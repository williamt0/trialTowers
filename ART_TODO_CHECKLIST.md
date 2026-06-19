# THE TOWER — ART TO-DRAW CHECKLIST (missing files)

_Generated v230: engine-requested art keys cross-referenced against `web/assets/` + `web/assets/anim/`. Companion to `THE_TOWER_GENERATION_SPEC.md` (read §0 + §6 for the rules)._

**Rules recap:** face RIGHT · transparent bg · frames contiguous from `_1` · ≤16 frames @ ~10 fps · bump `ASSET_VER` (statics)/`ANIM_VER` (anim) after adding. Minimum to render: a static `<key>.png` **or** `idle` frames; `walk` recommended (falls back to idle); heroes also need `attack`.
Legend: ❌ no art (renders procedural) · 🟡 partial (works, improvable) · ✅ done

---

## HEROES (8) — ✅ ALL DONE
Knight, Ranger, Mage, Rogue, Gorilla, Joker, Necromancer, Vampire — idle/walk/attack present & contiguous (fixed v230).

## BOSSES — ❌ 9 missing statics (anim optional)
Key `boss_f<floor>.png`. **Floors 7 (Families) and 8 (Champions) have NO boss** — their gatekeepers are NPC house-heads / the 4 Champions, so the engine never requests `boss_f7`/`boss_f8`.

- ❌ `boss_f1.png` — Trial Grounds · beast
- ❌ `boss_f2.png` — Verdant Jungle · beast
- ❌ `boss_f3.png` — Human Empire · knight
- ❌ `boss_f4.png` — 獸人族 Empire · beast
- ❌ `boss_f5.png` — Elves Forest · elf
- ❌ `boss_f6.png` — 魔物 Empire · imp
- ❌ `boss_f9.png` — Hall of Echoes · ghost
- ❌ `boss_f10.png` — Molten Heart · imp
- ❌ `boss_f11.png` — Tower's Crown · Aethon · spirit
- ⚠️ `boss_f7m.png` — exists on disk but is **unused dead art**: F7 (families) spawns no boss, so it's never drawn. Safe to ignore or delete. *(verified by adversarial audit)*

## CHAMPIONS (Floor 8) — `champ_<1-4>`
- 🟡 `champ_1` — The Crimson Count · Vampire · bat — has: walk → need: static or idle, idle
- ❌ `champ_2` — Aurelia · Higher Spirit · spirit — has: nothing → need: static or idle, idle, walk
- ❌ `champ_3` — Vermithrax · Elder Dragon · dragon — has: nothing → need: static or idle, idle, walk
- ❌ `champ_4` — Mal'goth · 高階魔族 · imp — has: nothing → need: static or idle, idle, walk

## MOBS

### ❌ No art — 16 species (top priority)
Each needs `mob_<key>.png` **or** `mob_<key>_idle_N` (+ `_walk_N`).
- ❌ `mob_arbalist` — F3 · knight
- ❌ `mob_cinderdart` — F10 · bug
- ❌ `mob_dancer` — F5 · elf
- ❌ `mob_echoarcher` — F9 · ghost
- ❌ `mob_emberhound` — F10 · beast
- ❌ `mob_legion` — F3 · knight
- ❌ `mob_magmite` — F10 · imp
- ❌ `mob_packwolf` — F4 · beast
- ❌ `mob_pyrecaster` — F10 · mage
- ❌ `mob_silverback` — F2 boss-sig · beast
- ❌ `mob_slagbrute` — F10 sig · beast
- ❌ `mob_splitter` — F1 Trial · slime
- ❌ `mob_swordsman` — F7 · knight
- ❌ `mob_templar` — F11 · knight
- ❌ `mob_treant` — F5 · plant
- ❌ `mob_wardenE` — F5 · elf
- ❌ `mob_general` — camp warlords / world-bosses (`general` base)

### 🟡 Static only — 9 (add `idle`+`walk` to animate)
`mob_bloodbat`, `mob_bruiser`, `mob_dartfrog`, `mob_froster`, `mob_impling`, `mob_sentinel`, `mob_seraphling`, `mob_stinger`, `mob_warhound`

### 🟡 Idle only — 10 (add `_walk_N`)
`mob_arcanist`, `mob_brute`, `mob_drakeling`, `mob_felguard`, `mob_hexcaster`, `mob_lurker`, `mob_seraph`, `mob_spiritling`, `mob_vinesnap`, `mob_voidling`

### ✅ Fully animated — 6
`mob_bombfiend`, `mob_prowler`, `mob_shade`, `mob_spearhunt`, `mob_thrall`, `mob_wisp`

_Legacy:_ `mob_sporeling.png` is unused (species is `splitter`); `mob_darter/slime/nest` cover base critters.

## NPCs — only 4 of 66 spawnable types have art

**Already drawn:** `npc_arenamaster`, `npc_monk`, `npc_quester`, `npc_storyteller`.
Resolution is single-hop: `npc_<type>` → `npc_<spriteAs>` → procedural. Draw one **base** sprite and every type aliasing to it is covered.

