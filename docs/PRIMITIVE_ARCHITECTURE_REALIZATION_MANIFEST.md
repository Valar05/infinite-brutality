# Primitive Architecture Realization Manifest

Status: Project-local build contract
Purpose: Teach Infinite Brutality how to turn primitives into specific island-stone places instead of cube spaghetti.

## Core Thesis

Infinite Brutality can still build with primitives.

The failure is not cubes. The failure is untyped cubes.

A primitive becomes architecture only when the generator can name what it is, why it exists, what supports it, what it touches, what phase built it, and what gameplay decision it creates.

Use this manifest when converting district, terrain, room-bundle, or decoration work into actual buildable geometry.

## Required Skill

Primitive Architectural Realization:

> Given a district purpose, produce a specific place made from island stone, embedded buildings, valid supports, readable routes, and typed primitive recipes.

This skill sits between the general architectural corpus and the runtime generator.

Input:

- district purpose
- former use
- terrain or island stone form
- desired tactical sentence
- route graph needs
- support/collision constraints

Output:

- place archetype
- dominant stone form
- architectural assemblies
- primitive recipes
- support language
- route roles
- validation checks
- screenshot acceptance tests

## Sources Of Truth

Use these project-local documents first:

- `docs/LEVEL_DESIGN_BIBLE.md`
- `docs/LEVEL_DESIGN_WORKFLOW.md`
- `docs/ROCK_SHAPE_GRAMMAR.md`
- `docs/IMPERIAL_FLOATING_STRATA_GRAMMAR.md`
- `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`
- `docs/DISTRICT_RUNTIME_CONTRACT.md`

Use the Thunder architectural corpus as grammar and validation support:

- `../thunder-brainstorm/docs/ARCHITECTURAL_PATTERN_LANGUAGE.md`

Do not use the deprecated `level-design-environment-grammar` skill as geometry doctrine. It is useful only as a warning label: avoid box architecture, prop-dumped rooms, bridge chains, abstract purpose labels, and toybox platforms.

## Build Pipeline

Every major district or landmark should resolve through this chain:

```text
Place Archetype
-> Island Stone Form
-> Construction History
-> Assembly Set
-> Primitive Recipes
-> Route And Combat Roles
-> Support And Collision Envelopes
-> Validation
-> Screenshot Review
```

Do not start from loose room pads or decorative props.

## Primitive Typing Rule

A primitive must be one of these kinds before it can ship as visible structure:

- wall bay
- wall panel
- pier
- lintel
- arch span
- arcade bay
- column
- buttress
- retaining course
- parapet
- stair run
- stair landing
- switchback landing
- balcony deck
- balcony bracket
- bridge abutment
- bridge pier
- bridge deck
- tower base
- tower crown
- roof monitor
- machinery plinth
- furnace plinth
- dock edge
- crane base
- cliff cut
- quarry face
- service tunnel wall
- foundation block
- repair brace
- scaffold leg
- chain anchor

Reject unnamed primitives. If the generator cannot name the part, it is probably filler.

## Primitive Record Contract

Every generated structural primitive should carry enough metadata to be audited:

```js
{
  id,
  kind,
  assemblyId,
  placeArchetype,
  builtPhase,
  materialGeneration,
  supportRole,
  supportedBy: [],
  touches: [],
  routeRole,
  collisionPolicy,
  visualPriority,
  validationTags: []
}
```

Minimum meanings:

- `kind`: architectural atom, not shape name.
- `assemblyId`: larger structure this primitive belongs to.
- `builtPhase`: natural, initial construction, expansion, damage, repair, retrofit, or current state.
- `supportRole`: load-bearing, retained, bracing, edge treatment, circulation, cover, landmark, dressing.
- `supportedBy`: what prevents it from floating.
- `touches`: stone, wall, route, bridge, tower, stair, adjacent assembly, or void.
- `routeRole`: official route, maintenance route, recovery route, shortcut, hazard edge, combat cover, landmark-only.
- `collisionPolicy`: solid, walkable, climbable, partial blocker, visual-only. Visual-only is forbidden for structural masses.

## Terrain-Building Fusion

The default composition is not terrain first and buildings second.

The correct composition is a single object where architecture and island stone explain each other.

Allowed interfaces:

- building carved into cliff
- building grown from a foundation shelf
- road cut through a plateau crown
- retaining wall holding back strata
- stair trench cut into quarry face
- bridge abutment biting into rock
- dock edge bolted under a stone shelf
- tower base fused into a mesa corner
- buttress stack supporting a cracked wall
- scaffold forest repairing a failed underside
- machinery plinth anchored into old masonry
- repair brace crossing a damaged phase boundary

Reject:

- buildings placed politely on flat rocks
- props floating near terrain
- slabs with no foundation language
- supports that do not touch load
- stone that ignores attached architecture
- architecture that could be removed without changing the island silhouette

