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

## Current World Policy

- The runtime currently defaults to one architectural family for the whole run: `hanging_gardens`.
- There should not be a visually separate fallback biome in the same run while the proof pass is still in progress.
- District purpose can still vary, but the visible world should stay inside the same ancient layered family until the room kit itself has been fully converted.
- If screenshots read like mixed biomes again, treat that as a generator regression, not acceptable variation.

## Level Generation

- `LEVEL_GENERATION_CONTRACT.md`: current route-grammar rules for Quake-style level generation without copied Quake layouts.
- `src/carved-voxel-fortress-slice.js`: current default playable slice direction. It starts from one solid voxel mass and carves the fortress route as negative space.
- `src/district-intent-planner.js`: district identity planner for memorable place reads. It selects purpose, required phrases, assemblies, logistics, skyline, silhouette, and traversal identity before carved geometry is emitted.
- `src/district-assembly-emitter.js`: district assembly emitter for turning intent into supported visible structures. The first implemented slice is the Imperial Foundry process chain.
- `tools/quake_geometry_ingest/`: neutral geometry ingestion experiment that extracts Quake-style spatial structure into Infinite Brutality-owned room graphs, voxels, and debug outputs.
- `tools/assembly_workbench.html`: static local workbench for reviewing district assembly support chains without booting the full game.
- `tools/ib_doctor.sh`: one-command local validation for cache-bust consistency, key contracts, and tmux server health.
- `docs/QUAKE_M1E1_FORTRESS_SLICE.md`: default first playable fortress-rock slice, with the old generated gauntlet preserved by `?slice=generated`.
- `data/level_route_templates.json`: generator-facing route template contract.
- `data/room_junction_batch.json`: overnight batch list of room prompts by connector topology.
- `docs/ROOM_JUNCTION_BATCH_LIST.md`: human-readable room junction build list.
- `docs/ROOM_BATCH_IMPLEMENTATION.md`: runtime wiring notes for the generated room sequence.
- `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`: district-level route graph and implementation status.
- `docs/DISTRICT_RUNTIME_CONTRACT.md`: authoritative runtime contract for district build order, skeleton geometry, support snapping, spawns, and enemy traversal.
- `docs/ROCK_SHAPE_GRAMMAR.md`: terrain shape grammar for floating geological fragments, readable island silhouettes, and rock/architecture fusion.
- `docs/TERRAIN_GENERATION_TECHNIQUES.md`: implementation map of current and historical terrain generators still present in code.
- `docs/IMPERIAL_FLOATING_STRATA_GRAMMAR.md`: Napoleon's Floating Kingdom terrain grammar, district archetypes, forbidden outputs, mobile constraints, and TerrainLayer ownership notes.
- `docs/TOOL_FIRST_ENGINEERING_DOCTRINE.md`: tool-first engineering rule for hard domains; propose proven tools before hand-rolling physics, collision, profiling, visual QA, procedural validation, asset import, animation, deployment, or content validation infrastructure.

## Direction

Render the world normally, then render FPS arms in a separate camera-space pass so the player never sees chest/body intrusion. Keep the low-poly hard-edged source asset as the art direction seed rather than forcing a full-body textured rig into first person.


## PBR Rendering Contract

- First-person arms render in a separate camera-space `armsScene`, but their Meshy PBR maps are still authoritative. Do not hide a flat-looking arm problem by weakening the normal, roughness, or metalness maps.
- The current FPSPlayer overlay uses `FPSPLAYER_MESHY_VISUAL_OVERLAY` in `src/main.js`: external albedo, normal, roughness, metallic, and emission textures, plus a UV transform that targets the usable atlas region.
- The island rocks use the readable Meshy-derived rock PBR set in `src/materials.js`; if rocks read correctly but arms look flat, compare lighting/material response before blaming the texture files.
- Screenshot validation is required for foreground arms because parse checks cannot prove visible PBR response. For browser-visible regressions, the workspace visual QA harness can launch a no-store Android capture run and collect frame sheets via `node ../tools/visual_qa.mjs --project infinite-brutality --url /infinite-brutality/index.html`.

