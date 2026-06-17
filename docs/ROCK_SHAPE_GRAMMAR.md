# Infinite Brutality Rock Shape Grammar Steering

## Purpose

This file defines the shape language for Infinite Brutality floating terrain.

The goal is to replace random floating blobs with believable geological fragments that feel shaped by natural forces, collapse, erosion, and ancient structural history.

Terrain should look like pieces of a broken continent suspended in the void.

Not asteroids. Not potatoes. Not noise blobs.

## Prime Directive

Every rock formation must imply a process.

Before creating any floating island, ask: what force shaped this?

Valid answers include:

- sediment layers
- erosion
- fracture
- collapse
- volcanic cooling
- shearing
- impact
- gravity
- water flow
- ancient construction damage

Invalid answers:

- random noise
- sphere deformation
- asteroid blob
- smooth lumpy rock
- decorative fantasy shape

If the formation does not suggest a force, redesign it.

## World Premise For Rocks

Infinite Brutality terrain is not made of isolated rocks. It is made of land fragments.

Imagine an ancient continent, battlefield, fortress, or ruin shattered into pieces and suspended in the void.

Each floating island should feel like:

- a torn-out cliff section
- a broken mesa
- a collapsed bridge foundation
- a severed courtyard slab
- a hanging canyon wall
- a fragment of old architecture fused with stone

The terrain must feel like it was once part of a larger world.

## Shape Hierarchy

Every terrain chunk should be built in three layers.

### 1. Macro Shape

The far-distance read.

Examples:

- floating mesa
- broken cliff slab
- vertical stone pillar
- eroded arch
- shattered bridge fragment
- fortress foundation
- hanging canyon shelf

The macro shape must be recognizable in silhouette.

### 2. Meso Shape

The playable and traversal read.

Examples:

- ledges
- shelves
- ramps
- terraces
- cracks
- steps
- collapsed platforms
- climbable breaks

The meso shape defines gameplay.

### 3. Micro Shape

The close-up surface read.

Examples:

- chipped edges
- smaller stones
- fracture lines
- sediment bands
- foothold cuts
- weathered corners

Micro shape supports the larger form. It must not become random noise.

## Preferred Geological Grammars

### Sedimentary Mesa Grammar

Use for main traversal islands.

Features:

- horizontal layers
- stacked strata
- flat tops
- eroded sides
- undercut shelves
- chipped ledges

Good for:

- arenas
- bridges
- climb paths
- readable combat spaces

Silhouette:

- wide top
- broken vertical sides
- layered bands

Avoid:

- smooth round blobs
- even pebble shapes

### Canyon Wall Grammar

Use for vertical boundaries and dramatic backdrops.

Features:

- sheer faces
- long cracks
- stratified bands
- vertical erosion channels
- broken overhangs

Good for:

- wall-running equivalents
- climbable faces
- enemy perches
- shadowed corridors

Silhouette:

- tall slab
- fractured side
- hard vertical read

### Basalt Column Grammar

Use for alien, void-touched, or ancient volcanic zones.

Features:

- vertical columns
- hexagonal or blocky shafts
- repeated pillar rhythm
- snapped tops
- broken stepping heights

Good for:

- platforming
- climbing
- combat pillars
- landmark zones

Avoid:

- perfectly even columns
- decorative symmetry

### Hoodoo / Spire Grammar

Use for landmarks and hazards.

Features:

- narrow vertical pillars
- wider capstones
- eroded necks
- unstable silhouettes

Good for:

- distant landmarks
- enemy lookouts
- bridge anchors
- tension spaces

Avoid:

- overuse
- making every rock a spike

### Fractured Fortress Grammar

Use where terrain and architecture merge.

Features:

- squared-off stone masses
- partial walls
- broken foundations
- stair remnants
- collapsed battlements
- stone blocks embedded in cliff

Good for:

- Infinite Brutality identity
- historical ruins
- combat rooms
- navigation landmarks

Rule: architecture should look swallowed by terrain or torn out with it. It should not look placed on top like decoration.

## Edge Language

Edges must look broken, eroded, or cut by force.

Use:

- chipped ledges
- sharp fractures
- stepped breaks
- undercuts
- cracked corners
- sheared planes

Avoid:

