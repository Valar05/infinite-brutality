import assert from 'node:assert/strict';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';
import { createPhysicsWorld, ensurePhysicsReady } from '../src/physics-world.js';

const PLAYER_EYE_HEIGHT = 1.68;
const PLAYER_RADIUS = 0.38;
const MAX_STEPS_PER_SEGMENT = 180;
const HORIZONTAL_STEP = 0.12;
const MAX_CONTACTS = 8;

const routeIds = [
  'foundry-service-landing-left',
  'foundry-catwalk-span',
  'foundry-service-landing-right',
  'foundry-cooling-service-walkway',
];

function topY(part) {
  return part.center[1] + part.size[1] * 0.5;
}

function routeAnchor(part) {
  return {
    id: part.id,
    x: part.center[0],
    y: topY(part) + PLAYER_EYE_HEIGHT + 0.04,
    z: part.center[2],
  };
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

await ensurePhysicsReady();
const intent = buildDistrictIntentPlan(37, 'imperial_foundry');
const plan = buildDistrictAssemblyPlan(intent);
const parts = new Map(plan.parts.map((part) => [part.id, part]));
const route = routeIds.map((id) => parts.get(id));
assert.ok(route.every(Boolean), 'walkability probe requires every ordered route part');

const physics = createPhysicsWorld({
  gravity: { x: 0, y: -14.4, z: 0 },
  autostepHeight: 0.34,
  autostepMinWidth: 0.3,
  snapToGround: 0.5,
});

for (const part of plan.parts) {
  if (part.visible === false || part.collisionPolicy !== 'player') continue;
  physics.addCuboid({
    size: part.size,
    position: part.center,
    source: part.id,
    kind: part.traversalIntent || part.kind || 'structure',
  });
}

let eye = routeAnchor(route[0]);
let worstContactCount = 0;
let ungroundedFrames = 0;
const visited = [route[0].id];

for (let i = 1; i < route.length; i += 1) {
  const target = routeAnchor(route[i]);
  let reached = false;
  let lastDistance = distanceXZ(eye, target);
  for (let step = 0; step < MAX_STEPS_PER_SEGMENT; step += 1) {
    const dx = target.x - eye.x;
    const dz = target.z - eye.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.42) {
      reached = true;
      break;
    }
    const moveScale = Math.min(HORIZONTAL_STEP, dist) / (dist || 1);
    const result = physics.movePlayer({
      eyePosition: eye,
      desiredDelta: {
        x: dx * moveScale,
        y: -0.18,
        z: dz * moveScale,
      },
      eyeHeight: PLAYER_EYE_HEIGHT,
      radius: PLAYER_RADIUS,
    });
    eye = result.eyePosition;
    worstContactCount = Math.max(worstContactCount, result.contactCount || 0);
    if (!result.grounded) ungroundedFrames += 1;
    assert.ok((result.contactCount || 0) <= MAX_CONTACTS, `${route[i - 1].id} -> ${route[i].id} has chaotic contact count ${result.contactCount}`);
    assert.ok(Number.isFinite(eye.x) && Number.isFinite(eye.y) && Number.isFinite(eye.z), 'player route probe produced invalid position');
    assert.ok(eye.y > -2 && eye.y < 4, `${route[i - 1].id} -> ${route[i].id} moved player outside plausible walk band y=${eye.y.toFixed(2)}`);
    const nextDistance = distanceXZ(eye, target);
    assert.ok(nextDistance <= lastDistance + 0.2, `${route[i - 1].id} -> ${route[i].id} stopped making route progress`);
    lastDistance = nextDistance;
  }
  assert.ok(reached, `player capsule could not walk from ${route[i - 1].id} to ${route[i].id}`);
  visited.push(route[i].id);
}

assert.equal(ungroundedFrames, 0, 'primary foundry route must be walkable without jump/fall frames');
physics.dispose();

console.log(JSON.stringify({
  ok: true,
  contract: 'player-walkability-route',
  visited,
  worstContactCount,
}));
