# Infinite Brutality Combat Bring-Up Plan

Use this note as the stable contract for introducing combat without reintroducing the enemy flicker / repeated hurt regression.

## Source Pattern

Gravity Fist shows the pattern to copy:

- attack ownership is explicit, not emergent
- attack permission is gated by state
- hitboxes arm on a timeline, not from raw proximity
- damage carries context
- hurt reactions are stateful overlays, not a base-pose takeover
- attack stalls can block reassignment

Reference targets:

- `../gravity-fist/scenes/ai_conductor.gd` for attack ownership, permission, stall release, and reassignment blocking
- `../gravity-fist/scripts/player.gd` for attack timeline, hitbox arming, damage context, knockback, and hurt reaction handling
- `../gravity-fist/scenes/world.gd` for move timing fields such as `dash_start` and `attack_end`

## Imported Clip Rule

- Pose clips live under `assets/models/.../*.poseclip.json` and must be fetched from the project asset path directly.
- Do not resolve them through `import.meta.url` or a `src/`-relative URL; that can silently point at the wrong file location.
- If a new attack clip appears to be missing, verify the asset path before changing the attack FSM.

## Infinite Brutality Contract

Combat must be introduced in layers. Do not let attack, hurt, movement, and room placement all change in the same slice.

### 1. Baseline

- Keep enemy locomotion working with combat off.
- Keep room placement stable.
- Keep player pose stable.
- Keep route generation separate from combat feedback.

### 2. Attack Ownership

- Only one enemy owns an attack opportunity at a time.
- Ownership must be explicit, not implied by distance.
- Reassignment must be blocked after stalls or damage lockouts.

### 3. Attack Permission

- Enemies in flee, wound, death, or stall lockout states cannot start attacks.
- Attack permission should be a separate query, not a proximity branch.
- A far enemy may be visible and chasing without being allowed to attack yet.

### 4. Attack Timeline

- Every attack needs a committed sequence:
  - windup
  - active frame
  - recover
- The hitbox or contact trace must only exist during the active frame.
- Do not use “in range now” as the whole attack rule.

### 5. Damage Context

- Damage should be delivered with a context payload.
- Include at minimum:
  - move name
  - source move name
  - knockback / impulse
  - knockdown or stomp flags when relevant
  - bleed or impact damage when relevant

### 6. Hurt Reaction

- Hurt animation is an overlay, not a replacement for the base locomotion pose.
- Hurt must not restart every frame.
- Hurt should produce a clear invulnerability window so it cannot spam frame 0.

### 7. Feedback Stack

- Add hitstop, shake, FOV kick, blood/sparks, and audio only after the hit contract is stable.
- Feedback should amplify a valid hit, not stand in for the hit contract.

### 8. Death

- Death can be backward launch / tumble / despawn.
- Add it after the hit loop is stable.
- Do not let death physics share state with attack timing.

### 9. Room Separation

- Room rebuilds must not reseat the enemy every time a room changes.
- Combat must not own room placement.
- Room transitions must not reset hurt or attack state unless the level is resetting.

## Failure Rules

If any of these happen, stop and re-balance before adding more combat layers:

- enemy visibly flickers or teleports
- hurt animation restarts at frame 0 repeatedly
- player takes damage with no believable attack commit
- combat changes also change room placement
- route/planning code starts rebuilding because of a hit event

## Suggested Bring-Up Order

1. locomotion only
2. explicit attack owner
3. attack windup and one hit window
4. damage context and single hit application
5. hurt overlay and invulnerability
6. impact juice
7. death behavior

## Validation

Prove each layer before adding the next:

- movement-only enemy stays in-world and does not reseat
- one attack owner, one attack start, one hit
- hurt overlay does not restart while invulnerable
- feedback stack does not affect position or attack timing
- room transitions do not create combat resets
