# Infinite Brutality Room Batch Implementation

Build: `0.8.30`

The 48-room junction batch is now wired into runtime as a generated playable sequence.

## Runtime Files

- `data/room_junction_batch.json`: source room prompt/spec list.
- `src/generated_room_batch.js`: generated JS module consumed by the browser runtime.
- `src/main.js`: imports `GENERATED_ROOM_BATCH`, builds the current batch room, and advances to the next room when the exit marker is reached.
- `roomState.navGraph`: room-traversal graph built from room sockets and route kinds so pursuit can follow authored links instead of only local collision guesses.

## Behavior

- The runtime starts at the persisted `roomState.nodeIndex`.
- Each room uses its own connector signature from the batch spec.
- One-connector terminal rooms spawn opposite their terminal connector and finish at the connector.
- Multi-connector rooms enter through the first connector and exit through the second; extra connectors become side branches.
- Vertical overlays (`U` / `D`) add raised exits, stairs, recovery paths, or lower recovery space.
- Reaching the exit advances through all 48 rooms, then wraps to room 1 and increments the level index.
- Enemy pursuit now walks the same district graph used by the room batch, so the agent can chain authored sockets and route kinds across rooms before falling back to local support sampling.

## Generation Rules Preserved

- Compact measured room, not a giant box.
- Route sentence first, decoration second.
- No crouch vocabulary.
- No copied Quake layouts or assets.
- Current visual language: vector stone, bronze bridge slabs, bone/skull gates, corpsefire route markers, panorama skybox.

## Morning Review Targets

- Check whether side portals visually match the declared connector signatures.
- Check 1c terminal rooms for accidental immediate exits.
- Tune bridge widths/gaps for touch movement after screenshots/playtest.
- Add per-room authored exceptions for any generated blockout that has the right topology but weak silhouette.
- Decide whether to add a debug next-room button/key for fast review.

## Build 0.8.30 Route Graph Pursuit

Build `0.8.30` adds the explicit room-traversal graph used by the district spine. The runtime now classifies room links as `flat`, `stair`, `drop`, `bridge`, `jump`, or `branch`, stores a graph on `roomState`, and rebuilds enemy routes from authored socket targets instead of trying to invent the path from collision alone.

This is the first slice of the "never quit" pursuit model. The top-level route decision is now graph-driven; the last-mile move still uses local support checks and collision validation.

## Build 0.8.29 Height-Separated District Spine

Build `0.8.29` replaces the mostly planar district placement pass with seeded elevation bands and a macro spine that intentionally climbs, drops, and climbs again across the run. Districts now carry explicit base and top elevations, approach/departure types, support styles, and landmark roles so the runtime can read the settlement as stacked over the abyss instead of just offset in X/Z.

Runtime impact for this slice:

- district plans now expose elevation bands, macro spine edges, return edges, and landmark views
- status/readout now show the current district band and base elevation
- descent rooms keep their dedicated silhouette while the spine pass moves the larger height read into district placement
- the first pass keeps the existing room batch and combat flow intact while making the world read as taller and more layered

## Build 0.8.28 Descent Silhouette Fix

Build `0.8.28` responds to screenshot feedback from the seeded district pass: some `descent` and `high_low` rooms were technically generating vertical play, but they read on screen as haphazard floating wall slabs instead of a clear upper-to-lower route.

The runtime now gives those rooms a dedicated descent layout with an upper run, visible drop lip, side stair tower, lower terrace, and a cut void between levels. The generic lower-recovery and vertical-clutter helpers are skipped for descent rooms so the silhouette stays legible at phone scale.

## Build 0.8.27 Extended Vector Surface Set

Build `0.8.27` expands the project-owned vector texture set beyond stone, bronze, and bone. The runtime now also loads deterministic SVG surfaces for iron, blood, flesh, and hazard materials, so supports, gore, organic corruption, and furnace beds stop falling back to plain tinted Lambert colors.

This keeps the art direction on the same vector-first low-poly track as the district pass. The new textures are lightweight, tileable, and directly wired into the existing material loader, with the review sheet and asset manifest updated to cover the larger surface family.

