function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function fract(v) { return v - Math.floor(v); }
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
function idx(field, x, y, z) { return x + field.nx * (y + field.ny * z); }
function setVoxel(field, x, y, z) { field.voxels[idx(field, x, y, z)] = 1; }
function voxelCenter(field, x, y, z) {
  return {
    x: field.min.x + (x + 0.5) * field.cell,
    y: field.min.y + (y + 0.5) * field.cell,
    z: field.min.z + (z + 0.5) * field.cell,
  };
}
function pointSegmentDistance2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const denom = dx * dx + dz * dz;
  const t = denom > 1e-6 ? clamp01(((px - ax) * dx + (pz - az) * dz) / denom) : 0;
  const x = ax + dx * t;
  const z = az + dz * t;
  return { distance: Math.hypot(px - x, pz - z), t };
}

function spanForNode(p, node, seed) {
  const [cx, cy, cz] = node.position;
  const radius = Math.max(7, node.massRadius || 14);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const radial = Math.hypot(dx, dz) / radius;
  const edgeNoise = (valueNoise2(dx / 18 + 7.3, dz / 18 - 4.1, seed + node.roomIndex * 31) - 0.5) * 0.18;
  const allowed = 1 + edgeNoise;
  if (radial > allowed) return null;
  const core = clamp01(1 - radial / Math.max(0.001, allowed));
  const plateauNoise = valueNoise2(dx / 26 - 3.2, dz / 26 + 9.1, seed + 211) - 0.5;
  const crumble = valueNoise2(dx / 8 + 12.1, dz / 8 - 5.4, seed + 307);
  if (radial > 0.88 && crumble > 0.80 + (1 - radial) * 0.8) return null;
  const top = cy - 0.18 + plateauNoise * 1.8 - Math.max(0, radial - 0.62) * 2.2;
  const depth = Math.max(6, node.massDepth || 10);
  const bottom = top - depth * (0.42 + core * 0.78 + Math.abs(plateauNoise) * 0.18);
  return { top, bottom };
}

function spanForEdge(p, edge, seed) {
  const path = edge.path || [];
  if (path.length < 2) return null;
  let best = null;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const hit = pointSegmentDistance2D(p.x, p.z, a[0], a[2], b[0], b[2]);
    if (!best || hit.distance < best.distance) {
      best = {
        distance: hit.distance,
        y: lerp(a[1], b[1], hit.t),
        segment: i,
        t: hit.t,
      };
    }
  }
  const noise = (valueNoise2(p.x / 22 + edge.a * 2.7, p.z / 22 - edge.b * 3.1, seed + 503) - 0.5) * 1.3;
  const halfWidth = Math.max(2.8, (edge.width || 6) * 0.62 + noise);
  if (!best || best.distance > halfWidth) return null;
  const center = clamp01(1 - best.distance / Math.max(0.001, halfWidth));
  const top = best.y - 0.24 + center * 0.24;
  const bottom = top - (3.2 + center * 4.6);
  return { top, bottom };
}

export function buildOpenWorldTerrainField(plan, options = {}) {
  if (!plan?.nodes?.length) throw new Error('open world terrain requires nodes');
  const seed = (plan.seed ?? 1) >>> 0;
  const cell = Math.max(1.4, Math.min(2.4, Number(options.cell) || 1.8));
  const all = [];
  for (const node of plan.nodes) all.push(node.position);
  for (const edge of plan.edges || []) for (const point of edge.path || []) all.push(point);
  const minX = Math.min(...all.map((p) => p[0])) - 22;
  const maxX = Math.max(...all.map((p) => p[0])) + 22;
  const minY = Math.min(...all.map((p) => p[1])) - 20;
  const maxY = Math.max(...all.map((p) => p[1])) + 5;
  const minZ = Math.min(...all.map((p) => p[2])) - 22;
  const maxZ = Math.max(...all.map((p) => p[2])) + 22;
  const nx = Math.max(8, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(8, Math.ceil((maxY - minY) / cell));
  const nz = Math.max(8, Math.ceil((maxZ - minZ) / cell));
  const field = {
    cell,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    nx, ny, nz,
    voxels: new Uint8Array(nx * ny * nz),
  };

  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const p = voxelCenter(field, x, y, z);
        let top = -Infinity;
        let bottom = Infinity;
        let occupied = false;
        for (const node of plan.nodes) {
          const span = spanForNode(p, node, seed);
          if (!span) continue;
          occupied = true;
          top = Math.max(top, span.top);
          bottom = Math.min(bottom, span.bottom);
        }
        for (const edge of plan.edges || []) {
          const span = spanForEdge(p, edge, seed);
          if (!span) continue;
          occupied = true;
          top = Math.max(top, span.top);
          bottom = Math.min(bottom, span.bottom);
        }
        if (occupied && p.y >= bottom && p.y <= top) setVoxel(field, x, y, z);
      }
    }
  }

  field.rockGrammar = {
    grammar: 'open_world_continuous_strata',
    baseGrammar: 'sedimentary_mesa',
    silhouette: 'tapered_plateaus_with_organic_causeways',
    process: 'semantic_route_graph_windowed_density_and_floating_mass_union',
    donorLineage: [...(plan.donorLineage || [])],
  };
  field.openWorldPlan = plan;
  return field;
}

