"""Grand Tide: an original island-hopping pirate adventure."""

import math
from dataclasses import dataclass

import pygame

WIDTH, HEIGHT = 1100, 720
ARENA = pygame.Rect(60, 130, 980, 485)
ISLAND_COUNT = 100
ISLAND_PREFIXES = ("Amber", "Azure", "Coral", "Dawn", "Emerald",
                   "Gale", "Ivory", "Moon", "Ruby", "Silver")
ISLAND_SUFFIXES = ("Atoll", "Bay", "Cove", "Haven", "Isle",
                   "Lagoon", "Point", "Reef", "Shoal", "Shore")
ISLAND_COLORS = ((208, 186, 124), (167, 162, 124), (188, 150, 124),
                 (153, 183, 142), (176, 169, 155), (202, 164, 144),
                 (166, 191, 181), (185, 171, 138), (177, 154, 171), (181, 185, 151))


def make_islands() -> tuple[tuple[str, tuple[int, int, int], int, int, int], ...]:
    islands = [("Palmshore", ISLAND_COLORS[0], 4, 2, 75),
               ("Stormreef", ISLAND_COLORS[1], 6, 3, 92)]
    for index in range(2, ISLAND_COUNT - 1):
        name_index = index - 2
        name = f"{ISLAND_PREFIXES[name_index // 10]} {ISLAND_SUFFIXES[name_index % 10]}"
        islands.append((name, ISLAND_COLORS[index // 10], min(8, 6 + index // 20),
                        min(5, 3 + index // 35), min(130, 92 + (index - 1) // 3 * 2)))
    islands.append(("Crown of Tides", ISLAND_COLORS[-1], 8, 5, 130))
    return tuple(islands)


ISLANDS = make_islands()


@dataclass(frozen=True)
class Pirate:
    name: str
    color: tuple[int, int, int]
    attack_name: str
    attack_range: int
    attack_damage: int
    attack_arc: float
    attack_cooldown: float
    special_name: str
    special_range: int
    special_damage: int
    special_arc: float
    special_cooldown: float


PIRATES = (
    Pirate("Mara the Navigator", (63, 154, 198), "Cutlass", 94, 1, 0.25, 0.38,
           "Tide Burst", 150, 2, -1.0, 6.0),
    Pirate("Flint the Gunner", (214, 137, 71), "Long Shot", 210, 1, 0.94, 0.65,
           "Cannon Blast", 230, 3, 0.85, 7.0),
    Pirate("Iris the Brawler", (174, 101, 182), "Heavy Punch", 65, 2, 0.5, 0.65,
           "Whirlwind", 105, 4, -1.0, 8.0),
    Pirate("Coral the Corsair", (235, 113, 120), "Twin Blades", 110, 2, 0.4, 0.48,
           "Blade Storm", 130, 3, -1.0, 6.5),
    Pirate("Rowan the Ranger", (125, 195, 115), "Arrow Volley", 240, 2, 0.96, 0.7,
           "Piercing Bolt", 300, 4, 0.95, 7.5),
    Pirate("Nova the Mystic", (241, 191, 83), "Star Pulse", 130, 2, 0.6, 0.55,
           "Sunflare", 190, 3, -1.0, 9.0),
)
SHOP_PRICES = {3: 500, 4: 1500, 5: 4000}
SHOP_ITEMS = tuple(SHOP_PRICES)


@dataclass
class Enemy:
    position: pygame.Vector2
    health: int
    speed: float
    boss: bool = False
    flash: float = 0.0


def bound(position: pygame.Vector2) -> None:
    position.x = max(ARENA.left + 20, min(ARENA.right - 20, position.x))
    position.y = max(ARENA.top + 20, min(ARENA.bottom - 20, position.y))


class Game:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.health, self.gold, self.island_index = 100, 0, 0
        self.status = "playing"
        self.pirate_index = 0
        self.unlocked_pirates = {0, 1, 2}
        self.shop_open = False
        self.shop_selection = 0
        self.shop_message = "Choose a pirate to unlock."
        self.attack_timer = self.burst_timer = self.attack_effect = self.burst_effect = 0.0
        self.effect_pirate = PIRATES[0]
        self.effect_facing = pygame.Vector2(1, 0)
        self.burst_pirate = PIRATES[0]
        self.burst_facing = pygame.Vector2(1, 0)
        self.message = "Defeat the raiders, then collect the treasure!"
        self.load_island()

    @property
    def pirate(self) -> Pirate:
        return PIRATES[self.pirate_index]

    def select_pirate(self, index: int) -> None:
        if self.status != "playing" or not 0 <= index < len(PIRATES):
            return
        if index not in self.unlocked_pirates:
            self.message = f"{PIRATES[index].name} is locked. Press B to visit the shop."
            return
        self.pirate_index = index
        self.message = f"{self.pirate.name}: {self.pirate.attack_name} / {self.pirate.special_name}"

    def buy_pirate(self, index: int) -> None:
        if index not in SHOP_PRICES:
            self.shop_message = "This pirate is not for sale."
        elif index in self.unlocked_pirates:
            self.shop_message = f"{PIRATES[index].name} is already unlocked."
        elif self.gold < SHOP_PRICES[index]:
            self.shop_message = f"Not enough gold: need {SHOP_PRICES[index]:,}."
        else:
            self.gold -= SHOP_PRICES[index]
            self.unlocked_pirates.add(index)
            self.shop_message = f"Unlocked {PIRATES[index].name}! Press {index + 1} to select."

    def handle_event(self, event: pygame.event.Event) -> bool:
        if event.type == pygame.QUIT:
            return False
        if event.type != pygame.KEYDOWN:
            return True
        if self.shop_open:
            if event.key in (pygame.K_ESCAPE, pygame.K_b):
                self.shop_open = False
            elif event.key == pygame.K_UP:
                self.shop_selection = (self.shop_selection - 1) % len(SHOP_ITEMS)
            elif event.key == pygame.K_DOWN:
                self.shop_selection = (self.shop_selection + 1) % len(SHOP_ITEMS)
            elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                self.buy_pirate(SHOP_ITEMS[self.shop_selection])
            return True
        if event.key == pygame.K_ESCAPE:
            return False
        if event.key == pygame.K_r:
            self.reset()
        elif event.key == pygame.K_b and self.status == "playing":
            self.shop_open = True
            self.shop_message = "Choose a pirate to unlock."
        elif event.key == pygame.K_SPACE:
            self.attack()
        elif event.key == pygame.K_q:
            self.burst()
        elif event.key == pygame.K_e:
            self.interact()
        elif pygame.K_1 <= event.key <= pygame.K_6:
            self.select_pirate(event.key - pygame.K_1)
        return True

    def load_island(self) -> None:
        self.player = pygame.Vector2(ARENA.left + 100, ARENA.centery)
        self.facing = pygame.Vector2(1, 0)
        self.chest = pygame.Vector2(ARENA.right - 80, ARENA.centery)
        self.chest_open = False
        self.invulnerability = 1.0
        self.attack_timer = self.attack_effect = self.burst_effect = 0.0
        _, _, count, health, speed = ISLANDS[self.island_index]
        self.enemies = [
            Enemy(pygame.Vector2(ARENA.left + 400 + (i % 4) * 145,
                                 ARENA.top + 85 + (i // 4) * 215), health, speed)
            for i in range(count)
        ]
        self.enemies.append(Enemy(pygame.Vector2(ARENA.right - 160, ARENA.centery), 12, 72, True))

    def defeat_enemies(self) -> None:
        defeated = [enemy for enemy in self.enemies if enemy.health <= 0]
        self.gold += sum(100 if enemy.boss else 20 for enemy in defeated)
        self.enemies = [enemy for enemy in self.enemies if enemy.health > 0]
        if defeated and not self.enemies:
            self.message = "Island cleared! Press E near the treasure chest."

    def attack(self) -> None:
        if self.status != "playing" or self.attack_timer > 0:
            return
        pirate = self.pirate
        self.attack_timer, self.attack_effect = pirate.attack_cooldown, 0.16
        self.effect_pirate, self.effect_facing = pirate, self.facing.copy()
        for enemy in self.enemies:
            offset = enemy.position - self.player
            if offset.length_squared() <= pirate.attack_range ** 2 and (
                offset.length_squared() == 0 or self.facing.dot(offset.normalize()) >= pirate.attack_arc
            ):
                enemy.health -= pirate.attack_damage
                enemy.flash = 0.15
                if offset.length_squared():
                    enemy.position += offset.normalize() * 32
                    bound(enemy.position)
        self.defeat_enemies()

    def burst(self) -> None:
        if self.status != "playing" or self.shop_open:
            return
        if self.burst_timer > 0:
            self.message = f"Special ready in {math.ceil(self.burst_timer)}s."
            return
        pirate = self.pirate
        self.burst_timer, self.burst_effect = pirate.special_cooldown, 0.3
        self.burst_pirate, self.burst_facing = pirate, self.facing.copy()
        for enemy in self.enemies:
            offset = enemy.position - self.player
            if offset.length_squared() <= pirate.special_range ** 2 and (
                offset.length_squared() == 0 or self.facing.dot(offset.normalize()) >= pirate.special_arc
            ):
                enemy.health -= pirate.special_damage
                enemy.flash = 0.2
                if offset.length_squared():
                    enemy.position += offset.normalize() * 60
                    bound(enemy.position)
        self.defeat_enemies()

    def interact(self) -> None:
        if self.status != "playing":
            return
        if self.player.distance_to(self.chest) > 85:
            self.message = "Get closer to the treasure chest."
        elif self.enemies:
            self.message = "Defeat every raider to unlock the chest!"
        elif not self.chest_open:
            self.chest_open = True
            self.gold += 150 * (self.island_index + 1)
            if self.island_index == len(ISLANDS) - 1:
                self.status = "won"
                self.message = "You found the Tide Crown!"
            else:
                self.message = "Treasure found! Press E again to sail onward."
        else:
            self.island_index += 1
            self.health = min(100, self.health + 30)
            self.load_island()
            self.message = f"Welcome to {ISLANDS[self.island_index][0]}! Restored up to 30 health."

    def update(self, dt: float, movement: pygame.Vector2) -> None:
        if self.status != "playing" or self.shop_open:
            return
        self.attack_timer = max(0.0, self.attack_timer - dt)
        self.attack_effect = max(0.0, self.attack_effect - dt)
        self.burst_timer = max(0.0, self.burst_timer - dt)
        self.burst_effect = max(0.0, self.burst_effect - dt)
        self.invulnerability = max(0.0, self.invulnerability - dt)
        if movement.length_squared():
            self.facing = movement.normalize()
            self.player += self.facing * 220 * dt
            bound(self.player)
        for enemy in self.enemies:
            enemy.flash = max(0.0, enemy.flash - dt)
            offset = self.player - enemy.position
            distance = offset.length()
            if distance > 0:
                enemy.position += offset.normalize() * min(enemy.speed * dt, distance)
            if enemy.position.distance_to(self.player) < (38 if enemy.boss else 29) and self.invulnerability <= 0:
                self.health = max(0, self.health - (20 if enemy.boss else 10))
                self.invulnerability = 0.8
                if self.health == 0:
                    self.status = "lost"
                    self.message = "Your voyage is over. Press R to try again!"
                    break


class View:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.small = pygame.font.SysFont("arial", 16)
        self.body = pygame.font.SysFont("arial", 20)
        self.bold = pygame.font.SysFont("arial", 23, bold=True)
        self.title = pygame.font.SysFont("arial", 34, bold=True)

    def text(self, text: str, position: tuple[int, int], color: tuple[int, int, int] = (250, 245, 230),
             font: pygame.font.Font | None = None, center: bool = False) -> None:
        image = (font or self.body).render(text, True, color)
        self.screen.blit(image, image.get_rect(center=position) if center else position)

    def draw(self, game: Game) -> None:
        s = self.screen
        s.fill((25, 82, 113))
        for y in range(125, HEIGHT, 35):
            for x in range(0, WIDTH, 85):
                pygame.draw.arc(s, (48, 116, 144), (x, y, 42, 12), 0.2, 2.8, 2)
        pygame.draw.rect(s, (98, 102, 80), ARENA.inflate(14, 14), border_radius=45)
        pygame.draw.rect(s, ISLANDS[game.island_index][1], ARENA, border_radius=40)
        for x, y in ((190, 195), (320, 550), (630, 195), (900, 550)):
            pygame.draw.line(s, (115, 77, 50), (x, y), (x + 5, y + 22), 6)
            pygame.draw.circle(s, (64, 130, 88), (x - 8, y - 5), 14)
            pygame.draw.circle(s, (75, 153, 94), (x + 8, y - 7), 15)
        cx, cy = int(game.chest.x), int(game.chest.y)
        pygame.draw.rect(s, (103, 58, 38), (cx - 28, cy - 15, 56, 38), border_radius=5)
        pygame.draw.rect(s, (235, 187, 66), (cx - 28, cy - 15, 56, 38), 3, border_radius=5)
        pygame.draw.rect(s, (235, 187, 66), (cx - 5, cy - 2, 10, 10))
        self.text("OPEN" if game.chest_open else ("LOCKED" if game.enemies else "E: OPEN"),
                  (cx, cy - 30), (255, 242, 174), self.small, True)
        for enemy in game.enemies:
            radius = 27 if enemy.boss else 17
            color = (255, 255, 255) if enemy.flash else ((139, 55, 96) if enemy.boss else (181, 73, 71))
            pygame.draw.circle(s, (54, 38, 48), enemy.position + pygame.Vector2(0, 5), radius + 3)
            pygame.draw.circle(s, color, enemy.position, radius)
            x, y = int(enemy.position.x), int(enemy.position.y)
            for dx in (-6, 6):
                pygame.draw.circle(s, (255, 245, 213), (x + dx, y - 4), 3)
            maximum = 12 if enemy.boss else ISLANDS[game.island_index][3]
            pygame.draw.rect(s, (54, 38, 48), (x - 23, y - radius - 12, 46, 5))
            pygame.draw.rect(s, (118, 231, 153), (x - 23, y - radius - 12, int(46 * enemy.health / maximum), 5))
            if enemy.boss:
                name = "CAPTAIN MAELSTROM" if game.island_index == len(ISLANDS) - 1 else "RAIDER CAPTAIN"
                self.text(name, (x, y - 49), (255, 221, 130), self.small, True)
        if game.burst_effect:
            if game.burst_pirate.special_arc < 0:
                pygame.draw.circle(s, game.burst_pirate.color, game.player, game.burst_pirate.special_range, 4)
            else:
                pygame.draw.line(s, game.burst_pirate.color, game.player,
                                 game.player + game.burst_facing * game.burst_pirate.special_range, 16)
        if game.attack_effect:
            pygame.draw.line(s, (255, 246, 187), game.player + game.effect_facing * 22,
                             game.player + game.effect_facing * game.effect_pirate.attack_range, 12)
        if game.invulnerability <= 0 or int(game.invulnerability * 10) % 2:
            pygame.draw.circle(s, (40, 42, 55), game.player + pygame.Vector2(0, 5), 21)
            pygame.draw.circle(s, game.pirate.color, game.player, 20)
            pygame.draw.circle(s, (247, 215, 164), game.player + pygame.Vector2(0, -6), 12)
            pygame.draw.line(s, (244, 241, 218), game.player, game.player + game.facing * 27, 4)
        pygame.draw.rect(s, (21, 40, 58), (0, 0, WIDTH, 108))
        self.text("GRAND TIDE", (20, 10), (255, 220, 127), self.title)
        self.text(f"Island {game.island_index + 1}/{len(ISLANDS)}: {ISLANDS[game.island_index][0]}", (22, 57), font=self.body)
        self.text(f"Health: {game.health}/100     Gold: {game.gold}", (400, 18), font=self.bold)
        self.text(f"Enemies: {len(game.enemies)}", (400, 55))
        burst = "READY" if game.burst_timer <= 0 else f"{game.burst_timer:.1f}s"
        self.text(f"{game.pirate.special_name}: {burst}", (770, 20), (147, 233, 255), self.body)
        self.text(game.pirate.name, (770, 55), game.pirate.color, self.small)
        pygame.draw.rect(s, (21, 40, 58), (0, 625, WIDTH, 95))
        self.text(game.message, (25, 638), (255, 226, 146))
        self.text("WASD: move  SPACE: attack  Q: special  1-6: character  B: shop  E: chest  R: restart  ESC: quit",
                  (25, 677), font=self.small)
        if game.shop_open:
            self.draw_shop(game)
        if game.status in ("won", "lost"):
            shade = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            shade.fill((5, 15, 30, 190))
            s.blit(shade, (0, 0))
            title = "VOYAGE COMPLETE!" if game.status == "won" else "SHIPWRECKED!"
            self.text(title, (WIDTH // 2, 285), (255, 224, 135), self.title, True)
            self.text(f"Gold remaining: {game.gold}", (WIDTH // 2, 340), center=True)
            self.text("Press R to play again or Esc to quit", (WIDTH // 2, 380), center=True)
        pygame.display.flip()

    def draw_shop(self, game: Game) -> None:
        shade = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        shade.fill((5, 15, 30, 210))
        self.screen.blit(shade, (0, 0))
        pygame.draw.rect(self.screen, (36, 57, 78), (155, 90, 790, 550), border_radius=18)
        self.text("PIRATE SHOP", (185, 110), (255, 220, 127), self.title)
        self.text(f"Gold: {game.gold:,}", (185, 158), (255, 220, 127), self.bold)
        self.text("UP / DOWN: choose   ENTER: buy   B / ESC: close", (185, 194), font=self.small)
        for row, index in enumerate(SHOP_ITEMS):
            pirate = PIRATES[index]
            y = 230 + row * 100
            pygame.draw.rect(self.screen, (74, 94, 114) if row == game.shop_selection else (25, 43, 61),
                             (185, y, 730, 85), border_radius=10)
            self.text(f"{index + 1}. {pirate.name}", (200, y + 8), pirate.color, self.bold)
            price = "UNLOCKED" if index in game.unlocked_pirates else f"{SHOP_PRICES[index]:,} gold"
            self.text(price, (740, y + 12), (255, 220, 127))
            self.text(f"{pirate.attack_name}: {pirate.attack_damage} damage, {pirate.attack_range} range",
                      (200, y + 37), font=self.small)
            self.text(f"{pirate.special_name}: {pirate.special_damage} damage, {pirate.special_range} range, "
                      f"{pirate.special_cooldown:g}s cooldown", (200, y + 58), font=self.small)
        self.text(game.shop_message, (185, 553), (255, 226, 146), self.body)
        self.text("Combat pauses while shopping. Purchases last until restart.", (185, 592), font=self.small)


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Grand Tide")
    clock = pygame.time.Clock()
    game = Game()
    view = View(screen)
    running = True
    while running:
        dt = min(clock.tick(60) / 1000, 0.05)
        for event in pygame.event.get():
            if not game.handle_event(event):
                running = False
        keys = pygame.key.get_pressed()
        movement = pygame.Vector2(
            int(keys[pygame.K_d] or keys[pygame.K_RIGHT]) - int(keys[pygame.K_a] or keys[pygame.K_LEFT]),
            int(keys[pygame.K_s] or keys[pygame.K_DOWN]) - int(keys[pygame.K_w] or keys[pygame.K_UP]),
        )
        game.update(dt, movement)
        view.draw(game)
    pygame.quit()


if __name__ == "__main__":
    main()