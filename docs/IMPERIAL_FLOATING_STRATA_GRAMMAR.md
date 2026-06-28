# Imperial Floating Strata Grammar

## Dangerous Question

What would make this terrain impossible to mistake for generic rocks?

Answer: every island must read as seized geology with an imperial job. From far
away the player should see a fortress road, battery shelf, quarry cut, rail
viaduct, dock underside, or conquered ruin fused into the stone. If the shape
could be dropped into any fantasy floating-rock game, it fails.

## Premise

Imperial Floating Strata is Napoleon's floating empire in the clouds: a
pre-WW1 analog military kingdom built on torn continental fragments. The terrain
is not scenery. It is the empire's skeleton.

The core image is a war machine bolted into broken geology:

- fortress plateaus torn from earth
- quarry-cut cliff faces
- retaining-wall strata
- artillery battery shelves
- rail-cut causeways
- collapsed viaduct bridges
- dockyard undersides
- suspended foundries
- imperial roads bolted into stone
- masonry fused into sediment
- steam pipes and anchor pylons biting into cliffs

## Relationship To Infinite Brutality Terrain

This grammar reuses the Infinite Brutality sedimentary machinery as the engine,
not the costume.

Keep:

- broad playable tops from sedimentary mesa fields
- terraced side bands
- chipped rim silhouettes
- voxel fields for support and collision
- `TerrainLayer` ownership of visible meshes, fields, support queries, body
  queries, and disposal
- bridge fields as budgeted causeway fragments

Do not keep:

- generic rock-island identity
- "rock bridge but brown"
- decorative props politely sitting on rocks
- terrain that has no military or logistical reason to exist

Implementation rule: `imperial_floating_strata` may map onto the current
sedimentary mesh path, but the district metadata must name the imperial function
that makes the terrain legible.

## Doctrine Questions

Every island must answer:

1. What did the empire build here?
2. What geological fragment did they seize?
3. What war or logistics function does it serve?
4. Where does the player stand, fight, jump, climb, retreat?
5. What silhouette names it from 200 meters away?

## Macro Silhouettes

Use macro silhouettes that read before surface detail:

- `fortress_plateau`: a command slab with road approaches and retaining walls.
- `battery_crown`: stepped artillery shelves aimed across open air.
- `quarry_barracks_cut`: a squared cliff bite with stair trenches and block scars.
- `viaduct_rib_field`: broken parallel bridge ribs spanning voids.
- `cloud_dock_keel`: underside platforms, pylons, cranes, and mooring anchors.
- `foundry_shelf`: soot-stained industrial ledges, vents, rails, and slag lips.
- `border_ruin_fused`: older conquered stone swallowed by newer imperial masonry.

One island gets one primary silhouette. Secondary detail may support it, but
must not blur the far read.

## Meso Traversal Vocabulary

Traversal must explain how soldiers, guns, coal, prisoners, supplies, and the
player move through the empire.

Use:

- parade roads wide enough for formation movement
- cannon roads with straight approaches and hard turnouts
- stair trenches cut into quarry faces
- maintenance ledges below official roads
- rail beds and causeway ribs as narrow risk routes
- retaining-wall terraces that define upper and lower combat bands
- dock undersides that create recovery shelves and flank routes
- blast craters that become readable cover or jump gaps

Avoid traversal that is only a random ledge, a random ramp, or a floating
platform with no route purpose.

## Micro Surface Vocabulary

Micro detail supports function and geology. It must not become noise.

Use:

- soot streaks below vents and foundry mouths
- rust around rail cuts, chain anchors, pylons, and cranes
- pale limestone and cut-block scars on fortress faces
- coal dust on foundry shelves and dock undersides
- old blood and blast staining only where military function explains it
- masonry blocks fused into sediment bands
- drilled anchor sockets and bolted plates at structural bite points

Avoid:

- all-over pebble noise
- high-frequency crack soup
- unmotivated color patches
- surface dressing that hides the route

## Bridge And Causeway Grammar

Connectors are imperial logistics, not rock bridges.

Allowed connector identities:

- `parade_causeway`: broad official road between fortress plateaus.
- `cannon_ramp`: stepped route sized for artillery movement.
- `rail_viaduct_remnant`: broken parallel ribs with missing spans.
- `dock_service_span`: underside maintenance bridge with chains and pylons.
- `quarry_haul_road`: cut shelf ramp with block scars and worker-road turns.

Rules:

- The deck must explain what crossed it.
- Broken edges should imply collapse, bombardment, overloading, or imperial
  extraction.
- Each connector must preserve broad mobile-readable footing.
- Bridges use sparse silhouette breaks and material/UV strata before per-cell
  geometry.

## Architecture Fused With Rock

Architecture must look embedded, cut, bolted, or swallowed by terrain.

Use:

- retaining walls that hold back strata, not walls placed beside terrain
- roads carved through plateau crowns
- rail beds cutting into cliff faces
- masonry blocks exposed inside sediment bands
- pylons and chains that bite into undersides
- vents and pipes emerging from foundry shelves
- cranes and mooring frames anchored to load-bearing stone

