"""Behavior tests for the claw machine."""

import os
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame

from main import (
    BASE_RARITIES, CAPSULE_COLUMNS, CAPSULE_COUNT, CAPSULE_ROWS, GRAB_RADIUS, PRIZE_TYPES, RARITIES, SHOP, STARTING_PLAYS,
    ClawMachine, GameView, HEIGHT, WIDTH, Prize, draw_capsule, draw_prize,
)


class ClawMachineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.save_path = Path(self.tempdir.name) / "progress.json"
        self.game = ClawMachine(random.Random(4), self.save_path)

    def finish_turn(self) -> None:
        for _ in range(1000):
            self.game.update(0.05)
            if self.game.state in ("aim", "game_over"):
                return
        self.fail("Claw did not finish its turn")

    def test_grab_awards_points_only_after_delivery(self) -> None:
        prize = self.game.prizes[0]
        self.game.claw_x = prize.x
        self.game.start_drop()
        self.assertEqual(self.game.plays, STARTING_PLAYS - 1)
        self.assertEqual(self.game.score, 0)
        while self.game.state == "descending":
            self.game.update(0.05)
        self.assertNotIn(prize.name, self.game.message)
        self.assertNotIn(prize.rarity, self.game.message)
        self.assertEqual(self.game.score, 0)
        self.assertEqual(self.game.won, [])
        self.game.start_drop()
        self.assertEqual(self.game.plays, STARTING_PLAYS - 1)
        self.finish_turn()
        self.assertEqual(self.game.score, prize.points)
        self.assertEqual(self.game.won, [prize])
        self.assertNotIn(prize, self.game.prizes)

    def test_miss_and_last_play_end_game(self) -> None:
        self.game.plays = 1
        self.game.claw_x = 155
        self.assertTrue(all(abs(p.x - self.game.claw_x) > GRAB_RADIUS for p in self.game.prizes))
        self.game.start_drop()
        self.finish_turn()
        self.assertEqual(self.game.state, "game_over")
        self.assertEqual(self.game.score, 0)
        self.assertEqual(len(self.game.prizes), CAPSULE_COUNT)
        self.game.start_drop()
        self.assertEqual(self.game.plays, 0)

    def test_collect_all_and_restart(self) -> None:
        while self.game.prizes:
            self.game.claw_x = self.game.prizes[0].x
            self.game.start_drop()
            self.finish_turn()
        self.assertEqual(self.game.state, "game_over")
        self.assertEqual(len(self.game.won), CAPSULE_COUNT)
        self.assertEqual(self.game.plays, STARTING_PLAYS - CAPSULE_COUNT)
        self.game.reset()
        self.assertEqual((self.game.plays, self.game.score, len(self.game.prizes)), (STARTING_PLAYS, 0, CAPSULE_COUNT))
        self.assertEqual(self.game.state, "aim")

    def test_render_each_game_phase(self) -> None:
        pygame.init()
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = GameView(screen)
        view.draw(self.game)
        self.game.claw_x = self.game.prizes[0].x
        self.game.start_drop()
        seen = set()
        for _ in range(1000):
            seen.add(self.game.state)
            view.draw(self.game)
            self.game.update(0.05)
            if self.game.state == "aim":
                break
        self.assertTrue({"descending", "rising", "returning", "dropping"} <= seen)
        self.game.state = "game_over"
        view.draw(self.game)
        pygame.quit()

    def test_rarities_are_weighted_and_all_toys_are_reachable(self) -> None:
        self.assertEqual(len(PRIZE_TYPES), 43)
        self.assertEqual(len(RARITIES), 11)
        self.assertEqual(len({toy.name for toy in PRIZE_TYPES}), len(PRIZE_TYPES))
        self.assertEqual(sum(RARITIES[name][0] for name in BASE_RARITIES), 100)
        seen = set()
        counts = {rarity: 0 for rarity in RARITIES}
        for _ in range(1000):
            self.game.reset()
            for prize in self.game.prizes:
                seen.add(prize.name)
                counts[prize.rarity] += 1
                self.assertEqual(prize.points, RARITIES[prize.rarity][1])
        self.assertEqual(seen, {toy.name for toy in PRIZE_TYPES if toy.rarity in BASE_RARITIES})
        for rarity in BASE_RARITIES:
            weight = RARITIES[rarity][0]
            self.assertLess(abs(counts[rarity] / (1000 * CAPSULE_COUNT) - weight / 100), 0.02)
        self.assertTrue(all(counts[name] == 0 for name in SHOP))

    def test_shop_purchases_persist_and_change_future_capsules(self) -> None:
        self.game.balance = 20000
        original = list(self.game.prizes)
        self.game.buy_rarity("Celestial")
        self.assertEqual(self.game.balance, 0)
        self.assertEqual(self.game.unlocked, {"Celestial"})
        self.assertEqual(self.game.prizes, original)
        reloaded = ClawMachine(random.Random(5), self.save_path)
        self.assertEqual((reloaded.balance, reloaded.unlocked), (0, {"Celestial"}))
        seen = set()
        for _ in range(100):
            reloaded.reset()
            seen.update(prize.rarity for prize in reloaded.prizes)
        self.assertIn("Celestial", seen)
        self.assertNotIn("Abyssal", seen)
        self.assertNotIn("Eternal", seen)
        self.assertTrue(all(prize.rarity not in {"Abyssal", "Eternal"} for prize in reloaded.prizes))

    def test_shop_rejects_insufficient_duplicate_and_unknown_purchases(self) -> None:
        self.game.balance = 19999
        self.game.buy_rarity("Celestial")
        self.assertEqual(self.game.balance, 19999)
        self.assertIn("Not enough", self.game.message)
        self.game.balance = 100000000
        self.game.buy_rarity("Eternal")
        self.assertEqual(self.game.balance, 0)
        self.assertIn("Eternal", self.game.unlocked)
        self.game.buy_rarity("Eternal")
        self.assertIn("already unlocked", self.game.message)
        self.game.buy_rarity("Unknown")
        self.assertIn("not in the shop", self.game.message)
        self.assertEqual(self.game.balance, 0)

    def test_awards_and_resets_preserve_saved_balance(self) -> None:
        prize = self.game.prizes[0]
        self.game.claw_x = prize.x
        self.game.start_drop()
        self.finish_turn()
        self.game.reset()
        self.assertEqual((self.game.score, self.game.balance), (0, prize.points))
        self.assertEqual(ClawMachine(random.Random(3), self.save_path).balance, prize.points)

    def test_save_failure_is_visible_and_purchase_is_not_committed(self) -> None:
        self.game.balance = 20000
        with patch("main.os.replace", side_effect=OSError("disk full")):
            self.game.buy_rarity("Celestial")
        self.assertEqual(self.game.balance, 20000)
        self.assertNotIn("Celestial", self.game.unlocked)
        self.assertIn("disk full", self.game.save_error)
        self.assertFalse(self.save_path.exists())

    def test_failed_award_save_can_be_retried(self) -> None:
        prize = self.game.prizes[0]
        self.game.claw_x = prize.x
        self.game.start_drop()
        with patch("main.os.replace", side_effect=OSError("disk full")):
            self.finish_turn()
        self.assertEqual(self.game.balance, prize.points)
        self.assertIn("disk full", self.game.save_error)
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_s))
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_t))
        self.assertEqual(self.game.save_error, "")
        self.assertEqual(ClawMachine(random.Random(3), self.save_path).balance, prize.points)

    def test_shop_input_render_and_capsule_colors(self) -> None:
        pygame.init()
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = GameView(screen)
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_s))
        self.assertTrue(self.game.shop_open)
        view.draw(self.game)
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_DOWN))
        self.assertEqual(self.game.shop_selection, 1)
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN))
        self.assertIn("Not enough", self.game.message)
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_ESCAPE))
        self.assertFalse(self.game.shop_open)
        images = set()
        for rarity in SHOP:
            surface = pygame.Surface((86, 90), pygame.SRCALPHA)
            draw_capsule(surface, 43, 45, rarity=rarity)
            self.assertEqual(surface.get_at((43, 30))[:3], RARITIES[rarity][2])
            images.add(pygame.image.tobytes(surface, "RGBA"))
        self.assertEqual(len(images), len(SHOP))
        toy = next(toy for toy in PRIZE_TYPES if toy.rarity == "Celestial")
        prize = Prize(toy.name, toy.color, RARITIES[toy.rarity][1], toy.kind, toy.rarity, 225, 420)
        self.game.prizes = [prize]
        with patch("main.draw_capsule", wraps=draw_capsule) as draw:
            view.draw(self.game)
            self.assertEqual(draw.call_args.kwargs["rarity"], "Celestial")
            self.game.prizes.clear()
            self.game.carried = prize
            view.draw(self.game)
            self.assertEqual(draw.call_args.kwargs["rarity"], "Celestial")
        pygame.quit()

    def test_invalid_save_is_reported(self) -> None:
        self.save_path.write_text('{"balance": -1, "unlocked": []}', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Invalid progress file"):
            ClawMachine(random.Random(2), self.save_path)

    def test_layers_can_be_collected_from_top_to_bottom(self) -> None:
        self.assertEqual((CAPSULE_COLUMNS, CAPSULE_ROWS, CAPSULE_COUNT, STARTING_PLAYS), (9, 3, 27, 30))
        column = [prize for prize in self.game.prizes if prize.x == self.game.prizes[0].x]
        self.assertEqual(len(column), CAPSULE_ROWS)
        for expected in sorted(column, key=lambda prize: prize.y):
            self.game.claw_x = expected.x
            self.game.start_drop()
            self.assertIs(self.game.target, expected)
            self.finish_turn()
            self.assertIs(self.game.won[-1], expected)
        self.game.claw_x = column[0].x
        self.game.start_drop()
        self.assertIsNone(self.game.target)
        self.finish_turn()

    def test_collection_remains_renderable_with_all_capsules_won(self) -> None:
        pygame.init()
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = GameView(screen)
        self.game.won = list(self.game.prizes)
        self.game.prizes.clear()
        self.game.state = "game_over"
        view.draw(self.game)
        pygame.quit()

    def test_every_toy_renders_and_has_a_valid_rarity(self) -> None:
        pygame.init()
        images = set()
        for toy in PRIZE_TYPES:
            self.assertIn(toy.rarity, RARITIES)
            prize = Prize(toy.name, toy.color, RARITIES[toy.rarity][1], toy.kind, toy.rarity, 0, 0)
            surface = pygame.Surface((86, 90), pygame.SRCALPHA)
            draw_prize(surface, prize, 43, 45)
            images.add(pygame.image.tobytes(surface, "RGBA"))
        self.assertEqual(len(images), len(PRIZE_TYPES))
        pygame.quit()

    def test_capsules_are_golden_only_for_supernatural(self) -> None:
        pygame.init()
        normal = pygame.Surface((86, 90), pygame.SRCALPHA)
        golden = pygame.Surface((86, 90), pygame.SRCALPHA)
        draw_capsule(normal, 43, 45)
        draw_capsule(golden, 43, 45, supernatural=True)
        self.assertNotEqual(pygame.image.tobytes(normal, "RGBA"), pygame.image.tobytes(golden, "RGBA"))
        self.assertEqual(golden.get_at((43, 30))[:3], (255, 214, 101))
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = GameView(screen)
        toy = next(toy for toy in PRIZE_TYPES if toy.rarity == "Supernatural")
        prize = Prize(toy.name, toy.color, RARITIES[toy.rarity][1], toy.kind, toy.rarity, 225, 420)
        self.game.prizes = [prize]
        with patch("main.draw_capsule", wraps=draw_capsule) as draw:
            view.draw(self.game)
            self.assertTrue(draw.call_args.kwargs["supernatural"])
            self.game.prizes.clear()
            self.game.carried = prize
            self.game.state = "returning"
            view.draw(self.game)
            self.assertTrue(draw.call_args.kwargs["supernatural"])
        prize.rarity = "Common"
        self.game.carried = None
        self.game.prizes = [prize]
        with patch("main.draw_capsule", wraps=draw_capsule) as draw:
            view.draw(self.game)
            self.assertFalse(draw.call_args.kwargs["supernatural"])
        pygame.quit()

    def test_supernatural_capsule_reveals_its_toy_only_after_delivery(self) -> None:
        toy = next(toy for toy in PRIZE_TYPES if toy.rarity == "Supernatural")
        prize = Prize(toy.name, toy.color, RARITIES[toy.rarity][1], toy.kind, toy.rarity, 225, 420)
        self.game.prizes[0] = prize
        self.game.claw_x = prize.x
        self.game.start_drop()
        while self.game.state == "descending":
            self.game.update(0.05)
        self.assertNotIn(prize.name, self.game.message)
        self.assertEqual(self.game.score, 0)
        self.finish_turn()
        self.assertIn(prize.name, self.game.message)
        self.assertIn("Supernatural", self.game.message)
        self.assertEqual(self.game.score, 10000)

    def test_last_play_reveals_its_prize(self) -> None:
        self.game.plays = 1
        prize = self.game.prizes[0]
        self.game.claw_x = prize.x
        self.game.start_drop()
        self.finish_turn()
        self.assertEqual(self.game.state, "game_over")
        self.assertIn(prize.name, self.game.message)
        self.assertIn(prize.rarity, self.game.message)
        self.assertIn(str(prize.points), self.game.message)

    def test_last_play_miss_does_not_repeat_old_reveal(self) -> None:
        prize = self.game.prizes[0]
        self.game.claw_x = prize.x
        self.game.start_drop()
        self.finish_turn()
        self.game.plays = 1
        self.game.claw_x = 155
        self.game.start_drop()
        self.finish_turn()
        self.assertEqual(self.game.state, "game_over")
        self.assertEqual(self.game.message, "Out of plays! Press R for a new game.")


if __name__ == "__main__":
    unittest.main()
