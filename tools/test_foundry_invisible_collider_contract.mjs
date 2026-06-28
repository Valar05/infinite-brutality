import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const plan = buildDistrictAssemblyPlan(buildDistrictIntentPlan(37, 'imperial_foundry'));
const parts = new Map(plan.parts.map((part) => [part.id, part]));
const playerColliderParts = plan.parts.filter((part) => part.collisionPolicy === 'player');
const visiblePlayerColliderParts = playerColliderParts.filter((part) => part.visible !== false);

assert.match(mainSource, /function addFortressVisualOnly/, 'runtime must have a visual-only assembly emission path');
assert.match(mainSource, /part\.collisionPolicy === 'player'/, 'runtime must opt in to player colliders per assembly part');
assert.match(mainSource, /hasPlayerCollider \? addFortressSolid : addFortressVisualOnly/, 'non-player assembly parts must not use addFortressSolid');

const host = parts.get('foundry-host-floor-read');
assert.ok(host, 'foundry host must exist as metadata');
assert.equal(host.visible, false, 'foundry host floor must not render a slab over carved terrain');
assert.equal(host.collisionPolicy, 'none', 'foundry host floor must not create an invisible player collider');

for (const part of plan.parts) {
  if (part.traversalIntent !== 'walkable') {
    assert.notEqual(part.collisionPolicy, 'player', `${part.id} is ${part.traversalIntent} and must not create a player collider`);
  }
  if (part.role === 'support' || part.role === 'channel_rim' || part.hazard) {
    assert.notEqual(part.collisionPolicy, 'player', `${part.id} is visual/process geometry and must not become a climb wall`);
  }
}

assert.deepEqual(
  visiblePlayerColliderParts.map((part) => part.id),
  [
    'foundry-service-landing-left',
    'foundry-service-landing-right',
    'foundry-catwalk-span',
    'foundry-cooling-service-walkway',
  ],
  'only visible primary route decks may create foundry player colliders',
);

console.log(JSON.stringify({
  ok: true,
  contract: 'foundry-invisible-collider',
  playerColliderParts: visiblePlayerColliderParts.map((part) => part.id),
}));
