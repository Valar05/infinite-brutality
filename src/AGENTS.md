# AGENTS.md

Scope: `src/`

## Runtime Rules

- `src/main.js` is the authoritative runtime file. Extend existing systems before creating parallel ones.
- Keep changes scoped to the subsystem being touched: district runtime, combat, props, spawn/support, UI, or boot params.
- Do not mix combat bring-up with room-placement or district-geometry changes unless the user explicitly asks for a combined slice.

## District And Prop Work

- When editing district geometry or offsets, check `../docs/DISTRICT_RUNTIME_CONTRACT.md` first.
- When editing lift-court or other floor props, prefer support-aware placement over raw elevation-band guesses.
- If you add a new district prop type or district-specific prop rule, update `../data/prop_decoration_manifest.json` and `../docs/PROP_DECORATION_MANIFEST.md` in the same change.

## Combat Work

- When editing attack, hurt, or enemy engagement logic, check `../docs/COMBAT_BRINGUP_PLAN.md` first.
- Keep explicit ownership, permission gating, and one active hit window intact.

## Boot And Debug Links

- Keep URL boot params small and deterministic.
- If you add a new boot param, make sure it resolves before the first `buildRoom()` call and does not depend on uninitialized runtime constants.

## Validation

After `src/` changes, run `node --input-type=module --check < src/main.js`.
Also run `node --input-type=module --check < src/generated_room_batch.js` if the batch module or its imports changed.
