"""Tests for local blog storage and editor actions."""

import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame

from main import BlogApp, BlogStore, HEIGHT, WIDTH


class BlogTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "posts.sqlite3"
        self.store = BlogStore(self.path)

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()
        pygame.quit()

    def test_save_search_edit_delete_and_reopen(self) -> None:
        post_id = self.store.save(None, " First post ", " travel, , Life ", "A little story")
        self.store.save(None, "Other", "music", "Another post")
        for query in ("first", "TRAVEL", "STORY"):
            self.assertEqual([post.id for post in self.store.list_posts(query)], [post_id])
        self.assertEqual(self.store.list_posts("travel")[0].tags, "travel, Life")
        self.store.save(post_id, "New title", "updated", "Changed")
        self.assertEqual(self.store.list_posts("updated")[0].body, "Changed")
        self.store.close()
        self.store = BlogStore(self.path)
        self.assertEqual(self.store.list_posts("new title")[0].id, post_id)
        self.store.delete(post_id)
        self.assertEqual(self.store.list_posts("new title"), [])

    def test_reject_empty_title_and_missing_posts(self) -> None:
        with self.assertRaises(ValueError):
            self.store.save(None, "  ", "", "text")
        with self.assertRaises(ValueError):
            self.store.save(99, "title", "", "")
        with self.assertRaises(ValueError):
            self.store.delete(99)
        self.assertEqual(self.store.list_posts(), [])

    def test_editor_save_switch_confirmation_delete_and_render(self) -> None:
        pygame.init()
        app = BlogApp(pygame.display.set_mode((WIDTH, HEIGHT)), self.store)
        app.edit("A title")
        app.focus = "body"
        app.edit("First line\nSecond line")
        app.draw()
        app.save_post()
        post_id = app.post_id
        self.assertIsNotNone(post_id)
        self.assertFalse(app.dirty())
        app.edit(" with changes")
        app.request_switch(app.new_post)
        self.assertIsNotNone(app.confirm_action)
        app.draw()
        app.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=app.no_rect.center))
        self.assertEqual(app.post_id, post_id)
        self.assertTrue(app.dirty())
        app.request_switch(app.new_post)
        app.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=app.yes_rect.center))
        self.assertIsNone(app.post_id)
        app.open_post(self.store.list_posts()[0])
        self.assertEqual(app.values["body"], "First line\nSecond line")
        app.request_delete()
        app.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=app.yes_rect.center))
        self.assertEqual(self.store.list_posts(), [])

    def test_search_filters_immediately(self) -> None:
        self.store.save(None, "First", "cake", "Hello")
        self.store.save(None, "Second", "tea", "World")
        pygame.init()
        app = BlogApp(pygame.display.set_mode((WIDTH, HEIGHT)), self.store)
        app.focus = "search"
        app.edit("cake")
        self.assertEqual([post.title for post in app.posts], ["First"])

    def test_edit_in_middle_of_existing_post(self) -> None:
        post_id = self.store.save(None, "Hello world", "", "Body text")
        pygame.init()
        app = BlogApp(pygame.display.set_mode((WIDTH, HEIGHT)), self.store)
        app.open_post(self.store.list_posts()[0])
        app.focus = "title"
        for _ in range(5):
            app.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_LEFT, mod=0))
        app.edit("beautiful ")
        app.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_BACKSPACE, mod=0))
        app.save_post()
        self.assertEqual(self.store.list_posts()[0].title, "Hello beautifulworld")
        self.assertEqual(app.post_id, post_id)


if __name__ == "__main__":
    unittest.main()
