# Character Animation Guide — generating frames that feel SMOOTH

The engine now plays frame animations automatically. You generate the frames; this guide
is how to make them as smooth as possible.

## 1 · How the engine plays animations
Drop numbered PNGs into **`web/assets/anim/`**:

```
anim/<key>_<state>_<n>.png        n = 1, 2, 3 ... (up to 16)

hero_Knight_idle_1.png  hero_Knight_idle_2.png ...
hero_Knight_walk_1.png  ...
hero_Knight_attack_1.png ...      (attack: heroes only)
mob_slime_idle_1.png    mob_slime_walk_1.png ...
npc_guard_idle_1.png    ...
boss_f4_idle_1.png      champ_3_idle_1.png ...
```

- `<key>` = the same names as the static images (see `web/assets/README.md`)
- **States:** `idle`, `walk` — plus `attack` for `hero_*`. Walk falls back to idle; idle falls
  back to the static PNG; static falls back to generated art. Animate one character at a time.
- The engine detects the frame count automatically, plays at **10 fps**, **crossfades
  adjacent frames** (this alone makes 6 frames look like 12), and gives every creature a
  random phase offset so crowds don't move in lockstep.
- Same rules as statics: **transparent background, character faces RIGHT, consistent size.**

## 2 · Frame counts that work
| State | Frames | Notes |
|---|---|---|
| idle | **4–6** | breathing, weapon sway, cloth drift — small motion only |
| walk | **6–8** | full stride cycle (two steps) |
| attack | **4–6** | windup → swing → follow-through |

More frames ≠ smoother if the character drifts between them. **Consistency beats count.**

## 3 · THE GOLDEN RULES for AI-generated frames
The whole game is frame-to-frame consistency. These rules are ranked by impact:

1. **One generation = one whole animation.** Ask for a single image containing ALL frames
   in a horizontal strip. Never generate frames as separate images — the character will drift.
2. **Upload the existing static sprite as the reference image** and say "animate THIS exact
   character." You already have the perfect references in `web/assets/`.
3. Demand a rigid grid: *"6 equal cells in one row, character at identical scale and position
   in every cell, feet on the same baseline."*
4. **Seamless loop:** *"frame 6 flows back into frame 1."* For idle, a ping-pong read
   (1-2-3-4-3-2) also loops perfectly — duplicate frames when slicing if you want this.
5. Change ONLY what moves: *"identical palette, identical outfit, only the pose changes."*
6. Flat or transparent background, no shadows baked in (the engine draws shadows).

### Paste-ready prompt template
> Animation sprite strip of THIS exact character (reference attached): **[6] frames in one
> horizontal row**, equal cells, character at identical scale and position in every cell,
> feet on a constant baseline, facing right, **[walk cycle — a full two-step stride]**,
> frame 6 flows seamlessly back into frame 1, identical palette and outfit in all frames,
> only the pose changes, flat solid background, chibi fantasy game sprite, flat cel shading,
> bold dark outline

For idle, swap the motion clause: *"subtle idle breathing — chest rises, weapon sways
slightly, cloak drifts."* For attack: *"sword attack — windup, slash arc, follow-through."*

### Slicing & naming
Use the same cropper you used for the static sheets, then rename the crops in order:
`hero_Knight_walk_1.png` → `_2` → ... Drop them in `web/assets/anim/`. Reload. Done —
no code changes ever needed.

## 4 · MAXIMUM smoothness: the image-to-video route
For your hero (the character you stare at most), this beats sprite strips:

1. Feed the static PNG to an **image-to-video AI** (Kling / Runway / Pika / Sora).
   Prompt: *"this character idles in place, subtle breathing and cloak sway, side view,
   camera completely static, seamless loop, plain background."*
2. Extract evenly spaced frames with ffmpeg:
   ```
   ffmpeg -i idle.mp4 -vf "fps=10,scale=-1:256" hero_Knight_idle_%d.png
   ```
   Keep the best 6–8 consecutive frames that loop cleanly.
3. Batch-remove the background (remove.bg, or Preview's Remove Background, or rembg).
4. Name + drop into `anim/`.

Video models keep the character perfectly consistent across frames — that's the smoothest
result possible. Cost: more cleanup per character. Recommended for: the 4 heroes and the
10 bosses. Use sprite strips for the small fry.

## 5 · Priority order (best smoothness-per-effort)
1. ~~`hero_*` idle + walk + attack~~ ✅ **DONE** — all 4 heroes animated (6 frames each, in `web/assets/anim/`)
2. `boss_f*` + `champ_*` idle (big sprites, motion is very visible — do these next)
3. Common mobs: `mob_slime`, `mob_packwolf`, `mob_legion`, `mob_shade`
4. Town NPCs idle (subtle breathing is plenty)

Everything not yet animated just uses its static art — ship frames one character at a time.
