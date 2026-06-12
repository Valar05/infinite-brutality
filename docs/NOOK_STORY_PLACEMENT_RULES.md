# Nook Story Placement Rules

Date: 2026-06-11
Status: first placement wiring layer for Hanging Gardens absent-people packets

## Purpose

These rules connect story packets to actual district structure vocabulary.

The goal is not to render text in-world yet. The goal is to stop the story system from floating free of level generation.

Placement rules should tell the generator:

- which district archetypes can host which story pilots
- which packet clusters belong to which structural pockets
- what support/cover expectations those pockets have
- how to preserve route clarity while adding lived-in story evidence

## Placement Principle

A story nook is not a random text drop.

It must attach to one of these real spatial conditions:

- underdeck recess
- wall niche
- customs alcove
- stair landing veil
- blind bell corner
- watch berth
- service table
- hidden cache
- memorial arch shadow
- water shelf or capped route station

If a packet cannot be attached to a real spatial condition, it should not spawn.

## Route Safety Rule

Story nooks must not consume the player's main touch-safe envelope.

Allowed:

- visual narrowing
- side-pocket occupancy
- cover edge dressing
- recess occupation

Not allowed:

- centerline blockage on exposed bridges
- unreadable clutter at jump lips
- shrine piles or caches that destroy primary route readability

## Current Sets

### `hg_market_intake_nooks`

Uses pilot:

- `hanging_gardens_absent_people_01`

Targets district archetype:

- `intake`

Read:

- domestic survival inside former public water and customs infrastructure

### `hg_shrine_rim_nooks`

Uses pilot:

- `hanging_gardens_absent_people_02`

Targets district archetype:

- `shrine`

Read:

- witness culture, silent bells, rewritten law, and sealed-route hope

## Runtime Wiring Expectation

The district template should carry:

- `storyPilotId`
- `storyPlacementSet`
- `storyNookPlacements`

That metadata is enough for a later geometry pass to:

1. choose a district story pilot
2. choose cluster rules
3. locate candidate recesses or ledges
4. attach evidence-object bundles and future readable fragments

## Immediate Next Step

The next implementation pass should not jump straight to prose rendering.

First build support-aware geometry markers for:

- wall niche
- side shelf
- underdeck cache
- stair veil landing
- memorial arch shadow
- service bench

Then spawn object evidence from the pilot packets before tackling readable text surfaces.
