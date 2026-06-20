# Project Manifest: infinite-brutality

- Generated: 2026-06-20T17:47:30-05:00
- Workspace path: `/storage/emulated/0/Documents/GodotProjects/infinite-brutality`
- Git repository: yes
- Git remote: `https://github.com/Valar05/infinite-brutality.git`
- Orientation: `PROJECT_ORIENTATION.md`
- Agent instructions: `AGENTS.md`

## Purpose Snapshot
> # Infinite Brutality Prototype
> Three.js landscape mobile prototype for a first-person melee platformer roguelike set in Limbo, a low-poly nightmare realm where violence has become geography.
> ## Entry Point
> - `index.html`: browser entry shell.
> - `src/main.js`: runtime, controls, generated room-batch builder, camera-space FPV arms, footsteps, and attack loop.
> - `src/generated_room_batch.js`: generated 48-room batch module derived from `data/room_junction_batch.json`.
> - `src/styles.css`: mobile landscape HUD and touch controls.
> - `assets/models/FPSPlayer.glb`: copied from Pose Lab as the first-person arm and animation source.
> ## Run
> From `/storage/emulated/0/Documents/GodotProjects`, serve the workspace root and open:
> `http://127.0.0.1:8798/infinite-brutality/index.html`
> The prototype expects to be served from the GodotProjects workspace root.
> ## Validation
> ```sh
> node --input-type=module --check < src/main.js
> python3 -m json.tool assets/asset_manifest.json >/dev/null
> ```
> ## Current World Policy

## Entrypoints And Validation Clues
- `src/main.js`

## Top-Level Inventory
- `.gitattributes`
- `.gitignore`
- `.tmp/`
- `AGENTS.md`
- `assets/`
- `data/`
- `docs/`
- `index.html`
- `LEVEL_GENERATION_CONTRACT.md`
- `Meshy_AI__0615135730_texture (1).png`
- `Meshy_AI__0615135730_texture_emission.png`
- `Meshy_AI__0615135730_texture_metallic (1).png`
- `Meshy_AI__0615135730_texture_normal.png`
- `Meshy_AI__0615135730_texture_roughness (1).png`
- `node_modules/`
- `PROJECT_MANIFEST.md`
- `PROJECT_ORIENTATION.md`
- `README.md`
- `src/`
- `THUNDER_LINKS.md`
- `tools/`

## Git Hygiene
- `.gitignore` contains a Codex workspace hygiene block for credentials, caches, and local build outputs.
- `.gitattributes` contains a Codex Git LFS block for common binary assets, models, audio, video, archives, fonts, and PDFs.
- `git lfs install --local` was attempted for this repository during the manifest pass.
