import * as THREE from 'three';

const MANIFEST_TEXTURE_VERSION = 'openai-pbr-20260628';

const EDGE_DEFAULTS = {
  edgeColor: 0xb8afa0,
  edgeStrength: 0.025,
  edgePower: 2.4,
  edgeTintMix: 0.18,
  topReadabilityColor: 0xd8d0bc,
  topReadabilityLift: 0.0,
  topReadabilityPower: 1.45,
};

function installWorldPosVarying(shader) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vWorldGridPos;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vWorldGridPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
      varying vec3 vWorldGridPos;`,
  );
}

function faceWorldNormalFragmentBlock() {
  return `
    vec3 faceWorldNormal(vec3 worldPos) {
      vec3 dx = dFdx(worldPos);
      vec3 dy = dFdy(worldPos);
      vec3 n = normalize(cross(dx, dy));
      return gl_FrontFacing ? n : -n;
    }
  `;
}

function applyEdgeOutlineOverlay(material, options = {}) {
  const settings = { ...EDGE_DEFAULTS, ...options };
  const edgeColor = new THREE.Color(settings.edgeColor);
  const priorOnBeforeCompile = material.onBeforeCompile;
  const priorCacheKey = material.customProgramCacheKey?.bind(material);

  material.onBeforeCompile = (shader) => {
    priorOnBeforeCompile?.(shader);

    shader.uniforms.worldEdgeColor = { value: edgeColor };
    shader.uniforms.worldEdgeStrength = { value: settings.edgeStrength };
    shader.uniforms.worldEdgePower = { value: settings.edgePower };
    shader.uniforms.worldEdgeTintMix = { value: settings.edgeTintMix };
    shader.uniforms.worldTopReadabilityColor = { value: new THREE.Color(settings.topReadabilityColor) };
    shader.uniforms.worldTopReadabilityLift = { value: settings.topReadabilityLift };
    shader.uniforms.worldTopReadabilityPower = { value: settings.topReadabilityPower };

    installWorldPosVarying(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${faceWorldNormalFragmentBlock()}
        uniform vec3 worldEdgeColor;
        uniform float worldEdgeStrength;
        uniform float worldEdgePower;
        uniform float worldEdgeTintMix;
        uniform vec3 worldTopReadabilityColor;
        uniform float worldTopReadabilityLift;
        uniform float worldTopReadabilityPower;

        vec3 applyWorldEdge(vec3 baseColor, vec3 worldPos) {
          vec3 worldNormal = faceWorldNormal(worldPos);
          vec3 viewDir = normalize(cameraPosition - worldPos);
          float edge = pow(max(0.0, 1.0 - abs(dot(worldNormal, viewDir))), worldEdgePower);
          float intensity = clamp(edge * worldEdgeStrength, 0.0, 0.75);
          vec3 tint = mix(baseColor, worldEdgeColor, worldEdgeTintMix);
          vec3 edged = mix(baseColor, tint, intensity);
          float topFace = pow(clamp(worldNormal.y, 0.0, 1.0), worldTopReadabilityPower);
          vec3 readableTop = mix(edged, worldTopReadabilityColor, 0.32);
          return mix(edged, max(edged, readableTop), clamp(topFace * worldTopReadabilityLift, 0.0, 0.58));
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `outgoingLight = applyWorldEdge(outgoingLight, vWorldGridPos);
        #include <dithering_fragment>`,
      );
  };

  material.customProgramCacheKey = () => {
    const prior = priorCacheKey ? priorCacheKey() : '';
    return `${prior}|world-edge:${JSON.stringify(settings)}`;
  };

  material.needsUpdate = true;
  return material;
}


