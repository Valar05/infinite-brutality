import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GENERATED_ROOM_BATCH } from './generated_room_batch.js';
import { QUAKE_M1E1_SLICE } from './quake-m1e1-slice.js?v=0.8.197';
import { buildCarvedVoxelFortressData } from './carved-voxel-fortress-slice.js?v=0.8.209';
import { buildDistrictIntentPlan } from './district-intent-planner.js?v=0.8.213';
import { buildDistrictAssemblyPlan } from './district-assembly-emitter.js?v=0.8.213';
import { createDistrictGeometryApi } from './district-geometry.js?v=0.8.196';
import { createMaterialResources } from './materials.js?v=0.8.213';
import { createEnemyCombatApi } from './enemy-combat.js?v=0.8.128';
import { createBoundedContactMantlePlan, createPlayerClimbApi } from './player-climb.js?v=0.8.218';
import { createPhysicsWorld, ensurePhysicsReady } from './physics-world.js?v=0.8.218';
import { createNookTtsApi } from './nook-tts.js';
import { queryVoxelIntersectsPrism, queryVoxelTopY } from './island-geometry.js?v=0.8.179';
import { createTerrainLayer } from './terrain-layer.js?v=0.8.200';
import { generateControllerArena } from './controller-kata.js?v=0.8.218';
import { applyWorldGridOverlay } from './controller-grid-material.js?v=0.8.214';
import { evaluateSpawnCandidate as evaluateSpawnAnchorCandidate, findSpawnAnchor as findBestSpawnAnchor } from './spawn-anchor.js?v=0.8.152';
import {
  DISTRICT_ARCHETYPES,
  DISTRICT_ROOM_COUNT_PROFILES,
  DISTRICT_LOCAL_LAYOUTS,
  DISTRICT_MACRO_TEMPLATES,
  DISTRICT_ARCHETYPE_TEMPLATES,
  DISTRICT_STORY_PACKET_FAMILY,
  DISTRICT_STORY_PLACEMENT_RUNTIME_SETS,
  applyDefaultArchitecturalFamily,
  buildDistrictSkeletonMeta,
  classifySpineRoute,
  buildDistrictMacroOrigins,
  pickDistrictLayout,
  sampleRange,
  createDistrictStoryApi,
} from './district-plan.js';

const BUILD = '0.8.218';
const URL_PARAMS = new URLSearchParams(window.location.search);
const ACTIVE_SLICE = URL_PARAMS.get('slice') || 'controller_kata';
const CONTROLLER_KATA_BASE_SEED = URL_PARAMS.get('seed') || 'controller-proof';
const ACTIVE_DISTRICT_ID = URL_PARAMS.get('district') || 'artillery_battery';
const ISLAND_ART_ONLY = true;
const PLAYABLE_SLICE_ROOM_COUNT = 3;
const USE_DYNAMIC_SHADOWS = false;
const USE_DYNAMIC_DIEGETIC_LIGHTS = false;
const DEBUG_RAGDOLL = URL_PARAMS.get('ragdebug') === '1';
const DEBUG_ATTACK_SWEEP = URL_PARAMS.get('attackdebug') === '1';
const DEBUG_UI = URL_PARAMS.get('debugui') === '1';
const VISUAL_QA_BEACON = URL_PARAMS.has('beacon');
const VISUAL_QA_CAPTURE = URL_PARAMS.has('capture');
const DEBUG_COLLISION = URL_PARAMS.get('debugCollision') === '1';
const VISUAL_QA_CAPTURE_FRAMES = Math.max(1, Math.min(24, Number(URL_PARAMS.get('captureFrames') || 1)));
const VISUAL_QA_CAPTURE_INTERVAL_MS = Math.max(100, Math.min(10000, Number(URL_PARAMS.get('captureIntervalMs') || 500)));
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const readoutEl = document.getElementById('readout');
const hintEl = document.getElementById('hint');
if (readoutEl) readoutEl.hidden = !DEBUG_UI;
const errorCopyButton = document.getElementById('errorCopyButton');
const leftStick = document.getElementById('leftStick');
const stickKnob = leftStick.querySelector('div');
const actionPad = document.getElementById('actionPad');
const attackButton = document.getElementById('attackButton');
const jumpButton = document.getElementById('jumpButton');
const gyroButton = document.getElementById('gyroButton');
const fsButton = document.getElementById('fsButton');
const healthBarFill = document.getElementById('healthBarFill');
const healthValueEl = document.getElementById('healthValue');
const damageFlashEl = document.getElementById('damageFlash');
const healthHudEl = document.getElementById('healthHud');
const attackDebugHud = document.getElementById('attackDebugHud');
const attackDebugText = document.getElementById('attackDebugText');

window.addEventListener('error', (event) => {
  const detail = event.error || event.message;
  console.error(detail);
  const summary = rememberError('Runtime error', detail);
  setStatus(summary.toLowerCase());
  hintEl.textContent = summary;
  hintEl.style.opacity = '1';
});
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  const summary = rememberError('Promise error', event.reason);
  setStatus(summary.toLowerCase());
  hintEl.textContent = summary;
  hintEl.style.opacity = '1';
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.0, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = USE_DYNAMIC_SHADOWS;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.48;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x162329);
scene.fog = new THREE.FogExp2(0x162329, 0.0058);

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 160);
camera.rotation.order = 'YXZ';

const armsScene = new THREE.Scene();
const armsCamera = new THREE.PerspectiveCamera(82, 1, 0.01, 12);
armsCamera.up.set(0, 1, 0);
armsCamera.lookAt(0, 0, 1);
armsScene.add(new THREE.HemisphereLight(0xe8ece8, 0x606868, 1.65));
armsScene.add(new THREE.AmbientLight(0x788184, 1.55));
const armsKey = new THREE.DirectionalLight(0xece8df, 2.0);
armsKey.position.set(-0.4, 5.6, 3.4);
armsScene.add(armsKey);
const armsFill = new THREE.DirectionalLight(0xdfecef, 2.2);
armsFill.position.set(2.8, 4.2, 2.0);
armsScene.add(armsFill);

const clock = new THREE.Clock();
const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const environmentPmrem = new THREE.PMREMGenerator(renderer);
environmentPmrem.compileEquirectangularShader();
function installMeshyEnvironmentLighting() {
  const url = new URL('../assets/textures/ib-real-limbo-skybox-20260609.png', import.meta.url).href;
  textureLoader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const environmentMap = environmentPmrem.fromEquirectangular(texture).texture;
    scene.environment = environmentMap;
    armsScene.environment = environmentMap;
    scene.environmentIntensity = 0.96;
    armsScene.environmentIntensity = 1.28;
    texture.dispose();
    environmentPmrem.dispose();
  }, undefined, (error) => {
    console.warn('environment lighting texture failed; direct light rig remains', error);
  });
}
installMeshyEnvironmentLighting();
const FPSPLAYER_MESHY_VISUAL_OVERLAY = {
  model: 'assets/models/fpsplayer_meshy/FPSPlayer_rigged_20260615.glb',
  requiredTextures: ['baseColor', 'normal', 'roughness'],
  textureTransform: { offset: [0.025, 0.475], repeat: [0.85, 0.65] },
  textures: {
    baseColor: 'Meshy_AI__0615135730_texture (1).png',
    normal: 'Meshy_AI__0615135730_texture_normal.png',
    roughness: 'Meshy_AI__0615135730_texture_roughness (1).png',
    metallic: 'Meshy_AI__0615135730_texture_metallic (1).png',
    emission: 'Meshy_AI__0615135730_texture_emission.png',
  },
  materialOptions: { color: 0xffffff, roughness: 1.0, metalness: 0.0, normalScale: 0.26, emissive: 0x000000, emissiveIntensity: 0.0, envMapIntensity: 0.72 },
};
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
const HIT_FREEZE_TIME = 0.05;
const HIT_SLOW_TIME = 0.24;
const HIT_SLOW_SCALE = 0.26;
const HIT_SHAKE_TIME = 0.28;
const HIT_SHAKE_STRENGTH = 0.05;
const PLAYER_MAX_HEALTH = 10;
const ENEMY_BLOOD_PARTICLE_COUNT = 14;
const ENEMY_BLOOD_PARTICLE_LIFETIME = 0.42;
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
const CLIMB_JUMP_REGRAB_LOCK_MS = 500;

const player = {
  position: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, -8.4),
  visualPosition: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, -8.4),
  velocity: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  grounded: true,
  mode: 'ground',
  climb: null,
  climbRegrabUntil: 0,
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
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  damageTaken: 0,
  lastDamageAt: 0,
  damageFlash: 0,
  hurtTimer: 0,
  hurtRecoverTimer: 0,
};

const walkableSurfaces = [];
const solidColliders = [];
const meshSupportColliders = [];
const voxelSupportColliders = [];
const climbSurfaces = [];
const diegeticLights = [];

function rapierPlayerCollisionActive() {
  return !!roomState.physicsWorld;
}
const bootParams = new URLSearchParams(window.location.search);
const bootDistrictTarget = (bootParams.get('district') || '').trim();
const bootLevelTarget = bootParams.has('level') ? Math.max(0, Math.floor(Number(bootParams.get('level') || 0) || 0)) : null;
const bootPlayerOverride = ['playerx', 'playery', 'playerz'].every((key) => bootParams.has(key))
  ? new THREE.Vector3(
    Number(bootParams.get('playerx')),
    Number(bootParams.get('playery')),
    Number(bootParams.get('playerz')),
  )
  : null;
const ATTACK_LAB = bootParams.get('attacklab') === '1';
if (bootParams.has('reset')) {
  localStorage.setItem('infinite-brutality-level-index', '0');
  localStorage.setItem('infinite-brutality-node-index', '0');
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
  sliceSpecs: null,
  navGraph: null,
  connectivityRepair: null,
  terrainLayer: null,
  physicsWorld: null,
  controllerKataMantleProof: null,
  lastFrameMs: 0,
  lastRenderMs: 0,
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

const attackDebug = {
  group: new THREE.Group(),
  history: [],
  snapshot: null,
};
attackDebug.group.name = 'attack-sweep-debug';
scene.add(attackDebug.group);

const collisionDebug = {
  group: new THREE.Group(),
  key: '',
};
collisionDebug.group.name = 'collision-truth-debug';
collisionDebug.group.visible = DEBUG_COLLISION;
scene.add(collisionDebug.group);

const combatFx = {
  timeScale: 1,
  slowTimer: 0,
  shakeTime: 0,
  shakeDuration: 0,
  shakeStrength: 0,
};
const NOOK_TTS_TRIGGER_DISTANCE = 2.6;
const NOOK_TTS_VERTICAL_DISTANCE = 2.4;
const NOOK_TTS_COOLDOWN = 2.8;
const NOOK_TTS_HINT_TIME = 4.2;
const nookTtsState = {
  manifest: null,
  byPacketId: new Map(),
  heardPlacementIds: new Set(),
  heardLevelIndex: -1,
  cooldown: 0,
  hintTimer: 0,
  audio: null,
  currentPlacementId: '',
  currentText: '',
  manifestPromise: null,
};
let enemyBloodGroup = null;
const enemyBloodParticles = [];

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


const playerClimb = createPlayerClimbApi({
  player,
  input,
  solidColliders,
  climbSurfaces,
  cameraForwardYaw,
  faceYawFromNormal,
  canStandOnClimbSurfaceTop,
  canStandOnSolidTop,
  findMantleTopSupport,
  clamp,
  makeVec,
  constants: {
    PLAYER_EYE_HEIGHT,
    PLAYER_SOLID_RADIUS,
    CLIMB_MIN_HEIGHT,
    CLIMB_MIN_TOP_SIZE,
    CLIMB_ATTACH_DISTANCE,
    CLIMB_TOP_OUT_THRESHOLD,
    CLIMB_FACE_OFFSET,
    CLIMB_MANTLE_DURATION,
    CLIMB_MANTLE_FORWARD,
    CLIMB_SPEED_HORIZONTAL,
    CLIMB_SPEED_VERTICAL,
    CLIMB_TERRAIN_LATERAL_SPAN: 3.4,
    CLIMB_TERRAIN_VERTICAL_SPAN: 3.1,
  },
});
const { tryBeginClimb, startMantleFromClimb, updatePlayerClimb, updatePlayerMantle } = playerClimb;

const nookTts = createNookTtsApi({
  state: nookTtsState,
  roomState,
  player,
  hintEl,
  buildVersion: BUILD,
  AudioCtor: Audio,
  constants: {
    NOOK_TTS_TRIGGER_DISTANCE,
    NOOK_TTS_VERTICAL_DISTANCE,
    NOOK_TTS_COOLDOWN,
    NOOK_TTS_HINT_TIME,
  },
});
const { stopNookTtsPlayback, ensureNookTtsLevelState, loadNookTtsManifest, allStoryNookPlacements, playNookTtsPlacement, updateNookTts } = nookTts;


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
let hurtAction = null;
let hurtRecoverAction = null;
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
let lastErrorClipboardText = '';
let visualQaCapturedFrames = 0;
let visualQaLastCaptureMs = -Infinity;
let visualQaRenderedBeaconSent = false;

function publishVisualQaBeacon(stage, values = {}) {
  if (!VISUAL_QA_BEACON) return;
  try {
    const params = new URLSearchParams({
      stage,
      build: BUILD,
      t: String(Math.round(performance.now())),
    });
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const image = new Image();
    image.src = '/__visual_qa_smoke?' + params.toString();
  } catch (_err) {}
}

function publishVisualQaCapture(stage, values = {}) {
  if (!VISUAL_QA_CAPTURE || !canvas?.toBlob) return;
  try {
    const params = new URLSearchParams({
      stage,
      build: BUILD,
      t: String(Math.round(performance.now())),
    });
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      fetch('/__visual_qa_capture?' + params.toString(), { method: 'POST', body: blob }).catch(() => {});
    }, 'image/png');
  } catch (_err) {}
}

function collisionTruthSnapshot() {
  const physics = roomState.physicsWorld?.snapshot?.() || null;
  const truth = {
    build: BUILD,
    physicsReady: !!physics,
    rapierPlayerCollisionActive: rapierPlayerCollisionActive(),
    totalRapierColliders: physics?.colliderCount ?? 0,
    terrainMeshColliders: physics?.terrainMeshColliderCount ?? 0,
    primitiveCuboidColliders: physics?.cuboidColliderCount ?? 0,
    ownerlessColliders: physics?.ownerlessColliderCount ?? 0,
    legacySolidPlayerBlockersActive: rapierPlayerCollisionActive() ? 0 : solidColliders.length,
    legacyWalkablePlayerSupportActive: rapierPlayerCollisionActive() ? 0 : walkableSurfaces.length,
    legacyVoxelPlayerBlockersActive: rapierPlayerCollisionActive() ? 0 : voxelSupportColliders.length,
    legacyMeshPlayerSupportActive: rapierPlayerCollisionActive() ? 0 : meshSupportColliders.length,
    storedLegacySolidCount: solidColliders.length,
    storedLegacyWalkableCount: walkableSurfaces.length,
    storedLegacyVoxelCount: voxelSupportColliders.length,
    storedLegacyMeshSupportCount: meshSupportColliders.length,
    playerContactCount: physics?.contactCount ?? 0,
    playerGrounded: physics?.grounded ?? false,
    colliderKinds: physics?.colliderKinds || {},
    ownerlessSources: (physics?.ownerlessColliders || []).map((record) => record.source || record.kind || record.type).slice(0, 8),
  };
  window.__ibCollisionTruth = truth;
  return truth;
}

function clearCollisionDebugGroup() {
  while (collisionDebug.group.children.length) {
    const child = collisionDebug.group.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
    child.parent?.remove?.(child);
  }
}

function updateCollisionDebugOverlay() {
  if (!DEBUG_COLLISION) return;
  const physics = roomState.physicsWorld?.snapshot?.() || null;
  const records = physics?.colliders || [];
  const key = records.map((record) => record.type + ':' + record.source + ':' + (record.position || record.origin || []).join(',')).join('|');
  if (key === collisionDebug.key) return;
  collisionDebug.key = key;
  clearCollisionDebugGroup();
  const material = new THREE.LineBasicMaterial({ color: 0x58e6ff, transparent: true, opacity: 0.88 });
  for (const record of records) {
    if (record.type !== 'cuboid' || !record.size || !record.position) continue;
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(record.size[0], record.size[1], record.size[2]));
    const line = new THREE.LineSegments(geometry, material.clone());
    line.name = 'collision-debug-' + (record.source || 'ownerless');
    line.position.set(record.position[0], record.position[1], record.position[2]);
    line.rotation.y = record.yaw || 0;
    collisionDebug.group.add(line);
  }
}

function visualQaBeaconFields(extra = {}) {
  const node = extra.node || roomState?.spec || null;
  const district = node?.districtName || '';
  const enemyNav = extra.enemyNav || null;
  const physics = roomState.physicsWorld?.snapshot?.() || null;
  const collisionTruth = collisionTruthSnapshot();
  const physicsKinds = physics?.colliderKinds || {};
  return {
    width: canvas?.width || 0,
    height: canvas?.height || 0,
    status: statusEl?.textContent || '',
    level: (roomState?.levelIndex ?? 0) + 1,
    nodeIndex: (roomState?.nodeIndex ?? 0) + 1,
    connector: node?.connector || '',
    district,
    districtIndex: node?.districtIndex == null ? '' : node.districtIndex + 1,
    districtElevationBand: node?.districtElevationBand || '',
    playerMode: player?.mode || '',
    playerHealth: Math.round(player?.health ?? 0),
    playerGrounded: !!player?.grounded,
    playerRunning: !!player?.isRunning,
    playerX: Number(player?.position?.x || 0).toFixed(2),
    playerY: Number(player?.position?.y || 0).toFixed(2),
    playerZ: Number(player?.position?.z || 0).toFixed(2),
    enemyVisible: !!enemy?.visible,
    enemyHealth: Math.round(enemy?.userData?.health ?? 0),
    enemyMode: enemy?.userData?.mode || '',
    enemyNavMode: extra.navMode || '',
    enemyWaypoints: enemyNav?.waypoints?.length ?? '',
    triangles: renderer?.info?.render?.triangles ?? 0,
    calls: renderer?.info?.render?.calls ?? 0,
    physicsReady: !!physics,
    physicsColliderCount: physics?.colliderCount ?? '',
    ownerlessColliderCount: collisionTruth.ownerlessColliders,
    legacySolidPlayerBlockersActive: collisionTruth.legacySolidPlayerBlockersActive,
    legacyWalkablePlayerSupportActive: collisionTruth.legacyWalkablePlayerSupportActive,
    legacyVoxelPlayerBlockersActive: collisionTruth.legacyVoxelPlayerBlockersActive,
    physicsTerrainColliderCount: physicsKinds.terrain ?? '',
    physicsStructureColliderCount: (physicsKinds.structure || 0) + (physicsKinds.solid || 0) + (physicsKinds.walkable || 0),
    frameMs: Number(roomState.lastFrameMs || 0).toFixed(2),
    renderMs: Number(roomState.lastRenderMs || 0).toFixed(2),
    physicsStepMs: physics ? Number(physics.stepMs || 0).toFixed(3) : '',
    physicsMoveMs: physics ? Number(physics.moveMs || 0).toFixed(3) : '',
    playerContactCount: physics?.contactCount ?? '',
    physicsGrounded: physics?.grounded ?? '',
    ...extra,
    node: undefined,
    enemyNav: undefined,
  };
}

function maybePublishVisualQaFrame(values = {}) {
  if (!VISUAL_QA_BEACON && !VISUAL_QA_CAPTURE) return;
  const now = performance.now();
  const shouldCapture = VISUAL_QA_CAPTURE
    && visualQaCapturedFrames < VISUAL_QA_CAPTURE_FRAMES
    && (visualQaCapturedFrames === 0 || now - visualQaLastCaptureMs >= VISUAL_QA_CAPTURE_INTERVAL_MS);
  const stage = visualQaRenderedBeaconSent ? 'frame' : 'rendered';
  if (!visualQaRenderedBeaconSent || shouldCapture) {
    const fields = visualQaBeaconFields({ ...values, frame: visualQaCapturedFrames });
    publishVisualQaBeacon(stage, fields);
    visualQaRenderedBeaconSent = true;
    if (shouldCapture) {
      publishVisualQaCapture(stage, fields);
      visualQaCapturedFrames += 1;
      visualQaLastCaptureMs = now;
    }
  }
}

function setStatus(text) {
  statusEl.textContent = 'build ' + BUILD + ' | ' + text;
}

function refreshPlayerHealthHud() {
  const maxHealth = Math.max(1, player.maxHealth || PLAYER_MAX_HEALTH);
  const health = clamp(player.health ?? maxHealth, 0, maxHealth);
  const ratio = health / maxHealth;
  if (healthBarFill) {
    healthBarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    healthBarFill.style.filter = player.healthPulse > 0 ? `brightness(${1 + player.healthPulse * 0.55}) saturate(${1 + player.healthPulse * 0.4})` : 'none';
  }
  if (healthValueEl) healthValueEl.textContent = `${Math.ceil(health)} / ${maxHealth}`;
  if (damageFlashEl) damageFlashEl.style.opacity = (player.damageFlash || 0).toFixed(3);
}

function refreshAttackDebugHud() {
  if (!attackDebugHud || !attackDebugText) return;
  if (!DEBUG_ATTACK_SWEEP) {
    attackDebugHud.hidden = true;
    attackDebugText.textContent = '';
    return;
  }
  attackDebugHud.hidden = false;
  const snap = attackDebug.snapshot;
  if (!snap) {
    attackDebugText.textContent = 'attack debug\nno active sweep';
    return;
  }
  attackDebugText.textContent = [
    `attack ${snap.name}  t ${snap.elapsed.toFixed(2)} / ${snap.total.toFixed(2)}`,
    `window ${snap.activeStart.toFixed(2)} - ${snap.activeEnd.toFixed(2)}   lunge ${snap.lungeStart.toFixed(2)} - ${snap.lungeEnd.toFixed(2)}`,
    `dist pre ${snap.preDist.toFixed(2)}   post ${snap.postDist.toFixed(2)}   active ${snap.active ? 'yes' : 'no'}`,
    `probe ${snap.reason}   actual ${snap.actual.toFixed(2)} / need ${snap.threshold.toFixed(2)}`,
    `travel pre ${snap.preTravel.toFixed(2)}   post ${snap.postTravel.toFixed(2)}   health ${Math.ceil(player.health)} / ${player.maxHealth}`,
    `lab ${ATTACK_LAB ? 'on' : 'off'}`,
  ].join('\n');
}

function shortErrorText(detail) {
  if (detail instanceof Error) return detail.message || detail.name || 'unknown';
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail.message === 'string') return detail.message;
  if (detail === undefined || detail === null) return 'unknown';
  try {
    return JSON.stringify(detail);
  } catch (err) {
    return String(detail);
  }
}

function formatErrorDetail(detail) {
  if (detail instanceof Error) return detail.stack || detail.message || detail.name || 'unknown';
  if (typeof detail === 'string') return detail;
  if (detail === undefined || detail === null) return 'unknown';
  try {
    return JSON.stringify(detail, null, 2);
  } catch (err) {
    return String(detail);
  }
}

function updateErrorCopyButton() {
  if (!errorCopyButton) return;
  const hasError = !!lastErrorClipboardText;
  errorCopyButton.hidden = !hasError;
  errorCopyButton.disabled = !hasError;
}

function rememberError(kind, detail) {
  const short = shortErrorText(detail);
  const summary = kind + ': ' + short;
  const detailText = formatErrorDetail(detail);
  const lines = ['build ' + BUILD + ' | ' + summary];
  if (readoutEl.textContent) lines.push('readout: ' + readoutEl.textContent);
  if (detailText && detailText !== short) lines.push(detailText);
  lastErrorClipboardText = lines.join('\n');
  updateErrorCopyButton();
  return summary;
}

function fallbackCopyText(text) {
  const probe = document.createElement('textarea');
  probe.value = text;
  probe.setAttribute('readonly', 'readonly');
  probe.style.position = 'fixed';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  probe.select();
  probe.setSelectionRange(0, probe.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    copied = false;
  }
  probe.remove();
  return copied;
}

async function copyLastErrorToClipboard() {
  if (!lastErrorClipboardText) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(lastErrorClipboardText);
    } else if (!fallbackCopyText(lastErrorClipboardText)) {
      throw new Error('clipboard unavailable');
    }
    setStatus('error copied');
    hintEl.textContent = 'Copied last error to clipboard.';
    hintEl.style.opacity = '1';
  } catch (err) {
    console.error(err);
    const summary = rememberError('Copy failed', err);
    setStatus(summary.toLowerCase());
    hintEl.textContent = summary;
    hintEl.style.opacity = '1';
  }
}

if (errorCopyButton) {
  errorCopyButton.addEventListener('click', () => {
    void copyLastErrorToClipboard();
  });
  updateErrorCopyButton();
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

function ensureEnemyBloodGroup() {
  if (enemyBloodGroup) return enemyBloodGroup;
  enemyBloodGroup = new THREE.Group();
  enemyBloodGroup.name = 'enemy-blood-particles';
  scene.add(enemyBloodGroup);
  return enemyBloodGroup;
}

function spawnEnemyBloodBurst(worldPoint, direction, strength = 1) {
  if (!worldPoint) return;
  const group = ensureEnemyBloodGroup();
  const count = Math.max(6, Math.round(ENEMY_BLOOD_PARTICLE_COUNT * clamp(strength, 0.6, 1.5)));
  for (let i = 0; i < count; i += 1) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0x3c0b0e : 0x8a2020,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const size = 0.035 + Math.random() * 0.065;
    mesh.scale.set(size, size * (0.8 + Math.random() * 0.7), size);
    mesh.position.copy(worldPoint);
    group.add(mesh);
    const spray = direction ? direction.clone() : new THREE.Vector3(0, 0, -1);
    spray.y = Math.max(0.18, spray.y + 0.25 + Math.random() * 0.35);
    spray.x += (Math.random() - 0.5) * 0.75;
    spray.z += (Math.random() - 0.5) * 0.75;
    spray.normalize().multiplyScalar(1.8 + Math.random() * 2.6 + strength * 0.7);
    enemyBloodParticles.push({
      mesh,
      material: mat,
      velocity: spray,
      age: 0,
      life: ENEMY_BLOOD_PARTICLE_LIFETIME * (0.75 + Math.random() * 0.55),
      spin: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
    });
  }
}

function updateEnemyBloodParticles(dt) {
  if (!enemyBloodParticles.length) return;
  for (let i = enemyBloodParticles.length - 1; i >= 0; i -= 1) {
    const particle = enemyBloodParticles[i];
    particle.age += dt;
    if (particle.age >= particle.life) {
      particle.mesh.removeFromParent();
      particle.mesh.geometry.dispose();
      particle.material.dispose();
      enemyBloodParticles.splice(i, 1);
      continue;
    }
    particle.velocity.y -= 5.8 * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.rotation.x += particle.spin.x * dt;
    particle.mesh.rotation.y += particle.spin.y * dt;
    particle.mesh.rotation.z += particle.spin.z * dt;
    particle.material.opacity = Math.max(0, 1 - particle.age / particle.life);
  }
}

function triggerHitJuice(worldPoint, direction, damage = 1) {
  const strength = clamp(0.72 + damage * 0.18, 0.72, 1.5);
  player.hitPause = Math.max(player.hitPause || 0, HIT_FREEZE_TIME);
  combatFx.timeScale = Math.min(combatFx.timeScale, HIT_SLOW_SCALE);
  combatFx.slowTimer = Math.max(combatFx.slowTimer, HIT_SLOW_TIME + damage * 0.03);
  combatFx.shakeTime = Math.max(combatFx.shakeTime, HIT_SHAKE_TIME + damage * 0.03);
  combatFx.shakeDuration = Math.max(combatFx.shakeDuration, combatFx.shakeTime);
  combatFx.shakeStrength = Math.max(combatFx.shakeStrength, HIT_SHAKE_STRENGTH * strength);
  spawnEnemyBloodBurst(worldPoint, direction, strength);
}

function updateCombatFx(realDt) {
  player.hitPause = Math.max(0, (player.hitPause || 0) - realDt);
  player.healthPulse = Math.max(0, (player.healthPulse || 0) - realDt * 1.8);
  player.damageFlash = Math.max(0, (player.damageFlash || 0) - realDt * 1.9);
  if (combatFx.slowTimer > 0) {
    combatFx.slowTimer = Math.max(0, combatFx.slowTimer - realDt);
    const recoverBlend = 1 - Math.exp(-10 * realDt);
    combatFx.timeScale += (1 - combatFx.timeScale) * recoverBlend;
  } else {
    combatFx.timeScale += (1 - combatFx.timeScale) * (1 - Math.exp(-14 * realDt));
  }
  if (combatFx.shakeTime > 0) {
    combatFx.shakeTime = Math.max(0, combatFx.shakeTime - realDt);
    if (combatFx.shakeTime <= 0.0001) {
      combatFx.shakeTime = 0;
      combatFx.shakeDuration = 0;
      combatFx.shakeStrength = 0;
    }
  }
}

function currentHitShake() {
  if (combatFx.shakeTime <= 0 || combatFx.shakeDuration <= 0) return null;
  const fade = clamp(combatFx.shakeTime / combatFx.shakeDuration, 0, 1);
  const amp = combatFx.shakeStrength * fade * fade;
  const t = performance.now() * 0.028;
  return {
    x: (Math.sin(t * 1.9) + Math.sin(t * 3.7 + 1.1)) * 0.5 * amp,
    y: (Math.cos(t * 2.3 + 0.6) + Math.sin(t * 4.1 + 0.2)) * 0.5 * amp,
    yaw: Math.sin(t * 2.1 + 0.4) * amp * 0.22,
    pitch: Math.cos(t * 2.9 + 0.7) * amp * 0.18,
  };
}

const { MAT, buildLimboSkyDome } = createMaterialResources({
  textureLoader,
  renderer,
  rngFromSeed,
});

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