## Thunder Brainstorm

Durable design/runtime context is linked from `THUNDER_LINKS.md`. The main Thunder note is `../thunder-brainstorm/generated/session_learnings/2026-06-08_infinite_brutality_prototype_lessons.md`. Read it before changing level generation, movement feel, visual language, or lighting.

Level-design workflow is split in two places:

- general workflow: `../thunder-brainstorm/generated/skills/level_design_environment_grammar.md`
- project-specific workflow: `docs/LEVEL_DESIGN_WORKFLOW.md`
- level-design bible: `docs/LEVEL_DESIGN_BIBLE.md`
- rock shape grammar: `docs/ROCK_SHAPE_GRAMMAR.md`
- imperial floating strata grammar: `docs/IMPERIAL_FLOATING_STRATA_GRAMMAR.md`
- realization plan: `docs/VERTICAL_DISTRICT_REALIZATION_PLAN.md`
- district graph implementation plan: `docs/DISTRICT_GRAPH_IMPLEMENTATION_PLAN.md`
- runtime contract: `docs/DISTRICT_RUNTIME_CONTRACT.md`
- prop decoration manifest: `data/prop_decoration_manifest.json`
- prop decoration guide: `docs/PROP_DECORATION_MANIFEST.md`
- hanging gardens texture prompts: `docs/TEXTURE_PROMPTS_HANGING_GARDENS.md`
- Pose Lab clip-gradient tool concept: `docs/POSE_LAB_CLIP_GRADIENT_EDITOR.md`

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

## Product One Controller Grid

- `controller-kata.html?seed=controller-proof` is the isolated playable controller surface; it loads the authoritative `src/main.js` controller path.
- `src/product-one-controller.js` owns Product One input normalization, fixed-tick movement, queued jump commit, Rapier contact selection, and the no-CLIMB transition into constrained mantle motion. `src/player-climb.js` remains the shared owner of mantle planning and interpolation.
- `src/controller-kata.js` consumes the pinned, data-only `src/generated/product-one-mantle-course.mjs` emitted by Boxcraft commit `b4ff8625a0981ed39eb6d25a6ba88642b974e9b4`, course hash `b4fbadc14e0b5be04285e02a21e361a5666d917b989bb99753b379f2cdfff969`.
- Mantle eligibility is generic to actual walkable cuboids resolved through `src/physics-world.js`: a successful queued jump must still be rising when a real facing wall contact enters the player-relative feet-to-lip reach window, with support and body clearance. There is no authored-box height category or privileged mantle fixture.
- `tools/qa_product_one_controller_simulator.mjs` mounts the exact page-owned arena records and proves the legacy low edge/stairs, Boxcraft step/low/high/impossible controls, and a qualifying seeded random cuboid through the shared controller. The global `.qa` case binds deterministic positive assertions and anti-vacuity controls.
- Local syntax, contract, simulation, and HTTP checks are guardrails. Visible acceptance remains the user's play verdict; do not substitute a simulator or source marker for pixels.
- `src/product-one-input-adapter.js` is the shipped input boundary used by both `src/main.js` and the robustness harness. The global QA engine derives the HTML/ESM dependency graph, requires runtime move/jump/step traces from that adapter, and generates partial-stick, approach-angle, jump-window, and irregular-frame samples from declarative ranges. The idealized controller simulator is diagnostic only; it cannot green a handoff by itself.
- The Boxcraft high-mantle scenario is the proof's playable spawn so the required cuboid is discoverable without teleporting a test. Its normalized mantle timing window is contact through half of the source-owned 4m clear approach; a jump earlier than that can physically clear the box and is a separate, safe negative control.
- Product One reuses the existing Infinite Brutality arms load/update/render path and mantle action for visible constrained motion. Machine QA is labeled guardrail-only with `visual_acceptance: false`; the user's play verdict remains acceptance.
