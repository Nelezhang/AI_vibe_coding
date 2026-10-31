"""An endless obstacle course built with Pygame. Every level is harder than the last."""

from __future__ import annotations

import math
import random
import sys
from dataclasses import dataclass

import pygame

pygame.init()

SCREEN_WIDTH = 1000
SCREEN_HEIGHT = 700
PANEL_WIDTH = 260
FIELD_WIDTH = SCREEN_WIDTH - PANEL_WIDTH
FPS = 60
TRACK_LEFT = 55
TRACK_WIDTH = 630
LANE_WIDTH = TRACK_WIDTH / 3
PLAYER_Y = 505
PLAYER_WIDTH = 42
PLAYER_HEIGHT = 58
OBSTACLE_WIDTH = 138
JUMP_DURATION = 0.78
JUMP_HEIGHT = 112
MOVE_SPEED = 380
LEVEL_REWARD = 100

INK = (14, 20, 36)
PANEL = (22, 31, 51)
PANEL_HI = (31, 44, 68)
WHITE = (242, 247, 255)
MUTED = (150, 164, 188)
MINT = (103, 241, 190)
GOLD = (255, 207, 105)
RED = (255, 106, 127)
TRACK = (42, 55, 77)
TRACK_EDGE = (82, 102, 132)

SKINS = [
    {"name": "Classic", "price": 0, "color": (94, 206, 255), "accent": (225, 247, 255), "style": "robot"},
    {"name": "Ocean", "price": 100, "color": (38, 139, 211), "accent": (162, 245, 255), "style": "shark"},
    {"name": "Lime", "price": 350, "color": (107, 226, 112), "accent": (218, 255, 140), "style": "dino"},
    {"name": "Sunset", "price": 900, "color": (255, 123, 92), "accent": (255, 213, 122), "style": "phoenix"},
    {"name": "Royal", "price": 2500, "color": (172, 100, 255), "accent": (255, 218, 102), "style": "knight"},
    {"name": "Galaxy", "price": 10000, "color": (255, 76, 195), "accent": (120, 241, 255), "style": "alien"},
]

screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Infinite Obstacle Course")
clock = pygame.time.Clock()
FONT = pygame.font.SysFont("arial", 17)
FONT_SMALL = pygame.font.SysFont("arial", 14)
FONT_MED = pygame.font.SysFont("arial", 21, bold=True)
FONT_BIG = pygame.font.SysFont("arial", 36, bold=True)


def level_speed(level: int) -> float:
    return min(300 + (level - 1) * 26, 640)


def level_length(level: int) -> float:
    return min(1800 + (level - 1) * 220, 5200)


def level_spacing(level: int) -> float:
    return max(230 - (level - 1) * 14, 105)


def difficulty_label(level: int) -> str:
    if level < 3:
        return "EASY"
    if level < 6:
        return "FAST"
    if level < 10:
        return "INTENSE"
    return "INSANE"


@dataclass
class Obstacle:
    distance: float
    lane: int
    kind: str


