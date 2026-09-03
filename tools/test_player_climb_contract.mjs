import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateControllerArena } from '../src/controller-kata.js';
import { advanceConstrainedMantle, createBoundedContactMantlePlan } from '../src/player-climb.js';
import { createPhysicsWorld, ensurePhysicsReady } from '../src/physics-world.js';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const climbSource = fs.readFileSync(new URL('../src/player-climb.js', import.meta.url), 'utf8');
const arena = generateControllerArena({ seed: 'controller-proof:0' });
const fixture = arena.directMantle;
const eyeHeight = 1.68;
const radius = 0.38;
const mantleForward = 0.48;

await ensurePhysicsReady();
const physics = createPhysicsWorld({ gravity: { x: 0, y: -14.4, z: 0 }, autostepHeight: 0.62, autostepMinWidth: 0.646, snapToGround: 0.48 });
physics.addCuboid({ size: arena.floor.size, position: arena.floor.center, source: 'controller-kata-floor', kind: 'walkable' });
physics.addCuboid({ size: fixture.size, position: fixture.center, source: fixture.id, kind: 'walkable' });

let eyePosition = { x: arena.spawn[0], y: eyeHeight, z: arena.spawn[2] };
let groundedContact = null;
for (let frame = 0; frame < 120; frame += 1) {
  const move = physics.movePlayer({ eyePosition, desiredDelta: { x: 0, y: -0.24, z: 5.2 / 60 }, eyeHeight, radius });
  eyePosition = move.eyePosition;
  if (move.collisions.some((collision) => collision.isWall && collision.source === fixture.id)) {
    groundedContact = move;
    break;
  }
}
assert.ok(groundedContact?.grounded, 'real Rapier forward motion must reach the fixture while grounded');

const supportCalls = [];
const clearanceCalls = [];
const findMantleTopSupport = (x, z, targetTopY) => {
  supportCalls.push({ x, z, targetTopY });
  return physics.findCuboidTopSupport({ x, z, targetTopY, radius, source: fixture.id });
};
const isBodyClear = (x, z, eyeY) => {
  clearanceCalls.push({ x, z, eyeY });
  return physics.isCapsuleClearAt({ x, z, eyeY, eyeHeight, radius });
};
const optionsFor = (move, position, overrides = {}) => ({
  fixture,
  eyePosition: [position.x, position.y, position.z],
  inputMoveY: 1,
  collisions: move.collisions,
  eyeHeight,
  radius,
  mantleForward,
  playerMode: move.grounded ? 'ground' : 'air',
  grounded: move.grounded,
  velocityY: 0,
  facing: [0, 0, 1],
  faceYaw: Math.PI,
  findMantleTopSupport,
  isBodyClear,
  ...overrides,
});

assert.equal(createBoundedContactMantlePlan(optionsFor(groundedContact, eyePosition)), null, 'grounded forward collision cannot activate Product One mantle');

let velocityY = 7.1;
let airborneContact = null;
let plan = null;
for (let frame = 0; frame < 20 && !plan; frame += 1) {
  velocityY -= 14.4 / 60;
  const move = physics.movePlayer({ eyePosition, desiredDelta: { x: 0, y: velocityY / 60, z: 5.2 / 60 }, eyeHeight, radius });
  eyePosition = move.eyePosition;
  const wall = move.collisions.find((collision) => collision.isWall && collision.source === fixture.id);
  if (!move.grounded && wall) {
    airborneContact = move;
    plan = createBoundedContactMantlePlan(optionsFor(move, eyePosition, { playerMode: 'air', grounded: false, velocityY }));
  }
}
assert.ok(airborneContact, 'jump approach must produce a real airborne Rapier wall contact');
assert.ok(plan, 'airborne forward contact within the feet-to-lip window must activate');
assert.equal(plan.kind, 'controller-direct');
assert.equal(plan.contactSource, fixture.id);
assert.equal(plan.supportSource, fixture.id);
assert.ok(plan.feetToLip >= fixture.minFeetToLip && plan.feetToLip <= fixture.maxFeetToLip);
assert.ok(plan.faceDot >= fixture.minFacingDot);
assert.ok(plan.verticalDisplacement <= fixture.maxVerticalDisplacement);
assert.ok(plan.horizontalDisplacement <= fixture.maxHorizontalDisplacement);
assert.ok(plan.end.z > plan.contactPoint.z, 'landing must be beyond the contacted lip');
assert.notEqual(plan.end.z, fixture.center[2], 'landing target must not be the box center');
assert.ok(Math.abs((plan.end.z - plan.contactPoint.z) - (radius + mantleForward)) < 0.02, 'landing inset must reuse radius plus CLIMB_MANTLE_FORWARD');
assert.ok(supportCalls.length > 0, 'landing support must be queried');
assert.ok(clearanceCalls.length > 0, 'landing body clearance must be queried');

assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'air', grounded: false, velocityY, facing: [0, 0, -1] })), null, 'facing away from the actual contact normal must reject');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, {
  playerMode: 'air',
  grounded: false,
  velocityY,
  collisions: airborneContact.collisions.map((collision) => collision.source === fixture.id ? { ...collision, normal: { x: 0, y: 0, z: 1 } } : collision),
})), null, 'a reversed Rapier wall normal must reject even with forward input');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'air', grounded: false, velocityY, findMantleTopSupport: () => null })), null, 'missing landing support must reject');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'air', grounded: false, velocityY, isBodyClear: () => false })), null, 'blocked landing body volume must reject');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'climb', grounded: false, velocityY })), null, 'Product One must reject CLIMB as a mantle precursor');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'air', grounded: false, velocityY, inputMoveY: 0 })), null, 'mantle must require forward input');
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, eyePosition, { playerMode: 'air', grounded: false, velocityY, collisions: [] })), null, 'mantle must require actual owned-fixture contact');

const groundLaunchEye = [plan.start.x, fixture.topY + eyeHeight - 1.2, plan.start.z];
assert.equal(createBoundedContactMantlePlan(optionsFor(airborneContact, { x: groundLaunchEye[0], y: groundLaunchEye[1], z: groundLaunchEye[2] }, {
  eyePosition: groundLaunchEye,
  playerMode: 'air',
  grounded: false,
  velocityY: 0.1,
})), null, 'the 1.2m ground-to-top launch must exceed the vertical bound');

let motion = null;
let elapsed = 0;
let steps = 0;
while (!motion?.complete && steps < 60) {
  motion = advanceConstrainedMantle({ ...plan, elapsed }, 1 / 60);
  elapsed = motion.elapsed;
  steps += 1;
  assert.deepEqual(motion.velocity, [0, 0, 0], 'mantle motion must never grant launch velocity');
}
assert.ok(motion?.complete, 'direct mantle must complete within its bounded duration');
assert.ok(steps <= Math.ceil(fixture.duration * 60) + 1);
assert.deepEqual(motion.position, [plan.end.x, plan.end.y, plan.end.z]);
assert.equal(motion.grounded, true);
assert.equal(createBoundedContactMantlePlan(optionsFor(groundedContact, { x: plan.end.x, y: plan.end.y, z: plan.end.z }, {
  eyePosition: [plan.end.x, plan.end.y, plan.end.z],
  playerMode: 'ground',
  grounded: true,
  velocityY: 0,
})), null, 'completed mantle must not repeat while grounded on top');

assert.match(mainSource, /createBoundedContactMantlePlan/, 'authoritative runtime must use the shared constrained mantle owner');
assert.equal((mainSource.match(/if \(!useControllerKataSlice\(\) && tryBeginClimb/g) || []).length, 2, 'Product One must bypass both general climb entry paths');
assert.match(mainSource, /controller kata entered forbidden CLIMB state/, 'Product One must fail closed if CLIMB is ever entered');
assert.match(climbSource, /export function createBoundedContactMantlePlan/, 'bounded contact planning must live with the original mantle owner');
assert.match(climbSource, /export function advanceConstrainedMantle/, 'Product One motion must share the original mantle interpolation owner');
physics.dispose();

console.log(JSON.stringify({
  ok: true,
  contract: 'product-one-constrained-direct-mantle',
  contactSource: plan.contactSource,
  feetToLip: plan.feetToLip,
  faceDot: plan.faceDot,
  verticalDisplacement: plan.verticalDisplacement,
  horizontalDisplacement: plan.horizontalDisplacement,
  completionSteps: steps,
  modes: ['air', 'mantle', 'ground'],
}));
