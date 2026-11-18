# SOLMAR BAY — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Maranatha99/gta6-01-r4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Maranatha99/gta6-01-r4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Riko Vale just walked out of the county lockup. The bay still owes him — and
Mara Solis still holds his debt. **Six jobs. One way out.**

SOLMAR BAY is a full open-world crime game in the spirit of GTA 6, built from
nothing for the make.fun **gta6-01** bounty — see the bounty at
[make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01?ref=s11m3687)
(referral `s11m3687`). It plays completely offline from static files: open
`game/index.html` in a desktop browser and you are in. No network calls, no
outside assets, no Rockstar material — every name, character, street, vehicle
and sound is original work.

## The city

Solmar Bay is a bright coastal city laid out on a road grid: glass towers
downtown, quiet residential streets, parks, parking lots, a boardwalk, a beach
and a marina. Traffic keeps to the right-hand lanes, pedestrians stroll the
sidewalks and scatter when shots are fired, and the whole place keeps moving
whether you are watching it or not.

## How to play

- **On foot** — WASD to move, mouse to aim, click to fire, R to reload.
- **Driving** — approach any car and press **E** to take it. W/S drive and
  brake, A/D steer. Quicker cars handle better; a battered car starts to
  smoke.
- **Wanted level** — theft, hitting pedestrians, shooting and killing officers
  raise your stars (1–5). Police Interceptors chase and ram you; from 3 stars
  up, officers on foot hunt you down and shoot. Stay out of sight and the heat
  fades. Cornered on foot, you are **BUSTED**; out of health, you are
  **WASTED**.
- **Missions** — follow the yellow **M**. Six story jobs for Mara Solis:
  1. **First Wheels** — take a car and deliver it to the garage ($400)
  2. **Heat Wave** — shake a 3-star pursuit at the hideout ($600)
  3. **Package Run** — three drops against the clock ($800)
  4. **Getaway Driver** — collect Mara and drive her to the safehouse ($1,000)
  5. **Turbo Heist** — lift the Vortex GT from a guarded lot ($1,500)
  6. **Big Score** — crack the bank vault, then outrun 5 stars to the marina boat ($5,000)
- **Extras** — hidden cash and health packs around town, garage repairs for
  $50, a live minimap with police and objective blips, an arrow pointing to
  off-screen objectives, and a save that remembers your money and completed
  jobs between visits (localStorage).

## Sound

All audio is synthesised live with WebAudio: an engine hum that tracks your
speed, a two-tone police siren, gunfire, explosions and a soft bassline.
Press **M** to mute. (Browsers only start audio after a click or keypress.)

## Screenshots

- `1-title.jpg` — the title screen over the living city
- `2-drive.jpg` — cruising the strip in a stolen sedan
- `3-mission.jpg` — the Heat Wave chase, three stars up
- `4-chase.jpg` — the Big Score escape, five stars and the Vortex GT

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

To hand the entry in (outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for
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
