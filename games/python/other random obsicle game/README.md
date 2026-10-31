# Infinite Obstacle Course

A desktop obstacle-course game made with Pygame. Dodge crates, spike traps, and gaps to reach the finish line. Each completed level awards 100 coins, and levels continue forever.

## Difficulty

Every level is harder than the last: the course is longer and faster, obstacle rows are packed closer together, and more rows block two lanes. Every row always leaves a reachable safe lane, and all hazards can also be jumped over.

## Skins

Six fully different characters, not color swaps: a robot, shark, dinosaur, phoenix, knight, and alien. The Galaxy alien is the most expensive at 10,000 coins.

## Run the game

From the workspace root, activate your Python environment and install the dependency:

```bash
source .venv-1/bin/activate
python -m pip install -r "games/python/other random obsicle game/requirements.txt"
python "games/python/other random obsicle game/main.py"
```

## Controls

- **A / D** or **Left / Right**: move
- **Space**, **W**, or **Up**: jump
- **Enter**: start, retry, or continue to the next level
- Click a skin in the shop to buy or equip it
- **Esc**: quit
