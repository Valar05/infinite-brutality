export const DISTRICT_INTENT_IDS = [
  'artillery_battery',
  'cloud_dock',
  'imperial_foundry',
  'quarry_barracks',
];

export const DISTRICT_INTENT_REQUIRED_FIELDS = [
  'id',
  'displayName',
  'purpose',
  'primaryGameplayLoop',
  'landmark',
  'requiredPhrases',
  'optionalPhrases',
  'requiredAssemblies',
  'supportingAtoms',
  'logisticsFlow',
  'militaryCivilFunction',
  'expectedSkyline',
  'expectedSilhouette',
  'traversalIdentity',
  'materialBias',
  'hazardBias',
  'validationTags',
];

export const DISTRICT_INTENT_PROFILES = {
  artillery_battery: {
    id: 'artillery_battery',
    displayName: 'Artillery Battery',
    purpose: 'void-facing imperial gun position cut into a floating fortress mass',
    primaryGameplayLoop: 'approach through protected rear service, read the firing line, cross the exposed battery, then climb to the command chamber',
    landmark: {
      id: 'forward-gun-platform',
      label: 'Forward Gun Platform',
      requiredAssemblies: ['Battery Emplacement', 'Parapet', 'Machinery Plinth'],
      visibilityRole: 'front void-facing silhouette',
    },
    requiredPhrases: ['Parapet -> Battery Emplacement -> Rear Service Tunnel', 'Alcove -> Battery Emplacement -> Rear Service Tunnel', 'Compression -> Reveal'],
    optionalPhrases: ['Wall Bay -> Corner Transition -> Gatehouse', 'Cliff Cut -> Side Passage -> Overlook'],
    requiredAssemblies: ['Battery Emplacement', 'Parapet', 'Service Tunnel', 'Alcove', 'Gatehouse'],
    supportingAtoms: ['Retaining Wall', 'Wall Bay', 'Buttress', 'Parapet'],
    logisticsFlow: ['ammo recess', 'rear protected service route', 'gun platform', 'firing arc'],
    militaryCivilFunction: 'military defense and bombardment control',
    expectedSkyline: ['low parapet teeth', 'single gun barrel silhouette', 'rear service shoulders'],
    expectedSilhouette: ['flat defended front edge', 'recessed ammo pockets', 'void-facing muzzle line'],
    traversalIdentity: ['rear approach', 'exposed firing line', 'side service return', 'upper command overlook'],
    materialBias: ['sedimentary rock', 'dark iron', 'scarred masonry'],
    hazardBias: ['open firing edge', 'broken void side', 'blast-scarred cover'],
    validationTags: ['firing_arc', 'rear_service', 'ammo_logistics', 'parapet_read', 'void_edge'],
  },
  cloud_dock: {
    id: 'cloud_dock',
    displayName: 'Cloud Dock',
    purpose: 'cargo landing edge carved into the rock for airship loading and service routes',
    primaryGameplayLoop: 'enter through a cargo court, choose dock-edge risk or warehouse bypass, then climb past the crane to the upper service exit',
    landmark: {
      id: 'void-crane-and-dock-lip',
      label: 'Void Crane And Dock Lip',
      requiredAssemblies: ['Dock Edge', 'Crane Base', 'Warehouse Bay'],
      visibilityRole: 'tall crane over a void-facing loading edge',
    },
    requiredPhrases: ['Dock Edge -> Crane Base -> Warehouse', 'Service Tunnel -> Secret Exit'],
    optionalPhrases: ['Bridge Abutment -> Bridge Span -> Tower Gate', 'Dock Edge -> Catwalk -> Service Tunnel', 'Cliff Cut -> Side Passage -> Overlook'],
    requiredAssemblies: ['Dock Edge', 'Crane Base', 'Warehouse Bay', 'Service Tunnel', 'Catwalk'],
    supportingAtoms: ['Bridge Abutment', 'Machinery Plinth', 'Wall Bay', 'Parapet'],
    logisticsFlow: ['dock lip', 'crane working radius', 'cargo staging', 'warehouse/service route'],
    militaryCivilFunction: 'civil and military cargo transfer',
    expectedSkyline: ['crane mast', 'horizontal loading lip', 'stacked cargo blocks'],
    expectedSilhouette: ['void-facing platform bite', 'overhead boom', 'warehouse mouth behind the dock'],
    traversalIdentity: ['cargo zigzag', 'risky dock edge', 'protected warehouse bypass', 'upper service return'],
    materialBias: ['sedimentary rock', 'weathered iron', 'cargo-dark wood'],
    hazardBias: ['falling void edge', 'crane blind corner', 'narrow loading lip'],
    validationTags: ['dock_edge', 'crane_radius', 'cargo_flow', 'warehouse_adjacency', 'service_route'],
  },
  imperial_foundry: {
    id: 'imperial_foundry',
    displayName: 'Imperial Foundry',
    purpose: 'industrial heat-process chamber where furnace, catwalk, cooling route, and exhaust are one playable machine',
    primaryGameplayLoop: 'read the furnace hazard, cross service catwalks, use the cooling side route, then exit through the vented upper chamber',
    landmark: {
      id: 'furnace-core',
      label: 'Furnace Core',
      requiredAssemblies: ['Furnace Hall', 'Machinery Plinth', 'Catwalk'],
      visibilityRole: 'hot central process mass with overhead venting',
    },
    requiredPhrases: ['Foundry Plinth -> Catwalk -> Furnace -> Cooling Hall'],
    optionalPhrases: ['Service Tunnel -> Secret Exit', 'Tower Base -> Shaft -> Tower Crown'],
    requiredAssemblies: ['Furnace Hall', 'Machinery Plinth', 'Catwalk', 'Cooling Hall', 'Service Tunnel'],
    supportingAtoms: ['Roof Monitor', 'Buttress', 'Retaining Wall', 'Bridge Pier'],
    logisticsFlow: ['ore/fuel input', 'furnace core', 'service catwalk', 'cooling exhaust', 'output route'],
    militaryCivilFunction: 'industrial production and repair',
    expectedSkyline: ['roof monitor vents', 'vertical stacks', 'catwalk line over hazard'],
    expectedSilhouette: ['central furnace bite', 'overhead service crossing', 'exhaust crown'],
    traversalIdentity: ['heat-core avoidance', 'catwalk commitment', 'cooling side escape', 'upper vent exit'],
    materialBias: ['charred masonry', 'black iron', 'hot orange hazard'],
    hazardBias: ['heat core', 'narrow catwalk', 'steam/exhaust choke'],
    validationTags: ['furnace_core', 'catwalk_crossing', 'cooling_exit', 'exhaust_path', 'service_perimeter'],
  },
  quarry_barracks: {
    id: 'quarry_barracks',
    displayName: 'Quarry Barracks',
    purpose: 'old extraction face retrofitted into shelf barracks and processing access',
    primaryGameplayLoop: 'move along cut shelves, climb the quarry service route, read barracks pockets, then reach the processing/overlook chamber',
    landmark: {
      id: 'quarry-face-lift',
      label: 'Quarry Face Lift',
      requiredAssemblies: ['Quarry Face', 'Lift Cage', 'Terrace'],
      visibilityRole: 'stepped extraction wall with lift rails and inhabited shelves',
    },
    requiredPhrases: ['Quarry Face -> Lift Cage -> Processing Yard', 'Retaining Wall -> Stair -> Terrace'],
    optionalPhrases: ['Processing Yard -> Warehouse Bay -> Service Tunnel', 'Cliff Cut -> Side Passage -> Overlook', 'Wall Bay -> Corner Transition -> Gatehouse'],
    requiredAssemblies: ['Quarry Face', 'Lift Cage', 'Terrace', 'Service Tunnel', 'Warehouse Bay'],
    supportingAtoms: ['Retaining Wall', 'Wall Bay', 'Buttress', 'Bridge Pier'],
    logisticsFlow: ['extraction face', 'lift route', 'processing shelf', 'barracks pockets', 'service exit'],
    militaryCivilFunction: 'resource extraction retrofitted into troop housing',
    expectedSkyline: ['stepped quarry shelves', 'lift rail pair', 'small barracks mouths'],
    expectedSilhouette: ['cut rock face', 'tiered shelf profile', 'repeated inhabited recesses'],
    traversalIdentity: ['shelf climb', 'mountable wall reads', 'barracks alcove detours', 'processing-yard exit'],
    materialBias: ['raw cut stone', 'rough retaining walls', 'work iron'],
    hazardBias: ['loose ledges', 'vertical quarry face', 'service lift void'],
    validationTags: ['quarry_face', 'lift_route', 'shelf_barracks', 'processing_flow', 'retaining_terraces'],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeDistrictIntentId(districtId, seed = 1) {
  if (DISTRICT_INTENT_PROFILES[districtId]) return districtId;
  const numericSeed = Number.isFinite(seed) ? seed : hashText(String(seed));
  return DISTRICT_INTENT_IDS[Math.abs(numericSeed) % DISTRICT_INTENT_IDS.length];
}

export function validateDistrictIntentPlan(plan) {
  const missingFields = DISTRICT_INTENT_REQUIRED_FIELDS.filter((field) => {
    const value = plan?.[field];
    if (Array.isArray(value)) return value.length === 0;
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    return value === undefined || value === null || value === '';
  });
  const requiredAssembliesCovered = (plan?.requiredAssemblies || []).every((assembly) => {
    return [...(plan?.requiredPhrases || []), ...(plan?.optionalPhrases || [])].some((phrase) => phrase.includes(assembly))
      || (plan?.landmark?.requiredAssemblies || []).includes(assembly)
      || (plan?.supportingAtoms || []).includes(assembly);
  });
  const logisticsCovered = (plan?.logisticsFlow || []).length >= 4;
  const silhouetteCovered = (plan?.expectedSilhouette || []).length >= 3 && (plan?.expectedSkyline || []).length >= 3;
  const traversalCovered = (plan?.traversalIdentity || []).length >= 4;
  const validationTagsCovered = (plan?.validationTags || []).length >= 4;
  return {
    implemented: true,
    passes: missingFields.length === 0
      && requiredAssembliesCovered
      && logisticsCovered
      && silhouetteCovered
      && traversalCovered
      && validationTagsCovered,
    failedChecks: [
      ...missingFields.map((field) => `missing:${field}`),
      ...(requiredAssembliesCovered ? [] : ['required_assembly_coverage']),
      ...(logisticsCovered ? [] : ['logistics_flow']),
      ...(silhouetteCovered ? [] : ['silhouette_identity']),
      ...(traversalCovered ? [] : ['traversal_identity']),
      ...(validationTagsCovered ? [] : ['validation_tags']),
    ],
    coverage: {
      requiredPhraseCount: plan?.requiredPhrases?.length || 0,
      requiredAssemblyCount: plan?.requiredAssemblies?.length || 0,
      logisticsStepCount: plan?.logisticsFlow?.length || 0,
      skylineCueCount: plan?.expectedSkyline?.length || 0,
      silhouetteCueCount: plan?.expectedSilhouette?.length || 0,
      traversalCueCount: plan?.traversalIdentity?.length || 0,
      validationTagCount: plan?.validationTags?.length || 0,
    },
  };
}

export function buildDistrictIntentPlan(seed = 1, districtId = 'artillery_battery') {
  const id = normalizeDistrictIntentId(districtId, seed);
  const plan = clone(DISTRICT_INTENT_PROFILES[id]);
  plan.seed = seed;
  plan.routeTemplateId = `${id}_carved_fortress_route`;
  plan.generationOrder = [
    'district_purpose',
    'required_phrases',
    'required_assemblies',
    'route_cuts',
    'terrain_mesh',
    'validation',
  ];
  plan.validation = validateDistrictIntentPlan(plan);
  return plan;
}