function addGroundedBeveledBox(parent, name, size, basePos, mat, cast = true, bevel = 0.06, bevelSegments = 2, options = {}) {
  const geo = anchorGeometryBottomCenter(makeBeveledBoxGeometry(size, bevel, bevelSegments));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(basePos[0] + batchBuildOffset.x, basePos[1] + batchBuildOffset.y, basePos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  if (options.physicsOptions) {
    registerPrimitivePhysicsBox(name, size, [basePos[0], basePos[1] + size[1] * 0.5, basePos[2]], options.physicsOptions || {});
  }
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

function addGroundedGeometry(parent, name, geometry, basePos, mat, cast = true) {
  const geo = anchorGeometryBottomCenter(applyWorldProjectedUvs(geometry, materialUvScale(mat)));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(basePos[0] + batchBuildOffset.x, basePos[1] + batchBuildOffset.y, basePos[2] + batchBuildOffset.z);
  mesh.castShadow = USE_DYNAMIC_SHADOWS && cast;
  mesh.receiveShadow = USE_DYNAMIC_SHADOWS;
  parent.add(mesh);
  return mesh;
}

function addGroundedTaperedCylinder(parent, name, topRadius, bottomRadius, depth, basePos, mat, radial = 6, cast = true) {
  return addGroundedGeometry(parent, name, new THREE.CylinderGeometry(topRadius, bottomRadius, depth, radial, 1, false), basePos, mat, cast);
}

function worldOffset() {
  const base = roomGroup?.position || new THREE.Vector3();
  return makeVec(base.x + batchBuildOffset.x, base.y + batchBuildOffset.y, base.z + batchBuildOffset.z);
}

function computeOrientedBounds(centerX, centerZ, sizeX, sizeZ, yaw, margin = 0) {
  const hx = sizeX * 0.5 + margin;
  const hz = sizeZ * 0.5 + margin;
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const extentX = c * hx + s * hz;
  const extentZ = s * hx + c * hz;
  return { minX: centerX - extentX, maxX: centerX + extentX, minZ: centerZ - extentZ, maxZ: centerZ + extentZ };
}

function toOrientedLocal(x, z, centerX, centerZ, yaw = 0) {
  const dx = x - centerX;
  const dz = z - centerZ;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function horizontalContainsShape(entry, x, z, margin = 0) {
  if (entry.shape === 'obb') {
    const local = toOrientedLocal(x, z, entry.centerX, entry.centerZ, entry.yaw || 0);
    return Math.abs(local.x) <= entry.sizeX * 0.5 - margin && Math.abs(local.z) <= entry.sizeZ * 0.5 - margin;
  }
  return x >= entry.minX + margin && x <= entry.maxX - margin && z >= entry.minZ + margin && z <= entry.maxZ - margin;
}

function registerWalkable(size, pos, margin = 0.12, options = {}) {
  if (rapierPlayerCollisionActive()) return;
  const offset = worldOffset();
  const centerX = pos[0] + offset.x;
  const centerY = pos[1] + offset.y;
  const centerZ = pos[2] + offset.z;
  const yaw = Number.isFinite(options.yaw) ? options.yaw : 0;
  const shape = options.shape === 'obb' ? 'obb' : 'aabb';
  const bounds = shape === 'obb'
    ? computeOrientedBounds(centerX, centerZ, size[0], size[2], yaw, 0)
    : { minX: centerX - size[0] / 2, maxX: centerX + size[0] / 2, minZ: centerZ - size[2] / 2, maxZ: centerZ + size[2] / 2 };
  walkableSurfaces.push({
    centerX,
    centerY,
    centerZ,
    sizeX: size[0],
    sizeY: size[1],
    sizeZ: size[2],
    minX: bounds.minX + margin,
    maxX: bounds.maxX - margin,
    minZ: bounds.minZ + margin,
    maxZ: bounds.maxZ - margin,
    topY: centerY + size[1] / 2,
    source: options.source || '',
    traversalCritical: !!options.traversalCritical,
    shape,
    yaw,
  });
}

function registerSolid(size, pos, margin = 0.0, options = {}) {
  const offset = worldOffset();
  const centerX = pos[0] + offset.x;
  const centerY = pos[1] + offset.y;
  const centerZ = pos[2] + offset.z;
  const yaw = Number.isFinite(options.yaw) ? options.yaw : 0;
  const shape = options.shape === 'obb' ? 'obb' : 'aabb';
  const bounds = shape === 'obb'
    ? computeOrientedBounds(centerX, centerZ, size[0], size[2], yaw, margin)
    : { minX: centerX - size[0] / 2 - margin, maxX: centerX + size[0] / 2 + margin, minZ: centerZ - size[2] / 2 - margin, maxZ: centerZ + size[2] / 2 + margin };
  if (!rapierPlayerCollisionActive()) {
    solidColliders.push({
      centerX,
      centerY,
      centerZ,
      sizeX: size[0],
      sizeY: size[1],
      sizeZ: size[2],
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: centerY - size[1] / 2,
      maxY: centerY + size[1] / 2,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ,
      stepHeight: Number.isFinite(options.stepHeight) ? options.stepHeight : 0,
      shape,
      yaw,
    });
  }
  roomState.physicsWorld?.addCuboid?.({
    size: [
      size[0] + margin * 2,
      size[1],
      size[2] + margin * 2,
    ],
    position: [centerX, centerY, centerZ],
    yaw,
    source: options.source || '',
    kind: options.kind || 'solid',
  });
}

function registerPrimitivePhysicsBox(name, size, pos, options = {}) {
  if (!roomState.physicsWorld || !size || !pos) return;
  if (!options.force) return;
  const sx = size[0] || 0;
  const sy = size[1] || 0;
  const sz = size[2] || 0;
  const minSize = Math.min(sx, sy, sz);
  const maxSize = Math.max(sx, sy, sz);
  const volume = sx * sy * sz;
  if (maxSize < 0.72 || minSize < 0.045 || volume < 0.08) return;
  const source = String(name || '');
  registerSolid(size, pos, options.margin ?? 0.015, {
    source,
    kind: options.kind || 'structure',
    yaw: options.yaw || 0,
    shape: options.yaw ? 'obb' : 'aabb',
  });
}

const meshSupportRaycaster = new THREE.Raycaster();
const DOWN_VECTOR = new THREE.Vector3(0, -1, 0);

function registerMeshSupportCollider(object, options = {}) {
  if (rapierPlayerCollisionActive()) return null;
  if (!object) return null;
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const collider = { object, bounds, source: options.source || '' };
  meshSupportColliders.push(collider);
  return collider;
}

function registerVoxelSupportCollider(field, options = {}) {
  if (rapierPlayerCollisionActive()) return null;
  if (!field) return null;
  const origin = options.origin || [0, 0, 0];
  const yaw = Number.isFinite(options.yaw) ? options.yaw : 0;
  const centerX = origin[0];
  const centerY = origin[1];
  const centerZ = origin[2];
  const minX = centerX + field.min.x;
  const maxX = centerX + field.max.x;
  const minY = centerY + field.min.y;
  const maxY = centerY + field.max.y;
  const minZ = centerZ + field.min.z;
  const maxZ = centerZ + field.max.z;
  const collider = { field, centerX, centerY, centerZ, yaw, minX, maxX, minY, maxY, minZ, maxZ, source: options.source || '' };
  voxelSupportColliders.push(collider);
  return collider;
}

function voxelLocalXZ(collider, x, z) {
  return toOrientedLocal(x, z, collider.centerX, collider.centerZ, collider.yaw || 0);
}

function resolveVoxelSupportHeight(x, z, feetY, velocityY, stepUp = SUPPORT_SNAP_UP, stepDown = SUPPORT_SNAP_DOWN, prevFeetY = feetY) {
  let best = null;
  stepDown = effectiveSupportStepDown(feetY, prevFeetY, stepDown);
  for (const collider of voxelSupportColliders) {
    if (feetY > collider.maxY + stepUp || feetY < collider.minY - stepDown) continue;
    if (x < collider.minX - PLAYER_SOLID_RADIUS || x > collider.maxX + PLAYER_SOLID_RADIUS) continue;
    if (z < collider.minZ - PLAYER_SOLID_RADIUS || z > collider.maxZ + PLAYER_SOLID_RADIUS) continue;
    const local = voxelLocalXZ(collider, x, z);
    const topLocalY = queryVoxelTopY(collider.field, local.x, local.z, PLAYER_SOLID_RADIUS);
    if (topLocalY == null) continue;
    const topY = collider.centerY + topLocalY;
    if (velocityY > 0.5 && feetY < topY - 0.14) continue;
    if (feetY > topY + stepUp) continue;
    if (feetY < topY - stepDown) continue;
    if (!best || topY > best.topY) best = { topY, collider };
  }
  return best;
}

function voxelBodyBlockedAt(x, z, minY, maxY, radius = ENEMY_SOLID_RADIUS) {
  for (const collider of voxelSupportColliders) {
    if (maxY < collider.minY || minY > collider.maxY) continue;
    if (x < collider.minX - radius || x > collider.maxX + radius) continue;
    if (z < collider.minZ - radius || z > collider.maxZ + radius) continue;
    const local = voxelLocalXZ(collider, x, z);
    const localMinY = minY - collider.centerY;
    const localMaxY = maxY - collider.centerY;
    if (queryVoxelIntersectsPrism(collider.field, local.x, local.z, localMinY, localMaxY, radius)) return true;
  }
  return false;
}

function addIslandArtBridge(name, from, to, width = 4.4, options = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.4) return null;
  const center = makeVec((from.x + to.x) * 0.5, (from.y + to.y) * 0.5, (from.z + to.z) * 0.5);
  const yaw = Math.atan2(dx, dz);
  const terrain = roomState.terrainLayer;
  if (!terrain) throw new Error('TerrainLayer is required before island-art connectors can be emitted');
  const thickness = options.thickness || 1.45;
  const bridgeSeed = hashRoomKey(name + ':' + Math.round(length * 10));
  return terrain.addBridgeSpan({
    id: name,
    length,
    width,
    thickness,
    origin: [center.x, center.y, center.z],
    yaw,
    slabBridge: options.slabBridge,
    material: options.material,
    rockGrammar: options.rockGrammar || 'imperial_floating_strata',
    rockSilhouette: options.rockSilhouette || 'rail_cut_causeway',
    imperialFunction: options.imperialFunction || 'imperial_causeway_logistics',
    seed: bridgeSeed,
    source: (options.source || name) + ':voxel',
  });
}

function addIslandArtSteppedRamp(name, from, to, options = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const side = makeVec(-dz / length, 0, dx / length);
  const seed = hashRoomKey(name + ':' + Math.round(length * 10));
  const rng = rngFromSeed(seed);
  const bendA = (rng() - 0.5) * 5.8;
  const bendB = (rng() - 0.5) * 6.4;
  const points = [
    from.clone(),
    makeVec(
      from.x + dx * 0.36 + side.x * bendA,
      from.y + (to.y - from.y) * 0.32,
      from.z + dz * 0.36 + side.z * bendA,
    ),
    makeVec(
      from.x + dx * 0.68 + side.x * bendB,
      from.y + (to.y - from.y) * 0.66,
      from.z + dz * 0.68 + side.z * bendB,
    ),
    to.clone(),
  ];
  for (let i = 0; i < points.length - 1; i += 1) {
    addIslandArtBridge(name + '-step-' + i, points[i], points[i + 1], options.width || 5.8, {
      material: options.material || MAT.sedimentaryRockDark,
      thickness: options.thickness || 1.55,
      source: (options.source || name) + ':step-' + i,
    });
  }
}

function registerClimbSurface(options) {
  if (!options?.center || !options?.normal) return null;
  const normal = options.normal.clone();
  normal.y = 0;
  if (normal.lengthSq() < 0.0001) return null;
  normal.normalize();
  const right = new THREE.Vector3(-normal.z, 0, normal.x);
  const center = options.center.clone ? options.center.clone() : makeVec(options.center.x, options.center.y || 0, options.center.z);
  const width = Math.max(CLIMB_MIN_TOP_SIZE, options.width || 1.2);
  const baseY = Number.isFinite(options.baseY) ? options.baseY : center.y;
  const topY = Math.max(baseY + CLIMB_MIN_HEIGHT, Number.isFinite(options.topY) ? options.topY : baseY + 2.2);
  const shelfDepth = Math.max(CLIMB_MIN_TOP_SIZE, options.topDepth || 1.18);
  const topCenter = options.topCenter?.clone ? options.topCenter.clone() : makeVec(center.x - normal.x * shelfDepth * 0.28, topY, center.z - normal.z * shelfDepth * 0.28);
  const surface = {
    center,
    normal,
    right,
    width,
    baseY,
    topY,
    topCenter,
    topWidth: Math.max(CLIMB_MIN_TOP_SIZE, options.topWidth || width * 0.92),
    topDepth: shelfDepth,
    attachDistance: Math.max(CLIMB_ATTACH_DISTANCE, options.attachDistance || CLIMB_ATTACH_DISTANCE),
    source: options.source || '',
  };
  climbSurfaces.push(surface);
  return surface;
}

function canStandOnClimbSurfaceTop(surface, x, z) {
  if (!surface) return false;
  const relX = x - surface.topCenter.x;
  const relZ = z - surface.topCenter.z;
  const across = relX * surface.right.x + relZ * surface.right.z;
  const inwardX = -surface.normal.x;
  const inwardZ = -surface.normal.z;
  const along = relX * inwardX + relZ * inwardZ;
  const halfWidth = Math.max(0.14, surface.topWidth * 0.5 - PLAYER_SOLID_RADIUS);
  const halfDepth = Math.max(0.14, surface.topDepth * 0.5 - PLAYER_SOLID_RADIUS);
  return Math.abs(across) <= halfWidth && Math.abs(along) <= halfDepth;
}

function addWallBox(parent, name, size, pos, mat, cast = false) {
  if (ISLAND_ART_ONLY) {
    return null;
  }
  const mesh = addBox(parent, name, size, pos, mat, cast);
  registerSolid(size, pos, 0.02, { source: name, kind: 'structure' });
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
  if (ISLAND_ART_ONLY) return;
  const height = 10;
  const openSides = options.openSides || new Set(['north', 'south', 'west', 'east']);
  const isOpen = (side) => openSides === 'all' || openSides.has?.(side);
  if (isOpen('north')) addPortalWall(parent, 'north-wall', depth / 2, width, height, mat); else addSealedPortal(parent, 'north-wall', 'north', width, depth, height, mat);
  if (isOpen('south')) addPortalWall(parent, 'south-wall', -depth / 2, width, height, mat); else addSealedPortal(parent, 'south-wall', 'south', width, depth, height, mat);
  if (isOpen('west')) addSidePortalWall(parent, 'west-wall', -width / 2, depth, height, mat); else addSealedPortal(parent, 'west-wall', 'west', width, depth, height, mat);
  if (isOpen('east')) addSidePortalWall(parent, 'east-wall', width / 2, depth, height, mat); else addSealedPortal(parent, 'east-wall', 'east', width, depth, height, mat);
  addCeilingFrame(parent, 'ceiling-frame', width, depth, mat);
}

function islandRouteDisplayMaterial(mat) {
  if (useControllerKataSlice()) return mat;
  if (!ISLAND_ART_ONLY) return mat;
  if (mat === MAT.bridge) return MAT.bridge;
  if (mat === MAT.exit) return MAT.bridge;
  if (mat === MAT.hazard || mat === MAT.bloodDark || mat === MAT.water) return MAT.islandRockDark;
  return MAT.islandRock;
}

function addWalkableBox(parent, name, size, pos, mat, cast = true, margin = 0.12, options = null) {
  const displayMat = islandRouteDisplayMaterial(mat);
  const physicsOptions = {
    source: options?.source || name,
    kind: 'walkable',
    margin: Math.max(0.01, margin * 0.25),
    force: true,
    yaw: options?.yaw || 0,
  };
  const mesh = addBeveledBox(parent, name, size, pos, displayMat, cast, 0.04, 1);
  registerPrimitivePhysicsBox(name, size, pos, physicsOptions);
  registerWalkable(size, pos, margin, options || {});
  return mesh;
}

function clearGroup(group) {
  while (group.children.length) group.remove(group.children[0]);
}

function disposeActiveTerrainLayer() {
  if (!roomState.terrainLayer) return;
  roomState.terrainLayer.dispose();
  roomState.terrainLayer = null;
}

function disposeActivePhysicsWorld() {
  if (!roomState.physicsWorld) return;
  roomState.physicsWorld.dispose();
  roomState.physicsWorld = null;
}

function createActivePhysicsWorld() {
  disposeActivePhysicsWorld();
  roomState.physicsWorld = createPhysicsWorld({
    gravity: { x: 0, y: -14.4, z: 0 },
    characterOffset: 0.035,
    autostepHeight: Math.min(0.62, SUPPORT_SNAP_UP),
    autostepMinWidth: PLAYER_SOLID_RADIUS * 1.7,
    snapToGround: 0.48,
  });
  return roomState.physicsWorld;
}

function createActiveTerrainLayer() {
  disposeActiveTerrainLayer();
  const layer = createTerrainLayer({
    MAT,
    hashRoomKey,
    debugMode: URL_PARAMS.get('terrain') || 'visual',
    physicsWorld: roomState.physicsWorld,
  });
  roomState.terrainLayer = layer;
  roomGroup.add(layer.group);
  return layer;
}

function resetWalkableBounds() {
  walkableSurfaces.length = 0;
  solidColliders.length = 0;
  meshSupportColliders.length = 0;
  voxelSupportColliders.length = 0;
  climbSurfaces.length = 0;
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

function normalizeDistrictTarget(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
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

function districtMatchesBootTarget(district, target) {
  const normalizedTarget = normalizeDistrictTarget(target);
  if (!normalizedTarget || !district) return false;
  const candidates = [
    district.archetype,
    district.id,
    district.name,
    district.skeletonType,
    district.macroTemplateId,
    district.landmarkRole,
  ];
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeDistrictTarget(candidate);
    return normalizedCandidate && (normalizedCandidate === normalizedTarget || normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate));
  });
}

function findBootDistrictStart(target, startLevel = roomState.levelIndex, maxLevels = 32) {
  const normalizedTarget = normalizeDistrictTarget(target);
  if (!normalizedTarget) return null;
  for (let offset = 0; offset < maxLevels; offset += 1) {
    const levelIndex = Math.max(0, startLevel + offset);
    const plan = generateDistrictPlan(levelIndex);
    const districtIndex = plan.districts.findIndex((district) => districtMatchesBootTarget(district, normalizedTarget));
    if (districtIndex >= 0) {
      const district = plan.districts[districtIndex];
      return {
        levelIndex,
        districtIndex,
        roomIndex: district.roomStart,
      };
    }
  }
  return null;
}

function applyBootNavigationTarget() {
  if (bootLevelTarget !== null) {
    roomState.levelIndex = bootLevelTarget;
    setLevelIndex(roomState.levelIndex);
    roomState.districtPlan = null;
  }
  if (bootDistrictTarget) {
    const target = findBootDistrictStart(bootDistrictTarget, roomState.levelIndex);
    if (target) {
      roomState.levelIndex = target.levelIndex;
      roomState.nodeIndex = target.roomIndex;
      roomState.districtPlan = null;
      setLevelIndex(roomState.levelIndex);
      setNodeIndex(roomState.nodeIndex);
      return;
    }
    console.warn('boot district target not found', bootDistrictTarget);
  }
  if (bootParams.has('room')) {
    const roomIndex = clamp(Number(bootParams.get('room') || 1) - 1, 0, playableRoomCount() - 1);
    roomState.nodeIndex = Math.floor(roomIndex);
    setNodeIndex(roomState.nodeIndex);
  }
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
  if (ISLAND_ART_ONLY) return null;
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
  if (ISLAND_ART_ONLY) return null;
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
  enemy.userData.attackDefKey = '';
  enemy.userData.attackDef = null;
  enemy.userData.attackPrevHand = null;
  enemy.userData.attackCurrentHand = null;
  enemy.userData.attackContactPoint = null;
  enemy.userData.attackBones = {};
  enemy.userData.mode = 'approach';
  enemy.userData.modeTimer = 0;
  enemy.userData.commitTimer = ENEMY_COMMIT_INTERVAL * 0.55;
  enemy.userData.commitElapsed = 0;
  enemy.userData.orbitSign = enemy.userData.orbitSign || 1;
  enemy.userData.pursuitStall = 0;
  enemy.userData.lastHitReaction = '';
  enemy.userData.lastHitZone = '';
  enemy.userData.lastHitLocalX = 0;
  enemy.userData.lastHitLocalY = 0;
  enemy.userData.dissolveProgress = 0;
  resetEnemyDissolve();
  resetEnemyDeathState();
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
  registerSolid([2.9, 10.5, 2.9], [0, 4.8, 0.2], 0.08, { source: 'spire-core', kind: 'structure' });
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
const ORC_BERSERKER_PBR = {
  textures: {
    baseColor: 'assets/models/orc_berserker/Meshy_AI_Orc_Berserker_0609121503_texture.png',
    normal: 'assets/models/orc_berserker/Meshy_AI_Orc_Berserker_0609121503_texture_normal.png',
    roughness: 'assets/models/orc_berserker/Meshy_AI_Orc_Berserker_0609121503_texture_roughness.png',
    metallic: 'assets/models/orc_berserker/Meshy_AI_Orc_Berserker_0609121503_texture_metallic.png',
  },
  materialOptions: { roughness: 0.46, metalness: 0.18, normalScale: 0.18, emissiveIntensity: 0, envMapIntensity: 1.0 },
};
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
  reactBodyCenter: 'assets/models/orc_berserker/react_body_center.poseclip.json',
  reactHeadLeft: 'assets/models/orc_berserker/react_head_left_turn.poseclip.json',
  reactHeadRight: 'assets/models/orc_berserker/react_head_right.poseclip.json',
  dying: 'assets/models/orc_berserker/mutant_dying.fbx',
};
const ENEMY_HIT_HEAD_SIDE_THRESHOLD = 0.12;
const ENEMY_HIT_HEAD_NORMALIZED_Y = 0.64;
const ENEMY_PLAYER_COLLISION_VERTICAL_GRACE = 0.18;
const ENEMY_DEATH_DESPAWN_DELAY = 10.0;
const ENEMY_DEATH_LAUNCH_SPEED = 4.45;
const ENEMY_DEATH_UPWARD_SPEED = 3.7;
const ENEMY_RAGDOLL_GRAVITY = 17.5;
const ENEMY_RAGDOLL_DRAG = 0.985;
const ENEMY_RAGDOLL_GROUNDED_DRAG = 0.82;
const ENEMY_RAGDOLL_FLOOR_BOUNCE = 0.04;
const ENEMY_RAGDOLL_FLOOR_FRICTION = 0.22;
const ENEMY_RAGDOLL_FLOOR_IMPACT_FRICTION = 0.1;
const ENEMY_RAGDOLL_FLOOR_IMPACT_BOUNCE = 0.008;
const ENEMY_RAGDOLL_DECAY_DELAY = 0.52;
const ENEMY_RAGDOLL_DECAY_DURATION = 1.35;
const ENEMY_RAGDOLL_FORCE_SETTLE_TIME = 1.75;
const ENEMY_RAGDOLL_SETTLE_ENTRY_DAMPING = 0.14;
const ENEMY_RAGDOLL_SETTLE_CORE_DAMPING = 0.03;
const ENEMY_RAGDOLL_SETTLE_AIR_DAMPING = 0.22;
const ENEMY_RAGDOLL_SETTLE_SPEED_SQ = 0.006;
const ENEMY_RAGDOLL_SUBSTEPS = 2;
const ENEMY_RAGDOLL_ITERATIONS = 6;
const ENEMY_RAGDOLL_SELF_COLLISION_SCALE = 0.72;
const ENEMY_RAGDOLL_SELF_COLLISION_STIFFNESS = 0.72;
const ENEMY_RAGDOLL_SELF_COLLISION_GROUNDED_STIFFNESS = 0.38;
const ENEMY_RAGDOLL_SELF_COLLISION_VERTICAL_SCALE = 0.16;
const ENEMY_RAGDOLL_SELF_COLLISION_MAX_PUSH = 0.08;
const ENEMY_DISSOLVE_VORONOI_SCALE = 7.4;
const ENEMY_DISSOLVE_EDGE_WIDTH = 0.14;
const ENEMY_DISSOLVE_EDGE_INTENSITY = 2.4;
const ENEMY_DISSOLVE_EDGE_COLOR = new THREE.Color(0xff6b1a);
const ENEMY_DISSOLVE_SHARD_COUNT = 22;
const ENEMY_DISSOLVE_SHARD_DRIFT = 0.82;
const ENEMY_DISSOLVE_SHARD_RISE = 0.58;
const ENEMY_RING_RADIUS = 4.0;
const ENEMY_RING_TOLERANCE = 0.45;
const ENEMY_ATTACK_RANGE = 1.55;
const ENEMY_ATTACK_WINDUP = 0.24;
const ENEMY_ATTACK_ACTIVE_END = 0.46;
const ENEMY_ATTACK_RECOVERY = 0.78;
const ENEMY_ATTACK_COOLDOWN = 1.15;
const ENEMY_ATTACK_SWEEP_PLAYER_SAMPLES = 7;
const ENEMY_ATTACK_DEBUG_LIFETIME = 0.9;
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
const ENEMY_PLAYER_COLLISION_RADIUS = PLAYER_SOLID_RADIUS + ENEMY_CAPSULE_RADIUS + 0.04;
const ENEMY_PLAYER_COLLISION_RADIUS_SQ = ENEMY_PLAYER_COLLISION_RADIUS * ENEMY_PLAYER_COLLISION_RADIUS;
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
const ENEMY_ATTACK_DEFS = {
  attackHorizontal: {
    handAliases: ['mixamorig:RightHand', 'RightHand', 'mixamorig:RightForeArm', 'RightForeArm'],
    activeStartTime: 0.69,
    activeEndTime: 0.85,
    lungeStartNorm: 0.0,
    lungeDuration: 0.1,
    sweepHalfExtents: new THREE.Vector3(0.28, 0.26, 0.18),
    sweepRangePadding: 0.3,
    damage: 1,
    knockback: 1.65,
    fallbackOffset: new THREE.Vector3(0.78, 1.22, 0.1),
  },
};
let enemy = null;
const enemyRuntime = {
  primitiveVisual: null,
  model: null,
  mixer: null,
  currentAction: null,
  actions: new Map(),
};
let enemyRagdollDebugGroup = null;
let enemyRagdollDebugPoints = [];
let enemyRagdollDebugLines = [];

const enemyCombat = createEnemyCombatApi({
  runtime: enemyRuntime,
  getEnemy: () => enemy,
  player,
  input,
  attackDebug,
  getHurtAction: () => hurtAction,
  cameraAimDirection,
  fallbackEnemyHitBox,
  findBoneByAliases,
  clamp,
  makeVec,
  isEnemyCorpseActive,
  getEnemyNavState,
  enemyCombatGoalPoint,
  findNearestGauntletRoomIndex,
  clearEnemyRoute,
  rebuildEnemyRoute,
  advanceEnemyJump,
  findEnemySupport,
  enemyHasDirectCombatPath,
  shiftEnemyRouteWaypoint,
  sampleEnemyMoveSupport,
  enemyCanJumpBetween,
  startEnemyJump,
  applyEnemyMove,
  setEnemyMode,
  spawnEnemyAttackSweepDebug,
  updateEnemyRagdollDeath,
  despawnEnemyCorpse,
  startEnemyDeath,
  triggerHitJuice,
  setStatus,
  playArmAction,
  playThud,
  constants: {
    ENEMY_ATTACK_DEFS,
    ENEMY_ATTACK_RECOVERY,
    ENEMY_ATTACK_WINDUP,
    ENEMY_ATTACK_ACTIVE_END,
    ENEMY_ATTACK_COOLDOWN,
    ENEMY_ATTACK_RANGE,
    ENEMY_ATTACK_SWEEP_PLAYER_SAMPLES,
    ENEMY_LUNGE_SPEED,
    ENEMY_RETREAT_DURATION,
    ENEMY_RETREAT_SPEED,
    ENEMY_RUN_SPEED,
    ENEMY_WALK_SPEED,
    ENEMY_SIDESTEP_SPEED,
    ENEMY_RING_RADIUS,
    ENEMY_RING_TOLERANCE,
    ENEMY_COMMIT_TIMEOUT,
    ENEMY_NAV_REPATH_INTERVAL,
    ENEMY_NAV_STALL_LIMIT,
    ENEMY_STEP_UP,
    ENEMY_STEP_DOWN,
    ENEMY_AI_SLEEP_DISTANCE,
    ENEMY_AI_WAKE_DISTANCE,
    ENEMY_AI_SLEEP_ROOM_DELTA,
    ENEMY_AI_WAKE_ROOM_DELTA,
    ENEMY_HIT_HEAD_SIDE_THRESHOLD,
    ENEMY_HIT_HEAD_NORMALIZED_Y,
    PLAYER_EYE_HEIGHT,
    PLAYER_SOLID_RADIUS,
    PLAYER_MAX_HEALTH,
    ATTACK_LAB,
    DEBUG_ATTACK_SWEEP,
  },
});
const {
  chooseEnemyHitReaction,
  playEnemyAction,
  updateEnemyMixer,
  getEnemyAttackDefinition,
  resolveEnemyAttackHandBone,
  sampleEnemyAttackHandWorld,
  getPlayerDamageCapsule,
  segmentSegmentDistanceSq,
  sweepEnemyAttackHitsPlayer,
  applyEnemyAttackHit,
  startEnemyAttack,
  updateEnemyEngagement,
  updateAttack,
} = enemyCombat;

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
    return addWalkableTopBox(parent, name, [Math.max(0.4, lenX + 0.64), routeWidth], center, topY, mat, 0.12, 0.045);
  }
  const center = makeVec((startX + endX) * 0.5, topY, (startZ + endZ) * 0.5);
  addBrokenRouteRails(parent, name, a, b, topY, routeWidth);
  return addWalkableTopBox(parent, name, [routeWidth, Math.max(0.4, lenZ + 0.64)], center, topY, mat, 0.12, 0.045);
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
    addWalkableTopBox(parent, prefix + '-tread-' + i, size, makeVec(x, topY, z), topY, mat, 0.1, 0.045);
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
    }
  }
  addBatchRouteSegment(parent, prefix + '-base-join', a, b, Math.min(startTop, endTop) + 0.025, 4.2, MAT.connectorFloor, 1.65);
}

function addBatchShell(parent, spec, width, depth, height) {
  if (ISLAND_ART_ONLY) return;

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
  if (ISLAND_ART_ONLY) return;

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
  if (ISLAND_ART_ONLY) return;

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
  if (ISLAND_ART_ONLY) return;

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

  if (ISLAND_ART_ONLY) {
    const sockets = {};
    for (const connector of shellConnectors) {
      const point = connectorPoint(connector, width, depth, 0.34, 4.6);
      sockets[connector] = makeVec(point.x, point.y + PLAYER_EYE_HEIGHT, point.z);
    }
    return {
      spawn: makeVec(start.x, start.y + PLAYER_EYE_HEIGHT, start.z),
      exit: makeVec(exit.x, exit.y + PLAYER_EYE_HEIGHT, exit.z),
      sockets,
      exitRadius: 2.15,
      enemyPositions: [makeVec(center.x, center.y, center.z), makeVec(exit.x, exit.y, exit.z)],
      bounds: { minX: -width * 0.5 + 0.7, maxX: width * 0.5 - 0.7, minZ: -depth * 0.5 + 0.7, maxZ: depth * 0.5 - 0.7 },
    };
  }

  addBatchVoidBoundary(roomGroup, spec, width, depth, height, shellConnectors);

  // Build a carved chamber footprint first; pads and route pieces sit on top of this outline.
  addBatchCarvedChamberFloor(roomGroup, spec, width, depth, height, shellConnectors, { index, wantsCorner, wantsHub });
  addWalkableTopBox(roomGroup, 'batch-entry-pad', [7.2, 5.4], start, start.y, MAT.platform, 0.08, 0.06, { source: 'batch-entry-pad', traversalCritical: true });
  addWalkableTopBox(roomGroup, 'batch-exit-pad', [7.4, 5.4], exit, exit.y, MAT.platform, 0.08, 0.06, { source: 'batch-exit-pad', traversalCritical: true });

  // A narrow visual gutter gives movement focus without creating the giant side void from build 0.8.1.
  if (wantsRiskLine && !ISLAND_ART_ONLY) {
    const gutterAlongX = Math.abs(exit.x - start.x) > Math.abs(exit.z - start.z);
    const gutterSize = gutterAlongX ? [Math.max(8, width * 0.46), 1.25] : [1.25, Math.max(8, depth * 0.46)];
    addBeveledBox(roomGroup, 'batch-narrow-hazard-gutter', [gutterSize[0], 0.05, gutterSize[1]], [0, 0.035, 0], role.includes('hazard') ? MAT.hazard : MAT.bloodDark, false, 0.01, 1);
  }

  const midA = makeVec((start.x * 0.58 + exit.x * 0.42), Math.max(start.y + 0.08, 0.32), (start.z * 0.58 + exit.z * 0.42));
  const midB = makeVec((start.x * 0.30 + exit.x * 0.70), Math.max(exit.y + 0.06, 0.36), (start.z * 0.30 + exit.z * 0.70));

  if (wantsCorner) {
    const bendSide = terminalExitConnector === 'E' || spawnConnector === 'E' ? 1 : -1;
    const bend = makeVec(bendSide * width * 0.26, Math.max(0.36, (start.y + exit.y) * 0.5 + 0.08), (start.z + exit.z) * 0.18);
    addWalkableTopBox(roomGroup, 'batch-corner-route-a', [5.2, 4.0], bend, bend.y, MAT.platform, 0.08, 0.04, { source: 'batch-corner-route-a', traversalCritical: true });
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

    addWalkableTopBox(roomGroup, 'batch-descent-upper-run', routeAlongX ? [Math.max(6.2, width * 0.26), 4.2] : [4.2, Math.max(6.2, depth * 0.26)], upperRun, upperRun.y, MAT.bridge, 0.08, 0.04, { source: 'batch-descent-upper-run', traversalCritical: true });
    addWalkableTopBox(roomGroup, 'batch-descent-lower-terrace', routeAlongX ? [Math.max(6.6, width * 0.32), 5.0] : [5.0, Math.max(6.6, depth * 0.32)], lowerTerrace, lowerTerrace.y, MAT.platform, 0.08, 0.05, { source: 'batch-descent-lower-terrace', traversalCritical: true });
    addBeveledBox(roomGroup, 'batch-descent-void-cut', [voidSize[0], 0.18, voidSize[1]], [voidCenter.x, 0.08, voidCenter.z], MAT.void, false, 0.01, 1);

    addBatchRouteSegment(roomGroup, 'batch-descent-entry-link', start, upperRun, upperRun.y + 0.04, 2.6, MAT.platform, 2.65);
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
    addBatchRouteSegment(roomGroup, 'batch-upper-entry-link', start, midA, midA.y + 0.035, 2.8, MAT.platform, 2.65);
    addBatchStairRun(roomGroup, 'batch-measured-rise', midA, midB, midA.y, Math.max(midA.y + 0.38, exit.y + 0.04), MAT.platform);
    addBatchRouteSegment(roomGroup, 'batch-upper-exit-link', midB, exit, Math.max(0.46, exit.y + 0.08), 2.8, MAT.bridge, 2.65);
  } else {
    addBatchRouteSegment(roomGroup, 'batch-low-route-link-a', start, midA, midA.y + 0.035, 2.6, MAT.platform, 2.65);
    addBatchRouteSegment(roomGroup, 'batch-low-route-link-b', midB, exit, Math.max(midB.y + 0.06, exit.y + 0.08), 2.6, MAT.platform, 2.65);
  }

  if (!isDescentRoom && (hasLower || role.includes('recovery') || role.includes('secret'))) {
    const side = Math.abs(start.x) < 1 ? (index % 2 ? 1 : -1) : -Math.sign(start.x);
    const low = makeVec(side * width * 0.30, 0.24, 0);
    addWalkableTopBox(roomGroup, 'batch-side-recovery-floor', [4.6, Math.max(7.0, depth * 0.34)], low, low.y, MAT.connectorFloor, 0.08, 0.05, { source: 'batch-side-recovery-floor', traversalCritical: true });
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
      addWalkableTopBox(roomGroup, 'batch-side-branch-' + i, [5.2, 4.2], point, point.y, i % 2 ? MAT.bridge : MAT.connectorFloor, 0.08, 0.05, { source: 'batch-side-branch-' + i, traversalCritical: true });
      addBatchRouteSegment(roomGroup, 'batch-side-branch-link-' + i, center, point, Math.max(0.34, branchTop + 0.09), 2.4, MAT.connectorFloor, 2.65);
      addBatchConnectorLandmark(roomGroup, 'batch-side-connector-' + i, point, c, 'side', branchTop);
    }
  }

  if (klass.startsWith('4c')) {
    addBeveledBox(roomGroup, 'batch-hub-central-landmark', [2.1, 2.6, 1.8], [0, 1.3, 0], MAT.connectorWall, true, 0.04, 1);
  }

  if (wantsCombat && !wantsCorner) {
    addBeveledBox(roomGroup, 'batch-combat-route-mass', [1.8, 2.1, 1.3], [center.x, 1.05, center.z], MAT.connectorWall, true, 0.04, 1);
    addWalkableTopBox(roomGroup, 'batch-combat-route-mass-top', [1.5, 1.02], center, 2.1, MAT.connectorFloor, 0.08, 0.04);
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
  const count = playableRoomCount();
  const index = ((roomState.nodeIndex % count) + count) % count;
  roomState.nodeIndex = index;
  return GENERATED_ROOM_BATCH[index];
}

function playableRoomCount() {
  return Math.max(1, Math.min(PLAYABLE_SLICE_ROOM_COUNT, GENERATED_ROOM_BATCH.length));
}

function playableRoomSpecs() {
  return GENERATED_ROOM_BATCH.slice(0, playableRoomCount());
}

function activeRoomSpecs() {
  return roomState.sliceSpecs || playableRoomSpecs();
}

function useControllerKataSlice() {
  return ACTIVE_SLICE === 'controller_kata';
}

function useQuakeM1E1Slice() {
  return ACTIVE_SLICE === 'quake_m1e1';
}

function useCarvedVoxelFortressSlice() {
  return ACTIVE_SLICE === 'carved_voxel_fortress';
}

