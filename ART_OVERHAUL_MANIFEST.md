# THE TOWER — Complete Visual Overhaul Manifest
### Every image the game can use. Generate, name exactly, drop in the folder — the engine does the rest.

The engine now has **universal skinning hooks**: every layer below loads a PNG if it exists and
falls back to the built-in procedural art if it doesn't. You can generate these in any order;
the game upgrades piece by piece. **No code changes are ever needed.**

| Drop into | What goes there |
|---|---|
| `web/assets/` | every static PNG below |
| `web/assets/anim/` | animation frames (`<key>_<state>_<n>.png`, n = 1..6) |

**After adding anim frames**: bump `ANIM_VER` (one character in game.js) or hard-refresh.
**Slicing sheets into frames**: see `ANIMATION_GUIDE.md` — same pipeline as the heroes/monsters already done.

---

## 0 · THE STYLE BIBLE — append this to EVERY prompt

> **GLOBAL STYLE SUFFIX:**
> "chibi fantasy game sprite, flat cel shading with painterly accents, bold dark outline,
> vibrant saturated colors, soft top-left key light, transparent background, no drop shadow,
> facing right, centered, full body in frame, high quality game asset"

For ENVIRONMENT pieces (decos/props) replace "facing right, full body" with:
> "three-quarter top-down view game asset, grounded at the base of the frame"

For GROUND textures use the dedicated suffix in §6.

Palette anchors per realm (work these color words into prompts when a realm variant is asked for):

| # | Realm | Palette words |
|---|---|---|
| f0 | Trial Grounds | spring meadow green, warm grey stone, dandelion gold |
| f1 | Verdant Jungle | deep jungle green, moss, orchid pink, vine |
| f2 | Human Empire | slate blue, cobblestone grey, imperial crimson banners |
| f3 | 獸人族 (Orc) Empire | burnt umber, tusk ivory, war-paint ochre |
| f4 | Elves Forest | silver birch, leaf green, petal pink, moonlight |
| f5 | 魔物 (Demon) Empire | obsidian black, ember orange, infernal magenta |
| f6 | Two Families Peak | white marble, gold filigree, sky at dusk |
| f7 | Court of Upper Beings | void violet, starfield indigo, arcane glow |
| f8 | Hall of Echoes | glacial blue, pale marble, ghost-light cyan |
| f9 | Tower's Crown | royal gold, sunrise amber, white stone |

---

## 1 · HEROES (P0 — highest priority)

Existing & done (KEEP): hero_Knight, hero_Ranger, hero_Mage, hero_Rogue — statics + full anim sets.

### New heroes — static portrait (296×296) + anim sheets (6-frame idle / walk / attack rows, see ANIMATION_GUIDE)
| File(s) | Prompt core |
|---|---|
| `hero_Gorilla.png` + `anim/hero_Gorilla_{idle,walk,attack}_1..6.png` | massive silverback gorilla warrior, hulking shoulders, stone-grey fur with silver back, leather knuckle wraps, small battle scars, gentle intelligent eyes, knuckle-walking stance |
| `hero_Vampire.png` + `anim/hero_Vampire_{idle,walk,attack}_1..6.png` | elegant vampire lord, slicked black hair with widow's peak, high-collared crimson-lined black cape, pale skin, glowing red eyes, one clawed hand raised with a floating blood orb |
| `hero_Joker.png` + `anim/hero_Joker_{idle,walk,attack}_1..6.png` | sinister carnival jester, purple-and-gold harlequin coat, white face paint with a sharp grin, fan of razor playing cards in one hand, curved dagger in the other, jingling three-point hat |
| `hero_Necromancer.png` + `anim/hero_Necromancer_{idle,walk,attack}_1..6.png` | hooded necromancer, tattered deep-green robes, glowing teal soul-flame in raised palm, bone trinkets on belt, skeletal pauldron on one shoulder |

Attack rows: Gorilla = double-fist overhead smash · Vampire = clawed swipe with blood ribbon · Joker = card-fan throw · Necromancer = scythe-of-light sweep.

---

## 2 · NPCs (P1) — statics, 256×256

Existing & done (KEEP): arenamaster, bard, caravaneer, cook, courier, enchanter, gambler, guard, healer, hermit, innkeep, merchant, miner, monk, priest, quester, sage, scholar, smith, storyteller, tavernkeep, watchman.

### Missing classics
| File | Prompt core |
|---|---|
| `npc_fisher.png` | weathered fisherman, bucket hat hung with lures, rod over shoulder, rolled waders |
| `npc_farmer.png` | sun-browned farmer, straw hat, pitchfork, wheat sprig in teeth |
| `npc_child.png` | tiny village child mid-skip, patched tunic, wooden toy sword |
| `npc_wanderer.png` | road-worn traveller, dusty cloak, walking staff, satchel of maps |