### ⭐ Minimal base set — draw these 26, and (almost) every NPC is covered
`npc_acolyte`, `npc_bard`, `npc_caravaneer`, `npc_child`, `npc_cook`, `npc_courier`, `npc_enchanter`, `npc_errant`, `npc_farmer`, `npc_fisher`, `npc_gambler`, `npc_guard`, `npc_healer`, `npc_hermit`, `npc_innkeep`, `npc_merchant`, `npc_miner`, `npc_noble`, `npc_peasant`, `npc_priest`, `npc_sage`, `npc_scholar`, `npc_smith`, `npc_tavernkeep`, `npc_wanderer`, `npc_watchman`

### Full per-type fallback table
| type | falls back to | covered? |
|---|---|---|
| `npc_acolyte` | `npc_monk` | ✅ |
| `npc_arenamaster` | `npc_arenamaster` (self) | ✅ |
| `npc_bard` | `npc_bard` (self) | ❌ |
| `npc_beggar` | `npc_hermit` | ❌ |
| `npc_bountymaster` | `npc_guard` | ❌ |
| `npc_busker` | `npc_bard` | ❌ |
| `npc_caravaneer` | `npc_caravaneer` (self) | ❌ |
| `npc_child` | `npc_child` (self) | ❌ |
| `npc_climber` | `npc_wanderer` | ❌ |
| `npc_cook` | `npc_cook` (self) | ❌ |
| `npc_courier` | `npc_courier` (self) | ❌ |
| `npc_crier` | `npc_storyteller` | ✅ |
| `npc_dancer` | `npc_bard` | ❌ |
| `npc_drunkard` | `npc_tavernkeep` | ❌ |
| `npc_enchanter` | `npc_enchanter` (self) | ❌ |
| `npc_errant` | `npc_guard` | ❌ |
| `npc_farmer` | `npc_farmer` (self) | ❌ |
| `npc_fisher` | `npc_fisher` (self) | ❌ |
| `npc_fishmonger` | `npc_fisher` | ❌ |
| `npc_gambler` | `npc_gambler` (self) | ❌ |
| `npc_gravedigger` | `npc_miner` | ❌ |
| `npc_guard` | `npc_guard` (self) | ❌ |
| `npc_healer` | `npc_healer` (self) | ❌ |
| `npc_herbalist` | `npc_monk` | ✅ |
| `npc_hermit` | `npc_hermit` (self) | ❌ |
| `npc_house_acolyte` | `npc_acolyte` | ❌ |
| `npc_house_arcanist` | `npc_enchanter` | ❌ |
| `npc_house_enchant` | `npc_enchanter` | ❌ |
| `npc_house_errant` | `npc_errant` | ❌ |
| `npc_house_heir` | `npc_errant` | ❌ |
| `npc_house_knight` | `npc_guard` | ❌ |
| `npc_house_scholar` | `npc_scholar` | ❌ |
| `npc_house_smith` | `npc_smith` | ❌ |
| `npc_house_steward` | `npc_caravaneer` | ❌ |
| `npc_househead` | `npc_errant` | ❌ |
| `npc_innkeep` | `npc_innkeep` (self) | ❌ |
| `npc_laborer` | `npc_miner` | ❌ |
| `npc_lamplighter` | `npc_watchman` | ❌ |
| `npc_magistrate` | `npc_enchanter` | ❌ |
| `npc_merchant` | `npc_merchant` (self) | ❌ |
| `npc_miner` | `npc_miner` (self) | ❌ |
| `npc_monk` | `npc_monk` (self) | ✅ |
| `npc_mythic` | `npc_enchanter` | ❌ |
| `npc_noble` | `npc_merchant` | ❌ |
| `npc_peasant` | `npc_farmer` | ❌ |
| `npc_pedlar` | `npc_caravaneer` | ❌ |
| `npc_pilgrim` | `npc_monk` | ✅ |
| `npc_pilgrimkeeper` | `npc_monk` | ✅ |
| `npc_priest` | `npc_priest` (self) | ❌ |
| `npc_quartermaster` | `npc_caravaneer` | ❌ |
| `npc_quester` | `npc_quester` (self) | ✅ |
| `npc_ranger` | `npc_courier` | ❌ |
| `npc_ratcatcher` | `npc_hermit` | ❌ |
| `npc_sage` | `npc_sage` (self) | ❌ |
| `npc_scholar` | `npc_scholar` (self) | ❌ |
| `npc_seer` | `npc_enchanter` | ❌ |
| `npc_shepherd` | `npc_farmer` | ❌ |
| `npc_smith` | `npc_smith` (self) | ❌ |
| `npc_storyteller` | `npc_storyteller` (self) | ✅ |
| `npc_tavernkeep` | `npc_tavernkeep` (self) | ❌ |
| `npc_taxman` | `npc_noble` | ❌ |
| `npc_urchin` | `npc_child` | ❌ |
| `npc_villager` | `npc_wanderer` | ❌ |
| `npc_washer` | `npc_peasant` | ❌ |
| `npc_watchman` | `npc_watchman` (self) | ❌ |
| `npc_youngson` | `npc_child` | ❌ |

---
_Props/decos/ground/UI are mostly procedural or already present — not animation art. See `THE_TOWER_GENERATION_SPEC.md` §4/§6 for those._
