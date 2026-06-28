import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import {
  DISTRICT_ASSEMBLY_REQUIRED_FIELDS,
  buildDistrictAssemblyPlan,
  validateDistrictAssemblyPlan,
} from '../src/district-assembly-emitter.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const foundryIntent = buildDistrictIntentPlan(37, 'imperial_foundry');
const foundryAssembly = buildDistrictAssemblyPlan(foundryIntent);

assert.equal(foundryAssembly.districtId, 'imperial_foundry');
assert.equal(foundryAssembly.validation.passes, true, foundryAssembly.validation.failedChecks.join(', '));
assert.deepEqual(validateDistrictAssemblyPlan(foundryAssembly), foundryAssembly.validation, 'assembly validation must be deterministic');
assert.ok(foundryAssembly.parts.length >= 18, 'foundry must be an assembly chain, not a handful of props');
assert.ok(foundryAssembly.assemblies.includes('furnace-service-frame'), 'foundry must include furnace service frame assembly');
assert.ok(foundryAssembly.assemblies.includes('catwalk-over-hazard'), 'foundry must include catwalk-over-hazard assembly');
assert.ok(foundryAssembly.assemblies.includes('roof-monitor-and-vent'), 'foundry must include roof monitor and vent assembly');
assert.ok(foundryAssembly.assemblies.includes('cooling-channel'), 'foundry must include downstream cooling channel assembly');

const partsById = new Map(foundryAssembly.parts.map((part) => [part.id, part]));
const roles = new Set(foundryAssembly.parts.map((part) => part.role));
for (const role of foundryAssembly.requiredRoles) {
  assert.ok(roles.has(role), `foundry missing role ${role}`);
}

for (const part of foundryAssembly.parts) {
  for (const field of DISTRICT_ASSEMBLY_REQUIRED_FIELDS) {
    const value = part[field];
    if (Array.isArray(value) && field !== 'supports') assert.ok(value.length > 0, `${part.id} has empty required field ${field}`);
    else assert.notEqual(value ?? '', '', `${part.id} missing required field ${field}`);
  }
  assert.ok(part.hostId === 'carved_voxel_floor' || partsById.has(part.hostId), `${part.id} host ${part.hostId} must be another emitted part or carved floor`);
  for (const supportId of part.supportedBy || []) {
    assert.ok(partsById.has(supportId), `${part.id} supportedBy missing part ${supportId}`);
  }
}

const catwalk = partsById.get('foundry-catwalk-span');
assert.ok(catwalk, 'catwalk span must exist');
assert.deepEqual(
  catwalk.supportedBy,
  ['foundry-catwalk-end-left', 'foundry-catwalk-end-right', 'foundry-catwalk-post-a', 'foundry-catwalk-post-b'],
  'catwalk must have endpoints and visible posts, not float',
);

const ventStacks = foundryAssembly.parts.filter((part) => part.role === 'vent_stack');
assert.ok(ventStacks.length >= 3, 'vent stack assembly must include stacks plus a termination cap');
for (const stack of ventStacks) {
  assert.match(stack.hostId, /foundry-vent-|foundry-vent-stack-/, `${stack.id} must connect to the vent source chain`);
}

const cooling = partsById.get('foundry-cooling-channel');
assert.equal(cooling.hostId, 'foundry-cooling-source', 'cooling channel must start at a furnace outlet');
assert.ok(partsById.get('foundry-cooling-destination'), 'cooling channel must terminate in a visible destination');

assert.doesNotMatch(mainSource, /intent-foundry-/, 'runtime must not emit old naked intent-foundry props');
assert.match(mainSource, /emitDistrictAssemblyPlan\(buildDistrictAssemblyPlan\(intent\)\)/, 'foundry branch must route through assembly emitter');
assert.match(mainSource, /window\.__infiniteBrutalityDistrictAssembly/, 'runtime must expose district assembly debug state');

console.log(JSON.stringify({
  ok: true,
  contract: 'district-assembly',
  foundryParts: foundryAssembly.parts.length,
  assemblies: foundryAssembly.assemblies,
}));
