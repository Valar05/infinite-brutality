# Inside-Out Voxel Mass Plan

## Goal

Add a new Infinite Brutality district mass that reads like a floating hollow ruin: a solid exterior body with playable void carved inside it. The target is not a stitched box-room cluster. It is an inside-out cave mass with architectural cuts, hanging walkways, skull-gate thresholds, crystal growth, and selective recovery climbs.

This plan is guided by two sources:

- `ruined_air`: useful for the old-school voxel-blob mass logic, especially noisy inverted room solids and bridge solids.
- `driftfield` Expedition: useful for the newer cave-first field discipline, authored layout-to-field coupling, and traversal-truth constraints.

## What To Extract

### From Ruined Air

Use these ideas:

- Inverted room solids with noisy tops rather than flat boxes.
- MST-connected room-center graph plus a few extra edges.
- Bridge/capsule solids between masses.
- Chunked scalar-field sampling as a cheap, controllable authoring surface.

Evidence:

- `ruined_air/scripts/world_generator.gd:15-72` defines inverted-cone room, bridge, and small-rock controls.
- `ruined_air/scripts/world_generator.gd:181-295` composes density from room masses, bridge masses, and small-rock fields.
- `ruined_air/scripts/world_generator.gd:337-350` builds a room-center graph with MST plus extra edges.
- `ruined_air/scripts/world_generator.gd:436-486` spawns chunk builders asynchronously.
- `ruined_air/scripts/voxel_chunk.gd:1-239` turns the scalar field into visible/collidable marching-cubes chunks.

### From Driftfield Expedition

Use these ideas:

- Author a semantic layout first, then carve the field from that layout.
- Keep the visible shell and collision truth derived from the same field.
- Use room apertures, tunnel radius rules, and bend carve rules instead of generic room boxes.
- Treat rock as enclosing truth and architecture as attached to the carved void.

Evidence:

- `driftfield/src/expedition-layout.js:17-105` builds a seeded authored room/connective segment graph.
- `driftfield/src/expedition-layout.js:120-176` turns connectors into bounded path segments with gameplay-readable radii.
- `driftfield/src/expedition-field.js:37-48` builds the shell mesh and returns collision triangles from the same field pass.
- `driftfield/src/expedition-field.js:61-123` samples the scalar field from authored rooms/connectors plus shell guard logic.
- `driftfield/src/expedition-field.js:126-204` carves ellipsoid chambers, tunnel tubes, and bend bulbs with noise.
- `driftfield/src/expedition-generator.js:42-87` wraps layout, field, nav, dressing, hazards, pickups, and enemies into one layer product.

## What Not To Use

Do **not** import Ruined Air's procedural walk cycle, glide controller, or foot-IK behavior into Infinite Brutality.

That code is solving a different game.

Explicit non-goals:

- `ruined_air/scripts/player.gd:123-180` upright reorientation, locomotion, and glide state handling.
- `ruined_air/scripts/player.gd:200-240` glide aero/boost steering path.
- `ruined_air/scenes/foot_ik_root.gd:1-16` yaw-following foot IK root behavior.

If a future Infinite Brutality leg system is needed, it should be designed for first-person melee platforming, not copied from Ruined Air flight/ground recovery logic.

## Recommended Infinite Brutality Shape

Use an authored graph plus scalar mass hybrid:

1. Author `4-7` mass-anchor chambers per district slice.
2. Treat each anchor as a solid lobe in the field, not an empty room box.
3. Carve traversable void **between** and **inside** those lobes.
4. Connect anchors with thick internal cuts, bridge throats, or suspended trench paths.
5. Attach human-made walkways, stairs, lifts, shrines, and crystal clusters to the carved void afterward.

This should read as:

- the mass came first
- the void was opened inside it
- people later occupied and reinforced the void

## Translation To Infinite Brutality

### Mass grammar

- exterior silhouette: hanging rock/limestone/bone/bronze ruin mass, legible from afar
- interior truth: carved nave, shaft, gallery, crypt throat, overlook pocket, bridge trench
- route language: suspended corridor, throat bridge, undercroft return, side shrine, vertical cut, recovery climb shelf

### Preferred carve primitives

- ellipsoid or inverted-bell chamber solids for anchor masses
- thick capsule or rounded-rect solids for bridge masses
- subtractive void carve with soft radii and limited noise
- shell guard so exterior silhouette does not puncture into fake holes

### Architectural after-pass

After the mass/void is valid:

- attach walkways to carved walls
- hang stairs from ledges or bridge throats
- inject crystal clusters as recovery shelves and seam-bridging landmarks
- place nooks at wall pockets, shrine rims, intake ledges, under-bridge ash wraps, and burial shelves

## First Implementation Slice

1. New module in Infinite Brutality for scalar mass sampling, separate from room garnish.
2. One district archetype only: a Hanging Gardens offshoot mass.
3. Use `3-4` chamber anchors and `1-2` connecting throats.
4. Emit:
   - visible low-poly shell mesh
   - collision triangles or coarse climb-support surfaces from the same carve
   - walkway anchor points on interior faces
5. Attach existing crystal and nook systems after the shell exists.

## Validation Rules

- If the visible shell shows a passage, the player can traverse it.
- The exterior mass must read as one memorable object, not room clutter.
- The carved void must have at least one strong overhead reveal and one under-route reveal.
- Walkways must feel attached to a real enclosing wall, not floating in empty space.
- The first mass should improve district silhouette before it improves route count.

## Proposed Boundary

Use Ruined Air as an extraction source for mass logic and chunk wisdom. Use Driftfield as the corrective source for authored-field discipline and traversal truth. Infinite Brutality should combine them into a lower-frequency, more architectural inside-out ruin mass rather than a raw voxel tech demo.
