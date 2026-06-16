import assert from 'node:assert/strict';
import { buildRockBridgeField, buildRoomIslandField, buildSurfaceNetMeshData } from '../src/island-geometry.js';

const DRIFTFIELD_TARGET_CELL = 4.8;
const MAX_ROOM_TRIANGLES = 1200;
const MAX_BRIDGE_TRIANGLES = 700;
const MAX_REPRESENTATIVE_TRIANGLES = 6000;

function meshDiagnostics(label, field) {
  const mesh = buildSurfaceNetMeshData(field);
  return {
    label,
    cell: Number(field.cell.toFixed(3)),
    dims: [field.nx, field.ny, field.nz],
    triangles: mesh.triangleCount,
    emittedVertices: mesh.positions.length / 3,
  };
}

const roomDiagnostics = [
  meshDiagnostics('compact-room-island', buildRoomIslandField([12, 6, 12], 1)),
  meshDiagnostics('cistern-customs-terrace', buildRoomIslandField([30, 11, 26], 1000, true)),
  meshDiagnostics('graft-market-crown', buildRoomIslandField([35, 13, 30], 1001, true)),
  meshDiagnostics('witness-cistern-stair', buildRoomIslandField([28, 12, 27], 1002, true)),
];

const bridgeDiagnostics = [
  meshDiagnostics('short-stepped-ramp-a', buildRockBridgeField(10, 5.8, 1.55, 2000)),
  meshDiagnostics('short-stepped-ramp-b', buildRockBridgeField(11, 5.8, 1.55, 2003)),
  meshDiagnostics('long-contract-bridge', buildRockBridgeField(28, 4.8, 1.6, 1)),
];

const allDiagnostics = [...roomDiagnostics, ...bridgeDiagnostics];
const totalTriangles = allDiagnostics.reduce((sum, diag) => sum + diag.triangles, 0);
const failures = [];

for (const diag of roomDiagnostics) {
  if (diag.triangles <= 0) failures.push(`${diag.label} emitted no triangles`);
  if (diag.triangles > MAX_ROOM_TRIANGLES) failures.push(`${diag.label} emitted ${diag.triangles} triangles > ${MAX_ROOM_TRIANGLES}`);
  if (diag.cell > DRIFTFIELD_TARGET_CELL) failures.push(`${diag.label} cell ${diag.cell} exceeds Driftfield target ${DRIFTFIELD_TARGET_CELL}`);
  if (diag.cell < 1.35) failures.push(`${diag.label} cell ${diag.cell} fell back to dense voxel scale`);
}

for (const diag of bridgeDiagnostics) {
  if (diag.triangles <= 0) failures.push(`${diag.label} emitted no triangles`);
  if (diag.triangles > MAX_BRIDGE_TRIANGLES) failures.push(`${diag.label} emitted ${diag.triangles} triangles > ${MAX_BRIDGE_TRIANGLES}`);
  if (diag.cell < 1.35) failures.push(`${diag.label} cell ${diag.cell} fell back to dense voxel scale`);
}

if (totalTriangles > MAX_REPRESENTATIVE_TRIANGLES) {
  failures.push(`representative terrain emitted ${totalTriangles} triangles > ${MAX_REPRESENTATIVE_TRIANGLES}`);
}

if (failures.length) {
  console.error(JSON.stringify({
    summary: 'Low-poly island geometry contract failed.',
    target: 'Driftfield-scale procedural terrain, not dense voxel layering.',
    totalTriangles,
    roomDiagnostics,
    bridgeDiagnostics,
    failures,
  }, null, 2));
}

assert.deepEqual(failures, [], 'island geometry must remain Driftfield-scale and mobile-light');
console.log(JSON.stringify({
  ok: true,
  summary: 'Low-poly island geometry contract passed.',
  totalTriangles,
  roomDiagnostics,
  bridgeDiagnostics,
}, null, 2));
