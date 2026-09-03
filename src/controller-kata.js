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
  maxActivationDistance: 0.82,
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

export function createDirectMantlePlan(options = {}) {
  const fixture = options.fixture;
  const position = options.eyePosition;
  const collisions = Array.isArray(options.collisions) ? options.collisions : [];
  const inputMoveY = Number(options.inputMoveY) || 0;
  const playerMode = String(options.playerMode || 'ground');
  const eyeHeight = Number(options.eyeHeight) || 1.68;
  if (!fixture || !Array.isArray(position) || position.length < 3) return null;
  if (playerMode === 'climb' || playerMode === 'mantle' || inputMoveY < fixture.minForwardInput) return null;
  const contact = collisions.find((entry) => entry?.isWall && entry.source === fixture.id);
  if (!contact) return null;
  const approachX = Number(fixture.approach?.[0]) || 0;
  const approachZ = Number(fixture.approach?.[2]) || 0;
  const approachLength = Math.hypot(approachX, approachZ);
  if (approachLength < 0.99) return null;
  const forwardX = approachX / approachLength;
  const forwardZ = approachZ / approachLength;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const faceX = fixture.center[0] - forwardX * fixture.size[2] * 0.5;
  const faceZ = fixture.center[2] - forwardZ * fixture.size[2] * 0.5;
  const toFaceX = faceX - position[0];
  const toFaceZ = faceZ - position[2];
  const forwardDistance = toFaceX * forwardX + toFaceZ * forwardZ;
  const lateral = (position[0] - fixture.center[0]) * rightX + (position[2] - fixture.center[2]) * rightZ;
  if (forwardDistance < -0.08 || forwardDistance > fixture.maxActivationDistance) return null;
  const halfWidth = fixture.size[0] * 0.5;
  if (Math.abs(lateral) > halfWidth) return null;
  const endLateral = Math.max(-halfWidth + 0.5, Math.min(halfWidth - 0.5, lateral));
  return {
    kind: 'controller-direct',
    source: fixture.id,
    start: [position[0], position[1], position[2]],
    end: [fixture.center[0] + rightX * endLateral, fixture.topY + eyeHeight, fixture.center[2]],
    elapsed: 0,
    duration: fixture.duration,
    faceYaw: Number(options.faceYaw) || 0,
    inputMoveY,
    contactSource: contact.source,
    activationDistance: forwardDistance,
  };
}

export function advanceDirectMantle(plan, dt) {
  if (!plan || plan.kind !== 'controller-direct') throw new TypeError('direct mantle plan is required');
  const elapsed = Math.min(plan.duration, plan.elapsed + Math.max(0, Number(dt) || 0));
  const t = Math.max(0, Math.min(1, elapsed / plan.duration));
  const eased = t * t * (3 - 2 * t);
  const lift = Math.sin(Math.PI * eased) * 0.18;
  const position = plan.start.map((value, index) => value + (plan.end[index] - value) * eased);
  position[1] += lift;
  return { elapsed, progress: t, position, complete: t >= 1 };
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
