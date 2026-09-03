const DEFAULT_ARENA_SEED = 'controller-proof';
const BOX_COUNT = 28;
const GRID_MIN = -40;
const GRID_MAX = 40;
const GRID_STEP = 4;
const BOX_MIN_WIDTH = 1.35;
const BOX_MAX_WIDTH = 3.2;
const BOX_MIN_HEIGHT = 0.8;
const BOX_MAX_HEIGHT = 5;
const BOX_MIN_DEPTH = 1.35;
const BOX_MAX_DEPTH = 3.2;
const SAFE_ROUTE_CLEARANCE = 6;
const SPAWN = [0, 1.65, -38];
const EXIT = [0, 0, 38];
const DIRECT_MANTLE_FIXTURE = Object.freeze({
  id: 'controller-kata-direct-mantle',
  center: Object.freeze([0, 0.6, -34]),
  size: Object.freeze([6, 1.2, 2.4]),
  approach: Object.freeze([0, 0, 1]),
  minForwardInput: 0.55,
  minFacingDot: 0.72,
  minFeetToLip: 0.2,
  maxFeetToLip: 1.0,
  maxVerticalDisplacement: 1.02,
  maxHorizontalDisplacement: 1.45,
  duration: 0.34,
});

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

function copyDirectMantleFixture() {
  return {
    ...DIRECT_MANTLE_FIXTURE,
    center: [...DIRECT_MANTLE_FIXTURE.center],
    size: [...DIRECT_MANTLE_FIXTURE.size],
    approach: [...DIRECT_MANTLE_FIXTURE.approach],
    topY: DIRECT_MANTLE_FIXTURE.center[1] + DIRECT_MANTLE_FIXTURE.size[1] * 0.5,
  };
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
    const height = randomDimension(BOX_MIN_HEIGHT, BOX_MAX_HEIGHT);
    const depth = randomDimension(BOX_MIN_DEPTH, BOX_MAX_DEPTH);
    const center = [x, height * 0.5, z];
    const size = [width, height, depth];

    if (pointToBoxDistanceXZ(SPAWN, center, size) < SAFE_ROUTE_CLEARANCE) continue;
    if (pointToBoxDistanceXZ(EXIT, center, size) < SAFE_ROUTE_CLEARANCE) continue;

    occupied.add(key);
    cubes.push({
      id: `cube-${cubes.length}`,
      cell: [x, z],
      center,
      size,
    });
  }

  if (cubes.length !== BOX_COUNT) {
    throw new Error(`controller arena generation exhausted after ${attempts} attempts`);
  }

  return {
    seedText,
    numericSeed,
    grid: {
      min: GRID_MIN,
      max: GRID_MAX,
      step: GRID_STEP,
      safeRouteClearance: SAFE_ROUTE_CLEARANCE,
    },
    floor: { center: [0, -0.25, 0], size: [96, 0.5, 96] },
    spawn: [...SPAWN],
    exit: [...EXIT],
    exitRadius: 2.5,
    directMantle: copyDirectMantleFixture(),
    cubes,
  };
}