- melted edges
- smooth inflated surfaces
- balloon-like curves
- random lumpy silhouettes

Rock breaks. Rock erodes. Rock does not inflate.

## Silhouette Rules

Every floating chunk should read as one of these:

- mesa
- cliff
- slab
- pillar
- arch
- bridge fragment
- fortress foundation
- canyon wall
- broken stair mass

Never read as:

- potato
- asteroid
- sphere
- random blob
- melted mound

If the silhouette cannot be named, it is too random.

## Surface Rules

Surfaces should have direction.

Use directional structure:

- horizontal bands
- vertical cracks
- diagonal shears
- stepped terraces
- erosion grooves

Avoid uniform all-over noise.

A good rock surface has flow. A bad rock surface has static.

## Gameplay Requirements

Terrain must support first-person movement.

Every island should include some combination of:

- readable landing zone
- combat floor
- cover edge
- jump target
- climbable break
- enemy perch
- escape route
- visual landmark

Do not create beautiful rocks that do nothing. Every formation should imply gameplay.

## Traversal Readability

Player movement is fast.

The player must instantly understand:

- where they can stand
- where they can jump
- where they can climb
- where they can fall
- where enemies may appear

Use shape to communicate function.

Flat tops are safe. Broken ledges are risky. Vertical cracks imply climbing. Overhangs imply danger. Terraces imply routes.

## Arena Rock Rules

Combat arenas should usually be built from:

- broad mesa tops
- broken courtyard slabs
- layered stone shelves
- fortress foundations

Avoid arenas that are:

- round
- smooth
- featureless
- symmetrical blobs

Good arenas contain:

- height changes
- cover
- chokepoints
- escape routes
- ledges
- hazards
- landmarks

## Floating Island Construction Pattern

When generating a new rock island:

1. Choose geological grammar.
2. Define macro silhouette.
3. Cut playable top surface.
4. Add erosion direction.
5. Add fractures.
6. Add ledges and shelves.
7. Add historical or architectural traces.
8. Add gameplay purpose.
9. Remove random noise.
10. Check silhouette from distance.

If it still looks like a blob, start over.


## Implementation Acceptance

The first runtime grammar slice is `sedimentary_mesa`.

A generated sedimentary mesa is acceptable only if the test harness can prove:

- metadata names the grammar, silhouette, shaping process, and gameplay role
- the central top surface is broad enough to stand and fight on
- terraced mode exposes multiple height bands
- the rim has chipped silhouette variation without collapsing into unusable gaps
- rim underside depth varies more than the stable center mass, implying erosion and undercutting
- mesh output stays inside the mobile island triangle budget

These checks live in `tools/test_rock_grammar_contract.mjs` and should run before accepting new rock grammar branches.

## Material And Texture Direction

Rock textures should support the shape grammar.

Use:

- sediment bands
- hand-painted cracks
- broad value planes
- rough stone normals
- directional erosion streaks
- subtle color temperature shifts

Avoid:

- uniform noise
- repeated pebble texture
- procedural rock soup
- high-frequency detail everywhere

Texture should explain the form, not hide it.

## Color Palette

Use muted, ancient stone colors:

- warm gray
- dirty tan
- sandstone ochre
- charcoal
- rust brown
- pale limestone
- ash black

Occasional accents:

- moss
- mineral veins
- old blood stains
- soot
- ritual paint
- quartz flecks

Keep accents sparse.

## Forbidden Generation Patterns

Do not generate:

- floating boulders with no flat surfaces
- asteroid fields
- round lumpy islands
- smooth melted cliffs
- procedural noise terrain
- random spikes everywhere
- caves with no readable entrance
- platforms with no geological explanation

## Quick Diagnostic Checklist

Before accepting a terrain chunk, answer:

1. What geological force shaped it?
2. What is its silhouette name?
3. Where does the player stand?
4. Where does the player move next?
5. What is the combat purpose?
6. What makes it different from nearby rocks?
7. Does the texture support the form?
8. Does it look like a fragment of a larger world?

If any answer is unclear, revise the shape.

## One-Sentence Direction

Infinite Brutality rocks are not floating blobs; they are broken geological and architectural fragments of a violent world, shaped by erosion, fracture, collapse, and war.
