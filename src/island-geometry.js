function rngFromSeed(seed) {
  let t = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function vec3(x, y, z) {
  return { x, y, z };
}

const DRIFTFIELD_TERRAIN_CELL = 4.8;
const MIN_PLAYABLE_ISLAND_CELL = 2.0;
const STAIR_RAMP_CELL = 1.6;

function fieldIndex(nx, ny, x, y, z) {
  return x + nx * (y + ny * z);
}

function padVoxelField(field, padding = 1) {
  const pad = Math.max(0, padding | 0);
  if (!pad) return field;
  const nx = field.nx + pad * 2;
  const ny = field.ny + pad * 2;
  const nz = field.nz + pad * 2;
  const voxels = new Uint8Array(nx * ny * nz);
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        voxels[fieldIndex(nx, ny, x + pad, y + pad, z + pad)] = 1;
      }
    }
  }
  return {
    cell: field.cell,
    min: vec3(field.min.x - pad * field.cell, field.min.y - pad * field.cell, field.min.z - pad * field.cell),
    max: vec3(field.max.x + pad * field.cell, field.max.y + pad * field.cell, field.max.z + pad * field.cell),
    nx,
    ny,
    nz,
    voxels,
  };
}

function getVoxel(field, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) return 0;
  return field.voxels[fieldIndex(field.nx, field.ny, x, y, z)];
}

function setVoxel(field, x, y, z, value = 1) {
  if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) return;
  field.voxels[fieldIndex(field.nx, field.ny, x, y, z)] = value;
}

function voxelCenter(field, x, y, z) {
  return {
    x: field.min.x + (x + 0.5) * field.cell,
    y: field.min.y + (y + 0.5) * field.cell,
    z: field.min.z + (z + 0.5) * field.cell,
  };
}

function fillEllipsoid(field, center, radii) {
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        const p = voxelCenter(field, x, y, z);
        const dx = (p.x - center.x) / Math.max(0.001, radii.x);
        const dy = (p.y - center.y) / Math.max(0.001, radii.y);
        const dz = (p.z - center.z) / Math.max(0.001, radii.z);
        if (dx * dx + dy * dy + dz * dz <= 1.0) setVoxel(field, x, y, z, 1);
      }
    }
  }
}

function fillDownwardSpike(field, center, radiusX, radiusZ, height) {
  const topY = center.y;
  const bottomY = center.y - height;
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        const p = voxelCenter(field, x, y, z);
        if (p.y > topY || p.y < bottomY) continue;
        const t = (topY - p.y) / Math.max(0.001, height);
        const rx = Math.max(field.cell * 0.45, radiusX * (1 - t));
        const rz = Math.max(field.cell * 0.45, radiusZ * (1 - t));
        const dx = (p.x - center.x) / rx;
        const dz = (p.z - center.z) / rz;
        if (dx * dx + dz * dz <= 1.0) setVoxel(field, x, y, z, 1);
      }
    }
  }
}

export function buildIslandBridgeSpec(fromAnchor, toAnchor) {
  const a = vec3(fromAnchor.pos[0], fromAnchor.pos[1] + fromAnchor.size[1] * 0.22, fromAnchor.pos[2]);
  const b = vec3(toAnchor.pos[0], toAnchor.pos[1] + toAnchor.size[1] * 0.22, toAnchor.pos[2]);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const horizontalLength = Math.hypot(dx, dz);
  const center = vec3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
  return {
    start: a,
    end: b,
    center,
    yaw: Math.atan2(dx, dz),
    horizontalLength,
    visible: horizontalLength >= 8,
    deckSize: [4.8, 0.42, horizontalLength * 0.92],
    railOffset: 2.3,
    railSize: [0.18, 0.56, horizontalLength * 0.88],
  };
}

export function buildIslandSupportSolids(anchor) {
  const [ax, ay, az] = anchor.pos;
  const [sx, sy, sz] = anchor.size;
  return [
    {
      size: [sx * 0.88, sy * 0.72, sz * 0.88],
      pos: [ax, ay, az],
      margin: 0.18,
      source: 'district-island-core:' + anchor.id,
    },
    {
      size: [sx * 0.52, sy * 0.24, sz * 0.52],
      pos: [ax, ay + sy * 0.34, az],
      margin: 0.08,
      source: 'district-island-crown:' + anchor.id,
    },
  ];
}

export function buildIslandVoxelField(anchor, seed) {
  const [sx, sy, sz] = anchor.size;
  const cell = Math.max(1.3, Math.min(2.2, Math.min(sx, sy, sz) / 7.5));
  const halfX = sx * 0.72;
  const halfYDown = sy * 0.74;
  const halfYUp = sy * 0.46;
  const halfZ = sz * 0.72;
  const min = vec3(-halfX, -halfYDown, -halfZ);
  const max = vec3(halfX, halfYUp, halfZ);
  const nx = Math.max(8, Math.ceil((max.x - min.x) / cell));
  const ny = Math.max(6, Math.ceil((max.y - min.y) / cell));
  const nz = Math.max(8, Math.ceil((max.z - min.z) / cell));
  const field = {
    cell,
    min,
    max,
    nx,
    ny,
    nz,
    voxels: new Uint8Array(nx * ny * nz),
  };
  const rng = rngFromSeed(seed);
  fillEllipsoid(field, { x: 0, y: -sy * 0.04, z: 0 }, { x: sx * 0.52, y: sy * 0.60, z: sz * 0.52 });
  const lobeCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < lobeCount; i += 1) {
    fillEllipsoid(field, {
      x: (rng() - 0.5) * sx * 0.82,
      y: (rng() - 0.2) * sy * 0.34,
      z: (rng() - 0.5) * sz * 0.82,
    }, {
      x: sx * (0.18 + rng() * 0.16),
      y: sy * (0.18 + rng() * 0.14),
      z: sz * (0.18 + rng() * 0.16),
    });
  }
  const spikeCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < spikeCount; i += 1) {
    fillDownwardSpike(field, {
      x: (rng() - 0.5) * sx * 0.58,
      y: -sy * (0.20 + rng() * 0.08),
      z: (rng() - 0.5) * sz * 0.58,
    }, sx * (0.10 + rng() * 0.06), sz * (0.10 + rng() * 0.06), sy * (0.34 + rng() * 0.22));
  }
  fillEllipsoid(field, { x: 0, y: sy * 0.32, z: 0 }, { x: sx * 0.22, y: sy * 0.10, z: sz * 0.22 });
  return field;
}

export function countExposedVoxelFaces(field) {
  let faces = 0;
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        if (!getVoxel(field, x - 1, y, z)) faces += 1;
        if (!getVoxel(field, x + 1, y, z)) faces += 1;
        if (!getVoxel(field, x, y - 1, z)) faces += 1;
        if (!getVoxel(field, x, y + 1, z)) faces += 1;
        if (!getVoxel(field, x, y, z - 1)) faces += 1;
        if (!getVoxel(field, x, y, z + 1)) faces += 1;
      }
    }
  }
  return faces;
}


function sampleVoxelDensity(field, x, y, z) {
  const gx = (x - field.min.x) / field.cell - 0.5;
  const gy = (y - field.min.y) / field.cell - 0.5;
  const gz = (z - field.min.z) / field.cell - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const ty = gy - y0;
  const tz = gz - z0;
  const density = (ix, iy, iz) => getVoxel(field, ix, iy, iz) ? -1 : 1;
  const c000 = density(x0, y0, z0);
  const c100 = density(x0 + 1, y0, z0);
  const c010 = density(x0, y0 + 1, z0);
  const c110 = density(x0 + 1, y0 + 1, z0);
  const c001 = density(x0, y0, z0 + 1);
  const c101 = density(x0 + 1, y0, z0 + 1);
  const c011 = density(x0, y0 + 1, z0 + 1);
  const c111 = density(x0 + 1, y0 + 1, z0 + 1);
  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);
  const y0v = lerp(x00, x10, ty);
  const y1v = lerp(x01, x11, ty);
  return lerp(y0v, y1v, tz);
}

function gradientNormal(field, point) {
  const e = field.cell * 0.5;
  const sx = sampleVoxelDensity(field, point.x + e, point.y, point.z) - sampleVoxelDensity(field, point.x - e, point.y, point.z);
  const sy = sampleVoxelDensity(field, point.x, point.y + e, point.z) - sampleVoxelDensity(field, point.x, point.y - e, point.z);
  const sz = sampleVoxelDensity(field, point.x, point.y, point.z + e) - sampleVoxelDensity(field, point.x, point.y, point.z - e);
  const length = Math.hypot(sx, sy, sz) || 1;
  return { x: sx / length, y: sy / length, z: sz / length };
}

