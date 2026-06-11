# Orc Hit Reaction Plan

Current runtime import uses three authored reaction clips:

- `react_body_center.poseclip.json`: center-mass impact
- `react_head_left_turn.poseclip.json`: enemy left side, player right, stronger turning head hit
- `react_head_right.poseclip.json`: enemy right side, player left, lighter head hit

## First Pass Landed

The game now does a lightweight selector at melee impact time:

1. Cache one overall Orc hitbox from the imported standing-idle rig in model-local space.
2. Use the live camera aim vector, not only flat attack yaw.
3. Project that aim to the enemy distance, transform the predicted impact into model-local space, and clamp it into the overall hitbox so every confirmed hit lands somewhere inside it.
4. Interpret the clamped point inside that one hitbox: normalized height drives `head` vs `body`, and centered local X drives side selection.
5. Pick body-center or one of the two head reactions, and interrupt the Orc's current attack so the hurt clip can read.

## Next Hitbox Steps

1. Replace the current cone-like melee check with a real short-range sweep or ray/capsule query that returns an explicit impact point.
2. Keep the single overall hitbox, but add more interpretation bands inside it: upper head, lower head, upper torso, lower torso, left shoulder, right shoulder.
3. Add missing mirrored clips so head-center and body-side impacts do not borrow the wrong authored side.
4. Let attack defs bias reactions by move type: uppercut/head-focused, straight/body-focused, crouch/low-body.
5. Preserve `lastHitReaction`, `lastHitZone`, and `lastHitLocalX/Y` for debug readout so screenshot/video critique can verify selector quality quickly.

## Missing Authoring Coverage

To finish directional hurt convincingly, the Orc still needs:

- head center
- body left
- body right
- low body / gut fold
- stronger death-specific knockback or collapse clips
