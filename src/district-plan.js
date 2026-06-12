export const DISTRICT_ARCHETYPES = {
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

export const DISTRICT_MIDDLE_ARCHETYPES = [
  DISTRICT_ARCHETYPES.scaffolds,
  DISTRICT_ARCHETYPES.liftworks,
  DISTRICT_ARCHETYPES.furnace,
  DISTRICT_ARCHETYPES.refuse,
];

export const DISTRICT_ROOM_COUNT_PROFILES = [
  [10, 12, 14, 12],
  [12, 10, 12, 14],
  [11, 13, 10, 14],
  [9, 13, 12, 14],
  [12, 11, 14, 11],
];

export const DISTRICT_LOCAL_LAYOUTS = [
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

export const DISTRICT_LOCAL_LAYOUT_MAP = Object.fromEntries(DISTRICT_LOCAL_LAYOUTS.map((layout) => [layout.id, layout]));

export const DISTRICT_MACRO_TEMPLATES = {
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
    storyPilotId: 'hanging_gardens_absent_people_01',
    storyPlacementSet: 'hg_market_intake_nooks',
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
    realSourceA: 'fortified_hoist_yard',
    realSourceB: 'cliff_granary_terraces',
    skeletonType: 'lift_court_hybrid',
    patchStyle: 'counterweight_chain_retrofit',
    silhouetteRule: 'a hoist court stacked around a visible counterweight tower and upper winch gallery',
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
    storyPilotId: 'hanging_gardens_absent_people_02',
    storyPlacementSet: 'hg_shrine_rim_nooks',
  },
};

export const DISTRICT_ARCHETYPE_TEMPLATES = {
  intake: DISTRICT_MACRO_TEMPLATES.intake,
  scaffolds: DISTRICT_MACRO_TEMPLATES.scaffolds,
  liftworks: DISTRICT_MACRO_TEMPLATES.liftworks,
  furnace: DISTRICT_MACRO_TEMPLATES.furnace,
  refuse: DISTRICT_MACRO_TEMPLATES.refuse,
  shrine: DISTRICT_MACRO_TEMPLATES.shrine,
};

export const DEFAULT_ARCHITECTURAL_FAMILY = 'hanging_gardens';

export const DISTRICT_STORY_PACKET_FAMILY = {
  hg_np_01_cistern_sleep_ledge: 'shelter',
  hg_np_02_lamp_shelf_shrine: 'shrine',
  hg_np_03_splice_bench: 'repair',
  hg_np_04_grain_wall_recess: 'ration',
  hg_np_05_name_veil_niche: 'burial',
  hg_np_06_bath_step_corner: 'shelter',
  hg_np_07_toll_icon_shelf: 'shrine',
  hg_np_08_hidden_jar_crawlspace: 'ration',
  hg_np_09_bell_blind_memorial: 'burial',
  hg_np_10_garden_graft_table: 'repair',
  hg_np_11_veil_stair_school: 'shelter',
  hg_np_12_underbridge_ash_wrap: 'burial',
  hg2_np_01_bell_tongue_reliquary: 'shrine',
  hg2_np_02_witness_step_school: 'shelter',
  hg2_np_03_double_seal_bench: 'repair',
  hg2_np_04_unblessed_water_shelf: 'ration',
  hg2_np_05_unrung_memorial_arc: 'burial',
  hg2_np_06_roof_curtain_cell: 'shelter',
  hg2_np_07_substitute_offering_wall: 'shrine',
  hg2_np_08_cistern_cap_table: 'repair',
  hg2_np_09_handprint_count_panel: 'shrine',
  hg2_np_10_blind_choir_corner: 'shrine',
  hg2_np_11_linen_name_drawer: 'burial',
  hg2_np_12_sealed_stair_cache: 'ration',
};

export const DISTRICT_STORY_PLACEMENT_RUNTIME_SETS = {
  hg_market_intake_nooks: {
    pilotId: 'hanging_gardens_absent_people_01',
    clusterRules: [
      {
        clusterId: 'intake_shelter_layer',
        preferredPacketIds: ['hg_np_01_cistern_sleep_ledge', 'hg_np_04_grain_wall_recess', 'hg_np_05_name_veil_niche'],
        preferredSegmentRoles: ['support_stair', 'underdeck_pass'],
        preferredMassAnchorRoles: ['retaining_gate', 'undercroft_run'],
        supportMode: 'floor_snap_recess',
        coverRequirement: 'high',
      },
      {
        clusterId: 'customs_law_friction',
        preferredPacketIds: ['hg_np_07_toll_icon_shelf', 'hg_np_09_bell_blind_memorial', 'hg_np_12_underbridge_ash_wrap'],
        preferredSegmentRoles: ['market_court', 'bridge_landing'],
        preferredMassAnchorRoles: ['retaining_gate', 'aqueduct_remnant'],
        supportMode: 'wall_niche_or_bridge_sidebay',
        coverRequirement: 'medium',
      },
      {
        clusterId: 'escape_preparation',
        preferredPacketIds: ['hg_np_03_splice_bench', 'hg_np_08_hidden_jar_crawlspace', 'hg_np_11_veil_stair_school'],
        preferredSegmentRoles: ['bridge_landing', 'underdeck_pass', 'roof_lane'],
        preferredMassAnchorRoles: ['aqueduct_remnant', 'undercroft_run'],
        supportMode: 'service_edge_or_hidden_cache',
        coverRequirement: 'medium',
      },
      {
        clusterId: 'former_garden_memory',
        preferredPacketIds: ['hg_np_06_bath_step_corner', 'hg_np_10_garden_graft_table', 'hg_np_02_lamp_shelf_shrine'],
        preferredSegmentRoles: ['support_stair', 'market_court', 'roof_lane'],
        preferredMassAnchorRoles: ['bath_court', 'aqueduct_remnant'],
        supportMode: 'former_use_surface',
        coverRequirement: 'low_to_medium',
      },
    ],
  },
  hg_shrine_rim_nooks: {
    pilotId: 'hanging_gardens_absent_people_02',
    clusterRules: [
      {
        clusterId: 'witness_sanctuary',
        preferredPacketIds: ['hg2_np_01_bell_tongue_reliquary', 'hg2_np_07_substitute_offering_wall', 'hg2_np_10_blind_choir_corner'],
        preferredSegmentRoles: ['roof_lane', 'bridge_landing'],
        preferredMassAnchorRoles: ['aqueduct_remnant'],
        supportMode: 'high_wall_niche_or_screen_back',
        coverRequirement: 'medium',
      },
      {
        clusterId: 'law_and_exemption',
        preferredPacketIds: ['hg2_np_03_double_seal_bench', 'hg2_np_09_handprint_count_panel', 'hg2_np_11_linen_name_drawer'],
        preferredSegmentRoles: ['market_court', 'roof_lane'],
        preferredMassAnchorRoles: ['retaining_gate'],
        supportMode: 'bench_panel_drawer_wall',
        coverRequirement: 'medium',
      },
      {
        clusterId: 'sealed_route_hope',
        preferredPacketIds: ['hg2_np_04_unblessed_water_shelf', 'hg2_np_08_cistern_cap_table', 'hg2_np_12_sealed_stair_cache'],
        preferredSegmentRoles: ['support_stair', 'underdeck_pass', 'bridge_landing'],
        preferredMassAnchorRoles: ['aqueduct_remnant', 'undercroft_run'],
        supportMode: 'water_edge_or_service_table',
        coverRequirement: 'medium',
      },
      {
        clusterId: 'failed_bell_memory',
        preferredPacketIds: ['hg2_np_02_witness_step_school', 'hg2_np_05_unrung_memorial_arc', 'hg2_np_06_roof_curtain_cell'],
        preferredSegmentRoles: ['support_stair', 'roof_lane'],
        preferredMassAnchorRoles: ['retaining_gate'],
        supportMode: 'stair_landing_or_watch_berth',
        coverRequirement: 'high',
      },
    ],
  },
};

export const HANGING_GARDENS_DISTRICT_NAMES = {
  intake: ['Arrival Terraces', 'Cistern Gate', 'Garden Customs'],
  scaffolds: ['Hanging Market', 'Ropewalk Court', 'Lantern Bazaar'],
  liftworks: ['Winch Gardens', 'Counterweight Galleries', 'Lift Court'],
  furnace: ['Ash Gardens', 'Kiln Terraces', 'Fire Court'],
  refuse: ['Undercroft Gardens', 'Rooted Gutters', 'Drain Court'],
  shrine: ['Shrine Arches', 'Crown Terrace', 'Garden Rim'],
};

export function applyDefaultArchitecturalFamily(archetype, template) {
  if (DEFAULT_ARCHITECTURAL_FAMILY !== 'hanging_gardens') return template;
  const family = DISTRICT_MACRO_TEMPLATES.scaffolds;
  return {
    ...template,
    realSourceA: template.realSourceA || family.realSourceA,
    realSourceB: template.realSourceB || family.realSourceB,
    skeletonType: template.skeletonType || family.skeletonType,
    patchStyle: template.patchStyle || family.patchStyle,
    silhouetteRule: template.silhouetteRule || family.silhouetteRule,
    familyNameSet: HANGING_GARDENS_DISTRICT_NAMES[archetype.id] || family.names || archetype.names,
  };
}

export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

export function buildHangingMarketDistrictMeta(district) {
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
    if (t < 0.18) {
      const s = t / 0.18;
      x = lerpNumber(-54, -24, s);
      z = lerpNumber(20, 84, s);
      y = lerpNumber(0.8, 3.2, s);
      role = 'support_stair';
    } else if (t < 0.48) {
      const s = (t - 0.18) / 0.30;
      x = lerpNumber(-18, 18, s);
      z = lerpNumber(96, 178, s);
      y = lerpNumber(4.4, 7.6, s);
      role = 'market_court';
    } else if (t < 0.76) {
      const s = (t - 0.48) / 0.28;
      x = lerpNumber(24, 58, s);
      z = lerpNumber(188, 252, s);
      y = lerpNumber(9.0, 12.8, s);
      role = s < 0.52 ? 'roof_lane' : 'bridge_landing';
    } else {
      const s = (t - 0.76) / 0.24;
      x = lerpNumber(70, 26, s);
      z = lerpNumber(264, 336, s);
      y = lerpNumber(13.2, 5.8, s);
      role = s < 0.5 ? 'bridge_landing' : 'underdeck_pass';
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
      { id: 'market_mid', y: base + 7.6, role: 'market_court' },
      { id: 'market_high', y: base + 12.8, role: 'roof_lane' },
    ],
    massAnchors: [
      { id: 'retaining_gate', role: 'retaining_gate', pos: [origin.x - 50, base - 1.8, origin.z + 34], size: [32, 10, 24] },
      { id: 'bath_court', role: 'bath_court', pos: [origin.x + 8, base + 2.8, origin.z + 156], size: [46, 15, 34] },
      { id: 'undercroft_run', role: 'undercroft_run', pos: [origin.x - 8, base - 4.8, origin.z + 224], size: [28, 10, 32] },
      { id: 'aqueduct_remnant', role: 'aqueduct_remnant', pos: [origin.x + 76, base + 9.6, origin.z + 286], size: [24, 10, 42] },
    ],
    landmarkAnchor: { x: origin.x + 78, y: base + 14.2, z: origin.z + 286, role: 'market_bridge_cluster' },
  };
}

