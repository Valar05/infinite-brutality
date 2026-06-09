# Infinite Brutality District Graph Implementation Plan

Date: 2026-06-09

Status: first slice implemented in `src/main.js` as of build `0.8.30`. The runtime now builds a room-traversal graph from room sockets and route kinds, then uses that graph for district-spine route selection and enemy pursuit routing.

## Goal

Replace the current fixed chapter/room mental model with a seeded district graph that feels like a suspended shanty settlement over an abyss.

The world should still be legible on phone:

- One continuous physical run.
- Local route choice and revisitable shortcuts.
- New district combinations, silhouettes, and paths on replay.
- No giant fake open world that overwhelms rendering, readability, or touch navigation.

## Constraints

- Keep the existing generated room/spec corpus as the first production asset base.
- Preserve phone-first movement and route readability.
- Preserve the current compact measured room grammar inside larger structures.
- Avoid a full streaming rewrite in the first pass.
- Keep the runtime deterministic from the existing seeded level index.

## Target Runtime Model

The generator should operate on four layers.

1. `district archetype`
   - Purpose-driven environment type such as intake, scaffold market, furnace lifts, refuse underworks, shrine rim.
   - Defines preferred room roles, branch budget, vertical bias, landmark language, and light grammar.

2. `district instance`
   - A seeded runtime district picked for the run.
   - Has a name, purpose, room-count budget, local layout template, and branch-link policy.

3. `district graph`
   - A small world graph of connected districts.
   - Critical path remains readable.
   - Each district can have shortcuts, optional side routes, and one or more return links.

4. `room/blockout`
   - Existing room specs remain the short-term building blocks.
   - Rooms become route bundles inside a district, not the top-level world structure.

## Data Model

Short-term runtime objects:

- `districtPlan`
  - `seed`
  - `districts[]`
  - `roomToDistrict[]`
  - `branchLinks[]`
  - `bounds`

- `district`
  - `id`
  - `archetype`
  - `name`
  - `purpose`
  - `signal`
  - `origin`
  - `roomStart`
  - `roomCount`
  - `layoutId`
  - `branchPairs`
  - `preferredRoles`

- `districtState`
  - reserved for later systems such as powered lifts, opened tolls, fire spread, moved cranes, or unlocked refuse chutes.

## Phase Plan

### Phase 1: Seeded District Layout Over Existing Room Batch

Implement now.

- Replace fixed 12-room chapters with seeded districts.
- Keep the existing `GENERATED_ROOM_BATCH` as the room source.
- Partition the 48 specs into variable-sized district slices.
- Give each district a distinct local layout pattern and branch pair set.
- Build the full gauntlet from district offsets instead of chapter offsets.
- Expose district metadata in status/readout so the run feels like traversing places with purpose.

Success condition:

- Same runtime remains playable.
- Replays produce different district order/archetype/layout combinations.
- The world is still one continuous physical layout.

### Phase 2: District-Aware Room Selection

- Stop treating the batch order as sacred.
- Reorder or draw room specs by district purpose and preferred semantic roles.
- Example: intake prefers `start`, `choice`, `corner`, `ambush`; furnace prefers `vertical_transition`, `hazard_crossing`, `switch`; shrine prefers `vista`, `locked`, `reward`, `hub`.

Success condition:

- The same district archetype tends to produce coherent route language and local gameplay pressures.

### Phase 3: District State And Return Loops

- Add per-district state changes.
- Add route changes caused by switches, powered lifts, opened gates, moved cranes, or collapsed bridges.
- Permit revisits and changed shortcuts instead of one-way consumption only.

Success condition:

- The settlement feels like a working hostile machine, not a chain of static scenes.

### Phase 4: Streaming And Proxy World

- Fully build the current district and adjacent districts.
- Render distant districts as cheap silhouettes and landmark proxies.
- Allow a larger world graph without loading the whole thing at full detail.

Success condition:

- Open-world feel without destroying phone performance or navigational clarity.

## First Executable Slice

The first slice in this session should do only the following:

- Add a seeded district archetype library in `src/main.js`.
- Generate a deterministic district plan from `roomState.levelIndex`.
- Replace `BATCH_CHAPTER_*` layout logic with district-plan layout logic.
- Keep rooms, combat, collision, and enemy spawn behavior otherwise intact.
- Update runtime status/readout to show district name and purpose.
- Document the new runtime shape in the existing room-batch implementation doc.

## Explicit Non-Goals For This Slice

- No full room corpus rewrite.
- No streaming system yet.
- No world-state persistence beyond the current level/node persistence.
- No navmesh or heavyweight AI pathing rewrite.
- No fully authored overworld.

## Why This Order

This order gives the project a real environment-level generator now, without discarding the working room grammar or overcommitting to an unbounded open-world implementation too early.
