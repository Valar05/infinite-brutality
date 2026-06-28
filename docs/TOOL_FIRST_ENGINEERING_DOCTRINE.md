# Tool-First Engineering Doctrine

When a task enters a solved hard domain, propose useful tools proactively.

Assume the user wants leverage unless they explicitly ask for from-scratch work,
no new dependencies, or a deliberately minimal experiment.

## Rule

Do not hard-mode implementation with bespoke code when a mature tool, library,
engine feature, CLI, harness, or workflow would remove risk and make the work
easier.

Custom code is allowed, but it must be justified. The default move is to ask:

- What tool already solves this class of problem?
- What risk does it remove?
- What integration cost does it add?
- Is the tool a better default than another local abstraction?

## Applies To

- physics and collision
- visual QA and browser/device capture
- profiling and performance diagnosis
- procedural generation validation
- asset import and provenance
- animation, rigging, and retargeting
- deployment, CI, and release automation
- content validation and schema enforcement

## Infinite Brutality Implication

For terrain contact, player collision, climbing, slopes, and stable ground
movement, do not keep inventing JavaScript contact physics.

Use a real physics/collision layer when the game needs mesh colliders, capsule
movement, slope handling, contact normals, ray casts, or stable terrain contact.
Prefer a proven browser-compatible physics layer over custom triangle tests in
the frame loop.

## Proposal Format

When proposing a tool, be concrete:

- recommended default
- what pain it removes
- why it beats custom code
- integration cost
- risks or tradeoffs
- smallest verification step

The point is not dependency sprawl. The point is using leverage before the
project spends time debugging infrastructure that should have been outsourced.
