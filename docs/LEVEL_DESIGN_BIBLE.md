# Infinite Brutality Level Design Bible

## The Hanging Gardens Principle

### Core Thesis

The world is not a dungeon.

The world is not random floating geometry.

The world is the accumulated wreckage of history.

Every structure should feel like it once had a purpose.

Every route should feel like somebody built it.

Every arena should feel like somebody fought over it.

The player is not exploring levels.

The player is exploring survivors.

## Rule 1: Every Landmark Must Have A Past

Before placing geometry, answer:

> What was this before it became a game level?

Useful source families:

- bathhouse
- monastery
- watchtower
- marketplace
- aqueduct
- amphitheater
- harbor
- barracks
- temple
- garden

Bad:

- random floating boxes

Good:

- collapsed Roman bathhouse
- broken monastery overrun by scavengers
- hanging marketplace patched into an older retaining wall

Generator implication:

- every district and major room bundle needs a `former_use`
- that former use must drive silhouette, circulation, and support placement before combat logic enters the picture

## Rule 2: The Hanging Gardens Test

A player should regularly stop and think:

> I want to go there.

Not because loot is there.

Because the place itself is interesting.

Every major landmark should contain several of:

- height
- vegetation
- water
- lanterns
- architecture
- sky exposure
- bridges
- terraces
- gardens
- hanging structures

The world should create wonder before combat.

Generator implication:

- every district needs at least one wonder landmark
- every run needs repeated over-under reads, suspended paths, and visible destination silhouettes
- patchwork should intensify the landmark, not replace it with filler geometry

## Rule 3: Every Structure Creates Tactical Space

Combat space is never random.

Every landmark must create one or more tactical features.

### Chokepoint

Examples:

- gatehouse
- bridge
- stairwell
- broken hallway

Questions:

- Can multiple enemies pressure here?
- Can the player retreat here?
- Does the player need to commit?

### Strongpoint

Examples:

- tower top
- balcony
- elevated platform

Questions:

- Can the player gain advantage here?
- Can enemies contest it?

### Kill Zone

Examples:

- courtyard
- arena floor
- plaza

Questions:

- Can the player become surrounded?
- Can enemies attack from multiple directions?

### Escape Route

Examples:

- climb path
- broken wall
- hidden stair

Questions:

- Can the player recover from mistakes?
- Can skilled movement create opportunities?

Generator implication:

- each major landmark needs a declared tactical sentence
- each district should intentionally mix chokepoints, strongpoints, kill zones, and escape routes
- if a route feature does not create a decision, it is probably dead geometry

## Rule 4: Climbing Must Matter

Climbing is not traversal.

Climbing is survival.

The player should constantly discover:

- alternate routes
- recovery routes
- ambush routes
- observation points
- hidden shortcuts

A missed jump should often become:

> I can save this.

Not:

> I am dead.

Generator implication:

- climbable surfaces need to create save routes and side returns, not only optional collectibles
- vertical mistakes should usually spill into recovery paths rather than instant failure
- lower layers need to feed back into middle and upper layers through climb logic

## Rule 5: Multi-Layer Design

Every major area should contain multiple layers.

### Lower Layer

- danger
- pressure
- combat

### Middle Layer

- main travel route
- most common combat path

### Upper Layer

- observation
- shortcuts
- tactical advantage

Players should frequently see places they can eventually reach.

Generator implication:

- every major district should expose lower, middle, and upper circulation bands
- the middle route cannot be the only readable path
- verticality must produce tactical tradeoffs, not only screenshot height

## Rule 6: History Before Fantasy

Historical inspiration comes first.

Fantasy grows from history.

### Roman

- baths
- villas
- aqueducts
- amphitheaters
- barracks
- forums

### Medieval

- keeps
- monasteries
- gatehouses
- watchtowers
- fortified bridges

### Ancient

- temples
- terraces
- processional roads
- ziggurats

### Maritime

- lighthouses
- drydocks
- harbor walls
- ship fragments

Do not recreate these accurately.

Stylize them.

Recognize the silhouette.

Preserve the feeling.

Generator implication:

- district skeletons should derive from recognizable building families
- fantasy salvage, corpsefire, chains, and suspended additions are second-pass adaptation layers
- if the silhouette does not read as a real former structure, the district is still underdesigned

## Rule 7: Every Landmark Requires Three Stories

Example: broken monastery.

Story 1:

- why was it built?

