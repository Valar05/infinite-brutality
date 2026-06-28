# Terrain Generation Techniques

This note catalogs the terrain-generation techniques that are current in the
runtime, plus historical techniques that still remain in code or tests.

Authoritative terrain shape direction lives in `docs/ROCK_SHAPE_GRAMMAR.md`.
This file is the implementation map: which functions build which style, where
they are used, and what validates them.

## Current Runtime Terrain

### Sedimentary Mesa Island Fields

Primary functions:

- `src/island-geometry.js`: `buildRoomIslandField(size, seed, { grammar: 'sedimentary_mesa', ... })`
- `src/island-geometry.js`: `buildSedimentaryMesaField(...)`
- `src/island-geometry.js`: `closeVoxelDiagonalEdgeGaps(...)`

This is the current accepted terrain grammar for district island masses. The
field generator samples a rectangular mesa-like voxel footprint, then varies
rim chips, terraces, undercut depth, vertical grooves, and strata bands. The
result keeps broad playable tops while making rims and undersides read as
sediment, erosion, and fracture rather than random blob noise.

The generated field carries `field.rockGrammar` metadata:

- `grammar`: `sedimentary_mesa`
- `silhouette`: `mesa`
- `process`: `sediment_layers_erosion_fracture`
- `role`: caller-supplied gameplay role, such as `arena`

After field sampling, `closeVoxelDiagonalEdgeGaps(...)` fills diagonal-only
contacts so exposed-voxel meshing can remain watertight and manifold.

Current runtime use:

- `src/main.js`: `generateDistrictPlan(...)` creates three terraced district
  mass anchors with `rockGrammar: 'sedimentary_mesa'`.
- `src/district-geometry.js`: `addDistrictIslandMasses(...)` calls
  `buildRoomIslandField(..., { grammar: anchor.rockGrammar || 'sedimentary_mesa',
  terraced: true, role: anchor.role || 'arena' })` for terraced anchors.

### Sedimentary Mesa Bridge Fields

Primary functions:

- `src/island-geometry.js`: `buildSedimentaryMesaBridgeField(...)`
- `src/main.js`: `addIslandArtBridge(...)`
- `src/main.js`: `addIslandArtSteppedRamp(...)`
- `src/district-geometry.js`: `addDistrictIslandBridges(...)`

This is the current connector terrain path. It builds sheared bridge-fragment
voxel fields with wider touch-first decks, chipped side edges, stepped tops,
and sedimentary underside variation. The field metadata marks these as:

- `grammar`: `sedimentary_mesa`
- `silhouette`: `bridge_fragment`
- `process`: `sediment_layers_sheared_collapse`
- `role`: `connector`

Current runtime use:

- `addWorldConnector(...)` uses `addIslandArtSteppedRamp(...)` when
  `ISLAND_ART_ONLY` is active.
- `addIslandArtSteppedRamp(...)` splits a connector into several bent segments,
  and each segment calls `addIslandArtBridge(...)`.
- `addIslandArtBridge(...)` defaults to `buildSedimentaryMesaBridgeField(...)`
  unless explicitly passed `slabBridge: false`.
- `addDistrictIslandBridges(...)` also uses the sedimentary bridge field for
  visible bridges between district mass anchors.

### Budgeted Sedimentary Visual Shell

Primary functions:

- `src/island-geometry.js`: `buildSedimentaryMesaMeshData(field, uvScale)`
- `src/island-geometry.js`: `buildSedimentaryVisualMeshData(field, uvScale)`
- `src/island-geometry.js`: `buildSurfaceNetMeshData(field, uvScale)`

This is the active sedimentary terrain path. It preserves the voxel field for
support and collision, but the visible mesh is a budgeted contour shell instead
of exposed voxel faces or greedy merged voxel sheets. The shell starts from the
surface-net mesh, applies deterministic sedimentary terrace/fracture shaping,
then reorients triangles against the voxel field so the result remains
watertight and consistently outward-facing.

The important split is:

- Collision/support stays voxel-aligned and queryable.
- The rendered mesh is a budgeted LOD, not the collision mesh.
- Playable top surfaces stay broad and clean.
- Chipped rim and fracture shaping are concentrated at side/boundary regions.
- Strata and erosion come from the shell shape plus material/UV response, not
  one quad per voxel cell.

