import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSedimentaryMesaBridgeField, buildSedimentaryMesaMeshData, buildSurfaceNetMeshData } from '../src/island-geometry.js';

const districtGeometry = fs.readFileSync(new URL('../src/district-geometry.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const terrainLayer = fs.readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');

assert.ok(
  districtGeometry.includes('function addDistrictRouteIslands(district, contract) {\n    return;'),
  'per-room route islands must remain disabled in island art mode',
);
assert.ok(
  districtGeometry.includes('addDistrictIslandMasses(district, contract);\n    addDistrictIslandBridges(district, contract);'),
  'district visuals must come from mass islands and mass bridges',
);
assert.ok(
  main.includes('const PLAYABLE_SLICE_ROOM_COUNT = 3;'),
  'runtime must cap the current playable slice to three islands',
);
assert.ok(
  main.includes('addIslandArtSteppedRamp('),
  'slice islands must use explicit stair-stepped organic ramp connectors',
);
assert.ok(
  !main.includes("addIslandArtSteppedRamp('gauntlet-connector-"),
  'slice connectors must not reuse old gauntlet tube naming/contract',
);

assert.ok(
  districtGeometry.includes("rockGrammar: anchor.rockGrammar || 'sedimentary_mesa'"),
  'active terraced district mass anchors must use the sedimentary mesa rock grammar',
);
assert.ok(
  main.includes("rockGrammar: 'sedimentary_mesa'"),
  'playable slice anchors must opt into sedimentary mesa terrain',
);
assert.ok(
  main.includes("const BUILD = '0.8.175';"),
  'runtime build should be cache-busted for the playable sedimentary mesa slice',
);

assert.ok(
  terrainLayer.includes("const isSedimentaryMesa = field.rockGrammar?.grammar === 'sedimentary_mesa';"),
  'sedimentary mesa islands must use a dedicated visible mesh/material path',
);
assert.ok(
  terrainLayer.includes('buildSedimentaryMesaMeshData(field, MAT.sedimentaryRock?.userData?.uvScale ?? 0.072)'),
  'sedimentary mesa visible mesh must use the dedicated manifold sedimentary mesh and material',
);
assert.ok(
  terrainLayer.includes('MAT.sedimentaryRock : MAT.sedimentaryRockDark'),
  'sedimentary mesa islands must use dedicated sedimentary terrain materials, not vector-stone architecture materials',
);

assert.ok(
  terrainLayer.includes('buildSedimentaryMesaBridgeField(spec.length, spec.width, thickness, seed)'),
  'active island art bridges must use contiguous sedimentary slab bridge fields',
);
assert.ok(
  terrainLayer.includes('buildSedimentaryMesaMeshData(field, MAT.sedimentaryRock?.userData?.uvScale ?? 0.072)'),
  'active island art bridges must use the dedicated manifold sedimentary mesh and material',
);
assert.ok(
  terrainLayer.includes('spec.material || (spec.slabBridge === false ? MAT.islandRockDark : MAT.sedimentaryRockDark)'),
  'active stepped ramps must default to dedicated sedimentary material, not vector stone or pebble rock',
);

const longBridge = buildSedimentaryMesaBridgeField(135, 5.8, 2.0, 1);
const longBridgeMesh = buildSedimentaryMesaMeshData(longBridge, 0.072);
assert.equal(longBridge.rockGrammar?.grammar, 'sedimentary_mesa', 'long active bridge should carry sedimentary mesa grammar metadata');
assert.equal(longBridge.rockGrammar?.silhouette, 'bridge_fragment', 'long active bridge should declare bridge-fragment silhouette');
assert.ok(longBridge.cell >= 1.35, `long bridge cell size ${longBridge.cell} is too dense for mobile`);
assert.ok(longBridgeMesh.triangleCount > 0, 'long bridge should still emit a visible/support mesh');
assert.ok(longBridgeMesh.triangleCount < 9000, `long bridge produced ${longBridgeMesh.triangleCount} triangles; expected under 9000`);

console.log(JSON.stringify({
  ok: true,
  contract: 'island-grammar',
  longBridgeCell: Number(longBridge.cell.toFixed(3)),
  longBridgeTriangles: longBridgeMesh.triangleCount,
}));
