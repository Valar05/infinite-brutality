import assert from 'node:assert/strict';
import { buildRoomIslandField, buildSedimentaryMesaMeshData, buildSurfaceNetMeshData, queryVoxelTopY } from '../src/island-geometry.js';

function voxelAt(field, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) return 0;
  return field.voxels[x + field.nx * (y + field.ny * z)];
}

function sampleTopPoints(field, xScale = 1, zScale = 1, stepScale = 0.5) {
  const points = [];
  const minX = field.min.x * xScale;
  const maxX = field.max.x * xScale;
  const minZ = field.min.z * zScale;
  const maxZ = field.max.z * zScale;
  for (let z = minZ; z <= maxZ; z += field.cell * stepScale) {
    for (let x = minX; x <= maxX; x += field.cell * stepScale) {
      const top = queryVoxelTopY(field, x, z, field.cell * 0.18);
      if (top == null) continue;
      points.push({ x, z, top });
    }
  }
  return points;
}

function centralCoverage(field) {
  let total = 0;
  let occupied = 0;
  for (let z = field.min.z * 0.55; z <= field.max.z * 0.55; z += field.cell * 0.5) {
    for (let x = field.min.x * 0.55; x <= field.max.x * 0.55; x += field.cell * 0.5) {
      total += 1;
      if (queryVoxelTopY(field, x, z, field.cell * 0.2) != null) occupied += 1;
    }
  }
  return total ? occupied / total : 0;
}

function rimCoverageByAngle(field, sectors = 16) {
  const hits = new Array(sectors).fill(0);
  const radius = Math.min(Math.abs(field.min.x), Math.abs(field.max.x), Math.abs(field.min.z), Math.abs(field.max.z)) * 0.82;
  for (let i = 0; i < sectors; i += 1) {
    const angle = (Math.PI * 2 * i) / sectors;
    for (const scale of [0.72, 0.82, 0.92, 1.02]) {
      const x = Math.cos(angle) * radius * scale;
      const z = Math.sin(angle) * radius * scale;
      if (queryVoxelTopY(field, x, z, field.cell * 0.16) != null) hits[i] += 1;
    }
  }
  return hits;
}

function standardDeviation(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
  return Math.sqrt(variance);
}

function topBandCount(field) {
  const points = sampleTopPoints(field, 0.9, 0.9, 0.45);
  const bands = new Set(points.map((point) => Math.round(point.top / field.cell)));
  return bands.size;
}

function bottomDepthSamples(field) {
  const centerDepths = [];
  const rimDepths = [];
  for (let z = 0; z < field.nz; z += 1) {
    for (let x = 0; x < field.nx; x += 1) {
      let topY = null;
      let bottomY = null;
      for (let y = 0; y < field.ny; y += 1) {
        if (!voxelAt(field, x, y, z)) continue;
        if (bottomY == null) bottomY = field.min.y + y * field.cell;
        topY = field.min.y + (y + 1) * field.cell;
      }
      if (topY == null || bottomY == null) continue;
      const localX = field.min.x + (x + 0.5) * field.cell;
      const localZ = field.min.z + (z + 0.5) * field.cell;
      const nx = localX / Math.max(Math.abs(field.min.x), Math.abs(field.max.x), 0.001);
      const nz = localZ / Math.max(Math.abs(field.min.z), Math.abs(field.max.z), 0.001);
      const radial = Math.hypot(nx, nz);
      const depth = topY - bottomY;
      if (radial < 0.36) centerDepths.push(depth);
      if (radial > 0.62 && radial < 0.96) rimDepths.push(depth);
    }
  }
  return { centerDepths, rimDepths };
}


function offGridVertexRatio(field, mesh) {
  let offGrid = 0;
  let total = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const gx = Math.abs((mesh.positions[i] - field.min.x) / field.cell - Math.round((mesh.positions[i] - field.min.x) / field.cell));
    const gy = Math.abs((mesh.positions[i + 1] - field.min.y) / field.cell - Math.round((mesh.positions[i + 1] - field.min.y) / field.cell));
    const gz = Math.abs((mesh.positions[i + 2] - field.min.z) / field.cell - Math.round((mesh.positions[i + 2] - field.min.z) / field.cell));
    if (Math.max(gx, gy, gz) > 0.012) offGrid += 1;
    total += 1;
  }
  return total ? offGrid / total : 0;
}
function sideProfileStats(field) {
  const midZ = Math.floor(field.nz * 0.5);
  const columns = [];
  for (let x = 0; x < field.nx; x += 1) {
    let topY = null;
    let bottomY = null;
    for (let y = 0; y < field.ny; y += 1) {
      if (!voxelAt(field, x, y, midZ)) continue;
      if (bottomY == null) bottomY = field.min.y + y * field.cell;
      topY = field.min.y + (y + 1) * field.cell;
    }
    if (topY == null || bottomY == null) continue;
    const localX = field.min.x + (x + 0.5) * field.cell;
    columns.push({ localX, topY, bottomY, depth: topY - bottomY });
  }
  const maxAbsX = Math.max(...columns.map((column) => Math.abs(column.localX)), 0.001);
  const center = columns.filter((column) => Math.abs(column.localX) / maxAbsX < 0.35);
  const side = columns.filter((column) => Math.abs(column.localX) / maxAbsX >= 0.68);
  const avg = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const centerDepth = avg(center.map((column) => column.depth));
  const sideDepth = avg(side.map((column) => column.depth));
  const centerBottom = avg(center.map((column) => column.bottomY));
  const sideBottom = avg(side.map((column) => column.bottomY));
  const topSpread = Math.max(...center.map((column) => column.topY)) - Math.min(...center.map((column) => column.topY));
  return {
    columns: columns.length,
    centerDepth,
    sideDepth,
    centerBottom,
    sideBottom,
    topSpread,
  };
}