function surfaceCellIndex(nx, ny, x, y, z) {
  return x + nx * (y + ny * z);
}

function scalarGridIndex(gx, gy, x, y, z) {
  return x + gx * (y + gy * z);
}

function faceNormal(a, b, c) {
  const abx = b.position.x - a.position.x;
  const aby = b.position.y - a.position.y;
  const abz = b.position.z - a.position.z;
  const acx = c.position.x - a.position.x;
  const acy = c.position.y - a.position.y;
  const acz = c.position.z - a.position.z;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const rawLength = Math.hypot(nx, ny, nz);
  const length = rawLength || 1;
  return { x: nx / length, y: ny / length, z: nz / length, length: rawLength };
}

function pushSurfaceVertex(positions, normals, vertex) {
  positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
  normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
}

function pushSurfaceTriangle(positions, normals, indices, a, b, c) {
  const start = positions.length / 3;
  pushSurfaceVertex(positions, normals, a);
  pushSurfaceVertex(positions, normals, b);
  pushSurfaceVertex(positions, normals, c);
  indices.push(start, start + 1, start + 2);
}

function pushOrientedSurfaceTriangle(field, positions, normals, indices, a, b, c) {
  const tri = [a, b, c];
  orientTriangleTowardAir(tri, field);
  const normal = faceNormal(tri[0], tri[1], tri[2]);
  if (normal.length < 1e-8) return;
  const center = {
    x: (tri[0].position.x + tri[1].position.x + tri[2].position.x) / 3,
    y: (tri[0].position.y + tri[1].position.y + tri[2].position.y) / 3,
    z: (tri[0].position.z + tri[1].position.z + tri[2].position.z) / 3,
  };
  const probeDistances = [0.2, 0.45, 0.75, 1.05].map((multiplier) => field.cell * multiplier);
  let score = 0;
  for (const distance of probeDistances) {
    const front = sampleVoxelDensity(field, center.x + normal.x * distance, center.y + normal.y * distance, center.z + normal.z * distance);
    const back = sampleVoxelDensity(field, center.x - normal.x * distance, center.y - normal.y * distance, center.z - normal.z * distance);
    if (front > 0 && back < 0) score += 2;
    else if (front < 0 && back > 0) score -= 2;
    else score += front - back;
  }
  if (score < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
  pushSurfaceTriangle(positions, normals, indices, tri[0], tri[1], tri[2]);
}

function triangleShapeScore(a, b, c) {
  const ab = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
  const bc = Math.hypot(b.position.x - c.position.x, b.position.y - c.position.y, b.position.z - c.position.z);
  const ca = Math.hypot(c.position.x - a.position.x, c.position.y - a.position.y, c.position.z - a.position.z);
  const maxEdge = Math.max(ab, bc, ca);
  const minEdge = Math.min(ab, bc, ca);
  if (minEdge < 1e-5 || maxEdge < 1e-5) return -Infinity;
  const raw = faceNormal(a, b, c);
  const aspect = maxEdge / minEdge;
  return (raw.length / maxEdge) - aspect * 0.03;
}

function quadSplitScore(triangles) {
  return Math.min(...triangles.map((tri) => triangleShapeScore(tri[0], tri[1], tri[2])));
}

function chooseQuadSplit(vertices) {
  const splitA = [
    [vertices[0], vertices[1], vertices[2]],
    [vertices[0], vertices[2], vertices[3]],
  ];
  const splitB = [
    [vertices[0], vertices[1], vertices[3]],
    [vertices[1], vertices[2], vertices[3]],
  ];
  return quadSplitScore(splitB) > quadSplitScore(splitA) ? splitB : splitA;
}

function orientTriangleTowardAir(triangle, field) {
  const triNormal = faceNormal(triangle[0], triangle[1], triangle[2]);
  if (triNormal.length < 1e-8) return;
  const center = {
    x: (triangle[0].position.x + triangle[1].position.x + triangle[2].position.x) / 3,
    y: (triangle[0].position.y + triangle[1].position.y + triangle[2].position.y) / 3,
    z: (triangle[0].position.z + triangle[1].position.z + triangle[2].position.z) / 3,
  };
  const distances = [0.16, 0.32, 0.52, 0.78].map((multiplier) => field.cell * multiplier);
  let score = 0;
  for (const distance of distances) {
    const front = sampleVoxelDensity(field, center.x + triNormal.x * distance, center.y + triNormal.y * distance, center.z + triNormal.z * distance);
    const back = sampleVoxelDensity(field, center.x - triNormal.x * distance, center.y - triNormal.y * distance, center.z - triNormal.z * distance);
    score += front - back;
  }
  if (score < 0) {
    [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
    return;
  }
  const target = {
    x: triangle[0].normal.x + triangle[1].normal.x + triangle[2].normal.x,
    y: triangle[0].normal.y + triangle[1].normal.y + triangle[2].normal.y,
    z: triangle[0].normal.z + triangle[1].normal.z + triangle[2].normal.z,
  };
  const targetLength = Math.hypot(target.x, target.y, target.z) || 1;
  if ((triNormal.x * target.x + triNormal.y * target.y + triNormal.z * target.z) / targetLength < 0) {
    [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
  }
}

function scalarGridPoint(grid, x, y, z) {
  return {
    x: grid.min.x + x * grid.cell,
    y: grid.min.y + y * grid.cell,
    z: grid.min.z + z * grid.cell,
  };
}

function buildScalarGrid(field) {
  const padded = padVoxelField(field, 2);
  const gx = padded.nx + 1;
  const gy = padded.ny + 1;
  const gz = padded.nz + 1;
  const values = new Float32Array(gx * gy * gz);
  for (let z = 0; z < gz; z += 1) {
    for (let y = 0; y < gy; y += 1) {
      for (let x = 0; x < gx; x += 1) {
        const point = scalarGridPoint(padded, x, y, z);
        values[scalarGridIndex(gx, gy, x, y, z)] = sampleVoxelDensity(field, point.x, point.y, point.z);
      }
    }
  }
  return { min: padded.min, cell: padded.cell, gx, gy, gz, values };
}

function scalarGridValue(grid, x, y, z) {
  return grid.values[scalarGridIndex(grid.gx, grid.gy, x, y, z)];
}

function buildSurfaceNetCellVertex(field, grid, x, y, z) {
  const corners = [
    [x, y, z],
    [x + 1, y, z],
    [x + 1, y + 1, z],
    [x, y + 1, z],
    [x, y, z + 1],
    [x + 1, y, z + 1],
    [x + 1, y + 1, z + 1],
    [x, y + 1, z + 1],
  ];
  const values = corners.map(([cx, cy, cz]) => scalarGridValue(grid, cx, cy, cz));
  let hasSolid = false;
  let hasAir = false;
  for (const value of values) {
    if (value < 0) hasSolid = true;
    else hasAir = true;
  }
  if (!hasSolid || !hasAir) return null;
  const edgePairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  let count = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (const [a, b] of edgePairs) {
    const va = values[a];
    const vb = values[b];
    if ((va < 0) === (vb < 0)) continue;
    const pa = scalarGridPoint(grid, corners[a][0], corners[a][1], corners[a][2]);
    const pb = scalarGridPoint(grid, corners[b][0], corners[b][1], corners[b][2]);
    const t = Math.abs(va - vb) > 1e-6 ? va / (va - vb) : 0.5;
    px += lerp(pa.x, pb.x, t);
    py += lerp(pa.y, pb.y, t);
    pz += lerp(pa.z, pb.z, t);
    count += 1;
  }
  if (!count) return null;
  const position = { x: px / count, y: py / count, z: pz / count };
  return { position, normal: gradientNormal(field, position) };
}

function surfaceNetCellVertex(cellVertices, x, y, z, nx, ny, nz) {
  if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return null;
  return cellVertices[surfaceCellIndex(nx, ny, x, y, z)] || null;
}

function gridEdgeCrosses(grid, ax, ay, az, bx, by, bz) {
  const va = scalarGridValue(grid, ax, ay, az);
  const vb = scalarGridValue(grid, bx, by, bz);
  return (va < 0) !== (vb < 0);
}

const CUBE_OFFSETS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

const TETRAHEDRA = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

function interpolateScalarVertex(field, aPos, bPos, aValue, bValue) {
  const denom = aValue - bValue;
  const t = Math.abs(denom) > 1e-6 ? aValue / denom : 0.5;
  const position = {
    x: lerp(aPos.x, bPos.x, t),
    y: lerp(aPos.y, bPos.y, t),
    z: lerp(aPos.z, bPos.z, t),
  };
  return { position, normal: gradientNormal(field, position) };
}

function emitMarchingTetra(field, tetraPoints, tetraValues, positions, normals, indices) {
  const inside = [];
  const outside = [];
  for (let i = 0; i < 4; i += 1) {
    if (tetraValues[i] < 0) inside.push(i);
    else outside.push(i);
  }
  if (!inside.length || inside.length === 4) return;

  const make = (aIndex, bIndex) => interpolateScalarVertex(field, tetraPoints[aIndex], tetraPoints[bIndex], tetraValues[aIndex], tetraValues[bIndex]);
  const emitTriangle = (a, b, c) => pushOrientedSurfaceTriangle(field, positions, normals, indices, a, b, c);

  if (inside.length === 1 || inside.length === 3) {
    const solidSide = inside.length === 1 ? inside[0] : outside[0];
    const airSide = inside.length === 1 ? outside : inside;
    emitTriangle(make(solidSide, airSide[0]), make(solidSide, airSide[1]), make(solidSide, airSide[2]));
    return;
  }

  const a = inside[0];
  const b = inside[1];
  const c = outside[0];
  const d = outside[1];
  const quad = [make(a, c), make(a, d), make(b, d), make(b, c)];
  const split = chooseQuadSplit(quad);
  emitTriangle(split[0][0], split[0][1], split[0][2]);
  emitTriangle(split[1][0], split[1][1], split[1][2]);
}

function emitSurfaceNetQuad(field, cellVertices, nx, ny, nz, coords, positions, normals, indices) {
  const vertices = coords.map(([x, y, z]) => surfaceNetCellVertex(cellVertices, x, y, z, nx, ny, nz));
  if (vertices.some((vertex) => !vertex)) return;
  const triangles = chooseQuadSplit(vertices);
  for (const triangle of triangles) {
    pushOrientedSurfaceTriangle(field, positions, normals, indices, triangle[0], triangle[1], triangle[2]);
  }
}

function emitSurfaceNetQuads(field, grid, cellVertices, nx, ny, nz, positions, normals, indices) {
  for (let z = 0; z < grid.gz; z += 1) {
    for (let y = 0; y < grid.gy; y += 1) {
      for (let x = 0; x < grid.gx - 1; x += 1) {
        if (!gridEdgeCrosses(grid, x, y, z, x + 1, y, z)) continue;
        emitSurfaceNetQuad(field, cellVertices, nx, ny, nz, [
          [x, y - 1, z - 1],
          [x, y, z - 1],
          [x, y, z],
          [x, y - 1, z],
        ], positions, normals, indices);
      }
    }
  }

  for (let z = 0; z < grid.gz; z += 1) {
    for (let y = 0; y < grid.gy - 1; y += 1) {
      for (let x = 0; x < grid.gx; x += 1) {
        if (!gridEdgeCrosses(grid, x, y, z, x, y + 1, z)) continue;
        emitSurfaceNetQuad(field, cellVertices, nx, ny, nz, [
          [x - 1, y, z - 1],
          [x - 1, y, z],
          [x, y, z],
          [x, y, z - 1],
        ], positions, normals, indices);
      }
    }
  }

  for (let z = 0; z < grid.gz - 1; z += 1) {
    for (let y = 0; y < grid.gy; y += 1) {
      for (let x = 0; x < grid.gx; x += 1) {
        if (!gridEdgeCrosses(grid, x, y, z, x, y, z + 1)) continue;
        emitSurfaceNetQuad(field, cellVertices, nx, ny, nz, [
          [x - 1, y - 1, z],
          [x, y - 1, z],
          [x, y, z],
          [x - 1, y, z],
        ], positions, normals, indices);
      }
    }
  }
}

export function buildSurfaceNetMeshData(field, uvScale = 0.12) {
  const grid = buildScalarGrid(field);
  const positions = [];
  const normals = [];
  const indices = [];
  for (let z = 0; z < grid.gz - 1; z += 1) {
    for (let y = 0; y < grid.gy - 1; y += 1) {
      for (let x = 0; x < grid.gx - 1; x += 1) {
        const cubePoints = CUBE_OFFSETS.map(([ox, oy, oz]) => scalarGridPoint(grid, x + ox, y + oy, z + oz));
        const cubeValues = CUBE_OFFSETS.map(([ox, oy, oz]) => scalarGridValue(grid, x + ox, y + oy, z + oz));
        let hasSolid = false;
        let hasAir = false;
        for (const value of cubeValues) {
          if (value < 0) hasSolid = true;
          else hasAir = true;
        }
        if (!hasSolid || !hasAir) continue;
        for (const tetra of TETRAHEDRA) {
          emitMarchingTetra(
            field,
            tetra.map((index) => cubePoints[index]),
            tetra.map((index) => cubeValues[index]),
            positions,
            normals,
            indices,
          );
        }
      }
    }
  }
  const uvs = [];
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const cx = positions[i + 6];
    const cy = positions[i + 7];
    const cz = positions[i + 8];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nxFace = uy * vz - uz * vy;
    const nyFace = uz * vx - ux * vz;
    const nzFace = ux * vy - uy * vx;
    const anx = Math.abs(nxFace);
    const any = Math.abs(nyFace);
    const anz = Math.abs(nzFace);
    let coords;
    if (any >= anx && any >= anz) {
      coords = [[ax, az], [bx, bz], [cx, cz]];
    } else if (anx >= anz) {
      coords = [[az, ay], [bz, by], [cz, cy]];
    } else {
      coords = [[ax, ay], [bx, by], [cx, cy]];
    }
    for (const [u, v] of coords) uvs.push(u * uvScale, v * uvScale);
  }
  return {
    positions,
    normals,
    uvs,
    indices,
    quadCount: 0,
    triangleCount: indices.length / 3,
  };
}


function columnSpan(field, x, z) {
  let bottom = null;
  let top = null;
  for (let y = 0; y < field.ny; y += 1) {
    if (!getVoxel(field, x, y, z)) continue;
    if (bottom == null) bottom = field.min.y + y * field.cell;
    top = field.min.y + (y + 1) * field.cell;
  }
  if (top == null || bottom == null) return null;
  return { top, bottom };
}

function addProjectedUv(uvs, verts, normal, uvScale) {
  const anx = Math.abs(normal[0]);
  const any = Math.abs(normal[1]);
  const anz = Math.abs(normal[2]);
  for (const vert of verts) {
    if (any >= anx && any >= anz) uvs.push(vert[0] * uvScale, vert[2] * uvScale);
    else if (anx >= anz) uvs.push(vert[2] * uvScale, vert[1] * uvScale);
    else uvs.push(vert[0] * uvScale, vert[1] * uvScale);
  }
}

function emitIndexedQuad(positions, normals, uvs, indices, verts, normal, uvScale) {
  const start = positions.length / 3;
  for (const vert of verts) {
    positions.push(vert[0], vert[1], vert[2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
  addProjectedUv(uvs, verts, normal, uvScale);
  const ux = verts[1][0] - verts[0][0];
  const uy = verts[1][1] - verts[0][1];
  const uz = verts[1][2] - verts[0][2];
  const vx = verts[2][0] - verts[0][0];
  const vy = verts[2][1] - verts[0][1];
  const vz = verts[2][2] - verts[0][2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const aligned = nx * normal[0] + ny * normal[1] + nz * normal[2] >= 0;
  if (aligned) indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  else indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
}

function emitSedimentarySide(positions, normals, uvs, indices, a0, a1, top, bottom, axis, sign, uvScale) {
  const bands = 1;
  const normal = axis === 'x' ? [sign, 0, 0] : [0, 0, sign];
  for (let band = 0; band < bands; band += 1) {
    const y0 = lerp(bottom, top, band / bands);
    const y1 = lerp(bottom, top, (band + 1) / bands);
    let verts;
    if (axis === 'x') {
      const x = a0[0];
      const z0 = a0[1];
      const z1 = a1[1];
      verts = sign > 0
        ? [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]
        : [[x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1]];
    } else {
      const z = a0[1];
      const x0 = a0[0];
      const x1 = a1[0];
      verts = sign > 0
        ? [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]]
        : [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
    }
    emitIndexedQuad(positions, normals, uvs, indices, verts, normal, uvScale);
  }
}

function signedGridNoise(x, y, z, seed) {
  return hash2(x * 0.37 + y * 0.19 + seed * 0.011, z * 0.41 - y * 0.23 - seed * 0.017, seed) * 2 - 1;
}

function weatherSedimentaryVertex(field, vert) {
  const cell = field.cell;
  const gx = Math.round((vert[0] - field.min.x) / cell);
  const gy = Math.round((vert[1] - field.min.y) / cell);
  const gz = Math.round((vert[2] - field.min.z) / cell);
  const layerShear = Math.sin(gy * 1.73 + gx * 0.37) * cell * 0.045;
  const fractureShear = signedGridNoise(gx, gy, gz, 701) * cell * 0.075;
  const erosion = signedGridNoise(gx, gy, gz, 733) * cell * 0.055;
  const verticalChip = signedGridNoise(gx, gy, gz, 761) * cell * 0.038;
  return [
    vert[0] + fractureShear + layerShear,
    vert[1] + verticalChip,
    vert[2] + erosion - layerShear * 0.65,
  ];
}

function weatherSedimentaryLodVertex(field, vert, normal = [0, 1, 0]) {
  const cell = field.cell;
  const gx = Math.round((vert[0] - field.min.x) / cell);
  const gy = Math.round((vert[1] - field.min.y) / cell);
  const gz = Math.round((vert[2] - field.min.z) / cell);
  const layerShear = Math.sin(gy * 1.73 + gx * 0.37) * cell * 0.052;
  const fractureShear = signedGridNoise(gx, gy, gz, 701) * cell * 0.074;
  const erosion = signedGridNoise(gx, gy, gz, 733) * cell * 0.064;
  const movesX = Math.abs(normal[0]) < 0.5;
  const movesZ = Math.abs(normal[2]) < 0.5;
  return [
    vert[0] + (movesX ? fractureShear + layerShear : 0),
    vert[1],
    vert[2] + (movesZ ? erosion - layerShear * 0.55 : 0),
  ];
}

function triangleNormalFromVerts(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function emitWeatheredTriangle(positions, normals, uvs, indices, verts, desiredNormal, uvScale) {
  const tri = verts.map((vert) => vert.slice());
  let normal = triangleNormalFromVerts(tri[0], tri[1], tri[2]);
  if (normal[0] * desiredNormal[0] + normal[1] * desiredNormal[1] + normal[2] * desiredNormal[2] < 0) {
    [tri[1], tri[2]] = [tri[2], tri[1]];
    normal = triangleNormalFromVerts(tri[0], tri[1], tri[2]);
  }
  const start = positions.length / 3;
  for (const vert of tri) {
    positions.push(vert[0], vert[1], vert[2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
  addProjectedUv(uvs, tri, desiredNormal, uvScale);
  indices.push(start, start + 1, start + 2);
}

function emitWeatheredQuad(field, positions, normals, uvs, indices, verts, normal, uvScale) {
  const weathered = verts.map((vert) => weatherSedimentaryVertex(field, vert));
  emitWeatheredTriangle(positions, normals, uvs, indices, [weathered[0], weathered[1], weathered[2]], normal, uvScale);
  emitWeatheredTriangle(positions, normals, uvs, indices, [weathered[0], weathered[2], weathered[3]], normal, uvScale);
}

export function buildExposedVoxelFaceMeshData(field, uvScale = 0.072) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let quadCount = 0;
  const cell = field.cell;
  const emitFace = (verts, normal) => {
    emitWeatheredQuad(field, positions, normals, uvs, indices, verts, normal, uvScale);
    quadCount += 1;
  };
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        const x0 = field.min.x + x * cell;
        const x1 = x0 + cell;
        const y0 = field.min.y + y * cell;
        const y1 = y0 + cell;
        const z0 = field.min.z + z * cell;
        const z1 = z0 + cell;
        if (!getVoxel(field, x, y + 1, z)) emitFace([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
        if (!getVoxel(field, x, y - 1, z)) emitFace([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]);
        if (!getVoxel(field, x - 1, y, z)) emitFace([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]);
        if (!getVoxel(field, x + 1, y, z)) emitFace([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
        if (!getVoxel(field, x, y, z - 1)) emitFace([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
        if (!getVoxel(field, x, y, z + 1)) emitFace([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]);
      }
    }
  }
  return {
    positions,
    normals,
    uvs,
    indices,
    quadCount,
    triangleCount: indices.length / 3,
  };
}

function transformedSedimentarySurfaceVertex(field, vert) {
  const cell = field.cell;
  const spanX = Math.max(cell, field.max.x - field.min.x);
  const spanZ = Math.max(cell, field.max.z - field.min.z);
  const centerX = (field.min.x + field.max.x) * 0.5;
  const centerZ = (field.min.z + field.max.z) * 0.5;
  const nx = (vert[0] - centerX) / (spanX * 0.5);
  const nz = (vert[2] - centerZ) / (spanZ * 0.5);
  const radial = Math.hypot(nx, nz);
  const edge = smoothstep(0.54, 0.96, radial);
  const gx = Math.round((vert[0] - field.min.x) / cell);
  const gy = Math.round((vert[1] - field.min.y) / cell);
  const gz = Math.round((vert[2] - field.min.z) / cell);
  const layer = Math.round(vert[1] / Math.max(0.001, cell * 0.42)) * cell * 0.42;
  const topBandWeight = smoothstep(field.min.y + cell * (field.ny - 3), field.min.y + cell * field.ny, vert[1]);
  const sideWeight = smoothstep(0.36, 0.86, radial);
  const fractureA = signedGridNoise(gx, gy, gz, 811);
  const fractureB = signedGridNoise(gx + 17, gy, gz - 13, 853);
  const strata = Math.sin(vert[1] * 2.15 + fractureA * 1.7) * cell * 0.035;
  const chip = signedGridNoise(gx, Math.round(layer / cell), gz, 877);
  const playableTopWeight = topBandWeight * (1 - smoothstep(0.42, 0.72, radial));
  const silhouetteAmp = cell * (0.045 + edge * 0.12 + sideWeight * 0.075);
  const terraceY = lerp(vert[1], layer + strata, sideWeight * 0.55 + edge * 0.25);
  const cleanTopY = lerp(terraceY, layer, playableTopWeight * 0.72);
  return [
    vert[0] + fractureA * silhouetteAmp + Math.sin(gy * 1.37 + gz * 0.43) * cell * 0.028 * edge,
    cleanTopY + chip * cell * 0.045 * (edge + sideWeight) - Math.abs(fractureB) * cell * 0.035 * smoothstep(0.62, 1.04, radial),
    vert[2] + fractureB * silhouetteAmp - Math.sin(gy * 1.11 + gx * 0.51) * cell * 0.024 * edge,
  ];
}

function recomputeMeshNormals(mesh) {
  const positions = mesh.positions;
  const indices = mesh.indices?.length
    ? mesh.indices
    : Array.from({ length: positions.length / 3 }, (_, index) => index);
  const normals = new Array(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const ax = positions[ia];
    const ay = positions[ia + 1];
    const az = positions[ia + 2];
    const bx = positions[ib];
    const by = positions[ib + 1];
    const bz = positions[ib + 2];
    const cx = positions[ic];
    const cy = positions[ic + 1];
    const cz = positions[ic + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    normals[ia] += nx;
    normals[ia + 1] += ny;
    normals[ia + 2] += nz;
    normals[ib] += nx;
    normals[ib + 1] += ny;
    normals[ib + 2] += nz;
    normals[ic] += nx;
    normals[ic + 1] += ny;
    normals[ic + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }
  return {
    ...mesh,
    normals,
  };
}

function sampledVoxelDensity(field, x, y, z) {
  const gx = (x - field.min.x) / field.cell - 0.5;
  const gy = (y - field.min.y) / field.cell - 0.5;
  const gz = (z - field.min.z) / field.cell - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const ty = gy - y0;
  const tz = gz - z0;
  const sample = (ix, iy, iz) => {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= field.nx || iy >= field.ny || iz >= field.nz) return 1;
    return getVoxel(field, ix, iy, iz) ? -1 : 1;
  };
  const c000 = sample(x0, y0, z0);
  const c100 = sample(x0 + 1, y0, z0);
  const c010 = sample(x0, y0 + 1, z0);
  const c110 = sample(x0 + 1, y0 + 1, z0);
  const c001 = sample(x0, y0, z0 + 1);
  const c101 = sample(x0 + 1, y0, z0 + 1);
  const c011 = sample(x0, y0 + 1, z0 + 1);
  const c111 = sample(x0 + 1, y0 + 1, z0 + 1);
  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function orientMeshTrianglesAgainstVoxelField(field, mesh) {
  const positions = mesh.positions;
  const indices = mesh.indices?.length
    ? mesh.indices.slice()
    : Array.from({ length: positions.length / 3 }, (_, index) => index);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const ax = positions[ia];
    const ay = positions[ia + 1];
    const az = positions[ia + 2];
    const bx = positions[ib];
    const by = positions[ib + 1];
    const bz = positions[ib + 2];
    const cx = positions[ic];
    const cy = positions[ic + 1];
    const cz = positions[ic + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    let reversed = false;
    let confirmed = false;
    for (const multiplier of [0.2, 0.45, 0.75, 1.05]) {
      const eps = field.cell * multiplier;
      const front = sampledVoxelDensity(field, mx + nx * eps, my + ny * eps, mz + nz * eps);
      const back = sampledVoxelDensity(field, mx - nx * eps, my - ny * eps, mz - nz * eps);
      if (front > 0 && back < 0) {
        confirmed = true;
        break;
      }
      if (front < 0 && back > 0) reversed = true;
    }
    if (!confirmed && reversed) {
      const temp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = temp;
    }
  }
  return {
    ...mesh,
    indices,
  };
}

export function buildSedimentaryVisualMeshData(field, uvScale = 0.072) {
  const shell = buildSurfaceNetMeshData(field, uvScale);
  const transformed = shell.positions.slice();
  const cache = new Map();
  for (let i = 0; i < transformed.length; i += 3) {
    const key = `${shell.positions[i].toFixed(5)},${shell.positions[i + 1].toFixed(5)},${shell.positions[i + 2].toFixed(5)}`;
    let finalVert = cache.get(key);
    if (!finalVert) {
      finalVert = transformedSedimentarySurfaceVertex(field, [
        shell.positions[i],
        shell.positions[i + 1],
        shell.positions[i + 2],
      ]);
      cache.set(key, finalVert);
    }
    transformed[i] = finalVert[0];
    transformed[i + 1] = finalVert[1];
    transformed[i + 2] = finalVert[2];
  }
  const oriented = orientMeshTrianglesAgainstVoxelField(field, {
    ...shell,
    positions: transformed,
    sourceTriangleCount: shell.triangleCount,
  });
  return recomputeMeshNormals(oriented);
}

export function buildSedimentaryMesaMeshData(field, uvScale = 0.072) {
  return buildSedimentaryVisualMeshData(field, uvScale);
}

function buildColumnSpans(field) {
  const spans = new Array(field.nx * field.nz).fill(null);
  for (let z = 0; z < field.nz; z += 1) {
    for (let x = 0; x < field.nx; x += 1) {
      let bottomIndex = null;
      let topIndex = null;
      for (let y = 0; y < field.ny; y += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        if (bottomIndex == null) bottomIndex = y;
        topIndex = y;
      }
      if (bottomIndex == null || topIndex == null) continue;
      spans[x + field.nx * z] = {
        x,
        z,
        bottom: field.min.y + bottomIndex * field.cell,
        top: field.min.y + (topIndex + 1) * field.cell,
      };
    }
  }
  return spans;
}

function columnSpanAt(spans, field, x, z) {
  if (x < 0 || z < 0 || x >= field.nx || z >= field.nz) return null;
  return spans[x + field.nx * z];
}

function emitSedimentaryLodQuad(field, positions, normals, uvs, indices, verts, normal, uvScale) {
  const weathered = verts.map((vert) => weatherSedimentaryLodVertex(field, vert));
  emitWeatheredTriangle(positions, normals, uvs, indices, [weathered[0], weathered[1], weathered[2]], normal, uvScale);
  emitWeatheredTriangle(positions, normals, uvs, indices, [weathered[0], weathered[2], weathered[3]], normal, uvScale);
}

function buildSedimentaryColumnSpanMeshData(field, uvScale = 0.072) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const spans = buildColumnSpans(field);
  const cell = field.cell;
  let quadCount = 0;
  const emitFace = (verts, normal) => {
    emitSedimentaryLodQuad(field, positions, normals, uvs, indices, verts, normal, uvScale);
    quadCount += 1;
  };
  const emitVoxelSide = (x, y, z, dirX, dirZ) => {
    const x0 = field.min.x + x * cell;
    const x1 = x0 + cell;
    const y0 = field.min.y + y * cell;
    const y1 = y0 + cell;
    const z0 = field.min.z + z * cell;
    const z1 = z0 + cell;
    if (dirX < 0) emitFace([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]);
    else if (dirX > 0) emitFace([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
    else if (dirZ < 0) emitFace([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
    else if (dirZ > 0) emitFace([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]);
  };

  for (let z = 0; z < field.nz; z += 1) {
    for (let x = 0; x < field.nx; x += 1) {
      const span = columnSpanAt(spans, field, x, z);
      if (!span) continue;
      const x0 = field.min.x + x * cell;
      const x1 = x0 + cell;
      const z0 = field.min.z + z * cell;
      const z1 = z0 + cell;
      emitFace([[x0, span.top, z0], [x1, span.top, z0], [x1, span.top, z1], [x0, span.top, z1]], [0, 1, 0]);
      emitFace([[x0, span.bottom, z1], [x1, span.bottom, z1], [x1, span.bottom, z0], [x0, span.bottom, z0]], [0, -1, 0]);

      for (let y = 0; y < field.ny; y += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        if (!getVoxel(field, x - 1, y, z)) emitVoxelSide(x, y, z, -1, 0);
        if (!getVoxel(field, x + 1, y, z)) emitVoxelSide(x, y, z, 1, 0);
        if (!getVoxel(field, x, y, z - 1)) emitVoxelSide(x, y, z, 0, -1);
        if (!getVoxel(field, x, y, z + 1)) emitVoxelSide(x, y, z, 0, 1);
      }
    }
  }

  return {
    positions,
    normals,
    uvs,
    indices,
    quadCount,
    triangleCount: indices.length / 3,
  };
}

export function buildGreedyVoxelMeshData(field, uvScale = 0.12, vertexTransform = null) {
  const dims = [field.nx, field.ny, field.nz];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let quadCount = 0;
  const cursor = [0, 0, 0];
  const q = [0, 0, 0];
  for (let d = 0; d < 3; d += 1) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    q[0] = 0; q[1] = 0; q[2] = 0; q[d] = 1;
    const mask = new Int32Array(dims[u] * dims[v]);
    for (cursor[d] = -1; cursor[d] < dims[d];) {
      let n = 0;
      for (cursor[v] = 0; cursor[v] < dims[v]; cursor[v] += 1) {
        for (cursor[u] = 0; cursor[u] < dims[u]; cursor[u] += 1) {
          const a = cursor[d] >= 0 ? getVoxel(field, cursor[0], cursor[1], cursor[2]) : 0;
          const b = cursor[d] < dims[d] - 1 ? getVoxel(field, cursor[0] + q[0], cursor[1] + q[1], cursor[2] + q[2]) : 0;
          mask[n++] = a !== b ? (a ? 1 : -1) : 0;
        }
      }
      cursor[d] += 1;
      n = 0;
      for (let j = 0; j < dims[v]; j += 1) {
        for (let i = 0; i < dims[u];) {
          const c = mask[n];
          if (!c) {
            i += 1;
            n += 1;
            continue;
          }
          let w = 1;
          while (i + w < dims[u] && mask[n + w] === c) w += 1;
          let h = 1;
          outer: while (j + h < dims[v]) {
            for (let k = 0; k < w; k += 1) {
              if (mask[n + k + h * dims[u]] !== c) break outer;
            }
            h += 1;
          }
          cursor[u] = i;
          cursor[v] = j;
          const du = [0, 0, 0];
          const dv = [0, 0, 0];
          du[u] = w;
          dv[v] = h;
          const base = [cursor[0], cursor[1], cursor[2]];
          if (c < 0) base[d] -= 1;
          const corners = [
            [base[0], base[1], base[2]],
            [base[0] + du[0], base[1] + du[1], base[2] + du[2]],
            [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]],
            [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]],
          ];
          const normal = [0, 0, 0];
          normal[d] = c > 0 ? 1 : -1;
          const startIndex = positions.length / 3;
          const ordered = c > 0 ? corners : [corners[0], corners[3], corners[2], corners[1]];
          for (const corner of ordered) {
            const vert = [
              field.min.x + corner[0] * field.cell,
              field.min.y + corner[1] * field.cell,
              field.min.z + corner[2] * field.cell,
            ];
            const finalVert = vertexTransform ? vertexTransform(field, vert, normal) : vert;
            positions.push(
              finalVert[0],
              finalVert[1],
              finalVert[2],
            );
            normals.push(normal[0], normal[1], normal[2]);
          }
          const quadW = w * field.cell;
          const quadH = h * field.cell;
          uvs.push(0, 0, quadW * uvScale, 0, quadW * uvScale, quadH * uvScale, 0, quadH * uvScale);
          indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
          quadCount += 1;
          for (let l = 0; l < h; l += 1) {
            for (let k = 0; k < w; k += 1) mask[n + k + l * dims[u]] = 0;
          }
          i += w;
          n += w;
        }
      }
    }
  }
  return {
    positions,
    normals,
    uvs,
    indices,
    quadCount,
    triangleCount: indices.length / 3,
  };
}


function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function fract(value) {
  return value - Math.floor(value);
}

function hash2(x, z, seed) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123);
}

function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function buildFieldFromVerticalSpan(cell, min, max, spanFn) {
  const nx = Math.max(8, Math.ceil((max.x - min.x) / cell));
  const ny = Math.max(8, Math.ceil((max.y - min.y) / cell));
  const nz = Math.max(8, Math.ceil((max.z - min.z) / cell));
  const field = {
    cell,
    min,
    max,
    nx,
    ny,
    nz,
    voxels: new Uint8Array(nx * ny * nz),
  };
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        const p = voxelCenter(field, x, y, z);
        const span = spanFn(p);
        if (!span) continue;
        if (p.y < span.bottom || p.y > span.top) continue;
        setVoxel(field, x, y, z, 1);
      }
    }
  }
  return field;
}

function closeVoxelDiagonalEdgeGaps(field) {
  let changed = true;
  let passes = 0;
  while (changed && passes < field.nx + field.nz) {
    changed = false;
    passes += 1;
    for (let z = 0; z < field.nz - 1; z += 1) {
      for (let y = 0; y < field.ny; y += 1) {
        for (let x = 0; x < field.nx - 1; x += 1) {
          const a = getVoxel(field, x, y, z);
          const b = getVoxel(field, x + 1, y, z);
          const c = getVoxel(field, x, y, z + 1);
          const d = getVoxel(field, x + 1, y, z + 1);
          if (a && d && !b && !c) {
            setVoxel(field, x + 1, y, z, 1);
            changed = true;
          } else if (b && c && !a && !d) {
            setVoxel(field, x, y, z, 1);
            changed = true;
          }
        }
      }
    }
  }
  return field;
}

function normalizeRoomIslandOptions(optionsOrTerraced = false) {
  if (optionsOrTerraced && typeof optionsOrTerraced === 'object') {
    return {
      grammar: optionsOrTerraced.grammar || 'legacy_room_island',
      terraced: Boolean(optionsOrTerraced.terraced),
      role: optionsOrTerraced.role || 'generic',
      rockSilhouette: optionsOrTerraced.rockSilhouette,
      imperialFunction: optionsOrTerraced.imperialFunction,
    };
  }
  return {
    grammar: 'legacy_room_island',
    terraced: Boolean(optionsOrTerraced),
    role: 'generic',
  };
}

function buildLegacyRoomIslandField(size, seed, options) {
  const [sx, sy, sz] = size;
  const cell = Math.min(DRIFTFIELD_TERRAIN_CELL, Math.max(MIN_PLAYABLE_ISLAND_CELL, Math.min(sx, sy, sz) / 2.8));
  const min = vec3(-sx * 0.56, -sy * 1.08, -sz * 0.56);
  const max = vec3(sx * 0.56, sy * 0.38, sz * 0.56);
  const phaseA = (seed & 255) * 0.031;
  const phaseB = ((seed >>> 8) & 255) * 0.027;
  const phaseC = ((seed >>> 16) & 255) * 0.023;
  return buildFieldFromVerticalSpan(cell, min, max, (p) => {
    const nx = p.x / Math.max(0.001, sx * 0.5);
    const nz = p.z / Math.max(0.001, sz * 0.5);
    const radial = Math.hypot(nx, nz);
    const angle = Math.atan2(nz, nx);
    const rimNoise = (valueNoise2(nx * 2.8 + 12.7, nz * 2.8 - 9.1, seed + 17) - 0.5) * 0.22;
    const rimWave = Math.sin(angle * 3 + phaseA) * 0.09 + Math.sin(angle * 5 - phaseB) * 0.06;
    const diagonalBias = Math.sin((nx - nz) * 5.2 + phaseC) * 0.05;
    const radius = 0.78 + rimNoise + rimWave + diagonalBias;
    if (radial > radius) return null;
    const edgeNotchNoise = valueNoise2(nx * 6.1 - 5.3, nz * 6.1 + 7.4, seed + 91);
    if (radial > radius * 0.88 && edgeNotchNoise > 0.76 + (radial - radius * 0.88) * 0.9) return null;
    const core = clamp01(1 - radial / Math.max(radius, 0.001));
    const crownNoise = valueNoise2(nx * 3.4 + 4.8, nz * 3.4 + 11.2, seed + 29) - 0.5;
    const terraceNoise = valueNoise2(nx * 7.8 - 2.1, nz * 7.8 + 3.6, seed + 43) - 0.5;
    const ridgeNoise = valueNoise2(nx * 11.6 + 9.3, nz * 11.6 - 7.8, seed + 57) - 0.5;
    const topPocketNoise = valueNoise2(nx * 9.2 - 6.4, nz * 9.2 + 5.1, seed + 101);
    let top = sy * (
      0.12
      + core * 0.28
      + crownNoise * 0.18
      + terraceNoise * 0.10
      + ridgeNoise * 0.08
      - Math.max(0, radial - 0.22) * 0.18
      - smoothstep(0.0, 1.0, Math.abs(nx * nz)) * 0.05
    );
    if (topPocketNoise > 0.84) top -= sy * (topPocketNoise - 0.84) * 0.16;
    if (options.terraced) {
      const terraceStep = sy * 0.095;
      top = Math.round(top / terraceStep) * terraceStep;
    }
    const bellyNoise = valueNoise2(nx * 2.1 + 17.0, nz * 2.1 - 13.0, seed + 61) - 0.5;
    const spikeGate = valueNoise2(Math.cos(angle) * 3.2 + 8.1, Math.sin(angle) * 3.2 - 6.3, seed + 77);
    const hangingSpur = radial > radius * 0.48 ? Math.max(0, spikeGate - 0.68) * sy * 0.34 : 0;
    const bottom = -sy * (
      0.40
      + (1 - core) * 0.24
      + Math.abs(bellyNoise) * 0.20
      + smoothstep(0.45, 1.0, radial / Math.max(radius, 0.001)) * 0.12
    ) - hangingSpur;
    const thickness = top - bottom;
    if (thickness < sy * 0.58) return null;
    if (radial > radius * 0.70 && thickness < sy * 0.68) return null;
    return { top, bottom };
  });
}

function buildSedimentaryMesaField(size, seed, options) {
  const [sx, sy, sz] = size;
  const cell = Math.min(DRIFTFIELD_TERRAIN_CELL, Math.max(MIN_PLAYABLE_ISLAND_CELL, Math.min(sx, sy, sz) / 5.4));
  const min = vec3(-sx * 0.56, -sy * 1.08, -sz * 0.56);
  const max = vec3(sx * 0.56, sy * 0.38, sz * 0.56);
  const phaseA = (seed & 255) * 0.031;
  const phaseB = ((seed >>> 8) & 255) * 0.027;
  const field = buildFieldFromVerticalSpan(cell, min, max, (p) => {
    const nx = p.x / Math.max(0.001, sx * 0.5);
    const nz = p.z / Math.max(0.001, sz * 0.5);
    const ax = Math.abs(nx);
    const az = Math.abs(nz);
    const angle = Math.atan2(nz, nx);
    const slabX = ax / 0.94;
    const slabZ = az / 0.78;
    const rectRadial = Math.max(slabX, slabZ);
    const cornerCrowding = Math.max(0, slabX - 0.76) * Math.max(0, slabZ - 0.68);
    const edgeWave = Math.sin(angle * 4 + phaseA) * 0.035 + Math.sin(angle * 7 - phaseB) * 0.025;
    const fractureBias = (valueNoise2(nx * 2.4 + 19.1, nz * 2.4 - 4.2, seed + 211) - 0.5) * 0.055;
    const radius = 0.98 + edgeWave + fractureBias;
    if (rectRadial + cornerCrowding * 0.62 > radius) return null;
    const rim = clamp01(rectRadial / Math.max(radius, 0.001));
    const chipNoise = valueNoise2(nx * 7.4 - 3.2, nz * 7.4 + 5.8, seed + 223);
    if (rim > 0.90 && chipNoise > 0.76 + (rim - 0.90) * 0.62) return null;
    const core = clamp01(1 - rim);
    const shelfNoise = valueNoise2(nx * 3.0 + 6.3, nz * 3.0 - 10.8, seed + 229) - 0.5;
    const crackNoise = valueNoise2(nx * 10.5 - 8.7, nz * 5.6 + 13.4, seed + 233);
    let top = sy * (
      0.30
      + core * 0.08
      - smoothstep(0.66, 1.0, rim) * 0.26
      + shelfNoise * 0.045
      - Math.max(0, crackNoise - 0.80) * 0.10
    );
    if (options.terraced) {
      const terraceStep = sy * 0.065;
      top = Math.round(top / terraceStep) * terraceStep;
    }
    const undercutNoise = valueNoise2(nx * 5.1 + 11.7, nz * 5.1 - 8.9, seed + 241);
    const verticalGroove = Math.max(0, valueNoise2(Math.cos(angle) * 5.3 + 2.2, Math.sin(angle) * 5.3 - 5.5, seed + 251) - 0.54);
    const strataStep = Math.floor((rim * 5.0 + undercutNoise * 2.0) % 4) * 0.035;
    const bottom = -sy * (
      0.64
      + rim * 0.10
      + Math.abs(undercutNoise - 0.5) * (0.08 + rim * 0.18)
      + verticalGroove * rim * 0.22
      + strataStep
    );
    const thickness = top - bottom;
    if (thickness < sy * 0.56) return null;
    if (rim > 0.78 && thickness < sy * 0.62) return null;
    return { top, bottom };
  });
  closeVoxelDiagonalEdgeGaps(field);
  field.rockGrammar = {
    grammar: 'sedimentary_mesa',
    silhouette: 'mesa',
    process: 'sediment_layers_erosion_fracture',
    role: options.role,
  };
  return field;
}

function imperialShapeSettings(options) {
  switch (options.imperialFunction) {
    case 'suspended_foundry_logistics':
      return {
        silhouette: options.rockSilhouette || 'foundry_shelf',
        roadHalfWidth: 0.24,
        roadHalfLength: 0.92,
        deckHalfWidth: 0.62,
        deckHalfLength: 0.78,
        shelfSide: -1,
        process: 'rail_shelf_furnace_cut_into_suspended_strata',
      };
    case 'battery_terrace_command_road':
      return {
        silhouette: options.rockSilhouette || 'artillery_crown',
        roadHalfWidth: 0.28,
        roadHalfLength: 0.96,
        deckHalfWidth: 0.72,
        deckHalfLength: 0.70,
        shelfSide: 1,
        process: 'battery_terraces_cannon_roads_cut_into_strata',
      };
    case 'imperial_core_retaining_gate':
    default:
      return {
        silhouette: options.rockSilhouette || 'fortress_plateau',
        roadHalfWidth: 0.26,
        roadHalfLength: 0.96,
        deckHalfWidth: 0.56,
        deckHalfLength: 0.82,
        shelfSide: 0,
        process: 'imperial_construction_cut_into_suspended_strata',
      };
  }
}

function enforceImperialEngineeredCuts(field, size, settings) {
  const [sx, sy, sz] = size;
  for (let z = 0; z < field.nz; z += 1) {
    for (let x = 0; x < field.nx; x += 1) {
      const p = voxelCenter(field, x, 0, z);
      const nx = p.x / Math.max(0.001, sx * 0.5);
      const nz = p.z / Math.max(0.001, sz * 0.5);
      const ax = Math.abs(nx);
      const az = Math.abs(nz);
      const roadCut = ax <= settings.roadHalfWidth && az <= settings.roadHalfLength;
      const retainingBite = ax >= 0.68 && ax <= 0.94 && az <= 0.76;
      const serviceShelf = (
        settings.shelfSide === 0
          ? ax <= 0.88 && nz >= 0.34 && nz <= 0.94
          : nx * settings.shelfSide >= 0.34 && nx * settings.shelfSide <= 0.92 && az <= 0.72
      );
      if (roadCut) continue;
      const topLimit = retainingBite ? sy * 0.12 : serviceShelf ? sy * 0.16 : null;
      if (topLimit == null) continue;
      for (let y = 0; y < field.ny; y += 1) {
        const centerY = field.min.y + (y + 0.5) * field.cell;
        if (centerY > topLimit) setVoxel(field, x, y, z, 0);
      }
    }
  }
}

function buildImperialFloatingStrataField(size, seed, options) {
  const [sx, sy, sz] = size;
  const settings = imperialShapeSettings(options);
  const cell = Math.min(DRIFTFIELD_TERRAIN_CELL, Math.max(MIN_PLAYABLE_ISLAND_CELL, Math.min(sx, sy, sz) / 5.4));
  const min = vec3(-sx * 0.58, -sy * 1.10, -sz * 0.58);
  const max = vec3(sx * 0.58, sy * 0.42, sz * 0.58);
  const field = buildFieldFromVerticalSpan(cell, min, max, (p) => {
    const nx = p.x / Math.max(0.001, sx * 0.5);
    const nz = p.z / Math.max(0.001, sz * 0.5);
    const ax = Math.abs(nx);
    const az = Math.abs(nz);
    const angle = Math.atan2(nz, nx);
    const roadCut = ax <= settings.roadHalfWidth && az <= settings.roadHalfLength;
    const commandDeck = ax <= settings.deckHalfWidth && az <= settings.deckHalfLength;
    const retainingBite = ax >= 0.68 && ax <= 0.94 && az <= 0.76;
    const serviceShelf = (
      settings.shelfSide === 0
        ? ax <= 0.88 && nz >= 0.34 && nz <= 0.94
        : nx * settings.shelfSide >= 0.34 && nx * settings.shelfSide <= 0.92 && az <= 0.72
    );
    const outer = Math.max(ax / 0.94, az / 1.0);
    const cornerShear = Math.max(0, ax - 0.74) * Math.max(0, az - 0.78);
    const edgeNoise = valueNoise2(nx * 5.3 + 14.0, nz * 5.3 - 3.1, seed + 503);
    const blastCut = outer > 0.82 && edgeNoise > 0.82 + Math.max(0, outer - 0.82) * 0.52;
    if (!commandDeck && !roadCut && !retainingBite && !serviceShelf) {
      if (outer + cornerShear * 0.86 > 1.0) return null;
      if (blastCut) return null;
    }

    const rim = clamp01(outer);
    const strataNoise = valueNoise2(nx * 4.1 - 6.7, nz * 4.1 + 9.4, seed + 521);
    const quarryStep = Math.floor((az * 5.0 + ax * 2.0 + strataNoise * 2.0) % 4) * 0.035;
    const surfaceNoise = (valueNoise2(nx * 8.0 + 1.5, nz * 8.0 - 4.4, seed + 541) - 0.5) * sy * 0.025;
    let top = sy * (0.29 - rim * 0.05) + surfaceNoise;
    if (commandDeck) top = Math.max(top, sy * 0.31);
    if (serviceShelf && !roadCut) top = Math.min(top, sy * 0.15 + surfaceNoise * 0.45);
    if (retainingBite && !roadCut) top = Math.min(top, sy * 0.10 + surfaceNoise * 0.35);
    if (roadCut) top = sy * 0.34;
    if (options.terraced && !roadCut) {
      const terraceStep = sy * 0.055;
      top = Math.round(top / terraceStep) * terraceStep;
    }

    const verticalGroove = Math.max(0, valueNoise2(Math.cos(angle) * 5.0 + 2.0, Math.sin(angle) * 5.0 - 5.2, seed + 557) - 0.56);
    const engineeredDepth = retainingBite ? 0.26 : roadCut ? 0.05 : serviceShelf ? 0.14 : 0;
    const bottom = -sy * (
      0.58
      + rim * 0.16
      + engineeredDepth
      + Math.abs(strataNoise - 0.5) * (0.08 + rim * 0.14)
      + verticalGroove * rim * 0.18
      + quarryStep
    );
    const thickness = top - bottom;
    if (thickness < sy * 0.54) return null;
    if (rim > 0.86 && thickness < sy * 0.60) return null;
    return { top, bottom };
  });
  closeVoxelDiagonalEdgeGaps(field);
  enforceImperialEngineeredCuts(field, size, settings);
  field.rockGrammar = {
    grammar: 'imperial_floating_strata',
    baseGrammar: 'sedimentary_mesa',
    fieldGrammar: 'imperial_floating_strata',
    silhouette: settings.silhouette,
    process: settings.process,
    role: options.role,
    imperialFunction: options.imperialFunction || 'imperial_core_retaining_gate',
    zones: ['commandDeck', 'roadCut', 'retainingBites', 'serviceShelf', 'undersideMass', 'damageCuts'],
  };
  return field;
}

function buildCarvedImperialStructureField(size, seed, options) {
  const field = buildImperialFloatingStrataField(size, seed, {
    ...options,
    rockSilhouette: options.rockSilhouette || 'carved_fortress_cavern',
    imperialFunction: options.imperialFunction || 'imperial_carved_logistics_spine',
  });
  field.rockGrammar = {
    ...field.rockGrammar,
    grammar: 'carved_imperial_structure',
    fieldGrammar: 'carved_imperial_structure',
    baseGrammar: 'imperial_floating_strata',
    silhouette: options.rockSilhouette || 'carved_fortress_cavern',
    process: 'imperial_structure_caved_from_rock',
    imperialFunction: options.imperialFunction || 'imperial_carved_logistics_spine',
    zones: [
      'paradeSpine',
      'fortressCourt',
      'retainingCliffs',
      'quarryGalleries',
      'undercroftService',
      'airshipMooringBites',
      'collapseVoids',
    ],
  };
  return field;
}

export function buildRoomIslandField(size, seed, optionsOrTerraced = false) {
  const options = normalizeRoomIslandOptions(optionsOrTerraced);
  if (options.grammar === 'carved_imperial_structure') return buildCarvedImperialStructureField(size, seed, options);
  if (options.grammar === 'imperial_floating_strata') return buildImperialFloatingStrataField(size, seed, options);
  if (options.grammar === 'sedimentary_mesa') return buildSedimentaryMesaField(size, seed, options);
  return buildLegacyRoomIslandField(size, seed, options);
}

export function buildRoomIslandMeshData(size, seed, uvScale = 0.12) {
  return buildSurfaceNetMeshData(buildRoomIslandField(size, seed), uvScale);
}


export function buildSedimentaryMesaBridgeField(length, width = 5.8, thickness = 1.55, seed = 1) {
  const cell = STAIR_RAMP_CELL;
  const min = vec3(-width * 0.62, -thickness * 1.65, -length * 0.52);
  const max = vec3(width * 0.62, thickness * 0.84, length * 0.52);
  const phaseA = (seed & 255) * 0.041;
  const field = buildFieldFromVerticalSpan(cell, min, max, (p) => {
    const nz = p.z / Math.max(0.001, length * 0.5);
    if (Math.abs(nz) > 1.04) return null;
    const nx = p.x / Math.max(0.001, width * 0.5);
    const lateral = Math.abs(nx);
    if (lateral > 1.04) return null;
    const endTaper = smoothstep(0.86, 1.04, Math.abs(nz));
    const edgeChip = valueNoise2(nx * 5.0 + 12.4, nz * 3.2 - 8.1, seed + 317);
    if (lateral > 0.92 && edgeChip > 0.84 + (lateral - 0.92) * 0.7) return null;
    const strata = Math.floor((lateral * 4.0 + valueNoise2(nz * 2.4, nx * 1.8, seed + 331) * 2.0) % 3) * 0.035;
    let top = thickness * (
      0.30
      - lateral * 0.06
      - endTaper * 0.08
      + Math.sin(nz * 2.0 + phaseA) * 0.025
    );
    top = Math.round(top / Math.max(0.001, thickness * 0.18)) * thickness * 0.18;
    const bottom = -thickness * (
      1.02
      + lateral * 0.12
      + Math.abs(valueNoise2(nx * 3.1 - 4.6, nz * 3.1 + 9.2, seed + 347) - 0.5) * 0.10
      + strata
    );
    return { top, bottom };
  });
  closeVoxelDiagonalEdgeGaps(field);
  field.rockGrammar = {
    grammar: 'sedimentary_mesa',
    silhouette: 'bridge_fragment',
    process: 'sediment_layers_sheared_collapse',
    role: 'connector',
  };
  return field;
}

export function buildRockBridgeField(length, width = 4.8, thickness = 1.4, seed = 1) {
  const cell = STAIR_RAMP_CELL;
  const min = vec3(-width * 0.84, -thickness * 1.82, -length * 0.5);
  const max = vec3(width * 0.84, thickness * 0.92, length * 0.5);
  const phaseA = (seed & 255) * 0.041;
  const phaseB = ((seed >>> 8) & 255) * 0.037;
  return buildFieldFromVerticalSpan(cell, min, max, (p) => {
    const nz = p.z / Math.max(0.001, length * 0.5);
    if (Math.abs(nz) > 1.03) return null;
    const path = 1 - Math.abs(nz);
    const centerNoise = valueNoise2(nz * 4.2 + 10.0, 0.0, seed + 5) - 0.5;
    const widthNoise = valueNoise2(nz * 3.2 - 7.0, 2.0, seed + 13) - 0.5;
    const halfWidthNorm = 0.89 + path * 0.16 + widthNoise * 0.05 + Math.sin(nz * 6.4 + phaseA) * 0.03;
    const nx = p.x / Math.max(0.001, width * 0.5);
    const lateral = Math.abs(nx) / Math.max(halfWidthNorm, 0.001);
    if (lateral > 1.08) return null;
    const edgeNotchNoise = valueNoise2(nx * 6.4 + 3.1, nz * 5.8 - 9.2, seed + 23);
    if (lateral > 0.98 && edgeNotchNoise > 0.88 + (lateral - 0.98) * 0.4) return null;
    const centerLift = clamp01(1 - lateral);
    const arch = Math.sin(path * Math.PI * 0.9);
    const crestNoise = valueNoise2(nz * 8.4 + 3.6, nx * 4.2 - 1.4, seed + 59) - 0.5;
    const topPocketNoise = valueNoise2(nz * 12.2 - 8.0, nx * 7.1 + 2.7, seed + 71);
    let top = thickness * (
      0.34
      + arch * 0.52
      + centerLift * 0.34
      + centerNoise * 0.18
      + crestNoise * 0.14
      + Math.sin(nz * 10.0 + phaseB) * 0.08
    );
    if (topPocketNoise > 0.90) top -= thickness * (topPocketNoise - 0.90) * 0.14;
    const underNoise = valueNoise2(nz * 4.8 + 5.7, lateral * 4.3 + 7.1, seed + 31) - 0.5;
    const fangGate = valueNoise2(nz * 9.2 - 4.7, nx * 5.0 + 1.9, seed + 47);
    const fang = lateral < 0.84 ? Math.max(0, fangGate - 0.84) * thickness * 0.40 : 0;
    const bottom = -thickness * (
      0.86
      + (1 - centerLift) * 0.20
      + path * 0.12
      + Math.abs(underNoise) * 0.16
      + Math.cos(nz * 6.4 + phaseA) * 0.04
    ) - fang;
    const thicknessSpan = top - bottom;
    if (thicknessSpan < thickness * 1.18) return null;
    return { top, bottom };
  });
}

export function buildRockBridgeMeshData(length, width = 4.8, thickness = 1.4, seed = 1, uvScale = 0.12) {
  return buildSurfaceNetMeshData(buildRockBridgeField(length, width, thickness, seed), uvScale);
}

export function queryVoxelTopY(field, localX, localZ, radius = 0) {
  const pad = Math.max(0, radius);
  const minX = Math.max(0, Math.floor((localX - pad - field.min.x) / field.cell));
  const maxX = Math.min(field.nx - 1, Math.floor((localX + pad - field.min.x) / field.cell));
  const minZ = Math.max(0, Math.floor((localZ - pad - field.min.z) / field.cell));
  const maxZ = Math.min(field.nz - 1, Math.floor((localZ + pad - field.min.z) / field.cell));
  let best = null;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = field.ny - 1; y >= 0; y -= 1) {
        if (!getVoxel(field, x, y, z)) continue;
        const topY = field.min.y + (y + 1) * field.cell;
        if (best == null || topY > best) best = topY;
        break;
      }
    }
  }
  return best;
}

export function queryVoxelIntersectsPrism(field, localX, localZ, minY, maxY, radius = 0) {
  const pad = Math.max(0, radius);
  const minX = Math.max(0, Math.floor((localX - pad - field.min.x) / field.cell));
  const maxX = Math.min(field.nx - 1, Math.floor((localX + pad - field.min.x) / field.cell));
  const minZ = Math.max(0, Math.floor((localZ - pad - field.min.z) / field.cell));
  const maxZ = Math.min(field.nz - 1, Math.floor((localZ + pad - field.min.z) / field.cell));
  const y0 = Math.max(0, Math.floor((minY - field.min.y) / field.cell));
  const y1 = Math.min(field.ny - 1, Math.floor((maxY - field.min.y) / field.cell));
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        if (getVoxel(field, x, y, z)) return true;
      }
    }
  }
  return false;
}
