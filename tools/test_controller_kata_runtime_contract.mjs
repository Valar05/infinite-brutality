import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createControllerKataCore } from '../src/controller-kata-core.js';
import { projectNoodleFrame } from '../src/noodle-svg-terminal.js';
import { CONTROLLER_KATA_BUILD_MANIFEST } from '../src/controller-kata-svg-build-manifest.js';

const text = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = text('../controller-kata.html');
const runtime = text('../src/controller-kata-runtime.js');
const coreSource = text('../src/controller-kata-core.js');
const arenaSource = text('../src/controller-kata.js');
const profileSource = text('../src/controller-kata-profile.js');
const terminalSource = text('../src/noodle-svg-terminal.js');
const provenance = JSON.parse(text('../src/noodle-svg-terminal.provenance.json'));
const manifestSource = text('../src/controller-kata-svg-build-manifest.js');

assert.match(html, /<svg id="game"/);
assert.match(html, /controller-kata-runtime\.js\?build=[0-9a-f]{64}/);
assert.match(html, /controller-kata\.css\?build=[0-9a-f]{64}/);
assert.doesNotMatch(html, /<canvas|importmap|three\.module|WebGL/i);
assert.match(runtime, /createControllerKataCore/);
assert.match(runtime, /createNoodleSvgTerminal/);
assert.match(runtime, /createTouchLookOwner/);
assert.match(runtime, /__infiniteBrutalityControllerKata/);
assert.match(runtime, /end-test-button/);
assert.match(runtime, /first-mantle/);
assert.doesNotMatch(`${runtime}\n${coreSource}\n${arenaSource}\n${profileSource}`, /from ['"]three|THREE\.|WebGLRenderer|CanvasRenderingContext/i);
assert.doesNotMatch(`${coreSource}\n${arenaSource}\n${profileSource}`, /document\.|window\.|createElement|<svg/i);
assert.match(terminalSource, /source-faithful extractions from verified noodle3d\.html/);
assert.deepEqual(provenance.authority, {
  archive_sha256: '3a3888479d8048025c9cbfbd554aacb8df013664c44c4f27d554ea61a42f9d6b',
  noodle3d_html_sha256: '9862656c631d2c2b2f1035774cef51060b38ff83f0977d35eecd5d89b262d749',
  source: 'Helm Center document 1Wi5s1Vp8JvQIivmjvdAMIXI7Vn6A0OMeLYZjN5zaZNo',
});
assert.match(manifestSource, /controller-kata-build-manifest-v1/);
for (const [path, expected] of Object.entries(CONTROLLER_KATA_BUILD_MANIFEST.modules)) {
  const actual = createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
  assert.equal(actual, expected, `manifest hash drift: ${path}`);
}
const graphActual = createHash('sha256').update(JSON.stringify(CONTROLLER_KATA_BUILD_MANIFEST.modules)).digest('hex');
assert.equal(graphActual, CONTROLLER_KATA_BUILD_MANIFEST.graphSha256);

const frame = { camera: { x: 0, y: 1.68, z: -5, yaw: Math.PI, pitch: 0 }, gridStep: 4, gridHalf: 12,
  cuboids: [{ id: 'authority-box', center: [0, 1, 1], size: [2, 2, 2], kind: 'course' }] };
const projectedA = projectNoodleFrame(frame, { width: 800, height: 450 });
const projectedB = projectNoodleFrame(JSON.parse(JSON.stringify(frame)), { width: 800, height: 450 });
assert.deepEqual(projectedA, projectedB, 'terminal projection must be deterministic');
assert.ok(projectedA.lines.length > 0);
assert.ok(projectedA.faces.length > 0);
const movedCamera = projectNoodleFrame({ ...frame, camera: { ...frame.camera, x: 1 } }, { width: 800, height: 450 });
assert.notDeepEqual(projectedA, movedCamera, 'terminal must consume neutral camera records');

const events = [];
const fixture = { source: 'ordinary-wide-ledge', center: [0, 0.5, 1], size: [4, 1, 2], topY: 1 };
const world = {
  movePlayer({ eyePosition }) { return { eyePosition: { ...eyePosition }, movement: { x: 0, y: 0, z: 0 }, grounded: true,
    collisions: [{ isWall: true, source: fixture.source, normal: { x: 0, y: 0, z: -1 }, point: { x: 0, y: 0.8, z: 0.4 }, toi: 0 }] }; },
  getWalkableCuboid(source) { return source === fixture.source ? fixture : null; },
  findCuboidTopSupport() { return fixture; },
  isCapsuleClearAt() { return true; },
};
const core = createControllerKataCore({ world, spawn: { x: 0, y: 1.68, z: 0 }, onEvent: (event) => events.push(event) });
core.setMove({ moveX: 0, moveY: 1 });
core.update(1 / 60);
assert.equal(core.state.mode, 'mantle', 'ordinary frontal contact must start mantle without angle finagling');
for (let i = 0; i < 30; i += 1) core.update(1 / 60);
assert.equal(core.state.mode, 'ground');
assert.ok(events.some((event) => event.type === 'mantle-start'));
assert.ok(events.some((event) => event.type === 'mantle-complete'));
assert.ok(core.state.position.y > 2.6);

console.log(JSON.stringify({ ok: true, contract: 'controller-kata-engine-terminal-boundary', terminal: 'noodle-svg', mantle: 'ordinary-frontal-contact' }));
