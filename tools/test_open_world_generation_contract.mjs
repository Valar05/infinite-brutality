import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildOpenWorldPlan } from '../src/open-world-plan.js';
import { buildOpenWorldTerrainField } from '../src/open-world-field.js';
import { buildSedimentaryMesaMeshData } from '../src/island-geometry.js';

const districtPlan = {
  levelIndex: 2,
  seed: 424242,
  roomToDistrict: [0, 0, 0],
  districts: [{
    id: 'test-district',
    roomStart: 0,
    origin: { x: 0, y: 2, z: 0 },
    roomOffsets: [[0, 0, 0], [34, 28, 3], [72, 12, 6]],
    branchPairs: [[0, 2]],
  }],
};
const specs = [
  { id: 'entry', semantic_role: 'entry' },
  { id: 'foundry', semantic_role: 'processing' },
  { id: 'overlook', semantic_role: 'destination' },
];

const a = buildOpenWorldPlan({ districtPlan, roomCount: 3, roomSpecAt: (i) => specs[i] });
const b = buildOpenWorldPlan({ districtPlan, roomCount: 3, roomSpecAt: (i) => specs[i] });
assert.deepEqual(a, b, 'same seed must replay exactly');
assert.equal(a.topologyAuthority, 'semantic_nodes_edges');
assert.equal(a.nodes.length, 3);
assert.ok(a.edges.filter((edge) => edge.routeRole === 'main').length >= 2, 'main route must connect all three nodes');
assert.ok(a.edges.some((edge) => edge.routeRole === 'branch' || edge.routeRole === 'return'), 'plan must contain a meaningful non-main route');
assert.ok(a.edges.every((edge) => edge.path.length >= 4), 'connectors must carry organic path control points');
assert.ok(a.donorLineage.includes('driftfield:semantic-route-graph'));
assert.ok(a.donorLineage.includes('armorture:windowed-field'));
assert.ok(a.donorLineage.includes('ruined-air:floating-mass'));

const field = buildOpenWorldTerrainField(a, { cell: 2.0 });
assert.equal(field.rockGrammar.grammar, 'open_world_continuous_strata');
assert.ok(field.voxels.some((value) => value === 1), 'field must contain solid terrain');

function occupiedNear(point, radiusCells = 2) {
  const gx = Math.floor((point[0] - field.min.x) / field.cell);
  const gy = Math.floor((point[1] - field.min.y) / field.cell);
  const gz = Math.floor((point[2] - field.min.z) / field.cell);
  for (let dz = -radiusCells; dz <= radiusCells; dz += 1) {
    for (let dy = -8; dy <= 1; dy += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        const x = gx + dx, y = gy + dy, z = gz + dz;
        if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) continue;
        if (field.voxels[x + field.nx * (y + field.ny * z)]) return true;
      }
    }
  }
  return false;
}
for (const node of a.nodes) assert.ok(occupiedNear(node.position), 'terrain must support ' + node.id);
for (const edge of a.edges) {
  const mid = edge.path[Math.floor(edge.path.length / 2)];
  assert.ok(occupiedNear(mid, 3), 'terrain must occupy connector ' + edge.id);
}

const mesh = buildSedimentaryMesaMeshData(field, 0.072);
assert.ok(mesh.positions.length > 0, 'continuous field must produce renderable surface-net vertices');
assert.ok(mesh.indices.length > 0, 'continuous field must produce indexed triangles');

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const terrainSource = fs.readFileSync(new URL('../src/terrain-layer.js', import.meta.url), 'utf8');
assert.match(mainSource, /import \{ buildOpenWorldPlan \} from '\.\/open-world-plan\.js/);
assert.match(mainSource, /roomState\.openWorldPlan = buildOpenWorldPlan\(/);
assert.match(mainSource, /const worldNode = roomState\.openWorldPlan\?\.nodes\?\.\[index\]/);
assert.match(mainSource, /terrainLayer\.addOpenWorldPlan\(roomState\.openWorldPlan/);
assert.match(terrainSource, /buildOpenWorldTerrainChunks\(plan, \{/);
assert.match(terrainSource, /updateOpenWorldChunks/);
assert.match(terrainSource, /kind: 'open_world_terrain_chunk'/);

console.log(JSON.stringify({
  ok: true,
  contract: 'open-world-generation-v1',
  nodes: a.nodes.length,
  edges: a.edges.length,
  loops: a.loopEdgeIds.length,
  voxels: field.voxels.length,
  solidVoxels: field.voxels.reduce((n, value) => n + (value ? 1 : 0), 0),
  triangles: mesh.indices.length / 3,
}));
