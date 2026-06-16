import assert from 'node:assert/strict';
import { buildRockBridgeField, buildRoomIslandField, queryVoxelTopY } from '../src/island-geometry.js';

function lateralCoverage(field, localZ, radius = 0.28) {
  let occupied = 0;
  let total = 0;
  for (let localX = field.min.x; localX <= field.max.x; localX += field.cell * 0.5) {
    total += 1;
    if (queryVoxelTopY(field, localX, localZ, radius) != null) occupied += 1;
  }
  return total ? occupied / total : 0;
}

function topMassThickness(field) {
  const depths = [];
  for (let localZ = field.min.z; localZ <= field.max.z; localZ += field.cell * 0.75) {
    for (let localX = field.min.x; localX <= field.max.x; localX += field.cell * 0.75) {
      const top = queryVoxelTopY(field, localX, localZ, 0.34);
      if (top == null) continue;
      let bottom = null;
      const ix = Math.max(0, Math.min(field.nx - 1, Math.floor((localX - field.min.x) / field.cell)));
      const iz = Math.max(0, Math.min(field.nz - 1, Math.floor((localZ - field.min.z) / field.cell)));
      for (let y = 0; y < field.ny; y += 1) {
        const index = ix + field.nx * (y + field.ny * iz);
        if (!field.voxels[index]) continue;
        bottom = field.min.y + y * field.cell;
        break;
      }
      if (bottom != null) depths.push(top - bottom);
    }
  }
  depths.sort((a, b) => a - b);
  return depths[Math.floor(depths.length * 0.25)] ?? 0;
}

const roomFailures = [];
for (const seed of [1, 2, 3, 4]) {
  const field = buildRoomIslandField([8.8, 5.2, 8.8], seed);
  const quarterDepth = topMassThickness(field);
  if (quarterDepth < 3.2) {
    roomFailures.push(`room island seed ${seed} is too sheet-like: lower quartile mass depth ${quarterDepth.toFixed(2)} < 3.20`);
  }
}

const bridgeFailures = [];
for (const seed of [1, 2, 3]) {
  const field = buildRockBridgeField(28, 4.8, 1.6, seed);
  for (const t of [-0.45, -0.15, 0, 0.15, 0.45]) {
    const coverage = lateralCoverage(field, t * 14);
    if (coverage < 0.60) {
      bridgeFailures.push(`bridge seed ${seed} playable span slice ${t.toFixed(2)} is still a ribbon: lateral coverage ${coverage.toFixed(2)} < 0.60`);
      break;
    }
  }
}

assert.deepEqual(roomFailures, [], 'room islands should read as broad masses, not thin sheets');
assert.deepEqual(bridgeFailures, [], 'bridges should read as broad rock causeways, not thin ribbons');
console.log(JSON.stringify({ ok: true, contract: 'island-surface-truth' }));
