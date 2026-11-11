# Multigamer — 3D Arcade

Twenty Three.js mini-games in one arcade. The games share movement and an arena, but each has a different rule or challenge. Each card explains its objective and the game displays progress, time, and hearts.

- **Collect:** Gem Dash scatters gems; Coin Rush has disappearing coins; Rainbow Run alternates colors; Key Quest unlocks an exit; Garden Harvest has ripening fruit.
- **Blast:** Target Practice picks an ordered target; Drone Hunter has moving enemies; Armor Breaker has timed shields; Rapid Fire requires reloading; Boss Battle adds aimed enemy projectiles.
- **Survive:** Meteor Dodge warns of impacts; Swarm Escape has pursuers; Shrinking Storm narrows the safe zone; One Heart requires constant movement; Speed Trap has sweeping lasers.
- **Race:** Checkpoint Chase follows a fixed circuit; Speed Circuit awards boosts; Minefield Run challenges you to reach eight checkpoints in 60 seconds while avoiding five fast mines with two hearts; Marathon has sprint stamina; Precision Path has moving checkpoints.

## Play

Open `index.html` using VS Code's **Five Server** extension, or serve this folder from a local HTTP server. For example, from the workspace root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/games/multigamer/`. Three.js loads from jsDelivr, so an internet connection and a WebGL-capable browser are required.

## Controls

- **W / A / S / D** or **arrow keys**: move
- **Space**: fire in blasting games; in Rapid Fire, release for one second to reload. Hold Space to sprint in Marathon and release it to recover stamina.
- **Esc**: return to the game menu
- Use the **Character** selector at the top to change your skin, including during a game. All five skins are free and stay selected while you switch games in the current session.
- Use **Restart game** or **Play again** to retry.

Each round starts fresh; progress and high scores are not saved.

## Test

Run the game-rule tests from this directory with `node --test engine.test.mjs`.
