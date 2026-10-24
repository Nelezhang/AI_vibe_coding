"""A compact, mouse-driven tower defense game built with Pygame."""

from __future__ import annotations

import math
import random
import sys
from dataclasses import dataclass, field

import pygame

pygame.init()

SCREEN_WIDTH = 1120
SCREEN_HEIGHT = 720
SIDEBAR_WIDTH = 280
FIELD_WIDTH = SCREEN_WIDTH - SIDEBAR_WIDTH
FPS = 60

# Palette
INK = (13, 20, 35)
PANEL = (20, 31, 50)
PANEL_HI = (28, 43, 65)
WHITE = (239, 246, 255)
MUTED = (139, 158, 181)
MINT = (98, 242, 190)
GOLD = (255, 205, 99)
RED = (255, 105, 125)
BLUE = (103, 177, 255)
PURPLE = (193, 139, 255)
FIELD_BG = (18, 38, 50)
PATH_EDGE = (34, 63, 70)
PATH_FILL = (70, 107, 91)

screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Greenlight Defense — Pygame Tower Defense")
clock = pygame.time.Clock()

FONT = pygame.font.SysFont("arial", 16)
FONT_SMALL = pygame.font.SysFont("arial", 13)
FONT_MED = pygame.font.SysFont("arial", 20, bold=True)
FONT_BIG = pygame.font.SysFont("arial", 34, bold=True)
FONT_TITLE = pygame.font.SysFont("arial", 52, bold=True)

FIELD_RECT = pygame.Rect(0, 0, FIELD_WIDTH, SCREEN_HEIGHT)
SIDEBAR_RECT = pygame.Rect(FIELD_WIDTH, 0, SIDEBAR_WIDTH, SCREEN_HEIGHT)

# The path is intentionally broad and easy to read. Enemies follow its points.
PATH_POINTS = [
    (-18, 170),
    (165, 170),
    (165, 355),
    (365, 355),
    (365, 205),
    (575, 205),
    (575, 525),
    (FIELD_WIDTH + 18, 525),
]
PATH_WIDTH = 66

TOWER_TYPES = {
    "dart": {
        "name": "Dart Tower",
        "hotkey": "1",
        "cost": 75,
        "range": 175,
        "fire_rate": 0.52,
        "damage": 18,
        "color": BLUE,
        "description": "Quick, reliable shots",
    },
    "cannon": {
        "name": "Cannon Tower",
        "hotkey": "2",
        "cost": 125,
        "range": 145,
        "fire_rate": 1.15,
        "damage": 48,
        "color": GOLD,
        "description": "Heavy impact damage",
    },
    "frost": {
        "name": "Frost Tower",
        "hotkey": "3",
        "cost": 105,
        "range": 160,
        "fire_rate": 0.9,
        "damage": 14,
        "color": PURPLE,
        "description": "Slows enemies down",
    },
}


@dataclass
class Enemy:
    x: float
    y: float
    hp: float
    max_hp: float
    speed: float
    reward: int
    color: tuple[int, int, int]
    path_index: int = 1
    slow_timer: float = 0.0
    alive: bool = True

    def update(self, dt: float) -> bool:
        """Move along the path; return True if the enemy escapes."""
        if self.path_index >= len(PATH_POINTS):
            return True
        target_x, target_y = PATH_POINTS[self.path_index]
        dx = target_x - self.x
        dy = target_y - self.y
        distance = math.hypot(dx, dy)
        if distance < 1:
            self.path_index += 1
            return self.path_index >= len(PATH_POINTS)
        speed_scale = 0.48 if self.slow_timer > 0 else 1.0
        travel = min(distance, self.speed * speed_scale * dt)
        self.x += dx / distance * travel
        self.y += dy / distance * travel
        self.slow_timer = max(0.0, self.slow_timer - dt)
        return False


