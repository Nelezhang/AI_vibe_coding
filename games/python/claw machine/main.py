"""A colorful, self-contained claw machine game."""

from __future__ import annotations

import math
import json
import os
import random
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pygame

WIDTH, HEIGHT = 1080, 720
FPS = 60
PLAY_LEFT, PLAY_RIGHT = 130, 730
RAIL_Y = 158
REST_Y = 215
BOTTOM_Y = 510
CHUTE_X = 164
CLAW_SPEED = 300
VERTICAL_SPEED = 240
RETURN_SPEED = 300
STARTING_PLAYS = 30
GRAB_RADIUS = 25
CAPSULE_COLUMNS = 9
CAPSULE_ROWS = 3
CAPSULE_COUNT = CAPSULE_COLUMNS * CAPSULE_ROWS

NAVY = (22, 31, 57)
WHITE = (247, 248, 255)
MUTED = (150, 164, 191)
MINT = (126, 241, 203)
PINK = (255, 116, 161)
GOLD = (255, 204, 104)

RARITIES = {
    "Common": (44.5, 100, (201, 214, 225)),
    "Uncommon": (25, 175, (135, 231, 153)),
    "Rare": (15, 250, (110, 195, 255)),
    "Epic": (8, 500, (208, 155, 255)),
    "Legendary": (4, 1000, (255, 208, 110)),
    "Mythic": (2, 2000, (255, 133, 165)),
    "Cosmic": (1, 5000, (122, 245, 231)),
    "Supernatural": (0.5, 10000, (255, 222, 110)),
    "Celestial": (0.8, 20000, (103, 224, 255)),
    "Abyssal": (0.2, 50000, (153, 113, 231)),
    "Eternal": (0.05, 1000000, (255, 105, 110)),
}

SHOP = {
    "Celestial": (20000, "Sky blue"),
    "Abyssal": (200000, "Deep purple"),
    "Eternal": (100000000, "Ruby red"),
}
BASE_RARITIES = tuple(name for name in RARITIES if name not in SHOP)
SAVE_PATH = Path.home() / ".lucky_claw" / "progress.json"


@dataclass(frozen=True)
class ToyType:
    name: str
    color: tuple[int, int, int]
    kind: str
    rarity: str


PRIZE_TYPES = (
    ToyType("Bunny", (249, 167, 195), "bunny", "Common"),
    ToyType("Frog", (122, 214, 138), "frog", "Common"),
    ToyType("Bear", (224, 172, 119), "bear", "Common"),
    ToyType("Kitten", (177, 160, 237), "cat", "Common"),
    ToyType("Duck", (255, 218, 112), "duck", "Common"),
    ToyType("Panda", (228, 237, 237), "panda", "Common"),
    ToyType("Mouse", (200, 190, 195), "mouse", "Common"),
    ToyType("Piglet", (250, 178, 191), "pig", "Common"),
    ToyType("Owl", (188, 156, 122), "owl", "Uncommon"),
    ToyType("Turtle", (132, 205, 154), "turtle", "Uncommon"),
    ToyType("Bee", (252, 208, 101), "bee", "Uncommon"),
    ToyType("Cloud", (211, 235, 248), "cloud", "Uncommon"),
    ToyType("Koala", (168, 188, 201), "koala", "Uncommon"),
    ToyType("Fox", (242, 155, 97), "fox", "Rare"),
    ToyType("Penguin", (128, 169, 205), "penguin", "Rare"),
    ToyType("Robot", (106, 203, 234), "robot", "Rare"),
    ToyType("Dinosaur", (115, 214, 164), "dino", "Rare"),
    ToyType("Octopus", (244, 149, 183), "octopus", "Rare"),
    ToyType("Shark", (122, 183, 210), "shark", "Rare"),
    ToyType("Unicorn", (242, 184, 255), "unicorn", "Epic"),
    ToyType("Dragon", (191, 131, 235), "dragon", "Epic"),
    ToyType("Space Alien", (130, 228, 202), "alien", "Epic"),
    ToyType("Phoenix", (255, 147, 100), "phoenix", "Epic"),
    ToyType("Wizard", (142, 149, 227), "wizard", "Epic"),
    ToyType("Golden Star", (255, 210, 105), "star", "Legendary"),
    ToyType("Moon Spirit", (255, 238, 168), "moon", "Legendary"),
    ToyType("Crowned Bear", (250, 195, 112), "crown", "Legendary"),
    ToyType("Sun Lion", (255, 182, 91), "lion", "Legendary"),
    ToyType("Crystal Whale", (142, 224, 242), "whale", "Mythic"),
    ToyType("Magic Mushroom", (255, 142, 177), "mushroom", "Mythic"),
    ToyType("Starlight Owl", (186, 168, 255), "starlight", "Mythic"),
    ToyType("Galaxy Cat", (117, 102, 210), "galaxy", "Cosmic"),
    ToyType("Comet", (128, 232, 240), "comet", "Cosmic"),
    ToyType("Cosmic Dragon", (119, 205, 215), "cosmic_dragon", "Cosmic"),
    ToyType("Spirit Fox", (235, 226, 255), "spirit_fox", "Supernatural"),
    ToyType("Ghost", (231, 251, 255), "ghost", "Supernatural"),
    ToyType("Magic Wisp", (174, 245, 232), "wisp", "Supernatural"),
    ToyType("Sky Dragon", (125, 221, 255), "dragon", "Celestial"),
    ToyType("Star Bunny", (156, 233, 255), "bunny", "Celestial"),
    ToyType("Abyss Cat", (118, 85, 177), "galaxy", "Abyssal"),
    ToyType("Deep Sea Whale", (104, 96, 188), "whale", "Abyssal"),
    ToyType("Eternal Phoenix", (255, 95, 107), "phoenix", "Eternal"),
    ToyType("Eternal Star", (255, 130, 120), "star", "Eternal"),
)


