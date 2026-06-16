import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRockBridgeField, buildSurfaceNetMeshData } from '../src/island-geometry.js';

const districtGeometry = fs.readFileSync(new URL('../src/district-geometry.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

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

const longBridge = buildRockBridgeField(135, 5.8, 2.0, 1);
const longBridgeMesh = buildSurfaceNetMeshData(longBridge);
assert.ok(longBridge.cell >= 1.35, `long bridge cell size ${longBridge.cell} is too dense for mobile`);
assert.ok(longBridgeMesh.triangleCount > 0, 'long bridge should still emit a visible/support mesh');
assert.ok(longBridgeMesh.triangleCount < 9000, `long bridge produced ${longBridgeMesh.triangleCount} triangles; expected under 9000`);

console.log(JSON.stringify({
  ok: true,
  contract: 'island-grammar',
  longBridgeCell: Number(longBridge.cell.toFixed(3)),
  longBridgeTriangles: longBridgeMesh.triangleCount,
}));
