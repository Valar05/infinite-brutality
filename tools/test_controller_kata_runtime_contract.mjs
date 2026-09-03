import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = file('../controller-kata.html');
const index = file('../index.html');
const main = file('../src/main.js');
const arena = file('../src/controller-kata.js');
const climb = file('../src/player-climb.js');
const productOne = file('../src/product-one-controller.js');
const productInput = file('../src/product-one-input-adapter.js');
const gridMaterial = file('../src/controller-grid-material.js');
const physics = file('../src/physics-world.js');
const simulator = file('../tools/qa_product_one_controller_simulator.mjs');
const mantleCourse = file('../src/generated/product-one-mantle-course.mjs');
const mantlePin = JSON.parse(file('../src/generated/product-one-mantle-course.pin.json'));
const license = file('../vendor/three/LICENSE');
const cloudWorkflow = file('../.github/workflows/controller-grid-visual-qa.yml');
const cloudCapture = file('../tools/github_controller_grid_visual_capture.mjs');
const forbiddenLegacySeed = ['v', 'l', 'a', 'd'].join('');

for (const path of [
  '../vendor/three/build/three.module.js',
  '../vendor/three/build/three.core.js',
  '../vendor/three/examples/jsm/loaders/GLTFLoader.js',
  '../vendor/three/examples/jsm/loaders/FBXLoader.js',
  '../vendor/three/LICENSE',
]) {
  assert.ok(existsSync(new URL(path, import.meta.url)), `self-contained vendor path is required: ${path}`);
}

for (const id of [
  'game',
  'status',
  'hint',
  'errorCopyButton',
  'leftStick',
  'actionPad',
  'jumpButton',
  'attackButton',
  'gyroButton',
  'fsButton',
  'healthBarFill',
  'healthValue',
  'damageFlash',
  'healthHud',
  'attackDebugHud',
  'attackDebugText',
  'readout',
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `controller shell must preserve main.js DOM id: ${id}`);
}

