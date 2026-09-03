import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPhysicsWorld, ensurePhysicsReady } from '../src/physics-world.js';

const physicsSource = fs.readFileSync(new URL('../src/physics-world.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(physicsSource, /from '\.\.\/vendor\/rapier3d\/rapier\.mjs'/, 'physics world must use vendored Rapier');
assert.match(physicsSource, /createCharacterController/, 'physics world must use Rapier kinematic character controller');
assert.match(physicsSource, /ColliderDesc\.trimesh/, 'physics world must support static mesh terrain colliders');
assert.match(physicsSource, /ColliderDesc\.cuboid/, 'physics world must support static building colliders');
assert.match(physicsSource, /controller\.computedCollision\(i\)/, 'physics world must expose Rapier character collision records');
assert.match(physicsSource, /const normal = vectorRecord\(collision\.normal1\)/, 'physics collision records must include wall normals for freeform climbing');
assert.match(physicsSource, /isWall: !!normal && Math\.abs\(normal\.y\) < 0\.55/, 'physics collision records must classify near-vertical wall contacts');
assert.match(physicsSource, /colliderRecords/, 'physics world must retain collider records for collision truth diagnostics');
assert.match(physicsSource, /ownerlessColliderCount/, 'physics snapshot must expose ownerless collider counts');
assert.match(mainSource, /physicsReady/, 'visual QA must report physics readiness');
assert.match(mainSource, /physicsStepMs/, 'visual QA must report physics step timing');
assert.match(mainSource, /window\.__ibCollisionTruth/, 'browser QA must expose collision truth diagnostics');

await ensurePhysicsReady();
const physics = createPhysicsWorld({ gravity: { x: 0, y: -14.4, z: 0 } });
physics.addCuboid({
  size: [12, 1, 12],
  position: [0, -0.5, 0],
  source: 'test-floor',
  kind: 'walkable',
});
physics.addCuboid({ size: [2, 2, 2], position: [4, 1, 0], source: 'test-solid', kind: 'solid' });
physics.addTerrainMesh({ meshData: { positions: [-1, 0, -1, 1, 0, -1, 0, 0, 1], indices: [0, 1, 2] }, source: 'test-terrain', kind: 'terrain' });
const walkable = physics.getWalkableCuboid('test-floor');
assert.deepEqual(walkable, { source: 'test-floor', kind: 'walkable', center: [0, -0.5, 0], position: [0, -0.5, 0], size: [12, 1, 12], topY: 0, yaw: 0 });
walkable.center[0] = 999;
walkable.size[0] = 999;
assert.deepEqual(physics.getWalkableCuboid('test-floor').center, [0, -0.5, 0], 'walkable lookup must return a safe copy');
assert.equal(physics.getWalkableCuboid('test-solid'), null, 'non-walkable cuboids must reject');
assert.equal(physics.getWalkableCuboid('test-terrain'), null, 'terrain meshes must reject');
assert.equal(physics.getWalkableCuboid('missing'), null, 'unknown sources must reject');

const result = physics.movePlayer({
  eyePosition: { x: 0, y: 1.68, z: 0 },
  desiredDelta: { x: 0, y: -1.4, z: 0 },
  eyeHeight: 1.68,
  radius: 0.38,
});

assert.equal(result.grounded, true, 'player capsule should ground on a Rapier cuboid floor');
assert.ok(result.eyePosition.y >= 1.5, 'player eye should remain above the floor');
const snapshot = physics.snapshot();
assert.ok(snapshot.colliderCount >= 1, 'physics world must count registered static colliders');
assert.ok(Array.isArray(snapshot.collisions), 'physics snapshot must expose recent player collision records');
assert.equal(snapshot.ownerlessColliderCount, 0, 'named test collider should not be ownerless');
assert.equal(snapshot.cuboidColliderCount, 2, 'walkable and solid test cuboids should be tracked');
assert.equal(snapshot.terrainMeshColliderCount, 1, 'terrain test collider should be tracked without becoming mantleable');
physics.dispose();

console.log(JSON.stringify({ ok: true, contract: 'physics-world-rapier', result }));
