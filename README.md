# SOLMAR BAY — an open-world crime game

[![make.fun bounty gta6-01](https://make.fun/api/badge/bounty/gta6-01)](https://make.fun/c/gta6-01?ref=s11m3687)
[![make.fun rank](https://make.fun/api/badge/rank/gta6-01)](https://make.fun/c/gta6-01?ref=s11m3687)
[![make.fun reward](https://make.fun/api/badge/reward/gta6-01)](https://make.fun/c/gta6-01?ref=s11m3687)

Riko Vale is out of the county lockup. The bay still owes him — and Mara Solis
still owns his debt. **Six jobs. One way out.**

SOLMAR BAY is a complete open-world crime game in the spirit of GTA 6, built
from scratch for the make.fun **gta6-01** bounty. It runs entirely offline from
static files: open `game/index.html` in a desktop browser and play. No network
requests, no external assets, no Rockstar content — every name, character, city
block, car and sound is original.

## The city

Solmar Bay is a sun-soaked coastal city on a road grid: downtown glass towers,
house-lined streets, parks, parking lots, a boardwalk, a beach and a marina.
Traffic follows the roads with right-hand lanes, pedestrians walk the
sidewalks and run from gunfire, and the whole city is alive whether or not
you are looking at it.

## Play

- **On foot** — WASD to walk, mouse to aim, click to shoot, R to reload.
- **Driving** — walk up to any car and press **E** to steal it. W/S accelerate
  and brake, A/D steer. Faster cars handle better; damaged cars smoke.
- **Wanted** — stealing, hitting pedestrians, shooting and killing cops raise
  your stars (1–5). Police Interceptors chase and ram you; at 3 stars and up,
  foot cops hunt you down and shoot. Lay low out of sight and the heat cools.
  Get cornered on foot and you are **BUSTED**; run out of health and you are
  **WASTED**.
- **Missions** — follow the yellow **M**. Six story jobs for Mara Solis:
  1. **First Wheels** — steal a car, bring it to the garage ($400)
  2. **Heat Wave** — lose a 3-star chase at the hideout ($600)
  3. **Package Run** — three deliveries against the clock ($800)
  4. **Getaway Driver** — pick up Mara, drive her to the safehouse ($1,000)
  5. **Turbo Heist** — steal the Vortex GT from a guarded lot ($1,500)
  6. **Big Score** — crack the bank vault, escape 5 stars to the marina boat ($5,000)
- **Extras** — stashed cash and health packs around the city, garage repairs
  ($50), a live minimap with police and objective blips, an off-screen
  objective arrow, and a save that keeps your money and finished jobs between
  visits (localStorage).

## Sound

Everything is synthesised live with WebAudio: an engine drone that follows
your speed, a two-tone police siren, gunshots, explosions and a quiet bassline.
Press **M** to mute. (Browsers only allow audio after a click or keypress.)

## Screens

- `1-title.jpg` — the title screen over the living city
- `2-drive.jpg` — cruising the strip in a stolen sedan
- `3-mission.jpg` — the Heat Wave chase, three stars up
- `4-chase.jpg` — the Big Score escape, five stars and the Vortex GT

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Hand the entry in (outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for
`/output`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node ../gta6-01-kit/cli/makefun.mjs check
```

## Files

| File | What it does |
| --- | --- |
| `game/index.html` | The page: one canvas, one module script |
| `game/src/main.js` | Boot, the fixed-step loop, screens, saves |
| `game/src/world.js` | The rules: player, cars, traffic, police, wanted, missions, combat |
| `game/src/city.js` | The city generator: roads, blocks, parks, beach, marina |
| `game/src/missions.js` | The six-job story |
| `game/src/render.js` | The canvas painter: city, cars, HUD, minimap, menus |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/audio.js` | Synthesised WebAudio sound |
| `game/src/shots.js` | The four screenshot scenes (real play, autopilot-driven) |
| `game/src/config.js` | Tunables |
| `game/src/random.js` | Seeded RNG |
| `main.ts` | Hands the game in: copies `game/` + `screenshots/`, writes `dossier.json` |
| `serve.ts` | Local static server for development |

## License

MIT — see `LICENSE`.
