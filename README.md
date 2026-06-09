# Infinite Brutality

Three.js landscape mobile prototype for a first-person melee/platformer roguelike set in Limbo.

## Run

From the parent `GodotProjects` workspace, serve the workspace root and open:

```sh
python3 -m http.server 8798
```

```text
http://127.0.0.1:8798/infinite-brutality/index.html
```

## Current Build

Build `0.8.19` adds the imported mutant/orc FBX enemy skin and animation set on top of the void-defined room and softened movement work.

## Validation

```sh
node --input-type=module --check < src/main.js
node --input-type=module --check < src/generated_room_batch.js
python3 -m json.tool assets/asset_manifest.json >/dev/null
python3 -m json.tool data/room_junction_batch.json >/dev/null
python3 -m json.tool data/level_route_templates.json >/dev/null
```
