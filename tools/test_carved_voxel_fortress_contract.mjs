import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCarvedVoxelFortressData, CARVED_VOXEL_FORTRESS_CUTS } from '../src/carved-voxel-fortress-slice.js';
import { buildSedimentaryMesaMeshData } from '../src/island-geometry.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const terrainLayerSource = readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');
const carvedSource = readFileSync(new URL('../src/carved-voxel-fortress-slice.js', import.meta.url), 'utf8');
const carved = buildCarvedVoxelFortressData();

const requiredCuts = [
  'spawn_alcove',
  'battery_court',
  'first_mount_lip',
  'trench_cut',
  'carved_stair',
  'overlook_window',
  'final_chamber',
  'secret_side_cut',
  'broken_void_edge',
];

assert.equal(carved.id, 'carved_voxel_fortress');
assert.ok(carvedSource.includes('field.voxels.fill(1)'), 'slice must start from a solid voxel mass');
assert.ok(carvedSource.includes('carveCut(field, cut)'), 'slice must apply subtractive cuts');
for (const id of requiredCuts) {
  const cut = CARVED_VOXEL_FORTRESS_CUTS.find((entry) => entry.id === id);
  assert.ok(cut, `missing cut ${id}`);
  for (const key of ['id', 'purpose', 'cutShape', 'connectsFrom', 'connectsTo', 'tacticalRole', 'verticalRole', 'readabilityCue']) {
    assert.ok(Object.hasOwn(cut, key), `${id} missing ${key}`);
  }
  assert.ok(cut.worldBounds || cut.localBounds, `${id} must declare bounds`);
}

assert.ok(carved.metrics.solidVoxelCountBeforeCuts > 0, 'solid mass must exist before cuts');
assert.ok(carved.metrics.airVolumeCreated > 0, 'air volume must increase after cuts');
assert.ok(carved.metrics.solidVoxelCountBeforeCuts > carved.metrics.solidVoxelCountAfterCuts, 'cuts must remove solid voxels');
assert.ok(carved.metrics.routeConnections.every((edge) => edge.connected), 'required cut volumes must overlap/connect in route order');
assert.equal(carved.metrics.firstMountLipReachable, true, 'first carved mount lip must fit the current jump/mantle envelope');
assert.ok(carved.metrics.firstMountLipDelta <= 2.15, 'first mount lip must be a low ledge, not a full-height platform');
const stairCut = CARVED_VOXEL_FORTRESS_CUTS.find((entry) => entry.id === 'carved_stair');
assert.equal(stairCut.tacticalRole, 'walkable_ascent', 'carved stair must read as a walkable ascent, not a jump/mount challenge');
assert.equal(stairCut.ascentProfile?.kind, 'walkable_switchback_road', 'carved stair must declare a walkable road profile');
assert.equal(carved.metrics.carvedStairWalkable, true, 'carved stair must stay inside the walk-readable slope envelope');
assert.ok(carved.metrics.carvedStairProfile.maxRisePerRun <= 0.24, `carved stair slope ${carved.metrics.carvedStairProfile.maxRisePerRun} is too steep to read as walkable`);
assert.ok(carved.metrics.carvedStairProfile.landingRun >= carved.field.cell * 2, 'carved stair needs a flat landing before the upper lip');
assert.equal(carved.metrics.overlookLineOfSight, true, 'overlook/window cut must expose line of sight to earlier court cut');
assert.equal(carved.metrics.secretReturns, true, 'secret side cut must branch from and return to the main route');

const mesh = buildSedimentaryMesaMeshData(carved.field, 0.072);
assert.ok(mesh.triangleCount > 0, 'carved voxel field must emit a visible mesh');
assert.ok(mesh.triangleCount <= 9000, `carved voxel mesh triangle count ${mesh.triangleCount} exceeds mobile slice budget`);
assert.ok(carved.field.voxels.length > carved.metrics.airVolumeCreated, 'field must retain surrounding solid after cuts');

assert.match(terrainLayerSource, /const addVoxelField = \(spec\) => \{/, 'TerrainLayer must expose raw voxel field emission');
assert.match(terrainLayerSource, /physicsWorld\?\.addTerrainMesh\?\.\(\{ meshData, origin, yaw, source, kind \}\)/, 'raw voxel field must register mesh collider through TerrainLayer');
assert.match(mainSource, /createTerrainLayer \} from '\.\/terrain-layer\.js\?v=0\.8\.200'/, 'runtime must import cache-busted TerrainLayer with addVoxelField');
assert.match(mainSource, /carved-voxel-fortress-slice\.js\?v=0\.8\.203'/, 'runtime must import cache-busted carved voxel slice');
assert.match(mainSource, /const ACTIVE_SLICE = URL_PARAMS\.get\('slice'\) \|\| 'carved_voxel_fortress'/, 'carved voxel fortress must be the default slice');
assert.match(mainSource, /function buildCarvedVoxelFortressSlice\(\)/, 'runtime must include carved slice builder');
assert.match(mainSource, /function exitCompletionEnabled\(\) \{\n  return !useCarvedVoxelFortressSlice\(\);\n\}/, 'carved slice must not auto-complete and rebuild when the player walks on terrain near the final chamber');
assert.match(mainSource, /if \(exitCompletionEnabled\(\) && player\.grounded && roomState\.transitionLock <= 0\)/, 'exit completion must be explicitly gated before rebuilding the room');

const carvedBuilder = mainSource.slice(
  mainSource.indexOf('function buildCarvedVoxelFortressSlice()'),
  mainSource.indexOf('function buildQuakeM1E1Slice()'),
);
for (const forbidden of ['addWalkableBox', 'addBatchRouteSegment', 'addIslandStamp', 'addBridgeSpan', 'room.center', 'room.size']) {
  assert.ok(!carvedBuilder.includes(forbidden), `carved builder must not use forbidden primitive route call ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: 'carved-voxel-fortress',
  cuts: CARVED_VOXEL_FORTRESS_CUTS.length,
  airVolumeCreated: carved.metrics.airVolumeCreated,
  triangles: mesh.triangleCount,
  stairMaxRisePerRun: carved.metrics.carvedStairProfile.maxRisePerRun,
  stairLandingRun: carved.metrics.carvedStairProfile.landingRun,
}));
