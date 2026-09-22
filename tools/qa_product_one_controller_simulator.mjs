import * as THREE from "../vendor/three/build/three.module.js";
import { generateControllerArena } from "../src/controller-kata.js";
import { createPhysicsWorld, ensurePhysicsReady } from "../src/physics-world.js";
import { createProductOneInputAdapter } from "../src/product-one-input-adapter.js";
import {
  createProductOneController,
  PRODUCT_ONE_CAPABILITY_PROFILE,
  PRODUCT_ONE_FIXED_DT,
  PRODUCT_ONE_PHYSICS_OPTIONS,
} from "../src/product-one-controller.js";

const args = process.argv.slice(2);
const valueAfter = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const seed = valueAfter("--seed", "controller-proof");
const tickHz = Number(valueAfter("--tick-hz", "60"));
const negativeControl = valueAfter("--negative-control", "");
if (tickHz !== Math.round(1 / PRODUCT_ONE_FIXED_DT)) throw new TypeError("tick-hz must match Product One fixed tick");

await ensurePhysicsReady();
const arena = generateControllerArena({ seed: `${seed}:0` });
const fixtures = arena.traversal.fixtures;
const fixtureByRole = (role) => fixtures.find((fixture) => fixture.role === role);
const groundedStepFixture = fixtureByRole("grounded-step-control");
const lowMantleFixture = fixtureByRole("low-mantle");
const highMantleFixture = fixtureByRole("high-mantle");
const impossibleFixture = fixtureByRole("impossible-control");
const apexRise = PRODUCT_ONE_CAPABILITY_PROFILE.jumpSpeed ** 2 / (2 * PRODUCT_ONE_CAPABILITY_PROFILE.gravity);
const minimumMantleFootprint = PRODUCT_ONE_CAPABILITY_PROFILE.radius * 2 + PRODUCT_ONE_CAPABILITY_PROFILE.mantleForward;
const randomMantleFixture = arena.cubes
  .filter((cube) => (
    cube.size[0] >= minimumMantleFootprint
    && cube.size[2] >= minimumMantleFootprint
    && cube.size[1] > PRODUCT_ONE_CAPABILITY_PROFILE.autostepHeight
    && cube.size[1] <= apexRise + PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip
  ))
  .sort((a, b) => (b.size[0] * b.size[2]) - (a.size[0] * a.size[2]) || a.id.localeCompare(b.id))[0];
const courseScenario = (fixture) => arena.traversal.scenarios[fixture.id];
const withholdFixture = valueAfter(
  "--withhold-fixture",
  negativeControl === "missing-course-box" ? highMantleFixture?.id || "mantle-course-high-mantle" : "",
);
const expectedMountedIds = [
  "controller-kata-floor",
  ...fixtures.map((fixture) => fixture.id),
  ...arena.cubes.map((cube) => cube.id),
].filter((id) => id !== withholdFixture);
const arenaFailures = [];
if (arena.boxcraftCourse.courseHash !== "b4fbadc14e0b5be04285e02a21e361a5666d917b989bb99753b379f2cdfff969") arenaFailures.push("Boxcraft course hash drifted");
if (JSON.stringify(arena.boxcraftCourse.profile) !== JSON.stringify(PRODUCT_ONE_CAPABILITY_PROFILE)) arenaFailures.push("Boxcraft profile differs from controller capability profile");
for (const role of ["grounded-step-control", "low-mantle", "high-mantle", "impossible-control"]) {
  if (!fixtureByRole(role)) arenaFailures.push(`Boxcraft course role missing: ${role}`);
}
if (!randomMantleFixture) arenaFailures.push("no suitable actual seeded random cuboid exists");
if (highMantleFixture?.topY <= PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight) arenaFailures.push("Boxcraft high fixture does not begin above eye height");
if (impossibleFixture?.topY <= apexRise + PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip) arenaFailures.push("Boxcraft impossible fixture is not above ballistic reach");