class ObstacleCourseGame:
    def __init__(self) -> None:
        self.level = 1
        self.coins = 0
        self.owned_skins = {0}
        self.equipped_skin = 0
        self.status = "ready"
        self.message = ""
        self.message_color = WHITE
        self.message_timer = 0.0
        self.progress = 0.0
        self.player_x = TRACK_LEFT + TRACK_WIDTH / 2
        self.jump_timer = 0.0
        self.obstacles: list[Obstacle] = []
        self.skin_buttons = [
            pygame.Rect(FIELD_WIDTH + 14, 170 + index * 78, PANEL_WIDTH - 28, 68)
            for index in range(len(SKINS))
        ]
        self.continue_rect = pygame.Rect(225, 546, 290, 54)
        self.make_level()

    @property
    def length(self) -> float:
        return level_length(self.level)

    def make_level(self) -> None:
        """Build a deterministic course; later levels are faster, longer, and more crowded."""
        rng = random.Random(self.level)
        speed = level_speed(self.level)
        base_spacing = level_spacing(self.level)
        double_chance = min(0.1 + (self.level - 1) * 0.09, 0.85)
        spike_chance = min(0.25 + self.level * 0.03, 0.5)
        self.obstacles = []
        distance = 340.0
        safe_lane = 1
        while distance < self.length - 100:
            spacing = base_spacing * rng.uniform(0.85, 1.2)
            # Switching one lane takes about 0.55s, so rows that are close together
            # only allow the safe lane to shift as far as the player can actually move.
            lanes_reachable = int(spacing / speed * MOVE_SPEED / LANE_WIDTH * 0.8)
            options = [
                lane for lane in range(3) if abs(lane - safe_lane) <= lanes_reachable
            ]
            safe_lane = rng.choice(options)
            blocked = [lane for lane in range(3) if lane != safe_lane]
            if rng.random() > double_chance:
                blocked = [rng.choice(blocked)]
            for lane in blocked:
                roll = rng.random()
                kind = "spikes" if roll < spike_chance else rng.choice(("crate", "gap"))
                self.obstacles.append(Obstacle(distance, lane, kind))
            distance += spacing
        self.progress = 0.0
        self.player_x = TRACK_LEFT + TRACK_WIDTH / 2
        self.jump_timer = 0.0

    def start_or_advance(self) -> None:
        if self.status == "cleared":
            self.level += 1
            self.make_level()
        elif self.status in ("ready", "failed"):
            self.make_level()
        self.status = "running"

    def buy_or_equip_skin(self, skin_index: int) -> None:
        skin = SKINS[skin_index]
        if skin_index in self.owned_skins:
            self.equipped_skin = skin_index
            self.show_message(f"{skin['name']} skin equipped!", MINT)
        elif self.coins >= skin["price"]:
            self.coins -= skin["price"]
            self.owned_skins.add(skin_index)
            self.equipped_skin = skin_index
            self.show_message(f"Bought {skin['name']}!", MINT)
        else:
            self.show_message(f"Need {skin['price'] - self.coins:,} more coins.", GOLD)

    def show_message(self, text: str, color: tuple[int, int, int]) -> None:
        self.message = text
        self.message_color = color
        self.message_timer = 2.0

    def update(self, dt: float, keys: pygame.key.ScancodeWrapper) -> None:
        self.message_timer = max(0.0, self.message_timer - dt)
        if self.status != "running":
            return

        move_direction = int(keys[pygame.K_RIGHT] or keys[pygame.K_d]) - int(
            keys[pygame.K_LEFT] or keys[pygame.K_a]
        )
        self.player_x += move_direction * MOVE_SPEED * dt
        self.player_x = max(
            TRACK_LEFT + PLAYER_WIDTH / 2,
            min(TRACK_LEFT + TRACK_WIDTH - PLAYER_WIDTH / 2, self.player_x),
        )

        self.progress += level_speed(self.level) * dt
        self.jump_timer = max(0.0, self.jump_timer - dt)
        self.check_collisions()
        if self.status != "running":
            return
        if self.progress >= self.length:
            self.status = "cleared"
            self.coins += LEVEL_REWARD
            self.show_message(f"Level complete! +{LEVEL_REWARD} coins", MINT)

    def jump(self) -> None:
        if self.status == "running" and self.jump_timer <= 0:
            self.jump_timer = JUMP_DURATION

    def current_jump_height(self) -> float:
        if not self.jump_timer:
            return 0.0
        return JUMP_HEIGHT * math.sin(math.pi * (1 - self.jump_timer / JUMP_DURATION))

    def check_collisions(self) -> None:
        jump_height = self.current_jump_height()
        # The hit window grows with speed so fast levels can't skip over a hazard in one frame.
        window = max(24.0, level_speed(self.level) / FPS * 1.2)
        for obstacle in self.obstacles:
            if abs(obstacle.distance - self.progress) > window:
                continue
            obstacle_x = TRACK_LEFT + LANE_WIDTH * (obstacle.lane + 0.5)
            overlaps_x = abs(self.player_x - obstacle_x) < (PLAYER_WIDTH + OBSTACLE_WIDTH) / 2 - 6
            if overlaps_x and jump_height < 58:
                self.status = "failed"
                self.show_message("Ouch! Press Enter to retry this level.", RED)
                return

    def handle_event(self, event: pygame.event.Event) -> bool:
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                return False
            if event.key == pygame.K_RETURN:
                self.start_or_advance()
            elif event.key in (pygame.K_SPACE, pygame.K_UP, pygame.K_w):
                self.jump()
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for index, rect in enumerate(self.skin_buttons):
                if rect.collidepoint(event.pos):
                    self.buy_or_equip_skin(index)
                    break
            if self.status in ("ready", "cleared", "failed") and self.continue_rect.collidepoint(event.pos):
                self.start_or_advance()
        return True

    def draw(self) -> None:
        screen.fill(INK)
        self.draw_track()
        self.draw_hud()
        self.draw_shop()
        self.draw_obstacles()
        self.draw_player()
        self.draw_overlay()
        pygame.display.flip()

    def draw_track(self) -> None:
        pygame.draw.rect(screen, (19, 28, 43), (0, 0, FIELD_WIDTH, SCREEN_HEIGHT))
        for side in (0, TRACK_LEFT + TRACK_WIDTH):
            side_width = TRACK_LEFT if side == 0 else FIELD_WIDTH - side
            pygame.draw.rect(screen, (25, 38, 52), (side, 92, side_width, SCREEN_HEIGHT - 92))
            for index in range(12):
                y = 110 + ((index * 71 + int(self.progress * 0.42)) % 650)
                x = 14 + (index * 37) % max(side_width - 24, 1)
                pygame.draw.circle(screen, (39, 61, 73), (side + x, y), 2 + index % 2)

        track_rect = pygame.Rect(TRACK_LEFT, 0, TRACK_WIDTH, SCREEN_HEIGHT)
        pygame.draw.rect(screen, TRACK, track_rect, border_radius=14)
        pygame.draw.rect(screen, TRACK_EDGE, track_rect, width=3, border_radius=14)
        for edge_x in (TRACK_LEFT + 9, TRACK_LEFT + TRACK_WIDTH - 9):
            pygame.draw.line(screen, (37, 46, 65), (edge_x, 94), (edge_x, SCREEN_HEIGHT - 10), 4)
        for lane in (1, 2):
            x = TRACK_LEFT + lane * LANE_WIDTH
            for y in range(-30, SCREEN_HEIGHT, 64):
                dash_y = (y + int(self.progress * 0.8)) % (SCREEN_HEIGHT + 64) - 32
                pygame.draw.line(screen, (92, 106, 130), (x, dash_y), (x, dash_y + 30), 3)
        for y in range(32, SCREEN_HEIGHT, 80):
            marker_y = (y + int(self.progress)) % (SCREEN_HEIGHT + 80)
            for marker_x in (TRACK_LEFT + 18, TRACK_LEFT + TRACK_WIDTH - 18):
                pygame.draw.circle(screen, (27, 38, 55), (marker_x, marker_y), 8)
                pygame.draw.circle(screen, (87, 220, 194), (marker_x, marker_y), 3)

        # Finish line scrolls into view as the level ends.
        finish_y = int(PLAYER_Y - (self.length - self.progress))
        if -20 < finish_y < SCREEN_HEIGHT:
            for index in range(0, TRACK_WIDTH, 30):
                color = WHITE if (index // 30) % 2 == 0 else (30, 36, 52)
                pygame.draw.rect(screen, color, (TRACK_LEFT + index, finish_y - 10, 30, 20))

    def draw_hud(self) -> None:
        pygame.draw.rect(screen, (20, 28, 45), (0, 0, FIELD_WIDTH, 92))
        screen.blit(FONT_BIG.render(f"LEVEL {self.level}", True, WHITE), (28, 18))
        label = difficulty_label(self.level)
        label_color = MINT if label == "EASY" else GOLD if label in ("FAST", "INTENSE") else RED
        screen.blit(FONT_MED.render(label, True, label_color), (225, 31))
        progress_rect = pygame.Rect(365, 31, 300, 18)
        pygame.draw.rect(screen, (55, 68, 91), progress_rect, border_radius=9)
        fill_width = int(progress_rect.width * min(self.progress / self.length, 1))
        if fill_width:
            pygame.draw.rect(
                screen,
                MINT,
                (progress_rect.x, progress_rect.y, fill_width, progress_rect.height),
                border_radius=9,
            )
        screen.blit(FONT_SMALL.render("FINISH", True, MUTED), (progress_rect.right - 45, 54))

    def draw_shop(self) -> None:
        pygame.draw.rect(screen, PANEL, (FIELD_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT))
        pygame.draw.line(screen, (58, 76, 105), (FIELD_WIDTH, 0), (FIELD_WIDTH, SCREEN_HEIGHT), 2)
        screen.blit(FONT_BIG.render("SHOP", True, WHITE), (FIELD_WIDTH + 18, 19))
        screen.blit(FONT_MED.render(f"{self.coins:,} coins", True, GOLD), (FIELD_WIDTH + 19, 70))
        screen.blit(FONT_SMALL.render(f"+{LEVEL_REWARD} coins per level", True, MUTED), (FIELD_WIDTH + 19, 101))

        for index, (skin, rect) in enumerate(zip(SKINS, self.skin_buttons)):
            selected = index == self.equipped_skin
            pygame.draw.rect(screen, (41, 63, 80) if selected else PANEL_HI, rect, border_radius=10)
            border = skin["color"] if selected else (53, 69, 94)
            pygame.draw.rect(screen, border, rect, width=2, border_radius=10)
            self.draw_skin_sprite(rect.x + 24, rect.centery, index, 0.48)
            screen.blit(FONT_MED.render(skin["name"], True, WHITE), (rect.x + 48, rect.y + 8))

            if selected:
                action, action_color = "EQUIPPED", MINT
            elif index in self.owned_skins:
                action, action_color = "EQUIP", MINT
            else:
                action, action_color = f"{skin['price']:,} coins", GOLD
            screen.blit(FONT_SMALL.render(action, True, action_color), (rect.x + 49, rect.y + 39))

        screen.blit(FONT_SMALL.render("Move: A/D or arrows", True, MUTED), (FIELD_WIDTH + 16, 653))

    def draw_player(self) -> None:
        jump_height = self.current_jump_height()
        shadow_width = max(20, PLAYER_WIDTH + 12 - int(jump_height * 0.28))
        pygame.draw.ellipse(
            screen,
            (12, 16, 25),
            (int(self.player_x - shadow_width / 2), PLAYER_Y + 23, shadow_width, 12),
        )
        self.draw_skin_sprite(int(self.player_x), int(PLAYER_Y - jump_height), self.equipped_skin, 1.0)

    def draw_skin_sprite(self, center_x: int, center_y: int, skin_index: int, scale: float) -> None:
        """Draw a distinct, detailed character silhouette for each shop skin."""
        size = max(1, round(80 * scale))
        sprite = pygame.Surface((80, 80), pygame.SRCALPHA)
        skin = SKINS[skin_index]
        color = skin["color"]
        accent = skin["accent"]
        outline = (20, 25, 42)

        def polygon(points: list[tuple[int, int]], fill: tuple[int, int, int]) -> None:
            pygame.draw.polygon(sprite, outline, points)
            inner = [(int(40 + (x - 40) * 0.89), int(40 + (y - 40) * 0.89)) for x, y in points]
            pygame.draw.polygon(sprite, fill, inner)

        def ellipse(rect: tuple[int, int, int, int], fill: tuple[int, int, int]) -> None:
            pygame.draw.ellipse(sprite, outline, rect)
            pygame.draw.ellipse(sprite, fill, (rect[0] + 3, rect[1] + 3, rect[2] - 6, rect[3] - 6))

        style = skin["style"]
        if style == "robot":
            pygame.draw.line(sprite, outline, (40, 13), (40, 5), 6)
            pygame.draw.circle(sprite, accent, (40, 5), 4)
            pygame.draw.rect(sprite, outline, (19, 13, 42, 31), border_radius=8)
            pygame.draw.rect(sprite, color, (22, 16, 36, 25), border_radius=6)
            pygame.draw.rect(sprite, accent, (27, 23, 8, 8), border_radius=3)
            pygame.draw.rect(sprite, accent, (45, 23, 8, 8), border_radius=3)
            pygame.draw.rect(sprite, outline, (25, 46, 30, 22), border_radius=6)
            pygame.draw.rect(sprite, color, (29, 48, 22, 17), border_radius=4)
            pygame.draw.line(sprite, outline, (32, 66), (28, 75), 6)
            pygame.draw.line(sprite, outline, (48, 66), (52, 75), 6)
            pygame.draw.line(sprite, accent, (31, 53), (49, 53), 3)
            pygame.draw.line(sprite, outline, (22, 48), (15, 58), 5)
            pygame.draw.line(sprite, outline, (58, 48), (65, 58), 5)
        elif style == "shark":
            polygon([(40, 8), (54, 26), (58, 50), (40, 69), (22, 50), (26, 26)], color)
            polygon([(29, 58), (40, 51), (51, 58), (40, 73)], accent)
            polygon([(29, 22), (40, 7), (49, 27)], accent)
            polygon([(24, 41), (12, 48), (27, 52)], color)
            polygon([(56, 41), (68, 48), (53, 52)], color)
            for eye_x in (33, 47):
                pygame.draw.circle(sprite, outline, (eye_x, 31), 4)
                pygame.draw.circle(sprite, (255, 255, 255), (eye_x + 1, 30), 1)
            for gill_x in (30, 35, 45, 50):
                pygame.draw.line(sprite, (20, 76, 116), (gill_x, 39), (gill_x - 2, 47), 2)
            pygame.draw.arc(sprite, outline, (33, 42, 14, 11), math.pi * 0.05, math.pi * 0.95, 2)
        elif style == "dino":
            polygon([(24, 39), (7, 30), (10, 47), (28, 52)], color)
            ellipse((20, 35, 43, 28), color)
            polygon([(43, 38), (48, 17), (63, 15), (72, 26), (68, 39), (53, 45)], color)
            pygame.draw.rect(sprite, outline, (27, 54, 11, 18), border_radius=4)
            pygame.draw.rect(sprite, color, (30, 55, 6, 14), border_radius=3)
            pygame.draw.rect(sprite, outline, (49, 53, 11, 19), border_radius=4)
            pygame.draw.rect(sprite, color, (52, 54, 6, 15), border_radius=3)
            for spike_x in (32, 41, 50, 58):
                pygame.draw.polygon(sprite, accent, [(spike_x - 4, 37), (spike_x, 27), (spike_x + 5, 39)])
            pygame.draw.circle(sprite, outline, (62, 23), 3)
            pygame.draw.circle(sprite, (255, 255, 255), (63, 22), 1)
            pygame.draw.line(sprite, outline, (61, 33), (71, 33), 2)
            pygame.draw.circle(sprite, accent, (33, 45), 3)
            pygame.draw.circle(sprite, accent, (43, 50), 2)
        elif style == "phoenix":
            polygon([(40, 72), (25, 62), (19, 43), (8, 34), (19, 35), (12, 22), (30, 31), (40, 14),
                     (50, 31), (68, 22), (61, 36), (73, 34), (61, 48), (56, 64)], color)
            polygon([(40, 62), (31, 50), (38, 40), (35, 31), (44, 37), (48, 47), (43, 53), (50, 58)], accent)
            pygame.draw.circle(sprite, outline, (35, 36), 2)
            pygame.draw.circle(sprite, outline, (45, 36), 2)
            pygame.draw.polygon(sprite, GOLD, [(38, 41), (48, 41), (43, 49)])
            for feather_x in (17, 25, 55, 63):
                pygame.draw.line(sprite, accent, (feather_x, 40), (feather_x + (3 if feather_x < 40 else -3), 54), 2)
        elif style == "knight":
            polygon([(23, 24), (12, 20), (17, 47), (28, 59), (38, 53)], (128, 45, 78))
            polygon([(30, 34), (50, 34), (59, 52), (54, 70), (25, 70), (20, 52)], color)
            polygon([(23, 35), (19, 20), (29, 26), (40, 10), (49, 26), (60, 19), (56, 36)], accent)
            pygame.draw.arc(sprite, outline, (25, 25, 30, 26), math.pi, math.tau, 3)
            pygame.draw.rect(sprite, outline, (27, 32, 26, 9), border_radius=3)
            pygame.draw.line(sprite, (255, 255, 255), (31, 36), (49, 36), 2)
            polygon([(54, 43), (69, 48), (67, 63), (57, 72), (49, 62), (49, 49)], accent)
            pygame.draw.line(sprite, (126, 74, 34), (58, 50), (58, 65), 2)
            pygame.draw.line(sprite, (126, 74, 34), (53, 57), (64, 57), 2)
        else:
            pygame.draw.ellipse(sprite, (91, 47, 150), (6, 25, 68, 32), width=4)
            pygame.draw.ellipse(sprite, accent, (8, 27, 64, 28), width=2)
            pygame.draw.line(sprite, outline, (34, 20), (27, 8), 4)
            pygame.draw.line(sprite, outline, (46, 20), (54, 8), 4)
            pygame.draw.circle(sprite, accent, (26, 7), 5)
            pygame.draw.circle(sprite, (255, 255, 255), (55, 7), 5)
            ellipse((16, 15, 48, 45), color)
            pygame.draw.ellipse(sprite, outline, (23, 29, 12, 17))
            pygame.draw.ellipse(sprite, outline, (45, 29, 12, 17))
            pygame.draw.ellipse(sprite, (255, 255, 255), (26, 31, 5, 8))
            pygame.draw.ellipse(sprite, (255, 255, 255), (48, 31, 5, 8))
            pygame.draw.arc(sprite, outline, (32, 43, 17, 10), 0, math.pi, 2)
            pygame.draw.circle(sprite, accent, (24, 53), 3)
            pygame.draw.circle(sprite, accent, (55, 54), 3)

        scaled = pygame.transform.smoothscale(sprite, (size, size))
        screen.blit(scaled, scaled.get_rect(center=(center_x, center_y)))

    def draw_obstacles(self) -> None:
        for obstacle in self.obstacles:
            y = int(PLAYER_Y - (obstacle.distance - self.progress))
            if y < -90 or y > SCREEN_HEIGHT + 90:
                continue
            center_x = int(TRACK_LEFT + LANE_WIDTH * (obstacle.lane + 0.5))
            rect = pygame.Rect(center_x - OBSTACLE_WIDTH // 2, y - 22, OBSTACLE_WIDTH, 44)
            if obstacle.kind == "gap":
                pygame.draw.rect(screen, (17, 22, 34), rect, border_radius=8)
                pygame.draw.rect(screen, (102, 117, 143), rect, width=3, border_radius=8)
                pygame.draw.line(screen, (180, 193, 214), (rect.x + 10, rect.y + 5), (rect.right - 10, rect.y + 5), 2)
                for stripe_x in range(rect.x + 12, rect.right - 8, 24):
                    pygame.draw.line(screen, (44, 54, 73), (stripe_x, rect.y + 7), (stripe_x, rect.bottom - 7), 3)
            elif obstacle.kind == "spikes":
                pygame.draw.rect(screen, (119, 43, 62), rect, border_radius=6)
                for spike_x in range(rect.x + 8, rect.right - 8, 22):
                    pygame.draw.polygon(
                        screen,
                        (255, 220, 224),
                        ((spike_x, rect.bottom - 5), (spike_x + 11, rect.y + 4), (spike_x + 22, rect.bottom - 5)),
                    )
                    pygame.draw.polygon(
                        screen,
                        RED,
                        ((spike_x + 3, rect.bottom - 7), (spike_x + 11, rect.y + 10), (spike_x + 19, rect.bottom - 7)),
                    )
            else:
                pygame.draw.rect(screen, (150, 91, 48), rect, border_radius=7)
                pygame.draw.rect(screen, (255, 190, 105), rect, width=3, border_radius=7)
                pygame.draw.line(screen, (255, 190, 105), (rect.x + 14, rect.y + 10), (rect.right - 14, rect.bottom - 10), 3)
                pygame.draw.line(screen, (255, 190, 105), (rect.right - 14, rect.y + 10), (rect.x + 14, rect.bottom - 10), 3)
                for bolt_x, bolt_y in (
                    (rect.x + 9, rect.y + 9),
                    (rect.right - 9, rect.y + 9),
                    (rect.x + 9, rect.bottom - 9),
                    (rect.right - 9, rect.bottom - 9),
                ):
                    pygame.draw.circle(screen, (255, 222, 164), (bolt_x, bolt_y), 2)

    def draw_overlay(self) -> None:
        if self.message_timer > 0:
            msg = FONT_MED.render(self.message, True, self.message_color)
            msg_rect = msg.get_rect(center=(FIELD_WIDTH // 2, 125))
            pygame.draw.rect(screen, (20, 28, 45), msg_rect.inflate(30, 18), border_radius=12)
            screen.blit(msg, msg_rect)

        if self.status == "running":
            screen.blit(FONT_SMALL.render("Jump: SPACE / W / UP", True, WHITE), (TRACK_LEFT, 104))
            return

        overlay = pygame.Surface((FIELD_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((8, 12, 22, 145))
        screen.blit(overlay, (0, 0))
        if self.status == "ready":
            title = "INFINITE OBSTACLE COURSE"
            instruction = "Dodge the obstacles and make it to the finish!"
            button_text = "START LEVEL 1"
        elif self.status == "cleared":
            title = f"LEVEL {self.level} COMPLETE!"
            instruction = f"You earned {LEVEL_REWARD} coins. The next course is faster and more crowded."
            button_text = f"START LEVEL {self.level + 1}"
        else:
            title = "LEVEL FAILED"
            instruction = "Move between lanes and jump to avoid obstacles."
            button_text = "TRY AGAIN"

        title_surface = FONT_BIG.render(title, True, WHITE)
        screen.blit(title_surface, title_surface.get_rect(center=(FIELD_WIDTH // 2, 390)))
        line = FONT.render(instruction, True, (205, 217, 235))
        screen.blit(line, line.get_rect(center=(FIELD_WIDTH // 2, 445)))
        pygame.draw.rect(screen, (48, 177, 139), self.continue_rect, border_radius=13)
        button_surface = FONT_MED.render(button_text, True, (9, 28, 31))
        screen.blit(button_surface, button_surface.get_rect(center=self.continue_rect.center))
        screen.blit(FONT_SMALL.render("Press ENTER to continue", True, MUTED), (275, 615))


def main() -> None:
    game = ObstacleCourseGame()
    running = True
    while running:
        dt = min(clock.tick(FPS) / 1000, 0.05)
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            running = game.handle_event(event) and running
        game.update(dt, keys)
        game.draw()
    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
