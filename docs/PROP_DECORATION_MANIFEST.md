# Infinite Brutality Prop Decoration Manifest

Date: 2026-06-11

This note is the human-readable companion to `data/prop_decoration_manifest.json`.

## Purpose

The current world now reads as one Hanging Gardens family. The next pass is not another macro-biome rewrite. It is prop density, habitation, and tactical-space reinforcement.

The props in this manifest are designed to satisfy three needs at once:

- make the settlement look inhabited and historically layered
- create readable tactical pressure, cover, and chokepoints
- stay buildable from primitives before demanding bespoke generated meshes

## Primitive-First Rule

Default to combinations of:

- boxes
- beveled boxes
- cylinders
- rails
- chains
- rope lines
- cloth planes
- shallow inset basins

Use generated meshes only when the primitive version fails to read at gameplay distance.

## Prop Families

### Trade and habitation

- open market stalls
- shuttered stalls
- bench and table sets
- jar clusters
- crate bundles
- cloth lines

### Garden and water

- terrace planter beds
- hanging planters
- cistern pools
- well and bucket sets
- trellis walls

### Ritual and history

- shrine niches
- arch fragments
- bath screen walls

### Defense and circulation

- watch posts
- gate chokepoint sets
- bridge railing clusters
- ladders and landings
- rope bridges
- counterweight winches

### Lift Court mechanical and punitive

- cargo lift cages
- cargo hook posts
- maintenance tool benches
- brake lever pedestals
- execution tribunal dais

These are the district-specific additions for `lift_court_hybrid`. The lift court should read as a hauling and punishment machine first, not as another market lane with recycled stalls.

## Texture Status

The first Hanging Gardens prop texture family now exists as project-owned SVG assets:

- `ib-vector-timber-20260610.svg`
- `ib-vector-cloth-20260610.svg`
- `ib-vector-plaster-20260610.svg`
- `ib-vector-ceramic-20260610.svg`
- `ib-vector-garden-20260610.svg`
- `ib-vector-water-20260610.svg`
- `ib-vector-rope-20260610.svg`

They are tracked in `assets/asset_manifest.json` and previewed in `assets/textures/ib-vector-hanging-gardens-material-sheet-20260610.svg`.

## Texture Policy

Do not fake this with the current material set alone. The prop pass needs new project-owned vector textures for:

- timber
- cloth
- plaster
- ceramic
- garden foliage
- water
- rope

These are listed in `docs/TEXTURE_PROMPTS_HANGING_GARDENS.md`.

## Tactical Rule

Lift-court floor props must snap to actual support surfaces. Do not place mechanical or court props by elevation-band guess alone; stairs, bridge runs, and undercroft returns need support-aware anchoring or they will float.

Each prop cluster must reinforce one of these:

- soft cover
- hard cover
- lane narrowing
- strongpoint
- escape route support
- climb recovery
- route framing
- wonder read

If a prop only adds clutter and weakens traversal readability, it does not belong in the first pass.

## Historical Rule

Each prop cluster must answer one of these:

- how people traded here
- how people stored water here
- how people sheltered here
- how people prayed here
- how people watched or defended this route
- how the old structure was repurposed

If it cannot answer one, it is filler.
