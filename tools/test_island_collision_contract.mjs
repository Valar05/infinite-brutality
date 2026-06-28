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
const terrainLayerSource = fs.readFileSync(path.resolve('src/terrain-layer.js'), 'utf8');
assert.match(districtGeometrySource, /activeTerrainLayer/, 'district terrain must target the active TerrainLayer');
assert.match(districtGeometrySource, /terrain\.addIslandStamp\(/, 'district island traversal must be submitted as TerrainLayer stamps');
assert.match(terrainLayerSource, /buildRoomIslandField\(spec\.size, seed,/, 'TerrainLayer island stamps must build voxel room-island fields');
assert.match(terrainLayerSource, /addCollider\(field, origin, yaw, source, kind, mesh\)/, 'TerrainLayer must register visible mesh colliders from the generated terrain mesh');
assert.match(districtGeometrySource, /const spec = buildIslandBridgeSpec\(anchors\[i\], anchors\[i \+ 1\]\);/, 'district landmark bridges must still come from the shared bridge spec');
assert.match(districtGeometrySource, /terrain\.addBridgeSpan\(/, 'district bridges must be submitted as TerrainLayer spans');
assert.match(terrainLayerSource, /buildSedimentaryMesaBridgeField\(spec\.length, spec\.width, thickness, seed\)/, 'TerrainLayer bridges must build visible sedimentary slab fields from the shared bridge spec');
assert.ok(!districtGeometrySource.includes('buildRockBridgeField(spec.horizontalLength'), 'district bridges must not fall back to the old lumpy rock bridge generator');
assert.match(districtGeometrySource, /origin: \[spec\.center\.x, spec\.center\.y, spec\.center\.z\]/, 'district bridge visual/support must use the shared bridge center');
assert.match(districtGeometrySource, /yaw: spec\.yaw/, 'district bridge visual/support must use the shared bridge yaw');
assert.match(districtGeometrySource, /source: 'district-island-bridge-voxel:' \+ district\.id \+ ':' \+ i/, 'district bridge support must come from the same generated bridge voxel field');
assert.match(terrainLayerSource, /grammar: grammar\.fieldGrammar/, 'district landmark islands must build sedimentary mesa or fallback voxel fields from shared helpers');
assert.match(terrainLayerSource, /buildSedimentaryMesaMeshData\(field, MAT\.sedimentaryRock/, 'district islands must use dedicated layered slab meshes with sedimentary rock materials');
assert.match(terrainLayerSource, /terrainSupportRaycaster\.intersectObject\(collider\.mesh, true\)/, 'visible terrain mesh must be runtime support truth');
assert.doesNotMatch(terrainLayerSource, /queryVoxelTopY/, 'TerrainLayer must not use hidden voxel tops as runtime support truth');
assert.match(districtGeometrySource, /source: 'district-island-voxel:' \+ anchor\.id/, 'district landmark islands must register oriented voxel support from the same generated field');
const mainSource = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
assert.match(mainSource, /terrain\.addBridgeSpan\(/, 'world connector bridges must route through TerrainLayer');
assert.match(mainSource, /source: \(options\.source \|\| name\) \+ ':voxel'/, 'world connector bridges must register voxel support from the same generated slab bridge field');

console.log(JSON.stringify({
  bridgeLength: bridge.horizontalLength,
  exposedFaces,
  greedyQuads: mesh.quadCount,
  triangles: mesh.triangleCount,
}));
