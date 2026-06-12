# Infinite Brutality District Runtime Contract

Date: 2026-06-10

This note is the authoritative technical contract for how district generation, room fitting, support snapping, structural geometry, and enemy traversal are supposed to interact at runtime.

Use this note when changing:

- district archetype schema
- district skeleton generation
- room placement and offsets
- support snapping
- player or enemy spawn placement
- connector generation
- enemy route building

If a change crosses any of those boundaries, update this note.

## Purpose

The district system is no longer just a room-order reshuffle.

Current policy:

- the runtime defaults to a single architectural family per run
- the current family is `hanging_gardens`
- district roles may differ, but they should not read like separate unrelated biomes while the proof pass is active

The runtime now has multiple interacting geometry and navigation layers:

1. district plan generation
2. district skeleton generation
3. room bundle fitting
4. connector generation
5. support snapping
6. enemy route validation and traversal

Recent regressions showed that these layers can interfere with each other if the order or ownership rules are vague.

This document exists to make those ownership rules explicit.

## Authoritative Build Order

Build the world in this order:

1. `districtPlan`
   - choose district archetypes
   - choose district order
   - assign elevation bands
   - assign macro template ids

2. `district skeleton metadata`
   - assign source-architecture fields
   - assign skeleton type
   - generate mass anchors
   - generate circulation bands
   - generate landmark anchor
   - generate structural room offsets or segment roles

3. `room bundle fitting`
   - fit room specs into district-local offsets or segment roles
   - build room-local geometry
   - build room-local sockets, spawn, exit, and enemy anchors

4. `world connectors`
   - connect room exits, entries, and branch sockets
   - add stairs, bridges, or route segments between rooms

5. `district structural geometry`
   - add major district masses
   - add supports, underdecks, landmark bridges, and skeleton-only structure

6. `connectivity repair and validation`
   - validate traversability
   - add bounded repair connectors if needed

7. `spawn finalization`
   - snap player spawn
   - snap exit
   - sanitize enemy spawn positions

8. `combat/runtime activation`
   - spawn enemy
   - route graph active
   - attack logic active

Important:

- District skeleton metadata must exist before room fitting.
- District story-placement metadata must exist before nook/evidence placement, even if readable text surfaces are deferred.
- District skeleton geometry must not be allowed to silently invalidate room anchors.
- Spawn sanitization is the final defensive layer, not the primary layout tool.

## Runtime Data Model

### `districtPlan`

Current required fields:

- `seed`
- `districts[]`
- `roomToDistrict[]`
- `mainSpineEdges[]`
- `returnEdges[]`
- `landmarkViews[]`

### `district`

Current runtime district objects may include:

- `id`
- `archetype`
- `name`
- `purpose`
- `signal`
- `roomStart`
- `roomCount`
- `origin`
- `baseElevation`
- `topElevation`
- `elevationBand`
- `macroTemplateId`
- `approachType`
- `departureType`
- `supportStyle`
- `landmarkRole`
- `requiresVisibleBelow`
- `requiresVisibleAbove`
- `layoutId`
- `layoutPoints`
- `branchPairs`
- `preferredRoles`

Skeleton-first extension fields:

- `realSourceA`
- `realSourceB`
- `skeletonType`
- `patchStyle`
- `silhouetteRule`
- `roomOffsets`
- `segmentRoles`
- `circulationBands`
- `massAnchors`
- `landmarkAnchor`
- `familyNameSet`

Current expectation:

- when the default family override is active, every district should inherit the same source-architecture family fields unless a deliberate later feature reintroduces controlled family changes

### `roomState.plan`

This is the debug-facing and persistence-facing projection of the generated district plan.

It should expose enough district metadata to diagnose:

- what district the player is in
- what skeleton the district is using
- what local segment role the current room is serving

## Geometry Layer Ownership

### Layer 1: room-local geometry

Includes:

- room floors
- room walls
- in-room stairs
- in-room vertical shelves
- in-room enemy anchors
- sockets
- room spawn and exit anchors

This layer owns the initial semantic anchors for play.

### Layer 2: connector geometry

Includes:

- room-to-room stairs
- room-to-room bridges
- branch connectors
- repair connectors

This layer owns inter-room traversal continuity.

### Layer 3: district structural geometry

Includes:

- major masses
- underdeck platforms
- support forests
- landmark bridge clusters
- district silhouette pieces

This layer owns district readability and architecture.

This layer does not own original room semantic anchors.

If this layer invalidates a room anchor, that must be treated as a layout bug or a required post-pass adjustment, not as acceptable incidental overlap.

