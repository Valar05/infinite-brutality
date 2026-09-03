import * as THREE from '../vendor/three/build/three.module.js';
import { generateControllerArena } from '../src/controller-kata.js';
import { createPhysicsWorld, ensurePhysicsReady } from '../src/physics-world.js';
import { createProductOneController, PRODUCT_ONE_CAPABILITY_PROFILE, PRODUCT_ONE_PHYSICS_OPTIONS } from '../src/product-one-controller.js';

const args = process.argv.slice(2);
const valueAfter = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const seed = valueAfter('--seed', 'controller-proof');
const robustness = JSON.parse(valueAfter('--qa-robustness-json', '{"schema":"qa-robustness-v1","domains":{}}'));
const negativeControl = valueAfter('--negative-control', '');
const values = (name, fallback) => robustness.domains?.[name]?.values || fallback;
const frameRates = values('frame_hz', [30, 45, 60, 75, 90, 105, 120]);
const arena = generateControllerArena({ seed: seed + ':0' });
const fixture = arena.traversal.fixtures.find((entry) => entry.role === 'high-mantle');
const scenario = arena.traversal.scenarios[fixture.id];
const forwardForYaw = (yaw) => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
const rightForYaw = (yaw) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
await ensurePhysicsReady();

function createHarness(spawn, yaw) {
  const physics = createPhysicsWorld(PRODUCT_ONE_PHYSICS_OPTIONS);
  physics.addCuboid({ size: arena.floor.size, position: arena.floor.center, source: 'controller-kata-floor', kind: 'walkable' });
  for (const record of [...arena.traversal.fixtures, ...arena.cubes]) {
    physics.addCuboid({ size: record.size, position: record.center, source: record.id, kind: 'walkable' });
  }
  const player = {
    position: new THREE.Vector3(...spawn), velocity: new THREE.Vector3(), yaw, pitch: 0,
    grounded: true, mode: 'ground', climb: null, mantle: null, runCharge: 0,
    isRunning: false, lastRunIntent: false,
  };
  const events = [];
  const controller = createProductOneController({
    player, physicsWorld: physics, forwardForYaw, rightForYaw,
    onEvent: (event) => events.push(event),
  });
  return { physics, player, events, controller };
}

function runApproach({ moveY = 1, angle = 0, jumpDistance = 1, framePattern = [1 / 60], spawn = null, bypass = false }) {
  const radians = angle * Math.PI / 180;
  const yaw = Math.PI - radians;
  const forward = forwardForYaw(yaw);
  const halfX = fixture.size[0] * 0.5;
  const halfZ = fixture.size[2] * 0.5;
  const boundaryDistance = Math.min(
    halfX / Math.max(Math.abs(forward.x), 1e-9),
    halfZ / Math.max(Math.abs(forward.z), 1e-9),
  );
  const start = spawn || [
    fixture.center[0] - forward.x * (boundaryDistance + 4),
    PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight,
    fixture.center[2] - forward.z * (boundaryDistance + 4),
  ];
  const harness = createHarness(start, yaw);
  let pressed = false;
  let becameAirborne = false;
  let maxFeetY = harness.player.position.y - PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight;
  for (let frame = 0; frame < 1000; frame += 1) {
    const dx = harness.player.position.x - fixture.center[0];
    const dz = harness.player.position.z - fixture.center[2];
    const along = Math.max(0, Math.hypot(dx, dz) - boundaryDistance);
    const groundedContact = harness.events.some((event) => event.type === 'wall-contact' && event.source === fixture.id && event.grounded);
    if (!pressed && (along <= jumpDistance || groundedContact)) {
      if (bypass) harness.controller.queueJump?.();
      else harness.controller.input.pressJump({ source: 'touch' });
      pressed = true;
    }
    harness.controller.input.setMove({ moveX: 0, moveY, source: 'touch-stick' });
    harness.controller.input.update(framePattern[frame % framePattern.length]);
    maxFeetY = Math.max(maxFeetY, harness.player.position.y - PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight);
    becameAirborne ||= harness.events.some((event) => event.type === 'jump-commit') && !harness.player.grounded;
    if (harness.events.some((event) => event.type === 'mantle-complete')) break;
    if (becameAirborne && harness.player.grounded && harness.events.some((event) => event.type === 'jump-commit')) break;
  }
  const jump = harness.events.find((event) => event.type === 'jump-commit');
  const startEvent = harness.events.find((event) => event.type === 'mantle-start');
  const complete = harness.events.find((event) => event.type === 'mantle-complete');
  const result = {
    moveY, angle, jumpDistance, pressed,
    completed: Boolean(complete), jumpCommitted: Boolean(jump),
    mantleStarts: harness.events.filter((event) => event.type === 'mantle-start').length,
    realContact: harness.events.some((event) => event.type === 'wall-contact' && event.source === fixture.id && !event.grounded),
    source: startEvent?.plan?.contactSource || '',
    climbEntries: harness.events.filter((event) => event.type === 'forbidden-climb').length,
    completionVelocity: complete?.completionVelocity || null,
    maxFeetY, finalPosition: harness.player.position.toArray(), finalMode: harness.player.mode,
    wallContacts: harness.events.filter((event) => event.type === 'wall-contact' && event.source === fixture.id).length,
    safelyContained: Math.abs(harness.player.position.x - arena.floor.center[0]) < arena.floor.size[0] * 0.5 - PRODUCT_ONE_CAPABILITY_PROFILE.radius
      && Math.abs(harness.player.position.z - arena.floor.center[2]) < arena.floor.size[2] * 0.5 - PRODUCT_ONE_CAPABILITY_PROFILE.radius,
  };
  harness.physics.dispose();
  return result;
}

