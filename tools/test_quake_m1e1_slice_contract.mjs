import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUAKE_M1E1_SLICE } from '../src/quake-m1e1-slice.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const templates = JSON.parse(readFileSync(new URL('../data/level_route_templates.json', import.meta.url), 'utf8'));

const roomIds = QUAKE_M1E1_SLICE.rooms.map((room) => room.id);
const edgeRoles = new Set(QUAKE_M1E1_SLICE.edges.map((edge) => edge.routeRole));

assert.equal(QUAKE_M1E1_SLICE.id, 'quake_m1e1_slice');
assert.equal(QUAKE_M1E1_SLICE.routeTemplateId, 'quake_seq_02_gate_loop_return');
assert.deepEqual(roomIds, [
  'start_casemate',
  'battery_court',
  'locked_gate_face',
  'key_trench_branch',
  'upper_overlook',
  'secret_ledge',
  'final_gun_room',
]);

for (const room of QUAKE_M1E1_SLICE.rooms) {
  assert.ok(room.combatPurpose, room.id + ' declares a combat purpose');
  assert.ok(room.routeSentence?.length >= 2, room.id + ' declares a route sentence');
  assert.ok(room.center?.length === 3, room.id + ' declares a center');
  assert.ok(room.size?.length === 3, room.id + ' declares a size');
}

const gate = QUAKE_M1E1_SLICE.rooms.find((room) => room.id === 'locked_gate_face');
assert.equal(gate.lockedGate?.static, true);
assert.equal(gate.lockedGate?.bypass, 'key_trench_branch');
assert.ok(edgeRoles.has('locked_gate_bypass'));
assert.ok(edgeRoles.has('loopback_return'));
assert.ok(edgeRoles.has('optional_secret'));
assert.ok(QUAKE_M1E1_SLICE.terrainStamps.length >= QUAKE_M1E1_SLICE.rooms.length);

assert.match(mainSource, /import \{ QUAKE_M1E1_SLICE \}/);
assert.match(mainSource, /const ACTIVE_SLICE = URL_PARAMS\.get\('slice'\)/);
assert.match(mainSource, /function buildQuakeM1E1Slice\(\)/);
assert.match(mainSource, /ACTIVE_SLICE !== 'generated'/);
assert.match(mainSource, /createActiveTerrainLayer\(\)/);
assert.match(mainSource, /addIslandStamp/);

const sliceBuilder = mainSource.slice(
  mainSource.indexOf('function buildQuakeM1E1Slice()'),
  mainSource.indexOf('function buildGeneratedGauntlet('),
);
assert.ok(sliceBuilder.length > 100, 'slice builder should be present before generated gauntlet');
assert.ok(!sliceBuilder.includes('districtGeometry.addDistrictSkeletonGeometry'), 'default slice must bypass broad district island emission');

const routeTemplate = templates.templates.find((template) => template.id === 'quake_m1e1_slice');
assert.ok(routeTemplate, 'route template data contains quake_m1e1_slice');
assert.ok(routeTemplate.route_sentence.includes('visible_locked_gate'));
assert.ok(routeTemplate.route_sentence.includes('side_key_trench'));
assert.ok(routeTemplate.route_sentence.includes('upper_overlook_loopback'));

console.log('quake_m1e1_slice contract ok');
