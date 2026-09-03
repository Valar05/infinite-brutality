import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { advanceConstrainedMantle } from '../src/player-climb.js';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const simulatorPath = fileURLToPath(new URL('./qa_product_one_controller_simulator.mjs', import.meta.url));
const observation = JSON.parse(execFileSync(process.execPath, [
  '--no-warnings',
  simulatorPath,
  '--seed',
  'controller-proof',
  '--tick-hz',
  '60',
], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim());

assert.equal(observation.schema, 'qa-observation-v1');
assert.equal(observation.ok, true, observation.failures?.join('; '));
const metrics = observation.metrics;
assert.equal(metrics.sharedOwner, 'src/product-one-controller.js');
assert.equal(metrics.arenaOwner, 'src/controller-kata.js');
assert.equal(metrics.physicsOwner, 'src/physics-world.js');
assert.equal(metrics.courseHash, 'b4fbadc14e0b5be04285e02a21e361a5666d917b989bb99753b379f2cdfff969');
assert.equal(metrics.highMantle.topY > metrics.capabilityProfile.eyeHeight, true);
for (const label of ['lowMantle', 'highMantle', 'randomMantle']) {
  const result = metrics[label];
  assert.deepEqual(result.sequence, ['ground', 'air', 'mantle', 'ground'], label);
  assert.equal(result.realSharedJump, true, label);
  assert.equal(result.sharedPhysicsContact, true, label);
  assert.equal(result.contactSource, result.fixtureId, label);
  assert.equal(result.finalGrounded, true, label);
  assert.deepEqual(result.completionVelocity, [0, 0, 0], label);
  assert.equal(result.climbEntries, 0, label);
}
assert.equal(metrics.groundedBoost.mantleStarts, 0);
assert.equal(metrics.groundedBoost.groundBoost, false);
assert.equal(metrics.impossible.rejected, true);
assert.equal(metrics.randomMantle.fixtureId, metrics.randomMantleFixtureId);
assert.ok(metrics.randomMantle.fixtureId.startsWith('cube-'));

const plan = {
  start: [0, 2.1, -1],
  end: [0, 3.455, 0],
  elapsed: 0,
  duration: 0.34,
};
let frame = null;
for (let step = 0; step < 60 && !frame?.complete; step += 1) {
  frame = advanceConstrainedMantle({ ...plan, elapsed: frame?.elapsed || 0 }, 1 / 60);
  assert.deepEqual(frame.velocity, [0, 0, 0], 'shared mantle interpolation must not grant launch velocity');
}
assert.equal(frame?.complete, true);
assert.deepEqual(frame.position, plan.end);
assert.equal(frame.grounded, true);

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const climbSource = fs.readFileSync(new URL('../src/player-climb.js', import.meta.url), 'utf8');
const controllerSource = fs.readFileSync(new URL('../src/product-one-controller.js', import.meta.url), 'utf8');
assert.match(mainSource, /createProductOneController/, 'authoritative runtime must use the shared Product One controller');
assert.equal((mainSource.match(/if \(!useControllerKataSlice\(\) && tryBeginClimb/g) || []).length, 2, 'Product One must bypass both full-game CLIMB entry paths');
assert.match(controllerSource, /physicsWorld\.getWalkableCuboid\(contact\.source\)/, 'mantle candidates must resolve actual Rapier collider sources');
assert.match(controllerSource, /type: 'jump-commit'/, 'mantle arming must originate in the shared jump input path');
assert.match(controllerSource, /createProductOneInputAdapter/, 'controller must construct the shipped input adapter');
assert.doesNotMatch(controllerSource, /^\s+queueJump,$/m, 'direct queue bypass must not be public');
assert.match(controllerSource, /if \(jumpArmed\)/, 'generic mantle planning must require a committed jump');
assert.match(controllerSource, /velocityY: player\.velocity\.y/, 'planner must observe still-rising velocity');
assert.match(controllerSource, /localeCompare\(right\.fixture\.source\)/, 'candidate selection must be deterministic by source after contact time and reach');
assert.doesNotMatch(controllerSource, /options\.fixture|directMantle/, 'Product One must not privilege an authored fixture');
assert.match(controllerSource, /Product One entered forbidden CLIMB state/, 'Product One must fail closed on CLIMB');
assert.match(climbSource, /export function createBoundedContactMantlePlan/, 'constrained planning must remain with the original climb owner');
assert.match(climbSource, /export function advanceConstrainedMantle/, 'mantle interpolation must remain with the original climb owner');

console.log(JSON.stringify({
  ok: true,
  contract: 'product-one-generic-constrained-mantle',
  courseHash: metrics.courseHash,
  fixtures: {
    low: metrics.lowMantle.fixtureId,
    high: metrics.highMantle.fixtureId,
    random: metrics.randomMantle.fixtureId,
    impossible: metrics.impossible.fixtureId,
  },
  sequences: {
    low: metrics.lowMantle.sequence,
    high: metrics.highMantle.sequence,
    random: metrics.randomMantle.sequence,
  },
}));
