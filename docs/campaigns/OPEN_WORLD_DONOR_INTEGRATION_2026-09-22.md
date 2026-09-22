# Infinite Brutality Open-World Donor Integration Inventory

Date: 2026-09-22
Authoritative target base: `9a822037ff64dbfa343878f8a3475e328f57743d`
Work branch: `fortress/open-world-intake-20260922`
Protected pre-integration branch: `fortress/pre-open-world-20260922`

## Mission boundary

Move Infinite Brutality away from a room-batch/boxed level authority toward a continuous open-world style generator without replacing its proven JS/Three.js terrain, district intent, physics, collision, or validation systems wholesale.

This document is inventory and integration order only. No donor runtime code is integrated by this commit.

## Target truth

Infinite Brutality already has more than boxes:

- `src/district-intent-planner.js` provides semantic district purpose, assemblies, logistics, skyline, traversal, and validation.
- `src/terrain-layer.js` owns runtime terrain meshes, voxel fields, bridges, collision registration, and physics handoff.
- `src/island-geometry.js` already provides voxel/surface-net terrain primitives and sedimentary/floating strata grammar.
- `src/district-geometry.js` binds semantic district plans into visible/collidable architecture.
- `src/main.js` still treats `GENERATED_ROOM_BATCH`, room indices, `buildRoom()`, and room-batch offsets as major layout authority. This is the seam to retire, not the entire terrain stack.

## Donor inventory

### Driftfield
Pinned: `dba8871da2745d5eb045d3373960a3f2fcadc3d2`

Role: PRIMARY TOPOLOGY / SEMANTIC ROUTE DONOR.

Useful pieces:
- `ASTEROID_MINE_GRAMMAR.md`: natural body first, circulation second, industrial graft third, game route fourth.
- `src/expedition-layout.js`: seeded semantic spaces, explicit graph, branch/loop routes, organic connector paths, orthogonal paths only where purpose calls for them.
- `src/expedition-mine-patterns.js`: pattern metadata bridging purpose, carve, architecture, materials, hazards, signposting, placement rules.
- `src/expedition-generator.js`: clean separation of layout, scalar-field realization, nav volumes, props, hazards, pickups and runtime output.

Do not transplant its root app. It collides with Infinite Brutality at `index.html`, `src/main.js`, `src/styles.css`, shared project metadata and several assets.

### Armorture
Pinned: `e6540dd781c8ebbf03117e0b0d3f28ced9caab11`

Role: SCALAR-FIELD / CAVERN CARVING DONOR.

Useful pieces:
- Windowed organic room density instead of unioned boxes.
- Noise-shaped tunnel radius.
- Surface guard and controlled portals.
- Room-center spacing.
- MST plus extra loop edges as a proven graph fallback.
- Chunk-addressed marching-cubes mesh generation with asynchronous rebuild.

Boundary:
- Godot/GDScript, not directly importable into the JS/Three runtime.
- Fixed chunk dimensions are not true distance-based streaming.
- Its graph generation must not become a second competing topology authority once Driftfield-style planning is adopted.

Port field primitives and lifecycle lessons only.

### Ruined Air
Pinned: `ff5e4b074c7756f124d1fd918fbfaece69050b80`

Role: FLOATING TERRAIN SILHOUETTE / CHUNK LIFECYCLE DONOR.

Useful pieces:
- Inverted-cone floating masses.
- Noisy top plateaus, taper, edge crumble and small-rock scatter.
- Noisy bridge capsules.
- Asynchronous world/chunk build and chunk-ready signaling.
- Collision-enabled voxel chunks.

Boundary:
- Godot/GDScript, not directly importable.
- Its `world_generator.gd` differs substantially from Armorture, so it is not a duplicate.
- Fixed chunk dimensions are not open-world streaming.

Port silhouette formulas and lifecycle concepts into existing `island-geometry.js` / `terrain-layer.js`.

### Pose Lab V2
Pinned: `39ede09e7d27dee142f087ba8f6c57b5ba9ca9d4`

Role: CHARACTER / ANIMATION ASSET DONOR, NOT WORLD GENERATION.

Contains the accepted current ARIES/FPSPlayer material assets, Vanguard 2D animation review assets, pose/saber authoring and associated provenance.

Defer until terrain/topology is stable. Do not import its root `index.html`, `src/main.js`, `src/styles.css`, or duplicate Three.js vendor tree.

### Fatal Vow Exception
Pinned: `7f8c8742db78f4f29635e6c131be607f89a8a866`

Role: TERRAIN-STATE + POSE-GRAMMAR REFERENCE, LATER PHASE.

