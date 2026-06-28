import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runIngest } from './quake_geometry_ingest/ingest.mjs';

const fixture = resolve('tools/quake_geometry_ingest/fixtures/mini_gate_loop.neutral.json');
const out = mkdtempSync(join(tmpdir(), 'ib-quake-ingest-'));

try {
  const { structure, voxelField, slicePlan } = runIngest({ input: fixture, out, voxelCell: 1 });
  const roomGraph = JSON.parse(readFileSync(join(out, 'room_graph.json'), 'utf8'));
  const emittedVoxelField = JSON.parse(readFileSync(join(out, 'voxel_field.json'), 'utf8'));
  const emittedSlicePlan = JSON.parse(readFileSync(join(out, 'slice_plan.json'), 'utf8'));
  const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
  const svg = readFileSync(join(out, 'debug_route_graph.svg'), 'utf8');

  assert.equal(structure.source.id, 'mini_gate_loop');
  assert.ok(!fixture.includes('thunder-brainstorm/generated/external_sources'), 'fixture must not come from external Quake sources');
  assert.ok(structure.rooms.length >= 4, 'should extract at least four rooms');
  assert.ok(structure.walkableSurfaces.length >= 8, 'should extract walkable surfaces');
  assert.ok(structure.stairs.length >= 2, 'should detect stair/elevation changes');
  assert.ok(structure.gates.some((gate) => gate.locked), 'should detect locked gate');
  assert.ok(roomGraph.loopbacks.length >= 1, 'should detect at least one loopback');
  assert.ok(roomGraph.sidePathCandidates.some((candidate) => candidate.kind === 'secret'), 'should detect a secret candidate');
  assert.ok(roomGraph.edges.some((edge) => edge.kind === 'locked_gate' || edge.routeRole === 'blocked_goal'), 'graph should include gate pressure');
  assert.ok(voxelField.solidVoxelCount > 0, 'runtime voxel field should contain solid voxels');
  assert.ok(emittedVoxelField.rle.length > 0, 'emitted voxel field should be RLE encoded');
  assert.equal(slicePlan.schema, 'infinite_brutality.ingested_slice_plan.v1');
  assert.equal(emittedSlicePlan.copyrightBoundary, 'route_structure_analysis_only_rebuilt_as_infinite_brutality_voxels');
  assert.ok(emittedSlicePlan.walkableSurfaces.length >= 8, 'slice plan should carry walkable surfaces');
  assert.ok(report.loopbackCount >= 1, 'report should expose loopback metric');
  assert.ok(svg.includes('<svg') && svg.includes('Locked Gate Face'), 'debug SVG should render route graph labels');
  assert.ok(!JSON.stringify(emittedSlicePlan).match(/quake-maps|\.wad|\.pak|id1\/textures/i), 'emitted slice must not reference shipped Quake assets');

  console.log(JSON.stringify({
    ok: true,
    contract: 'quake-geometry-ingest',
    rooms: structure.rooms.length,
    walkableSurfaces: structure.walkableSurfaces.length,
    stairs: structure.stairs.length,
    loopbacks: roomGraph.loopbacks.length,
    solidVoxels: emittedVoxelField.solidVoxelCount,
  }));
} finally {
  rmSync(out, { recursive: true, force: true });
}