export function buildLiftCourtDistrictMeta(district) {
  const base = district.baseElevation;
  const origin = district.origin;
  const roomOffsets = [];
  const segmentRoles = [];
  const total = Math.max(1, district.roomCount);
  for (let i = 0; i < total; i += 1) {
    const t = total <= 1 ? 0 : i / (total - 1);
    let x = 0;
    let z = 0;
    let y = 0;
    let role = 'gate_step';
    if (t < 0.18) {
      const s = t / 0.18;
      x = lerpNumber(-30, -10, s);
      z = lerpNumber(24, 82, s);
      y = lerpNumber(3.0, 6.0, s);
      role = s < 0.55 ? 'gate_step' : 'court_edge';
    } else if (t < 0.48) {
      const s = (t - 0.18) / 0.30;
      x = lerpNumber(-8, 18, s);
      z = lerpNumber(98, 156, s);
      y = lerpNumber(7.0, 9.2, s);
      role = s < 0.45 ? 'kill_court' : 'cargo_stage';
    } else if (t < 0.72) {
      const s = (t - 0.48) / 0.24;
      x = lerpNumber(18, 58, s);
      z = lerpNumber(160, 214, s);
      y = lerpNumber(10.2, 15.4, s);
      role = s < 0.55 ? 'tower_core' : 'winch_gallery';
    } else if (t < 0.86) {
      const s = (t - 0.72) / 0.14;
      x = lerpNumber(58, 92, s);
      z = lerpNumber(216, 266, s);
      y = lerpNumber(15.6, 18.8, s);
      role = s < 0.5 ? 'bridge_landing' : 'strongpoint_gallery';
    } else {
      const s = (t - 0.86) / 0.14;
      x = lerpNumber(8, -12, s);
      z = lerpNumber(190, 248, s);
      y = lerpNumber(2.4, 4.4, s);
      role = s < 0.5 ? 'undercroft_pass' : 'recovery_return';
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
      { id: 'lift_low', y: base + 3.2, role: 'undercroft_pass' },
      { id: 'lift_mid', y: base + 9.0, role: 'kill_court' },
      { id: 'lift_high', y: base + 16.2, role: 'winch_gallery' },
    ],
    massAnchors: [
      { id: 'gate_terrace', role: 'gate_terrace', pos: [origin.x - 22, base + 2.2, origin.z + 54], size: [30, 10, 22] },
      { id: 'execution_court', role: 'execution_court', pos: [origin.x + 8, base + 6.4, origin.z + 142], size: [44, 14, 36] },
      { id: 'counterweight_tower', role: 'counterweight_tower', pos: [origin.x + 42, base + 10.0, origin.z + 196], size: [18, 26, 18] },
      { id: 'undercroft_return', role: 'undercroft_return', pos: [origin.x - 2, base + 0.6, origin.z + 216], size: [30, 10, 28] },
      { id: 'upper_gallery', role: 'upper_gallery', pos: [origin.x + 78, base + 16.0, origin.z + 258], size: [20, 12, 38] },
    ],
    landmarkAnchor: { x: origin.x + 44, y: base + 18.8, z: origin.z + 214, role: 'counterweight_crown' },
  };
}

