import * as THREE from 'three';
import {
  buildIslandVoxelField,
  buildRoomIslandField,
  buildRockBridgeField,
  buildRockBridgeMeshData,
  buildSedimentaryMesaBridgeField,
  buildSedimentaryMesaMeshData,
  buildSurfaceNetMeshData,
} from './island-geometry.js?v=0.8.179';

const TERRAIN_DOWN = new THREE.Vector3(0, -1, 0);
const terrainSupportRaycaster = new THREE.Raycaster();

function buildRuntimeMesh(meshData, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
  geometry.setIndex(meshData.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function toOrientedLocal(x, z, centerX, centerZ, yaw = 0) {
  const dx = x - centerX;
  const dz = z - centerZ;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function disposeObjectTree(root) {
  root.traverse((object) => {
    if (object.geometry?.dispose) object.geometry.dispose();
    if (object.userData?.disposeMaterial && object.material?.dispose) object.material.dispose();
  });
}

function normalizeTerrainGrammar(grammar) {
  if (grammar === 'carved_imperial_structure') {
    return {
      requestedGrammar: 'carved_imperial_structure',
      fieldGrammar: 'carved_imperial_structure',
      process: 'imperial_structure_caved_from_rock',
    };
  }
  if (grammar === 'imperial_floating_strata') {
    return {
      requestedGrammar: 'imperial_floating_strata',
      fieldGrammar: 'imperial_floating_strata',
      process: 'imperial_roads_retaining_walls_strata',
    };
  }
  return {
    requestedGrammar: grammar || 'sedimentary_mesa',
    fieldGrammar: grammar || 'sedimentary_mesa',
    process: null,
  };
}

function applyTerrainGrammarMetadata(field, metadata, spec = {}) {
  if (!field?.rockGrammar) return field;
  if (metadata.requestedGrammar === field.rockGrammar.grammar) {
    field.rockGrammar = {
      ...field.rockGrammar,
      silhouette: spec.rockSilhouette || field.rockGrammar.silhouette,
      imperialFunction: spec.imperialFunction || field.rockGrammar.imperialFunction,
    };
    return field;
  }
  field.rockGrammar = {
    ...field.rockGrammar,
    baseGrammar: field.rockGrammar.grammar,
    grammar: metadata.requestedGrammar,
    fieldGrammar: metadata.fieldGrammar,
    silhouette: spec.rockSilhouette || field.rockGrammar.silhouette,
    imperialFunction: spec.imperialFunction,
    process: metadata.process || field.rockGrammar.process,
  };
  return field;
}

export function createTerrainLayer({ MAT, hashRoomKey, debugMode = 'visual' }) {
  const group = new THREE.Group();
  group.name = 'terrain-layer';
  group.userData.owner = 'TerrainLayer';
  group.userData.debugMode = debugMode;
  const colliders = [];
  const visualMeshes = [];
  const meshColliders = [];
  const terrainSpecs = [];

  const addCollider = (field, origin, yaw, source, kind, mesh = null) => {
    const collider = {
      field,
      mesh,
      centerX: origin[0],
      centerY: origin[1],
      centerZ: origin[2],
      yaw: Number.isFinite(yaw) ? yaw : 0,
      minX: origin[0] + field.min.x,
      maxX: origin[0] + field.max.x,
      minY: origin[1] + field.min.y,
      maxY: origin[1] + field.max.y,
      minZ: origin[2] + field.min.z,
      maxZ: origin[2] + field.max.z,
      source,
      kind,
    };
    colliders.push(collider);
    if (mesh) meshColliders.push(collider);
    return collider;
  };

  const refreshMeshColliderBounds = (collider) => {
    if (!collider?.mesh) return null;
    collider.mesh.parent?.updateMatrixWorld(true);
    collider.mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(collider.mesh);
    collider.minX = bounds.min.x;
    collider.maxX = bounds.max.x;
    collider.minY = bounds.min.y;
    collider.maxY = bounds.max.y;
    collider.minZ = bounds.min.z;
    collider.maxZ = bounds.max.z;
    return bounds;
  };

  const addFieldMesh = ({ field, meshData, origin, yaw = 0, material, source, kind }) => {
    const holder = new THREE.Group();
    holder.name = source;
    holder.position.set(origin[0], origin[1], origin[2]);
    holder.rotation.y = yaw;
    group.add(holder);
    const mesh = buildRuntimeMesh(meshData, material);
    mesh.userData.terrainLayerSource = source;
    holder.add(mesh);
    visualMeshes.push(mesh);
    const collider = addCollider(field, origin, yaw, source, kind, mesh);
    refreshMeshColliderBounds(collider);
    return holder;
  };

  const addIslandStamp = (spec) => {
    terrainSpecs.push({ type: 'islandStamp', ...spec });
    const seed = spec.seed ?? hashRoomKey('terrain-layer-island:' + spec.id);
    const grammar = normalizeTerrainGrammar(spec.rockGrammar);
    const field = spec.terraced
      ? buildRoomIslandField(spec.size, seed, {
        grammar: grammar.fieldGrammar,
        terraced: true,
        role: spec.role || 'arena',
        rockSilhouette: spec.rockSilhouette,
        imperialFunction: spec.imperialFunction,
      })
      : buildIslandVoxelField({
        id: spec.id,
        role: spec.role,
        pos: spec.origin,
        size: spec.size,
        yaw: spec.yaw || 0,
      }, seed);
    applyTerrainGrammarMetadata(field, grammar, spec);
    const isSedimentaryMesa = field.rockGrammar?.baseGrammar === 'sedimentary_mesa'
      || field.rockGrammar?.fieldGrammar === 'sedimentary_mesa'
      || field.rockGrammar?.grammar === 'sedimentary_mesa'
      || field.rockGrammar?.grammar === 'imperial_floating_strata'
      || field.rockGrammar?.grammar === 'carved_imperial_structure';
    const meshData = isSedimentaryMesa
      ? buildSedimentaryMesaMeshData(field, MAT.sedimentaryRock?.userData?.uvScale ?? 0.072)
      : buildSurfaceNetMeshData(field, MAT.islandRock?.userData?.uvScale ?? 0.12);
    const material = spec.material || (isSedimentaryMesa
      ? (spec.materialVariant % 2 === 0 ? MAT.sedimentaryRock : MAT.sedimentaryRockDark)
      : (spec.materialVariant % 2 === 0 ? MAT.islandRock : MAT.islandRockDark));
    return addFieldMesh({
      field,
      meshData,
      origin: spec.origin,
      yaw: spec.yaw || 0,
      material,
      source: spec.source || 'terrain-island:' + spec.id,
      kind: spec.kind || (field.rockGrammar?.grammar === 'carved_imperial_structure' ? 'structure' : 'island'),
    });
  };

  const addBridgeSpan = (spec) => {
    if (!Number.isFinite(spec.length) || spec.length < 0.4) return null;
    terrainSpecs.push({ type: 'connectorStamp', ...spec });
    const seed = spec.seed ?? hashRoomKey('terrain-layer-bridge:' + spec.id + ':' + Math.round(spec.length * 10));
    const thickness = spec.thickness || 1.45;
    const grammar = normalizeTerrainGrammar(spec.rockGrammar);
    const field = spec.slabBridge === false
      ? buildRockBridgeField(spec.length, spec.width, thickness, seed)
      : buildSedimentaryMesaBridgeField(spec.length, spec.width, thickness, seed);
    if (spec.slabBridge !== false) applyTerrainGrammarMetadata(field, grammar, spec);
    const meshData = spec.slabBridge === false
      ? buildRockBridgeMeshData(spec.length, spec.width, thickness, seed, MAT.islandRock?.userData?.uvScale ?? 0.12)
      : buildSedimentaryMesaMeshData(field, MAT.sedimentaryRock?.userData?.uvScale ?? 0.072);
    const material = spec.material || (spec.slabBridge === false ? MAT.islandRockDark : MAT.sedimentaryRockDark);
    return addFieldMesh({
      field,
      meshData,
      origin: spec.origin,
      yaw: spec.yaw || 0,
      material,
      source: spec.source || 'terrain-bridge:' + spec.id,
      kind: 'bridge',
    });
  };

  const supportAt = (x, z, feetY, options = {}) => {
    const radius = options.radius ?? 0.38;
    const stepUp = options.stepUp ?? 0.92;
    const stepDown = options.stepDown ?? 1.65;
    const velocityY = options.velocityY ?? 0;
    const prevFeetY = Number.isFinite(options.prevFeetY) ? options.prevFeetY : feetY;
    const sweepDrop = Math.max(0, prevFeetY - feetY);
    const effectiveStepDown = Math.max(stepDown, sweepDrop + 0.2);
    const originY = Math.max(feetY, prevFeetY) + stepUp + 6.0;
    terrainSupportRaycaster.set(new THREE.Vector3(x, originY, z), TERRAIN_DOWN);
    terrainSupportRaycaster.far = stepUp + effectiveStepDown + 12.0;
    let best = null;
    for (const collider of meshColliders) {
      if (feetY > collider.maxY + stepUp || feetY < collider.minY - effectiveStepDown) continue;
      if (x < collider.minX - radius || x > collider.maxX + radius) continue;
      if (z < collider.minZ - radius || z > collider.maxZ + radius) continue;
      collider.mesh.parent?.updateMatrixWorld(true);
      collider.mesh.updateMatrixWorld(true);
      const hits = terrainSupportRaycaster.intersectObject(collider.mesh, true);
      for (const hit of hits) {
        const worldNormal = hit.face?.normal?.clone?.().transformDirection(hit.object.matrixWorld);
        if (!worldNormal || worldNormal.y < 0.2) continue;
        const topY = hit.point.y;
        if (velocityY > 0.5 && feetY < topY - 0.14) continue;
        if (feetY > topY + stepUp) continue;
        if (feetY < topY - effectiveStepDown) continue;
        if (!best || topY > best.topY) {
          best = { topY, collider, source: collider.source, point: hit.point.clone(), normal: worldNormal, kind: collider.kind };
        }
        break;
      }
    }
    return best;
  };

  const intersectsBody = () => false;

  const colliderBySource = (source) => colliders.find((collider) => collider.source === source) || null;

  const localToWorld = (collider, localX, localY, localZ) => {
    if (!colliders.includes(collider)) return null;
    const yaw = collider.yaw || 0;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return new THREE.Vector3(
      collider.centerX + localX * c + localZ * s,
      collider.centerY + localY,
      collider.centerZ - localX * s + localZ * c,
    );
  };

  const dispose = () => {
    group.parent?.remove(group);
    disposeObjectTree(group);
    group.clear();
    colliders.length = 0;
    visualMeshes.length = 0;
    meshColliders.length = 0;
    terrainSpecs.length = 0;
  };

  return {
    group,
    colliders,
    visualMeshes,
    meshColliders,
    terrainSpecs,
    addIslandStamp,
    addBridgeSpan,
    supportAt,
    intersectsBody,
    colliderBySource,
    localToWorld,
    dispose,
  };
}