Useful pieces:
- Engine-neutral append-only terrain scar authority and dirty-remesh concepts.
- Pose atom/contact atom/transition/score grammar.
- First-person weapon/hand carrier evidence.

Do not mix its terrain-edit authority into initial open-world generation. First make traversal generation coherent, then consider mutable terrain as a separate capability.

### Taste Trap Material Lab
Pinned: `ccaedc7e15ad69e36ae0ca4ee873d8e5e3bc43db`

Role: FPSPLAYER MATERIAL/VIEWER DONOR ONLY.

Contains:
- `FPSPlayer.glb`
- basecolor / metallic / normal / roughness maps
- phone-first Three.js inspection surface
- `tools/generate-mars-material.py`

Critical exclusion: this repository is NOT the Taste Trap truck/game runtime and must not be treated as the vehicle donor. Most of its root/vendor paths collide with Infinite Brutality.

### Thunder Brainstorm
Pinned: `a994b06716869bc7b313ee7e965f0c21d756b7d4`

Role: DOCTRINE / ARCHAEOLOGY / PATTERN SOURCE, NOT RUNTIME IMPORT.

It carries vehicle patterns, Taste Trap lineage notes, Ruined Air lineage, Driftfield archaeology and prior design lessons. Use these as constraints and provenance when implementing later vehicle/open-world work.

Critical exclusion: the separately remembered unnamed Mars game still has no trustworthy recovered repo identity. Do not substitute Thunder doctrine or Taste Trap Material Lab for that missing project.

## Collision assessment

Exact-path overlap against Infinite Brutality base:

- Pose Lab V2: 13 overlaps, 271 unique paths.
- Driftfield: 12 overlaps, 84 unique paths.
- Armorture: 2 overlaps, 71 unique paths.
- Fatal Vow Exception: 2 overlaps, 100 unique paths.
- Ruined Air: 3 overlaps, 106 unique paths.
- Taste Trap Material Lab: 14 overlaps, 9 unique paths.
- Thunder Brainstorm: 2 overlaps, 288 unique paths.

High-risk collision families are root `index.html`, `src/main.js`, `src/styles.css`, project metadata, and duplicate Three.js vendor trees. Therefore the integration strategy is selective ports under Infinite Brutality ownership, never repository-root overlays.

## Locked integration order

1. **Topology authority**
   - Keep Infinite Brutality district intent profiles.
   - Port Driftfield's semantic graph/route concepts into a new open-world plan layer or the existing district plan.
   - Replace `GENERATED_ROOM_BATCH` as spatial authority with seeded nodes + edges + route roles.
   - Keep legacy room specs only as archetype/content inputs during migration.

2. **Continuous carve primitives**
   - Port Armorture's windowed density, room separation, noisy tunnel radius, surface guard and portal concepts into Infinite Brutality's existing JS voxel/surface-net field.
   - The open-world plan owns topology. Armorture formulas realize that topology; they do not generate a competing graph.

3. **Floating-world silhouette**
   - Port Ruined Air's tapered masses, noisy plateaus, edge crumble, small-rock scatter and bridge wobble as optional rock grammars in `island-geometry.js`.
   - Preserve the current sedimentary / imperial grammar rather than replacing it.

4. **Chunk lifecycle**
   - Make terrain addressable by world chunk/cell and build/dispose chunks independently.
   - Borrow asynchronous build/readiness lessons from Armorture and Ruined Air.
   - Add actual player-centered load/unload policy in JS. Do not claim either donor already provides this; neither does.

5. **Runtime wiring migration**
   - Rewire `main.js` away from room index + batch offsets toward world position + active cells/districts.
   - Preserve `terrain-layer.js`, physics handoff, support queries, nav validation and collision truth.
   - Keep legacy room-batch mode as a temporary regression fixture until the open-world path passes equivalent traversal/collision tests.

6. **World-first validation**
   - Deterministic seed replay.
   - Guaranteed connected main route plus at least one meaningful loop/branch.
   - No visible-but-nontraversable openings unless visibly sealed.
   - Terrain visual/collision agreement.
   - Spawn/support validity.
   - Representative mobile performance and chunk churn checks.

7. **Deferred donors**
   - Pose Lab V2 and Fatal Vow animation/weapon systems after world topology is stable.
   - Taste Trap Material Lab only when FPSPlayer material work resumes.
   - Thunder vehicle doctrine when a commissioned vehicle phase begins.
   - Missing Mars repo remains unresolved and excluded until positively identified.

## Chunk 3 entry condition

Chunk 3 may begin only from this protected integration branch and should implement steps 1-3 as one bounded world-generation slice before touching vehicle behavior, animation imports, material polish, or the truck.
