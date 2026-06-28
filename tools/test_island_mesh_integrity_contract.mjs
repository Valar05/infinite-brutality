import assert from 'node:assert/strict';
import { buildRoomIslandField, buildRockBridgeField, buildSedimentaryMesaBridgeField, buildSedimentaryMesaMeshData, buildSurfaceNetMeshData } from '../src/island-geometry.js';

function voxelDensity(field, x, y, z) {
  const gx = (x - field.min.x) / field.cell - 0.5;
  const gy = (y - field.min.y) / field.cell - 0.5;
  const gz = (z - field.min.z) / field.cell - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const ty = gy - y0;
  const tz = gz - z0;
  const get = (ix, iy, iz) => {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= field.nx || iy >= field.ny || iz >= field.nz) return 1;
    return field.voxels[ix + field.nx * (iy + field.ny * iz)] ? -1 : 1;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const c000 = get(x0, y0, z0);
  const c100 = get(x0 + 1, y0, z0);
  const c010 = get(x0, y0 + 1, z0);
  const c110 = get(x0 + 1, y0 + 1, z0);
  const c001 = get(x0, y0, z0 + 1);
  const c101 = get(x0 + 1, y0, z0 + 1);
  const c011 = get(x0, y0 + 1, z0 + 1);
  const c111 = get(x0 + 1, y0 + 1, z0 + 1);
  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function triangleStats(field, mesh) {
  const p = mesh.positions;
  const indices = mesh.indices?.length ? mesh.indices : Array.from({ length: p.length / 3 }, (_, i) => i);
  const edges = new Map();
  let badFacing = 0;
  const keyForIndex = (index) => p[index * 3].toFixed(4) + ',' + p[index * 3 + 1].toFixed(4) + ',' + p[index * 3 + 2].toFixed(4);
  for (let i = 0; i < indices.length; i += 3) {
    const ai = indices[i];
    const bi = indices[i + 1];
    const ci = indices[i + 2];
    const ax = p[ai * 3], ay = p[ai * 3 + 1], az = p[ai * 3 + 2];
    const bx = p[bi * 3], by = p[bi * 3 + 1], bz = p[bi * 3 + 2];
    const cx = p[ci * 3], cy = p[ci * 3 + 1], cz = p[ci * 3 + 2];
    const verts = [keyForIndex(ai), keyForIndex(bi), keyForIndex(ci)];
    for (let e = 0; e < 3; e += 1) {
      const a = verts[e];
      const b = verts[(e + 1) % 3];
      const k = a < b ? a + '|' + b : b + '|' + a;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    const distances = [0.2, 0.45, 0.75, 1.05].map((multiplier) => field.cell * multiplier);
    let reversed = false;
    let confirmed = false;
    for (const eps of distances) {
      const front = voxelDensity(field, mx + nx * eps, my + ny * eps, mz + nz * eps);
      const back = voxelDensity(field, mx - nx * eps, my - ny * eps, mz - nz * eps);
      if (front > 0 && back < 0) {
        confirmed = true;
        break;
      }
      if (front < 0 && back > 0) reversed = true;
    }
    if (!confirmed && reversed) badFacing += 1;
  }
  let openEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edges.values()) {
    if (count === 1) openEdges += 1;
    if (count !== 2) nonManifoldEdges += 1;
  }
  return { triangleCount: indices.length / 3, openEdges, nonManifoldEdges, badFacing };
}

function countEnclosedAir(field) {
  const { nx, ny, nz } = field;
  const index = (x, y, z) => x + nx * (y + ny * z);
  const visited = new Uint8Array(nx * ny * nz);
  const stack = [];
  const push = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return;
    const i = index(x, y, z);
    if (visited[i] || field.voxels[i]) return;
    visited[i] = 1;
    stack.push([x, y, z]);
  };
  for (let x = 0; x < nx; x += 1) {
    for (let y = 0; y < ny; y += 1) {
      push(x, y, 0);
      push(x, y, nz - 1);
    }
  }
  for (let x = 0; x < nx; x += 1) {
    for (let z = 0; z < nz; z += 1) {
      push(x, 0, z);
      push(x, ny - 1, z);
    }
  }
  for (let y = 0; y < ny; y += 1) {
    for (let z = 0; z < nz; z += 1) {
      push(0, y, z);
      push(nx - 1, y, z);
    }
  }
  while (stack.length) {
    const [x, y, z] = stack.pop();
    push(x + 1, y, z);
    push(x - 1, y, z);
    push(x, y + 1, z);
    push(x, y - 1, z);
    push(x, y, z + 1);
    push(x, y, z - 1);
  }
  let enclosed = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (!visited[i] && !field.voxels[i]) enclosed += 1;
  }
  return enclosed;
}

const cases = [
  ['legacy-room', buildRoomIslandField([8.8, 5.2, 8.8], 1), buildSurfaceNetMeshData, { strictEdges: true }],
  ['legacy-bridge', buildRockBridgeField(28, 4.8, 1.6, 1), buildSurfaceNetMeshData, { strictEdges: true }],
  ['sedimentary-mesa', buildRoomIslandField([30, 11, 26], 1000, { grammar: 'sedimentary_mesa', terraced: true, role: 'arena' }), buildSedimentaryMesaMeshData, { strictEdges: true }],
  ['imperial-floating-strata', buildRoomIslandField([30, 11, 26], 1000, { grammar: 'imperial_floating_strata', terraced: true, role: 'arena', rockSilhouette: 'fortress_plateau', imperialFunction: 'imperial_core_retaining_gate' }), buildSedimentaryMesaMeshData, { strictEdges: true }],
  ['sedimentary-bridge', buildSedimentaryMesaBridgeField(28, 4.8, 1.6, 1), buildSedimentaryMesaMeshData, { strictEdges: true }],
];

const failures = [];
for (const [label, field, meshFactory, options] of cases) {
  const mesh = meshFactory(field);
  const stats = triangleStats(field, mesh);
  const enclosedAir = countEnclosedAir(field);
  if (enclosedAir > 0) failures.push(label + ' field encloses ' + enclosedAir + ' air voxels; no interior cavities are allowed');
  if (options.strictEdges && stats.openEdges > 0) failures.push(label + ' mesh has ' + stats.openEdges + ' open edges; mesh must be watertight');
  if (options.strictEdges && stats.nonManifoldEdges > 0) failures.push(label + ' mesh has ' + stats.nonManifoldEdges + ' non-manifold edges');
  const badFacingRatio = stats.badFacing / Math.max(1, stats.triangleCount);
  if (badFacingRatio > (options.maxBadFacingRatio ?? 0)) failures.push(label + ' mesh has bad-facing ratio ' + badFacingRatio.toFixed(3) + ' > ' + (options.maxBadFacingRatio ?? 0));
}

assert.deepEqual(failures, [], 'active visible terrain meshes must be cavity-free, edge-watertight, and consistently face solid vs air');
console.log(JSON.stringify({ ok: true, contract: 'island-mesh-integrity' }));
