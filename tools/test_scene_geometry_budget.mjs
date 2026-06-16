import assert from 'node:assert/strict';
import { buildRoomIslandField, buildRockBridgeField, buildSurfaceNetMeshData } from '../src/island-geometry.js';

// This test intentionally measures only procedural slice geometry. It excludes
// imported actors, sky, HUD, and textures so lag from the procedural generator
// cannot hide behind unrelated runtime cost.
const CURRENT_SLICE_ISLANDS = [
  { label: 'Cistern Customs Terrace', size: [30, 11, 26], seed: 1000 },
  { label: 'Graft Market Crown', size: [35, 13, 30], seed: 1001 },
  { label: 'Witness Cistern Stair', size: [28, 12, 27], seed: 1002 },
];

// The live slice makes two inter-island connectors, and each connector is split
// into three noisy rock spans by addIslandArtSteppedRamp(). These conservative
// lengths are short; if this fails, the real browser scene is already too heavy.
const CURRENT_SLICE_RAMP_SEGMENTS = [
  { label: 'ramp-0-a', length: 10, width: 5.8, thickness: 1.55, seed: 2000 },
  { label: 'ramp-0-b', length: 10, width: 5.8, thickness: 1.55, seed: 2001 },
  { label: 'ramp-0-c', length: 10, width: 5.8, thickness: 1.55, seed: 2002 },
  { label: 'ramp-1-a', length: 11, width: 5.8, thickness: 1.55, seed: 2003 },
  { label: 'ramp-1-b', length: 11, width: 5.8, thickness: 1.55, seed: 2004 },
  { label: 'ramp-1-c', length: 11, width: 5.8, thickness: 1.55, seed: 2005 },
];

const MOBILE_PROCEDURAL_BUDGET = {
  totalTriangles: 12000,
  totalEmittedVertices: 36000,
  totalUniqueEdges: 18000,
  maxIslandTriangles: 4000,
  maxRampTriangles: 900,
};

function uniqueEdgeCount(mesh) {
  const positions = mesh.positions;
  const edges = new Set();
  const keyAt = (i) => `${positions[i].toFixed(3)},${positions[i + 1].toFixed(3)},${positions[i + 2].toFixed(3)}`;
  for (let i = 0; i < positions.length; i += 9) {
    const verts = [keyAt(i), keyAt(i + 3), keyAt(i + 6)];
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const a = verts[edgeIndex];
      const b = verts[(edgeIndex + 1) % 3];
      edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return edges.size;
}

function meshStats(label, field, kind) {
  const mesh = buildSurfaceNetMeshData(field);
  return {
    kind,
    label,
    cell: Number(field.cell.toFixed(3)),
    dims: [field.nx, field.ny, field.nz],
    triangles: mesh.triangleCount,
    emittedVertices: mesh.positions.length / 3,
    uniqueEdges: uniqueEdgeCount(mesh),
  };
}

const islandStats = CURRENT_SLICE_ISLANDS.map((entry) => meshStats(
  entry.label,
  buildRoomIslandField(entry.size, entry.seed, true),
  'island',
));
const rampStats = CURRENT_SLICE_RAMP_SEGMENTS.map((entry) => meshStats(
  entry.label,
  buildRockBridgeField(entry.length, entry.width, entry.thickness, entry.seed),
  'ramp',
));
const allStats = [...islandStats, ...rampStats];
const total = allStats.reduce((sum, stats) => ({
  triangles: sum.triangles + stats.triangles,
  emittedVertices: sum.emittedVertices + stats.emittedVertices,
  uniqueEdges: sum.uniqueEdges + stats.uniqueEdges,
}), { triangles: 0, emittedVertices: 0, uniqueEdges: 0 });

const report = {
  summary: 'Procedural slice geometry budget',
  budget: MOBILE_PROCEDURAL_BUDGET,
  total,
  meshes: allStats,
};

const failures = [];
if (total.triangles > MOBILE_PROCEDURAL_BUDGET.totalTriangles) {
  failures.push(`total triangles ${total.triangles} > ${MOBILE_PROCEDURAL_BUDGET.totalTriangles}`);
}
if (total.emittedVertices > MOBILE_PROCEDURAL_BUDGET.totalEmittedVertices) {
  failures.push(`emitted vertices ${total.emittedVertices} > ${MOBILE_PROCEDURAL_BUDGET.totalEmittedVertices}`);
}
if (total.uniqueEdges > MOBILE_PROCEDURAL_BUDGET.totalUniqueEdges) {
  failures.push(`unique edges ${total.uniqueEdges} > ${MOBILE_PROCEDURAL_BUDGET.totalUniqueEdges}`);
}
for (const stats of islandStats) {
  if (stats.triangles > MOBILE_PROCEDURAL_BUDGET.maxIslandTriangles) {
    failures.push(`${stats.label} island triangles ${stats.triangles} > ${MOBILE_PROCEDURAL_BUDGET.maxIslandTriangles}`);
  }
}
for (const stats of rampStats) {
  if (stats.triangles > MOBILE_PROCEDURAL_BUDGET.maxRampTriangles) {
    failures.push(`${stats.label} triangles ${stats.triangles} > ${MOBILE_PROCEDURAL_BUDGET.maxRampTriangles}`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ...report, failures }, null, 2));
}
assert.deepEqual(failures, [], 'procedural scene geometry exceeds mobile budget');
console.log(JSON.stringify({ ok: true, ...report }, null, 2));