function playableRoomSpec(index) {
  return GENERATED_ROOM_BATCH[clamp(index, 0, playableRoomCount() - 1)] || GENERATED_ROOM_BATCH[0];
}

const districtStory = createDistrictStoryApi({
  makeVec,
  rngFromSeed,
  hashRoomKey,
  snapEnemyPointToSupport,
});

const {
  buildDistrictStoryPlacementCandidates,
  buildDistrictStoryPlacements,
  buildDistrictValidationSummary,
  buildDistrictDesignContract,
} = districtStory;

function generateDistrictPlan(levelIndex) {
  const totalRooms = playableRoomCount();
  const seed = buildLevelSeed(levelIndex) ^ 0x5f3759df;
  const rng = rngFromSeed(seed);
  const archetypes = [DISTRICT_ARCHETYPES.intake, DISTRICT_ARCHETYPES.scaffolds, DISTRICT_ARCHETYPES.shrine];
  const counts = [1, 1, 1];
  const templates = archetypes.map((archetype) => applyDefaultArchitecturalFamily(archetype, DISTRICT_ARCHETYPE_TEMPLATES[archetype.id] || DISTRICT_MACRO_TEMPLATES.intake));
  const sliceOrigins = [
    makeVec((rng() - 0.5) * 5.0, 0.0, (rng() - 0.5) * 3.0),
    makeVec(15.0 + (rng() - 0.5) * 5.5, 5.4 + rng() * 0.9, 23.0 + (rng() - 0.5) * 4.5),
    makeVec(-8.0 + (rng() - 0.5) * 5.8, 11.8 + rng() * 1.1, 47.0 + (rng() - 0.5) * 5.0),
  ];
  const sliceNodeConfigs = [
    {
      name: 'Cistern Customs Terrace',
      purpose: 'sort arrivals beside poisoned water measures and hidden household routes',
      role: 'retaining_gate',
      segmentRole: 'support_stair',
      size: [30, 11, 26],
      sourceA: 'intake terraces',
      sourceB: 'bridge customs',
      storyPilotId: 'hanging_gardens_absent_people_01',
      storyPlacementSet: 'hg_market_intake_nooks',
      silhouetteRule: 'low intake shelf cut into an organic cistern rock',
      terrainSilhouette: 'fortress_plateau',
      terrainFunction: 'imperial_core_retaining_gate',
      architectureContract: 'spawn_cistern_customs',
      placeArchetype: 'Cistern Customs Terrace',
      stoneForm: 'carved retaining-gate shelf',
      requiredStructuralReads: ['retainingGate', 'cisternCourt', 'stairRoute', 'supportLanguage', 'edgeTreatment'],
    },
    {
      name: 'Graft Market Crown',
      purpose: 'hold a compressed garden market where repair benches and graft tables replaced public stalls',
      role: 'bath_court',
      segmentRole: 'market_court',
      size: [35, 13, 30],
      sourceA: 'hanging market',
      sourceB: 'terrace households',
      storyPilotId: 'hanging_gardens_absent_people_01',
      storyPlacementSet: 'hg_market_intake_nooks',
      silhouetteRule: 'middle crown terrace with flat build pads and broken garden lips',
      terrainSilhouette: 'foundry_shelf',
      terrainFunction: 'suspended_foundry_logistics',
    },
    {
      name: 'Witness Cistern Stair',
      purpose: 'preserve silent bell law around the sealed route hope',
      role: 'aqueduct_remnant',
      segmentRole: 'roof_lane',
      size: [28, 12, 27],
      sourceA: 'shrine rim',
      sourceB: 'sealed cistern stair',
      storyPilotId: 'hanging_gardens_absent_people_02',
      storyPlacementSet: 'hg_shrine_rim_nooks',
      silhouetteRule: 'upper witness shelf pitched off-axis above the market crown',
      terrainSilhouette: 'artillery_crown',
      terrainFunction: 'battery_terrace_command_road',
    },
  ];
  const districts = [];
  const roomToDistrict = new Array(totalRooms).fill(0);
  let roomStart = 0;

  for (let i = 0; i < archetypes.length; i += 1) {
    const archetype = archetypes[i];
    const template = templates[i];
    const layout = pickDistrictLayout(template, rng, { pick });
    const roomCount = counts[i];
    const sliceConfig = sliceNodeConfigs[i];
    const origin = sliceOrigins[i];
    const baseElevation = origin.y;
    const topElevation = baseElevation + sliceConfig.size[1] * 0.58;
    const yaw = (rng() - 0.5) * 0.52 + i * 0.17;
    const islandCenterY = baseElevation - sliceConfig.size[1] * 0.34;
    const islandTopRel = sliceConfig.size[1] * 0.38;
    const district = {
      index: i,
      id: archetype.id + '-' + (i + 1),
      archetype: archetype.id,
      name: sliceConfig.name,
      purpose: sliceConfig.purpose,
      signal: archetype.signal,
      roomStart,
      roomCount,
      origin,
      baseElevation,
      topElevation,
      elevationBand: i === 0 ? 'low_terrace' : i === 1 ? 'middle_terrace' : 'upper_terrace',
      macroTemplateId: template.id,
      approachType: template.approachType,
      departureType: template.departureType,
      supportStyle: template.supportStyle,
      landmarkRole: template.landmarkRole,
      requiresVisibleBelow: template.requiresVisibleBelow,
      requiresVisibleAbove: template.requiresVisibleAbove,
      layoutId: layout.id,
      layoutPoints: layout.points,
      branchPairs: [],
      preferredRoles: [...archetype.preferredRoles],
      realSourceA: sliceConfig.sourceA,
      realSourceB: sliceConfig.sourceB,
      skeletonType: 'carved_imperial_structure',
      terrainMode: 'carved_imperial_structure',
      patchStyle: 'rough_hewn_imperial_carving',
      structureSize: [40, 12, 50],
      silhouetteRule: sliceConfig.silhouetteRule,
      storyPilotId: sliceConfig.storyPilotId,
      storyPlacementSet: sliceConfig.storyPlacementSet,
      architectureContract: sliceConfig.architectureContract || null,
      placeArchetype: sliceConfig.placeArchetype || null,
      stoneForm: sliceConfig.stoneForm || null,
      requiredStructuralReads: sliceConfig.requiredStructuralReads ? [...sliceConfig.requiredStructuralReads] : [],
    };
    Object.assign(district, {
      roomOffsets: [[0, 0, islandTopRel - 0.34]],
      segmentRoles: [sliceConfig.segmentRole],
      circulationBands: [
        { id: 'lower_lip', y: baseElevation - 1.0, role: 'recovery_edge' },
        { id: 'build_terrace', y: baseElevation + 0.1, role: sliceConfig.segmentRole },
        { id: 'upper_lip', y: baseElevation + 2.6, role: 'future_read' },
      ],
      massAnchors: [{
        id: 'terraced_node',
        role: sliceConfig.role,
        pos: [origin.x, islandCenterY, origin.z],
        size: sliceConfig.size,
        yaw,
        terraced: true,
        rockGrammar: 'carved_imperial_structure',
        rockSilhouette: sliceConfig.terrainSilhouette,
        imperialFunction: sliceConfig.terrainFunction,
      }],
      landmarkAnchor: { x: origin.x, y: baseElevation + 2.6, z: origin.z, role: sliceConfig.role },
    });
    Object.assign(district, buildDistrictDesignContract(district));
    district.storyNookPlacements = buildDistrictStoryPlacements(district);
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
  const safeIndex = clamp(index, 0, playableRoomCount() - 1);
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
  const spec = playableRoomSpec(index) || {};
  const text = [spec.id, spec.junction_class, spec.semantic_role, ...(spec.route_sentence || [])].join(' ');
  return /3c|4c|hub|junction|secret|shortcut|return|loop|reward|key|switch/.test(text);
}

function buildDistrictBranchLinks(plan = roomState.districtPlan || ensureDistrictPlan()) {
  const links = [];
  for (const district of plan.districts) {
    for (const [fromLocal, toLocal] of district.branchPairs) {
      const a = district.roomStart + fromLocal;
      const b = district.roomStart + toLocal;
      if (a >= playableRoomCount() || b >= playableRoomCount()) continue;
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
  const heightDelta = Math.abs(toTop - fromTop);

  if (ISLAND_ART_ONLY) {
    if (heightDelta > 0.28) {
      addIslandArtSteppedRamp('carved-causeway-' + index + '-rise', fromRun, toRun, {
        width: options.branch ? 5.2 : 6.4,
        thickness: 1.75,
        material: MAT.sedimentaryRockDark,
        source: 'carved-causeway-' + index,
      });
    } else {
      addIslandArtBridge('carved-causeway-' + index, fromRun, toRun, options.branch ? 5.2 : 6.4, {
        thickness: 1.75,
        material: MAT.sedimentaryRockDark,
        source: 'carved-causeway-' + index,
      });
    }
    return;
  }

  const corner = Math.abs(dx) > Math.abs(dz)
    ? makeVec(toRun.x, fromRun.y, fromRun.z)
    : makeVec(fromRun.x, fromRun.y, toRun.z);
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

function playerBlockedInBand(x, z, minY, maxY, radius) {
  for (const solid of solidColliders) {
    if (maxY < solid.minY || minY > solid.maxY) continue;
    if (!horizontalContainsShape(solid, x, z, radius)) continue;
    return true;
  }
  return voxelBodyBlockedAt(x, z, minY, maxY, radius);
}

function playerBodyBlockedAtPosition(x, z, positionY) {
  const radius = PLAYER_SOLID_RADIUS;
  const minY = positionY - PLAYER_EYE_HEIGHT + 0.15;
  const maxY = positionY + 0.35;
  return playerBlockedInBand(x, z, minY, maxY, radius);
}

function playerTorsoBlockedAtPosition(x, z, positionY) {
  const radius = PLAYER_SOLID_RADIUS * 0.92;
  const minY = positionY - PLAYER_EYE_HEIGHT + 0.58;
  const maxY = positionY + 0.30;
  return playerBlockedInBand(x, z, minY, maxY, radius);
}

function measurePlayerHeadroomAtPosition(x, z, positionY, maxProbe = 2.4) {
  const radius = PLAYER_SOLID_RADIUS * 0.84;
  const step = 0.18;
  let clearance = 0;
  for (let offset = step; offset <= maxProbe + 0.0001; offset += step) {
    if (playerBlockedInBand(x, z, positionY + 0.08, positionY + offset, radius)) return clearance;
    clearance = offset;
  }
  return maxProbe;
}

function supportAtPlayerFeet(x, z, feetY) {
  return resolveSupportHeight(x, z, feetY, 0, feetY) || resolveSolidTopSupport(x, z, feetY, 0, feetY);
}

function findMantleTopSupport(x, z, targetTopY) {
  const support = resolveSupportHeight(x, z, targetTopY + 0.18, 0, targetTopY + 0.18)
    || resolveSolidTopSupport(x, z, targetTopY + 0.18, 0, targetTopY + 0.18);
  if (!support) return null;
  if (Math.abs(support.topY - targetTopY) > 0.95) return null;
  const eyeY = support.topY + PLAYER_EYE_HEIGHT;
  if (playerBodyBlockedAtPosition(x, z, eyeY)) return null;
  return support;
}

function evaluatePlayerAnchorCandidate(x, z, baseFeetY) {
  return evaluateSpawnAnchorCandidate({
    x,
    z,
    baseFeetY,
    eyeHeight: PLAYER_EYE_HEIGHT,
    solidRadius: PLAYER_SOLID_RADIUS,
    supportAtFeet: supportAtPlayerFeet,
    isTorsoBlocked: playerTorsoBlockedAtPosition,
    measureHeadroom: measurePlayerHeadroomAtPosition,
  });
}

function findClearPlayerAnchor(point, lookTarget = null) {
  if (!point) return null;
  const candidate = findBestSpawnAnchor({
    point,
    lookTarget,
    eyeHeight: PLAYER_EYE_HEIGHT,
    solidRadius: PLAYER_SOLID_RADIUS,
    supportAtFeet: supportAtPlayerFeet,
    isTorsoBlocked: playerTorsoBlockedAtPosition,
    measureHeadroom: measurePlayerHeadroomAtPosition,
  });
  return candidate ? makeVec(candidate.x, candidate.y, candidate.z) : point.clone();
}

function findRoomIslandVoxelCollider(districtId, localIndex) {
  const source = 'district-room-island-voxel:' + districtId + ':' + localIndex;
  return roomState.terrainLayer?.colliderBySource(source) || voxelSupportColliders.find((collider) => collider.source === source) || null;
}

function voxelLocalToWorld(collider, localX, localY, localZ) {
  const terrainWorld = roomState.terrainLayer?.localToWorld?.(collider, localX, localY, localZ);
  if (terrainWorld) return terrainWorld;
  const yaw = collider.yaw || 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return makeVec(
    collider.centerX + localX * c + localZ * s,
    collider.centerY + localY,
    collider.centerZ - localX * s + localZ * c,
  );
}

function findRoomIslandSpawnAnchor(districtId, localIndex, fallbackPoint, lookTarget = null) {
  const district = roomState.districtPlan?.districts?.find((entry) => entry.id === districtId);
  if (district?.index === 0 && localIndex === 0 && district.spawnBuildingPlan?.rooms?.length) {
    const arrival = district.spawnBuildingPlan.rooms.find((room) => room.id === 'arrival_cut') || district.spawnBuildingPlan.rooms[0];
    const planned = makeVec(arrival.center[0], arrival.topY + PLAYER_EYE_HEIGHT, arrival.center[1]);
    return findClearPlayerAnchor(planned, lookTarget);
  }
  const collider = findRoomIslandVoxelCollider(districtId, localIndex);
  if (!collider) return findClearPlayerAnchor(fallbackPoint, lookTarget);
  const field = collider.field;
  const fallback = fallbackPoint || makeVec(collider.centerX, collider.centerY + PLAYER_EYE_HEIGHT, collider.centerZ);
  let best = null;
  const step = Math.max(field.cell * 0.72, 0.34);
  for (let localZ = field.min.z; localZ <= field.max.z; localZ += step) {
    for (let localX = field.min.x; localX <= field.max.x; localX += step) {
      const topLocalY = queryVoxelTopY(field, localX, localZ, PLAYER_SOLID_RADIUS);
      if (topLocalY == null) continue;
      const world = voxelLocalToWorld(collider, localX, topLocalY + PLAYER_EYE_HEIGHT, localZ);
      const candidate = evaluateSpawnAnchorCandidate({
        x: world.x,
        z: world.z,
        baseFeetY: collider.centerY + topLocalY,
        eyeHeight: PLAYER_EYE_HEIGHT,
        solidRadius: PLAYER_SOLID_RADIUS,
        supportAtFeet: supportAtPlayerFeet,
        isTorsoBlocked: playerTorsoBlockedAtPosition,
        measureHeadroom: measurePlayerHeadroomAtPosition,
        minHeadroom: 2.2,
        maxHeadroomProbe: 3.8,
      });
      if (!candidate) continue;
      const distanceBias = Math.hypot(candidate.x - fallback.x, candidate.z - fallback.z);
      const score = candidate.variance * 20 + distanceBias * 0.04 - candidate.topY * 0.16 - candidate.headroom * 1.8;
      if (!best || score < best.score) best = { ...candidate, score };
    }
  }
  if (best) return makeVec(best.x, best.y, best.z);
  return findClearPlayerAnchor(fallback, lookTarget);
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

function addHangingJarCluster(parent, prefix, x, y, z, count = 4, spread = 0.9) {
  const rng = rngFromSeed(hashRoomKey(prefix));
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  for (let i = 0; i < count; i += 1) {
    const radius = 0.12 + rng() * 0.08;
    const height = 0.24 + rng() * 0.18;
    const jx = (rng() - 0.5) * spread;
    const jz = (rng() - 0.5) * spread;
    addGroundedCylinder(group, prefix + '-jar-' + i, radius, height, [jx, y, jz], MAT.ceramic, 7);
    addGroundedBeveledBox(group, prefix + '-lid-' + i, [radius * 1.1, 0.05, radius * 1.1], [jx, y + height + 0.02, jz], i % 2 ? MAT.rope : MAT.trim, false, 0.01, 1);
  }
  parent.add(group);
  return group;
}

function addPlanterBed(parent, prefix, x, y, z, width, depth, leafCount = 4) {
  const rng = rngFromSeed(hashRoomKey(prefix));
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addGroundedBeveledBox(group, prefix + '-trough', [width, 0.3, depth], [0, y, 0], MAT.plaster, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-soil', [width * 0.82, 0.08, depth * 0.72], [0, y + 0.24, 0], MAT.wall, false, 0.01, 1);
  for (let i = 0; i < leafCount; i += 1) {
    const lx = (rng() - 0.5) * width * 0.55;
    const lz = (rng() - 0.5) * depth * 0.48;
    const leaf = addGroundedBeveledBox(group, prefix + '-leaf-' + i, [0.24 + rng() * 0.24, 0.18 + rng() * 0.16, 0.14 + rng() * 0.18], [lx, y + 0.26, lz], MAT.foliage, false, 0.01, 1);
    leaf.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI, (rng() - 0.5) * 0.35);
  }
  const spill = addGroundedBeveledBox(group, prefix + '-spill', [width * 0.42, 0.08, 0.16], [width * 0.12, y + 0.16, depth * 0.54], MAT.foliage, false, 0.01, 1);
  spill.rotation.z = -0.24;
  parent.add(group);
  return group;
}

function addHangingPlanter(parent, prefix, x, z, topY, bowlY) {
  const drop = Math.max(0.6, topY - bowlY);
  for (const [sx, sz] of [[-0.14, -0.1], [0.14, -0.1], [0, 0.14]]) {
    addBeveledBox(parent, prefix + '-rope-' + sx + '-' + sz, [0.04, drop, 0.04], [x + sx, bowlY + drop * 0.5, z + sz], MAT.rope, false, 0.008, 1);
  }
  addGroundedBeveledBox(parent, prefix + '-bowl', [0.86, 0.24, 0.86], [x, bowlY, z], MAT.ceramic, false, 0.02, 1);
  addGroundedBeveledBox(parent, prefix + '-soil', [0.62, 0.08, 0.62], [x, bowlY + 0.18, z], MAT.wall, false, 0.01, 1);
  for (const [ox, oz, sy] of [[-0.12, -0.08, 0.22], [0.16, 0.06, 0.28], [-0.04, 0.18, 0.26]]) {
    const leaf = addGroundedBeveledBox(parent, prefix + '-leaf-' + ox + '-' + oz, [0.22, 0.16 + sy * 0.2, 0.14], [x + ox, bowlY + sy, z + oz], MAT.foliage, false, 0.01, 1);
    leaf.rotation.y = ox * 4.0;
    leaf.rotation.z = oz * -1.8;
  }
}

function addCisternPool(parent, prefix, x, y, z, width, depth) {
  addGroundedBeveledBox(parent, prefix + '-rim', [width, 0.34, depth], [x, y, z], MAT.plaster, false, 0.02, 1);
  addGroundedBeveledBox(parent, prefix + '-water', [width * 0.78, 0.06, depth * 0.72], [x, y + 0.18, z], MAT.water, false, 0.01, 1);
  addGroundedBeveledBox(parent, prefix + '-spout-a', [0.34, 0.18, 0.64], [x - width * 0.22, y + 0.22, z - depth * 0.5], MAT.ceramic, false, 0.01, 1);
  addGroundedBeveledBox(parent, prefix + '-spout-b', [0.34, 0.18, 0.64], [x + width * 0.18, y + 0.22, z + depth * 0.5], MAT.ceramic, false, 0.01, 1);
}

function addWellSet(parent, prefix, x, y, z) {
  addGroundedCylinder(parent, prefix + '-ring', 0.9, 0.64, [x, y, z], MAT.plaster, 8);
  addGroundedBeveledBox(parent, prefix + '-water', [1.18, 0.06, 1.18], [x, y + 0.38, z], MAT.water, false, 0.01, 1);
  addBeveledBox(parent, prefix + '-post-left', [0.12, 1.6, 0.12], [x - 0.76, y + 1.0, z], MAT.timber, false, 0.01, 1);
  addBeveledBox(parent, prefix + '-post-right', [0.12, 1.6, 0.12], [x + 0.76, y + 1.0, z], MAT.timber, false, 0.01, 1);
  addBeveledBox(parent, prefix + '-beam', [1.82, 0.12, 0.12], [x, y + 1.76, z], MAT.timber, false, 0.01, 1);
  addBeveledBox(parent, prefix + '-rope', [0.04, 0.92, 0.04], [x, y + 1.2, z], MAT.rope, false, 0.008, 1);
  addGroundedCylinder(parent, prefix + '-bucket', 0.18, 0.24, [x, y + 0.62, z], MAT.ceramic, 6);
}

function addShrineNicheSet(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-back', [2.4, 2.6, 0.4], [0, y + 1.3, 0], MAT.plaster, false, 0.03, 1);
  addGroundedBeveledBox(group, prefix + '-sill', [1.6, 0.18, 0.58], [0, y + 0.42, 0.22], MAT.stone2, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-icon', [0.54, 0.9, 0.14], [0, y + 1.2, 0.26], MAT.bronze, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-bowl', [0.42, 0.12, 0.42], [0, y + 0.62, 0.3], MAT.ceramic, false, 0.01, 1);
  const drape = addGroundedBeveledBox(group, prefix + '-drape', [1.1, 1.2, 0.05], [0, y + 1.56, 0.18], MAT.cloth, false, 0.01, 1);
  drape.rotation.x = -0.1;
  parent.add(group);
  return group;
}

function addClothLineCluster(parent, prefix, x, y, z, width, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addBeveledBox(group, prefix + '-line', [width, 0.04, 0.04], [0, y + 1.6, 0], MAT.rope, false, 0.008, 1);
  for (let i = 0; i < 3; i += 1) {
    const cloth = addBeveledBox(group, prefix + '-cloth-' + i, [width * 0.18, 0.64 + i * 0.08, 0.03], [(-width * 0.26) + i * width * 0.26, y + 1.18, 0], MAT.cloth, false, 0.01, 1);
    cloth.rotation.z = (i - 1) * 0.08;
  }
  parent.add(group);
  return group;
}

function addWatchPost(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-deck', [3.2, 0.22, 2.8], [0, y, 0], MAT.timber, false, 0.02, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addBeveledBox(group, prefix + '-post-' + sx + '-' + sz, [0.12, 1.34, 0.12], [sx * 1.36, y + 0.74, sz * 1.14], MAT.timber, false, 0.01, 1);
  }
  addBeveledBox(group, prefix + '-rail-front', [2.88, 0.12, 0.1], [0, y + 1.18, 1.18], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-rail-back', [2.88, 0.12, 0.1], [0, y + 1.18, -1.18], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-rail-left', [0.1, 0.12, 2.3], [-1.46, y + 1.18, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-rail-right', [0.1, 0.12, 2.3], [1.46, y + 1.18, 0], MAT.timber, false, 0.01, 1);
  addBrazier(group, prefix + '-signal', [0, y + 0.22, 0], { kind: 'flame' });
  const banner = addBeveledBox(group, prefix + '-banner', [0.7, 1.0, 0.04], [1.18, y + 1.6, 0], MAT.cloth, false, 0.01, 1);
  banner.rotation.z = -0.08;
  parent.add(group);
  return group;
}

function addCrateBundle(parent, prefix, x, y, z, yaw = 0, count = 4) {
  const rng = rngFromSeed(hashRoomKey(prefix));
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  for (let i = 0; i < count; i += 1) {
    const w = 0.42 + rng() * 0.28;
    const h = 0.26 + rng() * 0.18;
    const d = 0.36 + rng() * 0.24;
    const cx = (rng() - 0.5) * 1.2;
    const cz = (rng() - 0.5) * 0.9;
    addGroundedBeveledBox(group, prefix + '-crate-' + i, [w, h, d], [cx, y, cz], MAT.timber, false, 0.015, 1);
    if (rng() > 0.55) addBeveledBox(group, prefix + '-lash-' + i, [w * 0.92, 0.03, 0.03], [cx, y + h * 0.66, cz], MAT.rope, false, 0.008, 1);
  }
  parent.add(group);
  return group;
}

function addBenchTableSet(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-table-top', [2.2, 0.14, 1.0], [0, y + 0.52, 0], MAT.timber, false, 0.01, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addGroundedBeveledBox(group, prefix + '-leg-' + sx + '-' + sz, [0.1, 0.52, 0.1], [sx * 0.88, y, sz * 0.32], MAT.timber, false, 0.01, 1);
  }
  addGroundedBeveledBox(group, prefix + '-bench-a', [1.9, 0.16, 0.36], [0, y + 0.22, -0.86], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-bench-b', [1.9, 0.16, 0.36], [0, y + 0.22, 0.86], MAT.timber, false, 0.01, 1);
  addHangingJarCluster(group, prefix + '-tableware', 0, y + 0.68, 0, 3, 0.8);
  parent.add(group);
  return group;
}

function addArchFragment(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-pier-left', [0.9, 2.6, 0.9], [-1.4, y, 0], MAT.plaster, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-pier-right', [1.0, 3.0, 1.0], [1.3, y, 0], MAT.plaster, false, 0.02, 1);
  addBeveledBox(group, prefix + '-arch-top', [2.6, 0.34, 0.8], [0.0, y + 2.88, 0], MAT.plaster, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-fallen-a', [0.86, 0.34, 0.68], [-0.24, y, 0.96], MAT.stone2, false, 0.02, 1).rotation.y = 0.42;
  addGroundedBeveledBox(group, prefix + '-fallen-b', [0.72, 0.28, 0.54], [0.72, y, -0.74], MAT.stone2, false, 0.02, 1).rotation.y = -0.36;
  parent.add(group);
  return group;
}

function addGateChokeSet(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-post-left', [0.4, 2.6, 0.4], [-1.5, y, 0], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-post-right', [0.4, 2.6, 0.4], [1.5, y, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-beam', [3.4, 0.24, 0.24], [0, y + 2.58, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-cross-chain', [2.8, 0.06, 0.06], [0, y + 1.24, 0], MAT.rope, false, 0.008, 1);
  addBrazier(group, prefix + '-brazier-left', [-2.1, y, -0.4], { kind: 'flame' });
  addBrazier(group, prefix + '-brazier-right', [2.1, y, 0.4], { kind: 'flame' });
  parent.add(group);
  return group;
}

function addTrellisWall(parent, prefix, x, y, z, width, height, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-frame-a', [width, 0.08, 0.08], [0, y + height * 0.05, 0], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-frame-b', [width, 0.08, 0.08], [0, y + height, 0], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-side-left', [0.08, height, 0.08], [-width * 0.5, y + height * 0.5, 0], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-side-right', [0.08, height, 0.08], [width * 0.5, y + height * 0.5, 0], MAT.timber, false, 0.01, 1);
  for (let i = 0; i < 4; i += 1) {
    const sx = -width * 0.36 + i * width * 0.24;
    const slat = addGroundedBeveledBox(group, prefix + '-slat-' + i, [0.06, height * 0.82, 0.04], [sx, y + height * 0.52, 0], MAT.timber, false, 0.01, 1);
    slat.rotation.z = 0.22;
  }
  for (let i = 0; i < 3; i += 1) {
    const leaf = addGroundedBeveledBox(group, prefix + '-leaf-panel-' + i, [width * 0.24, height * 0.26, 0.03], [-width * 0.24 + i * width * 0.26, y + 0.48 + i * 0.26, 0.03], MAT.foliage, false, 0.01, 1);
    leaf.rotation.z = (i - 1) * 0.12;
  }
  parent.add(group);
  return group;
}


function addPulleyDrum(parent, prefix, x, y, z, radius = 0.72, width = 1.6, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedCylinder(group, prefix + '-drum', radius, width, [0, y + radius, 0], MAT.timber, 10).rotation.z = Math.PI * 0.5;
  addGroundedCylinder(group, prefix + '-cap-left', radius * 0.18, width + 0.18, [0, y + radius, 0], MAT.iron, 10).rotation.z = Math.PI * 0.5;
  addBeveledBox(group, prefix + '-axle', [0.22, 0.22, width + 1.2], [0, y + radius, 0], MAT.iron, false, 0.01, 1);
  addBeveledBox(group, prefix + '-brace-left', [0.18, 1.4, 0.18], [-0.8, y + 0.7, 0], MAT.iron, false, 0.01, 1);
  addBeveledBox(group, prefix + '-brace-right', [0.18, 1.4, 0.18], [0.8, y + 0.7, 0], MAT.iron, false, 0.01, 1);
  parent.add(group);
  return group;
}

function addCounterweightFrame(parent, prefix, x, y, z, height = 8.8, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addBeveledBox(group, prefix + '-leg-' + sx + '-' + sz, [0.34, height, 0.34], [sx * 1.2, y + height * 0.5, sz * 0.9], MAT.timber, false, 0.01, 1);
  }
  addBeveledBox(group, prefix + '-beam-top', [3.1, 0.28, 2.0], [0, y + height, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-cross', [3.0, 0.12, 0.14], [0, y + height * 0.62, 0], MAT.iron, false, 0.01, 1);
  addPulleyDrum(group, prefix + '-pulley', 0, y + height - 1.1, 0, 0.56, 1.2, 0);
  parent.add(group);
  return group;
}

function addHangingWeightCluster(parent, prefix, x, y, z, topY, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  const drop = Math.max(1.2, topY - (y + 1.0));
  addBeveledBox(group, prefix + '-chain-a', [0.06, drop, 0.06], [-0.28, y + 1.0 + drop * 0.5, 0], MAT.iron, false, 0.008, 1);
  addBeveledBox(group, prefix + '-chain-b', [0.06, drop * 0.86, 0.06], [0.28, y + 1.0 + drop * 0.43, 0], MAT.iron, false, 0.008, 1);
  addGroundedBeveledBox(group, prefix + '-weight-a', [0.88, 1.8, 0.88], [-0.28, y, 0], MAT.stone2, false, 0.02, 1);
  addGroundedBeveledBox(group, prefix + '-weight-b', [0.76, 1.5, 0.76], [0.28, y, 0], MAT.stone2, false, 0.02, 1);
  parent.add(group);
  return group;
}

function addCargoCage(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-base', [2.8, 0.18, 2.2], [0, y, 0], MAT.timber, false, 0.01, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addBeveledBox(group, prefix + '-bar-' + sx + '-' + sz, [0.08, 2.2, 0.08], [sx * 1.18, y + 1.1, sz * 0.88], MAT.iron, false, 0.008, 1);
  }
  addBeveledBox(group, prefix + '-rail-front', [2.5, 0.08, 0.08], [0, y + 1.9, 0.92], MAT.iron, false, 0.008, 1);
  addBeveledBox(group, prefix + '-rail-back', [2.5, 0.08, 0.08], [0, y + 1.9, -0.92], MAT.iron, false, 0.008, 1);
  addCrateBundle(group, prefix + '-cargo', 0, y + 0.18, 0, 0, 4);
  parent.add(group);
  return group;
}

function addHookPost(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addBeveledBox(group, prefix + '-post', [0.22, 2.8, 0.22], [0, y + 1.4, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-arm', [1.2, 0.14, 0.14], [0.44, y + 2.42, 0], MAT.timber, false, 0.01, 1);
  addBeveledBox(group, prefix + '-hook', [0.12, 0.56, 0.12], [0.92, y + 1.98, 0], MAT.iron, false, 0.01, 1);
  parent.add(group);
  return group;
}

function addToolBench(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-top', [2.4, 0.14, 0.96], [0, y + 0.56, 0], MAT.timber, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-shelf', [2.0, 0.12, 0.66], [0, y + 0.22, 0], MAT.timber, false, 0.01, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addGroundedBeveledBox(group, prefix + '-leg-' + sx + '-' + sz, [0.1, 0.54, 0.1], [sx * 0.92, y, sz * 0.3], MAT.timber, false, 0.01, 1);
  }
  addGroundedBeveledBox(group, prefix + '-tool-a', [0.46, 0.08, 0.18], [-0.48, y + 0.66, 0], MAT.iron, false, 0.01, 1);
  addGroundedBeveledBox(group, prefix + '-tool-b', [0.24, 0.24, 0.24], [0.4, y + 0.66, 0.1], MAT.bronze, false, 0.01, 1);
  parent.add(group);
  return group;
}

function addBrakeLeverStand(parent, prefix, x, y, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-pedestal', [0.9, 1.2, 0.9], [0, y, 0], MAT.plaster, false, 0.02, 1);
  const lever = addBeveledBox(group, prefix + '-lever', [0.12, 1.6, 0.12], [0.08, y + 1.4, 0], MAT.iron, false, 0.01, 1);
  lever.rotation.z = -0.42;
  addGroundedBeveledBox(group, prefix + '-handle', [0.24, 0.12, 0.24], [-0.24, y + 2.06, 0], MAT.bronze, false, 0.01, 1);
  parent.add(group);
  return group;
}

function addScreenWallSegment(parent, prefix, x, y, z, width, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  addGroundedBeveledBox(group, prefix + '-base', [width, 1.8, 0.42], [0, y, 0], MAT.plaster, false, 0.02, 1);
  addBeveledBox(group, prefix + '-cap', [width + 0.12, 0.14, 0.56], [0, y + 1.86, 0], MAT.trim, false, 0.01, 1);
  parent.add(group);
  return group;
}

function addHangingMarketStall(parent, prefix, x, y, z, width, depth, yaw = 0) {
  const postHeight = 1.9;
  const roofY = y + postHeight + 0.16;
  const stall = new THREE.Group();
  stall.position.set(x, 0, z);
  stall.rotation.y = yaw;
  addGroundedBeveledBox(stall, prefix + '-counter', [width * 0.82, 0.42, depth * 0.78], [0, y, 0], MAT.timber, true, 0.03, 1);
  addGroundedBeveledBox(stall, prefix + '-cloth-back', [width * 0.7, 0.12, depth * 0.14], [0, y + 0.46, -depth * 0.2], MAT.cloth, false, 0.01, 1);
  addGroundedBeveledBox(stall, prefix + '-crate-a', [0.52, 0.34, 0.48], [-width * 0.22, y + 0.42, -depth * 0.12], MAT.timber, false, 0.02, 1);
  addGroundedBeveledBox(stall, prefix + '-crate-b', [0.48, 0.28, 0.42], [width * 0.18, y + 0.42, depth * 0.08], MAT.timber, false, 0.02, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    addBeveledBox(stall, prefix + '-post-' + sx + '-' + sz, [0.16, postHeight, 0.16], [sx * (width * 0.42), y + postHeight * 0.5, sz * (depth * 0.42)], MAT.timber, false, 0.02, 1);
  }
  addBeveledBox(stall, prefix + '-roof', [width, 0.14, depth], [0, roofY, 0], MAT.timber, false, 0.02, 1);
  addBeveledBox(stall, prefix + '-awning', [width * 0.78, 0.08, depth * 0.34], [0, roofY - 0.12, depth * 0.34], MAT.cloth, false, 0.01, 1).rotation.x = -0.18;
  addHangingJarCluster(stall, prefix + '-jars', 0, y + 0.44, depth * 0.06, 3, width * 0.32);
  parent.add(stall);
  return stall;
}


function crystalRulesForRole(role) {
  switch (role) {
    case 'support_stair':
      return [
        { habit: 'blade_fan', climbable: true, scale: 1.95, verticalSpan: 4.1, edgeOffset: 2.7, alongSpread: 1.2, perchLift: 0.18, topLift: 0.12, count: 2, chance: 1 },
        { habit: 'column_cluster', climbable: false, scale: 1.55, verticalSpan: 3.45, edgeOffset: 3.45, alongSpread: 0.9, perchLift: 0.72, topLift: 0.2, count: 1, chance: 0.92, sideSign: -1 },
      ];
    case 'bridge_landing':
      return [
        { habit: 'column_cluster', climbable: true, scale: 1.88, verticalSpan: 3.8, edgeOffset: 2.9, alongSpread: 1.0, perchLift: 0.26, topLift: 0.12, count: 2, chance: 0.96 },
      ];
    case 'roof_lane':
      return [
        { habit: 'spray', climbable: true, scale: 1.6, verticalSpan: 3.3, edgeOffset: 2.4, alongSpread: 1.4, perchLift: 0.32, topLift: 0.14, count: 2, chance: 0.86 },
      ];
    case 'underdeck_pass':
    case 'undercroft_pass':
    case 'undercroft_run':
    case 'recovery_return':
      return [
        { habit: 'blade_fan', climbable: true, scale: 1.92, verticalSpan: 4.35, edgeOffset: 2.55, alongSpread: 1.25, perchLift: 0.12, topLift: 0.1, count: 2, chance: 0.9 },
      ];
    case 'market_court':
    case 'bath_court':
      return [
        { habit: 'spray', climbable: false, scale: 1.48, verticalSpan: 2.8, edgeOffset: 2.85, alongSpread: 1.7, perchLift: 0.54, topLift: 0.2, count: 2, chance: 0.7 },
      ];
    case 'retaining_gate':
      return [
        { habit: 'column_cluster', climbable: true, scale: 2.08, verticalSpan: 4.5, edgeOffset: 3.2, alongSpread: 1.2, perchLift: 0.28, topLift: 0.16, count: 2, chance: 0.92 },
      ];
    case 'aqueduct_remnant':
      return [
        { habit: 'column_cluster', climbable: false, scale: 2.3, verticalSpan: 5.0, edgeOffset: 3.6, alongSpread: 1.6, perchLift: 1.0, topLift: 0.24, count: 2, chance: 0.96 },
        { habit: 'spray', climbable: true, scale: 1.68, verticalSpan: 3.6, edgeOffset: 2.5, alongSpread: 1.0, perchLift: 0.44, topLift: 0.12, count: 1, chance: 0.84 },
      ];
    default:
      return [];
  }
}

function addCrystalGrowthCluster(parent, prefix, options) {
  const normal = options.normal.clone();
  normal.y = 0;
  if (normal.lengthSq() < 0.0001) return null;
  normal.normalize();
  const scale = options.scale || 1;
  const rng = rngFromSeed(options.seed || hashRoomKey(prefix));
  const yaw = Math.atan2(normal.x, normal.z);
  const basePos = options.basePos.clone ? options.basePos.clone() : makeVec(options.basePos.x, options.basePos.y, options.basePos.z);
  const anchorY = options.anchorY;
  const topLift = options.topLift ?? 0.12;
  const topY = anchorY + topLift;
  const cluster = new THREE.Group();
  cluster.name = prefix;
  cluster.position.copy(basePos);
  cluster.rotation.y = yaw;
  parent.add(cluster);
  const topLocal = topY - basePos.y;
  const rootMat = MAT.crystalDark;
  const accentMat = options.climbable ? MAT.crystal : (rng() < 0.5 ? MAT.crystal : MAT.crystalDark);

  const coreHeight = Math.max(0.7 * scale, topLocal * 0.34);
  const coreY = Math.max(0.16 * scale, topLocal * 0.14);
  addGroundedTaperedCylinder(cluster, prefix + '-core', 0.42 * scale, 0.68 * scale, coreHeight, [0, coreY, 0.28 * scale], rootMat, 6, true);
  addGroundedBeveledBox(cluster, prefix + '-keel', [0.92 * scale, 0.18 * scale, 0.72 * scale], [0, coreY + coreHeight * 0.18, 0.56 * scale], rootMat, false, 0.03, 1).rotation.x = -0.14;
  const spurCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < spurCount; i += 1) {
    const spur = addGroundedBeveledBox(cluster, prefix + '-spur-' + i, [(0.22 + rng() * 0.14) * scale, (0.52 + rng() * 0.36) * scale, (0.18 + rng() * 0.1) * scale], [(rng() - 0.5) * 1.1 * scale, coreY + rng() * (topLocal * 0.28), (0.08 + rng() * 0.66) * scale], rng() < 0.4 ? accentMat : rootMat, true, 0.02, 1);
    spur.rotation.y = (rng() - 0.5) * 0.8;
    spur.rotation.x = -0.1 - rng() * 0.22;
    spur.rotation.z = (rng() - 0.5) * 0.32;
  }

  const habit = options.habit || 'column_cluster';
  if (habit === 'column_cluster') {
    const count = 7 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i += 1) {
      const lateral = (rng() - 0.5) * 2.35 * scale;
      const depth = -0.15 * scale + rng() * 1.55 * scale;
      const radius = (0.14 + rng() * 0.22) * scale;
      const height = (topLocal * (0.74 + rng() * 0.36)) + 0.6 * scale;
      const startY = rng() * 0.32 * scale;
      const crystal = addGroundedTaperedCylinder(cluster, prefix + '-col-' + i, radius * 0.68, radius, height, [lateral, startY, depth], i % 3 === 0 ? accentMat : rootMat, 6, true);
      crystal.rotation.x = (rng() - 0.5) * 0.2;
      crystal.rotation.z = (rng() - 0.5) * 0.24;
    }
  } else if (habit === 'blade_fan') {
    const count = 6 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const bladeWidth = (0.28 + rng() * 0.26) * scale;
      const bladeDepth = (0.16 + rng() * 0.2) * scale;
      const bladeHeight = (topLocal * (0.9 + rng() * 0.24)) + 0.72 * scale;
      const lateral = (i - (count - 1) * 0.5) * (0.34 + rng() * 0.12) * scale;
      const depth = -0.08 * scale + rng() * 1.08 * scale;
      const startY = rng() * 0.22 * scale;
      const blade = addGroundedBeveledBox(cluster, prefix + '-blade-' + i, [bladeWidth, bladeHeight, bladeDepth], [lateral, startY, depth], i % 2 === 0 ? accentMat : rootMat, true, 0.02, 1);
      blade.rotation.y = (i - (count - 1) * 0.5) * 0.18 + (rng() - 0.5) * 0.14;
      blade.rotation.x = -0.08 - rng() * 0.18;
      blade.rotation.z = (i - (count - 1) * 0.5) * 0.09 + (rng() - 0.5) * 0.18;
    }
  } else {
    const count = 8 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i += 1) {
      const depth = -0.12 * scale + rng() * 1.34 * scale;
      const lateral = (rng() - 0.5) * 2.45 * scale;
      const startY = rng() * 0.24 * scale;
      if (i % 2 === 0) {
        const radius = (0.08 + rng() * 0.14) * scale;
        const height = (topLocal * (0.5 + rng() * 0.36)) + 0.36 * scale;
        const crystal = addGroundedTaperedCylinder(cluster, prefix + '-spray-col-' + i, radius * 0.56, radius, height, [lateral, startY, depth], i % 3 === 0 ? accentMat : rootMat, 6, true);
        crystal.rotation.x = (rng() - 0.5) * 0.32;
        crystal.rotation.z = (rng() - 0.5) * 0.32;
      } else {
        const blade = addGroundedBeveledBox(cluster, prefix + '-spray-blade-' + i, [(0.18 + rng() * 0.18) * scale, (topLocal * (0.46 + rng() * 0.26)) + 0.28 * scale, (0.12 + rng() * 0.12) * scale], [lateral, startY, depth], i % 3 === 0 ? accentMat : rootMat, true, 0.02, 1);
        blade.rotation.y = (rng() - 0.5) * 0.72;
        blade.rotation.x = -0.1 - rng() * 0.2;
        blade.rotation.z = (rng() - 0.5) * 0.28;
      }
    }
  }
  if (options.climbable) {
    const shelfWidth = 1.58 * scale;
    const shelfDepth = 1.22 * scale;
    const shelfHeight = 0.24 * scale;
    const topCenter = makeVec(basePos.x - normal.x * 0.18 * scale, topY, basePos.z - normal.z * 0.18 * scale);
    const shelf = addGroundedBeveledBox(cluster, prefix + '-shelf', [shelfWidth, shelfHeight, shelfDepth], [0, topLocal - shelfHeight, -0.18 * scale], MAT.crystal, true, 0.03, 1);
    shelf.rotation.x = -0.08;
    registerWalkable([shelfWidth * 0.92, shelfHeight, shelfDepth * 0.94], [topCenter.x, topY - shelfHeight * 0.5, topCenter.z], 0.04, {
      source: prefix + '-crystal-shelf',
      traversalCritical: true,
    });
    registerClimbSurface({
      center: makeVec(basePos.x + normal.x * 0.56 * scale, basePos.y + 0.1 * scale, basePos.z + normal.z * 0.56 * scale),
      normal,
      width: 1.78 * scale,
      baseY: basePos.y + 0.1 * scale,
      topY,
      topCenter,
      topWidth: shelfWidth * 0.92,
      topDepth: shelfDepth,
      source: prefix + '-crystal-climb',
    });
  }
  return cluster;
}

const districtGeometry = createDistrictGeometryApi({
  PLAYER_EYE_HEIGHT,
  MAT,
  roomGroup,
  rngFromSeed,
  hashRoomKey,
  buildDistrictStoryPlacementCandidates,
  crystalRulesForRole,
  makeVec,
  addCrystalGrowthCluster,
  addGroundedBeveledBox,
  addGroundedCylinder,
  addWalkableBox,
  addWallBox,
  addBatchStairRun,
  addBatchRouteSegment,
  addHangingMarketStall,
  addPlanterBed,
  addHangingPlanter,
  addTrellisWall,
  addCisternPool,
  addShrineNicheSet,
  addWellSet,
  addHangingJarCluster,
  addClothLineCluster,
  addWatchPost,
  addCrateBundle,
  addBenchTableSet,
  addArchFragment,
  addGateChokeSet,
  addBrazier,
  addHangingChain,
  resolveSupportHeight,
  addCounterweightFrame,
  addHangingWeightCluster,
  addPulleyDrum,
  addCargoCage,
  addHookPost,
  addToolBench,
  addBrakeLeverStand,
  addScreenWallSegment,
  addBeveledBox,
  activeTerrainLayer: () => roomState.terrainLayer,
});

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

function slicePoint(point, eye = false) {
  if (!point) return makeVec(0, eye ? PLAYER_EYE_HEIGHT : 0, 0);
  return makeVec(point[0], point[1] + (eye ? PLAYER_EYE_HEIGHT : 0), point[2]);
}

function sliceRoomBounds(room) {
  const center = slicePoint(room.center);
  const sx = room.size[0];
  const sz = room.size[2];
  return {
    minX: center.x - sx * 0.5,
    maxX: center.x + sx * 0.5,
    minZ: center.z - sz * 0.5,
    maxZ: center.z + sz * 0.5,
  };
}

function addFortressSolid(parent, name, size, center, mat = MAT.connectorWall, options = {}) {
  const baseY = center.y - size[1] * 0.5;
  return addGroundedBeveledBox(parent, name, size, [center.x, baseY, center.z], mat, true, options.bevel ?? 0.035, 1, {
    physicsOptions: {
      force: true,
      kind: options.kind || 'structure',
      source: name,
      margin: options.margin ?? 0.02,
      yaw: options.yaw || 0,
    },
  });
}

function addFortressVisualOnly(parent, name, size, center, mat = MAT.connectorWall, options = {}) {
  const baseY = center.y - size[1] * 0.5;
  return addGroundedBeveledBox(parent, name, size, [center.x, baseY, center.z], mat, true, options.bevel ?? 0.035, 1);
}

function addFortressRoomShell(parent, room) {
  const center = slicePoint(room.center);
  const floorY = center.y;
  const width = room.size[0];
  const depth = room.size[2];
  const wallHeight = room.semanticRole === 'spawn_read' ? 4.2 : 5.2;
  const wallThickness = 0.58;
  const gate = room.lockedGate;
  const openings = new Set(Object.keys(room.sockets || {}));
  const wallSpecs = [
    { side: 'north', center: makeVec(center.x, floorY + wallHeight * 0.5, center.z + depth * 0.5), size: [width, wallHeight, wallThickness] },
    { side: 'south', center: makeVec(center.x, floorY + wallHeight * 0.5, center.z - depth * 0.5), size: [width, wallHeight, wallThickness] },
    { side: 'west', center: makeVec(center.x - width * 0.5, floorY + wallHeight * 0.5, center.z), size: [wallThickness, wallHeight, depth] },
    { side: 'east', center: makeVec(center.x + width * 0.5, floorY + wallHeight * 0.5, center.z), size: [wallThickness, wallHeight, depth] },
  ];
  for (const spec of wallSpecs) {
    if (openings.has(spec.side) && gate?.side !== spec.side) {
      const span = spec.side === 'north' || spec.side === 'south' ? spec.size[0] : spec.size[2];
      const shoulder = Math.max(1.4, (span - 5.4) * 0.5);
      if (spec.side === 'north' || spec.side === 'south') {
        const z = spec.center.z;
        addFortressSolid(parent, room.id + '-' + spec.side + '-left-shoulder', [shoulder, wallHeight, wallThickness], makeVec(center.x - (2.7 + shoulder * 0.5), spec.center.y, z), MAT.connectorWall);
        addFortressSolid(parent, room.id + '-' + spec.side + '-right-shoulder', [shoulder, wallHeight, wallThickness], makeVec(center.x + (2.7 + shoulder * 0.5), spec.center.y, z), MAT.connectorWall);
        addFortressSolid(parent, room.id + '-' + spec.side + '-lintel', [5.6, 1.0, wallThickness], makeVec(center.x, floorY + wallHeight - 0.5, z), MAT.stone2);
      } else {
        const x = spec.center.x;
        addFortressSolid(parent, room.id + '-' + spec.side + '-front-shoulder', [wallThickness, wallHeight, shoulder], makeVec(x, spec.center.y, center.z - (2.7 + shoulder * 0.5)), MAT.connectorWall);
        addFortressSolid(parent, room.id + '-' + spec.side + '-back-shoulder', [wallThickness, wallHeight, shoulder], makeVec(x, spec.center.y, center.z + (2.7 + shoulder * 0.5)), MAT.connectorWall);
        addFortressSolid(parent, room.id + '-' + spec.side + '-lintel', [wallThickness, 1.0, 5.6], makeVec(x, floorY + wallHeight - 0.5, center.z), MAT.stone2);
      }
      continue;
    }
    addFortressSolid(parent, room.id + '-' + spec.side + '-wall', spec.size, spec.center, MAT.connectorWall);
  }
}

function addLockedGateBars(parent, room) {
  const center = slicePoint(room.center);
  const floorY = center.y;
  const z = center.z + room.size[2] * 0.5 - 0.28;
  addFortressSolid(parent, 'slice-locked-gate-header', [6.8, 0.55, 0.5], makeVec(center.x, floorY + 3.6, z), MAT.iron, { margin: 0.01 });
  for (let i = 0; i < 5; i += 1) {
    const x = center.x - 2.4 + i * 1.2;
    addFortressSolid(parent, 'slice-locked-gate-bar-' + i, [0.22, 3.35, 0.34], makeVec(x, floorY + 1.75, z), MAT.iron, { margin: 0.01 });
  }
  addBeveledBox(parent, 'slice-locked-gate-warning-plate', [3.8, 0.34, 0.16], [center.x, floorY + 2.15, z - 0.24], MAT.exit, false, 0.02, 1);
}

function addSliceTerrain(layer) {
  for (let i = 0; i < QUAKE_M1E1_SLICE.terrainStamps.length; i += 1) {
    const stamp = QUAKE_M1E1_SLICE.terrainStamps[i];
    layer.addIslandStamp({
      id: stamp.id,
      origin: stamp.center,
      size: [stamp.radiusX * 2, stamp.height, stamp.radiusZ * 2],
      terraced: true,
      materialVariant: i % 2,
      role: stamp.id.includes('trench') ? 'trench_cut' : 'fortress_foundation',
      rockGrammar: 'imperial_floating_strata',
      rockSilhouette: stamp.id.includes('trench') ? 'cliff_cut_trench' : 'retaining_wall_plateau',
      imperialFunction: stamp.purpose,
      source: 'quake_m1e1_slice:' + stamp.id,
    });
  }
}

function buildSlicePlan() {
  return {
    levelIndex: roomState.levelIndex,
    seed: hashRoomKey(QUAKE_M1E1_SLICE.id + ':' + roomState.levelIndex),
    sliceId: QUAKE_M1E1_SLICE.id,
    districts: [{
      id: 'imperial-fortress-rock',
      name: 'Imperial Fortress Rock',
      purpose: QUAKE_M1E1_SLICE.purpose,
      archetype: 'fortress_rock_slice',
      roomStart: 0,
      roomCount: QUAKE_M1E1_SLICE.rooms.length,
      layoutId: 'quake_m1e1_slice',
      elevationBand: 'fortress ascent',
      baseElevation: 0,
      topElevation: 4,
      macroTemplateId: QUAKE_M1E1_SLICE.routeTemplateId,
      approachType: 'start_casemate',
      departureType: 'final_gun_room',
      supportStyle: 'terrain_layer_foundations',
      landmarkRole: 'locked_gate_and_upper_overlook',
      requiresVisibleBelow: true,
      requiresVisibleAbove: true,
      skeletonType: 'hand_authored_quake_m1e1_slice',
      patchStyle: 'primitive_blockout',
      silhouetteRule: 'single fortress rock mass with readable loop',
      segmentRoles: QUAKE_M1E1_SLICE.rooms.map((room) => room.semanticRole),
      validation: { implemented: true, passes: true, failedChecks: [] },
      repairsApplied: [],
      landmarkSchemas: [],
      storyNookPlacements: [],
      requiredStructuralReads: ['locked_gate_face', 'side_trench_branch', 'upper_overlook_loopback'],
    }],
    mainSpineEdges: QUAKE_M1E1_SLICE.edges.filter((edge) => edge.routeRole !== 'optional_secret').map((edge) => ({ ...edge })),
    returnEdges: QUAKE_M1E1_SLICE.edges.filter((edge) => edge.routeRole === 'loopback_return').map((edge) => ({ ...edge })),
    landmarkViews: [{ from: 'battery_court', to: 'locked_gate_face' }, { from: 'upper_overlook', to: 'battery_court' }],
  };
}

function sliceEdgeLink(edge) {
  const from = QUAKE_M1E1_SLICE.rooms.find((room) => room.id === edge.from);
  const to = QUAKE_M1E1_SLICE.rooms.find((room) => room.id === edge.to);
  if (!from || !to) return null;
  return {
    a: QUAKE_M1E1_SLICE.rooms.indexOf(from),
    b: QUAKE_M1E1_SLICE.rooms.indexOf(to),
    sideA: edge.kind === 'jump' ? 'west' : (edge.kind === 'branch' ? 'west' : 'exit'),
    sideB: edge.kind === 'jump' ? 'east' : (edge.kind === 'branch' ? 'east' : 'spawn'),
    kind: edge.kind,
    routeRole: edge.routeRole,
  };
}

function districtAssemblyMaterial(materialKey) {
  return {
    bridge: MAT.bridge,
    connectorWall: MAT.connectorWall,
    hazard: MAT.hazard,
    iron: MAT.iron,
    trim: MAT.trim,
    water: MAT.water,
  }[materialKey] || MAT.connectorWall;
}

function emitDistrictAssemblyPlan(assemblyPlan) {
  if (!assemblyPlan?.parts?.length) return assemblyPlan || null;
  for (const part of assemblyPlan.parts) {
    if (part.visible === false) continue;
    const hasPhysicalCollider = part.collisionPolicy === 'player' || part.collisionPolicy === 'solid';
    const mesh = (hasPhysicalCollider ? addFortressSolid : addFortressVisualOnly)(
      roomGroup,
      'assembly-' + part.id,
      part.size,
      makeVec(part.center[0], part.center[1], part.center[2]),
      districtAssemblyMaterial(part.material),
      {
        margin: 0.01,
        kind: part.traversalIntent || part.kind || (part.hazard ? 'hazard' : 'structure'),
      },
    );
    Object.assign(mesh.userData, {
      districtId: part.districtId,
      assemblyId: part.assemblyId,
      assemblyPartId: part.id,
      assemblyRole: part.role,
      hostId: part.hostId,
      supports: part.supports,
      supportedBy: part.supportedBy,
      serviceAccess: part.serviceAccess,
      silhouette: part.silhouette,
      traversalIntent: part.traversalIntent,
      collisionPolicy: part.collisionPolicy,
    });
  }
  return assemblyPlan;
}

function publishDistrictAssemblyDebug(assemblyPlan) {
  if (!assemblyPlan) return;
  window.__infiniteBrutalityDistrictAssembly = {
    build: BUILD,
    districtId: assemblyPlan.districtId,
    assemblyCount: assemblyPlan.assemblies?.length || 0,
    partCount: assemblyPlan.parts?.length || 0,
    requiredRoles: assemblyPlan.requiredRoles || [],
    roles: [...new Set((assemblyPlan.parts || []).map((part) => part.role))],
    unsupportedPartIds: assemblyPlan.validation?.unsupportedPartIds || [],
    missingRoles: assemblyPlan.validation?.missingRoles || [],
    nakedPartIds: assemblyPlan.validation?.nakedPartIds || [],
    validation: assemblyPlan.validation,
  };
}

function addDistrictIntentReadabilityProps(intent) {
  const id = intent?.id || 'artillery_battery';
  if (id === 'artillery_battery') {
    addFortressSolid(roomGroup, 'intent-battery-front-parapet-a', [6.2, 1.05, 0.62], makeVec(8.8, 1.0, -9.2), MAT.connectorWall, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-battery-front-parapet-b', [5.4, 1.0, 0.62], makeVec(8.9, 1.0, -3.2), MAT.connectorWall, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-battery-gun-bed', [3.8, 0.55, 2.2], makeVec(6.4, 1.05, -6.3), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-battery-gun-barrel', [0.58, 0.58, 5.2], makeVec(8.8, 1.65, -6.3), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-battery-ammo-recess-a', [1.0, 1.0, 1.0], makeVec(-12.8, 0.2, -2.4), MAT.trim, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-battery-ammo-recess-b', [0.9, 0.9, 0.9], makeVec(-12.8, 0.15, -0.8), MAT.trim, { margin: 0.01 });
    return;
  }
  if (id === 'cloud_dock') {
    addFortressSolid(roomGroup, 'intent-dock-loading-lip', [1.0, 0.5, 12.0], makeVec(9.6, 1.0, -4.2), MAT.bridge, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-crane-mast', [0.55, 6.8, 0.55], makeVec(7.7, 3.9, -2.2), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-crane-boom', [7.2, 0.38, 0.42], makeVec(5.0, 7.15, -2.2), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-crane-hook', [0.34, 1.9, 0.34], makeVec(2.2, 5.95, -2.2), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-warehouse-mouth', [5.4, 2.6, 0.58], makeVec(-1.5, 1.4, 22.0), MAT.connectorWall, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-cargo-a', [1.35, 1.1, 1.35], makeVec(-5.8, 0.2, -10.0), MAT.trim, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-dock-cargo-b', [1.1, 1.35, 1.1], makeVec(-4.1, 0.35, -10.4), MAT.trim, { margin: 0.01 });
    return;
  }
  if (id === 'imperial_foundry') {
    const assemblyPlan = emitDistrictAssemblyPlan(buildDistrictAssemblyPlan(intent));
    publishDistrictAssemblyDebug(assemblyPlan);
    return assemblyPlan;
  }
  if (id === 'quarry_barracks') {
    addFortressSolid(roomGroup, 'intent-quarry-lift-rail-a', [0.32, 6.8, 0.32], makeVec(-14.2, 3.1, 4.0), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-lift-rail-b', [0.32, 6.8, 0.32], makeVec(-11.7, 3.1, 4.0), MAT.iron, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-lift-cage', [2.2, 2.1, 1.5], makeVec(-13.0, 1.8, 4.0), MAT.trim, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-shelf-low', [5.2, 0.52, 1.3], makeVec(-12.4, 0.9, -7.4), MAT.connectorWall, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-shelf-mid', [4.6, 0.5, 1.15], makeVec(-12.7, 2.4, 9.2), MAT.connectorWall, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-barracks-mouth-a', [0.55, 1.5, 2.2], makeVec(-15.0, 2.6, 13.4), MAT.trim, { margin: 0.01 });
    addFortressSolid(roomGroup, 'intent-quarry-barracks-mouth-b', [0.55, 1.45, 2.0], makeVec(-15.0, 2.5, 17.0), MAT.trim, { margin: 0.01 });
  }
  return null;
}

function buildCarvedVoxelFortressSlice() {
  const layer = createActiveTerrainLayer();
  const districtIntent = buildDistrictIntentPlan(hashRoomKey(ACTIVE_DISTRICT_ID + ':' + roomState.levelIndex), ACTIVE_DISTRICT_ID);
  const districtAssemblyPlan = buildDistrictAssemblyPlan(districtIntent);
  const carved = buildCarvedVoxelFortressData({ districtIntent });
  layer.addVoxelField({
    id: carved.id,
    field: carved.field,
    material: MAT.sedimentaryRockDark,
    rockGrammar: 'carved_imperial_structure',
    source: 'carved-voxel-fortress:single-mass',
    kind: 'carved_voxel_fortress',
  });

  addFortressSolid(roomGroup, 'carved-gate-bars', [0.28, 3.2, 4.8], makeVec(-7.8, 1.6, 6.4), MAT.iron, { margin: 0.01 });
  addFortressSolid(roomGroup, 'carved-void-brace-a', [0.34, 3.8, 0.34], makeVec(7.2, 1.9, -7.5), MAT.iron, { margin: 0.01 });
  addFortressSolid(roomGroup, 'carved-void-brace-b', [0.34, 4.6, 0.34], makeVec(7.6, 2.3, 8.0), MAT.iron, { margin: 0.01 });
  addFortressSolid(roomGroup, 'carved-final-gun-plinth', [4.8, 0.7, 2.0], makeVec(4.5, 4.1, 24.0), MAT.iron, { margin: 0.01 });
  const emittedAssemblyPlan = addDistrictIntentReadabilityProps(districtIntent) || districtAssemblyPlan;
  addMarker(roomGroup, makeVec(carved.anchors.exit[0], carved.anchors.exit[1], carved.anchors.exit[2]), MAT.exit, 1.15);

  const district = {
    id: districtIntent.id,
    name: districtIntent.displayName,
    purpose: districtIntent.purpose,
    archetype: districtIntent.id,
    roomStart: 0,
    roomCount: carved.anchors.rooms.length,
    layoutId: carved.id,
    elevationBand: 'carved ascent',
    baseElevation: 0,
    topElevation: 6,
    macroTemplateId: districtIntent.routeTemplateId,
    approachType: 'spawn_alcove',
    departureType: 'final_chamber',
    supportStyle: 'single_voxel_field',
    landmarkRole: districtIntent.landmark.id,
    requiresVisibleBelow: true,
    requiresVisibleAbove: true,
    skeletonType: 'solid_mass_subtractive_cuts',
    patchStyle: 'carved_negative_space',
    silhouetteRule: districtIntent.expectedSilhouette.join('; '),
    segmentRoles: carved.cuts.map((cut) => cut.tacticalRole),
    validation: districtIntent.validation,
    repairsApplied: [],
    landmarkSchemas: [districtIntent.landmark],
    storyNookPlacements: [],
    requiredStructuralReads: districtIntent.validationTags,
    districtIntent,
    requiredPhrases: districtIntent.requiredPhrases,
    requiredAssemblies: districtIntent.requiredAssemblies,
    logisticsFlow: districtIntent.logisticsFlow,
    expectedSkyline: districtIntent.expectedSkyline,
    expectedSilhouette: districtIntent.expectedSilhouette,
    traversalIdentity: districtIntent.traversalIdentity,
    districtAssemblies: emittedAssemblyPlan,
  };
  const plan = {
    levelIndex: roomState.levelIndex,
    seed: hashRoomKey(carved.id + ':' + roomState.levelIndex),
    sliceId: carved.id,
    districtIntentPlans: [districtIntent],
    districtAssemblyPlans: [emittedAssemblyPlan],
    districts: [district],
    mainSpineEdges: carved.metrics.routeConnections.map((edge) => ({ ...edge, kind: 'carved_connection' })),
    returnEdges: [{ from: 'secret_side_cut', to: 'overlook_window', kind: 'secret_return' }],
    landmarkViews: [{ from: 'overlook_window', to: 'battery_court' }],
  };
  const rooms = carved.anchors.rooms.map((entry, index) => ({
    id: entry.id,
    spec: carved.cuts.find((cut) => cut.id === entry.id),
    district,
    districtIndex: 0,
    spawn: makeVec(entry.center[0], entry.center[1], entry.center[2]),
    exit: makeVec(entry.center[0], entry.center[1], entry.center[2]),
    center: makeVec(entry.center[0], entry.center[1], entry.center[2]),
    enemyPositions: [],
    sockets: entry.sockets || {},
    bounds: entry.bounds,
    index,
  }));
  return {
    rooms,
    plan,
    spawn: makeVec(carved.anchors.spawn[0], carved.anchors.spawn[1], carved.anchors.spawn[2]),
    exit: makeVec(carved.anchors.exit[0], carved.anchors.exit[1], carved.anchors.exit[2]),
    exitRadius: 2.8,
    enemyPositions: carved.anchors.enemies.map((pos) => makeVec(pos[0], pos[1], pos[2])),
    bounds: {
      minX: carved.field.min.x,
      maxX: carved.field.max.x,
      minZ: carved.field.min.z,
      maxZ: carved.field.max.z,
    },
    connectivity: { repairs: [], unresolved: [] },
    branchLinks: [],
    carved,
  };
}

function buildQuakeM1E1Slice() {
  const layer = createActiveTerrainLayer();
  addSliceTerrain(layer);
  const rooms = [];
  for (const room of QUAKE_M1E1_SLICE.rooms) {
    const center = slicePoint(room.center);
    const floorHeight = room.size[1];
    addWalkableBox(roomGroup, 'slice-' + room.id + '-floor', [room.size[0], floorHeight, room.size[2]], [center.x, center.y - floorHeight * 0.5, center.z], MAT.floor, true, 0.05, {
      source: 'slice-' + room.id + '-floor',
      traversalCritical: true,
    });
    addFortressRoomShell(roomGroup, room);
    if (room.lockedGate) addLockedGateBars(roomGroup, room);
    if (room.id === 'battery_court') {
      addFortressSolid(roomGroup, 'slice-battery-cover-left', [2.6, 1.2, 1.6], makeVec(-5.2, 0.6, -7.6), MAT.stone2);
      addFortressSolid(roomGroup, 'slice-battery-cover-right', [2.4, 1.15, 1.7], makeVec(5.0, 0.575, -3.8), MAT.stone2);
    }
    if (room.id === 'final_gun_room') {
      addFortressSolid(roomGroup, 'slice-final-gun-plinth', [5.6, 1.0, 2.2], makeVec(4.4, 4.5, 27.2), MAT.iron);
      addMarker(roomGroup, slicePoint(room.exit, false), MAT.exit, 1.15);
    }
    rooms.push({
      id: room.id,
      spec: room,
      district: buildSlicePlan().districts[0],
      districtIndex: 0,
      spawn: slicePoint(room.spawn, true),
      exit: slicePoint(room.exit, true),
      center: center.clone(),
      enemyPositions: (room.enemies || []).map((point) => slicePoint(point)),
      sockets: Object.fromEntries(Object.entries(room.sockets || {}).map(([key, point]) => [key, slicePoint(point, true)])),
      bounds: sliceRoomBounds(room),
    });
  }

  addBatchRouteSegment(roomGroup, 'slice-start-to-court', slicePoint([0, 0, -16]), slicePoint([0, 0, -14]), 0, 6.2, MAT.connectorFloor);
  addBatchRouteSegment(roomGroup, 'slice-court-to-gate', slicePoint([0, 0, 0]), slicePoint([0, 0, 1]), 0, 6.0, MAT.connectorFloor);
  addBatchRouteSegment(roomGroup, 'slice-gate-to-trench', slicePoint([-7, 0, 5]), slicePoint([-11, 0, 2]), 0, 4.4, MAT.connectorFloor);
  addBatchRouteSegment(roomGroup, 'slice-overlook-to-final', slicePoint([0, 4, 18]), slicePoint([0, 4, 20]), 4, 5.0, MAT.bridge);
  addBatchStairRun(roomGroup, 'slice-trench-stair', slicePoint([-15, 0, 6], true), slicePoint([-12, 4, 8], true), 0, 4, MAT.platform);
  addIslandArtBridge('slice-overlook-rock-causeway', slicePoint([0, 4, 18]), slicePoint([0, 4, 20]), 5.5, {
    material: MAT.sedimentaryRockDark,
    thickness: 1.25,
    source: 'quake_m1e1_slice:overlook-final-causeway',
  });

  const plan = buildSlicePlan();
  const branchLinks = QUAKE_M1E1_SLICE.edges
    .map(sliceEdgeLink)
    .filter(Boolean)
    .filter((link) => link.routeRole !== 'main');
  const connectivity = validateAndRepairGauntletConnectivity(rooms, branchLinks);
  const first = rooms[0];
  const last = rooms[rooms.length - 1];
  const minX = Math.min(...rooms.map((room) => room.bounds.minX), -30);
  const maxX = Math.max(...rooms.map((room) => room.bounds.maxX), 16);
  const minZ = Math.min(...rooms.map((room) => room.bounds.minZ), -32);
  const maxZ = Math.max(...rooms.map((room) => room.bounds.maxZ), 36);
  return {
    rooms,
    plan,
    spawn: first.spawn,
    exit: last.exit,
    exitRadius: 2.6,
    enemyPositions: rooms.flatMap((room) => room.enemyPositions),
    bounds: { minX, maxX, minZ, maxZ },
    connectivity,
    branchLinks,
  };
}

function buildGeneratedGauntlet(startIndex = 0) {
  const districtPlan = ensureDistrictPlan();
  const rooms = [];
  const rawRooms = [];
  const linkKeys = new Set();
  const branchLinks = buildDistrictBranchLinks(districtPlan);
  const roomCount = playableRoomCount();
  const branchSides = Array.from({ length: roomCount }, () => new Set());
  for (const link of branchLinks) {
    branchSides[link.a].add(link.sideA);
    branchSides[link.b].add(link.sideB);
  }
  for (let i = 0; i < roomCount; i += 1) {
    const offset = batchRoomWorldOffset(i, districtPlan);
    const prevOffset = i > 0 ? batchRoomWorldOffset(i - 1, districtPlan) : null;
    const nextOffset = i < roomCount - 1 ? batchRoomWorldOffset(i + 1, districtPlan) : null;
    const districtInfo = districtInfoForRoomIndex(i, districtPlan);
    const roomSpec = playableRoomSpec(i);
    const path = {
      entryConnector: prevOffset ? connectorTowardOffset(offset, prevOffset) : null,
      exitConnector: nextOffset ? connectorTowardOffset(offset, nextOffset) : null,
      branchConnectors: [...branchSides[i]],
    };
    const built = withBatchBuildOffset(offset, () => buildGeneratedBatchRoom(roomSpec, i, path));
    rawRooms.push({
      spec: roomSpec,
      district: districtInfo.district,
      districtIndex: districtInfo.districtIndex,
      localIndex: districtInfo.localIndex,
      offset: offset.clone(),
      built,
      bounds: {
        minX: built.bounds.minX + offset.x,
        maxX: built.bounds.maxX + offset.x,
        minZ: built.bounds.minZ + offset.z,
        maxZ: built.bounds.maxZ + offset.z,
      },
    });
  }
  createActiveTerrainLayer();
  for (const district of districtPlan.districts) districtGeometry.addDistrictSkeletonGeometry(district);
  for (const room of rawRooms) {
    const offset = room.offset;
    const built = room.built;
    const snappedSpawn = snapAnchorToSupport(built.spawn.clone().add(offset));
    const spawn = findRoomIslandSpawnAnchor(room.district.id, room.localIndex, snappedSpawn, built.exit.clone().add(offset));
    const exit = findClearPlayerAnchor(snapAnchorToSupport(built.exit.clone().add(offset)), built.spawn.clone().add(offset));
    const enemyPositions = built.enemyPositions.map((pos) => snapEnemyPointToSupport(pos.clone().add(offset)));
    const sockets = Object.fromEntries(Object.entries(built.sockets).map(([key, pos]) => [key, snapAnchorToSupport(pos.clone().add(offset))]));
    rooms.push({
      spec: room.spec,
      district: room.district,
      districtIndex: room.districtIndex,
      spawn,
      exit,
      enemyPositions,
      sockets,
      bounds: room.bounds,
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
  const designRepairs = districtPlan.districts
    .filter((district) => district.repairsApplied?.length)
    .map((district) => ({ id: district.id, repairsApplied: district.repairsApplied }));
  if (designRepairs.length) console.info('district design repairs', designRepairs);
  const designFailures = districtPlan.districts
    .filter((district) => district.validation?.implemented && !district.validation.passes)
    .map((district) => ({ id: district.id, failedChecks: district.validation.failedChecks }));
  if (designFailures.length) console.warn('district design validation', designFailures);
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
    const center = roomWorldCenter(roomState.gauntletRooms[i]);
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
    const specs = activeRoomSpecs();
    const spec = specs[bestIndex] || playableRoomSpec(bestIndex);
    if (useCarvedVoxelFortressSlice()) {
      const district = roomState.districtPlan?.districts?.[0] || {};
      roomState.spec = {
        index: bestIndex,
        connector: spec.id,
        type: spec.cutShape,
        roomRole: spec.tacticalRole,
        landmark: spec.readabilityCue,
        routeSentence: [spec.connectsFrom, spec.id, spec.connectsTo].filter(Boolean),
        districtId: district.id || 'carved-voxel-fortress',
        districtName: district.name || 'Carved Voxel Fortress',
        districtPurpose: district.purpose || 'single mass carved fortress fragment',
        districtIntentId: district.districtIntent?.id || district.id,
        districtLandmarkRole: district.landmarkRole,
        districtLogisticsFlow: district.logisticsFlow || [],
        districtTraversalIdentity: district.traversalIdentity || [],
        districtIndex: 0,
        districtRoomIndex: bestIndex,
        districtElevationBand: district.elevationBand || 'carved ascent',
        districtBaseElevation: district.baseElevation || 0,
        districtTopElevation: district.topElevation || 6,
        districtMacroTemplateId: district.macroTemplateId || 'subtractive_fortress_fragment',
        districtSkeletonType: district.skeletonType || 'solid_mass_subtractive_cuts',
        districtSegmentRole: spec.tacticalRole,
      };
      setStatus((district.name || 'Carved Voxel Fortress') + ' | ' + spec.id + ' | ' + (spec.readabilityCue || spec.purpose));
      return;
    }
    if (useQuakeM1E1Slice()) {
      const district = roomState.districtPlan?.districts?.[0] || {};
      roomState.spec = {
        index: bestIndex,
        connector: spec.id,
        type: spec.semanticRole,
        roomRole: spec.semanticRole,
        landmark: spec.label,
        routeSentence: spec.routeSentence,
        districtId: district.id || 'imperial-fortress-rock',
        districtName: district.name || 'Imperial Fortress Rock',
        districtPurpose: district.purpose || QUAKE_M1E1_SLICE.purpose,
        districtIndex: 0,
        districtRoomIndex: bestIndex,
        districtElevationBand: district.elevationBand || 'fortress ascent',
        districtBaseElevation: district.baseElevation || 0,
        districtTopElevation: district.topElevation || 4,
        districtMacroTemplateId: district.macroTemplateId || QUAKE_M1E1_SLICE.routeTemplateId,
        districtSkeletonType: district.skeletonType || 'hand_authored_quake_m1e1_slice',
        districtSegmentRole: spec.semanticRole,
      };
      setStatus('quake_m1e1_slice | ' + (spec.label || spec.id) + ' | ' + (spec.combatPurpose || QUAKE_M1E1_SLICE.purpose));
      return;
    }
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
    setStatus('slice ' + (districtInfo.districtIndex + 1) + '/' + (roomState.districtPlan?.districts.length || 0) + ' | ' + districtInfo.district.elevationBand + ' @' + districtInfo.district.baseElevation.toFixed(1) + ' | island ' + (bestIndex + 1) + '/' + playableRoomCount() + ' | ' + districtInfo.district.name + ' | ' + spec.id);
  }
}


function tryBeginControllerKataDirectMantle(physicsMove, moveY) {
  const proof = roomState.controllerKataMantleProof;
  if (!proof || player.mode === 'mantle') return false;
  const collisions = physicsMove?.collisions || [];
  const fixtureContact = collisions.find((entry) => entry?.isWall && entry.source === proof.fixture.id);
  if (fixtureContact && (player.grounded || physicsMove?.grounded)) proof.phase = 'approach-ready';
  const plan = createBoundedContactMantlePlan({
    fixture: proof.fixture,
    eyePosition: player.position,
    inputMoveY: moveY,
    collisions,
    eyeHeight: PLAYER_EYE_HEIGHT,
    radius: PLAYER_SOLID_RADIUS,
    mantleForward: CLIMB_MANTLE_FORWARD,
    playerMode: player.mode,
    grounded: player.grounded || !!physicsMove?.grounded,
    velocityY: player.velocity.y,
    facing: cameraForwardYaw(player.yaw),
    faceYaw: player.yaw,
    findMantleTopSupport: (x, z, targetTopY) => roomState.physicsWorld?.findCuboidTopSupport({ x, z, targetTopY, radius: PLAYER_SOLID_RADIUS, source: proof.fixture.id }),
    isBodyClear: (x, z, eyeY) => !!roomState.physicsWorld?.isCapsuleClearAt({ x, z, eyeY, eyeHeight: PLAYER_EYE_HEIGHT, radius: PLAYER_SOLID_RADIUS }),
  });
  if (!plan) return false;
  player.mode = 'mantle';
  player.climb = null;
  player.mantle = plan;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  proof.phase = 'started';
  proof.starts += 1;
  proof.startedAt = performance.now();
  proof.contactSource = plan.contactSource;
  proof.contactNormal = [...plan.contactNormal];
  proof.faceDot = plan.faceDot;
  proof.feetToLip = plan.feetToLip;
  proof.supportSource = plan.supportSource;
  proof.verticalDisplacement = plan.verticalDisplacement;
  proof.horizontalDisplacement = plan.horizontalDisplacement;
  proof.startPosition = plan.start.toArray();
  proof.targetPosition = plan.end.toArray();
  proof.modeHistory.push('mantle');
  return true;
}

function updateControllerKataDirectMantle(dt) {
  const proof = roomState.controllerKataMantleProof;
  const mantle = player.mantle;
  if (!proof || !mantle || mantle.kind !== 'controller-direct') {
    throw new Error('controller kata direct mantle state is missing');
  }
  const frame = updatePlayerMantle(dt);
  proof.phase = frame?.complete ? 'completed' : 'mantling';
  proof.progress = frame?.progress || 0;
  if (!frame?.complete) return;
  proof.completions += 1;
  proof.completedAt = performance.now();
  proof.endPosition = mantle.end.toArray();
  proof.modeHistory.push('ground');
}

function applyControllerKataState(arena, movePlayer) {
  roomState.plan = { levelIndex: roomState.levelIndex, seed: arena.numericSeed, sliceId: 'controller_kata', nodes: [] };
  roomState.spec = { index: 0, connector: 'controller_kata', type: 'controller_kata', roomRole: 'controller_kata', landmark: 'cyan exit', routeSentence: [] };
  roomState.seed = arena.numericSeed;
  roomState.spawn.fromArray(arena.spawn);
  roomState.exit.fromArray(arena.exit);
  roomState.exitRadius = arena.exitRadius;
  roomState.enemyPositions = [];
  roomState.gauntletRooms = [];
  roomState.sliceSpecs = [];
  roomState.navGraph = null;
  roomState.connectivityRepair = null;
  roomState.levelBounds = { minX: -48, maxX: 48, minZ: -48, maxZ: 48 };
  roomState.controllerKataStartedAt = performance.now();
  roomState.controllerKataMantleProof = {
    fixture: { ...arena.directMantle, center: [...arena.directMantle.center], size: [...arena.directMantle.size], approach: [...arena.directMantle.approach] },
    phase: 'ready',
    starts: 0,
    completions: 0,
    climbEntries: 0,
    progress: 0,
    contactSource: '',
    contactNormal: null,
    faceDot: null,
    feetToLip: null,
    supportSource: '',
    verticalDisplacement: null,
    horizontalDisplacement: null,
    targetPosition: null,
    startedAt: 0,
    completedAt: 0,
    startPosition: null,
    endPosition: null,
    modeHistory: ['ground'],
  };
  window.__infiniteBrutalityControllerMantle = roomState.controllerKataMantleProof;
  if (enemy) enemy.visible = false;
  if (movePlayer) {
    player.position.copy(roomState.spawn);
    player.visualPosition.copy(player.position);
    player.velocity.set(0, 0, 0);
    input.smoothMoveX = 0;
    input.smoothMoveY = 0;
    player.grounded = true;
    player.mode = 'ground';
    player.climb = null;
    player.mantle = null;
    player.runCharge = 0;
    player.lastRunIntent = false;
    player.attack = null;
    player.attackTimer = 0;
  }
  setNodeIndex(0);
  setStatus(`controller kata | seed ${arena.seedText} | mantle ready | reach cyan exit`);
}

function buildControllerKataSlice(movePlayer, rootGroup) {
  const arena = generateControllerArena({ seed: `${CONTROLLER_KATA_BASE_SEED}:${roomState.levelIndex}` });
  const floorMaterial = applyWorldGridOverlay(new THREE.MeshStandardMaterial({ color: 0x17252b, roughness: 0.92, metalness: 0.04 }), { gridScale: 1, gridThickness: 0.72, gridStrength: 0.32, edgeStrength: 0.08, gridColor: 0x63e7ff });
  addWalkableBox(rootGroup, 'controller-kata-floor', arena.floor.size, arena.floor.center, floorMaterial, false, 0.02);
  const grid = new THREE.GridHelper(arena.floor.size[0], arena.floor.size[0] / arena.grid.step, 0xe7fdff, 0x63e7ff);
  grid.name = 'controller-kata-grid-helper';
  grid.position.y = arena.floor.center[1] + arena.floor.size[1] * 0.5 + 0.04 + 0.01;
  grid.material.depthWrite = false;
  grid.renderOrder = 2;
  rootGroup.add(grid);
  window.__infiniteBrutalityControllerGrid = grid;
  const mantleMaterial = new THREE.MeshStandardMaterial({ color: 0xd6a642, roughness: 0.72, metalness: 0.05 });
  addWalkableBox(rootGroup, arena.directMantle.id, arena.directMantle.size, arena.directMantle.center, mantleMaterial, true, 0.04);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x7899a3, roughness: 0.76, metalness: 0.06 });
  for (const cube of arena.cubes) addWalkableBox(rootGroup, cube.id, cube.size, cube.center, cubeMaterial, true, 0.04);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 12), new THREE.MeshBasicMaterial({ color: 0x63e7ff }));
  beacon.name = 'controller-kata-exit';
  beacon.position.set(arena.exit[0], 2, arena.exit[2]);
  rootGroup.add(beacon);
  applyControllerKataState(arena, movePlayer);
  return arena;
}

function completeGeneratedGauntlet() {
  if (useControllerKataSlice() && roomState.controllerKataStartedAt) {
    const elapsed = Math.max(0, (performance.now() - roomState.controllerKataStartedAt) / 1000);
    roomState.controllerKataLastTime = elapsed;
    const key = 'infinite-brutality-controller-kata-best';
    const prior = Number(localStorage.getItem(key) || 0);
    const best = prior > 0 ? Math.min(prior, elapsed) : elapsed;
    roomState.controllerKataBestTime = best;
    localStorage.setItem(key, String(best));
  }
  roomState.levelIndex += 1;
  roomState.nodeIndex = 0;
  setLevelIndex(roomState.levelIndex);
  setNodeIndex(0);
  buildRoom(true);
}

function exitCompletionEnabled() {
  return !useCarvedVoxelFortressSlice();
}

function buildRoom(movePlayer = true) {
  ensureNookTtsLevelState();
  stopNookTtsPlayback();
  const rootGroup = roomGroup;
  disposeActiveTerrainLayer();
  disposeActivePhysicsWorld();
  clearGroup(rootGroup);
  resetWalkableBounds();
  createActivePhysicsWorld();
  roomState.transitionLock = 0.7;
  if (useControllerKataSlice()) {
    buildControllerKataSlice(movePlayer, rootGroup);
    return;
  }
  if (useCarvedVoxelFortressSlice()) {
    const built = buildCarvedVoxelFortressSlice();
    const districtPlan = built.plan;
    const district = districtPlan.districts[0];
    const spec = built.carved.cuts[0];
    roomState.districtPlan = districtPlan;
    roomState.sliceSpecs = built.carved.cuts;
    roomState.plan = {
      levelIndex: roomState.levelIndex,
      seed: districtPlan.seed,
      sliceId: built.carved.id,
      routeTemplateId: district.macroTemplateId,
      districts: districtPlan.districts.map((entry) => ({ ...entry })),
      districtIntentPlans: districtPlan.districtIntentPlans.map((entry) => ({ ...entry })),
      districtAssemblyPlans: districtPlan.districtAssemblyPlans.map((entry) => ({ ...entry })),
      mainSpineEdges: districtPlan.mainSpineEdges.map((edge) => ({ ...edge })),
      returnEdges: districtPlan.returnEdges.map((edge) => ({ ...edge })),
      landmarkViews: districtPlan.landmarkViews.map((view) => ({ ...view })),
      nodes: built.carved.cuts.map((cut, index) => ({
        index,
        connector: cut.id,
        type: cut.cutShape,
        districtId: district.id,
        districtName: district.name,
        districtPurpose: district.purpose,
        districtIntentId: district.districtIntent.id,
        districtLandmarkRole: district.landmarkRole,
        districtLogisticsFlow: district.logisticsFlow,
        districtTraversalIdentity: district.traversalIdentity,
        districtElevationBand: district.elevationBand,
        districtBaseElevation: district.baseElevation,
        districtTopElevation: district.topElevation,
        districtMacroTemplateId: district.macroTemplateId,
        districtSkeletonType: district.skeletonType,
        districtSegmentRole: cut.tacticalRole,
        routeSentence: [cut.connectsFrom, cut.id, cut.connectsTo].filter(Boolean),
        combatPurpose: cut.purpose,
      })),
      carvedMetrics: built.carved.metrics,
    };
    roomState.gauntletRooms = built.rooms;
    roomState.navGraph = buildRoomTraversalGraph(built.rooms, built.carved.cuts, built.branchLinks);
    roomState.connectivityRepair = built.connectivity;
    refreshNavGraphDebug(roomState.navGraph);
    roomState.nodeIndex = 0;
    setNodeIndex(0);
    roomState.spec = {
      index: 0,
      connector: spec.id,
      type: spec.cutShape,
      roomRole: spec.tacticalRole,
      landmark: spec.readabilityCue,
      routeSentence: [spec.connectsFrom, spec.id, spec.connectsTo].filter(Boolean),
      districtId: district.id,
      districtName: district.name,
      districtPurpose: district.purpose,
      districtIntentId: district.districtIntent.id,
      districtLandmarkRole: district.landmarkRole,
      districtLogisticsFlow: district.logisticsFlow,
      districtTraversalIdentity: district.traversalIdentity,
      districtIndex: 0,
      districtRoomIndex: 0,
      districtElevationBand: district.elevationBand,
      districtBaseElevation: district.baseElevation,
      districtTopElevation: district.topElevation,
      districtMacroTemplateId: district.macroTemplateId,
      districtSkeletonType: district.skeletonType,
      districtSegmentRole: spec.tacticalRole,
      districtValidationImplemented: true,
      districtValidationPasses: district.validation.passes,
      districtValidationFailedChecks: [...district.validation.failedChecks],
      districtRepairsApplied: [],
      districtLandmarks: district.landmarkSchemas.map((landmark) => ({ ...landmark })),
    };
    roomState.seed = hashRoomKey(built.carved.id);
    roomState.spawn.copy(built.spawn);
    roomState.exit.copy(built.exit);
    roomState.exitRadius = built.exitRadius;
    roomState.enemyPositions = built.enemyPositions.map((pos) => resolveEnemySpawnPoint(pos));
    roomState.levelBounds = built.bounds;
    if (roomState.enemyPositions.length > 0) {
      positionEnemy(roomState.enemyPositions[0]);
    } else if (enemy) {
      enemy.visible = false;
    }
    applyAttackLabSetup();

    if (movePlayer) {
      player.position.copy(bootPlayerOverride && Number.isFinite(bootPlayerOverride.x) && Number.isFinite(bootPlayerOverride.y) && Number.isFinite(bootPlayerOverride.z)
        ? bootPlayerOverride
        : roomState.spawn);
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
    setStatus(district.name + ' | single mass -> ' + district.landmarkRole + ' | air ' + built.carved.metrics.airVolumeCreated);
    return;
  }
  if (useQuakeM1E1Slice()) {
    const built = buildQuakeM1E1Slice();
    const districtPlan = built.plan;
    const spec = QUAKE_M1E1_SLICE.rooms[0];
    const district = districtPlan.districts[0];
    roomState.districtPlan = districtPlan;
    roomState.sliceSpecs = QUAKE_M1E1_SLICE.rooms;
    roomState.plan = {
      levelIndex: roomState.levelIndex,
      seed: districtPlan.seed,
      sliceId: QUAKE_M1E1_SLICE.id,
      routeTemplateId: QUAKE_M1E1_SLICE.routeTemplateId,
      districts: districtPlan.districts.map((entry) => ({ ...entry })),
      mainSpineEdges: districtPlan.mainSpineEdges.map((edge) => ({ ...edge })),
      returnEdges: districtPlan.returnEdges.map((edge) => ({ ...edge })),
      landmarkViews: districtPlan.landmarkViews.map((view) => ({ ...view })),
      nodes: QUAKE_M1E1_SLICE.rooms.map((room, index) => ({
        index,
        connector: room.id,
        type: room.semanticRole,
        districtId: district.id,
        districtName: district.name,
        districtPurpose: district.purpose,
        districtElevationBand: district.elevationBand,
        districtBaseElevation: district.baseElevation,
        districtTopElevation: district.topElevation,
        districtMacroTemplateId: district.macroTemplateId,
        districtSkeletonType: district.skeletonType,
        districtSegmentRole: room.semanticRole,
        routeSentence: room.routeSentence,
        combatPurpose: room.combatPurpose,
      })),
    };
    roomState.gauntletRooms = built.rooms;
    roomState.navGraph = buildRoomTraversalGraph(built.rooms, QUAKE_M1E1_SLICE.rooms, built.branchLinks);
    roomState.connectivityRepair = built.connectivity;
    refreshNavGraphDebug(roomState.navGraph);
    roomState.nodeIndex = 0;
    setNodeIndex(0);
    roomState.spec = {
      index: 0,
      connector: spec.id,
      type: spec.semanticRole,
      roomRole: spec.semanticRole,
      landmark: spec.label,
      routeSentence: spec.routeSentence,
      districtId: district.id,
      districtName: district.name,
      districtPurpose: district.purpose,
      districtIndex: 0,
      districtRoomIndex: 0,
      districtElevationBand: district.elevationBand,
      districtBaseElevation: district.baseElevation,
      districtTopElevation: district.topElevation,
      districtMacroTemplateId: district.macroTemplateId,
      districtSkeletonType: district.skeletonType,
      districtSegmentRole: spec.semanticRole,
      districtValidationImplemented: true,
      districtValidationPasses: true,
      districtValidationFailedChecks: [],
      districtRepairsApplied: [],
      districtLandmarks: [],
    };
    roomState.seed = hashRoomKey(QUAKE_M1E1_SLICE.id);
    roomState.spawn.copy(built.spawn);
    roomState.exit.copy(built.exit);
    roomState.exitRadius = built.exitRadius;
    roomState.enemyPositions = built.enemyPositions.map((pos) => resolveEnemySpawnPoint(pos));
    roomState.levelBounds = built.bounds;
    positionEnemy(roomState.enemyPositions[0]);
    applyAttackLabSetup();

    if (movePlayer) {
      player.position.copy(bootPlayerOverride && Number.isFinite(bootPlayerOverride.x) && Number.isFinite(bootPlayerOverride.y) && Number.isFinite(bootPlayerOverride.z)
        ? bootPlayerOverride
        : roomState.spawn);
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
    setStatus('quake_m1e1_slice | start casemate -> locked gate -> side trench -> upper overlook -> final gun room' + repairNote + unresolvedNote);
    return;
  }
  roomState.sliceSpecs = null;
  const startIndex = Math.max(0, Math.min(roomState.nodeIndex, playableRoomCount() - 1));
  const built = buildGeneratedGauntlet(startIndex);
  const districtPlan = built.plan;
  const spec = playableRoomSpec(startIndex);
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
      storyPilotId: district.storyPilotId || null,
      storyPlacementSet: district.storyPlacementSet || null,
      architectureContract: district.architectureContract || null,
      placeArchetype: district.placeArchetype || null,
      stoneForm: district.stoneForm || null,
      requiredStructuralReads: [...(district.requiredStructuralReads || [])],
      spawnBuildingPlan: district.spawnBuildingPlan ? JSON.parse(JSON.stringify(district.spawnBuildingPlan)) : null,
      visualCollisionContract: district.visualCollisionContract ? JSON.parse(JSON.stringify(district.visualCollisionContract)) : null,
      storyNookPlacements: (district.storyNookPlacements || []).map((placement) => ({ ...placement })),
      segmentRoles: [...(district.segmentRoles || [])],
      landmarkSchemas: (district.landmarkSchemas || []).map((landmark) => ({ ...landmark })),
      repairsApplied: (district.repairsApplied || []).map((repair) => ({ ...repair })),
      validation: district.validation ? {
        implemented: district.validation.implemented,
        passes: district.validation.passes,
        requiredOutputs: { ...(district.validation.requiredOutputs || {}) },
        categories: { ...(district.validation.categories || {}) },
        failedChecks: [...(district.validation.failedChecks || [])],
        screenshotFailChecks: (district.validation.screenshotFailChecks || []).map((check) => ({ ...check })),
        tacticalCoverage: [...(district.validation.tacticalCoverage || [])],
        wonderCoverage: [...(district.validation.wonderCoverage || [])],
        habitationProofCount: district.validation.habitationProofCount || 0,
      } : null,
    })),
    mainSpineEdges: districtPlan.mainSpineEdges.map((edge) => ({ ...edge })),
    returnEdges: districtPlan.returnEdges.map((edge) => ({ ...edge })),
    landmarkViews: districtPlan.landmarkViews.map((view) => ({ ...view })),
    nodes: playableRoomSpecs().map((room, index) => {
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
        districtValidationImplemented: info.district.validation?.implemented || false,
        districtValidationPasses: info.district.validation?.passes ?? null,
        districtValidationFailedChecks: [...(info.district.validation?.failedChecks || [])],
        districtRepairsApplied: (info.district.repairsApplied || []).map((repair) => ({ ...repair })),
      };
    }),
  };
  roomState.gauntletRooms = built.rooms;
  roomState.navGraph = buildRoomTraversalGraph(built.rooms, playableRoomSpecs(), buildDistrictBranchLinks(districtPlan));
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
    districtValidationImplemented: districtInfo.district.validation?.implemented || false,
    districtValidationPasses: districtInfo.district.validation?.passes ?? null,
    districtValidationFailedChecks: [...(districtInfo.district.validation?.failedChecks || [])],
    districtRepairsApplied: (districtInfo.district.repairsApplied || []).map((repair) => ({ ...repair })),
    districtLandmarks: (districtInfo.district.landmarkSchemas || []).map((landmark) => ({ ...landmark })),
  };
  roomState.seed = hashRoomKey(spec.id || String(startIndex));
  roomState.spawn.copy(built.spawn);
  roomState.exit.copy(built.exit);
  roomState.exitRadius = built.exitRadius;
  roomState.enemyPositions = built.enemyPositions.map((pos) => resolveEnemySpawnPoint(pos));
  roomState.levelBounds = built.bounds;
  positionEnemy(roomState.enemyPositions[0]);
  applyAttackLabSetup();

  if (movePlayer) {
    player.position.copy(bootPlayerOverride && Number.isFinite(bootPlayerOverride.x) && Number.isFinite(bootPlayerOverride.y) && Number.isFinite(bootPlayerOverride.z)
      ? bootPlayerOverride
      : roomState.spawn);
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
  setStatus('slice ' + (districtInfo.districtIndex + 1) + '/' + districtPlan.districts.length + ' | ' + districtInfo.district.elevationBand + ' @' + districtInfo.district.baseElevation.toFixed(1) + ' | island ' + (startIndex + 1) + '/' + playableRoomCount() + ' | ' + districtInfo.district.name + ' | ' + districtInfo.district.purpose + repairNote + unresolvedNote);
}


