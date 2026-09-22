import * as THREE from 'three';
import { ColliderDesc, RigidBodyDesc } from '../vendor/rapier3d/rapier.mjs';

const ACCEPTED_OUTLAW_ASSET = 'https://valar05.github.io/model-viewer-lab/models/outlaw/Outlaw_Complete_Clearance_TEXTURED.glb';
const WHEEL_RADIUS = 0.54;
const WHEELBASE = 3.528;
const MAX_STEER = THREE.MathUtils.degToRad(32);
const MAX_FORWARD_SPEED = 24.6;
const MAX_REVERSE_SPEED = 8.0;
const MIN_ACCEL = 1.2;
const MAX_ACCEL = 6.5;
const BRAKE_ACCEL = 28.0;
const ROLLING_DRAG = 0.45;
const AERO_DRAG = 0.035;
const THROTTLE_RESPONSE = 7.0;
const MIN_STEER_RESPONSE = 0.9;
const MAX_STEER_RESPONSE = 4.2;
const STEER_RETURN_SPEED = 3.2;
const MIN_TURN_SPEED = 0.75;
const DRIFT_THRESHOLD_SPEED = 11.6;
const DRIFT_FULL_SPEED = 18.8;
const DRIFT_SPEED_EXPONENT = 1.7;
const DRIFT_SLIP_STRENGTH = 0.46;
const DRIFT_BUILD_RATE = 7.0;
const DRIFT_RECOVERY_RATE = 3.8;
const DRIFT_TURN_BONUS = 0.30;
const DRIFT_MAX_LATERAL = 5.5;
const DRIFT_ENGAGE_STEER = 0.25;
const DRIFT_HEADING_HOLD_STEER = 0.6;
const DRIFT_HEADING_RECOVERY = 7.0;
const DRIFT_GRIP_RESPONSE = 5.5;
const DRIFT_MIN_GRIP = 0.30;
const GRAVITY = -14.4;
const TURN_LOOK_MAX_YAW = THREE.MathUtils.degToRad(10);
const TURN_LOOK_RESPONSE = 4.8;
const TURN_LOOK_SPEED_EXPONENT = 1.35;
const TURN_ROLL_MAX = THREE.MathUtils.degToRad(6);
const TURN_ROLL_FULL_SPEED = 13.4;
const TURN_ROLL_SPEED_EXPONENT = 2.75;
const TURN_ROLL_BASE_SCALE = 0.33;
const TURN_ROLL_SLIDE_BONUS = 1.2;
const TURN_ROLL_RESPONSE = 5.6;
const COCKPIT_EYE = new THREE.Vector3(0.08, 0.76, 0.38);
const DEBUG_CAMERA_DISTANCE = 7.2;
const DEBUG_CAMERA_HEIGHT = 3.0;
const DEBUG_CAMERA_TARGET_HEIGHT = 0.9;

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

