# Infinite Brutality Prototype

Three.js landscape mobile prototype for a first-person melee platformer roguelike set in Limbo, a low-poly nightmare realm where violence has become geography.

## Entry Point

- `index.html`: browser entry shell.
- `src/main.js`: runtime, controls, generated room-batch builder, camera-space FPV arms, footsteps, and attack loop.
- `src/generated_room_batch.js`: generated 48-room batch module derived from `data/room_junction_batch.json`.
- `src/styles.css`: mobile landscape HUD and touch controls.
- `assets/models/FPSPlayer.glb`: copied from Pose Lab as the first-person arm and animation source.

## Run

From `/storage/emulated/0/Documents/GodotProjects`, serve the workspace root and open:

`http://127.0.0.1:8798/infinite-brutality/index.html`

The prototype expects to be served from the GodotProjects workspace root.

## Validation

```sh
node --input-type=module --check < src/main.js
python3 -m json.tool assets/asset_manifest.json >/dev/null
```

## Level Generation

- `LEVEL_GENERATION_CONTRACT.md`: current route-grammar rules for Quake-style level generation without copied Quake layouts.
- `data/level_route_templates.json`: generator-facing route template contract.
- `data/room_junction_batch.json`: overnight batch list of room prompts by connector topology.
- `docs/ROOM_JUNCTION_BATCH_LIST.md`: human-readable room junction build list.
- `docs/ROOM_BATCH_IMPLEMENTATION.md`: runtime wiring notes for the generated room sequence.
- `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`: district-level route graph and implementation status.

## Direction

Render the world normally, then render FPS arms in a separate camera-space pass so the player never sees chest/body intrusion. Keep the low-poly hard-edged source asset as the art direction seed rather than forcing a full-body textured rig into first person.

## Thunder Brainstorm

Durable design/runtime context is linked from `THUNDER_LINKS.md`. The main Thunder note is `../thunder-brainstorm/generated/session_learnings/2026-06-08_infinite_brutality_prototype_lessons.md`. Read it before changing level generation, movement feel, visual language, or lighting.

Level-design workflow is split in two places:

- general workflow: `../thunder-brainstorm/generated/skills/level_design_environment_grammar.md`
- project-specific workflow: `docs/LEVEL_DESIGN_WORKFLOW.md`
- realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`
- district graph implementation plan: `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`

When a level-design pass produces a durable critique/fix pattern, update the general Thunder note if it generalizes and this project-local note if it is Infinite Brutality-specific.

Before combat changes, also read `docs/COMBAT_BRINGUP_PLAN.md`. That note captures the Gravity Fist-derived combat contract: explicit attack ownership, permission gating, one active hit window, stateful hurt reaction, and no reseat on ordinary room changes.

If the runtime starts ignoring a `.poseclip.json` attack clip, check the asset path first. Pose clips should be loaded from the project asset URL directly, not by resolving through `import.meta.url`.

Before making changes:

1. Explain the problem.
2. Explain the likely cause.
3. List files involved.
4. Propose a solution.
5. Wait for approval.

Before changing anything:

- Explain the smallest possible change that solves the problem.
- Prefer modification over replacement.
- Prefer extension over refactor.
- Prefer local fixes over global changes.
