import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GENERATED_ROOM_BATCH } from './generated_room_batch.js';

const BUILD = '0.8.63';
const USE_DYNAMIC_SHADOWS = false;
const USE_DYNAMIC_DIEGETIC_LIGHTS = false;
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const readoutEl = document.getElementById('readout');
const hintEl = document.getElementById('hint');
const leftStick = document.getElementById('leftStick');
const stickKnob = leftStick.querySelector('div');
const actionPad = document.getElementById('actionPad');
const attackButton = document.getElementById('attackButton');
const jumpButton = document.getElementById('jumpButton');
const gyroButton = document.getElementById('gyroButton');
const fsButton = document.getElementById('fsButton');

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
  setStatus('runtime error: ' + (event.error?.message || event.message || 'unknown'));
  hintEl.textContent = 'Runtime error: ' + (event.error?.message || event.message || 'unknown');
  hintEl.style.opacity = '1';
});
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  setStatus('promise error: ' + (event.reason?.message || event.reason || 'unknown'));
  hintEl.textContent = 'Promise error: ' + (event.reason?.message || event.reason || 'unknown');
  hintEl.style.opacity = '1';
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.35, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = USE_DYNAMIC_SHADOWS;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111722);
scene.fog = new THREE.FogExp2(0x1a2230, 0.0068);

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 160);
camera.rotation.order = 'YXZ';

const armsScene = new THREE.Scene();
const armsCamera = new THREE.PerspectiveCamera(82, 1, 0.01, 12);
armsCamera.up.set(0, 1, 0);
armsCamera.lookAt(0, 0, 1);
armsScene.add(new THREE.HemisphereLight(0xf2e8d3, 0x1b1110, 1.25));
const armsKey = new THREE.DirectionalLight(0xffffff, 1.4);
armsKey.position.set(-1.5, 2.5, -2);
armsScene.add(armsKey);

const clock = new THREE.Clock();
const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const world = new THREE.Group();
scene.add(world);
let roomGroup = new THREE.Group();
world.add(roomGroup);
const batchBuildOffset = new THREE.Vector3();

const JUMP_CHARGE_MAX = 0.18;
const PLAYER_EYE_HEIGHT = 1.68;
const WALK_JUMP_BASE_HEIGHT = 7.1;
const WALK_JUMP_CHARGE_HEIGHT = 0.95;
const RUN_JUMP_HORIZONTAL_BOOST = 4.45;
const RUN_JUMP_VERTICAL_BOOST = 0.5;
const JUMP_HOLD_ACCEL = 11.75;
const GROUND_ACCEL = 28;
const GROUND_FRICTION = 13.5;
const AIR_ACCEL = 10.5;
const GROUND_WISH_SPEED = 5.2;
const RUN_WISH_SPEED = 8.8;
const AIR_WISH_SPEED = 6.8;
const KILL_Y = -10;
const RUN_BUILD_TIME = 1.0;
const SUPPORT_RADIUS = 0.56;
const SUPPORT_SNAP_UP = 0.92;
const SUPPORT_SNAP_DOWN = 1.65;
const WALKABLE_STEP_FORWARD_REACH = 0.72;
const STICK_RESPONSE = 1.28;
const MOVE_INPUT_SMOOTH_GROUND = 13.5;
const MOVE_INPUT_SMOOTH_AIR = 9.5;
const CAMERA_GROUND_SMOOTH = 18.0;
const CAMERA_AIR_SMOOTH = 26.0;
const AIR_CRUISE_SPEED = 6.2;
const AIR_MAX_SPEED = 8.8;
const AIR_TURN_ACCEL = 14.0;
const AIR_BRAKE_ACCEL = 19.5;
const AIR_DRAG = 3.4;
const PLAYER_SOLID_RADIUS = 0.38;
const CLIMB_ATTACH_DISTANCE = 0.58;
const CLIMB_FACE_OFFSET = 0.52;
const CLIMB_SPEED_VERTICAL = 2.45;
const CLIMB_SPEED_HORIZONTAL = 2.1;
const CLIMB_MIN_HEIGHT = 1.25;
const CLIMB_MIN_TOP_SIZE = 0.9;
const CLIMB_TOP_OUT_THRESHOLD = 0.22;
const CLIMB_MANTLE_DURATION = 0.34;
const CLIMB_MANTLE_FORWARD = 0.48;
const CLIMB_DETACH_UP = 4.6;
const CLIMB_DETACH_BACK = 2.8;

const player = {
  position: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, -8.4),
  visualPosition: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, -8.4),
  velocity: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: true,
  mode: 'ground',
  climb: null,
  mantle: null,
  bob: 0,
  stepClock: 0,
  attackTimer: 0,
  attack: null,
  comboIndex: 0,
  comboTimer: 0,
  isRunning: false,
  runCharge: 0,
  lastRunIntent: false,
  hitPause: 0,
  healthPulse: 0,
};

const walkableSurfaces = [];
const solidColliders = [];
const diegeticLights = [];
const bootParams = new URLSearchParams(window.location.search);
if (bootParams.has('reset')) {
  localStorage.setItem('infinite-brutality-level-index', '0');
  localStorage.setItem('infinite-brutality-node-index', '0');
}
if (bootParams.has('room')) {
  const roomIndex = clamp(Number(bootParams.get('room') || 1) - 1, 0, GENERATED_ROOM_BATCH.length - 1);
  localStorage.setItem('infinite-brutality-node-index', String(Math.floor(roomIndex)));
}
const roomState = {
  levelIndex: Number(localStorage.getItem('infinite-brutality-level-index') || 0) || 0,
  nodeIndex: Number(localStorage.getItem('infinite-brutality-node-index') || 0) || 0,
  seed: 0,
  plan: null,
  spec: null,
  exit: new THREE.Vector3(),
  exitRadius: 2.5,
  spawn: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, -8.4),
  transitionLock: 0,
  enemyPositions: [],
  districtPlan: null,
  gauntletRooms: [],
  navGraph: null,
  connectivityRepair: null,
};

const SHOW_NAV_LINKS = bootParams.get('links') === '1';
const navDebug = {
  graphGroup: new THREE.Group(),
  routeGroup: new THREE.Group(),
};
navDebug.graphGroup.name = 'nav-graph-debug';
navDebug.routeGroup.name = 'nav-route-debug';
scene.add(navDebug.graphGroup);
scene.add(navDebug.routeGroup);

const input = {
  moveX: 0,
  moveY: 0,
  smoothMoveX: 0,
  smoothMoveY: 0,
  stickPointer: null,
  lookPointer: null,
  lastLookX: 0,
  lastLookY: 0,
  gyro: false,
  gyroYaw: 0,
  gyroPitch: 0,
  gyroBaseGamma: null,
  gyroBaseBeta: null,
  attackPointerId: null,
  jumpPointerId: null,
  jumpHoldStart: 0,
  jumpCharging: false,
};

let audioCtx = null;
let armsModel = null;
let armsMixer = null;
let armsCameraBone = null;
let activeArmAction = null;
let idleAction = null;
let walkAction = null;
let jumpAction = null;
let runAction = null;
let climbIdleAction = null;
let climbUpAction = null;
let climbLeftAction = null;
let climbRightAction = null;
let mantleAction = null;
let attackAction = null;
let sprintAttackAction = null;
let airAttackAction = null;
let airForwardAttackAction = null;
let crouchAttackAction = null;
let normalAttackDefs = [];
let sprintAttackDef = null;
let airAttackDef = null;
let airForwardAttackDef = null;
let crouchAttackDef = null;

function setStatus(text) {
  statusEl.textContent = 'build ' + BUILD + ' | ' + text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cameraForwardYaw(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function cameraRightYaw(yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

function makeMat(color, roughness = 0.86, metalness = 0.04, lift = 0.055) {
  return new THREE.MeshLambertMaterial({
    color,
    fog: true,
    emissive: new THREE.Color(color).multiplyScalar(lift),
    flatShading: true,
  });
}

function makeGlowMat(color, intensity = 1.8) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function makeLightPoolMat(color, opacity = 0.22) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
}

const MAT = {
  floor: makeMat(0x657382, 0.86, 0.04, 0.07),
  wall: makeMat(0x2b3542, 0.9, 0.02, 0.045),
  platform: makeMat(0x83909b, 0.82, 0.04, 0.065),
  connectorFloor: makeMat(0x70818a, 0.84, 0.04, 0.07),
  connectorWall: makeMat(0x2b3542, 0.9, 0.02, 0.045),
  bridge: makeMat(0x9a7937, 0.74, 0.12, 0.06),
  trim: makeMat(0xcbbd91, 0.78, 0.04, 0.07),
  void: makeMat(0x202735, 0.95, 0.0, 0.035),
  hazard: makeMat(0xc24d27, 0.66, 0.02, 0.08),
  exit: makeMat(0x8de2b5, 0.66, 0.04, 0.08),
  stone: makeMat(0x657382, 0.86, 0.04, 0.07),
  stone2: makeMat(0x83909b, 0.82, 0.04, 0.065),
  bronze: makeMat(0x9a7937, 0.74, 0.12, 0.06),
  blood: makeMat(0x8a2020, 0.8, 0.02, 0.055),
  bloodDark: makeMat(0x3c0b0e, 0.88, 0.01, 0.035),
  bone: makeMat(0xd4c8ab, 0.8, 0.02, 0.07),
  bonePlain: makeMat(0xb9aa88, 0.84, 0.02, 0.055),
  green: makeMat(0x79d49a, 0.66, 0.05, 0.07),
  orange: makeMat(0xc24d27, 0.5, 0.02, 0.08),
  flame: makeGlowMat(0xffb04a, 2.4),
  corpsefire: makeGlowMat(0x8ee8df, 2.0),
  flamePool: makeLightPoolMat(0xff9a2f, 0.0),
  corpsefirePool: makeLightPoolMat(0x7df4e9, 0.0),
  hazardPool: makeLightPoolMat(0xb85a22, 0.0),
  flesh: makeMat(0xc7a183, 0.84, 0.02),
  iron: makeMat(0x2b2f34, 0.62, 0.06, 0.045),
};

function setMaterialUvScale(mat, scale) {
  mat.userData.uvScale = scale;
  return mat;
}

for (const mat of [MAT.floor, MAT.wall, MAT.platform, MAT.connectorFloor, MAT.connectorWall, MAT.stone, MAT.stone2]) setMaterialUvScale(mat, 0.125);
for (const mat of [MAT.bridge, MAT.trim, MAT.bronze]) setMaterialUvScale(mat, 0.105);
for (const mat of [MAT.bone, MAT.bonePlain]) setMaterialUvScale(mat, 0.112);
setMaterialUvScale(MAT.iron, 0.075);
setMaterialUvScale(MAT.blood, 0.055);

function makeVoronoiTexture(seed, options = {}) {
  const size = options.size ?? 96;
  const cells = options.cells ?? 18;
  const base = options.base ?? 0.76;
  const contrast = options.contrast ?? 0.18;
  const edgeDarken = options.edgeDarken ?? 0.28;
  const edgeScale = options.edgeScale ?? 0.038;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = size;
  ctx.canvas.height = size;
  const rng = rngFromSeed(seed);
  const sites = [];
  for (let i = 0; i < cells; i += 1) {
    sites.push({ x: rng() * size, y: rng() * size, tint: 0.92 + rng() * 0.16 });
  }
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let d1 = Infinity;
      let d2 = Infinity;
      let tint = 1;
      for (const site of sites) {
        const dx = x - site.x;
        const dy = y - site.y;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          tint = site.tint;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const cell = Math.min(1, Math.sqrt(d1) / (size * 0.34));
      const border = Math.max(0, Math.min(1, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / (size * edgeScale)));
      const grain = ((x * 13 + y * 7 + seed) % 11) / 10 - 0.5;
      const value = Math.max(0.08, Math.min(0.98, (base - cell * contrast - border * edgeDarken) * tint + grain * 0.022));
      const idx = (y * size + x) * 4;
      const c = Math.floor(value * 255);
      image.data[idx] = c;
      image.data[idx + 1] = c;
      image.data[idx + 2] = c;
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function applyProceduralSurfaceTextures() {
  const floorNoise = makeVoronoiTexture(0x11a2d3, { size: 96, cells: 22, base: 0.82, contrast: 0.12, edgeDarken: 0.16, edgeScale: 0.032, repeatX: 4, repeatY: 4 });
  const wallNoise = makeVoronoiTexture(0x334455, { size: 96, cells: 24, base: 0.74, contrast: 0.16, edgeDarken: 0.22, edgeScale: 0.032, repeatX: 5, repeatY: 4 });
  const bronzeNoise = makeVoronoiTexture(0x7b5a26, { size: 96, cells: 16, base: 0.92, contrast: 0.07, edgeDarken: 0.1, edgeScale: 0.04, repeatX: 3, repeatY: 3 });
  const boneNoise = makeVoronoiTexture(0xd4c8ab, { size: 96, cells: 18, base: 0.88, contrast: 0.1, edgeDarken: 0.12, edgeScale: 0.036, repeatX: 3, repeatY: 3 });
  const ironNoise = makeVoronoiTexture(0x444746, { size: 96, cells: 20, base: 0.72, contrast: 0.12, edgeDarken: 0.18, edgeScale: 0.036, repeatX: 3, repeatY: 3 });
  for (const mat of [MAT.floor, MAT.stone, MAT.connectorFloor]) {
    mat.map = floorNoise;
    mat.needsUpdate = true;
  }
  for (const mat of [MAT.wall, MAT.connectorWall, MAT.platform, MAT.stone2]) {
    mat.map = mat === MAT.wall || mat === MAT.connectorWall ? wallNoise : floorNoise;
    mat.needsUpdate = true;
  }
  for (const mat of [MAT.bronze, MAT.bridge, MAT.trim]) {
    mat.map = bronzeNoise;
    mat.needsUpdate = true;
  }
  MAT.bone.map = boneNoise;
  MAT.bone.needsUpdate = true;
  MAT.iron.map = ironNoise;
  MAT.iron.needsUpdate = true;
}

function loadWrappedTexture(path, repeatX, repeatY, onTexture) {
  const url = new URL(path, import.meta.url).href;
  textureLoader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy?.() || 1);
    texture.needsUpdate = true;
    onTexture(texture);
  }, undefined, (error) => {
    console.warn('surface texture failed; procedural fallback remains', path, error);
  });
}

function applyTextureToMaterials(texture, materials, tint = 0xffffff) {
  for (const mat of materials) {
    mat.map = texture;
    mat.color.setHex(tint);
    mat.needsUpdate = true;
  }
}

function applyGeneratedSurfaceTextures() {
  loadWrappedTexture('../assets/textures/ib-vector-stone-20260608.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.floor, MAT.wall, MAT.platform, MAT.connectorFloor, MAT.connectorWall, MAT.stone, MAT.stone2], 0xffffff);
  });
  loadWrappedTexture('../assets/textures/ib-vector-bronze-20260608.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.bridge, MAT.trim, MAT.bronze], 0xffffff);
  });
  loadWrappedTexture('../assets/textures/ib-vector-bone-20260608.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.bone, MAT.bonePlain], 0xd4c39f);
  });
  loadWrappedTexture('../assets/textures/ib-vector-iron-20260609.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.iron], 0xc7d0d6);
  });
  loadWrappedTexture('../assets/textures/ib-vector-blood-20260609.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.blood, MAT.bloodDark], 0xffffff);
  });
  loadWrappedTexture('../assets/textures/ib-vector-flesh-20260609.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.flesh], 0xe3c3ae);
  });
  loadWrappedTexture('../assets/textures/ib-vector-hazard-20260609.svg', 1, 1, (texture) => {
    applyTextureToMaterials(texture, [MAT.hazard, MAT.orange], 0xffffff);
  });
}

applyProceduralSurfaceTextures();
applyGeneratedSurfaceTextures();

function loadSkyDomeTexture(material) {
  const url = new URL('../assets/textures/ib-real-limbo-skybox-20260609.png', import.meta.url).href;
  textureLoader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    material.map = texture;
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
  }, undefined, (error) => {
    console.warn('vector sky texture failed; flat fallback remains', error);
  });
}

function buildLimboSkyDome() {
  const geometry = new THREE.SphereGeometry(145, 36, 18);
  const material = new THREE.MeshBasicMaterial({
    color: 0x182133,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  loadSkyDomeTexture(material);
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'limbo-sky-dome';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  return dome;
}

const skyDome = buildLimboSkyDome();
scene.add(skyDome);


function applyWorldProjectedUvs(geometry, scale) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const uvs = [];
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    if (ny >= nx && ny >= nz) uvs.push(x * scale, z * scale);
    else if (nx >= nz) uvs.push(z * scale, y * scale);
    else uvs.push(x * scale, y * scale);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

function materialUvScale(mat) {
  return mat?.userData?.uvScale ?? 0.1;
}

function offsetArray(pos) {
  return [pos[0] + batchBuildOffset.x, pos[1] + batchBuildOffset.y, pos[2] + batchBuildOffset.z];
}

function offsetVec(vec) {
  return makeVec(vec.x + batchBuildOffset.x, vec.y + batchBuildOffset.y, vec.z + batchBuildOffset.z);
}

function withBatchBuildOffset(offset, buildFn) {
  const previous = batchBuildOffset.clone();
  batchBuildOffset.copy(offset);
  try { return buildFn(); }
  finally { batchBuildOffset.copy(previous); }
}

function addBox(parent, name, size, pos, mat, cast = true) {
  const geo = applyWorldProjectedUvs(new THREE.BoxGeometry(size[0], size[1], size[2]), materialUvScale(mat));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(pos[0] + batchBuildOffset.x, pos[1] + batchBuildOffset.y, pos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function makeBeveledBoxGeometry(size, bevel = 0.06, bevelSegments = 2) {
  const width = size[0];
  const height = size[1];
  const depth = size[2];
  const inset = Math.max(0.001, Math.min(bevel, width * 0.24, height * 0.24, depth * 0.24));
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + inset, -height / 2);
  shape.lineTo(width / 2 - inset, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + inset);
  shape.lineTo(width / 2, height / 2 - inset);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - inset, height / 2);
  shape.lineTo(-width / 2 + inset, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - inset);
  shape.lineTo(-width / 2, -height / 2 + inset);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + inset, -height / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: inset,
    bevelSize: inset,
    bevelSegments,
    curveSegments: 4,
  });
  geo.center();
  return geo;
}