const forwardForYaw = (yaw) => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
const rightForYaw = (yaw) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
const feetPosition = (player) => [player.position.x, player.position.y - PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight, player.position.z];
const insideBounds = (point, bounds) => point.every((value, index) => value >= bounds.min[index] && value <= bounds.max[index]);
const physicsOptions = () => negativeControl === "disable-autostep"
  ? { ...PRODUCT_ONE_PHYSICS_OPTIONS, autostepHeight: 0.001 }
  : PRODUCT_ONE_PHYSICS_OPTIONS;

function makePlayer(position) {
  return {
    position: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    yaw: Math.PI,
    grounded: true,
    mode: "ground",
    climb: null,
    mantle: null,
    runCharge: 0,
    isRunning: false,
    lastRunIntent: false,
  };
}

function createHarness(spawn) {
  const physics = createPhysicsWorld(physicsOptions());
  const mountedIds = [];
  const mount = (record, source = record.id) => {
    if (source === withholdFixture) return;
    physics.addCuboid({ size: record.size, position: record.center, source, kind: "walkable" });
    mountedIds.push(source);
  };
  mount(arena.floor, "controller-kata-floor");
  for (const fixture of fixtures) mount(fixture);
  for (const cube of arena.cubes) mount(cube);
  const originalLookup = physics.getWalkableCuboid;
  if (negativeControl === "suppress-mantle") physics.getWalkableCuboid = () => null;
  if (negativeControl === "single-fixture-only") {
    physics.getWalkableCuboid = (source) => source === lowMantleFixture.id ? originalLookup(source) : null;
  }
  const player = makePlayer(spawn);
  const events = [];
  const controller = createProductOneController({
    player,
    physicsWorld: physics,
    forwardForYaw,
    rightForYaw,
    onEvent: (event) => events.push(event),
  });
  const input = createProductOneInputAdapter({
    enqueueJump: () => controller.input.pressJump({ source: "diagnostic-simulator" }),
    stepController: (dt, move) => {
      controller.input.setMove({ ...move, source: "diagnostic-simulator" });
      return controller.input.update(dt);
    },
  });
  let controllerTicks = 0;
  let physicsSteps = 0;
  const update = (rawInput) => {
    input.setMove({ ...rawInput, source: "diagnostic-simulator" });
    const frame = input.update(PRODUCT_ONE_FIXED_DT);
    controllerTicks += frame.steps;
    if (frame.last?.move) physicsSteps += 1;
    return frame;
  };
  return { physics, player, controller, input, events, mountedIds, update, counts: () => ({ controllerTicks, physicsSteps }) };
}

function runForwardScenario(scenario, seconds, topBounds = null) {
  const harness = createHarness(scenario.spawn);
  let reachedTop = false;
  let completed = false;
  let maxFeetY = 0;
  for (let tick = 0; tick < tickHz * seconds; tick += 1) {
    harness.update({ moveY: 1 });
    const feet = feetPosition(harness.player);
    maxFeetY = Math.max(maxFeetY, feet[1]);
    if (topBounds && insideBounds(feet, topBounds)) reachedTop = true;
    if (insideBounds(feet, scenario.successBounds) && harness.player.grounded) {
      completed = true;
      if (!topBounds || reachedTop) break;
    }
  }
  const result = {
    completed,
    reachedTop: topBounds ? reachedTop : undefined,
    grounded: harness.player.grounded,
    mantleStarts: harness.events.filter((event) => event.type === "mantle-start").length,
    finalPosition: feetPosition(harness.player),
    maxFeetY,
    mountedFixtureIds: [...harness.mountedIds],
    ...harness.counts(),
  };
  harness.physics.dispose();
  return result;
}

function derivedRandomScenario(fixture) {
  const frontZ = fixture.center[2] - fixture.size[2] * 0.5;
  const topY = fixture.center[1] + fixture.size[1] * 0.5;
  return {
    id: "scenario-seeded-random",
    fixtureId: fixture.id,
    spawn: [fixture.center[0], PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight, frontZ - 4],
    successBounds: {
      min: [fixture.center[0] - fixture.size[0] * 0.5 + PRODUCT_ONE_CAPABILITY_PROFILE.radius, topY - 0.000001, frontZ - 0.01],
      max: [fixture.center[0] + fixture.size[0] * 0.5 - PRODUCT_ONE_CAPABILITY_PROFILE.radius, topY + PRODUCT_ONE_CAPABILITY_PROFILE.radius, fixture.center[2] + fixture.size[2] * 0.5],
    },
  };
}

