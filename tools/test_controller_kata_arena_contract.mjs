import assert from 'node:assert/strict';
import { generateControllerArena, hashArenaSeed } from '../src/controller-kata.js';

const pointToBoxDistanceXZ = (point, center, size) => {
  const dx = Math.max(0, Math.abs(point[0] - center[0]) - size[0] * 0.5);
  const dz = Math.max(0, Math.abs(point[2] - center[2]) - size[2] * 0.5);
  return Math.hypot(dx, dz);
};

assert.equal(hashArenaSeed('alpha'), hashArenaSeed('alpha'));
assert.ok(Number.isInteger(hashArenaSeed(0)));

const ambientRandom = Math.random;
Math.random = () => { throw new Error('ambient randomness is forbidden'); };
const defaultArena = generateControllerArena();
const first = generateControllerArena({ seed: 'alpha' });
const repeat = generateControllerArena({ seed: 'alpha' });
const other = generateControllerArena({ seed: 'beta' });
Math.random = ambientRandom;

assert.equal(defaultArena.seedText, 'controller-proof');
assert.deepEqual(first, repeat);
assert.notDeepEqual(first, other);
assert.deepEqual(first.grid, { min: -40, max: 40, step: 4, safeRouteClearance: 6 });
assert.deepEqual(first.floor, { center: [0, -0.25, 0], size: [96, 0.5, 96] });
assert.deepEqual(first.spawn, [0, 1.65, -38]);
assert.deepEqual(first.exit, [0, 0, 38]);
assert.equal(first.cubes.length, 28);
assert.deepEqual(first.directMantle, {
  id: 'controller-kata-direct-mantle',
  center: [0, 0.6, -34],
  size: [6, 1.2, 2.4],
  approach: [0, 0, 1],
  minForwardInput: 0.55,
  minFacingDot: 0.72,
  minFeetToLip: 0.2,
  maxFeetToLip: 1.0,
  maxVerticalDisplacement: 1.02,
  maxHorizontalDisplacement: 1.45,
  duration: 0.34,
  topY: 1.2,
});
assert.ok(pointToBoxDistanceXZ(first.spawn, first.directMantle.center, first.directMantle.size) < first.grid.safeRouteClearance, 'direct mantle must be guaranteed near spawn');

const occupied = new Set();
const widths = new Set();
const heights = new Set();
const depths = new Set();
for (const [index, cube] of first.cubes.entries()) {
  assert.equal(cube.id, `cube-${index}`);
  const [x, y, z] = cube.center;
  const [sx, sy, sz] = cube.size;
  assert.deepEqual(cube.cell, [x, z]);
  assert.ok(sx >= 1.35 && sx <= 3.2);
  assert.ok(sy >= 0.8 && sy <= 5);
  assert.ok(sz >= 1.35 && sz <= 3.2);
  assert.notEqual(sx, sy);
  assert.notEqual(sy, sz);
  assert.notEqual(sx, sz);
  assert.equal(y, sy * 0.5);
  assert.equal((x - first.grid.min) % first.grid.step, 0);
  assert.equal((z - first.grid.min) % first.grid.step, 0);
  assert.ok(x >= first.grid.min && x <= first.grid.max);
  assert.ok(z >= first.grid.min && z <= first.grid.max);
  assert.ok(Math.abs(x) + sx * 0.5 < first.floor.size[0] * 0.5);
  assert.ok(Math.abs(z) + sz * 0.5 < first.floor.size[2] * 0.5);
  assert.ok(pointToBoxDistanceXZ(first.spawn, cube.center, cube.size) >= first.grid.safeRouteClearance);
  assert.ok(pointToBoxDistanceXZ(first.exit, cube.center, cube.size) >= first.grid.safeRouteClearance);
  const separatedFromMantleX = Math.abs(cube.center[0] - first.directMantle.center[0]) > (cube.size[0] + first.directMantle.size[0]) * 0.5;
  const separatedFromMantleZ = Math.abs(cube.center[2] - first.directMantle.center[2]) > (cube.size[2] + first.directMantle.size[2]) * 0.5;
  assert.ok(separatedFromMantleX || separatedFromMantleZ, `${cube.id} overlaps direct mantle fixture`);
  const key = `${x},${z}`;
  assert.ok(!occupied.has(key));
  occupied.add(key);
  widths.add(sx);
  heights.add(sy);
  depths.add(sz);
}

assert.ok(widths.size > 20);
assert.ok(heights.size > 20);
assert.ok(depths.size > 20);

for (let i = 0; i < first.cubes.length; i += 1) {
  const a = first.cubes[i];
  for (let j = i + 1; j < first.cubes.length; j += 1) {
    const b = first.cubes[j];
    const separatedX = Math.abs(a.center[0] - b.center[0]) > (a.size[0] + b.size[0]) * 0.5;
    const separatedZ = Math.abs(a.center[2] - b.center[2]) > (a.size[2] + b.size[2]) * 0.5;
    assert.ok(separatedX || separatedZ, `${a.id} overlaps ${b.id}`);
  }
}

assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
console.log(JSON.stringify({
  ok: true,
  contract: 'controller-kata-arena',
  seed: first.numericSeed,
  boxes: first.cubes.length,
  uniqueCells: occupied.size,
  variedDimensions: [widths.size, heights.size, depths.size],
}));
