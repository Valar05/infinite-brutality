import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRoomIslandField, buildRockBridgeField, buildSurfaceNetMeshData } from '../src/island-geometry.js';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const materials = fs.readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');

function hexLuma(hex) {
  const value = Number(hex);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function normalize(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function parseNumber(value) {
  const parsed = Number(value.trim());
  assert.ok(Number.isFinite(parsed), `expected finite light number, got ${value}`);
  return parsed;
}

function sectionBetween(startPattern, endPattern) {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `missing section start ${startPattern}`);
  const rest = source.slice(start);
  const end = rest.search(endPattern);
  assert.notEqual(end, -1, `missing section end ${endPattern}`);
  return rest.slice(0, end);
}

function parseLightRig(section) {
  const lights = [];
  for (const match of section.matchAll(/new THREE\.HemisphereLight\((0x[0-9a-f]+),\s*(0x[0-9a-f]+),\s*([0-9.]+)\)/gi)) {
    lights.push({ type: 'hemisphere', sky: Number(match[1]), ground: Number(match[2]), intensity: parseNumber(match[3]) });
  }
  for (const match of section.matchAll(/new THREE\.AmbientLight\((0x[0-9a-f]+),\s*([0-9.]+)\)/gi)) {
    lights.push({ type: 'ambient', color: Number(match[1]), intensity: parseNumber(match[2]) });
  }
  for (const match of section.matchAll(/const\s+(\w+)\s*=\s*new THREE\.DirectionalLight\((0x[0-9a-f]+),\s*([0-9.]+)\);[\s\S]*?\1\.position\.set\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/gi)) {
    lights.push({
      type: 'directional',
      color: Number(match[2]),
      intensity: parseNumber(match[3]),
      direction: normalize({ x: parseNumber(match[4]), y: parseNumber(match[5]), z: parseNumber(match[6]) }),
    });
  }
  assert.ok(lights.some((light) => light.type === 'ambient'), 'light rig should expose the ambient readability floor');
  assert.ok(lights.length >= 3, 'light rig should expose hemisphere, ambient floor, and key light');
  return lights;
}

function luminanceForNormal(lights, normal) {
  let total = 0;
  for (const light of lights) {
    if (light.type === 'hemisphere') {
      const t = Math.max(0, Math.min(1, normal.y * 0.5 + 0.5));
      total += ((1 - t) * hexLuma(light.ground) + t * hexLuma(light.sky)) * light.intensity;
    } else if (light.type === 'ambient') {
      total += hexLuma(light.color) * light.intensity;
    } else {
      total += Math.max(0, dot(normal, light.direction)) * hexLuma(light.color) * light.intensity;
    }
  }
  return total;
}

function assertTopIsBrightest(label, lights, options = {}) {
  const minTopBottomRatio = options.minTopBottomRatio ?? 12;
  const minBottomLight = options.minBottomLight ?? 0.12;
  const normals = {
    top: { x: 0, y: 1, z: 0 },
    bottom: { x: 0, y: -1, z: 0 },
    front: { x: 0, y: 0, z: 1 },
    back: { x: 0, y: 0, z: -1 },
    left: { x: -1, y: 0, z: 0 },
    right: { x: 1, y: 0, z: 0 },
  };
  const scores = Object.fromEntries(Object.entries(normals).map(([name, normal]) => [name, luminanceForNormal(lights, normal)]));
  const brightest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(brightest, 'top', `${label} brightest ideal surface must be top: ${JSON.stringify(scores)}`);
  assert.ok(scores.top > scores.bottom * minTopBottomRatio, `${label} top must crush bottom light: ${JSON.stringify(scores)}`);
  const brightestSide = Math.max(scores.front, scores.back, scores.left, scores.right);
  assert.ok(scores.top > brightestSide * 1.12, `${label} top must remain the clearest key while preserving Meshy-style side detail: ${JSON.stringify(scores)}`);
  assert.ok(scores.bottom > minBottomLight, `${label} bottom-facing surfaces need a visible non-black material floor: ${JSON.stringify(scores)}`);
  return scores;
}

function faceNormal(p, offset) {
  const ax = p[offset], ay = p[offset + 1], az = p[offset + 2];
  const bx = p[offset + 3], by = p[offset + 4], bz = p[offset + 5];
  const cx = p[offset + 6], cy = p[offset + 7], cz = p[offset + 8];
  return normalize({
    x: (by - ay) * (cz - az) - (bz - az) * (cy - ay),
    y: (bz - az) * (cx - ax) - (bx - ax) * (cz - az),
    z: (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
  });
}

function emittedTriangleNormal(normals, offset) {
  return normalize({
    x: normals[offset] + normals[offset + 3] + normals[offset + 6],
    y: normals[offset + 1] + normals[offset + 4] + normals[offset + 7],
    z: normals[offset + 2] + normals[offset + 5] + normals[offset + 8],
  });
}

function terrainLightingBands(field, lights) {
  const mesh = buildSurfaceNetMeshData(field);
  const rows = [];
  for (let i = 0; i < mesh.positions.length; i += 9) {
    const face = faceNormal(mesh.positions, i);
    const emitted = emittedTriangleNormal(mesh.normals, i);
    const centerY = (mesh.positions[i + 1] + mesh.positions[i + 4] + mesh.positions[i + 7]) / 3;
    rows.push({ faceY: face.y, normalY: emitted.y, centerY, light: luminanceForNormal(lights, emitted) });
  }
  rows.sort((a, b) => a.centerY - b.centerY);
  const topY = rows[Math.floor(rows.length * 0.72)]?.centerY ?? 0;
  const bottomY = rows[Math.floor(rows.length * 0.28)]?.centerY ?? 0;
  const top = rows.filter((row) => row.centerY >= topY && row.faceY > 0.35);
  const bottom = rows.filter((row) => row.centerY <= bottomY && row.faceY < -0.35);
  assert.ok(top.length >= 8, `expected enough upward top triangles, got ${top.length}`);
  assert.ok(bottom.length >= 8, `expected enough downward underside triangles, got ${bottom.length}`);
  const avg = (items, key) => items.reduce((sum, item) => sum + item[key], 0) / items.length;
  return {
    triangles: rows.length,
    topCount: top.length,
    bottomCount: bottom.length,
    topFaceY: avg(top, 'faceY'),
    topNormalY: avg(top, 'normalY'),
    topLight: avg(top, 'light'),
    bottomFaceY: avg(bottom, 'faceY'),
    bottomNormalY: avg(bottom, 'normalY'),
    bottomLight: avg(bottom, 'light'),
  };
}

function assertTerrainTopLit(label, field, lights) {
  const stats = terrainLightingBands(field, lights);
  assert.ok(stats.topFaceY > 0.55, `${label} top classifier must be upward-facing: ${JSON.stringify(stats)}`);
  assert.ok(stats.bottomFaceY < -0.55, `${label} bottom classifier must be downward-facing: ${JSON.stringify(stats)}`);
  assert.ok(stats.topNormalY > 0.35, `${label} emitted top normals must point up for PBR lighting: ${JSON.stringify(stats)}`);
  assert.ok(stats.bottomNormalY < -0.35, `${label} emitted underside normals must point down for PBR lighting: ${JSON.stringify(stats)}`);
  assert.ok(stats.topLight > stats.bottomLight * 1.8, `${label} generated terrain tops must stay brighter than undersides while preserving underside readability: ${JSON.stringify(stats)}`);
  assert.ok(stats.bottomLight > 0.24, `${label} undersides must not collapse to pure black: ${JSON.stringify(stats)}`);
  return stats;
}

const armsSection = sectionBetween(/const armsScene = new THREE\.Scene\(\);/, /const clock = new THREE\.Clock\(\);/);
const worldSection = sectionBetween(/function buildLights\(\) \{/, /function buildFallbackArms\(\) \{/);
const armsScores = assertTopIsBrightest('first-person arms', parseLightRig(armsSection), { minTopBottomRatio: 2.2, minBottomLight: 1.2 });
const worldLights = parseLightRig(worldSection);
const worldScores = assertTopIsBrightest('world', worldLights, { minTopBottomRatio: 7, minBottomLight: 0.46 });
const terrainStats = [
  assertTerrainTopLit('terraced graft-market island', buildRoomIslandField([35, 13, 30], 1001, true), worldLights),
  assertTerrainTopLit('terraced archive island', buildRoomIslandField([29, 12, 26], 1409, true), worldLights),
  assertTerrainTopLit('stair ramp bridge', buildRockBridgeField(10, 5.8, 1.55, 2000), worldLights),
];

assert.match(source, /const environmentPmrem = new THREE\.PMREMGenerator\(renderer\);/, 'world should use a PMREM environment map for Meshy-like material readability');
assert.match(source, /scene\.environment = environmentMap;[\s\S]*armsScene\.environment = environmentMap;/, 'environment lighting must apply to both world and first-person arms');
assert.match(source, /scene\.environmentIntensity = 0\.96;[\s\S]*armsScene\.environmentIntensity = 1\.28;/, 'environment intensity should visibly lift detail without replacing the top key');
assert.match(materials, /material\.envMapIntensity = options\.envMapIntensity \?\? 0\.56;/, 'rock material should opt into environment response');
assert.match(materials, /envMapIntensity: 0\.92[\s\S]*envMapIntensity: 0\.9/, 'island rock materials should use visible environment intensity');
assert.match(materials, /float topFace = pow\(clamp\(worldNormal\.y, 0\.0, 1\.0\)/, 'terrain readability lift must be driven only by upward-facing normals');
assert.doesNotMatch(materials, /clamp\(-worldNormal\.y|abs\(worldNormal\.y\)/, 'terrain readability lift must not brighten bottom-facing surfaces');

console.log(JSON.stringify({ ok: true, contract: 'light-direction-generated-terrain-top-brightest', armsScores, worldScores, terrainStats }, null, 2));
