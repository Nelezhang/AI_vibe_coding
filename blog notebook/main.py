"""A local-first blog notebook with a Pygame interface."""

from __future__ import annotations

import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

import pygame

WIDTH, HEIGHT = 1200, 760
SIDEBAR = pygame.Rect(28, 102, 335, 625)
EDITOR = pygame.Rect(383, 102, 789, 625)
DB_PATH = Path.home() / ".blog-notebook" / "posts.sqlite3"

BG = (14, 21, 37)
PANEL = (25, 35, 54)
CARD = (35, 48, 69)
FIELD = (18, 28, 44)
WHITE = (238, 244, 250)
MUTED = (150, 166, 186)
MINT = (126, 226, 190)
GOLD = (246, 198, 117)
RED = (255, 135, 140)
OUTLINE = (67, 83, 106)


@dataclass(frozen=True)
class Post:
    id: int
    title: str
    tags: str
    body: str
    updated: str


class BlogStore:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute(
            """CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                tags TEXT NOT NULL,
                body TEXT NOT NULL,
                updated TEXT NOT NULL
            )"""
        )
        self.connection.commit()

    def list_posts(self, query: str = "") -> list[Post]:
        rows = self.connection.execute(
            """SELECT id, title, tags, body, updated FROM posts
               WHERE instr(lower(title), lower(?)) > 0
                  OR instr(lower(tags), lower(?)) > 0
                  OR instr(lower(body), lower(?)) > 0
               ORDER BY updated DESC, id DESC""",
            (query, query, query),
        ).fetchall()
        return [Post(**dict(row)) for row in rows]

    def save(self, post_id: int | None, title: str, tags: str, body: str) -> int:
        title = title.strip()
        if not title:
            raise ValueError("Please give your post a title.")
        clean_tags = ", ".join(tag.strip() for tag in tags.split(",") if tag.strip())
        updated = datetime.now().astimezone().isoformat(timespec="microseconds")
        with self.connection:
            if post_id is None:
                cursor = self.connection.execute(
                    "INSERT INTO posts (title, tags, body, updated) VALUES (?, ?, ?, ?)",
                    (title, clean_tags, body, updated),
                )
                assert cursor.lastrowid is not None
                return cursor.lastrowid
            cursor = self.connection.execute(
                "UPDATE posts SET title = ?, tags = ?, body = ?, updated = ? WHERE id = ?",
                (title, clean_tags, body, updated, post_id),
            )
            if cursor.rowcount != 1:
                raise ValueError("This post no longer exists in the database.")
            return post_id

    def delete(self, post_id: int) -> None:
        with self.connection:
            cursor = self.connection.execute("DELETE FROM posts WHERE id = ?", (post_id,))
            if cursor.rowcount != 1:
                raise ValueError("This post no longer exists in the database.")

    def close(self) -> None:
        self.connection.close()


def wrap_text(text: str, font: pygame.font.Font, width: int) -> list[str]:
    """Wrap text without losing blank lines or hiding long words."""
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        remaining = paragraph
        while font.size(remaining)[0] > width:
            cut = len(remaining)
            while cut > 1 and font.size(remaining[:cut])[0] > width:
                cut -= 1
            space = remaining.rfind(" ", 0, cut)
            if space > 0:
                cut = space + 1
            lines.append(remaining[:cut])
            remaining = remaining[cut:]
        lines.append(remaining)
    return lines


