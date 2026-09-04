import { CONTROLLER_KATA_PROFILE as P } from './controller-kata-profile.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const vec = (value = {}) => ({ x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 });
const lengthXZ = (value) => Math.hypot(value.x, value.z);
const normalizedXZ = (value) => {
  const length = lengthXZ(value);
  return length > 1e-9 ? { x: value.x / length, y: 0, z: value.z / length } : { x: 0, y: 0, z: 0 };
};
const forwardForYaw = (yaw) => ({ x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) });
const rightForYaw = (yaw) => ({ x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) });
const copyState = (state) => ({
  position: vec(state.position), velocity: vec(state.velocity), yaw: state.yaw, pitch: state.pitch,
  grounded: state.grounded, mode: state.mode, runCharge: state.runCharge, isRunning: state.isRunning,
});

export function createControllerKataCore(options = {}) {
  const world = options.world;
  if (!world || typeof world.movePlayer !== 'function') throw new TypeError('controller core requires a plain-record world adapter');
  const emit = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const fixedTick = typeof options.onFixedTick === 'function' ? options.onFixedTick : () => {};
  const state = {
    position: vec(options.spawn), velocity: vec(), yaw: Math.PI, pitch: 0, grounded: true, mode: 'ground',
    runCharge: 0, isRunning: false, mantle: null, tick: 0,
  };
  const input = { moveX: 0, moveY: 0, smoothX: 0, smoothY: 0, jump: false, lookX: 0, lookY: 0 };
  let accumulator = 0;

  function reset(spawn) {
    Object.assign(state, { position: vec(spawn), velocity: vec(), yaw: Math.PI, pitch: 0, grounded: true,
      mode: 'ground', runCharge: 0, isRunning: false, mantle: null, tick: 0 });
    Object.assign(input, { moveX: 0, moveY: 0, smoothX: 0, smoothY: 0, jump: false, lookX: 0, lookY: 0 });
    accumulator = 0;
  }

  function planMantle(move, movementStart, desiredDelta) {
    const collisions = Array.isArray(move.collisions) ? move.collisions.slice() : [];
    if (!collisions.some((entry) => entry && entry.isWall && entry.source)
      && Math.hypot(desiredDelta.x, desiredDelta.z) > 0.01
      && Math.hypot(move.movement.x, move.movement.z) + 1e-4 < Math.hypot(desiredDelta.x, desiredDelta.z)
      && typeof world.findWalkableCuboidContact === 'function') {
      const recovered = world.findWalkableCuboidContact({ eyePosition: movementStart, desiredDelta,
        eyeHeight: P.eyeHeight, radius: P.radius });
      if (recovered) collisions.push(recovered);
    }
    const candidates = collisions.filter((entry) => entry && entry.isWall && entry.source && entry.normal && entry.point)
      .map((contact) => ({ contact, fixture: world.getWalkableCuboid(contact.source) }))
      .filter((entry) => entry.fixture)
      .sort((a, b) => (Number(a.contact.toi) || 0) - (Number(b.contact.toi) || 0)
        || String(a.fixture.source).localeCompare(String(b.fixture.source)));
    for (const entry of candidates) {
      const fixture = entry.fixture;
      const topY = Number(fixture.topY) || 0;
      const feetToLip = topY - (state.position.y - P.eyeHeight);
      if (feetToLip <= P.autostepHeight + 1e-6 || topY > state.position.y + 1e-6) continue;
      const normal = normalizedXZ(entry.contact.normal);
      if (lengthXZ(normal) < 0.35) continue;
      const inward = { x: -normal.x, y: 0, z: -normal.z };
      const supportInset = P.radius + 0.035;
      const minX = fixture.center[0] - fixture.size[0] * 0.5 + supportInset;
      const maxX = fixture.center[0] + fixture.size[0] * 0.5 - supportInset;
      const minZ = fixture.center[2] - fixture.size[2] * 0.5 + supportInset;
      const maxZ = fixture.center[2] + fixture.size[2] * 0.5 - supportInset;
      if (minX > maxX || minZ > maxZ) continue;
      const targetX = clamp(entry.contact.point.x + inward.x * (P.radius + P.mantleForward), minX, maxX);
      const targetZ = clamp(entry.contact.point.z + inward.z * (P.radius + P.mantleForward), minZ, maxZ);
      const support = world.findCuboidTopSupport({ x: targetX, z: targetZ, targetTopY: topY, radius: P.radius, source: fixture.source });
      if (!support) continue;
      const end = { x: targetX, y: support.topY + P.eyeHeight, z: targetZ };
      if (!world.isCapsuleClearAt({ x: end.x, z: end.z, eyeY: end.y, eyeHeight: P.eyeHeight, radius: P.radius })) continue;
      if (Math.hypot(end.x - state.position.x, end.z - state.position.z) > 1.31) continue;
      return { source: fixture.source, start: vec(state.position), end, elapsed: 0, duration: 0.34, faceYaw: state.yaw,
        contactSource: entry.contact.source, feetToLip };
    }
    return null;
  }

  function advanceMantle() {
    const mantle = state.mantle;
    mantle.elapsed = Math.min(mantle.duration, mantle.elapsed + P.fixedDt);
    const progress = mantle.elapsed / mantle.duration;
    const eased = progress * progress * (3 - 2 * progress);
    const lift = Math.sin(Math.PI * eased) * 0.18;
    state.position = {
      x: mantle.start.x + (mantle.end.x - mantle.start.x) * eased,
      y: mantle.start.y + (mantle.end.y - mantle.start.y) * eased + lift,
      z: mantle.start.z + (mantle.end.z - mantle.start.z) * eased,
    };
    state.velocity = vec();
    if (progress < 1) return 'mantle';
    state.position = vec(mantle.end);
    state.mantle = null;
    state.mode = 'ground';
    state.grounded = true;
    emit({ type: 'mantle-complete', source: mantle.source });
    return 'mantle-complete';
  }

  function step() {
    state.tick += 1;
    const before = copyState(state);
    state.yaw -= input.lookX;
    state.pitch = clamp(state.pitch - input.lookY, -1.15, 1.1);
    input.lookX = 0;
    input.lookY = 0;
    let outcome = 'move';
    if (state.mode === 'mantle') {
      outcome = advanceMantle();
      fixedTick({ tick: state.tick, input: { moveX: input.moveX, moveY: input.moveY }, before, after: copyState(state), outcome });
      return;
    }
    const smoothRate = state.grounded ? 13.5 : 9.5;
    const blend = 1 - Math.exp(-smoothRate * P.fixedDt);
    input.smoothX += (input.moveX - input.smoothX) * blend;
    input.smoothY += (input.moveY - input.smoothY) * blend;
    const rawLength = Math.hypot(input.smoothX, input.smoothY);
    const moveX = rawLength > 1 ? input.smoothX / rawLength : input.smoothX;
    const moveY = rawLength > 1 ? input.smoothY / rawLength : input.smoothY;
    const forward = forwardForYaw(state.yaw);
    const right = rightForYaw(state.yaw);
    let desired = { x: forward.x * moveY + right.x * moveX, y: 0, z: forward.z * moveY + right.z * moveX };
    if (lengthXZ(desired) > 1) desired = normalizedXZ(desired);
    const magnitude = Math.hypot(moveX, moveY);
    const building = state.grounded && moveY > 0.56 && Math.abs(moveX) <= Math.max(0.001, moveY) && magnitude > 0.55;
    state.runCharge = building ? Math.min(1, state.runCharge + P.fixedDt)
      : Math.max(0, state.runCharge - P.fixedDt * (state.grounded ? 2.2 : 0.15));
    state.isRunning = state.grounded && state.runCharge >= 1;
    const wishSpeed = state.grounded ? 5.2 + 3.6 * state.runCharge : 6.2;
    if (state.grounded) {
      const speed = lengthXZ(state.velocity);
      if (speed > 0.001) {
        const next = Math.max(0, speed - speed * 13.5 * P.fixedDt);
        state.velocity.x *= next / speed;
        state.velocity.z *= next / speed;
      }
    }
    const direction = normalizedXZ(desired);
    if (state.grounded && lengthXZ(direction) > 0.0001) {
      const along = state.velocity.x * direction.x + state.velocity.z * direction.z;
      const add = wishSpeed - along;
      if (add > 0) {
        const amount = Math.min(28 * wishSpeed * P.fixedDt, add);
        state.velocity.x += direction.x * amount;
        state.velocity.z += direction.z * amount;
      }
    } else if (!state.grounded && lengthXZ(direction) > 0.0001) {
      const along = state.velocity.x * direction.x + state.velocity.z * direction.z;
      const add = wishSpeed - along;
      const amount = add > 0 ? Math.min(14 * Math.max(0.35, magnitude) * P.fixedDt, add)
        : -Math.min(-add, 19.5 * P.fixedDt);
      state.velocity.x += direction.x * amount;
      state.velocity.z += direction.z * amount;
    }
    if (input.jump && state.grounded) {
      state.velocity.y = P.jumpSpeed;
      state.grounded = false;
      state.mode = 'air';
      emit({ type: 'jump-commit' });
    }
    input.jump = false;
    state.velocity.y -= P.gravity * P.fixedDt;
    const movementStart = vec(state.position);
    const desiredDelta = { x: state.velocity.x * P.fixedDt, y: state.velocity.y * P.fixedDt, z: state.velocity.z * P.fixedDt };
    const move = world.movePlayer({ eyePosition: state.position, desiredDelta, eyeHeight: P.eyeHeight, radius: P.radius });
    state.position = vec(move.eyePosition);
    state.velocity.x = move.movement.x / P.fixedDt;
    state.velocity.z = move.movement.z / P.fixedDt;
    state.velocity.y = move.grounded && state.velocity.y <= 0 ? 0 : move.movement.y / P.fixedDt;
    const mantle = planMantle(move, movementStart, desiredDelta);
    if (mantle) {
      state.mantle = mantle;
      state.mode = 'mantle';
      state.grounded = false;
      state.velocity = vec();
      outcome = 'mantle-start';
      emit({ type: 'mantle-start', plan: { source: mantle.source, contactSource: mantle.contactSource, feetToLip: mantle.feetToLip } });
    } else {
      state.grounded = Boolean(move.grounded);
      state.mode = state.grounded ? 'ground' : 'air';
    }
    fixedTick({ tick: state.tick, input: { moveX, moveY }, before, after: copyState(state), outcome });
  }

  return Object.freeze({
    state,
    setMove(value = {}) { input.moveX = clamp(value.moveX, -1, 1); input.moveY = clamp(value.moveY, -1, 1); },
    addLook(dx, dy) { input.lookX += Number(dx) || 0; input.lookY += Number(dy) || 0; },
    jump() { input.jump = true; },
    update(dt) {
      accumulator = Math.min(0.1, accumulator + Math.max(0, Number(dt) || 0));
      let steps = 0;
      while (accumulator + 1e-12 >= P.fixedDt) { step(); accumulator -= P.fixedDt; steps += 1; }
      return { steps, state: copyState(state), input: { moveX: input.smoothX, moveY: input.smoothY } };
    },
    reset,
  });
}
