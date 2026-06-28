import assert from 'node:assert/strict';
import { buildDistrictIntentPlan } from '../src/district-intent-planner.js';
import { buildDistrictAssemblyPlan } from '../src/district-assembly-emitter.js';

const TOP_EPSILON = 0.035;
const MIN_OVERLAP_AREA = 0.04;

function bounds(part) {
  const sx = part.size[0];
  const sy = part.size[1];
  const sz = part.size[2];
  return {
    id: part.id,
    role: part.role,
    topY: part.center[1] + sy * 0.5,
    minX: part.center[0] - sx * 0.5,
    maxX: part.center[0] + sx * 0.5,
    minZ: part.center[2] - sz * 0.5,
    maxZ: part.center[2] + sz * 0.5,
  };
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const z = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  return x * z;
}

const plan = buildDistrictAssemblyPlan(buildDistrictIntentPlan(37, 'imperial_foundry'));
const visible = plan.parts.filter((part) => part.visible !== false).map(bounds);
const failures = [];
for (let i = 0; i < visible.length; i += 1) {
  for (let j = i + 1; j < visible.length; j += 1) {
    const a = visible[i];
    const b = visible[j];
    const area = overlapArea(a, b);
    if (area <= MIN_OVERLAP_AREA) continue;
    const dy = Math.abs(a.topY - b.topY);
    if (dy <= TOP_EPSILON) failures.push(`${a.id}<->${b.id}:area=${area.toFixed(2)} dy=${dy.toFixed(3)}`);
  }
}

assert.deepEqual(failures, [], 'foundry visible top surfaces must not overlap at nearly identical height');

console.log(JSON.stringify({
  ok: true,
  contract: 'foundry-no-zfight',
  visibleSurfaces: visible.length,
}));
