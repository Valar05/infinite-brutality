import mantleCourse from './generated/product-one-mantle-course.mjs?v=231b619c8dac766a3989640ae4b11a03e4aaeb3830110702171044c0077f57f6';
import { CONTROLLER_KATA_PROFILE as PRODUCT_ONE_CAPABILITY_PROFILE } from './controller-kata-profile.js?build=b2eca19f7ffe30707c9b9d98ac2dfe5f5750d06f4c07740d4a7b712f77d8bc25';

const DEFAULT_ARENA_SEED = 'controller-proof';
const BOX_COUNT = 28;
const GRID_MIN = -40;
const GRID_MAX = 40;
const GRID_STEP = 4;
const BOX_MIN_WIDTH = 1.35;
const BOX_MAX_WIDTH = 3.2;
const BOX_HEIGHT_TIERS = Object.freeze([
  Object.freeze({ id: 'step', minimum: 0.18, maximum: 0.6 }),
  Object.freeze({ id: 'reachable-mantle', minimum: 0.68, maximum: 1.62 }),
  Object.freeze({ id: 'too-high', minimum: 1.78, maximum: 5 }),
]);
const BOX_MIN_DEPTH = 1.35;
const BOX_MAX_DEPTH = 3.2;
const SAFE_ROUTE_CLEARANCE = 6;
const PLAYABLE_MANTLE_SCENARIO = mantleCourse.scenarios.find((scenario) => scenario.id === 'scenario-high-mantle');
if (!PLAYABLE_MANTLE_SCENARIO) throw new Error('Boxcraft high-mantle playable scenario is missing');
const SPAWN = [
  PLAYABLE_MANTLE_SCENARIO.approach.spawn[0],
  PLAYABLE_MANTLE_SCENARIO.approach.spawn[1] + PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight,
  PLAYABLE_MANTLE_SCENARIO.approach.spawn[2],
];
const EXIT = [0, 0, 38];
const TRAVERSAL_LANE_BOUNDS = Object.freeze({ minX: -6, maxX: 6, minZ: -38, maxZ: -18.8 });
const LEGACY_AUTOSTEP_FIXTURES = Object.freeze([
  Object.freeze({ id: 'controller-kata-low-edge', role: 'low-edge', center: Object.freeze([0, 0.2, -33]), size: Object.freeze([4, 0.4, 3]), color: 0x47b8b0, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-1', role: 'stair-up', center: Object.freeze([0, 0.15, -29.8]), size: Object.freeze([4, 0.3, 1.2]), color: 0x5e8fc7, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-2', role: 'stair-up', center: Object.freeze([0, 0.3, -28.6]), size: Object.freeze([4, 0.6, 1.2]), color: 0x6598d1, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-3', role: 'stair-up', center: Object.freeze([0, 0.45, -27.4]), size: Object.freeze([4, 0.9, 1.2]), color: 0x6ea2dc, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-top', role: 'stair-top', center: Object.freeze([0, 0.45, -25.3]), size: Object.freeze([4, 0.9, 3]), color: 0x78ade7, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-down-1', role: 'stair-down', center: Object.freeze([0, 0.3, -23.2]), size: Object.freeze([4, 0.6, 1.2]), color: 0x6598d1, walkableTop: true }),
  Object.freeze({ id: 'controller-kata-stair-down-2', role: 'stair-down', center: Object.freeze([0, 0.15, -22]), size: Object.freeze([4, 0.3, 1.2]), color: 0x5e8fc7, walkableTop: true }),
]);
const LEGACY_AUTOSTEP_SCENARIOS = Object.freeze({
  lowEdge: Object.freeze({ spawn: Object.freeze([0, 1.68, -36]), successBounds: Object.freeze({ min: Object.freeze([-1.5, 0, -31.45]), max: Object.freeze([1.5, 2.2, -30.4]) }) }),
  stairs: Object.freeze({ spawn: Object.freeze([0, 1.68, -31.2]), topBounds: Object.freeze({ min: Object.freeze([-1.5, 0.75, -26.5]), max: Object.freeze([1.5, 1.1, -24.1]) }), successBounds: Object.freeze({ min: Object.freeze([-1.5, -0.08, -20.9]), max: Object.freeze([1.5, 0.18, -19.3]) }) }),
});

export const BOXCRAFT_MANTLE_COURSE_PIN = Object.freeze({
  repository: 'Valar05/punnett-boxcraft-judgment-mcp',
  commit: 'b4ff8625a0981ed39eb6d25a6ba88642b974e9b4',
  courseHash: 'b4fbadc14e0b5be04285e02a21e361a5666d917b989bb99753b379f2cdfff969',
});

if (mantleCourse.schema !== 'BOXCRAFT MANTLE COURSE 1'
  || mantleCourse.courseHash !== BOXCRAFT_MANTLE_COURSE_PIN.courseHash
  || JSON.stringify(mantleCourse.profile) !== JSON.stringify(PRODUCT_ONE_CAPABILITY_PROFILE)) {
  throw new Error('Product One capability profile or Boxcraft mantle course pin drifted');
}

export function hashArenaSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pointToBoxDistanceXZ(point, center, size) {
  const dx = Math.max(0, Math.abs(point[0] - center[0]) - size[0] * 0.5);
  const dz = Math.max(0, Math.abs(point[2] - center[2]) - size[2] * 0.5);
  return Math.hypot(dx, dz);
}

function copyFixture(fixture) {
  return {
    ...fixture,
    center: [...fixture.center],
    size: [...fixture.size],
    topY: fixture.center[1] + fixture.size[1] * 0.5,
    walkableTop: fixture.walkableTop !== false,
  };
}

function copyBounds(bounds) {
  return { min: [...bounds.min], max: [...bounds.max] };
}

function copyLegacyScenarios() {
  return Object.fromEntries(Object.entries(LEGACY_AUTOSTEP_SCENARIOS).map(([id, scenario]) => [id, {
    ...scenario,
    spawn: [...scenario.spawn],
    successBounds: copyBounds(scenario.successBounds),
    ...(scenario.topBounds ? { topBounds: copyBounds(scenario.topBounds) } : {}),
  }]));
}

function copyCourseScenario(scenario) {
  return {
    ...scenario,
    input: scenario.input,
    spawn: [
      scenario.approach.spawn[0],
      scenario.approach.spawn[1] + PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight,
      scenario.approach.spawn[2],
    ],
    approach: {
      ...scenario.approach,
      spawn: [...scenario.approach.spawn],
      facing: [...scenario.approach.facing],
    },
    successBounds: copyBounds(scenario.successBounds),
    relation: {
      ...scenario.relation,
      relativeReach: [...scenario.relation.relativeReach],
    },
  };
}

function overlapsBounds(center, size, bounds) {
  return center[0] + size[0] * 0.5 >= bounds.minX
    && center[0] - size[0] * 0.5 <= bounds.maxX
    && center[2] + size[2] * 0.5 >= bounds.minZ
    && center[2] - size[2] * 0.5 <= bounds.maxZ;
}

function courseLaneBounds() {
  return mantleCourse.scenarios.map((scenario) => {
    const fixture = mantleCourse.fixtures.find((entry) => entry.id === scenario.fixtureId);
    const halfWidth = fixture.size[0] * 0.5;
    const halfDepth = fixture.size[2] * 0.5;
    return {
      id: scenario.id,
      minX: fixture.center[0] - halfWidth,
      maxX: fixture.center[0] + halfWidth,
      minZ: Math.min(scenario.approach.spawn[2], fixture.center[2] - halfDepth),
      maxZ: fixture.center[2] + halfDepth,
    };
  });
}

export function generateControllerArena(options = {}) {
  const seedText = String(options.seed ?? DEFAULT_ARENA_SEED);
  const numericSeed = hashArenaSeed(seedText);
  let state = numericSeed;
  const rng = () => {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const randomDimension = (minimum, maximum) => minimum + rng() * (maximum - minimum);
  const reservedCourseBounds = courseLaneBounds();
  const cubes = [];
  const occupied = new Set();
  let attempts = 0;
  const maxAttempts = 4096;

  while (cubes.length < BOX_COUNT && attempts < maxAttempts) {
    attempts += 1;
    const x = GRID_MIN + GRID_STEP * Math.floor(rng() * ((GRID_MAX - GRID_MIN) / GRID_STEP + 1));
    const z = GRID_MIN + GRID_STEP * Math.floor(rng() * ((GRID_MAX - GRID_MIN) / GRID_STEP + 1));
    const key = `${x},${z}`;
    if (occupied.has(key)) continue;
    const width = randomDimension(BOX_MIN_WIDTH, BOX_MAX_WIDTH);
    const tier = BOX_HEIGHT_TIERS[cubes.length % BOX_HEIGHT_TIERS.length];
    const height = randomDimension(tier.minimum, tier.maximum);
    const depth = randomDimension(BOX_MIN_DEPTH, BOX_MAX_DEPTH);
    const center = [x, height * 0.5, z];
    const size = [width, height, depth];
    if (pointToBoxDistanceXZ(SPAWN, center, size) < SAFE_ROUTE_CLEARANCE) continue;
    if (pointToBoxDistanceXZ(EXIT, center, size) < SAFE_ROUTE_CLEARANCE) continue;
    if (overlapsBounds(center, size, TRAVERSAL_LANE_BOUNDS)) continue;
    if (reservedCourseBounds.some((bounds) => overlapsBounds(center, size, bounds))) continue;
    occupied.add(key);
    cubes.push({ id: `cube-${cubes.length}`, cell: [x, z], center, size, role: `seeded-random-${tier.id}`, tier: tier.id, walkableTop: true });
  }

  if (cubes.length !== BOX_COUNT) throw new Error(`controller arena generation exhausted after ${attempts} attempts`);

  const courseFixtures = mantleCourse.fixtures.map(copyFixture);
  const fixtures = [...LEGACY_AUTOSTEP_FIXTURES.map(copyFixture), ...courseFixtures];
  const courseScenarios = Object.fromEntries(mantleCourse.scenarios.map((scenario) => [scenario.fixtureId, copyCourseScenario(scenario)]));
  const geometryHash = hashArenaSeed(JSON.stringify([...fixtures, ...cubes].map(({ id, role, tier, center, size }) => ({ id, role, tier: tier || '', center, size })))).toString(16).padStart(8, '0');
  const tierCounts = Object.fromEntries(BOX_HEIGHT_TIERS.map((tier) => [tier.id, cubes.filter((cube) => cube.tier === tier.id).length]));
  return {
    seedText,
    numericSeed,
    grid: { min: GRID_MIN, max: GRID_MAX, step: GRID_STEP, safeRouteClearance: SAFE_ROUTE_CLEARANCE },
    floor: { center: [0, -0.25, 0], size: [96, 0.5, 96] },
    spawn: [...SPAWN],
    exit: [...EXIT],
    exitRadius: 2.5,
    boxcraftCourse: {
      schema: mantleCourse.schema,
      profile: { ...mantleCourse.profile },
      courseHash: mantleCourse.courseHash,
      provenance: JSON.parse(JSON.stringify(mantleCourse.provenance)),
      fixtureIds: courseFixtures.map((fixture) => fixture.id),
      scenarioIds: mantleCourse.scenarios.map((scenario) => scenario.id),
    },
    traversal: {
      laneBounds: { ...TRAVERSAL_LANE_BOUNDS },
      courseLaneBounds: reservedCourseBounds.map((bounds) => ({ ...bounds })),
      geometryHash,
      fixtures,
      scenarios: { ...copyLegacyScenarios(), ...courseScenarios },
    },
    cubes,
    tierCounts,
  };
}