## Build 0.8.26 Seeded District Graph Slice

Build `0.8.26` stops treating the 48-room batch as four fixed 12-room chapters. The runtime now generates a seeded district plan per level from the persisted level seed, then partitions the same room corpus into four purpose-driven districts with variable room counts, archetype names, local layout templates, and local branch pairs.

This is intentionally a first slice, not the final open-world system. The current runtime still uses the existing generated room specs and one continuous physical gauntlet, but the top-level world structure is now district-first instead of chapter-first. Intake, scaffold/lift/furnace/refuse middles, and shrine-rim endings can now recombine between runs without rewriting room geometry from scratch.

Runtime impact for this slice:

- room offsets now come from district-local layout templates instead of one fixed chapter shape
- branch links are generated per district instead of per fixed chapter
- status/readout now identify the current district name and purpose
- the full settlement path remains deterministic from the current level seed and phone-safe to render in one pass


## Build 0.8.3 Physical Gauntlet Fix

A screenshot of build `0.8.1` showed the generated rooms collapsing into the same centered one-bridge room, with large side voids and visible depth fighting. The shared generator was the problem: it made every room start from a global central chasm, then layered bridge/pad surfaces over the same planes.

Build `0.8.3` changes the generated-room default to floor-first compact chambers. Rooms now get a continuous stone chamber floor, slightly raised pads/route markers, optional narrow gutter accents only when the room route calls for risk, and no global underworld void by default.

The room sequence is also now a physical gauntlet. All 48 generated rooms are built into one world layout with connector spans between adjacent room exit/spawn points. Ordinary room exits do not teleport/rebuild the next room. The only rebuild is at the final gauntlet exit, where the run wraps to room 1 and increments the level index.

Morning check: inspect the physical connector spans for wall intersections and performance; tune individual room silhouettes after confirming the no-teleport and no-z-fighting baseline.

## Build 0.8.4 Bent Gauntlet And Coplanar Trim

Build `0.8.4` keeps the 48 rooms physically contiguous but stops placing them in a single north/south line. The gauntlet now lays rooms into a six-wide snake path with row jogs, and room tracking uses nearest 2D room center instead of only z distance.

Connector and route slabs are trimmed inward from pads and raised slightly where they leave room portals. This avoids drawing connector landing plates directly on top of room pads at the same height, which was a major source of visible z-fighting after the physical-gauntlet pass.

## Build 0.8.5 Neighbor-Facing Portals

Build `0.8.5` fixes the missing-connector failure from the first bent-gauntlet pass. Rooms now choose their runtime spawn and exit connectors from the actual previous/next room direction in the snake layout, while still preserving extra room-spec connectors as side branches. This makes portals face the physical neighbor rooms instead of only following each spec's abstract connector list.

The pass also separates floor, pad, branch, and route slab top heights more aggressively. Segment ends are still trimmed, but the visible route overlays now sit on distinct raised planes instead of sharing pad or floor height.

## Build 0.8.6 Real Branch Links

Build `0.8.6` turns side connectors into real graph links instead of decorative local side pads. The snake remains the readable critical path, but adjacent non-consecutive rows now get branch spans from selected junction, hub, shortcut, secret, reward, key, and switch rooms. Branch sockets are opened during room construction, stored as world sockets, then connected with visible corpsefire-marked walkable spans.

## Build 0.8.7 Connected Socket Filter

Build `0.8.7` stops opening abstract room-spec portals unless they are actually connected to the main path or a physical branch link. This removes empty side portals caused by treating prompt topology as runtime connectivity.

The pass also trims route slabs much farther away from pads and connector intersections, removes the length padding that cancelled earlier trimming, and offsets paired route slabs onto distinct top planes. This targets the visible bronze/stone z-fighting at room-branch intersections.

## Build 0.8.8 Legible Chapter Graph