function buildEnemy() {
  if (enemy) despawnEnemyCorpse();
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
  enemy.userData.attackDefKey = '';
  enemy.userData.attackDef = null;
  enemy.userData.attackPrevHand = null;
  enemy.userData.attackCurrentHand = null;
  enemy.userData.attackContactPoint = null;
  enemy.userData.attackBones = {};
  enemy.userData.mode = 'approach';
  enemy.userData.modeTimer = 0;
  enemy.userData.commitTimer = ENEMY_COMMIT_INTERVAL * 0.55;
  enemy.userData.commitElapsed = 0;
  enemy.userData.orbitSign = 1;
  enemy.userData.dissolveProgress = 0;
  enemy.userData.lastHitReaction = '';
  enemy.userData.lastHitZone = '';
  enemy.userData.lastHitLocalX = 0;
  enemy.userData.lastHitLocalY = 0;
  enemy.userData.hitBox = fallbackEnemyHitBox();

  enemyRuntime.primitiveVisual = new THREE.Group();
  enemyRuntime.primitiveVisual.name = 'broken-knight-fallback';
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-torso', [0.9, 1.25, 0.42], [0, 1.18, 0], MAT.iron);
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-head', [0.58, 0.5, 0.5], [0, 2.15, 0], MAT.stone2);
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-left-arm', [0.32, 1.05, 0.32], [-0.74, 1.2, 0], MAT.iron).rotation.z = -0.28;
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-right-arm', [0.32, 1.05, 0.32], [0.74, 1.2, 0], MAT.iron).rotation.z = 0.28;
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-legs', [0.34, 1.0, 0.32], [-0.26, 0.48, 0], MAT.iron);
  addBox(enemyRuntime.primitiveVisual, 'broken-knight-legs', [0.34, 1.0, 0.32], [0.26, 0.48, 0], MAT.iron);
  const sword = addBox(enemyRuntime.primitiveVisual, 'execution-sword', [0.16, 1.9, 0.16], [1.25, 1.25, 0.08], MAT.bone);
  sword.rotation.z = -0.42;
  enemyRuntime.primitiveVisual.visible = false;
  enemy.add(enemyRuntime.primitiveVisual);
  enemy.traverse((node) => { if (node.isMesh) node.castShadow = USE_DYNAMIC_SHADOWS; });
  scene.add(enemy);
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xeee8d8, 0x6b5b48, 0.96));
  scene.add(new THREE.AmbientLight(0x66513c, 0.48));
  const key = new THREE.DirectionalLight(0xffedcf, 2.82);
  key.position.set(0, 38, 18);
  key.castShadow = false;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d2cb, 1.28);
  fill.position.set(-14, 24, 8);
  fill.castShadow = false;
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffa26f, 0.34);
  rim.position.set(16, 20, -18);
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

