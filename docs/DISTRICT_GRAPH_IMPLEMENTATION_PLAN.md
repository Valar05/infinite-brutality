# Infinite Brutality District Graph Implementation Plan

Date: 2026-06-09

Status: first slice implemented in `src/main.js` as of build `0.8.30`. The runtime now builds a room-traversal graph from room sockets and route kinds, then uses that graph for district-spine route selection and enemy pursuit routing.

## Goal

Replace the current fixed chapter/room mental model with a seeded district graph that feels like a suspended shanty settlement over an abyss.

The world should still be legible on phone:

- One continuous physical run.
- Local route choice and revisitable shortcuts.
- New district combinations, silhouettes, and paths on replay.
- No giant fake open world that overwhelms rendering, readability, or touch navigation.

## Constraints

- Keep the existing generated room/spec corpus as the first production asset base.
- Preserve phone-first movement and route readability.
- Preserve the current compact measured room grammar inside larger structures.
- Avoid a full streaming rewrite in the first pass.
- Keep the runtime deterministic from the existing seeded level index.

## Target Runtime Model

The generator should operate on four layers.

1. `district archetype`
   - Purpose-driven environment type such as intake, scaffold market, furnace lifts, refuse underworks, shrine rim.
   - Defines preferred room roles, branch budget, vertical bias, landmark language, and light grammar.

2. `district instance`
   - A seeded runtime district picked for the run.
   - Has a name, purpose, room-count budget, local layout template, and branch-link policy.

3. `district graph`
   - A small world graph of connected districts.
   - Critical path remains readable.
   - Each district can have shortcuts, optional side routes, and one or more return links.

4. `room/blockout`
   - Existing room specs remain the short-term building blocks.
   - Rooms become route bundles inside a district, not the top-level world structure.

## Data Model

Short-term runtime objects:

- `districtPlan`
  - `seed`
  - `districts[]`
  - `roomToDistrict[]`
  - `branchLinks[]`
  - `bounds`

- `district`
  - `id`
  - `archetype`
  - `name`
  - `purpose`
  - `signal`
  - `origin`
  - `roomStart`
  - `roomCount`
  - `layoutId`
  - `branchPairs`
  - `preferredRoles`

- `districtState`
  - reserved for later systems such as powered lifts, opened tolls, fire spread, moved cranes, or unlocked refuse chutes.

## Phase Plan

### Phase 1: District Skeleton Schema

Implement first.

- Extend district archetypes with architectural-source fields instead of only purpose/layout fields.
- Add runtime district fields for:
  - `skeletonType`
  - `massPattern`
  - `circulationPattern`
  - `supportStyle`
  - `patchStyle`
  - `landmarkType`
  - `silhouetteRule`
  - `verticalProfile`
- Keep the existing room/spec corpus, but stop treating it as the top-level world shape.

Success condition:

- the generator can describe what a district is architecturally before it places local routes

### Phase 2: Architectural Skeleton Generation

- Generate `3 to 6` primary masses per district before room fitting.
- Generate explicit `voids`, `support zones`, and one `landmark anchor`.
- Make the blockout readable without local clutter or props.
- Ensure each district has one dominant silhouette sentence.

Success condition:

- a no-props screenshot reads as a real place instead of combat pads plus walls

### Phase 3: Circulation Grammar Over Skeleton

- Replace generic local layout offsets with circulation segments such as:
  - `terrace_run`
  - `roof_crossing`
  - `switchback_stair`
  - `bridge_span`
  - `undercroft_return`
  - `tower_core`
- Fit room bundles onto those segment roles instead of placing them as abstract route units.

Success condition:

- route logic feels embedded in the architecture instead of laid on top of it

### Phase 4: Patchwork Adaptation Pass

- After the skeleton and circulation pass, add district-specific repair language:
  - scaffold infill
  - chained crosswalks
  - bolted catwalks
  - masonry patch walls
  - cage lifts
  - diagonal braces
- Keep patchwork subordinate to the older structural mass.

Success condition:

- the world still reads as patched and piecemeal, but the underlying structure is legible and culturally grounded

### Phase 5: District Validation And Expansion

- Validate district readability, not only traversability.
- Reject or repair districts that fail silhouette, over-under, or landmark reads.
- Expand the skeleton-first method to the remaining archetypes after one district proves out.

Success condition:

- replay variety comes from distinct architectural skeletons, not only shuffled room order

## First Executable Slice

The next production slice should prove the new architectural direction with one district, not spread a weak version across all of them.

### Target district: `Hanging Market`

Use a `medina_kasbah + stilt_wharf_settlement` hybrid.

Required blockout:

- `4` major masses
  - entry deck mass
  - central stacked market block
  - side underdeck support block
  - far landmark bridge cluster
- `3` occupiable circulation bands
  - roof / high-crosswalk band
  - market / middle band
  - underdeck / return band