const irregular = frameRates.map((hz, index) => 1 / frameRates[(index * 3 + 1) % frameRates.length]);
const stickSweep = values('stick', [0.2, 0.3333333333, 0.4666666667, 0.6, 0.7333333333, 0.8666666667, 1])
  .map((moveY) => runApproach({ moveY, framePattern: irregular }));
const angleSweep = values('approach_angle_degrees', [-60, -45, -30, -15, 0, 15, 30, 45, 60])
  .map((angle) => runApproach({ angle, framePattern: irregular }));
// Timing is normalized to the source-owned Boxcraft clear approach. The mantle
// window ends at half that approach; earlier full-run jumps physically clear the box.
const timingSweep = values('jump_lead_fraction', [0, 1 / 12, 1 / 6, 0.25, 1 / 3, 5 / 12, 0.5])
  .map((fraction) => runApproach({ jumpDistance: scenario.approach.distance * fraction, framePattern: irregular }));
const frameSweep = frameRates.map((hz, index) => runApproach({
  framePattern: [1 / hz, 1 / frameRates[(index + 2) % frameRates.length], 1 / 60],
}));
const pageStart = runApproach({ spawn: arena.spawn, framePattern: irregular });
const directBypass = negativeControl === 'direct-queue-bypass'
  ? runApproach({ bypass: true, framePattern: irregular })
  : null;
const outOfContactDomain = negativeControl === 'out-of-contact-domain'
  ? runApproach({ jumpDistance: scenario.approach.distance * 0.6, framePattern: irregular })
  : null;
const count = (items) => items.filter((item) => item.completed).length;
const failures = [];
if (!pageStart.completed || pageStart.source !== fixture.id) failures.push('page-owned spawn route did not complete the real high mantle');
if (count(stickSweep) < Math.ceil(stickSweep.length * 0.7)) failures.push('partial-stick acceptance region is too narrow');
if (count(angleSweep) < Math.ceil(angleSweep.length * 0.7)) failures.push('approach-angle acceptance region is too narrow');
if (count(timingSweep) !== timingSweep.length) failures.push('jump timing domain contains a rejected ordinary approach');
if (count(frameSweep) !== frameSweep.length) failures.push('irregular render-dt accumulator changed mantle outcome');
for (const item of [...stickSweep, ...angleSweep, ...timingSweep, ...frameSweep, pageStart]) {
  if (item.completed && (!item.jumpCommitted || !item.realContact || item.climbEntries || item.source !== fixture.id)) failures.push('accepted path bypassed jump/contact/no-climb ownership');
  if (item.completed && item.completionVelocity?.some((entry) => entry !== 0)) failures.push('accepted mantle completed with launch velocity');
}
if (directBypass && (directBypass.jumpCommitted || directBypass.completed)) failures.push('direct queue bypass was not rejected');
if (outOfContactDomain && (!outOfContactDomain.jumpCommitted || outOfContactDomain.realContact || outOfContactDomain.completed || !outOfContactDomain.safelyContained)) failures.push('out-of-contact-domain control was not a safe running-jump clear');
const ok = failures.length === 0 && !negativeControl;
console.log(JSON.stringify({
  schema: 'qa-observation-v1',
  ok,
  reason: negativeControl && failures.length === 0 ? negativeControl + ' rejected' : '',
  failures,
  metrics: {
    evidence: { classification: 'machine-guardrail', visualAcceptance: false, acceptanceOwner: 'user-play' },
    productionAdapter: 'src/product-one-input-adapter.js',
    pageSpawn: arena.spawn,
    fixtureId: fixture.id,
    fixtureTopY: fixture.topY,
    inputDomainSource: 'qa-engine-generated',
    stick: { successes: count(stickSweep), total: stickSweep.length, results: stickSweep },
    angles: { successes: count(angleSweep), total: angleSweep.length, results: angleSweep },
    timing: { successes: count(timingSweep), total: timingSweep.length, results: timingSweep },
    frames: { successes: count(frameSweep), total: frameSweep.length, results: frameSweep },
    pageStart,
    directBypass, outOfContactDomain,
  },
}));