function copyOpenWorldChunk(source, startX, startZ, endX, endZ) {
  const halo = 1;
  const sx0 = Math.max(0, startX - halo);
  const sz0 = Math.max(0, startZ - halo);
  const sx1 = Math.min(source.nx, endX + halo);
  const sz1 = Math.min(source.nz, endZ + halo);
  const nx = Math.max(1, sx1 - sx0);
  const ny = source.ny;
  const nz = Math.max(1, sz1 - sz0);
  const field = {
    cell: source.cell,
    min: {
      x: source.min.x + sx0 * source.cell,
      y: source.min.y,
      z: source.min.z + sz0 * source.cell,
    },
    max: {
      x: source.min.x + sx1 * source.cell,
      y: source.max.y,
      z: source.min.z + sz1 * source.cell,
    },
    nx,
    ny,
    nz,
    voxels: new Uint8Array(nx * ny * nz),
    rockGrammar: { ...source.rockGrammar },
  };
  let occupied = 0;
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const sourceX = sx0 + x;
        const sourceZ = sz0 + z;
        const value = source.voxels[sourceX + source.nx * (y + source.ny * sourceZ)];
        field.voxels[x + nx * (y + ny * z)] = value;
        if (value) occupied += 1;
      }
    }
  }
  return { field, occupied, sourceBounds: { startX: sx0, endX: sx1, startZ: sz0, endZ: sz1 } };
}

function chunkHasRenderableCell(field) {
  for (let z = 0; z < field.nz - 1; z += 1) {
    for (let y = 0; y < field.ny - 1; y += 1) {
      for (let x = 0; x < field.nx - 1; x += 1) {
        let solid = 0;
        for (let dz = 0; dz <= 1; dz += 1) {
          for (let dy = 0; dy <= 1; dy += 1) {
            for (let dx = 0; dx <= 1; dx += 1) {
              solid += field.voxels[(x + dx) + field.nx * ((y + dy) + field.ny * (z + dz))] ? 1 : 0;
            }
          }
        }
        if (solid > 0 && solid < 8) return true;
      }
    }
  }
  return false;
}

export function buildOpenWorldTerrainChunks(plan, options = {}) {
  const field = buildOpenWorldTerrainField(plan, options);
  const chunkCells = Math.max(8, Math.floor(Number(options.chunkCells) || 20));
  const chunks = [];
  const chunkCountX = Math.ceil(field.nx / chunkCells);
  const chunkCountZ = Math.ceil(field.nz / chunkCells);
  for (let cz = 0; cz < chunkCountZ; cz += 1) {
    for (let cx = 0; cx < chunkCountX; cx += 1) {
      const startX = cx * chunkCells;
      const endX = Math.min(field.nx, startX + chunkCells);
      const startZ = cz * chunkCells;
      const endZ = Math.min(field.nz, startZ + chunkCells);
      const copied = copyOpenWorldChunk(field, startX, startZ, endX, endZ);
      if (!copied.occupied || !chunkHasRenderableCell(copied.field)) continue;
      if (options.isRenderableField && !options.isRenderableField(copied.field)) continue;
      const centerX = field.min.x + (startX + (endX - startX) * 0.5) * field.cell;
      const centerZ = field.min.z + (startZ + (endZ - startZ) * 0.5) * field.cell;
      chunks.push({
        id: 'open-world-chunk-' + cx + '-' + cz,
        cx,
        cz,
        center: [centerX, (field.min.y + field.max.y) * 0.5, centerZ],
        radius: Math.hypot((endX - startX) * field.cell * 0.5, (endZ - startZ) * field.cell * 0.5),
        occupiedVoxels: copied.occupied,
        sourceBounds: copied.sourceBounds,
        field: copied.field,
      });
    }
  }
  return {
    schema: 'infinite-brutality.open-world-chunks.v1',
    seed: field.openWorldPlan?.seed ?? plan.seed,
    cell: field.cell,
    chunkCells,
    chunkWorldSize: chunkCells * field.cell,
    bounds: { min: field.min, max: field.max },
    chunks,
  };
}

export function selectOpenWorldChunkIds(chunkSet, position, options = {}) {
  const loadRadius = Math.max(chunkSet.chunkWorldSize * 0.75, Number(options.loadRadius) || chunkSet.chunkWorldSize * 1.45);
  const unloadRadius = Math.max(loadRadius, Number(options.unloadRadius) || loadRadius + chunkSet.chunkWorldSize * 0.85);
  const activeIds = new Set(options.activeIds || []);
  const load = [];
  const keep = [];
  const unload = [];
  for (const chunk of chunkSet.chunks) {
    const distance = Math.hypot(position.x - chunk.center[0], position.z - chunk.center[2]);
    if (distance <= loadRadius + chunk.radius) {
      keep.push(chunk.id);
      if (!activeIds.has(chunk.id)) load.push(chunk.id);
    } else if (activeIds.has(chunk.id) && distance > unloadRadius + chunk.radius) {
      unload.push(chunk.id);
    } else if (activeIds.has(chunk.id)) {
      keep.push(chunk.id);
    }
  }
  return { load, keep, unload, loadRadius, unloadRadius };
}
