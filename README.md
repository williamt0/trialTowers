# The Hundred Tower

A top-down **systemic district roguelite**. Each floor is both a fantasy realm and a
living civic district: patrols, shops, crowds, restricted buildings, fixers, informants,
breakable walls, disguises, records desks, evidence lockers, relay boxes, and several ways
to open the stair. Fight the gatekeeper if you want, or solve the floor through stealth,
paperwork, bribery, sabotage, blackmail, or rescue.

Built as a self-contained HTML5 game and packaged as a native **desktop app** (Electron) —
the same shape you'd ship to Steam.

## Run it

### As a desktop app (Electron)
```bash
cd topdown-rpg
npm install        # one-time (downloads Electron ~150MB)
npm start          # launches "The Hundred Tower: District Climb" in a native window
```

### As a plain web page (no install)
Just open the single file in any browser:
```bash
open web/index.html
```
Turn your **sound on** — all audio is synthesized in-code (no asset files).

## Controls
- **WASD / Arrows** — move
- **Space** — sword attack (also: start game, ascend stairs, restart)
- **Shift** — dash (brief invincibility)
- **F** — ranged bolt (unlocks at level 2)
- **E** — talk / use
- **E near district tools** — use records desks, lockers, relays, disguise racks, boards
- **1 / 2 / 3** — pick an upgrade in the draft
- **M** — map / pin route
- **I / Tab** — satchel
- **R** — restart after victory

## The game
- **District-first floor structure** — every floor rolls a district identity such as
  Gatehouse Checkpoint, Copper Market Maze, Ash Foundry Ward, Veiled Campus, or Lantern
  Shantyrow. Districts bias the buildings, crowds, patrol density, feature mix, and
  available non-combat operation.
- **Multiple exit routes** — defeat the gatekeeper, forge a stair permit, steal a key,
  sabotage the relay, recover leverage from the evidence room, buy an arrangement from a
  fixer, or escort an informant to a waystone. The stair opens when any route succeeds.
- **Social stealth and heat** — disguise racks and permits give temporary cover. Crimes,
  trespass, and loud break-ins raise Watch heat; attacking blows your disguise.
- **Faction pressure** — district operations build standing with the Watch, underworld,
  guild, cult, or commune. Favour lowers some prices and makes social routes easier.
- **10-floor prototype structure** — each floor compresses a distinct realm plus a civic
  district layer. The old 100-floor goal is now treated as an expansion target, not the
  current shipped scope.
- **News stands and intel economy** — buy local bulletins, boss-room reports, district
  dossiers, or black-market whispers to mark routes and secrets on the map.
- **Bosses are optional pressure, not the only key** — every ordinary floor has a
  gatekeeper, but the district operation can open the stair before the boss falls.
- **Big open-world floors** — each floor is a large explorable land (generated fresh) dotted
  with **points of interest**: a **town** (paved plaza, buildings, a knot of NPCs), a
  **garden** (healing flowers + a shrine), **monster nests** (spawner cores you can destroy
  for loot), a **hidden vault** (sealed elite room with a relic chest), scattered **chests**
  and **shrines**. A minimap marks them all.
- **Flexible ascent** — defeat the gatekeeper, solve the district operation, or resolve a
  special floor's social route, then step on the stair to climb.
- **NPCs to meet** — each floor has a few of: the **Sage** (lore/hints), the **Merchant**
  (full heal for 15 coins), the **Healer** (one free heal/floor), the **Smith** (+5 damage
  for 25 coins), and **Wanderers** (flavor). Walk up and press **E**.
- **Scaling** — enemy count and HP/damage/speed scale with floor; every 10th floor is a
  larger named **realm boss**.
- **Relics & boons** — beating a floor boss grants a named realm relic and a roguelite
  upgrade draft (pick 1 of 3).
- **Overview minimap** — shows the whole floor: you (white), NPCs (blue), boss (red), and
  the exit stair (green when open, gray when locked).
- **Enemies** — base foes (slime chaser, darter zigzag, spitter ranged, bomber kamikaze)
  plus a **signature enemy per realm** with a unique twist: Splitterling (splits on death),
  Frostbinder (slows you), Cinder Hound (fire trail), Sporeling (death poison cloud),
  Sparkwisp (blinks), Deep Lurker (stealth + lunge), Clock Sentinel (turret), Bloodbat
  (lifesteal), Lightbringer (spread shots), Voidling (death shock).
- **Bosses** — each realm boss has its own attack pattern (slam / volley / charge / summon
  / nova / void) and goes **multi-phase**: at 50% HP it ENRAGES — attacks faster, moves
  faster, and adds a second attack pattern. Every 10th floor is a larger named realm boss.
- **Death** — drops you back to the floor entrance (the boss refreshes for a fair rematch);
  your level, relics, and upgrades persist.

## Project layout
```
topdown-rpg/
├── web/index.html   ← the web shell
├── web/game.js      ← the Canvas game engine and systemic district layer
├── main.js          ← Electron entry point (native window wrapper)
├── package.json     ← npm scripts: `start`, `smoke`
└── Assets/Scripts/  ← a separate Unity C# port (older feature set; alt native path)
```

## Shipping to Steam
This Electron app is a viable Steam build path for an HTML5 game:
1. **Package a distributable** with [electron-builder](https://www.electron.build/):
   `npm i -D electron-builder` then add a build config → produces `.app`/`.dmg` (macOS),
   `.exe`/NSIS (Windows), and `AppImage` (Linux), all from this one codebase.
2. **Integrate Steamworks** via [greenworks](https://github.com/greenworks/greenworks)
   or [steamworks.js](https://github.com/ceifa/steamworks.js) for achievements,
   cloud saves, and the overlay.
3. Upload builds to Steam with **SteamPipe** (`steamcmd`).

> Alternative native path: the `Assets/Scripts/` Unity port. Unity exports to Steam
> natively but is a heavier toolchain and currently lags the web version's features.

## Ideas / roadmap
- A shop room to spend coins; rarer relics with active abilities
- More enemy behaviors per realm; multi-phase realm bosses with attack patterns
- Meta-progression between runs; daily-seed mode
- Gamepad support; settings (volume, fullscreen)
- electron-builder config + Steamworks wiring
