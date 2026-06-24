# Trial Towers — Unity 6 project (vertical slice)

A code-first Unity 2D scaffold of the Trial Towers core, sitting alongside the original
JavaScript prototype in [`web/`](web/). This was authored **without a local Unity install**, so it's
designed to be robust: the game builds itself in code, there are no hand-wired scenes or prefabs,
and visuals are generated at runtime (no art import needed yet).

## Open & run

1. Install **Unity Hub** + a **Unity 6 LTS** editor (any `6000.x`; this project declares `6000.0.23f1`
   in `ProjectSettings/ProjectVersion.txt` — if you have a different 6000.x, Unity will just use yours).
2. In Unity Hub → **Add → Add project from disk** → select this folder (`topdown-rpg/`).
3. Open it. Unity generates `Library/`, `.meta` files, and the rest of `ProjectSettings/` on first import (give it a minute).
4. Press **Play**. The slice bootstraps itself onto whatever scene is open (even the default empty one) — no scene setup required.
   - **If you see a red "INPUT DISABLED" message:** fresh Unity 6 projects default to the new Input System, which disables the legacy `Input` this slice uses. Set *Edit → Project Settings → Player → Other Settings → Active Input Handling* to **Both**, then press Play again. (The game shows this instruction on-screen, so you can't miss it.)

### Controls
- **WASD / arrows** — move
- **Space** or **Left-click** — melee (breaks walls, hits enemies)
- **R** — regenerate the floor (shows the procedural variety)

### What you should see
A dark arena bounded by indestructible walls, a 3×2 grid of **walled rooms** each with a gate gap,
a reinforced **vault** in the centre, red **enemies** that chase you, and a follow camera.
Wall colors encode hardness tiers — **timber** (brown, ~2 hits), **stone** (grey), **reinforced** (slate, slow).

## How it's wired (so it can't break on import)

- **No scene file.** `Bootstrap.Boot()` uses `[RuntimeInitializeOnLoadMethod]` to spawn everything on Play.
  Nothing references assets by GUID, so there's no scene/prefab to corrupt.
- **No art dependency.** `SpriteFactory` makes one 1×1 white sprite at runtime; everything is a tinted, scaled quad.
- **Real 2D physics.** Player/enemies are `Rigidbody2D` (gravity 0), walls are static `BoxCollider2D` — collision is engine-handled.
- **Legacy Input** (`Input.GetAxisRaw`, `Input.GetKey`). If movement does nothing, set
  *Edit → Project Settings → Player → Active Input Handling* to **Both**, then Play again.

## Scripts (`Assets/Scripts/`)
| File | Role |
|---|---|
| `Bootstrap.cs` | entry point; builds camera/player/world, handles R-regenerate |
| `WorldGen.cs` | procedural floor: boundary, walled rooms + gates, vault, enemies |
| `Wall.cs` | tiered breakable wall (timber/stone/reinforced/unbreakable) |
| `Player.cs` | movement + melee (OverlapCircle) |
| `Enemy.cs` | chase + contact damage |
| `CameraFollow.cs` | smooth follow |
| `SpriteFactory.cs` | runtime colored-sprite helper |
| `GameHUD.cs` | IMGUI HP + controls overlay |

## Next steps (porting the rest of the JS game)
This slice proves the architecture. The full port would grow `WorldGen` into the SoR district/road system,
add the hidden boss-room → portal loop with the four win-routes, the 4-act realm progression, and swap the
code-gen quads for the real sprite art in `web/assets/` (imported as Unity sprites). The JS build in `web/`
stays as the reference design + playable prototype.
