# Brainrot Heist

A single-player Pygame game inspired by collecting and stealing silly creatures. Build up your base, earn cash automatically, steal from a rival, and stop the rival raider from taking your best creatures. All characters are original; the rival and guard are computer-controlled.

## Run

From the repository root:

```bash
source .venv-1/bin/activate
python -m pip install -r "games/python/brainrot heist/requirements.txt"
python "games/python/brainrot heist/main.py"
```

## Controls

- **WASD / arrow keys**: move
- **E**: buy the market creature when nearby, or steal a creature when standing next to it in the rival base
- **L**: activate your base shield for 12 seconds; it takes 30 seconds from activation to recharge
- **R**: restart the game
- **Esc**: quit

## How to play

Creatures in your blue base earn cash every second. Buy creatures at the center market; the offer changes every 12 seconds. You can own up to six creatures. When the rival shield opens, approach a creature and press E, then carry it back to your base. The guard starts chasing after a short head start and returns the creature if it catches you.

The orange raider comes for your most valuable creature. Activate your shield to block a theft, or touch the raider before it escapes to recover the creature. The rival shield alternates between 9 seconds locked and 15 seconds open. Rarer creatures cost more and earn more income.

The game runs locally and progress lasts only until you restart or close it.
