# Enemy Attack Hand Sweep Plan

Use a per-frame swept hit volume from the attacking hand instead of the current distance-only damage check.

## Goal

Make enemy melee damage come from the animated weapon hand path during a short active window, so hits only land when the swing actually crosses the player capsule.

## Current Problem

Current enemy damage is driven by timer plus range:

- attack enters windup
- during a broad active span, if player distance is close enough, damage lands once
- hand position and swing path do not matter

That makes attacks feel detached from the animation and prevents clean tuning for whiffs, near-misses, and side-step escapes.

## Proposed Runtime Model

### 1. Author an attack contact window per clip

For each enemy attack clip, store:

- `active_start_norm`
- `active_end_norm`
- `sweep_radius`
- `damage`
- `knockback`
- optional `hand_bone`

Default first pass for the current horizontal attack:

- `active_start_norm = 0.70`
- `active_end_norm = active_start_norm + 0.05 / clipDuration`

If the clip frame count reads better than normalized time, derive the same window from exact clip frames and convert to normalized time at load.

### 2. Track hand bone world position every frame

During enemy attack update:

- resolve the attacking hand bone once from the imported rig
- record previous frame hand world position
- record current frame hand world position after mixer update
- only run damage logic while clip time is inside the active window

### 3. Sweep between previous and current hand positions

Each active frame:

- build a segment from `prevHandWorld` to `currHandWorld`
- test that segment against the player capsule or player vertical cylinder
- expand the segment by `sweep_radius`
- if the sweep crosses the player and this attack has not already dealt damage, apply hit

This is effectively a boxcast/capsule sweep between animation samples.

### 4. Use player capsule, not point distance

Player target should be the same close-range body used for movement collision:

- capsule center from player world position
- radius from current player collision radius
- vertical extent from eye height / body height

That keeps attack hit logic aligned with actual collision expectations.

### 5. One hit per attack by default

Per attack instance:

- `attackHasHit = false`
- once a sweep lands, set `attackHasHit = true`
- do not reapply until a new attack instance starts

Later, multi-hit attacks can opt into additional windows.

## Data Shape

Add an enemy attack definition table near current attack constants.

Example shape:

```js
const ENEMY_ATTACK_DEFS = {
  attackHorizontal: {
    handBone: 'mixamorigRightHand',
    activeStartNorm: 0.70,
    activeDuration: 0.05,
    sweepRadius: 0.22,
    damage: 1,
    knockback: 1.65,
  },
};
```

At runtime, convert `activeDuration` seconds into normalized end using current clip duration.

## Implementation Steps

1. Resolve and cache attack hand bone on enemy model load.
2. Add `enemy.userData.attackPrevHand`, `attackCurrHand`, `attackHasHit`, and `attackDefKey`.
3. On `startEnemyAttack()`, initialize the selected attack definition and reset sweep state.
4. In `updateEnemyEngagement(dt)`, after mixer pose update, sample hand world position each frame.
5. During the active window only, run swept segment vs player capsule test.
6. Replace the current distance-only damage gate with the sweep result.
7. Keep current feedback stack on successful hit: pulse, knockback, thud, future blood/stagger hooks.

## Collision Test Plan

First pass collision test can stay lightweight:

- closest point on segment to player capsule line
- compare horizontal distance to capsule radius plus sweep radius
- compare vertical overlap against capsule top/bottom

If needed later, promote to a proper capsule-vs-segment distance test.

## Debug Requirements

Add optional debug only under a URL flag such as `?attackdebug=1`:

- line from previous to current hand position
- active window color change
- small sphere at current hand point
- hit flash when sweep connects

Do not leave this visible by default.

## Acceptance Criteria

- enemy can visibly whiff if the hand path misses the player body
- stepping outside the swing arc prevents damage even at similar range
- damage lands when the swing passes through the player capsule during the active frames
- active window is clip-driven, not a broad timer guess
- future enemy attacks can tune their own hand, window, and sweep radius independently

## Suggested Next Slice

Implement only `attackHorizontal` with one right-hand sweep first. Do not generalize to both hands or weapons until the first contact path is verified in live play.