export function buildDistrictSkeletonMeta(district) {
  if (district.skeletonType === 'hanging_market_hybrid') return buildHangingMarketDistrictMeta(district);
  if (district.skeletonType === 'lift_court_hybrid') return buildLiftCourtDistrictMeta(district);
  return {
    realSourceA: district.realSourceA || null,
    realSourceB: district.realSourceB || null,
    skeletonType: district.skeletonType || null,
    patchStyle: district.patchStyle || null,
    silhouetteRule: district.silhouetteRule || null,
    storyPilotId: district.storyPilotId || null,
    storyPlacementSet: district.storyPlacementSet || null,
    roomOffsets: null,
    segmentRoles: [],
    circulationBands: [],
    massAnchors: [],
    landmarkAnchor: null,
  };
}

export function shuffleWithRng(items, rng) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function sampleRange(rng, range) {
  return range[0] + (range[1] - range[0]) * rng();
}

export function pickDistrictLayout(template, rng, { pick }) {
  const layoutId = pick(rng, template.layoutIds || DISTRICT_LOCAL_LAYOUTS.map((layout) => layout.id));
  return DISTRICT_LOCAL_LAYOUT_MAP[layoutId] || DISTRICT_LOCAL_LAYOUTS[0];
}

export function buildDistrictMacroOrigins(rng, templates, { makeVec }) {
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

export function classifySpineRoute(fromDistrict, toDistrict) {
  const delta = toDistrict.baseElevation - fromDistrict.baseElevation;
  if (delta >= 3.5) return 'climb';
  if (delta <= -3.5) return 'descent';
  return 'traverse';
}


export function createDistrictStoryApi(deps) {
  const { makeVec, rngFromSeed, hashRoomKey, snapEnemyPointToSupport } = deps;

  function storyCoverRequirementValue(value) {
    switch (value) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low_to_medium': return 1.5;
      default: return 1;
    }
  }

  function storyCoverScoreForRole(role) {
    switch (role) {
      case 'retaining_gate':
      case 'undercroft_run':
      case 'underdeck_pass':
      case 'support_stair':
        return 3;
      case 'bath_court':
      case 'market_court':
      case 'bridge_landing':
        return 2;
      case 'roof_lane':
      case 'aqueduct_remnant':
        return 1.5;
      default:
        return 1;
    }
  }

  function storyBasisForRole(role) {
    switch (role) {
      case 'support_stair':
      case 'retaining_gate':
        return { side: makeVec(1, 0, 0), forward: makeVec(0, 0, 1), yaw: 0 };
      case 'market_court':
      case 'bath_court':
        return { side: makeVec(1, 0, 0), forward: makeVec(0, 0, -1), yaw: Math.PI };
      case 'roof_lane':
      case 'aqueduct_remnant':
        return { side: makeVec(0, 0, 1), forward: makeVec(-1, 0, 0), yaw: -Math.PI * 0.5 };
      case 'bridge_landing':
        return { side: makeVec(1, 0, 0), forward: makeVec(0, 0, 1), yaw: 0 };
      case 'underdeck_pass':
      case 'undercroft_run':
        return { side: makeVec(1, 0, 0), forward: makeVec(0, 0, -1), yaw: Math.PI };
      default:
        return { side: makeVec(1, 0, 0), forward: makeVec(0, 0, 1), yaw: 0 };
    }
  }

  function buildDistrictStoryPlacementCandidates(district) {
    const candidates = [];
    for (const anchor of district.massAnchors || []) {
      const basis = storyBasisForRole(anchor.role);
      candidates.push({
        key: 'anchor:' + anchor.id,
        targetId: anchor.id,
        candidateType: 'mass_anchor',
        role: anchor.role,
        worldPos: makeVec(anchor.pos[0], anchor.pos[1], anchor.pos[2]),
        size: anchor.size || [10, 8, 10],
        localRoomIndex: null,
        sideDir: basis.side,
        forwardDir: basis.forward,
        yaw: basis.yaw,
        coverScore: storyCoverScoreForRole(anchor.role),
      });
    }
    for (let localIndex = 0; localIndex < (district.segmentRoles || []).length; localIndex += 1) {
      const role = district.segmentRoles[localIndex];
      const point = district.roomOffsets?.[localIndex];
      if (!role || !point) continue;
      const basis = storyBasisForRole(role);
      candidates.push({
        key: 'segment:' + localIndex,
        targetId: district.id + '-segment-' + localIndex,
        candidateType: 'segment_role',
        role,
        worldPos: makeVec(district.origin.x + point[0], district.origin.y + (point[2] || 0), district.origin.z + point[1]),
        size: [4.4, 2.4, 4.4],
        localRoomIndex: localIndex,
        sideDir: basis.side,
        forwardDir: basis.forward,
        yaw: basis.yaw,
        coverScore: storyCoverScoreForRole(role),
      });
    }
    return candidates;
  }

  function scoreDistrictStoryCandidate(candidate, cluster, usedTargetKeys) {
    let score = 0;
    if (candidate.candidateType === 'mass_anchor' && (cluster.preferredMassAnchorRoles || []).includes(candidate.role)) score += 52;
    if (candidate.candidateType === 'segment_role' && (cluster.preferredSegmentRoles || []).includes(candidate.role)) score += 46;
    if (usedTargetKeys.has(candidate.key)) score -= 14;
    score += (candidate.coverScore - storyCoverRequirementValue(cluster.coverRequirement)) * 9;
    if (candidate.candidateType === 'mass_anchor') score += 3;
    return score;
  }

  function chooseDistrictStoryClusterTarget(cluster, candidates, usedTargetKeys, rng) {
    const ranked = candidates
      .map((candidate) => ({ candidate, score: scoreDistrictStoryCandidate(candidate, cluster, usedTargetKeys) + rng() * 0.8 }))
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.candidate || null;
  }

  function resolveDistrictStoryPlacementPose(target, cluster, packetIndex, packetCount, rng) {
    const spread = packetIndex - (packetCount - 1) * 0.5;
    const lateral = spread * 1.18;
    let forwardOffset = 0.42;
    if (/wall|screen|panel|niche|drawer/.test(cluster.supportMode || '')) forwardOffset = -0.42;
    if (/service|table|surface/.test(cluster.supportMode || '')) forwardOffset = 0.18;
    if (/cache|recess/.test(cluster.supportMode || '')) forwardOffset = -0.18;
    const jitter = (rng() - 0.5) * 0.22;
    const x = target.worldPos.x + target.sideDir.x * lateral + target.forwardDir.x * (forwardOffset + jitter);
    const z = target.worldPos.z + target.sideDir.z * lateral + target.forwardDir.z * (forwardOffset + jitter);
    const snapped = snapEnemyPointToSupport(makeVec(x, target.worldPos.y + 1.4, z)) || makeVec(x, target.worldPos.y, z);
    return {
      position: snapped,
      yaw: target.yaw,
    };
  }

  function buildDistrictStoryPlacements(district) {
    if (!district?.storyPlacementSet) return [];
    const runtimeSet = DISTRICT_STORY_PLACEMENT_RUNTIME_SETS[district.storyPlacementSet];
    if (!runtimeSet) return [];
    const candidates = buildDistrictStoryPlacementCandidates(district);
    if (!candidates.length) return [];
    const usedTargetKeys = new Set();
    const rng = rngFromSeed(hashRoomKey(district.id + ':' + district.storyPlacementSet + ':' + district.baseElevation.toFixed(2)));
    const placements = [];
    for (const cluster of runtimeSet.clusterRules) {
      const target = chooseDistrictStoryClusterTarget(cluster, candidates, usedTargetKeys, rng);
      if (!target) continue;
      usedTargetKeys.add(target.key);
      const packetIds = cluster.preferredPacketIds || [];
      for (let packetIndex = 0; packetIndex < packetIds.length; packetIndex += 1) {
        const packetId = packetIds[packetIndex];
        const pose = resolveDistrictStoryPlacementPose(target, cluster, packetIndex, packetIds.length, rng);
        placements.push({
          id: district.id + ':' + packetId,
          packetId,
          nookFamily: DISTRICT_STORY_PACKET_FAMILY[packetId] || 'shrine',
          clusterId: cluster.clusterId,
          storyPilotId: district.storyPilotId || runtimeSet.pilotId,
          storyPlacementSet: district.storyPlacementSet,
          supportMode: cluster.supportMode,
          coverRequirement: cluster.coverRequirement,
          candidateType: target.candidateType,
          targetId: target.targetId,
          targetRole: target.role,
          localRoomIndex: target.localRoomIndex,
          worldPos: [Number(pose.position.x.toFixed(2)), Number(pose.position.y.toFixed(2)), Number(pose.position.z.toFixed(2))],
          yaw: Number(pose.yaw.toFixed(3)),
        });
      }
    }
    return placements;
  }

  function makeDistrictAcceptanceCheck(id, text, passed) {
    return { id, text, passed: !!passed };
  }

  function buildDistrictValidationSummary(district, landmarkSchemas) {
    if (!landmarkSchemas?.length) {
      return {
        implemented: false,
        passes: null,
        requiredOutputs: {},
        categories: {},
        failedChecks: [],
        screenshotFailChecks: [],
        tacticalCoverage: [],
        wonderCoverage: [],
        habitationProofCount: 0,
      };
    }
    const tacticalCoverage = [...new Set(landmarkSchemas.flatMap((landmark) => landmark.tacticalFeatures || []))];
    const wonderCoverage = [...new Set(landmarkSchemas.flatMap((landmark) => landmark.wonderTags || []))];
    const habitationProofCount = landmarkSchemas.reduce((sum, landmark) => sum + (landmark.habitationProof?.length || 0), 0);
    const hasHistoricalStories = landmarkSchemas.every((landmark) => landmark.formerUse && landmark.damageCause && landmark.currentOccupant && landmark.silhouetteFamily);
    const hasWonderLandmark = landmarkSchemas.some((landmark) => (landmark.wonderTags?.length || 0) >= 3);
    const hasCombatSentences = landmarkSchemas.every((landmark) => landmark.combatSentence);
    const hasClimbRoutes = landmarkSchemas.some((landmark) => (landmark.climbRoutes?.length || 0) > 0);
    const hasMeaningfulClimbRecovery = landmarkSchemas.some((landmark) => (landmark.climbRoutes || []).some((route) => /recovery/i.test(route.value || route.kind || '')));
    const hasVisibilityTargets = landmarkSchemas.some((landmark) => (landmark.visibilityTargets?.length || 0) > 0);
    const hasHabitationProof = habitationProofCount > 0;
    const requiredOutputs = {
      dominantFormerUseSkeleton: !!district.skeletonType && !!district.realSourceA,
      hangingGardensLandmark: hasWonderLandmark,
      chokepoint: tacticalCoverage.includes('chokepoint'),
      strongpoint: tacticalCoverage.includes('strongpoint'),
      killZone: tacticalCoverage.includes('kill_zone'),
      escapeRoute: tacticalCoverage.includes('escape_route'),
      climbRecoveryPath: hasMeaningfulClimbRecovery,
      visibleFutureDestination: hasVisibilityTargets,
      overUnderRead: (district.circulationBands?.length || 0) >= 3,
      habitationProof: hasHabitationProof,
    };
    const categories = {
      historicalRead: requiredOutputs.dominantFormerUseSkeleton && hasHistoricalStories && !!district.patchStyle && !!district.silhouetteRule,
      hangingGardensWonderRead: requiredOutputs.hangingGardensLandmark && !!district.landmarkAnchor && wonderCoverage.some((tag) => tag === 'sky_exposure' || tag === 'bridges' || tag === 'terraces'),
      tacticalRead: hasCombatSentences && requiredOutputs.chokepoint && requiredOutputs.strongpoint && requiredOutputs.killZone && requiredOutputs.escapeRoute,
      climbValue: hasClimbRoutes && requiredOutputs.climbRecoveryPath && requiredOutputs.overUnderRead,
      visibilityAndPull: requiredOutputs.visibleFutureDestination && requiredOutputs.hangingGardensLandmark,
    };
    const screenshotFailChecks = [
      makeDistrictAcceptanceCheck('historical_read', 'district reads as a former structure with visible damage and occupancy', categories.historicalRead),
      makeDistrictAcceptanceCheck('wonder_read', 'district creates at least one Hanging Gardens destination read', categories.hangingGardensWonderRead),
      makeDistrictAcceptanceCheck('tactical_read', 'district exposes chokepoint, strongpoint, kill zone, and escape route decisions', categories.tacticalRead),
      makeDistrictAcceptanceCheck('climb_value', 'climbing creates a meaningful recovery or alternate route', categories.climbValue),
      makeDistrictAcceptanceCheck('visibility_pull', 'player can see a future destination or shortcut that pulls them forward', categories.visibilityAndPull),
    ];
    const failedChecks = [
      ...Object.entries(requiredOutputs).filter(([, passed]) => !passed).map(([key]) => key),
      ...screenshotFailChecks.filter((check) => !check.passed).map((check) => check.id),
    ];
    return {
      implemented: true,
      passes: failedChecks.length === 0,
      requiredOutputs,
      categories,
      failedChecks,
      screenshotFailChecks,
      tacticalCoverage,
      wonderCoverage,
      habitationProofCount,
    };
  }

  function buildHangingMarketLandmarkSchemas(district) {
    const lowBand = district.circulationBands?.[0]?.y ?? district.baseElevation + 3.2;
    const midBand = district.circulationBands?.[1]?.y ?? district.baseElevation + 7.4;
    const highBand = district.circulationBands?.[2]?.y ?? district.baseElevation + 12.4;
    const bridgeAnchor = district.landmarkAnchor || { x: district.origin.x + 86, y: highBand + 1.2, z: district.origin.z + 286, role: 'market_bridge_cluster' };
    return [
      {
        id: district.id + '-market-bridge-cluster',
        districtId: district.id,
        formerUse: 'trade terrace marketplace bridge cluster',
        damageCause: 'partial collapse and hanging salvage repair',
        currentOccupant: 'toll keepers, scavenger stalls, corpsefire watchers',
        silhouetteFamily: 'hanging market bridge cluster',
        wonderTags: ['bridges', 'terraces', 'lanterns', 'sky_exposure', 'hanging_structures'],
        tacticalFeatures: ['chokepoint', 'strongpoint', 'escape_route'],
        combatSentence: 'push across the bridge or drop to the underdeck return',
        climbRoutes: [
          { id: 'brace-recovery', kind: 'brace_climb', value: 'recovery_route', fromBand: 'market_low', toBand: 'market_high' },
          { id: 'awning-flank', kind: 'awning_scramble', value: 'ambush_route', fromBand: 'market_mid', toBand: 'market_high' },
        ],
        visibilityTargets: [
          { id: 'shrine-rim', kind: 'future_landmark', prompt: 'how do i get there' },
          { id: 'underdeck-return', kind: 'future_shortcut', prompt: 'can i drop and recover there' },
        ],
        lowerLayer: 'underdeck pressure and recovery return',
        middleLayer: 'market pressure lane',
        upperLayer: 'roof lane and bridge control',
        supportLanguage: 'scaffold forest, chain hangs, diagonal braces',
        habitationProof: ['bridge toll fires', 'market stalls', 'watch posts', 'lanterns'],
        landmarkAnchors: [bridgeAnchor],
        acceptanceChecks: [
          { id: 'visible-bridge-cluster', text: 'bridge cluster reads before arrival' },
          { id: 'over-under-market', text: 'upper bridge reads above an underdeck return' },
        ],
      },
      {
        id: district.id + '-market-core-court',
        districtId: district.id,
        formerUse: 'retaining-wall market court',
        damageCause: 'wall breach, awning collapse, and scaffold replacement',
        currentOccupant: 'stall keepers, corpsefire guards, roaming scavengers',
        silhouetteFamily: 'stacked market court',
        wonderTags: ['terraces', 'lanterns', 'architecture', 'gardens'],
        tacticalFeatures: ['kill_zone', 'strongpoint'],
        combatSentence: 'circle through the court or climb out to the roof lane',
        climbRoutes: [
          { id: 'court-awning', kind: 'awning_climb', value: 'alternate_route', fromBand: 'market_mid', toBand: 'market_high' },
        ],
        visibilityTargets: [
          { id: 'bridge-cluster', kind: 'future_landmark', prompt: 'the high bridge market tier ahead' },
        ],
        lowerLayer: 'stall shadows and pressure pockets',
        middleLayer: 'main crowd court and combat lane',
        upperLayer: 'roof eaves and hanging crosswalks',
        supportLanguage: 'retaining walls with scaffold infill',
        habitationProof: ['stalls', 'garden trays', 'lanterns', 'work benches'],
        landmarkAnchors: [{ x: district.origin.x + 24, y: midBand + 0.6, z: district.origin.z + 168, role: 'market_court' }],
        acceptanceChecks: [
          { id: 'court-kill-zone', text: 'court reads as a surround-risk arena' },
        ],
      },
      {
        id: district.id + '-underdeck-return',
        districtId: district.id,
        formerUse: 'service undercroft and maintenance pass',
        damageCause: 'load sag, missing planks, and emergency bracing',
        currentOccupant: 'maintenance scavengers and hidden survivors',
        silhouetteFamily: 'underdeck service run',
        wonderTags: ['hanging_structures', 'sky_exposure', 'bridges'],
        tacticalFeatures: ['escape_route', 'chokepoint'],
        combatSentence: 'drop to recover or hold the narrow return against pursuit',
        climbRoutes: [
          { id: 'service-ladder', kind: 'service_climb', value: 'recovery_route', fromBand: 'market_low', toBand: 'market_mid' },
        ],
        visibilityTargets: [
          { id: 'market-core-return', kind: 'future_shortcut', prompt: 'this can save a missed jump' },
        ],
        lowerLayer: 'recovery and ambush pressure lane',
        middleLayer: 'rejoin point back into the market route',
        upperLayer: 'visible roof traffic overhead',
        supportLanguage: 'timber braces and hanging chain repairs',
        habitationProof: ['maintenance lamps', 'wells', 'hidden shrines'],
        landmarkAnchors: [{ x: district.origin.x + 12, y: lowBand + 0.5, z: district.origin.z + 220, role: 'underdeck_return' }],
        acceptanceChecks: [
          { id: 'underdeck-recovery', text: 'underdeck path visibly reads as a survivable recovery route' },
        ],
      },
    ];
  }


  function buildLiftCourtLandmarkSchemas(district) {
    const lowBand = district.circulationBands?.[0]?.y ?? district.baseElevation + 3.2;
    const midBand = district.circulationBands?.[1]?.y ?? district.baseElevation + 9.0;
    const highBand = district.circulationBands?.[2]?.y ?? district.baseElevation + 16.2;
    const crownAnchor = district.landmarkAnchor || { x: district.origin.x + 44, y: highBand + 2.4, z: district.origin.z + 214, role: 'counterweight_crown' };
    return [
      {
        id: district.id + '-counterweight-crown',
        districtId: district.id,
        formerUse: 'fortified hoist tower and lift crown',
        damageCause: 'partial collapse, seized rigging, and emergency chain retrofits',
        currentOccupant: 'watch crews, execution wardens, and salvage haulers',
        silhouetteFamily: 'counterweight tower crown',
        wonderTags: ['height', 'bridges', 'lanterns', 'sky_exposure', 'hanging_structures'],
        tacticalFeatures: ['strongpoint', 'chokepoint'],
        combatSentence: 'take the upper gallery or get pinned below the hoist crown',
        climbRoutes: [
          { id: 'tower-maintenance-climb', kind: 'tower_climb', value: 'alternate_route', fromBand: 'lift_mid', toBand: 'lift_high' },
        ],
        visibilityTargets: [
          { id: 'crown-gallery', kind: 'future_landmark', prompt: 'how do i reach the hoist crown' },
        ],
        lowerLayer: 'counterweight shaft and chain pit',
        middleLayer: 'tower approach and winch floor',
        upperLayer: 'crown gallery and bridge control',
        supportLanguage: 'old stone piers with timber winch retrofits',
        habitationProof: ['signal lanterns', 'warden perch', 'rope stores'],
        landmarkAnchors: [crownAnchor],
        acceptanceChecks: [
          { id: 'crown-reads-early', text: 'counterweight crown reads before arrival' },
        ],
      },
      {
        id: district.id + '-execution-court',
        districtId: district.id,
        formerUse: 'cargo staging and tribunal court',
        damageCause: 'public violence, dropped loads, and broken retaining edges',
        currentOccupant: 'haulers, guards, and scavengers moving salvage through the court',
        silhouetteFamily: 'execution and cargo court',
        wonderTags: ['architecture', 'terraces', 'lanterns'],
        tacticalFeatures: ['kill_zone', 'chokepoint'],
        combatSentence: 'hold the court or break toward the flanking lanes and stairs',
        climbRoutes: [
          { id: 'court-scramble', kind: 'gantry_scramble', value: 'ambush_route', fromBand: 'lift_mid', toBand: 'lift_high' },
        ],
        visibilityTargets: [
          { id: 'upper-gallery', kind: 'future_shortcut', prompt: 'there is a higher route over the court' },
        ],
        lowerLayer: 'load shadow and choke pressure',
        middleLayer: 'main kill court',
        upperLayer: 'gallery gunslit equivalent and pressure rail',
        supportLanguage: 'retaining walls, hoist beams, and partial screen walls',
        habitationProof: ['tool benches', 'water buckets', 'cargo pallets'],
        landmarkAnchors: [{ x: district.origin.x + 8, y: midBand + 0.4, z: district.origin.z + 144, role: 'execution_court' }],
        acceptanceChecks: [
          { id: 'court-is-kill-zone', text: 'court reads as a surround-risk kill zone' },
        ],
      },
      {
        id: district.id + '-undercroft-return',
        districtId: district.id,
        formerUse: 'maintenance undercroft and brake access corridor',
        damageCause: 'chain drag, water seepage, and blocked shaft collapse',
        currentOccupant: 'maintenance survivors and hidden runners',
        silhouetteFamily: 'machinery undercroft',
        wonderTags: ['hanging_structures', 'bridges', 'architecture'],
        tacticalFeatures: ['escape_route'],
        combatSentence: 'drop to recover and re-enter or stay above and risk the choke',
        climbRoutes: [
          { id: 'service-ladder', kind: 'service_climb', value: 'recovery_route', fromBand: 'lift_low', toBand: 'lift_mid' },
        ],
        visibilityTargets: [
          { id: 'court-return', kind: 'future_shortcut', prompt: 'this can save a bad fight or missed movement line' },
        ],
        lowerLayer: 'recovery and maintenance lane',
        middleLayer: 'rejoin point into the hoist court',
        upperLayer: 'visible hoist tower overhead',
        supportLanguage: 'stone undercroft with chained service braces',
        habitationProof: ['bucket stations', 'repair alcoves', 'hidden shrines'],
        landmarkAnchors: [{ x: district.origin.x - 4, y: lowBand + 0.2, z: district.origin.z + 220, role: 'maintenance_return' }],
        acceptanceChecks: [
          { id: 'undercroft-is-recovery', text: 'undercroft reads as a survivable recovery route' },
        ],
      },
    ];
  }

  function cloneDistrictLandmarkSchemas(landmarkSchemas) {
    return landmarkSchemas.map((landmark) => ({
      ...landmark,
      wonderTags: [...(landmark.wonderTags || [])],
      tacticalFeatures: [...(landmark.tacticalFeatures || [])],
      climbRoutes: (landmark.climbRoutes || []).map((route) => ({ ...route })),
      visibilityTargets: (landmark.visibilityTargets || []).map((target) => ({ ...target })),
      habitationProof: [...(landmark.habitationProof || [])],
      landmarkAnchors: (landmark.landmarkAnchors || []).map((anchor) => ({ ...anchor })),
      acceptanceChecks: (landmark.acceptanceChecks || []).map((check) => ({ ...check })),
    }));
  }

  function addUniqueValues(target, values) {
    for (const value of values) {
      if (!target.includes(value)) target.push(value);
    }
  }

  function applyHangingMarketDesignRepairs(district, initialLandmarkSchemas, initialValidation) {
    const landmarkSchemas = cloneDistrictLandmarkSchemas(initialLandmarkSchemas);
    const repairsApplied = [];
    let budget = 6;
    const noteRepair = (id, detail) => {
      if (budget <= 0) return false;
      repairsApplied.push({ id, detail });
      budget -= 1;
      return true;
    };
    const bridge = landmarkSchemas.find((landmark) => /bridge-cluster$/.test(landmark.id)) || landmarkSchemas[0];
    const court = landmarkSchemas.find((landmark) => /core-court$/.test(landmark.id)) || landmarkSchemas[1] || bridge;
    const underdeck = landmarkSchemas.find((landmark) => /underdeck-return$/.test(landmark.id)) || landmarkSchemas[2] || bridge;

    if ((!district.realSourceA || !district.skeletonType || !district.patchStyle || !district.silhouetteRule) && noteRepair('historical_defaults', 'restored missing Hanging Market historical skeleton fields')) {
      district.realSourceA = district.realSourceA || 'medina_kasbah';
      district.realSourceB = district.realSourceB || 'stilt_wharf_settlement';
      district.skeletonType = district.skeletonType || 'hanging_market_hybrid';
      district.patchStyle = district.patchStyle || 'scaffold_chain_infill';
      district.silhouetteRule = district.silhouetteRule || 'lateral stacked market over a visible support forest';
    }

    if ((district.circulationBands?.length || 0) < 3 && noteRepair('circulation_band_fallback', 'forced three circulation bands for over-under readability')) {
      district.circulationBands = [
        { id: 'market_low', y: district.baseElevation + 3.2, role: 'support_stair' },
        { id: 'market_mid', y: district.baseElevation + 7.4, role: 'market_court' },
        { id: 'market_high', y: district.baseElevation + 12.4, role: 'roof_lane' },
      ];
    }

    let validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.hangingGardensLandmark || !validation.categories.hangingGardensWonderRead) && noteRepair('wonder_boost', 'reinforced Hanging Gardens wonder tags and anchor visibility')) {
      addUniqueValues(bridge.wonderTags, ['bridges', 'terraces', 'sky_exposure', 'lanterns', 'hanging_structures']);
      addUniqueValues(court.wonderTags, ['gardens', 'architecture', 'terraces']);
      district.landmarkAnchor = district.landmarkAnchor || { x: district.origin.x + 86, y: district.baseElevation + 13.6, z: district.origin.z + 286, role: 'market_bridge_cluster' };
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.chokepoint || !validation.requiredOutputs.strongpoint || !validation.requiredOutputs.killZone || !validation.requiredOutputs.escapeRoute || !validation.categories.tacticalRead) && noteRepair('tactical_sentence_boost', 'completed tactical feature coverage across bridge, court, and underdeck')) {
      addUniqueValues(bridge.tacticalFeatures, ['chokepoint', 'strongpoint', 'escape_route']);
      addUniqueValues(court.tacticalFeatures, ['kill_zone', 'strongpoint']);
      addUniqueValues(underdeck.tacticalFeatures, ['escape_route', 'chokepoint']);
      bridge.combatSentence = bridge.combatSentence || 'push across the bridge or drop to the underdeck return';
      court.combatSentence = court.combatSentence || 'circle through the court or climb out to the roof lane';
      underdeck.combatSentence = underdeck.combatSentence || 'drop to recover or hold the narrow return against pursuit';
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.climbRecoveryPath || !validation.categories.climbValue) && noteRepair('climb_recovery_boost', 'added explicit recovery climb routes between underdeck, court, and roof')) {
      underdeck.climbRoutes = underdeck.climbRoutes || [];
      court.climbRoutes = court.climbRoutes || [];
      underdeck.climbRoutes.push({ id: 'repair-service-ladder', kind: 'service_climb', value: 'recovery_route', fromBand: 'market_low', toBand: 'market_mid' });
      court.climbRoutes.push({ id: 'repair-court-scramble', kind: 'awning_climb', value: 'alternate_route', fromBand: 'market_mid', toBand: 'market_high' });
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.visibleFutureDestination || !validation.categories.visibilityAndPull) && noteRepair('visibility_pull_boost', 'added future landmark and shortcut targets to pull the player forward')) {
      bridge.visibilityTargets = bridge.visibilityTargets || [];
      underdeck.visibilityTargets = underdeck.visibilityTargets || [];
      bridge.visibilityTargets.push({ id: 'repair-shrine-rim', kind: 'future_landmark', prompt: 'how do i get there' });
      underdeck.visibilityTargets.push({ id: 'repair-market-return', kind: 'future_shortcut', prompt: 'this can save a missed jump' });
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.habitationProof || !validation.categories.historicalRead) && noteRepair('habitation_proof_boost', 'added survivor habitation evidence across market, bridge, and underdeck')) {
      addUniqueValues(bridge.habitationProof, ['bridge toll fires', 'lanterns', 'watch posts']);
      addUniqueValues(court.habitationProof, ['stalls', 'garden trays', 'work benches']);
      addUniqueValues(underdeck.habitationProof, ['maintenance lamps', 'wells', 'hidden shrines']);
      bridge.currentOccupant = bridge.currentOccupant || 'toll keepers and scavenger stalls';
      court.currentOccupant = court.currentOccupant || 'stall keepers and roaming scavengers';
      underdeck.currentOccupant = underdeck.currentOccupant || 'maintenance scavengers and hidden survivors';
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);
    return { landmarkSchemas, validation, repairsApplied };
  }


  function applyLiftCourtDesignRepairs(district, initialLandmarkSchemas, initialValidation) {
    const landmarkSchemas = cloneDistrictLandmarkSchemas(initialLandmarkSchemas);
    const repairsApplied = [];
    let budget = 6;
    const noteRepair = (id, detail) => {
      if (budget <= 0) return false;
      repairsApplied.push({ id, detail });
      budget -= 1;
      return true;
    };
    const crown = landmarkSchemas.find((landmark) => /counterweight-crown$/.test(landmark.id)) || landmarkSchemas[0];
    const court = landmarkSchemas.find((landmark) => /execution-court$/.test(landmark.id)) || landmarkSchemas[1] || crown;
    const undercroft = landmarkSchemas.find((landmark) => /undercroft-return$/.test(landmark.id)) || landmarkSchemas[2] || crown;

    if ((!district.realSourceA || !district.skeletonType || !district.patchStyle || !district.silhouetteRule) && noteRepair('historical_defaults', 'restored missing Lift Court historical skeleton fields')) {
      district.realSourceA = district.realSourceA || 'fortified_hoist_yard';
      district.realSourceB = district.realSourceB || 'cliff_granary_terraces';
      district.skeletonType = district.skeletonType || 'lift_court_hybrid';
      district.patchStyle = district.patchStyle || 'counterweight_chain_retrofit';
      district.silhouetteRule = district.silhouetteRule || 'a hoist court stacked around a visible counterweight tower and upper winch gallery';
    }

    if ((district.circulationBands?.length || 0) < 3 && noteRepair('circulation_band_fallback', 'forced three circulation bands for Lift Court readability')) {
      district.circulationBands = [
        { id: 'lift_low', y: district.baseElevation + 3.2, role: 'undercroft_pass' },
        { id: 'lift_mid', y: district.baseElevation + 9.0, role: 'kill_court' },
        { id: 'lift_high', y: district.baseElevation + 16.2, role: 'winch_gallery' },
      ];
    }

    let validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.hangingGardensLandmark || !validation.categories.hangingGardensWonderRead) && noteRepair('wonder_boost', 'reinforced the hoist crown and upper gallery as the district wonder destination')) {
      addUniqueValues(crown.wonderTags, ['height', 'bridges', 'lanterns', 'sky_exposure', 'hanging_structures']);
      district.landmarkAnchor = district.landmarkAnchor || { x: district.origin.x + 44, y: district.baseElevation + 18.8, z: district.origin.z + 214, role: 'counterweight_crown' };
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.chokepoint || !validation.requiredOutputs.strongpoint || !validation.requiredOutputs.killZone || !validation.requiredOutputs.escapeRoute || !validation.categories.tacticalRead) && noteRepair('tactical_sentence_boost', 'completed tactical coverage across crown, court, and undercroft')) {
      addUniqueValues(crown.tacticalFeatures, ['strongpoint', 'chokepoint']);
      addUniqueValues(court.tacticalFeatures, ['kill_zone', 'chokepoint']);
      addUniqueValues(undercroft.tacticalFeatures, ['escape_route']);
      crown.combatSentence = crown.combatSentence || 'take the upper gallery or get pinned below the hoist crown';
      court.combatSentence = court.combatSentence || 'hold the court or break toward the flanking lanes and stairs';
      undercroft.combatSentence = undercroft.combatSentence || 'drop to recover and re-enter or stay above and risk the choke';
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.climbRecoveryPath || !validation.categories.climbValue) && noteRepair('climb_recovery_boost', 'added recovery climbs and alternate tower scrambles')) {
      undercroft.climbRoutes = undercroft.climbRoutes || [];
      crown.climbRoutes = crown.climbRoutes || [];
      undercroft.climbRoutes.push({ id: 'repair-service-ladder', kind: 'service_climb', value: 'recovery_route', fromBand: 'lift_low', toBand: 'lift_mid' });
      crown.climbRoutes.push({ id: 'repair-tower-scramble', kind: 'tower_climb', value: 'alternate_route', fromBand: 'lift_mid', toBand: 'lift_high' });
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.visibleFutureDestination || !validation.categories.visibilityAndPull) && noteRepair('visibility_pull_boost', 'added crown and return-path visibility targets')) {
      crown.visibilityTargets = crown.visibilityTargets || [];
      undercroft.visibilityTargets = undercroft.visibilityTargets || [];
      crown.visibilityTargets.push({ id: 'repair-crown-gallery', kind: 'future_landmark', prompt: 'how do i reach the hoist crown' });
      undercroft.visibilityTargets.push({ id: 'repair-court-return', kind: 'future_shortcut', prompt: 'this can save a bad fight' });
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);

    if ((!validation.requiredOutputs.habitationProof || !validation.categories.historicalRead) && noteRepair('habitation_proof_boost', 'added worker and survivor evidence across the lift court')) {
      addUniqueValues(crown.habitationProof, ['signal lanterns', 'warden perch', 'rope stores']);
      addUniqueValues(court.habitationProof, ['tool benches', 'water buckets', 'cargo pallets']);
      addUniqueValues(undercroft.habitationProof, ['bucket stations', 'repair alcoves', 'hidden shrines']);
    }

    validation = buildDistrictValidationSummary(district, landmarkSchemas);
    return { landmarkSchemas, validation, repairsApplied };
  }

  function buildDistrictDesignContract(district) {
    if (district.skeletonType === 'hanging_market_hybrid') {
      let landmarkSchemas = buildHangingMarketLandmarkSchemas(district);
      let validation = buildDistrictValidationSummary(district, landmarkSchemas);
      let repairsApplied = [];
      if (!validation.passes) {
        ({ landmarkSchemas, validation, repairsApplied } = applyHangingMarketDesignRepairs(district, landmarkSchemas, validation));
      }
      return { landmarkSchemas, validation, repairsApplied };
    }
    if (district.skeletonType === 'lift_court_hybrid') {
      let landmarkSchemas = buildLiftCourtLandmarkSchemas(district);
      let validation = buildDistrictValidationSummary(district, landmarkSchemas);
      let repairsApplied = [];
      if (!validation.passes) {
        ({ landmarkSchemas, validation, repairsApplied } = applyLiftCourtDesignRepairs(district, landmarkSchemas, validation));
      }
      return { landmarkSchemas, validation, repairsApplied };
    }
    return {
      landmarkSchemas: [],
      validation: buildDistrictValidationSummary(district, []),
      repairsApplied: [],
    };
  }

  return {
    buildDistrictStoryPlacementCandidates,
    buildDistrictStoryPlacements,
    buildDistrictValidationSummary,
    buildDistrictDesignContract,
  };
}
