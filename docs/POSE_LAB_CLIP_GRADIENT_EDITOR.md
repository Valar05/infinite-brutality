# Pose Lab Clip Gradient Editor

## Purpose

Extend Pose Lab's video-like animation editor with a clip-gradient tool for one rig.

The user should be able to treat source clips like editable motion strips:

- keep the first part of clip A
- blend into clip B
- hold or stitch a middle section from clip C
- blend back to A or out to D
- smooth-delete or compress unwanted motion without creating a hard pop

This is not a generic timeline editor.

It is a same-skeleton motion blender optimized for mobile iteration.

## Core Mental Model

The existing video editor model is the right starting point:

- clips are strips on a timeline
- transitions are visible ranges, not hidden math
- destructive edits should feel like trimming, cutting, and smoothing video

The new tool should add one new primitive:

- a `blend segment`

A blend segment is a gradient between motion sources, not just a cut.

## Primary Operations

### 1. Smooth Delete

Current need:

- remove a section of motion and reconnect the remaining animation cleanly

Behavior:

- user marks an in and out range inside one clip or a stitched sequence
- tool deletes the interior range
- tool automatically creates a blend bridge from the retained left edge to the retained right edge
- user adjusts blend width and bias

This is the animation equivalent of ripple delete plus dissolve.

### 2. A to B Blend

Behavior:

- clip A plays
- blend region begins
- tool crossfades pose, root transform, and optional additive channels into clip B
- clip B takes over fully after the blend

### 3. A to B to A Sandwich

Behavior:

- clip A enters
- blend into B
- keep a selected middle window of B
- blend back to A

Use case:

- borrow one recovery beat, anticipation, recoil, or hand pose from another clip without rebuilding the whole take

### 4. Stitch Middle Section

Behavior:

- trim a middle section from source clip C
- place it between A and B
- auto-create left and right blend ramps

Use case:

- reusing only the readable middle contact phase of a motion

### 5. Weight Paint Over Time

Behavior:

- user edits blend strength as a curve across time
- can bias the blend to:
  - ease in fast / out slow
  - stay mostly on source A with a small B influence
  - spike only during one beat

This is why the “gradient editor” framing is right.

## Data Model

Each edited motion should be representable as a stack of timeline segments:

- `clip segment`
  - source clip id
  - in time
  - out time
  - playback speed
  - optional reverse
- `blend segment`
  - left source reference
  - right source reference
  - duration
  - weight curve
  - root mode
  - channel mask
- `hold segment`
  - frozen pose or short sampled loop
  - optional easing in and out

Output should remain exportable to a normal clip or pose-lab sequence file.

## Blending Rules

### Pose blending

Default:

- quaternion slerp per bone
- position lerp only for bones allowed to translate

### Root blending

Need selectable modes:

- `pose only`
  - ignore root motion, use destination track or locked root
- `match left`
  - preserve clip A root continuity
- `match right`
  - align to clip B landing/root state
- `blend root`
  - interpolate root transform across the blend

### Channel masks

Critical for usefulness.

User should be able to blend only:

- upper body
- lower body
- spine + arms
- left arm only
- right arm only
- root + hips only

This makes the tool useful for first-person arms, combat recoveries, and locomotion repair.

## Mobile UI Principles

This must work as a phone-first tool.

### Layout

Use a stacked mobile editor:

1. viewport
2. compact transport row
3. clip strip timeline
4. contextual inspector drawer

### Timeline interaction

Need big touch targets.

Controls:

- drag segment left/right
- trim left handle
- trim right handle
- drag blend ramp handles
- tap segment to open inspector
- pinch timeline to zoom
- two-finger pan timeline

### Blend visualization

Do not show blend as tiny icons.

Show it like a gradient wedge between clips:

- left clip block
- sloped overlap band
- right clip block

For A-B-A shapes, show:

- clip A
- fade wedge
- clip B core
- fade wedge
- clip A

The user should understand the motion structure at a glance.

### Smooth Delete UI

Flow:

1. scrub to range
2. mark in/out
3. tap `Smooth Delete`
4. tool removes the range
5. auto-creates a bridge
6. user adjusts bridge width with one slider or direct drag

This should be faster than manual cut/blend/retrim.

### Inspector

Segment inspector should expose only the relevant controls.

For clip segments:

- source clip
- trim in/out
- playback rate
- reverse
- loop hold

For blend segments:

- duration
- curve type
- root mode
- channel mask
- preview toggle for left/right source ghosting

## Video-Editor Inspiration

Borrow the interaction language of mobile video editors:

- timeline strips
- overlap transitions
- pinch zoom
- ripple delete
- blade/cut tool
- undo stack
- quick preview loops around the edit point

But adapt for animation-specific needs:

- pose continuity matters more than frame dissolves
- root motion can drift and needs explicit policy
- per-bone masks matter
- timing needs sub-second precision around impacts and contacts

## Preview Modes

Need three fast preview modes.

### 1. Local loop preview

- loop only around the selected transition
- default for edit work

### 2. Before/after A-B compare

- toggle raw cut vs blended version
- proves the edit actually improved the motion

### 3. Ghost source overlay

- faint source-pose ghosts during a blend
- helps see whether a hand, foot, or weapon arc is drifting badly

## First-Person Specific Use Case

For FPS arms, this tool is especially valuable.

Examples:

- splice a better anticipation from one punch into another
- smooth-delete dead recovery frames
- blend into climb hold cleanly
- borrow only the middle contact from one mantle animation
- preserve lower root lock while replacing upper body action

This is better than whole-clip replacement because first-person readability usually depends on a few frames.

## Recommended First Slice

Build only this first:

1. same-rig timeline with clip segments
2. cut and trim
3. smooth delete
4. A-B blend segment with duration handles
5. local loop preview
6. export merged sequence

Do not start with:

- multi-rig retargeting
- huge curve editors
- full NLE track stacks
- per-bone graph editing UI

## Second Slice

After the first slice works:

1. A-B-A sandwich editing
2. channel masks
3. root blend modes
4. frozen hold segment
5. ghost overlay preview

## Success Test

The tool is good if a mobile user can:

- remove a bad animation section in under 10 seconds
- replace a middle beat from another clip without desktop tooling
- preview the repaired transition immediately
- export a cleaner combined motion for runtime use

If it still feels like traditional animation software, it is too heavy.

It should feel like mobile video editing for motion repair.
