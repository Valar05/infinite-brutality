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
  'legacy fallback district visuals must still keep mass-island bridge order when carved mode is not active',
);
assert.ok(
  districtGeometry.includes("district.terrainMode === 'carved_imperial_structure'"),
  'active Napoleon proof slice must have a carved-structure district path before island/bridge fallback',
);
assert.ok(
  main.includes('const PLAYABLE_SLICE_ROOM_COUNT = 3;'),
  'runtime must cap the current playable slice to three islands',
);
assert.ok(
  main.includes("'carved-causeway-' + index"),
  'active slice connectors must use built carved causeways/stairs instead of floating terrain ramps',
);
assert.ok(
  !main.includes("addIslandArtSteppedRamp('slice-ramp-"),
  'active slice connectors must not emit floating terrain ramp spans',
);
assert.ok(
  !main.includes("addIslandArtSteppedRamp('gauntlet-connector-"),
  'slice connectors must not reuse old gauntlet tube naming/contract',
);

assert.ok(
  districtGeometry.includes("rockGrammar: 'carved_imperial_structure'"),
  'active carved structure must submit carved imperial structure terrain labels',
);
assert.ok(
  main.includes("rockGrammar: 'carved_imperial_structure'"),
  'playable slice anchors must opt into carved imperial structure terrain labels',
);
assert.ok(
  main.includes("'carved-causeway-' + index") && !main.includes("addIslandArtSteppedRamp('slice-ramp-"),
  'active proof-slice connectors must be built causeways, not floating terrain bridge spans',
);
assert.ok(
  districtGeometry.includes('function addCarvedImperialStructure(district, contract)'),
  'Imperial terrain must have a carved structure emission path',
);
assert.ok(
  districtGeometry.includes("'-embedded-rail-'") && districtGeometry.includes("'-mooring-socket-a-"),
  'carved imperial structure renderer must keep only sparse embedded hardware, not large box surfaces',
);
assert.ok(
  !districtGeometry.includes("'-parade-spine'") && !districtGeometry.includes("'-fortress-court'") && !districtGeometry.includes("'-command-tower'"),
  'carved imperial structure must not be assembled from large walkable boxes or pasted box towers',
);
assert.ok(
  main.includes("const BUILD = '0.8.179';"),
  'runtime build should be cache-busted for the playable sedimentary mesa slice',
);

assert.ok(
  terrainLayer.includes("field.rockGrammar?.grammar === 'carved_imperial_structure'"),
  'carved structure labels must still use the dedicated sedimentary visible mesh/material path',
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