class BlogApp:
    def __init__(self, screen: pygame.Surface, store: BlogStore) -> None:
        self.screen = screen
        self.store = store
        self.font = pygame.font.SysFont("arial", 18)
        self.small = pygame.font.SysFont("arial", 14)
        self.bold = pygame.font.SysFont("arial", 19, bold=True)
        self.heading = pygame.font.SysFont("arial", 27, bold=True)
        self.title_font = pygame.font.SysFont("arial", 34, bold=True)
        self.post_id: int | None = None
        self.values = {"search": "", "title": "", "tags": "", "body": ""}
        self.cursors = {name: 0 for name in self.values}
        self.saved = ("", "", "")
        self.focus = "title"
        self.posts: list[Post] = []
        self.list_offset = 0
        self.body_offset = 0
        self.notice = "Your posts are saved on this computer."
        self.notice_color = MUTED
        self.confirm_message = ""
        self.confirm_action: Callable[[], None] | None = None
        self.running = True
        self.search_rect = pygame.Rect(46, 159, 299, 42)
        self.title_rect = pygame.Rect(408, 186, 739, 45)
        self.tags_rect = pygame.Rect(408, 271, 739, 43)
        self.body_rect = pygame.Rect(408, 352, 739, 264)
        self.new_rect = pygame.Rect(245, 114, 100, 34)
        self.save_rect = pygame.Rect(1020, 656, 127, 44)
        self.delete_rect = pygame.Rect(408, 656, 115, 44)
        self.yes_rect = pygame.Rect(640, 418, 130, 42)
        self.no_rect = pygame.Rect(793, 418, 130, 42)
        self.refresh()
        pygame.key.start_text_input()

    def refresh(self) -> bool:
        try:
            self.posts = self.store.list_posts(self.values["search"].strip())
            self.list_offset = min(self.list_offset, max(0, len(self.posts) - 6))
            return True
        except sqlite3.Error as error:
            self.set_notice(f"Database error: {error}", RED)
            return False

    def set_notice(self, text: str, color: tuple[int, int, int] = MINT) -> None:
        self.notice, self.notice_color = text, color

    def snapshot(self) -> tuple[str, str, str]:
        return self.values["title"], self.values["tags"], self.values["body"]

    def dirty(self) -> bool:
        return self.snapshot() != self.saved

    def confirm(self, message: str, action: Callable[[], None]) -> None:
        self.confirm_message = message
        self.confirm_action = action

    def request_switch(self, action: Callable[[], None]) -> None:
        if self.dirty():
            self.confirm("Discard your unsaved changes?", action)
        else:
            action()

    def new_post(self) -> None:
        self.post_id = None
        self.values.update(title="", tags="", body="")
        self.cursors.update(title=0, tags=0, body=0)
        self.saved = self.snapshot()
        self.focus = "title"
        self.body_offset = 0
        self.set_notice("New post. Write a title and start typing.", MUTED)

    def open_post(self, post: Post) -> None:
        self.post_id = post.id
        self.values.update(title=post.title, tags=post.tags, body=post.body)
        self.cursors.update(title=len(post.title), tags=len(post.tags), body=len(post.body))
        self.saved = self.snapshot()
        self.focus = "body"
        self.body_offset = 0
        self.set_notice("Post opened.", MUTED)

    def save_post(self) -> None:
        try:
            self.post_id = self.store.save(self.post_id, *self.snapshot())
            self.values["title"] = self.values["title"].strip()
            self.values["tags"] = ", ".join(tag.strip() for tag in self.values["tags"].split(",") if tag.strip())
            for name in ("title", "tags"):
                self.cursors[name] = min(self.cursors[name], len(self.values[name]))
            self.saved = self.snapshot()
            if self.refresh():
                self.set_notice("Post saved.")
        except (sqlite3.Error, ValueError, OSError) as error:
            self.set_notice(f"Could not save: {error}", RED)

    def request_delete(self) -> None:
        if self.post_id is None:
            self.set_notice("Save this post before deleting it.", GOLD)
            return
        self.confirm("Delete this post permanently?", self.delete_post)

    def delete_post(self) -> None:
        if self.post_id is None:
            return
        try:
            self.store.delete(self.post_id)
            self.new_post()
            if self.refresh():
                self.set_notice("Post deleted.")
        except (sqlite3.Error, ValueError, OSError) as error:
            self.set_notice(f"Could not delete: {error}", RED)

    def edit(self, text: str) -> None:
        if self.focus not in self.values:
            return
        if self.focus != "body":
            text = text.replace("\n", "").replace("\r", "")
        limit = {"title": 150, "tags": 200, "search": 100, "body": 50000}[self.focus]
        value = self.values[self.focus]
        cursor = self.cursors[self.focus]
        text = text[:max(0, limit - len(value))]
        self.values[self.focus] = value[:cursor] + text + value[cursor:]
        self.cursors[self.focus] += len(text)
        if self.focus == "search":
            self.list_offset = 0
            self.refresh()
        elif self.focus == "body":
            self.reveal_body_cursor()

    def body_cursor_line(self) -> int:
        before_cursor = self.values["body"][:self.cursors["body"]]
        return len(wrap_text(before_cursor, self.font, self.body_rect.width - 26)) - 1

    def reveal_body_cursor(self) -> None:
        line = self.body_cursor_line()
        if line < self.body_offset:
            self.body_offset = line
        elif line >= self.body_offset + 11:
            self.body_offset = line - 10

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.QUIT:
            if self.confirm_action is None:
                self.request_switch(lambda: setattr(self, "running", False))
            return
        if self.confirm_action is not None:
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                self.confirm_action = None
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if self.yes_rect.collidepoint(event.pos):
                    action = self.confirm_action
                    self.confirm_action = None
                    action()
                elif self.no_rect.collidepoint(event.pos):
                    self.confirm_action = None
            return
        if event.type == pygame.TEXTINPUT:
            self.edit(event.text)
        elif event.type == pygame.KEYDOWN:
            ctrl = bool(event.mod & (pygame.KMOD_CTRL | pygame.KMOD_META))
            if ctrl and event.key == pygame.K_s:
                self.save_post()
            elif event.key == pygame.K_BACKSPACE:
                cursor = self.cursors[self.focus]
                if cursor:
                    value = self.values[self.focus]
                    self.values[self.focus] = value[:cursor - 1] + value[cursor:]
                    self.cursors[self.focus] -= 1
                if self.focus == "search":
                    self.list_offset = 0
                    self.refresh()
                elif self.focus == "body":
                    self.reveal_body_cursor()
            elif event.key == pygame.K_DELETE:
                cursor = self.cursors[self.focus]
                value = self.values[self.focus]
                self.values[self.focus] = value[:cursor] + value[cursor + 1:]
                if self.focus == "search":
                    self.list_offset = 0
                    self.refresh()
            elif event.key in (pygame.K_LEFT, pygame.K_RIGHT, pygame.K_HOME, pygame.K_END):
                cursor = self.cursors[self.focus]
                value = self.values[self.focus]
                if event.key == pygame.K_LEFT:
                    cursor = max(0, cursor - 1)
                elif event.key == pygame.K_RIGHT:
                    cursor = min(len(value), cursor + 1)
                elif event.key == pygame.K_HOME:
                    cursor = value.rfind("\n", 0, cursor) + 1
                else:
                    next_line = value.find("\n", cursor)
                    cursor = next_line if next_line != -1 else len(value)
                self.cursors[self.focus] = cursor
                if self.focus == "body":
                    self.reveal_body_cursor()
            elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER) and self.focus == "body":
                self.edit("\n")
            elif event.key == pygame.K_TAB:
                order = ["title", "tags", "body", "search"]
                self.focus = order[(order.index(self.focus) + 1) % len(order)]
            elif event.key == pygame.K_ESCAPE:
                self.request_switch(lambda: setattr(self, "running", False))
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.new_rect.collidepoint(event.pos):
                self.request_switch(self.new_post)
            elif self.save_rect.collidepoint(event.pos):
                self.save_post()
            elif self.delete_rect.collidepoint(event.pos):
                self.request_delete()
            else:
                for field, rect in (("search", self.search_rect), ("title", self.title_rect),
                                    ("tags", self.tags_rect), ("body", self.body_rect)):
                    if rect.collidepoint(event.pos):
                        self.focus = field
                        break
                else:
                    for index, post in enumerate(self.posts[self.list_offset:self.list_offset + 6]):
                        if pygame.Rect(46, 235 + index * 75, 299, 66).collidepoint(event.pos):
                            self.request_switch(lambda post=post: self.open_post(post))
                            break
        elif event.type == pygame.MOUSEWHEEL:
            mouse = pygame.mouse.get_pos()
            if SIDEBAR.collidepoint(mouse):
                self.list_offset = max(0, min(max(0, len(self.posts) - 6), self.list_offset - event.y))
            elif self.body_rect.collidepoint(mouse):
                max_offset = max(0, len(wrap_text(self.values["body"], self.font, self.body_rect.width - 26)) - 11)
                self.body_offset = max(0, min(max_offset, self.body_offset - event.y * 3))

    def text(self, value: str, pos: tuple[int, int], color: tuple[int, int, int] = WHITE,
             font: pygame.font.Font | None = None, max_width: int | None = None) -> None:
        font = font or self.font
        if max_width is not None and font.size(value)[0] > max_width:
            while value and font.size(value + "...")[0] > max_width:
                value = value[:-1]
            value += "..."
        self.screen.blit(font.render(value, True, color), pos)

    def button(self, rect: pygame.Rect, label: str, background: tuple[int, int, int],
               color: tuple[int, int, int] = WHITE) -> None:
        pygame.draw.rect(self.screen, background, rect, border_radius=8)
        image = self.bold.render(label, True, color)
        self.screen.blit(image, image.get_rect(center=rect.center))

    def field(self, name: str, rect: pygame.Rect, placeholder: str) -> None:
        pygame.draw.rect(self.screen, FIELD, rect, border_radius=8)
        pygame.draw.rect(self.screen, MINT if self.focus == name else OUTLINE, rect, width=2, border_radius=8)
        value = self.values[name]
        if name == "body":
            lines = wrap_text(value, self.font, rect.width - 26) if value else [placeholder]
            color = WHITE if value else MUTED
            for index, line in enumerate(lines[self.body_offset:self.body_offset + 11]):
                self.text(line, (rect.x + 12, rect.y + 10 + index * 22), color)
            if self.focus == name:
                before = self.values[name][:self.cursors[name]]
                cursor_lines = wrap_text(before, self.font, rect.width - 26)
                line_index = len(cursor_lines) - 1 - self.body_offset
                if 0 <= line_index < 11:
                    x = rect.x + 12 + self.font.size(cursor_lines[-1])[0]
                    y = rect.y + 10 + line_index * 22
                    pygame.draw.line(self.screen, MINT, (x, y), (x, y + 18), 2)
        else:
            start = 0
            cursor = self.cursors[name]
            while start < cursor and self.font.size(value[start:cursor])[0] > rect.width - 30:
                start += 1
            display = value[start:]
            while display and self.font.size(display)[0] > rect.width - 27:
                display = display[:-1]
            self.text(display or placeholder, (rect.x + 12, rect.y + 12), WHITE if value else MUTED)
            if self.focus == name:
                x = rect.x + 12 + self.font.size(value[start:cursor])[0]
                pygame.draw.line(self.screen, MINT, (x, rect.y + 11), (x, rect.y + 30), 2)

    def draw(self) -> None:
        self.screen.fill(BG)
        self.text("THE BLOG NOTEBOOK", (30, 25), WHITE, self.title_font)
        self.text("A little space for your big ideas.", (33, 66), MUTED, self.small)
        self.text("LOCAL  /  PRIVATE  /  YOURS", (944, 43), MINT, self.small)
        pygame.draw.rect(self.screen, PANEL, SIDEBAR, border_radius=14)
        pygame.draw.rect(self.screen, PANEL, EDITOR, border_radius=14)
        self.text("YOUR POSTS", (46, 121), WHITE, self.bold)
        self.button(self.new_rect, "+ New", (49, 104, 92))
        self.field("search", self.search_rect, "Search posts or tags...")
        self.text(f"{len(self.posts)} POST{'S' if len(self.posts) != 1 else ''}", (47, 211), MUTED, self.small)
        if not self.posts:
            self.text("No posts found.", (49, 259), MUTED)
        for index, post in enumerate(self.posts[self.list_offset:self.list_offset + 6]):
            rect = pygame.Rect(46, 235 + index * 75, 299, 66)
            pygame.draw.rect(self.screen, CARD if post.id != self.post_id else (45, 80, 77), rect, border_radius=8)
            self.text(post.title, (rect.x + 12, rect.y + 9), WHITE, self.bold, 275)
            subtitle = post.tags or "Untagged"
            self.text(subtitle, (rect.x + 12, rect.y + 39), MINT if post.tags else MUTED, self.small, 275)
        if len(self.posts) > 6:
            self.text("Scroll to see more posts", (48, 692), MUTED, self.small)

        self.text("EDIT POST" if self.post_id else "NEW POST", (408, 120), WHITE, self.heading)
        if self.dirty():
            self.text("UNSAVED CHANGES", (994, 129), GOLD, self.small)
        self.text("TITLE", (408, 164), MUTED, self.small)
        self.field("title", self.title_rect, "Give your story a title...")
        self.text("TAGS  /  SEPARATE WITH COMMAS", (408, 248), MUTED, self.small)
        self.field("tags", self.tags_rect, "e.g. travel, ideas, life")
        self.text("YOUR STORY", (408, 329), MUTED, self.small)
        self.field("body", self.body_rect, "Start writing here...")
        self.text("Arrow keys move the cursor. Scroll to read longer posts.", (409, 625), MUTED, self.small)
        self.button(self.delete_rect, "Delete", (104, 55, 66))
        self.button(self.save_rect, "Save post", MINT, BG)
        self.text(self.notice, (540, 671), self.notice_color, self.small, 465)

        if self.confirm_action is not None:
            shade = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            shade.fill((5, 10, 20, 190))
            self.screen.blit(shade, (0, 0))
            rect = pygame.Rect(478, 299, 492, 187)
            pygame.draw.rect(self.screen, CARD, rect, border_radius=14)
            self.text("ARE YOU SURE?", (505, 321), WHITE, self.heading)
            self.text(self.confirm_message, (505, 372), WHITE)
            self.button(self.yes_rect, "Yes", (152, 74, 83))
            self.button(self.no_rect, "Cancel", (75, 91, 112))
        pygame.display.flip()


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("The Blog Notebook")
    try:
        store = BlogStore(DB_PATH)
    except (sqlite3.Error, OSError) as error:
        pygame.quit()
        print(f"Could not open blog database at {DB_PATH}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    app = BlogApp(screen, store)
    clock = pygame.time.Clock()
    try:
        while app.running:
            clock.tick(60)
            for event in pygame.event.get():
                app.handle_event(event)
            app.draw()
    finally:
        store.close()
        pygame.quit()


if __name__ == "__main__":
    main()
