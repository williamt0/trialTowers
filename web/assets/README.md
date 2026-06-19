# Image Assets — drop PNGs here to replace the generated art

The game checks this folder for images at runtime. **If a file exists it is used; if not, the
built-in generated art draws instead** — so you can replace characters one at a time.

## File naming
| What | Filename | Keys |
|---|---|---|
| Player classes | `hero_<Class>.png` | `hero_Knight`, `hero_Ranger`, `hero_Mage`, `hero_Rogue`, `hero_Gorilla`, `hero_Vampire`, `hero_Joker`, `hero_Necromancer` |
| NPCs | `npc_<kind>.png` | `npc_sage`, `npc_quester`, `npc_merchant`, `npc_healer`, `npc_smith`, `npc_guard`, `npc_scholar`, `npc_cook`, `npc_gambler`, `npc_bard`, `npc_monk`, `npc_child`, `npc_innkeep`, `npc_farmer`, `npc_wanderer`, `npc_enchanter`, `npc_fisher`, `npc_arenamaster`, `npc_watchman`, `npc_priest`, `npc_storyteller`, `npc_caravaneer`, `npc_courier`, `npc_miner`, `npc_hermit`, `npc_tavernkeep` |
| Creatures | `mob_<species>.png` | `mob_slime`, `mob_darter`, `mob_spitter`, `mob_bomber`, `mob_nest`, `mob_splitter`, `mob_froster`, `mob_hound`, `mob_sporeling`, `mob_wisp`, `mob_lurker`, `mob_sentinel`, `mob_bloodbat`, `mob_seraphling`, `mob_voidling`, `mob_vinesnap`, `mob_prowler`, `mob_dartfrog`, `mob_stinger`, `mob_silverback`, `mob_legion`, `mob_arbalist`, `mob_warhound`, `mob_packwolf`, `mob_bruiser`, `mob_spearhunt`, `mob_wardenE`, `mob_dancer`, `mob_treant`, `mob_impling`, `mob_hexcaster`, `mob_brute`, `mob_bombfiend`, `mob_swordsman`, `mob_arcanist`, `mob_thrall`, `mob_spiritling`, `mob_drakeling`, `mob_felguard`, `mob_shade`, `mob_echoarcher`, `mob_seraph`, `mob_templar`, `mob_general` |
| Floor bosses | `boss_f<floor>.png` | `boss_f1` ... `boss_f11`, plus `boss_f7m` |
| Upper Beings (F8) | `champ_<n>.png` | `champ_1` (Crimson Count), `champ_2` (Aurelia), `champ_3` (Vermithrax), `champ_4` (Mal'goth) |

## Image requirements
- **PNG with transparent background**
- Character should **face RIGHT** (the game flips it to face left automatically)
- ~**256×256** for creatures/NPCs/heroes, ~**512×512** for bosses (any size works; height is what's scaled)
- Keep the subject centered with a little padding

## Generator workflow
Run the project-local generator from the repo root:

```bash
python3 tools/generate_character_assets.py
```

It rebuilds the full non-hero cast, skips every `hero_*` file, writes
`character_asset_manifest.json`, and updates `character_asset_preview.png`.

## Animated characters (frame animation)
The playable heroes keep their existing hand-authored `hero_*` static and animation assets.
The generated non-hero cast covers 122 character keys: 57 NPCs, 49 mobs, 4 champions, and
12 boss keys. Each generated character has:

- 16 `idle` frames
- 16 `walk` frames
- 8 `attack` frames for future combat animation wiring

The engine currently consumes idle/walk frames for NPCs, mobs, champions, and bosses, and
continues to use the existing hero attack frames for the playable classes.
