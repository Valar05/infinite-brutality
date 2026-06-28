import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const plan = buildDistrictAssemblyPlan(buildDistrictIntentPlan(37, 'imperial_foundry'));
const parts = new Map(plan.parts.map((part) => [part.id, part]));
const playerColliderParts = plan.parts.filter((part) => part.collisionPolicy === 'player');
const visiblePlayerColliderParts = playerColliderParts.filter((part) => part.visible !== false);
const solidColliderParts = plan.parts.filter((part) => part.collisionPolicy === 'solid');

assert.match(mainSource, /function addFortressVisualOnly/, 'runtime must have a visual-only assembly emission path');
assert.match(mainSource, /part\.collisionPolicy === 'player'/, 'runtime must opt in to player colliders per assembly part');
assert.match(mainSource, /part\.collisionPolicy === 'player' \|\| part\.collisionPolicy === 'solid'/, 'runtime must create physical colliders for solid visible architecture');
assert.match(mainSource, /hasPhysicalCollider \? addFortressSolid : addFortressVisualOnly/, 'only none/visual-only assembly parts may skip physical colliders');

const host = parts.get('foundry-host-floor-read');
assert.ok(host, 'foundry host must exist as metadata');
assert.equal(host.visible, false, 'foundry host floor must not render a slab over carved terrain');
assert.equal(host.collisionPolicy, 'none', 'foundry host floor must not create an invisible player collider');

for (const part of plan.parts) {
  if (part.traversalIntent !== 'walkable') {
    assert.notEqual(part.collisionPolicy, 'player', `${part.id} is ${part.traversalIntent} and must not create a player collider`);
  }
  if (part.visible !== false && part.collisionPolicy !== 'player') {
    assert.equal(part.collisionPolicy, 'solid', `${part.id} is visible architecture and must have a solid collider`);
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

assert.ok(solidColliderParts.length >= 12, 'visible foundry architecture must mostly be solid collider-backed geometry');
assert.ok(solidColliderParts.some((part) => part.id === 'foundry-furnace-plinth'), 'furnace plinth must have solid collision');
assert.ok(solidColliderParts.some((part) => part.id === 'foundry-vent-stack-a'), 'vent stacks must have solid collision');
assert.ok(solidColliderParts.some((part) => part.id === 'foundry-cooling-rim-left'), 'cooling channel rims must have solid collision');

console.log(JSON.stringify({
  ok: true,
  contract: 'foundry-invisible-collider',
  playerColliderParts: visiblePlayerColliderParts.map((part) => part.id),
  solidColliderCount: solidColliderParts.length,
}));
