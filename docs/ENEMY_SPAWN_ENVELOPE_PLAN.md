# Enemy Spawn Envelope Plan

Use a local spawning envelope around the player instead of placing one persistent enemy at fixed room spawn points.

## Goal

Keep combat pressure near the player like Risk of Rain without filling the whole gauntlet with active enemies.

The system should:

- spawn enemies near the player as they move through the route
- avoid spawning inside view or on invalid support
- despawn enemies left far behind
- preserve one nearby combat pocket instead of simulating the whole level

## Current Problem

Right now the runtime is still effectively single-enemy and room-seeded:

- enemy placement comes from room build output
- one enemy can chase across long stretches of route
- distant enemies are not treated as a local pressure budget
- room progression and combat pressure are too tightly coupled

That works for combat bring-up, but it will not scale to a run where the player can keep moving and fighting continuously.

## Target Model

### 1. Spawn Envelope Around The Player

Maintain a live envelope centered on the player's current position and room index.

Use three radii / bands:

- `inner_exclusion_radius`: never spawn too close to the player
- `combat_band_radius`: preferred spawn ring where new enemies may appear
- `despawn_radius`: enemies beyond this radius or too many rooms behind are removed

First pass target:

- inner exclusion: roughly `5m`
- preferred spawn band: roughly `8m` to `18m`
- hard despawn: roughly `28m` to `36m`

Also gate by room distance so the system works across multi-level connectors:

- preferred spawn room delta: `0` to `1`
- despawn room delta: `> 2`

## Runtime Rules

### 2. Local Enemy Budget

Replace the single global enemy assumption with a small local budget.

Suggested first pass:

- `active_nearby_budget = 3`
- `soft_budget = 4`
- `hard_budget = 5`

Budget should scale later by level index or elapsed run pressure, but not in the first slice.

### 3. Spawn Candidate Sources

Spawn candidates should come from legal traversal/support points, not arbitrary radial positions.

Preferred sources in order:

1. room-authored enemy anchor points from `enemyPositions`
2. district/room sockets that already have valid support
3. nav graph anchors or support-sampled fallback points inside the target room

Do not spawn from decorative geometry, off-mesh voids, or connector tops that the enemy controller cannot actually traverse.

### 4. Visibility And Fairness Gates

A candidate spawn is only valid if all are true:

- outside inner exclusion radius
- within the combat band or just beyond it
- valid support under enemy capsule
- not in the player's current direct camera frustum
- not in unobstructed direct line of sight at close range
- not overlapping player or another enemy capsule
- reachable from the current nav graph

The important fairness rule is: nearby pressure can appear around the player, but not pop directly into view unless the game explicitly wants an ambush archetype later.

### 5. Despawn Rules

Enemies should be removed when they are no longer part of the current combat pocket.

Despawn if any of these are true:

- farther than `despawn_radius`
- more than `despawn_room_delta` rooms behind the player
- asleep and not re-entering the local envelope soon
- on invalid support after room/runtime rebuild

Do not despawn:

- enemies currently in hurt, attack, or death state right next to the player
- the current attack owner if it is still inside the combat band

Corpses should keep their existing short death lifetime, then clean themselves up independently of spawn budgeting.

## Required Runtime Refactor

### 6. Move From One Enemy To An Enemy Registry

Current runtime still assumes one `enemy` root. The spawn envelope needs a small registry/pool.

Introduce:

- `enemies = []`
- `enemyPool = []` for recycled enemy roots
- per-enemy `spawnToken`, `roomIndex`, `districtIndex`, `asleep`, `despawnPending`, and combat state

Keep the existing Orc controller logic per enemy instance first. Do not redesign combat behavior and spawn behavior in the same slice.

### 7. Keep One Attack Owner Rule

The combat contract still applies:

- only one enemy owns the current attack opportunity
- others can orbit, chase, or stage
- attack ownership must transfer cleanly when the owner despawns, dies, or leaves the local band

This prevents the spawn envelope from turning into simultaneous unfair point-blank hits.

## Spawn Loop

### 8. Update Flow Per Frame Or Tick

Suggested periodic flow, every `0.25s` to `0.5s` rather than every render frame:

1. measure player room index and world position
2. score active enemies against keep/despawn rules
3. despawn invalid or stale enemies
4. count active nearby enemies
5. if below budget, gather candidate spawn anchors in nearby rooms
6. filter anchors by fairness/support/visibility
7. spawn one enemy at the best candidate
8. re-evaluate attack ownership if needed

Spawn only one enemy per tick in the first pass. Continuous trickle feels better than bursts and is easier to debug.

## Candidate Scoring

### 9. Prefer Nearby-But-Not-Seen Spawns

Score valid candidates by:

- distance to preferred combat band center
- room adjacency to player
- broken line of sight
- valid support confidence
- lateral spread relative to current enemy positions

Prefer candidates that create flanking pressure without spawning behind a wall that makes the enemy instantly pathfail.

## Suggested First Slice

### 10. Minimal Implementation Order

1. replace single `enemy` assumptions with an enemy array of size `1` first
2. add pooled spawn/despawn lifecycle without changing combat rules
3. allow at most `2` active enemies near the player
4. spawn only from existing room `enemyPositions`
5. despawn enemies beyond radius / room delta
6. once stable, raise budget and add support-sampled fallback anchors

That gets the envelope behavior online without solving the whole encounter system at once.

## Validation

Prove these behaviors before increasing budget:

- walking forward through rooms keeps enemies appearing near the player
- enemies far behind disappear cleanly
- no enemy pops directly in front of the camera at close range
- despawn does not interrupt a nearby death dissolve or ragdoll
- attack ownership stays single even with multiple live enemies
- route rebuilds remain driven by navigation state, not by spawn ticks alone

## Follow-Up Phase

After the envelope works, the next good extension is pressure scaling:

- raise nearby budget by level/district/run time
- add spawn archetype mixes by district
- stage heavier enemies farther out in the envelope
- use special ambush exceptions intentionally instead of as baseline behavior