function driftRatio(speed) {
  const speedAbs = Math.abs(speed);
  if (speedAbs <= DRIFT_THRESHOLD_SPEED) return 0;
  const t = THREE.MathUtils.clamp(
    (speedAbs - DRIFT_THRESHOLD_SPEED) / Math.max(0.001, DRIFT_FULL_SPEED - DRIFT_THRESHOLD_SPEED),
    0,
    1,
  );
  return Math.pow(t, DRIFT_SPEED_EXPONENT);
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

function createCockpit() {
  const group = new THREE.Group();
  group.name = 'outlaw-cockpit-interior';
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2222, roughness: 0.88, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x555d60, roughness: 0.54, metalness: 0.58 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x171918, roughness: 0.96, metalness: 0.0 });
  const service = new THREE.MeshStandardMaterial({ color: 0xa85a24, roughness: 0.7, metalness: 0.05 });

  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.30, 1.35), dark);
  dash.name = 'OUTLAW_DASH';
  dash.position.set(-0.53, 0.36, 0);
  group.add(dash);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 1.42), trim);
  brow.name = 'OUTLAW_DASH_BROW';
  brow.position.set(-0.58, 0.54, 0);
  group.add(brow);

  const console = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.26), dark);
  console.name = 'OUTLAW_CENTER_CONSOLE';
  console.position.set(0.02, 0.16, 0);
  group.add(console);

  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.18, 0.62), seat);
  seatBase.name = 'OUTLAW_DRIVER_SEAT_BASE';
  seatBase.position.set(0.34, 0.03, 0.38);
  group.add(seatBase);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.62), seat);
  seatBack.name = 'OUTLAW_DRIVER_SEAT_BACK';
  seatBack.position.set(0.62, 0.40, 0.38);
  seatBack.rotation.z = THREE.MathUtils.degToRad(-7);
  group.add(seatBack);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 10), trim);
  column.name = 'OUTLAW_STEERING_COLUMN';
  column.position.set(-0.30, 0.39, 0.38);
  column.rotation.z = Math.PI * 0.5;
  group.add(column);

  const steeringPivot = new THREE.Group();
  steeringPivot.name = 'OUTLAW_STEERING_WHEEL_PIVOT';
  steeringPivot.position.set(-0.13, 0.51, 0.38);
  steeringPivot.rotation.order = 'YXZ';
  steeringPivot.rotation.y = Math.PI * 0.5;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.024, 10, 28), trim);
  wheel.name = 'OUTLAW_STEERING_WHEEL';
  steeringPivot.add(wheel);
  const spokeA = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.30, 0.024), trim);
  const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.30, 0.024), trim);
  spokeA.rotation.z = Math.PI * 0.33;
  spokeB.rotation.z = -Math.PI * 0.33;
  steeringPivot.add(spokeA, spokeB);
  group.add(steeringPivot);

  const instrument = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.34), service);
  instrument.name = 'OUTLAW_INSTRUMENT_CLUSTER';
  instrument.position.set(-0.65, 0.48, 0.38);
  group.add(instrument);

  return { group, steeringPivot };
}

