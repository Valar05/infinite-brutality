# Infinite Brutality Thunder Links

This project has durable design/runtime notes in Thunder Brainstorm. Read these before major changes to level generation, movement, first-person arms, lighting, or art direction.

## Thunder Records

- Prototype lessons: `../thunder-brainstorm/generated/session_learnings/2026-06-08_infinite_brutality_prototype_lessons.md`
- General level-design workflow: `../thunder-brainstorm/generated/skills/level_design_environment_grammar.md`
- Project-specific level-design workflow: `docs/LEVEL_DESIGN_WORKFLOW.md`
- Project combat bring-up plan: `docs/COMBAT_BRINGUP_PLAN.md`
- Vertical district realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`
- District graph implementation plan: `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`
- Project links: `../thunder-brainstorm/generated/project_links/infinite_brutality_project_links.md`
- Project links JSON: `../thunder-brainstorm/generated/project_links/infinite_brutality_project_links.json`
- Meshy/PBR rendering handoff: `../thunder-brainstorm/generated/session_learnings/2026-06-15_infinite_brutality_meshy_pbr_rendering_handoff.md`
- Meshy/PBR rendering source refs: `../thunder-brainstorm/generated/source_refs_manual/infinite_brutality_meshy_pbr_rendering_source_refs.jsonl`
- Manual source refs: `../thunder-brainstorm/generated/source_refs_manual/infinite_brutality_source_refs.jsonl`
- Nook story / absent-people writing note: `../thunder-brainstorm/generated/session_learnings/2026-06-11_infinite_brutality_nook_story_brainstorm.md`
- Nook story source refs: `../thunder-brainstorm/generated/source_refs_manual/infinite_brutality_nook_story_source_refs.jsonl`
- Local nook story system: `docs/NOOK_STORY_WRITING_SYSTEM.md`
- Local nook story placement rules: `docs/NOOK_STORY_PLACEMENT_RULES.md`
- Local nook story seed data: `data/nook_story_seed.json`
- Local nook story placement data: `data/nook_story_placement_rules.json`
- Hanging Gardens pilot doc: `docs/HANGING_GARDENS_NOOK_STORY_PILOT.md`
- Hanging Gardens pilot data: `data/hanging_gardens_nook_story_pilot.json`
- Hanging Gardens Thunder note: `../thunder-brainstorm/generated/session_learnings/2026-06-11_infinite_brutality_hanging_gardens_story_pilot.md`
- Hanging Gardens source packet: `../thunder-brainstorm/generated/source_packets/infinite_brutality_hanging_gardens_nook_story_source.md`
- Precursor FPS/Arcane brainstorm: `../thunder-brainstorm/generated/session_learnings/2026-06-07_fps_platformer_arcane_ik_brainstorm.md`
- Quake/touch movement brainstorm: `../thunder-brainstorm/generated/session_learnings/2026-06-08_quake_movement_touch_speedrun_brainstorm.md`
- Quake route grammar curriculum: `../thunder-brainstorm/generated/quake_route_grammar/quake_route_grammar_curriculum.md`
- Route grammar extractor: `../thunder-brainstorm/tools/quake_route_grammar.py`

## Local Runtime

- Play URL: `http://127.0.0.1:8798/infinite-brutality/index.html`
- Current documented build: `0.8.30`
- Entry: `index.html`
- Runtime: `src/main.js`
- Styles: `src/styles.css`
- Level contract: `LEVEL_GENERATION_CONTRACT.md`
- Route template data: `data/level_route_templates.json`
- Room junction batch list: `docs/ROOM_JUNCTION_BATCH_LIST.md`
- Room junction batch data: `data/room_junction_batch.json`
- Generated room batch module: `src/generated_room_batch.js`
- Room batch implementation: `docs/ROOM_BATCH_IMPLEMENTATION.md`
- Route graph implementation status: `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`

## Current Direction

Phone-landscape Three.js first-person melee/platformer. Low-poly primitive nightmare architecture, FPSPlayer arms, touch-friendly acceleration movement, dungeon graph layout with turns/loops/vertical offsets, and visible diegetic light sources.

## Workflow Split

Read both the Thunder general workflow and the Infinite Brutality local workflow before major generation or screenshot-driven geometry changes. When a pass teaches a durable lesson, update the Thunder note if it generalizes and this project's local workflow if it is specific to Infinite Brutality.
