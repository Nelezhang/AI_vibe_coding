import os
import random
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame

from main import (
    CREATURES, HEIGHT, MARKET, PLAYER_BASE, RIVAL_BASE, SLOTS, WIDTH,
    Game, View, slot_position,
)


class GameTests(unittest.TestCase):
    def setUp(self) -> None:
        self.game = Game(random.Random(7))

    def test_income_and_market_purchase(self) -> None:
        self.game.update(2, pygame.Vector2())
        self.assertEqual(self.game.cash, 106)
        self.game.player = MARKET.copy()
        self.game.offer = CREATURES[1]
        self.game.interact()
        self.assertEqual(self.game.cash, 41)
        self.assertEqual(self.game.income, 7)
        self.assertEqual(self.game.own[-1], CREATURES[1])
        self.game.offer = CREATURES[-1]
        self.game.interact()
        self.assertEqual(self.game.cash, 41)
        self.assertIn("Not enough", self.game.message)

    def test_steal_locked_then_deliver_and_earn(self) -> None:
        creature = self.game.rival[0]
        self.game.player = slot_position(RIVAL_BASE, 0)
        self.game.interact()
        self.assertIsNone(self.game.carried)
        self.assertIn("shield", self.game.message)
        self.game.elapsed = 10
        self.game.interact()
        self.assertEqual(self.game.carried, creature)
        self.assertEqual(len(self.game.rival), 3)
        self.game.player = pygame.Vector2(PLAYER_BASE.center)
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.carried)
        self.assertIn(creature, self.game.own)
        self.assertEqual(self.game.income, CREATURES[0].income + creature.income)

    def test_guard_returns_stolen_creature(self) -> None:
        self.game.elapsed = 10
        self.game.player = slot_position(RIVAL_BASE, 0)
        creature = self.game.rival[0]
        self.game.interact()
        self.game.guard = self.game.player.copy()
        self.game.update(0.1, pygame.Vector2())
        self.assertEqual(self.game.carried, creature)
        self.game.guard_delay = 0
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.carried)
        self.assertIn(creature, self.game.rival)

    def test_raider_steals_and_player_recovers(self) -> None:
        self.game.raider_pause = 0
        self.game.raider = slot_position(PLAYER_BASE, 0)
        self.game.update(0.01, pygame.Vector2())
        self.assertEqual(self.game.raider_carry, CREATURES[0])
        self.assertEqual(self.game.income, 0)
        self.game.player = self.game.raider.copy()
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.raider_carry)
        self.assertEqual(self.game.own, [CREATURES[0]])

    def test_raider_escape_and_shield(self) -> None:
        self.game.raider_pause = 0
        self.game.raider = slot_position(PLAYER_BASE, 0)
        self.game.lock_base()
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.raider_carry)
        self.assertEqual(self.game.own, [CREATURES[0]])
        self.game.lock_base()
        self.assertIn("recharges", self.game.message)
        self.game.lock_remaining = 0
        self.game.raider = slot_position(PLAYER_BASE, 0)
        self.game.update(0.01, pygame.Vector2())
        self.game.raider = pygame.Vector2(840, 570)
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.raider_carry)
        self.assertIn(CREATURES[0], self.game.rival)

    def test_reserved_slots_prevent_overflow(self) -> None:
        self.game.own = [CREATURES[0]] * (SLOTS - 1)
        self.game.raider_carry = CREATURES[1]
        self.game.player = MARKET.copy()
        self.game.offer = CREATURES[0]
        self.game.interact()
        self.assertEqual(len(self.game.own), SLOTS - 1)
        self.assertIn("full", self.game.message)
        self.game.rival = [CREATURES[0]] * (SLOTS - 1)
        self.game.carried = CREATURES[1]
        self.game.raider_carry = None
        self.game.raider_pause = 0
        self.game.raider = slot_position(PLAYER_BASE, 0)
        self.game.update(0.01, pygame.Vector2())
        self.assertIsNone(self.game.raider_carry)

    def test_offer_rolls_and_all_creatures_render(self) -> None:
        self.assertEqual({self.game.roll_offer() for _ in range(5000)}, set(CREATURES))
        pygame.init()
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = View(screen)
        for creature in CREATURES:
            self.game.offer = creature
            self.game.own = [creature]
            self.game.carried = creature
            self.game.raider_carry = creature
            view.draw(self.game)
        pygame.quit()


if __name__ == "__main__":
    unittest.main()