@dataclass
class Prize:
    name: str
    color: tuple[int, int, int]
    points: int
    kind: str
    rarity: str
    x: float
    y: float


class ClawMachine:
    def __init__(self, rng: random.Random | None = None, save_path: Path = SAVE_PATH) -> None:
        self.rng = rng if rng is not None else random.Random()
        self.save_path = save_path
        self.balance = 0
        self.unlocked: set[str] = set()
        self.save_error = ""
        self.shop_open = False
        self.shop_selection = 0
        self.load_progress()
        self.reset()

    def load_progress(self) -> None:
        try:
            with self.save_path.open(encoding="utf-8") as file:
                data = json.load(file)
        except FileNotFoundError:
            return
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Could not load progress from {self.save_path}: {error}") from error
        if (not isinstance(data, dict) or type(data.get("balance")) is not int
                or data["balance"] < 0 or not isinstance(data.get("unlocked"), list)
                or any(not isinstance(name, str) or name not in SHOP for name in data["unlocked"])):
            raise ValueError(f"Invalid progress file: {self.save_path}")
        self.balance = data["balance"]
        self.unlocked = set(data["unlocked"])

    def save_progress(self, balance: int, unlocked: set[str]) -> bool:
        temp_path: str | None = None
        try:
            self.save_path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.save_path.parent,
                                             delete=False) as file:
                temp_path = file.name
                json.dump({"balance": balance, "unlocked": sorted(unlocked)}, file)
            os.replace(temp_path, self.save_path)
        except OSError as error:
            self.save_error = f"Save failed: {error}"
            if temp_path is not None:
                try:
                    os.unlink(temp_path)
                except FileNotFoundError:
                    pass
            return False
        self.save_error = ""
        return True

    def buy_rarity(self, rarity: str) -> None:
        if rarity not in SHOP:
            self.message = "That rarity is not in the shop."
        elif rarity in self.unlocked:
            self.message = f"{rarity} is already unlocked."
        elif self.balance < SHOP[rarity][0]:
            self.message = f"Not enough points for {rarity}."
        else:
            balance = self.balance - SHOP[rarity][0]
            unlocked = self.unlocked | {rarity}
            if not self.save_progress(balance, unlocked):
                self.message = "Purchase failed: could not save progress."
                self.message_color = GOLD
                return
            self.balance, self.unlocked = balance, unlocked
            self.message = f"{rarity} unlocked! Press R for a new round."
        self.message_color = MINT

    def reset(self) -> None:
        self.plays = STARTING_PLAYS
        self.score = 0
        self.won: list[Prize] = []
        self.prizes: list[Prize] = []
        available = [name for name in RARITIES if name in BASE_RARITIES or name in self.unlocked]
        for index in range(CAPSULE_COUNT):
            rarity = self.rng.choices(available, weights=[RARITIES[name][0] for name in available])[0]
            toy = self.rng.choice([item for item in PRIZE_TYPES if item.rarity == rarity])
            row, column = divmod(index, CAPSULE_COLUMNS)
            x = 225 + column * 54
            y = 420 + row * 50
            self.prizes.append(Prize(toy.name, toy.color, RARITIES[rarity][1], toy.kind, rarity, x, y))
        self.claw_x = (PLAY_LEFT + PLAY_RIGHT) / 2
        self.claw_y = REST_Y
        self.state = "aim"
        self.target: Prize | None = None
        self.carried: Prize | None = None
        self.message = "Line up the claw and press SPACE!"
        self.message_color = MINT
        self.drop_timer = 0.0
        self.elapsed = 0.0

    def start_drop(self) -> None:
        if self.state != "aim" or self.plays <= 0:
            return
        self.plays -= 1
        candidates = [prize for prize in self.prizes if abs(prize.x - self.claw_x) <= GRAB_RADIUS]
        self.target = min(candidates, key=lambda prize: (prize.y, abs(prize.x - self.claw_x))) if candidates else None
        self.state = "descending"
        self.message = "Claw dropping..."
        self.message_color = WHITE

    def update(self, dt: float, left: bool = False, right: bool = False) -> None:
        if self.shop_open:
            return
        self.elapsed += dt
        if self.state == "aim":
            direction = int(right) - int(left)
            self.claw_x = max(PLAY_LEFT + 25, min(PLAY_RIGHT - 25, self.claw_x + direction * CLAW_SPEED * dt))
        elif self.state == "descending":
            stop_y = self.target.y - 35 if self.target else BOTTOM_Y
            self.claw_y = min(stop_y, self.claw_y + VERTICAL_SPEED * dt)
            if self.claw_y >= stop_y:
                if self.target is not None:
                    self.carried = self.target
                    self.prizes.remove(self.target)
                    self.message = "Capsule grabbed! What's inside?"
                    self.message_color = MINT
                else:
                    self.message = "Missed! Try lining up with a capsule."
                    self.message_color = GOLD
                self.target = None
                self.state = "rising"
        elif self.state == "rising":
            self.claw_y = max(REST_Y, self.claw_y - VERTICAL_SPEED * dt)
            if self.claw_y <= REST_Y:
                self.state = "returning" if self.carried else "aim"
                if self.state == "aim":
                    self.finish_turn(revealed=False)
        elif self.state == "returning":
            self.claw_x = max(CHUTE_X, self.claw_x - RETURN_SPEED * dt)
            if self.claw_x <= CHUTE_X:
                self.state = "dropping"
                self.drop_timer = 0.65
        elif self.state == "dropping":
            self.drop_timer -= dt
            if self.drop_timer <= 0:
                assert self.carried is not None
                prize = self.carried
                self.carried = None
                self.won.append(prize)
                self.score += prize.points
                self.balance += prize.points
                self.save_progress(self.balance, self.unlocked)
                self.message = f"{prize.rarity}: {prize.name}! +{prize.points} points"
                self.message_color = RARITIES[prize.rarity][2]
                self.state = "aim"
                self.finish_turn(revealed=True)

    def finish_turn(self, revealed: bool) -> None:
        if not self.prizes:
            self.state = "game_over"
            prize = self.won[-1]
            self.message = f"All collected! {prize.rarity} {prize.name} +{prize.points}"
            self.message_color = RARITIES[prize.rarity][2]
        elif self.plays == 0:
            self.state = "game_over"
            if revealed:
                prize = self.won[-1]
                self.message = f"{prize.rarity} {prize.name} +{prize.points}! Press R"
            else:
                self.message = "Out of plays! Press R for a new game."
            self.message_color = GOLD

    def handle_event(self, event: pygame.event.Event) -> bool:
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.KEYDOWN:
            if self.shop_open:
                if event.key in (pygame.K_ESCAPE, pygame.K_s):
                    self.shop_open = False
                elif event.key == pygame.K_UP:
                    self.shop_selection = (self.shop_selection - 1) % len(SHOP)
                elif event.key == pygame.K_DOWN:
                    self.shop_selection = (self.shop_selection + 1) % len(SHOP)
                elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                    self.buy_rarity(list(SHOP)[self.shop_selection])
                elif event.key == pygame.K_t:
                    if self.save_progress(self.balance, self.unlocked):
                        self.message = "Progress saved."
                        self.message_color = MINT
                return True
            if event.key == pygame.K_ESCAPE:
                return False
            if event.key == pygame.K_s and self.state in ("aim", "game_over"):
                self.shop_open = True
                return True
            if event.key == pygame.K_SPACE:
                self.start_drop()
            elif event.key == pygame.K_r:
                self.reset()
        return True