function addBeveledBox(parent, name, size, pos, mat, cast = true, bevel = 0.06, bevelSegments = 2) {
  const geo = applyWorldProjectedUvs(makeBeveledBoxGeometry(size, bevel, bevelSegments), materialUvScale(mat));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(pos[0] + batchBuildOffset.x, pos[1] + batchBuildOffset.y, pos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function addDeformedCube(parent, name, points, depth, pos, mat, cast = true) {
  const halfDepth = depth * 0.5;
  const vertices = [];
  const uvs = [];
  const uvScale = materialUvScale(mat);
  for (const p of points) {
    vertices.push(p[0], p[1], -halfDepth);
    uvs.push(p[0] * uvScale, p[1] * uvScale);
  }
  for (const p of points) {
    vertices.push(p[0], p[1], halfDepth);
    uvs.push(p[0] * uvScale, p[1] * uvScale);
  }

  const indices = [];
  for (let i = 1; i < points.length - 1; i += 1) indices.push(0, i, i + 1);
  const backOffset = points.length;
  for (let i = 1; i < points.length - 1; i += 1) indices.push(backOffset, backOffset + i + 1, backOffset + i);
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    indices.push(i, next, backOffset + next);
    indices.push(i, backOffset + next, backOffset + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(pos[0] + batchBuildOffset.x, pos[1] + batchBuildOffset.y, pos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function addExtrudedPolygon(parent, name, points, depth, pos, mat, cast = true) {
  return addDeformedCube(parent, name, points, depth, pos, mat, cast);
}

function addCylinder(parent, name, radius, depth, pos, mat, radial = 6) {  const geo = new THREE.CylinderGeometry(radius, radius, depth, radial, 1, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(pos[0] + batchBuildOffset.x, pos[1] + batchBuildOffset.y, pos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function anchorGeometryBottomCenter(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  geometry.translate(
    -((box.min.x + box.max.x) * 0.5),
    -box.min.y,
    -((box.min.z + box.max.z) * 0.5),
  );
  return geometry;
}

function addGroundedBox(parent, name, size, basePos, mat, cast = true) {
  const geo = anchorGeometryBottomCenter(new THREE.BoxGeometry(size[0], size[1], size[2]));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(basePos[0] + batchBuildOffset.x, basePos[1] + batchBuildOffset.y, basePos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function addGroundedBeveledBox(parent, name, size, basePos, mat, cast = true, bevel = 0.06, bevelSegments = 2) {
  const geo = anchorGeometryBottomCenter(makeBeveledBoxGeometry(size, bevel, bevelSegments));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(basePos[0] + batchBuildOffset.x, basePos[1] + batchBuildOffset.y, basePos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function addGroundedCylinder(parent, name, radius, depth, basePos, mat, radial = 6) {
  const geo = anchorGeometryBottomCenter(new THREE.CylinderGeometry(radius, radius, depth, radial, 1, false));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(basePos[0] + batchBuildOffset.x, basePos[1] + batchBuildOffset.y, basePos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function worldOffset() {
  const base = roomGroup?.position || new THREE.Vector3();
  return makeVec(base.x + batchBuildOffset.x, base.y + batchBuildOffset.y, base.z + batchBuildOffset.z);
}

function registerWalkable(size, pos, margin = 0.12, options = {}) {
  const offset = worldOffset();
  const centerX = pos[0] + offset.x;
  const centerY = pos[1] + offset.y;
  const centerZ = pos[2] + offset.z;
  walkableSurfaces.push({
    centerX,
    centerY,
    centerZ,
    sizeX: size[0],
    sizeY: size[1],
    sizeZ: size[2],
    minX: centerX - size[0] / 2 + margin,
    maxX: centerX + size[0] / 2 - margin,
    minZ: centerZ - size[2] / 2 + margin,
    maxZ: centerZ + size[2] / 2 - margin,
    topY: centerY + size[1] / 2,
    source: options.source || '',
    traversalCritical: !!options.traversalCritical,
  });
}

function registerSolid(size, pos, margin = 0.0, options = {}) {
  const offset = worldOffset();
  const centerX = pos[0] + offset.x;
  const centerY = pos[1] + offset.y;
  const centerZ = pos[2] + offset.z;
  solidColliders.push({
    centerX,
    centerY,
    centerZ,
    sizeX: size[0],
    sizeY: size[1],
    sizeZ: size[2],
    minX: centerX - size[0] / 2 - margin,
    maxX: centerX + size[0] / 2 + margin,
    minY: centerY - size[1] / 2,
    maxY: centerY + size[1] / 2,
    minZ: centerZ - size[2] / 2 - margin,
    maxZ: centerZ + size[2] / 2 + margin,
    stepHeight: Number.isFinite(options.stepHeight) ? options.stepHeight : 0,
  });
}

function addWallBox(parent, name, size, pos, mat, cast = false) {
  const mesh = addBox(parent, name, size, pos, mat, cast);
  registerSolid(size, pos, 0.02);
  return mesh;
}

function addPortalWall(parent, prefix, z, width, height, mat, gapWidth = 6.4) {
  const sideWidth = Math.max(0.1, (width - gapWidth) * 0.5);
  const x = gapWidth * 0.5 + sideWidth * 0.5;
  addWallBox(parent, prefix + '-left', [sideWidth, height, 0.5], [-x, height * 0.5, z], mat, false);
  addWallBox(parent, prefix + '-right', [sideWidth, height, 0.5], [x, height * 0.5, z], mat, false);
  addWallBox(parent, prefix + '-lintel', [gapWidth, Math.max(0.8, height - 4.2), 0.5], [0, 4.2 + Math.max(0.8, height - 4.2) * 0.5, z], mat, false);
  addBeveledBox(parent, prefix + '-threshold', [gapWidth + 1.2, 0.22, 0.72], [0, 0.11, z], MAT.trim, false, 0.025, 1);
}

function addSidePortalWall(parent, prefix, x, depth, height, mat, gapWidth = 6.4) {
  const sideDepth = Math.max(0.1, (depth - gapWidth) * 0.5);
  const z = gapWidth * 0.5 + sideDepth * 0.5;
  addWallBox(parent, prefix + '-front', [0.5, height, sideDepth], [x, height * 0.5, -z], mat, false);
  addWallBox(parent, prefix + '-back', [0.5, height, sideDepth], [x, height * 0.5, z], mat, false);
  addWallBox(parent, prefix + '-lintel', [0.5, Math.max(0.8, height - 4.2), gapWidth], [x, 4.2 + Math.max(0.8, height - 4.2) * 0.5, 0], mat, false);
  addBeveledBox(parent, prefix + '-threshold', [0.72, 0.22, gapWidth + 1.2], [x, 0.11, 0], MAT.trim, false, 0.025, 1);
}

function addFullWall(parent, prefix, side, width, depth, height, mat) {
  if (side === 'north') addWallBox(parent, prefix, [width, height, 0.5], [0, height * 0.5, depth / 2], mat, false);
  if (side === 'south') addWallBox(parent, prefix, [width, height, 0.5], [0, height * 0.5, -depth / 2], mat, false);
  if (side === 'west') addWallBox(parent, prefix, [0.5, height, depth], [-width / 2, height * 0.5, 0], mat, false);
  if (side === 'east') addWallBox(parent, prefix, [0.5, height, depth], [width / 2, height * 0.5, 0], mat, false);
}

function addSealedPortal(parent, prefix, side, width, depth, height, mat) {
  addFullWall(parent, prefix + '-solid', side, width, depth, height, mat);
  const z = side === 'north' ? depth / 2 - 0.28 : -depth / 2 + 0.28;
  const x = side === 'east' ? width / 2 - 0.28 : -width / 2 + 0.28;
  if (side === 'north' || side === 'south') {
    addBeveledBox(parent, prefix + '-blocked-arch', [4.8, 3.0, 0.22], [0, 1.5, z], MAT.connectorWall, false, 0.04, 1);
    addBeveledBox(parent, prefix + '-seal-cross', [5.4, 0.24, 0.3], [0, 2.45, z + (side === 'north' ? -0.04 : 0.04)], MAT.trim, false, 0.03, 1);
    addRubbleLine(parent, prefix + '-rubble', side, width, depth, 0);
  } else {
    addBeveledBox(parent, prefix + '-blocked-arch', [0.22, 3.0, 4.8], [x, 1.5, 0], MAT.connectorWall, false, 0.04, 1);
    addBeveledBox(parent, prefix + '-seal-cross', [0.3, 0.24, 5.4], [x + (side === 'east' ? -0.04 : 0.04), 2.45, 0], MAT.trim, false, 0.03, 1);
    addRubbleLine(parent, prefix + '-rubble', side, width, depth, 0);
  }
}

function addRubbleLine(parent, prefix, side, width, depth, baseY) {
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const t = (i - (count - 1) * 0.5) / count;
    const sx = 0.42 + (i % 2) * 0.22;
    const h = 0.2 + (i % 3) * 0.08;
    const mat = i % 2 ? MAT.platform : MAT.trim;
    if (side === 'north' || side === 'south') {
      const z = side === 'north' ? depth / 2 - 0.66 : -depth / 2 + 0.66;
      addGroundedBeveledBox(parent, prefix + '-' + i, [sx, h, 0.42], [t * 5.4, baseY, z], mat, true, 0.02, 1);
    } else {
      const x = side === 'east' ? width / 2 - 0.66 : -width / 2 + 0.66;
      addGroundedBeveledBox(parent, prefix + '-' + i, [0.42, h, sx], [x, baseY, t * 5.4], mat, true, 0.02, 1);
    }
  }
}

function addCeilingFrame(parent, prefix, width, depth, mat = MAT.wall) {
  const y = 8.9;
  addBeveledBox(parent, prefix + '-north', [width, 0.58, 1.1], [0, y, depth / 2 - 0.58], mat, false, 0.04, 1);
  addBeveledBox(parent, prefix + '-south', [width, 0.58, 1.1], [0, y, -depth / 2 + 0.58], mat, false, 0.04, 1);
  addBeveledBox(parent, prefix + '-west', [1.1, 0.58, depth], [-width / 2 + 0.58, y, 0], mat, false, 0.04, 1);
  addBeveledBox(parent, prefix + '-east', [1.1, 0.58, depth], [width / 2 - 0.58, y, 0], mat, false, 0.04, 1);
  const ribCount = Math.max(2, Math.floor(depth / 11));
  for (let i = 1; i <= ribCount; i += 1) {
    const z = -depth / 2 + (depth * i) / (ribCount + 1);
    addBeveledBox(parent, prefix + '-rib-' + i, [width * 0.62, 0.34, 0.44], [0, y - 0.42, z], MAT.connectorWall, false, 0.03, 1);
  }
}

function addRoomShell(parent, width, depth, mat = MAT.stone, options = {}) {
  const height = 10;
  const openSides = options.openSides || new Set(['north', 'south', 'west', 'east']);
  const isOpen = (side) => openSides === 'all' || openSides.has?.(side);
  if (isOpen('north')) addPortalWall(parent, 'north-wall', depth / 2, width, height, mat); else addSealedPortal(parent, 'north-wall', 'north', width, depth, height, mat);
  if (isOpen('south')) addPortalWall(parent, 'south-wall', -depth / 2, width, height, mat); else addSealedPortal(parent, 'south-wall', 'south', width, depth, height, mat);
  if (isOpen('west')) addSidePortalWall(parent, 'west-wall', -width / 2, depth, height, mat); else addSealedPortal(parent, 'west-wall', 'west', width, depth, height, mat);
  if (isOpen('east')) addSidePortalWall(parent, 'east-wall', width / 2, depth, height, mat); else addSealedPortal(parent, 'east-wall', 'east', width, depth, height, mat);
  addCeilingFrame(parent, 'ceiling-frame', width, depth, mat);
}

function addWalkableBox(parent, name, size, pos, mat, cast = true, margin = 0.12, options = null) {
  const mesh = addBeveledBox(parent, name, size, pos, mat, cast, 0.04, 1);
  registerWalkable(size, pos, margin, options || {});
  return mesh;
}

function clearGroup(group) {
  while (group.children.length) group.remove(group.children[0]);
}

function resetWalkableBounds() {
  walkableSurfaces.length = 0;
  solidColliders.length = 0;
  diegeticLights.length = 0;
}

function rngFromSeed(seed) {
  let t = seed >>> 0;
  if (t === 0) t = 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

function hashRoomKey(key) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length) % items.length];
}

function makeVec(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

function levelIndexKey() {
  return 'infinite-brutality-level-index';
}

function nodeIndexKey() {
  return 'infinite-brutality-node-index';
}

function levelSeedKey(index) {
  return 'infinite-brutality-level-seed-' + index;
}

function setLevelIndex(value) {
  localStorage.setItem(levelIndexKey(), String(value));
}

function setNodeIndex(value) {
  localStorage.setItem(nodeIndexKey(), String(value));
}

const ROOM_LIBRARY = {
  chasm: {
    names: ['Chasm Walk', 'Bridge Test', 'Gloam Span'],
    entrySockets: ['gate', 'arch', 'bridge'],
    exitSockets: ['bridge', 'ledge', 'gate'],
    roomRole: 'crossing',
    landmark: 'split span over a chasm',
    toy: 'a narrow beam over fire',
  },
  switchback: {
    names: ['Switchback Hall', 'Turnblade Route', 'Forked Rise'],
    entrySockets: ['stair', 'gate', 'arch', 'ledge'],
    exitSockets: ['stair', 'gate', 'bridge', 'ledge'],
    roomRole: 'climb',
    landmark: 'a climbing loop around a central mass',
    toy: 'a switchback ledge chain',
  },
  spire: {
    names: ['Spire Ascent', 'Broken Shaft', 'Tower Climb'],
    entrySockets: ['gate', 'ledge', 'stair', 'drop'],
    exitSockets: ['gate', 'drop', 'ledge', 'bridge'],
    roomRole: 'vertical',
    landmark: 'a central spire or tower core',
    toy: 'a vertical drop or launch edge',
  },
};

const ROOM_SEQUENCE_ROLES = ['crossing', 'climb', 'vertical'];
const ROOM_PORTAL_MAP = {
  chasm: {
    spawn: {
      gate: [0, PLAYER_EYE_HEIGHT, -13.0],
      bridge: [0, PLAYER_EYE_HEIGHT + 0.56, -5.0],
      arch: [0, PLAYER_EYE_HEIGHT, -13.0],
      ledge: [-11.0, PLAYER_EYE_HEIGHT + 1.9, 1.4],
      stair: [-7.4, PLAYER_EYE_HEIGHT + 0.74, -6.1],
      drop: [0, PLAYER_EYE_HEIGHT + 0.56, -5.0],
    },
    exit: {
      gate: [0, 2.82, 13.0],
      bridge: [7.2, 3.08, 7.4],
      arch: [0, 2.08, 8.7],
      ledge: [-6.3, 2.33, 7.8],
      stair: [0, 2.82, 13.0],
      drop: [0, -1.95, 0.9],
    },
    exitRadius: {
      gate: 2.4,
      bridge: 1.5,
      arch: 1.4,
      ledge: 1.2,
      stair: 2.3,
      drop: 1.0,
    },
  },
  switchback: {
    spawn: {
      gate: [-11.2, PLAYER_EYE_HEIGHT, -10.0],
      bridge: [-11.2, PLAYER_EYE_HEIGHT, -8.0],
      arch: [-3.6, PLAYER_EYE_HEIGHT, -1.2],
      ledge: [-1.5, PLAYER_EYE_HEIGHT, 1.1],
      stair: [2.2, PLAYER_EYE_HEIGHT, 6.8],
      drop: [0, PLAYER_EYE_HEIGHT, -1.0],
    },
    exit: {
      gate: [0, 4.7, 13.0],
      bridge: [6.6, 3.9, 8.6],
      arch: [-1.5, 2.1, 1.1],
      ledge: [-1.5, 2.1, 1.1],
      stair: [-11.2, 3.1, 10.2],
      drop: [0, -1.95, 2.0],
    },
    exitRadius: {
      gate: 2.5,
      bridge: 1.5,
      arch: 1.2,
      ledge: 1.4,
      stair: 2.2,
      drop: 1.0,
    },
  },
  spire: {
    spawn: {
      gate: [0, PLAYER_EYE_HEIGHT, -10.8],
      bridge: [8.4, PLAYER_EYE_HEIGHT, -1.8],
      arch: [-0.6, PLAYER_EYE_HEIGHT, -5.2],
      ledge: [8.4, PLAYER_EYE_HEIGHT, -1.8],
      stair: [-4.0, PLAYER_EYE_HEIGHT, 0.2],
      drop: [0, PLAYER_EYE_HEIGHT, 5.0],
    },
    exit: {
      gate: [0, 6.2, 10.4],
      bridge: [8.4, 2.4, -1.8],
      arch: [0, 3.4, 1.4],
      ledge: [0, 3.4, 1.4],
      stair: [0.4, 5.4, 10.4],
      drop: [0, 0.2, 0.2],
    },
    exitRadius: {
      gate: 2.6,
      bridge: 1.8,
      arch: 1.4,
      ledge: 1.4,
      stair: 2.0,
      drop: 1.1,
    },
  },
};

const SOCKET_HEIGHT = {
  gate: 0,
  arch: 0.2,
  bridge: 0.42,
  stair: 0.82,
  ledge: 1.05,
  drop: -1.15,
  shaft: -0.72,
};

function buildLevelSeed(index) {
  const seedKey = localStorage.getItem(levelSeedKey(index)) || (Date.now().toString(16) + '-' + index + '-limbo');
  localStorage.setItem(levelSeedKey(index), seedKey);
  return hashRoomKey(seedKey);
}

function buildPortal(type, kind, socket, fallback = [0, 0, 0]) {
  const map = ROOM_PORTAL_MAP[type]?.[kind] || {};
  const point = map[socket];
  return makeVec(point?.[0] ?? fallback[0], point?.[1] ?? fallback[1], point?.[2] ?? fallback[2]);
}

function pickRoomTypeForSocket(rng, entrySocket, finalNode = false, context = {}) {
  const options = Object.keys(ROOM_LIBRARY).filter((type) => ROOM_LIBRARY[type].entrySockets.includes(entrySocket));
  const fallback = ['chasm', 'switchback', 'spire'];
  const pool = options.length ? options : fallback;
  if (finalNode && pool.includes('spire')) return 'spire';
  const lastRole = context.lastRole || null;
  const previousType = context.previousType || null;
  const rolesUsed = context.rolesUsed || {};
  const mandatoryRole = context.mandatoryRole || null;
  const roleBias = { crossing: 0.68, climb: 0.74, vertical: 0.8 };
  const weights = pool.map((type) => {
    const profile = ROOM_LIBRARY[type];
    let weight = 1;
    if (type === previousType) weight *= 0.52;
    if (mandatoryRole && profile.roomRole === mandatoryRole) weight *= 2.2;
    if (profile.roomRole === lastRole) weight *= 0.48;
    if (!rolesUsed[profile.roomRole]) weight *= 1.25;
    weight *= roleBias[profile.roomRole] || 1;
    return weight;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    target -= weights[i];
    if (target <= 0) return pool[i];
  }
  return pick(pool, weights);
}

function pickExitSocketForRoom(rng, roomType, currentSocket, isFinalNode = false) {
  const profile = ROOM_LIBRARY[roomType];
  const options = profile.exitSockets.filter((socket) => socket !== currentSocket);
  const fallback = profile.exitSockets.length ? profile.exitSockets : ['gate'];
  const pool = options.length ? options : fallback;
  if (isFinalNode) {
    const endingPool = pool.filter((socket) => socket === 'gate' || socket === 'ledge' || socket === 'bridge');
    if (endingPool.length) return pick(rng, endingPool);
  }
  return pick(rng, pool);
}

function remainingMandatoryRole(rolesUsed, nodesRemaining) {
  const missing = ROOM_SEQUENCE_ROLES.filter((role) => !rolesUsed[role]);
  if (!missing.length) return null;
  if (missing.length <= nodesRemaining) return null;
  return missing[0];
}

function assignDungeonLayout(nodes, rng) {
  const patterns = [
    [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 2], [0, 1, 2], [-1, 0, 2]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 1, 1], [2, 1, 0], [3, 0, 0]],
    [[0, 0, 0], [0, 0, 1], [-1, 1, 1], [-1, 1, 2], [0, 0, 2], [1, 0, 2]],
    [[0, 0, 0], [-1, 0, 0], [-1, 1, 1], [0, 1, 1], [0, 0, 2], [1, 0, 2]],
  ];
  const pattern = patterns[Math.floor(rng() * patterns.length)] || patterns[0];
  for (let i = 0; i < nodes.length; i += 1) {
    const cell = pattern[i % pattern.length];
    nodes[i].grid = { x: cell[0], y: cell[1], z: cell[2] };
    nodes[i].layoutOrigin = makeVec(cell[0] * ROOM_LAYOUT_STEP, cell[1] * ROOM_VERTICAL_STEP, cell[2] * ROOM_LAYOUT_STEP);
  }
}

function generateLevelPlan(levelIndex) {
  const seed = buildLevelSeed(levelIndex);
  const rng = rngFromSeed(seed);
  const nodeCount = 6;
  const nodes = [];
  let entrySocket = 'gate';
  const rolesUsed = {};
  let previousType = null;
  let previousRole = null;
  for (let i = 0; i < nodeCount; i += 1) {
    const isFinalNode = i === nodeCount - 1;
    const mandatoryRole = remainingMandatoryRole(rolesUsed, nodeCount - i);
    const roomType = pickRoomTypeForSocket(rng, entrySocket, isFinalNode, {
      previousType,
      lastRole: previousRole,
      rolesUsed,
      mandatoryRole,
    });
    const roomProfile = ROOM_LIBRARY[roomType];
    const exitSocket = pickExitSocketForRoom(rng, roomType, entrySocket, isFinalNode);
    const nodeSeed = hashRoomKey(`${seed}:${i}:${roomType}:${entrySocket}->${exitSocket}`);
    nodes.push({
      index: i,
      type: roomType,
      name: pick(rng, roomProfile.names),
      roomRole: roomProfile.roomRole,
      landmark: roomProfile.landmark,
      toy: roomProfile.toy,
      entrySocket,
      exitSocket,
      seed: nodeSeed,
      exitRadiusHint: ROOM_PORTAL_MAP[roomType]?.exitRadius?.[exitSocket] || 2.3,
      connector: `${entrySocket}->${exitSocket}`,
    });
    rolesUsed[roomProfile.roomRole] = true;
    previousType = roomType;
    previousRole = roomProfile.roomRole;
    entrySocket = exitSocket;
  }
  assignDungeonLayout(nodes, rng);
  return { levelIndex, seed, nodes };
}

function ensureLevelPlan() {
  if (!roomState.plan || roomState.plan.levelIndex !== roomState.levelIndex) {
    roomState.plan = generateLevelPlan(roomState.levelIndex);
  }
  return roomState.plan;
}

function getCurrentNode() {
  const plan = ensureLevelPlan();
  return plan.nodes[Math.min(roomState.nodeIndex, plan.nodes.length - 1)] || plan.nodes[0];
}

function advanceLevelNode() {
  const plan = ensureLevelPlan();
  const nextIndex = roomState.nodeIndex + 1;
  if (nextIndex >= plan.nodes.length) {
    roomState.levelIndex += 1;
    roomState.nodeIndex = 0;
    roomState.plan = null;
  } else {
    roomState.nodeIndex = nextIndex;
  }
  setLevelIndex(roomState.levelIndex);
  setNodeIndex(roomState.nodeIndex);
  return roomState.nodeIndex;
}

function addMarker(parent, pos, color = MAT.green, scale = 1) {
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.26 * scale, 0), color);
  orb.position.copy(pos);
  parent.add(orb);
  return orb;
}

function addGate(parent, pos, scale = 1) {
  const gate = new THREE.Group();
  gate.position.copy(pos);
  gate.scale.setScalar(scale);
  addBeveledBox(gate, 'gate-pillar-left', [0.24, 2.8, 0.24], [-1.1, 1.4, 0], MAT.trim, true, 0.03, 1);
  addBeveledBox(gate, 'gate-pillar-right', [0.24, 2.8, 0.24], [1.1, 1.4, 0], MAT.trim, true, 0.03, 1);
  addBeveledBox(gate, 'gate-top', [2.6, 0.2, 0.28], [0, 2.75, 0], MAT.trim, true, 0.03, 1);
  addBeveledBox(gate, 'gate-keystone', [0.72, 0.24, 0.34], [0, 2.35, 0.04], MAT.exit, true, 0.02, 1);
  const rune = addGroundedBeveledBox(gate, 'gate-rune', [0.34, 0.12, 0.1], [0, 1.35, 0.06], MAT.flame, false, 0.01, 1);
  rune.userData.phase = pos.x * 0.37 + pos.z * 0.19;
  diegeticLights.push({ flame: rune, phase: rune.userData.phase });
  parent.add(gate);
  return gate;
}

function addGlowPool(parent, prefix, pos, radius = 2.4, kind = 'flame') {
  return null;
}

function addBrazier(parent, prefix, pos, options = {}) {
  const kind = options.kind || 'flame';
  const mat = kind === 'corpsefire' ? MAT.corpsefire : MAT.flame;
  const baseY = pos[1] || 0;
  const group = new THREE.Group();
  group.position.set(pos[0], 0, pos[2]);
  addGroundedCylinder(group, prefix + '-post', 0.08, 0.9, [0, baseY, 0], MAT.iron, 5);
  addGroundedBeveledBox(group, prefix + '-sconce', [0.46, 0.18, 0.28], [0, baseY + 0.9, 0], MAT.trim, false, 0.025, 1);
  const signal = addGroundedBeveledBox(group, prefix + '-signal', [0.22, 0.16, 0.22], [0, baseY + 1.08, 0], mat, false, 0.015, 1);
  signal.name = prefix + '-signal';
  diegeticLights.push({ flame: signal, phase: 0 });
  parent.add(group);
  return group;
}

function addRoomLightSet(parent, prefix, width, depth, rng, options = {}) {
  const y = options.y || 0;
  const kind = options.kind || 'flame';
  const insetX = Math.max(4.2, width * 0.34);
  const insetZ = Math.max(4.2, depth * 0.34);
  const points = [
    [-insetX, y, -insetZ],
    [insetX, y, -insetZ],
    [-insetX, y, insetZ],
    [insetX, y, insetZ],
  ];
  for (let i = 0; i < points.length; i += 1) {
    if (rng && rng() < 0.18) continue;
    addBrazier(parent, prefix + '-brazier-' + i, points[i], { kind: i === 2 && kind === 'flame' ? 'corpsefire' : kind, intensity: 1.18, distance: 12 });
  }
}

function updateDiegeticLights(time) {
  for (const source of diegeticLights) {
    const flame = source.userData?.flame || source.flame;
    if (flame) flame.scale.setScalar(1.0);
  }
}

function positionEnemy(position) {
  if (!enemy) return;
  const nav = getEnemyNavState();
  enemy.visible = true;
  enemy.userData.health = 3;
  enemy.userData.hitTimer = 0;
  enemy.userData.dead = false;
  enemy.userData.deathTimer = 0;
  enemy.userData.baseY = position.y;
  enemy.userData.attackTimer = 0;
  enemy.userData.attackElapsed = 0;
  enemy.userData.attackCooldown = 0.75;
  enemy.userData.attackHitDone = false;
  enemy.userData.attackName = '';
  enemy.userData.mode = 'approach';
  enemy.userData.modeTimer = 0;
  enemy.userData.commitTimer = ENEMY_COMMIT_INTERVAL * 0.55;
  enemy.userData.commitElapsed = 0;
  enemy.userData.orbitSign = enemy.userData.orbitSign || 1;
  enemy.userData.pursuitStall = 0;
  if (nav) {
    nav.goal = null;
    nav.waypoints.length = 0;
    nav.waypointKinds.length = 0;
    nav.routePath.length = 0;
    nav.routeGraph = null;
    nav.mode = 'approach';
    nav.repathTimer = 0;
    nav.stallCount = 0;
    nav.lastSeenPlayer = null;
    nav.lastValidSupport = position.clone();
    nav.jump = null;
    nav.lastEnemyRoomIndex = -1;
    nav.lastPlayerRoomIndex = -1;
    nav.asleep = false;
  }
  enemy.position.copy(position);
  enemy.scale.setScalar(1);
  playEnemyAction('idle', 0.08);
}

function addDetailCube(parent, name, size, pos, mat, rx = 0, ry = 0, rz = 0, cast = true) {
  const mesh = addBox(parent, name, size, pos, mat, cast);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

function addTileField(parent, prefix, center, spanX, spanZ, cols, rows, topY, mats, rng, options = {}) {
  // Dense floor overlays fought the base floor and made the scene muddy. Keep only a few raised gothic insets.
  const count = Math.max(2, Math.floor((cols + rows) * 0.18));
  for (let i = 0; i < count; i += 1) {
    const sizeX = spanX * (0.08 + rng() * 0.1);
    const sizeZ = spanZ * (0.04 + rng() * 0.08);
    const x = center[0] + (rng() - 0.5) * spanX * 0.72;
    const z = center[2] + (rng() - 0.5) * spanZ * 0.72;
    const h = 0.09 + rng() * 0.06;
    const tile = addGroundedBeveledBox(parent, prefix + '-inset-' + i, [sizeX, h, sizeZ], [x, topY + 0.08, z], mats[i % mats.length], true, 0.025, 1);
    tile.rotation.y = (rng() - 0.5) * 0.2;
  }
}

function addPillarStack(parent, prefix, x, z, baseY, height, mats, rng) {
  const baseH = Math.max(0.18, height * 0.22);
  const shaftH = Math.max(0.28, height * 0.5);
  const capH = Math.max(0.12, height * 0.14);
  const swayX = (rng() - 0.5) * 0.12;
  const swayZ = (rng() - 0.5) * 0.12;
  addGroundedBeveledBox(parent, prefix + '-base', [1.34, baseH, 1.34], [x, baseY, z], mats[0], true, 0.04, 1);
  addGroundedBeveledBox(parent, prefix + '-shaft', [0.92, shaftH, 0.92], [x + swayX, baseY + baseH, z + swayZ], mats[1], true, 0.035, 1);
  addGroundedBeveledBox(parent, prefix + '-cap', [1.56, capH, 1.56], [x, baseY + baseH + shaftH, z], mats[0], true, 0.04, 1);
  if (rng() > 0.55) {
    const a = addGroundedBeveledBox(parent, prefix + '-buttress-a', [0.32, shaftH * 0.62, 0.84], [x + 0.82, baseY + baseH + shaftH * 0.19, z], mats[1], true, 0.02, 1);
    a.rotation.z = -0.14;
  }
  if (rng() > 0.55) {
    const b = addGroundedBeveledBox(parent, prefix + '-buttress-b', [0.84, shaftH * 0.62, 0.32], [x, baseY + baseH + shaftH * 0.19, z + 0.82], mats[1], true, 0.02, 1);
    b.rotation.x = 0.14;
  }
}

function addButtressRow(parent, prefix, startX, endX, z, y, step, mats, rng) {
  let index = 0;
  for (let x = startX; x <= endX; x += step) {
    const h = 1.2 + rng() * 1.8;
    addPillarStack(parent, prefix + '-' + index, x, z, y, h, mats, rng);
    index += 1;
  }
}

function addLinearRidge(parent, prefix, start, end, count, mat, rng, options = {}) {
  const size = options.size || [0.42, 0.12, 0.42];
  const bevel = options.bevel ?? 0.02;
  const lift = options.lift ?? -0.01;
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const x = start[0] + (end[0] - start[0]) * t;
    const y = start[1] + (end[1] - start[1]) * t + lift + (rng() - 0.5) * (options.yJitter ?? 0.03);
    const z = start[2] + (end[2] - start[2]) * t + (rng() - 0.5) * (options.zJitter ?? 0.03);
    const sx = size[0] * (0.8 + rng() * 0.35);
    const sy = size[1] * (0.8 + rng() * 0.3);
    const sz = size[2] * (0.8 + rng() * 0.35);
    const ridge = addBeveledBox(parent, prefix + '-' + i, [sx, sy, sz], [x, y + lift, z], mat, true, bevel, 1);
    ridge.rotation.y += (rng() - 0.5) * (options.spin ?? 0.3);
    ridge.rotation.x += (rng() - 0.5) * (options.pitch ?? 0.08);
    ridge.rotation.z += (rng() - 0.5) * (options.roll ?? 0.08);
  }
}

function addHangingChain(parent, prefix, x, z, topY, links, mat, rng, options = {}) {
  const length = options.length ?? 1.8;
  const sway = options.sway ?? 0.06;
  const count = Math.max(2, links);
  const linkGeo = new THREE.TorusGeometry(0.14, 0.05, 4, 6);
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const y = topY - t * length;
    const ring = new THREE.Mesh(linkGeo, mat);
    ring.position.set(x + Math.sin(i * 0.85) * sway, y, z + Math.cos(i * 0.55) * sway);
    ring.scale.set(1.05, 1.35, 1.05);
    ring.rotation.set(Math.PI / 2, 0, 0);
    ring.rotation.y = i % 2 ? Math.PI / 2 : 0;
    ring.castShadow = USE_DYNAMIC_SHADOWS;
    ring.receiveShadow = USE_DYNAMIC_SHADOWS;
    parent.add(ring);
  }
  if (options.dropStone !== false) {
    addGroundedBeveledBox(parent, prefix + '-weight', [0.16, 0.24, 0.16], [x, topY - length - 0.12, z], mat, true, 0.01, 1);
  }
}

function addBrokenSlab(parent, prefix, pos, size, mat, rng) {
  const sink = 0.06;
  const floorY = pos[1];
  const slab = addGroundedBeveledBox(parent, prefix + '-slab', size, [pos[0], floorY - sink, pos[2]], mat, true, 0.03, 1);
  slab.rotation.set((rng() - 0.5) * 0.12, (rng() - 0.5) * 0.45, (rng() - 0.5) * 0.12);
  const chipCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < chipCount; i += 1) {
    addGroundedBeveledBox(parent, prefix + '-chip-' + i, [size[0] * 0.22, size[1] * 0.26, size[2] * 0.18], [pos[0] + (rng() - 0.5) * size[0] * 0.45, floorY + size[1] * 0.45 - sink, pos[2] + (rng() - 0.5) * size[2] * 0.45], mat, true, 0.015, 1);
  }
}

function addRubbleScatter(parent, prefix, center, spanX, spanZ, baseY, count, mats, rng) {
  const pieceCount = Math.max(4, count);
  const coreCount = Math.max(2, Math.floor(pieceCount * 0.35));
  for (let i = 0; i < pieceCount; i += 1) {
    const core = i < coreCount;
    const t = pieceCount <= 1 ? 0 : i / (pieceCount - 1);
    const angle = t * Math.PI * 2 + (rng() - 0.5) * 0.8;
    const radiusX = spanX * (0.16 + rng() * 0.38);
    const radiusZ = spanZ * (0.16 + rng() * 0.38);
    const x = center[0] + Math.cos(angle) * radiusX + (rng() - 0.5) * spanX * 0.22;
    const z = center[2] + Math.sin(angle * 1.17) * radiusZ + (rng() - 0.5) * spanZ * 0.22;
    const h = core ? 0.16 + rng() * 0.22 : 0.08 + rng() * 0.12;
    const w = core ? 0.18 + rng() * 0.24 : 0.08 + rng() * 0.14;
    const d = core ? 0.16 + rng() * 0.24 : 0.08 + rng() * 0.14;
    const piece = addGroundedBeveledBox(parent, prefix + '-' + i, [w, h, d], [x, baseY, z], mats[i % mats.length], true, 0.015, 1);
    piece.rotation.set((rng() - 0.5) * 0.35, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.25);
    if (core && rng() > 0.6) {
      const chip = addGroundedBeveledBox(parent, prefix + '-' + i + '-chip', [w * 0.45, h * 0.32, d * 0.45], [x + (rng() - 0.5) * 0.14, baseY + h * 0.82, z + (rng() - 0.5) * 0.14], mats[(i + 1) % mats.length], true, 0.01, 1);
      chip.rotation.set((rng() - 0.5) * 0.45, (rng() - 0.5) * 1.4, (rng() - 0.5) * 0.3);
    }
  }
}

function addBridgeGalleryStructure(parent, rng) {
  // Quake-style blockout: one dominant void, one supported bridge, one readable side loop.
  addWallBox(parent, 'gallery-left-buttress-a', [1.2, 4.8, 4.2], [-10.8, 2.4, -8.8], MAT.connectorWall, false);
  addWallBox(parent, 'gallery-left-buttress-b', [1.2, 4.8, 4.2], [-10.8, 2.4, 1.2], MAT.connectorWall, false);
  addWallBox(parent, 'gallery-left-buttress-c', [1.2, 4.8, 4.2], [-10.8, 2.4, 10.2], MAT.connectorWall, false);
  addWallBox(parent, 'gallery-right-buttress-a', [1.2, 4.8, 4.2], [10.8, 2.4, -8.8], MAT.connectorWall, false);
  addWallBox(parent, 'gallery-right-buttress-b', [1.2, 4.8, 4.2], [10.8, 2.4, 1.2], MAT.connectorWall, false);
  addWallBox(parent, 'gallery-right-buttress-c', [1.2, 4.8, 4.2], [10.8, 2.4, 10.2], MAT.connectorWall, false);
  addBeveledBox(parent, 'gallery-crossbeam-front', [22.0, 0.62, 0.76], [0, 5.1, -8.8], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, 'gallery-crossbeam-mid', [22.0, 0.62, 0.76], [0, 5.1, 1.2], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, 'gallery-crossbeam-back', [22.0, 0.62, 0.76], [0, 5.1, 10.2], MAT.trim, false, 0.04, 1);
  addGroundedBeveledBox(parent, 'gallery-execution-dais', [5.2, 0.82, 3.2], [0, 0, -7.4], MAT.trim, true, 0.05, 1);
  addGroundedBeveledBox(parent, 'gallery-blood-channel', [0.7, 0.1, 11.4], [0, 0.08, -0.7], MAT.blood, false, 0.02, 1);
  for (let i = 0; i < 3; i += 1) {
    addHangingChain(parent, 'gallery-chain-' + i, -4 + i * 4, 4.4 + i * 0.7, 7.4, 6, MAT.iron, rng, { length: 3.2, sway: 0.02, dropStone: i === 1 });
  }
}

function buildChasmRoom(spec) {
  const rng = rngFromSeed(spec.seed);
  const width = 28;
  const depth = 34;
  addWalkableBox(roomGroup, 'gallery-floor-start', [width, 0.3, 8.4], [0, -0.15, -12.8], MAT.floor, false, 0.08);
  addWalkableBox(roomGroup, 'gallery-floor-end', [width, 0.3, 7.8], [0, 2.45, 12.1], MAT.platform, false, 0.08);
  addWalkableBox(roomGroup, 'gallery-left-walk', [4.8, 0.3, 23.2], [-11.0, 1.75, 1.4], MAT.platform, false, 0.08);
  addWalkableBox(roomGroup, 'gallery-right-walk', [4.2, 0.3, 17.2], [10.6, 2.3, 3.6], MAT.platform, false, 0.08);
  addRoomShell(roomGroup, width, depth, MAT.wall, { openSides: spec.openSides });
  addRoomLightSet(roomGroup, 'gallery', width, depth, rng, { kind: 'flame' });
  addBridgeGalleryStructure(roomGroup, rng);

  addBox(roomGroup, 'gallery-void', [15.2, 0.42, 19.6], [0, -2.0, 0.9], MAT.void, false);
  addBox(roomGroup, 'gallery-hazard-bed', [13.4, 0.05, 17.2], [0, -2.72, 0.9], MAT.hazard, false);

  addWalkableBox(roomGroup, 'gallery-main-bridge-a', [6.4, 0.42, 8.8], [0, 0.35, -5.0], MAT.bridge, true, 0.05);
  addWalkableBox(roomGroup, 'gallery-main-bridge-b', [6.4, 0.42, 8.8], [0, 1.1, 2.8], MAT.bridge, true, 0.05);
  addWalkableBox(roomGroup, 'gallery-main-bridge-c', [6.4, 0.42, 7.6], [0, 1.85, 8.7], MAT.bridge, true, 0.05);
  addWalkableBox(roomGroup, 'gallery-left-ramp-low', [4.8, 0.36, 7.0], [-7.4, 0.55, -6.1], MAT.platform, true, 0.06);
  addWalkableBox(roomGroup, 'gallery-left-ramp-high', [4.8, 0.36, 8.0], [-7.4, 1.25, 0.4], MAT.platform, true, 0.06);
  addWalkableBox(roomGroup, 'gallery-left-balcony-link', [6.6, 0.36, 4.0], [-6.3, 2.15, 7.8], MAT.platform, true, 0.06);
  addWalkableBox(roomGroup, 'gallery-right-overlook', [5.8, 0.36, 5.2], [7.2, 2.9, 7.4], MAT.platform, true, 0.06);
  addWalkableBox(roomGroup, 'gallery-exit-landing', [9.6, 0.42, 4.8], [0, 2.6, 13.0], MAT.bridge, true, 0.05);

  addBeveledBox(roomGroup, 'gallery-bridge-support-a', [1.0, 3.5, 1.0], [-3.8, -0.2, -1.2], MAT.connectorWall, true, 0.04, 1);
  addBeveledBox(roomGroup, 'gallery-bridge-support-b', [1.0, 3.8, 1.0], [3.8, 0.2, 3.7], MAT.connectorWall, true, 0.04, 1);
  addBeveledBox(roomGroup, 'gallery-bridge-support-c', [1.0, 5.0, 1.0], [-3.6, 0.9, 8.8], MAT.connectorWall, true, 0.04, 1);

  addGate(roomGroup, makeVec(0, 0, 15.2), 1.1);
  addMarker(roomGroup, makeVec(0, 2.82, 13.0), MAT.exit, 1.4);
  addMarker(roomGroup, makeVec(-6.3, 2.33, 7.8), MAT.trim, 0.9);
  addMarker(roomGroup, makeVec(7.2, 3.08, 7.4), MAT.exit, 0.85);

  return { spawn: makeVec(0, PLAYER_EYE_HEIGHT, -13.0), exit: makeVec(0, 2.82, 13.0), exitRadius: 2.8, enemyPositions: [makeVec(0, 1.1, -6.8), makeVec(7.2, 3.2, 7.4)] };
}

function buildSwitchbackRoom(spec) {
  const rng = rngFromSeed(spec.seed ^ 0x9e3779b9);
  const width = 34;
  const depth = 28;
  addWalkableBox(roomGroup, 'rim-floor', [width, 0.3, depth], [0, -0.15, 0], MAT.floor, false, 0.08);
  addRoomShell(roomGroup, width, depth, MAT.wall, { openSides: spec.openSides });
  addRoomLightSet(roomGroup, 'switch', width, depth, rng, { kind: 'flame' });

  const path = [[-11.5, -7.6, -8.0], [-7.8, -4.5, -2.8], [-3.6, -1.2, 2.2], [2.1, 1.8, 6.8], [8.0, 3.1, 10.2]];
  for (let i = 0; i < path.length; i += 1) {
    const p = path[i];
    const sizeX = 3.8 + (rng() - 0.5) * 0.8;
    const sizeZ = 2.8 + (rng() - 0.5) * 0.5;
    addWalkableBox(roomGroup, 'switch-step-' + i, [sizeX, 0.34, sizeZ], [p[0], i * 0.74, p[2]], i % 2 ? MAT.bridge : MAT.platform, true, 0.05);
  }
  addWalkableBox(roomGroup, 'switch-long-beam', [1.0, 0.24, 10.6], [-1.5, 2.1, 1.1], MAT.bridge, true, 0.02);
  addWalkableBox(roomGroup, 'switch-upper', [6.8, 0.38, 4.0], [6.6, 3.9, 8.6], MAT.platform, true, 0.04);
  addWalkableBox(roomGroup, 'switch-finish', [9.4, 0.42, 4.6], [0, 4.7, 13.0], MAT.bridge, true, 0.04);

  addGlowPool(roomGroup, 'switch-pit', [0, -0.68, 2.0], 6.2, 'hazard');
  addBox(roomGroup, 'switch-chasm', [18.0, 0.36, 8.8], [0, -1.95, 2.0], MAT.void, false);
  addGate(roomGroup, makeVec(0, 0, 14.2), 1.15);
  addMarker(roomGroup, makeVec(0, 4.7, 13.0), MAT.exit, 1.4);
  addMarker(roomGroup, makeVec(-1.5, 2.1, 1.1), MAT.trim, 1.0);
  dressSwitchbackRoom(rng);

  return { spawn: makeVec(-11.2, PLAYER_EYE_HEIGHT, -10.0), exit: makeVec(0, 4.7, 13.0), exitRadius: 2.5, enemyPositions: [makeVec(-3.6, 1.8, 2.2), makeVec(6.6, 3.9, 8.6)] };
}

function buildSpireRoom(spec) {
  const rng = rngFromSeed(spec.seed ^ 0x85ebca6b);
  const width = 30;
  const depth = 30;
  addWalkableBox(roomGroup, 'rim-floor', [width, 0.3, depth], [0, -0.15, 0], MAT.floor, false, 0.08);
  addRoomShell(roomGroup, width, depth, MAT.wall, { openSides: spec.openSides });
  addRoomLightSet(roomGroup, 'spire', width, depth, rng, { kind: 'corpsefire' });

  const heights = [0.2, 0.95, 1.8, 2.7, 3.7, 4.7];
  const radii = [7.5, 6.4, 5.1, 4.0, 2.7, 1.4];
  for (let i = 0; i < heights.length; i += 1) {
    const angle = i * 0.9 + (rng() - 0.5) * 0.25;
    const x = Math.cos(angle) * radii[i];
    const z = Math.sin(angle) * radii[i];
    addWalkableBox(roomGroup, 'spire-ring-' + i, [3.4 - i * 0.25, 0.34, 2.8 - i * 0.15], [x, heights[i], z], i % 2 ? MAT.bridge : MAT.platform, true, 0.04);
  }
  addWalkableBox(roomGroup, 'spire-top', [5.4, 0.4, 4.6], [0.4, 5.4, 0.2], MAT.bridge, true, 0.04);
  addWalkableBox(roomGroup, 'spire-side-ledge', [2.2, 0.28, 8.0], [8.4, 2.4, -1.8], MAT.platform, true, 0.03);
  addWalkableBox(roomGroup, 'spire-finish', [8.4, 0.42, 4.4], [0, 6.2, 10.4], MAT.platform, true, 0.04);

  const core = addCylinder(roomGroup, 'spire-core', 1.4, 10.5, [0, 4.8, 0.2], MAT.iron, 6);
  core.rotation.y = Math.PI / 6;
  registerSolid([2.9, 10.5, 2.9], [0, 4.8, 0.2], 0.08);
  addGlowPool(roomGroup, 'spire-core-glow', [0, 0.04, 0.2], 3.6, 'corpsefire');
  addGate(roomGroup, makeVec(0, 0, 11.8), 1.05);
  addMarker(roomGroup, makeVec(0, 6.2, 10.4), MAT.exit, 1.3);
  addMarker(roomGroup, makeVec(8.4, 2.4, -1.8), MAT.trim, 1.0);
  dressSpireRoom(rng);

  return { spawn: makeVec(0, PLAYER_EYE_HEIGHT, -10.8), exit: makeVec(0, 6.2, 10.4), exitRadius: 2.6, enemyPositions: [makeVec(0.4, 1.8, 0.2), makeVec(0, 5.4, 10.4)] };
}


function dressChasmRoom(rng) {
  addTileField(roomGroup, 'chasm-rim-north', [0, 0.03, -8.8], 24.8, 5.8, 14, 4, 0, [MAT.platform, MAT.floor], rng, { minH: 0.05, maxH: 0.16, jitter: 0.05, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'chasm-rim-south', [0, 0.03, 8.9], 24.8, 5.0, 14, 4, 0, [MAT.floor, MAT.bridge], rng, { minH: 0.05, maxH: 0.18, jitter: 0.05, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'chasm-west-run', [-10.6, 0.04, 0], 5.2, 24.8, 4, 13, 0, [MAT.platform, MAT.floor], rng, { minH: 0.05, maxH: 0.14, jitter: 0.04, rotY: 0.06, inset: 0.03 });
  addTileField(roomGroup, 'chasm-east-run', [10.7, 0.04, 0], 5.2, 24.8, 4, 13, 0, [MAT.platform, MAT.bridge], rng, { minH: 0.05, maxH: 0.14, jitter: 0.04, rotY: 0.06, inset: 0.03 });
  addTileField(roomGroup, 'chasm-main-deck', [0.6, 3.93, 5.2], 6.6, 4.0, 6, 3, 0, [MAT.platform, MAT.bridge], rng, { minH: 0.05, maxH: 0.15, jitter: 0.06, rotY: 0.12, inset: 0.03 });
  addTileField(roomGroup, 'chasm-finish-deck', [0, 4.86, 11.5], 8.0, 3.4, 7, 3, 0, [MAT.bridge, MAT.platform], rng, { minH: 0.05, maxH: 0.16, jitter: 0.05, rotY: 0.1, inset: 0.03 });
  addTileField(roomGroup, 'chasm-side-perch', [8.8, 2.68, 7.6], 2.0, 2.0, 2, 2, 0, [MAT.floor, MAT.bridge], rng, { minH: 0.04, maxH: 0.12, jitter: 0.03, rotY: 0.08, inset: 0.02 });
  addPillarStack(roomGroup, 'chasm-pill-nw', -12.0, -11.6, 0, 4.6, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'chasm-pill-ne', 12.0, -11.6, 0, 4.2, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'chasm-pill-sw', -12.0, 11.4, 0, 4.0, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'chasm-pill-se', 12.0, 11.4, 0, 4.4, [MAT.platform, MAT.bridge], rng);
  addHangingChain(roomGroup, 'chasm-chain-center', 0.0, 0.4, 8.2, 8, MAT.iron, rng, { length: 4.0, sway: 0.03 });
  addHangingChain(roomGroup, 'chasm-chain-left', -4.5, -0.5, 7.4, 7, MAT.iron, rng, { length: 3.3, sway: 0.03 });
  addHangingChain(roomGroup, 'chasm-chain-right', 4.7, 0.6, 7.1, 7, MAT.iron, rng, { length: 3.5, sway: 0.03 });
  addBrokenSlab(roomGroup, 'chasm-slab-left', [-6.8, 0.18, 6.5], [2.1, 0.22, 1.0], MAT.platform, rng);
  addBrokenSlab(roomGroup, 'chasm-slab-right', [6.2, 0.18, -1.0], [1.8, 0.22, 0.9], MAT.bridge, rng);
  addRubbleScatter(roomGroup, 'chasm-rubble-left', [-7.8, 0, 6.2], 3.0, 2.2, 0, 14, [MAT.platform, MAT.bridge, MAT.iron], rng);
  addRubbleScatter(roomGroup, 'chasm-rubble-right', [6.8, 0, -0.2], 2.2, 2.6, 0, 12, [MAT.platform, MAT.bridge, MAT.iron], rng);
  addRubbleScatter(roomGroup, 'chasm-rubble-finish', [0, 4.95, 11.0], 2.6, 1.4, 0, 8, [MAT.bridge, MAT.platform], rng);
}

function dressSwitchbackRoom(rng) {
  addTileField(roomGroup, 'switch-base', [0, 0.03, 0], 30.8, 24.8, 15, 10, 0, [MAT.floor, MAT.platform], rng, { minH: 0.04, maxH: 0.14, jitter: 0.05, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'switch-start', [-10.8, -7.56, -8.1], 5.8, 4.6, 5, 4, 0, [MAT.platform, MAT.bridge], rng, { minH: 0.04, maxH: 0.14, jitter: 0.04, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'switch-middle', [-3.6, -1.16, 2.0], 7.0, 5.2, 6, 4, 0, [MAT.platform, MAT.bridge], rng, { minH: 0.04, maxH: 0.16, jitter: 0.05, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'switch-upper', [6.6, 3.94, 8.6], 6.4, 3.6, 6, 3, 0, [MAT.bridge, MAT.platform], rng, { minH: 0.05, maxH: 0.16, jitter: 0.05, rotY: 0.1, inset: 0.03 });
  addPillarStack(roomGroup, 'switch-wall-a', -13.6, -7.5, 0, 4.0, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'switch-wall-b', -13.6, 0.5, 0, 3.6, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'switch-wall-c', 13.6, -4.0, 0, 4.1, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'switch-wall-d', 13.6, 6.0, 0, 4.3, [MAT.platform, MAT.bridge], rng);
  addButtressRow(roomGroup, 'switch-buttress-north', -10.0, 10.0, 13.3, 0, 6.5, [MAT.platform, MAT.bridge], rng);
  addHangingChain(roomGroup, 'switch-chain-a', -6.2, -0.3, 6.6, 8, MAT.iron, rng, { length: 4.1, sway: 0.03 });
  addHangingChain(roomGroup, 'switch-chain-b', 0.2, 1.0, 6.9, 8, MAT.iron, rng, { length: 4.3, sway: 0.03 });
  addHangingChain(roomGroup, 'switch-chain-c', 6.4, -0.7, 6.5, 8, MAT.iron, rng, { length: 4.0, sway: 0.03 });
  addBrokenSlab(roomGroup, 'switch-slab-a', [-8.6, 0.18, -1.4], [2.0, 0.2, 0.9], MAT.platform, rng);
  addBrokenSlab(roomGroup, 'switch-slab-b', [2.8, 0.18, 5.7], [2.4, 0.2, 1.0], MAT.bridge, rng);
  addRubbleScatter(roomGroup, 'switch-rubble', [0, 0, 2.0], 14, 6, 0, 16, [MAT.platform, MAT.bridge, MAT.iron], rng);
}

function dressSpireRoom(rng) {
  addTileField(roomGroup, 'spire-base', [0, 0.03, 0], 26.8, 26.8, 14, 14, 0, [MAT.floor, MAT.platform], rng, { minH: 0.04, maxH: 0.14, jitter: 0.04, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'spire-ring-low', [0, 0.2, 0], 13.2, 13.2, 9, 9, 0, [MAT.bridge, MAT.platform], rng, { minH: 0.05, maxH: 0.16, jitter: 0.04, rotY: 0.08, inset: 0.03 });
  addTileField(roomGroup, 'spire-top-pad', [0.4, 5.42, 0.2], 4.8, 4.0, 4, 4, 0, [MAT.bridge, MAT.platform], rng, { minH: 0.05, maxH: 0.14, jitter: 0.04, rotY: 0.08, inset: 0.03 });
  addPillarStack(roomGroup, 'spire-core-a', 0.0, 0.0, 0, 6.5, [MAT.iron, MAT.trim], rng);
  addPillarStack(roomGroup, 'spire-core-b', 0.9, 0.4, 0, 5.4, [MAT.platform, MAT.bridge], rng);
  addPillarStack(roomGroup, 'spire-core-c', -0.9, -0.4, 0, 4.9, [MAT.platform, MAT.iron], rng);
  addHangingChain(roomGroup, 'spire-chain-a', 0.0, -4.2, 8.2, 8, MAT.iron, rng, { length: 4.4, sway: 0.03 });
  addHangingChain(roomGroup, 'spire-chain-b', 4.0, 0.0, 8.0, 8, MAT.iron, rng, { length: 4.0, sway: 0.03 });
  addHangingChain(roomGroup, 'spire-chain-c', -4.1, 0.4, 8.1, 8, MAT.iron, rng, { length: 4.1, sway: 0.03 });
  addBrokenSlab(roomGroup, 'spire-slab-a', [2.8, 0.18, -2.6], [1.8, 0.18, 0.8], MAT.bridge, rng);
  addBrokenSlab(roomGroup, 'spire-slab-b', [-3.0, 0.18, 2.9], [2.0, 0.18, 0.9], MAT.platform, rng);
  addRubbleScatter(roomGroup, 'spire-rubble', [0, 0, 0], 10, 10, 0, 16, [MAT.platform, MAT.bridge, MAT.iron], rng);
}

const ROOM_LAYOUT_STEP = 40;
const ROOM_VERTICAL_STEP = 2.2;
const CONNECTOR_FLOOR_DROP = 0.09;
const ROOM_DIMENSIONS = {
  chasm: { width: 28, depth: 34 },
  switchback: { width: 34, depth: 28 },
  spire: { width: 30, depth: 30 },
};
const MUTANT_ORC_CLIPS = {
  idle: 'assets/models/mutant_orc/mutant_idle.fbx',
  run: 'assets/models/mutant_orc/mutant_run.fbx',
  walking: 'assets/models/mutant_orc/mutant_walking.fbx',
  jumping: 'assets/models/mutant_orc/mutant_jumping.fbx',
  punch: 'assets/models/mutant_orc/mutant_punch.fbx',
  dying: 'assets/models/mutant_orc/mutant_dying.fbx',
};
const ORC_BERSERKER_MODEL = 'assets/models/orc_berserker/standing_idle.fbx';
const ORC_BERSERKER_TARGET_HEIGHT = 1.7;
const ORC_BERSERKER_GROUND_OFFSET = -0.32;
const PRO_MELEE_AXE_CLIPS = {
  idle: 'assets/models/pro_melee_axe/standing_idle.fbx',
  walk: 'assets/models/pro_melee_axe/standing_walk_forward.fbx',
  sidestepLeft: 'assets/models/pro_melee_axe/standing_walk_left.fbx',
  sidestepRight: 'assets/models/pro_melee_axe/standing_walk_right.fbx',
  run: 'assets/models/pro_melee_axe/standing_run_forward.fbx',
  jumping: 'assets/models/pro_melee_axe/standing_jump.fbx',
  attackHorizontal: 'assets/models/pro_melee_axe/standing_melee_attack_horizontal_smooth.poseclip.json',
  react: 'assets/models/pro_melee_axe/standing_react_large_gut.fbx',
};
const ENEMY_RING_RADIUS = 4.0;
const ENEMY_RING_TOLERANCE = 0.45;
const ENEMY_ATTACK_RANGE = 2.45;
const ENEMY_ATTACK_WINDUP = 0.24;
const ENEMY_ATTACK_ACTIVE_END = 0.46;
const ENEMY_ATTACK_RECOVERY = 0.78;
const ENEMY_ATTACK_COOLDOWN = 1.15;
const ENEMY_COMMIT_INTERVAL = 1.25;
const ENEMY_COMMIT_TIMEOUT = 1.3;
const ENEMY_RETREAT_DURATION = 0.72;
const ENEMY_WALK_SPEED = 2.0;
const ENEMY_RUN_SPEED = 3.35;
const ENEMY_SIDESTEP_SPEED = 1.05;
const ENEMY_RETREAT_SPEED = 2.25;
const ENEMY_LUNGE_SPEED = 2.9;
const ENEMY_FLOOR_RADIUS = 0.36;
const ENEMY_SOLID_RADIUS = 0.44;
const ENEMY_CAPSULE_RADIUS = 0.44;
const ENEMY_CAPSULE_FOOT_OFFSET = 0.3;
const ENEMY_CAPSULE_SUPPORT_TOLERANCE = 0.26;
// Match the player's snap range so the enemy can clear the same tiny seams and ledges.
const ENEMY_STEP_UP = SUPPORT_SNAP_UP;
const ENEMY_STEP_DOWN = SUPPORT_SNAP_DOWN;
const ENEMY_FLOOR_SAMPLE_STEP = 0.68;
const ENEMY_NAV_REPATH_INTERVAL = 0.18;
const ENEMY_NAV_STALL_LIMIT = 12;
const BUILD_REPAIR_TOTAL_BUDGET = 12;
const BUILD_REPAIR_PER_ROOM_BUDGET = 3;
const ENEMY_JUMP_MIN_DISTANCE = 0.42;
const ENEMY_JUMP_MAX_DISTANCE = 8.8;
const ENEMY_JUMP_MAX_HEIGHT = 2.2;
const ENEMY_JUMP_PREP_DURATION = 0.16;
const ENEMY_JUMP_LAND_FRACTION = 0.78;
const ENEMY_AI_SLEEP_DISTANCE = 44;
const ENEMY_AI_WAKE_DISTANCE = 30;
const ENEMY_AI_SLEEP_ROOM_DELTA = 2;
const ENEMY_AI_WAKE_ROOM_DELTA = 1;
let enemy = null;
let enemyPrimitiveVisual = null;
let enemyModel = null;
let enemyMixer = null;
let enemyCurrentAction = null;
const enemyActions = new Map();

function getNodeLayoutOrigin(nodeOrIndex) {
  if (typeof nodeOrIndex === 'number') return makeVec(0, 0, nodeOrIndex * ROOM_LAYOUT_STEP);
  return nodeOrIndex.layoutOrigin?.clone?.() || makeVec(0, 0, nodeOrIndex.index * ROOM_LAYOUT_STEP);
}

function addConnectorLanding(parent, name, x, z, floorY) {
  addWalkableBox(parent, name + '-threshold', [8.2, 0.3, 8.2], [x, floorY - 0.15 - CONNECTOR_FLOOR_DROP, z], MAT.connectorFloor, true, 0.04);
  addBeveledBox(parent, name + '-lip-a', [8.6, 0.22, 0.36], [x, floorY + 0.08 - CONNECTOR_FLOOR_DROP, z - 4.18], MAT.trim, false, 0.02, 1);
  addBeveledBox(parent, name + '-lip-b', [8.6, 0.22, 0.36], [x, floorY + 0.08 - CONNECTOR_FLOOR_DROP, z + 4.18], MAT.trim, false, 0.02, 1);
}

function addConnectorRibs(parent, name, start, end, floorY, horizontal, length) {
  const ribCount = Math.max(1, Math.min(5, Math.floor(length / 9)));
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  for (let i = 1; i <= ribCount; i += 1) {
    const t = i / (ribCount + 1);
    const x = start.x + dx * t;
    const z = start.z + dz * t;
    const y = floorY + 1.72 - CONNECTOR_FLOOR_DROP;
    if (horizontal) {
      addBeveledBox(parent, name + '-rib-' + i + '-left', [0.34, 2.3, 0.34], [x, y - 0.35, z - 4.05], MAT.trim, false, 0.025, 1);
      addBeveledBox(parent, name + '-rib-' + i + '-right', [0.34, 2.3, 0.34], [x, y - 0.35, z + 4.05], MAT.trim, false, 0.025, 1);
      addBeveledBox(parent, name + '-rib-' + i + '-top', [0.42, 0.34, 8.6], [x, y + 0.88, z], MAT.connectorWall, false, 0.025, 1);
    } else {
      addBeveledBox(parent, name + '-rib-' + i + '-left', [0.34, 2.3, 0.34], [x - 4.05, y - 0.35, z], MAT.trim, false, 0.025, 1);
      addBeveledBox(parent, name + '-rib-' + i + '-right', [0.34, 2.3, 0.34], [x + 4.05, y - 0.35, z], MAT.trim, false, 0.025, 1);
      addBeveledBox(parent, name + '-rib-' + i + '-top', [8.6, 0.34, 0.42], [x, y + 0.88, z], MAT.connectorWall, false, 0.025, 1);
    }
  }
}

function addConnectorSegment(parent, name, start, end, floorY) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const horizontal = Math.abs(dx) >= Math.abs(dz);
  const length = Math.max(2.0, Math.abs(horizontal ? dx : dz) + 1.6);
  const cx = (start.x + end.x) * 0.5;
  const cz = (start.z + end.z) * 0.5;
  const topY = floorY - CONNECTOR_FLOOR_DROP;
  if (horizontal) {
    addWalkableBox(parent, name + '-floor', [length, 0.34, 7.6], [cx, floorY - 0.17 - CONNECTOR_FLOOR_DROP, start.z], MAT.connectorFloor, true, 0.03);
    addBeveledBox(parent, name + '-curb-a', [length, 0.18, 0.28], [cx, topY + 0.09, start.z - 3.94], MAT.trim, false, 0.02, 1);
    addBeveledBox(parent, name + '-curb-b', [length, 0.18, 0.28], [cx, topY + 0.09, start.z + 3.94], MAT.trim, false, 0.02, 1);
  } else {
    addWalkableBox(parent, name + '-floor', [7.6, 0.34, length], [start.x, floorY - 0.17 - CONNECTOR_FLOOR_DROP, cz], MAT.connectorFloor, true, 0.03);
    addBeveledBox(parent, name + '-curb-a', [0.28, 0.18, length], [start.x - 3.94, topY + 0.09, cz], MAT.trim, false, 0.02, 1);
    addBeveledBox(parent, name + '-curb-b', [0.28, 0.18, length], [start.x + 3.94, topY + 0.09, cz], MAT.trim, false, 0.02, 1);
  }
  addBrokenRouteRails(parent, name + '-rails', start, end, topY, 7.2);
  addConnectorRibs(parent, name, start, end, floorY, horizontal, length);
}

function addConnectorStairs(parent, name, start, end, startY, endY) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const horizontal = Math.abs(dx) >= Math.abs(dz);
  const span = Math.max(4.0, Math.abs(horizontal ? dx : dz));
  const steps = Math.max(3, Math.ceil(Math.abs(endY - startY) / 0.34));
  const dir = Math.sign(horizontal ? dx : dz) || 1;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const mid = (t0 + t1) * 0.5;
    const floorY = startY + (endY - startY) * t1;
    const sx = start.x + dx * mid;
    const sz = start.z + dz * mid;
    const stepLen = span / steps + 0.18;
    const size = horizontal ? [stepLen, 0.34, 7.6] : [7.6, 0.34, stepLen];
    addWalkableBox(parent, name + '-step-' + i, size, [sx, floorY - 0.17 - CONNECTOR_FLOOR_DROP, sz], i % 2 ? MAT.bridge : MAT.connectorFloor, true, 0.03);
  }
  addConnectorSegment(parent, name + '-guard', start, end, Math.min(startY, endY));
}

function addConnectorSpan(parent, index, from, to) {
  const fromFloor = from.y;
  const toFloor = to.y - PLAYER_EYE_HEIGHT;
  const vertical = Math.abs(toFloor - fromFloor) > 0.35;
  const useXForStairs = vertical && Math.abs(to.z - from.z) < 6 && Math.abs(to.x - from.x) > 6;
  const corner = useXForStairs ? makeVec(from.x, from.y, to.z) : makeVec(to.x, from.y, from.z);
  addConnectorLanding(parent, 'level-connector-' + index + '-start', from.x, from.z, fromFloor);
  if (Math.hypot(corner.x - from.x, corner.z - from.z) > 1.0) addConnectorSegment(parent, 'level-connector-' + index + '-a', from, corner, fromFloor);
  addConnectorLanding(parent, 'level-connector-' + index + '-corner', corner.x, corner.z, fromFloor);
  const endOnFromLevel = makeVec(to.x, from.y, to.z);
  if (Math.abs(toFloor - fromFloor) > 0.35) {
    addConnectorStairs(parent, 'level-connector-' + index + '-b', corner, endOnFromLevel, fromFloor, toFloor);
  } else if (Math.hypot(endOnFromLevel.x - corner.x, endOnFromLevel.z - corner.z) > 1.0) {
    addConnectorSegment(parent, 'level-connector-' + index + '-b', corner, endOnFromLevel, fromFloor);
  }
  addConnectorLanding(parent, 'level-connector-' + index + '-end', to.x, to.z, toFloor);
}

function nodeSidePortalWorld(node, other) {
  const dims = ROOM_DIMENSIONS[node.type] || ROOM_DIMENSIONS.spire;
  const dx = Math.sign(other.origin.x - node.origin.x);
  const dz = Math.sign(other.origin.z - node.origin.z);
  const floorY = node.origin.y;
  if (Math.abs(dx) > Math.abs(dz)) return makeVec(node.origin.x + dx * (dims.width / 2 + 0.4), floorY, node.origin.z);
  return makeVec(node.origin.x, floorY, node.origin.z + dz * (dims.depth / 2 + 0.4));
}

function buildLoopLinks(nodes) {
  const links = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 2; j < nodes.length; j += 1) {
      if (j === i + 1) continue;
      const a = nodes[i].grid;
      const b = nodes[j].grid;
      if (!a || !b) continue;
      const horizontal = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
      const vertical = Math.abs(a.y - b.y);
      if (horizontal === 1 && vertical <= 1) links.push([i, j]);
    }
  }
  return links.slice(0, 2);
}

function activateLevelNode(nodeIndex, movePlayer = true) {
  const plan = ensureLevelPlan();
  const node = plan.nodes[Math.min(nodeIndex, plan.nodes.length - 1)] || plan.nodes[0];
  if (!node) return null;
  roomState.nodeIndex = node.index;
  setNodeIndex(roomState.nodeIndex);
  roomState.spec = node;
  roomState.seed = node.seed;
  roomState.spawn.copy(node.spawnWorld);
  roomState.exit.copy(node.exitWorld);
  roomState.exitRadius = node.exitRadiusWorld;
  roomState.enemyPositions = [node.enemyWorld.clone()];
  positionEnemy(node.enemyWorld);
  if (movePlayer) {
    roomState.transitionLock = 0.5;
    player.position.copy(roomState.spawn);
    player.visualPosition.copy(player.position);
    player.velocity.set(0, 0, 0);
    input.smoothMoveX = 0;
    input.smoothMoveY = 0;
    player.grounded = true;
    player.runCharge = 0;
    player.lastRunIntent = false;
    player.attack = null;
    player.attackTimer = 0;
  }
  setStatus('L' + (plan.levelIndex + 1) + '.' + (node.index + 1) + '/' + plan.nodes.length + ' ' + node.name + ' (' + node.roomRole + ') | ' + node.landmark + ' | ' + node.entrySocket + ' -> ' + node.exitSocket + ' | ' + node.type);
  return node;
}

function sideTowardNode(fromNode, toNode) {
  const a = fromNode.layoutOrigin || fromNode.origin || makeVec(0, 0, 0);
  const b = toNode.layoutOrigin || toNode.origin || makeVec(0, 0, 0);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'north' : 'south';
}

function markRoomConnection(a, b) {
  if (!a.openSides) a.openSides = new Set();
  if (!b.openSides) b.openSides = new Set();
  a.openSides.add(sideTowardNode(a, b));
  b.openSides.add(sideTowardNode(b, a));
}

function assignOpenSides(plan, loopLinks) {
  for (const node of plan.nodes) node.openSides = new Set();
  for (let i = 1; i < plan.nodes.length; i += 1) markRoomConnection(plan.nodes[i - 1], plan.nodes[i]);
  for (const [aIndex, bIndex] of loopLinks) markRoomConnection(plan.nodes[aIndex], plan.nodes[bIndex]);
}

function addGoldPortalWall(parent, prefix, z, width, height, gapWidth = 7.2, gapHeight = 5.4) {
  const sideWidth = Math.max(0.1, (width - gapWidth) * 0.5);
  const x = gapWidth * 0.5 + sideWidth * 0.5;
  addWallBox(parent, prefix + '-left', [sideWidth, height, 0.72], [-x, height * 0.5, z], MAT.wall, false);
  addWallBox(parent, prefix + '-right', [sideWidth, height, 0.72], [x, height * 0.5, z], MAT.wall, false);
  addWallBox(parent, prefix + '-lintel', [gapWidth, height - gapHeight, 0.72], [0, gapHeight + (height - gapHeight) * 0.5, z], MAT.wall, false);
  addBeveledBox(parent, prefix + '-left-jamb', [0.55, gapHeight, 0.92], [-gapWidth * 0.5 - 0.28, gapHeight * 0.5, z], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, prefix + '-right-jamb', [0.55, gapHeight, 0.92], [gapWidth * 0.5 + 0.28, gapHeight * 0.5, z], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, prefix + '-cap', [gapWidth + 1.1, 0.5, 0.98], [0, gapHeight - 0.18, z], MAT.trim, false, 0.04, 1);
}

function addGoldSideWall(parent, prefix, x, depth, height) {
  addWallBox(parent, prefix + '-solid', [0.72, height, depth], [x, height * 0.5, 0], MAT.wall, false);
  for (let i = 0; i < 4; i += 1) {
    const z = -depth * 0.36 + i * depth * 0.24;
    addBeveledBox(parent, prefix + '-buttress-' + i, [1.2, 7.8, 1.1], [x + (x > 0 ? -0.68 : 0.68), 3.9, z], MAT.connectorWall, false, 0.04, 1);
  }
}

function addGoldStairRun(parent, prefix, x, startZ, stepCount, stepWidth, stepDepth, baseY, stepH, mat = MAT.platform) {
  for (let i = 0; i < stepCount; i += 1) {
    const topY = baseY + (i + 1) * stepH;
    addWalkableBox(parent, prefix + '-step-' + i, [stepWidth, stepH, stepDepth], [x, topY - stepH * 0.5, startZ + i * stepDepth], i % 2 ? mat : MAT.bridge, true, 0.04);
  }
}

function addGoldCeiling(parent, width, depth, height) {
  addBeveledBox(parent, 'gold-ceiling-south-slab', [width, 0.62, 11.0], [0, height - 0.32, -depth * 0.38], MAT.wall, false, 0.04, 1);
  addBeveledBox(parent, 'gold-ceiling-north-slab', [width, 0.62, 11.0], [0, height - 0.32, depth * 0.38], MAT.wall, false, 0.04, 1);
  for (let i = 0; i < 5; i += 1) {
    const z = -depth * 0.34 + i * depth * 0.17;
    addBeveledBox(parent, 'gold-ceiling-rib-' + i, [width - 3.0, 0.7, 0.72], [0, height - 1.35, z], MAT.trim, false, 0.04, 1);
  }
}

function addGoldHangingBlade(parent, z = -1.8) {
  const frameY = 11.6;
  addBeveledBox(parent, 'blade-frame-left', [0.92, 10.8, 0.92], [-4.85, frameY - 5.4, z], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, 'blade-frame-right', [0.92, 10.8, 0.92], [4.85, frameY - 5.4, z], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, 'blade-frame-top', [11.3, 0.82, 1.08], [0, frameY, z], MAT.trim, false, 0.04, 1);
  addBeveledBox(parent, 'blade-frame-back-top', [10.2, 0.36, 1.0], [0, frameY - 1.35, z - 0.08], MAT.iron, false, 0.03, 1);
  addBeveledBox(parent, 'blade-chain-a', [0.24, 2.8, 0.24], [-0.95, 9.65, z], MAT.iron, false, 0.02, 1);
  addBeveledBox(parent, 'blade-chain-b', [0.24, 2.8, 0.24], [0.95, 9.65, z], MAT.iron, false, 0.02, 1);
  const blade = addExtrudedPolygon(parent, 'deadfall-iron-blade-body', [
    [-3.65, 2.05],
    [3.65, 2.05],
    [3.35, -0.55],
    [0.0, -3.35],
    [-3.35, -0.55],
  ], 0.5, [0, 6.7, z], MAT.iron, false);
  blade.rotation.y = 0;
  addExtrudedPolygon(parent, 'deadfall-bronze-face-left', [
    [-2.9, 1.45],
    [-0.28, 1.45],
    [-0.55, -0.75],
    [-2.62, -0.38],
  ], 0.52, [-0.08, 6.72, z - 0.035], MAT.trim, false);
  addExtrudedPolygon(parent, 'deadfall-bronze-face-right', [
    [0.28, 1.45],
    [2.9, 1.45],
    [2.62, -0.38],
    [0.55, -0.75],
  ], 0.52, [0.08, 6.72, z - 0.04], MAT.trim, false);
  addExtrudedPolygon(parent, 'deadfall-bloodied-cutting-edge', [
    [-2.75, -0.48],
    [0, -2.78],
    [2.75, -0.48],
    [2.36, -0.72],
    [0, -2.44],
    [-2.36, -0.72],
  ], 0.56, [0, 6.5, z - 0.08], MAT.bloodDark, false);
  addBeveledBox(parent, 'deadfall-lower-dark-slot', [7.9, 0.22, 0.18], [0, 3.44, z - 0.32], MAT.void, false, 0.01, 1);
  addBeveledBox(parent, 'deadfall-guide-left', [0.26, 5.9, 0.22], [-3.95, 5.8, z - 0.55], MAT.iron, false, 0.02, 1);
  addBeveledBox(parent, 'deadfall-guide-right', [0.26, 5.9, 0.22], [3.95, 5.8, z - 0.55], MAT.iron, false, 0.02, 1);
  for (let i = 0; i < 4; i += 1) {
    const x = -2.4 + i * 1.6;
    addCylinder(parent, 'deadfall-rivet-' + i, 0.12, 0.08, [x, 7.72, z - 0.31], MAT.iron, 6).rotation.x = Math.PI * 0.5;
  }
}

function addGoldArchRibs(parent) {
  for (let i = 0; i < 4; i += 1) {
    const z = -15 + i * 10.0;
    addBeveledBox(parent, 'gold-arch-rib-left-' + i, [0.72, 8.8, 0.72], [-7.2, 4.4, z], MAT.connectorWall, false, 0.045, 1).rotation.z = -0.13;
    addBeveledBox(parent, 'gold-arch-rib-right-' + i, [0.72, 8.8, 0.72], [7.2, 4.4, z], MAT.connectorWall, false, 0.045, 1).rotation.z = 0.13;
    addBeveledBox(parent, 'gold-arch-rib-cap-' + i, [14.4, 0.54, 0.78], [0, 8.55, z], MAT.trim, false, 0.04, 1);
  }
}

function addGoldSkullPress(parent, z = 23.15) {
  addExtrudedPolygon(parent, 'maw-brow-plain-bone', [
    [-7.8, 0.85],
    [7.8, 0.85],
    [6.7, -0.36],
    [2.4, -0.72],
    [0, -1.12],
    [-2.4, -0.72],
    [-6.7, -0.36],
  ], 1.15, [0, 8.7, z], MAT.bonePlain, false);
  addBeveledBox(parent, 'maw-bronze-compression-rail', [12.6, 0.38, 0.82], [0, 7.85, z - 0.04], MAT.trim, false, 0.03, 1);
  addBeveledBox(parent, 'maw-upper-tooth-socket', [7.8, 0.62, 0.98], [0, 6.82, z - 0.34], MAT.bonePlain, false, 0.035, 1);
  addBeveledBox(parent, 'maw-upper-mouth-shadow', [6.7, 0.22, 0.28], [0, 6.44, z - 0.57], MAT.void, false, 0.01, 1);

  addExtrudedPolygon(parent, 'maw-left-upright-plain', [
    [-1.18, 3.45],
    [1.08, 3.72],
    [0.82, -3.1],
    [-1.35, -2.72],
  ], 1.05, [-5.75, 5.55, z], MAT.bonePlain, false);
  addExtrudedPolygon(parent, 'maw-right-upright-plain', [
    [-1.08, 3.72],
    [1.18, 3.45],
    [1.35, -2.72],
    [-0.82, -3.1],
  ], 1.05, [5.75, 5.55, z], MAT.bonePlain, false);

  addExtrudedPolygon(parent, 'maw-left-eye-recess', [
    [-0.78, 0.38],
    [0.78, 0.52],
    [0.54, -0.45],
    [-0.62, -0.56],
  ], 0.36, [-2.65, 7.92, z - 0.34], MAT.void, false);
  addExtrudedPolygon(parent, 'maw-right-eye-recess', [
    [-0.78, 0.52],
    [0.78, 0.38],
    [0.62, -0.56],
    [-0.54, -0.45],
  ], 0.36, [2.65, 7.92, z - 0.34], MAT.void, false);
  addExtrudedPolygon(parent, 'maw-nose-notch', [
    [0, 0.62],
    [0.46, -0.24],
    [0, -0.76],
    [-0.46, -0.24],
  ], 0.32, [0, 7.02, z - 0.35], MAT.void, false);

  for (let i = 0; i < 5; i += 1) {
    const x = -3.2 + i * 1.6;
    const tooth = addExtrudedPolygon(parent, 'maw-rooted-upper-tooth-' + i, [
      [-0.42, 0.58],
      [0.42, 0.58],
      [0.18, -0.72],
      [0, -1.02],
      [-0.18, -0.72],
    ], 0.58, [x, 6.24 + (i % 2) * 0.08, z - 0.58], MAT.bone, false);
    tooth.rotation.z = (i - 2) * 0.025;
  }

  addBeveledBox(parent, 'maw-left-lower-jaw', [3.75, 0.54, 0.9], [-3.72, 3.32, z], MAT.bonePlain, false, 0.035, 1).rotation.z = -0.12;
  addBeveledBox(parent, 'maw-right-lower-jaw', [3.75, 0.54, 0.9], [3.72, 3.32, z], MAT.bonePlain, false, 0.035, 1).rotation.z = 0.12;
  addExtrudedPolygon(parent, 'maw-narrow-center-blade', [
    [-0.72, 2.05],
    [0.72, 2.05],
    [0.52, -1.42],
    [0, -2.52],
    [-0.52, -1.42],
  ], 0.46, [0, 6.1, z - 0.72], MAT.blood, false);
}

function addGoldBloodGutter(parent) {
  addGroundedBeveledBox(parent, 'blood-gutter-dark-trench', [1.28, 0.12, 28.6], [0, 0.255, -0.3], MAT.bloodDark, false, 0.02, 1);
  addGroundedBeveledBox(parent, 'blood-gutter-left-lip', [0.22, 0.18, 28.8], [-0.76, 0.31, -0.3], MAT.trim, false, 0.018, 1);
  addGroundedBeveledBox(parent, 'blood-gutter-right-lip', [0.22, 0.18, 28.8], [0.76, 0.31, -0.3], MAT.trim, false, 0.018, 1);
  const segments = [
    [-12.2, 2.9, 0.56],
    [-8.1, 1.8, 0.38],
    [-4.9, 3.2, 0.64],
    [0.2, 2.3, 0.48],
    [4.2, 3.5, 0.7],
    [9.2, 2.1, 0.42],
  ];
  for (let i = 0; i < segments.length; i += 1) {
    const [z, length, width] = segments[i];
    addGroundedBeveledBox(parent, 'blood-gutter-pool-' + i, [width, 0.08, length], [0, 0.37, z], i % 2 ? MAT.blood : MAT.bloodDark, false, 0.012, 1);
  }
  for (let i = 0; i < 5; i += 1) {
    addGroundedBeveledBox(parent, 'blood-gutter-crossbar-' + i, [1.55, 0.08, 0.1], [0, 0.405, -10 + i * 5.2], MAT.iron, false, 0.01, 1);
  }
}

function addGoldRoomLandmarks(parent) {
  addGroundedBeveledBox(parent, 'execution-block', [4.2, 1.0, 2.4], [0, 0.3, -18.4], MAT.trim, true, 0.06, 1);
  addGoldBloodGutter(parent);
  addGoldArchRibs(parent);
  addGoldHangingBlade(parent);
  addGoldSkullPress(parent);
  addHangingChain(parent, 'gold-chain-left', -4.0, -2.0, 8.9, 8, MAT.iron, rngFromSeed(0x51551), { length: 4.2, sway: 0.01, dropStone: false });
  addHangingChain(parent, 'gold-chain-right', 4.0, -2.0, 8.9, 8, MAT.iron, rngFromSeed(0x51553), { length: 4.2, sway: 0.01, dropStone: false });
  addBrazier(parent, 'gold-brazier-left', [-13.8, 0, -20.4], { kind: 'flame' });
  addBrazier(parent, 'gold-brazier-right', [13.8, 0, -20.4], { kind: 'flame' });
  addBrazier(parent, 'gold-brazier-exit-left', [-5.1, 2.4, 24.0], { kind: 'corpsefire' });
  addBrazier(parent, 'gold-brazier-exit-right', [5.1, 2.4, 24.0], { kind: 'corpsefire' });
}

function addMeasuredQuakeRoomLandmarks(parent) {
  addGroundedBeveledBox(parent, 'measured-execution-block', [3.5, 0.82, 2.0], [0, 0.02, -13.2], MAT.trim, true, 0.05, 1);
  addGoldBloodGutter(parent);
  addGoldArchRibs(parent);
  addGoldHangingBlade(parent, -4.1);
  addGoldSkullPress(parent, 15.6);
  addHangingChain(parent, 'measured-chain-left', -3.4, 2.1, 5.7, 7, MAT.iron, rngFromSeed(0x71551), { length: 3.0, sway: 0.01, dropStone: false });
  addHangingChain(parent, 'measured-chain-right', 3.4, 1.6, 5.7, 7, MAT.iron, rngFromSeed(0x71553), { length: 3.0, sway: 0.01, dropStone: false });
  addBrazier(parent, 'measured-entry-brazier-left', [-8.8, 0, -13.8], { kind: 'flame' });
  addBrazier(parent, 'measured-entry-brazier-right', [8.8, 0, -13.8], { kind: 'flame' });
  addBrazier(parent, 'measured-recovery-corpsefire', [-8.4, 1.45, 5.0], { kind: 'corpsefire' });
  addBrazier(parent, 'measured-exit-corpsefire-left', [-4.2, 1.76, 14.6], { kind: 'corpsefire' });
  addBrazier(parent, 'measured-exit-corpsefire-right', [4.2, 1.76, 14.6], { kind: 'corpsefire' });
  addMarker(parent, makeVec(0, 1.98, 14.6), MAT.exit, 1.15);
  addMarker(parent, makeVec(-6.8, 1.64, 7.8), MAT.trim, 0.8);
}

function buildGoldExecutionBridgeGallery() {
  const width = 24;
  const depth = 36;
  const height = 13.5;

  // Compact Quake-style route sentence: entry read -> lip -> offset bridge -> side recovery -> upper crossing -> visible exit.
  addWalkableBox(roomGroup, 'measured-entry-read', [9.8, 0.42, 5.8], [0, -0.21, -14.7], MAT.floor, false, 0.08);
  addWalkableBox(roomGroup, 'measured-runway-lip', [5.6, 0.46, 5.4], [0, 0.02, -9.4], MAT.floor, true, 0.06);
  addWalkableBox(roomGroup, 'measured-bridge-commit-a', [4.2, 0.46, 5.8], [0, 0.26, -4.4], MAT.bridge, true, 0.04);
  addWalkableBox(roomGroup, 'measured-bridge-commit-b', [3.4, 0.42, 5.6], [1.35, 0.68, 1.0], MAT.bridge, true, 0.035);
  addWalkableBox(roomGroup, 'measured-bridge-commit-c', [3.2, 0.42, 4.8], [-1.25, 1.08, 5.8], MAT.bridge, true, 0.035);
  addWalkableBox(roomGroup, 'measured-exit-landing', [8.2, 0.46, 5.6], [0, 1.53, 14.0], MAT.platform, false, 0.08);

  addWalkableBox(roomGroup, 'measured-west-low-recovery', [4.1, 0.42, 16.8], [-8.1, -0.21, -2.0], MAT.platform, false, 0.08);
  addGoldStairRun(roomGroup, 'measured-west-stair', -8.0, -10.4, 5, 3.8, 1.62, 0.0, 0.25, MAT.platform);
  addWalkableBox(roomGroup, 'measured-west-upper-gallery', [4.2, 0.42, 12.2], [-7.0, 1.24, 4.8], MAT.platform, false, 0.06);
  addWalkableBox(roomGroup, 'measured-upper-crossing', [12.0, 0.42, 3.2], [-1.25, 1.38, 8.7], MAT.bridge, true, 0.04);
  addWalkableBox(roomGroup, 'measured-east-drop-recovery', [3.8, 0.38, 9.4], [8.1, 0.18, 1.5], MAT.platform, false, 0.06);
  addWalkableBox(roomGroup, 'measured-east-return-ledge', [3.5, 0.42, 8.0], [7.3, 1.36, 8.5], MAT.platform, false, 0.06);

  addBox(roomGroup, 'measured-central-void', [12.4, 0.5, 22.8], [0, -2.28, 0.8], MAT.void, false);
  addBox(roomGroup, 'measured-blood-lit-floor', [10.8, 0.08, 19.6], [0, -3.02, 0.8], MAT.hazard, false);

  addWallBox(roomGroup, 'measured-west-inner-wall-low', [0.62, 2.2, 6.8], [-4.55, 0.9, -2.4], MAT.connectorWall, true);
  addWallBox(roomGroup, 'measured-west-inner-wall-upper', [0.62, 3.2, 3.0], [-4.55, 2.0, 2.6], MAT.connectorWall, true);
  addWallBox(roomGroup, 'measured-east-inner-wall-low', [0.62, 2.1, 5.0], [5.0, 1.05, -1.4], MAT.connectorWall, true);
  addWallBox(roomGroup, 'measured-east-inner-wall-upper', [0.62, 2.8, 2.8], [5.0, 2.18, 5.4], MAT.connectorWall, true);

  addBeveledBox(roomGroup, 'measured-bridge-support-a', [0.88, 3.1, 0.88], [-3.0, -0.52, -4.2], MAT.connectorWall, true);
  addBeveledBox(roomGroup, 'measured-bridge-support-b', [0.88, 3.9, 0.88], [3.15, -0.1, 1.1], MAT.connectorWall, true);
  addBeveledBox(roomGroup, 'measured-bridge-support-c', [0.88, 4.6, 0.88], [-2.95, 0.25, 5.9], MAT.connectorWall, true);
  addBeveledBox(roomGroup, 'measured-upper-support-west', [0.9, 4.9, 0.9], [-7.0, 0.55, 8.6], MAT.connectorWall, true);
  addBeveledBox(roomGroup, 'measured-upper-support-east', [0.9, 4.4, 0.9], [5.35, 0.75, 8.6], MAT.connectorWall, true);

  addGoldPortalWall(roomGroup, 'measured-south-portal', -depth / 2, width, height, 6.2, 5.2);
  addGoldPortalWall(roomGroup, 'measured-north-portal', depth / 2, width, height, 6.8, 5.6);
  addGoldSideWall(roomGroup, 'measured-west-wall', -width / 2, depth, height);
  addGoldSideWall(roomGroup, 'measured-east-wall', width / 2, depth, height);
  addGoldCeiling(roomGroup, width, depth, height);

  addBeveledBox(roomGroup, 'measured-exit-gate-left', [0.5, 3.6, 0.66], [-3.7, 3.6, 15.9], MAT.trim, false, 0.04, 1);
  addBeveledBox(roomGroup, 'measured-exit-gate-right', [0.5, 3.6, 0.66], [3.7, 3.6, 15.9], MAT.trim, false, 0.04, 1);
  addBeveledBox(roomGroup, 'measured-exit-gate-top', [7.8, 0.5, 0.74], [0, 5.6, 15.9], MAT.trim, false, 0.04, 1);
  addExtrudedPolygon(roomGroup, 'measured-exit-sloped-cap', [[-4.4, 0.52], [4.4, 0.52], [3.25, -0.74], [-3.25, -0.74]], 0.78, [0, 6.28, 15.72], MAT.bone, false);
  addMeasuredQuakeRoomLandmarks(roomGroup);

  return {
    spawn: makeVec(0, PLAYER_EYE_HEIGHT, -15.0),
    exit: makeVec(0, 3.26, 14.2),
    exitRadius: 2.2,
    enemyPositions: [makeVec(0.2, 0, -5.2), makeVec(-7.0, 0, 4.8)],
    bounds: { minX: -11.5, maxX: 11.5, minZ: -17.4, maxZ: 17.4 },
  };
}


const CARDINAL_CONNECTORS = ['N', 'E', 'S', 'W'];

function normalizeConnector(connector) {
  if (!connector) return 'N';
  const c = String(connector).toUpperCase();
  if (CARDINAL_CONNECTORS.includes(c)) return c;
  if (c.includes('N')) return c.includes('E') ? 'E' : 'W';
  if (c.includes('S')) return c.includes('E') ? 'E' : 'W';
  return 'N';
}

function oppositeConnector(connector) {
  const c = normalizeConnector(connector);
  if (c === 'N') return 'S';
  if (c === 'S') return 'N';
  if (c === 'E') return 'W';
  return 'E';
}

function connectorPoint(connector, width, depth, topY = 0, inset = 4.2) {
  const c = normalizeConnector(connector);
  if (c === 'N') return makeVec(0, topY, depth * 0.5 - inset);
  if (c === 'S') return makeVec(0, topY, -depth * 0.5 + inset);
  if (c === 'E') return makeVec(width * 0.5 - inset, topY, 0);
  return makeVec(-width * 0.5 + inset, topY, 0);
}

function addWalkableTopBox(parent, name, sizeXZ, center, topY, mat, height = 0.42, margin = 0.06, options = null) {
  return addWalkableBox(parent, name, [sizeXZ[0], height, sizeXZ[1]], [center.x, topY - height * 0.5, center.z], mat, true, margin, options || {});
}

function addBrokenRouteRails(parent, name, a, b, topY, walkWidth = 4.2) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 3.4) return;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const seed = hashRoomKey(name + ':' + Math.round(topY * 10));
  const rng = rngFromSeed(seed);
  const sideBias = rng() < 0.68 ? [1] : [1, -1];
  const railOffset = Math.max(1.55, walkWidth * 0.5 + 0.14);
  const railTop = topY + 0.74;
  const railHeight = 0.28;
  const railThickness = 0.16;
  const segments = length > 8.2 ? [[0.06, 0.28], [0.40, 0.61], [0.73, 0.94]] : [[0.08, 0.34], [0.60, 0.92]];
  for (const side of sideBias) {
    if (rng() < 0.22 && side < 0) continue;
    const sideOffset = side * railOffset;
    for (let i = 0; i < segments.length; i += 1) {
      if (rng() < 0.18 && i === 1) continue;
      const [t0, t1] = segments[i];
      const startT = t0 + (rng() * 0.04);
      const endT = t1 - (rng() * 0.04);
      const segLen = Math.max(0.9, length * (endT - startT));
      const midT = (startT + endT) * 0.5;
      const cx = a.x + dx * midT;
      const cz = a.z + dz * midT;
      const pos = alongX
        ? [cx, railTop - railHeight * 0.5, cz + sideOffset]
        : [cx + sideOffset, railTop - railHeight * 0.5, cz];
      const size = alongX ? [segLen, railHeight, railThickness] : [railThickness, railHeight, segLen];
      addBeveledBox(parent, name + '-rail-' + (side > 0 ? 'outer' : 'inner') + '-' + i, size, pos, MAT.trim, false, 0.02, 1);
      registerSolid(size, pos, 0.01);
      const mountSurfaceSize = alongX
        ? [Math.max(0.72, segLen - 0.12), 0.12, 0.92]
        : [0.92, 0.12, Math.max(0.72, segLen - 0.12)];
      registerWalkable(mountSurfaceSize, [pos[0], railTop - 0.06, pos[2]], 0.02);
    }
  }
}

function addBatchRouteSegment(parent, name, a, b, topY, width = 3.4, mat = MAT.bridge, trim = 0.95) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.35) return null;
  const inset = Math.min(trim, Math.max(0, length * 0.18 - 0.05));
  const ux = dx / length;
  const uz = dz / length;
  const startX = a.x + ux * inset;
  const startZ = a.z + uz * inset;
  const endX = b.x - ux * inset;
  const endZ = b.z - uz * inset;
  const lenX = Math.abs(endX - startX);
  const lenZ = Math.abs(endZ - startZ);
  if (lenX < 0.28 && lenZ < 0.28) return null;
  const routeWidth = Math.max(width * 1.5, 4.2);
  if (lenX >= lenZ) {
    const center = makeVec((startX + endX) * 0.5, topY, (startZ + endZ) * 0.5);
    addBrokenRouteRails(parent, name, a, b, topY, routeWidth);
    return addWalkableTopBox(parent, name, [Math.max(0.4, lenX + 0.64), routeWidth], center, topY, mat, 0.42, 0.045);
  }
  const center = makeVec((startX + endX) * 0.5, topY, (startZ + endZ) * 0.5);
  addBrokenRouteRails(parent, name, a, b, topY, routeWidth);
  return addWalkableTopBox(parent, name, [routeWidth, Math.max(0.4, lenZ + 0.64)], center, topY, mat, 0.42, 0.045);
}

function addBatchStairRun(parent, prefix, a, b, startTop, endTop, mat = MAT.platform) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const horizontalLength = Math.max(0.1, Math.hypot(dx, dz));
  const verticalDelta = Math.abs(endTop - startTop);
  const steps = Math.max(5, Math.min(12, Math.ceil(horizontalLength / 4.2), Math.ceil(verticalDelta / 0.26)));
  const alongX = Math.abs(dx) > Math.abs(dz);
  const ux = dx / horizontalLength;
  const uz = dz / horizontalLength;
  const treadLength = Math.max(1.55, horizontalLength / steps * 0.98);
  const stairWidth = 4.9;
  for (let i = 0; i < steps; i += 1) {
    const t = (i + 0.5) / steps;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const topY = startTop + (endTop - startTop) * ((i + 1) / steps) + i * 0.008;
    const size = alongX ? [treadLength, stairWidth] : [stairWidth, treadLength];
    addWalkableTopBox(parent, prefix + '-tread-' + i, size, makeVec(x, topY, z), topY, mat, 0.24, 0.045);
    if (i > 0) {
      const prevT = (i - 0.5) / steps;
      const prevY = startTop + (endTop - startTop) * (i / steps) + (i - 1) * 0.008;
      const riserY = (prevY + topY) * 0.5 - 0.08;
      const riserH = Math.max(0.18, Math.abs(topY - prevY) + 0.14);
      const riserX = a.x + dx * prevT;
      const riserZ = a.z + dz * prevT;
      const riserSize = alongX ? [0.24, riserH, stairWidth] : [stairWidth, riserH, 0.24];
      const riserPos = [riserX - ux * 0.08, riserY, riserZ - uz * 0.08];
      addBeveledBox(parent, prefix + '-riser-' + i, riserSize, riserPos, MAT.connectorWall, false, 0.015, 1);
      registerSolid(riserSize, riserPos, 0.01);
    }
  }
  addBatchRouteSegment(parent, prefix + '-base-join', a, b, Math.min(startTop, endTop) + 0.025, 4.2, MAT.connectorFloor, 1.65);
}

function addBatchShell(parent, spec, width, depth, height) {
  const connectors = new Set((spec.horizontal_connectors || []).map(normalizeConnector));
  if (connectors.has('N')) addGoldPortalWall(parent, 'batch-north-portal', depth / 2, width, height, 6.4, 5.2);
  else addFullWall(parent, 'batch-north-wall', 'north', width, depth, height, MAT.wall);
  if (connectors.has('S')) addGoldPortalWall(parent, 'batch-south-portal', -depth / 2, width, height, 6.4, 5.2);
  else addFullWall(parent, 'batch-south-wall', 'south', width, depth, height, MAT.wall);
  if (connectors.has('E')) addSidePortalWall(parent, 'batch-east-portal', width / 2, depth, height, MAT.wall, 6.4);
  else addFullWall(parent, 'batch-east-wall', 'east', width, depth, height, MAT.wall);
  if (connectors.has('W')) addSidePortalWall(parent, 'batch-west-portal', -width / 2, depth, height, MAT.wall, 6.4);
  else addFullWall(parent, 'batch-west-wall', 'west', width, depth, height, MAT.wall);
  addGoldCeiling(parent, width, depth, height);
}

function addBatchVoidBoundary(parent, spec, width, depth, height, shellConnectors) {
  const connectors = new Set((shellConnectors || []).map(normalizeConnector));
  const seed = hashRoomKey(spec.id || 'void-boundary');
  const missing = ['N', 'S', 'E', 'W'].filter((c) => !connectors.has(c));

  const addSocketFrame = (connector) => {
    const c = normalizeConnector(connector);
    const sideAxis = c === 'N' || c === 'S';
    const point = connectorPoint(c, width, depth, 0, 2.15);
    const inward = c === 'N' ? [0, 0, -1] : c === 'S' ? [0, 0, 1] : c === 'E' ? [-1, 0, 0] : [1, 0, 0];
    const spread = sideAxis ? Math.max(3.6, width * 0.18) : Math.max(3.6, depth * 0.18);
    const postSize = sideAxis ? [0.72, height * 0.46, 0.95] : [0.95, height * 0.46, 0.72];
    const capSize = sideAxis ? [spread * 2 + 1.2, 0.48, 0.76] : [0.76, 0.48, spread * 2 + 1.2];
    const postY = postSize[1] * 0.5;
    const capY = Math.min(height - 1.8, postSize[1] + 0.3);
    const a = sideAxis ? [point.x - spread, postY, point.z + inward[2] * 0.5] : [point.x + inward[0] * 0.5, postY, point.z - spread];
    const b = sideAxis ? [point.x + spread, postY, point.z + inward[2] * 0.5] : [point.x + inward[0] * 0.5, postY, point.z + spread];
    const cap = sideAxis ? [point.x, capY, point.z + inward[2] * 0.62] : [point.x + inward[0] * 0.62, capY, point.z];
    addBeveledBox(parent, 'batch-void-' + c + '-post-a', postSize, a, MAT.connectorWall, false, 0.035, 1);
    addBeveledBox(parent, 'batch-void-' + c + '-post-b', postSize, b, MAT.connectorWall, false, 0.035, 1);
    addBeveledBox(parent, 'batch-void-' + c + '-high-cap', capSize, cap, MAT.trim, false, 0.025, 1);
  };

  for (const connector of connectors) addSocketFrame(connector);

  const addBoundaryButtress = (name, side, offset = 0) => {
    if (side === 'N') addWallBox(parent, 'batch-void-buttress-' + name, [width * 0.24, height * 0.62, 1.15], [offset * width * 0.18, height * 0.31, depth * 0.5 - 1.05], MAT.wall, false);
    if (side === 'S') addWallBox(parent, 'batch-void-buttress-' + name, [width * 0.24, height * 0.62, 1.15], [offset * width * 0.18, height * 0.31, -depth * 0.5 + 1.05], MAT.wall, false);
    if (side === 'E') addWallBox(parent, 'batch-void-buttress-' + name, [1.15, height * 0.62, depth * 0.24], [width * 0.5 - 1.05, height * 0.31, offset * depth * 0.18], MAT.wall, false);
    if (side === 'W') addWallBox(parent, 'batch-void-buttress-' + name, [1.15, height * 0.62, depth * 0.24], [-width * 0.5 + 1.05, height * 0.31, offset * depth * 0.18], MAT.wall, false);
  };

  for (let i = 0; i < missing.length; i += 1) {
    const offset = ((seed >> (i * 3)) & 1) ? 0.72 : -0.72;
    addBoundaryButtress(missing[i].toLowerCase() + '-' + i, missing[i], offset);
  }
}

function batchRoomDimensions(spec) {
  const klass = spec.junction_class || '';
  if (klass.startsWith('4c')) return { width: 30, depth: 36, height: 13.5 };
  if (klass.startsWith('3c')) return { width: 28, depth: 34, height: 13.0 };
  if (klass.startsWith('1c')) return { width: 22, depth: 28, height: 12.0 };
  return { width: 25, depth: 32, height: 12.5 };
}

function addBatchArchitecturalTemplate(parent, prefix, spec, width, depth, center, start, exit, options = {}) {
  const role = spec.semantic_role || '';
  const routeText = (spec.route_sentence || []).join(' ');
  const routeAlongX = Math.abs(exit.x - start.x) > Math.abs(exit.z - start.z);
  const sideSign = (hashRoomKey(spec.id || String(options.index || 0)) % 2) ? 1 : -1;
  const isGoalTeaseCorner = options.wantsCorner && /goal_tease|blocked_goal_view|exit_gate_read/.test(role + ' ' + routeText);
  const attachWall = (name, side, span = 0.34, height = 4.4) => {
    const alongX = side === 'north' || side === 'south';
    const length = alongX ? width * span : depth * span;
    const wallX = side === 'east' ? width * 0.5 - 1.0 : side === 'west' ? -width * 0.5 + 1.0 : 0;
    const wallZ = side === 'north' ? depth * 0.5 - 1.0 : side === 'south' ? -depth * 0.5 + 1.0 : 0;
    const postHeight = Math.max(2.4, height * 0.72);
    const endOffset = Math.max(0.6, length * 0.5 - 0.42);
    if (alongX) {
      addBeveledBox(parent, prefix + '-' + name + '-post-a', [0.34, postHeight, 0.52], [-endOffset, postHeight * 0.5, wallZ], MAT.connectorWall, false, 0.03, 1);
      addBeveledBox(parent, prefix + '-' + name + '-post-b', [0.34, postHeight, 0.52], [endOffset, postHeight * 0.5, wallZ], MAT.connectorWall, false, 0.03, 1);
      addBeveledBox(parent, prefix + '-' + name + '-cap', [Math.max(1.0, length - 0.68), 0.18, 0.28], [0, postHeight - 0.12, wallZ], MAT.iron, false, 0.02, 1);
    } else {
      addBeveledBox(parent, prefix + '-' + name + '-post-a', [0.52, postHeight, 0.34], [wallX, postHeight * 0.5, -endOffset], MAT.connectorWall, false, 0.03, 1);
      addBeveledBox(parent, prefix + '-' + name + '-post-b', [0.52, postHeight, 0.34], [wallX, postHeight * 0.5, endOffset], MAT.connectorWall, false, 0.03, 1);
      addBeveledBox(parent, prefix + '-' + name + '-cap', [0.28, 0.18, Math.max(1.0, length - 0.68)], [wallX, postHeight - 0.12, 0], MAT.iron, false, 0.02, 1);
    }
  };
  const sideWall = routeAlongX ? (sideSign > 0 ? 'north' : 'south') : (sideSign > 0 ? 'east' : 'west');
  const oppositeWall = routeAlongX ? (sideSign > 0 ? 'south' : 'north') : (sideSign > 0 ? 'west' : 'east');

  if (options.wantsHub) {
    addBeveledBox(parent, prefix + '-hub-anchor', [2.4, 5.1, 2.0], [center.x, 2.55, center.z], MAT.connectorWall, true, 0.04, 1);
    attachWall('hub-backed-shrine', sideWall, 0.42, 5.0);
    return;
  }
  if (options.isDescent) {
    const stairSide = routeAlongX ? (sideSign > 0 ? 'north' : 'south') : (sideSign > 0 ? 'east' : 'west');
    attachWall('descent-lower-backing', oppositeWall, 0.22, 2.8);
    addBeveledBox(parent, prefix + '-descent-tower-base', routeAlongX ? [2.0, 3.4, 4.0] : [4.0, 3.4, 2.0], routeAlongX ? [0, 1.7, sideSign * depth * 0.24] : [sideSign * width * 0.24, 1.7, 0], MAT.connectorWall, true, 0.04, 1);
    addBeveledBox(parent, prefix + '-descent-buttress-a', [1.2, 3.0, 1.2], routeAlongX ? [start.x * 0.18, 1.5, sideSign * depth * 0.12] : [sideSign * width * 0.12, 1.5, start.z * 0.18], MAT.connectorWall, true, 0.04, 1);
    addBeveledBox(parent, prefix + '-descent-buttress-b', [1.2, 2.6, 1.2], routeAlongX ? [exit.x * 0.18, 1.3, -sideSign * depth * 0.16] : [-sideSign * width * 0.16, 1.3, exit.z * 0.18], MAT.connectorWall, true, 0.04, 1);
    return;
  }
  if (options.hasUpper || role.includes('reward') || routeText.includes('upper')) {
    attachWall('upper-retaining-wall', sideWall, 0.52, 4.8);
    addBeveledBox(parent, prefix + '-upper-support-a', [1.0, 3.2, 1.0], routeAlongX ? [start.x * 0.45, 1.6, sideSign * depth * 0.28] : [sideSign * width * 0.28, 1.6, start.z * 0.45], MAT.connectorWall, true, 0.04, 1);
    addBeveledBox(parent, prefix + '-upper-support-b', [1.0, 3.2, 1.0], routeAlongX ? [exit.x * 0.45, 1.6, sideSign * depth * 0.28] : [sideSign * width * 0.28, 1.6, exit.z * 0.45], MAT.connectorWall, true, 0.04, 1);
    return;
  }
  if (options.hasLower || role.includes('recovery') || role.includes('secret') || role.includes('return')) {
    attachWall('sump-retaining-wall', oppositeWall, 0.48, 3.8);
    addBeveledBox(parent, prefix + '-sump-corner-pier', [1.4, 3.0, 1.4], routeAlongX ? [center.x, 1.5, -sideSign * depth * 0.27] : [-sideSign * width * 0.27, 1.5, center.z], MAT.connectorWall, true, 0.04, 1);
    return;
  }
  if (options.wantsCorner) {
    if (isGoalTeaseCorner) {
      attachWall('goal-tease-route-frame', sideWall, 0.18, 3.1);
      addBeveledBox(parent, prefix + '-goal-tease-pier', routeAlongX ? [0.9, 2.2, 1.5] : [1.5, 2.2, 0.9], routeAlongX ? [center.x, 1.1, sideSign * depth * 0.18] : [sideSign * width * 0.18, 1.1, center.z], MAT.connectorWall, true, 0.04, 1);
      return;
    }
    attachWall('corner-blind-mass-a', sideWall, 0.36, 4.2);
    attachWall('corner-blind-mass-b', oppositeWall, 0.24, 3.4);
    return;
  }
  if (options.wantsCombat || role.includes('ambush')) {
    attachWall('combat-cover-wall', sideWall, 0.30, 3.2);
    const pierSize = routeAlongX ? [1.15, 3.0, 2.0] : [2.0, 3.0, 1.15];
    const pierCenter = routeAlongX ? makeVec(center.x, 0, sideSign * depth * 0.22) : makeVec(sideSign * width * 0.22, 0, center.z);
    addBeveledBox(parent, prefix + '-combat-attached-pier', pierSize, [pierCenter.x, 1.5, pierCenter.z], MAT.connectorWall, true, 0.04, 1);
    addWalkableTopBox(parent, prefix + '-combat-attached-pier-top', [Math.max(0.74, pierSize[0] - 0.22), Math.max(0.74, pierSize[2] - 0.22)], pierCenter, 3.0, MAT.connectorFloor, 0.18, 0.04);
    return;
  }
  attachWall('route-framing-wall', sideWall, 0.26, 3.4);
}

function addBatchVerticalPlayArea(parent, prefix, spec, width, depth, center, start, exit, options = {}) {
  if (options.isDescent) return;
  const routeAlongX = Math.abs(exit.x - start.x) > Math.abs(exit.z - start.z);
  const sideSign = options.index % 2 ? 1 : -1;
  const upperTop = options.hasUpper ? 4.35 : options.wantsHub ? 3.85 : 3.15;
  const lowerTop = -1.15;
  const hasDropRoute = options.hasLower || /recovery|drop|secret|return/.test(options.routeText || '');
  const isGoalTeaseCorner = options.wantsCorner && /goal_tease|blocked_goal_view|exit_gate_read/.test((spec.semantic_role || '') + ' ' + (options.routeText || ''));
  const wantsUpperLayer = options.hasUpper || options.wantsHub || (options.wantsCorner && !hasDropRoute && !isGoalTeaseCorner);
  if (options.enabled && wantsUpperLayer) {
    const gallery = routeAlongX
      ? makeVec((start.x + exit.x) * 0.32, upperTop, sideSign * depth * 0.31)
      : makeVec(sideSign * width * 0.31, upperTop, (start.z + exit.z) * 0.32);
    const gallerySize = routeAlongX ? [Math.max(7, width * 0.34), 3.65] : [3.65, Math.max(7, depth * 0.34)];
    addWalkableTopBox(parent, prefix + '-upper-gallery', gallerySize, gallery, upperTop, MAT.bridge, 0.34, 0.06);
    const stairStart = makeVec(center.x, Math.max(0.32, center.y + 0.04), center.z);
    addBatchStairRun(parent, prefix + '-upper-stair', stairStart, gallery, stairStart.y, upperTop, MAT.platform);
    const cross = routeAlongX
      ? makeVec(exit.x * 0.46, upperTop + 0.08, gallery.z)
      : makeVec(gallery.x, upperTop + 0.08, exit.z * 0.46);
    addWalkableTopBox(parent, prefix + '-upper-crossing', routeAlongX ? [4.1, 3.25] : [3.25, 4.1], cross, cross.y, MAT.connectorFloor, 0.28, 0.06);
    addBatchRouteSegment(parent, prefix + '-upper-exit-read', cross, exit, Math.max(cross.y + 0.04, exit.y + 0.12), 2.3, MAT.connectorFloor, 2.35);
  }
  if (options.hasLower || /recovery|drop|secret|return/.test(options.routeText || '')) {
    const shelf = routeAlongX
      ? makeVec((start.x + exit.x) * 0.15, lowerTop, -sideSign * depth * 0.27)
      : makeVec(-sideSign * width * 0.27, lowerTop, (start.z + exit.z) * 0.15);
    addWalkableTopBox(parent, prefix + '-lower-recovery-shelf', routeAlongX ? [Math.max(7, width * 0.36), 4.0] : [4.0, Math.max(7, depth * 0.36)], shelf, lowerTop, MAT.connectorFloor, 0.32, 0.06);
    addBatchStairRun(parent, prefix + '-recovery-stair', shelf, center, lowerTop + 0.04, Math.max(0.28, center.y + 0.04), MAT.platform);
    addBrazier(parent, prefix + '-lower-corpsefire', [shelf.x, lowerTop, shelf.z], { kind: 'corpsefire' });
  }
}

function addBatchCarvedChamberFloor(parent, spec, width, depth, height, shellConnectors, options = {}) {
  const connectors = new Set((shellConnectors || []).map(normalizeConnector));
  const seed = hashRoomKey(spec.id || String(options.index || 0));
  const centralW = width * (options.wantsHub ? 0.56 : 0.48);
  const centralD = depth * (options.wantsHub ? 0.54 : 0.44);
  addWalkableTopBox(parent, 'batch-carved-core-floor', [centralW, centralD], makeVec(0, 0.02, 0), 0.02, MAT.floor, 0.42, 0.08);

  if (connectors.has('N')) addWalkableTopBox(parent, 'batch-carved-north-arm', [Math.max(5.8, width * 0.26), depth * 0.36], makeVec(0, 0.06, depth * 0.27), 0.06, MAT.floor, 0.38, 0.07);
  if (connectors.has('S')) addWalkableTopBox(parent, 'batch-carved-south-arm', [Math.max(5.8, width * 0.26), depth * 0.36], makeVec(0, 0.06, -depth * 0.27), 0.06, MAT.floor, 0.38, 0.07);
  if (connectors.has('E')) addWalkableTopBox(parent, 'batch-carved-east-arm', [width * 0.36, Math.max(5.8, depth * 0.24)], makeVec(width * 0.27, 0.06, 0), 0.06, MAT.floor, 0.38, 0.07);
  if (connectors.has('W')) addWalkableTopBox(parent, 'batch-carved-west-arm', [width * 0.36, Math.max(5.8, depth * 0.24)], makeVec(-width * 0.27, 0.06, 0), 0.06, MAT.floor, 0.38, 0.07);

  if (options.wantsCorner) {
    const sx = seed % 2 ? 1 : -1;
    const sz = seed % 3 ? 1 : -1;
    addWalkableTopBox(parent, 'batch-carved-corner-gallery', [width * 0.32, depth * 0.26], makeVec(sx * width * 0.23, 0.14, sz * depth * 0.23), 0.14, MAT.connectorFloor, 0.34, 0.07);
  }
  if (options.wantsHub) {
    addWalkableTopBox(parent, 'batch-carved-west-balcony', [width * 0.22, depth * 0.34], makeVec(-width * 0.31, 0.12, 0), 0.12, MAT.connectorFloor, 0.32, 0.07);
    addWalkableTopBox(parent, 'batch-carved-east-balcony', [width * 0.22, depth * 0.34], makeVec(width * 0.31, 0.12, 0), 0.12, MAT.connectorFloor, 0.32, 0.07);
  }

  const cornerW = Math.max(3.2, width * 0.17);
  const cornerD = Math.max(3.2, depth * 0.17);
  const cornerH = height * 0.72;
  const corners = [
    ['nw', -1, 1, !connectors.has('N') || !connectors.has('W')],
    ['ne', 1, 1, !connectors.has('N') || !connectors.has('E')],
    ['sw', -1, -1, !connectors.has('S') || !connectors.has('W')],
    ['se', 1, -1, !connectors.has('S') || !connectors.has('E')],
  ];
  for (const [name, sx, sz, enabled] of corners) {
    if (!enabled) continue;
    addWallBox(parent, 'batch-carved-corner-mass-' + name, [cornerW, cornerH, cornerD], [sx * (width * 0.5 - cornerW * 0.5), cornerH * 0.5, sz * (depth * 0.5 - cornerD * 0.5)], MAT.wall, false);
  }
}

function addBatchConnectorLandmark(parent, name, point, connector, role, topY = 0) {
  addMarker(parent, makeVec(point.x, topY + 0.18, point.z), role === 'exit' || role === 'locked' ? MAT.exit : MAT.trim, 0.8);
  const c = normalizeConnector(connector);
  const sideAxis = c === 'N' || c === 'S';
  const offset = c === 'N' ? [0, 0, -0.86] : c === 'S' ? [0, 0, 0.86] : c === 'E' ? [-0.86, 0, 0] : [0.86, 0, 0];
  const spread = 2.55;
  const postA = sideAxis ? [point.x - spread, topY + 1.55, point.z + offset[2]] : [point.x + offset[0], topY + 1.55, point.z - spread];
  const postB = sideAxis ? [point.x + spread, topY + 1.55, point.z + offset[2]] : [point.x + offset[0], topY + 1.55, point.z + spread];
  addBeveledBox(parent, name + '-post-a', sideAxis ? [0.34, 3.1, 0.54] : [0.54, 3.1, 0.34], postA, MAT.trim, false, 0.03, 1);
  addBeveledBox(parent, name + '-post-b', sideAxis ? [0.34, 3.1, 0.54] : [0.54, 3.1, 0.34], postB, MAT.trim, false, 0.03, 1);
}

function addBatchRoleLandmarks(parent, spec, start, exit, center, width, depth, exitTop) {
  const role = spec.semantic_role || '';
  const seed = hashRoomKey(spec.id || role);
  const rng = rngFromSeed(seed);
  addBrazier(parent, 'batch-start-flame-left', [start.x - 2.8, 0, start.z], { kind: 'flame' });
  addBrazier(parent, 'batch-start-flame-right', [start.x + 2.8, 0, start.z], { kind: 'flame' });
  addBrazier(parent, 'batch-exit-corpsefire-a', [exit.x - 2.4, exitTop, exit.z], { kind: 'corpsefire' });
  addBrazier(parent, 'batch-exit-corpsefire-b', [exit.x + 2.4, exitTop, exit.z], { kind: 'corpsefire' });
  if (role.includes('exit') || role.includes('locked') || role.includes('key')) {
    addGoldSkullPress(parent, Math.max(-depth * 0.5 + 5, Math.min(depth * 0.5 - 2.4, exit.z + (exit.z >= 0 ? 1.6 : -1.6))));
  }
  if (role.includes('switch')) {
    addGroundedBeveledBox(parent, 'batch-switch-plinth', [2.2, 0.9, 1.6], [center.x, exitTop, center.z], MAT.trim, true, 0.04, 1);
    addMarker(parent, makeVec(center.x, exitTop + 1.05, center.z), MAT.exit, 0.75);
  }
  if (role.includes('hazard') || role.includes('deadfall') || role.includes('timing')) {
    addGoldHangingBlade(parent, center.z);
  }
  if (role.includes('vista')) {
    addBeveledBox(parent, 'batch-vista-high-rib', [6.8, 0.28, 0.4], [exit.x, exitTop + 4.3, exit.z], MAT.iron, false, 0.02, 1);
  }
  if (role.includes('reward') || role.includes('secret')) {
    addMarker(parent, makeVec(exit.x, exitTop + 0.32, exit.z), MAT.bone, 0.9);
    addHangingChain(parent, 'batch-reward-chain', center.x, center.z, 6.8, 6, MAT.iron, rng, { length: 2.5, sway: 0.015, dropStone: false });
  }
}

function buildGeneratedBatchRoom(spec, index, path = {}) {
  const { width, depth, height } = batchRoomDimensions(spec);
  const connectors = (spec.horizontal_connectors || ['S', 'N']).map(normalizeConnector);
  const uniqueConnectors = [...new Set(connectors)];
  const specEntryConnector = uniqueConnectors[0] || 'S';
  const specExitConnector = uniqueConnectors.length === 1 ? specEntryConnector : (uniqueConnectors[1] || oppositeConnector(specEntryConnector));
  const pathEntryConnector = path.entryConnector ? normalizeConnector(path.entryConnector) : null;
  const pathExitConnector = path.exitConnector ? normalizeConnector(path.exitConnector) : null;
  const pathBranchConnectors = (path.branchConnectors || []).map(normalizeConnector);
  const spawnConnector = pathEntryConnector || oppositeConnector(pathExitConnector || specEntryConnector);
  const terminalExitConnector = pathExitConnector || specExitConnector;
  const shellConnectors = [...new Set([spawnConnector, terminalExitConnector, ...pathBranchConnectors])];
  const role = spec.semantic_role || '';
  const routeText = (spec.route_sentence || []).join(' ');
  const klass = spec.junction_class || '';
  const hasUpper = (spec.vertical_overlays || []).includes('U') || klass.includes('vertical') || klass.includes('layered') || routeText.includes('upper') || routeText.includes('stair');
  const hasLower = (spec.vertical_overlays || []).includes('D') || routeText.includes('drop') || routeText.includes('recovery');
  const wantsRiskLine = /bridge|gap|hazard|gutter|broken|trial|crossing|lip/.test(routeText) || /hazard|trial|crossing/.test(role);
  const wantsCorner = klass.includes('corner') || routeText.includes('turn') || routeText.includes('switchback');
  const wantsCombat = /combat|ambush|enemy/.test(role);
  const wantsHub = klass.startsWith('3c') || klass.startsWith('4c');
  const isDescentRoom = role.includes('descent') || routeText.includes('visible_lower_goal') || routeText.includes('drop_or_stair_recovery');
  const wantsVerticalPlay = (hasUpper || hasLower || wantsHub || wantsCorner || index % 3 === 2) && !isDescentRoom;
  const startTop = hasLower && role.includes('descent') ? 1.0 : 0;
  const exitTop = hasUpper ? 1.2 : role.includes('descent') ? 0 : 0.28;
  const startSurfaceTop = Math.max(0.22, startTop + 0.2);
  const exitSurfaceTop = Math.max(0.28, exitTop + 0.2);
  const start = connectorPoint(spawnConnector, width, depth, startSurfaceTop, 4.5);
  const exit = connectorPoint(terminalExitConnector, width, depth, exitSurfaceTop, 4.5);
  const center = makeVec(0, Math.max(0.3, Math.min(1.05, (start.y + exit.y) * 0.5)), 0);

  addBatchVoidBoundary(roomGroup, spec, width, depth, height, shellConnectors);

  // Build a carved chamber footprint first; pads and route pieces sit on top of this outline.
  addBatchCarvedChamberFloor(roomGroup, spec, width, depth, height, shellConnectors, { index, wantsCorner, wantsHub });
  addWalkableTopBox(roomGroup, 'batch-entry-pad', [7.2, 5.4], start, start.y, MAT.platform, 0.18, 0.06, { source: 'batch-entry-pad', traversalCritical: true });
  addWalkableTopBox(roomGroup, 'batch-exit-pad', [7.4, 5.4], exit, exit.y, MAT.platform, 0.18, 0.06, { source: 'batch-exit-pad', traversalCritical: true });

  // A narrow visual gutter gives movement focus without creating the giant side void from build 0.8.1.
  if (wantsRiskLine) {
    const gutterAlongX = Math.abs(exit.x - start.x) > Math.abs(exit.z - start.z);
    const gutterSize = gutterAlongX ? [Math.max(8, width * 0.46), 1.25] : [1.25, Math.max(8, depth * 0.46)];
    addBeveledBox(roomGroup, 'batch-narrow-hazard-gutter', [gutterSize[0], 0.05, gutterSize[1]], [0, 0.035, 0], role.includes('hazard') ? MAT.hazard : MAT.bloodDark, false, 0.01, 1);
  }

  const midA = makeVec((start.x * 0.58 + exit.x * 0.42), Math.max(start.y + 0.08, 0.32), (start.z * 0.58 + exit.z * 0.42));
  const midB = makeVec((start.x * 0.30 + exit.x * 0.70), Math.max(exit.y + 0.06, 0.36), (start.z * 0.30 + exit.z * 0.70));

  if (wantsCorner) {
    const bendSide = terminalExitConnector === 'E' || spawnConnector === 'E' ? 1 : -1;
    const bend = makeVec(bendSide * width * 0.26, Math.max(0.36, (start.y + exit.y) * 0.5 + 0.08), (start.z + exit.z) * 0.18);
    addWalkableTopBox(roomGroup, 'batch-corner-route-a', [5.2, 4.0], bend, bend.y, MAT.platform, 0.16, 0.04, { source: 'batch-corner-route-a', traversalCritical: true });
    addBatchRouteSegment(roomGroup, 'batch-corner-entry-link', start, bend, bend.y + 0.035, 2.7, MAT.platform, 2.65);
    addBatchRouteSegment(roomGroup, 'batch-corner-exit-link', bend, exit, Math.max(bend.y + 0.09, exit.y + 0.08), 2.7, MAT.bridge, 2.65);
  } else if (isDescentRoom) {
    const routeAlongX = Math.abs(exit.x - start.x) > Math.abs(exit.z - start.z);
    const stairSide = Math.abs(start.x) < 1 ? (index % 2 ? 1 : -1) : -Math.sign(start.x || 1);
    const upperRun = routeAlongX
      ? makeVec((start.x * 0.68 + center.x * 0.32), start.y, start.z * 0.28)
      : makeVec(start.x * 0.16, start.y, (start.z * 0.68 + center.z * 0.32));
    const dropLip = routeAlongX
      ? makeVec((upperRun.x + exit.x) * 0.42, start.y, upperRun.z)
      : makeVec(upperRun.x, start.y, (upperRun.z + exit.z) * 0.42);
    const lowerTerrace = routeAlongX
      ? makeVec(exit.x * 0.22, Math.max(0.34, exit.y + 0.04), (center.z + exit.z) * 0.32)
      : makeVec((center.x + exit.x) * 0.22, Math.max(0.34, exit.y + 0.04), exit.z * 0.38);
    const stairMid = routeAlongX
      ? makeVec((upperRun.x + lowerTerrace.x) * 0.22, Math.max(0.64, center.y + 0.18), stairSide * depth * 0.24)
      : makeVec(stairSide * width * 0.24, Math.max(0.64, center.y + 0.18), (upperRun.z + lowerTerrace.z) * 0.22);
    const voidCenter = routeAlongX
      ? makeVec((dropLip.x + lowerTerrace.x) * 0.5, 0.16, (dropLip.z + lowerTerrace.z) * 0.5)
      : makeVec((dropLip.x + lowerTerrace.x) * 0.5, 0.16, (dropLip.z + lowerTerrace.z) * 0.5);
    const voidSize = routeAlongX
      ? [Math.max(5.4, Math.abs(lowerTerrace.x - dropLip.x) * 0.95), 6.0]
      : [6.0, Math.max(5.4, Math.abs(lowerTerrace.z - dropLip.z) * 0.95)];

    addWalkableTopBox(roomGroup, 'batch-descent-upper-run', routeAlongX ? [Math.max(6.2, width * 0.26), 4.2] : [4.2, Math.max(6.2, depth * 0.26)], upperRun, upperRun.y, MAT.bridge, 0.16, 0.04, { source: 'batch-descent-upper-run', traversalCritical: true });
    addWalkableTopBox(roomGroup, 'batch-descent-drop-lip', routeAlongX ? [4.6, 3.6] : [3.6, 4.6], dropLip, dropLip.y, MAT.bridge, 0.14, 0.04, { source: 'batch-descent-drop-lip', traversalCritical: true });
    addWalkableTopBox(roomGroup, 'batch-descent-lower-terrace', routeAlongX ? [Math.max(6.6, width * 0.32), 5.0] : [5.0, Math.max(6.6, depth * 0.32)], lowerTerrace, lowerTerrace.y, MAT.platform, 0.18, 0.05, { source: 'batch-descent-lower-terrace', traversalCritical: true });
    addBeveledBox(roomGroup, 'batch-descent-void-cut', [voidSize[0], 0.18, voidSize[1]], [voidCenter.x, 0.08, voidCenter.z], MAT.void, false, 0.01, 1);

    addBatchRouteSegment(roomGroup, 'batch-descent-entry-link', start, upperRun, upperRun.y + 0.04, 2.6, MAT.platform, 2.65);
    addBatchRouteSegment(roomGroup, 'batch-descent-fast-line', upperRun, dropLip, dropLip.y + 0.04, 2.3, MAT.bridge, 2.65);
    addBatchStairRun(roomGroup, 'batch-descent-stair-a', upperRun, stairMid, upperRun.y, stairMid.y, MAT.platform);
    addBatchStairRun(roomGroup, 'batch-descent-stair-b', stairMid, lowerTerrace, stairMid.y, lowerTerrace.y, MAT.platform);
    addBatchRouteSegment(roomGroup, 'batch-descent-exit-link', lowerTerrace, exit, Math.max(lowerTerrace.y + 0.05, exit.y + 0.06), 2.6, MAT.platform, 2.65);

    const supportTop = start.y + 2.2;
    const supportY = supportTop * 0.5;
    const supportA = routeAlongX ? [dropLip.x - 1.6, supportY, dropLip.z - 1.2] : [dropLip.x - 1.2, supportY, dropLip.z - 1.6];
    const supportB = routeAlongX ? [dropLip.x + 1.6, supportY, dropLip.z + 1.2] : [dropLip.x + 1.2, supportY, dropLip.z + 1.6];
    addBeveledBox(roomGroup, 'batch-descent-support-a', [1.0, supportTop, 1.0], supportA, MAT.connectorWall, true, 0.04, 1);
    addBeveledBox(roomGroup, 'batch-descent-support-b', [1.0, supportTop, 1.0], supportB, MAT.connectorWall, true, 0.04, 1);
    addBeveledBox(roomGroup, 'batch-descent-stair-tower', routeAlongX ? [1.4, 3.2, 3.8] : [3.8, 3.2, 1.4], [stairMid.x, 1.6, stairMid.z], MAT.connectorWall, true, 0.04, 1);
    addBrazier(roomGroup, 'batch-descent-lower-signal', [lowerTerrace.x, lowerTerrace.y, lowerTerrace.z], { kind: 'corpsefire' });
  } else if (hasUpper) {
    addWalkableTopBox(roomGroup, 'batch-lip-landing', [4.8, 3.8], midA, midA.y, MAT.platform, 0.16, 0.04, { source: 'batch-lip-landing', traversalCritical: true });
    addBatchStairRun(roomGroup, 'batch-measured-rise', midA, midB, midA.y, Math.max(midA.y + 0.38, exit.y + 0.04), MAT.platform);
    addBatchRouteSegment(roomGroup, 'batch-upper-exit-link', midB, exit, Math.max(0.46, exit.y + 0.08), 2.8, MAT.bridge, 2.65);
  } else {
    addWalkableTopBox(roomGroup, 'batch-route-lip-marker', [4.6, 3.4], midA, midA.y, wantsRiskLine ? MAT.bridge : MAT.platform, 0.14, 0.04, { source: 'batch-route-lip-marker', traversalCritical: true });
    addWalkableTopBox(roomGroup, 'batch-route-landing-marker', [4.2, 3.6], midB, midB.y, MAT.platform, 0.14, 0.04, { source: 'batch-route-landing-marker', traversalCritical: true });
    addBatchRouteSegment(roomGroup, 'batch-low-route-link-a', start, midA, midA.y + 0.035, 2.6, MAT.platform, 2.65);
    addBatchRouteSegment(roomGroup, 'batch-low-route-link-b', midB, exit, Math.max(midB.y + 0.06, exit.y + 0.08), 2.6, MAT.platform, 2.65);
  }

  if (!isDescentRoom && (hasLower || role.includes('recovery') || role.includes('secret'))) {
    const side = Math.abs(start.x) < 1 ? (index % 2 ? 1 : -1) : -Math.sign(start.x);
    const low = makeVec(side * width * 0.30, 0.24, 0);
    addWalkableTopBox(roomGroup, 'batch-side-recovery-floor', [4.6, Math.max(7.0, depth * 0.34)], low, low.y, MAT.connectorFloor, 0.16, 0.05, { source: 'batch-side-recovery-floor', traversalCritical: true });
    addBatchStairRun(roomGroup, 'batch-side-recovery-rise', low, exit, low.y + 0.03, Math.max(0.5, exit.y + 0.04), MAT.platform);
    addBrazier(roomGroup, 'batch-recovery-corpsefire', [low.x, 0, low.z], { kind: 'corpsefire' });
  }

  addBatchArchitecturalTemplate(roomGroup, 'batch-architecture', spec, width, depth, center, start, exit, {
    index,
    wantsHub,
    wantsCombat,
    wantsCorner,
    hasUpper,
    hasLower,
    isDescent: isDescentRoom,
  });

  addBatchVerticalPlayArea(roomGroup, 'batch-vertical-play', spec, width, depth, center, start, exit, {
    index,
    enabled: wantsVerticalPlay,
    hasUpper,
    hasLower,
    wantsHub,
    routeText,
    isDescent: isDescentRoom,
  });

  const branchConnectors = [...new Set(pathBranchConnectors)].filter((c) => c !== spawnConnector && c !== terminalExitConnector);
  const socketPoints = new Map([[spawnConnector, start], [terminalExitConnector, exit]]);
  if (wantsHub || branchConnectors.length) {
    for (let i = 0; i < branchConnectors.length; i += 1) {
      const c = branchConnectors[i];
      const branchTop = hasUpper && i % 2 ? 0.95 : 0.26;
      const point = connectorPoint(c, width, depth, branchTop, 4.6);
      socketPoints.set(c, point);
      addWalkableTopBox(roomGroup, 'batch-side-branch-' + i, [5.2, 4.2], point, point.y, i % 2 ? MAT.bridge : MAT.connectorFloor, 0.16, 0.05, { source: 'batch-side-branch-' + i, traversalCritical: true });
      addBatchRouteSegment(roomGroup, 'batch-side-branch-link-' + i, center, point, Math.max(0.34, branchTop + 0.09), 2.4, MAT.connectorFloor, 2.65);
      addBatchConnectorLandmark(roomGroup, 'batch-side-connector-' + i, point, c, 'side', branchTop);
    }
  }

  if (klass.startsWith('4c')) {
    addBeveledBox(roomGroup, 'batch-hub-central-landmark', [2.1, 2.6, 1.8], [0, 1.3, 0], MAT.connectorWall, true, 0.04, 1);
    addWalkableTopBox(roomGroup, 'batch-hub-west-footwork', [3.6, 7.8], makeVec(-4.9, 0.3, 0), 0.3, MAT.platform, 0.14, 0.04, { source: 'batch-hub-west-footwork', traversalCritical: true });
    addWalkableTopBox(roomGroup, 'batch-hub-east-footwork', [3.6, 7.8], makeVec(4.9, 0.3, 0), 0.3, MAT.platform, 0.14, 0.04, { source: 'batch-hub-east-footwork', traversalCritical: true });
  }

  if (wantsCombat && !wantsCorner) {
    addBeveledBox(roomGroup, 'batch-combat-route-mass', [1.8, 2.1, 1.3], [center.x, 1.05, center.z], MAT.connectorWall, true, 0.04, 1);
    addWalkableTopBox(roomGroup, 'batch-combat-route-mass-top', [1.5, 1.02], center, 2.1, MAT.connectorFloor, 0.18, 0.04);
  } else {
    addBeveledBox(roomGroup, 'batch-route-buttress-left', [0.8, 2.4, 1.0], [-width * 0.28, 1.2, center.z], MAT.connectorWall, true, 0.035, 1);
    addBeveledBox(roomGroup, 'batch-route-buttress-right', [0.8, 2.4, 1.0], [width * 0.28, 1.2, center.z], MAT.connectorWall, true, 0.035, 1);
  }

  addBatchConnectorLandmark(roomGroup, 'batch-exit-landmark', exit, terminalExitConnector, role, exit.y);
  for (let i = 0; i < pathBranchConnectors.length; i += 1) {
    const connector = pathBranchConnectors[i];
    const branchPoint = socketPoints.get(connector);
    if (branchPoint) addBatchConnectorLandmark(roomGroup, 'batch-physical-branch-' + i, branchPoint, connector, 'side', branchPoint.y);
  }
  addBatchRoleLandmarks(roomGroup, spec, start, exit, center, width, depth, exit.y);

  const sockets = {};
  for (const connector of shellConnectors) {
    const point = socketPoints.get(connector) || connectorPoint(connector, width, depth, 0.34, 4.6);
    sockets[connector] = makeVec(point.x, point.y + PLAYER_EYE_HEIGHT, point.z);
  }
  return {
    spawn: makeVec(start.x, start.y + PLAYER_EYE_HEIGHT, start.z),
    exit: makeVec(exit.x, exit.y + PLAYER_EYE_HEIGHT, exit.z),
    sockets,
    exitRadius: 2.15,
    enemyPositions: [makeVec(center.x, 0, center.z), makeVec(exit.x, exit.y, exit.z)],
    bounds: { minX: -width * 0.5 + 0.7, maxX: width * 0.5 - 0.7, minZ: -depth * 0.5 + 0.7, maxZ: depth * 0.5 - 0.7 },
  };
}

function currentBatchSpec() {
  const count = Math.max(1, GENERATED_ROOM_BATCH.length);
  const index = ((roomState.nodeIndex % count) + count) % count;
  roomState.nodeIndex = index;
  return GENERATED_ROOM_BATCH[index];
}

const DISTRICT_ARCHETYPES = {
  intake: {
    id: 'intake',
    names: ['Toll Intake', 'Arrival Bridges', 'Chain Customs'],
    purpose: 'sort arrivals and choke the safest approach into the settlement',
    signal: 'flame',
    preferredRoles: ['start', 'choice', 'ambush', 'corner', 'recovery_line'],
  },
  scaffolds: {
    id: 'scaffolds',
    names: ['Hanging Market', 'Scaffold Ward', 'Ropewalk Stalls'],
    purpose: 'pack trade, ambush, and foot traffic onto hanging walkways',
    signal: 'corpsefire',
    preferredRoles: ['choice_t', 'fork', 'combat_choice', 'loop_node', 'combat'],
  },
  liftworks: {
    id: 'liftworks',
    names: ['Liftworks', 'Winch Towers', 'Counterweight Racks'],
    purpose: 'haul salvage and bodies between tiers with lifts, cranes, and stairs',
    signal: 'flame',
    preferredRoles: ['vertical_transition', 'stairwell', 'switch', 'vertical_choice', 'climb'],
  },
  furnace: {
    id: 'furnace',
    names: ['Corpsefire Kilns', 'Furnace Tier', 'Ash Engines'],
    purpose: 'burn refuse and feed the fire chain that keeps the town alive',
    signal: 'hazard',
    preferredRoles: ['hazard_crossing', 'timing', 'combat', 'locked_hub', 'descent'],
  },
  refuse: {
    id: 'refuse',
    names: ['Refuse Underworks', 'Sump Gutters', 'Waste Chutes'],
    purpose: 'dump runoff below the homes and hide maintenance returns',
    signal: 'corpsefire',
    preferredRoles: ['secret', 'recovery_t', 'secret_tease', 'descent_corner', 'shortcut_receiver'],
  },
  shrine: {
    id: 'shrine',
    names: ['Shrine Rim', 'Skull Gate Ward', 'Abyss Chapel'],
    purpose: 'guard the ritual rim and the settlement exit above the void',
    signal: 'exit',
    preferredRoles: ['vista', 'reward', 'hub', 'layered_hub', 'exit'],
  },
};

const DISTRICT_MIDDLE_ARCHETYPES = [
  DISTRICT_ARCHETYPES.scaffolds,
  DISTRICT_ARCHETYPES.liftworks,
  DISTRICT_ARCHETYPES.furnace,
  DISTRICT_ARCHETYPES.refuse,
];

const DISTRICT_ROOM_COUNT_PROFILES = [
  [10, 12, 14, 12],
  [12, 10, 12, 14],
  [11, 13, 10, 14],
  [9, 13, 12, 14],
  [12, 11, 14, 11],
];

const DISTRICT_LOCAL_LAYOUTS = [
  {
    id: 'switchback-racks',
    points: [
      [0, 0, 0], [0, 42, 0], [32, 76, 1.1], [70, 76, 1.2], [106, 112, 2.7], [106, 154, 3.1], [70, 188, 1.9],
      [30, 188, 1.8], [-6, 220, 0.6], [-6, 262, 0.6], [36, 300, 2.9], [78, 300, 3.0], [114, 338, 1.4], [78, 376, 1.4],
    ],
    branchPairs: [[2, 7], [5, 9], [8, 11]],
  },
  {
    id: 'hanging-spine',
    points: [
      [0, 0, 0], [36, 32, 0.7], [74, 60, 1.6], [112, 92, 2.8], [112, 136, 2.6], [74, 174, 1.3], [32, 202, 0.3],
      [-8, 238, 0.2], [-8, 280, 1.0], [30, 318, 2.1], [72, 348, 3.6], [118, 378, 3.8], [82, 414, 2.4], [40, 444, 2.4],
    ],
    branchPairs: [[1, 6], [4, 8], [7, 11]],
  },
  {
    id: 'lift-fan',
    points: [
      [0, 0, 0], [0, 44, 0.4], [-36, 80, 1.5], [-72, 118, 2.7], [-36, 154, 3.2], [6, 190, 3.0], [48, 226, 1.6],
      [88, 226, 1.5], [126, 264, 2.8], [126, 306, 4.2], [86, 340, 3.2], [44, 374, 1.4], [6, 408, 1.0], [-34, 438, 2.5],
    ],
    branchPairs: [[2, 5], [6, 10], [9, 12]],
  },
];

const DISTRICT_LOCAL_LAYOUT_MAP = Object.fromEntries(DISTRICT_LOCAL_LAYOUTS.map((layout) => [layout.id, layout]));

const DISTRICT_MACRO_TEMPLATES = {
  intake: {
    id: 'entry_toll',
    elevationBand: 'mid',
    layoutIds: ['switchback-racks'],
    baseRange: [0.4, 3.4],
    topRange: [6.0, 9.0],
    xRange: [0, 18],
    zRange: [0, 0],
    supportStyle: 'chain_hangs',
    landmarkRole: 'toll_gate',
    approachType: 'arrival',
    departureType: 'stair_climb',
    routeType: 'traverse',
    requiresVisibleBelow: false,
    requiresVisibleAbove: true,
  },
  scaffolds: {
    id: 'market_lattice',
    elevationBand: 'climb_transition',
    layoutIds: ['hanging-spine', 'switchback-racks'],
    baseRange: [8.2, 12.4],
    topRange: [16.0, 21.0],
    xRange: [96, 154],
    zRange: [176, 244],
    supportStyle: 'scaffold_forest',
    landmarkRole: 'market_core',
    approachType: 'stair_ascent',
    departureType: 'bridge_crossing',
    routeType: 'climb',
    requiresVisibleBelow: true,
    requiresVisibleAbove: true,
    realSourceA: 'medina_kasbah',
    realSourceB: 'stilt_wharf_settlement',
    skeletonType: 'hanging_market_hybrid',
    patchStyle: 'scaffold_chain_infill',
    silhouetteRule: 'lateral stacked market over a visible support forest',
  },
  liftworks: {
    id: 'liftworks_spire',
    elevationBand: 'high',
    layoutIds: ['lift-fan'],
    baseRange: [12.0, 17.4],
    topRange: [21.0, 29.5],
    xRange: [64, 120],
    zRange: [188, 260],
    supportStyle: 'lift_cage',
    landmarkRole: 'lift_core',
    approachType: 'winch_climb',
    departureType: 'suspended_crossing',
    routeType: 'climb',
    requiresVisibleBelow: true,
    requiresVisibleAbove: true,
  },
  furnace: {
    id: 'furnace_drop',
    elevationBand: 'descent_transition',
    layoutIds: ['switchback-racks', 'hanging-spine'],
    baseRange: [-6.8, -3.6],
    topRange: [0.6, 4.8],
    xRange: [-116, -52],
    zRange: [184, 252],
    supportStyle: 'buttress_stack',
    landmarkRole: 'furnace_glow',
    approachType: 'drop_to_lower_terrace',
    departureType: 'maintenance_return',
    routeType: 'descent',
    requiresVisibleBelow: true,
    requiresVisibleAbove: false,
  },
  refuse: {
    id: 'refuse_underworks',
    elevationBand: 'low',
    layoutIds: ['switchback-racks'],
    baseRange: [-5.6, -2.8],
    topRange: [0.0, 3.2],
    xRange: [-92, -36],
    zRange: [136, 208],
    supportStyle: 'counterweight_rig',
    landmarkRole: 'waste_chute',
    approachType: 'underpath_entry',
    departureType: 'climb_return',
    routeType: 'descent',
    requiresVisibleBelow: true,
    requiresVisibleAbove: true,
  },
  shrine: {
    id: 'shrine_rim',
    elevationBand: 'rim',
    layoutIds: ['hanging-spine', 'lift-fan'],
    baseRange: [16.0, 23.0],
    topRange: [28.0, 36.0],
    xRange: [112, 186],
    zRange: [220, 312],
    supportStyle: 'tower_legs',
    landmarkRole: 'abyss_crown',
    approachType: 'rim_climb',
    departureType: 'exit_crown',
    routeType: 'climb',
    requiresVisibleBelow: true,
    requiresVisibleAbove: false,
  },
};

const DISTRICT_ARCHETYPE_TEMPLATES = {
  intake: DISTRICT_MACRO_TEMPLATES.intake,
  scaffolds: DISTRICT_MACRO_TEMPLATES.scaffolds,
  liftworks: DISTRICT_MACRO_TEMPLATES.liftworks,
  furnace: DISTRICT_MACRO_TEMPLATES.furnace,
  refuse: DISTRICT_MACRO_TEMPLATES.refuse,
  shrine: DISTRICT_MACRO_TEMPLATES.shrine,
};

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function buildHangingMarketDistrictMeta(district) {
  const base = district.baseElevation;
  const origin = district.origin;
  const roomCount = Math.max(1, district.roomCount);
  const roomOffsets = [];
  const segmentRoles = [];
  for (let i = 0; i < roomCount; i += 1) {
    const t = roomCount <= 1 ? 0 : i / (roomCount - 1);
    let x = 0;
    let z = 0;
    let y = 0;
    let role = 'market_court';
    if (t < 0.22) {
      const s = t / 0.22;
      x = lerpNumber(-28, -6, s);
      z = lerpNumber(18, 74, s);
      y = lerpNumber(1.2, 4.1, s);
      role = s < 0.45 ? 'support_stair' : 'market_court';
    } else if (t < 0.5) {
      const s = (t - 0.22) / 0.28;
      x = lerpNumber(0, 28, s);
      z = lerpNumber(86, 156, s);
      y = lerpNumber(5.0, 8.6, s);
      role = 'market_court';
    } else if (t < 0.8) {
      const s = (t - 0.5) / 0.3;
      x = lerpNumber(34, 76, s);
      z = lerpNumber(170, 256, s);
      y = lerpNumber(10.0, 13.8, s);
      role = s < 0.68 ? 'roof_lane' : 'bridge_landing';
    } else {
      const s = (t - 0.8) / 0.2;
      x = lerpNumber(84, 42, s);
      z = lerpNumber(270, 338, s);
      y = lerpNumber(11.0, 6.1, s);
      role = s < 0.45 ? 'bridge_landing' : 'underdeck_pass';
    }
    roomOffsets.push([x, z, y]);
    segmentRoles.push(role);
  }
  return {
    realSourceA: district.realSourceA,
    realSourceB: district.realSourceB,
    skeletonType: district.skeletonType,
    patchStyle: district.patchStyle,
    silhouetteRule: district.silhouetteRule,
    roomOffsets,
    segmentRoles,
    circulationBands: [
      { id: 'market_low', y: base + 3.2, role: 'support_stair' },
      { id: 'market_mid', y: base + 7.4, role: 'market_court' },
      { id: 'market_high', y: base + 12.4, role: 'roof_lane' },
    ],
    massAnchors: [
      { id: 'entry_deck', role: 'entry_deck', pos: [origin.x - 58, base - 2.0, origin.z + 26], size: [22, 8, 18] },
      { id: 'market_core', role: 'market_core', pos: [origin.x + 34, base + 2.6, origin.z + 152], size: [38, 16, 30] },
      { id: 'underdeck_support', role: 'underdeck_support', pos: [origin.x - 10, base - 5.0, origin.z + 202], size: [24, 10, 26] },
      { id: 'bridge_cluster', role: 'bridge_cluster', pos: [origin.x + 84, base + 9.2, origin.z + 290], size: [24, 8, 38] },
    ],
    landmarkAnchor: { x: origin.x + 86, y: base + 13.6, z: origin.z + 286, role: 'market_bridge_cluster' },
  };
}

function buildDistrictSkeletonMeta(district) {
  if (district.skeletonType === 'hanging_market_hybrid') return buildHangingMarketDistrictMeta(district);
  return {
    realSourceA: district.realSourceA || null,
    realSourceB: district.realSourceB || null,
    skeletonType: district.skeletonType || null,
    patchStyle: district.patchStyle || null,
    silhouetteRule: district.silhouetteRule || null,
    roomOffsets: null,
    segmentRoles: [],
    circulationBands: [],
    massAnchors: [],
    landmarkAnchor: null,
  };
}

function shuffleWithRng(items, rng) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function sampleRange(rng, range) {
  return range[0] + (range[1] - range[0]) * rng();
}

function pickDistrictLayout(template, rng) {
  const layoutId = pick(rng, template.layoutIds || DISTRICT_LOCAL_LAYOUTS.map((layout) => layout.id));
  return DISTRICT_LOCAL_LAYOUT_MAP[layoutId] || DISTRICT_LOCAL_LAYOUTS[0];
}

function buildDistrictMacroOrigins(rng, templates) {
  const origins = [];
  let zCursor = 0;
  for (let i = 0; i < templates.length; i += 1) {
    const template = templates[i];
    const x = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * sampleRange(rng, template.xRange);
    if (i > 0) zCursor += sampleRange(rng, template.zRange);
    const baseElevation = sampleRange(rng, template.baseRange);
    origins.push(makeVec(x, baseElevation, zCursor));
  }
  return origins;
}

function classifySpineRoute(fromDistrict, toDistrict) {
  const delta = toDistrict.baseElevation - fromDistrict.baseElevation;
  if (delta >= 3.5) return 'climb';
  if (delta <= -3.5) return 'descent';
  return 'traverse';
}

function generateDistrictPlan(levelIndex) {
  const totalRooms = GENERATED_ROOM_BATCH.length;
  const seed = buildLevelSeed(levelIndex) ^ 0x5f3759df;
  const rng = rngFromSeed(seed);
  const climbArchetype = pick(rng, [DISTRICT_ARCHETYPES.scaffolds, DISTRICT_ARCHETYPES.liftworks]);
  const descentArchetype = pick(rng, [DISTRICT_ARCHETYPES.furnace, DISTRICT_ARCHETYPES.refuse]);
  const archetypes = [DISTRICT_ARCHETYPES.intake, climbArchetype, descentArchetype, DISTRICT_ARCHETYPES.shrine];
  const counts = [...pick(rng, DISTRICT_ROOM_COUNT_PROFILES)];
  const templates = archetypes.map((archetype) => DISTRICT_ARCHETYPE_TEMPLATES[archetype.id] || DISTRICT_MACRO_TEMPLATES.intake);
  const origins = buildDistrictMacroOrigins(rng, templates);
  const districts = [];
  const roomToDistrict = new Array(totalRooms).fill(0);
  let roomStart = 0;

  for (let i = 0; i < archetypes.length; i += 1) {
    const archetype = archetypes[i];
    const template = templates[i];
    const layout = pickDistrictLayout(template, rng);
    const roomCount = counts[i];
    const baseElevation = origins[i]?.y ?? sampleRange(rng, template.baseRange);
    const topElevation = Math.max(baseElevation + 4.0, sampleRange(rng, template.topRange));
    const district = {
      index: i,
      id: archetype.id + '-' + (i + 1),
      archetype: archetype.id,
      name: pick(rng, archetype.names),
      purpose: archetype.purpose,
      signal: archetype.signal,
      roomStart,
      roomCount,
      origin: origins[i] || makeVec(0, baseElevation, 0),
      baseElevation,
      topElevation,
      elevationBand: template.elevationBand,
      macroTemplateId: template.id,
      approachType: template.approachType,
      departureType: template.departureType,
      supportStyle: template.supportStyle,
      landmarkRole: template.landmarkRole,
      requiresVisibleBelow: template.requiresVisibleBelow,
      requiresVisibleAbove: template.requiresVisibleAbove,
      layoutId: layout.id,
      layoutPoints: layout.points,
      branchPairs: layout.branchPairs.filter(([a, b]) => a < roomCount && b < roomCount),
      preferredRoles: [...archetype.preferredRoles],
      realSourceA: template.realSourceA || null,
      realSourceB: template.realSourceB || null,
      skeletonType: template.skeletonType || null,
      patchStyle: template.patchStyle || null,
      silhouetteRule: template.silhouetteRule || null,
    };
    Object.assign(district, buildDistrictSkeletonMeta(district));
    for (let j = 0; j < roomCount && roomStart + j < totalRooms; j += 1) roomToDistrict[roomStart + j] = i;
    roomStart += roomCount;
    districts.push(district);
  }

  if (roomStart < totalRooms && districts.length) {
    const lastDistrict = districts[districts.length - 1];
    lastDistrict.roomCount += totalRooms - roomStart;
    for (let i = roomStart; i < totalRooms; i += 1) roomToDistrict[i] = districts.length - 1;
  }

  const mainSpineEdges = [];
  const returnEdges = [];
  const landmarkViews = [];
  for (let i = 0; i < districts.length - 1; i += 1) {
    const fromDistrict = districts[i];
    const toDistrict = districts[i + 1];
    const routeType = classifySpineRoute(fromDistrict, toDistrict);
    mainSpineEdges.push({
      id: fromDistrict.id + '->' + toDistrict.id,
      from: fromDistrict.id,
      to: toDistrict.id,
      fromIndex: fromDistrict.index,
      toIndex: toDistrict.index,
      routeType,
      verticalDelta: Number((toDistrict.baseElevation - fromDistrict.baseElevation).toFixed(2)),
      supportStyle: routeType === 'descent' ? 'buttress_stack' : routeType === 'climb' ? 'lift_cage' : 'chain_hangs',
    });
    landmarkViews.push({
      from: fromDistrict.id,
      to: toDistrict.id,
      fromIndex: fromDistrict.index,
      toIndex: toDistrict.index,
      lookDirection: toDistrict.baseElevation >= fromDistrict.baseElevation ? 'look_up' : 'look_down',
      landmarkRole: toDistrict.landmarkRole,
      routeType,
    });
  }
  if (districts[2] && districts[0]) {
    returnEdges.push({
      id: districts[2].id + '->' + districts[0].id,
      from: districts[2].id,
      to: districts[0].id,
      fromIndex: districts[2].index,
      toIndex: districts[0].index,
      routeType: 'maintenance_return',
      note: 'low maintenance return back toward intake',
    });
  }
  if (districts[3] && districts[1]) {
    returnEdges.push({
      id: districts[3].id + '->' + districts[1].id,
      from: districts[3].id,
      to: districts[1].id,
      fromIndex: districts[3].index,
      toIndex: districts[1].index,
      routeType: 'overlook_return',
      note: 'rim overlook back toward the climb district',
    });
  }

  return { levelIndex, seed, districts, roomToDistrict, mainSpineEdges, returnEdges, landmarkViews };
}

function ensureDistrictPlan() {
  if (!roomState.districtPlan || roomState.districtPlan.levelIndex !== roomState.levelIndex) {
    roomState.districtPlan = generateDistrictPlan(roomState.levelIndex);
  }
  return roomState.districtPlan;
}

function districtInfoForRoomIndex(index, plan = roomState.districtPlan || ensureDistrictPlan()) {
  const safeIndex = clamp(index, 0, GENERATED_ROOM_BATCH.length - 1);
  const districtIndex = clamp(plan.roomToDistrict[safeIndex] || 0, 0, Math.max(0, plan.districts.length - 1));
  const district = plan.districts[districtIndex] || plan.districts[0];
  const localIndex = Math.max(0, safeIndex - (district?.roomStart || 0));
  return { districtIndex, district, localIndex };
}

function batchRoomWorldOffset(index, plan = roomState.districtPlan || ensureDistrictPlan()) {
  const info = districtInfoForRoomIndex(index, plan);
  const districtPoints = info.district?.roomOffsets?.length ? info.district.roomOffsets : info.district?.layoutPoints;
  const points = districtPoints || DISTRICT_LOCAL_LAYOUTS[0].points;
  const point = points[Math.min(info.localIndex, points.length - 1)] || points[points.length - 1] || [0, 0, 0];
  return makeVec(info.district.origin.x + point[0], info.district.origin.y + (point[2] || 0), info.district.origin.z + point[1]);
}

function connectorTowardOffset(fromOffset, toOffset) {
  const dx = toOffset.x - fromOffset.x;
  const dz = toOffset.z - fromOffset.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'E' : 'W';
  return dz >= 0 ? 'N' : 'S';
}

function roomWantsBranch(index) {
  const spec = GENERATED_ROOM_BATCH[index] || {};
  const text = [spec.id, spec.junction_class, spec.semantic_role, ...(spec.route_sentence || [])].join(' ');
  return /3c|4c|hub|junction|secret|shortcut|return|loop|reward|key|switch/.test(text);
}

function buildDistrictBranchLinks(plan = roomState.districtPlan || ensureDistrictPlan()) {
  const links = [];
  for (const district of plan.districts) {
    for (const [fromLocal, toLocal] of district.branchPairs) {
      const a = district.roomStart + fromLocal;
      const b = district.roomStart + toLocal;
      if (a >= GENERATED_ROOM_BATCH.length || b >= GENERATED_ROOM_BATCH.length) continue;
      const offsetA = batchRoomWorldOffset(a, plan);
      const offsetB = batchRoomWorldOffset(b, plan);
      links.push({
        a,
        b,
        sideA: connectorTowardOffset(offsetA, offsetB),
        sideB: connectorTowardOffset(offsetB, offsetA),
      });
    }
  }
  return links;
}

function addWorldConnector(index, from, to, options = {}) {
  const fromTop = from.y - PLAYER_EYE_HEIGHT;
  const toTop = to.y - PLAYER_EYE_HEIGHT;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  const padClearance = options.branch ? 3.9 : 3.25;
  const fromRun = makeVec(from.x + ux * padClearance, from.y, from.z + uz * padClearance);
  const toRun = makeVec(to.x - ux * padClearance, to.y, to.z - uz * padClearance);
  const corner = Math.abs(dx) > Math.abs(dz)
    ? makeVec(toRun.x, fromRun.y, fromRun.z)
    : makeVec(fromRun.x, fromRun.y, toRun.z);
  const heightDelta = Math.abs(toTop - fromTop);
  const routeTopA = Math.max(0.34, fromTop + 0.14);
  const routeTopB = Math.max(0.34, toTop + 0.14);

  if (heightDelta > 0.28) {
    const firstDx = corner.x - fromRun.x;
    const firstDz = corner.z - fromRun.z;
    const firstLen = Math.hypot(firstDx, firstDz);
    const secondDx = toRun.x - corner.x;
    const secondDz = toRun.z - corner.z;
    const secondLen = Math.hypot(secondDx, secondDz);
    const minUsefulRun = Math.max(7.5, heightDelta * 5.2);
    if (secondLen >= minUsefulRun || secondLen >= firstLen) {
      addBatchRouteSegment(roomGroup, 'gauntlet-connector-' + index + '-a', fromRun, corner, routeTopA, 3.2, MAT.connectorFloor, 1.25);
      addBatchStairRun(roomGroup, 'gauntlet-connector-' + index + '-rise', corner, toRun, fromTop + 0.18, toTop + 0.18, MAT.connectorFloor);
    } else if (firstLen > 0.5) {
      const stairLen = Math.min(firstLen, Math.max(minUsefulRun, Math.min(firstLen, heightDelta * 8.5)));
      const sx = corner.x - (firstDx / firstLen) * stairLen;
      const sz = corner.z - (firstDz / firstLen) * stairLen;
      const stairStart = makeVec(sx, fromRun.y, sz);
      addBatchRouteSegment(roomGroup, 'gauntlet-connector-' + index + '-a', fromRun, stairStart, routeTopA, 3.2, MAT.connectorFloor, 1.25);
      addBatchStairRun(roomGroup, 'gauntlet-connector-' + index + '-rise', stairStart, corner, fromTop + 0.18, toTop + 0.18, MAT.connectorFloor);
      addBatchRouteSegment(roomGroup, 'gauntlet-connector-' + index + '-b', makeVec(corner.x, to.y, corner.z), toRun, routeTopB, 3.2, MAT.connectorFloor, 1.25);
    } else {
      addBatchStairRun(roomGroup, 'gauntlet-connector-' + index + '-rise', fromRun, toRun, fromTop + 0.18, toTop + 0.18, MAT.connectorFloor);
    }
  } else {
    addBatchRouteSegment(roomGroup, 'gauntlet-connector-' + index + '-a', fromRun, corner, routeTopA, 3.2, MAT.connectorFloor, 1.25);
    addBatchRouteSegment(roomGroup, 'gauntlet-connector-' + index + '-b', corner, toRun, routeTopB, 3.2, MAT.connectorFloor, 1.25);
  }

  const addSignal = options.signal || Number(index) % 3 === 0;
  if (addSignal) {
    const safeName = String(index).replace(/[^a-z0-9_-]/gi, '-');
    const signalPos = heightDelta > 0.28 ? makeVec((fromRun.x + toRun.x) * 0.5, 0, (fromRun.z + toRun.z) * 0.5) : corner;
    addBrazier(roomGroup, 'gauntlet-connector-' + safeName + '-corpsefire', [signalPos.x, Math.max(0, Math.min(fromTop, toTop)), signalPos.z], { kind: options.branch ? 'corpsefire' : 'flame' });
  }
}

function snapAnchorToSupport(point) {
  if (!point) return null;
  const floorY = point.y - PLAYER_EYE_HEIGHT;
  const support = findEnemySupport(point.x, point.z, floorY, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  return support ? makeVec(point.x, support.topY + PLAYER_EYE_HEIGHT, point.z) : point.clone();
}

function snapEnemyPointToSupport(point) {
  if (!point) return null;
  const support = findEnemySupport(point.x, point.z, point.y, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  return support ? makeVec(point.x, support.topY, point.z) : point.clone();
}

function anchorFloorPoint(point) {
  return makeVec(point.x, point.y - PLAYER_EYE_HEIGHT, point.z);
}

function canEnemyTraverseSegment(from, to) {
  return !!sampleEnemyMoveSupport(from, to) || (!!enemy && enemyCanJumpBetween(from, to));
}

function canEnemyTraverseBetween(room, fromAnchor, toAnchor) {
  if (!fromAnchor || !toAnchor) return false;
  const from = anchorFloorPoint(fromAnchor);
  const to = anchorFloorPoint(toAnchor);
  if (canEnemyTraverseSegment(from, to)) return true;
  if (!room) return false;
  const route = buildEnemyLocalRoute(room, from, to);
  if (!route?.length) return false;
  let cursor = from;
  for (const point of route) {
    if (!canEnemyTraverseSegment(cursor, point)) return false;
    cursor = point;
  }
  return cursor.distanceToSquared(to) < 0.04 || canEnemyTraverseSegment(cursor, to);
}

function addHangingMarketStall(parent, prefix, x, y, z, width, depth, yaw = 0) {
  const postHeight = 1.9;
  const roofY = y + postHeight + 0.16;
  const stall = new THREE.Group();
  stall.position.set(x, 0, z);
  stall.rotation.y = yaw;
  addGroundedBeveledBox(stall, prefix + '-counter', [width * 0.82, 0.42, depth * 0.78], [0, y, 0], MAT.bridge, true, 0.03, 1);
  addGroundedBeveledBox(stall, prefix + '-crate-a', [0.52, 0.34, 0.48], [-width * 0.22, y + 0.42, -depth * 0.12], MAT.trim, false, 0.02, 1);
  addGroundedBeveledBox(stall, prefix + '-crate-b', [0.48, 0.28, 0.42], [width * 0.18, y + 0.42, depth * 0.08], MAT.iron, false, 0.02, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addBeveledBox(stall, prefix + '-post-' + sx + '-' + sz, [0.16, postHeight, 0.16], [sx * (width * 0.42), y + postHeight * 0.5, sz * (depth * 0.42)], MAT.iron, false, 0.02, 1);
  }
  addBeveledBox(stall, prefix + '-roof', [width, 0.14, depth], [0, roofY, 0], MAT.trim, false, 0.02, 1);
  addBeveledBox(stall, prefix + '-awning', [width * 0.78, 0.08, depth * 0.34], [0, roofY - 0.12, depth * 0.34], MAT.bronze, false, 0.01, 1).rotation.x = -0.18;
  parent.add(stall);
  return stall;
}

function addHangingMarketDistrictSkeleton(district) {
  const masses = district.massAnchors || [];
  for (const mass of masses) {
    const center = mass.pos;
    const size = mass.size;
    const y = center[1] + size[1] * 0.5;
    const mat = mass.role === 'bridge_cluster' ? MAT.bridge : mass.role === 'underdeck_support' ? MAT.iron : MAT.stone2;
    addWalkableBox(roomGroup, 'district-' + district.id + '-' + mass.id, size, [center[0], y, center[2]], mat, true, 0.2);
  }

  const lowBand = district.circulationBands?.[0]?.y ?? district.baseElevation + 3.2;
  const midBand = district.circulationBands?.[1]?.y ?? district.baseElevation + 7.4;
  const highBand = district.circulationBands?.[2]?.y ?? district.baseElevation + 12.4;
  for (let i = 0; i < 9; i += 1) {
    const z = district.origin.z + 92 + i * 24;
    const x = district.origin.x - 20 + (i % 3) * 18;
    addGroundedCylinder(roomGroup, 'district-' + district.id + '-support-' + i, 1.2 + (i % 2) * 0.2, Math.max(8, highBand - district.baseElevation + 10), [x, district.baseElevation - 10, z], MAT.iron, 6);
    addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-brace-' + i, [1.2, 10 + (i % 3) * 2, 1.2], [x + 5, district.baseElevation - 8, z + 5], MAT.trim, false, 0.03, 1).rotation.z = 0.42;
    if (i < 7) addHangingChain(roomGroup, 'district-' + district.id + '-chain-' + i, x, z, highBand + 2.6, 6, MAT.iron, rngFromSeed(hashRoomKey(district.id + '-chain-' + i)), { length: 2.8 + (i % 3) * 0.45, sway: 0.02, dropStone: false });
  }

  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-entry-a', district.origin.x - 34, lowBand + 0.1, district.origin.z + 62, 4.2, 2.6, 0.18);
  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-entry-b', district.origin.x - 12, lowBand + 0.1, district.origin.z + 94, 4.8, 2.8, -0.12);
  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-core-a', district.origin.x + 12, midBand + 0.1, district.origin.z + 148, 5.2, 3.0, 0.1);
  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-core-b', district.origin.x + 36, midBand + 0.1, district.origin.z + 176, 4.4, 2.8, -0.08);
  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-bridge-a', district.origin.x + 58, highBand + 0.1, district.origin.z + 230, 4.6, 2.6, 0.22);
  addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-bridge-b', district.origin.x + 78, highBand + 0.1, district.origin.z + 264, 4.0, 2.4, -0.2);
  addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-crate-stack-a', [1.8, 1.1, 1.4], [district.origin.x - 18, lowBand + 0.05, district.origin.z + 118], MAT.iron, false, 0.03, 1);
  addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-crate-stack-b', [1.6, 0.9, 1.2], [district.origin.x + 18, midBand + 0.05, district.origin.z + 198], MAT.trim, false, 0.03, 1);
  addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-crate-stack-c', [1.4, 0.8, 1.0], [district.origin.x + 68, highBand + 0.05, district.origin.z + 252], MAT.iron, false, 0.03, 1);
  addBrazier(roomGroup, 'district-' + district.id + '-market-brazier-a', [district.origin.x - 8, lowBand + 0.18, district.origin.z + 88], { kind: 'flame' });
  addBrazier(roomGroup, 'district-' + district.id + '-market-brazier-b', [district.origin.x + 28, midBand + 0.18, district.origin.z + 168], { kind: 'corpsefire' });
  addBrazier(roomGroup, 'district-' + district.id + '-market-brazier-c', [district.origin.x + 74, highBand + 0.18, district.origin.z + 258], { kind: 'flame' });

  addBatchRouteSegment(roomGroup, 'district-' + district.id + '-roof-cross', makeVec(district.origin.x + 24, highBand, district.origin.z + 174), makeVec(district.origin.x + 86, highBand + 0.8, district.origin.z + 272), highBand + 0.18, 4.2, MAT.bridge, 1.0);
  addBatchRouteSegment(roomGroup, 'district-' + district.id + '-underdeck-cross', makeVec(district.origin.x - 20, lowBand, district.origin.z + 146), makeVec(district.origin.x + 38, lowBand - 0.4, district.origin.z + 242), lowBand + 0.18, 3.4, MAT.connectorFloor, 1.0);
  addBatchStairRun(roomGroup, 'district-' + district.id + '-market-rise', makeVec(district.origin.x - 6, lowBand + PLAYER_EYE_HEIGHT, district.origin.z + 82), makeVec(district.origin.x + 24, midBand + PLAYER_EYE_HEIGHT, district.origin.z + 146), lowBand + 0.18, midBand + 0.18, MAT.platform);

  const landmark = district.landmarkAnchor;
  if (landmark) addBrazier(roomGroup, 'district-' + district.id + '-landmark', [landmark.x, landmark.y - PLAYER_EYE_HEIGHT + 0.4, landmark.z], { kind: 'corpsefire' });
}

function addDistrictSkeletonGeometry(district) {
  if (!district) return;
  if (district.skeletonType === 'hanging_market_hybrid') addHangingMarketDistrictSkeleton(district);
}

function validateAndRepairGauntletConnectivity(rooms, branchLinks) {
  const repairs = [];
  const roomRepairCounts = new Map();
  const repairKeys = new Set();
  const pairKey = (from, to) => {
    const a = [Math.round(from.x * 10), Math.round(from.y * 10), Math.round(from.z * 10)].join(',');
    const b = [Math.round(to.x * 10), Math.round(to.y * 10), Math.round(to.z * 10)].join(',');
    return a < b ? a + '|' + b : b + '|' + a;
  };
  const canRepairRoom = (roomIndex) => roomIndex == null || (roomRepairCounts.get(roomIndex) || 0) < BUILD_REPAIR_PER_ROOM_BUDGET;
  const noteRepair = (roomIndex) => {
    if (roomIndex == null) return;
    roomRepairCounts.set(roomIndex, (roomRepairCounts.get(roomIndex) || 0) + 1);
  };
  const tryRepair = (name, from, to, room, roomIndexes = [], options = {}) => {
    if (!from || !to || repairs.length >= BUILD_REPAIR_TOTAL_BUDGET) return false;
    const key = pairKey(from, to);
    if (repairKeys.has(key)) return false;
    for (const roomIndex of roomIndexes) {
      if (!canRepairRoom(roomIndex)) return false;
    }
    addWorldConnector('repair-' + name, from, to, options);
    repairKeys.add(key);
    repairs.push({ name, from: from.clone(), to: to.clone(), roomIndexes: [...roomIndexes] });
    for (const roomIndex of roomIndexes) noteRepair(roomIndex);
    return canEnemyTraverseBetween(room, from, to);
  };

  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i];
    const pairs = [{ name: 'room-' + i + '-main', from: room.spawn, to: room.exit }];
    for (const [socketKey, socketPoint] of Object.entries(room.sockets || {})) {
      pairs.push({ name: 'room-' + i + '-socket-' + socketKey.toLowerCase(), from: room.spawn, to: socketPoint });
    }
    for (const pair of pairs) {
      if (canEnemyTraverseBetween(room, pair.from, pair.to)) continue;
      tryRepair(pair.name, pair.from, pair.to, room, [i]);
    }
  }

  for (let i = 0; i < rooms.length - 1; i += 1) {
    const from = rooms[i]?.exit;
    const to = rooms[i + 1]?.spawn;
    if (!from || !to || canEnemyTraverseBetween(null, from, to)) continue;
    tryRepair('spine-' + i, from, to, null, [i, i + 1]);
  }

  for (let i = 0; i < branchLinks.length; i += 1) {
    const link = branchLinks[i];
    const from = rooms[link.a]?.sockets?.[link.sideA];
    const to = rooms[link.b]?.sockets?.[link.sideB];
    if (!from || !to || canEnemyTraverseBetween(null, from, to)) continue;
    tryRepair('branch-' + i, from, to, null, [link.a, link.b], { branch: true });
  }

  const unresolved = [];
  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i];
    if (!canEnemyTraverseBetween(room, room.spawn, room.exit)) unresolved.push('room-' + i + '-main');
    for (const [socketKey, socketPoint] of Object.entries(room.sockets || {})) {
      if (!canEnemyTraverseBetween(room, room.spawn, socketPoint)) unresolved.push('room-' + i + '-socket-' + socketKey.toLowerCase());
    }
  }
  for (let i = 0; i < rooms.length - 1; i += 1) {
    const from = rooms[i]?.exit;
    const to = rooms[i + 1]?.spawn;
    if (from && to && !canEnemyTraverseBetween(null, from, to)) unresolved.push('spine-' + i);
  }
  for (let i = 0; i < branchLinks.length; i += 1) {
    const link = branchLinks[i];
    const from = rooms[link.a]?.sockets?.[link.sideA];
    const to = rooms[link.b]?.sockets?.[link.sideB];
    if (from && to && !canEnemyTraverseBetween(null, from, to)) unresolved.push('branch-' + i);
  }

  return { repairs, unresolved };
}

function buildGeneratedGauntlet(startIndex = 0) {
  const districtPlan = ensureDistrictPlan();
  const rooms = [];
  const linkKeys = new Set();
  const branchLinks = buildDistrictBranchLinks(districtPlan);
  const branchSides = Array.from({ length: GENERATED_ROOM_BATCH.length }, () => new Set());
  for (const link of branchLinks) {
    branchSides[link.a].add(link.sideA);
    branchSides[link.b].add(link.sideB);
  }
  for (let i = 0; i < GENERATED_ROOM_BATCH.length; i += 1) {
    const offset = batchRoomWorldOffset(i, districtPlan);
    const prevOffset = i > 0 ? batchRoomWorldOffset(i - 1, districtPlan) : null;
    const nextOffset = i < GENERATED_ROOM_BATCH.length - 1 ? batchRoomWorldOffset(i + 1, districtPlan) : null;
    const districtInfo = districtInfoForRoomIndex(i, districtPlan);
    const path = {
      entryConnector: prevOffset ? connectorTowardOffset(offset, prevOffset) : null,
      exitConnector: nextOffset ? connectorTowardOffset(offset, nextOffset) : null,
      branchConnectors: [...branchSides[i]],
    };
    const built = withBatchBuildOffset(offset, () => buildGeneratedBatchRoom(GENERATED_ROOM_BATCH[i], i, path));
    const spawn = snapAnchorToSupport(built.spawn.clone().add(offset));
    const exit = snapAnchorToSupport(built.exit.clone().add(offset));
    const enemyPositions = built.enemyPositions.map((pos) => snapEnemyPointToSupport(pos.clone().add(offset)));
    const sockets = Object.fromEntries(Object.entries(built.sockets).map(([key, pos]) => [key, snapAnchorToSupport(pos.clone().add(offset))]));
    rooms.push({
      spec: GENERATED_ROOM_BATCH[i],
      district: districtInfo.district,
      districtIndex: districtInfo.districtIndex,
      spawn,
      exit,
      enemyPositions,
      sockets,
      bounds: {
        minX: built.bounds.minX + offset.x,
        maxX: built.bounds.maxX + offset.x,
        minZ: built.bounds.minZ + offset.z,
        maxZ: built.bounds.maxZ + offset.z,
      },
    });
  }
  const addUniqueConnector = (name, from, to, options = {}) => {
    if (!from || !to) return;
    const ax = Math.round(from.x * 10);
    const ay = Math.round(from.y * 10);
    const az = Math.round(from.z * 10);
    const bx = Math.round(to.x * 10);
    const by = Math.round(to.y * 10);
    const bz = Math.round(to.z * 10);
    const aKey = ax + ',' + ay + ',' + az;
    const bKey = bx + ',' + by + ',' + bz;
    const key = aKey < bKey ? aKey + '|' + bKey : bKey + '|' + aKey;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    addWorldConnector(name, from, to, options);
  };
  for (let i = 0; i < rooms.length - 1; i += 1) addUniqueConnector(i, rooms[i].exit, rooms[i + 1].spawn);
  for (let i = 0; i < branchLinks.length; i += 1) {
    const link = branchLinks[i];
    const from = rooms[link.a]?.sockets?.[link.sideA];
    const to = rooms[link.b]?.sockets?.[link.sideB];
    addUniqueConnector('branch-' + i, from, to, { branch: true, signal: true });
  }
  for (const district of districtPlan.districts) addDistrictSkeletonGeometry(district);
  const connectivity = validateAndRepairGauntletConnectivity(rooms, branchLinks);
  const first = rooms[Math.max(0, Math.min(startIndex, rooms.length - 1))] || rooms[0];
  const last = rooms[rooms.length - 1] || first;
  const minX = Math.min(...rooms.map((room) => room.bounds.minX), -14);
  const maxX = Math.max(...rooms.map((room) => room.bounds.maxX), 14);
  const minZ = Math.min(...rooms.map((room) => room.bounds.minZ), -18);
  const maxZ = Math.max(...rooms.map((room) => room.bounds.maxZ), 18);
  return {
    rooms,
    plan: districtPlan,
    spawn: first.spawn,
    exit: last.exit,
    exitRadius: 2.35,
    enemyPositions: first.enemyPositions,
    bounds: { minX, maxX, minZ, maxZ },
    connectivity,
  };
}


function updateCurrentGauntletRoom() {
  if (!roomState.gauntletRooms?.length) return;
  let bestIndex = roomState.nodeIndex;
  let bestDist = Infinity;
  for (let i = 0; i < roomState.gauntletRooms.length; i += 1) {
    const center = batchRoomWorldOffset(i, roomState.districtPlan || ensureDistrictPlan());
    const dx = player.position.x - center.x;
    const dz = player.position.z - center.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDist) {
      bestDist = distSq;
      bestIndex = i;
    }
  }
  if (bestIndex !== roomState.nodeIndex) {
    roomState.nodeIndex = bestIndex;
    setNodeIndex(bestIndex);
    const spec = GENERATED_ROOM_BATCH[bestIndex];
    const districtInfo = districtInfoForRoomIndex(bestIndex, roomState.districtPlan || ensureDistrictPlan());
    roomState.spec = {
      index: bestIndex,
      connector: spec.id,
      type: spec.junction_class,
      roomRole: spec.semantic_role,
      landmark: spec.batch_prompt,
      routeSentence: spec.route_sentence,
      districtId: districtInfo.district.id,
      districtName: districtInfo.district.name,
      districtPurpose: districtInfo.district.purpose,
      districtIndex: districtInfo.districtIndex,
      districtRoomIndex: districtInfo.localIndex,
      districtElevationBand: districtInfo.district.elevationBand,
      districtBaseElevation: districtInfo.district.baseElevation,
      districtTopElevation: districtInfo.district.topElevation,
      districtMacroTemplateId: districtInfo.district.macroTemplateId,
      districtSkeletonType: districtInfo.district.skeletonType,
      districtSegmentRole: districtInfo.district.segmentRoles?.[districtInfo.localIndex] || null,
    };
    setStatus('district ' + (districtInfo.districtIndex + 1) + '/' + (roomState.districtPlan?.districts.length || 0) + ' | ' + districtInfo.district.elevationBand + ' @' + districtInfo.district.baseElevation.toFixed(1) + ' | room ' + (bestIndex + 1) + '/' + GENERATED_ROOM_BATCH.length + ' | ' + districtInfo.district.name + ' | ' + spec.id);
  }
}