Story 2:

- how was it damaged?

Story 3:

- who occupies it now?

If the generator cannot answer all three questions, the landmark is incomplete.

Generator implication:

- each landmark kit needs `built_for`, `broken_by`, and `occupied_by`
- those answers should affect props, routes, damage language, and tactical use

## Rule 8: Visibility

Players should regularly see:

- future destinations
- future shortcuts
- future landmarks
- future settlements

The world should pull the player forward.

The player should frequently think:

> How do I get there?

Generator implication:

- each district should have at least one forward-looking reveal
- each run should show future routes above, below, or across voids
- visibility is part of progression design, not just dressing

## Rule 9: Combat Sentences

Every combat space must answer:

> What tactical decision does this arena create?

Examples:

### Bridge

Fight or retreat?

### Tower

Climb or hold ground?

### Courtyard

Circle or charge?

### Marketplace

Use cover or stay mobile?

### Staircase

Push upward or defend downward?

If no meaningful decision exists, redesign the area.

Generator implication:

- every arena should declare one primary decision sentence
- combat validation should fail spaces that only permit flat forward pressure
- cover, climb, drop, retreat, and elevation all need to feed the same tactical question

## Rule 10: The World Must Remember

The world is built from survivors.

Not kingdoms.

Not empires.

Survivors.

The player should constantly encounter evidence that people tried to live here:

- gardens
- wells
- lanterns
- shrines
- homes
- workshops
- watch posts
- bridges

The world should feel inhabited, not generated.

Generator implication:

- each district needs signs of habitation and maintenance
- support structures, wells, lamps, bridges, stalls, shrines, and work surfaces should explain how people survived here
- pure combat sculpture is not enough

## Rule 11: Infinite Brutality

The dead become the landscape.

The living keep moving.

Every landmark should feel like proof that somebody survived here once.

Every arena should feel like proof that somebody failed.

The player moves between both.

Generator implication:

- corpsefire, bone, and wreckage should intensify a prior human purpose
- brutality is strongest when layered over life, not when it replaces it with abstract spikes and voids

## Final Test

A successful area should answer yes to all of these:

- Does it look like a real place?
- Does it suggest a history?
- Does it contain tactical decisions?
- Does climbing matter?
- Does movement matter?
- Does combat matter?
- Does the player want to explore it?
- Does the player want to survive it?

If not, continue iterating.

## Runtime Translation

This bible is the qualitative source of truth.

Use it to judge:

- `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md` for macro district shape
- `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md` for generation schema and proof-district work
- `docs/DISTRICT_RUNTIME_CONTRACT.md` for build-order and ownership constraints
- `docs/LEVEL_DESIGN_WORKFLOW.md` for screenshot critique and day-to-day generator iteration

The generator should no longer ask only:

- can the player traverse this
- can the enemy path here

It must also ask:

- what was this place
- why would someone defend it
- why would someone want to climb it
- what tactical sentence does this space create
- why does the player want to go there


## Generator Landmark Schema

The bible needs a concrete landmark contract so the generator can fail incomplete spaces early.

Every major landmark should carry a schema record like this:

```js
{
  id,
  districtId,
  formerUse,
  damageCause,
  currentOccupant,
  silhouetteFamily,
  wonderTags: [],
  tacticalFeatures: [],
  combatSentence,
  climbRoutes: [],
  visibilityTargets: [],
  lowerLayer,
  middleLayer,
  upperLayer,
  supportLanguage,
  habitationProof: [],
  landmarkAnchors: [],
  acceptanceChecks: []
}
```

### Required fields

- `formerUse`
  - what this structure originally was
- `damageCause`
  - how it was broken, collapsed, burned, besieged, or scavenged
- `currentOccupant`
  - who survives here now or what uses it now
- `silhouetteFamily`
  - the dominant historical read such as bathhouse, monastery, aqueduct, harbor wall, or market terrace
- `wonderTags`
  - the Hanging Gardens attraction set such as water, lanterns, terraces, bridges, vegetation, sky exposure, or hanging structures
- `tacticalFeatures`
  - explicit landmark outputs like chokepoint, strongpoint, kill_zone, escape_route
- `combatSentence`
  - the main tactical decision this space creates
- `climbRoutes`
  - where climbing creates alternate, recovery, ambush, or overlook value
- `visibilityTargets`
  - what future place or shortcut the landmark reveals
