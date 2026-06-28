import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DISTRICT_INTENT_IDS,
  DISTRICT_INTENT_PROFILES,
  DISTRICT_INTENT_REQUIRED_FIELDS,
  buildDistrictIntentPlan,
  validateDistrictIntentPlan,
} from '../src/district-intent-planner.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const carvedSource = readFileSync(new URL('../src/carved-voxel-fortress-slice.js', import.meta.url), 'utf8');

assert.deepEqual(DISTRICT_INTENT_IDS, [
  'artillery_battery',
  'cloud_dock',
  'imperial_foundry',
  'quarry_barracks',
]);

const requiredIdentityReads = {
  artillery_battery: ['Battery Emplacement', 'Parapet', 'firing arc'],
  cloud_dock: ['Dock Edge', 'Crane Base', 'cargo'],
  imperial_foundry: ['Furnace Hall', 'Catwalk', 'cooling'],
  quarry_barracks: ['Quarry Face', 'Lift Cage', 'shelf'],
};

for (const id of DISTRICT_INTENT_IDS) {
  const profile = DISTRICT_INTENT_PROFILES[id];
  const plan = buildDistrictIntentPlan(17, id);
  assert.equal(plan.id, id);
  assert.equal(plan.validation.passes, true, `${id} planner validation failed: ${plan.validation.failedChecks.join(', ')}`);
  assert.deepEqual(validateDistrictIntentPlan(plan), plan.validation, `${id} validation must be deterministic`);
  for (const field of DISTRICT_INTENT_REQUIRED_FIELDS) {
    assert.ok(Object.hasOwn(plan, field), `${id} missing required field ${field}`);
  }
  assert.ok(plan.requiredPhrases.length > 0, `${id} must declare required phrases`);
  assert.ok(plan.requiredAssemblies.length >= 4, `${id} must declare required assemblies`);
  assert.ok(plan.supportingAtoms.length >= 3, `${id} must declare supporting structural atoms`);
  assert.ok(plan.logisticsFlow.length >= 4, `${id} must declare logistics flow`);
  assert.ok(plan.expectedSkyline.length >= 3, `${id} must declare skyline identity`);
  assert.ok(plan.expectedSilhouette.length >= 3, `${id} must declare silhouette identity`);
  assert.ok(plan.traversalIdentity.length >= 4, `${id} must declare traversal identity`);
  assert.ok(plan.materialBias.length >= 3, `${id} must declare material bias`);
  assert.ok(plan.hazardBias.length >= 3, `${id} must declare hazard bias`);
  assert.ok(plan.validationTags.length >= 4, `${id} must declare validation tags`);
  assert.notEqual(plan.displayName, 'Carved Voxel Fortress', `${id} must not collapse to generic carved fortress identity`);
  for (const read of requiredIdentityReads[id]) {
    const packet = JSON.stringify(profile).toLowerCase();
    assert.ok(packet.includes(read.toLowerCase()), `${id} missing identity read ${read}`);
  }
}

assert.match(mainSource, /import \{ buildDistrictIntentPlan \} from '\.\/district-intent-planner\.js\?v=0\.8\.205'/, 'runtime must import the district intent planner with cache bust');
assert.match(mainSource, /import \{ buildDistrictAssemblyPlan \} from '\.\/district-assembly-emitter\.js\?v=0\.8\.205'/, 'runtime must import the district assembly emitter with cache bust');
assert.match(mainSource, /const ACTIVE_DISTRICT_ID = URL_PARAMS\.get\('district'\) \|\| 'artillery_battery'/, 'runtime must expose ?district= selection with artillery battery default');
assert.match(mainSource, /const districtIntent = buildDistrictIntentPlan\(hashRoomKey\(ACTIVE_DISTRICT_ID \+ ':' \+ roomState\.levelIndex\), ACTIVE_DISTRICT_ID\)/, 'carved slice must build district intent before terrain data');
assert.match(mainSource, /addDistrictIntentReadabilityProps\(districtIntent\)/, 'runtime must emit screenshot-visible district identity props');
assert.match(mainSource, /districtIntentPlans: \[districtIntent\]/, 'district plan must expose intent plans');
assert.match(mainSource, /districtAssemblyPlans: \[emittedAssemblyPlan\]/, 'district plan must expose assembly plans');
assert.match(mainSource, /districtLogisticsFlow: district\.logisticsFlow/, 'debug plan must expose district logistics flow');
assert.match(mainSource, /districtTraversalIdentity: district\.traversalIdentity/, 'debug plan must expose district traversal identity');
assert.match(carvedSource, /districtIntent = options\.districtIntent \|\| null/, 'carved data builder must accept district intent');
assert.match(carvedSource, /field\.rockGrammar\.imperialFunction = districtIntent\.id/, 'voxel field grammar must receive district purpose');

console.log(JSON.stringify({
  ok: true,
  contract: 'district-intent-planner',
  districts: DISTRICT_INTENT_IDS.length,
  ids: DISTRICT_INTENT_IDS,
}));
