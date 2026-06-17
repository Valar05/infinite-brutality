import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIslandBridgeSpec, buildIslandVoxelField, countExposedVoxelFaces, buildGreedyVoxelMeshData, buildSurfaceNetMeshData, buildRoomIslandMeshData, buildRockBridgeMeshData } from '../src/island-geometry.js';

const bridge = buildIslandBridgeSpec(
  { id: 'a', pos: [0, 10, 0], size: [18, 14, 16] },
  { id: 'b', pos: [22, 12, 30], size: [16, 12, 18] },
);
assert.equal(bridge.visible, true, 'bridge spec should mark long spans visible');
assert.ok(bridge.deckSize[0] > 0 && bridge.deckSize[2] > 0, 'bridge deck size must be positive');
assert.ok(Number.isFinite(bridge.yaw), 'bridge yaw must be finite');

const field = buildIslandVoxelField({ id: 'test', pos: [0, 0, 0], size: [18, 14, 16] }, 12345);
const exposedFaces = countExposedVoxelFaces(field);
const mesh = buildGreedyVoxelMeshData(field);
assert.ok(mesh.quadCount > 0, 'greedy mesh must emit quads');
assert.ok(mesh.quadCount < exposedFaces, 'greedy mesh must reduce naive exposed face count');
assert.equal(mesh.indices.length % 3, 0, 'mesh indices must form triangles');
assert.equal(mesh.positions.length % 3, 0, 'mesh positions must be xyz triples');

const roomIsland = buildRoomIslandMeshData([12, 6, 12], 6789);
assert.ok(roomIsland.triangleCount > 0, 'room island surface nets must emit triangles');
const bridgeMesh = buildRockBridgeMeshData(28, 4.8, 1.6, 2468);
assert.ok(bridgeMesh.triangleCount > 0, 'rock bridge surface nets must emit triangles');
const netMesh = buildSurfaceNetMeshData(field);
assert.ok(netMesh.triangleCount > 0, 'surface-net meshes must emit triangles');

const districtGeometrySource = fs.readFileSync(path.resolve('src/district-geometry.js'), 'utf8');
assert.match(districtGeometrySource, /const field = buildRoomIslandField\(size,/, 'district room traversal must come from voxel room-island fields');
assert.match(districtGeometrySource, /registerVoxelSupportCollider\(field, \{ origin: worldPos, source: 'district-room-island-voxel:' \+ district\.id \+ ':' \+ i \}\);/, 'district room islands must register voxel support from the same generated field');
assert.match(districtGeometrySource, /const spec = buildIslandBridgeSpec\(anchors\[i\], anchors\[i \+ 1\]\);/, 'district landmark bridges must still come from the shared bridge spec');
assert.match(districtGeometrySource, /const field = buildSedimentaryMesaBridgeField\(spec\.horizontalLength, spec\.deckSize\[0\], 1\.6,/, 'district bridges must build visible sedimentary slab fields from the shared bridge spec');
assert.ok(!districtGeometrySource.includes('buildRockBridgeField(spec.horizontalLength'), 'district bridges must not fall back to the old lumpy rock bridge generator');
assert.match(districtGeometrySource, /group\.position\.set\(spec\.center\.x, spec\.center\.y, spec\.center\.z\);/, 'district bridge visual must use the shared bridge center');
assert.match(districtGeometrySource, /group\.rotation\.y = spec\.yaw;/, 'district bridge visual must use the shared bridge yaw');
assert.match(districtGeometrySource, /registerVoxelSupportCollider\(field, \{ origin: \[spec\.center\.x, spec\.center\.y, spec\.center\.z\], yaw: spec\.yaw, source: 'district-island-bridge-voxel:' \+ district\.id \+ ':' \+ i \}\);/, 'district bridge support must come from the same generated bridge voxel field');
assert.match(districtGeometrySource, /anchor\.terraced[\s\S]*buildRoomIslandField\(anchor\.size,[\s\S]*grammar: anchor\.rockGrammar \|\| 'sedimentary_mesa'[\s\S]*terraced: true[\s\S]*buildIslandVoxelField\(anchor,/, 'district landmark islands must build sedimentary mesa or fallback voxel fields from shared helpers');
assert.match(districtGeometrySource, /const meshData = isSedimentaryMesa[\s\S]*buildSedimentaryMesaMeshData\(field, MAT\.sedimentaryRock/, 'district islands must use dedicated layered slab meshes with sedimentary rock materials');
assert.match(districtGeometrySource, /registerVoxelSupportCollider\(field, \{ origin: anchor\.pos, yaw: anchor\.yaw \|\| 0, source: 'district-island-voxel:' \+ anchor\.id \}\);/, 'district landmark islands must register oriented voxel support from the same generated field');
const mainSource = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
assert.match(mainSource, /const field = options\.slabBridge === false[\s\S]*buildRockBridgeField\(length, width, thickness, bridgeSeed\)[\s\S]*buildSedimentaryMesaBridgeField\(length, width, thickness, bridgeSeed\);/, 'world connector bridges must default to shared sedimentary slab voxel fields');
assert.match(mainSource, /registerVoxelSupportCollider\(field, \{ origin: \[center\.x, center\.y, center\.z\], yaw, source: \(options\.source \|\| name\) \+ ':voxel' \}\);/, 'world connector bridges must register voxel support from the same generated slab bridge field');

console.log(JSON.stringify({
  bridgeLength: bridge.horizontalLength,
  exposedFaces,
  greedyQuads: mesh.quadCount,
  triangles: mesh.triangleCount,
}));
