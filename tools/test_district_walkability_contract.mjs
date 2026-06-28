import assert from 'node:assert/strict';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';

const PLAYER_SOLID_DIAMETER = 0.76;
const MIN_CATWALK_WIDTH = 2.2;
const MIN_LANDING_WIDTH = 3.0;
const MAX_WALK_STEP = 0.28;

const intent = buildDistrictIntentPlan(37, 'imperial_foundry');
const plan = buildDistrictAssemblyPlan(intent);
const parts = new Map(plan.parts.map((part) => [part.id, part]));
const walkableParts = plan.parts.filter((part) => part.traversalIntent === 'walkable' && part.visible !== false);
const hazardParts = plan.parts.filter((part) => part.traversalIntent === 'hazard');
const structuralParts = plan.parts.filter((part) => part.traversalIntent === 'structural');

const routeIds = [
  'foundry-service-landing-left',
  'foundry-catwalk-span',
  'foundry-service-landing-right',
  'foundry-cooling-service-walkway',
];

assert.ok(walkableParts.length >= routeIds.length, 'foundry must expose a full service route, not just supported machinery');
assert.ok(hazardParts.some((part) => part.role === 'heat_core'), 'heat core must be hazard, not an ambiguous route block');
assert.ok(structuralParts.some((part) => part.role === 'plinth'), 'machinery plinth must be structural, not route');

const orderedRoute = [...walkableParts].sort((a, b) => a.routeOrder - b.routeOrder);
assert.deepEqual(orderedRoute.map((part) => part.id), routeIds, 'foundry primary route must be explicit and ordered');

for (const part of orderedRoute) {
  const width = Math.min(part.size[0], part.size[2]);
  const required = /landing/.test(part.role) ? MIN_LANDING_WIDTH : MIN_CATWALK_WIDTH;
  assert.ok(
    width >= required,
    `${part.id} is too narrow for first-person walking: ${width.toFixed(2)} < ${required.toFixed(2)}`,
  );
  assert.ok(width >= PLAYER_SOLID_DIAMETER + 1.0, `${part.id} needs comfort margin around the player capsule`);
  assert.equal(Number.isInteger(part.routeOrder), true, `${part.id} must declare integer routeOrder`);
  assert.ok(part.affordanceCue && part.affordanceCue.length > 12, `${part.id} must explain the visible walking affordance`);
  assert.ok(part.serviceAccess && part.serviceAccess.length > 12, `${part.id} needs explicit service access text`);
}

for (let i = 0; i < orderedRoute.length - 1; i += 1) {
  const from = orderedRoute[i];
  const to = orderedRoute[i + 1];
  const fromTop = from.center[1] + from.size[1] * 0.5;
  const toTop = to.center[1] + to.size[1] * 0.5;
  const step = Math.abs(fromTop - toTop);
  assert.ok(from.connectsTo.includes(to.id), `${from.id} must connect to ${to.id}`);
  assert.ok(step <= MAX_WALK_STEP, `${from.id} -> ${to.id} requires jump-scale step ${step.toFixed(2)}`);
}

const span = parts.get('foundry-catwalk-span');
assert.ok(
  span.supportedBy.includes('foundry-catwalk-end-left') && span.supportedBy.includes('foundry-catwalk-end-right'),
  'catwalk span must terminate into endpoint landings before it can be treated as walkable',
);
assert.ok(
  span.supportedBy.includes('foundry-catwalk-post-a') && span.supportedBy.includes('foundry-catwalk-post-b'),
  'catwalk span must have visible supports before it can be treated as walkable',
);

for (const part of hazardParts) {
  assert.notEqual(part.traversalIntent, 'walkable', `${part.id} cannot be both hazard and walkable`);
  assert.equal(part.routeOrder, null, `${part.id} hazard must not appear in the ordered route`);
}

console.log(JSON.stringify({
  ok: true,
  contract: 'district-walkability',
  routeIds,
  minCatwalkWidth: MIN_CATWALK_WIDTH,
  maxWalkStep: MAX_WALK_STEP,
}));
