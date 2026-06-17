# Infinite Brutality

Three.js landscape mobile prototype for a first-person melee/platformer roguelike set in Limbo.

## Run

From the parent `GodotProjects` workspace, serve the workspace root and open:

```sh
sh ./tools/start_local_server.sh
```

```text
http://127.0.0.1:8798/infinite-brutality/index.html
```

Use `sh ./tools/status_local_server.sh` to check it and `sh ./tools/stop_local_server.sh` to stop it.

## Current Build

Build `0.8.175` keeps sedimentary meshes manifold while adding deterministic visual weathering so sandstone corners shear off the cube grid without changing collision.

## Validation

```sh
node --input-type=module --check < src/main.js
node --input-type=module --check < src/generated_room_batch.js
python3 -m json.tool assets/asset_manifest.json >/dev/null
python3 -m json.tool data/room_junction_batch.json >/dev/null
python3 -m json.tool data/level_route_templates.json >/dev/null
```
