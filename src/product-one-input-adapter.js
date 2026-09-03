// @qa-production-adapter-v1 product-one-input move jump step
// Shipped Product One input boundary shared by the page and deterministic QA.
function trace(event, detail = {}) {
  const sink = globalThis.__qaProductionAdapterTrace;
  if (typeof sink === 'function') sink({ adapter: import.meta.url, event, ...detail });
}

export function createProductOneInputAdapter(options = {}) {
  if (typeof options.enqueueJump !== 'function' || typeof options.stepController !== 'function') {
    throw new TypeError('Product One input adapter requires controller-owned jump and step callbacks');
  }
  let moveX = 0;
  let moveY = 0;
  return Object.freeze({
    setMove(value = {}) {
      moveX = Number.isFinite(Number(value.moveX)) ? Number(value.moveX) : 0;
      moveY = Number.isFinite(Number(value.moveY)) ? Number(value.moveY) : 0;
      trace('move', { source: String(value.source || 'runtime') });
    },
    pressJump(value = {}) {
      trace('jump', { source: String(value.source || 'runtime') });
      return options.enqueueJump();
    },
    update(dt) {
      trace('step', { dt: Number(dt) });
      return options.stepController(dt, { moveX, moveY });
    },
    snapshot() { return { moveX, moveY }; },
  });
}
