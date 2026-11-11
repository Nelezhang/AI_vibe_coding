# The Lucky Claw

A Pygame claw machine with 43 different toys to discover. Each round fills the machine with 27 opaque capsules in three layers. The original rarities use identical pale capsules, except Supernatural, which is golden. Shop rarities have their own capsule colors, but the toy inside is still hidden. Line up the claw and drop it; the claw grabs the topmost capsule in the column you aim at. Its toy is revealed only after it reaches the prize chute. Collect as many as you can in 30 plays.

Each capsule is randomly filled independently, so duplicate toys are possible. Before any shop unlocks, rarity is rolled with these chances:

| Rarity | Chance | Points |
| --- | ---: | ---: |
| Common | 44.5% | 100 |
| Uncommon | 25% | 175 |
| Rare | 15% | 250 |
| Epic | 8% | 500 |
| Legendary | 4% | 1,000 |
| Mythic | 2% | 2,000 |
| Cosmic | 1% | 5,000 |
| Supernatural | 0.5% | 10,000 |

Within each rarity, its toys are equally likely. The collection shows your eight most recent prizes with a colored dot for each toy's rarity; the total shows how many capsules you've opened. The name and rarity appear when a capsule is opened.

## Rarity shop

Earn points by delivering capsules and press **S** between drops to open the shop. Select a rarity with **Up / Down**, then press **Enter** to buy it. Unlocks add new toys to the randomly generated capsules in the **next** round; they do not replace capsules already in the machine. All original rarities remain available.

| Unlock | Price | Capsule | Points per toy | Roll weight |
| --- | ---: | --- | ---: | ---: |
| Celestial | 20,000 | Sky blue | 20,000 | 0.8 |
| Abyssal | 200,000 | Deep purple | 50,000 | 0.2 |
| Eternal | 100,000,000 | Ruby red | 1,000,000 | 0.05 |

Weights determine each capsule's odds: divide its rarity's weight by the sum of all currently available weights. The original weights add up to 100. For example, with only Celestial unlocked its chance is 0.8 / 100.8.

Spendable points and unlocks are saved to `~/.lucky_claw/progress.json` after each prize and purchase. They survive new rounds and restarting the app; the round score, collection, and remaining plays reset on a new round. A save error is shown on screen; open the shop and press **T** to retry. Purchases are not charged if saving fails.

## Run

From the workspace root:

```bash
source .venv-1/bin/activate
python -m pip install -r "games/python/claw machine/requirements.txt"
python "games/python/claw machine/main.py"
```

## Controls

- **A / D** or **Left / Right**: move the claw
- **Space**: drop the claw
- **S**: open or close the rarity shop (between drops)
- **Up / Down**, **Enter**: select and buy a shop rarity
- **T**: retry saving in the shop
- **R**: start a new round
- **Esc**: close the shop or quit

Line up carefully: a missed grab uses a play.
