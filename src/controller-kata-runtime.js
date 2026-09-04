import { CONTROLLER_KATA_PROFILE as P } from './controller-kata-profile.js?build=38dc52ca54554f86b69a0daeb6de28729168e7b2934ff850b40994499662b759';
import { generateControllerArena } from './controller-kata.js?build=e54114481acc5212d748b851ed599d1cd677ecffe8323c022b340cb3fd5e3cd2';
import { createPhysicsWorld, ensurePhysicsReady } from './physics-world.js?build=7360e97b129a7063b51aa398deddd5f9b5b272ba9c1ac613aa6c606c99d0fdde';
import { createControllerKataCore } from './controller-kata-core.js?build=75ec2e28b0b9d1dbdf5629e0584b4d8763b8a1f026cf6e4787cc139bcf2a6c7b';
import { createNoodleSvgTerminal } from './noodle-svg-terminal.js?build=f6296355e14b9e23f2a0436f6a922e1ecee5360f20561dea6c2fd18c3d38db3b';
import { createTouchLookOwner } from './touch-look-owner.js?build=aaa2525307225fc34d9298ddccbc2de5b7b2ff9fe945b488f490df58ed5ee751';
import { createPlaytestOverwatchTelemetry } from './playtest-overwatch-telemetry.js?build=d89295693b529a85c381357d545b1b4c9983debc2343472dc5382f66c21bf228';
import { CONTROLLER_KATA_BUILD_MANIFEST } from './controller-kata-svg-build-manifest.js?build=3f88cc78e25ceac5bc7fc1767fa4422fc404f786719cf0070250584d97d32ab4';

const BUILD = 'controller-kata-noodle-svg-v1';
const doc = document;
const win = window;
const svg = doc.getElementById('game');
const status = doc.getElementById('status');
const hint = doc.getElementById('hint');
const stick = doc.getElementById('leftStick');
const knob = stick.querySelector('div');
const jumpButton = doc.getElementById('jumpButton');
const endButton = doc.getElementById('endTestButton');
const fullscreenButton = doc.getElementById('fsButton');
const params = new URLSearchParams(win.location.search);
const seed = params.get('seed') || 'controller-proof';
const playtest = createPlaytestOverwatchTelemetry({
  search: win.location.search,
  origin: win.location.origin,
  runtimeBuildGraph: CONTROLLER_KATA_BUILD_MANIFEST,
});
let world = null;
let core = null;
let terminal = null;
let arena = null;
let cuboids = [];
let runIndex = 0;
let startedAt = performance.now();
let lookOwner = null;
let stickPointer = null;
let previous = performance.now();
let active = true;

function reportCrash(phase, error) {
  playtest.crash(phase, { message: String(error && (error.message || error) || 'unknown').slice(0, 1024) });
  status.textContent = 'boot error';
  hint.textContent = String(error && (error.message || error) || 'unknown');
}
win.addEventListener('error', (event) => reportCrash('window-error', event.error || event.message));
win.addEventListener('unhandledrejection', (event) => reportCrash('unhandled-rejection', event.reason));

function frameRecord(value) {
  return {
    position: [value.position.x, value.position.y, value.position.z],
    velocity: [value.velocity.x, value.velocity.y, value.velocity.z],
    yaw: value.yaw,
    mode: value.mode,
    grounded: Boolean(value.grounded),
  };
}

function beginPlaytest(source) {
  if (playtest.started || !core) return;
  if (playtest.start({ slice: 'controller_kata', build: BUILD, trigger: source })) {
    playtest.milestone('course-ready', { seed: arena.seedText });
    playtest.tapeStart({ seed: arena.seedText, courseHash: arena.boxcraftCourse.courseHash, initial: frameRecord(core.state) });
  }
}

function mountArena() {
  if (world) world.dispose();
  world = createPhysicsWorld({ gravity: { x: 0, y: -P.gravity, z: 0 }, characterOffset: 0.035,
    playerFootInset: 0, autostepHeight: P.autostepHeight, autostepMinWidth: 0.646, snapToGround: 0.48 });
  arena = generateControllerArena({ seed: runIndex ? seed + ':' + runIndex : seed });
  const worldCuboids = arena.traversal.fixtures.concat(arena.cubes);
  world.addCuboid({ size: arena.floor.size, position: arena.floor.center, source: 'controller-kata-floor', kind: 'floor' });
  for (const record of worldCuboids) {
    world.addCuboid({ size: record.size, position: record.center, source: record.id, kind: 'walkable' });
  }
  cuboids = worldCuboids.map((record) => ({
    id: record.id,
    center: record.center.slice(),
    size: record.size.slice(),
    kind: String(record.id).indexOf('mantle-course-') === 0 ? 'course' : 'box',
  }));
  cuboids.push({ id: 'cyan-exit', center: [arena.exit[0], 2.5, arena.exit[2]], size: [0.28, 5, 0.28], kind: 'exit' });
  core = createControllerKataCore({
    world,
    spawn: { x: arena.spawn[0], y: arena.spawn[1], z: arena.spawn[2] },
    onEvent(event) {
      if (event.type === 'mantle-start') playtest.milestone('first-mantle', { contactSource: event.plan.contactSource });
    },
    onFixedTick(tick) {
      playtest.tapeFrame({
        schema: 'product-one-fixed-tick-v1',
        tick: tick.tick,
        input: tick.input,
        yaw: tick.before.yaw,
        jumpQueued: false,
        before: tick.before,
        after: tick.after,
        outcome: tick.outcome,
      });
    },
  });
  startedAt = performance.now();
}