export async function createOutlawVehicle(options) {
  const {
    parent,
    loader,
    physicsWorld,
    input,
    camera,
    viewState = null,
    spawn = new THREE.Vector3(0, 0.78, 0),
    assetUrl = ACCEPTED_OUTLAW_ASSET,
    cameraMode: initialCameraMode = 'cockpit',
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
  const cockpit = createCockpit();
  wrapper.add(cockpit.group);
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
  let driftAmount = 0;
  let driftDirection = 0;
  let lateralVelocity = 0;
  let turnLookYaw = 0;
  let turnRoll = 0;
  let cameraMode = initialCameraMode === 'debug' ? 'debug' : 'cockpit';
  const driveHeading = new THREE.Vector3(-1, 0, 0);
  const momentumVelocity = new THREE.Vector3();
  const forward = new THREE.Vector3(-1, 0, 0);
  const right = new THREE.Vector3(0, 0, -1);
  const desiredVelocity = new THREE.Vector3();
  const desiredMovement = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cockpitEyeWorld = new THREE.Vector3();
  const cockpitLookLocal = new THREE.Vector3();
  const cockpitUp = new THREE.Vector3(0, 1, 0);
  const wrapperQuaternion = new THREE.Quaternion();
  const rollQuaternion = new THREE.Quaternion();

  if (viewState) {
    viewState.yaw = 0;
    viewState.pitch = 0;
  }

  function updateSteering(safeDt, steerInput) {
    const strength = Math.abs(steerInput);
    if (strength > 0.001) {
      const response = THREE.MathUtils.lerp(MIN_STEER_RESPONSE, MAX_STEER_RESPONSE, strength);
      smoothSteer = moveToward(smoothSteer, steerInput, response * safeDt);
    } else {
      smoothSteer = moveToward(smoothSteer, 0, STEER_RETURN_SPEED * safeDt);
    }
  }

  function updateSpeed(safeDt, throttleInput) {
    smoothThrottle = moveToward(smoothThrottle, throttleInput, THROTTLE_RESPONSE * safeDt);
    const targetSpeed = smoothThrottle >= 0
      ? smoothThrottle * MAX_FORWARD_SPEED
      : smoothThrottle * MAX_REVERSE_SPEED;
    if (Math.abs(smoothThrottle) > 0.001) {
      const changingDirection = Math.abs(speed) > 0.001 && Math.sign(speed) !== Math.sign(targetSpeed);
      if (changingDirection) speed = moveToward(speed, 0, BRAKE_ACCEL * Math.abs(smoothThrottle) * safeDt);
      else {
        const accel = THREE.MathUtils.lerp(MIN_ACCEL, MAX_ACCEL, Math.abs(smoothThrottle));
        speed = moveToward(speed, targetSpeed, accel * safeDt);
      }
    } else {
      const drag = ROLLING_DRAG + speed * speed * AERO_DRAG;
      speed = moveToward(speed, 0, drag * safeDt);
    }
  }

  function updateTurning(safeDt) {
    if (Math.abs(speed) < MIN_TURN_SPEED || Math.abs(smoothSteer) < 0.001) return;
    const steerAngle = MAX_STEER * smoothSteer;
    const directionSign = speed < 0 ? -1 : 1;
    const yawRate = (Math.abs(speed) / WHEELBASE) * Math.tan(steerAngle) * (1 + DRIFT_TURN_BONUS * driftAmount);
    yaw -= yawRate * directionSign * safeDt;
  }

  function updateDrift(safeDt) {
    const ratio = driftRatio(speed);
    const steerFactor = Math.abs(smoothSteer);
    const shouldDrift = ratio > 0.001
      && steerFactor >= DRIFT_ENGAGE_STEER
      && smoothThrottle > 0.02;
    if (Math.abs(speed) < MIN_TURN_SPEED || ratio <= 0.001) {
      driftAmount = moveToward(driftAmount, 0, DRIFT_RECOVERY_RATE * safeDt);
      lateralVelocity = moveToward(lateralVelocity, 0, DRIFT_RECOVERY_RATE * safeDt);
      if (driftAmount <= 0.01) driftDirection = 0;
      return;
    }
    if (shouldDrift) {
      if (driftDirection === 0 || driftAmount <= 0.12 || Math.sign(smoothSteer) !== driftDirection) {
        driftDirection = Math.sign(smoothSteer);
      }
      const target = THREE.MathUtils.clamp(ratio * THREE.MathUtils.lerp(0.6, 1.15, steerFactor), 0, 1);
      driftAmount = moveToward(driftAmount, target, DRIFT_BUILD_RATE * safeDt);
    } else {
      driftAmount = moveToward(driftAmount, 0, DRIFT_RECOVERY_RATE * safeDt);
      if (driftAmount <= 0.01) driftDirection = 0;
    }
    const throttleFactor = THREE.MathUtils.clamp(Math.abs(smoothThrottle), 0.55, 1);
    let targetLateral = -driftDirection * Math.abs(speed) * DRIFT_SLIP_STRENGTH * driftAmount * throttleFactor;
    targetLateral = THREE.MathUtils.clamp(targetLateral, -DRIFT_MAX_LATERAL, DRIFT_MAX_LATERAL);
    const buildRate = THREE.MathUtils.lerp(DRIFT_RECOVERY_RATE, DRIFT_BUILD_RATE, driftAmount);
    lateralVelocity = moveToward(lateralVelocity, driftAmount > 0.001 ? targetLateral : 0, buildRate * safeDt);
  }

  function updateMomentum(safeDt) {
    forward.set(-Math.cos(yaw), 0, Math.sin(yaw));
    right.set(-forward.z, 0, forward.x);
    if (driveHeading.lengthSq() <= 0.001 || Math.abs(speed) < MIN_TURN_SPEED) driveHeading.copy(forward);
    else {
      const steerFactor = Math.abs(smoothSteer);
      const sharpTurn = steerFactor >= DRIFT_HEADING_HOLD_STEER && driftAmount >= 0.08 && smoothThrottle > 0.02;
      let recoveryScale = THREE.MathUtils.lerp(0.35, 1.0, 1.0 - steerFactor);
      if (sharpTurn) recoveryScale *= 0.42;
      if (!sharpTurn || smoothThrottle <= 0.02 || driftAmount <= 0.05) recoveryScale = Math.max(recoveryScale, 1.15);
      const blend = THREE.MathUtils.clamp(DRIFT_HEADING_RECOVERY * recoveryScale * safeDt, 0, 1);
      driveHeading.lerp(forward, blend).normalize();
    }

    desiredVelocity.copy(driveHeading).multiplyScalar(speed).addScaledVector(right, lateralVelocity);
    if (momentumVelocity.lengthSq() <= 0.001 || Math.abs(speed) < MIN_TURN_SPEED) {
      momentumVelocity.copy(desiredVelocity);
      return;
    }
    const ratio = driftRatio(speed);
    if (ratio <= 0.001 && Math.abs(lateralVelocity) <= 0.001) {
      momentumVelocity.copy(desiredVelocity);
      return;
    }
    const steerFactor = Math.abs(smoothSteer);
    const gatedSlip = ratio * steerFactor * DRIFT_SLIP_STRENGTH;
    const slipRatio = THREE.MathUtils.clamp(Math.max(driftAmount, gatedSlip, driftAmount * THREE.MathUtils.lerp(0.8, 1.35, steerFactor)), 0, 1);
    const grip = THREE.MathUtils.lerp(1.0, DRIFT_MIN_GRIP, slipRatio);
    const alignment = THREE.MathUtils.clamp(
      DRIFT_GRIP_RESPONSE * grip * THREE.MathUtils.lerp(0.55, 0.10, steerFactor) * safeDt,
      0,
      1,
    );
    momentumVelocity.lerp(desiredVelocity, alignment);
  }

  function updateTurnCamera(safeDt) {
    const speedRatio = THREE.MathUtils.clamp(Math.abs(speed) / MAX_FORWARD_SPEED, 0, 1);
    const yawScale = Math.pow(speedRatio, TURN_LOOK_SPEED_EXPONENT);
    const targetYaw = -smoothSteer * TURN_LOOK_MAX_YAW * yawScale;
    turnLookYaw += (targetYaw - turnLookYaw) * (1 - Math.exp(-TURN_LOOK_RESPONSE * safeDt));

    const rollSpeedRatio = THREE.MathUtils.clamp(Math.abs(speed) / TURN_ROLL_FULL_SPEED, 0, 1);
    const rollScale = TURN_ROLL_BASE_SCALE + Math.pow(rollSpeedRatio, TURN_ROLL_SPEED_EXPONENT) * (1 - TURN_ROLL_BASE_SCALE);
    const slideScale = 1 + driftAmount * TURN_ROLL_SLIDE_BONUS;
    const targetRoll = -smoothSteer * TURN_ROLL_MAX * rollScale * slideScale;
    turnRoll += (targetRoll - turnRoll) * (1 - Math.exp(-TURN_ROLL_RESPONSE * safeDt));
  }

  function updateCamera(safeDt) {
    if (cameraMode === 'debug') {
      cameraTarget.copy(wrapper.position).setY(wrapper.position.y + DEBUG_CAMERA_TARGET_HEIGHT);
      cameraDesired.copy(cameraTarget).addScaledVector(forward, -DEBUG_CAMERA_DISTANCE).addScaledVector(cockpitUp, DEBUG_CAMERA_HEIGHT);
      camera.position.lerp(cameraDesired, 1 - Math.exp(-5.8 * safeDt));
      camera.up.set(0, 1, 0);
      camera.lookAt(cameraTarget);
      return;
    }

    cockpitEyeWorld.copy(COCKPIT_EYE);
    wrapper.localToWorld(cockpitEyeWorld);
    camera.position.copy(cockpitEyeWorld);
    const lookYaw = finite(viewState?.yaw) + turnLookYaw;
    const lookPitch = finite(viewState?.pitch);
    cockpitLookLocal.set(-Math.cos(lookYaw), Math.sin(lookPitch), Math.sin(lookYaw) * Math.cos(lookPitch)).normalize();
    wrapper.getWorldQuaternion(wrapperQuaternion);
    cameraForward.copy(cockpitLookLocal).applyQuaternion(wrapperQuaternion).normalize();
    cockpitUp.set(0, 1, 0).applyQuaternion(wrapperQuaternion).normalize();
    rollQuaternion.setFromAxisAngle(cameraForward, turnRoll);
    cockpitUp.applyQuaternion(rollQuaternion).normalize();
    camera.up.copy(cockpitUp);
    camera.lookAt(camera.position.clone().add(cameraForward));
  }

  function toggleCamera() {
    cameraMode = cameraMode === 'cockpit' ? 'debug' : 'cockpit';
    setStatus(cameraMode === 'cockpit' ? 'Outlaw cockpit view' : 'Outlaw wheel debug view');
    return cameraMode;
  }

  function snapshot() {
    const p = body.translation();
    return {
      ready: true,
      authority: 'after-clearance-accepted',
      handlingDonor: 'Valar05/long-haul',
      cameraMode,
      cockpitAndExteriorSameScene: true,
      assetUrl,
      position: [finite(p.x), finite(p.y), finite(p.z)],
      speed,
      throttle: smoothThrottle,
      steering: smoothSteer,
      yaw,
      grounded,
      driftAmount,
      lateralVelocity,
      wheelSpin,
      wheelRadius: WHEEL_RADIUS,
      wheelbase: WHEELBASE,
      wheelNodes: Object.values(WHEEL_PARTS).flat(),
    };
  }

  function update(dt) {
    const safeDt = Math.min(0.05, Math.max(0, finite(dt)));
    const throttleInput = THREE.MathUtils.clamp(finite(input.moveY), -1, 1);
    const steerInput = THREE.MathUtils.clamp(finite(input.moveX), -1, 1);
    updateSpeed(safeDt, throttleInput);
    updateSteering(safeDt, steerInput);
    updateTurning(safeDt);
    updateDrift(safeDt);
    updateMomentum(safeDt);
    updateTurnCamera(safeDt);

    verticalVelocity += GRAVITY * safeDt;
    desiredMovement.copy(momentumVelocity).multiplyScalar(safeDt);
    desiredMovement.y = verticalVelocity * safeDt;
    controller.computeColliderMovement(collider, desiredMovement);
    const movement = controller.computedMovement();
    grounded = controller.computedGrounded();
    if (grounded && verticalVelocity < 0) verticalVelocity = 0;

    const p = body.translation();
    body.setNextKinematicTranslation({ x: p.x + movement.x, y: p.y + movement.y, z: p.z + movement.z });
    physicsWorld.world.step();
    const next = body.translation();
    wrapper.position.set(next.x, next.y, next.z);
    wrapper.rotation.y = yaw;
    wrapper.updateMatrixWorld(true);

    wheelSpin += (speed / WHEEL_RADIUS) * safeDt;
    applyWheelPose(wheelRig, smoothSteer * MAX_STEER, wheelSpin);
    cockpit.steeringPivot.rotation.x = -smoothSteer * THREE.MathUtils.degToRad(300);
    updateCamera(safeDt);
    window.__outlawVehicle = snapshot();
  }

  function dispose() {
    parent.remove(wrapper);
    physicsWorld.world.removeCharacterController(controller);
    if (window.__outlawVehicle) delete window.__outlawVehicle;
  }

  setStatus('Outlaw cockpit drive ready');
  window.__outlawVehicle = snapshot();
  return { update, dispose, snapshot, toggleCamera, wrapper, body };
}

export const OUTLAW_VEHICLE_CONTRACT = Object.freeze({
  asset: ACCEPTED_OUTLAW_ASSET,
  authority: 'after-clearance-accepted',
  handlingDonor: 'Valar05/long-haul',
  camera: 'world-space cockpit with exterior retained',
  wheelRadius: WHEEL_RADIUS,
  wheelbase: WHEELBASE,
  wheelParts: WHEEL_PARTS,
});
