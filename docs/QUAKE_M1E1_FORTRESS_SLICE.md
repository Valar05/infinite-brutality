# Quake M1E1 Fortress Slice

Status: first playable route target.

The default runtime slice is now `quake_m1e1_slice`. It is a compact fortress-rock route built from primitive rooms first, with TerrainLayer used for supporting rock foundations and void borders.

## Route

`start casemate -> battery court -> locked gate face -> key trench branch -> upper overlook -> optional secret ledge -> final gun room -> exit`

The direct gate is intentionally static and blocked. The side trench bypasses it, climbs to the upper overlook, then loops the player back above the earlier route before the final gun room.

## Runtime Contract

- Default load uses `quake_m1e1_slice`.
- `?slice=generated` preserves the previous generated gauntlet path.
- The slice bypasses broad district island emission.
- TerrainLayer remains authoritative for terrain stamps and support rock.
- Primitive blockout geometry owns the room read first.
- Every room declares a combat purpose and route sentence.

## Acceptance

- Player can describe the route after one pass.
- At least one locked gate creates anticipation.
- A side branch bypasses the gate.
- An upper overlook shows a previous route from above.
- At least one optional secret ledge exists.
- Final room contains combat pressure before the exit.