function collectBones(root) {
  if (!root) return [];
  const bones = [];
  const seen = new Set();
  root.traverse((node) => {
    if (!node?.isBone || seen.has(node)) return;
    seen.add(node);
    bones.push(node);
  });
  root.traverse((node) => {
    const skeletonBones = node?.skeleton?.bones || [];
    for (const bone of skeletonBones) {
      if (!bone || seen.has(bone)) continue;
      seen.add(bone);
      bones.push(bone);
    }
  });
  return bones;
}

function normalizeBoneName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeRigNodeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findMatchingRigBone(root, name) {
  const target = normalizeRigNodeName(name);
  if (!target) return null;
  const bones = collectBones(root);
  for (const bone of bones) {
    if (normalizeRigNodeName(bone.name) === target) return bone;
  }
  for (const bone of bones) {
    const candidate = normalizeRigNodeName(bone.name);
    if (candidate.endsWith(target) || target.endsWith(candidate)) return bone;
  }
  for (const bone of bones) {
    if (normalizeRigNodeName(bone.name).includes(target)) return bone;
  }
  return null;
}

async function loadVisualOverlayTextureSet(config = {}) {
  const textureUrls = config?.textures || {};
  const required = new Set(config?.requiredTextures || []);
  const entries = await Promise.all(Object.entries(textureUrls).map(async ([key, url]) => {
    if (!url) return [key, null];
    try {
      const texture = await textureLoader.loadAsync(url);
      if (key === 'baseColor' || key === 'emission') texture.colorSpace = THREE.SRGBColorSpace;
      else texture.colorSpace = THREE.NoColorSpace;
      const transform = config?.textureTransform;
      if (transform?.repeat) texture.repeat.fromArray(transform.repeat);
      if (transform?.offset) texture.offset.fromArray(transform.offset);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);
      texture.needsUpdate = true;
      return [key, texture];
    } catch (err) {
      console.warn('visual overlay texture failed', url, err);
      if (required.has(key)) throw err;
      return [key, null];
    }
  }));
  const textureSet = Object.fromEntries(entries);
  for (const key of required) {
    if (!textureSet[key]) throw new Error(`required visual overlay texture missing: ${key}`);
  }
  return textureSet;
}

function buildVisualOverlayMaterial(existing, textureSet = {}, options = {}) {
  return new THREE.MeshStandardMaterial({
    name: existing?.name || 'visual-overlay',
    color: options.color != null ? new THREE.Color(options.color) : (existing?.color?.clone?.() || new THREE.Color(0xffffff)),
    map: textureSet.baseColor || null,
    normalMap: textureSet.normal || null,
    roughnessMap: textureSet.roughness || null,
    metalnessMap: textureSet.metallic || null,
    emissiveMap: textureSet.emission || null,
    emissive: options.emissive != null ? new THREE.Color(options.emissive) : (textureSet.emission ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)),
    emissiveIntensity: Number(options.emissiveIntensity ?? (textureSet.emission ? 0.08 : 0)),
    roughness: Number(options.roughness ?? (textureSet.roughness ? 0.62 : 0.82)),
    metalness: Number(options.metalness ?? (textureSet.metallic ? 0.32 : 0.08)),
    normalScale: new THREE.Vector2(Number(options.normalScale ?? 0.24), Number(options.normalScale ?? 0.24)),
    envMapIntensity: Number(options.envMapIntensity ?? 0.64),
    flatShading: Boolean(options.flatShading ?? false),
    transparent: Boolean(existing?.transparent),
    opacity: existing?.opacity ?? 1,
    side: existing?.side ?? THREE.FrontSide,
  });
}

