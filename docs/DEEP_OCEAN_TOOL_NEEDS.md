# Deep Ocean Tool Needs

This note records the tools needed after the PBR material and foundry collider
slice.

## Knowledge Capture

- Runtime material art must come from real image sources. Local scripts may
  derive normal, height, roughness, metalness, AO, and emissive maps, but they
  must not invent final albedo art.
- Generated material paths need a separate texture cache-bust token. Replacing a
  PNG in place is not enough for Android browser review.
- A manifest entry is not enough. Runtime material entries need explicit
  `runtimeApproved: true`.
- Visible architecture needs collision by default. Walkable decks use `player`
  colliders; substantial non-route architecture uses `solid`; hidden metadata
  uses `none`.
- Cache-bust tests should compare imports to the current `BUILD` token instead
  of hard-coding old version strings.

## Friction Audit

- Missing texture-source tool: no batch workflow that takes manifest entries,
  asks OpenAI for source albedos/emissive masks, copies outputs into project
  source assets, derives channels, and marks entries approved.
- Missing material visual QA: no automated contact-sheet check that fails on
  flat procedural mush, low-contrast crayon output, or accidental rock
  replacement.
- Missing runtime material smoke: no in-browser assertion that a sampled material
  has the expected manifest id and non-null PBR maps.
- Missing collision coverage test: current foundry contract now catches visible
  assembly parts without `solid` or `player`, but this should generalize to all
  district assembly emitters.
- Missing debug overlay: collision debug can show Rapier colliders, but there is
  no one-click "visible architecture without collider" overlay.

## Build Next

Build `tools/generate_openai_material_batch.py` as a manifest-driven pipeline:

- read `assets/materials/ib_pbr_material_manifest.json`
- select unapproved or stale material entries
- call the OpenAI image-generation workflow for albedo/emissive sources
- copy sources into `assets/source/generated_textures/ib_pbr_openai/`
- run `tools/derive_ib_pbr_from_albedo.py`
- rebuild `assets/materials/ib_pbr_material_preview.png`
- fail if any runtime material is unapproved, missing files, or still marked
  placeholder

Then add a general district assembly collision contract:

- every visible part must declare `player`, `solid`, or an explicit decorative
  exemption
- every `solid` or `player` part must appear in the physics snapshot
- every visible structure without a collider should fail before screenshot QA
