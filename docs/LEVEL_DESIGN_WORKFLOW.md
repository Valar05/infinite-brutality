# Infinite Brutality Level Design Workflow

Use this note for level-design, generator, and screenshot-critique work specific to Infinite Brutality.

Current qualitative source of truth: `docs/LEVEL_DESIGN_BIBLE.md`.

Current authoritative realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`.

Current terrain shape contract: `docs/ROCK_SHAPE_GRAMMAR.md`.

General workflow lives in Thunder at `../thunder-brainstorm/generated/skills/level_design_environment_grammar.md`. This local note is the tailored version for the suspended shanty-settlement over the abyss.

## Environment Thesis

Infinite Brutality should read as one broken settlement-machine, not a stack of disconnected combat rooms.

The settlement exists to keep itself suspended and alive. It harvests salvage, bodies, heat, and value from below. Architecture should follow that job.

## World Structure

Prefer a seeded vertical district graph over a giant flat open world.

Phone-safe target:

- `3 to 5` districts per run
- each district bigger than a room and physically contiguous
- `2 to 4` exits per district
- loops, return paths, and visible neighboring districts
- full geometry only for current and adjacent districts when streaming becomes necessary

Replayability should come from district order, route bundles, state changes, and special-case grammars, not random prop scatter.

## District Rules

Every district should answer:

- What is its job in the settlement?
- What circulation route does that create?
- What maintenance or under-route exists beside it?
- What visible landmark tells the player where they are?
- What can change state here?

Current archetype direction:

- intake and toll bridges
- hanging market or scaffold ward
- liftworks or winch towers
- corpsefire kilns or furnace tier
- refuse underworks or waste chutes
- shrine rim or abyss chapel

## Rock Shape Grammar

The terrain layer should read as fragments of a broken continent, not asteroids or procedural blobs. Every floating island or rock mass needs an implied shaping force before it is accepted.

Use `docs/ROCK_SHAPE_GRAMMAR.md` as the local contract for rock generation. The short version:

- name the macro silhouette first: mesa, cliff, slab, pillar, arch, bridge fragment, fortress foundation, canyon wall, or broken stair mass
- choose the geological process: sediment, erosion, fracture, collapse, volcanic cooling, shearing, impact, gravity, water flow, or ancient construction damage
- preserve a macro/meso/micro hierarchy: far silhouette, playable traversal shape, then close surface detail
- prefer sedimentary mesas, canyon walls, basalt columns, hoodoos, and fractured fortress fragments over smooth lumpy forms
- fuse architecture into terrain as swallowed or torn-out history, not decoration placed on top
- reject any chunk that cannot answer where the player stands, moves next, fights, recovers, or reads a landmark

This does not replace the Hanging Gardens settlement grammar. It gives the terrain underneath and around that settlement a geological logic so future variants can mix human-worked architecture with believable broken landforms.

Screenshot-driven correction from build `0.8.171`: when old lumpy rocks persist, audit every active terrain render path, not only the named island generator. District connector bridges were still using the legacy rock-bridge field after the island anchors had moved to sedimentary mesas. Active terrain acceptance now requires both islands and connector bridges to use sedimentary grammar metadata and continuous surface meshes, with the old lumpy bridge generator reserved for explicit legacy calls.

Screenshot-driven correction from build `0.8.172`: correct geometry can still read wrong if sedimentary terrain shares the architecture material. The first sedimentary surface pass used `MAT.stone`/`MAT.stone2`, so the islands inherited the old vector wall/floor tile and looked like tiled blocks instead of rock strata. Sedimentary terrain now needs its own texture/material lane, sourced from a height-map-first sedimentary texture set, while architecture keeps the vector stone family.

Mesh correction from build `0.8.173`: surface-net extraction is useful for organic rocks, but it rounds sedimentary mesas back toward blob language and costs extra triangles. Active sedimentary terrain now uses a dedicated layered slab mesh extractor: top/bottom faces and boundary/riser faces are generated from the same voxel field used for collision, so the visual read is flatter, more sheared, and cheaper while support queries remain unchanged.

Mesh correction from build `0.8.174`: the first layered slab rewrite produced broken sandstone even though the older blob-era integrity harness still passed, because the harness only tested legacy surface-net meshes. Active sedimentary terrain now emits literal exposed voxel faces from the same collision field, runs iterative diagonal-gap cleanup to remove edge-only voxel contacts, and `tools/test_island_mesh_integrity_contract.mjs` checks the actual sedimentary island and bridge mesh paths for watertightness, manifold edges, and outward normal winding.

Mesh correction from build `0.8.175`: a manifold exposed-voxel repair still read as kitbashed cubes because every visible sandstone vertex sat on the voxel grid. The weathering pass now applies deterministic, shared-vertex sediment shear and erosion offsets to the visual mesh only, preserving voxel collision and manifold tests while `tools/test_rock_grammar_contract.mjs` requires the active sedimentary mesh to move most vertices off the exact cube grid.

## Route Rule

Generate route bundles instead of isolated arenas.

Treat exposed walkways as touch-first surfaces:

- give the walkable surface about 50% more width than a thin visual bridge
- add worn or missing handrails with visible gaps on exposed ledges
- if a route feels like a handrail instead of a path, widen the path before adding more decoration

Each bundle should try to include:

- official circulation path
- recovery path
- maintenance path
- shortcut, secret, or return path

Combat should ride on top of these paths instead of replacing them.

## Vertical Readability Rule

This project already hit a specific failure mode: high/low spaces that technically had elevation but read as haphazard floating wall slabs.

A second failure mode is now confirmed: a mostly planar district graph with room-level vertical garnish still reads as a flat map. Macro verticality has to live in district placement and spine generation, not only in room interiors.

For `descent`, `high_low`, `climb`, or `switchback` spaces, force explicit reads:

- upper run
- visible drop lip
- lower terrace
- side stair tower or stair line
- visible support columns or buttresses
- a cut void or reveal between elevations

Do not let these spaces inherit generic vertical clutter used for hubs or ambient overlays.

## Screenshot Critique Checklist

When the user sends a screenshot, check:

- main route readability within one second
- upper/lower relationship readability
- whether supports explain suspended pieces
- whether the space reads like one place instead of random blockers
- whether district purpose is visible in the geometry

Prefer targeted generator corrections over broad style churn.

## Implementation Bias

Make bounded structural passes first:

- district schema
- district order generation
- route bundle generation
- special-case descent/climb grammars
- stateful gates, lifts, cranes, or chutes
- status/readout that exposes district identity

Avoid trying to solve giant-world streaming, final art pass, and all authored exceptions in one move.

## Maintenance Loop

This note should be updated as the workflow is used.

After a meaningful Infinite Brutality level-design pass, record:

- the concrete failure mode
- the generator or geometry correction
- the screenshot or validation check that proved it
- whether the lesson should also be promoted into the general Thunder note

Do this as part of the same task when the lesson is durable.
