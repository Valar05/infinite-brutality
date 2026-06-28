import assert from 'node:assert/strict';
import { buildExposedVoxelFaceMeshData, buildRoomIslandField, buildSedimentaryMesaMeshData } from '../src/island-geometry.js';

// This test intentionally measures only procedural slice geometry. It excludes
// imported actors, sky, HUD, and textures so lag from the procedural generator
// cannot hide behind unrelated runtime cost.
const CURRENT_SLICE_STRUCTURES = [
  { label: 'Cistern Customs Carved Structure', size: [40, 12, 50], seed: 1000 },
  { label: 'Graft Market Carved Structure', size: [40, 12, 50], seed: 1001 },
  { label: 'Witness Cistern Carved Structure', size: [40, 12, 50], seed: 1002 },
];

// Active island-art connectors must now be built causeways/stairs, not terrain
// bridge spans. This array intentionally stays empty so the budget mirrors the
// no-floating-rock-bridge runtime contract.
const CURRENT_SLICE_RAMP_SEGMENTS = [];

const MOBILE_PROCEDURAL_BUDGET = {
  totalTriangles: 12000,
  totalEmittedVertices: 36000,
  totalUniqueEdges: 18000,
  maxIslandTriangles: 4000,
  maxRampTriangles: 900,
  maxTotalContourToExposedRatio: 1.6,
  maxIslandContourToExposedRatio: 1.75,
  maxRampContourToExposedRatio: 1.2,
};

function uniqueEdgeCount(mesh) {
  const positions = mesh.positions;
  const edges = new Set();
  const keyAtVertex = (vertexIndex) => {
    const i = vertexIndex * 3;
    return `${positions[i].toFixed(3)},${positions[i + 1].toFixed(3)},${positions[i + 2].toFixed(3)}`;
  };
  const indices = mesh.indices?.length ? mesh.indices : Array.from({ length: positions.length / 3 }, (_, index) => index);
  for (let i = 0; i < indices.length; i += 3) {
    const verts = [keyAtVertex(indices[i]), keyAtVertex(indices[i + 1]), keyAtVertex(indices[i + 2])];
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

const islandStats = CURRENT_SLICE_STRUCTURES.map((entry) => {
  const field = buildRoomIslandField(entry.size, entry.seed, {
    grammar: 'carved_imperial_structure',
    terraced: true,
    role: 'carved_imperial_structure',
    rockSilhouette: 'fortress_cavern_logistics_spine',
    imperialFunction: 'imperial_airship_logistics_fortress',
  });
  const mesh = buildSedimentaryMesaMeshData(field, 0.072);
  const exposedMesh = buildExposedVoxelFaceMeshData(field, 0.072);
  return {
    kind: 'structure',
    label: entry.label,
    cell: Number(field.cell.toFixed(3)),
    dims: [field.nx, field.ny, field.nz],
    triangles: mesh.triangleCount,
    exposedFaceTriangles: exposedMesh.triangleCount,
    exposedFaceRatio: Number((mesh.triangleCount / Math.max(1, exposedMesh.triangleCount)).toFixed(3)),
    emittedVertices: mesh.positions.length / 3,
    uniqueEdges: uniqueEdgeCount(mesh),
  };
});
const rampStats = CURRENT_SLICE_RAMP_SEGMENTS;
const allStats = [...islandStats, ...rampStats];
const total = allStats.reduce((sum, stats) => ({
  triangles: sum.triangles + stats.triangles,
  emittedVertices: sum.emittedVertices + stats.emittedVertices,
  uniqueEdges: sum.uniqueEdges + stats.uniqueEdges,
}), { triangles: 0, emittedVertices: 0, uniqueEdges: 0 });
total.exposedFaceTriangles = allStats.reduce((sum, stats) => sum + stats.exposedFaceTriangles, 0);
total.exposedFaceRatio = Number((total.triangles / Math.max(1, total.exposedFaceTriangles)).toFixed(3));

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
if (total.exposedFaceRatio > MOBILE_PROCEDURAL_BUDGET.maxTotalContourToExposedRatio) {
  failures.push(`active sedimentary contour ratio ${total.exposedFaceRatio} > ${MOBILE_PROCEDURAL_BUDGET.maxTotalContourToExposedRatio}; visible terrain exceeds the mobile contour-shell budget`);
}
for (const stats of islandStats) {
  if (stats.triangles > MOBILE_PROCEDURAL_BUDGET.maxIslandTriangles) {
    failures.push(`${stats.label} structure triangles ${stats.triangles} > ${MOBILE_PROCEDURAL_BUDGET.maxIslandTriangles}`);
  }
  if (stats.exposedFaceRatio > MOBILE_PROCEDURAL_BUDGET.maxIslandContourToExposedRatio) {
    failures.push(`${stats.label} structure contour ratio ${stats.exposedFaceRatio} > ${MOBILE_PROCEDURAL_BUDGET.maxIslandContourToExposedRatio}`);
  }
}
for (const stats of rampStats) {
  if (stats.triangles > MOBILE_PROCEDURAL_BUDGET.maxRampTriangles) {
    failures.push(`${stats.label} triangles ${stats.triangles} > ${MOBILE_PROCEDURAL_BUDGET.maxRampTriangles}`);
  }
  if (stats.exposedFaceRatio > MOBILE_PROCEDURAL_BUDGET.maxRampContourToExposedRatio) {
    failures.push(`${stats.label} contour ratio ${stats.exposedFaceRatio} > ${MOBILE_PROCEDURAL_BUDGET.maxRampContourToExposedRatio}`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ...report, failures }, null, 2));
}
assert.deepEqual(failures, [], 'procedural scene geometry exceeds mobile budget');
console.log(JSON.stringify({ ok: true, ...report }, null, 2));
