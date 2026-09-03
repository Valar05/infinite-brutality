import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mantleCourse from '../src/generated/product-one-mantle-course.mjs';
import { BOXCRAFT_MANTLE_COURSE_PIN, generateControllerArena, hashArenaSeed } from '../src/controller-kata.js';
import { PRODUCT_ONE_CAPABILITY_PROFILE } from '../src/product-one-controller.js';

const pointToBoxDistanceXZ = (point, center, size) => {
  const dx = Math.max(0, Math.abs(point[0] - center[0]) - size[0] * 0.5);
  const dz = Math.max(0, Math.abs(point[2] - center[2]) - size[2] * 0.5);
  return Math.hypot(dx, dz);
};
const overlaps = (center, size, bounds) => (
  center[0] + size[0] * 0.5 >= bounds.minX
  && center[0] - size[0] * 0.5 <= bounds.maxX
  && center[2] + size[2] * 0.5 >= bounds.minZ
  && center[2] - size[2] * 0.5 <= bounds.maxZ
);

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
const playableScenario = mantleCourse.scenarios.find((scenario) => scenario.id === 'scenario-high-mantle');
assert.ok(playableScenario, 'Boxcraft high-mantle scenario must own the playable spawn');
assert.deepEqual(first.spawn, [
  playableScenario.approach.spawn[0],
  playableScenario.approach.spawn[1] + PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight,
  playableScenario.approach.spawn[2],
]);
assert.deepEqual(first.exit, [0, 0, 38]);
assert.equal(first.cubes.length, 28);
assert.equal(first.boxcraftCourse.schema, 'BOXCRAFT MANTLE COURSE 1');
assert.equal(first.boxcraftCourse.courseHash, BOXCRAFT_MANTLE_COURSE_PIN.courseHash);
assert.equal(BOXCRAFT_MANTLE_COURSE_PIN.commit, 'b4ff8625a0981ed39eb6d25a6ba88642b974e9b4');
assert.deepEqual(first.boxcraftCourse.profile, PRODUCT_ONE_CAPABILITY_PROFILE);
assert.deepEqual(JSON.parse(readFileSync(new URL('../src/generated/product-one-mantle-course.json', import.meta.url), 'utf8')), mantleCourse);

const legacyIds = [
  'controller-kata-low-edge',
  'controller-kata-stair-1',
  'controller-kata-stair-2',
  'controller-kata-stair-3',
  'controller-kata-stair-top',
  'controller-kata-stair-down-1',
  'controller-kata-stair-down-2',
];
const courseIds = [
  'mantle-course-grounded-step',
  'mantle-course-low-mantle',
  'mantle-course-high-mantle',
  'mantle-course-impossible',
];
assert.equal(first.traversal.geometryHash, '8c87484c');
assert.deepEqual(first.traversal.fixtures.map((fixture) => fixture.id), [...legacyIds, ...courseIds]);
assert.deepEqual(first.boxcraftCourse.fixtureIds, courseIds);
assert.deepEqual(first.boxcraftCourse.scenarioIds, [
  'scenario-grounded-step-control',
  'scenario-low-mantle',
  'scenario-high-mantle',
  'scenario-impossible-control',
]);
assert.deepEqual(Object.keys(first.traversal.scenarios), ['lowEdge', 'stairs', ...courseIds]);
assert.equal(first.traversal.fixtures.filter((fixture) => fixture.role === 'stair-up').length, 3);
assert.equal(first.traversal.fixtures.filter((fixture) => fixture.role === 'stair-down').length, 2);
assert.ok(first.traversal.scenarios.stairs.topBounds);
assert.ok(first.traversal.scenarios.stairs.successBounds.max[1] < 0.2);

const byRole = Object.fromEntries(first.traversal.fixtures.map((fixture) => [fixture.role, fixture]));
const apex = PRODUCT_ONE_CAPABILITY_PROFILE.jumpSpeed ** 2 / (2 * PRODUCT_ONE_CAPABILITY_PROFILE.gravity);
assert.ok(byRole['grounded-step-control'].topY < PRODUCT_ONE_CAPABILITY_PROFILE.autostepHeight);
assert.ok(byRole['low-mantle'].topY > PRODUCT_ONE_CAPABILITY_PROFILE.autostepHeight);
assert.ok(byRole['high-mantle'].topY > PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight);
assert.ok(byRole['high-mantle'].topY <= apex + PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip);
assert.ok(byRole['impossible-control'].topY > apex + PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip);
for (const bounds of first.traversal.courseLaneBounds) {
  assert.ok(bounds.maxZ - bounds.minZ >= 4, `${bounds.id} must retain a clear 4m approach`);
}

const occupied = new Set();
const widths = new Set();
const heights = new Set();
const depths = new Set();
for (const [index, cube] of first.cubes.entries()) {
  assert.equal(cube.id, `cube-${index}`);
  assert.equal(cube.role, 'seeded-random');
  assert.equal(cube.walkableTop, true);
  const [x, y, z] = cube.center;
  const [sx, sy, sz] = cube.size;
  assert.deepEqual(cube.cell, [x, z]);
  assert.ok(sx >= 1.35 && sx <= 3.2);
  assert.ok(sy >= 0.8 && sy <= 5);
  assert.ok(sz >= 1.35 && sz <= 3.2);
  assert.equal(y, sy * 0.5);
  assert.equal((x - first.grid.min) % first.grid.step, 0);
  assert.equal((z - first.grid.min) % first.grid.step, 0);
  assert.ok(pointToBoxDistanceXZ(first.spawn, cube.center, cube.size) >= first.grid.safeRouteClearance);
  assert.ok(pointToBoxDistanceXZ(first.exit, cube.center, cube.size) >= first.grid.safeRouteClearance);
  assert.equal(overlaps(cube.center, cube.size, first.traversal.laneBounds), false);
  assert.equal(first.traversal.courseLaneBounds.some((bounds) => overlaps(cube.center, cube.size, bounds)), false);
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
  for (let j = i + 1; j < first.cubes.length; j += 1) {
    const a = first.cubes[i];
    const b = first.cubes[j];
    const separatedX = Math.abs(a.center[0] - b.center[0]) > (a.size[0] + b.size[0]) * 0.5;
    const separatedZ = Math.abs(a.center[2] - b.center[2]) > (a.size[2] + b.size[2]) * 0.5;
    assert.ok(separatedX || separatedZ, `${a.id} overlaps ${b.id}`);
  }
}
assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
console.log(JSON.stringify({ ok: true, contract: 'controller-kata-arena', boxes: first.cubes.length, courseHash: first.boxcraftCourse.courseHash, traversalGeometryHash: first.traversal.geometryHash, fixtures: [...legacyIds, ...courseIds] }));