function completeGeneratedGauntlet() {
  roomState.levelIndex += 1;
  roomState.nodeIndex = 0;
  setLevelIndex(roomState.levelIndex);
  setNodeIndex(0);
  buildRoom(true);
}

function buildRoom(movePlayer = true) {
  const rootGroup = roomGroup;
  clearGroup(rootGroup);
  resetWalkableBounds();
  roomState.transitionLock = 0.7;
  const startIndex = Math.max(0, Math.min(roomState.nodeIndex, GENERATED_ROOM_BATCH.length - 1));
  const built = buildGeneratedGauntlet(startIndex);
  const districtPlan = built.plan;
  const spec = GENERATED_ROOM_BATCH[startIndex] || GENERATED_ROOM_BATCH[0];
  const districtInfo = districtInfoForRoomIndex(startIndex, districtPlan);
  roomState.districtPlan = districtPlan;
  roomState.plan = {
    levelIndex: roomState.levelIndex,
    seed: districtPlan.seed,
    districts: districtPlan.districts.map((district) => ({
      id: district.id,
      name: district.name,
      purpose: district.purpose,
      archetype: district.archetype,
      roomStart: district.roomStart,
      roomCount: district.roomCount,
      layoutId: district.layoutId,
      elevationBand: district.elevationBand,
      baseElevation: district.baseElevation,
      topElevation: district.topElevation,
      macroTemplateId: district.macroTemplateId,
      approachType: district.approachType,
      departureType: district.departureType,
      supportStyle: district.supportStyle,
      landmarkRole: district.landmarkRole,
      requiresVisibleBelow: district.requiresVisibleBelow,
      requiresVisibleAbove: district.requiresVisibleAbove,
      realSourceA: district.realSourceA,
      realSourceB: district.realSourceB,
      skeletonType: district.skeletonType,
      patchStyle: district.patchStyle,
      silhouetteRule: district.silhouetteRule,
      segmentRoles: [...(district.segmentRoles || [])],
    })),
    mainSpineEdges: districtPlan.mainSpineEdges.map((edge) => ({ ...edge })),
    returnEdges: districtPlan.returnEdges.map((edge) => ({ ...edge })),
    landmarkViews: districtPlan.landmarkViews.map((view) => ({ ...view })),
    nodes: GENERATED_ROOM_BATCH.map((room, index) => {
      const info = districtInfoForRoomIndex(index, districtPlan);
      return {
        index,
        connector: room.id,
        type: room.junction_class,
        districtId: info.district.id,
        districtName: info.district.name,
        districtPurpose: info.district.purpose,
        districtElevationBand: info.district.elevationBand,
        districtBaseElevation: info.district.baseElevation,
        districtTopElevation: info.district.topElevation,
        districtMacroTemplateId: info.district.macroTemplateId,
        districtSkeletonType: info.district.skeletonType,
        districtSegmentRole: info.district.segmentRoles?.[info.localIndex] || null,
      };
    }),
  };
  roomState.gauntletRooms = built.rooms;
  roomState.navGraph = buildRoomTraversalGraph(built.rooms, GENERATED_ROOM_BATCH, buildDistrictBranchLinks(districtPlan));
  roomState.connectivityRepair = built.connectivity;
  refreshNavGraphDebug(roomState.navGraph);
  if (built.connectivity?.repairs?.length || built.connectivity?.unresolved?.length) {
    console.warn('gauntlet connectivity repair', built.connectivity);
  }
  roomState.nodeIndex = startIndex;
  roomState.spec = {
    index: startIndex,
    connector: spec.id,
    type: spec.junction_class,
    roomRole: spec.semantic_role,
    landmark: spec.batch_prompt,
    routeSentence: spec.route_sentence,
    districtId: districtInfo.district.id,
    districtName: districtInfo.district.name,
    districtPurpose: districtInfo.district.purpose,
    districtIndex: districtInfo.districtIndex,
    districtRoomIndex: districtInfo.localIndex,
    districtElevationBand: districtInfo.district.elevationBand,
    districtBaseElevation: districtInfo.district.baseElevation,
    districtTopElevation: districtInfo.district.topElevation,
    districtMacroTemplateId: districtInfo.district.macroTemplateId,
    districtSkeletonType: districtInfo.district.skeletonType,
    districtSegmentRole: districtInfo.district.segmentRoles?.[districtInfo.localIndex] || null,
  };
  roomState.seed = hashRoomKey(spec.id || String(startIndex));
  roomState.spawn.copy(built.spawn);
  roomState.exit.copy(built.exit);
  roomState.exitRadius = built.exitRadius;
  roomState.enemyPositions = built.enemyPositions.map((pos) => resolveEnemySpawnPoint(pos));
  roomState.levelBounds = built.bounds;
  positionEnemy(roomState.enemyPositions[0]);

  if (movePlayer) {
    player.position.copy(roomState.spawn);
    player.visualPosition.copy(player.position);
    player.velocity.set(0, 0, 0);
    input.smoothMoveX = 0;
    input.smoothMoveY = 0;
    player.grounded = true;
    player.runCharge = 0;
    player.lastRunIntent = false;
    player.attack = null;
    player.attackTimer = 0;
  }
  const repairNote = built.connectivity?.repairs?.length ? ' | repairs ' + built.connectivity.repairs.length : '';
  const unresolvedNote = built.connectivity?.unresolved?.length ? ' | unresolved ' + built.connectivity.unresolved.length : '';
  setStatus('district ' + (districtInfo.districtIndex + 1) + '/' + districtPlan.districts.length + ' | ' + districtInfo.district.elevationBand + ' @' + districtInfo.district.baseElevation.toFixed(1) + ' | room ' + (startIndex + 1) + '/' + GENERATED_ROOM_BATCH.length + ' | ' + districtInfo.district.name + ' | ' + districtInfo.district.purpose + repairNote + unresolvedNote);
}


