# Fleshpunk lineart training

This manifest-driven lane continues the verified `drw_fleshpunk_v1.safetensors` into P0 maze assets. Run order is fixed: generate SVG references, rasterize with pinned Inkscape on THECAULDRON, train from grouped asset families, render fixed-seed recreations, run `REGNET QA JUDGMENT JAR 1`, then ask for user acceptance.

The Windows scripts write only under `%LOCALAPPDATA%\FleshpunkCauldron` and `C:\Users\dclar\workspace\fleshpunk-maze-training`. The poisoned Venice runtime is never executed; only the specifically permitted LoRA file is copied after before/after hashing.

`run-overnight.ps1` uses a portable lock directory and atomic state at `state/latest.json`. A duplicate or recovered run fails closed. Training checkpoints are saved every 150 steps, and the model cannot approve its own output.

## Current durable gate

Google Drive source is materialized as 20 PNG/caption pairs. Provider sizes and PNG decode pass; all legacy manifest digests are preserved as stale mismatches. `preprocess_lineart.py` deterministically emits binary ink, selects eight separated mechanical plates, quarantines twelve dense/photo/blob plates, and adds one authored pressure-valve supplement.

THECAULDRON regenerates the same nine decoded pixel plates. `configure-task.ps1` binds the existing midnight task to this projection. Training cannot begin while `user-acceptance.json` is unsigned. After a checkpoint, `review_campaign.py` renders a fixed-seed recreation and one-factor mutation, `regnet_judge.py` scores the triptych, and Boxcraft's `asset-review-cli.mjs` issues `APPROVE_INTERNAL`, `DENY_MUTATION`, or `WAIT_FOR_REGNET`; final acceptance always remains `USER_ONLY`.