Build `0.8.8` backs out the branch-heavy mesh layout. The 48-room batch is now arranged as four readable 12-room chapters. Each chapter uses a clear bent main route and only two deliberate physical shortcut branches. This preserves branching, but avoids filling the view with unrelated portals, nearby rooms, and crossing connector spans.

## Build 0.8.9 Review Reset URL

Build `0.8.9` adds review helpers for the browser's persisted room state: `?reset=1` returns to room 1, and `?room=N` starts on a specific 1-based room. This keeps layout review from being trapped in a stale late-room localStorage position after generator changes.

## Build 0.8.10 Vertical Chapter Relief

Build `0.8.10` restores vertical route grammar to the legible chapter layout. Each 12-room chapter now includes deliberate rises and drops, so connector spans produce stairs again instead of keeping every room on one flat plane.

The stair builder was also tightened: steps are shorter, count scales with run length and height delta, and connector spans begin farther from room pads. This reduces remaining connector z-fighting at stair/landing transitions.

## Build 0.8.11 Carved Room Footprints

Build `0.8.11` replaces the single full rectangular room floor with carved chamber footprints: central islands, connector arms, corner galleries, hub balconies, and solid corner masses. The generator now changes the room silhouette before adding route markers and props, so rooms should stop reading as identical boxes with objects inside.

## Build 0.8.12 In-Room Vertical Play

Build `0.8.12` adds vertical play inside generated rooms, not only between rooms. Upper galleries, upper crossings, stair approaches, and lower recovery shelves are now generated for upper/lower rooms, hubs, corner rooms, and a regular cadence of workhorse rooms. This makes height part of each room's route sentence instead of only a connector transition.

## Build 0.8.13 Deeper Vertical Reads And Connector Cleanup

Build `0.8.13` removes the low horizontal connector lintels and low vista bars that were reading as arbitrary waist/head-height bars. Connector markers now use side posts instead of crossbars.

The chapter height profile and in-room vertical play heights are deeper, making stairs and upper/lower play areas more visible. External connector spans now begin farther outside room sockets and trim more aggressively, reducing z-fighting where world connectors meet room pads or in-room route slabs.

## Build 0.8.14 Internal Room Walls

Build `0.8.14` adds internal wall islands, divider ribs, low sight blockers, and occasional broken towers inside generated rooms. This gives rooms internal structure instead of only carved outer footprints, while preserving route gaps and sightlines to exits.

## Build 0.8.15 Corrective Architecture Pass

Build `0.8.15` backs out the incoherent freestanding internal-wall pass. Rooms now use attached architectural templates instead: upper rooms get retaining walls and supports, lower/recovery rooms get sump retaining walls, corner rooms get attached blind masses, hubs get a central anchor plus backed shrine wall, and combat rooms get attached cover.

Bridge spans are restored to more normal proportions, while duplicate connector generation is suppressed by endpoint keying. This targets the doubled-up connector issue without globally shortening every bridge.


## Build 0.8.16 Void-Defined Rooms And Stair Readability

Build `0.8.16` removes the full rectangular outer shell from generated batch rooms. Rooms are now defined by carved floor footprints, connector-only socket frames, and missing-side buttresses instead of four continuous walls plus a ceiling. This makes empty space the default boundary and prevents valid gauntlet sockets from being half-blocked by box walls.

Stair runs now use a continuous stepped causeway with tighter risers, wider treads, and a subtle base join. The climb should read as one navigable route rather than isolated horizontal bars stacked in front of the player.


## Build 0.8.17 Softened Movement Intent

Build `0.8.17` smooths the touch movement intent before it becomes acceleration, so small stick corrections and edge-mounting recoveries stop snapping the player as sharply. Jump and strike input remain immediate.

The camera now follows short grounded position snaps with a tight visual lerp, which takes the harsh edge off automatic step-up/edge mounting while preserving the actual collision position.


## Build 0.8.18 Stair Clearance And Connector Climb Routing

Build `0.8.18` stops incidental upper galleries from spawning over drop/secret/recovery stair routes. Upper floors now require an explicit upper/hub/corner route, and their footprint is narrower and farther to the side.

