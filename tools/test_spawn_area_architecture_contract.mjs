import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildSpawnCisternCustomsPlan,
  validateSpawnCisternCustomsPlan,
} from '../src/spawn-building-plan.js';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const districtGeometrySource = fs.readFileSync(new URL('../src/district-geometry.js', import.meta.url), 'utf8');
const manifestSource = fs.readFileSync(new URL('../docs/PRIMITIVE_ARCHITECTURE_REALIZATION_MANIFEST.md', import.meta.url), 'utf8');

const plan = buildSpawnCisternCustomsPlan({
  origin: { x: 0, y: 0, z: 0 },
  lowBand: -1,
  buildBand: 0.1,
  highBand: 2.6,
});
const validation = validateSpawnCisternCustomsPlan(plan);

assert.equal(validation.ok, true, validation.failures.join('; '));
assert.equal(plan.placeArchetype, 'Cistern Customs Terrace');
assert.equal(plan.stoneForm, 'carved retaining-gate shelf');
assert.ok(plan.rooms.length >= 5, 'spawn building must be a multi-room place');
assert.ok(plan.connectors.length >= 5, 'spawn building must include route and recovery connectors');
assert.ok(validation.walkablePrimitiveCount >= plan.rooms.length, 'every named space needs walkable surface truth');
assert.ok(validation.solidPrimitiveCount > validation.walkablePrimitiveCount, 'building needs more real walls than floors');

const roomIds = new Set(plan.rooms.map((room) => room.id));
for (const requiredRoom of ['arrival_cut', 'customs_gate', 'cistern_court', 'stair_landing', 'roof_overlook']) {
  assert.ok(roomIds.has(requiredRoom), 'missing required spawn room: ' + requiredRoom);
}

const primitiveKinds = new Set(plan.primitives.map((primitive) => primitive.kind));
for (const requiredKind of ['cliff cut', 'floor plate', 'wall bay', 'gate pier', 'lintel', 'retaining wall', 'parapet', 'stair run']) {
  assert.ok(primitiveKinds.has(requiredKind), 'missing required architectural primitive kind: ' + requiredKind);
}

for (const primitive of plan.primitives) {
  assert.ok(primitive.kind, primitive.id + ' must name an architectural kind');
  assert.ok(primitive.assemblyId, primitive.id + ' must belong to an assembly');
  assert.ok(primitive.roomId, primitive.id + ' must belong to a room');
  assert.ok(primitive.supportedBy.length > 0, primitive.id + ' must declare support');
  assert.notEqual(primitive.collisionPolicy, 'visual-only', primitive.id + ' must not be structural decoration');
}

assert.match(mainSource, /name: 'Cistern Customs Terrace'/, 'default spawn-area district must remain Cistern Customs Terrace');
assert.match(mainSource, /architectureContract: 'spawn_cistern_customs'/, 'spawn area must declare the primitive architecture contract');
assert.match(mainSource, /spawnBuildingPlan: district\.spawnBuildingPlan \? JSON\.parse\(JSON\.stringify\(district\.spawnBuildingPlan\)\) : null/, 'roomState plan must expose the actual generated spawn building plan');
assert.match(mainSource, /district\.spawnBuildingPlan\?\.rooms\?\.length/, 'spawn anchor must be allowed to use generated building-plan rooms');
assert.match(mainSource, /room\.id === 'arrival_cut'/, 'spawn district must anchor the player to the arrival cut room, not an arbitrary terrain scan');

assert.match(districtGeometrySource, /buildSpawnCisternCustomsPlan/, 'district geometry must consume the spawn building plan');
assert.match(districtGeometrySource, /validateSpawnCisternCustomsPlan/, 'district geometry must validate the spawn building plan at runtime');
assert.match(districtGeometrySource, /renderBuildingPrimitive/, 'district geometry must render typed building primitives');
assert.match(districtGeometrySource, /addVisibleSolidBox/, 'solid building primitives must have both visible mesh and collision envelope');
assert.doesNotMatch(districtGeometrySource, /function addSpawnCisternCustomsArchitecture\(district, contract\)[\s\S]*customs-road/, 'spawn renderer must not regress to the old ad hoc road slab');

assert.match(manifestSource, /A primitive becomes architecture only when the generator can name what it is/, 'primitive architecture doctrine must stay present');
assert.match(manifestSource, /Terrain-Building Fusion/, 'terrain-building fusion doctrine must stay present');

console.log(JSON.stringify({
  ok: true,
  contract: 'spawn-area-room-plan-architecture',
  rooms: validation.roomCount,
  connectors: validation.connectorCount,
  primitives: validation.primitiveCount,
}));
