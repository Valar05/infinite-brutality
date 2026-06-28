import assert from 'node:assert/strict';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';

const PLAYER_SOLID_DIAMETER = 0.76;
const MIN_WALKABLE_WIDTH = PLAYER_SOLID_DIAMETER + 0.22;
const MAX_ROUTE_STEP = 1.45;

const intent = buildDistrictIntentPlan(37, 'imperial_foundry');
const plan = buildDistrictAssemblyPlan(intent);
const parts = new Map(plan.parts.map((part) => [part.id, part]));
const walkableRoles = new Set(['service_landing', 'catwalk_endpoint', 'catwalk_span', 'service_route']);
const walkableParts = plan.parts.filter((part) => walkableRoles.has(part.role));

assert.ok(walkableParts.length >= 6, 'foundry must expose a service route, not just a supported machine');

for (const part of walkableParts) {
  const width = Math.min(part.size[0], part.size[2]);
  assert.ok(
    width >= MIN_WALKABLE_WIDTH,
    `${part.id} is too narrow to read as a first-person walkable surface: ${width.toFixed(2)}`,
  );
  assert.ok(part.serviceAccess && part.serviceAccess.length > 12, `${part.id} needs explicit service access text`);
}

const leftLanding = parts.get('foundry-service-landing-left');
const rightLanding = parts.get('foundry-service-landing-right');
const leftEndpoint = parts.get('foundry-catwalk-end-left');
const rightEndpoint = parts.get('foundry-catwalk-end-right');
const span = parts.get('foundry-catwalk-span');

assert.ok(leftLanding && rightLanding && leftEndpoint && rightEndpoint && span, 'foundry catwalk route must include landings, endpoints, and span');

for (const [from, to] of [
  [leftLanding, leftEndpoint],
  [leftEndpoint, span],
  [span, rightEndpoint],
  [rightEndpoint, rightLanding],
]) {
  const rise = Math.abs(from.center[1] - to.center[1]);
  assert.ok(rise <= MAX_ROUTE_STEP, `${from.id} -> ${to.id} has unreadable vertical step ${rise.toFixed(2)}`);
}

assert.ok(
  span.supportedBy.includes('foundry-catwalk-end-left') && span.supportedBy.includes('foundry-catwalk-end-right'),
  'catwalk span must terminate into endpoint landings before it can be treated as walkable',
);

assert.ok(
  span.supportedBy.includes('foundry-catwalk-post-a') && span.supportedBy.includes('foundry-catwalk-post-b'),
  'catwalk span must have visible supports before it can be treated as walkable',
);

console.log(JSON.stringify({
  ok: true,
  contract: 'district-walkability',
  walkableParts: walkableParts.map((part) => part.id),
  minWidth: MIN_WALKABLE_WIDTH,
}));
