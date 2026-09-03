import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = file('../controller-kata.html');
const index = file('../index.html');
const main = file('../src/main.js');
const arena = file('../src/controller-kata.js');
const gridMaterial = file('../src/controller-grid-material.js');
const physics = file('../src/physics-world.js');
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

assert.match(html, /src=["']\.\/src\/main\.js\?v=0\.8\.216["']/, 'controller page must load the authoritative runtime');
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

assert.match(main, /createPhysicsWorld, ensurePhysicsReady/);
assert.match(main, /generateControllerArena/);
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

assert.match(main, /if \(!useControllerKataSlice\(\)\) \{\s*updateAttack\(dt\);/s);
assert.match(main, /if \(!useControllerKataSlice\(\)\) \{\s*renderer\.clearDepth\(\);\s*renderer\.render\(armsScene, armsCamera\);/s);
assert.match(main, /if \(useControllerKataSlice\(\)\) \{\s*attackButton\.hidden = true;/s);
assert.match(main, /if \(!useControllerKataSlice\(\)\) \{\s*loadArms\(\);\s*loadOrcBerserkerEnemy\(\);/s);

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