### The new civilian cast
| File | Prompt core |
|---|---|
| `npc_villager.png` | ordinary villager, simple wool tunic and apron, basket of bread, friendly tired face |
| `npc_peasant.png` | field peasant, rolled sleeves, mud-hem smock, hoe over shoulder |
| `npc_noble.png` | haughty noble, plum velvet doublet, gold chain, raised chin, lace cuffs, tiny lapdog-less smugness |
| `npc_beggar.png` | hunched beggar, patched grey blanket-cloak, wooden bowl, hopeful eyes |
| `npc_pilgrim.png` | hooded pilgrim in undyed linen, prayer beads, tall walking staff with a small bell |
| `npc_laborer.png` | brawny labourer, leather work apron, sledgehammer, dusty bandana |
| `npc_urchin.png` | scrappy street kid, oversized flat cap, mischievous grin, hands in pockets (small frame, 0.7 scale of adult) |
| `npc_pedlar.png` | travelling pedlar bent under a huge backpack of pots, trinkets and lanterns, jangling wares |
| `npc_shepherd.png` | calm shepherd, wide-brim felt hat, crook staff, wool poncho |
| `npc_climber.png` | rival adventurer, rope coil across chest, battered breastplate, confident smirk, bandaged hands |

---

## 3 · MONSTERS (P1) — statics 256×256 (anims optional later, same pipeline)

Existing & done (KEEP): all current `mob_*.png` statics + the 17 animated species.

### Missing species
| File | Prompt core |
|---|---|
| `mob_spitter.png` | squat toad-like creature with an inflated acid sac throat, dripping green |
| `mob_bomber.png` | round grinning bomb-imp, fizzing fuse on head, anxious sweat drop |
| `mob_hound.png` | lean shadow hound, ribbed sides, glowing amber eyes, hackles raised |
| `mob_arbalist.png` | armored crossbow soldier kneeling behind a pavise shield, bolt loaded |
| `mob_wardenE.png` | tall elven warden in leaf-scale armor, living-wood glaive, stern silver eyes |
| `mob_dancer.png` | elven blade-dancer mid-spin, twin crescent daggers, ribbon sashes flying |
| `mob_general.png` | hulking warlord general in spiked plate, ragged war-cape, notched greataxe planted |
| `mob_brute.png` | (anim exists; static optional) lava-veined ogre brute, knuckles like boulders |

---

## 4 · BOSSES (P0 for anims) — statics exist; generate 6-frame idle + walk sheets, 512 frame size

| Files | Boss | Motion notes |
|---|---|---|
| `anim/boss_f1_{idle,walk}_1..6.png` | Trial Beast | heavy breathing, mane sway |
| `anim/boss_f2_{idle,walk}_1..6.png` | Jungle Tyrant | vines twitch, tail lash |
| `anim/boss_f3_{idle,walk}_1..6.png` | Imperial Lord-Commander | cape billow, sword tap |
| `anim/boss_f4_{idle,walk}_1..6.png` | Horde Khan | tusks grind, trophy chains swing |
| `anim/boss_f5_{idle,walk}_1..6.png` | High Keeper of the Elder Grove | bark plates shift, leaves drift |
| `anim/boss_f6_{idle,walk}_1..6.png` | Horned Sovereign | ember drift, molten sword drips |
| `anim/boss_f7_{idle,walk}_1..6.png` + `boss_f7m_{idle,walk}_1..6.png` | Patriarch of the Blade / Matriarch of the Arcane | stance sway / orbiting glyphs |
| `anim/boss_f9_{idle,walk}_1..6.png` | Echo Sovereign | ghost-light flicker, frost breath |
| `anim/boss_f10_{idle,walk}_1..6.png` | The Crowned | radiant crown pulse, slow regal stride |

(Champions champ_1..4 already animated. Optional: `champ_N_attack` rows.)

---

## 5 · ENVIRONMENT DECOS (P0 — biggest visual lift) — 256×256 (tree 384×384)

Generic set first; the engine auto-prefers a realm variant **`deco_<type>_f<realmIdx>.png`** when present (do trees + bushes per-realm in a second pass — palette words from §0).

