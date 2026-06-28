function fieldIndex(nx, ny, x, y, z) {
  return x + nx * (y + ny * z);
}

function encodeRle(values) {
  const runs = [];
  let cursor = 0;
  while (cursor < values.length) {
    const value = values[cursor];
    let count = 1;
    cursor += 1;
    while (cursor < values.length && values[cursor] === value && count < 65535) {
      count += 1;
      cursor += 1;
    }
    runs.push([value, count]);
  }
  return runs;
}

export function voxelizeSolids(solids, options = {}) {
  const cell = options.cell || 1;
  const padding = options.padding ?? 1;
  const min = [
    Math.floor(Math.min(...solids.map((solid) => solid.min[0])) / cell) * cell - padding * cell,
    Math.floor(Math.min(...solids.map((solid) => solid.min[1])) / cell) * cell - padding * cell,
    Math.floor(Math.min(...solids.map((solid) => solid.min[2])) / cell) * cell - padding * cell,
  ];
  const max = [
    Math.ceil(Math.max(...solids.map((solid) => solid.max[0])) / cell) * cell + padding * cell,
    Math.ceil(Math.max(...solids.map((solid) => solid.max[1])) / cell) * cell + padding * cell,
    Math.ceil(Math.max(...solids.map((solid) => solid.max[2])) / cell) * cell + padding * cell,
  ];
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / cell));
  const ny = Math.max(1, Math.ceil((max[1] - min[1]) / cell));
  const nz = Math.max(1, Math.ceil((max[2] - min[2]) / cell));
  const voxels = new Uint8Array(nx * ny * nz);
  for (const solid of solids) {
    const ix0 = Math.max(0, Math.floor((solid.min[0] - min[0]) / cell));
    const iy0 = Math.max(0, Math.floor((solid.min[1] - min[1]) / cell));
    const iz0 = Math.max(0, Math.floor((solid.min[2] - min[2]) / cell));
    const ix1 = Math.min(nx, Math.ceil((solid.max[0] - min[0]) / cell));
    const iy1 = Math.min(ny, Math.ceil((solid.max[1] - min[1]) / cell));
    const iz1 = Math.min(nz, Math.ceil((solid.max[2] - min[2]) / cell));
    for (let z = iz0; z < iz1; z += 1) {
      for (let y = iy0; y < iy1; y += 1) {
        for (let x = ix0; x < ix1; x += 1) voxels[fieldIndex(nx, ny, x, y, z)] = 1;
      }
    }
  }
  const solidCount = voxels.reduce((sum, value) => sum + value, 0);
  return {
    schema: 'infinite_brutality.voxel_field.v1',
    cell,
    origin: min,
    dimensions: [nx, ny, nz],
    solidVoxelCount: solidCount,
    encoding: 'rle_u8_xyz',
    rle: encodeRle(voxels),
  };
}

export function buildSlicePlan(structure, voxelField) {
  const rooms = structure.rooms.map((room) => ({
    id: room.id,
    label: room.label,
    role: room.role,
    center: room.center,
    bounds: room.bounds,
    surfaces: room.surfaces,
  }));
  return {
    schema: 'infinite_brutality.ingested_slice_plan.v1',
    source: structure.source,
    generatedBy: 'tools/quake_geometry_ingest',
    copyrightBoundary: 'route_structure_analysis_only_rebuilt_as_infinite_brutality_voxels',
    rooms,
    edges: structure.roomGraph.edges,
    walkableSurfaces: structure.walkableSurfaces.map((surface) => ({
      id: surface.id,
      roomId: surface.roomId,
      y: surface.y,
      bounds: surface.bounds,
      sourceBrushId: surface.sourceBrushId,
    })),
    stairs: structure.stairs,
    ledges: structure.ledges,
    gates: structure.gates,
    loopbacks: structure.roomGraph.loopbacks,
    secretOrSidePathCandidates: structure.roomGraph.sidePathCandidates,
    voxelField: {
      cell: voxelField.cell,
      origin: voxelField.origin,
      dimensions: voxelField.dimensions,
      solidVoxelCount: voxelField.solidVoxelCount,
      encoding: voxelField.encoding,
    },
    terrainReconstruction: {
      owner: 'Infinite Brutality',
      primitiveKind: 'voxel_solids_plus_walkable_surface_graph',
      recommendedMaterialSet: 'imperial_floating_strata',
    },
  };
}