export function createMaterialResources(deps) {
  const { textureLoader, renderer, rngFromSeed } = deps;

  function makeMat(color, roughness = 0.86, metalness = 0.04, lift = 0.055) {
      return new THREE.MeshStandardMaterial({
        color,
        fog: true,
        emissive: new THREE.Color(color).multiplyScalar(lift),
        emissiveIntensity: 1.0,
        roughness,
        metalness,
        flatShading: true,
      });
    }

    function makeRockMat(color, options = {}) {
      const material = new THREE.MeshStandardMaterial({
        color,
        fog: true,
        emissive: new THREE.Color(options.emissive ?? 0x11100f),
        emissiveIntensity: options.emissiveIntensity ?? 0.035,
        roughness: options.roughness ?? 0.88,
        metalness: options.metalness ?? 0.02,
        flatShading: false,
      });
      material.userData.isIslandRock = true;
      material.userData.normalScale = options.normalScale ?? 0.46;
      return applyEdgeOutlineOverlay(material, options.edgeOptions || {});
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
      sedimentaryRock: makeMat(0x948873, 0.9, 0.01, 0.035),
      sedimentaryRockDark: makeMat(0x6f685b, 0.92, 0.01, 0.028),
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
      timber: makeMat(0x71533b, 0.82, 0.02, 0.05),
      cloth: makeMat(0x9d5f43, 0.88, 0.01, 0.05),
      plaster: makeMat(0xd2c0a8, 0.9, 0.01, 0.045),
      ceramic: makeMat(0xb7baa8, 0.76, 0.03, 0.05),
      foliage: makeMat(0x6b8448, 0.82, 0.01, 0.06),
      water: makeMat(0x32545d, 0.52, 0.02, 0.03),
      rope: makeMat(0x9e7d52, 0.84, 0.01, 0.045),
      crystal: makeMat(0x7ac9c0, 0.68, 0.03, 0.09),
      crystalDark: makeMat(0x3f6f73, 0.78, 0.02, 0.055),
      islandRock: makeRockMat(0xffffff, { edgeOptions: { edgeColor: 0xe1d6bd, edgeStrength: 0.014, edgePower: 2.05, edgeTintMix: 0.1, topReadabilityLift: 0.26, topReadabilityColor: 0xe1d6bd, topReadabilityPower: 1.18 } }),
      islandRockDark: makeRockMat(0xe3ddd1, { emissive: 0x18120d, emissiveIntensity: 0.025, roughness: 0.8, metalness: 0.02, edgeOptions: { edgeColor: 0xe3d4b6, edgeStrength: 0.014, edgePower: 1.95, edgeTintMix: 0.16, topReadabilityLift: 0.34, topReadabilityColor: 0xe3d4b6, topReadabilityPower: 1.08 } }),
    };

    function setMaterialUvScale(mat, scale) {
      mat.userData.uvScale = scale;
      return mat;
    }

    for (const mat of [MAT.floor, MAT.wall, MAT.platform, MAT.connectorFloor, MAT.connectorWall, MAT.stone, MAT.stone2, MAT.plaster]) setMaterialUvScale(mat, 0.125);
    for (const mat of [MAT.bridge, MAT.trim, MAT.bronze, MAT.timber]) setMaterialUvScale(mat, 0.105);
    for (const mat of [MAT.bone, MAT.bonePlain, MAT.ceramic]) setMaterialUvScale(mat, 0.112);
    setMaterialUvScale(MAT.iron, 0.075);
    setMaterialUvScale(MAT.blood, 0.055);
    setMaterialUvScale(MAT.cloth, 0.092);
    setMaterialUvScale(MAT.foliage, 0.09);
    setMaterialUvScale(MAT.water, 0.08);
    setMaterialUvScale(MAT.rope, 0.065);
    setMaterialUvScale(MAT.crystal, 0.082);
    setMaterialUvScale(MAT.crystalDark, 0.078);
    setMaterialUvScale(MAT.islandRock, 0.125);
    setMaterialUvScale(MAT.islandRockDark, 0.125);
    setMaterialUvScale(MAT.sedimentaryRock, 0.072);
    setMaterialUvScale(MAT.sedimentaryRockDark, 0.072);

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
      const crystalNoise = makeVoronoiTexture(0x72b8bc, { size: 96, cells: 26, base: 0.86, contrast: 0.16, edgeDarken: 0.24, edgeScale: 0.028, repeatX: 3, repeatY: 4 });
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
      MAT.timber.map = bronzeNoise;
      MAT.timber.needsUpdate = true;
      MAT.cloth.map = bronzeNoise;
      MAT.cloth.needsUpdate = true;
      MAT.plaster.map = wallNoise;
      MAT.plaster.needsUpdate = true;
      MAT.ceramic.map = bronzeNoise;
      MAT.ceramic.needsUpdate = true;
      MAT.foliage.map = floorNoise;
      MAT.foliage.needsUpdate = true;
      MAT.water.map = floorNoise;
      MAT.water.needsUpdate = true;
      MAT.rope.map = bronzeNoise;
      MAT.rope.needsUpdate = true;
      MAT.crystal.map = crystalNoise;
      MAT.crystal.needsUpdate = true;
      MAT.crystalDark.map = crystalNoise;
      MAT.crystalDark.needsUpdate = true;
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


    function loadPbrTextureSet(config = {}) {
      const result = {
        albedo: null,
        normal: null,
        roughness: null,
        metalness: null,
        height: null,
        ao: null,
        emissive: null,
      };
      const entries = [
        ['albedo', config.albedo, THREE.SRGBColorSpace],
        ['normal', config.normal, THREE.NoColorSpace],
        ['roughness', config.roughness, THREE.NoColorSpace],
        ['metalness', config.metalness, THREE.NoColorSpace],
        ['height', config.height, THREE.NoColorSpace],
        ['ao', config.ao, THREE.NoColorSpace],
        ['emissive', config.emissive, THREE.SRGBColorSpace],
      ];
      for (const [key, path, colorSpace] of entries) {
        if (!path) continue;
        const url = new URL(path, import.meta.url).href;
        const texture = textureLoader.load(url);
        texture.colorSpace = colorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() || 1);
        texture.needsUpdate = true;
        result[key] = texture;
      }
      return result;
    }

    function applyPbrSetToMaterial(material, maps, options = {}) {
      if (!material || !(maps?.albedo || maps?.emissive)) return;
      material.map = maps.albedo || maps.emissive || null;
      if ('normalMap' in material) material.normalMap = maps.normal || null;
      if ('roughnessMap' in material) material.roughnessMap = maps.roughness || null;
      if ('metalnessMap' in material) material.metalnessMap = maps.metalness || null;
      if ('bumpMap' in material) material.bumpMap = maps.height || null;
      if ('aoMap' in material) material.aoMap = maps.ao || null;
      if ('aoMapIntensity' in material) material.aoMapIntensity = options.aoMapIntensity ?? 0.72;
      if ('emissiveMap' in material) material.emissiveMap = maps.emissive || null;
      if (maps.emissive && 'emissive' in material) {
        material.emissive = material.emissive || new THREE.Color(0xffffff);
        material.emissive.setHex(options.emissive ?? 0xffffff);
        material.emissiveIntensity = options.emissiveIntensity ?? material.emissiveIntensity ?? 0.35;
      }
      if ('alphaMap' in material && material.transparent && maps.emissive && !maps.albedo) {
        material.alphaMap = maps.emissive;
      }
      const normalScale = options.normalScale ?? material.userData?.normalScale ?? 0.46;
      if ('normalScale' in material) material.normalScale = new THREE.Vector2(normalScale, normalScale);
      if ('bumpScale' in material) material.bumpScale = options.bumpScale ?? 0.035;
      if ('envMapIntensity' in material) material.envMapIntensity = options.envMapIntensity ?? 0.56;
      if ('roughness' in material && Number.isFinite(options.roughness)) material.roughness = options.roughness;
      if ('metalness' in material && Number.isFinite(options.metalness)) material.metalness = options.metalness;
      if (maps.albedo && material.color) material.color.setHex(0xffffff);
      material.needsUpdate = true;
    }

    function applyRockPbrSet(material, maps, options = {}) {
      applyPbrSetToMaterial(material, maps, options);
    }

    function normalizeManifestAssetPath(assetPath) {
      if (!assetPath) return null;
      const normalized = assetPath.startsWith('assets/') ? `../${assetPath}` : assetPath;
      if (normalized.includes('/ib_pbr/')) return `${normalized}?v=${MANIFEST_TEXTURE_VERSION}`;
      return normalized;
    }

    async function applyManifestPbrMaterials() {
      const manifestUrl = new URL('../assets/materials/ib_pbr_material_manifest.json', import.meta.url).href;
      try {
        const response = await fetch(manifestUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = await response.json();
        for (const entry of manifest.materials || []) {
          if (entry.runtimeApproved !== true) continue;
          const runtimeKeys = Array.isArray(entry.runtimeKeys) ? entry.runtimeKeys : [];
          const materials = runtimeKeys.map((key) => MAT[key]).filter(Boolean);
          if (!materials.length) continue;
          const channels = entry.channels || {};
          const maps = loadPbrTextureSet({
            albedo: normalizeManifestAssetPath(channels.albedo),
            normal: normalizeManifestAssetPath(channels.normal),
            roughness: normalizeManifestAssetPath(channels.roughness),
            metalness: normalizeManifestAssetPath(channels.metalness),
            height: normalizeManifestAssetPath(channels.height),
            ao: normalizeManifestAssetPath(channels.ao),
            emissive: normalizeManifestAssetPath(channels.emissive),
          });
          for (const material of materials) {
            material.userData.pbrManifestId = entry.id;
            applyPbrSetToMaterial(material, maps, entry.runtimeParams || {});
          }
        }
      } catch (error) {
        console.warn('IB PBR material manifest failed; generated/vector fallbacks remain', error);
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
      loadWrappedTexture('../assets/textures/ib-vector-timber-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.timber], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-cloth-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.cloth], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-plaster-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.plaster], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-ceramic-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.ceramic], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-garden-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.foliage, MAT.green], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-water-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.water], 0xffffff);
      });
      loadWrappedTexture('../assets/textures/ib-vector-rope-20260610.svg', 1, 1, (texture) => {
        applyTextureToMaterials(texture, [MAT.rope], 0xffffff);
      });
    }

    function applySedimentaryTerrainTexture() {
      loadWrappedTexture('../assets/textures/openai-sedimentary-mesa-albedo-20260616.png', 1, 1, (texture) => {
        texture.anisotropy = 1;
        applyTextureToMaterials(texture, [MAT.sedimentaryRock, MAT.sedimentaryRockDark], 0xffffff);
      });
    }

    applyProceduralSurfaceTextures();
    applyGeneratedSurfaceTextures();
    applySedimentaryTerrainTexture();
    const meshyRockMaps = loadPbrTextureSet({
      albedo: '../assets/textures/openai-meshy-rock-albedo-20260615-readable.png',
      normal: '../assets/textures/openai-meshy-rock-normal-20260615-readable.png',
      roughness: '../assets/textures/openai-meshy-rock-roughness-20260615-readable.png',
      metalness: '../assets/textures/openai-meshy-rock-metalness-20260615-readable.png',
      height: '../assets/textures/openai-meshy-rock-height-20260615-readable.png',
    });
    applyRockPbrSet(MAT.islandRock, meshyRockMaps, { normalScale: 0.16, bumpScale: 0.01, envMapIntensity: 0.92 });
    applyRockPbrSet(MAT.islandRockDark, meshyRockMaps, { normalScale: 0.12, bumpScale: 0.008, envMapIntensity: 0.9 });
    applyManifestPbrMaterials();

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

  return {
    MAT,
    buildLimboSkyDome,
  };
}
