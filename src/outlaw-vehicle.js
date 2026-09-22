import * as THREE from 'three';
import { ColliderDesc, RigidBodyDesc } from '../vendor/rapier3d/rapier.mjs';

const ACCEPTED_OUTLAW_ASSET = './assets/vehicles/outlaw/Outlaw_Complete_Clearance_TEXTURED.glb';
const WHEEL_RADIUS = 0.54;
const MAX_STEER = THREE.MathUtils.degToRad(28);
const MAX_FORWARD_SPEED = 15.5;
const MAX_REVERSE_SPEED = 6.5;
const FORWARD_ACCEL = 7.8;
const REVERSE_ACCEL = 5.2;
const BRAKE_ACCEL = 11.5;
const COAST_DECEL = 3.3;
const MAX_YAW_RATE = 1.34;
const GRAVITY = -14.4;
const CAMERA_DISTANCE = 7.2;
const CAMERA_HEIGHT = 3.0;
const CAMERA_TARGET_HEIGHT = 0.9;

const WHEEL_PARTS = {
  FL: ['WHEEL_FL', 'RIM_FL', 'HUB_FL'],
  FR: ['WHEEL_FR', 'RIM_FR', 'HUB_FR'],
  RL: ['WHEEL_RL', 'RIM_RL', 'HUB_RL'],
  RR: ['WHEEL_RR', 'RIM_RR', 'HUB_RR'],
};