function applyVisualOverlayMaterials(root, textureSet = {}, options = {}) {
  function smoothMeshyOverlayGeometry(node) {
    const geometry = node?.geometry;
    const position = geometry?.attributes?.position;
    if (!geometry || !position || geometry.userData?.meshyOverlayNormalsPrepared) return;
    geometry.computeVertexNormals();
    const normal = geometry.attributes.normal;
    if (!normal) return;
    const index = geometry.index;
    const faceA = new THREE.Vector3();
    const faceB = new THREE.Vector3();
    const faceC = new THREE.Vector3();
    const edgeAB = new THREE.Vector3();
    const edgeAC = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const accum = new Map();
    const keyFor = (vertexIndex) => `${Math.round(position.getX(vertexIndex) * 1000)}|${Math.round(position.getY(vertexIndex) * 1000)}|${Math.round(position.getZ(vertexIndex) * 1000)}`;
    const addNormal = (vertexIndex, sourceNormal) => {
      const key = keyFor(vertexIndex);
      let entry = accum.get(key);
      if (!entry) {
        entry = new THREE.Vector3();
        accum.set(key, entry);
      }
      entry.add(sourceNormal);
    };
    const visitTriangle = (a, b, c) => {
      faceA.fromBufferAttribute(position, a);
      faceB.fromBufferAttribute(position, b);
      faceC.fromBufferAttribute(position, c);
      edgeAB.subVectors(faceB, faceA);
      edgeAC.subVectors(faceC, faceA);
      faceNormal.crossVectors(edgeAB, edgeAC);
      if (faceNormal.lengthSq() <= 1e-10) return;
      faceNormal.normalize();
      addNormal(a, faceNormal);
      addNormal(b, faceNormal);
      addNormal(c, faceNormal);
    };
    if (index) {
      for (let i = 0; i < index.count; i += 3) visitTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    } else {
      for (let i = 0; i < position.count; i += 3) visitTriangle(i, i + 1, i + 2);
    }
    for (let i = 0; i < position.count; i += 1) {
      const averaged = accum.get(keyFor(i));
      if (!averaged || averaged.lengthSq() <= 1e-10) continue;
      averaged.normalize();
      normal.setXYZ(i, averaged.x, averaged.y, averaged.z);
    }
    normal.needsUpdate = true;
    geometry.userData.meshyOverlayNormalsPrepared = true;
  }

  root?.traverse?.((node) => {
    if (!node?.isMesh && !node?.isSkinnedMesh) return;
    smoothMeshyOverlayGeometry(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const upgraded = materials.map((material) => buildVisualOverlayMaterial(material, textureSet, options));
    node.material = Array.isArray(node.material) ? upgraded : upgraded[0];
    node.frustumCulled = false;
    node.castShadow = false;
    node.receiveShadow = false;
    node.renderOrder = 11;
  });
}

function rebindVisualOverlayToRig(visualRoot, rigRoot) {
  const meshes = [];
  visualRoot?.traverse?.((node) => {
    if (node?.isSkinnedMesh && node.skeleton?.bones?.length) meshes.push(node);
  });
  let matchedBones = 0;
  let totalBones = 0;
  let reboundMeshes = 0;
  for (const mesh of meshes) {
    const bones = mesh.skeleton?.bones || [];
    totalBones += bones.length;
    let meshHits = 0;
    const mapped = bones.map((bone) => {
      const target = findMatchingRigBone(rigRoot, bone.name);
      if (target) {
        meshHits += 1;
        matchedBones += 1;
      }
      return target || bone;
    });
    if (meshHits < Math.max(3, Math.floor(bones.length * 0.35))) continue;
    mesh.bind(new THREE.Skeleton(mapped, mesh.skeleton.boneInverses), mesh.bindMatrix.clone());
    mesh.normalizeSkinWeights?.();
    reboundMeshes += 1;
  }
  return { reboundMeshes, matchedBones, totalBones };
}

function loadFbxScene(url) {
  return new Promise((resolve, reject) => {
    fbxLoader.load(url, resolve, undefined, reject);
  });
}

function attachArmsVisualOverlay(overlayRoot, config = {}, textureSet = {}) {
  if (!armsModel || !overlayRoot) return null;
  applyVisualOverlayMaterials(overlayRoot, textureSet, config.materialOptions || {});
  const bindStats = rebindVisualOverlayToRig(overlayRoot, armsModel);
  if (config.requireRebind !== false && (!bindStats || bindStats.reboundMeshes < 1)) {
    throw new Error(`FPSPlayer Meshy overlay did not rebind to runtime rig: ${JSON.stringify(bindStats)}`);
  }
  const hideBaseNodes = new Set(config.hideBaseNodes || []);
  if (hideBaseNodes.size) {
    armsModel.traverse((node) => {
      if (hideBaseNodes.has(node.name)) node.visible = false;
    });
  }
  if (config.transform?.position) overlayRoot.position.fromArray(config.transform.position);
  if (config.transform?.rotationDeg) overlayRoot.rotation.set(...config.transform.rotationDeg.map((value) => THREE.MathUtils.degToRad(value)));
  if (config.transform?.scale != null) overlayRoot.scale.setScalar(Number(config.transform.scale || 1));
  overlayRoot.name = 'fpsplayer-meshy-visual-overlay';
  armsModel.add(overlayRoot);
  return bindStats;
}

function findBone(root, name) {
  const target = normalizeBoneName(name);
  if (!target) return null;
  const bones = collectBones(root);
  for (const bone of bones) {
    if (normalizeBoneName(bone.name) === target) return bone;
  }
  return null;
}

function findBoneByAliases(root, names = []) {
  const bones = collectBones(root);
  if (!bones.length) return null;
  const normalizedTargets = names.map(normalizeBoneName).filter(Boolean);
  for (const target of normalizedTargets) {
    for (const bone of bones) {
      if (normalizeBoneName(bone.name) === target) return bone;
    }
  }
  for (const target of normalizedTargets) {
    for (const bone of bones) {
      const candidate = normalizeBoneName(bone.name);
      if (candidate.endsWith(target) || candidate.includes(target)) return bone;
    }
  }
  return null;
}

const ENEMY_RAGDOLL_DEFS = [
  { key: 'hips', names: ['mixamorig:Hips', 'Hips'], childKey: 'spine', radius: 0.34, maxAngle: 1.1, invMass: 0.1 },
  { key: 'spine', names: ['mixamorig:Spine', 'Spine'], childKey: 'chest', radius: 0.28, maxAngle: 0.72, invMass: 0.14 },
  { key: 'chest', names: ['mixamorig:Spine2', 'mixamorig:Spine1', 'Spine2', 'Spine1'], childKey: 'neck', radius: 0.26, maxAngle: 0.82, invMass: 0.18 },
  { key: 'neck', names: ['mixamorig:Neck', 'Neck'], childKey: 'head', radius: 0.13, maxAngle: 0.9, invMass: 0.24 },
  { key: 'head', names: ['mixamorig:Head', 'Head'], childKey: null, radius: 0.17, maxAngle: 0.0, invMass: 0.28 },
  { key: 'lShoulder', names: ['mixamorig:LeftShoulder', 'LeftShoulder'], childKey: 'lArm', radius: 0.13, maxAngle: 1.35, invMass: 0.34 },
  { key: 'lArm', names: ['mixamorig:LeftArm', 'LeftArm'], childKey: 'lForeArm', radius: 0.11, maxAngle: 1.05, invMass: 0.42 },
  { key: 'lForeArm', names: ['mixamorig:LeftForeArm', 'LeftForeArm'], childKey: 'lHand', radius: 0.09, maxAngle: 0.62, invMass: 0.58 },
  { key: 'lHand', names: ['mixamorig:LeftHand', 'LeftHand'], childKey: null, radius: 0.07, maxAngle: 0.0, invMass: 0.82 },
  { key: 'rShoulder', names: ['mixamorig:RightShoulder', 'RightShoulder'], childKey: 'rArm', radius: 0.13, maxAngle: 1.35, invMass: 0.34 },
  { key: 'rArm', names: ['mixamorig:RightArm', 'RightArm'], childKey: 'rForeArm', radius: 0.11, maxAngle: 1.05, invMass: 0.42 },
  { key: 'rForeArm', names: ['mixamorig:RightForeArm', 'RightForeArm'], childKey: 'rHand', radius: 0.09, maxAngle: 0.62, invMass: 0.58 },
  { key: 'rHand', names: ['mixamorig:RightHand', 'RightHand'], childKey: null, radius: 0.07, maxAngle: 0.0, invMass: 0.82 },
  { key: 'lUpLeg', names: ['mixamorig:LeftUpLeg', 'LeftUpLeg'], childKey: 'lLeg', radius: 0.17, maxAngle: 1.08, invMass: 0.28 },
  { key: 'lLeg', names: ['mixamorig:LeftLeg', 'LeftLeg'], childKey: 'lFoot', radius: 0.13, maxAngle: 0.58, invMass: 0.48 },
  { key: 'lFoot', names: ['mixamorig:LeftFoot', 'LeftFoot'], childKey: null, radius: 0.09, maxAngle: 0.0, invMass: 0.76 },
  { key: 'rUpLeg', names: ['mixamorig:RightUpLeg', 'RightUpLeg'], childKey: 'rLeg', radius: 0.17, maxAngle: 1.08, invMass: 0.28 },
  { key: 'rLeg', names: ['mixamorig:RightLeg', 'RightLeg'], childKey: 'rFoot', radius: 0.13, maxAngle: 0.58, invMass: 0.48 },
  { key: 'rFoot', names: ['mixamorig:RightFoot', 'RightFoot'], childKey: null, radius: 0.09, maxAngle: 0.0, invMass: 0.76 },
];
const ENEMY_RAGDOLL_BRACES = [
  ['hips', 'chest'],
  ['chest', 'lShoulder'],
  ['chest', 'rShoulder'],
  ['lShoulder', 'rShoulder'],
  ['hips', 'lUpLeg'],
  ['hips', 'rUpLeg'],
  ['lUpLeg', 'rUpLeg'],
  ['lShoulder', 'rUpLeg'],
  ['rShoulder', 'lUpLeg'],
];
const ENEMY_RAGDOLL_ROOT_ANCHOR_KEYS = ['hips', 'spine', 'chest'];
const ENEMY_RAGDOLL_GROUND_CONTACT_KEYS = ['hips', 'spine', 'chest', 'lUpLeg', 'rUpLeg'];
const ENEMY_RAGDOLL_SETTLE_FREEZE_FRAMES = 32;
const ENEMY_RAGDOLL_SETTLE_DURATION = ENEMY_RAGDOLL_SETTLE_FREEZE_FRAMES / 60;
const ENEMY_DISSOLVE_DURATION = ENEMY_RAGDOLL_FORCE_SETTLE_TIME + ENEMY_RAGDOLL_SETTLE_DURATION;

function ensureEnemyRagdollDebugVisual() {
  if (!DEBUG_RAGDOLL || enemyRagdollDebugGroup) return;
  enemyRagdollDebugGroup = new THREE.Group();
  enemyRagdollDebugGroup.name = 'enemy-ragdoll-debug';
  enemyRagdollDebugGroup.visible = false;
  scene.add(enemyRagdollDebugGroup);
}

function clearEnemyRagdollDebugVisual() {
  if (!enemyRagdollDebugGroup) return;
  enemyRagdollDebugGroup.visible = false;
  enemyRagdollDebugPoints.length = 0;
  enemyRagdollDebugLines.length = 0;
  while (enemyRagdollDebugGroup.children.length) enemyRagdollDebugGroup.remove(enemyRagdollDebugGroup.children[enemyRagdollDebugGroup.children.length - 1]);
}

function rebuildEnemyRagdollDebugVisual(state) {
  if (!DEBUG_RAGDOLL) return;
  ensureEnemyRagdollDebugVisual();
  clearEnemyRagdollDebugVisual();
  if (!state || !enemyRagdollDebugGroup) return;
  const pointGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const pointMat = new THREE.MeshBasicMaterial({ color: 0x6cf3ff, depthTest: false });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd36c, depthTest: false });
  for (const entry of state.entries) {
    const mesh = new THREE.Mesh(pointGeo, entry.key === 'head' ? headMat : pointMat);
    mesh.renderOrder = 10;
    enemyRagdollDebugGroup.add(mesh);
    enemyRagdollDebugPoints.push({ key: entry.key, mesh });
  }
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7cff7c, depthTest: false });
  for (const constraint of state.constraints) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, lineMat);
    line.renderOrder = 9;
    enemyRagdollDebugGroup.add(line);
    enemyRagdollDebugLines.push({ constraint, line });
  }
  enemyRagdollDebugGroup.visible = true;
}

function updateEnemyRagdollDebugVisual(state) {
  if (!DEBUG_RAGDOLL || !enemyRagdollDebugGroup) return;
  if (!state) {
    enemyRagdollDebugGroup.visible = false;
    return;
  }
  enemyRagdollDebugGroup.visible = true;
  for (const point of enemyRagdollDebugPoints) {
    const entry = state.entryMap.get(point.key);
    if (!entry) continue;
    point.mesh.position.copy(entry.position);
  }
  for (const item of enemyRagdollDebugLines) {
    const a = state.entryMap.get(item.constraint.a);
    const b = state.entryMap.get(item.constraint.b);
    if (!a || !b) continue;
    const positions = item.line.geometry.attributes.position.array;
    positions[0] = a.position.x;
    positions[1] = a.position.y;
    positions[2] = a.position.z;
    positions[3] = b.position.x;
    positions[4] = b.position.y;
    positions[5] = b.position.z;
    item.line.geometry.attributes.position.needsUpdate = true;
    item.line.geometry.computeBoundingSphere();
  }
}

function computeEnemyRagdollBodyAnchor(state) {
  if (!state?.entryMap) return null;
  const anchor = new THREE.Vector3();
  let weightTotal = 0;
  for (const key of ENEMY_RAGDOLL_ROOT_ANCHOR_KEYS) {
    const entry = state.entryMap.get(key);
    if (!entry) continue;
    const weight = key === 'hips' ? 6.0 : (key === 'spine' ? 1.6 : 0.35);
    anchor.addScaledVector(entry.position, weight);
    weightTotal += weight;
  }
  return weightTotal > 0 ? anchor.multiplyScalar(1 / weightTotal) : null;
}

function computeEnemyRagdollPoseAnchor(state) {
  if (!state?.entryMap) return null;
  const anchor = new THREE.Vector3();
  let weightTotal = 0;
  for (const key of ENEMY_RAGDOLL_ROOT_ANCHOR_KEYS) {
    const entry = state.entryMap.get(key);
    if (!entry?.bone) continue;
    const world = new THREE.Vector3();
    entry.bone.getWorldPosition(world);
    const weight = key === 'hips' ? 6.0 : (key === 'spine' ? 1.6 : 0.35);
    anchor.addScaledVector(world, weight);
    weightTotal += weight;
  }
  return weightTotal > 0 ? anchor.multiplyScalar(1 / weightTotal) : null;
}

function computeEnemyRagdollGroundContacts(state) {
  if (!state?.entryMap) return 0;
  let contacts = 0;
  for (const key of ENEMY_RAGDOLL_GROUND_CONTACT_KEYS) {
    const entry = state.entryMap.get(key);
    if (!entry) continue;
    const floorY = findRagdollSupportY(entry.position, entry.radius);
    if (floorY === null) continue;
    if (entry.position.y <= floorY + 0.06) contacts += 1;
  }
  return contacts;
}

function computeEnemyRagdollTorsoContacts(state) {
  if (!state?.entryMap) return 0;
  let contacts = 0;
  for (const key of ENEMY_RAGDOLL_ROOT_ANCHOR_KEYS) {
    const entry = state.entryMap.get(key);
    if (!entry || !entry.grounded) continue;
    contacts += 1;
  }
  return contacts;
}

function isEnemyRagdollCoreNode(node) {
  return Boolean(node && ['hips', 'spine', 'chest', 'neck', 'head'].includes(node.key));
}

function enemyRagdollCollisionFamily(key) {
  if (!key) return 'none';
  if (['hips', 'spine', 'chest', 'neck'].includes(key)) return 'core';
  if (key === 'head') return 'head';
  if (key.startsWith('lShoulder') || key.startsWith('lArm') || key.startsWith('lForeArm') || key === 'lHand') return 'left-arm';
  if (key.startsWith('rShoulder') || key.startsWith('rArm') || key.startsWith('rForeArm') || key === 'rHand') return 'right-arm';
  if (key.startsWith('lUpLeg') || key.startsWith('lLeg') || key === 'lFoot') return 'left-leg';
  if (key.startsWith('rUpLeg') || key.startsWith('rLeg') || key === 'rFoot') return 'right-leg';
  return 'other';
}

function enemyRagdollAllowsSelfCollision(nodeA, nodeB) {
  if (!nodeA || !nodeB) return false;
  const familyA = enemyRagdollCollisionFamily(nodeA.key);
  const familyB = enemyRagdollCollisionFamily(nodeB.key);
  if (familyA === familyB) return false;
  if (familyA === 'core' && familyB === 'core') return false;
  if ((familyA === 'core' && familyB === 'head') || (familyA === 'head' && familyB === 'core')) return false;
  const armLike = new Set(['left-arm', 'right-arm']);
  const legLike = new Set(['left-leg', 'right-leg']);
  if ((armLike.has(familyA) && legLike.has(familyB)) || (armLike.has(familyB) && legLike.has(familyA))) return false;
  if ((familyA === 'core' && armLike.has(familyB)) || (familyB === 'core' && armLike.has(familyA))) {
    return nodeA.key.endsWith('Hand') || nodeB.key.endsWith('Hand');
  }
  if ((familyA === 'core' && legLike.has(familyB)) || (familyB === 'core' && legLike.has(familyA))) {
    return nodeA.key.endsWith('Foot') || nodeB.key.endsWith('Foot');
  }
  if (familyA === 'head' || familyB === 'head') {
    return familyA === 'left-arm' || familyA === 'right-arm' || familyB === 'left-arm' || familyB === 'right-arm';
  }
  return (familyA === 'left-arm' && familyB === 'right-arm')
    || (familyA === 'right-arm' && familyB === 'left-arm')
    || (familyA === 'left-leg' && familyB === 'right-leg')
    || (familyA === 'right-leg' && familyB === 'left-leg');
}

function isEnemyCorpseActive() {
  return Boolean(enemy?.userData?.corpseActive);
}

function summarizeEnemyAttackDebug() {
  if (!DEBUG_ATTACK_SWEEP || !enemy?.userData) return '';
  const attack = enemy.userData.attackDebug;
  if (!attack && !enemy.userData.attackTimer) return '';
  const elapsed = attack?.elapsed ?? enemy.userData.attackElapsed ?? 0;
  const total = attack?.total ?? enemy.userData.attackDef?.clipDuration ?? 0;
  const activeStart = attack?.activeStart ?? enemy.userData.attackDef?.activeStart ?? 0;
  const activeEnd = attack?.activeEnd ?? enemy.userData.attackDef?.activeEnd ?? 0;
  const lungeStart = attack?.lungeStart ?? enemy.userData.attackDef?.lungeStart ?? 0;
  const dist = attack?.distToPlayer ?? enemy.position.distanceTo(player.position);
  const activeFlag = attack?.active ? 'A' : '-';
  const hitFlag = attack?.hitDone ? 'H' : '-';
  const probeReason = attack?.probeReason || '-';
  const probeDist = attack?.probeDistanceSq >= 0 ? Math.sqrt(attack.probeDistanceSq).toFixed(2) : '-';
  const probeThreshold = attack?.probeThresholdSq >= 0 ? Math.sqrt(attack.probeThresholdSq).toFixed(2) : '-';
  const probeHorizontal = attack?.probeHorizontalDistance >= 0 ? attack.probeHorizontalDistance.toFixed(2) : '-';
  return ` | atk ${enemy.userData.attackName || '-'} ${elapsed.toFixed(2)}/${total.toFixed(2)} l${lungeStart.toFixed(2)} a${activeStart.toFixed(2)}-${activeEnd.toFixed(2)} d${dist.toFixed(2)} p${probeHorizontal} ${activeFlag}${hitFlag} ${probeReason} ${probeDist}/${probeThreshold}`;
}

function summarizeEnemyRagdollDebug() {
  const debug = enemy?.userData?.ragdollDebug;
  if (debug?.failure) return ` | rag FAIL ${debug.failure}`;
  if (!DEBUG_RAGDOLL || !debug) return '';
  const action = debug.currentAction ? String(debug.currentAction).slice(0, 8) : '-';
  const audit = debug.dead
    ? ` o${debug.owner || '-'} m${debug.mode || '-'} a${(debug.attackTimer || 0).toFixed(2)} j${debug.navJump ? 1 : 0} x${action} ph${debug.phase || '-'} i${(debug.maxImpactVelocity || 0).toFixed(2)} f${debug.floorHits || 0} cp${(debug.selfCollisionPush || 0).toFixed(2)}`
    : '';
  return ` | rag ${debug.entries}n ${debug.constraints}c ${debug.collisions || 0}p v${debug.maxVelocity.toFixed(2)} d${debug.maxDisplacement.toFixed(2)} h${debug.hipsDisplacement.toFixed(2)} a${(debug.anchorDisplacement || 0).toFixed(2)} s${(debug.maxStretch || 0).toFixed(2)} g${debug.groundContacts || 0} q${(debug.dissolveProgress || 0).toFixed(2)}${audit}`;
}

function buildEnemyRagdollProfile() {
  if (!enemyRuntime.model) {
    if (enemy) enemy.userData.ragdollProfileInfo = { reason: 'no-model', entries: 0, links: 0, missingKeys: [], resolvedKeys: [] };
    return null;
  }
  const entries = [];
  for (const def of ENEMY_RAGDOLL_DEFS) {
    const bone = findBoneByAliases(enemyRuntime.model, def.names);
    if (!bone) continue;
    entries.push({
      key: def.key,
      bone,
      childKey: def.childKey || null,
      radius: def.radius,
      maxAngle: def.maxAngle || 0,
      bindLocalPosition: bone.position.clone(),
      bindLocalQuaternion: bone.quaternion.clone(),
    });
  }
  const entryMap = new Map(entries.map((entry) => [entry.key, entry]));
  const requiredKeys = ['hips', 'spine', 'chest', 'head', 'lArm', 'rArm', 'lUpLeg', 'rUpLeg'];
  const missingKeys = requiredKeys.filter((key) => !entryMap.has(key));
  const earlyReason = !entryMap.has('hips') ? 'missing-hips' : (entries.length < 10 ? 'too-few-entries' : '');
  if (earlyReason) {
    if (enemy) enemy.userData.ragdollProfileInfo = { reason: earlyReason, entries: entries.length, links: 0, missingKeys, resolvedKeys: entries.map((entry) => entry.key) };
    return null;
  }
  const links = [];
  for (const entry of entries) {
    if (entry.childKey && entryMap.has(entry.childKey)) links.push([entry.key, entry.childKey]);
  }
  for (const [a, b] of ENEMY_RAGDOLL_BRACES) {
    if (entryMap.has(a) && entryMap.has(b)) links.push([a, b]);
  }
  const profile = { entries, entryMap, links, missingKeys, resolvedKeys: entries.map((entry) => entry.key) };
  if (enemy) {
    enemy.userData.ragdollProfile = missingKeys.length ? null : profile;
    enemy.userData.ragdollProfileInfo = { reason: missingKeys.length ? 'missing-required' : 'ok', entries: entries.length, links: links.length, missingKeys, resolvedKeys: profile.resolvedKeys.slice() };
  }
  return missingKeys.length ? null : profile;
}

function computeObjectLocalBounds(root) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  let hasBounds = false;
  root.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    const geometry = node.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const localBox = geometry.boundingBox.clone();
    const nodeToRoot = rootInverse.clone().multiply(node.matrixWorld);
    localBox.applyMatrix4(nodeToRoot);
    if (!hasBounds) {
      bounds.copy(localBox);
      hasBounds = true;
    } else {
      bounds.union(localBox);
    }
  });
  return hasBounds ? bounds : null;
}

function fallbackEnemyHitBox() {
  return new THREE.Box3(
    new THREE.Vector3(-0.55, 0, -0.42),
    new THREE.Vector3(0.55, ORC_BERSERKER_TARGET_HEIGHT, 0.42)
  );
}

function cacheEnemyHitBox() {
  if (!enemy) return;
  enemy.userData.hitBox = computeObjectLocalBounds(enemyRuntime.model) || fallbackEnemyHitBox();
}

function resetEnemyDeathState() {
  if (!enemy) return;
  clearEnemyRagdollDebugVisual();
  enemy.userData.ragdollDebug = null;
  const state = enemy.userData.ragdollState;
  const profile = enemy.userData.ragdollProfile;
  const sourceEntries = state?.entries || profile?.entries || [];
  for (const entry of sourceEntries) {
    if (!entry?.bone) continue;
    const bindPos = entry.bindLocalPosition || entry.startLocalPosition;
    const bindQuat = entry.bindLocalQuaternion || entry.startLocalQuaternion;
    if (bindPos) entry.bone.position.copy(bindPos);
    if (bindQuat) entry.bone.quaternion.copy(bindQuat);
  }
  enemy.userData.ragdollState = null;
  enemy.userData.corpseActive = false;
  enemy.userData.suppressEnemyMixer = false;
  enemy.userData.physicsOwner = '';
  resetEnemyDissolve();
  enemyRuntime.currentAction = null;
  if (enemyRuntime.model) enemyRuntime.model.updateMatrixWorld(true);
}

function despawnEnemyCorpse() {
  if (!enemy) return;
  resetEnemyDeathState();
  enemy.userData.dead = false;
  enemy.userData.deathTimer = 0;
  enemy.userData.mode = 'down';
  enemy.scale.setScalar(1);
  enemy.visible = false;
}

function captureEnemyDeathRig() {
  const profile = enemy?.userData?.ragdollProfile || buildEnemyRagdollProfile();
  if (!enemy || !profile) {
    const info = enemy?.userData?.ragdollProfileInfo;
    if (enemy) {
      const failure = info?.reason === 'missing-required' && info?.missingKeys?.length
        ? 'profile-' + info.missingKeys.join(',')
        : ('profile-' + (info?.reason || 'unknown'));
      enemy.userData.ragdollDebug = { failure };
    }
    return null;
  }
  enemyRuntime.model?.updateMatrixWorld?.(true);
  const entries = [];
  const entryMap = new Map();
  for (const profileEntry of profile.entries) {
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    profileEntry.bone.getWorldPosition(worldPosition);
    profileEntry.bone.getWorldQuaternion(worldQuaternion);
    const entry = {
      key: profileEntry.key,
      bone: profileEntry.bone,
      childKey: profileEntry.childKey,
      radius: profileEntry.radius,
      maxAngle: profileEntry.maxAngle || 0,
      invMass: Number.isFinite(profileEntry.invMass) ? profileEntry.invMass : 1,
      bindLocalPosition: profileEntry.bindLocalPosition.clone(),
      bindLocalQuaternion: profileEntry.bindLocalQuaternion.clone(),
      startLocalPosition: profileEntry.bone.position.clone(),
      startLocalQuaternion: profileEntry.bone.quaternion.clone(),
      startWorldQuaternion: worldQuaternion,
      position: worldPosition,
      previous: worldPosition.clone(),
      previousPinned: worldPosition.clone(),
      baseChildDirection: null,
      grounded: false,
      groundedFrames: 0,
      justHitGround: false,
      impactVelocity: 0,
    };
    entries.push(entry);
    entryMap.set(entry.key, entry);
  }
  const constraints = [];
  const linkedPairs = new Set();
  for (const [a, b] of profile.links) {
    const entryA = entryMap.get(a);
    const entryB = entryMap.get(b);
    if (!entryA || !entryB) continue;
    const direct = entryA.childKey === b;
    constraints.push({ a, b, length: entryA.position.distanceTo(entryB.position), brace: !direct, direct });
    linkedPairs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  const collisionPairs = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const entryA = entries[i];
      const entryB = entries[j];
      const pairKey = entryA.key < entryB.key ? `${entryA.key}|${entryB.key}` : `${entryB.key}|${entryA.key}`;
      if (linkedPairs.has(pairKey)) continue;
      if (!enemyRagdollAllowsSelfCollision(entryA, entryB)) continue;
      const minDistance = (entryA.radius + entryB.radius) * ENEMY_RAGDOLL_SELF_COLLISION_SCALE;
      if (minDistance <= 0.000001) continue;
      collisionPairs.push({ a: entryA.key, b: entryB.key, minDistance });
    }
  }
  for (const entry of entries) {
    if (!entry.childKey || !entryMap.has(entry.childKey)) continue;
    const child = entryMap.get(entry.childKey);
    const dir = child.position.clone().sub(entry.position);
    if (dir.lengthSq() > 0.000001) entry.baseChildDirection = dir.normalize();
  }
  const hips = entryMap.get('hips');
  const anchorStart = computeEnemyRagdollBodyAnchor({ entryMap }) || hips?.position.clone() || enemy.position.clone();
  const state = {
    entries,
    entryMap,
    constraints,
    collisionPairs,
    settleFrames: 0,
    settleElapsed: 0,
    settled: false,
    phase: 'flight',
    elapsed: 0,
    motionFade: 0,
    velocityWindow: [],
    rootOffset: enemy.position.clone().sub(anchorStart),
    startHipsPosition: hips ? hips.position.clone() : enemy.position.clone(),
    startAnchorPosition: anchorStart.clone(),
  };
  enemy.userData.ragdollState = state;
  enemy.userData.ragdollDebug = { entries: entries.length, constraints: constraints.length, collisions: collisionPairs.length, maxVelocity: 0, maxDisplacement: 0, hipsDisplacement: 0, owner: 'ragdoll' };
  rebuildEnemyRagdollDebugVisual(state);
  return state;
}

function findRagdollSupportY(position, radius) {
  const support = findEnemySupport(position.x, position.z, position.y + radius + 0.2, ENEMY_STEP_UP + 1.4, ENEMY_STEP_DOWN + 10.0);
  return support ? support.topY + radius : null;
}

function integrateEnemyRagdollNode(node, dtSq, phase = 'flight', motionFade = 0) {
  const settling = phase === 'settle';
  const decaying = phase === 'decay';
  const fade = settling ? 1 : (decaying ? motionFade : 0);
  const drag = settling
    ? (node.groundedFrames > 0 ? 0.45 : 0.58)
    : (node.groundedFrames > 0 ? ENEMY_RAGDOLL_GROUNDED_DRAG : ENEMY_RAGDOLL_DRAG);
  const velocity = node.position.clone().sub(node.previous).multiplyScalar(drag);
  if (settling) {
    const core = isEnemyRagdollCoreNode(node);
    const damp = node.groundedFrames > 0
      ? (core ? ENEMY_RAGDOLL_SETTLE_CORE_DAMPING : ENEMY_RAGDOLL_SETTLE_ENTRY_DAMPING)
      : ENEMY_RAGDOLL_SETTLE_AIR_DAMPING;
    velocity.x *= damp;
    velocity.z *= damp;
    if (velocity.y > 0) velocity.y = 0;
    else velocity.y *= node.groundedFrames > 0 ? 0.05 : 0.18;
  } else if (decaying) {
    const groundedHoriz = 0.9 + (0.18 - 0.9) * fade;
    const airHoriz = 1.0 + (0.3 - 1.0) * fade;
    const horiz = node.groundedFrames > 0 ? groundedHoriz : airHoriz;
    velocity.x *= horiz;
    velocity.z *= horiz;
    if (velocity.y > 0) velocity.y *= Math.max(0, 1 - fade);
    else velocity.y *= node.groundedFrames > 0 ? Math.max(0.06, 0.35 - 0.22 * fade) : Math.max(0.2, 0.65 - 0.3 * fade);
  } else if (node.groundedFrames > 0) {
    velocity.x *= 0.9;
    velocity.z *= 0.9;
    if (velocity.y > 0) velocity.y *= 0.18;
  }
  node.justHitGround = false;
  node.previous.copy(node.position);
  node.position.add(velocity);
  node.position.y -= ENEMY_RAGDOLL_GRAVITY * dtSq;
}

function constrainEnemyRagdollNode(node, phase = 'flight', motionFade = 0) {
  const bounds = roomState.bounds;
  if (bounds) {
    node.position.x = clamp(node.position.x, bounds.minX + node.radius, bounds.maxX - node.radius);
    node.position.z = clamp(node.position.z, bounds.minZ + node.radius, bounds.maxZ - node.radius);
  }
  const floorY = findRagdollSupportY(node.position, node.radius);
  if (floorY === null || node.position.y >= floorY) {
    node.grounded = false;
    node.groundedFrames = 0;
    node.impactVelocity = 0;
    return;
  }
  const wasGrounded = node.groundedFrames > 0;
  const settling = phase === 'settle';
  const decaying = phase === 'decay';
  const fade = settling ? 1 : (decaying ? motionFade : 0);
  const vx = node.position.x - node.previous.x;
  const vy = node.position.y - node.previous.y;
  const vz = node.position.z - node.previous.z;
  const core = isEnemyRagdollCoreNode(node);
  node.position.y = floorY;
  node.grounded = true;
  node.justHitGround = !wasGrounded;
  node.groundedFrames = wasGrounded ? (node.groundedFrames + 1) : 1;
  node.impactVelocity = Math.max(0, -vy);
  const baseRetain = node.justHitGround ? ENEMY_RAGDOLL_FLOOR_IMPACT_FRICTION : (core ? ENEMY_RAGDOLL_FLOOR_FRICTION : ENEMY_RAGDOLL_FLOOR_FRICTION + 0.06);
  const targetRetain = core ? ENEMY_RAGDOLL_SETTLE_CORE_DAMPING : ENEMY_RAGDOLL_SETTLE_ENTRY_DAMPING;
  const horizontalRetain = settling
    ? targetRetain
    : (decaying ? (baseRetain + (targetRetain - baseRetain) * fade) : baseRetain);
  const baseBounce = node.justHitGround ? (core ? 0 : ENEMY_RAGDOLL_FLOOR_IMPACT_BOUNCE) : (core ? 0 : ENEMY_RAGDOLL_FLOOR_BOUNCE);
  const bounce = settling
    ? 0
    : (decaying ? baseBounce * Math.max(0, 1 - fade) : baseBounce);
  node.previous.x = node.position.x - vx * horizontalRetain;
  node.previous.z = node.position.z - vz * horizontalRetain;
  node.previous.y = node.position.y + node.impactVelocity * bounce;
}