function buildEnemy() {
  if (enemy && enemy.parent) enemy.parent.remove(enemy);
  enemy = new THREE.Group();
  enemy.name = 'enemy-root';
  enemy.position.set(0, 0, 4.8);
  enemy.userData.health = 3;
  enemy.userData.hitTimer = 0;
  enemy.userData.dead = false;
  enemy.userData.deathTimer = 0;
  enemy.userData.baseY = enemy.position.y;
  enemy.userData.attackTimer = 0;
  enemy.userData.attackElapsed = 0;
  enemy.userData.attackCooldown = 0.75;
  enemy.userData.attackHitDone = false;
  enemy.userData.attackName = '';
  enemy.userData.mode = 'approach';
  enemy.userData.modeTimer = 0;
  enemy.userData.commitTimer = ENEMY_COMMIT_INTERVAL * 0.55;
  enemy.userData.commitElapsed = 0;
  enemy.userData.orbitSign = 1;

  enemyPrimitiveVisual = new THREE.Group();
  enemyPrimitiveVisual.name = 'broken-knight-fallback';
  addBox(enemyPrimitiveVisual, 'broken-knight-torso', [0.9, 1.25, 0.42], [0, 1.18, 0], MAT.iron);
  addBox(enemyPrimitiveVisual, 'broken-knight-head', [0.58, 0.5, 0.5], [0, 2.15, 0], MAT.stone2);
  addBox(enemyPrimitiveVisual, 'broken-knight-left-arm', [0.32, 1.05, 0.32], [-0.74, 1.2, 0], MAT.iron).rotation.z = -0.28;
  addBox(enemyPrimitiveVisual, 'broken-knight-right-arm', [0.32, 1.05, 0.32], [0.74, 1.2, 0], MAT.iron).rotation.z = 0.28;
  addBox(enemyPrimitiveVisual, 'broken-knight-legs', [0.34, 1.0, 0.32], [-0.26, 0.48, 0], MAT.iron);
  addBox(enemyPrimitiveVisual, 'broken-knight-legs', [0.34, 1.0, 0.32], [0.26, 0.48, 0], MAT.iron);
  const sword = addBox(enemyPrimitiveVisual, 'execution-sword', [0.16, 1.9, 0.16], [1.25, 1.25, 0.08], MAT.bone);
  sword.rotation.z = -0.42;
  enemy.add(enemyPrimitiveVisual);
  enemy.traverse((node) => { if (node.isMesh) node.castShadow = USE_DYNAMIC_SHADOWS; });
  scene.add(enemy);
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xf2e8d6, 0x3a4654, 1.18));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.16);
  key.position.set(-4, 8, -5);
  key.castShadow = false;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9bd4ff, 0.62);
  rim.position.set(5, 3, 7);
  rim.castShadow = false;
  scene.add(rim);
}

