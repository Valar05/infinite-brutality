# Terrain Generation Techniques

This note catalogs the terrain-generation techniques that are current in the
runtime, plus historical techniques that still remain in code or tests.

Authoritative terrain shape direction lives in `docs/ROCK_SHAPE_GRAMMAR.md`.
This file is the implementation map: which functions build which style, where
they are used, and what validates them.

`docs/IMPERIAL_FLOATING_STRATA_GRAMMAR.md` is the current design bridge from
sedimentary terrain machinery to Napoleon's Floating Kingdom terrain language.
The active proof slice now requests `carved_imperial_structure`: one carved
fortress/logistics structure made from rock, not a chain of floating rocks. The
field bakes parade spine, fortress court, retaining cliffs, quarry galleries,
undercroft service, mooring bites, and collapse voids into the voxel support
truth. The visible terrain still uses the proven sedimentary contour shell for
the carved base, while district geometry supplies fused architecture.

## Current Runtime Terrain


### Carved Imperial Structure Fields

- `src/island-geometry.js`: `buildRoomIslandField(size, seed, { grammar: 'carved_imperial_structure', ... })`
- `src/district-geometry.js`: `addCarvedImperialStructure(...)`
- `src/main.js`: active districts carry `terrainMode: 'carved_imperial_structure'`

This is the active Napoleon proof-slice path. It is deliberately not an island
or bridge generator. It emits one carved base per district and suppresses the
old active island/bridge terrain chain. World connectors in island-art mode use
built causeways/stairs, not `addIslandArtSteppedRamp(...)` terrain spans.

The generated field carries:

- `grammar`: `carved_imperial_structure`
- `baseGrammar`: `imperial_floating_strata`
- `fieldGrammar`: `carved_imperial_structure`
- `process`: `imperial_structure_caved_from_rock`
- `zones`: parade spine, fortress court, retaining cliffs, quarry galleries,
  undercroft service, airship mooring bites, collapse voids

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

When emitted through `TerrainLayer`, callers may request
`imperial_floating_strata`. The layer routes that label to the imperial field
builder and records:

- `grammar`: `imperial_floating_strata`
- `baseGrammar`: `sedimentary_mesa`
- `fieldGrammar`: `imperial_floating_strata`
- `imperialFunction`: caller-supplied district/logistics function

After field sampling, `closeVoxelDiagonalEdgeGaps(...)` fills diagonal-only
contacts so exposed-voxel meshing can remain watertight and manifold.

Current runtime use:

- `src/main.js`: `generateDistrictPlan(...)` creates three terraced district
  mass anchors with `rockGrammar: 'sedimentary_mesa'`.
- `src/district-geometry.js`: `addDistrictIslandMasses(...)` submits each
  anchor to `TerrainLayer.addIslandStamp(...)`. The layer builds the
  `buildRoomIslandField(..., { grammar: spec.rockGrammar || 'sedimentary_mesa',
  terraced: true, role: spec.role || 'arena' })` field for terraced anchors.

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
- `addIslandArtBridge(...)` submits a connector stamp to
  `TerrainLayer.addBridgeSpan(...)`. The layer defaults to
  `buildSedimentaryMesaBridgeField(...)` unless explicitly passed
  `slabBridge: false`.
- `addDistrictIslandBridges(...)` submits bridge stamps to the same layer for
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

### Terrain Layer Ownership

Primary functions:

- `src/terrain-layer.js`: `createTerrainLayer(...)`
- `src/terrain-layer.js`: `addIslandStamp(...)`
- `src/terrain-layer.js`: `addBridgeSpan(...)`
- `src/terrain-layer.js`: `supportAt(...)`
- `src/terrain-layer.js`: `intersectsBody(...)`

Runtime terrain is owned by one `TerrainLayer` per built room. `src/main.js`
creates the layer before district geometry emits terrain, attaches
`layer.group` to `roomGroup`, and disposes the layer before rebuilding the
room. District geometry no longer constructs terrain meshes or registers
terrain colliders directly; it submits island and bridge stamps to the layer.

The layer keeps the current split explicit:

- Terrain intent lives in district/main stamp calls.
- Voxel fields live in the layer as support/collision data.
- Visible terrain meshes live in the layer group.
- Player and enemy support/body queries ask the layer first.
- Layer disposal clears generated terrain meshes and collider records together.

For Imperial Floating Strata, the layer owns grammar routing. A caller can
submit `rockGrammar: 'imperial_floating_strata'`; the layer builds the
imperial-specific voxel field, keeps support/collision tied to that field, and
uses the current sedimentary contour shell for visible output. This is no
longer a metadata-only hook.

This is the first architectural boundary for moving toward a Driftfield-style
terrain pipeline: current terrain pieces have one room-level owner and a single
query surface instead of scattered per-island mesh/collider registration.

### Voxel Support And Collision Queries

Primary functions:

- `src/island-geometry.js`: `queryVoxelTopY(...)`
- `src/island-geometry.js`: `queryVoxelIntersectsPrism(...)`
- `src/terrain-layer.js`: `supportAt(...)`
- `src/terrain-layer.js`: `intersectsBody(...)`
- `src/main.js`: `registerVoxelSupportCollider(...)`
- `src/main.js`: `findVoxelSupport(...)`
- `src/main.js`: `voxelBodyBlockedAt(...)`

Visible sedimentary meshes are paired with voxel fields owned by
`TerrainLayer`. Player and enemy support queries use the same field as the
rendered island or bridge, which keeps visual terrain and traversal truth
aligned. The older `registerVoxelSupportCollider(...)` path remains for legacy
surfaces that have not moved into the layer.

Current runtime use:

- `addIslandArtBridge(...)` and `addDistrictIslandMasses(...)` submit terrain
  stamps to `TerrainLayer`, which stores the voxel support collider internally.
- `resolveSupportHeight(...)`, `findEnemySupport(...)`, `playerBlockedInBand(...)`,
  and `enemyBodyBlockedAt(...)` query `TerrainLayer` before legacy voxel/mesh
  support arrays.
- `findVoxelSupport(...)` and `voxelBodyBlockedAt(...)` participate in enemy
  and player support/blocking checks for legacy callers.

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