function beginEnemyRagdollSettle(state) {
  if (!state || state.phase === 'settle' || state.settled) return;
  state.phase = 'settle';
  state.motionFade = 1;
  state.settleFrames = 0;
  state.settleElapsed = 0;
  state.velocityWindow.length = 0;
  for (const entry of state.entries) {
    const core = isEnemyRagdollCoreNode(entry);
    const vx = entry.position.x - entry.previous.x;
    const vz = entry.position.z - entry.previous.z;
    const damp = entry.groundedFrames > 0
      ? (core ? ENEMY_RAGDOLL_SETTLE_CORE_DAMPING : ENEMY_RAGDOLL_SETTLE_ENTRY_DAMPING)
      : ENEMY_RAGDOLL_SETTLE_AIR_DAMPING;
    entry.previous.x = entry.position.x - vx * damp;
    entry.previous.z = entry.position.z - vz * damp;
    entry.previous.y = entry.position.y;
  }
}

function solveEnemyRagdollConstraint(nodeA, nodeB, length, direct = false, brace = false) {
  const delta = nodeB.position.clone().sub(nodeA.position);
  const dist = delta.length();
  if (dist <= 0.000001) return;
  const error = (dist - length) / dist;
  const stiffness = direct ? 0.96 : (brace ? 0.16 : 0.5);
  const totalInvMass = Math.max(0.000001, (nodeA.invMass || 1) + (nodeB.invMass || 1));
  const moveA = (nodeA.invMass || 1) / totalInvMass;
  const moveB = (nodeB.invMass || 1) / totalInvMass;
  const correction = delta.multiplyScalar(error * stiffness);
  nodeA.position.addScaledVector(correction, moveA);
  nodeB.position.addScaledVector(correction, -moveB);
}

function solveEnemyRagdollVolumeCollision(nodeA, nodeB, minDistance) {
  if (!nodeA || !nodeB || minDistance <= 0.000001) return 0;
  const groundedA = nodeA.groundedFrames > 0;
  const groundedB = nodeB.groundedFrames > 0;
  const delta = nodeB.position.clone().sub(nodeA.position);
  if (groundedA && groundedB) delta.y *= ENEMY_RAGDOLL_SELF_COLLISION_VERTICAL_SCALE;
  let dist = delta.length();
  if (dist <= 0.000001) {
    delta.set(nodeB.key < nodeA.key ? -1 : 1, 0, 0);
    dist = 1;
  }
  if (dist >= minDistance) return 0;
  const dir = delta.multiplyScalar(1 / dist);
  const stiffness = groundedA || groundedB
    ? ENEMY_RAGDOLL_SELF_COLLISION_GROUNDED_STIFFNESS
    : ENEMY_RAGDOLL_SELF_COLLISION_STIFFNESS;
  const correction = Math.min(ENEMY_RAGDOLL_SELF_COLLISION_MAX_PUSH, (minDistance - dist) * stiffness);
  const totalInvMass = Math.max(0.000001, (nodeA.invMass || 1) + (nodeB.invMass || 1));
  let moveA = correction * ((nodeA.invMass || 1) / totalInvMass);
  let moveB = correction * ((nodeB.invMass || 1) / totalInvMass);
  if (groundedA && !groundedB) {
    moveA = correction * 0.18;
    moveB = correction * 0.82;
  } else if (!groundedA && groundedB) {
    moveA = correction * 0.82;
    moveB = correction * 0.18;
  }
  const offsetA = dir.clone().multiplyScalar(-moveA);
  const offsetB = dir.clone().multiplyScalar(moveB);
  if (groundedA) offsetA.y *= groundedB ? 0.05 : 0.12;
  if (groundedB) offsetB.y *= groundedA ? 0.05 : 0.12;
  nodeA.position.add(offsetA);
  nodeB.position.add(offsetB);
  return correction;
}

function applyEnemyRagdollVolumeCollisions(state) {
  if (!state?.collisionPairs?.length || state.phase === 'settle' || (state.motionFade || 0) > 0.6) return 0;
  let totalPush = 0;
  for (const pair of state.collisionPairs) {
    const nodeA = state.entryMap.get(pair.a);
    const nodeB = state.entryMap.get(pair.b);
    if (!nodeA || !nodeB) continue;
    totalPush += solveEnemyRagdollVolumeCollision(nodeA, nodeB, pair.minDistance);
  }
  return totalPush;
}

function clampEnemyRagdollJointLimit(parent, child) {
  if (!parent?.baseChildDirection || !child || !parent.maxAngle || parent.maxAngle <= 0) return;
  const delta = child.position.clone().sub(parent.position);
  const dist = delta.length();
  if (dist <= 0.000001) return;
  const currentDir = delta.clone().multiplyScalar(1 / dist);
  const baseDir = parent.baseChildDirection;
  const angle = baseDir.angleTo(currentDir);
  if (angle <= parent.maxAngle) return;
  const axis = new THREE.Vector3().crossVectors(baseDir, currentDir);
  if (axis.lengthSq() <= 0.000001) {
    child.position.copy(parent.position).addScaledVector(baseDir, dist);
    return;
  }
  axis.normalize();
  const clampedDir = baseDir.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, parent.maxAngle)).normalize();
  child.position.copy(parent.position).addScaledVector(clampedDir, dist);
}

function applyEnemyRagdollJointLimits(state) {
  if (!state?.entries) return;
  for (const entry of state.entries) {
    if (!entry.childKey) continue;
    const child = state.entryMap.get(entry.childKey);
    if (!child) continue;
    clampEnemyRagdollJointLimit(entry, child);
  }
}

function applyEnemyDeathPose() {
  const state = enemy?.userData?.ragdollState;
  if (!enemy || !enemyRuntime.model || !state) return;
  if (!enemyRuntime.model.visible && enemy.userData.dissolveProgress < 0.999) enemyRuntime.model.visible = true;
  const inverseParent = new THREE.Quaternion();
  const targetWorld = new THREE.Quaternion();
  const swing = new THREE.Quaternion();
  const bodyAnchor = computeEnemyRagdollBodyAnchor(state);
  const desiredAnchor = bodyAnchor ? bodyAnchor.clone() : null;
  if (desiredAnchor) {
    enemy.position.copy(desiredAnchor).add(state.rootOffset || new THREE.Vector3());
    enemy.userData.baseY = enemy.position.y;
  }
  for (const entry of state.entries) {
    entry.bone.position.copy(entry.bindLocalPosition || entry.startLocalPosition);
  }
  enemyRuntime.model.updateMatrixWorld(true);
  for (const entry of state.entries) {
    const child = entry.childKey ? state.entryMap.get(entry.childKey) : null;
    if (!child || !entry.baseChildDirection) {
      entry.bone.quaternion.copy(entry.startLocalQuaternion);
      continue;
    }
    const currentDir = child.position.clone().sub(entry.position);
    if (currentDir.lengthSq() <= 0.000001) {
      entry.bone.quaternion.copy(entry.startLocalQuaternion);
      continue;
    }
    currentDir.normalize();
    swing.setFromUnitVectors(entry.baseChildDirection, currentDir);
    targetWorld.copy(swing).multiply(entry.startWorldQuaternion);
    const parentObject = entry.bone.parent && entry.bone.parent.isBone ? entry.bone.parent : enemyRuntime.model;
    parentObject.getWorldQuaternion(inverseParent).invert();
    entry.bone.quaternion.copy(inverseParent.multiply(targetWorld));
    entry.bone.updateMatrixWorld(true);
  }
  enemyRuntime.model.updateMatrixWorld(true);
  if (desiredAnchor) {
    const posedAnchor = computeEnemyRagdollPoseAnchor(state);
    if (posedAnchor) {
      const correction = desiredAnchor.sub(posedAnchor);
      enemy.position.add(correction);
      enemy.userData.baseY = enemy.position.y;
      enemyRuntime.model.updateMatrixWorld(true);
    }
  }
}

function updateEnemyRagdollDeath(dt) {
  const state = enemy?.userData?.ragdollState;
  if (!enemy || !state) return;
  if (state.settled) {
    syncEnemyDissolveToRagdollState(state);
    applyEnemyDeathPose();
    updateEnemyRagdollDebugVisual(state);
    enemy.userData.ragdollDebug = {
      ...(enemy.userData.ragdollDebug || {}),
      dead: !!enemy.userData.dead,
      corpseActive: !!enemy.userData.corpseActive,
      owner: enemy.userData.physicsOwner || '-',
      mode: enemy.userData.mode || '-',
      attackTimer: enemy.userData.attackTimer || 0,
      navJump: !!getEnemyNavState()?.jump,
      currentAction: enemyRuntime.currentAction?.getClip?.().name || '',
      phase: state.phase || 'settled',
      settled: true,
      settleFrames: state.settleFrames || 0,
      dissolveProgress: enemy.userData.dissolveProgress || 0,
    };
    return;
  }
  const substeps = Math.max(1, ENEMY_RAGDOLL_SUBSTEPS);
  const subDt = dt / substeps;
  const dtSq = subDt * subDt;
  let moving = false;
  let maxVelocitySq = 0;
  let maxDisplacement = 0;
  let maxStretch = 0;
  let groundContacts = 0;
  let torsoContacts = 0;
  let floorHits = 0;
  let maxImpactVelocity = 0;
  let selfCollisionPush = 0;
  let velocityTotal = 0;
  let anchorDrift = 0;
  state.elapsed = (state.elapsed || 0) + dt;
  state.motionFade = clamp((state.elapsed - ENEMY_RAGDOLL_DECAY_DELAY) / ENEMY_RAGDOLL_DECAY_DURATION, 0, 1);
  if (state.phase === 'flight' && state.motionFade > 0) state.phase = 'decay';
  if (state.phase !== 'settle' && state.elapsed >= ENEMY_RAGDOLL_FORCE_SETTLE_TIME) beginEnemyRagdollSettle(state);
  for (let step = 0; step < substeps; step += 1) {
    for (const entry of state.entries) integrateEnemyRagdollNode(entry, dtSq, state.phase, state.motionFade);
    for (let i = 0; i < ENEMY_RAGDOLL_ITERATIONS; i += 1) {
      for (const constraint of state.constraints) {
        const nodeA = state.entryMap.get(constraint.a);
        const nodeB = state.entryMap.get(constraint.b);
        if (!nodeA || !nodeB) continue;
        solveEnemyRagdollConstraint(nodeA, nodeB, constraint.length, constraint.direct, constraint.brace);
      }
      applyEnemyRagdollJointLimits(state);
      for (const entry of state.entries) constrainEnemyRagdollNode(entry, state.phase, state.motionFade);
      selfCollisionPush += applyEnemyRagdollVolumeCollisions(state);
      for (const entry of state.entries) constrainEnemyRagdollNode(entry, state.phase, state.motionFade);
    }
  }
  for (const entry of state.entries) {
    const vx = entry.position.x - entry.previous.x;
    const vy = entry.position.y - entry.previous.y;
    const vz = entry.position.z - entry.previous.z;
    const velocitySq = vx * vx + vy * vy + vz * vz;
    const velocity = Math.sqrt(velocitySq);
    velocityTotal += velocity;
    if (velocitySq > ENEMY_RAGDOLL_SETTLE_SPEED_SQ) moving = true;
    if (velocitySq > maxVelocitySq) maxVelocitySq = velocitySq;
    if (entry.justHitGround) floorHits += 1;
    if ((entry.impactVelocity || 0) > maxImpactVelocity) maxImpactVelocity = entry.impactVelocity || 0;
    if (entry.key === 'hips' && state.startHipsPosition) {
      const hipsDisp = entry.position.distanceTo(state.startHipsPosition);
      if (hipsDisp > maxDisplacement) maxDisplacement = hipsDisp;
    }
  }
  for (const constraint of state.constraints) {
    if (!constraint.direct) continue;
    const nodeA = state.entryMap.get(constraint.a);
    const nodeB = state.entryMap.get(constraint.b);
    if (!nodeA || !nodeB || constraint.length <= 0.000001) continue;
    const stretch = Math.abs(nodeA.position.distanceTo(nodeB.position) - constraint.length) / constraint.length;
    if (stretch > maxStretch) maxStretch = stretch;
  }
  groundContacts = computeEnemyRagdollGroundContacts(state);
  torsoContacts = computeEnemyRagdollTorsoContacts(state);
  const avgVelocity = state.entries.length ? velocityTotal / state.entries.length : 0;
  state.velocityWindow.push(avgVelocity);
  if (state.velocityWindow.length > 6) state.velocityWindow.shift();
  const avgWindowVelocity = state.velocityWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, state.velocityWindow.length);
  const quiet = state.phase === 'settle'
    ? (avgWindowVelocity < 0.12 && maxVelocitySq < 0.08 && selfCollisionPush < 0.08)
    : (state.motionFade > 0.9 && avgWindowVelocity < 0.16);
  if (state.phase === 'settle') {
    state.settleElapsed = Math.min(ENEMY_RAGDOLL_SETTLE_DURATION, (state.settleElapsed || 0) + dt);
    state.settleFrames = Math.max(0, state.settleFrames || 0) + 1;
  } else {
    state.settleElapsed = 0;
    state.settleFrames = 0;
  }
  if (state.phase === 'settle' && state.settleElapsed >= ENEMY_RAGDOLL_SETTLE_DURATION) {
    state.settled = true;
    for (const entry of state.entries) entry.previous.copy(entry.position);
  }
  syncEnemyDissolveToRagdollState(state);
  applyEnemyDeathPose();
  updateEnemyRagdollDebugVisual(state);
  const hips = state.entryMap.get('hips');
  const anchor = computeEnemyRagdollBodyAnchor(state);
  anchorDrift = anchor && state.startAnchorPosition ? anchor.distanceTo(state.startAnchorPosition) : 0;
  enemy.userData.ragdollDebug = {
    entries: state.entries.length,
    constraints: state.constraints.length,
    collisions: state.collisionPairs?.length || 0,
    maxVelocity: Math.sqrt(maxVelocitySq),
    avgVelocity: avgWindowVelocity,
    maxImpactVelocity,
    floorHits,
    selfCollisionPush,
    dissolveProgress: enemy.userData.dissolveProgress || 0,
    maxDisplacement,
    hipsDisplacement: hips && state.startHipsPosition ? hips.position.distanceTo(state.startHipsPosition) : 0,
    anchorDisplacement: anchorDrift,
    maxStretch,
    groundContacts,
    torsoContacts,
    settleFrames: state.settleFrames || 0,
    settled: !!state.settled,
    dead: !!enemy.userData.dead,
    corpseActive: !!enemy.userData.corpseActive,
    owner: enemy.userData.physicsOwner || '-',
    mode: enemy.userData.mode || '-',
    attackTimer: enemy.userData.attackTimer || 0,
    navJump: !!getEnemyNavState()?.jump,
    currentAction: enemyRuntime.currentAction?.getClip?.().name || '',
    phase: state.phase,
    elapsed: state.elapsed || 0,
    motionFade: state.motionFade || 0,
  };
}

function startEnemyDeath(attackDirection, damage = 1) {
  if (!enemy || enemy.userData.dead) return;
  const push = attackDirection ? attackDirection.clone() : new THREE.Vector3(0, 0, -1);
  push.y = 0;
  if (push.lengthSq() < 0.0001) push.set(0, 0, -1);
  push.normalize();
  const state = captureEnemyDeathRig();
  if (!state) {
    const fail = enemy.userData.ragdollDebug?.failure || 'capture-null';
    setStatus('ragdoll failed: ' + fail);
    hintEl.textContent = 'Ragdoll failed: ' + fail;
    hintEl.style.opacity = '1';
    return;
  }
  enemy.userData.dead = true;
  enemy.userData.corpseActive = true;
  enemy.userData.suppressEnemyMixer = true;
  enemy.userData.physicsOwner = 'ragdoll';
  enemy.userData.deathTimer = ENEMY_DEATH_DESPAWN_DELAY;
  enemy.userData.hitTimer = 0;
  enemy.userData.attackTimer = 0;
  enemy.userData.attackElapsed = 0;
  enemy.userData.attackHitDone = false;
  enemy.userData.attackName = '';
  enemy.userData.attackDefKey = '';
  enemy.userData.attackDef = null;
  enemy.userData.attackPrevHand = null;
  enemy.userData.attackCurrentHand = null;
  enemy.userData.attackContactPoint = null;
  enemy.userData.mode = 'dead';
  enemy.userData.modeTimer = 0;
  enemy.userData.commitTimer = 0;
  enemy.userData.commitElapsed = 0;
  const sideImpulse = enemy.userData.lastHitLocalX || 0;
  for (const entry of state.entries) {
    const scale = entry.key === 'hips' || entry.key === 'spine' || entry.key === 'chest'
      ? 1.0
      : (entry.key === 'head' || entry.key.endsWith('Hand') || entry.key.endsWith('Foot') ? 0.78 : 0.88);
    const lift = entry.key === 'hips' || entry.key === 'spine' || entry.key === 'chest' ? 1.0 : 0.58;
    const lateral = entry.key.startsWith('l') ? -1 : (entry.key.startsWith('r') ? 1 : 0);
    const impulse = push.clone().multiplyScalar((ENEMY_DEATH_LAUNCH_SPEED + damage * 0.32) * scale);
    impulse.y = (ENEMY_DEATH_UPWARD_SPEED + damage * 0.18) * lift;
    impulse.add(new THREE.Vector3(0.45 * lateral * sideImpulse, 0, 0));
    entry.previous.copy(entry.position.clone().sub(impulse.multiplyScalar(1 / 60)));
  }
  if (DEBUG_RAGDOLL) console.info('enemy ragdoll start', { entries: state.entries.length, constraints: state.constraints.length, keys: state.entries.map((entry) => entry.key) });
  if (enemyRuntime.mixer) enemyRuntime.mixer.stopAllAction();
  enemyRuntime.currentAction = null;
  const nav = getEnemyNavState();
  if (nav) {
    clearEnemyRoute(nav);
    nav.jump = null;
  }
  applyEnemyDeathPose();
}

function cameraAimDirection() {
  const dir = new THREE.Vector3();
  if (camera?.getWorldDirection) {
    camera.getWorldDirection(dir);
    if (dir.lengthSq() > 0.0001) return dir.normalize();
  }
  const yaw = player.yaw + (input.gyroYaw || 0);
  const pitch = player.pitch + (input.gyroPitch || 0);
  const cosPitch = Math.cos(pitch);
  return new THREE.Vector3(-Math.sin(yaw) * cosPitch, -Math.sin(pitch), -Math.cos(yaw) * cosPitch).normalize();
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
        && solid.sizeX >= PLAYER_SOLID_RADIUS * 2
        && solid.sizeZ >= PLAYER_SOLID_RADIUS * 2
        && horizontalContainsShape(solid, position.x, position.z, -radius);
      if (canStepUp) {
        position.y = Math.max(position.y, solid.maxY + PLAYER_EYE_HEIGHT);
        velocity.y = Math.max(0, velocity.y);
        continue;
      }
      if (solid.shape === 'obb') {
        const local = toOrientedLocal(position.x, position.z, solid.centerX, solid.centerZ, solid.yaw || 0);
        const halfX = solid.sizeX * 0.5 + radius;
        const halfZ = solid.sizeZ * 0.5 + radius;
        const dxFace = halfX - Math.abs(local.x);
        const dzFace = halfZ - Math.abs(local.z);
        if (dxFace <= dzFace) local.x = (local.x < 0 ? -halfX : halfX);
        else local.z = (local.z < 0 ? -halfZ : halfZ);
        const c = Math.cos(solid.yaw || 0);
        const s = Math.sin(solid.yaw || 0);
        position.x = solid.centerX + local.x * c + local.z * s;
        position.z = solid.centerZ - local.x * s + local.z * c;
        if (dxFace <= dzFace) velocity.x = 0; else velocity.z = 0;
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

function effectiveSupportStepDown(feetY, prevFeetY, baseStepDown) {
  const sweepDrop = Number.isFinite(prevFeetY) ? Math.max(0, prevFeetY - feetY) : 0;
  return Math.max(baseStepDown, sweepDrop + 0.2);
}

function resolveSolidTopSupport(x, z, feetY, velocityY, prevFeetY = feetY) {
  let best = null;
  const stepDown = effectiveSupportStepDown(feetY, prevFeetY, SUPPORT_SNAP_DOWN);
  for (const solid of solidColliders) {
    if (!solidTopWalkable(solid)) continue;
    if (!horizontalContainsShape(solid, x, z, PLAYER_SOLID_RADIUS)) continue;
    const topY = solid.maxY;
    if (velocityY > 0.5 && feetY < topY - 0.14) continue;
    if (feetY > topY + SUPPORT_SNAP_UP) continue;
    if (feetY < topY - stepDown) continue;
    if (!best || topY > best.topY) best = { topY, solid };
  }
  return best;
}

function canStandOnSolidTop(solid, x, z) {
  if (!solidTopWalkable(solid)) return false;
  return horizontalContainsShape(solid, x, z, PLAYER_SOLID_RADIUS);
}

function resolveMeshSupportHeight(x, z, feetY, velocityY, stepUp = SUPPORT_SNAP_UP, stepDown = SUPPORT_SNAP_DOWN, prevFeetY = feetY) {
  let best = null;
  stepDown = effectiveSupportStepDown(feetY, prevFeetY, stepDown);
  const originY = Math.max(feetY, prevFeetY) + stepUp + 6.0;
  meshSupportRaycaster.set(new THREE.Vector3(x, originY, z), DOWN_VECTOR);
  meshSupportRaycaster.far = stepUp + stepDown + 12.0;
  for (const collider of meshSupportColliders) {
    const box = collider.bounds;
    if (!box) continue;
    if (x < box.min.x - PLAYER_SOLID_RADIUS || x > box.max.x + PLAYER_SOLID_RADIUS) continue;
    if (z < box.min.z - PLAYER_SOLID_RADIUS || z > box.max.z + PLAYER_SOLID_RADIUS) continue;
    const hits = meshSupportRaycaster.intersectObject(collider.object, true);
    for (const hit of hits) {
      const worldNormal = hit.face?.normal?.clone?.().transformDirection(hit.object.matrixWorld);
      if (!worldNormal || worldNormal.y < 0.2) continue;
      const topY = hit.point.y;
      if (velocityY > 0.5 && feetY < topY - 0.14) continue;
      if (feetY > topY + stepUp) continue;
      if (feetY < topY - stepDown) continue;
      if (!best || topY > best.topY) best = { topY, collider, point: hit.point.clone() };
      break;
    }
  }
  return best;
}

function faceYawFromNormal(normal) {
  return Math.atan2(-normal.x, -normal.z);
}

function playerHasFallSafeTerrainSupport() {
  if (player.grounded) return true;
  const physics = roomState.physicsWorld?.snapshot?.();
  if (physics?.grounded) return true;
  const feetY = player.position.y - PLAYER_EYE_HEIGHT;
  const terrainSupport = roomState.terrainLayer?.supportAt(player.position.x, player.position.z, feetY, {
    radius: PLAYER_SOLID_RADIUS,
    stepUp: SUPPORT_SNAP_UP,
    stepDown: Math.max(SUPPORT_SNAP_DOWN, 2.6),
    velocityY: player.velocity.y,
    prevFeetY: feetY,
  });
  return !!terrainSupport;
}

function finalizePlayerFrame(dt, now, stickMagnitude) {
  player.position.x = clamp(player.position.x, roomState.levelBounds?.minX ?? -14, roomState.levelBounds?.maxX ?? 14);
  player.position.z = clamp(player.position.z, roomState.levelBounds?.minZ ?? -18, roomState.levelBounds?.maxZ ?? 18);
  if (player.grounded && player.runCharge < RUN_BUILD_TIME && stickMagnitude < 0.18) player.runCharge = Math.max(0, player.runCharge - dt * 0.4);
  if (roomState.transitionLock > 0) roomState.transitionLock = Math.max(0, roomState.transitionLock - dt);
  if (exitCompletionEnabled() && player.grounded && roomState.transitionLock <= 0) {
    const dx = player.position.x - roomState.exit.x;
    const dz = player.position.z - roomState.exit.z;
    const dy = player.position.y - roomState.exit.y;
    if (Math.hypot(dx, dz) < roomState.exitRadius && Math.abs(dy) < 1.8) completeGeneratedGauntlet();
  }
  updateCurrentGauntletRoom();
  if (player.position.y < KILL_Y && !playerHasFallSafeTerrainSupport()) {
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
  const shake = currentHitShake();
  if (shake) camera.position.add(new THREE.Vector3(shake.x, shake.y, 0));
  skyDome.position.copy(camera.position);
  camera.rotation.y = player.yaw + input.gyroYaw + (shake?.yaw || 0);
  camera.rotation.x = player.pitch + input.gyroPitch + (shake?.pitch || 0);
}

function resolveSupportHeight(x, z, feetY, velocityY, prevFeetY = feetY) {
  let best = null;
  for (const surface of walkableSurfaces) {
    if (x < surface.minX - SUPPORT_RADIUS || x > surface.maxX + SUPPORT_RADIUS) continue;
    if (z < surface.minZ - SUPPORT_RADIUS || z > surface.maxZ + SUPPORT_RADIUS) continue;
    if (!horizontalContainsShape(surface, x, z, -SUPPORT_RADIUS)) continue;
    if (velocityY > 0.5 && feetY < surface.topY - 0.14) continue;
    if (feetY > surface.topY + SUPPORT_SNAP_UP) continue;
    if (feetY < surface.topY - SUPPORT_SNAP_DOWN) continue;
    if (!best || surface.topY > best.topY) best = surface;
  }
  const terrainSupport = roomState.terrainLayer?.supportAt(x, z, feetY, {
    radius: PLAYER_SOLID_RADIUS,
    stepUp: SUPPORT_SNAP_UP,
    stepDown: SUPPORT_SNAP_DOWN,
    velocityY,
    prevFeetY,
  });
  if (terrainSupport && (!best || terrainSupport.topY > best.topY)) best = terrainSupport;
  const voxelSupport = resolveVoxelSupportHeight(x, z, feetY, velocityY, SUPPORT_SNAP_UP, SUPPORT_SNAP_DOWN, prevFeetY);
  if (voxelSupport && (!best || voxelSupport.topY > best.topY)) best = voxelSupport;
  const meshSupport = resolveMeshSupportHeight(x, z, feetY, velocityY, SUPPORT_SNAP_UP, SUPPORT_SNAP_DOWN, prevFeetY);
  if (meshSupport && (!best || meshSupport.topY > best.topY)) best = meshSupport;
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
    const samples = surface.shape === 'obb'
      ? [new THREE.Vector3(surface.centerX, 0, surface.centerZ)]
      : [new THREE.Vector3(clamp(position.x, surface.minX, surface.maxX), 0, clamp(position.z, surface.minZ, surface.maxZ))];
    for (const sample of samples) {
      const dx = sample.x - position.x;
      const dz = sample.z - position.z;
      const along = dx * dir.x + dz * dir.z;
      const lateral = Math.abs(dx * perp.x + dz * perp.z);
      if (along < -0.06 || along > WALKABLE_STEP_FORWARD_REACH) continue;
      if (lateral > SUPPORT_RADIUS + 0.18) continue;
      const score = (surface.traversalCritical ? -0.2 : 0) + along + deltaY * 0.35 + lateral * 0.25;
      if (!best || score < best.score) best = { surface, targetX: sample.x, targetZ: sample.z, score };
    }
  }
  return best;
}

function findEnemySupport(x, z, referenceY, stepUp = ENEMY_STEP_UP, stepDown = ENEMY_STEP_DOWN) {
  let best = null;
  for (const surface of walkableSurfaces) {
    if (x < surface.minX - ENEMY_FLOOR_RADIUS || x > surface.maxX + ENEMY_FLOOR_RADIUS) continue;
    if (z < surface.minZ - ENEMY_FLOOR_RADIUS || z > surface.maxZ + ENEMY_FLOOR_RADIUS) continue;
    if (!horizontalContainsShape(surface, x, z, -ENEMY_FLOOR_RADIUS)) continue;
    const deltaY = surface.topY - referenceY;
    if (deltaY > stepUp || deltaY < -stepDown) continue;
    if (!best || surface.topY > best.topY) best = surface;
  }
  const terrainSupport = roomState.terrainLayer?.supportAt(x, z, referenceY, {
    radius: ENEMY_FLOOR_RADIUS,
    stepUp,
    stepDown,
    velocityY: 0,
    prevFeetY: referenceY,
  });
  if (terrainSupport && (!best || terrainSupport.topY > best.topY)) best = terrainSupport;
  const voxelSupport = resolveVoxelSupportHeight(x, z, referenceY, 0, stepUp, stepDown);
  if (voxelSupport && (!best || voxelSupport.topY > best.topY)) best = voxelSupport;
  const meshSupport = resolveMeshSupportHeight(x, z, referenceY, 0, stepUp, stepDown);
  if (meshSupport && (!best || meshSupport.topY > best.topY)) best = meshSupport;
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
    if (!horizontalContainsShape(solid, x, z, -ENEMY_SOLID_RADIUS)) continue;
    return true;
  }
  if (voxelBodyBlockedAt(x, z, minY, maxY, ENEMY_SOLID_RADIUS)) return true;
  return false;
}


function enemyPlayerVerticalOverlap(playerPos = player.position, enemyPos = enemy?.position, enemyBaseY = enemy?.userData?.baseY) {
  if (!playerPos || !enemyPos || !enemy) return false;
  const playerFeetY = playerPos.y - PLAYER_EYE_HEIGHT;
  const playerHeadY = playerPos.y;
  const enemyFeetY = Number.isFinite(enemyBaseY) ? enemyBaseY : enemyPos.y;
  const enemyHeadY = enemyFeetY + ORC_BERSERKER_TARGET_HEIGHT * 0.9;
  return playerHeadY >= enemyFeetY - ENEMY_PLAYER_COLLISION_VERTICAL_GRACE && playerFeetY <= enemyHeadY + ENEMY_PLAYER_COLLISION_VERTICAL_GRACE;
}

function resolvePlayerEnemyOverlapForPlayer(position, velocity = player.velocity) {
  if (!enemy?.visible || enemy.userData?.dead || !enemyPlayerVerticalOverlap(position, enemy.position, enemy.userData?.baseY)) return false;
  const dx = position.x - enemy.position.x;
  const dz = position.z - enemy.position.z;
  const distSq = dx * dx + dz * dz;
  if (distSq >= ENEMY_PLAYER_COLLISION_RADIUS_SQ) return false;
  const dist = Math.sqrt(Math.max(0.000001, distSq));
  const push = ENEMY_PLAYER_COLLISION_RADIUS - dist;
  const nx = dist > 0.0001 ? dx / dist : (cameraForwardYaw(player.yaw).x || 1);
  const nz = dist > 0.0001 ? dz / dist : (cameraForwardYaw(player.yaw).z || 0);
  position.x += nx * push;
  position.z += nz * push;
  if (velocity) {
    const towardEnemy = velocity.x * -nx + velocity.z * -nz;
    if (towardEnemy > 0) {
      velocity.x += nx * towardEnemy;
      velocity.z += nz * towardEnemy;
    }
  }
  return true;
}

function clampEnemyAgainstPlayer(next, direction = null) {
  if (!enemy?.visible || enemy.userData?.dead || !enemyPlayerVerticalOverlap(player.position, next, enemy.userData?.baseY)) return false;
  const dx = next.x - player.position.x;
  const dz = next.z - player.position.z;
  const distSq = dx * dx + dz * dz;
  if (distSq >= ENEMY_PLAYER_COLLISION_RADIUS_SQ) return false;
  const dist = Math.sqrt(Math.max(0.000001, distSq));
  const push = ENEMY_PLAYER_COLLISION_RADIUS - dist;
  let nx = dist > 0.0001 ? dx / dist : 0;
  let nz = dist > 0.0001 ? dz / dist : 0;
  if (dist <= 0.0001 && direction && direction.lengthSq() > 0.0001) {
    const away = direction.clone().normalize().multiplyScalar(-1);
    nx = away.x;
    nz = away.z;
  } else if (dist <= 0.0001) {
    nx = 1;
    nz = 0;
  }
  next.x += nx * push;
  next.z += nz * push;
  return true;
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
  if (!enemy || isEnemyCorpseActive() || direction.lengthSq() <= 0.0001 || speed <= 0) return false;
  const moveDir = direction.clone().normalize();
  const step = moveDir.clone().multiplyScalar(speed * dt);
  const next = enemy.position.clone().add(step);
  const bounds = roomState.levelBounds;
  if (bounds) {
    next.x = clamp(next.x, bounds.minX + ENEMY_CAPSULE_RADIUS, bounds.maxX - ENEMY_CAPSULE_RADIUS);
    next.z = clamp(next.z, bounds.minZ + ENEMY_CAPSULE_RADIUS, bounds.maxZ - ENEMY_CAPSULE_RADIUS);
  }
  clampEnemyAgainstPlayer(next, moveDir);
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
  if (room?.center) return makeVec(room.center.x, room.center.y || 0, room.center.z);
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

function addDebugSphere(group, point, color, radius = 0.08, opacity = 0.9) {
  if (!group || !point) return null;
  const geometry = new THREE.SphereGeometry(radius, 10, 8);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(point);
  mesh.renderOrder = 41;
  group.add(mesh);
  return mesh;
}

function disposeDebugObject(object) {
  if (!object) return;
  object.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      for (const mat of node.material) mat?.dispose?.();
    } else {
      node.material?.dispose?.();
    }
  });
}

