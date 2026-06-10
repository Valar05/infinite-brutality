# Infinite Brutality Vertical District Realization Plan

Date: 2026-06-09

This is the current authoritative plan for realizing the suspended shanty-settlement vision. It supersedes the assumption that a mostly flat district graph plus room-level vertical garnish will be enough.

## Problem Statement

Recent screenshots exposed a disconnect between the design target and the current runtime output.

Current failure mode:

- routes still read as blocked by arbitrary masses
- district chunks still read as mostly co-planar
- verticality is being added inside rooms instead of across the world spine
- architecture is being dressed after the fact instead of generated from a validated circulation path

Result:

The world does not yet read as a three-dimensional settlement suspended over an abyss. It reads as a flat map with local height tricks.

## Design Correction

Macro topology must come before room dressing.

The generator needs to build the settlement in this order:

1. `district elevation graph`
2. `critical path spine through that graph`
3. `district-local route bundles attached to the spine`
4. `support logic and landmark structures`
5. `walls, shacks, clutter, and encounter dressing`

If the macro spine is flat, room-level stairs and platforms will never produce the intended world read.

## Non-Negotiable World Rules

### 1. Districts must occupy different elevation bands

Each district belongs to a clear height band relative to the abyss:

- intake: upper-mid arrival tier
- hanging market: laterally spread stacked walkways
- liftworks: strong climb or stepped machine ascent
- furnace tier: deliberate descent into heat and processing
- refuse underworks: low maintenance and runoff band
- shrine rim: high exposed overlook or final perched crown

A run should visibly cross multiple elevation bands, not just minor Y variation.

### 2. The critical path must be visibly three-dimensional

The main run should include all of these at macro scale:

- at least one major climb district
- at least one major descent district
- at least one visible over-under relationship between occupied spaces
- at least one distant destination above or below the player
- at least one suspended crossing with obvious exposure to the abyss

### 3. Support logic must explain the settlement

Major traversable masses need visible support language:

- scaffold forests
- tower legs
- chain hangs
- buttress stacks
- lift cages
- counterweight rigs

If a chunk feels like a floating tile with walls on it, it has failed before decoration starts.

### 4. Route validation happens before dressing

The generator must validate:

- official route is traversable end-to-end
- promised recovery route exists
- local landmark can be seen from the approach
- added structures do not block the official route
- district adjacency preserves the intended climb/descent relationship

Blocked-route screenshots should be treated as topology failures, not art issues.

## Runtime Model Revision

The current model places districts by hand-authored XY footprints with a small per-room Y offset. That is not enough.

Replace it with these layers.

### Layer A: Elevation Band Plan

Generate a seeded sequence of district bands:

- `high`
- `mid`
- `low`
- `climb_transition`
- `descent_transition`
- `rim`

Each district archetype has allowed bands and preferred transitions.

Example:

- intake prefers `mid -> climb_transition`
- liftworks prefers `climb_transition -> high`
- furnace prefers `mid -> descent_transition -> low`
- shrine prefers `high` or `rim`

### Layer B: District Adjacency Graph

Generate district nodes with:

- `elevation_band`
- `absolute_elevation`
- `approach_type`
- `departure_type`
- `support_style`
- `landmark_role`

Edges should encode route type:

- stair ascent
- lift cage climb
- hanging bridge traverse
- drop-to-lower-terrace descent
- underdeck maintenance return

### Layer C: District Spine Templates

Each district gets a macro spine template that already assumes elevation behavior.

Examples:

- `liftworks_spire`: stacked landings around a vertical core
- `furnace_drop`: upper feed route, mid gantry, lower burn terrace
- `market_lattice`: lateral spread with stacked crosswalks and underdeck routes
- `refuse_sump`: descending maintenance ramps with hidden return
- `shrine_overlook`: exposed upper crown looking back across prior districts

The room batch should be fitted inside these spines, not the other way around.

### Layer D: Room Bundle Fitting

Only after macro spine placement:

- assign room specs to spine segments
- choose descent/climb/corner/hub variants to match local segment needs
- allow room-level vertical detail only when it reinforces the segment role

## Concrete Data Additions

Add these runtime concepts.

### `districtPlan`

Add:

- `districts[]`
- `mainSpineEdges[]`
- `returnEdges[]`
- `elevationBands[]`
- `landmarkViews[]`

### `district`

Add:

- `elevationBand`
- `baseElevation`
- `topElevation`
- `macroTemplateId`
- `approachType`
- `departureType`
- `supportStyle`
- `landmarkRole`
- `requiresVisibleBelow`
- `requiresVisibleAbove`

### `spineSegment`

New object:

- `districtId`
- `segmentId`
- `fromAnchor`
- `toAnchor`
- `routeType`
- `entryElevation`
- `exitElevation`
- `isCritical`
- `supportsRequired`

