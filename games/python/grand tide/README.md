# Grand Tide

An original single-player pirate adventure inspired by island-hopping stories. Fight raiders, collect treasure across 100 islands, and defeat Captain Maelstrom on the final island to find the Tide Crown.

## Run

From the repository root:

```bash
source .venv-1/bin/activate
python -m pip install -r "games/python/grand tide/requirements.txt"
python "games/python/grand tide/main.py"
```

## Controls

- **WASD / arrow keys**: move and face a direction
- **Space**: use the selected character's attack in the direction you are facing
- **Q**: use the selected character's special attack
- **1–6**: switch to an unlocked character at any time during play
- **B**: open or close the pirate shop; use **Up / Down** and **Enter** to buy
- **E**: open an unlocked treasure chest; press again to sail to the next island
- **R**: restart the adventure
- **Esc**: close the shop or quit

## Characters

These are original pirates:

1. **Mara the Navigator**: medium-range Cutlass; Tide Burst hits all around her (6-second cooldown).
2. **Flint the Gunner**: long-range, narrow Long Shot; Cannon Blast hits a wide forward area (7-second cooldown).
3. **Iris the Brawler**: short-range, powerful Heavy Punch; Whirlwind hits all around her (8-second cooldown).

The first three are free. Earn gold from defeated enemies and treasure chests, then spend it in the shop:

4. **Coral the Corsair** — 500 gold: medium-range Twin Blades and circular Blade Storm.
5. **Rowan the Ranger** — 1,500 gold: long-range Arrow Volley and forward Piercing Bolt.
6. **Nova the Mystic** — 4,000 gold: Star Pulse and a large circular Sunflare.

The shop pauses combat. After buying a character, close the shop and press their number to select them. Gold is deducted once; purchased characters remain unlocked across islands but are reset, along with gold, when you restart or close the game.

Attack and special cooldowns are shared when switching characters, so changing characters does not reset them. Your selected character carries over between islands; restarting selects Mara.

Defeat every raider and the boss to unlock each chest. Enemy numbers, health, and speed increase in stages, with a captain on every island and Captain Maelstrom on island 100. You regain up to 30 health between islands. Gold is spendable and the final screen shows your remaining balance. The final chest wins the game. Progress is not saved between runs, so closing the game or pressing R starts the voyage over.