function spawnEnemyAttackSweepDebug(previousHand, currentHand, attackDef, hit = null, options = {}) {
  if (!DEBUG_ATTACK_SWEEP || !attackDebug.group || !previousHand || !currentHand || !attackDef) return;
  const color = options.color || (hit?.hit ? 0x54ff96 : 0xffb347);
  const travel = currentHand.clone().sub(previousHand);
  const travelLength = travel.length();
  if (travelLength <= 0.0001) return;
  travel.multiplyScalar(1 / travelLength);
  const upSeed = Math.abs(travel.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upSeed, travel).normalize();
  const up = new THREE.Vector3().crossVectors(travel, right).normalize();
  const halfExtents = attackDef.sweepHalfExtents.clone();
  halfExtents.z += travelLength * 0.5;
  const center = previousHand.clone().add(currentHand).multiplyScalar(0.5);
  const size = halfExtents.clone().multiplyScalar(2);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: hit?.hit ? 0.95 : 0.72,
      depthTest: false,
      depthWrite: false,
    })
  );
  const basis = new THREE.Matrix4().makeBasis(right, up, travel);
  box.quaternion.setFromRotationMatrix(basis);
  box.position.copy(center);
  box.renderOrder = 42;
  attackDebug.group.add(box);
  const line = addDebugLine(attackDebug.group, [previousHand.clone(), currentHand.clone()], hit?.hit ? 0x54ff96 : color, 0.95);
  const start = addDebugSphere(attackDebug.group, previousHand, color, 0.055, 0.85);
  const end = addDebugSphere(attackDebug.group, currentHand, hit?.hit ? 0x54ff96 : color, 0.07, 0.95);
  const capsuleStart = new THREE.Vector3();
  const capsuleEnd = new THREE.Vector3();
  const playerRadius = getPlayerDamageCapsule(capsuleStart, capsuleEnd);
  const capsuleLine = addDebugLine(attackDebug.group, [capsuleStart.clone(), capsuleEnd.clone()], 0x7cd7ff, 0.9);
  const capsuleA = addDebugSphere(attackDebug.group, capsuleStart, 0x7cd7ff, playerRadius, 0.18);
  const capsuleB = addDebugSphere(attackDebug.group, capsuleEnd, 0x7cd7ff, playerRadius, 0.18);
  const sweepRadius = Math.max(attackDef.sweepHalfExtents.x, attackDef.sweepHalfExtents.y);
  const attackA = addDebugSphere(attackDebug.group, previousHand, color, sweepRadius, 0.12);
  const attackB = addDebugSphere(attackDebug.group, currentHand, color, sweepRadius, 0.12);
  const contact = hit?.center ? addDebugSphere(attackDebug.group, hit.center, 0x6cf2ff, 0.09, 0.95) : null;
  attackDebug.history.push({
    ttl: ENEMY_ATTACK_DEBUG_LIFETIME,
    maxTtl: ENEMY_ATTACK_DEBUG_LIFETIME,
    objects: [box, line, start, end, capsuleLine, capsuleA, capsuleB, attackA, attackB, contact].filter(Boolean),
  });
}

function updateEnemyAttackSweepDebug(realDt) {
  if (!DEBUG_ATTACK_SWEEP) {
    if (attackDebug.history.length || attackDebug.group.children.length) {
      clearDebugGroup(attackDebug.group);
      attackDebug.history.length = 0;
    }
    return;
  }
  for (let i = attackDebug.history.length - 1; i >= 0; i -= 1) {
    const entry = attackDebug.history[i];
    entry.ttl -= realDt;
    const alpha = clamp(entry.ttl / Math.max(0.0001, entry.maxTtl), 0, 1);
    for (const object of entry.objects) {
      object.visible = alpha > 0;
      object.traverse?.((node) => {
        if (!node.material) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.opacity = alpha * (mat.wireframe ? 0.95 : 0.95);
          mat.transparent = true;
          mat.needsUpdate = true;
        }
      });
    }
    if (entry.ttl <= 0) {
      for (const object of entry.objects) {
        attackDebug.group.remove(object);
        disposeDebugObject(object);
      }
      attackDebug.history.splice(i, 1);
    }
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
  const text = [
    spec?.junction_class,
    spec?.semantic_role,
    spec?.semanticRole,
    spec?.batch_prompt,
    spec?.label,
    spec?.cutShape,
    spec?.verticalRole,
    spec?.tacticalRole,
    spec?.readabilityCue,
    ...(spec?.route_sentence || []),
    ...(spec?.routeSentence || []),
  ].join(' ').toLowerCase();
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
  return Math.max(0.42, enemyRuntime.actions.get('jumping')?.getClip?.().duration || ENEMY_ATTACK_RECOVERY);
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
  const standOff = clamp(ENEMY_ATTACK_RANGE * 0.68, 0.72, Math.max(0.72, ENEMY_RING_RADIUS - 0.35));
  const goal = makeVec(player.position.x - dir.x * standOff, player.position.y - PLAYER_EYE_HEIGHT, player.position.z - dir.z * standOff);
  const support = findEnemySupport(goal.x, goal.z, goal.y, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (support) goal.y = support.topY;
  return goal;
}

function applyAttackLabSetup() {
  if (!ATTACK_LAB || !enemy) return;
  const axis = roomState.exit.clone().sub(roomState.spawn);
  axis.y = 0;
  if (axis.lengthSq() < 0.001) axis.set(0, 0, 1);
  axis.normalize();
  const enemyPoint = roomState.spawn.clone().addScaledVector(axis, 1.45);
  const support = findEnemySupport(enemyPoint.x, enemyPoint.z, enemyPoint.y - PLAYER_EYE_HEIGHT, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (support) enemyPoint.y = support.topY;
  positionEnemy(enemyPoint);
  player.position.copy(roomState.spawn);
  player.visualPosition.copy(player.position);
  player.velocity.set(0, 0, 0);
  player.health = player.maxHealth;
  player.damageTaken = 0;
  player.damageFlash = 0;
  player.healthPulse = 0;
  player.hurtTimer = 0;
  player.hurtRecoverTimer = 0;
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
  const specs = activeRoomSpecs();
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
  if (!enemy || isEnemyCorpseActive()) return false;
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
  if (!enemy || isEnemyCorpseActive()) return false;
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
  if (!enemy || isEnemyCorpseActive() || enemy.userData.mode === mode) return;
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


function createEnemyDissolveMaterial(material) {
  if (!material) return material;
  if (material.userData?.enemyDissolvePatched) return material;
  const patched = material.clone();
  patched.userData = {
    ...(patched.userData || {}),
    enemyDissolvePatched: true,
    enemyDissolveUniforms: null,
    enemyDissolveBaseOpacity: Number.isFinite(patched.opacity) ? patched.opacity : 1,
    enemyDissolveBaseTransparent: !!patched.transparent,
    enemyDissolveBaseEmissive: patched.emissive ? patched.emissive.clone() : new THREE.Color(0x000000),
    enemyDissolveBaseEmissiveIntensity: Number.isFinite(patched.emissiveIntensity) ? patched.emissiveIntensity : 0,
  };
  patched.transparent = false;
  patched.depthWrite = true;
  patched.onBeforeCompile = (shader) => {
    shader.uniforms.enemyDissolveProgress = { value: 0 };
    shader.uniforms.enemyDissolveScale = { value: ENEMY_DISSOLVE_VORONOI_SCALE };
    shader.uniforms.enemyDissolveEdgeWidth = { value: ENEMY_DISSOLVE_EDGE_WIDTH };
    shader.uniforms.enemyDissolveEdgeColor = { value: ENEMY_DISSOLVE_EDGE_COLOR };
    shader.uniforms.enemyDissolveEdgeIntensity = { value: ENEMY_DISSOLVE_EDGE_INTENSITY };
    patched.userData.enemyDissolveUniforms = shader.uniforms;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vEnemyDissolvePosition;\nvarying vec3 vEnemyDissolveNormal;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvEnemyDissolvePosition = transformed;'
      )
      .replace(
        '#include <normal_vertex>',
        '#include <normal_vertex>\nvEnemyDissolveNormal = normalize( transformedNormal );'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vEnemyDissolvePosition;
        varying vec3 vEnemyDissolveNormal;
        uniform float enemyDissolveProgress;
        uniform float enemyDissolveScale;
        uniform float enemyDissolveEdgeWidth;
        uniform vec3 enemyDissolveEdgeColor;
        uniform float enemyDissolveEdgeIntensity;

        vec2 enemyVoronoiCell(vec2 pos) {
          vec2 cell = floor(pos);
          vec2 fracPart = fract(pos);
          float nearest = 8.0;
          float nextNearest = 8.0;
          for (int yy = -1; yy <= 1; yy++) {
            for (int xx = -1; xx <= 1; xx++) {
              vec2 neighbor = vec2(float(xx), float(yy));
              vec2 point = neighbor + fract(sin(dot(cell + neighbor, vec2(127.1, 311.7))) * vec2(43758.5453, 28001.8384));
              float dist = length(fracPart - point);
              if (dist < nearest) {
                nextNearest = nearest;
                nearest = dist;
              } else if (dist < nextNearest) {
                nextNearest = dist;
              }
            }
          }
          return vec2(nearest, nextNearest - nearest);
        }

        float sampleEnemyDissolve(vec3 pos, vec3 normalDir) {
          vec3 weights = pow(abs(normalize(normalDir)), vec3(4.0));
          float weightSum = max(0.0001, weights.x + weights.y + weights.z);
          weights /= weightSum;
          float sampleX = enemyVoronoiCell(pos.yz * enemyDissolveScale).y;
          float sampleY = enemyVoronoiCell(pos.xz * enemyDissolveScale).y;
          float sampleZ = enemyVoronoiCell(pos.xy * enemyDissolveScale).y;
          return sampleX * weights.x + sampleY * weights.y + sampleZ * weights.z;
        }`
      )
      .replace(
        '#include <output_fragment>',
        `float enemyDissolveValue = sampleEnemyDissolve(vEnemyDissolvePosition, vEnemyDissolveNormal);
        if (enemyDissolveValue < enemyDissolveProgress) discard;
        float enemyEdgeDistance = enemyDissolveValue - enemyDissolveProgress;
        if (enemyEdgeDistance > 0.0 && enemyEdgeDistance < enemyDissolveEdgeWidth && enemyDissolveProgress > 0.0) {
          float enemyEdgeGlow = (enemyDissolveEdgeWidth - enemyEdgeDistance) / enemyDissolveEdgeWidth;
          enemyEdgeGlow = pow(enemyEdgeGlow, 2.0) * enemyDissolveEdgeIntensity;
          totalEmissiveRadiance += enemyDissolveEdgeColor * enemyEdgeGlow;
        }
        #include <output_fragment>`
      );
  };
  patched.customProgramCacheKey = () => 'enemy-dissolve-v1';
  patched.needsUpdate = true;
  return patched;
}

function applyEnemyDissolveMaterials(model) {
  if (!model) return;
  model.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    if (Array.isArray(node.material)) node.material = node.material.map(createEnemyDissolveMaterial);
    else node.material = createEnemyDissolveMaterial(node.material);
  });
}

function ensureEnemyDissolveShards() {
  if (!enemy) return null;
  if (enemy.userData.dissolveShardGroup) return enemy.userData.dissolveShardGroup;
  const group = new THREE.Group();
  group.name = 'enemy-dissolve-shards';
  group.visible = false;
  enemy.add(group);
  const shardGeo = new THREE.BoxGeometry(1, 1, 1);
  const hitBox = enemy.userData.hitBox || fallbackEnemyHitBox();
  const min = hitBox.min.clone();
  const max = hitBox.max.clone();
  const baseOffset = enemyRuntime.model ? enemyRuntime.model.position.clone() : new THREE.Vector3();
  const shards = [];
  const rand = (seed) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < ENEMY_DISSOLVE_SHARD_COUNT; i += 1) {
    const rx = rand(i + 1.1);
    const ry = rand(i + 2.7);
    const rz = rand(i + 4.3);
    const base = new THREE.Vector3(
      THREE.MathUtils.lerp(min.x, max.x, rx),
      THREE.MathUtils.lerp(min.y, max.y, ry),
      THREE.MathUtils.lerp(min.z, max.z, rz),
    ).add(baseOffset);
    const drift = new THREE.Vector3(rx - 0.5, 0.35 + rand(i + 7.9) * 0.85, rz - 0.5).normalize();
    const size = 0.08 + rand(i + 9.2) * 0.18;
    const mat = new THREE.MeshBasicMaterial({
      color: rand(i + 6.4) > 0.5 ? 0xff6b1a : 0xffc07a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(shardGeo, mat);
    mesh.visible = false;
    mesh.position.copy(base);
    mesh.scale.setScalar(size);
    group.add(mesh);
    shards.push({
      mesh,
      material: mat,
      base,
      drift,
      threshold: rand(i + 11.3) * 0.72,
      spin: new THREE.Vector3(rand(i + 12.1) * 4 - 2, rand(i + 13.5) * 5 - 2.5, rand(i + 14.8) * 4 - 2),
      size,
    });
  }
  enemy.userData.dissolveShardGroup = group;
  enemy.userData.dissolveShards = shards;
  return group;
}

function updateEnemyDissolveShards(progress) {
  if (!enemy) return;
  const group = ensureEnemyDissolveShards();
  const shards = enemy.userData.dissolveShards || [];
  if (!group) return;
  if (progress <= 0.001 || progress >= 0.999) {
    group.visible = false;
    for (const shard of shards) shard.mesh.visible = false;
    return;
  }
  group.visible = true;
  for (const shard of shards) {
    const localT = clamp((progress - shard.threshold) / Math.max(0.08, 1 - shard.threshold), 0, 1);
    if (localT <= 0.0001) {
      shard.mesh.visible = false;
      continue;
    }
    const eased = Math.pow(localT, 0.7);
    const fade = 1 - Math.pow(localT, 1.15);
    shard.mesh.visible = true;
    shard.mesh.position.copy(shard.base).addScaledVector(shard.drift, eased * ENEMY_DISSOLVE_SHARD_DRIFT);
    shard.mesh.position.y += eased * ENEMY_DISSOLVE_SHARD_RISE;
    shard.mesh.rotation.set(shard.spin.x * eased, shard.spin.y * eased, shard.spin.z * eased);
    shard.mesh.scale.setScalar(shard.size * (0.9 + eased * 0.9));
    shard.material.opacity = Math.max(0, fade * 0.95);
  }
}

function setEnemyDissolveProgress(progress) {
  const clamped = clamp(progress, 0, 1);
  if (enemy) enemy.userData.dissolveProgress = clamped;
  updateEnemyDissolveShards(clamped);
  if (!enemyRuntime.model) return;
  enemyRuntime.model.visible = clamped < 0.999;
  enemyRuntime.model.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      const uniforms = mat?.userData?.enemyDissolveUniforms;
      if (uniforms) uniforms.enemyDissolveProgress.value = clamped;
      const baseOpacity = mat?.userData?.enemyDissolveBaseOpacity ?? 1;
      const baseTransparent = !!mat?.userData?.enemyDissolveBaseTransparent;
      const fade = 1 - clamp(Math.max(0, clamped - 0.12) / 0.88, 0, 1);
      mat.transparent = baseTransparent || clamped > 0.001;
      mat.opacity = Math.max(0, baseOpacity * fade);
      mat.depthWrite = fade > 0.02;
      if (mat.emissive) {
        const baseEmissive = mat.userData.enemyDissolveBaseEmissive || new THREE.Color(0x000000);
        mat.emissive.copy(baseEmissive).lerp(ENEMY_DISSOLVE_EDGE_COLOR, Math.min(1, clamped * 0.9));
        mat.emissiveIntensity = (mat.userData.enemyDissolveBaseEmissiveIntensity || 0) + clamped * 1.6;
      }
      mat.needsUpdate = true;
    }
  });
}

function resetEnemyDissolve() {
  setEnemyDissolveProgress(0);
  if (enemyRuntime.model) enemyRuntime.model.visible = true;
}

function syncEnemyDissolveToRagdollState(state) {
  if (!state) {
    resetEnemyDissolve();
    return;
  }
  const progress = state.settled
    ? 1
    : clamp((state.elapsed || 0) / ENEMY_DISSOLVE_DURATION, 0, 1);
  setEnemyDissolveProgress(progress);
  if (state.settled && enemyRagdollDebugGroup) enemyRagdollDebugGroup.visible = false;
}

function configureOrcBerserkerModel(model, textureSet = null) {
  model.name = 'orc-berserker-model';
  model.rotation.y = Math.PI;
  model.position.set(0, 0, 0);
  if (textureSet) applyVisualOverlayMaterials(model, textureSet, ORC_BERSERKER_PBR.materialOptions || {});
  applyEnemyDissolveMaterials(model);
  model.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = USE_DYNAMIC_SHADOWS;
    node.receiveShadow = USE_DYNAMIC_SHADOWS;
    node.frustumCulled = false;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.flatShading = true;
      if (!mat.roughnessMap) mat.roughness = Math.max(mat.roughness ?? 0.72, 0.62);
      if (!mat.metalnessMap) mat.metalness = Math.max(mat.metalness ?? 0.12, 0.12);
      mat.needsUpdate = true;
    }
  });
  const scale = normalizeEnemyModelToHeight(model, ORC_BERSERKER_TARGET_HEIGHT);
  model.position.y += ORC_BERSERKER_GROUND_OFFSET;
  return scale;
}

function loadOrcBerserkerEnemy() {
  fbxLoader.load(ORC_BERSERKER_MODEL, async (asset) => {
    try {
      if (!enemy) return;
      if (enemyRuntime.model?.parent) enemyRuntime.model.parent.remove(enemyRuntime.model);
      enemyRuntime.actions.clear();
      enemyRuntime.currentAction = null;
      enemyRuntime.model = asset;
      const orcTextures = await loadVisualOverlayTextureSet(ORC_BERSERKER_PBR);
      const scale = configureOrcBerserkerModel(enemyRuntime.model, orcTextures);
      cacheEnemyHitBox();
      buildEnemyRagdollProfile();
      enemyRuntime.mixer = asset.animations?.length ? new THREE.AnimationMixer(enemyRuntime.model) : null;
      if (enemyRuntime.mixer) {
        registerEnemyClip('idle', asset.animations);
        playEnemyAction('idle', 0.01);
        loadProMeleeAxeEnemyClips();
      }
      enemy.add(enemyRuntime.model);
      enemy.userData.attackBones = {};
      resetEnemyDissolve();
      if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = false;
      setStatus('standing idle orc imported' + (scale ? ' scale ' + scale.toFixed(3) : ''));
    } catch (err) {
      console.warn('standing idle orc setup failed; keeping primitive fallback', err);
      if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = true;
      const summary = rememberError('Orc setup error', err);
      setStatus(summary.toLowerCase());
      hintEl.textContent = summary;
      hintEl.style.opacity = '1';
    }
  }, undefined, (err) => {
    console.warn('standing idle orc failed; keeping primitive fallback', err);
    if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = true;
    const summary = rememberError('Orc load error', err);
    setStatus(summary.toLowerCase());
    hintEl.textContent = summary;
    hintEl.style.opacity = '1';
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
  if (!enemyRuntime.mixer || !clips?.length) return null;
  const sourceClip = clips[0];
  const clip = options.stripRootMotionXZ ? stripRootMotionXZ(sourceClip) : sourceClip.clone();
  clip.name = name;
  const action = enemyRuntime.mixer.clipAction(clip, enemyRuntime.model);
  action.enabled = true;
  if (options.timeScale) action.timeScale = options.timeScale;
  if (options.once) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }
  enemyRuntime.actions.set(name, action);
  return action;
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
  loadEnemyClip('reactBodyCenter', PRO_MELEE_AXE_CLIPS.reactBodyCenter, { once: true });
  loadEnemyClip('reactHeadLeft', PRO_MELEE_AXE_CLIPS.reactHeadLeft, { once: true });
  loadEnemyClip('reactHeadRight', PRO_MELEE_AXE_CLIPS.reactHeadRight, { once: true });
  loadEnemyClip('dying', PRO_MELEE_AXE_CLIPS.dying, { once: true, stripRootMotionXZ: true });
}

function loadMutantOrcEnemy() {
  fbxLoader.load(MUTANT_ORC_CLIPS.idle, (asset) => {
    try {
      enemyRuntime.model = asset;
      configureMutantOrcModel(enemyRuntime.model);
      enemyRuntime.mixer = new THREE.AnimationMixer(enemyRuntime.model);
      registerEnemyClip('idle', asset.animations);
      enemy.add(enemyRuntime.model);
      resetEnemyDissolve();
      if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = false;
      playEnemyAction('idle', 0.01);
      loadEnemyClip('run', MUTANT_ORC_CLIPS.run);
      loadEnemyClip('walking', MUTANT_ORC_CLIPS.walking);
      loadEnemyClip('jumping', MUTANT_ORC_CLIPS.jumping, { once: true });
      loadEnemyClip('punch', MUTANT_ORC_CLIPS.punch, { once: true });
      loadEnemyClip('dying', MUTANT_ORC_CLIPS.dying, { once: true });
      setStatus('mutant orc enemy imported');
    } catch (err) {
      console.warn('mutant orc setup failed; keeping primitive fallback', err);
      if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = true;
      const summary = rememberError('Mutant orc setup error', err);
      setStatus(summary.toLowerCase());
      hintEl.textContent = summary;
      hintEl.style.opacity = '1';
    }
  }, undefined, (err) => {
    console.warn('mutant orc enemy failed; keeping primitive fallback', err);
    if (enemyRuntime.primitiveVisual) enemyRuntime.primitiveVisual.visible = true;
    const summary = rememberError('Mutant orc load error', err);
    setStatus(summary.toLowerCase());
    hintEl.textContent = summary;
    hintEl.style.opacity = '1';
  });
}


function loadArms() {
  loader.load(FPSPLAYER_MESHY_VISUAL_OVERLAY.model, async (gltf) => {
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
          mat.flatShading = false;
          mat.needsUpdate = true;
        }
      }
    });
    let meshyOverlayReady = false;
    try {
      const overlayTextures = await loadVisualOverlayTextureSet(FPSPLAYER_MESHY_VISUAL_OVERLAY);
      applyVisualOverlayMaterials(armsModel, overlayTextures, FPSPLAYER_MESHY_VISUAL_OVERLAY.materialOptions || {});
      meshyOverlayReady = true;
      console.info('fpsplayer rigged meshy GLB materialized');
    } catch (err) {
      console.warn('fpsplayer meshy texture overlay failed', err);
      const summary = rememberError('FPSPlayer Meshy overlay failed', err);
      armsModel.visible = false;
      fallbackArms.visible = false;
      setStatus(summary.toLowerCase());
      hintEl.textContent = summary;
      hintEl.style.opacity = '1';
    }
    if (!meshyOverlayReady) return;
    armsScene.add(armsModel);
    armsCameraBone = findBone(armsModel, 'Camera');
    armsMixer = new THREE.AnimationMixer(armsModel);
    const clipsByName = clipMap(gltf.animations);
    idleAction = makeArmAction(chooseClip(gltf.animations, ['FistReady', 'FistIdle', '0T-Pose']));
    walkAction = makeArmAction(chooseClip(gltf.animations, ['FistWalking', 'Walking']));
    runAction = walkAction;
    jumpAction = makeArmAction(chooseClip(gltf.animations, ['FistJump', 'JumpAddative', 'Jump']), { once: true, clamp: true });
    hurtAction = makeArmAction(chooseClip(gltf.animations, ['FistInjuredRight', 'FistBlockHitLeft', 'FistBlockHitParry']), { once: true, clamp: true });
    hurtRecoverAction = makeArmAction(chooseClip(gltf.animations, ['FistReadied', 'FistReady']), { once: true, clamp: true });
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
    player.climbRegrabUntil = performance.now() + CLIMB_JUMP_REGRAB_LOCK_MS;
    player.velocity.set(normal.x * CLIMB_DETACH_BACK, CLIMB_DETACH_UP, normal.z * CLIMB_DETACH_BACK);
    player.grounded = false;
    input.jumpCharging = false;
    input.jumpHoldStart = 0;
    input.jumpPointerId = null;
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
        if (player.mode === 'climb') {
          jump(pointerId);
        } else if (player.grounded) {
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

  if (useControllerKataSlice() && player.mode === 'climb') {
    if (roomState.controllerKataMantleProof) roomState.controllerKataMantleProof.climbEntries += 1;
    throw new Error('controller kata entered forbidden CLIMB state');
  }
  if (player.mode === 'climb') {
    updatePlayerClimb(dt, moveX, moveY);
    finalizePlayerFrame(dt, now, stickMagnitude);
    return;
  }
  if (player.mode === 'mantle') {
    if (useControllerKataSlice()) updateControllerKataDirectMantle(dt);
    else updatePlayerMantle(dt);
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
  const previousFeetY = player.position.y - PLAYER_EYE_HEIGHT;
  player.velocity.y -= 14.4 * dt;
  if (roomState.physicsWorld) {
    const desiredDelta = {
      x: player.velocity.x * dt,
      y: player.velocity.y * dt,
      z: player.velocity.z * dt,
    };
    const physicsMove = roomState.physicsWorld.movePlayer({
      eyePosition: player.position,
      desiredDelta,
      eyeHeight: PLAYER_EYE_HEIGHT,
      radius: PLAYER_SOLID_RADIUS,
    });
    player.position.set(physicsMove.eyePosition.x, physicsMove.eyePosition.y, physicsMove.eyePosition.z);
    if (dt > 0) {
      player.velocity.x = physicsMove.movement.x / dt;
      player.velocity.z = physicsMove.movement.z / dt;
      if (physicsMove.grounded && player.velocity.y <= 0) player.velocity.y = 0;
      else player.velocity.y = physicsMove.movement.y / dt;
    }
    if (useControllerKataSlice() && tryBeginControllerKataDirectMantle(physicsMove, moveY)) {
      finalizePlayerFrame(dt, now, stickMagnitude);
      return;
    }
    if (physicsMove.grounded) {
      if (!player.grounded && player.velocity.y < -1.2) playThud(0.7);
      player.grounded = true;
      player.mode = 'ground';
      if (player.isRunning && input.jumpCharging && input.jumpHoldStart !== 0 && player.lastRunIntent && now - input.jumpHoldStart > 35) commitJump(0.15, 0, false);
    } else {
      player.grounded = false;
      player.mode = 'air';
      if (!useControllerKataSlice() && tryBeginClimb(true, physicsMove.collisions)) {
        finalizePlayerFrame(dt, now, stickMagnitude);
        return;
      }
    }
    resolvePlayerEnemyOverlapForPlayer(player.position, player.velocity);
    finalizePlayerFrame(dt, now, stickMagnitude);
    return;
  }
  player.position.addScaledVector(player.velocity, dt);
  resolvePlayerSolids(player.position, player.velocity);
  let support = player.velocity.y <= 0 ? (resolveSupportHeight(player.position.x, player.position.z, player.position.y - PLAYER_EYE_HEIGHT, player.velocity.y, previousFeetY) || resolveSolidTopSupport(player.position.x, player.position.z, player.position.y - PLAYER_EYE_HEIGHT, player.velocity.y, previousFeetY)) : null;
  if (support && player.velocity.y <= 0) {
    player.position.y = Math.max(player.position.y, support.topY + PLAYER_EYE_HEIGHT);
  }
  if (playerBodyBlockedAtPosition(player.position.x, player.position.z, player.position.y)) {
    const cleared = findClearPlayerAnchor(player.position.clone(), roomState.exit);
    if (cleared && cleared.distanceToSquared(player.position) > 0.0001) {
      player.position.copy(cleared);
      player.velocity.x = 0;
      player.velocity.z = 0;
      if (player.velocity.y < 0) player.velocity.y = 0;
    }
  }
  resolvePlayerEnemyOverlapForPlayer(player.position, player.velocity);
  const feetY = player.position.y - PLAYER_EYE_HEIGHT;
  support = player.velocity.y <= 0 ? (resolveSupportHeight(player.position.x, player.position.z, feetY, player.velocity.y, previousFeetY) || resolveSolidTopSupport(player.position.x, player.position.z, feetY, player.velocity.y, previousFeetY)) : null;
  const stepDirection = desired.lengthSq() > 0.0001 ? desired : new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
  if (!support && player.velocity.y <= 0 && stepDirection.lengthSq() > 0.0001) {
    const stepSurface = findWalkableStepSurface(player.position, stepDirection, feetY);
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
    if (!useControllerKataSlice() && tryBeginClimb(true)) {
      finalizePlayerFrame(dt, now, stickMagnitude);
      return;
    }
  }
  resolvePlayerEnemyOverlapForPlayer(player.position, player.velocity);
  finalizePlayerFrame(dt, now, stickMagnitude);
}

function updateArms(dt) {
  if (armsMixer) armsMixer.update(dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.hurtRecoverTimer = Math.max(0, player.hurtRecoverTimer - dt);
  if (!player.attack && player.hurtTimer > 0) {
    if (hurtAction) playArmAction(hurtAction, 0.04, activeArmAction !== hurtAction);
    return;
  }
  if (!player.attack && player.hurtTimer <= 0 && player.hurtRecoverTimer === 0 && hurtRecoverAction && activeArmAction === hurtAction) {
    player.hurtRecoverTimer = Math.max(0.18, hurtRecoverAction.getClip().duration || 0.42);
    playArmAction(hurtRecoverAction, 0.05, true);
    return;
  }
  if (!player.attack && player.hurtRecoverTimer > 0 && activeArmAction === hurtRecoverAction) return;
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

function updateControllerKataHud() {
  if (!useControllerKataSlice() || !roomState.controllerKataStartedAt) return;
  const elapsed = Math.max(0, (performance.now() - roomState.controllerKataStartedAt) / 1000);
  const best = roomState.controllerKataBestTime || Number(localStorage.getItem('infinite-brutality-controller-kata-best') || 0);
  const last = roomState.controllerKataLastTime || 0;
  const timing = `${elapsed.toFixed(2)}s${best > 0 ? ` | best ${best.toFixed(2)}s` : ''}${last > 0 ? ` | last ${last.toFixed(2)}s` : ''}`;
  const mantle = roomState.controllerKataMantleProof;
  const mantleText = mantle ? ` | mantle ${mantle.phase} ${mantle.completions}/${mantle.starts}` : '';
  statusEl.textContent = `build ${BUILD} | controller kata | seed ${roomState.seed} | ${timing}${mantleText} | reach cyan exit`;
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
  const frameStart = performance.now();
  try {
    const realDt = Math.min(0.045, clock.getDelta());
    updateCombatFx(realDt);
    updateEnemyBloodParticles(realDt);
    updateEnemyAttackSweepDebug(realDt);
    const dt = player.hitPause > 0 ? 0 : realDt * combatFx.timeScale;
    updatePlayer(dt);
    if (!useControllerKataSlice()) {
      updateAttack(dt);
      updateEnemyEngagement(dt);
      updateArms(dt);
      updateNookTts(dt);
    }
    updateControllerKataHud();
    updateDiegeticLights(performance.now() / 1000);
    updatePad();
    updateCollisionDebugOverlay();
    const renderStart = performance.now();
    renderer.clear();
    renderer.render(scene, camera);
    if (!useControllerKataSlice()) {
      renderer.clearDepth();
      renderer.render(armsScene, armsCamera);
    }
    roomState.lastRenderMs = performance.now() - renderStart;
    roomState.lastFrameMs = performance.now() - frameStart;
    const mode = player.attack?.def?.name || (input.jumpCharging ? 'jump-charge' : (player.isRunning ? 'run' : (!player.grounded ? 'air' : (player.runCharge > 0 ? 'build' : 'walk'))));
    const node = roomState.spec;
    const districtText = node?.districtName ? ` | D${(node.districtIndex ?? 0) + 1} ${node.districtName}${node.districtElevationBand ? `(${node.districtElevationBand})` : ''}` : '';
    const enemyNav = getEnemyNavState();
    const navMode = enemyNav?.asleep ? 'sleep' : (enemyNav?.waypointKinds[0] || enemy.userData.mode || 'idle');
    const navText = enemyNav ? ` | nav ${navMode} w${enemyNav.waypoints.length} e${enemyNav.routePath.length}` : '';
    const ragText = summarizeEnemyRagdollDebug();
    const attackText = summarizeEnemyAttackDebug();
    maybePublishVisualQaFrame({ mode, node, enemyNav, navMode });
    const hurtText = ` | hurt ${Number(player.damageTaken || 0).toFixed(1)}`;
    refreshEnemyRouteDebug(enemyNav);
    if (!useControllerKataSlice()) refreshPlayerHealthHud();
    refreshAttackDebugHud();
    if (DEBUG_UI) readoutEl.textContent = `L${roomState.levelIndex + 1}.${roomState.nodeIndex + 1} ${node ? node.connector : 'loading'}${districtText} | move ${input.smoothMoveX.toFixed(2)},${input.smoothMoveY.toFixed(2)} | ${mode} | enemy ${enemy.visible ? enemy.userData.health.toFixed(1) : 'down'}${hurtText}${navText}${ragText}${attackText} | ${input.gyro ? 'gyro' : 'touch'}`;
  } catch (err) {
    console.error(err);
    const summary = rememberError('Runtime error', err);
    setStatus(summary.toLowerCase());
    hintEl.textContent = summary;
    hintEl.style.opacity = '1';
  }
}

async function init() {
  try {
    await ensurePhysicsReady();
    applyBootNavigationTarget();
    buildLights();
    buildEnemy();
    if (useControllerKataSlice()) {
      attackButton.hidden = true;
      if (healthHudEl) healthHudEl.hidden = true;
      if (damageFlashEl) damageFlashEl.hidden = true;
      hintEl.textContent = 'Move with WASD or left touch. Look with mouse or right touch. Jump. Reach the cyan exit.';
    }
    buildRoom();
    publishVisualQaBeacon('reset', visualQaBeaconFields());
    setupTouch();
    resize();
    window.addEventListener('resize', resize);
    placeActionPad();
    if (!useControllerKataSlice()) {
      loadArms();
      loadOrcBerserkerEnemy();
      loadNookTtsManifest();
      setStatus(ATTACK_LAB ? 'Attack lab ready' : 'Limbo room ready');
    }
    render();
  } catch (err) {
    console.error(err);
    const summary = rememberError('Boot error', err);
    setStatus(summary.toLowerCase());
    hintEl.textContent = summary;
    hintEl.style.opacity = '1';
  }
}

init();
