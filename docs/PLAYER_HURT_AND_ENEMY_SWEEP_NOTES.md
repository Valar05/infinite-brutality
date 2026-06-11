# Player Hurt And Enemy Sweep Notes

Date: 2026-06-11
Build: 0.8.117

## Status

Enemy melee damage is live in the normal runtime. It is not gated behind `?attacklab=1` or `?attackdebug=1`. Those URL flags only add deterministic test setup and readable telemetry.

The runtime now also has a visible player damage response on the FPS arms:

- hurt clip: `FistInjuredRight`
- fallback short impact clips: `FistBlockHitLeft`, `FistBlockHitParry`
- recover clip: `FistReadied`
- steady-state idle after recovery: `FistReady`

## Enemy Attack Damage Model

The enemy attack path now uses the animated hand sweep instead of a pure distance timer gate.

Current contact query:

- previous frame enemy hand world position
- current frame enemy hand world position
- player body treated as a vertical capsule
- closest-distance check between hand travel segment and player capsule spine
- hit threshold = player capsule radius + attack sweep radius

That query is implemented in `sweepEnemyAttackHitsPlayer(...)`.

## Important Debugging Distinction

If the Orc seems to shove away while attacking, that is not the sweep query having physical collision. The sweep is math only. Physical separation still comes from the close-range player/enemy non-overlap logic.

This matters because the visible attack sweep can look correct while body-separation still changes spacing during the dash. When debugging attack misses, do not confuse:

- attack sweep query
- player/enemy body separation
- debug visuals

## Why Attack Lab Exists

`?attacklab=1` exists only to remove the normal orbit/retreat behavior and repeatedly stage the Orc in a fixed close setup.

`?attackdebug=1` exists only to show:

- larger attack timing HUD
- pre-dash and post-dash sweep traces
- actual player damage capsule
- sweep history that lingers long enough to read

These modes are for diagnosis, not for enabling the real combat path.

## FPS Arms Clip Selection Rule

For FPSPlayer-style GLB rigs, do not guess from aliases first. Enumerate the actual embedded action list from the GLB and choose from the real clip inventory.

Relevant embedded actions confirmed from `FPSPlayer.glb` for player damage/restart are:

- `FistInjuredRight`
- `FistBlockHitLeft`
- `FistBlockHitParry`
- `FistReadied`
- `FistReady`

Observed durations during inspection:

- `FistInjuredRight`: `0.667s`
- `FistBlockHitLeft`: `0.375s`
- `FistBlockHitParry`: `0.375s`
- `FistReadied`: `0.542s`
- `FistReady`: `1.250s`

## Open Follow-Up

The FPSPlayer set still does not contain a real death clip. If first-person death is needed, import or author a dedicated arms/camera drop rather than abusing an attack or block animation.