function buildFallbackArms() {
  const group = new THREE.Group();
  group.name = 'fallback-camera-space-arms';
  const left = addBox(group, 'left-primitive-arm', [0.32, 0.32, 2.6], [-0.62, -0.45, 1.7], MAT.flesh);
  const right = addBox(group, 'right-primitive-arm', [0.32, 0.32, 2.6], [0.62, -0.45, 1.7], MAT.flesh);
  const fistL = addBox(group, 'left-fist', [0.48, 0.42, 0.54], [-0.62, -0.45, 3.02], MAT.flesh);
  const fistR = addBox(group, 'right-fist', [0.48, 0.42, 0.54], [0.62, -0.45, 3.02], MAT.flesh);
  left.rotation.y = -0.17;
  right.rotation.y = 0.17;
  fistL.rotation.y = -0.17;
  fistR.rotation.y = 0.17;
  armsScene.add(group);
  return group;
}
const fallbackArms = buildFallbackArms();

function findBone(root, name) {
  let found = null;
  root.traverse((node) => { if (!found && node.isBone && node.name === name) found = node; });
  return found;
}

function clipMap(clips) {
  return new Map(clips.map((clip) => [clip.name, clip]));
}

function chooseClip(clips, names) {
  for (const name of names) {
    const exact = clips.find((clip) => clip.name === name);
    if (exact) return exact;
  }
  for (const name of names) {
    const partial = clips.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase()));
    if (partial) return partial;
  }
  return clips[0] || null;
}

