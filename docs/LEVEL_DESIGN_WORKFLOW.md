# Infinite Brutality Level Design Workflow

Use this note for level-design, generator, and screenshot-critique work specific to Infinite Brutality.

Current authoritative realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`.

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