| File | Prompt core |
|---|---|
| `deco_tree.png` | broad fantasy oak, layered painterly canopy in 3 green tones, knotted trunk, root flare |
| `deco_bush.png` | round layered shrub, three leaf clusters, berry sparks |
| `deco_rock.png` | mossy granite boulder, lichen patches, chipped facet |
| `deco_reed.png` | tall river reeds, five stalks with seed heads, slight bend |
| `deco_mushroom.png` | fat red-cap toadstool with white spots, two button mushrooms at base |
| `deco_crystal.png` | jagged arcane crystal cluster, inner glow, faceted highlights |
| `deco_brazier.png` | iron fire brazier on tripod legs, licking flame, ember sparks |
| `deco_pillar.png` | ancient fluted stone pillar, broken capital, ivy wisp |
| `deco_banner.png` | war banner on rough pole, swallow-tail pennant mid-flutter, emblem roundel |
| `deco_totem.png` | carved orcish totem pole, three stacked grimacing faces, feather ties, gold-leaf crown |
| `deco_bones.png` | weathered skull and rib pile, half-buried, one tilted femur |
| `deco_crate.png` | banded wooden crate, rope handle, stenciled mark |
| `deco_barrel.png` | oak barrel with iron hoops, bunghole, slight lean |
| `deco_flower.png` | tuft of three wildflowers (pink, gold, violet) with grass blades |

Per-realm tree pass (high impact, optional): `deco_tree_f1` jungle kapok with hanging vines · `deco_tree_f4` silver elven birch with pink petals · `deco_tree_f5` charred dead tree with ember cracks · `deco_tree_f6` golden-leaf ornamental tree.

---

## 6 · GROUND TEXTURES (P0 — transforms every screen) — 512×512, SEAMLESS TILEABLE

> **GROUND SUFFIX:** "seamless tileable top-down terrain texture, hand-painted stylized game art,
> soft painterly noise, no hard shadows, no objects, subtle value variation only, 512x512"

| File | Prompt core |
|---|---|
| `ground_f0.png` | spring meadow grass, tiny clover, worn dirt flecks |
| `ground_f1.png` | dense jungle floor, dark leaf litter, moss patches, fern shadows |
| `ground_f2.png` | grey cobblestone and packed earth, wheel-worn |
| `ground_f3.png` | cracked ochre wasteland clay, scattered gravel, old hoofprints |
| `ground_f4.png` | enchanted forest moss, silver-green, scattered petals, faint glow motes |
| `ground_f5.png` | scorched obsidian ground, ember veins, ash drifts |
| `ground_f6.png` | white marble terrace tiles with gold inlay seams |
| `ground_f7.png` | dark void-stone, faint starfield speckle, arcane hairline runes |
| `ground_f8.png` | pale frost-marble, hairline cracks, icy sheen |
| `ground_f9.png` | warm gold-flecked sandstone, sun-bleached, regal |

---

## 7 · PROPS (P1) — 256×256

| File | Prompt core |
|---|---|
| `prop_stall.png` | market stall with red-and-cream striped canopy, plank counter with fruit and trinkets |
| `prop_lamp.png` | wrought-iron street lamp, warm glowing glass cage, small scrollwork |
| `prop_anvil.png` | blacksmith anvil on oak stump, resting hammer, fresh sparks |
| `prop_keg.png` | tavern ale keg on its side cradle, brass tap, foam drip |
| `prop_cookfire.png` | camp cookfire ring of stones, hanging pot on tripod, curling smoke |
| `prop_well.png` | round stone village well, peaked wooden roof, rope and bucket |
| `prop_shrine.png` | small wayside shrine, carved alcove with glowing votive candle, flower offerings |
| `prop_waystone.png` | tall runed waystone monolith, blue glyphs, moss base |
| `prop_mound.png` | suspicious disturbed earth mound, cracked dry crust |
| `prop_board.png` | village notice board, pinned parchments, one fluttering |
| `prop_dummy.png` | straw training dummy on post, patched burlap, practice nicks |
| `prop_ore.png` | rock outcrop with exposed glinting copper-gold ore vein |
| `prop_book.png` | huge open tome on a carved lectern, glowing script |
| `prop_orb.png` | memory orb on a bronze stand, swirling galaxy inside |

(Runestones, chests, signs stay procedural/done — chest art exists; runestones need their three engine-tinted glow states.)

---

## 8 · SET PIECES & UI (P2)

| File | Size | Prompt core |
|---|---|---|
| `portal_open.png` | 512 | swirling arcane ascension portal seen from above-front, ringed stone dais, light vortex (engine animates rings/motes on top) |
| `portal_locked.png` | 512 | the same dais dormant, dark sealed vortex, faint dead runes |
| `ui_logo.png` | 1200×400 | game logo text "THE TOWER", carved stone letters with gold inlay and ivy, small portal glyph for the O, dark transparent background |

---

## 9 · GENERATION ORDER (best bang per batch)

1. **§6 ground textures** (10 images) — every pixel of every floor improves at once
2. **§5 generic decos** (14) — the wilds stop being vector shapes
3. **§1 new-hero statics** (4) — the roster screen completes
4. **§7 props** (14) — towns/markets finish
5. **§4 boss anim sheets** — the ten duels come alive
6. **§1 new-hero anim sheets**, **§2 NPCs**, **§3 missing mobs**, per-realm trees, **§8**

~110 images total to fully repaint the game; the first two batches (24 images) carry ~70% of the visual change.