function findClipByNames(clips, names) {
  for (const name of names) {
    const exact = clips.find((clip) => clip.name === name);
    if (exact) return exact;
  }
  for (const name of names) {
    const partial = clips.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase()));
    if (partial) return partial;
  }
  return null;
}

function interpolationFromName(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('discrete')) return THREE.InterpolateDiscrete;
  if (value.includes('smooth')) return THREE.InterpolateSmooth;
  return THREE.InterpolateLinear;
}

function deserializePoseClip(data, fallbackName = 'pose clip') {
  const clipData = data?.clip || data;
  if (!clipData || !Array.isArray(clipData.tracks)) return null;
  const tracks = [];
  for (const entry of clipData.tracks) {
    const name = String(entry.name || '');
    const interpolation = interpolationFromName(entry.interpolation);
    const times = Float32Array.from(entry.times || []);
    const values = entry.type === 'bool' || entry.type === 'string' ? Array.from(entry.values || []) : Float32Array.from(entry.values || []);
    let track = null;
    if (entry.type === 'quaternion' || name.endsWith('.quaternion')) track = new THREE.QuaternionKeyframeTrack(name, times, values, interpolation);
    else if (entry.type === 'vector' || name.endsWith('.position') || name.endsWith('.scale')) track = new THREE.VectorKeyframeTrack(name, times, values, interpolation);
    else if (entry.type === 'bool') track = new THREE.BooleanKeyframeTrack(name, times, values, interpolation);
    else if (entry.type === 'string') track = new THREE.StringKeyframeTrack(name, times, values, interpolation);
    else track = new THREE.NumberKeyframeTrack(name, times, values, interpolation);
    tracks.push(track);
  }
  const clip = new THREE.AnimationClip(clipData.name || fallbackName, Number(clipData.duration || 0.001), tracks);
  clip.userData = { ...(clipData.userData || {}), exportedAt: data?.exportedAt || '', actorKey: data?.actorKey || '', actorLabel: data?.actorLabel || '' };
  return clip;
}

function loadPoseClip(path) {
  return fetch(path).then((response) => {
    if (!response.ok) throw new Error('failed to load pose clip ' + path + ' (' + response.status + ')');
    return response.json();
  }).then((data) => deserializePoseClip(data, path.split('/').pop().replace(/\.poseclip\.json$/i, '').replace(/\.[^.]+$/, '')));
}

function isRootOrHipPositionTrack(trackName) {
  const name = String(trackName || '').toLowerCase();
  if (!name.endsWith('.position')) return false;
  const target = name.slice(0, -'.position'.length);
  return target === 'hips'
    || target === 'root'
    || target.endsWith(':hips')
    || target.endsWith('|hips')
    || target.endsWith('/hips')
    || target.endsWith('.hips')
    || target.includes('mixamorig:hips')
    || target.includes('mixamorig_hips')
    || target.includes('mixamorighips');
}

function stripRootMotionXZ(clip) {
  const clone = clip.clone();
  for (const track of clone.tracks) {
    if (!isRootOrHipPositionTrack(track.name) || track.values.length < 3) continue;
    const baseX = track.values[0];
    const baseZ = track.values[2];
    for (let i = 0; i < track.values.length; i += 3) {
      track.values[i] = baseX;
      track.values[i + 2] = baseZ;
    }
  }
  clone.resetDuration();
  return clone;
}

function resolvePlayerSolids(position, velocity) {
  const radius = PLAYER_SOLID_RADIUS;
  const minY = position.y - PLAYER_EYE_HEIGHT + 0.15;
  const maxY = position.y + 0.35;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const solid of solidColliders) {
      if (maxY < solid.minY || minY > solid.maxY) continue;
      if (position.x < solid.minX - radius || position.x > solid.maxX + radius) continue;
      if (position.z < solid.minZ - radius || position.z > solid.maxZ + radius) continue;
      const feetY = position.y - PLAYER_EYE_HEIGHT;
      const topDelta = solid.maxY - feetY;
      const canStepUp = topDelta >= -0.04 && topDelta <= SUPPORT_SNAP_UP
        && solid.maxX - solid.minX >= PLAYER_SOLID_RADIUS * 2
        && solid.maxZ - solid.minZ >= PLAYER_SOLID_RADIUS * 2;
      if (canStepUp) {
        position.y = Math.max(position.y, solid.maxY + PLAYER_EYE_HEIGHT);
        velocity.y = Math.max(0, velocity.y);
        continue;
      }
      const centerX = (solid.minX + solid.maxX) * 0.5;
      const centerZ = (solid.minZ + solid.maxZ) * 0.5;
      const pushLeft = Math.abs(position.x - (solid.minX - radius));
      const pushRight = Math.abs((solid.maxX + radius) - position.x);
      const pushBack = Math.abs(position.z - (solid.minZ - radius));
      const pushForward = Math.abs((solid.maxZ + radius) - position.z);
      const pushX = Math.min(pushLeft, pushRight);
      const pushZ = Math.min(pushBack, pushForward);
      if (pushX < pushZ) {
        position.x = position.x < centerX ? solid.minX - radius : solid.maxX + radius;
        velocity.x = 0;
      } else {
        position.z = position.z < centerZ ? solid.minZ - radius : solid.maxZ + radius;
        velocity.z = 0;
      }
    }
  }
}

function solidTopWalkable(solid) {
  return solid && solid.sizeY >= CLIMB_MIN_HEIGHT && Math.min(solid.sizeX, solid.sizeZ) >= CLIMB_MIN_TOP_SIZE;
}

function resolveSolidTopSupport(x, z, feetY, velocityY) {
  let best = null;
  for (const solid of solidColliders) {
    if (!solidTopWalkable(solid)) continue;
    if (x < solid.minX + PLAYER_SOLID_RADIUS || x > solid.maxX - PLAYER_SOLID_RADIUS) continue;
    if (z < solid.minZ + PLAYER_SOLID_RADIUS || z > solid.maxZ - PLAYER_SOLID_RADIUS) continue;
    const topY = solid.maxY;
    if (velocityY > 0.5 && feetY < topY - 0.14) continue;
    if (feetY > topY + SUPPORT_SNAP_UP) continue;
    if (feetY < topY - SUPPORT_SNAP_DOWN) continue;
    if (!best || topY > best.topY) best = { topY, solid };
  }
  return best;
}

function canStandOnSolidTop(solid, x, z) {
  if (!solidTopWalkable(solid)) return false;
  const feetY = solid.maxY;
  return x >= solid.minX + PLAYER_SOLID_RADIUS
    && x <= solid.maxX - PLAYER_SOLID_RADIUS
    && z >= solid.minZ + PLAYER_SOLID_RADIUS
    && z <= solid.maxZ - PLAYER_SOLID_RADIUS
;
}

function faceYawFromNormal(normal) {
  return Math.atan2(-normal.x, -normal.z);
}

function tryBeginClimb(attachForward = true) {
  if (player.mode === 'climb' || player.mode === 'mantle') return false;
  if (player.attack) return false;
  const chestY = player.position.y - PLAYER_EYE_HEIGHT + 1.1;
  const facing = cameraForwardYaw(player.yaw).normalize();
  let best = null;
  let bestScore = Infinity;
  const candidateFaces = [];
  for (const solid of solidColliders) {
    if (solid.sizeY < CLIMB_MIN_HEIGHT) continue;
    if (Math.max(solid.sizeX, solid.sizeZ) < CLIMB_MIN_TOP_SIZE) continue;
    candidateFaces.push(
      { axis: 'x', plane: solid.minX, normal: makeVec(-1, 0, 0), rangeA: [solid.minZ, solid.maxZ] },
      { axis: 'x', plane: solid.maxX, normal: makeVec(1, 0, 0), rangeA: [solid.minZ, solid.maxZ] },
      { axis: 'z', plane: solid.minZ, normal: makeVec(0, 0, -1), rangeA: [solid.minX, solid.maxX] },
      { axis: 'z', plane: solid.maxZ, normal: makeVec(0, 0, 1), rangeA: [solid.minX, solid.maxX] },
    );
    for (const face of candidateFaces.splice(0)) {
      const towardWall = face.normal.clone().multiplyScalar(-1);
      const faceDot = facing.dot(towardWall);
      if (attachForward && faceDot < 0.38) continue;
      const distance = face.axis === 'x' ? Math.abs(player.position.x - face.plane) : Math.abs(player.position.z - face.plane);
      if (distance > CLIMB_ATTACH_DISTANCE) continue;
      const lateral = face.axis === 'x' ? player.position.z : player.position.x;
      if (lateral < face.rangeA[0] - PLAYER_SOLID_RADIUS || lateral > face.rangeA[1] + PLAYER_SOLID_RADIUS) continue;
      if (chestY < solid.minY + 0.2 || chestY > solid.maxY + 0.65) continue;
      const score = distance - faceDot * 0.15 + Math.abs(chestY - clamp(chestY, solid.minY + 0.45, solid.maxY - 0.2)) * 0.05;
      if (score < bestScore) {
        bestScore = score;
        best = { solid, face };
      }
    }
  }
  if (!best) return false;
  const { solid, face } = best;
  const right = new THREE.Vector3(-face.normal.z, 0, face.normal.x);
  const hangY = clamp(player.position.y, solid.minY + 0.4 + PLAYER_EYE_HEIGHT, solid.maxY - 0.12 + PLAYER_EYE_HEIGHT);
  const lateral = face.axis === 'x'
    ? clamp(player.position.z, solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS)
    : clamp(player.position.x, solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS);
  player.mode = 'climb';
  player.climb = {
    solid,
    normal: face.normal.clone(),
    right,
    planeAxis: face.axis,
    plane: face.plane,
    minLateral: face.rangeA[0] + PLAYER_SOLID_RADIUS,
    maxLateral: face.rangeA[1] - PLAYER_SOLID_RADIUS,
    minY: solid.minY + 0.12 + PLAYER_EYE_HEIGHT,
    maxY: solid.maxY - CLIMB_TOP_OUT_THRESHOLD + PLAYER_EYE_HEIGHT,
  };
  player.mantle = null;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.runCharge = 0;
  player.isRunning = false;
  player.lastRunIntent = false;
  player.attack = null;
  player.attackTimer = 0;
  if (face.axis === 'x') {
    player.position.x = face.plane + face.normal.x * CLIMB_FACE_OFFSET;
    player.position.z = lateral;
  } else {
    player.position.z = face.plane + face.normal.z * CLIMB_FACE_OFFSET;
    player.position.x = lateral;
  }
  player.position.y = hangY;
  player.yaw = faceYawFromNormal(face.normal.clone().multiplyScalar(-1));
  return true;
}

function startMantleFromClimb() {
  const climb = player.climb;
  if (!climb) return false;
  const solid = climb.solid;
  const topX = climb.planeAxis === 'x'
    ? solid.centerX
    : clamp(player.position.x + climb.normal.x * CLIMB_MANTLE_FORWARD, solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS);
  const topZ = climb.planeAxis === 'z'
    ? solid.centerZ
    : clamp(player.position.z + climb.normal.z * CLIMB_MANTLE_FORWARD, solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS);
  const endX = climb.planeAxis === 'x'
    ? clamp(climb.plane + climb.normal.x * (PLAYER_SOLID_RADIUS + CLIMB_MANTLE_FORWARD), solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS)
    : topX;
  const endZ = climb.planeAxis === 'z'
    ? clamp(climb.plane + climb.normal.z * (PLAYER_SOLID_RADIUS + CLIMB_MANTLE_FORWARD), solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS)
    : topZ;
  if (!canStandOnSolidTop(solid, endX, endZ)) return false;
  player.mode = 'mantle';
  player.mantle = {
    start: player.position.clone(),
    end: makeVec(endX, solid.maxY + PLAYER_EYE_HEIGHT, endZ),
    elapsed: 0,
    duration: CLIMB_MANTLE_DURATION,
    faceYaw: player.yaw,
  };
  player.climb = null;
  player.velocity.set(0, 0, 0);
  return true;
}

function updatePlayerClimb(dt, moveX, moveY) {
  const climb = player.climb;
  if (!climb) {
    player.mode = 'air';
    return;
  }
  const lateralDelta = moveX * CLIMB_SPEED_HORIZONTAL * dt;
  const verticalDelta = moveY * CLIMB_SPEED_VERTICAL * dt;
  let lateral = climb.planeAxis === 'x' ? player.position.z : player.position.x;
  lateral = clamp(lateral + lateralDelta, climb.minLateral, climb.maxLateral);
  const nextY = clamp(player.position.y + verticalDelta, climb.minY, climb.maxY + 0.28);
  if (climb.planeAxis === 'x') {
    player.position.x = climb.plane + climb.normal.x * CLIMB_FACE_OFFSET;
    player.position.z = lateral;
  } else {
    player.position.z = climb.plane + climb.normal.z * CLIMB_FACE_OFFSET;
    player.position.x = lateral;
  }
  player.position.y = nextY;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.yaw = faceYawFromNormal(climb.normal.clone().multiplyScalar(-1));
  if (moveY > 0.18 && player.position.y >= climb.maxY - 0.02) startMantleFromClimb();
  else if (moveY < -0.45 && player.position.y <= climb.minY + 0.02) {
    player.mode = 'air';
    player.climb = null;
  }
}

function updatePlayerMantle(dt) {
  const mantle = player.mantle;
  if (!mantle) {
    player.mode = 'ground';
    return;
  }
  mantle.elapsed = Math.min(mantle.duration, mantle.elapsed + dt);
  const t = clamp(mantle.elapsed / mantle.duration, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const lift = Math.sin(Math.PI * eased) * 0.18;
  player.position.lerpVectors(mantle.start, mantle.end, eased);
  player.position.y += lift;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.yaw = mantle.faceYaw;
  if (t >= 1) {
    player.position.copy(mantle.end);
    player.mode = 'ground';
    player.mantle = null;
    player.grounded = true;
  }
}

function finalizePlayerFrame(dt, now, stickMagnitude) {
  player.position.x = clamp(player.position.x, roomState.levelBounds?.minX ?? -14, roomState.levelBounds?.maxX ?? 14);
  player.position.z = clamp(player.position.z, roomState.levelBounds?.minZ ?? -18, roomState.levelBounds?.maxZ ?? 18);
  if (player.grounded && player.runCharge < RUN_BUILD_TIME && stickMagnitude < 0.18) player.runCharge = Math.max(0, player.runCharge - dt * 0.4);
  if (roomState.transitionLock > 0) roomState.transitionLock = Math.max(0, roomState.transitionLock - dt);
  if (player.grounded && roomState.transitionLock <= 0) {
    const dx = player.position.x - roomState.exit.x;
    const dz = player.position.z - roomState.exit.z;
    const dy = player.position.y - roomState.exit.y;
    if (Math.hypot(dx, dz) < roomState.exitRadius && Math.abs(dy) < 1.8) completeGeneratedGauntlet();
  }
  updateCurrentGauntletRoom();
  if (player.position.y < KILL_Y) {
    player.position.copy(roomState.spawn);
    player.visualPosition.copy(player.position);
    player.velocity.set(0, 0, 0);
    input.smoothMoveX = 0;
    input.smoothMoveY = 0;
    player.grounded = true;
    player.mode = 'ground';
    player.climb = null;
    player.mantle = null;
    player.attack = null;
    player.attackTimer = 0;
    setStatus('returned to start');
  }

  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  const bobRate = player.grounded ? (player.isRunning ? 2.05 : 1.35) * Math.min(1.2, horizontalSpeed / 5.2) : 0.35;
  player.bob += dt * bobRate;
  const bobAmount = player.grounded ? Math.min(1, horizontalSpeed / 5.2) : 0.08;
  const bobY = Math.sin(player.bob * Math.PI * 2) * 0.012 * bobAmount;
  const bobX = Math.cos(player.bob * Math.PI * 2) * 0.008 * bobAmount;
  const followBlend = 1 - Math.exp(-(player.grounded ? CAMERA_GROUND_SMOOTH : CAMERA_AIR_SMOOTH) * dt);
  if (!Number.isFinite(player.visualPosition.x) || player.visualPosition.distanceTo(player.position) > 4.0 || (!player.grounded && player.velocity.y > 0.35)) player.visualPosition.copy(player.position);
  else player.visualPosition.lerp(player.position, followBlend);
  camera.position.copy(player.visualPosition).add(new THREE.Vector3(bobX, bobY, 0));
  skyDome.position.copy(camera.position);
  camera.rotation.y = player.yaw + input.gyroYaw;
  camera.rotation.x = player.pitch + input.gyroPitch;
}

function resolveSupportHeight(x, z, feetY, velocityY) {
  let best = null;
  for (const surface of walkableSurfaces) {
    if (x < surface.minX - SUPPORT_RADIUS || x > surface.maxX + SUPPORT_RADIUS) continue;
    if (z < surface.minZ - SUPPORT_RADIUS || z > surface.maxZ + SUPPORT_RADIUS) continue;
    if (velocityY > 0.5 && feetY < surface.topY - 0.14) continue;
    if (feetY > surface.topY + SUPPORT_SNAP_UP) continue;
    if (feetY < surface.topY - SUPPORT_SNAP_DOWN) continue;
    if (!best || surface.topY > best.topY) best = surface;
  }
  return best;
}

function findWalkableStepSurface(position, direction, feetY) {
  if (!direction || direction.lengthSq() <= 0.0001) return null;
  const dir = direction.clone().normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  let best = null;
  for (const surface of walkableSurfaces) {
    const deltaY = surface.topY - feetY;
    if (deltaY < 0.04 || deltaY > SUPPORT_SNAP_UP) continue;
    const standMinX = surface.minX + PLAYER_SOLID_RADIUS * 0.18;
    const standMaxX = surface.maxX - PLAYER_SOLID_RADIUS * 0.18;
    const standMinZ = surface.minZ + PLAYER_SOLID_RADIUS * 0.18;
    const standMaxZ = surface.maxZ - PLAYER_SOLID_RADIUS * 0.18;
    if (standMaxX <= standMinX || standMaxZ <= standMinZ) continue;
    const nearX = clamp(position.x, standMinX, standMaxX);
    const nearZ = clamp(position.z, standMinZ, standMaxZ);
    const dx = nearX - position.x;
    const dz = nearZ - position.z;
    const along = dx * dir.x + dz * dir.z;
    const lateral = Math.abs(dx * perp.x + dz * perp.z);
    if (along < -0.06 || along > WALKABLE_STEP_FORWARD_REACH) continue;
    if (lateral > SUPPORT_RADIUS + 0.18) continue;
    const targetX = clamp(nearX + dir.x * 0.06, standMinX, standMaxX);
    const targetZ = clamp(nearZ + dir.z * 0.06, standMinZ, standMaxZ);
    const score = (surface.traversalCritical ? -0.2 : 0) + along + deltaY * 0.35 + lateral * 0.25;
    if (!best || score < best.score) best = { surface, targetX, targetZ, score };
  }
  return best;
}

function findEnemySupport(x, z, referenceY, stepUp = ENEMY_STEP_UP, stepDown = ENEMY_STEP_DOWN) {
  let best = null;
  for (const surface of walkableSurfaces) {
    if (x < surface.minX - ENEMY_FLOOR_RADIUS || x > surface.maxX + ENEMY_FLOOR_RADIUS) continue;
    if (z < surface.minZ - ENEMY_FLOOR_RADIUS || z > surface.maxZ + ENEMY_FLOOR_RADIUS) continue;
    const deltaY = surface.topY - referenceY;
    if (deltaY > stepUp || deltaY < -stepDown) continue;
    if (!best || surface.topY > best.topY) best = surface;
  }
  return best;
}

function enemyCapsuleOffsets(direction = null) {
  const radius = ENEMY_CAPSULE_RADIUS * 0.72;
  if (!direction || direction.lengthSq() <= 0.0001) {
    return [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
    ];
  }
  const dir = direction.clone().normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  return [
    [0, 0],
    [dir.x * ENEMY_CAPSULE_FOOT_OFFSET, dir.z * ENEMY_CAPSULE_FOOT_OFFSET],
    [-dir.x * ENEMY_CAPSULE_FOOT_OFFSET * 0.4, -dir.z * ENEMY_CAPSULE_FOOT_OFFSET * 0.4],
    [perp.x * radius, perp.z * radius],
    [-perp.x * radius, -perp.z * radius],
  ];
}

function findEnemyCapsuleSupport(x, z, referenceY, direction = null, stepUp = ENEMY_STEP_UP, stepDown = ENEMY_STEP_DOWN) {
  const offsets = enemyCapsuleOffsets(direction);
  const supports = [];
  let minTopY = Infinity;
  let maxTopY = -Infinity;
  for (const [ox, oz] of offsets) {
    const support = findEnemySupport(x + ox, z + oz, referenceY, stepUp, stepDown);
    if (!support) return null;
    if (enemyBodyBlockedAt(x + ox, z + oz, support.topY)) return null;
    supports.push(support);
    minTopY = Math.min(minTopY, support.topY);
    maxTopY = Math.max(maxTopY, support.topY);
  }
  if (maxTopY - minTopY > ENEMY_CAPSULE_SUPPORT_TOLERANCE) return null;
  return supports.reduce((best, support) => (!best || support.topY > best.topY ? support : best), null);
}

function resolveEnemyLandingSupport(target, referenceY, fromPoint = null) {
  if (!target) return null;
  const refY = Number.isFinite(referenceY) ? referenceY : (enemy?.userData?.baseY ?? target.y);
  const direction = fromPoint ? target.clone().sub(fromPoint) : null;
  if (direction) {
    direction.y = 0;
    if (direction.lengthSq() > 0.001) direction.normalize();
  }
  const offsets = direction && direction.lengthSq() > 0.001 ? [0, -0.14, -0.28, -0.42] : [0];
  for (const offset of offsets) {
    const probe = direction ? target.clone().addScaledVector(direction, offset) : target.clone();
    const support = findEnemyCapsuleSupport(probe.x, probe.z, refY, direction, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
    if (!support) continue;
    return { point: makeVec(probe.x, support.topY, probe.z), support };
  }
  return null;
}

function enemyBodyBlockedAt(x, z, floorY) {
  const minY = floorY + 0.08;
  const maxY = floorY + ORC_BERSERKER_TARGET_HEIGHT * 0.86;
  for (const solid of solidColliders) {
    if (maxY < solid.minY || minY > solid.maxY) continue;
    if (x < solid.minX - ENEMY_SOLID_RADIUS || x > solid.maxX + ENEMY_SOLID_RADIUS) continue;
    if (z < solid.minZ - ENEMY_SOLID_RADIUS || z > solid.maxZ + ENEMY_SOLID_RADIUS) continue;
    return true;
  }
  return false;
}


function resolveEnemySpawnPoint(position) {
  if (!position) return position;
  const baseY = Number.isFinite(position.y) ? position.y : 0;
  const probes = [
    [0, 0],
    [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2],
    [3.8, 0], [-3.8, 0], [0, 3.8], [0, -3.8],
    [2.8, 2.8], [2.8, -2.8], [-2.8, 2.8], [-2.8, -2.8],
    [5.6, 0], [-5.6, 0], [0, 5.6], [0, -5.6],
    [4.4, 4.4], [4.4, -4.4], [-4.4, 4.4], [-4.4, -4.4],
  ];
  let best = null;
  let bestScore = Infinity;
  for (const [ox, oz] of probes) {
    const x = position.x + ox;
    const z = position.z + oz;
    const support = findEnemyCapsuleSupport(x, z, baseY, null, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
    if (!support) continue;
    if (enemyBodyBlockedAt(x, z, support.topY)) continue;
    let minClear = Infinity;
    for (const solid of solidColliders) {
      if (support.topY + 0.08 >= solid.maxY || support.topY + ORC_BERSERKER_TARGET_HEIGHT * 0.72 <= solid.minY) continue;
      const dx = x < solid.minX ? solid.minX - x : x > solid.maxX ? x - solid.maxX : 0;
      const dz = z < solid.minZ ? solid.minZ - z : z > solid.maxZ ? z - solid.maxZ : 0;
      const edge = Math.max(dx, dz);
      if (edge <= 0) {
        minClear = -1;
        break;
      }
      minClear = Math.min(minClear, edge);
    }
    if (minClear < 0.45) continue;
    const score = ox * ox + oz * oz;
    if (score < bestScore) {
      bestScore = score;
      best = makeVec(x, support.topY, z);
    }
  }
  return best || (position.clone ? position.clone() : position);
}

function sampleEnemyMoveSupport(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / ENEMY_FLOOR_SAMPLE_STEP));
  const moveDir = distance > 0.0001 ? makeVec(dx / distance, 0, dz / distance) : null;
  let referenceY = Number.isFinite(enemy?.userData?.baseY) ? enemy.userData.baseY : from.y;
  let support = findEnemyCapsuleSupport(from.x, from.z, referenceY, moveDir, ENEMY_STEP_UP, ENEMY_STEP_DOWN) || { topY: referenceY };
  referenceY = support.topY;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + dx * t;
    const z = from.z + dz * t;
    support = findEnemyCapsuleSupport(x, z, referenceY, moveDir, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
    if (!support) return null;
    referenceY = support.topY;
  }
  return support;
}

function applyEnemyMove(direction, speed, dt) {
  if (!enemy || direction.lengthSq() <= 0.0001 || speed <= 0) return false;
  const step = direction.clone().normalize().multiplyScalar(speed * dt);
  const next = enemy.position.clone().add(step);
  const bounds = roomState.levelBounds;
  if (bounds) {
    next.x = clamp(next.x, bounds.minX + ENEMY_CAPSULE_RADIUS, bounds.maxX - ENEMY_CAPSULE_RADIUS);
    next.z = clamp(next.z, bounds.minZ + ENEMY_CAPSULE_RADIUS, bounds.maxZ - ENEMY_CAPSULE_RADIUS);
  }
  const support = sampleEnemyMoveSupport(enemy.position, next);
  if (!support) {
    enemy.userData.pursuitStall = Math.min(48, (enemy.userData.pursuitStall || 0) + 1);
    return false;
  }
  enemy.position.x = next.x;
  enemy.position.z = next.z;
  enemy.userData.baseY = support.topY;
  enemy.userData.pursuitStall = 0;
  return true;
}

function getEnemyNavState() {
  if (!enemy) return null;
  if (!enemy.userData.nav) {
    enemy.userData.nav = {
      goal: null,
      waypoints: [],
      waypointKinds: [],
      routePath: [],
      routeGraph: null,
      mode: 'approach',
      repathTimer: 0,
      stallCount: 0,
      lastSeenPlayer: null,
      lastValidSupport: null,
      jump: null,
      lastEnemyRoomIndex: -1,
      lastPlayerRoomIndex: -1,
      asleep: false,
    };
  }
  return enemy.userData.nav;
}

function roomFloorPoint(room, key) {
  const point = room?.[key];
  if (!point) return null;
  return makeVec(point.x, point.y - PLAYER_EYE_HEIGHT, point.z);
}

function roomSocketPoint(room, key) {
  const point = room?.sockets?.[key];
  if (!point) return null;
  return makeVec(point.x, point.y - PLAYER_EYE_HEIGHT, point.z);
}

function roomWorldCenter(room) {
  const bounds = room?.bounds;
  if (bounds) return makeVec((bounds.minX + bounds.maxX) * 0.5, 0, (bounds.minZ + bounds.maxZ) * 0.5);
  const fallback = room?.spawn || room?.exit || makeVec(0, 0, 0);
  return makeVec(fallback.x, 0, fallback.z);
}

function clearDebugGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) {
        for (const mat of node.material) mat?.dispose?.();
      } else {
        node.material?.dispose?.();
      }
    });
  }
}

