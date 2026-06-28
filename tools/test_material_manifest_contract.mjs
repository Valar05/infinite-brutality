import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/materials/ib_pbr_material_manifest.json');
const materialsSourcePath = path.join(root, 'src/materials.js');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const materialsSource = fs.readFileSync(materialsSourcePath, 'utf8');

assert.match(
  materialsSource,
  /new THREE\.MeshStandardMaterial/,
  'ordinary runtime materials must use MeshStandardMaterial so PBR maps affect rendering',
);
assert.match(
  materialsSource,
  /ib_pbr_material_manifest\.json/,
  'src/materials.js must fetch the generated PBR material manifest',
);
assert.match(
  materialsSource,
  /applyManifestPbrMaterials/,
  'src/materials.js must apply manifest PBR materials at runtime',
);
assert.match(
  materialsSource,
  /entry\.runtimeApproved !== true/,
  'runtime must ignore manifest texture sets unless runtimeApproved is explicitly true',
);
assert.match(
  materialsSource,
  /MANIFEST_TEXTURE_VERSION/,
  'runtime must cache-bust generated manifest texture URLs',
);
for (const runtimeChannel of ['albedo', 'normal', 'roughness', 'metalness', 'height', 'ao', 'emissive']) {
  assert.ok(materialsSource.includes(runtimeChannel), `src/materials.js must handle ${runtimeChannel} PBR channel`);
}

const matObjectMatch = materialsSource.match(/const MAT = \{([\s\S]*?)\n\s*\};/);
assert.ok(matObjectMatch, 'src/materials.js must expose a const MAT object');

const runtimeKeys = [];
for (const line of matObjectMatch[1].split('\n')) {
  const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/);
  if (match) runtimeKeys.push(match[1]);
}
assert.ok(runtimeKeys.length > 0, 'runtime MAT keys must be discoverable');

assert.equal(manifest.schemaVersion, 1, 'manifest schemaVersion must be 1');
assert.ok(Array.isArray(manifest.materials), 'manifest.materials must be an array');
assert.ok(manifest.materials.length > 0, 'manifest must define materials');

const requiredOrdinaryChannels = manifest.channelPolicy?.ordinarySurfaceRequiredChannels ?? [];
assert.deepEqual(requiredOrdinaryChannels, ['albedo', 'normal', 'roughness', 'metalness', 'height']);

const coverage = new Map();
for (const material of manifest.materials) {
  assert.ok(material.id, 'material entry needs id');
  assert.ok(Array.isArray(material.runtimeKeys), `${material.id} needs runtimeKeys`);
  assert.ok(material.runtimeKeys.length > 0, `${material.id} must cover at least one runtime key`);
  assert.ok(material.family, `${material.id} needs family`);
  assert.ok(material.role, `${material.id} needs role`);
  assert.ok(material.surfaceRead, `${material.id} needs surfaceRead`);
  assert.ok(material.status, `${material.id} needs status`);
  assert.equal(typeof material.runtimeApproved, 'boolean', `${material.id} must declare runtimeApproved boolean`);
  assert.ok(material.channels && typeof material.channels === 'object', `${material.id} needs channels object`);
  assert.ok(material.runtimeParams && typeof material.runtimeParams === 'object', `${material.id} needs runtimeParams`);
  assert.ok(typeof material.prompt === 'string' && material.prompt.length > 0, `${material.id} needs prompt`);
  assert.ok(typeof material.negativePrompt === 'string', `${material.id} needs negativePrompt`);

  for (const key of material.runtimeKeys) {
    assert.ok(runtimeKeys.includes(key), `${material.id} references unknown runtime MAT key ${key}`);
    assert.ok(!coverage.has(key), `runtime MAT key ${key} is covered by both ${coverage.get(key)} and ${material.id}`);
    coverage.set(key, material.id);
  }

  const isSpecial = material.status === 'special_case';
  const isRejected = material.status === 'rejected_placeholder';
  if (isSpecial) {
    assert.ok(material.specialCaseReason, `${material.id} special_case needs specialCaseReason`);
  } else if (!isRejected) {
    for (const channel of requiredOrdinaryChannels) {
      assert.ok(material.channels[channel], `${material.id} must declare ${channel}`);
    }
  }

  if (isRejected) {
    assert.equal(material.runtimeApproved, false, `${material.id} rejected placeholders must not be runtime approved`);
    assert.ok(material.rejectionReason, `${material.id} rejected placeholder needs rejectionReason`);
  }

  for (const [channel, assetPath] of Object.entries(material.channels)) {
    assert.ok(
      requiredOrdinaryChannels.includes(channel) || manifest.channelPolicy.optionalChannels.includes(channel),
      `${material.id} declares unsupported channel ${channel}`,
    );
    assert.ok(typeof assetPath === 'string' && assetPath.length > 0, `${material.id}.${channel} must be a path`);
    if (assetPath) {
      assert.ok(fs.existsSync(path.join(root, assetPath)), `${material.id}.${channel} asset missing: ${assetPath}`);
      assert.ok(
        assetPath.startsWith('assets/textures/ib_pbr/') || assetPath.startsWith('assets/textures/openai-'),
        `${material.id}.${channel} target must live under assets/textures/ib_pbr/ or reference existing openai texture`,
      );
    }
  }

  for (const sourcePath of material.sourceReferences ?? []) {
    assert.ok(fs.existsSync(path.join(root, sourcePath)), `${material.id} source reference missing: ${sourcePath}`);
  }
}

const missing = runtimeKeys.filter((key) => !coverage.has(key));
assert.deepEqual(missing, [], `material manifest missing runtime MAT keys: ${missing.join(', ')}`);

console.log(`Material manifest covers ${runtimeKeys.length} runtime MAT keys with ${manifest.materials.length} Infinite Brutality material definitions.`);