Room-to-room connector climbs now put the height change on the longest useful horizontal leg of the connector. This prevents aligned room connectors from generating a vertical stack of stair treads at the landing.


## Build 0.8.19 Mutant Orc Enemy Import

Build `0.8.19` imports the `Mutant Dying.zip` FBX archive as a project-owned mutant/orc enemy asset set. The runtime now loads the idle FBX as the visible enemy mesh through Three.js `FBXLoader`, registers run/walk/jump/punch/dying FBX clips on the same mixer, and keeps the primitive broken-knight enemy as a fallback if the imported asset fails to load.

The imported source archive and FBX files are tracked through Git LFS, and asset provenance is recorded in `assets/asset_manifest.json`.


## Build 0.8.20 Orc Berserker Visible Mesh

Build `0.8.20` switches the active enemy visual from the animation-only mutant FBX set to the actual Meshy Orc Berserker textured FBX mesh. The runtime now auto-fits the imported orc to a target enemy height using its bounding box, then hides the primitive broken-knight fallback only after the real mesh loads.

The mutant FBX files remain in the project as possible future animation sources, but they are not treated as a visible skinned mesh because the archive is motion-only.


## Build 0.8.21 Standing Idle Orc

Build `0.8.21` uses `/storage/emulated/0/Download/Standing Idle (4).fbx` as the active enemy model. This FBX contains geometry, `mixamorig` skeleton bones, skin deformers, bind pose, and an embedded idle animation, so it replaces the previous animation-only mutant import and the static Meshy texture FBX as the visible enemy source.

The runtime loads `assets/models/orc_berserker/standing_idle.fbx`, normalizes it to a target enemy height using its bounding box, registers the embedded idle clip if present, and hides the primitive fallback only after this rigged orc loads successfully.


## Build 0.8.22 Orc Foot Grounding

Build `0.8.22` keeps the standing-idle orc scale and facing from `0.8.21`, but applies a small local Y offset after bounding-box normalization so the visible feet sit on the runway instead of hovering above it.


## Build 0.8.23 Pressure-Ring Orc Engagement

Build `0.8.23` adds the first Gravity Fist-derived enemy pressure-ring behavior to the browser prototype. The single active orc now approaches into a ring around the player, orbits/holds that band, backs out when too close, and commits to cooldown-gated melee attacks instead of idling in place.

The build also imports `/storage/emulated/0/Download/Pro Melee Axe Pack (3).zip` as `assets/source/pro_melee_axe/pro_melee_axe_pack_source.zip` and extracts a narrow runtime subset under `assets/models/pro_melee_axe/`. Walk, run, and jump traversal clips are registered with root/hips XZ translation locked to their first frame so the runtime controller owns traversal, while hip Y motion and all child-bone motion remain intact. Attack clips are left as one-shot silhouette actions.


## Build 0.8.24 Floor-Aware Commit/Retreat Enemy Pressure

Build `0.8.24` keeps the no-navmesh direction and adds a lightweight floor-probe controller for the active orc. Enemy movement now samples the existing `walkableSurfaces` list along each attempted step, rejects unsupported gaps or excessive height changes, checks registered solid blockers, and updates the enemy floor/base Y from the accepted support surface.

The pressure-ring AI is now stateful instead of permanent orbit. The orc approaches the ring, uses lateral sidestep clips as the hold/idle-pressure behavior, commits after a short timer, attacks inside melee range, then retreats before re-entering hold. Failed floor-aware moves flip the sidestep direction and accelerate the next commit attempt so the enemy does not endlessly circle without engaging.



## Build 0.8.28 Follow-up: Flat-Graph Diagnosis

Fresh screenshots after the descent silhouette fix showed that local descent readability improved, but the overall world still reads too flat. The district graph is still mostly planar, and verticality is still being carried by room-local features instead of the settlement spine.

The next implementation step is therefore not another room-detail patch. The authoritative reset plan is `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`: move verticality into district elevation bands, macro spine generation, and validated over-under relationships before further dressing.
