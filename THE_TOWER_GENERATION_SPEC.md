# THE TOWER — Complete Design & Generation Bible

> **What this is.** A single, exhaustive reference describing **every character, every NPC, every enemy, every object, every movement and behavior** in the game *THE TOWER*, plus the exact technical rules for generating drop-in art and animation. Hand this to artists, designers, or AI tools and they have everything needed to generate sprites, animations, and content that fit the game.
>
> **Provenance.** Every value here was extracted directly from the live source `web/game.js` (single-file vanilla-JS HTML5 canvas roguelite, ~6,800 lines) at game version **v230**. Numbers are real, not invented. `game.js` line references are included throughout for engineers.
>
> **The golden rule of art.** The game is **fully playable with zero art** — all sprites are drawn procedurally by code. Any PNG you add **overrides** one generated sprite, one at a time. Resolution order per entity: **animation frames → static PNG → generated fallback.** So you can generate art incrementally and it just drops in.

---

## TABLE OF CONTENTS
0. [Asset Drop-In Cheat Sheet](#0--asset-drop-in-cheat-sheet) — *read this first if you're generating art*
1. [The Player — Classes, Movement & Combat](#1--the-player--classes-movement--combat)
2. [Enemies — Mobs, Archetypes, Species, Bosses & AI](#2--enemies--mobs-archetypes-species-bosses--ai)
3. [NPCs — Taxonomy, Movement/AI, Traits, Roster & Social](#3--npcs--taxonomy-movementai-traits-roster--social)
4. [World, Structures, Walls, Props & Decos](#4--world-structures-walls-props--decos)
5. [Items & Systems — Consumables, Relics, Trinkets, Economy](#5--items--systems)
6. [Technical Art & Animation Bible](#6--technical-art--animation-bible)
7. [Existing-Art Gap Map & Priorities](#7--existing-art-gap-map--priorities)

---

## 0 · ASSET DROP-IN CHEAT SHEET

Everything an art generator needs in one screen. Folders: `web/assets/` (static PNGs) and `web/assets/anim/` (frame sequences).

| Entity | Static file | Animation files | States engine asks for | Suggested src res |
|---|---|---|---|---|
| Hero/class | `hero_<Class>.png` | `anim/hero_<Class>_<state>_<n>.png` | `idle`, `walk`, **`attack`** | 256×256 |
| NPC | `npc_<kind>.png` | `anim/npc_<kind>_<state>_<n>.png` | `idle`, `walk` | 256×256 |
| Mob/creature | `mob_<species>.png` | `anim/mob_<species>_<state>_<n>.png` | `idle`, `walk` | 256×256 |
| Floor boss | `boss_f<floor>.png` (+ `boss_f7m.png` for F7 mage) | `anim/boss_f<floor>_<state>_<n>.png` | `idle`, `walk` | 512×512 |
| Champion (F8) | `champ_<1-4>.png` | `anim/champ_<1-4>_<state>_<n>.png` | `idle`, `walk` | 512×512 |
| Prop | `prop_<kind>.png` | — | static | 70px tall-ish |
| Deco | `deco_<type>.png` or `deco_<type>_f<realm>.png` | — | static | 60px (tree 113) |
| Ground | `ground_f<realm>.png` | — | tile | — |
| UI | `ui_logo.png` | — | static | large |

**Hard rules (all character art):**
- **Face RIGHT.** The engine flips horizontally for left movement. Never draw left- or front-facing.
- **Transparent background.** The renderer bakes a dark contour on the alpha silhouette; a baked-in background gets haloed and looks wrong.
- **Centered subject, leave headroom + footroom.** Sprites scale by **height**; names render *below the feet* and speech *above the head* — don't fill the whole canvas.
- **Frames are 1-indexed and contiguous from `_1`** (`..._idle_1.png`, `..._idle_2.png`, …). A gap silently truncates the cycle. Max **16** frames, plays at **~10 fps**. 6 frames is the established sweet spot.
- **Class keys:** `Knight, Ranger, Mage, Rogue, Gorilla, Vampire, Joker, Necromancer`.
- **After re-exporting, bump the cache version** in `game.js`: `ASSET_VER` (statics) / `ANIM_VER` (anim frames) — else the browser serves the old cached image.

**DO NOT bake these into the sprite — code adds them, doubling looks wrong:** dark outline/contour, drop/contact shadow, elite auras & rings, status glows (burn/frost/poison/hit-flash), nameplate/speech pills, the per-realm color wash. (Details in §6.) **Paint in neutral-to-mid saturation** — the realm color grade pushes the hue.

**On-screen size:** a sprite is drawn at height `R*2.6` CSS px where `R = radius_units * SCALE * CHAR_DRAW`, `SCALE = PPU(40) * ZOOM(1.30) = 52`, `CHAR_DRAW = 1.25`. A typical mob (r≈0.5) ≈ 85 CSS px tall; bosses several hundred. (Full math in §6.)

---
---

# 1 · THE PLAYER — Classes, Movement & Combat

## PLAYER — universal movement & combat

**World scale:** `PPU=40` px/tile, `ZOOM=1.30` default (clamped 0.60–1.50, adjustable with `−`/`=`), so `SCALE=PPU*ZOOM=52` px/tile. Sprites drawn at `CHAR_DRAW=1.25×`. Top-down camera with mouse look-ahead: once the cursor passes a dead radius, the camera eases up to ~20% of min(W,H) toward it.

**Base player stats (`reset()`):**
- Radius `r=0.45` tiles · `speed=5.5` tiles/s · `maxHp=100` · `dmg=35`
- `atkCdBase=0.35`s (melee), `rangedCdBase=0.4`s, `dashCdBase=0.8`s
- `critC=0.08` (8%), `critM=1.5` (×1.5 crit dmg)
- `multishot=1`, `lifesteal=0`, `thorns=0`, `magnet=1.4`, `chargeMul=1`, `ultBoost=1`, `lives=3`
- Level-up grants **+10 dmg, +20 maxHp**, full heal, xpNext ×1.6.

**Damage formula `PDMG()`:** `dmg ×`(1.12 if hp<30% — *adrenaline*)`×`(1.08 if song)`×`(1.5 if rage)`× pactPow × housePow`.

**Movement (WASD/arrows):** 8-dir normalized vector. Speed multipliers stack: dash ×3.1, slow ×0.55, buff ×1.18, adrenaline ×1.08, song ×1.08, rage ×1.35, water ×0.6.

**Aim & facing:** aim `fx/fy` tracks the mouse cursor. Visual facing looks where you *walk*, but snaps to the aim vector during the brief attack `faceLock` (0.16–0.52s). **All sprites face RIGHT, flipped for left.**

**Attack cadence:** LMB/Space → primary; RMB/F → secondary. Each attack drives the `attack` sprite + a screen kick (melee forward ×4, ranged recoil ×2).

**Dash (Shift):** `dashT=0.16`s motion at ×3.1, `iframe=0.22`s invuln, cd `dashCdBase`. Blue trail `[120,180,255]`.

**I-frames:** ignored while `iframe>0`/`dashT>0`. Floor entry 1s; respawn/jail 1.2s; dash 0.22s.

**Perfect dodge → Riposte (universal skill expression):** grazing a hit during a deliberate dash = `perfectDodge()`: 0.35s slow-mo (dt×0.45), instant dash-cd refund, `riposteT=1.8`s, +10 ult charge, "PERFECT!". The next strike while `riposteT>0` is a guaranteed mega-crit (`amt×(critM+0.9)`) that erupts across the pack ("RIPOSTE!").

**Ultimate (Q):** charge 0→100 from kills (boss +40, general +22, nest +15, normal +11, ×chargeMul×comboChargeMul), melee hits (+3×), perfect dodges (+10). At 100 → spend all, iframe ≥0.35, run class ult. `comboChargeMul`: ×1.25 @5 combo, ×1.5 @10, ×2 @20.

## The 8 Classes

### Knight
- **Identity:** Pure-steel bruiser; broadsword sweeps, no ranged, the immovable wall.
- **Art:** `hero_Knight.png` + idle/walk/attack. Armored plate knight, broadsword, heavy silhouette. Palette: steel grey, warm gold trim.
- **Stats:** `atkCdBase 0.42` (slow heavy), `maxHp +45` (155), `thorns +3`, `speed −0.3` (5.2).
- **LMB Broadsword:** wide sweep, reach 1.55, arc ~112°, dmg ×1.35, knock 0.62.
- **RMB Shield jab:** short, reach 1.35, dmg ×0.55, high knock 1.3 (never throws).
- **E Bulwark** (cd 9s): `bulwarkT 2.5s`, damage ×0.45, brief iframe, gold ring.
- **Q SUNDER QUAKE:** 6-tile shockwave, `PDMG×2.2`, stun (0.5s boss / 1.2s else), knock ×12, grants `shieldT 3s`.
- **Movement:** slowest bruiser; relies on bulwark + dash.

### Ranger
- **Identity:** Longbow kiter; volleys at range, marks prey.
- **Art:** `hero_Ranger.png` + idle/walk/attack. Lithe hooded archer, longbow, light leathers, quiver. Forest greens, gold arrow glints.
- **Stats:** `rangedStart`, `rangedCdBase 0.30` (fast), `maxHp −10` (90).
- **LMB Longbow:** arrow proj speed 15, dmg ×0.90, obeys multishot (±0.16 rad).
- **RMB Shove:** melee peel, reach 1.30, arc 135°, dmg ×0.80, knock 0.75.
- **E Hunter's Mark** (cd 6s): marks nearest foe ≤11 tiles (`markT 8s`, +30% dmg taken), provokes it.
- **Q ARROW STORM:** `stormT 2.5s` auto-volleys (every 0.09s) at nearest threat + a speed buff.
- **Movement:** fast ranged kiter.

### Mage
- **Identity:** Arcane artillery; piercing bolts, biggest ultimate.
- **Art:** `hero_Mage.png` + idle/walk/attack. Robed staff caster, glowing motifs. Deep blues/violets, bright orb glow.
- **Stats:** `rangedCdBase 0.50` (slow heavy), `chargeMul 1.7`, `ultBoost 1.55` (biggest ult), `maxHp −15` (85).
- **LMB Arcane bolt:** orb speed 10.5, dmg ×1.25, big projR 0.34, **pierce 2**.
- **RMB Staff strike:** melee shove (reach 1.30, dmg ×0.80).
- **E Blink** (cd 5s): teleport up to 4 tiles in aim direction, brief iframe.
- **Q CATACLYSM:** nova radius `9×ultBoost` (~14 tiles), `PDMG×3×ultBoost`, statuses, knock ×10, + 3 lingering rift zones.
- **Movement:** medium caster; Blink covers gaps dash can't.

### Rogue
- **Identity:** Glass-cannon crit-dasher; twin daggers, fastest dash, boss-deleter.
- **Art:** `hero_Rogue.png` + idle/walk/attack. Agile dual-dagger assassin, hood/cloak, light frame. Dark muted tones, teal/mint strike accents.
- **Stats:** `atkCdBase 0.18` (fastest), `critC 0.15`, `dashCdBase 0.5` (fastest dash), `speed +0.9` (6.4), `maxHp −10` (90).
- **LMB Twin Daggers:** reach 1.20, dmg ×0.72, **combo** (second flick 0.085s later ×0.85).
- **RMB Thrown knife** (unlocks Lv2): proj speed 14, dmg ×0.55.
- **E Smoke Bomb** (cd 9s): `stealthT 1.8s`, foes >1.2 tiles can't detect you.
- **Q DANCE OF KNIVES:** 6 teleport-strikes cycling nearest foes ≤9 tiles, `PDMG×0.9` (crits allowed), then iframe 0.6s.
- **Movement:** fastest hero; built to weave perfect dodges.

### Gorilla
- **Identity:** Mute juggernaut; huge HP, crushing fists, hurls boulders. Cannot speak with humans (no vendors/dialogue).
- **Art:** `hero_Gorilla.png` (currently reuses `mob_silverback`). Massive silverback, broad shoulders, huge fists. Dark grey-black fur, silver back; rage FX warm orange.
- **Stats:** `atkCdBase 0.5` (slow), `maxHp +80` (180, tankiest), `dmg +10` (45), `speed −0.2` (5.3), `rangedStart` (rock).
- **LMB Mighty Fists:** biggest reach 1.70, dmg ×1.5 (highest), knock 1.0.
- **RMB Hurl rock:** thrown boulder, proj speed 11, dmg ×1.15, cd ≥0.8.
- **E Ground Pound** (cd 8s): 3.2-tile shockwave, `PDMG×1.3`, stun (0.4/1.0s).
- **Q RAMPAGE:** `rageT 5s`: PDMG ×1.5, speed ×1.35, incoming dmg ×0.7.
- **Movement:** slow tank; rock-throw covers range; Rampage is its burst window.

### Vampire
- **Identity:** Blood mage; bolts cost HP, bite to feast it back; sustain via lifesteal.
- **Art:** `hero_Vampire.png` (currently reuses `champ_1`). Gaunt aristocrat, dark cloak, pale skin, crimson accents. Black/burgundy, vivid blood-red FX.
- **Stats:** `rangedStart`, `rangedCdBase 0.40`, `lifesteal +2`, `maxHp −5` (95).
- **LMB Blood bolt** (`hpCost 2`): orb speed 12, dmg ×1.0; **costs 2 HP/shot**.
- **RMB Claw:** melee shove (reach 1.30, dmg ×0.80).
- **E Bloody Bite** (cd 5s): bite nearest foe ≤2.4 tiles for `PDMG×1.2`, heal 60% dealt.
- **Q BLOOD MOON:** drain all foes ≤7.5 tiles for `PDMG×1.2` each, slow them, heal 40% of total drained.
- **Movement:** medium ranged; manages its own HP economy.

### Joker
- **Identity:** Chaos gambler; razor cards and a cruel dagger, outcomes left to the roll.
- **Art:** `hero_Joker.png` (currently reuses `npc_gambler`). Grinning harlequin in motley, fanned cards, hidden dagger. Purples/reds/gold, white card flashes.
- **Stats:** `rangedStart`, `rangedCdBase 0.22` (very fast), `critC 0.12`, `speed +0.4` (5.9), `maxHp −15` (85).
- **LMB Razor Cards:** knife-proj speed 14, dmg ×0.75, **pierce 1**, multishot.
- **RMB Dagger:** thrown knife, dmg ×0.55.
- **E Wild Card** (cd 10s): random 1-of-4 — Full House (+30 HP) / Dead Man's Hand (12-card nova) / Jackpot (15 coins) / The Fool (haste + dash reset).
- **Q 52 PICKUP:** `stormT 1.1s` deck flung in a golden-angle fan (paired cards every 0.03s, pierce 1).
- **Movement:** fast spammer; fastest fire rate.

### Necromancer
- **Identity:** Death-binder; soul bolts, and the slain rise to serve.
- **Art:** `hero_Necromancer.png` (currently reuses `mob_hexcaster`). Hooded skeletal/robed caster, scythe, sickly green soul-glow. Black robes, bone white, vivid necro-green FX.
- **Stats:** `rangedStart`, `rangedCdBase 0.45`, `chargeMul 1.3`, `maxHp −10` (90). **Passive:** 25% auto-raise a skeleton on any non-nest kill.
- **LMB Soul Lash:** orb speed 10, dmg ×1.05, **pierce 1**.
- **RMB Scythe:** melee shove (reach 1.30, dmg ×0.80).
- **E Raise Dead** (cd 6s): pay 8 HP → skeleton thrall (hp 40+10/floor, dmg 8+3/floor, 25s life). Cap 4.
- **Q DEATHLESS LEGION:** summon 7 skeletons at once, heal/buff existing minions (×1.4 dmg), + 6.5-tile soul nova `PDMG×1.6`.
- **Movement:** medium summoner; minions tank.

---
---

# 2 · ENEMIES — Mobs, Archetypes, Species, Bosses & AI

## 2.1 Enemy Movement & AI (universal)

Every non-special mob runs one shared loop (`for(const s of [...mobs])`). Per frame:

**Status ticks first:** burn (`burnDps×dt`), poison (`poisonDps×dt`), frost slow `eSlowT` (halves speed), `markT` (+30% dmg taken), `hitFlash`, `touchCd`, `bob` (anim phase), `stunT`, `fleeT`, `assistT` (pack memory of player), `warded` (Warding shield).

**Aggro / docility:**
- `docile` = `friendly` OR (`peaceful`/`neutralC` AND not `provoked`) — wanders, never hunts.
- Chases when `dist < sight × wSight()` (weather) OR (`smart && assistT>0`), and not docile, not in a safe zone, not blocked by player stealth (`stealthT>0 && dist>1.2`).
- `smart` becomes true at **floor ≥ 3** — flanks, strafes, jukes projectiles, retreats when low.
- **Wounded retreat:** smart mob <22% HP (non-boss) breaks off (`fleeT 1.2`, inverts chase vector).

**Idle (not aggroed), priority:** hold `orbit` post (camp guards) → hunt rival `faction`/`warFac` (feud melee) → follow `flock`/`leader` → `patrol` between two points → else **wander** (new heading every `rand(1,2.5)s`).

**Projectile juke (smart):** sidesteps incoming projectiles within 3u for `dodgeT 0.22s` at ×1.8.

**Movement application:** `mvx = dir × speed × (eSlowT?0.5) × bloodMoon? × covSpeedMul × wFoeSpeed`, + knockback velocity `kx/ky` (decays), then integrate + `collideWalls`. Sprite faces travel direction.

**Telegraphs (`tele`, floor ≥ 2):** after `teleCd (rand 1–3s)` when in sight —
- **Leap** (packwolf, warhound, prowler, lurker, bloodbat): if 3<dist<7.5 → windup 0.55s, then hurls to player + a 1.5-radius shock (`touch×0.8`).
- **Volley** (arbalist, echoarcher, templar, hexcaster, arcanist): if 3.5<dist<11 → windup 0.6s, then a 3-shot spread (±0.22 rad, speed 7.5).

**Stun/slow/knockback:** `stunT>0` zeroes movement + cancels windup (Sunder Quake 1.2s, 0.5 boss; riposte 0.6s). `eSlowT` halves speed. `slow` species set `player.slowT=1.6` on touch. Knockback is velocity (×0.25 vs boss/general/`knockResist`).

**Contact damage:** if `touch>0`, not docile, in range, `touchCd<=0`, player not iframe → `hurtPlayer(touch)`, `touchCd 0.8`. `hexer`→slow you; `lifedrain`→heals +8; `player.thorns` reflects. Mid-dash graze = perfect dodge (no damage).

## 2.2 Base Archetypes

| base | r | speed | sight | hp | touch | movement | attack | draw |
|------|---|-------|-------|----|-------|----------|--------|------|
| **slime** | .45 | 2.2 | 5 | 70 | 12 | slow straight chase, bobs | body contact | blobby |
| **darter** | .35 | 4.7 | 8 | 40 | 10 | fast; smart ones flank in an arc + weave; jukes bolts | melee, often leaps | small fast critter |
| **spitter** | .4 | 1.7 | 9 | 50 | 8 | kites (flees if <5u, strafes) | ranged `fireCd 1.7s` proj 6.5; `spread:N` fan; floor≥4 35% mortar (lobs AoE) | caster/archer |
| **bomber** | .42 | 3.1 | 8 | 30 | 0 | rushes straight | **detonates on contact** (2.4-radius, 22 dmg) | imp that runs in & pops |

Special bases: **nest** (r1.0, hp 140, stationary — hatches a foe every 2.5–4.5s if <5 mobs within 11u), **general** (r.85, hp 300 — single-phase mini-boss), **boss** (r1.15→1.45, hp 975, 3-phase gatekeeper).

**Heavy melee slam** (`slamAtk` — brute, bruiser, silverback, treant, felguard): at <3.4u, holds 0.6s (telegraphed red crater), then 1.7-radius shock `touch×1.15`.

**Signature flags:** `lunge` (×2.3 speed burst <4.5u — lurker, silverback, slagbrute), `blink` (teleports toward player every 1.6–3s — wisp, spiritling), `stationary` (sentinel, nest), `trail` (drops poison clouds), `stealth` (lurker: α 0.16/0.5/1 by distance), `onDeath: split | shock`.

## 2.3 Species (full roster)

Color is the base RGB *before* the realm-accent tint. Asset = `mob_<key>.png` (+ optional anim).

**Cross-floor signature elites:**
- **Trial Mimic** (`splitter`) — slime/slime · [150,235,120] · `onDeath:split` · F1 sig
- **Frostbinder** (`froster`) — slime/ghost · [150,215,255] · `slow` · F9 sig
- **Sparkwisp** (`wisp`) — darter/spirit · [185,175,255] · `blink` · F5 & F11 sig
- **Ambush Hunter** (`lurker`) — slime/beast · [90,215,205] · `stealth, lunge, hp×1.3` · F4 sig
- **Imperial Sentry** (`sentinel`) — spitter/knight · [235,205,110] · `stationary, hp×1.7` · F3 sig
- **Bloodbat** (`bloodbat`) — darter/bat · [235,95,115] · `lifedrain` (leap) · F8 sig
- **Family Adept** (`seraphling`) — spitter/mage · [255,238,165] · `spread:3` · F7 sig
- **Voidling** (`voidling`) — slime/imp · [195,125,255] · `onDeath:shock` · F6 sig

**F2 Verdant Jungle:** Vine Snapper (`vinesnap`, slime/plant, [90,200,80], hp×1.1) · Jade Prowler (`prowler`, darter/beast, [70,170,100], leap) · Dart Frog (`dartfrog`, spitter/frog, [240,180,60]) · Stinger Drone (`stinger`, darter/bug, [220,200,90], hp×0.6 speed×1.15) · **Silverback** (`silverback`, slime/beast, [170,170,180], hp×2.0 lunge slamAtk — also the Gorilla hero art).

**F3 Human Empire:** Legionnaire (`legion`, darter/knight, [150,170,220] — also palace warden) · Arbalist (`arbalist`, spitter/knight, [120,140,200], volley) · War Hound (`warhound`, darter/beast, [150,125,95], leap).

**F4 獸人族 Empire:** Pack Wolf (`packwolf`, darter/beast, [185,140,90], leap) · Tusked Bruiser (`bruiser`, slime/beast, [205,120,70], hp×1.6 slamAtk) · Spear Hunter (`spearhunt`, spitter/beast, [215,165,85]).

**F5 Elves Forest** (peaceful until provoked): Grove Warden (`wardenE`, spitter/elf, [140,220,130]) · Blade Dancer (`dancer`, darter/elf, [175,230,150], speed×1.1) · Treant Sapling (`treant`, slime/plant, [110,170,90], hp×1.5 slamAtk).

**F6 魔物 Empire:** Horned Impling (`impling`, darter/imp, [225,115,165]) · Hex Caster (`hexcaster`, spitter/mage, [195,95,205], volley — also Necromancer hero art) · Horned Brute (`brute`, slime/imp, [175,85,125], hp×1.7 slamAtk — also palace warden) · Bomb Fiend (`bombfiend`, **bomber**/imp, [230,95,85]).

**F7 Two Families** (peaceful estates, factions): House Blade (`swordsman`, darter/knight, [235,220,170]) · House Arcanist (`arcanist`, spitter/mage, [185,155,255], spread:2 volley).

**F8 Court of the Upper Beings** (champions realm): Vampire Thrall (`thrall`, darter/bat, [220,95,105]) · Spiritling (`spiritling`, darter/spirit, [175,235,255], blink) · Drakeling (`drakeling`, spitter/dragon, [235,150,65]) · Felguard (`felguard`, slime/imp, [185,115,255], hp×1.5 slamAtk).

**F9 Hall of Echoes:** Climber Shade (`shade`, slime/ghost, [150,200,235]) · Echo Archer (`echoarcher`, spitter/ghost, [135,185,225], volley) · + generic `darter`.

**F10 Molten Heart:** Magmite (`magmite`, slime/imp, [255,120,40], hp×1.4 onDeath:shock) · Cinder Dart (`cinderdart`, darter/bug, [255,160,60], speed×1.1) · Pyre Caster (`pyrecaster`, spitter/mage, [255,140,70], spread:2) · Ember Hound (`emberhound`, darter/beast, [240,110,50], speed×1.15) · **Slag Brute** (`slagbrute`, slime/beast, [255,90,30], hp×2.0 lunge — F10 sig).

**F11 Tower's Crown:** Crown Seraph (`seraph`, darter/spirit, [255,235,170]) · Crown Templar (`templar`, slime/knight, [240,220,155], hp×1.6 volley).

**Generics:** `slime` [115,217,102], `darter` [232,93,155].

## 2.4 Elite Affixes

~7% of field foes roll an affix (also forced on warlords, contracts, world bosses, the Warden). All elites: `hp×1.6, xp×2.5, drop+5`, pulsing aura + `✦ <name>` pill.

| Affix | Aura | Effect |
|---|---|---|
| Frenzied | [255,90,60] | speed×1.35, touch×1.25 |
| Shielded | [120,200,255] | caps every hit to max(8, maxHp×0.35) |
| Volatile | [255,150,40] | explodes/hazard on death |
| Vampiric | [200,60,130] | heals +8 per touch hit |
| Stoneskin | [170,174,190] | 50% damage taken while above half HP & not stunned |
| Titan | [230,205,120] | r×1.3, hp×1.6, knockback ×0.25 |
| Warding | [140,255,210] | shields allies within 5.5u every 2.5s (50% dmg) |
| Summoner | [200,120,255] | conjures a 60%-HP minion every 5–8s (cap 88 mobs) |
| Regenerator | [120,230,140] | heals maxHp×5%/s while wounded |
| Hexer | [230,120,210] | touch slows you (slowT 1.6) |

## 2.5 Bosses

Every realm gate is a `boss` (r1.45, hp 975, touch 22). Look = `realm.bossLook`. Asset = **`boss_f<floor>.png`** (F7 special: `boss_f7m.png` for the mage Matriarch). Heals to full on player death. Final boss (Aethon): hp×2.4, r1.9, speed×0.9. Name renders `★ <name> ★`.

**3-phase structure:** P1 (>50% hp) primary attack every 2.6s; P2 (≤50%) ENRAGE — speed×1.25, alternates atk/atk2, +volley ring; P3 (≤22%) FINAL FURY — speed×1.15, faster, plus the realm **signature**.

| Floor / Realm | Boss(es) | look | atk/atk2 | Phase-3 signature |
|---|---|---|---|---|
| F1 Trial Grounds | The Warden of First Steps / Mossback / The Bellringer | beast | slam/summon | double stomp rings (r5 & r7.5) |
| F2 Verdant Jungle | Raukan, the Jungle Tyrant | beast | summon/charge | spawn + spore cloud (r2.2 poison) |
| F3 Human Empire | Grand Marshal of the Human Empire | knight | charge/volley | cross volleys (4 diagonal arms × 3) |
| F4 獸人族 Empire | Khan of the 獸人族 | beast | summon/charge | relentless chain charges |
| F5 Elves Forest | High Keeper of the Elder Grove | elf | volley/nova | petal ring (10 bullets) |
| F6 魔物 Empire | Horned Sovereign of the 魔物 | imp | nova/summon | burning ground (2 fire patches) |
| F7 Two Families | 劍聖 Patriarch of the Blade (knight) **and** 法聖 Matriarch of the Arcane (mage → `boss_f7m`) | knight/mage | per head | blade rain (4 mortars) |
| F8 Court | *resolved as 4 Upper Beings — see Champions* | — | — | — |
| F9 Hall of Echoes | The First Climber's Echo | ghost | void/charge | frost ring + comet |
| F10 Molten Heart | Pyraxis / Vulkar / The Cinder Tyrant | imp | nova/summon | erupting lava + ember ring |
| F11 Tower's Crown | AETHON, SOVEREIGN OF THE TOWER | spirit | void/nova | radiant burst + sunfall |

**Boss attack kinds:** `volley` (12-bullet ring), `charge` (windup 0.5s, dash 14 for 1.05s), `summon` (3 minions), `nova` (r9 mortar), `void` (alternating summon/expanding shock), `slam` (r5.6 shock + summons).

## 2.6 Champions / Gatekeepers / Nests / Minions / Warden

**Gatekeeper** (`isGate`): the floor's stair-blocker — the realm boss (or two family heads on F7). Killing it opens the stair.

**The 4 Upper Beings (F8, `champ_<1-4>.png`):** `general`-based (hp 720), `neutralC` (docile until provoked), each in a pillar-ring sanctum. **Defeat OR befriend (parley, E)**; resolve all 4 to open the stair.
1. **The Crimson Count · Vampire** — charge, [230,80,90], bat
2. **Aurelia · Higher Spirit** — nova, [170,235,255], spirit
3. **Vermithrax · Elder Dragon** — volley, [235,150,60], dragon
4. **Mal'goth · 高階魔族** — summon, [180,110,255], imp

**Monster Nests** (`mob_nest.png`, hp 140, stationary): hatch a pool/sig foe every 2.5–4.5s while <5 mobs within 11u.

**Minions:** Summoner affix + boss summons (60% HP, provoked). Necromancer/merc allies fight for you with a ~20s lifespan.

**Generals** (hp 300): camp warlords, lone-champion event, world bosses, Court champions.

**Palace Wardens** (`warden`, hp×1.9): guard restricted palaces; **arrest** the WANTED player instead of killing — only hostile when `wantedT>0`. City patrols are legion wardens.

**The Floor Warden:** linger >75s on floors 2–9 → a hunter spawns (sig species, `hp×2.2, sight 999, smart, speed×1.12`, aura [255,70,90], renders `✦ THE WARDEN`). Slay it or take the stair.

**Other AI variants:** coinwraith (flees dropping coins, vanishes after 20s), highwaymen `gang` (ambush within 6.5u), watch `police` (chase WANTED), `thief` cutpurse (snatch & flee), feud `warFac` fighters, `merc` companions.

## 2.7 Enemy Animation Needs

Asset order per mob: `animFrames(key, moving?'walk':'idle')` → static `mob_<key>.png` → procedural `getSprite(look)`.
- **Common mobs:** `idle` + `walk`. (No mob `attack` state — attacks are code-driven shocks/projectiles/slams.)
- **Bosses (`boss_f<N>`) & champions (`champ_N`):** `idle` + `walk`. Charge windup, slam crater, enrage burst all drawn procedurally over the sprite.
- Missing `walk` → reuses `idle`. Missing all → static PNG → procedural.
- **13 procedural fallback looks** every species maps to: slime, beast, frog, bug, plant, ghost, bat, spirit, dragon, imp, mage, knight, elf (+ nest).
- Overlays code adds (don't bake in): contact shadow, elite aura, sig white ring, stealth fade, hit-flash/frost/burn/poison rings, telegraph craters, hp bar.

---
---

# 3 · NPCs — Taxonomy, Movement/AI, Traits, Roster & Social

## 3.1 NPC Taxonomy

The engine splits living things into **mobs** (`mobs[]`, attack-on-sight enemies) and **NPCs** (`npcs[]`, non-enemy townsfolk). NPCs are **NEUTRAL by default** and only turn hostile when provoked. Two predicates drive behavior:
- `npcFighter(n)`: guard, watchman, errant, magistrate, ranger, bountymaster, arenamaster, house_knight, house_errant, house_heir, househead, hermit (+ any `headHouse`). Fighters fight back / convert to a mob when attacked or when they witness a crime.
- `npcFaction(n)`: `house || headHouse`, else `watch` (WATCH_TYPES), else `cult` (CULT_TYPES), else `town`.

**Neutral subcategories:**
- **A. Civilians** (wander, chatter, flee; never fight; attacking = crime): villager, peasant, noble, beggar, pilgrim, laborer, urchin, shepherd, climber, wanderer, child, washer, drunkard, ratcatcher, miner, farmer, crier, busker, dancer, storyteller, gravedigger, lamplighter, scholar, cook, youngson.
- **B. Service/vendors** (`SERVICE_NPC`): merchant, smith, healer, enchanter, tavernkeep, gambler, priest, cook, monk, innkeep, fisher, caravaneer, arenamaster, pedlar, quester, sage, quartermaster, bountymaster, magistrate, ranger, pilgrimkeeper, seer, herbalist. Buy-from subset (`SHOP_NPC`, gold map marker): merchant, pedlar, smith, healer, enchanter, tavernkeep, gambler, caravaneer, quartermaster, herbalist, innkeep.
- **C. Authority/fighters** (`WATCH_TYPES`: guard, watchman, errant, magistrate, ranger; + bountymaster, arenamaster, hermit): defend the populace against monsters and fight you for crimes.
- **D. Faction:** *Cult* (priest, monk, pilgrim, acolyte, seer, pilgrimkeeper — `player.rep.cult`); *Houses (F7)* (`househead` + `house_*`, `n.house ∈ sword|magic` — `player.houseStand`).
- **E. Special/unique:** sage, quester (Herald), mythic (Mythic Dealer), youngson (Youngest Son), househead (劍聖/法聖), + banker/authority uniques.

**Who turns hostile, when:** attacking any NPC → `witnessCrime` (`wantedT≥14`, rep.watch−1); nearby fighters convert to hostile mobs, civilians flee. Killing → `wantedT≥28`, rep.watch−2, fighters within 16u convert. `wantedT>6` → civilians flee on sight. House standing ≤ −3 → that house cold/hostile.

## 3.2 NPC Movement & AI (universal)

Only NPCs with `n.roam` run the AI. Per tick, in order:
- **Per-soul constants:** `spd` 1.45–2.25 u/s (unique per soul), `trait` (forced or hashed), `given` name (civilians), `home`/`post` anchor.
- **`mind` states:** idle, walk, watch, gawk, flee, chat, use, work, sleep (+ travellers & followers run outside the machine).
- **Talk-anchor:** while `talkHold>0` (set 3.0 on interact, refreshed ≥1.2 while a dialogue is live) the NPC freezes, faces the player, drops chat — keeps conversation partners from wandering off.
- **Ambient chatter:** `barkCd` → if player within 22u, idle/walk/work, 60% → speak a bark for 2.6s.
- **Day–night schedule** (`clockPhase`: dawn<0.16, day<0.60, dusk<0.74, else night): every 7–13s the `post` retargets — night→home, dusk→social, dawn→home, day→work. Workers stay at station by day.
- **Foul-weather sheltering:** rain/snow/ash > 0.62 intensity → civilians shelter at a building doorway.
- **Panic contagion** (`fleePulse`): a civilian within ~4.7u of any fleeing NPC also flees. Raised by combat, crimes, deaths, routs.
- **Monster scatter:** civilians flee provoked non-friendly mobs within 8u.
- **Civic defenders:** a fighter (wanted≤0, non-special realm) within 9u of a hostile monster, 50%/tick → `convertDefender` (becomes a friendly merc mob: swordsman/arcanist, hp+30, speed 5.2).
- **Criminal recognition:** wanted>6 + player within 8u → flee.
- **Escort/follow:** walks toward player at 3.4 u/s; reaching a waystone → drops 12 coins, +12 XP.
- **Fear/flee:** player attacking within `6.5 × trait.fear` → flee at 3.6×(0.8+fear×0.4) u/s, facing away, ~1.9s.
- **Gawk:** bold souls (gawk>0.6) approach a fight to watch at 2.5 u/s, stop at 9u.
- **Travellers** (`travel`): pedlars/climbers/shepherds hop POI→POI at 2.1 u/s.
- **Notice the climber:** within **3.0u**, stop, face player, `mind='watch'`; first time emit a greeting keyed to rep/house/state.
- **NPC-to-NPC chat:** idle roamer within 2.6u → both enter `chat` for 4–8s, face each other, trade emotes (topic from weather/climber/gossip/prices/tower/family; kin always "family").
- **Night sleep:** civilian near home at night → `sleep` (z z particles), wakes at dawn/if scared.
- **Posted work:** `workFx` worker within 1.8u of post → `work` (profession particles + glyph).
- **Prop-use/lingering:** drifts to a nearby use-prop (well/fountain/cookfire/anvil/dummy/shrine/board/stall/book/orb/waystone/keg), favouring its trait's prop; on arrival lingers 3–6.5s (pray/train/drink/warm/read). Drinking → `tipsy 7–15`.
- **Goal wandering** (`npcGoal`): 80% walk a street end-to-end, 12% visit a POI, 8% loop near home. Soft NPC separation within 1.45u. **Tipsy wobble** while tipsy. Leash: civilians within post.r+34, non-civ +12.

Sizes/HP: `npcMaxHp = round((fighter?55:16) + floor*5)`. `big` = 1.6× (heads), kid/child/urchin = 0.72×, base r=0.5.

## 3.3 Traits (`TRAITS`)

`emo` (emote pool), `fear` (flee multiplier on 6.5u), `gawk` (chance to approach a fight), `barks`.

| Trait | fear | gawk | Behavior |
|---|---|---|---|
| merry | 0.7 | 0.4 | cheerful; favours keg |
| timid | 1.6 | 0.0 | flees early & far; favours shrine |
| brave | 0.35 | 1.0 | stands ground, nears fights; trains at dummy |
| curious | 0.6 | 1.0 | approaches to watch; reads books |
| gruff | 0.6 | 0.5 | terse; trains at dummy |
| weary | 0.9 | 0.2 | tired; favours keg |
| greedy | 0.85 | 0.6 | coin-obsessed; favours keg |
| devout | 0.7 | 0.3 | pious; favours shrine |

`TRAIT_FORCE` pins traits to roles (guard/crier/errant→brave, drunkard/busker/dancer→merry, seer/priest/monk/acolyte/herbalist→devout, taxman/beggar/gambler/noble→greedy, hermit/gravedigger/washer→weary, child/urchin/scholar→curious, fishmonger/lamplighter/ratcatcher→gruff).

## 3.4 NPC Roster (full)

Template: **name** (`type`) — category · appearance · roams? · role · service · hostile? · asset. All draw `npc_<type>.png` (fallback `npc_<spriteAs>.png` → generated folk sprite).

**Civilians:** a Pedlar (`pedlar`, vendor, sprite caravaneer, roams+travels, sells travel tonic/trinket, escortable) · Shepherd (`shepherd`, sprite farmer, travels, escortable) · Fellow Climber (`climber`, sprite wanderer, tells stair direction, escortable) · Villager (`villager`, sprite wanderer) · Peasant (`peasant`, sprite farmer) · Noble (`noble`, sprite merchant, greedy) · Beggar (`beggar`, sprite hermit) · Pilgrim (`pilgrim`, cult, sprite monk, devout) · Labourer (`laborer`, sprite miner, chops) · Urchin (`urchin`, kid 0.72×, sprite child) · Child (`child`, kid, rescue-target) · Town Crier (`crier`, brave, draws crowds) · Drunkard (`drunkard`, merry, tipsy walk) · Busker (`busker`, sprite bard, plays music) · Dancer (`dancer`, sprite bard) · Storyteller (`storyteller`, gives a tale/marks a warlord) · Gravedigger (`gravedigger`, sprite miner, weary) · Lamplighter (`lamplighter`, sprite watchman) · Washerwoman (`washer`, sprite peasant) · Rat-catcher (`ratcatcher`, sprite hermit) · Tax Collector (`taxman`, sprite noble, greedy) · Miner (`miner`, static) · Farmer (`farmer`, 45% quest-giver) · Scholar (`scholar`, 3 LORE lines, caster) · Local/Wanderer (`wanderer`, fallback type, 35% quest-giver, escort).

**Service/vendors:** Merchant (`merchant`, full heal 15c / +3 dmg 20c / mystery relic 30c / trinketer) · **Smith** (`smith`, opens **Blacksmith** `openForge`: +4 dmg / +18 HP / +crit, tiered) · Healer (`healer`, free full heal once/floor) · Enchanter (`enchanter`, 30c → draft boon) · Tavernkeeper (`tavernkeep`, drink/rumor/song/hire mercs) · Gambler (`gambler`, coin-flip bets) · Innkeeper (`innkeep`, 12c heal+cure) · Caravaneer (`caravaneer`, 25c mystery item) · Cook (`cook`, 8c +40HP+buff) · Monk (`monk`, cult, 15c +10 maxHP) · Priest (`priest`, cult, 10c regen) · Fisherman (`fisher`, 3 casts/floor) · Bard (`bard`, song/charge) · Courier (`courier`, parcel errand) · Herbalist (`herbalist`, cult, draught 8c/antidote 6c) · Seer (`seer`, cult, reveal POI 6c / buff 12c) · Fishmonger (`fishmonger`, stall worker) · Acolyte (`acolyte`, cult, caster).

**Authority/fighters (can turn hostile):** Guard (`guard`, directions, 45% quest, defender) · Watchman (`watchman`, reports elites/vault, defender) · Knight-Errant (`errant`, sprite guard, brave) · Arena Master (`arenamaster`, 3-wave arena) · Hermit (`hermit`, lore→vitality).

**Unique authority/bankers:** Magistrate (`magistrate`, sprite enchanter, fine/bail/writ) · Ranger Captain (`ranger`, sprite courier, cull-bounty + Cache) · Quartermaster (`quartermaster`, sprite caravaneer, the Cache bank) · Bounty Master (`bountymaster`, sprite guard, cross-floor contract) · Wayshrine Keeper (`pilgrimkeeper`, sprite monk, restores a life) · **Mythic Dealer** (`mythic`, sprite enchanter, never roams — black-market passes, reveal den, buy secrets).

**Special/story:** Sage (`sage`, floor intro lore) · Herald (`quester`, hands out & tracks the floor mission, `!` marker) · Youngest Son (`youngson`, F7 only, kid 0.42r, broker peace; can't die).

**House NPCs (F7, `house ∈ sword|magic`):** House Head (`househead`, big 1.6×: 劍聖 Sword Master sprite errant / 法聖 Matriarch sprite enchanter — pledge or hear the tale) · Heir (`house_heir`) · Blade Knight (`house_knight`, sprite guard) · Sword-Errant (`house_errant`) · House Smith (`house_smith`) · Steward (`house_steward`) · Arcanist (`house_arcanist`, sprite enchanter) · Scholar (`house_scholar`) · Enchanter (`house_enchant`) · Apprentice (`house_acolyte`).

**Dynamic variants (not new types):** Grateful soul (`grateful`, escorted survivor, gold nameplate, gives a gift, remembered across floors) · Rescue victim (`rescue`, cornered by monsters).

## 3.5 Social Interaction (the hub)

First **E** on an NPC opens a verb menu (up to 6). `MIGHT = level*2 + floor(dmg/12) + min(20, kills/8) + (wanted?6:0)` gates intimidation.
- **Ask for news** — nearest incident, else an unfound POI (compass direction), else flavour. +1 XP once/floor.
- **Bribe / Make amends** — *watch*: clears wanted + calms wardens + rep; *house*: raises standing toward 0.
- **Persuade / Press standing** — *watch favour*: writ; *cult*: regen blessing; *house*: favor.
- **Intimidate** — needs MIGHT ≥ resist; *fighter*: cowed; *civilian*: extort coins (cap 2/floor), they flee.
- **Trade** — opens that vendor's real shop menu.
- **Request** — escort to a waystone (cap 2/floor) or take a task (generates a mission/feud cull).
- **Leave.**

## 3.6 NPC Animation Needs

`animFrames(key, moving?'walk':'idle')`, flip when `faceX < -0.08`.
- **Required:** `idle` (still — also base for watch/work/use/sleep/chat) + `walk` (roam, flee, escort, travel). Single sheet, horizontally flipped; no up/down sheets.
- **Pose nuances driven by glyphs/overlays (not separate sheets):** work (idle + profession particles + WORK_EMOTE ⚒☕⚲❧✦♪), use/linger (idle + ACT_ICON ✦⚔☕♨✎), sleep (idle nudged down + "z z"), tipsy (walk + path wobble). Big heads 1.6×, kids 0.72×.
- **Nameplate BELOW** the sprite (translucent pill; given+surname within 7u else type name; blue=vendor, gold=grateful). **Speech ABOVE** the head. Yellow `!` above quest-relevant NPCs.

---
---

# 4 · World, Structures, Walls, Props & Decos

## 4.1 World & Realms

`PPU=40`, tile thickness `TW=0.8`, world half-extents `WORLD_HW=165, WORLD_HH=112`. `TOTAL_FLOORS=11`, one realm per floor. `realmIndex(f)` caps at 9, so **floor 11 (Tower's Crown) reuses Molten Heart's indexed visual tables** while keeping its own name/pool/boss.

| Floor | Realm | Accent | mapgen | weather | special |
|---|---|---|---|---|---|
| F1 | The Trial Grounds | 150,210,120 | gauntlet | dust | — |
| F2 | The Verdant Jungle | 110,205,90 | jungle | rain | dense |
| F3 | The Human Empire | 120,170,235 | legion | rain | roads, palace, city IMPERIA |
| F4 | The 獸人族 Empire | 235,150,60 | packs | leaves | roads |
| F5 | The Elves Forest | 120,210,110 | groves | leaves | **peaceful** |
| F6 | The 魔物 Empire | 200,90,160 | scorched | ash | roads, palace, city KHORVASH |
| F7 | Peak of the Two Families | 245,225,150 | ridge | glimmer | **families**, roads |
| F8 | Court of the Upper Beings | 180,110,255 | nexus | motes | **champions** |
| F9 | The Hall of Echoes | 150,215,255 | cathedral | snow | bossLook ghost |
| F10 | The Molten Heart | 255,120,40 | scorched | ash | — |
| F11 | The Tower's Crown | 255,235,170 | ascent | sparks | roads |

**Floor modifiers** (one per floor, shown after the realm name): Tranquil (×0.65 foes), Bustling (×0.85), Overgrown (gardens), Infested (×1.45, 2 nests), Haunted (×1.25, gloom), Bountiful (extra chests), Ancient (ruins+vault), Cursed (×1.15, elite hp×1.35, gloom, big loot), Flooded (ponds), Wild (×1.25), Sanctified (×0.9, shrines). Plus **Crimson/Blood Moon** (deep-night event, f≥3: foes +45% dmg, +28% speed).

**Weather** (`WEATHER`, screen-space particles, ~110, intermittent): dust, snow, leaves, rain (streaks+lightning), sparks (rise), ash, glimmer (twinkle), motes, fog (big blobs). Combat effects when intensity>0.5: rain → fire ×0.55 / lightning ×1.4; ash → burn ×1.35; snow → foe speed ×0.85; fog → enemy sight ×0.5.

**Day cycle** (`floorClock`, persistent): dawn→day→dusk→night drives sky tint; lamps/windows surge at night.

**Ground/tiles:** baked into 8-unit chunks. Regions: wild (mottled + flagstone), road (running-bond cobble, warm worn color, never lava), settlement slab, sidewalk. Roads width 3.6. Per-realm roof colors `ROOFS[]`. **Hazard floors:** water/pond (speed ×0.6), hot spring (+3 HP/s), lava (9 HP/s), void (6 HP/s + slow).

## 4.2 Structures

**Core generators:**
- **`building(cx,cy,w,h)`** — one room, floor `#2a2730`, south door gap 3.2u. Procedural **hipped 4-slope roof** with ridge/hip lines, shingle courses, quoins, arched glowing doorway (brighter at night), 2 flickering windows, occasional chimney+smoke. *(No building sprites — fully procedural.)*
- **`vaultRoom`** — sealed room, west entrance gap.
- **`compound(cx,cy,w,h,opts)`** — walled set primitive; perimeter from **breakable `cwall` segments**; gates punched + lamp-lit; registers a safe zone.
- **`buildHouse(cx,cy,kind)`** — F7 estates (32×24), Blade or Arcane, with the househead NPC + department NPCs.
- **`buildCompound`** — hostile F7 stronghold (gate-boss family head + buffed mobs + big chest).
- **`buildSanctum`** — F8 pillar-ring around a champion.
- **`buildPalace`** — restricted royal ground ("NO ENTRY", treasury chests, 4 arresting wardens) + jail annex (Magistrate, cell).
- **`buildVault`** — Sealed Vault: rune-sealed door, 3 runestones lit in order → big chest. **Secret Vault:** an 8×6 room plugged by one `crack` wall (hp 55) — break it for a chest.
- **`buildNest`** — rubble walls + a mob warren.

**Named structure sets** (`buildSet`: a walled compound + sigil sign + hall + ring buildings + central feat prop + props + decos + NPC roles; sizes S=16×13, M=24×18, L=31×23):

the Walled Town ❖ · the Garrison ⚔ · the Trading Center ⚜ · the Keep ♜ · the Monastery ✝ · the Manor Estate ⚐ · the Gaol ⛓ · the Academy ⚛ · the Grand Bazaar ☂ · the Farmstead ⚘ · the Watchtower Post ⌖ · the Forge ⚒ · the Chapel ✚ · the Wayhouse Inn ⌂ · the Apothecary ✤ · the Bounty Guild ⚔ · a Bandit Hideout ☠ (hostile) · the Hermitage ☖ · the Caravan Yard ⛟ · the Necropolis † · the Fighting Pit ⚐ · the Shrine Grove ❀ · the Mine Camp ⛏. (Each lists its NPC roles, props & decos — see `STRUCT_SETS` in code for exact contents.)

**Standalone feature sites** (placed by `feats`): town, city, inn, arena, watchtower, enchanter, banditcamp, monument, hot spring, mine, tavern, library, square, farm, garden, vault, nest, ruins, graveyard, pond, shrines, cache, caravan, hamlet, market, chapel, shanty, cart, campsite, orchard, homestead. Plus wilderness sites (wayshrine, beacon, ruined outpost, quartermaster vault, ranger camp, hermit tower, lore vault, weathervane altar) and ~85–100 scattered micro-sites (stones, woodpile, graves, memorial, lanterncourt, gallery, etc.). Road-front buildings get an **awning** + hanging **shopsign** (glyphs ⚒⚖⚜✂☕✨♠⚚⚓).

## 4.3 Destructible Walls (Streets-of-Rogue style)

- **Segment size `WALL_SEG = 1.5`u.** A wall run of length L splits into `n = max(1, round(L/WALL_SEG))` segments (thickness TW=0.8).
- **HP per segment:** `brkHp() = 50 + floor*5` (55 on F1, +5/floor).
- **Builders** `hwall/vwall(x1,x2,y, solid)`: breakable → `{brk:true, hp, struct:true}` segments; `solid:true` → one unbreakable wall (used only for the **world boundary** and a few barriers, which never break). Compounds use `cwall` segments (gate-/road-punched).
- **What breaks them:** only **player slashes & player projectiles** (enemies never damage walls). Melee within `(reach||1.6)+0.25` deals `PDMG()*0.6 + 8`; projectile deals its damage & is consumed. `hitCd 0.16s` rate-limit, dust + 'hit' sfx. At hp≤0 → `breakWall` removes that single segment, opening a passable breach; the rest of the wall stands.
- **Render/damage:** normal walls show a material body (stone/hedge/brick/wood/marble/crystal by biome) + lit top lip + outline; damaged `brk` segments darken with a crack overlay scaling with damage; vault `crack` walls glow gold and break dramatically (toast + flash). `ruin` walls = stacked broken stones.
- **Collision:** an 8×8 spatial grid keeps it fast even with ~1,500 wall segments.

## 4.4 Props (full roster)

Format: **kind** — interactable? · effect · appearance · (props are not collision-solid). Tall props draw over characters.

**Interactable:** chest (treasure; 15% mimic; big=vault hoard; locked=arena prize) · shrine (blessing + cult rep) · plaque (lore) · orb/monolith (Echo of the Tower + charge) · stone (+HP +charge) · waystone (attune; teleport between attuned) · ore (mine coins, 3 uses) · **board (Mission Board — 3-tier missions)** · well (1-coin or 20-coin gamble) · fountain (1-coin wish) · dummy (+charge, 3–6 uses) · book (+XP, lore) · runestone (vault puzzle, light in order) · beacon (reveal POIs/stair) · wardoor (opens with ≥3 lore echoes) · weathervane (current weather's boon) · anvil (+charge) · keg (+14 HP) · cookfire (+18 HP) · altar (seal a **Pact** — boon+curse) · **market (Black Market — needs a pass)** · obelisk (Trial: 3 waves → relic) · covenant (Ascension/Heat toggles).

**Decorative props:** sign (text) · flower (harvestable bloom) · crop (harvestable) · stall (striped canopy) · statue · wagon · **lamp** (elaborate post, halo surges at night) · bench · planter · bollard · **shopsign** (swaying, glyph, glows at night) · **awning** (striped) · mound (trap/dig) · powderkeg (☣ explodes) · oilslick (ignites).

Sizes (`PROP_H`): beacon 2.4, weathervane 2.2, lamp 2.1, shopsign 2.0, stall/waystone 1.9, awning 1.7, shrine 1.7, dummy 1.6, board/planter/well 1.5, ore 1.05, orb 1.0, anvil/keg/cookfire 0.95, book 0.9, bench 0.8, bollard 0.7, flower 0.6.

## 4.5 Decos (full roster)

Scenery; height from `DECO_H`; `SOLID` ones become collision when scatter-placed (cap 18/floor). `TALL_DECO` (tree, pillar, banner, totem, brazier, crystal, reed) draw over characters. Per-instance seed variation; many realm-specific palettes.

| deco | appearance | height | solid |
|---|---|---|---|
| tree | trunk + 3 foliage arcs (realm palettes: cherry/teal/green) + planter base | 2.7 | yes |
| bush | 3 arcs, planter base | 1.0 | no |
| rock | layered ellipses + specular | 0.95 | yes |
| reed | 5 curved stalks | 1.3 | no |
| mushroom | stem + cap (realm 4 bioluminescent, else red+spots) | 0.95 | no |
| crystal | faceted gem + halo (realm-colored) | 1.5 | yes |
| brazier | stem + bowl + animated flame | 1.7 | yes |
| pillar | shaft + base + capital (realm 8 broken) | 1.9 | yes |
| banner | pole + accent pennant + emblem | 2.0 | no |
| totem | 3 stacked faces, glowing eyes, gold crest | 1.9 | yes |
| bones | skull + scattered bones | 0.7 | no |
| crate | box + X-cross | 0.95 | yes |
| barrel | body + 2 hoops | 0.95 | yes |
| flower | 3–4 seed-varied blossoms | 0.65 | no |

Baked-asset path: `deco_<type>_f<realm>.png` → `deco_<type>.png` → procedural.

## 4.6 Structure/Object Art Needs

**Procedural-only (no art needed):** buildings (hipped roofs, facade, glowing doors, night windows, chimney smoke), walls (material textures + damage cracks), ground/tiles/roads/hazard floors, weather/sky/lightning, signs (text). **Art-optional candidates:** `prop_chest` (the one prop with a real hook; needs open/closed/locked/big states), animated props (lamp/fire/fountain/sway/glow), `deco_*` (esp. `deco_tree`, per-realm variants), `ground_f<realm>`. **State variants any prop art must cover:** chest open/closed/locked/big; used/unused (shrine, orb, stone, anvil, keg, cookfire, book, beacon, weathervane, altar, covenant); runestone lit/unlit; waystone attuned; ore/dummy use-count; lamp/window day/night glow.

---
---

# 5 · Items & Systems

## 5.1 Consumables (Satchel / Kit)

`KIT_DEFS`. Global use cooldown 0.6s; on use a particle burst + sfx + message. **Inventory model: 20 slots = 5×4 grid** — top row of 5 = hand/hotbar, 3 bag rows below (separator after row 1). Open with **I**/**Tab**, drag with `kitHeld`. Plus **3 trinket slots** top-right. World drops live 45s.

| Name | key | Effect | Max | Icon to draw |
|---|---|---|---|---|
| Tower Draught | draught | +45 HP | 5 | brown-cork green-glass potion, white highlight |
| Greater Draught | greater | +60% max HP | 3 | bottle, green→cyan gradient, glowing cyan orb |
| Swiftfoot Tonic | swift | +18% speed 10s, clears slow | 3 | peach vial, 3 orange motion lines |
| Ember Flask | ember | thrown: 2.8-radius AoE, 18+floor×1.3 dmg + burn | 5 | dark round bomb, fuse, orange glowing core |
| Frost Phial | frost | thrown: 2.8-radius chill (eSlowT 2.5) | 5 | blue snowflake, white core |
| Aether Cell | aether | +35 ult charge | 5 | purple hexagon, lightning glyph |
| Warding Charm | warding | half damage 4s | 5 | pale-blue shield, accent center line |
| Skeleton Key | skeleton | opens a locked chest within 1.8u | 9 | gold key (ring bow, shaft, teeth) |

## 5.2 Relics (16) + Resonance + Evolutions

`RELICS`. Stacking relics cap at 3. Listed by name with a `✦` prefix (no sprites).

| Name | key | Effect | Trigger | School |
|---|---|---|---|---|
| Ember Heart | ember | 13% ignite (burn) | onHit | ember |
| Frostfang Charm | frost | 13% chill | onHit | frost |
| Venom Idol | venom | 13% poison | onHit | venom |
| Storm Sigil | storm | 11% arc to a foe (PDMG×0.5) | onHit | storm |
| Vampire's Coil | coil | heal 3% max HP/kill | onKill | blood |
| Reaper's Tithe | tithe | +3 charge/kill | onKill | blood |
| Soulbrand | soul | 11%/kill +8 HP | onKill | venom |
| Hoarder Locket | hoard | 18%/kill +3 coins | onKill | blood |
| Thornmail Shard | thorn | attacker takes max(4, dmg×0.25) | onHurt | blood |
| Stoneheart Ward | stone | 30% on hit: shieldT 0.8 | onHurt | frost |
| Gambler's Eye | gambler | +6% crit (×3) | passive | storm |
| Berserker's Brand | brand | +16% dmg scaling (×3) | passive | ember |
| Ironwood Heart | ironwood | +28 max HP (×3) | passive | ember |
| Swiftboot Sigil | swift | +0.6 speed (×3) | passive | storm |
| Bloodthirst Idol | leech | +3 lifesteal (×3) | passive | venom |
| Chrono Sliver | chrono | cooldowns 25% faster | tick | frost |

**Resonance:** 3+ relics of a school = I, 5+ = II. Ember → +14% dmg; Frost → +24 maxHp; Venom → +3 lifesteal; Storm → +5% crit & +0.4 speed; Blood → +16 maxHp & +6 thorns.

**Evolutions (8 weapon fusions, from draft pairs):** Cryoclasm Brand (Burning Blade+Frostbite → Thermal Shock detonations) · Plagueblade (Venom+Burning Blade → huge Caustic Bloom) · Permafrost Fang (Venom+Frostbite → triple Brittle Rot) · Tempest Coil (Chain Spark+Twin Shot → lightning arcs to 2 more) · Deathmark Edge (Keen Edge+Executioner → +8% crit/+60% crit dmg, crits mark) · Sanguine Aegis (Vampirism+Thorns → +10 thorns/+2 lifesteal, reflect heals) · Bladestorm Rig (Frenzy+Quick Draw → cd ×0.88, every 6th strike a riposte-crit) · Apex Cleaver (Sharper Blade+Vitality → +10 dmg/+25 HP, execute foes <30% HP).

## 5.3 Trinkets (6, 3 slots)

`TRINKET_DEFS`. Passive equip; auto-equip on pickup if a slot is free. Prefixed `◈`.

| Name | key | Effect | Rarity | Icon |
|---|---|---|---|---|
| Stoneheart Locket | stoneheart | +24 max HP | common | grey locket, red gem |
| Keen Charm | keen | +12 damage | common | silver blade-stroke + shine |
| Fleetfoot Anklet | fleetfoot | +0.5 speed | common | bronze ring + motion lines |
| Lucky Sovereign | sovereign | +7% crit | uncommon | gold coin |
| Sanguine Tooth | fang | +4 lifesteal | uncommon | ivory fang + blood drop |
| Headsman's Edge | headsman | +40% crit dmg | rare | dark axe head, gold edge |

## 5.4 Pacts (8 — altar boon+curse)

Glass Pact (+40% power / −30% maxHP) · Reckless Fury (+15% atk speed & +1.2 speed / +30% dmg taken) · Sanguine Pact (+6 lifesteal / −25 maxHP) · Executioner's Oath (+100% crit dmg & +8% crit / +20% dmg taken) · Ironblood Vow (+55 maxHP & +1 life / −15% dmg) · Pyre Pact (every hit ignites / −15% maxHP) · Stormcaller Bargain (+speed & chain / −22 maxHP) · Gambler's Ruin (+30% dmg / +25% dmg taken). `pactVuln` capped 3×; cleansed at the Black Market.

## 5.5 Covenants (5 — Ascension/Heat)

Bloodthirst (foes +25% dmg) · Swarm (+30% foes) · Alacrity (foes +20% speed) · Legion (+4 elites) · Frailty (−20% maxHP). Each active = +1 Heat; reward ×(1 + 0.15×Heat).

## 5.6 Blacksmith Upgrades (`openForge`)

Tiers persist (`player.forge`). ◆ Sharpen Weapon (+4 dmg, cap 5, cost `30+wpn×28+floor×4`) · ✚ Reinforce Armour (+18 maxHP, cap 5, `30+arm×26+floor×4`) · ✦ Hone Edge (+4% crit & +0.1 crit dmg, cap 4, `42+edge×34+floor×5`).

## 5.7 Missions & Quests

`openMissions` (the notice **board**) — 3 tiers, one active mission at a time:

| Tier | Coin | Relic | Note |
|---|---|---|---|
| Recruit | 18+f×3 | — | else +25 HP |
| Veteran | 40+f×5 | 50% | |
| Elite | 70+f×8 | 100% | |
| Underworld (40% replaces Elite) | 70+f×8 | — → **◆ Black Market pass** | high-authority contract |

Quest types: cull (defeat N), treasure (open N chests), nest (destroy nest), vault (loot vault), bounty (slay gatekeeper). Other givers: Ranger Captain cull-bounty, Herald floor task, NPC "take a task".

## 5.8 Black Market & Passes

**Gated entry** (`player.bmTickets`): the den (`market` prop) is doorman-guarded — entering consumes 1 pass; no pass → barred. Hidden on the map until the Mythic Dealer reveals it. Passes come from: Underworld missions, the Mythic Dealer, or the pass reward.
- **Black Market wares** (`openMarket`): buy a relic (65+f×10) · full heal / cleanse curses (25+f×3 +curse surcharge) · bind a life (+1 max life, 80+f×5).
- **Mythic Dealer** (`openMythic`): buy a pass (120+f×15) · reveal the den (40+f×5) · sell a secret — reveal stair/POI (30+f×4).
- **Per-floor shops** (deterministic): Apothecary (kit consumables) · Trinketer (kit + a trinket + a relic). Sold-locks persist per floor.

## 5.9 Economy & Progression

- **Coins:** kills drop 2–6; magnet base 1.4. Cache, combos, chains, wraiths, vaults all pay coin. XP +1 per coin.
- **Climber's Cache** (banked-coin meta): `cacheRank = min(12, floor(sqrt(cache/45)))`; run-start grants +4 maxHp & +1 dmg per rank; lives = 3 + floor(rank/3) + (all echoes ? 1).
- **Feats (9):** each completed grants **+2 max HP & +1 dmg forever** (First Blood, Centurion, Myriad Blade, Slimecide, Elite Hunter, Boss Breaker, Stairmaster, Crowned, Untouchable).
- **Echoes (12):** one recoverable per floor; all 12 → +1 life + start each run with 10 charge & a free relic.
- **Bestiary Mastery:** lifetime kills per species → permanent dmg ×: Studied (25, ×1.08), Mastered (100, ×1.15), Nemesis (250, ×1.22).
- **XP/Leveling:** start L1, xpNext 12 (×1.6/level). Level-up: +10 dmg, +20 maxHp, full heal, opens a **draft** of 3 cards. L2 unlocks ranged.
- **Draft Upgrades (16):** Sharper Blade, Vitality, Swift Boots, Frenzy, Twin Shot, Vampirism, Thorns, Long Dash, Quick Draw, Greed, Burning Blade, Frostbite, Venom, Chain Spark, Keen Edge, Executioner — pairs feed the Evolutions.
- **Persistence:** per-run save (stats, items/kit/trinkets/forge/bmTickets/pacts/evolutions/house/quest); meta save (lifetime tallies, feats, cache, echoes, covenants, bestiary).

---
---

# 6 · Technical Art & Animation Bible

*The golden rule: **assets OVERRIDE procedural art; procedural is the fallback.** The game runs with zero PNGs. Resolution order per entity: animation frames → static PNG → generated sprite.*

## 6.1 Asset Naming & Drop-In Rules

URLs: `assets/<key>.png?v=ASSET_VER` and `assets/anim/<key>_<state>_<n>.png?v=ANIM_VER`. See the §0 cheat sheet for the key table.

**Hard rules:** transparent PNG; face RIGHT (engine flips); centered subject with head/foot room; frames 1-indexed contiguous from `_1` (gap = truncated cycle), max 16, ~10 fps; bump `ASSET_VER`/`ANIM_VER` after re-export. Class keys: Knight, Ranger, Mage, Rogue, Gorilla, Vampire, Joker, Necromancer (the last four currently borrow other art via an `art:` field).

**State fallback:** request `walk` while moving / `idle` while still; **missing state → idle → static PNG → procedural**. `attack` is hero-only (one-shot during a swing). Boss key = `boss_f<floor>` (+`m` for F7 mage); champion = `champ_<index+1>` (1–4); else `mob_<type>`.

## 6.2 What Already Exists (the gap map)

**Static PNGs present:** heroes `hero_Gorilla/Joker/Necromancer/Vampire` (Knight/Ranger/Mage/Rogue have anim frames instead); ~22 `mob_*`; NPCs `npc_arenamaster/monk/quester/storyteller`; `boss_f7m`; `ui_logo`, `ground_f0..f9`, `portal_*`, `prop_chest`, ~16 `deco_*`.

**Anim frames present:** `hero_Knight/Mage/Ranger/Rogue` full idle+walk+attack; several `mob_*` idle (+some walk); `champ_1` partial.

**✅ Fixed (v230):** `hero_Gorilla/Joker/Necromancer/Vampire` idle/walk frames were renumbered contiguous from `_1` (idle 1–5, walk 1–6) and `champ_1` walk → 1–3; `ANIM_VER` bumped to 11. Verified loading idle 5 / walk 6 / attack 6 — all four heroes animate. *(champ_2/3/4 still have no frames.)*

**Biggest gaps:** boss statics `boss_f1,f2,f3,f4,f5,f6,f9,f10,f11` (9 — F7/F8 have no boss; `boss_f7m` on disk is unused dead art); `champ_2/3/4` (champ_1 has partial walk); ~62 NPC types (only 4 drawn — see the minimal 26-base set); ~16 mob species with no art + others static/idle-only. **See `ART_TODO_CHECKLIST.md` for the exact file list.**

## 6.3 Canvas / Scale / Camera

`PPU=40`, `ZOOM=1.30` default (clamp 0.60–1.50, keys `−`/`=`), `SCALE=PPU*ZOOM=52` px/unit, `CHAR_DRAW=1.25`, `DPR=min(devicePixelRatio,2)`. Adaptive backbuffer drops DPR under load (don't rely on 1px detail).

**On-screen size = `R*2.6` CSS px** where `R = radius_units * SCALE * CHAR_DRAW` (player ×1.15 extra; NPC kid ×0.72, big ×1.6). Example: a mob r≈0.5 → R≈32.5 → ~85 CSS px (~169 device px) tall. **Source res:** 256² for mobs/NPCs/heroes, 512² for bosses (engine pre-downscales & caps at 640px, so larger is wasted). Keep the figure centered (height-scaled, width free).

**Facing:** drawn at center, then `ctx.scale(flip,1)`; flip=−1 mirrors left. NPCs use a small deadzone (`faceX<−0.08`) to avoid jitter.

## 6.4 Facing & Animation

Playback `floor(s_now()/1000*10 + _aph) % frames.length` — **~10 fps**, with a per-entity random phase `_aph` so crowds don't sync. **Crossfade blend:** nearest frame opaque + adjacent frame up to 0.6 alpha — design adjacent poses close enough to read as motion. **Attack one-shot** maps frames across the actual swing (wind-up→strike→follow-through); the code draws the bright weapon cone separately, so you don't paint the energy arc into frames. Sweet spot **6 frames** (max 16, contiguous from `_1`).

## 6.5 The Cohesion Look — what the CODE adds (DON'T bake in)

1. **Dark contour halo** — `drawAsset` adds `shadowColor rgba(5,7,13,0.62)`, `shadowBlur max(3, targetH*0.05)`, no offset. (Procedural equivalent: `bakeOutline`.) → don't add your own outline.
2. **Contact shadow** — soft radial ground shadow under every character. → don't paint a foot shadow.
3. **Per-realm color grade** — whole scene gets `soft-light` at alpha 0.13 in the realm accent. → paint neutral-to-mid saturation; the wash pushes hue.
4. **Vignette + gloom** on haunted/cursed floors.
5. **Nameplates & speech pills** — translucent near-black pill + off-white text; **name BELOW the feet, speech ABOVE the head**. → leave head/foot room.
6. **Elite/champion auras, status rings, hp bars** — all code-drawn. → don't bake auras/rings/glows.

## 6.6 Procedural Fallback

If no art exists, the engine generates & caches a sprite (`getSprite`/`getFolkSprite`/`drawCharacter`), each with `bakeOutline` (dark contour + cool top rim). **Creature looks:** beast, slime, frog, bug, plant, ghost, bat, spirit, dragon, imp, mage, knight, elf, nest. **Hero looks:** Ranger & Rogue bespoke; Knight/Mage fall to knight/mage. **NPC kinds:** shared villager body + profession gear (guard, merchant, healer, smith, sage, scholar, cook, gambler, bard, monk, innkeep, farmer, quester, watchman, priest, enchanter, fisher, arenamaster, caravaneer, courier, storyteller, miner, hermit, wanderer, villager, child). All face RIGHT.

## 6.7 Palettes & FX

**Realm accents** (drive grade/particles/rings): F1 150,210,120 · F2 110,205,90 · F3 120,170,235 · F4 235,150,60 · F5 120,210,110 · F6 200,90,160 · F7 245,225,150 · F8 180,110,255 · F9 150,215,255 · F10 255,120,40 · Crown 255,235,170.
**Roofs** (`ROOFS`): `#48525f, #3d5238, #5e3a3a, #5c4a30, #3e523a, #3a3148, #5d5a6a, #3f3a58, #41506b, #5a5036`. **Wall materials** by biome: stone/hedge/brick/wood/crystal/marble. **Tile bases kept dark** so characters read on top.
**FX vocabulary:** `burst` (impact/death/pickup puff) · particles drawn in 2 passes (additive glow + solid core) · `shocks` (expanding rings for slams/novas, filled clouds for poison/zones) · `slashes` (bright melee arc, the true hitbox, drawn over the hero) · projectiles (trail + glow + core; enemy ones orange `#ff9b3d`) · `dmgTexts` (floating numbers: crit gold, perfect cyan, dot grey, normal white) · telegraphs (dashed orange volley line / pulsing red slam crater / boss charge line) · screen shake / slow-mo / flash.

---
---

# 7 · Existing-Art Gap Map & Priorities

**To generate art that drops straight in, prioritize:**
1. ~~Fix the broken hero anim for `hero_Gorilla/Joker/Necromancer/Vampire`~~ — **DONE (v230):** frames renumbered contiguous from `_1`, `ANIM_VER`=11, verified animating.
2. **Champions** — `champ_1` (proper walk from `_1`) + `champ_2/3/4` entirely (Crimson Count, Aurelia, Vermithrax, Mal'goth).
3. **Floor bosses** — 9 statics: `boss_f1,f2,f3,f4,f5,f6,f9,f10,f11` (F7 Families & F8 Champions have no boss; `boss_f7m` is unused). Anim optional.
4. **NPCs** — the ~23 kinds without art (most townsfolk currently use shared procedural folk art).
5. **Mob species** — the realm-pool species lacking `mob_*` art.

**Every generated sprite must follow §0 + §6:** face right, transparent bg, centered with head/foot room, frames from `_1`, neutral-mid saturation, and **do not bake** outlines/shadows/auras/glows/nameplates (the engine adds them). Bump the version constant after each export.

*— End of bible. Generated from `web/game.js` @ v230. Keep this file updated as new content lands.*
