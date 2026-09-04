// Engine-neutral cuboid collision projection. Derived from physics-world.js AABB
// query contracts and Noodle3D's deterministic axis-separated collision shape.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const copy = (value = {}) => ({ x: finite(value.x), y: finite(value.y), z: finite(value.z) });

export function createControllerKataWorld(options = {}) {
  const autostepHeight = finite(options.autostepHeight, 0.62);
  const snapToGround = finite(options.snapToGround, 0.48);
  const records = [];
  const addCuboid = ({ size, position, source = '', kind = 'solid' }) => {
    if (!Array.isArray(size) || !Array.isArray(position)) throw new TypeError('cuboid requires size and position');
    const record = { type: 'cuboid', source: String(source), kind: String(kind), size: size.map(Number), position: position.map(Number) };
    record.topY = record.position[1] + record.size[1] * 0.5;
    record.bottomY = record.position[1] - record.size[1] * 0.5;
    records.push(record);
    return record;
  };
  const containsXZ = (record, x, z, inset = 0) => Math.abs(x - record.position[0]) <= record.size[0] * 0.5 - inset + 1e-7
    && Math.abs(z - record.position[2]) <= record.size[2] * 0.5 - inset + 1e-7;
  const overlapsXZ = (record, x, z, radius) => Math.abs(x - record.position[0]) < record.size[0] * 0.5 + radius - 1e-7
    && Math.abs(z - record.position[2]) < record.size[2] * 0.5 + radius - 1e-7;
  const overlapsBody = (record, feetY, eyeY) => eyeY + 0.35 > record.bottomY + 1e-7 && feetY + 0.001 < record.topY - 1e-7;
  const supportAt = (x, z, feetCeiling, radius, tolerance = snapToGround) => {
    let best = null;
    for (const record of records) {
      if (!['floor', 'walkable'].includes(record.kind) || !containsXZ(record, x, z, radius)) continue;
      if (record.topY > feetCeiling + tolerance + 1e-7) continue;
      if (!best || record.topY > best.topY) best = record;
    }
    return best;
  };
  const wallContact = (record, axis, direction, position, radius) => {
    const normal = axis === 'x' ? { x: -Math.sign(direction), y: 0, z: 0 } : { x: 0, y: 0, z: -Math.sign(direction) };
    return { source: record.source, kind: record.kind, normal,
      point: { x: position.x - normal.x * radius, y: Math.min(position.y, record.topY), z: position.z - normal.z * radius },
      toi: 0, isWall: true, isGround: false };
  };
  const isCapsuleClearAt = ({ x, z, eyeY, eyeHeight, radius = 0.38, ignoreSource = '' }) => {
    const feetY = finite(eyeY) - finite(eyeHeight, 1.68);
    for (const record of records) {
      if (record.source === ignoreSource || !overlapsBody(record, feetY, finite(eyeY))) continue;
      if (overlapsXZ(record, finite(x), finite(z), finite(radius))) return false;
    }
    return true;
  };
  const movePlayer = ({ eyePosition, desiredDelta, eyeHeight = 1.68, radius = 0.38 }) => {
    const start = copy(eyePosition); const delta = copy(desiredDelta); const next = copy(start); const movement = { x: 0, y: 0, z: 0 };
    let feetY = start.y - eyeHeight; let steppedTop = null; const collisions = [];
    for (const axis of ['x', 'z']) {
      const amount = delta[axis]; if (Math.abs(amount) < 1e-12) continue;
      const trial = { ...next, [axis]: next[axis] + amount };
      const blockers = records.filter((record) => record.kind !== 'floor' && overlapsBody(record, feetY, next.y) && overlapsXZ(record, trial.x, trial.z, radius));
      if (!blockers.length) { next[axis] = trial[axis]; movement[axis] += amount; continue; }
      const stepTop = Math.max(...blockers.map((record) => record.topY));
      const stepHeight = stepTop - feetY;
      const canStep = stepHeight > 1e-7 && stepHeight <= autostepHeight + 1e-7
        && isCapsuleClearAt({ x: trial.x, z: trial.z, eyeY: stepTop + eyeHeight, eyeHeight, radius });
      if (canStep) {
        next[axis] = trial[axis]; movement[axis] += amount; next.y = stepTop + eyeHeight; movement.y = next.y - start.y;
        feetY = stepTop; steppedTop = stepTop; continue;
      }
      const record = blockers.sort((a, b) => a.source.localeCompare(b.source))[0];
      collisions.push(wallContact(record, axis, amount, next, radius));
    }
    let grounded = steppedTop !== null;
    if (!grounded) {
      const targetY = next.y + delta.y; const targetFeet = targetY - eyeHeight;
      if (delta.y <= 0) {
        const support = supportAt(next.x, next.z, feetY, radius, Math.max(snapToGround, -delta.y + 1e-7));
        if (support && targetFeet <= support.topY + 1e-7) {
          next.y = support.topY + eyeHeight; grounded = true;
          collisions.push({ source: support.source, kind: support.kind, normal: { x: 0, y: 1, z: 0 }, point: { x: next.x, y: support.topY, z: next.z }, toi: 0, isWall: false, isGround: true });
        } else next.y = targetY;
      } else next.y = targetY;
      movement.y = next.y - start.y;
    }
    return { eyePosition: next, movement, grounded, collisions, contactCount: collisions.length };
  };
  const getWalkableCuboid = (source) => {
    const record = records.find((entry) => entry.source === String(source) && entry.kind === 'walkable');
    return record ? { source: record.source, kind: record.kind, center: record.position.slice(), position: record.position.slice(), size: record.size.slice(), topY: record.topY, yaw: 0 } : null;
  };
  const findCuboidTopSupport = ({ x, z, targetTopY, radius = 0.38, source = '', tolerance = 0.08 }) => {
    const record = records.filter((entry) => (!source || entry.source === source) && containsXZ(entry, finite(x), finite(z), finite(radius)) && Math.abs(entry.topY - targetTopY) <= tolerance)
      .sort((a, b) => b.topY - a.topY || a.source.localeCompare(b.source))[0];
    return record ? { topY: record.topY, source: record.source, kind: record.kind } : null;
  };
  const findWalkableCuboidContact = ({ eyePosition, desiredDelta, eyeHeight = 1.68, radius = 0.38 }) => {
    const start = copy(eyePosition); const delta = copy(desiredDelta); const feetY = start.y - eyeHeight;
    if (Math.hypot(delta.x, delta.z) < 1e-7) return null;
    let best = null;
    for (const record of records) {
      if (record.kind !== 'walkable' || record.topY <= feetY + autostepHeight + 1e-7 || record.topY > start.y + 1e-7 || record.bottomY > start.y) continue;
      const axes = [{ start: start.x - record.position[0], delta: delta.x, half: record.size[0] * 0.5 + radius, axis: 'x' }, { start: start.z - record.position[2], delta: delta.z, half: record.size[2] * 0.5 + radius, axis: 'z' }];
      let enter = -Infinity, exit = 1, normal = null;
      for (const item of axes) {
        if (Math.abs(item.delta) < 1e-12) { if (Math.abs(item.start) > item.half) { enter = 2; break; } continue; }
        const t1 = (-item.half - item.start) / item.delta, t2 = (item.half - item.start) / item.delta;
        const near = Math.min(t1, t2), far = Math.max(t1, t2);
        if (near > enter) { enter = near; const sign = t1 < t2 ? -1 : 1; normal = item.axis === 'x' ? { x: sign, y: 0, z: 0 } : { x: 0, y: 0, z: sign }; }
        exit = Math.min(exit, far);
      }
      if (!normal || enter < -1e-7 || enter > exit + 1e-7 || enter > 1 + 1e-7) continue;
      const hit = { x: start.x + delta.x * clamp(enter, 0, 1), y: Math.min(record.topY, start.y), z: start.z + delta.z * clamp(enter, 0, 1) };
      const contact = { source: record.source, kind: record.kind, normal, point: { x: hit.x - normal.x * radius, y: hit.y, z: hit.z - normal.z * radius }, toi: clamp(enter, 0, 1), isWall: true, isGround: false, recovered: true };
      if (!best || contact.toi < best.toi || (contact.toi === best.toi && contact.source < best.source)) best = contact;
    }
    return best;
  };
  return Object.freeze({ addCuboid, movePlayer, getWalkableCuboid, findWalkableCuboidContact, findCuboidTopSupport, isCapsuleClearAt, snapshot: () => records.map((record) => ({ ...record })), dispose: () => { records.length = 0; } });
}