const mesa = buildRoomIslandField([30, 11, 26], 1000, {
  grammar: 'sedimentary_mesa',
  terraced: true,
  role: 'arena',
});

assert.deepEqual(mesa.rockGrammar, {
  grammar: 'sedimentary_mesa',
  silhouette: 'mesa',
  process: 'sediment_layers_erosion_fracture',
  role: 'arena',
});

const coverage = centralCoverage(mesa);
assert.ok(coverage >= 0.84, `mesa central playable top coverage ${coverage.toFixed(2)} < 0.84`);

const bands = topBandCount(mesa);
assert.ok(bands >= 3, `mesa should expose at least 3 terraced top bands; saw ${bands}`);

const rimHits = rimCoverageByAngle(mesa);
const rimStdDev = standardDeviation(rimHits);
assert.ok(rimStdDev >= 0.45, `mesa rim silhouette is too uniform/blob-like; sector stddev ${rimStdDev.toFixed(2)} < 0.45`);
assert.ok(Math.min(...rimHits) >= 1, `mesa rim has a collapsed sector: ${rimHits.join(',')}`);

const { centerDepths, rimDepths } = bottomDepthSamples(mesa);
const centerDepthStdDev = standardDeviation(centerDepths);
const rimDepthStdDev = standardDeviation(rimDepths);
assert.ok(rimDepthStdDev > centerDepthStdDev * 1.15, `mesa rim undercut depth variance ${rimDepthStdDev.toFixed(2)} should exceed center ${centerDepthStdDev.toFixed(2)}`);

const sideProfile = sideProfileStats(mesa);
assert.ok(sideProfile.columns >= 8, `mesa side profile sampled too few solid columns: ${sideProfile.columns}`);
assert.ok(sideProfile.sideDepth >= sideProfile.centerDepth * 0.68, `mesa side profile pinches like a blob: side depth ${sideProfile.sideDepth.toFixed(2)} < 68% of center ${sideProfile.centerDepth.toFixed(2)}`);
assert.ok(sideProfile.sideBottom <= sideProfile.centerBottom + mesa.cell * 0.55, `mesa underside bulges upward at the rim: side bottom ${sideProfile.sideBottom.toFixed(2)} > center ${sideProfile.centerBottom.toFixed(2)}`);
assert.ok(sideProfile.topSpread <= mesa.cell * 1.15, `mesa center top is too domed: spread ${sideProfile.topSpread.toFixed(2)} > ${ (mesa.cell * 1.15).toFixed(2) }`);

const surfaceMesh = buildSurfaceNetMeshData(mesa);
const mesh = buildSedimentaryMesaMeshData(mesa, 0.072);
assert.ok(mesh.triangleCount > 0, 'mesa grammar must emit visible geometry');
assert.ok(mesh.triangleCount <= 4000, `sedimentary visual mesh emitted ${mesh.triangleCount} triangles > 4000 island budget`);
assert.ok(mesh.triangleCount <= surfaceMesh.triangleCount, `sedimentary visual mesh ${mesh.triangleCount} should not exceed the surface shell ${surfaceMesh.triangleCount}`);
const weatheredRatio = offGridVertexRatio(mesa, mesh);
assert.ok(weatheredRatio >= 0.82, `sedimentary mesh still reads like a cube grid: off-grid visual vertex ratio ${weatheredRatio.toFixed(2)} < 0.82`);

const legacyTerraced = buildRoomIslandField([30, 11, 26], 1000, true);
assert.ok(queryVoxelTopY(legacyTerraced, 0, 0, legacyTerraced.cell * 0.2) != null, 'legacy boolean terraced island must still emit support at center');

console.log(JSON.stringify({
  ok: true,
  contract: 'rock-grammar-sedimentary-mesa',
  coverage: Number(coverage.toFixed(3)),
  bands,
  rimStdDev: Number(rimStdDev.toFixed(3)),
  centerDepthStdDev: Number(centerDepthStdDev.toFixed(3)),
  rimDepthStdDev: Number(rimDepthStdDev.toFixed(3)),
  sideDepth: Number(sideProfile.sideDepth.toFixed(3)),
  centerDepth: Number(sideProfile.centerDepth.toFixed(3)),
  topSpread: Number(sideProfile.topSpread.toFixed(3)),
  triangles: mesh.triangleCount,
  surfaceNetTriangles: surfaceMesh.triangleCount,
  weatheredRatio: Number(weatheredRatio.toFixed(3)),
}));
