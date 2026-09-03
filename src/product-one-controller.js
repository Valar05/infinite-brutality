import * as THREE from '../vendor/three/build/three.module.js';
import { advanceConstrainedMantle, createBoundedContactMantlePlan } from './player-climb.js';
import { createProductOneInputAdapter } from './product-one-input-adapter.js?v=0.8.222';

// Product One owner boundary: raw movement/jump input enters here; this module owns
// its fixed-tick motor and Rapier contact-to-mantle transition. main.js owns DOM,
// audio, rendering, and HUD instrumentation; player-climb.js owns mantle geometry.
export const PRODUCT_ONE_FIXED_DT = 1 / 60;
export const PRODUCT_ONE_CAPABILITY_PROFILE = Object.freeze({
  id: 'product-one',
  eyeHeight: 1.68,
  radius: 0.38,
  autostepHeight: 0.62,
  jumpSpeed: 7.1,
  gravity: 14.4,
  mantleMinFeetToLip: 0.2,
  mantleMaxFeetToLip: 1.0,
  mantleForward: 0.48,
});
export const PRODUCT_ONE_PHYSICS_OPTIONS = Object.freeze({
  gravity: Object.freeze({ x: 0, y: -PRODUCT_ONE_CAPABILITY_PROFILE.gravity, z: 0 }),
  characterOffset: 0.035,
  playerFootInset: 0,
  autostepHeight: PRODUCT_ONE_CAPABILITY_PROFILE.autostepHeight,
  autostepMinWidth: 0.646,
  snapToGround: 0.48,
});

const EYE_HEIGHT = PRODUCT_ONE_CAPABILITY_PROFILE.eyeHeight;
const RADIUS = PRODUCT_ONE_CAPABILITY_PROFILE.radius;
const JUMP_SPEED = PRODUCT_ONE_CAPABILITY_PROFILE.jumpSpeed;
const RUN_JUMP_VERTICAL_BOOST = 0.5;
const RUN_JUMP_FORCE = 0.75;
const RUN_JUMP_HORIZONTAL_BOOST = 4.45;
const GROUND_ACCEL = 28;
const GROUND_FRICTION = 13.5;
const GROUND_WISH_SPEED = 5.2;
const RUN_WISH_SPEED = 8.8;
const RUN_BUILD_TIME = 1;
const AIR_CRUISE_SPEED = 6.2;
const AIR_MAX_SPEED = 8.8;
const AIR_TURN_ACCEL = 14;
const AIR_BRAKE_ACCEL = 19.5;
const AIR_DRAG = 3.4;
const MANTLE_FORWARD = PRODUCT_ONE_CAPABILITY_PROFILE.mantleForward;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeProductOneInput(value = {}) {
  let moveX = clamp(finite(value.moveX), -1, 1);
  let moveY = clamp(finite(value.moveY), -1, 1);
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  return { moveX, moveY };
}

