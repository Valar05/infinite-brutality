// Existing setupTouch owner helper: one captured camera pointer, deterministic ownership.
export function createTouchLookOwner(options = {}) {
  const capturePointer = typeof options.capturePointer === 'function' ? options.capturePointer : () => {};
  const releasePointer = typeof options.releasePointer === 'function' ? options.releasePointer : () => {};
  const onDelta = typeof options.onDelta === 'function' ? options.onDelta : () => {};
  const onTrace = typeof options.onTrace === 'function' ? options.onTrace : () => {};
  let active = null;
  let lastX = 0;
  let lastY = 0;
  const pointerId = (event) => Number(event?.pointerId);
  const point = (event) => ({ x: Number(event?.clientX) || 0, y: Number(event?.clientY) || 0 });
  const trace = (phase, event, accepted, ownerBefore, detail = {}) => {
    const p = point(event);
    onTrace({ phase, pointerId: pointerId(event), x: p.x, y: p.y, accepted, ownerBefore, ownerAfter: active, ...detail });
  };
  const begin = (event) => {
    const id = pointerId(event);
    const ownerBefore = active;
    if (!Number.isInteger(id) || active !== null) { trace('rejected-busy', event, false, ownerBefore); return false; }
    const p = point(event);
    active = id; lastX = p.x; lastY = p.y;
    try { capturePointer(id); } catch {}
    trace('down', event, true, ownerBefore);
    return true;
  };
  const move = (event) => {
    const id = pointerId(event);
    if (id !== active) return false;
    const ownerBefore = active;
    const p = point(event);
    const dx = p.x - lastX; const dy = p.y - lastY;
    lastX = p.x; lastY = p.y;
    onDelta({ pointerId: id, dx, dy });
    trace('move', event, true, ownerBefore, { dx, dy });
    return true;
  };
  const clear = (event, phase, release) => {
    const id = pointerId(event);
    if (id !== active) return false;
    const ownerBefore = active;
    if (release) { try { releasePointer(id); } catch {} }
    active = null;
    trace(phase, event, true, ownerBefore);
    return true;
  };
  const end = (event, phase = 'up') => clear(event, phase, true);
  const lost = (event) => clear(event, 'lost', false);
  const reset = (phase = 'reset') => active === null ? false : clear({ pointerId: active, clientX: lastX, clientY: lastY }, phase, true);
  return Object.freeze({ begin, move, end, lost, reset, activePointer: () => active });
}
