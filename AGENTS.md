# AGENTS.md

Scope: entire repository.

## Goal

Keep Codex context small. Read the minimum number of docs needed for the current change, then work from the canonical source of truth instead of re-reading adjacent notes.

## Entry Points

- Start with `PROJECT_ORIENTATION.md` for repo routing, current world policy, and active workflow constraints.
- Use `README.md` only for the local serve URL and baseline validation commands.
- For local play, prefer `sh ./tools/start_local_server.sh` over ad hoc `python -m http.server` so the server survives shell/session loss.
- Use `THUNDER_LINKS.md` only when the task explicitly needs Thunder Brainstorm context.

## Routing

Read extra docs only when the change actually touches that area:

- `docs/DISTRICT_RUNTIME_CONTRACT.md`: district generation, room fitting, support snapping, connectors, spawns, enemy traversal.
- `docs/ROCK_SHAPE_GRAMMAR.md`: floating terrain, island silhouettes, geological grammars, rock/architecture fusion, and terrain readability.
- `docs/COMBAT_BRINGUP_PLAN.md`: attack logic, hurt logic, combat ownership, combat sequencing.
- `docs/PROP_DECORATION_MANIFEST.md` and `data/prop_decoration_manifest.json`: prop families, district prop sets, decoration policy.
- `docs/LEVEL_DESIGN_WORKFLOW.md`: level-design process and critique workflow.
- `docs/NOOK_STORY_WRITING_SYSTEM.md`, `docs/NOOK_STORY_PLACEMENT_RULES.md`, `docs/NOOK_NARRATOR_VIBE.md`, `data/nook_story_seed.json`, and `data/nook_story_placement_rules.json`: corpus-backed environmental writing, narrator voice rules, district nook placement sets, survivor cultures, and story-fragment generation rules.

## Change Discipline

- Prefer local edits over broad refactors.
- For new durable runtime pieces, prefer object-oriented or factory-scoped stateful modules over adding more free functions and globals to `src/main.js`.
- Preserve the single-family Hanging Gardens world policy unless the user explicitly changes it.
- If a task crosses runtime-contract boundaries, update the relevant contract doc in the same pass.
- If a new durable prop family, district rule, or validation rule is introduced, update the matching manifest or doc instead of leaving it implicit in code.
- For first-person arms and Meshy characters, preserve PBR map authority: diagnose lighting, UV transform, material scalars, and render-pass setup before reducing normal/roughness/metalness contribution.
- For sandstone, cliff, island, or bridge terrain screenshots, treat crisp cube-grid silhouettes as a geometry failure even when manifold tests pass. Preserve the collision field, but add deterministic visual weathering/shear to the emitted mesh before trying texture-only fixes.
- Do not accept browser screenshots with stale build labels. Hard-refresh or bump the cache token until the screenshot proves it is rendering the current build.
- For browser-visible visual regressions, use the workspace visual QA harness before diagnosis when possible: `node ../tools/visual_qa.mjs --project infinite-brutality --url /infinite-brutality/index.html --frames 12 --interval-ms 500`. Treat harness failures as capture failures, not visual proof.

## Validation

Run the smallest relevant checks after edits:

- Runtime JS: `node --input-type=module --check < src/main.js`
- Generated room batch JS: `node --input-type=module --check < src/generated_room_batch.js`
- Asset manifest: `python3 -m json.tool assets/asset_manifest.json >/dev/null`
- Data manifests: `python3 -m json.tool data/room_junction_batch.json >/dev/null`
- Route templates: `python3 -m json.tool data/level_route_templates.json >/dev/null`
- Prop manifest: `python3 -m json.tool data/prop_decoration_manifest.json >/dev/null`
- Rock grammar: `node tools/test_rock_grammar_contract.mjs`
- Island mesh integrity: `node tools/test_island_mesh_integrity_contract.mjs`
- Scene geometry budget: `node tools/test_scene_geometry_budget.mjs`
- Visual QA dry-run: `node ../tools/visual_qa.mjs --project infinite-brutality --dry-run`

Run only the checks that match the files you changed, unless the user asks for a broader sweep. For terrain silhouette or sandstone-weathering changes, run the three terrain checks above together.