## Generation Order

### Phase 1: Macro 3D Spine

Implement first.

- Replace the current mostly planar `DISTRICT_WORLD_LAYOUTS` approach.
- Generate district elevations from seeded band rules.
- Generate district origins from a stacked 3D adjacency model.
- Build a guaranteed traversable main spine with meaningful elevation deltas.
- Keep current room internals mostly simple while proving the macro read.

Success condition:

- screenshots clearly show one district above or below another
- the player can name where the climb and descent are happening
- the world no longer reads as a flat map

### Phase 2: District Macro Templates

- Add archetype-specific spine templates.
- Fit district-local room offsets to those templates.
- Stop using the same local layout families for every archetype.

Success condition:

- liftworks, furnace, market, and refuse each have distinct silhouette and route behavior

### Phase 3: Route Validation Before Dressing

- Validate critical path and recovery path before architecture pass
- mark blockers or impossible transitions as generation failures
- regenerate segment or district placement on failure

Success condition:

- no screenshot should show the official route visually blocked by decorative masses

### Phase 4: Support Logic And Overlook Reads

- add support towers, chain hangs, scaffold forests, buttresses, and underdecks based on segment type
- add forced overlook moments where the player sees prior or future districts above/below

Success condition:

- architecture reads as a settlement machine rather than abstract combat tiles

### Phase 5: Stateful District Systems

- lifts, gates, cranes, chutes, burn channels
- route changes that affect traversal and revisits

Success condition:

- replayability comes from topology plus state, not only shuffled order

## Architectural Skeleton Follow-Through

The vertical reset is necessary, but it is still not enough if districts keep being built as route scaffolds with decorative walls.

The next correction is:

- macro topology must be three-dimensional
- district skeletons must be inspired by real building families
- patchwork should be layered over those skeletons rather than replacing them

### District skeleton requirements

Every district should answer these questions before room fitting:

- what real building type is this chunk descended from?
- what is its dominant massing logic?
- where does circulation naturally want to run through it?
- what support language keeps it believable over the abyss?
- what salvage or adaptation layer explains its present broken state?

### Recommended source families

Use real-world source families as structural seeds:

- cliff monastery
- medina / kasbah
- furnace works / foundry
- hill fort / citadel
- stilt wharf settlement
- necropolis / tomb quarter
- collapsed aqueduct / bath complex

The district generator should reduce these to massing and circulation rules, not decorative imitation.

### Hanging Market as the proof district

The first conversion should be `Hanging Market` using a `medina + wharf` hybrid.

Implementation checklist:

1. generate `4` major masses before any room fitting
2. generate `3` stacked circulation bands
3. force a visible underdeck support forest
4. place one landmark crosswalk cluster visible from approach
5. fit existing room bundles only into structural roles, not free offsets
6. add patchwork bridges, braces, and scaffold infill only after the massing works
7. validate one upper route, one lower route, one exposed crossing, and one over-under read

Success condition:

- the district screenshot reads as a salvaged vertical market settlement made from old architecture, not a flat combat layout with extra platforms


### Acceptance checklist for the first screenshot pass

The `Hanging Market` conversion should not be considered successful until a screenshot proves all of these at once:

- one dominant upper crosswalk or roof route
- one visible lower underdeck or return route
- one strong support forest or hanging support language
- one landmark bridge cluster that is visible before arrival
- one readable over-under condition inside the district
- no primary play space that reads as a free-standing generic slab

If these are not simultaneously visible, the problem is still skeleton generation, not prop density.

### Build order for the proof district

1. generate the large masses
2. carve the voids between them
3. place support systems underneath
4. place the three circulation bands
5. fit room bundles onto those bands
6. add patchwork adaptation pieces
7. only then add local dressing

This order should be treated as a hard rule for the proof district.

## Immediate Implementation Slice

Do next, not a geometry polish pass.

1. Replace district placement with seeded elevation-band generation.
2. Give each district a `baseElevation` and a stronger vertical delta budget.
3. Build one explicit 3D spine edge type for climbs and one for descents.
4. Force at least one district-to-district over-under relationship per run.
5. Strip back decorative blockers in spine-adjacent rooms until route validation exists.

## Explicit Non-Goals For The Next Slice

- no full streaming rewrite yet
- no giant authored overworld
- no large encounter redesign
- no clutter-heavy art pass
- no additional local room complexity unless it supports the macro spine

## Why This Is The Right Reset

The current build already proved that changing room details without changing macro topology does not realize the vision.

The next meaningful improvement has to happen at the settlement-graph layer. If that layer becomes truly three-dimensional, later room and art passes will reinforce the vision instead of fighting it.