function loadGlb(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function moveToward(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  if (value > target) return Math.max(target, value - maxDelta);
  return value;
}

function collectWheelRig(model) {
  const rig = {};
  for (const [corner, names] of Object.entries(WHEEL_PARTS)) {
    const nodes = names.map((name) => model.getObjectByName(name)).filter(Boolean);
    if (nodes.length !== names.length) throw new Error(`Outlaw wheel rig missing ${corner}: expected ${names.join(', ')}`);
    rig[corner] = nodes.map((node) => ({ node, baseQuaternion: node.quaternion.clone() }));
  }
  return rig;
}

function applyWheelPose(rig, steeringAngle, spinAngle) {
  const sourceVertical = new THREE.Vector3(0, 0, 1);
  const steer = new THREE.Quaternion().setFromAxisAngle(sourceVertical, steeringAngle);
  const spin = new THREE.Quaternion().setFromAxisAngle(sourceVertical, spinAngle);
  for (const [corner, records] of Object.entries(rig)) {
    const front = corner === 'FL' || corner === 'FR';
    for (const record of records) {
      const q = record.baseQuaternion.clone().multiply(spin);
      record.node.quaternion.copy(front ? steer.clone().multiply(q) : q);
    }
  }
}

export async function createOutlawVehicle(options) {
  const {
    parent,
    loader,
    physicsWorld,
    input,
    camera,
    spawn = new THREE.Vector3(0, 0.78, 0),
    assetUrl = ACCEPTED_OUTLAW_ASSET,
    setStatus = () => {},
  } = options || {};
  if (!parent || !loader || !physicsWorld?.world || !input || !camera) {
    throw new Error('Outlaw vehicle requires parent, loader, physicsWorld, input, and camera');
  }

  const gltf = await loadGlb(loader, assetUrl);
  const wrapper = new THREE.Group();
  wrapper.name = 'outlaw-accepted-vehicle';
  const model = gltf.scene;
  model.name = 'outlaw-accepted-model';
  model.rotation.x = -Math.PI * 0.5;
  model.position.y = -0.78;
  wrapper.add(model);
  parent.add(wrapper);
  model.updateMatrixWorld(true);
  const wheelRig = collectWheelRig(model);

  const body = physicsWorld.world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
  );
  const collider = physicsWorld.world.createCollider(
    ColliderDesc.cuboid(2.35, 0.60, 0.96)
      .setTranslation(0, -0.18, 0)
      .setFriction(1.0)
      .setRestitution(0),
    body,
  );
  const controller = physicsWorld.world.createCharacterController(0.045);
  controller.setSlideEnabled(true);
  controller.enableAutostep(0.34, 0.28, false);
  controller.enableSnapToGround(0.34);
  controller.setMaxSlopeClimbAngle(Math.PI * 0.24);
  controller.setMinSlopeSlideAngle(Math.PI * 0.40);

  let smoothThrottle = 0;
  let smoothSteer = 0;
  let speed = 0;
  let yaw = 0;
  let verticalVelocity = 0;
  let wheelSpin = 0;
  let grounded = false;
  const forward = new THREE.Vector3(-1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const desired = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();

  function snapshot() {
    const p = body.translation();
    return {
      ready: true,
      authority: 'after-clearance-accepted',
      assetUrl,
      position: [finite(p.x), finite(p.y), finite(p.z)],
      speed,
      throttle: smoothThrottle,
      steering: smoothSteer,
      yaw,
      grounded,
      wheelSpin,
      wheelRadius: WHEEL_RADIUS,
      wheelNodes: Object.values(WHEEL_PARTS).flat(),
    };
  }

  function update(dt) {
    const safeDt = Math.min(0.05, Math.max(0, finite(dt)));
    const throttleInput = THREE.MathUtils.clamp(finite(input.moveY), -1, 1);
    const steerInput = THREE.MathUtils.clamp(finite(input.moveX), -1, 1);
    const throttleBlend = 1 - Math.exp(-7.5 * safeDt);
    const steerBlend = 1 - Math.exp(-9.5 * safeDt);
    smoothThrottle += (throttleInput - smoothThrottle) * throttleBlend;
    smoothSteer += (steerInput - smoothSteer) * steerBlend;

    const targetSpeed = smoothThrottle >= 0
      ? smoothThrottle * MAX_FORWARD_SPEED
      : smoothThrottle * MAX_REVERSE_SPEED;
    let accel = smoothThrottle === 0 ? COAST_DECEL : (smoothThrottle > 0 ? FORWARD_ACCEL : REVERSE_ACCEL);
    if (speed !== 0 && targetSpeed !== 0 && Math.sign(speed) !== Math.sign(targetSpeed)) accel = BRAKE_ACCEL;
    if (Math.abs(smoothThrottle) < 0.025) speed = moveToward(speed, 0, COAST_DECEL * safeDt);
    else speed = moveToward(speed, targetSpeed, accel * safeDt);

    const speedRatio = THREE.MathUtils.clamp(Math.abs(speed) / 4.5, 0, 1);
    const directionSign = speed < -0.05 ? -1 : 1;
    yaw += -smoothSteer * MAX_YAW_RATE * speedRatio * directionSign * safeDt;
    forward.set(-Math.cos(yaw), 0, Math.sin(yaw));

    verticalVelocity += GRAVITY * safeDt;
    desired.copy(forward).multiplyScalar(speed * safeDt);
    desired.y = verticalVelocity * safeDt;
    controller.computeColliderMovement(collider, desired);
    const movement = controller.computedMovement();
    grounded = controller.computedGrounded();
    if (grounded && verticalVelocity < 0) verticalVelocity = 0;

    const p = body.translation();
    body.setNextKinematicTranslation({ x: p.x + movement.x, y: p.y + movement.y, z: p.z + movement.z });
    physicsWorld.world.step();
    const next = body.translation();
    wrapper.position.set(next.x, next.y, next.z);
    wrapper.rotation.y = yaw;

    wheelSpin += (speed / WHEEL_RADIUS) * safeDt;
    applyWheelPose(wheelRig, smoothSteer * MAX_STEER, wheelSpin);

    cameraTarget.copy(wrapper.position).addScaledVector(up, CAMERA_TARGET_HEIGHT);
    cameraDesired.copy(cameraTarget).addScaledVector(forward, -CAMERA_DISTANCE).addScaledVector(up, CAMERA_HEIGHT);
    camera.position.lerp(cameraDesired, 1 - Math.exp(-5.8 * safeDt));
    camera.lookAt(cameraTarget);
    window.__outlawVehicle = snapshot();
  }

  function dispose() {
    parent.remove(wrapper);
    physicsWorld.world.removeCharacterController(controller);
    if (window.__outlawVehicle) delete window.__outlawVehicle;
  }

  setStatus('Outlaw drive proof ready');
  window.__outlawVehicle = snapshot();
  return { update, dispose, snapshot, wrapper, body };
}

export const OUTLAW_VEHICLE_CONTRACT = Object.freeze({
  asset: ACCEPTED_OUTLAW_ASSET,
  authority: 'after-clearance-accepted',
  wheelRadius: WHEEL_RADIUS,
  wheelParts: WHEEL_PARTS,
});