function moveStick(event) {
  const rect = stick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const maximum = rect.width * 0.36;
  const length = Math.min(maximum, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * length;
  const y = Math.sin(angle) * length;
  knob.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  core.setMove({ moveX: Math.sign(x) * Math.pow(Math.abs(x / maximum), 1.28),
    moveY: Math.sign(-y) * Math.pow(Math.abs(y / maximum), 1.28) });
  beginPlaytest('first-movement');
}

function beginStick(event) {
  if (stickPointer !== null) return false;
  stickPointer = event.pointerId;
  const size = stick.getBoundingClientRect().width || 132;
  stick.style.left = Math.max(8, Math.min(win.innerWidth * 0.44 - size, event.clientX - size / 2)) + 'px';
  stick.style.top = Math.max(44, Math.min(win.innerHeight - size - 8, event.clientY - size / 2)) + 'px';
  stick.classList.add('active');
  try { svg.setPointerCapture(event.pointerId); } catch {}
  moveStick(event);
  return true;
}

function endStick(event) {
  if (event.pointerId !== stickPointer) return false;
  stickPointer = null;
  core.setMove({ moveX: 0, moveY: 0 });
  knob.style.transform = 'translate(0,0)';
  stick.classList.remove('active');
  return true;
}

function setupInput() {
  lookOwner = createTouchLookOwner({
    capturePointer: (pointerId) => { try { svg.setPointerCapture(pointerId); } catch {} },
    releasePointer: (pointerId) => { if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId); },
    onDelta: (delta) => core.addLook(delta.dx * 0.0065, delta.dy * 0.0053),
    onTrace: (trace) => playtest.pointerEvent(Object.assign({}, trace, { targetZone: 'right-look' })),
  });
  svg.addEventListener('pointerdown', (event) => {
    hint.hidden = true;
    if (event.clientX < win.innerWidth * 0.44) beginStick(event);
    else lookOwner.begin(event);
    event.preventDefault();
  });
  win.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) {
      moveStick(event);
      event.preventDefault();
      return;
    }
    if (lookOwner.move(event)) event.preventDefault();
  }, { passive: false });
  const end = (event) => {
    if (endStick(event)) return;
    lookOwner.end(event, event.type === 'pointercancel' ? 'cancel' : 'up');
  };
  win.addEventListener('pointerup', end);
  win.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === stickPointer) endStick(event);
    else lookOwner.lost(event);
  });
  jumpButton.addEventListener('pointerdown', (event) => {
    core.jump();
    beginPlaytest('jump');
    event.preventDefault();
    event.stopPropagation();
  });
  const keys = { KeyW: ['moveY', 1], KeyS: ['moveY', -1], KeyA: ['moveX', -1], KeyD: ['moveX', 1] };
  const keyboard = { moveX: 0, moveY: 0 };
  win.addEventListener('keydown', (event) => {
    const binding = keys[event.code];
    if (binding) {
      keyboard[binding[0]] = binding[1];
      core.setMove(keyboard);
      beginPlaytest('keyboard-movement');
      event.preventDefault();
    }
    if (event.code === 'Space' && !event.repeat) {
      core.jump();
      beginPlaytest('keyboard-jump');
      event.preventDefault();
    }
  });
  win.addEventListener('keyup', (event) => {
    const binding = keys[event.code];
    if (binding && keyboard[binding[0]] === binding[1]) {
      keyboard[binding[0]] = 0;
      core.setMove(keyboard);
    }
  });
  win.addEventListener('blur', () => {
    if (core) core.setMove({ moveX: 0, moveY: 0 });
    stickPointer = null;
    lookOwner.reset('blur');
  });
}

async function finishTest() {
  if (endButton.disabled) return;
  endButton.disabled = true;
  endButton.textContent = 'Finalizing...';
  core.setMove({ moveX: 0, moveY: 0 });
  lookOwner.reset('end-test');
  playtest.end({ reason: 'end-test-button', final: frameRecord(core.state) });
  await playtest.flush();
  endButton.textContent = 'Done';
  if (win.history.length > 1) win.history.back();
}
endButton.hidden = false;
endButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  finishTest();
});
fullscreenButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
});

function render(now) {
  if (!active) return;
  try {
    const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    const result = core.update(dt);
    const state = result.state;
    terminal.render({
      camera: { x: state.position.x, y: state.position.y, z: state.position.z, yaw: state.yaw, pitch: state.pitch },
      cuboids,
      gridStep: arena.grid.step,
      gridHalf: 48,
    });
    const elapsed = Math.max(0, (now - startedAt) / 1000);
    status.textContent = 'controller kata svg | ' + state.mode + ' | ' + elapsed.toFixed(1) + 's | ' + arena.seedText;
    if (state.grounded && Math.hypot(state.position.x - arena.exit[0], state.position.z - arena.exit[2]) < arena.exitRadius) {
      playtest.milestone('cyan-exit');
      playtest.success({ result: 'cyan-exit' });
      runIndex += 1;
      mountArena();
    }
    win.requestAnimationFrame(render);
  } catch (error) {
    active = false;
    reportCrash('render', error);
  }
}

async function boot() {
  await ensurePhysicsReady();
  terminal = createNoodleSvgTerminal({ svg });
  mountArena();
  setupInput();
  win.__infiniteBrutalityControllerKata = Object.freeze({
    build: BUILD,
    graphSha256: CONTROLLER_KATA_BUILD_MANIFEST.graphSha256,
    getState: () => frameRecord(core.state),
    getArena: () => ({ seed: arena.seedText, exit: arena.exit.slice(), geometryHash: arena.traversal.geometryHash }),
  });
  win.requestAnimationFrame(render);
}
boot().catch((error) => reportCrash('boot', error));
 