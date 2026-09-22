import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildOpenWorldPlan } from '../src/open-world-plan.js';
import { buildOpenWorldTerrainChunks, selectOpenWorldChunkIds } from '../src/open-world-field.js';
import { buildSedimentaryMesaMeshData } from '../src/island-geometry.js';

const districtPlan = {
  levelIndex: 3,
  seed: 987654,
  roomToDistrict: [0, 0, 0, 0],
  districts: [{
    id: 'stream-test',
    roomStart: 0,
    origin: { x: 0, y: 4, z: 0 },
    roomOffsets: [[0, 0, 0], [42, 18, 2], [88, 34, 5], [138, 8, 1]],
    branchPairs: [[0, 2], [1, 3]],
  }],
};
const specs = Array.from({ length: 4 }, (_, i) => ({ id: 'node-' + i, semantic_role: i === 0 ? 'entry' : 'traversal' }));
const plan = buildOpenWorldPlan({ districtPlan, roomCount: 4, roomSpecAt: (i) => specs[i] });
const chunkSet = buildOpenWorldTerrainChunks(plan, {
  cell: 2,
  chunkCells: 12,
  isRenderableField: (field) => buildSedimentaryMesaMeshData(field, 0.072).indices.length > 0,
});
assert.ok(chunkSet.chunks.length >= 4, 'test world must partition into several occupied chunks');

for (const chunk of chunkSet.chunks) {
  const mesh = buildSedimentaryMesaMeshData(chunk.field, 0.072);
  assert.ok(mesh.indices.length > 0, chunk.id + ' must independently mesh');
}

const p0 = { x: plan.nodes[0].position[0], z: plan.nodes[0].position[2] };
const p3 = { x: plan.nodes[3].position[0], z: plan.nodes[3].position[2] };
const first = selectOpenWorldChunkIds(chunkSet, p0, { activeIds: [], loadRadius: 34, unloadRadius: 58 });
assert.ok(first.load.length > 0, 'initial player position must load chunks');
assert.ok(first.load.length < chunkSet.chunks.length, 'initial load must not eagerly load the entire world');

const activeAtStart = new Set(first.load);
const far = selectOpenWorldChunkIds(chunkSet, p3, { activeIds: [...activeAtStart], loadRadius: 34, unloadRadius: 58 });
assert.ok(far.load.length > 0, 'moving across world must load new chunks');
assert.ok(far.unload.length > 0, 'moving across world must retire distant chunks');
assert.ok(far.load.some((id) => !activeAtStart.has(id)), 'far position must introduce previously inactive chunks');

const terrainSource = fs.readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');
const physicsSource = fs.readFileSync(new URL('../src/physics-world.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(terrainSource, /removeFieldMeshBySource/);
assert.match(terrainSource, /physicsWorld\?\.removeCollidersBySource\?\.\(source\)/);
assert.match(terrainSource, /updateOpenWorldChunks/);
assert.match(terrainSource, /selectOpenWorldChunkIds/);
assert.match(physicsSource, /const removeCollidersBySource = \(source\) =>/);
assert.match(physicsSource, /world\.removeCollider\(collider, true\)/);
assert.match(mainSource, /function updateOpenWorldChunkLifecycle/);
assert.match(mainSource, /updateOpenWorldChunkLifecycle\(frameStart\)/);
assert.match(mainSource, /loadRadius: 52/);
assert.match(mainSource, /unloadRadius: 82/);

console.log(JSON.stringify({
  ok: true,
  contract: 'open-world-chunk-lifecycle-v1',
  totalChunks: chunkSet.chunks.length,
  initialLoaded: first.load.length,
  farLoaded: far.load.length,
  farUnloaded: far.unload.length,
  chunkWorldSize: chunkSet.chunkWorldSize,
}));