## Construction History Requirement

Every specific place needs at least three time layers:

1. `former_use`: why the place was built.
2. `damage_or_pressure`: what broke, overloaded, burned, collapsed, starved, or militarized it.
3. `current_use`: who uses it now and how the player moves through it.

History must alter geometry.

Examples:

- A bathhouse court has drains, galleries, collapsed roof bays, patched cistern walls, and upper recovery paths.
- A quarry barracks has bite cuts, stair trenches, worker shelves, block scars, and later military parapets.
- A cloud dock has mooring pylons, underside service decks, crane bases, widened cargo routes, and damaged edge repairs.

Reject history that exists only in labels.

## Place Archetype Recipes

### Hanging Market Bridge Cluster

Place purpose:
A salvaged trade and toll settlement suspended between older retaining walls and newer scaffold repairs.

Island stone form:
Broken mesa edge with carved market shelves and an exposed underside.

Assembly set:

- retaining wall bands
- bridge abutments
- balcony decks
- scaffold legs
- stair runs
- switchback landings
- awning frames
- parapet fragments
- underdeck maintenance route

Primitive recipe:

- 2 to 4 large market masses on different elevation bands
- retaining courses on the back edge of each mass
- at least one dominant upper crosswalk
- one lower underdeck recovery route
- repeated scaffold legs under exposed decks
- bridge abutments visibly biting into stone at both ends
- small stall bays attached to walls, never free-floating as clutter

Route and combat sentence:
Push across the exposed bridge cluster or drop to the underdeck return.

Validation:

- upper and lower routes visible at once
- support forest touches both deck and stone
- no primary path reads as a generic floating slab
- market stalls reinforce route edges instead of blocking them

### Quarry Barracks Cliff Cut

Place purpose:
A quarried stone face converted into worker housing, then militarized.

Island stone form:
Squared cliff bite with exposed strata and cut shelves.

Assembly set:

- quarry faces
- retaining walls
- stair trenches
- barracks wall bays
- tower base or watch post
- parapets
- service tunnel mouths
- repair braces

Primitive recipe:

- one dominant vertical quarry wall
- 2 to 3 horizontal worker shelves cut into it
- stair trench connecting shelves in a visible zigzag
- barracks wall bays recessed into the cliff face
- parapets added later on exposed edges
- block scars and abandoned cuts where stone was removed

Route and combat sentence:
Climb the worker trench under pressure or take the exposed shelf for speed.

Validation:

- screenshot reads as a cliff cut before it reads as rooms
- barracks attach to the quarry face
- stair path is legible from below
- parapets and repairs visibly belong to a later phase

### Broken Bathhouse Court

Place purpose:
A civic bath complex turned into a survival court and corpsefire processing site.

Island stone form:
Severed courtyard slab with drained channels and broken gallery edges.

Assembly set:

- courtyard floor
- arcade bays
- cistern wall
- broken roof supports
- stair run to gallery
- balcony gallery
- basin plinths
- drainage channel
- repair braces

Primitive recipe:

- broad lower court as the kill zone
- raised gallery on two sides
- broken arcade rhythm along at least one wall
- drained basin or cistern as landmark center
- collapsed roof supports creating climb recovery
- service stair or broken wall route to upper gallery

Route and combat sentence:
Circle the exposed court or climb to the gallery strongpoint.

Validation:

- court, gallery, and basin read as one former bath complex
- upper route changes combat position
- broken roof or wall creates recovery, not only decoration
- water/drainage evidence shapes the floor plan

### Cloud Dock Underside

Place purpose:
A suspended logistics dock for airships, cargo lifts, or void barges.

Island stone form:
Undercut cliff shelf with mooring bites and cargo roads above.

Assembly set:

- dock edge
- crane base
- mooring pylon
- chain anchor
- cargo road
- underside service deck
- bridge abutment
- stair or lift shaft
- retaining wall

Primitive recipe:

- broad upper cargo route
- underside service platform offset below it
- crane bases anchored into stone, not loose props
- mooring pylons at readable edge intervals
- chain anchors biting into cliff underside
- one lift or stair shaft connecting cargo and service levels

Route and combat sentence:
Hold the cargo road or risk the underside flank route.

Validation:

- dock function is legible without UI
- every crane/pylon has cargo or mooring space nearby
- underside route is visible and reachable
- exposed edge has structural treatment

### Foundry Shelf

Place purpose:
An industrial heat and processing ledge carved into old stone.

Island stone form:
Sooted shelf, vent cuts, slag lips, and heavy plinths.

Assembly set:

- furnace plinth
- machinery plinth
- vent wall
- rail bed
- catwalk
- retaining wall
- cooling channel
- slag lip
- service stair

Primitive recipe:

- one heavy furnace or machinery plinth fused into rock
- straight rail or cargo path feeding it
- catwalk crossing above or beside the hazard area
- vents cut into a wall or shelf face
- slag lip or cooling channel marking the lower hazard boundary
- service stair connecting maintenance route to main route

Route and combat sentence:
Take the safe cargo path or cross the exposed catwalk for position.

Validation:

- heavy machinery has a load-bearing base
- rail/cargo route has a destination
- hazard edge is spatial, not only material color
- service route explains maintenance access

### Retaining-Wall Shrine Rim

Place purpose:
A sacred overlook repaired into a survival landmark on the edge of the abyss.

Island stone form:
High rim shelf held by older retaining walls and later braces.

Assembly set:

- retaining wall
- parapet
- shrine plinth
- stair run
- landing
- buttress
- balcony overlook
- repair brace
- lantern or witness post

Primitive recipe:

- high shelf with visible abyss exposure
- retaining wall below the shelf face
- shrine plinth set back from the edge
- stair approach with one landing reveal
- parapet fragments framing the overlook
- buttress or brace stack supporting cracked wall sections
- witness posts or lanterns marking active current use

Route and combat sentence:
Commit up the stair to the exposed shrine or retreat around the retaining base.

Validation:

- overlook is the landmark from approach
- retaining wall visibly holds the shelf
- shrine is placed as destination, not floor clutter
- repair braces answer specific cracks or missing supports

## Composition Phrases For Infinite Brutality

Use these phrases as repeatable architectural sentences.

### Cliff Cut -> Stair Trench -> Shelf Barracks

Purpose:
Turns raw vertical stone into a readable climb district.

Requires:
Visible quarry face, zigzag stair, shelf rooms attached to stone.

Reject if:
Shelves float away from the cliff or stair does not connect all active shelves.

### Retaining Wall -> Market Terrace -> Underdeck Return

Purpose:
Creates a place where commerce, support, and recovery route are the same structure.

Requires:
Back wall, broad terrace, lower return path, support language.

Reject if:
Market props sit on a generic slab or underdeck is unreachable.

### Court Floor -> Gallery Ring -> Broken Roof Climb

Purpose:
Creates a combat kill zone with an upper recovery/strongpoint route.

Requires:
Lower court, raised gallery, broken climb path, readable entrance/exit.

Reject if:
Gallery is decorative or court has no tactical decision.

### Cargo Road -> Dock Edge -> Underside Service Route

Purpose:
Creates logistics architecture with official and maintenance circulation.

Requires:
Wide cargo route, mooring/dock edge, connected service route.

Reject if:
Dock objects have no cargo zone or route purpose.

### Furnace Plinth -> Hazard Lip -> Catwalk Bypass

Purpose:
Creates an industrial combat sentence around danger and traversal choice.

Requires:
Heavy plinth, visible hazard boundary, alternate elevated or side route.

Reject if:
Hazard is just color or catwalk has no tactical value.

## Validation Gates

### Static Validation

Reject a district or landmark if:

- no former-use skeleton is declared
- no dominant island stone form is declared
- major visible primitives are unnamed
- supports do not touch loads
- a bridge has no abutments or route purpose
- a building has no entrance or circulation logic
- a stair does not connect meaningful levels
- a route has no official, maintenance, recovery, shortcut, or combat purpose
- structural visual masses are marked visual-only
- damage has no consequence
- repair has no damage or overload cause

### Runtime Validation

Reject or repair before dressing if:

- official route is blocked
- recovery route does not reconnect
- player spawn or enemy spawn lands inside structural mass
- collision and visible footing disagree
- support snapping buries an actor into geometry
- district structural geometry invalidates room anchors
- support/collision envelopes are missing for visible traversal-facing geometry

### Screenshot Validation

A screenshot should pass these tests with the player and enemies mentally removed:

- it reads as a specific place, not a level kit
- the dominant former structure can be named
- island stone and buildings look fused
- upper, middle, and lower route bands are visible where promised
- support language explains suspended mass
- at least one future destination or shortcut is visible
- the main route is readable within one second
- the scene does not read as cubes, slabs, potatoes, asteroids, or generic rocks

## Generator Defaults

When uncertain, choose the more physically motivated option:

- retaining wall over freestanding wall
- stair trench over floating stair
- bridge abutment over unsupported bridge
- carved shelf over platform
- gallery attached to court over balcony in empty space
- support forest over floating deck
- repair brace over random decoration
- cargo road over decorative path
- landmark silhouette over detail noise

## First Proof Target

Use Hanging Market as the first proof district.

Required first screenshot read:

- salvaged vertical market settlement
- upper crosswalk or roof route
- lower underdeck or return route
- strong support forest or hanging supports
- market masses attached to old retaining walls
- visible over-under condition
- no primary play space that reads as a generic freestanding slab

The proof is not complete until this reads before props, enemies, UI, or story text are considered.