function runJumpMantle(fixture, scenario) {
  if (negativeControl === "planner-only") {
    return { completed: true, sequence: ["ground", "air", "mantle", "ground"], realSharedJump: false, sharedPhysicsContact: false, controllerTicks: 0, physicsSteps: 0, climbEntries: 0, finalGrounded: true, completionVelocity: [0, 0, 0], mountedFixtureIds: [] };
  }
  const harness = createHarness(scenario.spawn);
  const frontZ = fixture.center[2] - fixture.size[2] * 0.5;
  const jumpTriggerDistance = Math.max(
    PRODUCT_ONE_CAPABILITY_PROFILE.radius + PRODUCT_ONE_PHYSICS_OPTIONS.characterOffset * 2,
    Math.min(1, fixture.topY - PRODUCT_ONE_CAPABILITY_PROFILE.mantleMinFeetToLip),
  );
  for (let tick = 0; tick < tickHz * 3; tick += 1) {
    harness.update({ moveY: 1 });
    if (harness.player.position.z >= frontZ - jumpTriggerDistance) break;
  }
  harness.input.pressJump({ source: "diagnostic-simulator" });
  for (let tick = 0; tick < tickHz * 3; tick += 1) {
    harness.update({ moveY: 1 });
    if (harness.events.some((event) => event.type === "mantle-complete")) break;
  }
  const jump = harness.events.find((event) => event.type === "jump-commit");
  const mantleStart = harness.events.find((event) => event.type === "mantle-start");
  const mantleComplete = harness.events.find((event) => event.type === "mantle-complete");
  const airborneContact = harness.events.find((event) => event.type === "wall-contact" && jump && event.tick >= jump.tick && !event.grounded && event.source === fixture.id);
  const sequence = ["ground"];
  if (jump) sequence.push("air");
  if (mantleStart) sequence.push("mantle");
  if (mantleComplete) sequence.push("ground");
  const result = {
    fixtureId: fixture.id,
    topY: fixture.topY ?? fixture.center[1] + fixture.size[1] * 0.5,
    completed: Boolean(mantleComplete),
    sequence,
    realSharedJump: Boolean(jump),
    sharedPhysicsContact: Boolean(airborneContact),
    contactSource: mantleStart?.plan?.contactSource || "",
    withinSuccessBounds: mantleComplete ? insideBounds(feetPosition(harness.player), scenario.successBounds) : false,
    mountedFixtureIds: [...harness.mountedIds],
    ...harness.counts(),
    climbEntries: harness.events.filter((event) => event.type === "forbidden-climb").length,
    finalGrounded: harness.player.grounded,
    finalPosition: feetPosition(harness.player),
    completionVelocity: mantleComplete ? harness.player.velocity.toArray() : null,
  };
  harness.physics.dispose();
  return result;
}

function runImpossible() {
  const scenario = courseScenario(impossibleFixture);
  const result = runJumpMantle(impossibleFixture, scenario);
  return { ...result, rejected: !result.completed && result.sequence.includes("air") && !result.sequence.includes("mantle") };
}

function runGroundedBoostControl() {
  const scenario = courseScenario(lowMantleFixture);
  const harness = createHarness(scenario.spawn);
  const frontZ = lowMantleFixture.center[2] - lowMantleFixture.size[2] * 0.5;
  let wallContact = false;
  for (let tick = 0; tick < tickHz * 3; tick += 1) {
    harness.update({ moveY: 1 });
    wallContact ||= harness.events.some((event) => event.type === "wall-contact" && event.source === lowMantleFixture.id && event.grounded);
    if (wallContact) break;
  }
  const mantleStarts = harness.events.filter((event) => event.type === "mantle-start").length;
  const injectedGroundBoost = negativeControl === "grounded-boost" && wallContact;
  const result = { wallContact, mantleStarts, groundBoost: injectedGroundBoost, grounded: harness.player.grounded, mountedFixtureIds: [...harness.mountedIds], ...harness.counts() };
  harness.physics.dispose();
  return result;
}

