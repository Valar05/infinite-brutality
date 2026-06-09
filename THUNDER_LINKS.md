# Infinite Brutality Thunder Links

This project has durable design/runtime notes in Thunder Brainstorm. Read these before major changes to level generation, movement, first-person arms, lighting, or art direction.

## Thunder Records

- Prototype lessons: `../thunder-brainstorm/generated/session_learnings/2026-06-08_infinite_brutality_prototype_lessons.md`
- General level-design workflow: `../thunder-brainstorm/generated/skills/level_design_environment_grammar.md`
- Project-specific level-design workflow: `docs/LEVEL_DESIGN_WORKFLOW.md`
- Vertical district realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`
- District graph implementation plan: `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`
- Project links: `../thunder-brainstorm/generated/project_links/infinite_brutality_project_links.md`
- Project links JSON: `../thunder-brainstorm/generated/project_links/infinite_brutality_project_links.json`
- Manual source refs: `../thunder-brainstorm/generated/source_refs_manual/infinite_brutality_source_refs.jsonl`
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
