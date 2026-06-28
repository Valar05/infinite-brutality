import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRoomIslandField, buildSedimentaryMesaMeshData } from '../src/island-geometry.js';

const terrainLayerSource = fs.readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');
assert.match(terrainLayerSource, /const meshColliders = \[\]/, 'TerrainLayer must track visible mesh colliders');
assert.match(terrainLayerSource, /meshColliders\.push\(collider\)/, 'visible terrain meshes must be registered as support colliders');
assert.match(terrainLayerSource, /terrainSupportRaycaster\.intersectObject\(collider\.mesh, true\)/, 'supportAt must raycast the visible mesh');
assert.doesNotMatch(terrainLayerSource, /queryVoxelTopY/, 'supportAt must not use hidden voxel top sampling');
assert.doesNotMatch(terrainLayerSource, /queryVoxelIntersectsPrism/, 'terrain body checks must not use hidden voxel prism blocking');

function vecAt(positions, index) {
  const i = index * 3;
  return [positions[i], positions[i + 1], positions[i + 2]];
}

function normalY(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const ny = ab[2] * ac[0] - ab[0] * ac[2];
  const nx = ab[1] * ac[2] - ab[2] * ac[1];
  const nz = ab[0] * ac[1] - ab[1] * ac[0];
  return ny / (Math.hypot(nx, ny, nz) || 1);
}

function supportYFromVisibleMesh(mesh, x, z) {
  const indices = mesh.indices?.length
    ? mesh.indices
    : Array.from({ length: mesh.positions.length / 3 }, (_, index) => index);
  let best = null;
  for (let i = 0; i < indices.length; i += 3) {
    const a = vecAt(mesh.positions, indices[i]);
    const b = vecAt(mesh.positions, indices[i + 1]);
    const c = vecAt(mesh.positions, indices[i + 2]);
    if (normalY(a, b, c) < 0.2) continue;
    const x0 = a[0];
    const z0 = a[2];
    const x1 = b[0];
    const z1 = b[2];
    const x2 = c[0];
    const z2 = c[2];
    const denom = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(denom) < 1e-6) continue;
    const w0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / denom;
    const w1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / denom;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
    const y = w0 * a[1] + w1 * b[1] + w2 * c[1];
    if (best == null || y > best) best = y;
  }
  return best;
}

const field = buildRoomIslandField([40, 12, 50], 1000, {
  grammar: 'carved_imperial_structure',
  terraced: true,
  role: 'carved_imperial_structure',
  rockSilhouette: 'fortress_cavern_logistics_spine',
  imperialFunction: 'imperial_airship_logistics_fortress',
});
const mesh = buildSedimentaryMesaMeshData(field, 0.072);
const samples = [
  [0, -22],
  [0, -12],
  [0, 0],
  [0, 12],
  [0, 22],
  [-4, 0],
  [4, 0],
];
const hits = samples.map(([x, z]) => ({ x, z, y: supportYFromVisibleMesh(mesh, x, z) }));
for (const hit of hits) {
  assert.notEqual(hit.y, null, `visible mesh support missing at ${hit.x},${hit.z}`);
}

console.log(JSON.stringify({ ok: true, contract: 'terrain-visible-mesh-collision-truth', hits }));