function navKindColor(kind) {
  switch (kind) {
    case 'jump': return 0xff6b8c;
    case 'bridge': return 0x58d1c9;
    case 'stair': return 0xf3c56b;
    case 'drop': return 0xff9b70;
    case 'branch': return 0xba8cff;
    default: return 0x7fb6ff;
  }
}

function raisedNavPoint(point, lift = 0.2) {
  return makeVec(point.x, point.y + lift, point.z);
}

function addDebugLine(group, points, color, opacity = 0.85) {
  if (!group || !points || points.length < 2) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 40;
  group.add(line);
  return line;
}

function addDebugPost(group, point, color, height = 0.9, opacity = 0.65) {
  if (!group || !point) return;
  addDebugLine(group, [point, makeVec(point.x, point.y + height, point.z)], color, opacity);
}

function resolveTraversalAnchor(room, key, fallback = null) {
  if (!room) return null;
  if (key === 'spawn' || key === 'exit') return roomFloorPoint(room, key);
  const socketPoint = roomSocketPoint(room, key);
  if (socketPoint) return socketPoint;
  if (fallback && fallback !== key) return resolveTraversalAnchor(room, fallback, null);
  return roomFloorPoint(room, 'spawn') || roomFloorPoint(room, 'exit') || roomWorldCenter(room);
}