assert.match(html, /src=["']\.\/src\/main\.js\?v=0\.8\.222["']/, 'controller page must load the authoritative runtime');
assert.match(html, /rel=["']icon["'] href=["']\.\/assets\/textures\/ib-vector-hazard-20260609\.svg["']/, 'controller page must use a hosted repository favicon');
assert.doesNotMatch(html, /controller-kata-runtime\.js/, 'duplicated standalone movement runtime must not be active');
assert.doesNotMatch(html, /controller-kata\.css/, 'controller page must reuse the authoritative shell stylesheet');
assert.match(html, /"three"\s*:\s*"\.\/vendor\/three\/build\/three\.module\.js"/);
assert.match(html, /"three\/addons\/"\s*:\s*"\.\/vendor\/three\/examples\/jsm\/"/);
assert.match(index, /"three"\s*:\s*"\.\/vendor\/three\/build\/three\.module\.js"/);
assert.match(index, /"three\/addons\/"\s*:\s*"\.\/vendor\/three\/examples\/jsm\/"/);
assert.doesNotMatch(`${html}\n${index}`, /https?:\/\/|\.\.\/pose-lab\/vendor\/three/);

assert.match(main, /const ACTIVE_SLICE = URL_PARAMS\.get\('slice'\) \|\| 'controller_kata'/);
assert.match(main, /CONTROLLER_KATA_BASE_SEED = URL_PARAMS\.get\('seed'\) \|\| 'controller-proof'/);
assert.match(arena, /DEFAULT_ARENA_SEED = 'controller-proof'/);
assert.doesNotMatch(`${html}\n${main}\n${arena}`, new RegExp(forbiddenLegacySeed, 'i'));

assert.match(main, /createPhysicsWorld, ensurePhysicsReady \} from '\.\/physics-world\.js\?v=0\.8\.222'/);
assert.match(main, /generateControllerArena/);
assert.doesNotMatch(arena, /createDirectMantlePlan|advanceDirectMantle/, 'arena module must not reinvent mantle mechanics');
assert.match(climb, /export function createBoundedContactMantlePlan/);
assert.match(climb, /export function advanceConstrainedMantle/);
assert.match(main, /createProductOneController, PRODUCT_ONE_CAPABILITY_PROFILE, PRODUCT_ONE_PHYSICS_OPTIONS/);
assert.match(main, /productOneController\.input\.pressJump/);
assert.match(main, /productOneController\.input\.setMove/);
assert.match(main, /productOneController\.input\.update\(dt\)/);
assert.match(productInput, /@qa-production-adapter-v1 product-one-input move jump step/);
assert.match(productOne, /createProductOneInputAdapter/);
assert.doesNotMatch(productOne, /^\s+queueJump,$/m, 'controller must not expose direct jump bypass');
assert.match(arena, /product-one-mantle-course\.mjs/, 'arena must consume the Boxcraft data-only course');
assert.equal(mantlePin.commit, 'b4ff8625a0981ed39eb6d25a6ba88642b974e9b4');
assert.equal(mantlePin.courseHash, 'b4fbadc14e0b5be04285e02a21e361a5666d917b989bb99753b379f2cdfff969');
assert.match(mantleCourse, /BOXCRAFT MANTLE COURSE 1/);
assert.match(productOne, /export const PRODUCT_ONE_CAPABILITY_PROFILE/);
assert.match(productOne, /physicsWorld\.getWalkableCuboid/);
assert.doesNotMatch(productOne, /options\.fixture/, 'controller must not accept one privileged fixture');
assert.doesNotMatch(main, /arena\.directMantle|fixture: roomState\.controllerKataMantleProof\.fixture/, 'runtime must not privilege a directMantle fixture');
assert.match(productOne, /Product One owner boundary/);
assert.match(productOne, /export const PRODUCT_ONE_FIXED_DT = 1 \/ 60/);
assert.match(productOne, /gravity: Object\.freeze\(\{ x: 0, y: -PRODUCT_ONE_CAPABILITY_PROFILE\.gravity, z: 0 \}\)/);
assert.match(productOne, /characterOffset: 0\.035/);
assert.match(productOne, /playerFootInset: 0/);
assert.match(productOne, /autostepHeight: PRODUCT_ONE_CAPABILITY_PROFILE\.autostepHeight/);
assert.match(productOne, /autostepMinWidth: 0\.646/);
assert.match(productOne, /snapToGround: 0\.48/);
assert.match(productOne, /physicsWorld\.movePlayer/);
assert.match(productOne, /createBoundedContactMantlePlan/);
assert.match(productOne, /advanceConstrainedMantle/);
assert.match(main, /if \(!useControllerKataSlice\(\) && tryBeginClimb/);
assert.match(productOne, /Product One entered forbidden CLIMB state/);
assert.match(main, /for \(const fixture of arena\.traversal\.fixtures\)/);
assert.match(main, /addWalkableBox\(rootGroup, fixture\.id, fixture\.size, fixture\.center, fixtureMaterial/);
assert.match(simulator, /const arena = generateControllerArena\(\{ seed:/);
assert.match(simulator, /for \(const fixture of fixtures\)/);
assert.match(simulator, /mount\(arena\.floor, "controller-kata-floor"\)/);
assert.match(simulator, /physics\.addCuboid\(\{ size: record\.size, position: record\.center, source, kind: "walkable" \}\)/);
assert.doesNotMatch(simulator, /qa-low-edge|qa-stair-|qa-tall-ledge/, "simulator must not invent nearby traversal geometry");
assert.match(simulator, /playable course fixture withheld/);
assert.match(simulator, /single-fixture-only/);
assert.match(simulator, /randomMantleFixture/);

assert.match(main, /applyWorldGridOverlay/);
assert.match(main, /new THREE\.GridHelper\(arena\.floor\.size\[0\], arena\.floor\.size\[0\] \/ arena\.grid\.step,/);
assert.match(main, /grid\.name = 'controller-kata-grid-helper'/, 'controller proof must expose the visible GridHelper marker');
assert.match(main, /grid\.position\.y = arena\.floor\.center\[1\] \+ arena\.floor\.size\[1\] \* 0\.5 \+ 0\.04 \+ 0\.01/);
assert.match(main, /grid\.material\.depthWrite = false/);
assert.match(main, /window\.__infiniteBrutalityControllerGrid = grid/);
assert.match(main, /function useControllerKataSlice\(\)/);
assert.match(main, /if \(useControllerKataSlice\(\)\) \{\s*buildControllerKataSlice\(movePlayer, rootGroup\);\s*return;/s);
assert.match(main, /for \(const cube of arena\.cubes\) addWalkableBox\(rootGroup, cube\.id, cube\.size, cube\.center,/);
assert.match(main, /function addWalkableBox[\s\S]*?addBeveledBox\(parent, name, size, pos,[\s\S]*?registerPrimitivePhysicsBox\(name, size, pos,/);
assert.match(gridMaterial, /export function applyWorldGridOverlay/);
assert.match(physics, /world\.timestep = 1 \/ 60/);
assert.match(physics, /controller\.computeColliderMovement/);
assert.match(physics, /options\.playerFootInset \?\? 0\.15/);
assert.match(physics, /Math\.max\(playerFootInset, 0\.001\)/);
assert.match(physics, /const getWalkableCuboid/);
assert.match(physics, /const findCuboidTopSupport/);
assert.match(physics, /const isCapsuleClearAt/);
assert.match(productOne, /physicsWorld\.findCuboidTopSupport/);
assert.match(productOne, /physicsWorld\.isCapsuleClearAt/);

assert.match(main, /if \(!useControllerKataSlice\(\)\) \{\s*updateAttack\(dt\);/s);
assert.match(main, /updateArms\(dt\);/);
assert.match(main, /renderer\.clearDepth\(\);\s*renderer\.render\(armsScene, armsCamera\);/s);
assert.match(main, /if \(useControllerKataSlice\(\)\) \{\s*attackButton\.hidden = true;/s);
assert.match(main, /loadArms\(\);\s*if \(!useControllerKataSlice\(\)\) \{\s*loadOrcBerserkerEnemy\(\);/s);
assert.doesNotMatch(main, /input\.lookPointer = event\.pointerId;\s*input\.lastLookX[\s\S]{0,120}if \(button === attackButton\)/, 'action buttons must not steal look pointer ownership');
assert.match(arena, /PLAYABLE_MANTLE_SCENARIO[\s\S]*scenario-high-mantle/);

assert.match(license, /The MIT License/);
assert.match(license, /Copyright © 2010-2026 three\.js authors/);
assert.match(license, /Permission is hereby granted, free of charge/);

assert.match(cloudWorkflow, /workflow_dispatch:/);
assert.match(cloudWorkflow, /description: Exact hosted Product One controller-grid URL/);
assert.match(cloudWorkflow, /required: true/);
assert.match(cloudWorkflow, /node-version: 22/);
assert.match(cloudWorkflow, /PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD/);
assert.match(cloudWorkflow, /google-chrome --version/);
assert.match(cloudWorkflow, /github_controller_grid_visual_capture\.mjs/);
assert.match(cloudWorkflow, /actions\/upload-artifact@v4/);
assert.equal((cloudCapture.match(/page\.goto\(/g) || []).length, 1, 'cloud capture may navigate only to the supplied hosted URL');
assert.match(cloudCapture, /page\.goto\(args\.url/);
assert.match(cloudCapture, /status\.includes\('controller kata'\)/);
assert.match(cloudCapture, /controllerGrid: gridHelper/);
assert.match(cloudCapture, /grid\.type !== 'GridHelper'/);
assert.match(cloudCapture, /!grid\.visibleInScene/);
assert.match(cloudCapture, /page\.keyboard\.down\('w'\)/);
assert.match(cloudCapture, /window\.__infiniteBrutalityControllerMantle/);
assert.match(cloudCapture, /entry\.role === 'high-mantle'/);
assert.match(cloudCapture, /mantleProof\.currentPosition/);
assert.match(cloudCapture, /page\.keyboard\.down\('a'\)/);
assert.match(cloudCapture, /proof\?\.starts === 0 && Array\.isArray\(proof\.currentPosition\)/);
assert.match(cloudCapture, /Boxcraft dynamic mantle proof instrumentation is missing/);
assert.match(cloudCapture, /proof\?\.starts >= 1/);
assert.match(cloudCapture, /proof\?\.completions >= 1/);
assert.ok(
  cloudCapture.indexOf("page.keyboard.down('a')")
    < cloudCapture.indexOf("page.keyboard.down('w')")
  && cloudCapture.indexOf("page.keyboard.down('w')")
    < cloudCapture.indexOf("page.keyboard.press('Space')")
  && cloudCapture.indexOf("page.keyboard.press('Space')")
    < cloudCapture.indexOf("proof?.starts >= 1"),
  'cloud replay must reach grounded contact, then jump, then observe mantle start',
);
assert.match(cloudCapture, /completed mantle violated constrained contact\/support bounds/);
assert.match(cloudCapture, /mantleStartSurface/);
assert.doesNotMatch(cloudCapture, /controller-kata-direct-mantle/);
assert.match(cloudCapture, /entered forbidden CLIMB state/);
assert.match(cloudCapture, /page\.keyboard\.press\('Space'\)/);
assert.match(cloudCapture, /initial-hosted\.png/);
assert.match(cloudCapture, /after-keyboard-input\.png/);
assert.match(cloudCapture, /visual_qa_manifest\.json/);
assert.match(cloudCapture, /process\.exitCode = 1/);

console.log(JSON.stringify({
  ok: true,
  contract: 'controller-kata-authoritative-runtime',
  runtime: 'src/main.js',
  collision: 'src/physics-world.js',
  vendor: 'vendor/three',
}));