export function createProductOneController(options = {}) {
  const player = options.player;
  const physicsWorld = options.physicsWorld;
  const forwardForYaw = options.forwardForYaw;
  const rightForYaw = options.rightForYaw;
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  if (!player?.position?.isVector3 || !player?.velocity?.isVector3) {
    throw new TypeError('Product One controller requires the shared player vectors');
  }
  if (!physicsWorld?.movePlayer || !physicsWorld?.getWalkableCuboid) throw new TypeError('Product One controller requires shared movement and walkable-cuboid lookup');
  if (typeof forwardForYaw !== 'function' || typeof rightForYaw !== 'function') {
    throw new TypeError('Product One controller requires runtime facing owners');
  }

  let accumulator = 0;
  let jumpQueued = false;
  let jumpArmed = false;
  let smoothMoveX = 0;
  let smoothMoveY = 0;
  let tick = 0;
  const trace = [];

  const emit = (event) => {
    const record = { tick, ...event };
    trace.push(record);
    if (trace.length > 512) trace.shift();
    onEvent(record);
  };

  const queueJump = () => {
    jumpQueued = true;
    return true;
  };

  const commitQueuedJump = (input) => {
    if (!jumpQueued) return false;
    jumpQueued = false;
    if (!player.grounded || player.mode === 'climb' || player.mode === 'mantle') {
      emit({ type: 'jump-rejected', grounded: Boolean(player.grounded), mode: player.mode });
      return false;
    }
    const forward = forwardForYaw(player.yaw).clone().normalize();
    const right = rightForYaw(player.yaw).clone().normalize();
    const moveBlend = new THREE.Vector3()
      .addScaledVector(forward, input.moveY)
      .addScaledVector(right, input.moveX);
    if (moveBlend.lengthSq() > 1) moveBlend.normalize();
    const horizontal = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
    const horizontalSpeed = horizontal.length();
    const moveDirection = horizontalSpeed > 0.05
      ? horizontal.multiplyScalar(1 / horizontalSpeed)
      : (moveBlend.lengthSq() > 0.0001 ? moveBlend.normalize() : forward);
    const running = Boolean(player.isRunning);
    const verticalBoost = running
      ? JUMP_SPEED + RUN_JUMP_VERTICAL_BOOST + RUN_JUMP_FORCE + Math.min(0.4, horizontalSpeed * 0.07)
      : JUMP_SPEED;
    const directionalBoost = running
      ? RUN_JUMP_HORIZONTAL_BOOST + Math.min(1.6, horizontalSpeed * 0.28) + RUN_JUMP_FORCE
      : 0;
    player.velocity.x += moveDirection.x * directionalBoost;
    player.velocity.z += moveDirection.z * directionalBoost;
    player.velocity.y = Math.max(player.velocity.y, verticalBoost);
    player.grounded = false;
    player.mode = 'air';
    jumpArmed = true;
    emit({ type: 'jump-commit', velocityY: player.velocity.y, running });
    return true;
  };

  const updateMantle = () => {
    if (!player.mantle || player.mantle.kind !== 'controller-direct') {
      throw new Error('Product One mantle state is missing');
    }
    const plan = player.mantle;
    const frame = advanceConstrainedMantle(plan, PRODUCT_ONE_FIXED_DT);
    plan.elapsed = frame.elapsed;
    player.position.fromArray(frame.position);
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    player.yaw = plan.faceYaw;
    if (!frame.complete) return { type: 'mantle', frame };
    player.position.fromArray(plan.end.toArray ? plan.end.toArray() : plan.end);
    player.velocity.set(0, 0, 0);
    player.mode = 'ground';
    player.mantle = null;
    player.grounded = true;
    jumpArmed = false;
    emit({ type: 'mantle-complete', plan, frame, completionVelocity: player.velocity.toArray() });
    return { type: 'mantle-complete', frame, plan };
  };

  const fixedStep = (rawInput = {}) => {
    tick += 1;
    if (player.mode === 'climb') {
      emit({ type: 'forbidden-climb' });
      throw new Error('Product One entered forbidden CLIMB state');
    }
    if (player.mode === 'mantle') return updateMantle();

    const input = normalizeProductOneInput(rawInput);
    const smoothRate = player.grounded ? 13.5 : 9.5;
    const smoothBlend = 1 - Math.exp(-smoothRate * PRODUCT_ONE_FIXED_DT);
    smoothMoveX += (input.moveX - smoothMoveX) * smoothBlend;
    smoothMoveY += (input.moveY - smoothMoveY) * smoothBlend;
    if (Math.abs(input.moveX) < 0.001 && Math.abs(smoothMoveX) < 0.015) smoothMoveX = 0;
    if (Math.abs(input.moveY) < 0.001 && Math.abs(smoothMoveY) < 0.015) smoothMoveY = 0;
    const normalized = normalizeProductOneInput({ moveX: smoothMoveX, moveY: smoothMoveY });

    commitQueuedJump(normalized);

    const forward = forwardForYaw(player.yaw);
    const right = rightForYaw(player.yaw);
    const desired = new THREE.Vector3()
      .addScaledVector(forward, normalized.moveY)
      .addScaledVector(right, normalized.moveX);
    if (desired.lengthSq() > 1) desired.normalize();
    const magnitude = Math.hypot(normalized.moveX, normalized.moveY);
    const forwardArc = normalized.moveY > 0.56 && Math.abs(normalized.moveX) <= Math.max(0.001, normalized.moveY);
    const buildingRun = player.grounded && forwardArc && magnitude > 0.55;
    player.runCharge = finite(player.runCharge);
    if (buildingRun) player.runCharge = Math.min(RUN_BUILD_TIME, player.runCharge + PRODUCT_ONE_FIXED_DT);
    else if (player.grounded) player.runCharge = Math.max(0, player.runCharge - PRODUCT_ONE_FIXED_DT * 2.2);
    else if (player.runCharge > 0) player.runCharge = Math.max(0, player.runCharge - PRODUCT_ONE_FIXED_DT * 0.15);
    player.isRunning = player.grounded && player.runCharge >= RUN_BUILD_TIME;
    if (player.isRunning) player.lastRunIntent = true;
    else if (player.grounded && magnitude < 0.18) player.lastRunIntent = false;

    const runProgress = clamp(player.runCharge / RUN_BUILD_TIME, 0, 1);
    const wishSpeed = player.grounded
      ? GROUND_WISH_SPEED + (RUN_WISH_SPEED - GROUND_WISH_SPEED) * runProgress
      : AIR_CRUISE_SPEED;
    if (player.grounded) {
      const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      if (horizontalSpeed > 0.001) {
        const nextSpeed = Math.max(0, horizontalSpeed - horizontalSpeed * GROUND_FRICTION * PRODUCT_ONE_FIXED_DT);
        const scale = nextSpeed / horizontalSpeed;
        player.velocity.x *= scale;
        player.velocity.z *= scale;
      }
    }
    const wishDirection = desired.lengthSq() > 0.0001 ? desired.normalize() : desired;
    if (!player.grounded) {
      const horizontal = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
      const horizontalSpeed = horizontal.length();
      if (wishDirection.lengthSq() > 0.0001) {
        const addSpeed = wishSpeed - horizontal.dot(wishDirection);
        if (addSpeed > 0) {
          horizontal.addScaledVector(wishDirection, Math.min(AIR_TURN_ACCEL * Math.max(0.35, magnitude) * PRODUCT_ONE_FIXED_DT, addSpeed));
        } else if (addSpeed < 0) {
          horizontal.addScaledVector(wishDirection, Math.min(-addSpeed, AIR_BRAKE_ACCEL * PRODUCT_ONE_FIXED_DT));
        }
      }
      if (horizontalSpeed > AIR_MAX_SPEED) {
        const overspeed = horizontalSpeed - AIR_MAX_SPEED;
        const drag = Math.min(overspeed, AIR_DRAG * PRODUCT_ONE_FIXED_DT + overspeed * 0.12 * PRODUCT_ONE_FIXED_DT);
        if (horizontalSpeed > 0.001) horizontal.multiplyScalar((horizontalSpeed - drag) / horizontalSpeed);
      }
      player.velocity.x = horizontal.x;
      player.velocity.z = horizontal.z;
    } else if (wishDirection.lengthSq() > 0.0001) {
      const addSpeed = wishSpeed - player.velocity.dot(wishDirection);
      if (addSpeed > 0) {
        player.velocity.addScaledVector(wishDirection, Math.min(GROUND_ACCEL * wishSpeed * PRODUCT_ONE_FIXED_DT, addSpeed));
      }
    }

    player.velocity.y -= 14.4 * PRODUCT_ONE_FIXED_DT;
    const move = physicsWorld.movePlayer({
      eyePosition: player.position,
      desiredDelta: {
        x: player.velocity.x * PRODUCT_ONE_FIXED_DT,
        y: player.velocity.y * PRODUCT_ONE_FIXED_DT,
        z: player.velocity.z * PRODUCT_ONE_FIXED_DT,
      },
      eyeHeight: EYE_HEIGHT,
      radius: RADIUS,
    });
    player.position.set(move.eyePosition.x, move.eyePosition.y, move.eyePosition.z);
    player.velocity.x = move.movement.x / PRODUCT_ONE_FIXED_DT;
    player.velocity.z = move.movement.z / PRODUCT_ONE_FIXED_DT;
    if (move.grounded && player.velocity.y <= 0) player.velocity.y = 0;
    else player.velocity.y = move.movement.y / PRODUCT_ONE_FIXED_DT;

    const contactCandidates = move.collisions
      .filter((entry) => entry?.isWall && entry.source)
      .map((contact) => {
        const fixture = physicsWorld.getWalkableCuboid(contact.source);
        const feetToLip = fixture ? fixture.topY - (player.position.y - EYE_HEIGHT) : Number.POSITIVE_INFINITY;
        return { contact, fixture, feetToLip };
      })
      .filter((entry) => entry.fixture)
      .sort((left, right) => (
        finite(left.contact.toi) - finite(right.contact.toi)
        || left.feetToLip - right.feetToLip
        || left.fixture.source.localeCompare(right.fixture.source)
      ));
    for (const entry of contactCandidates) {
      emit({
        type: 'wall-contact',
        source: entry.fixture.source,
        grounded: Boolean(player.grounded || move.grounded),
        normal: entry.contact.normal,
        feetToLip: entry.feetToLip,
      });
    }

    let plan = null;
    if (jumpArmed) {
      for (const entry of contactCandidates) {
        const fixture = {
          ...entry.fixture,
          id: entry.fixture.source,
          // Adapt the original constrained-climb acceptance region so ordinary
          // partial-stick intent and angled real wall contact remain usable.
          minForwardInput: 0.18,
          minFacingDot: 0.38,
          minFeetToLip: PRODUCT_ONE_CAPABILITY_PROFILE.mantleMinFeetToLip,
          maxFeetToLip: PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip,
          maxVerticalDisplacement: PRODUCT_ONE_CAPABILITY_PROFILE.mantleMaxFeetToLip,
          maxHorizontalDisplacement: RADIUS * 2 + MANTLE_FORWARD + PRODUCT_ONE_PHYSICS_OPTIONS.characterOffset,
          duration: 0.34,
        };
        plan = createBoundedContactMantlePlan({
          fixture,
          eyePosition: player.position,
          inputMoveY: normalized.moveY,
          collisions: move.collisions,
          eyeHeight: EYE_HEIGHT,
          radius: RADIUS,
          mantleForward: MANTLE_FORWARD,
          playerMode: player.mode,
          grounded: player.grounded || Boolean(move.grounded),
          velocityY: player.velocity.y,
          facing: forwardForYaw(player.yaw),
          faceYaw: player.yaw,
          findMantleTopSupport: (x, z, targetTopY) => physicsWorld.findCuboidTopSupport({
            x, z, targetTopY, radius: RADIUS, source: fixture.id,
          }),
          isBodyClear: (x, z, eyeY) => physicsWorld.isCapsuleClearAt({
            x, z, eyeY, eyeHeight: EYE_HEIGHT, radius: RADIUS,
          }),
        });
        if (plan) break;
      }
    }
    if (plan) {
      jumpArmed = false;
      player.mode = 'mantle';
      player.climb = null;
      player.mantle = plan;
      player.velocity.set(0, 0, 0);
      player.grounded = false;
      emit({ type: 'mantle-start', plan });
      return { type: 'mantle-start', move, plan, input: normalized };
    }
    if (move.grounded) {
      jumpArmed = false;
      player.grounded = true;
      player.mode = 'ground';
    } else {
      player.grounded = false;
      player.mode = 'air';
    }
    return { type: 'move', move, input: normalized };
  };

  const update = (dt, input = {}) => {
    accumulator += clamp(finite(dt), 0, 0.25);
    let steps = 0;
    let last = null;
    while (accumulator + 1e-12 >= PRODUCT_ONE_FIXED_DT) {
      last = fixedStep(input);
      accumulator -= PRODUCT_ONE_FIXED_DT;
      steps += 1;
    }
    return {
      steps,
      last,
      input: { moveX: smoothMoveX, moveY: smoothMoveY },
      tick,
      mode: player.mode,
      grounded: Boolean(player.grounded),
    };
  };

  const reset = () => {
    accumulator = 0;
    jumpQueued = false;
    jumpArmed = false;
    smoothMoveX = 0;
    smoothMoveY = 0;
    tick = 0;
    trace.length = 0;
  };

  const input = createProductOneInputAdapter({ enqueueJump: queueJump, stepController: update });
  return {
    input,
    reset,
    trace: () => trace.map((entry) => ({ ...entry })),
  };
}
