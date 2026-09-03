import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advanceDirectMantle, createDirectMantlePlan, generateControllerArena } from '../src/controller-kata.js';
import { createPhysicsWorld, ensurePhysicsReady } from '../src/physics-world.js';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const arena = generateControllerArena({ seed: 'controller-proof:0' });
const fixture = arena.directMantle;

await ensurePhysicsReady();
const physics = createPhysicsWorld({ gravity: { x: 0, y: -14.4, z: 0 }, autostepHeight: 0.62, autostepMinWidth: 0.646, snapToGround: 0.48 });
physics.addCuboid({ size: arena.floor.size, position: arena.floor.center, source: 'controller-kata-floor', kind: 'walkable' });
physics.addCuboid({ size: fixture.size, position: fixture.center, source: fixture.id, kind: 'walkable' });

let eyePosition = { x: arena.spawn[0], y: 1.68, z: arena.spawn[2] };
let contactMove = null;
for (let frame = 0; frame < 120; frame += 1) {
  const move = physics.movePlayer({
    eyePosition,
    desiredDelta: { x: 0, y: -0.24, z: 5.2 / 60 },
    eyeHeight: 1.68,
    radius: 0.38,
  });
  eyePosition = move.eyePosition;
  if (move.collisions.some((collision) => collision.isWall && collision.source === fixture.id)) {
    contactMove = move;
    break;
  }
}
assert.ok(contactMove, 'real Rapier forward motion must contact the bounded mantle fixture');
const plan = createDirectMantlePlan({
  fixture,
  eyePosition: [eyePosition.x, eyePosition.y, eyePosition.z],
  inputMoveY: 1,
  collisions: contactMove.collisions,
  eyeHeight: 1.68,
  playerMode: contactMove.grounded ? 'ground' : 'air',
  faceYaw: Math.PI,
});
assert.ok(plan, 'actual forward input plus the fixture wall contact must start a direct mantle');
assert.equal(plan.kind, 'controller-direct');
assert.equal(plan.contactSource, fixture.id);
assert.ok(plan.activationDistance >= -0.08 && plan.activationDistance <= fixture.maxActivationDistance);
assert.equal(plan.end[1], fixture.topY + 1.68);
assert.notEqual(plan.kind, 'climb');

let frame = null;
let steps = 0;
while (!frame?.complete && steps < 60) {
  frame = advanceDirectMantle({ ...plan, elapsed: frame?.elapsed || 0 }, 1 / 60);
  steps += 1;
}
assert.ok(frame?.complete, 'direct mantle must complete within its bounded duration');
assert.ok(steps <= Math.ceil(fixture.duration * 60) + 1);
assert.deepEqual(frame.position, plan.end);
assert.equal(createDirectMantlePlan({ fixture, eyePosition: plan.start, inputMoveY: 1, collisions: contactMove.collisions, playerMode: 'climb' }), null, 'Product One must reject CLIMB as a mantle precursor');
assert.equal(createDirectMantlePlan({ fixture, eyePosition: plan.start, inputMoveY: 0, collisions: contactMove.collisions, playerMode: 'ground' }), null, 'mantle must require real forward input');
assert.equal(createDirectMantlePlan({ fixture, eyePosition: plan.start, inputMoveY: 1, collisions: [], playerMode: 'ground' }), null, 'mantle must require the owned fixture contact');

assert.match(mainSource, /tryBeginControllerKataDirectMantle/, 'authoritative runtime must integrate the direct mantle adapter');
assert.match(mainSource, /if \(!useControllerKataSlice\(\) && tryBeginClimb/, 'Product One must bypass the general climb entry path');
assert.match(mainSource, /controller kata entered forbidden CLIMB state/, 'Product One must fail closed if CLIMB is ever entered');
physics.dispose();

console.log(JSON.stringify({
  ok: true,
  contract: 'product-one-direct-mantle',
  contactSource: plan.contactSource,
  activationDistance: plan.activationDistance,
  completionSteps: steps,
  modes: ['ground', 'mantle', 'ground'],
}));
