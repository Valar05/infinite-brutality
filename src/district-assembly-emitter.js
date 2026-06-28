export const DISTRICT_ASSEMBLY_REQUIRED_FIELDS = [
  'id',
  'districtId',
  'assemblyId',
  'role',
  'material',
  'size',
  'center',
  'hostId',
  'supports',
  'serviceAccess',
  'silhouette',
];

const FOUNDRY_REQUIRED_ROLES = [
  'host',
  'plinth',
  'heat_core',
  'service_landing',
  'catwalk_endpoint',
  'catwalk_span',
  'support',
  'vent_source',
  'vent_stack',
  'cooling_source',
  'cooling_channel',
  'cooling_destination',
  'service_route',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function part({
  id,
  assemblyId,
  role,
  material,
  size,
  center,
  hostId,
  supports = [],
  supportedBy = [],
  serviceAccess,
  silhouette,
  kind = 'structure',
  hazard = false,
  visible = true,
}) {
  return {
    id,
    districtId: 'imperial_foundry',
    assemblyId,
    role,
    material,
    size,
    center,
    hostId,
    supports,
    supportedBy,
    serviceAccess,
    silhouette,
    kind: hazard ? 'hazard' : kind,
    hazard,
    visible,
  };
}

export function buildImperialFoundryAssemblyPlan(_intent = null) {
  const parts = [
    part({
      id: 'foundry-host-floor-read',
      assemblyId: 'foundry-process-chain',
      role: 'host',
      material: 'connectorWall',
      size: [7.2, 0.18, 5.2],
      center: [5.8, 0.12, -11.5],
      hostId: 'carved_voxel_floor',
      supports: ['foundry-furnace-plinth', 'foundry-service-landing-left', 'foundry-service-landing-right'],
      serviceAccess: 'main carved chamber floor wraps the process machine',
      silhouette: 'flat carved floor plate under the furnace process chain',
    }),
    part({
      id: 'foundry-furnace-plinth',
      assemblyId: 'furnace-service-frame',
      role: 'plinth',
      material: 'iron',
      size: [5.4, 1.0, 3.8],
      center: [5.8, 0.72, -11.5],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-hot-core', 'foundry-vent-collar', 'foundry-catwalk-post-a', 'foundry-catwalk-post-b'],
      serviceAccess: 'service landings touch both sides of the furnace plinth',
      silhouette: 'heavy rectangular machine base embedded in the rock floor',
    }),
    part({
      id: 'foundry-hot-core',
      assemblyId: 'furnace-service-frame',
      role: 'heat_core',
      material: 'hazard',
      size: [2.25, 0.56, 2.25],
      center: [5.8, 1.5, -11.5],
      hostId: 'foundry-furnace-plinth',
      supports: ['foundry-vent-collar', 'foundry-cooling-source'],
      serviceAccess: 'catwalk and service landings orbit the heat core without crossing it at floor level',
      silhouette: 'hot central core sitting visibly on the plinth',
      hazard: true,
    }),
    part({
      id: 'foundry-service-landing-left',
      assemblyId: 'furnace-service-frame',
      role: 'service_landing',
      material: 'bridge',
      size: [1.0, 0.32, 4.2],
      center: [2.5, 1.42, -11.5],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-catwalk-end-left'],
      serviceAccess: 'left landing is the accessible catwalk endpoint from the carved route',
      silhouette: 'maintenance shelf pressed against the furnace side',
    }),
    part({
      id: 'foundry-service-landing-right',
      assemblyId: 'furnace-service-frame',
      role: 'service_landing',
      material: 'bridge',
      size: [1.0, 0.32, 4.2],
      center: [9.1, 1.42, -11.5],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-catwalk-end-right'],
      serviceAccess: 'right landing terminates the catwalk at a reachable service side',
      silhouette: 'paired maintenance shelf framing the furnace',
    }),
    part({
      id: 'foundry-catwalk-end-left',
      assemblyId: 'catwalk-over-hazard',
      role: 'catwalk_endpoint',
      material: 'bridge',
      size: [1.4, 0.4, 1.55],
      center: [2.5, 2.72, -9.1],
      hostId: 'foundry-service-landing-left',
      supports: ['foundry-catwalk-span'],
      serviceAccess: 'endpoint landing makes the catwalk enterable',
      silhouette: 'fat landing cap before the narrow crossing',
    }),
    part({
      id: 'foundry-catwalk-end-right',
      assemblyId: 'catwalk-over-hazard',
      role: 'catwalk_endpoint',
      material: 'bridge',
      size: [1.4, 0.4, 1.55],
      center: [9.1, 2.72, -9.1],
      hostId: 'foundry-service-landing-right',
      supports: ['foundry-catwalk-span'],
      serviceAccess: 'opposite endpoint lands on the right service side',
      silhouette: 'fat landing cap after the narrow crossing',
    }),
    part({
      id: 'foundry-catwalk-span',
      assemblyId: 'catwalk-over-hazard',
      role: 'catwalk_span',
      material: 'bridge',
      size: [6.6, 0.34, 1.0],
      center: [5.8, 2.86, -9.1],
      hostId: 'foundry-catwalk-end-left',
      supports: [],
      supportedBy: ['foundry-catwalk-end-left', 'foundry-catwalk-end-right', 'foundry-catwalk-post-a', 'foundry-catwalk-post-b'],
      serviceAccess: 'narrow maintenance crossing over the furnace mouth',
      silhouette: 'thin service line across the hot machine',
    }),
    part({
      id: 'foundry-catwalk-post-a',
      assemblyId: 'catwalk-over-hazard',
      role: 'support',
      material: 'iron',
      size: [0.34, 1.9, 0.34],
      center: [4.15, 1.9, -9.1],
      hostId: 'foundry-furnace-plinth',
      supports: ['foundry-catwalk-span'],
      serviceAccess: 'post carries catwalk load into the furnace plinth',
      silhouette: 'visible vertical load path under the catwalk',
    }),
    part({
      id: 'foundry-catwalk-post-b',
      assemblyId: 'catwalk-over-hazard',
      role: 'support',
      material: 'iron',
      size: [0.34, 1.9, 0.34],
      center: [7.45, 1.9, -9.1],
      hostId: 'foundry-furnace-plinth',
      supports: ['foundry-catwalk-span'],
      serviceAccess: 'post carries catwalk load into the furnace plinth',
      silhouette: 'second vertical load path under the catwalk',
    }),
    part({
      id: 'foundry-vent-collar',
      assemblyId: 'roof-monitor-and-vent',
      role: 'vent_source',
      material: 'trim',
      size: [3.1, 0.46, 1.35],
      center: [5.8, 2.08, -13.7],
      hostId: 'foundry-hot-core',
      supports: ['foundry-vent-stack-a', 'foundry-vent-stack-b'],
      serviceAccess: 'vent collar sits directly above the furnace process path',
      silhouette: 'wide collar where heat becomes exhaust',
    }),
    part({
      id: 'foundry-vent-stack-a',
      assemblyId: 'roof-monitor-and-vent',
      role: 'vent_stack',
      material: 'iron',
      size: [0.76, 4.8, 0.76],
      center: [4.85, 4.65, -13.7],
      hostId: 'foundry-vent-collar',
      supports: ['foundry-vent-cap'],
      serviceAccess: 'stack is maintainable from the catwalk side',
      silhouette: 'vertical exhaust stack above the furnace',
    }),
    part({
      id: 'foundry-vent-stack-b',
      assemblyId: 'roof-monitor-and-vent',
      role: 'vent_stack',
      material: 'iron',
      size: [0.76, 4.8, 0.76],
      center: [6.75, 4.65, -13.7],
      hostId: 'foundry-vent-collar',
      supports: ['foundry-vent-cap'],
      serviceAccess: 'paired stack reinforces the foundry skyline',
      silhouette: 'second exhaust stack making the room nameable',
    }),
    part({
      id: 'foundry-vent-cap',
      assemblyId: 'roof-monitor-and-vent',
      role: 'vent_stack',
      material: 'trim',
      size: [3.2, 0.42, 1.2],
      center: [5.8, 7.2, -13.7],
      hostId: 'foundry-vent-stack-a',
      supports: [],
      supportedBy: ['foundry-vent-stack-a', 'foundry-vent-stack-b'],
      serviceAccess: 'cap terminates the exhaust crown instead of leaving two random columns',
      silhouette: 'capped roof monitor crown above the furnace',
    }),
    part({
      id: 'foundry-cooling-source',
      assemblyId: 'cooling-channel',
      role: 'cooling_source',
      material: 'hazard',
      size: [1.0, 0.26, 1.65],
      center: [3.9, 1.62, -12.85],
      hostId: 'foundry-hot-core',
      supports: ['foundry-cooling-channel'],
      serviceAccess: 'cooling path begins at the furnace outlet',
      silhouette: 'hot outlet feeding the lower channel',
      hazard: true,
    }),
    part({
      id: 'foundry-cooling-channel',
      assemblyId: 'cooling-channel',
      role: 'cooling_channel',
      material: 'water',
      size: [1.15, 0.22, 8.2],
      center: [2.25, 0.34, -5.95],
      hostId: 'foundry-cooling-source',
      supports: ['foundry-cooling-destination'],
      serviceAccess: 'channel leads away from the furnace and parallels the service route',
      silhouette: 'downstream process line leaving the heat source',
      hazard: true,
    }),
    part({
      id: 'foundry-cooling-rim-left',
      assemblyId: 'cooling-channel',
      role: 'channel_rim',
      material: 'connectorWall',
      size: [0.32, 0.42, 8.6],
      center: [1.46, 0.5, -5.95],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-cooling-channel'],
      serviceAccess: 'left rim keeps the channel legible and traversable',
      silhouette: 'raised channel lip',
    }),
    part({
      id: 'foundry-cooling-rim-right',
      assemblyId: 'cooling-channel',
      role: 'channel_rim',
      material: 'connectorWall',
      size: [0.32, 0.42, 8.6],
      center: [3.04, 0.5, -5.95],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-cooling-channel'],
      serviceAccess: 'right rim defines the service-safe edge',
      silhouette: 'paired channel lip',
    }),
    part({
      id: 'foundry-cooling-service-walkway',
      assemblyId: 'cooling-channel',
      role: 'service_route',
      material: 'bridge',
      size: [1.18, 0.28, 8.6],
      center: [4.05, 0.62, -5.95],
      hostId: 'foundry-host-floor-read',
      supports: ['foundry-cooling-destination'],
      serviceAccess: 'walkable maintenance strip follows the cooling channel from outlet to destination',
      silhouette: 'narrow but readable service path beside the cooling trench',
    }),
    part({
      id: 'foundry-cooling-destination',
      assemblyId: 'cooling-channel',
      role: 'cooling_destination',
      material: 'trim',
      size: [2.2, 0.56, 1.0],
      center: [2.25, 0.58, -1.45],
      hostId: 'foundry-cooling-channel',
      supports: [],
      serviceAccess: 'downstream box terminates the cooling run at a visible output',
      silhouette: 'boxy output basin at the end of the process',
    }),
  ];

  return {
    districtId: 'imperial_foundry',
    assemblies: [
      'foundry-process-chain',
      'furnace-service-frame',
      'catwalk-over-hazard',
      'roof-monitor-and-vent',
      'cooling-channel',
    ],
    requiredRoles: clone(FOUNDRY_REQUIRED_ROLES),
    parts,
    validation: validateDistrictAssemblyPlan({ districtId: 'imperial_foundry', parts, requiredRoles: FOUNDRY_REQUIRED_ROLES }),
  };
}

export function buildDistrictAssemblyPlan(intent) {
  if (intent?.id === 'imperial_foundry') return buildImperialFoundryAssemblyPlan(intent);
  return {
    districtId: intent?.id || 'unknown',
    assemblies: [],
    requiredRoles: [],
    parts: [],
    validation: {
      implemented: false,
      passes: true,
      failedChecks: [],
      unsupportedPartIds: [],
      missingRoles: [],
      nakedPartIds: [],
    },
  };
}

export function validateDistrictAssemblyPlan(plan) {
  const parts = plan?.parts || [];
  const partIds = new Set(parts.map((entry) => entry.id));
  const roles = new Set(parts.map((entry) => entry.role));
  const requiredRoles = plan?.requiredRoles || (plan?.districtId === 'imperial_foundry' ? FOUNDRY_REQUIRED_ROLES : []);
  const missingRoles = requiredRoles.filter((role) => !roles.has(role));
  const nakedPartIds = [];
  const unsupportedPartIds = [];

  for (const entry of parts) {
    const missingFields = DISTRICT_ASSEMBLY_REQUIRED_FIELDS.filter((field) => {
      const value = entry[field];
      if (Array.isArray(value)) return value.length === 0 && field !== 'supports';
      return value === undefined || value === null || value === '';
    });
    if (missingFields.length > 0) nakedPartIds.push(`${entry.id}:${missingFields.join(',')}`);
    const supportedBy = entry.supportedBy || [];
    const supportReferences = [entry.hostId, ...supportedBy].filter(Boolean);
    if (entry.role !== 'host' && supportReferences.length === 0) unsupportedPartIds.push(entry.id);
    for (const supportId of supportedBy) {
      if (!partIds.has(supportId)) unsupportedPartIds.push(`${entry.id}->${supportId}`);
    }
    if (entry.hostId && entry.hostId !== 'carved_voxel_floor' && !partIds.has(entry.hostId)) {
      unsupportedPartIds.push(`${entry.id}->${entry.hostId}`);
    }
  }

  return {
    implemented: parts.length > 0,
    passes: missingRoles.length === 0 && nakedPartIds.length === 0 && unsupportedPartIds.length === 0,
    failedChecks: [
      ...missingRoles.map((role) => `missing_role:${role}`),
      ...nakedPartIds.map((id) => `naked_part:${id}`),
      ...unsupportedPartIds.map((id) => `unsupported:${id}`),
    ],
    unsupportedPartIds,
    missingRoles,
    nakedPartIds,
  };
}
