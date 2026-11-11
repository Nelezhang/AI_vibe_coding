"""A single-player creature-collecting and stealing arcade game."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

import pygame

WIDTH, HEIGHT = 1100, 720
PLAYER_BASE = pygame.Rect(30, 180, 260, 340)
RIVAL_BASE = pygame.Rect(810, 180, 260, 340)
MARKET = pygame.Vector2(550, 350)
SLOTS = 6
PLAYER_SPEED = 225
GUARD_SPEED = 145
RAIDER_SPEED = 125
LOCK_DURATION = 12.0
LOCK_COOLDOWN = 30.0
RIVAL_CYCLE = 24.0
RIVAL_LOCKED = 9.0


@dataclass(frozen=True)
class CreatureType:
    name: str
    rarity: str
    color: tuple[int, int, int]
    price: int
    income: int
    shape: str
    weight: int


CREATURES = (
    CreatureType("Bananinja", "Common", (255, 216, 75), 50, 3, "banana", 35),
    CreatureType("Socktopus", "Common", (243, 145, 190), 65, 4, "octopus", 30),
    CreatureType("Disco Pigeon", "Rare", (135, 205, 255), 160, 10, "bird", 18),
    CreatureType("Pizza Wizard", "Epic", (255, 149, 91), 350, 24, "pizza", 10),
    CreatureType("Turbo Turnip", "Legendary", (192, 138, 255), 850, 60, "turnip", 5),
    CreatureType("Cosmic Toaster", "Mythic", (114, 240, 216), 2000, 150, "toaster", 2),
)

RARITY_COLORS = {
    "Common": (210, 220, 229),
    "Rare": (108, 189, 255),
    "Epic": (206, 145, 255),
    "Legendary": (255, 205, 88),
    "Mythic": (255, 125, 185),
}


def slot_position(base: pygame.Rect, index: int) -> pygame.Vector2:
    return pygame.Vector2(base.x + 65 + (index % 2) * 130, base.y + 105 + (index // 2) * 85)


def move_toward(position: pygame.Vector2, target: pygame.Vector2, distance: float) -> None:
    delta = target - position
    if delta.length_squared() > 0:
        position += delta.normalize() * min(distance, delta.length())


class Game:
    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng if rng is not None else random.Random()
        self.reset()

    def reset(self) -> None:
        self.player = pygame.Vector2(325, 350)
        self.guard = pygame.Vector2(920, 550)
        self.raider = pygame.Vector2(785, 570)
        self.cash = 100
        self.income_fraction = 0.0
        self.own: list[CreatureType] = [CREATURES[0]]
        self.rival: list[CreatureType] = [CREATURES[1], CREATURES[2], CREATURES[3], CREATURES[4]]
        self.carried: CreatureType | None = None
        self.raider_carry: CreatureType | None = None
        self.guard_delay = 0.0
        self.raider_pause = 6.0
        self.lock_remaining = 0.0
        self.lock_cooldown = 0.0
        self.elapsed = 0.0
        self.offer_timer = 0.0
        self.offer = self.roll_offer()
        self.message = "Buy a creature or sneak into the rival base!"
        self.message_timer = 5.0

    def roll_offer(self) -> CreatureType:
        return self.rng.choices(CREATURES, weights=[item.weight for item in CREATURES])[0]

    @property
    def rival_locked(self) -> bool:
        return self.elapsed % RIVAL_CYCLE < RIVAL_LOCKED

    @property
    def income(self) -> int:
        return sum(item.income for item in self.own)

    @property
    def own_occupied(self) -> int:
        return len(self.own) + int(self.raider_carry is not None)

    def say(self, text: str) -> None:
        self.message = text
        self.message_timer = 4.0

    def interact(self) -> None:
        if self.carried:
            self.say("Bring the creature back to your blue base!")
            return
        if self.player.distance_to(MARKET) <= 95:
            if self.own_occupied >= SLOTS:
                self.say("Your base is full! No room to buy.")
            elif self.cash < self.offer.price:
                self.say(f"Not enough cash: need ${self.offer.price}.")
            else:
                self.cash -= self.offer.price
                self.own.append(self.offer)
                self.say(f"Bought {self.offer.name}! It earns ${self.offer.income}/sec.")
                self.offer = self.roll_offer()
                self.offer_timer = 0.0
            return
        for index, creature in enumerate(self.rival):
            if self.player.distance_to(slot_position(RIVAL_BASE, index)) <= 55:
                if self.rival_locked:
                    self.say("Rival shield is active! Wait for it to open.")
                elif self.own_occupied >= SLOTS:
                    self.say("Your base is full! No room for a stolen creature.")
                else:
                    self.carried = self.rival.pop(index)
                    self.guard_delay = 2.0
                    self.say(f"Run! Carry {creature.name} back to your base!")
                return
        self.say("Get closer to the market or a rival creature.")

    def lock_base(self) -> None:
        if self.lock_cooldown > 0:
            self.say(f"Shield recharges in {math.ceil(self.lock_cooldown)}s.")
        else:
            self.lock_remaining = LOCK_DURATION
            self.lock_cooldown = LOCK_COOLDOWN
            self.say("Your base shield is active for 12 seconds!")

    def update(self, dt: float, movement: pygame.Vector2) -> None:
        self.elapsed += dt
        self.message_timer = max(0.0, self.message_timer - dt)
        self.lock_remaining = max(0.0, self.lock_remaining - dt)
        self.lock_cooldown = max(0.0, self.lock_cooldown - dt)
        self.guard_delay = max(0.0, self.guard_delay - dt)
        self.offer_timer += dt
        if self.offer_timer >= 12:
            self.offer_timer %= 12
            self.offer = self.roll_offer()
        self.income_fraction += self.income * dt
        earned = int(self.income_fraction)
        self.income_fraction -= earned
        self.cash += earned

        if movement.length_squared():
            self.player += movement.normalize() * PLAYER_SPEED * dt
        self.player.x = max(20, min(WIDTH - 20, self.player.x))
        self.player.y = max(125, min(HEIGHT - 30, self.player.y))

        if self.carried and PLAYER_BASE.collidepoint(self.player.x, self.player.y):
            self.own.append(self.carried)
            self.say(f"Safe! {self.carried.name} is earning ${self.carried.income}/sec.")
            self.carried = None

        if self.carried and self.guard_delay == 0:
            move_toward(self.guard, self.player, GUARD_SPEED * dt)
            if self.guard.distance_to(self.player) < 27:
                self.rival.append(self.carried)
                self.say(f"Caught! {self.carried.name} went back to the rival.")
                self.carried = None
        else:
            move_toward(self.guard, pygame.Vector2(920, 550), GUARD_SPEED * dt)

        self.update_raider(dt)

    def update_raider(self, dt: float) -> None:
        if self.raider_carry:
            move_toward(self.raider, pygame.Vector2(850, 570), RAIDER_SPEED * dt)
            if self.raider.distance_to(self.player) < 35:
                self.own.append(self.raider_carry)
                self.say(f"Recovered {self.raider_carry.name} from the raider!")
                self.raider_carry = None
                self.raider_pause = 8.0
            elif self.raider.x >= 840:
                self.rival.append(self.raider_carry)
                self.say(f"The raider escaped with {self.raider_carry.name}!")
                self.raider_carry = None
                self.raider_pause = 8.0
        elif self.raider_pause > 0:
            self.raider_pause = max(0.0, self.raider_pause - dt)
            move_toward(self.raider, pygame.Vector2(785, 570), RAIDER_SPEED * dt)
        elif not self.own or self.lock_remaining > 0 or len(self.rival) + int(self.carried is not None) >= SLOTS:
            move_toward(self.raider, pygame.Vector2(325, 570), RAIDER_SPEED * dt)
        else:
            index = max(range(len(self.own)), key=lambda i: self.own[i].income)
            target = slot_position(PLAYER_BASE, index)
            move_toward(self.raider, target, RAIDER_SPEED * dt)
            if self.raider.distance_to(target) < 15:
                self.raider_carry = self.own.pop(index)
                self.say(f"Raider stole {self.raider_carry.name}! Touch the raider to recover it!")


def draw_creature(screen: pygame.Surface, creature: CreatureType, pos: pygame.Vector2, radius: int = 22) -> None:
    x, y = int(pos.x), int(pos.y)
    color = creature.color
    dark = (35, 38, 57)
    if creature.shape == "banana":
        pygame.draw.ellipse(screen, color, (x - radius, y - radius, radius * 2, radius * 2))
        pygame.draw.ellipse(screen, (55, 66, 87), (x - radius + 8, y - radius - 5, radius * 2 - 4, radius * 2 - 4))
    elif creature.shape == "pizza":
        pygame.draw.polygon(screen, color, [(x, y + radius), (x - radius, y - radius), (x + radius, y - radius)])
        pygame.draw.line(screen, (245, 200, 125), (x - radius, y - radius), (x + radius, y - radius), 7)
    elif creature.shape == "toaster":
        pygame.draw.rect(screen, color, (x - radius, y - radius + 4, radius * 2, radius * 2 - 4), border_radius=8)
        pygame.draw.line(screen, dark, (x - 12, y - radius + 8), (x + 12, y - radius + 8), 3)
    else:
        pygame.draw.circle(screen, color, (x, y), radius)
        if creature.shape == "octopus":
            for dx in (-15, -5, 5, 15):
                pygame.draw.line(screen, color, (x + dx, y + 10), (x + dx + 3, y + radius + 7), 5)
        elif creature.shape == "bird":
            pygame.draw.polygon(screen, (255, 200, 84), [(x + 15, y), (x + 30, y + 5), (x + 15, y + 9)])
        elif creature.shape == "turnip":
            pygame.draw.polygon(screen, (99, 215, 125), [(x, y - radius), (x - 12, y - radius - 15), (x, y - radius - 8), (x + 12, y - radius - 18)])
    for dx in (-7, 7):
        pygame.draw.circle(screen, dark, (x + dx, y), 3)
    pygame.draw.arc(screen, dark, (x - 7, y + 4, 14, 9), 3.14, 6.28, 2)


class View:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.font = pygame.font.SysFont("arial", 18)
        self.small = pygame.font.SysFont("arial", 14)
        self.bold = pygame.font.SysFont("arial", 22, bold=True)
        self.title = pygame.font.SysFont("arial", 30, bold=True)

    def text(self, text: str, pos: tuple[int, int], color: tuple[int, int, int] = (240, 245, 255),
             font: pygame.font.Font | None = None, center: bool = False) -> None:
        image = (font or self.font).render(text, True, color)
        self.screen.blit(image, image.get_rect(center=pos) if center else pos)

    def draw_base(self, base: pygame.Rect, creatures: list[CreatureType], name: str, color: tuple[int, int, int],
                  shielded: bool) -> None:
        pygame.draw.rect(self.screen, (44, 54, 75), base, border_radius=18)
        pygame.draw.rect(self.screen, color, base, 4, border_radius=18)
        if shielded:
            pygame.draw.rect(self.screen, (255, 225, 103), base.inflate(10, 10), 4, border_radius=20)
        self.text(name, (base.centerx, base.y + 27), color, self.bold, True)
        self.text("SHIELD ON" if shielded else "OPEN", (base.centerx, base.y + 50),
                  (255, 225, 103) if shielded else (180, 200, 215), self.small, True)
        for index in range(SLOTS):
            pos = slot_position(base, index)
            pygame.draw.circle(self.screen, (70, 82, 102), pos, 33)
            if index < len(creatures):
                creature = creatures[index]
                draw_creature(self.screen, creature, pos)
                self.text(creature.name, (int(pos.x), int(pos.y + 31)), RARITY_COLORS[creature.rarity], self.small, True)

    def draw(self, game: Game) -> None:
        screen = self.screen
        screen.fill((24, 31, 49))
        pygame.draw.rect(screen, (35, 44, 61), (0, 105, WIDTH, 615))
        for x in range(0, WIDTH, 80):
            pygame.draw.line(screen, (40, 51, 67), (x, 105), (x, HEIGHT), 1)
        self.draw_base(PLAYER_BASE, game.own, "YOUR BASE", (100, 202, 255), game.lock_remaining > 0)
        self.draw_base(RIVAL_BASE, game.rival, "RIVAL BASE", (255, 136, 155), game.rival_locked)
        pygame.draw.rect(screen, (83, 71, 105), (420, 230, 260, 215), border_radius=20)
        pygame.draw.rect(screen, (217, 180, 255), (420, 230, 260, 215), 3, border_radius=20)
        self.text("CREATURE MARKET", (550, 255), (229, 200, 255), self.bold, True)
        draw_creature(screen, game.offer, pygame.Vector2(550, 305), 25)
        self.text(game.offer.name, (550, 355), RARITY_COLORS[game.offer.rarity], self.bold, True)
        self.text(f"{game.offer.rarity}  |  ${game.offer.price}  |  +${game.offer.income}/s", (550, 385), center=True)
        self.text(f"E to buy nearby   New offer: {math.ceil(12 - game.offer_timer)}s", (550, 415), font=self.small, center=True)

        pygame.draw.circle(screen, (255, 123, 123), game.guard, 18)
        self.text("GUARD", (int(game.guard.x), int(game.guard.y - 29)), (255, 174, 174), self.small, True)
        pygame.draw.circle(screen, (255, 177, 80), game.raider, 17)
        self.text("RAIDER", (int(game.raider.x), int(game.raider.y - 28)), (255, 210, 140), self.small, True)
        if game.raider_carry:
            draw_creature(screen, game.raider_carry, game.raider + pygame.Vector2(0, -50), 15)
        pygame.draw.circle(screen, (87, 181, 255), game.player, 18)
        pygame.draw.circle(screen, (245, 250, 255), game.player + pygame.Vector2(-5, -4), 3)
        pygame.draw.circle(screen, (245, 250, 255), game.player + pygame.Vector2(5, -4), 3)
        if game.carried:
            draw_creature(screen, game.carried, game.player + pygame.Vector2(0, -42), 16)

        self.text("BRAINROT HEIST", (20, 12), (255, 225, 130), self.title)
        self.text(f"Cash: ${game.cash:,}   Income: ${game.income}/s   Base: {len(game.own)}/{SLOTS}", (20, 54), font=self.bold)
        shield = f"ACTIVE {math.ceil(game.lock_remaining)}s" if game.lock_remaining else (
            f"ready in {math.ceil(game.lock_cooldown)}s" if game.lock_cooldown else "READY")
        self.text(f"Your shield: {shield}", (740, 20), (255, 225, 130))
        rival_time = RIVAL_LOCKED - game.elapsed % RIVAL_CYCLE if game.rival_locked else RIVAL_CYCLE - game.elapsed % RIVAL_CYCLE
        self.text(f"Rival {'opens' if game.rival_locked else 'locks'} in {math.ceil(rival_time)}s", (740, 50))
        pygame.draw.rect(screen, (17, 24, 39), (10, 655, 1080, 55), border_radius=10)
        self.text(game.message if game.message_timer else "Steal, earn cash, and protect your creatures!", (25, 663), (255, 224, 141))
        self.text("WASD / arrows: move     E: buy / steal     L: shield     R: restart     Esc: quit", (25, 688), font=self.small)
        pygame.display.flip()


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Brainrot Heist")
    clock = pygame.time.Clock()
    game = Game()
    view = View(screen)
    running = True
    while running:
        dt = min(clock.tick(60) / 1000, 0.05)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_e:
                    game.interact()
                elif event.key == pygame.K_l:
                    game.lock_base()
                elif event.key == pygame.K_r:
                    game.reset()
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