- visible support forest under the main circulation
- at least one exposed suspended crossing
- at least one visible over-under relationship inside the district

Required room-role mapping:

- `roof_lane`
- `market_court`
- `bridge_landing`
- `support_stair`
- `underdeck_pass`

Validation for this slice:

- a raw screenshot reads as a stacked market settlement, not a generic combat gauntlet
- the main route is visibly embedded in the masses
- the under-route is visible and legible
- the patchwork layer reads as adaptation, not random clutter

Only after this passes should the same pipeline be copied to liftworks, shrine rim, refuse underworks, intake, and furnace.

## Runtime Touchpoints For The First Conversion

The current runtime already has the correct top-level insertion points. The first implementation pass should stay inside them instead of attempting a full generator rewrite.

### Existing symbols to extend

- `DISTRICT_MACRO_TEMPLATES`
  - add architectural-source fields here first
  - this is where `scaffolds` should become the real `Hanging Market` proof district instead of only a placement template
- `DISTRICT_ARCHETYPE_TEMPLATES`
  - keep the current mapping, but point `scaffolds` at a richer skeleton-aware template
- `generateDistrictPlan(levelIndex)`
  - add district-level skeleton metadata to the generated district records
- `batchRoomWorldOffset(index, plan)`
  - replace pure layout-point interpretation for the proof district with skeleton-segment fitting
- `buildGeneratedGauntlet(startIndex)`
  - use district skeleton masses and circulation bands before room fitting, then place rooms into those structural roles
- `buildRoom(movePlayer)`
  - expose the new district metadata in `roomState.plan` and `roomState.spec` for debugging and later validation

### New short-term runtime fields

Add these to each generated district object:

- `realSourceA`
- `realSourceB`
- `skeletonType`
- `massAnchors`
- `circulationBands`
- `segmentRoles`
- `patchStyle`
- `landmarkAnchor`
- `silhouetteRule`

These fields are enough for one proof district. Do not add a bigger generalized content schema until `Hanging Market` actually reads correctly.

## Landmark Schema And Validation Contract

For the next generator pass, every proof-district landmark should produce a minimal schema record derived from `docs/LEVEL_DESIGN_BIBLE.md`:

- `formerUse`
- `damageCause`
- `currentOccupant`
- `silhouetteFamily`
- `wonderTags[]`
- `tacticalFeatures[]`
- `combatSentence`
- `climbRoutes[]`
- `visibilityTargets[]`
- `habitationProof[]`
- `acceptanceChecks[]`

And every district should validate these categories before acceptance:

- historical read
- Hanging Gardens wonder read
- tactical read
- climb value
- visibility and pull

The first proof implementation should fail or repair `Hanging Market` if it cannot produce at least one chokepoint, one strongpoint, one kill zone, one escape route, one meaningful climb recovery path, and one visible future destination.

## Hanging Market Implementation Order

Do this in sequence.

1. Extend the `scaffolds` entry in `DISTRICT_MACRO_TEMPLATES`
   - set `realSourceA = medina_kasbah`
   - set `realSourceB = stilt_wharf_settlement`
   - add `skeletonType = hanging_market_hybrid`
   - add `patchStyle = scaffold_chain_infill`
   - add `silhouetteRule = lateral stacked market over a visible support forest`

2. Add a district-local skeleton generator for `hanging_market_hybrid`
   - output `4` major mass anchors
   - output `3` circulation bands
   - output one landmark crosswalk anchor
   - output one underdeck support zone

3. Fit the existing `layoutPoints` to structural roles instead of free space
   - high points become `roof_lane`
   - middle points become `market_court`
   - transition points become `support_stair`
   - low points become `underdeck_pass`
   - exposed connectors become `bridge_landing`

4. Only after the structural fit works, add patchwork geometry
   - chained crosswalks
   - scaffold braces
   - bolted catwalk inserts
   - infill stalls or roof bridges

5. Validate the proof district on screenshots before copying the method
   - no flat pad read
   - clear upper and lower occupiable bands
   - visible underside support depth
   - one strong landmark silhouette
   - route visibly embedded in architecture

## Explicit Anti-Scope Rules

For the first district conversion:

- do not rework enemy routing logic
- do not redesign combat spaces globally
- do not add general clutter passes to all districts
- do not try to convert all archetypes in one patch
- do not replace the room corpus

The correct first win is one district whose skeleton reads properly on screenshot.

## Explicit Non-Goals For This Slice

- No full room corpus rewrite.
- No streaming system yet.
- No world-state persistence beyond the current level/node persistence.
- No navmesh or heavyweight AI pathing rewrite.
- No fully authored overworld.

## Why This Order

This order gives the project a real environment-level generator now, without discarding the working room grammar or overcommitting to an unbounded open-world implementation too early.
