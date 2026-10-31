# Greenlight Defense — Three.js

A 3D browser tower-defense game built with Three.js. Defend the core through increasingly difficult waves using seven tower types and six enemy classes.

## Start the game

Open `index.html` with VS Code's **Five Server** extension, or serve the workspace with any local HTTP server and visit `games/python/tower%20defense/`. The page loads Three.js as an ES module from jsDelivr, so use `http://localhost` rather than opening the HTML directly as a `file://` URL.

## Controls

- Click a tower card or press **1–7** to select a tower; click open ground to place it.
- Click a deployed tower to inspect it, then upgrade or sell it.
- Click **Start Wave** or press **Space** to launch the next wave.
- Press **Enter** to deploy; press **R** after defeat to restart.

The 700-credit Ultra Tower fires a powerful all-direction blast combining splash, chaining, and slowing. Survive runners, armored and shielded enemies, regenerators, and bosses.

`main.py` is the earlier Pygame desktop prototype; `requirements.txt` is only needed to run that version.