- `lowerLayer`, `middleLayer`, `upperLayer`
  - what each layer is for and why it exists
- `supportLanguage`
  - what physically holds it up over the abyss
- `habitationProof`
  - evidence that survivors actually used it
- `acceptanceChecks`
  - screenshot-visible tests that must all pass

### Landmark archetype examples

#### Hanging market bridge cluster

- `formerUse`: trade terrace / retaining wall marketplace
- `damageCause`: partial collapse, scavenged decking, hanging repairs
- `currentOccupant`: toll keepers, scavenger stalls, corpsefire watchers
- `tacticalFeatures`: chokepoint, strongpoint, escape_route
- `combatSentence`: push across the bridge or drop to the underdeck return
- `climbRoutes`: side support ladder, broken brace climb, awning-to-roof recovery
- `visibilityTargets`: next market tier, shrine rim, lower return pass

#### Broken bathhouse court

- `formerUse`: Roman bath complex
- `damageCause`: roof collapse, drained channels, fire damage
- `currentOccupant`: squatters, corpse burners, patrol survivors
- `tacticalFeatures`: kill_zone, escape_route, upper_strongpoint
- `combatSentence`: circle the court floor or take the gallery
- `climbRoutes`: collapsed wall grip route to upper gallery
- `visibilityTargets`: aqueduct spine, hidden cistern shortcut

## District Validation Rules

A district is not valid because traversal works.

A district is valid only if traversal, wonder, history, and tactics all read together.

### District-level required outputs

Every district must produce at least:

- `1` dominant former-use skeleton
- `1` landmark that passes the Hanging Gardens test
- `1` chokepoint
- `1` strongpoint
- `1` kill zone
- `1` escape route
- `1` meaningful climb recovery path
- `1` visible future destination or shortcut
- `1` upper/lower over-under read
- `1` clear sign of habitation or maintenance

### Validation categories

#### 1. Historical read

Pass only if all are true:

- the screenshot suggests a real former structure
- the silhouette family is legible without UI context
- patchwork reads as adaptation layered over prior architecture
- damage language explains why routes are broken, elevated, or exposed

#### 2. Hanging Gardens wonder read

Pass only if all are true:

- the player sees at least one place they want to reach for the place itself
- the district contains at least `3` wonder tags
- sky exposure, suspended structure, and elevation work together
- the landmark still reads as a destination before combat starts

#### 3. Tactical read

Pass only if all are true:

- the district contains a declared combat sentence for each major arena
- there is at least one retreat-or-commit decision
- there is at least one elevation-advantage decision
- there is at least one route where enemies can pressure from more than one direction
- there is at least one recovery route for player mistakes

#### 4. Climb value

Pass only if all are true:

- climbing opens an alternate or recovery path
- climbing changes tactical position, not just collectible access
- a failed jump often spills into a survivable recovery path
- upper layers connect back into the main route meaningfully

#### 5. Visibility and pull

Pass only if all are true:

- the player can see a future landmark, route, or shortcut
- the visibility question is spatial, not only reward-driven
- at least one reveal creates a "how do I get there" moment

### District rejection triggers

Reject or repair a district if any of these are true:

- it reads as floating boxes instead of a former structure
- combat spaces do not create a tactical sentence
- climbing exists but does not change decision-making
- the upper layer is decorative only
- the lower layer is only death space with no recovery logic
- there is no visible habitation proof
- patchwork fully obscures the historical silhouette
- traversal works but the place is not desirable to explore

## Room Bundle Translation Rules

Room bundles should stop being generic route pads.

Each room bundle fitted into a district should declare:

- `structuralRole`
  - roof_lane, market_court, bridge_landing, support_stair, tower_core, underdeck_pass, courtyard_floor, gate_step
- `historicalAttachment`
  - what part of the former structure this bundle belongs to
- `tacticalOutput`
  - chokepoint, strongpoint, kill_zone, escape_route, or transition
- `combatSentence`
  - the decision the player makes here
- `climbValue`
  - alternate, recovery, ambush, or observation

If a room bundle cannot answer those fields, it is not ready to be placed into a historical district.

## Implementation Bias

The generator should now validate in this order:

1. former-use skeleton exists
2. landmark schema is complete
3. district validation categories pass
4. room bundles fit structural and tactical roles
5. traversal and enemy pathing still work
6. local dressing reinforces the result

This prevents the current failure mode where a level is technically traversable but still reads as abstract pads with no history and no tactical sentence.