const lowEdge = runForwardScenario(arena.traversal.scenarios.lowEdge, 3);
const stairs = runForwardScenario(arena.traversal.scenarios.stairs, 5, arena.traversal.scenarios.stairs.topBounds);
const groundedStep = runForwardScenario(courseScenario(groundedStepFixture), 3);
const groundedBoost = runGroundedBoostControl();
const lowMantle = runJumpMantle(lowMantleFixture, courseScenario(lowMantleFixture));
const highMantle = runJumpMantle(highMantleFixture, courseScenario(highMantleFixture));
const randomMantle = runJumpMantle(randomMantleFixture, derivedRandomScenario(randomMantleFixture));
const impossible = runImpossible();
const failures = [...arenaFailures];
if (withholdFixture) failures.push(`playable course fixture withheld: ${withholdFixture}`);
if (!lowEdge.completed || !lowEdge.grounded || lowEdge.mantleStarts) failures.push("low edge forward-only did not autostep grounded");
if (!stairs.completed || !stairs.reachedTop || !stairs.grounded || stairs.mantleStarts) failures.push("stairs forward-only did not reach top and return grounded");
if (!groundedStep.completed || !groundedStep.grounded || groundedStep.mantleStarts) failures.push("Boxcraft grounded step did not autostep without mantle");
if (groundedBoost.mantleStarts || groundedBoost.groundBoost) failures.push("grounded contact activated mantle or boost");
for (const [label, result] of [["low", lowMantle], ["high", highMantle], ["seeded random", randomMantle]]) {
  if (JSON.stringify(result.sequence) !== JSON.stringify(["ground", "air", "mantle", "ground"])) failures.push(`${label} cuboid did not yield ground-air-mantle-ground`);
  if (!result.completed || !result.finalGrounded || !result.withinSuccessBounds) failures.push(`${label} cuboid mantle did not complete on its actual top`);
  if (!result.realSharedJump || !result.sharedPhysicsContact || result.contactSource !== result.fixtureId || result.physicsSteps <= 0) failures.push(`${label} cuboid lacked real shared jump/contact ownership`);
  if (result.climbEntries !== 0) failures.push(`${label} cuboid entered CLIMB`);
  if (result.completionVelocity?.some((value) => value !== 0)) failures.push(`${label} cuboid mantle completion granted velocity`);
}
if (!impossible.rejected) failures.push("impossible Boxcraft control entered mantle");
for (const result of [lowEdge, stairs, groundedStep, groundedBoost, lowMantle, highMantle, randomMantle]) {
  if (JSON.stringify(result.mountedFixtureIds) !== JSON.stringify(expectedMountedIds)) failures.push("simulation did not mount exact page-owned arena records");
}

const ok = failures.length === 0;
console.log(JSON.stringify({
  schema: "qa-observation-v1",
  ok,
  seed,
  tickHz,
  reason: negativeControl && !ok ? `${negativeControl} rejected` : "",
  failures,
  metrics: {
    sharedOwner: "src/product-one-controller.js",
    arenaOwner: "src/controller-kata.js",
    physicsOwner: "src/physics-world.js",
    boxcraftCommit: "b4ff8625a0981ed39eb6d25a6ba88642b974e9b4",
    courseHash: arena.boxcraftCourse.courseHash,
    capabilityProfile: { ...PRODUCT_ONE_CAPABILITY_PROFILE },
    arenaGeometryHash: arena.traversal.geometryHash,
    arenaFixtureIds: fixtures.map((fixture) => fixture.id),
    randomBoxCount: arena.cubes.length,
    randomMantleFixtureId: randomMantleFixture?.id || "",
    lowEdge,
    stairs,
    groundedStep,
    groundedBoost,
    lowMantle,
    highMantle,
    randomMantle,
    impossible,
  },
}));