function refreshNavGraphDebug(graph) {
  clearDebugGroup(navDebug.graphGroup);
  if (!SHOW_NAV_LINKS || !graph?.adjacency?.length) return;
  const seen = new Set();
  for (const node of graph.nodes || []) {
    const center = roomWorldCenter(node.room);
    addDebugPost(navDebug.graphGroup, raisedNavPoint(center, 0.08), navKindColor(node.kind), 1.3, 0.4);
  }
  for (const edges of graph.adjacency) {
    for (const edge of edges) {
      const pairKey = edge.from < edge.to ? `${edge.from}:${edge.to}:${edge.kind}` : `${edge.to}:${edge.from}:${edge.kind}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const fromRoom = graph.nodes[edge.from]?.room;
      const toRoom = graph.nodes[edge.to]?.room;
      const from = resolveTraversalAnchor(fromRoom, edge.fromKey, edge.linear ? 'exit' : 'spawn');
      const to = resolveTraversalAnchor(toRoom, edge.toKey, edge.linear ? 'spawn' : 'exit');
      if (!from || !to) continue;
      addDebugLine(navDebug.graphGroup, [raisedNavPoint(from), raisedNavPoint(to)], navKindColor(edge.kind), edge.branch ? 0.95 : 0.75);
      addDebugPost(navDebug.graphGroup, raisedNavPoint(from, 0.04), navKindColor(edge.kind), 0.38, 0.45);
      addDebugPost(navDebug.graphGroup, raisedNavPoint(to, 0.04), navKindColor(edge.kind), 0.38, 0.45);
    }
  }
  for (const repair of roomState.connectivityRepair?.repairs || []) {
    const from = raisedNavPoint(repair.from, 0.32);
    const to = raisedNavPoint(repair.to, 0.32);
    addDebugLine(navDebug.graphGroup, [from, to], 0xfff2a8, 0.95);
  }
}

function refreshEnemyRouteDebug(nav) {
  clearDebugGroup(navDebug.routeGroup);
  if (!SHOW_NAV_LINKS || !enemy || !nav?.waypoints?.length) return;
  const points = [raisedNavPoint(makeVec(enemy.position.x, enemy.userData.baseY ?? enemy.position.y, enemy.position.z), 0.55)];
  for (const waypoint of nav.waypoints) points.push(raisedNavPoint(waypoint, 0.55));
  addDebugLine(navDebug.routeGroup, points, 0xffffff, 0.95);
  for (let i = 0; i < nav.waypoints.length; i += 1) {
    const waypoint = nav.waypoints[i];
    const kind = nav.waypointKinds[i] || 'flat';
    addDebugPost(navDebug.routeGroup, raisedNavPoint(waypoint, 0.18), navKindColor(kind), i === 0 ? 1.2 : 0.7, i === 0 ? 0.95 : 0.55);
  }
  if (nav.jump?.target) addDebugPost(navDebug.routeGroup, raisedNavPoint(nav.jump.target, 0.12), navKindColor('jump'), 1.5, 0.95);
}

function roomTraversalKindForSpec(spec) {
  const text = [spec?.junction_class, spec?.semantic_role, spec?.batch_prompt, ...(spec?.route_sentence || [])].join(' ').toLowerCase();
  const overlays = new Set((spec?.vertical_overlays || []).map((value) => String(value).toUpperCase()));
  if (overlays.has('D') || /drop|descent|lower|recovery|down/.test(text)) return 'drop';
  if (overlays.has('U') || /stair|climb|ascent|upper|up/.test(text)) return 'stair';
  if (/bridge|overpass|gallery|ledge|span|cross/.test(text)) return 'bridge';
  if (/jump|gap|leap/.test(text)) return 'jump';
  if (/branch|fork|loop|hub|switch|return|side/.test(text)) return 'branch';
  return 'flat';
}

function roomTraversalEdgeKind(fromSpec, toSpec) {
  const kindA = roomTraversalKindForSpec(fromSpec);
  const kindB = roomTraversalKindForSpec(toSpec);
  if (kindA === 'drop' || kindB === 'drop') return 'drop';
  if (kindA === 'stair' || kindB === 'stair') return 'stair';
  if (kindA === 'bridge' || kindB === 'bridge') return 'bridge';
  if (kindA === 'jump' || kindB === 'jump') return 'jump';
  if (kindA === 'branch' || kindB === 'branch') return 'branch';
  return 'flat';
}

function roomTraversalSocketKeys(kind) {
  switch (kind) {
    case 'stair': return ['stair', 'ledge', 'bridge', 'gate'];
    case 'drop': return ['drop', 'ledge', 'stair', 'gate'];
    case 'bridge': return ['bridge', 'ledge', 'gate', 'stair'];
    case 'jump': return ['ledge', 'bridge', 'gate', 'stair'];
    case 'branch': return ['gate', 'bridge', 'ledge', 'stair'];
    default: return ['gate', 'bridge', 'ledge', 'stair'];
  }
}

function pickRoomSocketToward(room, targetPosition, fallbackKey, kind = 'flat') {
  const sockets = room?.sockets || null;
  const keys = [...new Set([...(fallbackKey ? [fallbackKey] : []), ...roomTraversalSocketKeys(kind)])];
  if (!sockets) return roomSocketPoint(room, keys[0] || fallbackKey) || roomFloorPoint(room, keys[0] || fallbackKey);
  let best = null;
  let bestScore = Infinity;
  for (const key of keys) {
    const point = sockets[key];
    if (!point) continue;
    const candidate = makeVec(point.x, point.y - PLAYER_EYE_HEIGHT, point.z);
    const score = targetPosition ? candidate.distanceToSquared(targetPosition) : 0;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (!best) {
    for (const point of Object.values(sockets)) {
      if (!point) continue;
      const candidate = makeVec(point.x, point.y - PLAYER_EYE_HEIGHT, point.z);
      const score = targetPosition ? candidate.distanceToSquared(targetPosition) : 0;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }
  return best || roomSocketPoint(room, keys[0] || fallbackKey) || roomFloorPoint(room, keys[0] || fallbackKey);
}

function findNearestGauntletRoomIndex(position) {
  if (!roomState.gauntletRooms?.length) return -1;
  let bestIndex = -1;
  let bestDist = Infinity;
  for (let i = 0; i < roomState.gauntletRooms.length; i += 1) {
    const center = roomWorldCenter(roomState.gauntletRooms[i]);
    const dx = position.x - center.x;
    const dz = position.z - center.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDist) {
      bestDist = distSq;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildRoomTraversalGraph(rooms, specs, branchLinks = []) {
  const nodes = rooms.map((room, index) => ({
    index,
    kind: roomTraversalKindForSpec(specs[index]),
    room,
    spec: specs[index],
    connectors: Object.keys(room?.sockets || {}),
  }));
  const adjacency = Array.from({ length: rooms.length }, () => []);
  const connect = (from, to, kind, options = {}) => {
    if (!rooms[from] || !rooms[to]) return;
    adjacency[from].push({
      from,
      to,
      kind,
      fromKey: options.fromKey || 'exit',
      toKey: options.toKey || 'spawn',
      branch: Boolean(options.branch),
      linear: Boolean(options.linear),
    });
  };
  for (let i = 0; i < rooms.length - 1; i += 1) {
    const kind = roomTraversalEdgeKind(specs[i], specs[i + 1]);
    const fromKey = kind === 'drop' ? 'ledge' : (kind === 'stair' ? 'stair' : (kind === 'bridge' ? 'bridge' : 'exit'));
    const toKey = kind === 'drop' ? 'ledge' : (kind === 'stair' ? 'stair' : (kind === 'bridge' ? 'bridge' : 'spawn'));
    connect(i, i + 1, kind, { fromKey, toKey, linear: true });
    connect(i + 1, i, kind, { fromKey: toKey, toKey: fromKey, linear: true });
  }
  for (const link of branchLinks) {
    const fromSpec = specs[link.a];
    const toSpec = specs[link.b];
    const kind = roomTraversalEdgeKind(fromSpec, toSpec);
    connect(link.a, link.b, kind, { fromKey: link.sideA, toKey: link.sideB, branch: true });
    connect(link.b, link.a, kind, { fromKey: link.sideB, toKey: link.sideA, branch: true });
  }
  return { nodes, adjacency };
}

function findRoomTraversalPath(graph, startIndex, goalIndex) {
  if (!graph?.adjacency?.length) return null;
  if (startIndex === goalIndex) return [];
  const count = graph.adjacency.length;
  const seen = new Array(count).fill(false);
  const prevEdge = new Array(count).fill(null);
  const queue = [startIndex];
  seen[startIndex] = true;
  while (queue.length) {
    const index = queue.shift();
    if (index === goalIndex) break;
    for (const edge of graph.adjacency[index] || []) {
      if (seen[edge.to]) continue;
      seen[edge.to] = true;
      prevEdge[edge.to] = edge;
      queue.push(edge.to);
    }
  }
  if (!seen[goalIndex]) return null;
  const path = [];
  let cursor = goalIndex;
  while (cursor !== startIndex) {
    const edge = prevEdge[cursor];
    if (!edge) return null;
    path.push(edge);
    cursor = edge.from;
  }
  path.reverse();
  return path;
}

function clearEnemyRoute(nav) {
  nav.waypoints.length = 0;
  nav.waypointKinds.length = 0;
  nav.routePath.length = 0;
  refreshEnemyRouteDebug(nav);
}

function pushEnemyRouteWaypoint(nav, point, kind = 'flat') {
  if (!point) return;
  const last = nav.waypoints[nav.waypoints.length - 1];
  if (last && last.distanceToSquared(point) < 0.16) return;
  nav.waypoints.push(point.clone ? point.clone() : makeVec(point.x, point.y, point.z));
  nav.waypointKinds.push(kind || 'flat');
  refreshEnemyRouteDebug(nav);
}

function classifyTraversalSegment(from, to, preferredKind = 'flat') {
  if (!from || !to) return preferredKind || 'flat';
  if (!sampleEnemyMoveSupport(from, to) && enemyCanJumpBetween(from, to)) return 'jump';
  if (preferredKind === 'jump') return 'flat';
  return preferredKind || 'flat';
}

function shiftEnemyRouteWaypoint(nav) {
  if (!nav?.waypoints?.length) return null;
  if (nav.waypointKinds.length) nav.waypointKinds.shift();
  const shifted = nav.waypoints.shift();
  refreshEnemyRouteDebug(nav);
  return shifted;
}

function pushEnemyWaypoint(list, point) {
  if (!point) return;
  const last = list[list.length - 1];
  if (last && last.distanceToSquared(point) < 0.16) return;
  list.push(point.clone ? point.clone() : makeVec(point.x, point.y, point.z));
}

function enemyJumpDuration() {
  return Math.max(0.42, enemyActions.get('jumping')?.getClip?.().duration || ENEMY_ATTACK_RECOVERY);
}

function enemyCanJumpBetween(from, to) {
  if (!enemy) return false;
  const refY = Number.isFinite(enemy.userData.baseY) ? enemy.userData.baseY : from.y;
  const targetSupport = findEnemySupport(to.x, to.z, refY, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (!targetSupport) return false;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < ENEMY_JUMP_MIN_DISTANCE || dist > ENEMY_JUMP_MAX_DISTANCE) return false;
  if (Math.abs(targetSupport.topY - refY) > ENEMY_JUMP_MAX_HEIGHT) return false;
  return !sampleEnemyMoveSupport(from, to);
}

function tryEnemyJumpTargets(targets) {
  if (!enemy) return false;
  const currentSupport = findEnemySupport(enemy.position.x, enemy.position.z, enemy.userData.baseY ?? enemy.position.y, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  const currentTopY = currentSupport?.topY ?? (enemy.userData.baseY ?? enemy.position.y);
  for (const target of targets) {
    if (!target) continue;
    const advance = target.distanceTo(enemy.position);
    if (advance < ENEMY_JUMP_MIN_DISTANCE || advance > ENEMY_JUMP_MAX_DISTANCE) continue;
    const towardPlayer = player.position.clone().sub(enemy.position);
    towardPlayer.y = 0;
    const moveToTarget = target.clone().sub(enemy.position);
    moveToTarget.y = 0;
    if (towardPlayer.lengthSq() > 0.001 && moveToTarget.lengthSq() > 0.001) {
      if (moveToTarget.dot(towardPlayer) < 0.35 * moveToTarget.length() * towardPlayer.length()) continue;
    }
    const landing = resolveEnemyLandingSupport(target, currentTopY, enemy.position);
    if (!landing) continue;
    if (Math.abs(landing.support.topY - currentTopY) > ENEMY_JUMP_MAX_HEIGHT) continue;
    if (!sampleEnemyMoveSupport(enemy.position, landing.point) && startEnemyJump(landing.point)) return true;
  }
  return false;
}

function enemyCombatGoalPoint(fromPoint = null) {
  const origin = fromPoint ? fromPoint.clone() : makeVec(enemy?.position?.x || player.position.x, enemy?.userData?.baseY ?? enemy?.position?.y ?? (player.position.y - PLAYER_EYE_HEIGHT), fromPoint?.z ?? enemy?.position?.z ?? player.position.z);
  const toPlayer = player.position.clone().sub(origin);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const dir = dist > 0.001 ? toPlayer.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1);
  const standOff = clamp(ENEMY_ATTACK_RANGE * 0.82, 0.9, Math.max(0.9, ENEMY_RING_RADIUS - 0.35));
  const goal = makeVec(player.position.x - dir.x * standOff, player.position.y - PLAYER_EYE_HEIGHT, player.position.z - dir.z * standOff);
  const support = findEnemySupport(goal.x, goal.z, goal.y, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (support) goal.y = support.topY;
  return goal;
}

function enemyHasDirectCombatPath(fromPoint = null) {
  if (!enemy) return false;
  const origin = fromPoint ? fromPoint.clone() : makeVec(enemy.position.x, enemy.userData.baseY ?? enemy.position.y, enemy.position.z);
  const combatGoal = enemyCombatGoalPoint(origin);
  return !!sampleEnemyMoveSupport(origin, combatGoal);
}

function findEnemyJumpSegmentTarget(from, to, referenceY = null) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < ENEMY_JUMP_MIN_DISTANCE) return null;
  const refY = Number.isFinite(referenceY) ? referenceY : (enemy?.userData?.baseY ?? from.y);
  const steps = Math.max(8, Math.ceil(distance / 0.34));
  let blockedIndex = -1;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const probe = makeVec(from.x + dx * t, refY, from.z + dz * t);
    if (!sampleEnemyMoveSupport(from, probe)) {
      blockedIndex = i;
      break;
    }
  }
  if (blockedIndex < 0) return null;
  let best = null;
  let bestDist = Infinity;
  let fallback = null;
  let fallbackDist = Infinity;
  for (let i = blockedIndex + 1; i <= steps; i += 1) {
    const t = i / steps;
    const probe = makeVec(from.x + dx * t, refY, from.z + dz * t);
    const landing = resolveEnemyLandingSupport(probe, refY, from);
    if (!landing) continue;
    if (!enemyCanJumpBetween(from, landing.point)) continue;
    const remaining = landing.point.distanceTo(to);
    if (remaining < fallbackDist) {
      fallback = landing.point.clone();
      fallbackDist = remaining;
    }
    if (!sampleEnemyMoveSupport(landing.point, to)) continue;
    if (remaining < bestDist) {
      best = landing.point.clone();
      bestDist = remaining;
    }
  }
  return best || fallback;
}

function buildEnemyLocalRoute(room, from, to) {
  if (!room) return [to.clone()];
  if (sampleEnemyMoveSupport(from, to)) return [to.clone()];
  const routeRefY = Number.isFinite(enemy?.userData?.baseY) ? enemy.userData.baseY : from.y;
  const directJump = findEnemyJumpSegmentTarget(from, to, routeRefY);
  if (directJump) return [directJump, to.clone()];
  const center = roomWorldCenter(room);
  const bounds = room.bounds || null;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return [to.clone()];
  const ux = dx / len;
  const uz = dz / len;
  const perp = makeVec(-uz, 0, ux);
  const span = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) : 24;
  const detour = Math.max(3.2, Math.min(6.4, span * 0.18));
  const anchors = [];
  for (const key of ['spawn', 'exit']) {
    const point = roomFloorPoint(room, key);
    if (point) anchors.push(point);
  }
  if (room.sockets) {
    for (const socket of Object.values(room.sockets)) {
      if (!socket) continue;
      anchors.push(makeVec(socket.x, socket.y - PLAYER_EYE_HEIGHT, socket.z));
    }
  }
  anchors.push(center.clone());
  anchors.push(center.clone().addScaledVector(perp, detour));
  anchors.push(center.clone().addScaledVector(perp, -detour));
  anchors.push(from.clone().addScaledVector(perp, detour));
  anchors.push(from.clone().addScaledVector(perp, -detour));
  anchors.push(to.clone().addScaledVector(perp, detour));
  anchors.push(to.clone().addScaledVector(perp, -detour));

  let bestRoute = null;
  let bestScore = Infinity;
  for (const candidate of anchors) {
    if (!candidate) continue;
    const support = findEnemySupport(candidate.x, candidate.z, routeRefY, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
    if (!support) continue;
    const point = makeVec(candidate.x, support.topY, candidate.z);
    const fromClear = !!sampleEnemyMoveSupport(from, point);
    const toClear = !!sampleEnemyMoveSupport(point, to);
    const fromJump = !fromClear && enemyCanJumpBetween(from, point);
    const toJump = !toClear && enemyCanJumpBetween(point, to);
    const bridgeJump = !toClear && !toJump ? findEnemyJumpSegmentTarget(point, to, support.topY) : null;
    if (!fromClear && !fromJump) continue;
    if (!toClear && !toJump && !bridgeJump) continue;
    const route = bridgeJump ? [point, bridgeJump, to.clone()] : [point, to.clone()];
    const score = from.distanceTo(point) + point.distanceTo(to) + Math.abs(support.topY - routeRefY) * 0.45 - (bridgeJump ? 0.35 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = route;
    }
  }
  return bestRoute || [to.clone()];
}

function rebuildEnemyRoute(force = false) {
  if (!enemy) return;
  const nav = getEnemyNavState();
  if (!nav) return;
  const goal = makeVec(player.position.x, player.position.y - PLAYER_EYE_HEIGHT, player.position.z);
  nav.goal = goal.clone();
  nav.lastSeenPlayer = player.position.clone();
  nav.repathTimer = ENEMY_NAV_REPATH_INTERVAL;
  nav.stallCount = 0;
  nav.jump = null;
  clearEnemyRoute(nav);
  nav.mode = enemy.userData.mode || 'approach';

  const rooms = roomState.gauntletRooms || [];
  const specs = GENERATED_ROOM_BATCH || [];
  const graph = roomState.navGraph;
  const enemyRoomIndex = findNearestGauntletRoomIndex(enemy.position);
  const playerRoomIndex = findNearestGauntletRoomIndex(player.position);
  nav.lastEnemyRoomIndex = enemyRoomIndex;
  nav.lastPlayerRoomIndex = playerRoomIndex;
  nav.routePath = graph ? findRoomTraversalPath(graph, enemyRoomIndex, playerRoomIndex) || [] : [];

  if (!rooms.length || enemyRoomIndex < 0 || playerRoomIndex < 0) {
    appendRoutePoint(goal, 'flat');
    refreshEnemyRouteDebug(nav);
    return;
  }

  const appendRoutePoint = (point, preferredKind = 'flat') => {
    if (!point) return;
    const fromPoint = nav.waypoints.length
      ? nav.waypoints[nav.waypoints.length - 1]
      : makeVec(enemy.position.x, enemy.userData.baseY ?? enemy.position.y, enemy.position.z);
    pushEnemyRouteWaypoint(nav, point, classifyTraversalSegment(fromPoint, point, preferredKind));
  };

  const pathEdges = nav.routePath;
  if (pathEdges.length) {
    const startRoom = rooms[enemyRoomIndex];
    const firstEdge = pathEdges[0];
    const firstTargetRoom = rooms[firstEdge.to];
    const firstSource = pickRoomSocketToward(startRoom, roomWorldCenter(firstTargetRoom), firstEdge.fromKey, firstEdge.kind) || startRoom.spawn;
    for (const point of buildEnemyLocalRoute(startRoom, enemy.position, firstSource)) appendRoutePoint(point, firstEdge.kind);
    for (const edge of pathEdges) {
      const fromRoom = rooms[edge.from];
      const toRoom = rooms[edge.to];
      const source = pickRoomSocketToward(fromRoom, roomWorldCenter(toRoom), edge.fromKey, edge.kind) || fromRoom.exit;
      const target = pickRoomSocketToward(toRoom, roomWorldCenter(fromRoom), edge.toKey, edge.kind) || toRoom.spawn;
      appendRoutePoint(source, edge.kind);
      appendRoutePoint(target, edge.kind);
    }
    const finalRoom = rooms[playerRoomIndex];
    const tailStart = nav.waypoints.length ? nav.waypoints[nav.waypoints.length - 1] : enemy.position;
    const tailRoute = buildEnemyLocalRoute(finalRoom, tailStart, goal);
    for (const point of tailRoute) appendRoutePoint(point, roomTraversalKindForSpec(specs[playerRoomIndex]));
    if (!nav.waypoints.length) appendRoutePoint(goal, 'flat');
    refreshEnemyRouteDebug(nav);
    return;
  }

  if (enemyRoomIndex === playerRoomIndex) {
    for (const point of buildEnemyLocalRoute(rooms[enemyRoomIndex], enemy.position, goal)) appendRoutePoint(point, roomTraversalKindForSpec(specs[enemyRoomIndex]));
    if (!nav.waypoints.length) appendRoutePoint(goal, 'flat');
    refreshEnemyRouteDebug(nav);
    return;
  }

  const step = enemyRoomIndex < playerRoomIndex ? 1 : -1;
  for (let i = enemyRoomIndex; i !== playerRoomIndex; i += step) {
    const room = rooms[i];
    const nextRoom = rooms[i + step];
    const roomCenter = roomWorldCenter(room);
    const nextCenter = roomWorldCenter(nextRoom);
    const edgeKind = roomTraversalEdgeKind(specs[i], specs[i + step]);
    appendRoutePoint(pickRoomSocketToward(room, nextCenter, step > 0 ? 'exit' : 'spawn', edgeKind), edgeKind);
    appendRoutePoint(pickRoomSocketToward(nextRoom, roomCenter, step > 0 ? 'spawn' : 'exit', edgeKind), edgeKind);
  }

  const finalRoom = rooms[playerRoomIndex];
  const tailRoute = buildEnemyLocalRoute(finalRoom, nav.waypoints.length ? nav.waypoints[nav.waypoints.length - 1] : enemy.position, goal);
  for (const point of tailRoute) appendRoutePoint(point, roomTraversalKindForSpec(specs[playerRoomIndex]));
  if (!nav.waypoints.length) appendRoutePoint(goal, 'flat');
  refreshEnemyRouteDebug(nav);
}

function startEnemyJump(target) {
  if (!enemy) return false;
  const nav = getEnemyNavState();
  if (!nav) return false;
  const refY = Number.isFinite(enemy.userData.baseY) ? enemy.userData.baseY : enemy.position.y;
  const landing = resolveEnemyLandingSupport(target, refY, enemy.position);
  if (!landing) return false;
  const totalDuration = Math.max(0.48, enemyJumpDuration());
  const prepDuration = Math.min(ENEMY_JUMP_PREP_DURATION, totalDuration * 0.34);
  const landTime = Math.max(prepDuration + 0.24, totalDuration * ENEMY_JUMP_LAND_FRACTION);
  const travelDuration = Math.max(0.24, landTime - prepDuration);
  const settleDuration = Math.max(0, totalDuration - landTime);
  const horizontalDistance = Math.hypot(landing.point.x - enemy.position.x, landing.point.z - enemy.position.z);
  nav.jump = {
    start: enemy.position.clone(),
    target: landing.point.clone(),
    landing: landing.support,
    startY: refY,
    targetY: landing.support.topY,
    elapsed: 0,
    duration: totalDuration,
    prepDuration,
    landTime,
    travelDuration,
    settleDuration,
    landed: false,
    arc: Math.max(0.24, Math.min(0.74, 0.16 + Math.abs(landing.support.topY - refY) * 0.28 + horizontalDistance * 0.08)),
  };
  enemy.userData.mode = 'jump';
  enemy.userData.modeTimer = nav.jump.duration;
  enemy.userData.attackCooldown = Math.max(0, enemy.userData.attackCooldown || 0);
  enemy.userData.commitTimer = Math.max(0.15, enemy.userData.commitTimer || 0);
  playEnemyAction('jumping', 0.05);
  return true;
}

function advanceEnemyJump(dt) {
  if (!enemy) return false;
  const nav = getEnemyNavState();
  const jump = nav?.jump;
  if (!jump) return false;
  jump.elapsed += dt;
  if (jump.elapsed <= jump.prepDuration) {
    enemy.position.x = jump.start.x;
    enemy.position.z = jump.start.z;
    enemy.position.y = jump.startY;
    enemy.userData.baseY = jump.startY;
    return true;
  }

  if (jump.elapsed < jump.landTime) {
    const travelElapsed = jump.elapsed - jump.prepDuration;
    const t = clamp(travelElapsed / jump.travelDuration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    const lift = Math.sin(Math.PI * t) * jump.arc;
    enemy.position.x = jump.start.x + (jump.target.x - jump.start.x) * eased;
    enemy.position.z = jump.start.z + (jump.target.z - jump.start.z) * eased;
    enemy.position.y = jump.startY + (jump.targetY - jump.startY) * eased + lift;
    enemy.userData.baseY = jump.startY + (jump.targetY - jump.startY) * eased;
    return true;
  }

  const landing = findEnemySupport(jump.target.x, jump.target.z, jump.targetY, ENEMY_STEP_UP, ENEMY_STEP_DOWN) || jump.landing || { topY: jump.targetY };
  enemy.position.set(jump.target.x, landing.topY, jump.target.z);
  enemy.userData.baseY = landing.topY;
  nav.lastValidSupport = makeVec(jump.target.x, landing.topY, jump.target.z);

  if (!jump.landed) jump.landed = true;

  if (jump.elapsed < jump.duration) return true;

  if (nav.waypoints.length) shiftEnemyRouteWaypoint(nav);
  nav.jump = null;
  nav.repathTimer = 0.08;
  enemy.userData.mode = 'approach';
  enemy.userData.modeTimer = 0;
  playEnemyAction('idle', 0.08);
  return true;
}

function setEnemyMode(mode, timer = 0) {
  if (!enemy || enemy.userData.mode === mode) return;
  enemy.userData.mode = mode;
  enemy.userData.modeTimer = timer;
  if (mode === 'commit') enemy.userData.commitElapsed = 0;
  if (mode === 'retreat') {
    enemy.userData.orbitSign *= -1;
    enemy.userData.commitTimer = ENEMY_COMMIT_INTERVAL;
  }
}

function playArmAction(action, fade = 0.12, restart = false) {
  if (!action) return;
  if (action === activeArmAction && !restart) return;
  action.reset().enabled = true;
  action.fadeIn(fade).play();
  if (activeArmAction && activeArmAction !== action) activeArmAction.fadeOut(fade);
  activeArmAction = action;
}

function makeArmAction(clip, options = {}) {
  if (!armsMixer || !clip) return null;
  const action = armsMixer.clipAction(clip);
  action.enabled = true;
  if (options.once) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = Boolean(options.clamp);
  }
  return action;
}

function makeAttackDef(name, action, index = 0, options = {}) {
  const duration = Math.max(0.24, Number(action?.getClip?.().duration || options.duration || 0.55));
  return {
    name,
    action,
    index,
    duration,
    comboOpen: Math.max(0.16, duration * 0.46),
    hitAt: Math.max(0.08, duration * 0.34),
    dashStart: Math.max(0.05, duration * 0.22),
    dashDuration: Math.max(0.07, duration * 0.18),
    dashDistance: Number(options.dashDistance ?? (index >= 4 ? 0.58 : 0.36)),
    range: Number(options.range ?? 3.0),
    damage: Number(options.damage ?? 1),
    airBoost: Number(options.airBoost ?? 0),
  };
}

function startJumpCharge(pointerId = null) {
  input.jumpPointerId = pointerId;
  input.jumpCharging = true;
  input.jumpHoldStart = performance.now();
}

function normalizeEnemyModelToHeight(model, targetHeight = 2.35) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.y) || size.y <= 0.001) return null;
  const scale = targetHeight / size.y;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  fitted.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fitted.min.y;
  return scale;
}

function configureOrcBerserkerModel(model) {
  model.name = 'orc-berserker-model';
  model.rotation.y = Math.PI;
  model.position.set(0, 0, 0);
  model.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = USE_DYNAMIC_SHADOWS;
    node.receiveShadow = USE_DYNAMIC_SHADOWS;
    node.frustumCulled = false;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.flatShading = true;
      mat.roughness = Math.max(mat.roughness ?? 0.9, 0.82);
      mat.needsUpdate = true;
    }
  });
  const scale = normalizeEnemyModelToHeight(model, ORC_BERSERKER_TARGET_HEIGHT);
  model.position.y += ORC_BERSERKER_GROUND_OFFSET;
  return scale;
}

function loadOrcBerserkerEnemy() {
  fbxLoader.load(ORC_BERSERKER_MODEL, (asset) => {
    if (!enemy) return;
    if (enemyModel?.parent) enemyModel.parent.remove(enemyModel);
    enemyActions.clear();
    enemyCurrentAction = null;
    enemyModel = asset;
    const scale = configureOrcBerserkerModel(enemyModel);
    enemyMixer = asset.animations?.length ? new THREE.AnimationMixer(enemyModel) : null;
    if (enemyMixer) {
      registerEnemyClip('idle', asset.animations);
      playEnemyAction('idle', 0.01);
      loadProMeleeAxeEnemyClips();
    }
    enemy.add(enemyModel);
    if (enemyPrimitiveVisual) enemyPrimitiveVisual.visible = false;
    setStatus('standing idle orc imported' + (scale ? ' scale ' + scale.toFixed(3) : ''));
  }, undefined, (err) => {
    console.warn('standing idle orc failed; keeping primitive fallback', err);
    if (enemyPrimitiveVisual) enemyPrimitiveVisual.visible = true;
  });
}

function configureMutantOrcModel(model) {
  model.name = 'mutant-orc-model';
  model.scale.setScalar(0.012);
  model.rotation.y = Math.PI;
  model.position.set(0, 0, 0);
  model.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = USE_DYNAMIC_SHADOWS;
    node.receiveShadow = USE_DYNAMIC_SHADOWS;
    node.frustumCulled = false;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.flatShading = true;
      mat.roughness = Math.max(mat.roughness ?? 0.9, 0.82);
      mat.needsUpdate = true;
    }
  });
}

function registerEnemyClip(name, clips, options = {}) {
  if (!enemyMixer || !clips?.length) return null;
  const sourceClip = clips[0];
  const clip = options.stripRootMotionXZ ? stripRootMotionXZ(sourceClip) : sourceClip.clone();
  clip.name = name;
  const action = enemyMixer.clipAction(clip, enemyModel);
  action.enabled = true;
  if (options.timeScale) action.timeScale = options.timeScale;
  if (options.once) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }
  enemyActions.set(name, action);
  return action;
}

function playEnemyAction(name, fade = 0.16) {
  const next = enemyActions.get(name) || enemyActions.get('idle');
  if (!next || next === enemyCurrentAction) return;
  next.reset().fadeIn(fade).play();
  if (enemyCurrentAction) enemyCurrentAction.fadeOut(fade);
  enemyCurrentAction = next;
}

function loadEnemyClip(name, path, options = {}) {
  if (/\.poseclip\.json($|[?#])/i.test(path) || /\.json($|[?#])/i.test(path)) {
    loadPoseClip(path).then((clip) => {
      if (!clip) throw new Error('empty pose clip: ' + path);
      registerEnemyClip(name, [clip], options);
    }).catch((err) => {
      console.warn('enemy clip failed', name, err);
    });
    return;
  }
  fbxLoader.load(path, (asset) => {
    registerEnemyClip(name, asset.animations, options);
  }, undefined, (err) => {
    console.warn('enemy clip failed', name, err);
  });
}

function loadProMeleeAxeEnemyClips() {
  loadEnemyClip('idle', PRO_MELEE_AXE_CLIPS.idle, { stripRootMotionXZ: true });
  loadEnemyClip('walk', PRO_MELEE_AXE_CLIPS.walk, { stripRootMotionXZ: true });
  loadEnemyClip('sidestepLeft', PRO_MELEE_AXE_CLIPS.sidestepLeft, { stripRootMotionXZ: true });
  loadEnemyClip('sidestepRight', PRO_MELEE_AXE_CLIPS.sidestepRight, { stripRootMotionXZ: true });
  loadEnemyClip('run', PRO_MELEE_AXE_CLIPS.run, { stripRootMotionXZ: true, timeScale: 1.1 });
  loadEnemyClip('jumping', PRO_MELEE_AXE_CLIPS.jumping, { once: true, stripRootMotionXZ: true });
  loadEnemyClip('attackHorizontal', PRO_MELEE_AXE_CLIPS.attackHorizontal, { once: true });
  loadEnemyClip('react', PRO_MELEE_AXE_CLIPS.react, { once: true });
  loadEnemyClip('dying', PRO_MELEE_AXE_CLIPS.react, { once: true, timeScale: 0.72 });
}

function loadMutantOrcEnemy() {
  fbxLoader.load(MUTANT_ORC_CLIPS.idle, (asset) => {
    enemyModel = asset;
    configureMutantOrcModel(enemyModel);
    enemyMixer = new THREE.AnimationMixer(enemyModel);
    registerEnemyClip('idle', asset.animations);
    enemy.add(enemyModel);
    if (enemyPrimitiveVisual) enemyPrimitiveVisual.visible = false;
    playEnemyAction('idle', 0.01);
    loadEnemyClip('run', MUTANT_ORC_CLIPS.run);
    loadEnemyClip('walking', MUTANT_ORC_CLIPS.walking);
    loadEnemyClip('jumping', MUTANT_ORC_CLIPS.jumping, { once: true });
    loadEnemyClip('punch', MUTANT_ORC_CLIPS.punch, { once: true });
    loadEnemyClip('dying', MUTANT_ORC_CLIPS.dying, { once: true });
    setStatus('mutant orc enemy imported');
  }, undefined, (err) => {
    console.warn('mutant orc enemy failed; keeping primitive fallback', err);
    if (enemyPrimitiveVisual) enemyPrimitiveVisual.visible = true;
  });
}


function updateEnemyMixer(dt) {
  if (!enemyMixer) return;
  enemyMixer.update(dt);
  if (!enemy?.userData?.dead && enemyCurrentAction) {
    const clipName = enemyCurrentAction.getClip().name;
    const oneShotReturns = ['jumping', 'react'];
    if (oneShotReturns.includes(clipName) && enemyCurrentAction.time >= enemyCurrentAction.getClip().duration - 0.05) {
      playEnemyAction('idle', 0.12);
      return;
    }
  }
  if (!enemyCurrentAction) {
    const idle = enemyActions.get('idle');
    if (idle) {
      idle.reset().fadeIn(0.01).play();
      enemyCurrentAction = idle;
    }
  }
}

function loadArms() {
  loader.load('assets/models/FPSPlayer.glb', (gltf) => {
    armsModel = gltf.scene;
    armsModel.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        node.castShadow = false;
        node.renderOrder = 10;
        if (node.name === 'Plane' || node.name === 'placeholderWeapon') node.visible = false;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.flatShading = true;
          mat.needsUpdate = true;
        }
      }
    });
    armsScene.add(armsModel);
    armsCameraBone = findBone(armsModel, 'Camera');
    armsMixer = new THREE.AnimationMixer(armsModel);
    const clipsByName = clipMap(gltf.animations);
    idleAction = makeArmAction(chooseClip(gltf.animations, ['FistReady', 'FistIdle', '0T-Pose']));
    walkAction = makeArmAction(chooseClip(gltf.animations, ['FistWalking', 'Walking']));
    runAction = walkAction;
    jumpAction = makeArmAction(chooseClip(gltf.animations, ['FistJump', 'JumpAddative', 'Jump']), { once: true, clamp: true });
    climbIdleAction = makeArmAction(findClipByNames(gltf.animations, ['ClimbIdle', 'ClimbHold', 'LedgeHangIdle', 'HangIdle', 'Climbing']));
    climbUpAction = makeArmAction(findClipByNames(gltf.animations, ['ClimbUp', 'VerticalClimb', 'ClimbVertical', 'Climbing']));
    climbLeftAction = makeArmAction(findClipByNames(gltf.animations, ['ClimbLeft', 'HorizontalClimbLeft', 'ShimmyLeft', 'HorizontalClimb', 'ClimbingSide']));
    climbRightAction = makeArmAction(findClipByNames(gltf.animations, ['ClimbRight', 'HorizontalClimbRight', 'ShimmyRight', 'HorizontalClimb', 'ClimbingSide']));
    mantleAction = makeArmAction(findClipByNames(gltf.animations, ['ClimbMantle', 'VaultUp', 'LedgeClimb', 'Mantle']), { once: true, clamp: true });
    normalAttackDefs = [1, 2, 3, 4, 5].map((index) => {
      const clip = clipsByName.get('FistAttack' + index) || chooseClip(gltf.animations, ['FistAttack' + index]);
      const action = makeArmAction(clip, { once: true });
      return makeAttackDef('FistAttack' + index, action, index - 1, { dashDistance: 0.32 + index * 0.055, damage: 1 + index * 0.08 });
    }).filter((def) => def.action);
    attackAction = normalAttackDefs[0]?.action || null;
    sprintAttackAction = makeArmAction(clipsByName.get('FistAttackSprint') || chooseClip(gltf.animations, ['FistAttackSprint', 'SprintAttack']), { once: true });
    airAttackAction = makeArmAction(clipsByName.get('FistAttackAir') || chooseClip(gltf.animations, ['FistAttackAir', 'AirAttack']), { once: true });
    airForwardAttackAction = makeArmAction(clipsByName.get('FistAttackAirForward') || chooseClip(gltf.animations, ['FistAttackAirForward', 'AirForward']), { once: true });
    crouchAttackAction = makeArmAction(clipsByName.get('FistAttackCrouch') || chooseClip(gltf.animations, ['FistAttackCrouch', 'CrouchAttack']), { once: true });
    sprintAttackDef = makeAttackDef('FistAttackSprint', sprintAttackAction, 0, { dashDistance: 0.96, range: 3.35, damage: 1.45 });
    airAttackDef = makeAttackDef('FistAttackAir', airAttackAction, 0, { dashDistance: 0.26, range: 2.85, damage: 1.15 });
    airForwardAttackDef = makeAttackDef('FistAttackAirForward', airForwardAttackAction, 0, { dashDistance: 1.05, range: 3.4, damage: 1.35, airBoost: 3.2 });
    crouchAttackDef = makeAttackDef('FistAttackCrouch', crouchAttackAction, 0, { duration: 0.66, dashDistance: 0.4, range: 2.9, damage: 1.35 });
    if (crouchAttackDef) {
      crouchAttackDef.dashStart = 0.33;
      crouchAttackDef.dashDuration = 0.075;
      crouchAttackDef.hitAt = 0.36;
      crouchAttackDef.comboOpen = 0.42;
    }
    playArmAction(idleAction, 0.01);
    fallbackArms.visible = false;
    setStatus('FPS arms ready: ' + gltf.animations.length + ' clips');
  }, undefined, (err) => {
    console.error(err);
    fallbackArms.visible = true;
    setStatus('using primitive arms fallback');
  });
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function noiseBuffer(duration = 0.08) {
  const sampleRate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  return buffer;
}

function playStep(intensity = 1) {
  if (!audioCtx) return;
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  src.buffer = noiseBuffer(0.055 + Math.random() * 0.035);
  src.playbackRate.value = 0.82 + Math.random() * 0.28 + intensity * 0.1;
  filter.type = 'lowpass';
  filter.frequency.value = 360 + intensity * 240 + Math.random() * 90;
  gain.gain.value = 0.03 + intensity * 0.05;
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
}

function playThud(power = 1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(92 + power * 22, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.08 * power, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.16);
}

function setActionPadVisible(visible) {
  actionPad.classList.toggle('visible', visible);
}

function placeActionPad() {
  actionPad.style.left = 'auto';
  actionPad.style.top = 'auto';
  actionPad.style.right = 'max(22px, env(safe-area-inset-right))';
  actionPad.style.bottom = 'max(20px, env(safe-area-inset-bottom))';
  setActionPadVisible(true);
}

function selectAttackDef() {
  if (!player.grounded) return player.lastRunIntent ? airForwardAttackDef : airAttackDef;
  if (player.isRunning) return sprintAttackDef;
  if (player.comboTimer <= 0) player.comboIndex = 0;
  const def = normalAttackDefs[player.comboIndex % Math.max(1, normalAttackDefs.length)] || normalAttackDefs[0] || sprintAttackDef || airAttackDef;
  player.comboIndex = (player.comboIndex + 1) % Math.max(1, normalAttackDefs.length || 1);
  player.comboTimer = 0.9;
  return def;
}

function beginAttack() {
  beginAttackDef(selectAttackDef());
}

function beginHoldAttack() {
  beginAttackDef(crouchAttackDef || selectAttackDef());
}

function commitJump(force = 0, charge = 0, keepCharge = false) {
  ensureAudio();
  if (!player.grounded || player.mode === 'climb' || player.mode === 'mantle') return;
  const forward = cameraForwardYaw(player.yaw).normalize();
  const lateral = cameraRightYaw(player.yaw).normalize();
  const moveBlend = new THREE.Vector3().addScaledVector(forward, input.moveY).addScaledVector(lateral, input.moveX);
  if (moveBlend.lengthSq() > 1) moveBlend.normalize();
  const horizontalVelocity = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
  const horizontalSpeed = horizontalVelocity.length();
  const moveDir = horizontalSpeed > 0.05
    ? horizontalVelocity.multiplyScalar(1 / horizontalSpeed)
    : (moveBlend.lengthSq() > 0.0001 ? moveBlend.normalize() : forward.clone());
  const chargeRatio = clamp(charge / JUMP_CHARGE_MAX, 0, 1);
  const easedCharge = 1 - Math.pow(1 - chargeRatio, 4);
  const chargeBoost = easedCharge * WALK_JUMP_CHARGE_HEIGHT;
  const verticalBoost = player.isRunning
    ? WALK_JUMP_BASE_HEIGHT + RUN_JUMP_VERTICAL_BOOST + force + Math.min(0.4, horizontalSpeed * 0.07)
    : WALK_JUMP_BASE_HEIGHT + chargeBoost + force;
  const directionalBoost = player.isRunning
    ? RUN_JUMP_HORIZONTAL_BOOST + Math.min(1.6, horizontalSpeed * 0.28) + force
    : 0;
  player.velocity.x += moveDir.x * directionalBoost;
  player.velocity.z += moveDir.z * directionalBoost;
  player.velocity.y = Math.max(player.velocity.y, verticalBoost);
  player.grounded = false;
  if (!keepCharge) {
    input.jumpCharging = false;
    input.jumpHoldStart = 0;
    input.jumpPointerId = null;
  }
  if (jumpAction) playArmAction(jumpAction, 0.045, true);
  playThud(player.isRunning ? 0.55 : 0.42 + chargeRatio * 0.1);
  setActionPadVisible(true);
}

function beginAttackDef(def) {
  ensureAudio();
  if (player.mode === 'climb' || player.mode === 'mantle') return;
  const current = player.attack;
  if (current && current.elapsed < current.def.comboOpen) return;
  if (!def) return;
  const direction = cameraForwardYaw(player.yaw).normalize();
  player.attack = { def, elapsed: 0, hitDone: false, dashDone: 0, direction };
  player.attackTimer = def.duration;
  if (def.airBoost && !player.grounded) {
    player.velocity.x += direction.x * def.airBoost;
    player.velocity.z += direction.z * def.airBoost;
    player.velocity.y = Math.max(player.velocity.y, 1.2);
  }
  playArmAction(def.action, 0.035, true);
  playThud(def.name.includes('Sprint') || def.name.includes('Forward') || def.name.includes('Crouch') ? 0.92 : 0.62);
  setActionPadVisible(true);
}

function jump(pointerId = null) {
  if (player.mode === 'climb') {
    const normal = player.climb?.normal || cameraForwardYaw(player.yaw).multiplyScalar(-1);
    player.mode = 'air';
    player.climb = null;
    player.velocity.set(normal.x * CLIMB_DETACH_BACK, CLIMB_DETACH_UP, normal.z * CLIMB_DETACH_BACK);
    player.grounded = false;
    if (jumpAction) playArmAction(jumpAction, 0.045, true);
    return;
  }
  if (player.mode === 'mantle') return;
  if (!player.grounded) return;
  if (player.isRunning) {
    commitJump(0.75, 0, false);
    return;
  }
  startJumpCharge(pointerId);
  commitJump(0, 0, true);
}

async function toggleGyro() {
  ensureAudio();
  if (!input.gyro && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') return;
    } catch (err) {
      console.warn(err);
      return;
    }
  }
  input.gyro = !input.gyro;
  input.gyroYaw = 0;
  input.gyroPitch = 0;
  input.gyroBaseGamma = null;
  input.gyroBaseBeta = null;
  gyroButton.classList.toggle('active', input.gyro);
  setStatus(input.gyro ? 'gyro assist on' : 'gyro assist off');
  setActionPadVisible(true);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (err) {
    console.warn(err);
  }
}

function setupTouch() {
  window.addEventListener('pointerdown', ensureAudio, { passive: true });

  const handlePointerMove = (event) => {
    if (event.pointerId === input.stickPointer) {
      updateStick(event);
      event.preventDefault();
      return;
    }
    if (event.pointerId !== input.lookPointer) return;
    const dx = event.clientX - input.lastLookX;
    const dy = event.clientY - input.lastLookY;
    input.lastLookX = event.clientX;
    input.lastLookY = event.clientY;
    player.yaw -= dx * 0.0065;
    player.pitch = clamp(player.pitch - dy * 0.0053, -1.15, 1.1);
    event.preventDefault();
  };
  const endLook = (event) => {
    if (event.pointerId === input.stickPointer) {
      endStick(event);
      return;
    }
    if (event.pointerId !== input.lookPointer) return;
    input.lookPointer = null;
    placeActionPad(event.clientX, event.clientY);
    event.preventDefault();
  };
  window.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', endLook);
  window.addEventListener('pointercancel', endLook);

  fsButton.addEventListener('pointerdown', (event) => {
    ensureAudio();
    toggleFullscreen();
    event.preventDefault();
  });

  for (const button of [attackButton, jumpButton, gyroButton]) {
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    button.addEventListener('selectstart', (event) => event.preventDefault());
    button.addEventListener('pointerdown', (event) => {
      ensureAudio();
      setActionPadVisible(true);
      input.lookPointer = event.pointerId;
      input.lastLookX = event.clientX;
      input.lastLookY = event.clientY;
      if (button === attackButton) {
        const pointerId = event.pointerId;
        let holdTriggered = false;
        const holdTimer = window.setTimeout(() => {
          if (input.attackPointerId !== pointerId) return;
          holdTriggered = true;
          beginHoldAttack();
        }, 260);
        input.attackPointerId = pointerId;
        const finishAttackPress = (upEvent) => {
          if (upEvent.pointerId !== pointerId) return;
          window.clearTimeout(holdTimer);
          try { attackButton.releasePointerCapture(pointerId); } catch (err) { console.warn(err); }
          window.removeEventListener('pointerup', finishAttackPress, true);
          window.removeEventListener('pointercancel', finishAttackPress, true);
          input.attackPointerId = null;
          if (!holdTriggered) beginAttack();
          upEvent.preventDefault();
        };
        try { attackButton.setPointerCapture(pointerId); } catch (err) { console.warn(err); }
        window.addEventListener('pointerup', finishAttackPress, true);
        window.addEventListener('pointercancel', finishAttackPress, true);
      } else if (button === jumpButton) {
        const pointerId = event.pointerId;
        if (player.grounded) {
          jump(pointerId);
          if (input.jumpCharging) {
            try { jumpButton.setPointerCapture(pointerId); } catch (err) { console.warn(err); }
            const finishJumpPress = (upEvent) => {
              if (upEvent.pointerId !== pointerId) return;
              window.removeEventListener('pointerup', finishJumpPress, true);
              window.removeEventListener('pointercancel', finishJumpPress, true);
              try { jumpButton.releasePointerCapture(pointerId); } catch (err) { console.warn(err); }
              input.jumpCharging = false;
              input.jumpHoldStart = 0;
              input.jumpPointerId = null;
              upEvent.preventDefault();
            };
            window.addEventListener('pointerup', finishJumpPress, true);
            window.addEventListener('pointercancel', finishJumpPress, true);
          }
        }
      } else if (button === gyroButton) {
        toggleGyro();
      }
      event.preventDefault();
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    ensureAudio();
    hintEl.style.opacity = '0';
    if (event.clientX < window.innerWidth * 0.44) beginStick(event);
    else beginLook(event);
    event.preventDefault();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      jump();
      event.preventDefault();
    }
    if (event.code === 'KeyF' || event.code === 'Enter') beginAttack();
    if (event.code === 'KeyW') input.moveY = 1;
    if (event.code === 'KeyS') input.moveY = -1;
    if (event.code === 'KeyA') input.moveX = -1;
    if (event.code === 'KeyD') input.moveX = 1;
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && input.jumpCharging && input.jumpPointerId === null) {
      input.jumpCharging = false;
      input.jumpHoldStart = 0;
      event.preventDefault();
    }
    if ((event.code === 'KeyW' && input.moveY > 0) || (event.code === 'KeyS' && input.moveY < 0)) input.moveY = 0;
    if ((event.code === 'KeyA' && input.moveX < 0) || (event.code === 'KeyD' && input.moveX > 0)) input.moveX = 0;
  });

  window.addEventListener('deviceorientation', (event) => {
    if (!input.gyro) return;
    const gamma = Number(event.gamma || 0);
    const beta = Number(event.beta || 0);
    if (input.gyroBaseGamma === null || input.gyroBaseBeta === null) {
      input.gyroBaseGamma = gamma;
      input.gyroBaseBeta = beta;
    }
    input.gyroYaw = clamp(THREE.MathUtils.degToRad(gamma - input.gyroBaseGamma) * 0.72, -0.42, 0.42);
    input.gyroPitch = clamp(THREE.MathUtils.degToRad(beta - input.gyroBaseBeta) * 0.44, -0.28, 0.28);
  });
}

function beginStick(event) {
  input.stickPointer = event.pointerId;
  const size = leftStick.getBoundingClientRect().width || 132;
  leftStick.style.left = clamp(event.clientX - size / 2, 8, window.innerWidth * 0.48 - size) + 'px';
  leftStick.style.top = clamp(event.clientY - size / 2, 44, window.innerHeight - size - 8) + 'px';
  leftStick.style.bottom = 'auto';
  leftStick.classList.add('active');
  updateStick(event);
}

function beginLook(event) {
  input.lookPointer = event.pointerId;
  input.lastLookX = event.clientX;
  input.lastLookY = event.clientY;
}

function updateStick(event) {
  const rect = leftStick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const max = rect.width * 0.36;
  const mag = Math.min(max, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const kx = Math.cos(angle) * mag;
  const ky = Math.sin(angle) * mag;
  stickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
  const nx = clamp(kx / max, -1, 1);
  const ny = clamp(-ky / max, -1, 1);
  input.moveX = Math.sign(nx) * Math.pow(Math.abs(nx), STICK_RESPONSE);
  input.moveY = Math.sign(ny) * Math.pow(Math.abs(ny), STICK_RESPONSE);
}

function endStick(event) {
  if (event.pointerId !== input.stickPointer) return;
  input.stickPointer = null;
  input.moveX = 0;
  input.moveY = 0;
  stickKnob.style.transform = 'translate(0, 0)';
  leftStick.classList.remove('active');
  event.preventDefault();
}

function updatePlayer(dt) {
  const now = performance.now();
  const smoothRate = player.grounded ? MOVE_INPUT_SMOOTH_GROUND : MOVE_INPUT_SMOOTH_AIR;
  const smoothBlend = 1 - Math.exp(-smoothRate * dt);
  input.smoothMoveX += (input.moveX - input.smoothMoveX) * smoothBlend;
  input.smoothMoveY += (input.moveY - input.smoothMoveY) * smoothBlend;
  if (Math.abs(input.moveX) < 0.001 && Math.abs(input.smoothMoveX) < 0.015) input.smoothMoveX = 0;
  if (Math.abs(input.moveY) < 0.001 && Math.abs(input.smoothMoveY) < 0.015) input.smoothMoveY = 0;
  const moveX = input.smoothMoveX;
  const moveY = input.smoothMoveY;
  const forward = cameraForwardYaw(player.yaw);
  const right = cameraRightYaw(player.yaw);
  const desired = new THREE.Vector3();
  desired.addScaledVector(forward, moveY);
  desired.addScaledVector(right, moveX);
  if (desired.lengthSq() > 1) desired.normalize();
  const stickMagnitude = Math.hypot(moveX, moveY);

  if (player.mode === 'climb') {
    updatePlayerClimb(dt, moveX, moveY);
    finalizePlayerFrame(dt, now, stickMagnitude);
    return;
  }
  if (player.mode === 'mantle') {
    updatePlayerMantle(dt);
    finalizePlayerFrame(dt, now, stickMagnitude);
    return;
  }

  const forwardArc = moveY > 0.56 && Math.abs(moveX) <= Math.max(0.001, moveY);
  const buildingRun = player.grounded && forwardArc && stickMagnitude > 0.55;
  if (buildingRun) player.runCharge = Math.min(RUN_BUILD_TIME, player.runCharge + dt);
  else if (player.grounded) player.runCharge = Math.max(0, player.runCharge - dt * 2.2);
  else if (player.runCharge > 0) player.runCharge = Math.max(0, player.runCharge - dt * 0.15);
  player.isRunning = player.grounded && player.runCharge >= RUN_BUILD_TIME;
  if (player.isRunning) player.lastRunIntent = true;
  else if (player.grounded && stickMagnitude < 0.18) player.lastRunIntent = false;
  const runProgress = clamp(player.runCharge / RUN_BUILD_TIME, 0, 1);
  const wishSpeed = player.grounded ? (GROUND_WISH_SPEED + (RUN_WISH_SPEED - GROUND_WISH_SPEED) * runProgress) : AIR_CRUISE_SPEED;
  const accel = player.grounded ? GROUND_ACCEL : AIR_TURN_ACCEL;
  if (player.grounded) {
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (horizontalSpeed > 0.001) {
      const drop = horizontalSpeed * GROUND_FRICTION * dt;
      const newSpeed = Math.max(0, horizontalSpeed - drop);
      if (newSpeed !== horizontalSpeed) {
        const scale = newSpeed / horizontalSpeed;
        player.velocity.x *= scale;
        player.velocity.z *= scale;
      }
    }
  }
  const wishDir = desired.lengthSq() > 0.0001 ? desired.normalize() : desired;
  if (!player.grounded) {
    const horizontal = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
    const horizontalSpeed = horizontal.length();
    if (wishDir.lengthSq() > 0.0001) {
      const currentSpeed = horizontal.dot(wishDir);
      const addSpeed = wishSpeed - currentSpeed;
      if (addSpeed > 0) {
        const accelSpeed = AIR_TURN_ACCEL * Math.max(0.35, stickMagnitude) * dt;
        const applied = Math.min(accelSpeed, addSpeed);
        horizontal.addScaledVector(wishDir, applied);
      } else if (addSpeed < 0) {
        const brakeSpeed = Math.min(-addSpeed, AIR_BRAKE_ACCEL * dt);
        horizontal.addScaledVector(wishDir, brakeSpeed);
      }
    }
    if (horizontalSpeed > AIR_MAX_SPEED) {
      const overspeed = horizontalSpeed - AIR_MAX_SPEED;
      const drag = Math.min(overspeed, AIR_DRAG * dt + overspeed * 0.12 * dt);
      if (horizontalSpeed > 0.001) horizontal.multiplyScalar((horizontalSpeed - drag) / horizontalSpeed);
    }
    player.velocity.x = horizontal.x;
    player.velocity.z = horizontal.z;
  } else if (wishDir.lengthSq() > 0.0001) {
    const currentSpeed = player.velocity.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed > 0) {
      const accelSpeed = accel * wishSpeed * dt;
      const applied = Math.min(accelSpeed, addSpeed);
      player.velocity.addScaledVector(wishDir, applied);
    }
  }
  if (!player.grounded && input.jumpCharging && input.jumpHoldStart !== 0 && player.velocity.y > 0) {
    const held = clamp((now - input.jumpHoldStart) / 1000, 0, JUMP_CHARGE_MAX);
    const taper = 1 - held / JUMP_CHARGE_MAX;
    player.velocity.y += JUMP_HOLD_ACCEL * taper * dt;
  }
  if (player.attack) {
    const def = player.attack.def;
    const dashEnd = def.dashStart + def.dashDuration;
    if (player.attack.elapsed >= def.dashStart && player.attack.elapsed <= dashEnd) {
      const step = (def.dashDistance / def.dashDuration) * dt;
      player.position.addScaledVector(player.attack.direction, step);
      player.attack.dashDone += step;
    }
  }
  player.velocity.y -= 14.4 * dt;
  player.position.addScaledVector(player.velocity, dt);
  resolvePlayerSolids(player.position, player.velocity);
  const feetY = player.position.y - PLAYER_EYE_HEIGHT;
  let support = player.velocity.y <= 0 ? (resolveSupportHeight(player.position.x, player.position.z, feetY, player.velocity.y) || resolveSolidTopSupport(player.position.x, player.position.z, feetY, player.velocity.y)) : null;
  if (!support && player.velocity.y <= 0 && desired.lengthSq() > 0.0001) {
    const stepSurface = findWalkableStepSurface(player.position, desired, feetY);
    if (stepSurface) {
      player.position.x = stepSurface.targetX;
      player.position.z = stepSurface.targetZ;
      support = stepSurface.surface;
    }
  }
  if (support) {
    if (!player.grounded && player.velocity.y < -1.2) playThud(0.7);
    player.position.y = support.topY + PLAYER_EYE_HEIGHT;
    player.velocity.y = 0;
    player.grounded = true;
    player.mode = 'ground';
    if (player.isRunning && input.jumpCharging && input.jumpHoldStart !== 0 && player.lastRunIntent && now - input.jumpHoldStart > 35) commitJump(0.15, 0, false);
  } else {
    player.grounded = false;
    player.mode = 'air';
    if (tryBeginClimb(true)) {
      finalizePlayerFrame(dt, now, stickMagnitude);
      return;
    }
  }
  finalizePlayerFrame(dt, now, stickMagnitude);
}

function startEnemyAttack() {
  if (!enemy || enemy.userData.attackTimer > 0) return;
  const attackName = enemyActions.has('attackHorizontal') ? 'attackHorizontal' : '';
  if (!attackName) {
    console.warn('enemy attack missing attackHorizontal; refusing fallback attack');
    return;
  }
  const clipDuration = enemyActions.get(attackName)?.getClip?.().duration || ENEMY_ATTACK_RECOVERY;
  enemy.userData.attackName = attackName;
  enemy.userData.attackTimer = Math.max(clipDuration, ENEMY_ATTACK_RECOVERY);
  enemy.userData.attackElapsed = 0;
  enemy.userData.attackHitDone = false;
  playEnemyAction(attackName, 0.055);
}

function updateEnemyEngagement(dt) {
  if (!enemy) return;
  updateEnemyMixer(dt);
  enemy.userData.hitTimer = Math.max(0, enemy.userData.hitTimer - dt);
  enemy.userData.deathTimer = Math.max(0, enemy.userData.deathTimer || 0);
  const nav = getEnemyNavState();
  const baseY = Number.isFinite(enemy.userData.baseY) ? enemy.userData.baseY : enemy.position.y;
  enemy.position.y = baseY + Math.sin(performance.now() * 0.002) * 0.025;
  enemy.scale.setScalar(enemy.userData.hitTimer > 0 ? 1.08 : 1);
  if (!enemy.visible) return;
  if (enemy.userData.dead) {
    if (enemy.userData.deathTimer > 0) {
      enemy.userData.deathTimer = Math.max(0, enemy.userData.deathTimer - dt);
      if (enemy.userData.deathTimer <= 0) enemy.visible = false;
    }
    return;
  }

  const support = findEnemySupport(enemy.position.x, enemy.position.z, baseY, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (support) {
    enemy.userData.baseY = support.topY;
    if (nav) nav.lastValidSupport = makeVec(enemy.position.x, support.topY, enemy.position.z);
  }
  const previousGoal = nav?.goal ? nav.goal.clone() : null;
  const playerGoalY = player.grounded ? (player.position.y - PLAYER_EYE_HEIGHT) : (previousGoal?.y ?? (player.position.y - PLAYER_EYE_HEIGHT));
  const routeGoal = makeVec(player.position.x, playerGoalY, player.position.z);
  const playerFloorY = playerGoalY;
  const verticalGap = playerFloorY - enemy.userData.baseY;
  const directCombatGoal = enemyCombatGoalPoint();
  const toPlayer = player.position.clone().sub(enemy.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const toPlayerDir = dist > 0.001 ? toPlayer.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1);

  let playerRoomIndex = findNearestGauntletRoomIndex(player.position);
  let enemyRoomIndex = findNearestGauntletRoomIndex(enemy.position);
  if (nav) {
    nav.lastSeenPlayer = player.position.clone();
    nav.repathTimer = Math.max(0, nav.repathTimer - dt);
    if (nav.jump) {
      advanceEnemyJump(dt);
      return;
    }
    const roomDelta = (playerRoomIndex >= 0 && enemyRoomIndex >= 0)
      ? Math.abs(playerRoomIndex - enemyRoomIndex)
      : Number.POSITIVE_INFINITY;
    const shouldWake = dist <= ENEMY_AI_WAKE_DISTANCE || roomDelta <= ENEMY_AI_WAKE_ROOM_DELTA;
    const shouldSleep = dist >= ENEMY_AI_SLEEP_DISTANCE || roomDelta > ENEMY_AI_SLEEP_ROOM_DELTA;
    if (nav.asleep ? !shouldWake : shouldSleep) {
      if (!nav.asleep) {
        nav.asleep = true;
        clearEnemyRoute(nav);
      }
      nav.goal = null;
      nav.jump = null;
      nav.repathTimer = ENEMY_NAV_REPATH_INTERVAL;
      nav.stallCount = 0;
      enemy.userData.attackTimer = 0;
      enemy.userData.attackElapsed = 0;
      enemy.userData.attackHitDone = false;
      enemy.userData.attackName = '';
      enemy.userData.mode = 'hold';
      enemy.userData.modeTimer = 0;
      playEnemyAction('idle', 0.16);
      return;
    }
    if (nav.asleep) {
      nav.asleep = false;
      nav.repathTimer = 0;
      nav.lastEnemyRoomIndex = -1;
      nav.lastPlayerRoomIndex = -1;
    }
    nav.goal = routeGoal.clone();
    const goalChanged = !previousGoal || (player.grounded ? previousGoal.distanceToSquared(nav.goal) > 0.36 : ((previousGoal.x - nav.goal.x) ** 2 + (previousGoal.z - nav.goal.z) ** 2 > 0.36));
    const roomChanged = nav.lastEnemyRoomIndex !== enemyRoomIndex || nav.lastPlayerRoomIndex !== playerRoomIndex;
    const staleRoute = nav.waypoints.length === 0 || nav.repathTimer <= 0 || roomChanged || goalChanged;
    if (staleRoute) rebuildEnemyRoute(roomChanged || nav.waypoints.length === 0);
    nav.lastEnemyRoomIndex = enemyRoomIndex;
    nav.lastPlayerRoomIndex = playerRoomIndex;
  }
  enemy.rotation.y = Math.atan2(enemy.position.x - player.position.x, enemy.position.z - player.position.z);

  enemy.userData.attackCooldown = Math.max(0, (enemy.userData.attackCooldown || 0) - dt);
  enemy.userData.commitTimer = Math.max(0, (enemy.userData.commitTimer || 0) - dt);
  enemy.userData.modeTimer = Math.max(0, (enemy.userData.modeTimer || 0) - dt);
  if (enemy.userData.hitTimer > 0) return;

  if (enemy.userData.attackTimer > 0) {
    enemy.userData.attackElapsed += dt;
    enemy.userData.attackTimer = Math.max(0, enemy.userData.attackTimer - dt);
    if (enemy.userData.attackElapsed >= ENEMY_ATTACK_WINDUP && enemy.userData.attackElapsed <= ENEMY_ATTACK_ACTIVE_END) {
      applyEnemyMove(toPlayerDir, ENEMY_LUNGE_SPEED, dt);
    }
    if (!enemy.userData.attackHitDone && enemy.userData.attackElapsed >= ENEMY_ATTACK_WINDUP) {
      enemy.userData.attackHitDone = true;
      if (dist <= ENEMY_ATTACK_RANGE + 0.3) {
        player.healthPulse = 0.45;
        player.velocity.addScaledVector(toPlayerDir, 1.65);
        playThud(1.05);
      }
    }
    if (enemy.userData.attackTimer <= 0) {
      enemy.userData.attackCooldown = ENEMY_ATTACK_COOLDOWN;
      enemy.userData.attackName = '';
      setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
      playEnemyAction('idle', 0.12);
    }
    return;
  }

  const mode = enemy.userData.mode || 'approach';
  const directCombatPath = enemyHasDirectCombatPath();
  if (nav && directCombatPath && nav.waypoints.length && !nav.jump) {
    clearEnemyRoute(nav);
    nav.routePath.length = 0;
    nav.repathTimer = ENEMY_NAV_REPATH_INTERVAL * 0.5;
  }
  const tangent = new THREE.Vector3(-toPlayerDir.z, 0, toPlayerDir.x).multiplyScalar(enemy.userData.orbitSign || 1);
  const navTarget = nav?.waypoints?.length ? nav.waypoints[0].clone() : null;
  const navKind = nav?.waypointKinds?.[0] || 'flat';
  const toNavTarget = navTarget ? navTarget.clone().sub(enemy.position) : null;
  if (toNavTarget) toNavTarget.y = 0;
  const navDist = toNavTarget ? toNavTarget.length() : dist;
  const navDir = toNavTarget && navDist > 0.001 ? toNavTarget.clone().multiplyScalar(1 / navDist) : toPlayerDir;
  const needsClimb = player.grounded && verticalGap > 0.22;
  const separatedByGraph = enemyRoomIndex >= 0 && playerRoomIndex >= 0 && enemyRoomIndex !== playerRoomIndex;
  const traversalActive = Boolean(navTarget) && (separatedByGraph || (nav?.routePath?.length || 0) > 0 || navKind !== 'flat' || navDist > ENEMY_ATTACK_RANGE + 0.45);

  if (navTarget && navDist < 0.36) {
    shiftEnemyRouteWaypoint(nav);
    nav.repathTimer = 0;
  }
  if (nav?.jump) {
    advanceEnemyJump(dt);
    return;
  }

  if (traversalActive) {
    setEnemyMode('approach');
    const segmentNeedsJump = !sampleEnemyMoveSupport(enemy.position, navTarget) && enemyCanJumpBetween(enemy.position, navTarget);
    if (segmentNeedsJump) {
      startEnemyJump(navTarget);
      return;
    }
    const navSpeed = (navKind === 'stair' || navKind === 'drop')
      ? ENEMY_WALK_SPEED
      : (navDist > ENEMY_RING_RADIUS + 1.75 || navKind === 'bridge' || navKind === 'branch' || navKind === 'jump' ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED);
    const moved = applyEnemyMove(navDir, navSpeed, dt);
    playEnemyAction(navSpeed > ENEMY_WALK_SPEED + 0.1 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    } else if (nav) {
      nav.stallCount = 0;
      nav.lastValidSupport = makeVec(enemy.position.x, baseY, enemy.position.z);
    }
    return;
  }

  if (needsClimb) {
    setEnemyMode('approach');
    const climbDir = navTarget ? navDir : toPlayerDir;
    const moved = applyEnemyMove(climbDir, ENEMY_RUN_SPEED, dt);
    playEnemyAction('run', 0.16);
    if (!moved && nav) {
      nav.stallCount += 1;
      nav.repathTimer = 0;
      rebuildEnemyRoute(true);
    }
    return;
  }

  if (dist <= ENEMY_ATTACK_RANGE && enemy.userData.attackCooldown <= 0 && mode !== 'retreat' && !needsClimb && !traversalActive) {
    startEnemyAttack();
    return;
  }

  if (mode === 'commit') {
    enemy.userData.commitElapsed += dt;
    const moved = applyEnemyMove(navTarget ? navDir : toPlayerDir, ENEMY_RUN_SPEED, dt);
    playEnemyAction('run', 0.12);
    if (dist <= ENEMY_ATTACK_RANGE && enemy.userData.attackCooldown <= 0) {
      startEnemyAttack();
      return;
    }
    if (!moved || enemy.userData.commitElapsed >= ENEMY_COMMIT_TIMEOUT) {
      setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
      if (nav) nav.repathTimer = 0;
    }
    return;
  }

  if (mode === 'retreat') {
    const retreatDir = toPlayerDir.clone().multiplyScalar(-0.85).addScaledVector(tangent, 0.42);
    const moved = applyEnemyMove(retreatDir, ENEMY_RETREAT_SPEED, dt);
    playEnemyAction(enemy.userData.orbitSign > 0 ? 'sidestepRight' : 'sidestepLeft', 0.14);
    if (!moved || enemy.userData.modeTimer <= 0 || dist >= ENEMY_RING_RADIUS + ENEMY_RING_TOLERANCE) {
      setEnemyMode('hold', 0.55);
      if (nav) nav.repathTimer = 0;
    }
    return;
  }

  if (navTarget) {
    const moved = applyEnemyMove(navDir, navDist > ENEMY_RING_RADIUS + 2.2 ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED, dt);
    playEnemyAction(navDist > ENEMY_RING_RADIUS + 2.2 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    } else if (nav) {
      nav.stallCount = 0;
      nav.lastValidSupport = makeVec(enemy.position.x, baseY, enemy.position.z);
    }
    return;
  }

  if (dist > ENEMY_RING_RADIUS + ENEMY_RING_TOLERANCE) {
    setEnemyMode('approach');
    const moved = applyEnemyMove(toPlayerDir, dist > ENEMY_RING_RADIUS + 2.2 ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED, dt);
    playEnemyAction(dist > ENEMY_RING_RADIUS + 2.2 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    }
    return;
  }

  if (dist < ENEMY_ATTACK_RANGE * 0.78 && !needsClimb) {
    setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
    return;
  }

  setEnemyMode('hold');
  if (enemy.userData.commitTimer <= 0 && enemy.userData.attackCooldown <= 0) {
    setEnemyMode('commit');
    return;
  }

  const radialError = dist - ENEMY_RING_RADIUS;
  const holdMove = tangent.clone().addScaledVector(toPlayerDir, radialError * 0.22);
  const moved = applyEnemyMove(holdMove, ENEMY_SIDESTEP_SPEED, dt);
  if (!moved) {
    enemy.userData.orbitSign *= -1;
    enemy.userData.commitTimer = Math.min(enemy.userData.commitTimer || 0, 0.25);
    if (nav) {
      nav.stallCount += 1;
      nav.repathTimer = 0;
      if (nav.stallCount >= ENEMY_NAV_STALL_LIMIT) rebuildEnemyRoute(true);
    }
  } else if (nav) {
    nav.stallCount = 0;
  }
  playEnemyAction(enemy.userData.orbitSign > 0 ? 'sidestepRight' : 'sidestepLeft', 0.18);
}

function updateAttack(dt) {
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  const attack = player.attack;
  if (!attack) return;
  attack.elapsed += dt;
  const def = attack.def;
  if (!attack.hitDone && attack.elapsed >= def.hitAt) {
    attack.hitDone = true;
    const toEnemy = enemy.position.clone().sub(player.position);
    toEnemy.y = 0;
    const dist = toEnemy.length();
    const alignment = dist > 0.001 ? attack.direction.dot(toEnemy.normalize()) : 0;
    if (enemy.visible && !enemy.userData.dead && dist < def.range && alignment > 0.5) {
      enemy.userData.health -= def.damage;
      enemy.userData.hitTimer = 0.28;
      enemy.position.addScaledVector(attack.direction, 0.28 + def.damage * 0.12);
      playEnemyAction('react', 0.04);
      playThud(1.05 + def.damage * 0.16);
      if (enemy.userData.health <= 0) {
        enemy.userData.dead = true;
        enemy.userData.deathTimer = 1.35;
        playEnemyAction('dying', 0.04);
        setStatus('orc berserker down. survive another room.');
      }
    }
  }
  if (attack.elapsed >= def.duration) {
    player.attack = null;
    player.attackTimer = 0;
  }
}

function updateArms(dt) {
  if (armsMixer) armsMixer.update(dt);
  const moving = Math.hypot(input.smoothMoveX, input.smoothMoveY) > 0.18;
  if (!player.attack && player.mode === 'mantle' && mantleAction) playArmAction(mantleAction, 0.08, activeArmAction !== mantleAction);
  else if (!player.attack && player.mode === 'climb') {
    if (input.smoothMoveY > 0.18 && climbUpAction) {
      climbUpAction.timeScale = 1;
      playArmAction(climbUpAction, 0.1);
    }
    else if (input.smoothMoveX < -0.18 && climbLeftAction) {
      climbLeftAction.timeScale = 1;
      playArmAction(climbLeftAction, 0.1);
    }
    else if (input.smoothMoveX > 0.18 && climbRightAction) {
      climbRightAction.timeScale = 1;
      playArmAction(climbRightAction, 0.1);
    }
    else if (climbIdleAction) {
      climbIdleAction.timeScale = 0;
      playArmAction(climbIdleAction, 0.08);
    }
  }
  else if (!player.attack && player.grounded && moving && walkAction) walkAction.timeScale = player.isRunning ? 1.55 : 1;
  if (!player.attack && player.mode === 'ground') playArmAction(moving ? walkAction : idleAction, 0.12);
  else if (!player.attack && player.mode === 'air' && jumpAction) playArmAction(jumpAction, 0.12);
  if (armsModel && armsCameraBone) {
    armsModel.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    armsCameraBone.getWorldPosition(pos);
    armsCamera.position.copy(pos);
    armsCamera.position.y += 0.015;
    armsCamera.lookAt(pos.x, pos.y + 0.01, pos.z + 1.35);
  } else {
    const punch = Math.max(0, player.attackTimer / 0.42);
    fallbackArms.children.forEach((child, index) => {
      child.position.z += Math.sin(performance.now() * 0.008 + index) * 0.0007;
    });
    fallbackArms.rotation.z = Math.sin(player.bob * Math.PI * 2) * 0.018 + punch * -0.05;
  }
}

function updatePad() {
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  armsCamera.aspect = w / h;
  armsCamera.updateProjectionMatrix();
}

function render() {
  requestAnimationFrame(render);
  try {
    const dt = Math.min(0.045, clock.getDelta());
    updatePlayer(dt);
    updateAttack(dt);
    updateEnemyEngagement(dt);
    updateArms(dt);
    updateDiegeticLights(performance.now() / 1000);
    updatePad();
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(armsScene, armsCamera);
    const mode = player.attack?.def?.name || (input.jumpCharging ? 'jump-charge' : (player.isRunning ? 'run' : (!player.grounded ? 'air' : (player.runCharge > 0 ? 'build' : 'walk'))));
    const node = roomState.spec;
    const districtText = node?.districtName ? ` | D${(node.districtIndex ?? 0) + 1} ${node.districtName}${node.districtElevationBand ? `(${node.districtElevationBand})` : ''}` : '';
    const enemyNav = getEnemyNavState();
    const navMode = enemyNav?.asleep ? 'sleep' : (enemyNav?.waypointKinds[0] || enemy.userData.mode || 'idle');
    const navText = enemyNav ? ` | nav ${navMode} w${enemyNav.waypoints.length} e${enemyNav.routePath.length}` : '';
    refreshEnemyRouteDebug(enemyNav);
    readoutEl.textContent = `L${roomState.levelIndex + 1}.${roomState.nodeIndex + 1} ${node ? node.connector : 'loading'}${districtText} | move ${input.smoothMoveX.toFixed(2)},${input.smoothMoveY.toFixed(2)} | ${mode} | enemy ${enemy.visible ? enemy.userData.health.toFixed(1) : 'down'}${navText} | ${input.gyro ? 'gyro' : 'touch'}`;
  } catch (err) {
    console.error(err);
    setStatus('runtime error: ' + (err?.message || err));
    hintEl.textContent = 'Runtime error: ' + (err?.message || err);
    hintEl.style.opacity = '1';
  }
}

function init() {
  try {
    buildLights();
    buildEnemy();
    buildRoom();
    setupTouch();
    resize();
    window.addEventListener('resize', resize);
    placeActionPad();
    loadArms();
    loadOrcBerserkerEnemy();
    setStatus('Limbo room ready');
    render();
  } catch (err) {
    console.error(err);
    setStatus('boot error: ' + (err?.message || err));
    hintEl.textContent = 'Boot error: ' + (err?.message || err);
    hintEl.style.opacity = '1';
  }
}

init();