@dataclass
class Tower:
    x: float
    y: float
    kind: str
    cooldown: float = 0.0
    level: int = 1
    target: Enemy | None = None

    @property
    def stats(self) -> dict[str, object]:
        base = TOWER_TYPES[self.kind]
        return {
            "range": float(base["range"]) + (self.level - 1) * 16,
            "fire_rate": max(0.2, float(base["fire_rate"]) * (0.88 ** (self.level - 1))),
            "damage": float(base["damage"]) * (1 + (self.level - 1) * 0.55),
        }


@dataclass
class Projectile:
    x: float
    y: float
    target: Enemy
    speed: float
    damage: float
    color: tuple[int, int, int]
    kind: str
    splash_radius: float = 0.0
    slow_duration: float = 0.0


@dataclass
class Button:
    rect: pygame.Rect
    label: str
    color: tuple[int, int, int]
    action: str
    enabled: bool = True


class TowerDefenseGame:
    def __init__(self) -> None:
        self.towers: list[Tower] = []
        self.enemies: list[Enemy] = []
        self.projectiles: list[Projectile] = []
        self.money = 325
        self.lives = 20
        self.wave = 0
        self.kills = 0
        self.running = False
        self.game_over = False
        self.wave_active = False
        self.spawn_queue = 0
        self.spawn_timer = 0.0
        self.wave_gap = 0.0
        self.selected_kind = "dart"
        self.selected_tower: Tower | None = None
        self.banner = "Place towers, then launch your first wave."
        self.banner_timer = 3.0
        self.buttons: list[Button] = []

    def begin_wave(self) -> None:
        if self.game_over or self.wave_active or self.spawn_queue > 0:
            return
        self.wave += 1
        self.wave_active = True
        self.spawn_queue = 7 + self.wave * 2
        self.spawn_timer = 0.35
        self.wave_gap = 0.0
        self.banner = f"WAVE {self.wave} INCOMING!"
        self.banner_timer = 1.6

    def spawn_enemy(self) -> None:
        scale = 1 + (self.wave - 1) * 0.19
        if self.wave % 5 == 0 and self.spawn_queue == 1:
            hp = 420 * scale
            speed = 48 + self.wave * 1.3
            reward = 65
            color = (255, 120, 80)
        elif self.wave >= 3 and self.spawn_queue % 4 == 0:
            hp = 55 * scale
            speed = 102 + self.wave * 1.5
            reward = 14
            color = (220, 120, 255)
        else:
            hp = 90 * scale
            speed = 67 + self.wave * 1.7
            reward = 18 + self.wave
            color = (255, 106, 127)
        self.enemies.append(Enemy(PATH_POINTS[0][0], PATH_POINTS[0][1], hp, hp, speed, reward, color))
        self.spawn_queue -= 1

    def place_tower(self, position: tuple[int, int]) -> None:
        x, y = position
        if not FIELD_RECT.collidepoint(position):
            return
        if any(math.hypot(x - tower.x, y - tower.y) < 42 for tower in self.towers):
            self.banner = "Towers need a little room between them."
            self.banner_timer = 1.6
            return
        if distance_to_path((x, y)) < PATH_WIDTH / 2 + 13:
            self.banner = "Can't build on the enemy road!"
            self.banner_timer = 1.6
            return
        config = TOWER_TYPES[self.selected_kind]
        cost = int(config["cost"])
        if self.money < cost:
            self.banner = "Not enough coins for that tower."
            self.banner_timer = 1.6
            return
        self.money -= cost
        tower = Tower(float(x), float(y), self.selected_kind)
        self.towers.append(tower)
        self.selected_tower = tower
        self.banner = f"{config['name']} deployed."
        self.banner_timer = 1.2

    def upgrade_selected(self) -> None:
        tower = self.selected_tower
        if tower not in self.towers:
            return
        cost = self.upgrade_cost(tower)
        if self.money < cost:
            self.banner = "Not enough coins to upgrade."
            self.banner_timer = 1.5
            return
        if tower.level >= 5:
            self.banner = "This tower is already max level."
            self.banner_timer = 1.5
            return
        self.money -= cost
        tower.level += 1
        self.banner = f"Tower upgraded to level {tower.level}!"
        self.banner_timer = 1.5

    @staticmethod
    def upgrade_cost(tower: Tower) -> int:
        return 55 + tower.level * 45

    def sell_selected(self) -> None:
        tower = self.selected_tower
        if tower not in self.towers:
            return
        refund = int(TOWER_TYPES[tower.kind]["cost"] * 0.65 + (tower.level - 1) * 45)
        self.money += refund
        self.towers.remove(tower)
        self.selected_tower = None
        self.banner = f"Tower sold for {refund} coins."
        self.banner_timer = 1.5

    def update_towers(self, dt: float) -> None:
        for tower in self.towers:
            tower.cooldown = max(0.0, tower.cooldown - dt)
            stats = tower.stats
            if tower.cooldown > 0:
                continue
            candidates = [
                enemy for enemy in self.enemies
                if enemy.alive and math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= float(stats["range"])
            ]
            if not candidates:
                continue
            target = max(candidates, key=lambda enemy: enemy.path_index - math.hypot(enemy.x - tower.x, enemy.y - tower.y) / 200)
            tower.target = target
            base = TOWER_TYPES[tower.kind]
            self.projectiles.append(Projectile(
                tower.x, tower.y, target, 530 if tower.kind == "dart" else 380,
                float(stats["damage"]), tuple(base["color"]), tower.kind,
                splash_radius=52 if tower.kind == "cannon" else 0,
                slow_duration=1.4 if tower.kind == "frost" else 0,
            ))
            tower.cooldown = float(stats["fire_rate"])

    def update_projectiles(self, dt: float) -> None:
        for projectile in self.projectiles[:]:
            target = projectile.target
            if not target.alive:
                self.projectiles.remove(projectile)
                continue
            dx = target.x - projectile.x
            dy = target.y - projectile.y
            distance = math.hypot(dx, dy)
            travel = projectile.speed * dt
            if distance <= travel + 9:
                projectile.x, projectile.y = target.x, target.y
                self.hit_enemy(target, projectile)
                if projectile in self.projectiles:
                    self.projectiles.remove(projectile)
            elif distance > 0:
                projectile.x += dx / distance * travel
                projectile.y += dy / distance * travel

    def hit_enemy(self, enemy: Enemy, projectile: Projectile) -> None:
        if projectile.splash_radius:
            for victim in self.enemies:
                if victim.alive and math.hypot(victim.x - enemy.x, victim.y - enemy.y) <= projectile.splash_radius:
                    self.damage_enemy(victim, projectile.damage)
        else:
            self.damage_enemy(enemy, projectile.damage)
        if projectile.slow_duration and enemy.alive:
            enemy.slow_timer = max(enemy.slow_timer, projectile.slow_duration)

    def damage_enemy(self, enemy: Enemy, damage: float) -> None:
        enemy.hp -= damage
        if enemy.hp <= 0 and enemy.alive:
            enemy.alive = False
            self.money += enemy.reward
            self.kills += 1

    def update(self, dt: float) -> None:
        if not self.running or self.game_over:
            return
        for enemy in self.enemies[:]:
            if enemy.alive and enemy.update(dt):
                enemy.alive = False
                self.lives -= 1
            if not enemy.alive:
                self.enemies.remove(enemy)
        self.update_towers(dt)
        self.update_projectiles(dt)
        if self.wave_active:
            self.spawn_timer -= dt
            if self.spawn_queue > 0 and self.spawn_timer <= 0:
                self.spawn_enemy()
                self.spawn_timer = max(0.28, 0.78 - self.wave * 0.015)
            if self.spawn_queue == 0 and not self.enemies:
                self.wave_active = False
                self.money += 45 + self.wave * 8
                self.banner = f"Wave {self.wave} cleared! Bonus coins awarded."
                self.banner_timer = 3.0
        else:
            self.wave_gap += dt
        if self.lives <= 0:
            self.game_over = True
            self.banner = "THE BASE HAS FALLEN"
            self.banner_timer = 99

    def draw(self) -> None:
        screen.fill(INK)
        self.draw_field()
        self.draw_towers()
        self.draw_enemies()
        self.draw_projectiles()
        self.draw_hud()
        self.draw_sidebar()
        if not self.running:
            self.draw_start_overlay()
        elif self.game_over:
            self.draw_game_over_overlay()
        if self.banner_timer > 0 and self.running and not self.game_over:
            self.banner_timer -= clock.get_time() / 1000
            self.draw_banner()
        pygame.display.flip()

    def draw_field(self) -> None:
        screen.fill(FIELD_BG, FIELD_RECT)
        # Subtle field grid
        for x in range(0, FIELD_WIDTH, 40):
            pygame.draw.line(screen, (24, 49, 60), (x, 0), (x, SCREEN_HEIGHT))
        for y in range(0, SCREEN_HEIGHT, 40):
            pygame.draw.line(screen, (24, 49, 60), (0, y), (FIELD_WIDTH, y))
        # Soft map decorations
        for cx, cy, radius in [(90, 555, 82), (480, 590, 62), (730, 60, 72)]:
            pygame.draw.circle(screen, (20, 45, 54), (cx, cy), radius)
        pygame.draw.lines(screen, PATH_EDGE, False, PATH_POINTS, PATH_WIDTH + 12)
        pygame.draw.lines(screen, PATH_FILL, False, PATH_POINTS, PATH_WIDTH)
        pygame.draw.lines(screen, (105, 139, 111), False, PATH_POINTS, 3)
        for point in PATH_POINTS[1:-1]:
            pygame.draw.circle(screen, (111, 144, 114), point, PATH_WIDTH // 2)
        # Start and base markers
        pygame.draw.circle(screen, MINT, PATH_POINTS[0][1:] if False else PATH_POINTS[0], 17)
        pygame.draw.circle(screen, (17, 48, 42), PATH_POINTS[0], 8)
        pygame.draw.circle(screen, RED, PATH_POINTS[-1], 27)
        pygame.draw.circle(screen, (83, 29, 47), PATH_POINTS[-1], 18)
        draw_text(screen, "ENTRY", FONT_SMALL, WHITE, (18, 112))
        draw_text(screen, "BASE", FONT_SMALL, WHITE, (FIELD_WIDTH - 62, 480))

    def draw_towers(self) -> None:
        for tower in self.towers:
            config = TOWER_TYPES[tower.kind]
            color = tuple(config["color"])
            if tower is self.selected_tower:
                pygame.draw.circle(screen, (*color, 40), (round(tower.x), round(tower.y)), int(tower.stats["range"]), 1)
                pygame.draw.circle(screen, WHITE, (round(tower.x), round(tower.y)), 24, 2)
            pygame.draw.circle(screen, (10, 18, 30), (round(tower.x + 2), round(tower.y + 5)), 19)
            pygame.draw.circle(screen, color, (round(tower.x), round(tower.y)), 18)
            pygame.draw.circle(screen, (235, 244, 252), (round(tower.x), round(tower.y)), 18, 2)
            if tower.kind == "dart":
                pygame.draw.polygon(screen, WHITE, [(tower.x + 12, tower.y), (tower.x - 7, tower.y - 6), (tower.x - 5, tower.y + 6)])
            elif tower.kind == "cannon":
                pygame.draw.circle(screen, (83, 58, 19), (round(tower.x), round(tower.y)), 7)
                pygame.draw.line(screen, WHITE, (tower.x, tower.y), (tower.x + 12, tower.y - 9), 5)
            else:
                pygame.draw.polygon(screen, WHITE, [(tower.x, tower.y - 11), (tower.x + 9, tower.y), (tower.x, tower.y + 11), (tower.x - 9, tower.y)])
            for level in range(tower.level):
                pygame.draw.circle(screen, GOLD, (round(tower.x - 10 + level * 5), round(tower.y + 25)), 2)

    def draw_enemies(self) -> None:
        for enemy in self.enemies:
            x, y = round(enemy.x), round(enemy.y)
            pygame.draw.circle(screen, (10, 15, 28), (x + 2, y + 4), 15)
            pygame.draw.circle(screen, enemy.color, (x, y), 13)
            pygame.draw.circle(screen, (255, 225, 224), (x, y), 13, 2)
            pygame.draw.circle(screen, WHITE, (x - 4, y - 3), 2)
            pygame.draw.circle(screen, WHITE, (x + 4, y - 3), 2)
            bar = pygame.Rect(x - 18, y - 23, 36, 5)
            pygame.draw.rect(screen, (30, 28, 39), bar, border_radius=3)
            hp_rect = pygame.Rect(bar.x, bar.y, max(0, int(bar.width * enemy.hp / enemy.max_hp)), bar.height)
            pygame.draw.rect(screen, MINT if enemy.hp / enemy.max_hp > 0.35 else RED, hp_rect, border_radius=3)
            if enemy.slow_timer > 0:
                pygame.draw.circle(screen, PURPLE, (x, y), 17, 2)

    def draw_projectiles(self) -> None:
        for projectile in self.projectiles:
            pygame.draw.circle(screen, (*projectile.color, 70), (round(projectile.x), round(projectile.y)), 8)
            pygame.draw.circle(screen, WHITE, (round(projectile.x), round(projectile.y)), 4)
        for tower in self.towers:
            if tower.target and tower.cooldown > 0.35:
                pygame.draw.line(screen, tuple(TOWER_TYPES[tower.kind]["color"]), (round(tower.x), round(tower.y)), (round(tower.target.x), round(tower.target.y)), 1)

    def draw_hud(self) -> None:
        pygame.draw.rect(screen, (11, 24, 35), (0, 0, FIELD_WIDTH, 58))
        draw_text(screen, "GREENLIGHT DEFENSE", FONT_MED, WHITE, (19, 12))
        draw_text(screen, f"WAVE {self.wave:02d}", FONT_MED, GOLD, (280, 12))
        draw_text(screen, f"COINS  {self.money}", FONT_MED, MINT, (410, 12))
        draw_text(screen, f"BASE  {self.lives}", FONT_MED, RED if self.lives <= 6 else WHITE, (565, 12))
        draw_text(screen, f"KILLS  {self.kills}", FONT_MED, BLUE, (690, 12))

    def draw_sidebar(self) -> None:
        pygame.draw.rect(screen, PANEL, SIDEBAR_RECT)
        pygame.draw.line(screen, (51, 71, 91), (FIELD_WIDTH, 0), (FIELD_WIDTH, SCREEN_HEIGHT), 2)
        x = FIELD_WIDTH + 20
        draw_text(screen, "BUILD & COMMAND", FONT_MED, WHITE, (x, 22))
        draw_text(screen, "Choose a tower", FONT_SMALL, MUTED, (x, 56))

        self.buttons = []
        y = 80
        for kind, config in TOWER_TYPES.items():
            rect = pygame.Rect(x, y, SIDEBAR_WIDTH - 40, 67)
            selected = self.selected_kind == kind
            pygame.draw.rect(screen, PANEL_HI if selected else (24, 37, 55), rect, border_radius=10)
            pygame.draw.rect(screen, tuple(config["color"]), rect, 2 if selected else 1, border_radius=10)
            pygame.draw.circle(screen, tuple(config["color"]), (rect.x + 22, rect.y + 22), 10)
            draw_text(screen, f"{config['hotkey']}  {config['name']}", FONT, WHITE, (rect.x + 40, rect.y + 10))
            draw_text(screen, config["description"], FONT_SMALL, MUTED, (rect.x + 40, rect.y + 34))
            draw_text(screen, f"{config['cost']}c", FONT, GOLD if self.money >= int(config["cost"]) else RED, (rect.right - 47, rect.y + 10))
            self.buttons.append(Button(rect, str(config["name"]), tuple(config["color"]), f"tower:{kind}"))
            y += 78

        pygame.draw.line(screen, (51, 71, 91), (x, y + 1), (SCREEN_WIDTH - 18, y + 1))
        selected = self.selected_tower
        if selected and selected in self.towers:
            draw_text(screen, "SELECTED TOWER", FONT_SMALL, MUTED, (x, y + 14))
            draw_text(screen, f"{TOWER_TYPES[selected.kind]['name']}  ·  LV {selected.level}", FONT, WHITE, (x, y + 33))
            draw_text(screen, f"DMG {selected.stats['damage']:.0f}   RANGE {selected.stats['range']:.0f}", FONT_SMALL, MUTED, (x, y + 56))
            upgrade_rect = pygame.Rect(x, y + 80, 111, 38)
            sell_rect = pygame.Rect(x + 119, y + 80, 121, 38)
            upgrade_cost = self.upgrade_cost(selected)
            self.draw_button(upgrade_rect, f"UPGRADE {upgrade_cost}c", MINT, self.money >= upgrade_cost and selected.level < 5)
            self.draw_button(sell_rect, "SELL TOWER", RED, True)
            self.buttons.append(Button(upgrade_rect, "Upgrade", MINT, "upgrade", self.money >= upgrade_cost and selected.level < 5))
            self.buttons.append(Button(sell_rect, "Sell", RED, "sell", True))
            y += 132
        else:
            draw_text(screen, "Click a tower to inspect", FONT_SMALL, MUTED, (x, y + 18))
            y += 51

        launch_rect = pygame.Rect(x, min(y + 3, 636), SIDEBAR_WIDTH - 40, 48)
        launch_label = "START NEXT WAVE" if self.wave > 0 else "START FIRST WAVE"
        launch_label = "WAVE IN PROGRESS" if self.wave_active else launch_label
        self.draw_button(launch_rect, launch_label, GOLD, not self.wave_active and not self.game_over)
        self.buttons.append(Button(launch_rect, launch_label, GOLD, "wave", not self.wave_active and not self.game_over))
        draw_text(screen, "SPACE: start wave  ·  Click to build", FONT_SMALL, MUTED, (x, 690))

    @staticmethod
    def draw_button(rect: pygame.Rect, label: str, color: tuple[int, int, int], enabled: bool) -> None:
        fill = color if enabled else (63, 73, 87)
        text_color = INK if enabled else MUTED
        pygame.draw.rect(screen, fill, rect, border_radius=8)
        text = FONT_SMALL.render(label, True, text_color)
        screen.blit(text, text.get_rect(center=rect.center))

    def draw_start_overlay(self) -> None:
        overlay = pygame.Surface((FIELD_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((7, 12, 23, 185))
        screen.blit(overlay, (0, 0))
        title = FONT_TITLE.render("GREENLIGHT DEFENSE", True, WHITE)
        screen.blit(title, title.get_rect(center=(FIELD_WIDTH // 2, 270)))
        subtitle = FONT_MED.render("Build towers. Protect the base. Survive the waves.", True, MINT)
        screen.blit(subtitle, subtitle.get_rect(center=(FIELD_WIDTH // 2, 326)))
        instructions = [
            "Click a tower card, then click open ground to build.",
            "Click a tower to upgrade or sell it. Press SPACE to start a wave.",
            "Dart = fast · Cannon = splash · Frost = slow",
            "Press ENTER to begin",
        ]
        for index, line in enumerate(instructions):
            text = FONT.render(line, True, WHITE if index == 3 else MUTED)
            screen.blit(text, text.get_rect(center=(FIELD_WIDTH // 2, 390 + index * 31)))

    def draw_game_over_overlay(self) -> None:
        overlay = pygame.Surface((FIELD_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((7, 12, 23, 190))
        screen.blit(overlay, (0, 0))
        title = FONT_TITLE.render("BASE DESTROYED", True, RED)
        screen.blit(title, title.get_rect(center=(FIELD_WIDTH // 2, 290)))
        score = FONT_MED.render(f"You reached wave {self.wave}  ·  {self.kills} enemies defeated", True, WHITE)
        screen.blit(score, score.get_rect(center=(FIELD_WIDTH // 2, 350)))
        restart = FONT.render("Press R to rebuild your defenses", True, MINT)
        screen.blit(restart, restart.get_rect(center=(FIELD_WIDTH // 2, 400)))

    def draw_banner(self) -> None:
        text = FONT_MED.render(self.banner, True, WHITE)
        box = text.get_rect(center=(FIELD_WIDTH // 2, 80)).inflate(26, 16)
        pygame.draw.rect(screen, (10, 18, 30), box, border_radius=9)
        pygame.draw.rect(screen, (72, 102, 118), box, 1, border_radius=9)
        screen.blit(text, text.get_rect(center=box.center))

    def handle_click(self, position: tuple[int, int]) -> None:
        for button in self.buttons:
            if button.rect.collidepoint(position):
                if not button.enabled:
                    return
                if button.action.startswith("tower:"):
                    self.selected_kind = button.action.split(":", 1)[1]
                    self.selected_tower = None
                elif button.action == "upgrade":
                    self.upgrade_selected()
                elif button.action == "sell":
                    self.sell_selected()
                elif button.action == "wave":
                    self.begin_wave()
                return
        if position[0] >= FIELD_WIDTH:
            return
        clicked_tower = next((tower for tower in reversed(self.towers) if math.hypot(position[0] - tower.x, position[1] - tower.y) < 24), None)
        if clicked_tower:
            self.selected_tower = clicked_tower
            return
        self.selected_tower = None
        if self.running and not self.game_over:
            self.place_tower(position)

    def handle_event(self, event: pygame.event.Event) -> bool:
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                return False
            if not self.running and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.running = True
                self.banner_timer = 0
            elif self.game_over and event.key == pygame.K_r:
                self.__init__()
            elif self.running and not self.game_over:
                if event.key == pygame.K_SPACE:
                    self.begin_wave()
                elif event.key in (pygame.K_1, pygame.K_2, pygame.K_3):
                    self.selected_kind = ("dart", "cannon", "frost")[event.key - pygame.K_1]
                    self.selected_tower = None
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if not self.running and not self.game_over:
                self.running = True
                return True
            if self.running and not self.game_over:
                self.handle_click(event.pos)
        return True


def distance_to_path(point: tuple[int, int]) -> float:
    px, py = point
    best = float("inf")
    for start, end in zip(PATH_POINTS, PATH_POINTS[1:]):
        ax, ay = start
        bx, by = end
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            distance = math.hypot(px - ax, py - ay)
        else:
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
            nearest_x = ax + t * dx
            nearest_y = ay + t * dy
            distance = math.hypot(px - nearest_x, py - nearest_y)
        best = min(best, distance)
    return best


def draw_text(surface: pygame.Surface, text: str, font: pygame.font.Font, color: tuple[int, int, int], position: tuple[int, int]) -> None:
    surface.blit(font.render(text, True, color), position)


def main() -> None:
    game = TowerDefenseGame()
    alive = True
    while alive:
        dt = min(clock.tick(FPS) / 1000, 0.04)
        for event in pygame.event.get():
            alive = game.handle_event(event) and alive
        if not alive:
            break
        game.update(dt)
        game.draw()
    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
