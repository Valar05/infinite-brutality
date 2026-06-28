import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const districtSource = fs.readFileSync(new URL('../src/district-geometry.js', import.meta.url), 'utf8');
const terrainLayerSource = fs.readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');

assert.match(mainSource, /import \{ createTerrainLayer \} from '\.\/terrain-layer\.js/, 'main runtime must import TerrainLayer');
assert.match(mainSource, /roomState\.terrainLayer = layer/, 'roomState must own the active TerrainLayer');
assert.match(mainSource, /roomGroup\.add\(layer\.group\)/, 'TerrainLayer group must be attached as one terrain owner');
assert.match(mainSource, /terrain\.addBridgeSpan\(/, 'stepped ramp/connectors must add spans to TerrainLayer');
assert.match(districtSource, /activeTerrainLayer/, 'district geometry must target active TerrainLayer');
assert.match(districtSource, /terrain\.addIslandStamp\(/, 'district islands must be terrain layer stamps');
assert.match(districtSource, /terrain\.addBridgeSpan\(/, 'district bridges must be terrain layer spans');
assert.doesNotMatch(districtSource, /registerMeshSupportCollider\(/, 'district terrain must not register mesh support colliders directly');
assert.doesNotMatch(districtSource, /registerVoxelSupportCollider\(/, 'district terrain must not register voxel support colliders directly');
assert.match(terrainLayerSource, /export function createTerrainLayer/, 'terrain-layer module must expose one layer factory');
assert.match(terrainLayerSource, /group\.userData\.owner = 'TerrainLayer'/, 'terrain group must declare TerrainLayer ownership');
assert.match(terrainLayerSource, /const colliders = \[\]/, 'TerrainLayer must own support colliders internally');
assert.match(terrainLayerSource, /const visualMeshes = \[\]/, 'TerrainLayer must own visual meshes internally');
assert.match(terrainLayerSource, /imperial_floating_strata/, 'TerrainLayer must preserve the Imperial Floating Strata terrain label');
assert.match(terrainLayerSource, /fieldGrammar: 'imperial_floating_strata'/, 'Imperial Floating Strata must route to its own field builder');
assert.match(terrainLayerSource, /baseGrammar/, 'TerrainLayer must record the base field grammar when a terrain label aliases an existing generator');
assert.match(terrainLayerSource, /imperialFunction/, 'TerrainLayer must carry district function metadata into terrain fields');
assert.match(terrainLayerSource, /const addIslandStamp = /, 'TerrainLayer must own island stamp emission');
assert.match(terrainLayerSource, /const addBridgeSpan = /, 'TerrainLayer must own connector span emission');
assert.match(terrainLayerSource, /const supportAt = /, 'TerrainLayer must answer support queries');
assert.match(terrainLayerSource, /const intersectsBody = /, 'TerrainLayer must answer body intersection queries');
assert.match(terrainLayerSource, /colliderBySource/, 'TerrainLayer must index colliders by source for spawn selection');
assert.match(terrainLayerSource, /colliders\.includes\(collider\)/, 'TerrainLayer local transforms must reject legacy colliders it does not own');
assert.match(terrainLayerSource, /disposeObjectTree/, 'TerrainLayer must own disposal for generated terrain meshes');

console.log(JSON.stringify({ ok: true, contract: 'terrain-layer-architecture' }));
