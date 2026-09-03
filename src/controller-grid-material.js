import * as THREE from 'three';

const GRID_DEFAULTS = {
  gridColor: 0x9cefff,
  gridScale: 0.34,
  gridThickness: 0.7,
  gridStrength: 0.14,
  edgeStrength: 0.28,
  edgePower: 2.2,
  edgeTintMix: 0.7,
};

const EDGE_DEFAULTS = {
  edgeColor: 0x9cefff,
  edgeStrength: 0.24,
  edgePower: 2.4,
  edgeTintMix: 0.68,
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

export function applyEdgeOutlineOverlay(material, options = {}) {
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

        vec3 applyWorldEdge(vec3 baseColor, vec3 worldPos) {
          vec3 worldNormal = faceWorldNormal(worldPos);
          vec3 viewDir = normalize(cameraPosition - worldPos);
          float edge = pow(max(0.0, 1.0 - abs(dot(worldNormal, viewDir))), worldEdgePower);
          float intensity = clamp(edge * worldEdgeStrength, 0.0, 0.75);
          vec3 tint = mix(baseColor, worldEdgeColor, worldEdgeTintMix);
          return mix(baseColor, tint, intensity);
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

export function applyWorldGridOverlay(material, options = {}) {
  const settings = { ...GRID_DEFAULTS, ...options };
  const gridColor = new THREE.Color(settings.gridColor);
  const priorOnBeforeCompile = material.onBeforeCompile;
  const priorCacheKey = material.customProgramCacheKey?.bind(material);

  material.onBeforeCompile = (shader) => {
    priorOnBeforeCompile?.(shader);

    shader.uniforms.worldGridColor = { value: gridColor };
    shader.uniforms.worldGridScale = { value: settings.gridScale };
    shader.uniforms.worldGridThickness = { value: settings.gridThickness };
    shader.uniforms.worldGridStrength = { value: settings.gridStrength };
    shader.uniforms.worldGridEdgeStrength = { value: settings.edgeStrength };
    shader.uniforms.worldGridEdgePower = { value: settings.edgePower };
    shader.uniforms.worldGridEdgeTintMix = { value: settings.edgeTintMix };

    installWorldPosVarying(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${faceWorldNormalFragmentBlock()}
        uniform vec3 worldGridColor;
        uniform float worldGridScale;
        uniform float worldGridThickness;
        uniform float worldGridStrength;
        uniform float worldGridEdgeStrength;
        uniform float worldGridEdgePower;
        uniform float worldGridEdgeTintMix;

        float worldGridLine(vec2 uv, float thickness) {
          vec2 grid = abs(fract(uv - 0.5) - 0.5) / max(fwidth(uv), vec2(0.0001));
          float line = min(grid.x, grid.y);
          return 1.0 - smoothstep(thickness, thickness + 1.0, line);
        }

        vec3 applyWorldGrid(vec3 baseColor, vec3 worldPos) {
          vec3 worldNormal = faceWorldNormal(worldPos);
          vec3 weights = abs(worldNormal);
          weights = max(weights, vec3(0.0001));
          weights /= (weights.x + weights.y + weights.z);

          float gridXY = worldGridLine(worldPos.xy * worldGridScale, worldGridThickness);
          float gridXZ = worldGridLine(worldPos.xz * worldGridScale, worldGridThickness);
          float gridYZ = worldGridLine(worldPos.yz * worldGridScale, worldGridThickness);
          float surfaceGrid = gridXY * weights.z + gridXZ * weights.y + gridYZ * weights.x;

          vec3 viewDir = normalize(cameraPosition - worldPos);
          float edge = pow(max(0.0, 1.0 - abs(dot(worldNormal, viewDir))), worldGridEdgePower);
          float intensity = clamp(surfaceGrid * worldGridStrength + edge * worldGridEdgeStrength, 0.0, 0.82);
          vec3 tint = mix(baseColor, worldGridColor, worldGridEdgeTintMix);
          return mix(baseColor, tint, intensity);
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `outgoingLight = applyWorldGrid(outgoingLight, vWorldGridPos);
        #include <dithering_fragment>`,
      );
  };

  material.customProgramCacheKey = () => {
    const prior = priorCacheKey ? priorCacheKey() : '';
    return `${prior}|world-grid:${JSON.stringify(settings)}`;
  };

  material.needsUpdate = true;
  return material;
}
