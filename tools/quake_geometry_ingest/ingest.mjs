#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNeutralGeometry } from './schema.mjs';
import { extractSpatialStructure } from './extract_graph.mjs';
import { buildSlicePlan, voxelizeSolids } from './voxelize.mjs';
import { renderRouteGraphSvg } from './render_debug_svg.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function runIngest({ input, out, voxelCell = 1 } = {}) {
  if (!input) throw new Error('missing --input');
  if (!out) throw new Error('missing --out');
  const neutral = assertNeutralGeometry(JSON.parse(readFileSync(input, 'utf8')));
  const structure = extractSpatialStructure(neutral);
  const voxelField = voxelizeSolids(structure.solids, { cell: Number(voxelCell) || 1 });
  const slicePlan = buildSlicePlan(structure, voxelField);
  mkdirSync(out, { recursive: true });
  writeJson(join(out, 'room_graph.json'), structure.roomGraph);
  writeJson(join(out, 'voxel_field.json'), voxelField);
  writeJson(join(out, 'slice_plan.json'), slicePlan);
  writeJson(join(out, 'report.json'), {
    schema: 'infinite_brutality.quake_geometry_ingest_report.v1',
    input,
    outputDir: out,
    roomCount: structure.rooms.length,
    edgeCount: structure.roomGraph.edges.length,
    walkableSurfaceCount: structure.walkableSurfaces.length,
    stairCount: structure.stairs.length,
    ledgeCount: structure.ledges.length,
    gateCount: structure.gates.length,
    loopbackCount: structure.roomGraph.loopbacks.length,
    sidePathCandidateCount: structure.roomGraph.sidePathCandidates.length,
    solidVoxelCount: voxelField.solidVoxelCount,
    copyrightBoundary: slicePlan.copyrightBoundary,
  });
  writeFileSync(join(out, 'debug_route_graph.svg'), renderRouteGraphSvg(structure), 'utf8');
  return { structure, voxelField, slicePlan };
}

function main() {
  const args = parseArgs(process.argv);
  const here = dirname(fileURLToPath(import.meta.url));
  const input = args.input || join(here, 'fixtures', 'mini_gate_loop.neutral.json');
  const out = args.out || join(here, '..', '..', 'generated', 'quake_geometry_ingest', 'mini_gate_loop');
  const result = runIngest({ input, out, voxelCell: args['voxel-cell'] || 1 });
  console.log(JSON.stringify({
    ok: true,
    input,
    out,
    rooms: result.structure.rooms.length,
    walkableSurfaces: result.structure.walkableSurfaces.length,
    stairs: result.structure.stairs.length,
    loopbacks: result.structure.roomGraph.loopbacks.length,
    sidePathCandidates: result.structure.roomGraph.sidePathCandidates.length,
    solidVoxels: result.voxelField.solidVoxelCount,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
