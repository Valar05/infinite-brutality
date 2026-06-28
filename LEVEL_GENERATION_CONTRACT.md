# Infinite Brutality Level Generation Contract

This project should use Quake-style route grammar as an abstraction, not copy Quake layouts or data.

## Current State

- Current reference room: authored skull guillotine triple-bridge hall.
- Previous hand-authored comparison slice: `quake_m1e1_slice`, a compact fortress-rock route using `start casemate -> battery court -> locked gate face -> key trench branch -> upper overlook -> optional secret ledge -> final gun room -> exit`, available with `?slice=quake_m1e1`.
- Current default playable slice direction: `carved_voxel_fortress`, a single solid voxel rock mass with route spaces cut out of it. The fortress is carved negative space plus minimal reinforcement, not primitive rooms placed on rock.
- Current district identity direction: generation must begin with district intent before geometry. The first implemented intent profiles are `artillery_battery`, `cloud_dock`, `imperial_foundry`, and `quarry_barracks`, selectable on the carved slice with `?district=...`.
- Previous broad generated gauntlet remains available with `?slice=generated`.
- Main experimental direction after `quake_m1e1_slice`: ingest Quake-style spatial structure through `tools/quake_geometry_ingest/`, then rebuild it as Infinite Brutality-owned voxels/primitives. Use neutral or local-analysis geometry as tooling input; do not ship copied Quake map data.
- Current training artifact: `data/level_route_templates.json`.
- Thunder curriculum: `../thunder-brainstorm/generated/quake_route_grammar/quake_route_grammar_curriculum.json`.
- Levels processed from legal Quake map-source archive: 63 total sources; 41 playable maps trained; 22 item/prefab sources retained as metadata only.

The current templates are trained from John Romero/id Software's released Quake map source archive, kept under Thunder external sources. Infinite Brutality receives only abstract route sentences, feature counts, and generator biases; no Quake map geometry, WADs, textures, or copied layouts are placed in the game project.

## Hard Rules

- Do not generate generic boxes with random junk in them.
- Do not add crouch, crouch-slide, or duck-jump as movement verbs.
- Use running jump, jump buffering, air steering, bridge lips, ramp lips, and stair lips for bunny-hop feel.
- Build traversal route grammar first; add rubble, chains, pillars, enemies, and lights after the route reads.
- Keep side galleries and lower floors as recovery lines for touch players.
- Use landmarks and visible exits so the player understands the destination before optimizing the route.
- Do not let a valid carved route remain anonymous. Each generated district must declare and expose purpose, required phrases, required assemblies, logistics flow, skyline, silhouette, and traversal identity before geometry emission.

## Training Pipeline

Run this when legal/local Quake map sources are available:

```sh
python3 thunder-brainstorm/tools/quake_route_grammar.py \
  --input thunder-brainstorm/generated/external_sources/quake_map_sources/quake-maps-master.zip \
  --out-dir thunder-brainstorm/generated/quake_route_grammar
```

The extractor accepts `.map`, `.bsp`, Quake `.pak`, and `.pk3`/`.zip` files containing `.map` or `.bsp` files. Outputs must remain abstract: route sentences, feature counts, ML level-design biases, and Infinite Brutality template rules only. Keep original sources isolated under Thunder external source manifests and do not redistribute Quake map data inside the game.

## Trained ML Lessons

From the legal Quake map-source archive, the current abstract curriculum trained on 41 playable maps and retained 22 item/prefab map sources as metadata only. The aggregate bias is clear: prefer visible vertical layering, long acceleration lanes before jump lips, route-change gates with physical returns, and pickups/enemies as breadcrumbs along an already-readable route.

Current archetype counts: gate loop return = 34, layered read = 6, vertical bridge line = 1. This does not mean every room should be a copied gate loop; it means the generator should make destination, blockage, alternate route, changed route, and faster return legible in new Infinite Brutality geometry.

## Template Vocabulary

- `entry_read`: player sees the room sentence before moving.
- `central_bridge_commitment`: direct high-risk route through the room.
- `side_gallery_recovery`: safer alternate/recovery path for touch control.
- `upper_crossing`: visible route-memory layer above or ahead.
- `acceleration_runway`: enough approach distance for run build-up.
- `bridge_or_stair_lip`: timing surface for running jump / bunny-hop feel.
- `air_steer_window`: gap or turn where yaw and left stick shape trajectory.
- `forgiving_landing`: first clear landing that proves the route.
- `optional_faster_landing`: harder landing that rewards mastery.