`buildGreedyVoxelMeshData(...)` and `buildExposedVoxelFaceMeshData(...)` remain
in code as comparison/debug paths. They are not the accepted active visible
sedimentary terrain path.

Current validation:

- `tools/test_rock_grammar_contract.mjs` checks sedimentary metadata, playable
  central coverage, terraced top bands, rim variation, undercut variation,
  triangle budget, and off-grid visual vertex ratio.
- `tools/test_island_mesh_integrity_contract.mjs` checks active sedimentary
  island and bridge meshes for cavity-free fields, watertight edges,
  manifoldness, and outward-facing triangles.
- `tools/test_scene_geometry_budget.mjs` checks the active district slice
  against mobile triangle, vertex, edge, island, ramp, and contour-shell
  budgets.
- `tools/test_terrain_visual_contract.mjs` is the visual-proxy red test for the
  current branch. It rejects giant axis-aligned sheets and box-bounded
  silhouettes.

### Voxel Support And Collision Queries

Primary functions:

- `src/island-geometry.js`: `queryVoxelTopY(...)`
- `src/island-geometry.js`: `queryVoxelIntersectsPrism(...)`
- `src/main.js`: `registerVoxelSupportCollider(...)`
- `src/main.js`: `findVoxelSupport(...)`
- `src/main.js`: `voxelBodyBlockedAt(...)`

Visible sedimentary meshes are paired with voxel support colliders. Player and
enemy support queries use the same field as the rendered island or bridge,
which keeps visual terrain and traversal truth aligned.

Current runtime use:

- `addIslandArtBridge(...)` registers both mesh support and voxel support for
  each generated bridge segment.
- `addDistrictIslandMasses(...)` registers mesh and voxel support for each
  generated district island mass.
- `findVoxelSupport(...)` and `voxelBodyBlockedAt(...)` participate in enemy
  and player support/blocking checks.

## Historical Or Legacy Techniques Still In Code

### Ellipsoid-Lobe District Island Fields

Primary functions:

- `src/island-geometry.js`: `buildIslandVoxelField(anchor, seed)`
- `src/island-geometry.js`: `fillEllipsoid(...)`
- `src/island-geometry.js`: `fillDownwardSpike(...)`

This older district island generator builds a low-poly organic mass by filling
one main ellipsoid, several random lobes, downward spikes, and a small top
crown. It is still used as the fallback path in `addDistrictIslandMasses(...)`
when an anchor is not marked `terraced`.

Current status:

- Still callable.
- Not the intended path for the current Hanging Gardens proof slice, because
  current district mass anchors are terraced sedimentary mesas.
- Useful as a legacy organic-island fallback, but it can regress toward lumpy
  floating-rock language if it becomes visible again.

### Legacy Room Island Fields

Primary functions:

- `src/island-geometry.js`: `buildRoomIslandField(size, seed, optionsOrTerraced)`
- `src/island-geometry.js`: `buildLegacyRoomIslandField(...)`

Before the sedimentary grammar, `buildRoomIslandField(...)` generated broad
floating room islands from a radial noise footprint, rim waves, edge notches,
top pockets, optional terracing, belly noise, and hanging spurs. The boolean
`true` third argument still maps to a legacy terraced island.

Current status:

- Still callable through `buildRoomIslandField(...)` whenever
  `options.grammar !== 'sedimentary_mesa'`.
- Still covered by `tools/test_rock_grammar_contract.mjs`, which asserts that
  the legacy boolean terraced call emits center support.
- Still included in mesh-integrity tests as `legacy-room`.
- Should be treated as historical unless a caller deliberately wants the older
  organic floating-island style.

### Legacy Rock Bridge Fields

Primary functions:

- `src/island-geometry.js`: `buildRockBridgeField(...)`
- `src/island-geometry.js`: `buildRockBridgeMeshData(...)`
- `src/main.js`: `addIslandArtBridge(..., { slabBridge: false })`

This older bridge generator produces arched, organic rock bridges with width
noise, edge notches, crest noise, top pockets, underside variation, and small
fang-like hanging forms.

Current status:

- Still exported.
- Still covered by `tools/test_island_mesh_integrity_contract.mjs` as
  `legacy-bridge`.
- Still reachable from `addIslandArtBridge(...)` when `slabBridge === false`.
- Not the default connector path. The default is now
  `buildSedimentaryMesaBridgeField(...)`.

### Surface-Net / Marching-Tetra Mesh Output

Primary functions:

- `src/island-geometry.js`: `buildSurfaceNetMeshData(field, uvScale)`
- `src/island-geometry.js`: `buildScalarGrid(...)`
- `src/island-geometry.js`: `emitMarchingTetra(...)`

Despite the name, the current implementation emits a smooth-ish surface from a
scalar grid using marching tetrahedra. It remains valuable for organic legacy
fields, but it is no longer the active sedimentary mesa mesh path.

Current status:

- Still exported.
- Still used for non-sedimentary district islands in
  `addDistrictIslandMasses(...)`.
- Still used by `buildRoomIslandMeshData(...)`, which wraps a default legacy
  room island field.
- Still used in tests as a comparison baseline for sedimentary triangle cost.
- Not acceptable as the active sedimentary terrain mesh because it rounds
  mesa forms toward blob language.

### Greedy Voxel Mesh Output

Primary function:

- `src/island-geometry.js`: `buildGreedyVoxelMeshData(field, uvScale)`

This function emits merged axis-aligned voxel quads by sweeping masks through
the voxel volume. It can reduce face count, but it keeps exact grid-aligned
surfaces and therefore tends to read as voxel/cube terrain.

Current status:

- Still exported.
- No current runtime call was found in `src/`.
- Not part of the accepted sedimentary path because build `0.8.175` explicitly
  requires visual vertices to leave the exact cube grid.

### Disabled District Route Island Hook

Primary function:

- `src/district-geometry.js`: `addDistrictRouteIslands(...)`

This function currently returns immediately. Its disabled body would generate
route-local room islands with `buildRoomIslandField(...)`,
`buildSurfaceNetMeshData(...)`, mesh support colliders, and voxel support
colliders.

Current status:

- Present but disabled.
- Historical context for an earlier district route-island pass.
- If re-enabled, it should be updated to select sedimentary mesa fields and the
  current exposed-voxel mesh path unless the old organic style is explicitly
  desired.

## Architectural Terrain And Route Geometry

Not all terrain-like surfaces come from voxel fields.

Important runtime builders:

- `src/main.js`: generated batch rooms use carved floor footprints, route
  slabs, stairs, galleries, upper crossings, lower recovery shelves, and
  connector-only socket frames.
- `src/main.js`: `addWorldConnector(...)` can either build island-art ramps
  when `ISLAND_ART_ONLY` is active, or conventional `addBatchRouteSegment(...)`
  / `addBatchStairRun(...)` connector geometry otherwise.
- `src/district-geometry.js`: `addHangingMarketDistrictSkeleton(...)` builds
  large architectural terraces, retaining walls, undercroft returns,
  aqueduct pieces, stairs, and route segments from boxes/cylinders rather than
  voxel terrain.

These systems are terrain-adjacent but not rock generators. They create the
settlement-machine structure that sits on or between the sedimentary island
masses.

## Validation Commands

Use these checks for terrain work:

```sh
node tools/test_rock_grammar_contract.mjs
node tools/test_island_mesh_integrity_contract.mjs
node tools/test_scene_geometry_budget.mjs
node tools/test_island_geometry_quality.mjs
node tools/test_island_surface_truth_contract.mjs
```

For runtime syntax after touching `src/`:

```sh
node --input-type=module --check < src/main.js
```

## Current Acceptance Rule

For current visible terrain, prefer:

1. sedimentary mesa or sedimentary bridge field metadata
2. diagonal-gap-closed voxel field
3. budgeted merged-face visible mesh
4. deterministic in-plane visual weathering
5. registered mesh and voxel support colliders
6. terrain contracts passing
7. fresh screenshot review when the change is visible

Legacy surface-net, exposed-voxel, and organic rock paths may remain as
comparison baselines or explicit fallback styles, but they should not silently
become the default for the active Hanging Gardens terrain slice.
