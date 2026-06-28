import assert from 'node:assert/strict';
import {
  buildRoomIslandField,
  buildSedimentaryMesaBridgeField,
  buildSedimentaryMesaMeshData,
} from '../src/island-geometry.js';

const MAX_AXIS_ALIGNED_NORMAL_RATIO = 0.72;
const MAX_LARGE_QUAD_WORLD_UNITS = 8.5;
const MIN_BOUNDARY_VERTEX_RATIO = 0.42;

function vecAt(positions, vertexIndex) {
  const i = vertexIndex * 3;
  return [positions[i], positions[i + 1], positions[i + 2]];
}

function triangleArea(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  return Math.hypot(cross[0], cross[1], cross[2]) * 0.5;
}

function triangleNormal(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / length, n[1] / length, n[2] / length];
}

function longestEdge(a, b, c) {
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return Math.max(dist(a, b), dist(b, c), dist(c, a));
}

function visualStats(mesh) {
  const positions = mesh.positions;
  const indices = mesh.indices?.length
    ? mesh.indices
    : Array.from({ length: positions.length / 3 }, (_, index) => index);
  let totalArea = 0;
  let axisAlignedArea = 0;
  let maxEdge = 0;
  const xValues = [];
  const zValues = [];

  for (let i = 0; i < positions.length; i += 3) {
    xValues.push(positions[i]);
    zValues.push(positions[i + 2]);
  }
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  let boundaryVertices = 0;
  const boundaryEpsilon = 0.18;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    if (
      Math.abs(x - minX) < boundaryEpsilon ||
      Math.abs(x - maxX) < boundaryEpsilon ||
      Math.abs(z - minZ) < boundaryEpsilon ||
      Math.abs(z - maxZ) < boundaryEpsilon
    ) {
      boundaryVertices += 1;
    }
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = vecAt(positions, indices[i]);
    const b = vecAt(positions, indices[i + 1]);
    const c = vecAt(positions, indices[i + 2]);
    const area = triangleArea(a, b, c);
    const normal = triangleNormal(a, b, c);
    totalArea += area;
    if (Math.max(Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])) > 0.985) {
      axisAlignedArea += area;
    }
    maxEdge = Math.max(maxEdge, longestEdge(a, b, c));
  }

  return {
    triangleCount: indices.length / 3,
    axisAlignedNormalRatio: totalArea ? axisAlignedArea / totalArea : 1,
    maxEdge,
    boundaryVertexRatio: boundaryVertices / Math.max(1, positions.length / 3),
  };
}

const cases = [
  ['sedimentary-mesa', buildRoomIslandField([30, 11, 26], 1000, { grammar: 'sedimentary_mesa', terraced: true, role: 'arena' })],
  ['sedimentary-bridge', buildSedimentaryMesaBridgeField(28, 4.8, 1.6, 1)],
];

const failures = [];
const report = [];

for (const [label, field] of cases) {
  const mesh = buildSedimentaryMesaMeshData(field, 0.072);
  const stats = visualStats(mesh);
  report.push({
    label,
    triangleCount: stats.triangleCount,
    axisAlignedNormalRatio: Number(stats.axisAlignedNormalRatio.toFixed(3)),
    maxEdge: Number(stats.maxEdge.toFixed(3)),
    boundaryVertexRatio: Number(stats.boundaryVertexRatio.toFixed(3)),
  });
  if (stats.axisAlignedNormalRatio > MAX_AXIS_ALIGNED_NORMAL_RATIO) {
    failures.push(`${label} axis-aligned normal ratio ${stats.axisAlignedNormalRatio.toFixed(3)} > ${MAX_AXIS_ALIGNED_NORMAL_RATIO}; visible mesh still reads as voxel/box faces`);
  }
  if (stats.maxEdge > MAX_LARGE_QUAD_WORLD_UNITS) {
    failures.push(`${label} longest visible edge ${stats.maxEdge.toFixed(3)} > ${MAX_LARGE_QUAD_WORLD_UNITS}; giant merged sheets need subdivision or contouring`);
  }
  if (stats.boundaryVertexRatio > MIN_BOUNDARY_VERTEX_RATIO) {
    failures.push(`${label} boundary vertex ratio ${stats.boundaryVertexRatio.toFixed(3)} > ${MIN_BOUNDARY_VERTEX_RATIO}; silhouette is too rectangular/box-bounded`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, contract: 'terrain-visual-proxy', report, failures }, null, 2));
}

assert.deepEqual(failures, [], 'sedimentary visible terrain must not read as Minecraft, plank piles, or giant axis-aligned sheets');
console.log(JSON.stringify({ ok: true, contract: 'terrain-visual-proxy', report }, null, 2));