## Spawn And Anchor Rules

### Player spawn

Player spawn comes from the selected room build, then is snapped to support.

Rules:

- it must land on a valid walkable surface
- it must not be inside district structural solids
- it must preserve the room’s intended entry read

### Exit anchor

Exit anchor comes from the selected room build, then is snapped to support.

Rules:

- it must remain reachable by the intended route
- it must not be blocked by decorative or structural district masses

### Enemy spawn

Enemy spawn comes from the selected room build first.

Then:

1. snap to support
2. sanitize against current solids
3. verify capsule clearance
4. only then call `positionEnemy(...)`

Enemy spawn must satisfy all of these:

- valid floor support
- no body overlap with solids
- enough local clearance to animate and move
- not beneath a district mass unless intentionally authored

### Critical invariant

District structural geometry must not place a solid on top of the initial enemy anchor unless the spawn resolver deliberately relocates the enemy to a new legal point.

## Support Snapping Contract

Room and traversal systems use these support concepts:

- `walkableSurfaces`
- `solidColliders`
- `climbSurfaces`
- `findEnemySupport(...)`
- `findEnemyCapsuleSupport(...)`
- `resolveEnemySpawnPoint(...)`

Rules:

- support snap chooses legal floor support
- climb attach may use `climbSurfaces` for normals-based recovery faces even when collision remains coarse
- body clearance must be checked separately from floor support
- a valid top surface is not enough if the enemy capsule intersects a nearby mass

Support snap is not allowed to “solve” a bad district overlap by burying the actor into partial geometry.

## Enemy Traversal Contract

Enemy movement has separate ownership layers:

1. `district/room graph routing`
2. `local support-aware movement`
3. `jump traversal`
4. `combat engagement`

Rules:

- graph traversal owns long-distance route choice
- local support movement owns ground-valid stepping
- jump owns explicit traversal segments
- combat only begins after traversal no longer owns the frame

### Enemy animation contract

Enemy behavior depends on both:

- valid spawn placement
- active mixer/action updates

At minimum:

- `enemyMixer` must update every frame while the enemy is active
- `idle` must exist as a safe fallback action
- if current enemy action is null after spawn, idle should be re-seeded explicitly

T-pose plus non-reactive enemy should be treated as one of:

- mixer update missing
- action registration failed
- enemy never entered a valid active state
- spawn overlap preventing visible movement read

## Validation Stages

### Stage 1: topology validation

Check:

- room-to-room continuity
- branch continuity
- recovery path existence
- district-to-district macro continuity

### Stage 2: architectural readability validation

Check:

- silhouette read
- visible support logic
- over-under relation
- landmark visibility
- no flat generic pad read

### Stage 3: spawn validation

Check:

- player spawn legal
- exit legal
- enemy spawn legal
- no district structural overlap on core anchors

### Stage 4: runtime behavior validation

Check:

- enemy animates
- enemy reacts
- traversal graph still works
- district skeleton does not obstruct core play starts

## Known Failure Modes

### 1. District skeleton built too early

Symptom:

- new masses affect room anchor snapping unexpectedly
- enemy or player spawn ends up inside or under a district mass

Fix:

- build room bundles first
- add district structural geometry after room anchor generation
- then sanitize spawns

### 2. District mass overlaps first-room corridor

Symptom:

- enemy half inside block
- player start cluttered
- start-of-room readability broken

Fix:

- move or resize the district mass
- do not rely only on spawn relocation

### 3. Valid floor, invalid body clearance

Symptom:

- actor appears on the ground but clipped by a nearby block

Fix:

- require capsule clearance after support resolution

### 4. T-pose and non-reactive enemy

Symptom:

- enemy visible
- not animating
- not entering ordinary reactive behavior

Fix:

- confirm mixer update exists
- confirm idle action is registered
- confirm current action is re-seeded if missing
- then inspect spawn overlap

## Rules For Future District Conversions

When converting a new district skeleton:

1. add schema only for that district
2. add metadata generator
3. add structural room offsets or segment roles
4. add district structural geometry after room bundle creation
5. validate screenshot readability
6. validate enemy spawn and traversal
7. only then copy the pattern to the next district

Do not convert multiple districts at once until the runtime contract holds for one proof district.

`storyNookPlacements` is the resolved runtime placement plan: packet IDs, cluster IDs, target roles, and world positions chosen from district anchors and segment roles before any later prose or prop rendering.

District crystal growths may also be derived from the same segment-role basis at runtime. They are allowed to add cheap recovery shelves and `climbSurfaces`, but they must stay offset from the main route and must not replace the canonical room bundle or district spine.
