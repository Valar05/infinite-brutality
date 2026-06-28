# Quake Geometry Ingest

Tooling experiment for converting Quake-style spatial structure into Infinite Brutality-owned voxel and primitive data.

This directory must not contain shipped Quake art, textures, audio, or copyrighted map data. The committed fixture is synthetic repo-owned geometry. External Quake `.map`/`.bsp` data may be used locally for analysis only after being converted into the neutral schema; outputs from external sources must not be committed as game content.

## V1 Input

The canonical v1 input is `neutral_quake_geometry.v1`: AABB brushes and simple entities in Quake-style axes.

- Quake `x` maps to Infinite Brutality `x`.
- Quake `y` maps to Infinite Brutality `z`.
- Quake `z` maps to Infinite Brutality `y`.
- Default scale: `32 Quake units = 1 Infinite Brutality unit`.

## Command

```sh
node tools/quake_geometry_ingest/ingest.mjs \
  --input tools/quake_geometry_ingest/fixtures/mini_gate_loop.neutral.json \
  --out generated/quake_geometry_ingest/mini_gate_loop
```

## Outputs

- `room_graph.json`: extracted rooms, edges, loopbacks, side/secret candidates.
- `walkableSurfaces` inside `slice_plan.json`: floor/stair/ledge surface records.
- `voxel_field.json`: RLE encoded Infinite Brutality solid voxel field.
- `slice_plan.json`: runtime-facing rebuilt slice plan contract.
- `debug_route_graph.svg`: top-down route graph visualization.
- `report.json`: extraction metrics.

## Current Limits

V1 does not parse raw `.map` or `.bsp` directly. Raw format adapters should feed this neutral schema first, then reuse the same extraction, voxelization, and validation pipeline.
