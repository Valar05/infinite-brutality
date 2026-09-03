import { ColliderDesc, RigidBodyDesc, World, init as initRapier } from '../vendor/rapier3d/rapier.mjs';

let rapierReady = null;

export async function ensurePhysicsReady() {
  if (!rapierReady) rapierReady = initRapier({});
  await rapierReady;
  return true;
}

function yawQuaternion(yaw = 0) {
  const half = yaw * 0.5;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

function toUint32Indices(indices) {
  if (indices instanceof Uint32Array) return indices;
  return new Uint32Array(indices || []);
}

function toFloat32Positions(positions) {
  if (positions instanceof Float32Array) return positions;
  return new Float32Array(positions || []);
}

function vectorRecord(value) {
  if (!value) return null;
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
  };
}

export function createPhysicsWorld(options = {}) {
  const gravity = options.gravity || { x: 0, y: -14.4, z: 0 };
  const world = new World(gravity);
  world.timestep = 1 / 60;
  const controller = world.createCharacterController(options.characterOffset ?? 0.035);
  controller.setSlideEnabled(true);
  controller.enableAutostep(options.autostepHeight ?? 0.62, options.autostepMinWidth ?? 0.36, false);
  controller.enableSnapToGround(options.snapToGround ?? 0.42);
  controller.setMaxSlopeClimbAngle(options.maxSlopeClimbAngle ?? Math.PI * 0.34);
  controller.setMinSlopeSlideAngle(options.minSlopeSlideAngle ?? Math.PI * 0.44);

  const staticColliders = [];
  const colliderRecords = [];
  const colliderKinds = {};
  let playerBody = null;
  let playerCollider = null;
  let playerEyeOffset = 0.59;
  let lastStepMs = 0;
  let lastMoveMs = 0;
  let lastContactCount = 0;
  let lastGrounded = false;
  let lastCollisions = [];
  let collidersDirty = false;

  const registerCollider = (collider, source, kind, record = {}) => {
    const cleanSource = String(source || '');
    const cleanKind = String(kind || 'unknown');
    collider.userData = { source: cleanSource, kind: cleanKind };
    staticColliders.push(collider);
    colliderRecords.push({
      type: record.type || 'unknown',
      source: cleanSource,
      kind: cleanKind,
      ownerless: !cleanSource,
      size: record.size ? [...record.size] : null,
      position: record.position ? [...record.position] : null,
      origin: record.origin ? [...record.origin] : null,
      yaw: record.yaw || 0,
    });
    colliderKinds[cleanKind] = (colliderKinds[cleanKind] || 0) + 1;
    collidersDirty = true;
    return collider;
  };

  const addTerrainMesh = ({ meshData, origin = [0, 0, 0], yaw = 0, source = '', kind = 'terrain' }) => {
    if (!meshData?.positions?.length || !meshData?.indices?.length) return null;
    const desc = ColliderDesc.trimesh(toFloat32Positions(meshData.positions), toUint32Indices(meshData.indices))
      .setTranslation(origin[0], origin[1], origin[2])
      .setRotation(yawQuaternion(yaw))
      .setFriction(0.86)
      .setRestitution(0);
    return registerCollider(world.createCollider(desc), source, kind, {
      type: 'terrainMesh',
      origin,
      yaw,
    });
  };

  const addCuboid = ({ size, position, yaw = 0, source = '', kind = 'solid' }) => {
    if (!size || !position) return null;
    const desc = ColliderDesc.cuboid(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5)
      .setTranslation(position[0], position[1], position[2])
      .setRotation(yawQuaternion(yaw))
      .setFriction(0.9)
      .setRestitution(0);
    return registerCollider(world.createCollider(desc), source, kind, {
      type: 'cuboid',
      size,
      position,
      yaw,
    });
  };

  const ensurePlayer = ({ eyePosition, eyeHeight, radius }) => {
    const minY = eyePosition.y - eyeHeight + 0.15;
    const maxY = eyePosition.y + 0.35;
    const bodyHeight = Math.max(radius * 2 + 0.2, maxY - minY);
    const capsuleHalfHeight = Math.max(0.12, (bodyHeight - radius * 2) * 0.5);
    playerEyeOffset = eyePosition.y - ((minY + maxY) * 0.5);
    const center = { x: eyePosition.x, y: eyePosition.y - playerEyeOffset, z: eyePosition.z };
    if (playerBody && playerCollider) {
      playerBody.setTranslation(center, true);
      return;
    }
    playerBody = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z));
    playerCollider = world.createCollider(ColliderDesc.capsule(capsuleHalfHeight, radius).setFriction(0).setRestitution(0), playerBody);
  };

  const movePlayer = ({ eyePosition, desiredDelta, eyeHeight, radius }) => {
    ensurePlayer({ eyePosition, eyeHeight, radius });
    if (collidersDirty) {
      const syncStart = performance.now();
      world.step();
      lastStepMs = performance.now() - syncStart;
      collidersDirty = false;
    }
    const center = { x: eyePosition.x, y: eyePosition.y - playerEyeOffset, z: eyePosition.z };
    playerBody.setTranslation(center, true);
    const moveStart = performance.now();
    controller.computeColliderMovement(playerCollider, desiredDelta);
    const computed = controller.computedMovement();
    lastMoveMs = performance.now() - moveStart;
    lastContactCount = controller.numComputedCollisions();
    lastGrounded = controller.computedGrounded();
    lastCollisions = [];
    for (let i = 0; i < lastContactCount; i += 1) {
      const collision = controller.computedCollision(i);
      if (!collision) continue;
      const normal = vectorRecord(collision.normal1);
      const point = vectorRecord(collision.witness2 || collision.witness1);
      const horizontalLength = normal ? Math.hypot(normal.x, normal.z) : 0;
      const collider = collision.collider || null;
      const userData = collider?.userData || {};
      lastCollisions.push({
        source: userData.source || '',
        kind: userData.kind || 'unknown',
        normal,
        point,
        toi: Number(collision.toi) || 0,
        isWall: !!normal && Math.abs(normal.y) < 0.55 && horizontalLength > 0.35,
        isGround: !!normal && normal.y > 0.55,
      });
    }
    const nextCenter = {
      x: center.x + computed.x,
      y: center.y + computed.y,
      z: center.z + computed.z,
    };
    playerBody.setNextKinematicTranslation(nextCenter);
    const stepStart = performance.now();
    world.step();
    lastStepMs = performance.now() - stepStart;
    const actual = playerBody.translation();
    return {
      eyePosition: {
        x: actual.x,
        y: actual.y + playerEyeOffset,
        z: actual.z,
      },
      movement: computed,
      grounded: lastGrounded,
      contactCount: lastContactCount,
      collisions: lastCollisions.map((collision) => ({ ...collision })),
      moveMs: lastMoveMs,
      stepMs: lastStepMs,
    };
  };


  const cuboidContainsXZ = (record, x, z, radius = 0) => {
    if (record?.type !== 'cuboid' || !record.size || !record.position) return false;
    const yaw = -(record.yaw || 0);
    const dx = x - record.position[0];
    const dz = z - record.position[2];
    const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    return Math.abs(localX) <= record.size[0] * 0.5 - radius
      && Math.abs(localZ) <= record.size[2] * 0.5 - radius;
  };

  const findCuboidTopSupport = ({ x, z, targetTopY, radius = 0.38, source = '', tolerance = 0.08 }) => {
    let best = null;
    for (const record of colliderRecords) {
      if (record.type !== 'cuboid' || (source && record.source !== source)) continue;
      if (!cuboidContainsXZ(record, x, z, radius)) continue;
      const topY = record.position[1] + record.size[1] * 0.5;
      if (Math.abs(topY - targetTopY) > tolerance) continue;
      if (!best || topY > best.topY) best = { topY, source: record.source, kind: record.kind };
    }
    return best;
  };

  const isCapsuleClearAt = ({ x, z, eyeY, eyeHeight, radius = 0.38 }) => {
    const minY = eyeY - eyeHeight + 0.15;
    const maxY = eyeY + 0.35;
    for (const record of colliderRecords) {
      if (record.type !== 'cuboid' || !record.size || !record.position) continue;
      const recordMinY = record.position[1] - record.size[1] * 0.5;
      const recordMaxY = record.position[1] + record.size[1] * 0.5;
      if (maxY < recordMinY || minY > recordMaxY) continue;
      if (cuboidContainsXZ(record, x, z, -radius)) return false;
    }
    return true;
  };

  const snapshot = () => {
    const ownerless = colliderRecords.filter((record) => record.ownerless);
    return {
      ready: true,
      colliderCount: staticColliders.length,
      colliderKinds: { ...colliderKinds },
      ownerlessColliderCount: ownerless.length,
      terrainMeshColliderCount: colliderRecords.filter((record) => record.type === 'terrainMesh').length,
      cuboidColliderCount: colliderRecords.filter((record) => record.type === 'cuboid').length,
      colliders: colliderRecords.map((record) => ({ ...record })),
      ownerlessColliders: ownerless.map((record) => ({ ...record })),
      contactCount: lastContactCount,
      collisions: lastCollisions.map((collision) => ({ ...collision })),
      grounded: lastGrounded,
      moveMs: lastMoveMs,
      stepMs: lastStepMs,
    };
  };

  const dispose = () => {
    world.removeCharacterController(controller);
    playerBody = null;
    playerCollider = null;
    staticColliders.length = 0;
    colliderRecords.length = 0;
    for (const key of Object.keys(colliderKinds)) delete colliderKinds[key];
    world.free?.();
  };

  return {
    world,
    addTerrainMesh,
    addCuboid,
    movePlayer,
    findCuboidTopSupport,
    isCapsuleClearAt,
    snapshot,
    dispose,
  };
}
