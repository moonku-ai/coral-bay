[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/moonku-ai/coral-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/moonku-ai/coral-bay/reward.svg)](https://make.fun/bounty/gta6-01)

# Coral Bay — Open-World Crime Game

An original open-world crime game built for make.fun's **“Make GTA 6”** bounty
([gta6-01](https://make.fun/bounty/gta6-01), $1,666 in USDC).

You are **Rae Marlowe**, an ex-courier with a debt to pay in **Coral Bay**, a
sun-soaked coastal city of downtown towers, suburbs, a beach, a pier and a
coastal highway. Work six chained story missions for Delia Voss and Marco Hale:

1. **First Delivery** — timed courier run from the marina to the Coral Hotel
2. **Hot Pursuit** — chase a rival courier down the highway and ram him off
3. **Quiet Inlet** — stealth on foot past the dock guards' searchlights
4. **The Fork** — choose: **The Coral Heist** (rob the bank, lose 4 stars) *or*
   **The Long Way Home** (escort Marco's truck through an ambush)
5. **Street Kings** — 3-lap street race against three rivals
6. **The Last Tide** — pier ambush, then escape by speedboat to open water

Plus: taxi fares, a repeatable street race, 10 hidden parcels, a garage to buy
and upgrade cars, a safehouse, a 0–5 wanted level with police cruisers,
roadblocks, spike strips and a helicopter with a spotlight at 5 stars,
day/night cycle, rain, two procedural radio stations, and a full HUD with
minimap and big map.

## How to play

```bash
node serve.ts
# open http://localhost:8080
```

No build step, no network: every file is served from `game/`, three.js r160
is vendored under `game/vendor/`.

**Controls:** WASD move/drive · E enter/exit car · R pistol, click to fire ·
F punch · M next mission · T taxi job · G garage · Q radio · Tab big map ·
Shift run · Space handbrake · H heal at safehouse.

## Handing in

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts` library.

## License

MIT — see [LICENSE](LICENSE). All names, characters, story, art and music are
original; nothing is taken from any commercial game.
