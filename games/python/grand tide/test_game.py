import os
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame

from main import ARENA, HEIGHT, ISLANDS, PIRATES, SHOP_PRICES, WIDTH, Enemy, Game, View


class GameTests(unittest.TestCase):
    def setUp(self) -> None:
        self.game = Game()

    def test_sword_direction_cooldown_and_reward(self) -> None:
        self.game.player = pygame.Vector2(300, 300)
        front = Enemy(pygame.Vector2(350, 300), 1, 0)
        behind = Enemy(pygame.Vector2(260, 300), 2, 0)
        self.game.enemies = [front, behind]
        self.game.attack()
        self.assertEqual(self.game.enemies, [behind])
        self.assertEqual(self.game.gold, 20)
        self.game.facing = pygame.Vector2(-1, 0)
        self.game.attack()
        self.assertEqual(behind.health, 2)
        self.game.update(0.4, pygame.Vector2())
        self.game.attack()
        self.assertEqual(behind.health, 1)

    def test_burst_range_damage_and_cooldown(self) -> None:
        self.game.player = pygame.Vector2(400, 300)
        near = Enemy(pygame.Vector2(450, 300), 5, 0)
        far = Enemy(pygame.Vector2(600, 300), 5, 0)
        self.game.enemies = [near, far]
        self.game.burst()
        self.assertEqual((near.health, far.health), (3, 5))
        self.game.burst()
        self.assertEqual(near.health, 3)
        self.game.update(6.0, pygame.Vector2())
        self.game.burst()
        self.assertEqual(near.health, 1)

    def test_damage_invulnerability_death_and_restart(self) -> None:
        self.game.invulnerability = 0
        self.game.enemies = [Enemy(self.game.player.copy(), 5, 0)]
        self.game.update(0.01, pygame.Vector2())
        self.assertEqual(self.game.health, 90)
        self.game.update(0.1, pygame.Vector2())
        self.assertEqual(self.game.health, 90)
        self.game.health = 10
        self.game.update(0.8, pygame.Vector2())
        self.assertEqual(self.game.status, "lost")
        self.game.update(1, pygame.Vector2(1, 0))
        self.game.reset()
        self.assertEqual((self.game.status, self.game.health, self.game.island_index), ("playing", 100, 0))

    def test_progress_through_all_islands_to_victory(self) -> None:
        self.assertEqual(len(ISLANDS), 100)
        self.assertEqual(len({island[0] for island in ISLANDS}), 100)
        self.assertEqual(ISLANDS[0][0], "Palmshore")
        self.assertEqual(ISLANDS[1][0], "Stormreef")
        self.assertEqual(ISLANDS[-1][0], "Crown of Tides")
        self.game.interact()
        self.assertIn("closer", self.game.message)
        self.game.player = self.game.chest.copy()
        self.game.interact()
        self.assertIn("Defeat", self.game.message)
        expected_gold = 0
        for island in range(100):
            self.assertEqual(self.game.island_index, island)
            self.assertEqual(self.game.status, "playing")
            self.assertEqual(sum(enemy.boss for enemy in self.game.enemies), 1)
            self.assertEqual(len(self.game.enemies), ISLANDS[island][2] + 1)
            for enemy in self.game.enemies:
                self.assertTrue(ARENA.collidepoint(enemy.position.x, enemy.position.y))
            expected_gold += ISLANDS[island][2] * 20 + 100
            expected_gold += 150 * (island + 1)
            for enemy in self.game.enemies:
                enemy.health = 0
            self.game.defeat_enemies()
            self.game.player = self.game.chest.copy()
            self.game.health = 50
            self.game.interact()
            self.assertTrue(self.game.chest_open)
            if island < 99:
                self.game.interact()
                self.assertEqual(self.game.health, 80)
            else:
                self.assertEqual(self.game.status, "won")
        self.assertEqual(self.game.gold, expected_gold)
        previous = self.game.gold
        self.game.interact()
        self.assertEqual(self.game.gold, previous)

    def test_island_difficulty_increases_in_stages(self) -> None:
        for index in range(1, len(ISLANDS)):
            previous, current = ISLANDS[index - 1], ISLANDS[index]
            for field in (2, 3, 4):
                self.assertGreaterEqual(current[field], previous[field])
        self.assertEqual(ISLANDS[0][2:], (4, 2, 75))
        self.assertEqual(ISLANDS[1][2:], (6, 3, 92))
        self.assertEqual(ISLANDS[-1][2:], (8, 5, 130))

    def test_movement_is_bounded_and_diagonal_is_normalized(self) -> None:
        self.game.enemies = []
        self.game.player = pygame.Vector2(400, 300)
        self.game.update(1, pygame.Vector2(1, 1))
        self.assertAlmostEqual(self.game.player.distance_to(pygame.Vector2(400, 300)), 220)
        self.game.update(100, pygame.Vector2(1, 1))
        self.assertEqual(self.game.player.x, ARENA.right - 20)
        self.assertEqual(self.game.player.y, ARENA.bottom - 20)

    def test_character_attacks_have_distinct_range_damage_and_direction(self) -> None:
        for index, expected in enumerate(((4, 5, 5), (4, 4, 5), (3, 5, 5))):
            with self.subTest(pirate=PIRATES[index].name):
                self.game.reset()
                self.game.select_pirate(index)
                self.game.player = pygame.Vector2(300, 300)
                near = Enemy(pygame.Vector2(350, 300), 5, 0)
                far = Enemy(pygame.Vector2(480, 300), 5, 0)
                behind = Enemy(pygame.Vector2(260, 300), 5, 0)
                self.game.enemies = [near, far, behind]
                self.game.attack()
                self.assertEqual((near.health, far.health, behind.health), expected)
                self.assertEqual(self.game.attack_timer, PIRATES[index].attack_cooldown)

    def test_character_specials_have_distinct_effects_and_shared_cooldown(self) -> None:
        for index, expected in enumerate(((3, 5, 3), (2, 2, 5), (1, 5, 1))):
            with self.subTest(pirate=PIRATES[index].name):
                self.game.reset()
                self.game.select_pirate(index)
                self.game.player = pygame.Vector2(300, 300)
                near = Enemy(pygame.Vector2(350, 300), 5, 0)
                far = Enemy(pygame.Vector2(480, 300), 5, 0)
                behind = Enemy(pygame.Vector2(260, 300), 5, 0)
                self.game.enemies = [near, far, behind]
                self.game.burst()
                self.assertEqual((near.health, far.health, behind.health), expected)
                cooldown = self.game.burst_timer
                self.game.select_pirate((index + 1) % 3)
                self.game.burst()
                self.assertEqual(self.game.burst_timer, cooldown)
                self.assertEqual((near.health, far.health, behind.health), expected)
                self.assertEqual(self.game.burst_pirate, PIRATES[index])

    def test_character_selection_persists_between_islands_and_resets(self) -> None:
        self.game.select_pirate(2)
        self.game.attack()
        self.game.select_pirate(1)
        self.assertEqual(self.game.attack_timer, PIRATES[2].attack_cooldown)
        self.assertEqual(self.game.effect_pirate, PIRATES[2])
        self.game.enemies.clear()
        self.game.player = self.game.chest.copy()
        self.game.interact()
        self.game.interact()
        self.assertEqual(self.game.pirate_index, 1)
        self.game.reset()
        self.assertEqual(self.game.pirate_index, 0)

    def test_boss_must_be_defeated_to_open_chest(self) -> None:
        boss = next(enemy for enemy in self.game.enemies if enemy.boss)
        self.game.enemies = [boss]
        self.game.player = self.game.chest.copy()
        self.game.interact()
        self.assertFalse(self.game.chest_open)
        boss.health = 0
        self.game.defeat_enemies()
        self.game.interact()
        self.assertTrue(self.game.chest_open)

    def test_shop_purchases_and_selection_via_keys(self) -> None:
        def key(code: int) -> bool:
            return self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=code))

        key(pygame.K_4)
        self.assertEqual(self.game.pirate_index, 0)
        self.assertIn("locked", self.game.message)
        self.game.gold = 500
        key(pygame.K_b)
        self.assertTrue(self.game.shop_open)
        key(pygame.K_RETURN)
        self.assertEqual(self.game.gold, 0)
        self.assertIn(3, self.game.unlocked_pirates)
        key(pygame.K_RETURN)
        self.assertIn("already unlocked", self.game.shop_message)
        self.assertEqual(self.game.gold, 0)
        key(pygame.K_DOWN)
        key(pygame.K_RETURN)
        self.assertIn("Not enough", self.game.shop_message)
        self.assertNotIn(4, self.game.unlocked_pirates)
        self.assertTrue(key(pygame.K_ESCAPE))
        self.assertFalse(self.game.shop_open)
        key(pygame.K_4)
        self.assertEqual(self.game.pirate_index, 3)
        self.assertFalse(key(pygame.K_ESCAPE))

    def test_shop_pauses_game_and_blocks_gameplay_keys(self) -> None:
        self.game.attack_timer = 0.3
        self.game.invulnerability = 0
        enemy = self.game.enemies[0]
        enemy.position = self.game.player.copy()
        player_position = self.game.player.copy()
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_b))
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_SPACE))
        self.game.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_r))
        self.game.update(2, pygame.Vector2(1, 0))
        self.assertEqual(self.game.attack_timer, 0.3)
        self.assertEqual(self.game.player, player_position)
        self.assertEqual(enemy.position, player_position)
        self.assertEqual(self.game.health, 100)
        self.assertTrue(self.game.shop_open)

    def test_all_shop_pirates_attacks_and_reset(self) -> None:
        for index, price in SHOP_PRICES.items():
            with self.subTest(pirate=PIRATES[index].name):
                self.game.gold = price
                self.game.buy_pirate(index)
                self.assertEqual(self.game.gold, 0)
                self.game.select_pirate(index)
                self.game.player = pygame.Vector2(300, 300)
                self.game.facing = pygame.Vector2(1, 0)
                enemy = Enemy(pygame.Vector2(350, 300), 20, 0)
                self.game.enemies = [enemy]
                self.game.attack_timer = 0
                self.game.burst_timer = 0
                self.game.attack()
                self.assertEqual(enemy.health, 20 - PIRATES[index].attack_damage)
                enemy.position = pygame.Vector2(350, 300)
                self.game.burst()
                self.assertEqual(enemy.health, 20 - PIRATES[index].attack_damage - PIRATES[index].special_damage)
                self.assertEqual(self.game.burst_timer, PIRATES[index].special_cooldown)
        self.game.load_island()
        self.assertTrue(set(SHOP_PRICES).issubset(self.game.unlocked_pirates))
        self.game.reset()
        self.assertEqual(self.game.unlocked_pirates, {0, 1, 2})
        self.assertEqual(self.game.gold, 0)

    def test_render_islands_and_end_states(self) -> None:
        pygame.init()
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
        view = View(screen)
        self.game.unlocked_pirates.update(SHOP_PRICES)
        for island in range(len(ISLANDS)):
            self.game.island_index = island
            self.game.load_island()
            self.game.select_pirate(island % len(PIRATES))
            self.game.attack()
            self.game.burst_timer = 0
            self.game.burst()
            view.draw(self.game)
        self.game.shop_open = True
        view.draw(self.game)
        self.game.shop_open = False
        for status in ("won", "lost"):
            self.game.status = status
            view.draw(self.game)
        pygame.quit()


if __name__ == "__main__":
    unittest.main()