def rounded(surface: pygame.Surface, color: tuple[int, int, int], rect: pygame.Rect | tuple[int, int, int, int],
            radius: int = 12, width: int = 0) -> None:
    pygame.draw.rect(surface, color, rect, width=width, border_radius=radius)


def draw_text(surface: pygame.Surface, font: pygame.font.Font, text: str, color: tuple[int, int, int],
              pos: tuple[int, int], center: bool = False) -> None:
    image = font.render(text, True, color)
    surface.blit(image, image.get_rect(center=pos) if center else pos)


def draw_star(surface: pygame.Surface, color: tuple[int, int, int], x: int, y: int, radius: int) -> None:
    points = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        r = radius if index % 2 == 0 else radius * 0.48
        points.append((x + math.cos(angle) * r, y + math.sin(angle) * r))
    pygame.draw.polygon(surface, color, points)


def draw_capsule(surface: pygame.Surface, x: float, y: float, scale: float = 1.0,
                 *, supernatural: bool = False, rarity: str | None = None) -> None:
    """Draw an opaque shell, using special colors for special rarities."""
    sprite = pygame.Surface((86, 90), pygame.SRCALPHA)
    if supernatural:
        outline, edge, fill, band = (90, 58, 24), (210, 146, 42), (255, 214, 101), (177, 108, 35)
        line, highlight, button, button_inner = (111, 69, 25), (255, 245, 183), (128, 83, 30), (255, 230, 150)
    else:
        outline, edge, fill, band = (30, 42, 64), (146, 205, 220), (224, 245, 241), (85, 154, 183)
        line, highlight, button, button_inner = (35, 91, 122), (255, 255, 255), (70, 127, 153), (197, 232, 232)
        if rarity in SHOP:
            fill = RARITIES[rarity][2]
            edge = tuple(component * 3 // 4 for component in fill)
            band = tuple(component // 2 for component in fill)
    pygame.draw.ellipse(sprite, outline, (9, 8, 68, 75))
    pygame.draw.ellipse(sprite, edge, (12, 11, 62, 69))
    pygame.draw.ellipse(sprite, fill, (15, 14, 56, 61))
    pygame.draw.rect(sprite, band, (12, 43, 62, 8))
    pygame.draw.line(sprite, line, (13, 47), (73, 47), 3)
    pygame.draw.ellipse(sprite, highlight, (22, 21, 12, 20))
    pygame.draw.circle(sprite, button, (43, 47), 6)
    pygame.draw.circle(sprite, button_inner, (43, 47), 3)
    size = (max(1, round(86 * scale)), max(1, round(90 * scale)))
    scaled = pygame.transform.smoothscale(sprite, size)
    surface.blit(scaled, scaled.get_rect(center=(round(x), round(y))))


def draw_prize(surface: pygame.Surface, prize: Prize, x: float, y: float, scale: float = 1.0) -> None:
    sprite = pygame.Surface((86, 90), pygame.SRCALPHA)
    color = prize.color
    dark = (49, 50, 70)
    cream = (255, 241, 230)
    if prize.kind in ("star", "moon", "comet"):
        draw_star(sprite, (194, 131, 57), 43, 45, 37)
        draw_star(sprite, color, 43, 42, 34)
        if prize.kind == "moon":
            pygame.draw.circle(sprite, (255, 250, 212), (44, 43), 23)
            pygame.draw.circle(sprite, color, (55, 37), 19)
        elif prize.kind == "comet":
            pygame.draw.polygon(sprite, (139, 226, 255), [(15, 23), (4, 9), (34, 24), (28, 38)])
            pygame.draw.circle(sprite, (239, 255, 255), (43, 42), 16)
    elif prize.kind == "robot":
        rounded(sprite, dark, (13, 17, 60, 59), 12)
        rounded(sprite, color, (16, 20, 54, 53), 10)
        rounded(sprite, (46, 79, 108), (22, 27, 42, 25), 6)
        pygame.draw.line(sprite, dark, (43, 17), (43, 8), 4)
        pygame.draw.circle(sprite, GOLD, (43, 7), 5)
        pygame.draw.line(sprite, cream, (32, 62), (54, 62), 3)
    else:
        if prize.kind == "bunny":
            for ear_x in (27, 56):
                pygame.draw.ellipse(sprite, dark, (ear_x - 8, 2, 17, 37))
                pygame.draw.ellipse(sprite, color, (ear_x - 6, 4, 13, 32))
                pygame.draw.ellipse(sprite, (255, 215, 223), (ear_x - 3, 9, 7, 22))
        elif prize.kind in ("cat", "fox", "unicorn", "dragon", "cosmic_dragon", "galaxy", "owl", "starlight", "spirit_fox"):
            for ear_x in (19, 51):
                pygame.draw.polygon(sprite, dark, [(ear_x, 35), (ear_x + 4, 10), (ear_x + 22, 28)])
                pygame.draw.polygon(sprite, color, [(ear_x + 3, 31), (ear_x + 6, 15), (ear_x + 18, 28)])
        elif prize.kind in ("bear", "frog", "panda", "crown", "mouse", "koala", "pig"):
            for ear_x in (21, 61):
                pygame.draw.circle(sprite, dark, (ear_x, 25), 13)
                pygame.draw.circle(sprite, color, (ear_x, 25), 10)
                if prize.kind in ("bear", "panda", "crown", "mouse", "koala", "pig"):
                    pygame.draw.circle(sprite, cream, (ear_x, 25), 5)
        pygame.draw.ellipse(sprite, dark, (9, 21, 68, 61))
        pygame.draw.ellipse(sprite, color, (12, 23, 62, 56))
        pygame.draw.ellipse(sprite, cream, (30, 48, 26, 19))
        if prize.kind in ("duck", "penguin", "owl", "starlight", "phoenix"):
            pygame.draw.polygon(sprite, (241, 150, 66), [(33, 48), (53, 48), (43, 58)])
        if prize.kind in ("dino", "cosmic_dragon"):
            for spike_x in (27, 38, 49, 60):
                pygame.draw.polygon(sprite, (61, 143, 111), [(spike_x - 5, 25), (spike_x, 13), (spike_x + 5, 25)])
        if prize.kind == "alien":
            pygame.draw.line(sprite, dark, (28, 27), (22, 12), 3)
            pygame.draw.line(sprite, dark, (58, 27), (64, 12), 3)
            pygame.draw.circle(sprite, GOLD, (22, 11), 4)
            pygame.draw.circle(sprite, GOLD, (64, 11), 4)
        if prize.kind in ("unicorn", "crown"):
            if prize.kind == "unicorn":
                pygame.draw.polygon(sprite, GOLD, [(37, 26), (43, 4), (49, 26)])
            else:
                pygame.draw.polygon(sprite, GOLD, [(24, 27), (22, 10), (34, 20), (43, 6), (52, 20), (64, 10), (62, 27)])
        if prize.kind == "bee":
            pygame.draw.line(sprite, dark, (18, 30), (68, 30), 5)
            pygame.draw.line(sprite, dark, (16, 54), (70, 54), 5)
            pygame.draw.ellipse(sprite, (224, 245, 255), (8, 15, 18, 24))
            pygame.draw.ellipse(sprite, (224, 245, 255), (60, 15, 18, 24))
        elif prize.kind == "mushroom":
            pygame.draw.ellipse(sprite, (205, 76, 110), (7, 7, 72, 39))
            for spot_x in (23, 43, 63):
                pygame.draw.circle(sprite, WHITE, (spot_x, 23), 5)
        elif prize.kind == "wizard":
            pygame.draw.polygon(sprite, (82, 72, 153), [(18, 30), (42, 1), (64, 30)])
            draw_star(sprite, GOLD, 42, 19, 5)
        elif prize.kind == "lion":
            for mane_x in (17, 69):
                for mane_y in (29, 49, 66):
                    pygame.draw.circle(sprite, (190, 104, 49), (mane_x, mane_y), 7)
        elif prize.kind in ("galaxy", "starlight", "cosmic_dragon"):
            draw_star(sprite, GOLD, 22, 29, 5)
            draw_star(sprite, WHITE, 64, 27, 4)
        elif prize.kind == "shark":
            pygame.draw.polygon(sprite, (58, 110, 150), [(35, 25), (43, 5), (51, 25)])
        elif prize.kind == "whale":
            pygame.draw.ellipse(sprite, (175, 247, 255), (36, 4, 6, 15))
            pygame.draw.ellipse(sprite, (175, 247, 255), (46, 6, 6, 13))
        elif prize.kind == "octopus":
            for tentacle_x in (18, 30, 56, 68):
                pygame.draw.circle(sprite, color, (tentacle_x, 76), 7)
        elif prize.kind == "cloud":
            for cloud_x in (25, 43, 61):
                pygame.draw.circle(sprite, color, (cloud_x, 25), 13)
        elif prize.kind == "turtle":
            pygame.draw.ellipse(sprite, (68, 144, 99), (19, 22, 48, 23), 4)
        elif prize.kind == "pig":
            pygame.draw.ellipse(sprite, (245, 139, 158), (29, 47, 28, 19))
            for nostril_x in (37, 49):
                pygame.draw.circle(sprite, dark, (nostril_x, 55), 2)
        elif prize.kind == "phoenix":
            pygame.draw.polygon(sprite, GOLD, [(25, 26), (31, 8), (41, 22), (50, 5), (61, 26)])
        elif prize.kind == "spirit_fox":
            pygame.draw.polygon(sprite, (182, 170, 244), [(22, 53), (28, 62), (19, 61)])
            pygame.draw.polygon(sprite, (182, 170, 244), [(64, 53), (58, 62), (67, 61)])
        elif prize.kind == "ghost":
            pygame.draw.polygon(sprite, color, [(12, 64), (12, 84), (23, 76), (33, 84), (43, 76), (53, 84), (63, 76), (74, 84), (74, 64)])
        elif prize.kind == "wisp":
            draw_star(sprite, (87, 190, 184), 43, 18, 12)
    eye_y = 40 if prize.kind != "robot" else 38
    for eye_x in (32, 54):
        pygame.draw.circle(sprite, dark if prize.kind != "robot" else MINT, (eye_x, eye_y), 4)
        pygame.draw.circle(sprite, WHITE, (eye_x - 1, eye_y - 1), 1)
    if prize.kind != "robot":
        pygame.draw.arc(sprite, dark, (37, 46, 12, 10), math.pi, math.tau, 2)
        pygame.draw.circle(sprite, (255, 146, 162), (23, 48), 3)
        pygame.draw.circle(sprite, (255, 146, 162), (63, 48), 3)
    size = (max(1, round(86 * scale)), max(1, round(90 * scale)))
    scaled = pygame.transform.smoothscale(sprite, size)
    surface.blit(scaled, scaled.get_rect(center=(round(x), round(y))))


class GameView:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.small = pygame.font.SysFont("arial", 15)
        self.body = pygame.font.SysFont("arial", 18)
        self.bold = pygame.font.SysFont("arial", 21, bold=True)
        self.title = pygame.font.SysFont("arial", 37, bold=True)
        self.big = pygame.font.SysFont("arial", 48, bold=True)

    def draw(self, game: ClawMachine) -> None:
        screen = self.screen
        screen.fill((17, 23, 44))
        for index in range(28):
            x = (index * 173 + 45) % WIDTH
            y = (index * 113 + 22) % HEIGHT
            draw_star(screen, (39, 49, 77), x, y, 3 + index % 3)

        # Cabinet, illuminated marquee, glass, and front panel.
        rounded(screen, (10, 15, 29), (79, 47, 693, 645), 30)
        rounded(screen, (112, 67, 133), (72, 39, 693, 645), 30)
        rounded(screen, (226, 106, 153), (80, 46, 677, 629), 26)
        rounded(screen, (57, 46, 83), (95, 119, 647, 471), 15)
        rounded(screen, (24, 45, 66), (105, 129, 627, 451), 10)
        rounded(screen, (43, 73, 91), (111, 135, 615, 437), 8)
        pygame.draw.polygon(screen, (52, 86, 102), [(112, 136), (310, 136), (112, 348)])
        pygame.draw.line(screen, (87, 118, 130), (128, 155), (128, 448), 2)
        pygame.draw.ellipse(screen, (56, 95, 107), (195, 484, 497, 88))

        rounded(screen, (58, 45, 89), (96, 54, 646, 62), 14)
        rounded(screen, (255, 223, 177), (102, 59, 634, 51), 11)
        draw_text(screen, self.title, "THE LUCKY CLAW", (125, 62, 105), (420, 84), center=True)
        for x in range(115, 731, 35):
            light = GOLD if (int(game.elapsed * 3) + x // 35) % 2 else WHITE
            pygame.draw.circle(screen, light, (x, 65), 3)
            pygame.draw.circle(screen, light, (x, 108), 3)

        # The chute is separate from the prize bed, so the claw can carry prizes to it.
        rounded(screen, (26, 34, 52), (121, 474, 87, 104), 9)
        rounded(screen, (14, 21, 37), (129, 482, 71, 90), 7)
        draw_text(screen, self.small, "PRIZE", GOLD, (164, 551), center=True)
        for prize in game.prizes:
            draw_capsule(screen, prize.x, prize.y, 0.62, supernatural=prize.rarity == "Supernatural",
                         rarity=prize.rarity)

        pygame.draw.line(screen, (29, 40, 60), (136, RAIL_Y + 4), (714, RAIL_Y + 4), 12)
        pygame.draw.line(screen, (174, 193, 205), (136, RAIL_Y), (714, RAIL_Y), 6)
        x, y = round(game.claw_x), round(game.claw_y)
        rounded(screen, (32, 42, 62), (x - 29, RAIL_Y - 10, 58, 24), 7)
        rounded(screen, (196, 211, 217), (x - 24, RAIL_Y - 8, 48, 18), 6)
        pygame.draw.line(screen, (25, 32, 47), (x, RAIL_Y + 8), (x, y), 6)
        pygame.draw.line(screen, (193, 207, 212), (x - 1, RAIL_Y + 8), (x - 1, y), 2)
        closed = game.carried is not None and game.state != "dropping"
        spread = 19 if closed else 30
        pygame.draw.lines(screen, (31, 38, 55), False, [(x - 12, y + 8), (x - spread, y + 32), (x - spread + 7, y + 46)], 9)
        pygame.draw.lines(screen, (31, 38, 55), False, [(x + 12, y + 8), (x + spread, y + 32), (x + spread - 7, y + 46)], 9)
        pygame.draw.lines(screen, (207, 220, 223), False, [(x - 12, y + 8), (x - spread, y + 32), (x - spread + 7, y + 46)], 5)
        pygame.draw.lines(screen, (207, 220, 223), False, [(x + 12, y + 8), (x + spread, y + 32), (x + spread - 7, y + 46)], 5)
        rounded(screen, (34, 45, 65), (x - 20, y - 9, 40, 27), 8)
        rounded(screen, (213, 225, 228), (x - 17, y - 7, 34, 21), 6)
        pygame.draw.circle(screen, PINK, (x, y + 3), 5)
        if game.carried:
            offset = (0.65 - game.drop_timer) * 125 if game.state == "dropping" else 0
            draw_capsule(screen, x, y + 54 + offset, 0.62, supernatural=game.carried.rarity == "Supernatural",
                         rarity=game.carried.rarity)

        rounded(screen, (77, 47, 83), (98, 594, 641, 73), 12)
        rounded(screen, (39, 45, 68), (108, 604, 621, 53), 9)
        pygame.draw.circle(screen, (167, 62, 94), (680, 630), 22)
        pygame.draw.circle(screen, PINK, (680, 625), 19)
        draw_text(screen, self.bold, game.message, game.message_color, (127, 621))

        self.draw_panel(game)
        if game.shop_open:
            self.draw_shop(game)
        elif game.save_error:
            draw_text(screen, self.small, "SAVE FAILED - press S, then T to retry", GOLD, (120, 682))
        pygame.display.flip()

    def draw_shop(self, game: ClawMachine) -> None:
        screen = self.screen
        shade = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        shade.fill((5, 10, 25, 210))
        screen.blit(shade, (0, 0))
        rounded(screen, (45, 58, 85), (180, 90, 720, 550), 22)
        draw_text(screen, self.title, "RARITY SHOP", WHITE, (215, 110))
        draw_text(screen, self.bold, f"Points: {game.balance:,}", GOLD, (215, 160))
        draw_text(screen, self.body, "Unlock rarities for future rounds. Toys stay hidden!", WHITE, (215, 198))
        for index, (rarity, (price, color_name)) in enumerate(SHOP.items()):
            y = 247 + index * 80
            rounded(screen, (78, 93, 120) if index == game.shop_selection else (34, 43, 68),
                    (215, y - 10, 650, 68), 10)
            draw_capsule(screen, 247, y + 23, 0.5, rarity=rarity)
            draw_text(screen, self.bold, rarity, RARITIES[rarity][2], (280, y))
            draw_text(screen, self.small, f"{color_name} capsule", WHITE, (280, y + 27))
            label = "UNLOCKED" if rarity in game.unlocked else f"{price:,} points"
            draw_text(screen, self.body, label, GOLD, (630, y + 12))
        draw_text(screen, self.body, game.message, MINT, (215, 500))
        draw_text(screen, self.small, "UP / DOWN: select    ENTER: buy    S / ESC: close    T: retry save",
                  WHITE, (215, 540))
        if game.save_error:
            draw_text(screen, self.small, "SAVE FAILED: progress may be lost. Press T to retry.", GOLD, (215, 570))
            draw_text(screen, self.small, game.save_error[:90], GOLD, (215, 590))

    def draw_panel(self, game: ClawMachine) -> None:
        screen = self.screen
        rounded(screen, (34, 43, 68), (795, 46, 248, 629), 22)
        rounded(screen, (45, 58, 85), (806, 57, 226, 607), 17)
        draw_text(screen, self.small, "ARCADE / 01", MINT, (825, 77))
        draw_text(screen, self.title, "PRIZE", WHITE, (822, 102))
        draw_text(screen, self.title, "PALACE", PINK, (822, 137))
        pygame.draw.line(screen, (84, 100, 127), (824, 188), (1014, 188), 2)
        draw_text(screen, self.small, "PLAYS LEFT", MUTED, (825, 206))
        draw_text(screen, self.big, str(game.plays), GOLD, (821, 223))
        draw_text(screen, self.small, "POINTS", MUTED, (928, 206))
        draw_text(screen, self.small, f"{game.balance:,}", WHITE, (928, 238))
        pygame.draw.line(screen, (84, 100, 127), (824, 289), (1014, 289), 2)
        draw_text(screen, self.bold, "HOW TO PLAY", WHITE, (824, 305))
        for index, line in enumerate(("A / D or arrows: move", "SPACE: drop the claw", "S: rarity shop", "R: new round  ESC: quit")):
            draw_text(screen, self.small, line, (200, 213, 229), (825, 339 + index * 25))
        pygame.draw.line(screen, (84, 100, 127), (824, 450), (1014, 450), 2)
        draw_text(screen, self.bold, f"COLLECTION  {len(game.won)}/{CAPSULE_COUNT}", WHITE, (824, 466))
        if not game.won:
            draw_text(screen, self.small, "Your prizes appear here!", MUTED, (825, 506))
        else:
            draw_text(screen, self.small, "Most recent prizes", MUTED, (825, 493))
        for index, prize in enumerate(game.won[-8:]):
            x = 845 + (index % 4) * 48
            y = 525 + (index // 4) * 47
            draw_prize(screen, prize, x, y, 0.43)
            pygame.draw.circle(screen, RARITIES[prize.rarity][2], (x + 17, y + 16), 4)
        if game.state == "game_over":
            draw_text(screen, self.small, "PRESS R TO PLAY AGAIN", GOLD, (825, 634))
        else:
            draw_text(screen, self.small, f"Round score: {game.score:,}", MUTED, (825, 634))


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("The Lucky Claw")
    clock = pygame.time.Clock()
    game = ClawMachine()
    view = GameView(screen)
    running = True
    while running:
        dt = min(clock.tick(FPS) / 1000, 0.05)
        for event in pygame.event.get():
            if not game.handle_event(event):
                running = False
        keys = pygame.key.get_pressed()
        game.update(dt, keys[pygame.K_LEFT] or keys[pygame.K_a], keys[pygame.K_RIGHT] or keys[pygame.K_d])
        view.draw(game)
    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