Forbidden composition: terrain first, decorative prop second. The correct read
is terrain and empire built into one object.

## District Archetypes

### Imperial Core

Fortress plateaus, parade roads, monumental retaining walls. The player reads
command authority from far away: broad top roads, squared cliff faces, massive
walls holding sediment in place, and official approaches built for formation
movement.

### Foundry Shelf

Soot, pipes, slag, rails, furnace vents. The terrain is a suspended industrial
ledge that consumes coal and ore. Routes follow rail beds, vent clearances, slag
lips, and maintenance shelves below the official road.

### Artillery Crown

Battery terraces, cannon roads, blast-scarred stone. The terrain exists to fire
across the sky. It should expose stepped gun shelves, recoil lanes, ammunition
turnouts, and damaged outer rims.

### Viaduct Graveyard

Broken rail bridges and suspended causeway ribs. The terrain is a failed
logistics artery: parallel ribs, missing spans, repair platforms, and dangerous
side routes through collapsed imperial infrastructure.

### Quarry Barracks

Cut cliffs, stair trenches, block scars, worker roads. The island was mined,
quartered, and militarized. Traversal reads through rectangular bite marks,
worker switchbacks, barracks shelves, and exposed quarried strata.

### Cloud Dock

Mooring pylons, cranes, rope and chain anchors, underside platforms. The island
serves airships or suspended supply lifts. It needs readable upper loading
roads, underside service routes, and anchor hardware fused into the cliffs.

### Border Ruin

Older conquered stone swallowed by imperial construction. The island should
show older masonry, memorial fragments, or foreign structures trapped inside
newer roads, retaining walls, and military cuts.

## Forbidden Outputs

- Minecraft slabs
- cubes with noise
- potatoes
- asteroids
- smooth fantasy blobs
- decorative props sitting politely on rocks
- rock bridge but brown
- terrain with no military or logistical reason to exist
- a district whose silhouette cannot be named from 200 meters away
- texture-only identity with no structural read

## Gameplay Readability Rules

- The main route must be visible within one second.
- The player must see where to stand, fight, jump, climb, and retreat.
- Official routes should be broader and cleaner than maintenance routes.
- Hazardous side routes can be narrow, but they must have a visible purpose.
- Height bands should read as command plateau, service shelf, underside route,
  or collapsed lower recovery path.
- Combat tops stay broad. Chipped rims and imperial scars belong at boundaries.
- Large structures must not hide support truth. If the player can stand there,
  collision/support must agree.

## Mobile Performance Constraints

- Preserve voxel fields for support and collision.
- Do not emit one visible quad per exposed voxel face for accepted terrain.
- Keep visible shell output budgeted and mobile-readable.
- Prefer silhouette, UV/material response, and sparse structural geometry over
  dense per-cell rubble.
- Keep bridges and ramps within existing ramp budgets.
- Keep islands within existing island budgets.
- Keep the whole procedural slice within the existing scene budget.
- Do not generate decorative district-specific rubble until the primary
  silhouette, route, and support contracts hold.

## TerrainLayer Ownership Notes

`TerrainLayer` is the correct owner for runtime terrain stamps:

- district/main code submits intent: island stamps and bridge spans
- `TerrainLayer` builds the field and visible mesh
- `TerrainLayer` stores the voxel collider records
- player and enemy support/body queries ask `TerrainLayer`
- disposal clears fields, meshes, and collider records together

For Imperial Floating Strata, the safe first hook is metadata:

- route terrain labels to `imperial_floating_strata`
- build an imperial-specific voxel field with roads, retaining bites, service
  shelves, underside mass, and sparse damage cuts
- preserve `field.rockGrammar.baseGrammar = 'sedimentary_mesa'`
- preserve support/collision behavior
- keep district-specific function and silhouette metadata on the field

The visible shell can still use the sedimentary contour mesh until an
imperial-specific mesh path is proven necessary. The field shape, not dressing,
must carry the place identity first.

## Acceptance Checklist

A terrain slice is accepted only when:

- the grammar metadata names `imperial_floating_strata`
- each island answers the five doctrine questions
- the district archetype is visible in silhouette, not only in text
- the main route is readable from a phone screenshot
- broad playable tops remain clean
- rims and undersides carry chipped, fused, or engineered identity
- bridges read as causeways, rail remnants, cannon ramps, or dock spans
- architecture appears embedded in terrain
- voxel support and visible footing still agree
- existing terrain validation passes
- screenshot review does not read as Minecraft, slabs, potatoes, asteroids, or
  generic rocks

## What Still Looks Like Slabs

The current sedimentary mesa engine still produces broad horizontal tops and
terraced side bands. Those are useful for mobile play, but they remain slab-like
until district-specific imperial cuts are added: retaining walls, rail bites,
quarry scars, battery shelves, dock pylons, and fused masonry. The next fix
should add one small structural signature to one district archetype, then
validate the screenshot before expanding.
