const CELL = 2.0;

function vec3(x, y, z) {
  return { x, y, z };
}

function fieldIndex(nx, ny, x, y, z) {
  return x + nx * (y + ny * z);
}

function voxelCenter(field, x, y, z) {
  return {
    x: field.min.x + (x + 0.5) * field.cell,
    y: field.min.y + (y + 0.5) * field.cell,
    z: field.min.z + (z + 0.5) * field.cell,
  };
}

function getVoxel(field, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) return 0;
  return field.voxels[fieldIndex(field.nx, field.ny, x, y, z)];
}

function setVoxel(field, x, y, z, value) {
  if (x < 0 || y < 0 || z < 0 || x >= field.nx || y >= field.ny || z >= field.nz) return;
  field.voxels[fieldIndex(field.nx, field.ny, x, y, z)] = value ? 1 : 0;
}

function countSolid(field) {
  let total = 0;
  for (const value of field.voxels) total += value ? 1 : 0;
  return total;
}

function makeBounds(cx, cy, cz, sx, sy, sz) {
  return {
    min: [cx - sx * 0.5, cy - sy * 0.5, cz - sz * 0.5],
    max: [cx + sx * 0.5, cy + sy * 0.5, cz + sz * 0.5],
  };
}

function boundsOverlap(a, b, margin = 0) {
  return a.min[0] <= b.max[0] + margin && a.max[0] >= b.min[0] - margin
    && a.min[1] <= b.max[1] + margin && a.max[1] >= b.min[1] - margin
    && a.min[2] <= b.max[2] + margin && a.max[2] >= b.min[2] - margin;
}

function boundsCenter(bounds) {
  return [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ];
}

function pointInBox(point, bounds) {
  return point.x >= bounds.min[0] && point.x <= bounds.max[0]
    && point.y >= bounds.min[1] && point.y <= bounds.max[1]
    && point.z >= bounds.min[2] && point.z <= bounds.max[2];
}

function pointInEllipsoid(point, bounds) {
  const center = boundsCenter(bounds);
  const rx = Math.max(0.001, (bounds.max[0] - bounds.min[0]) * 0.5);
  const ry = Math.max(0.001, (bounds.max[1] - bounds.min[1]) * 0.5);
  const rz = Math.max(0.001, (bounds.max[2] - bounds.min[2]) * 0.5);
  const dx = (point.x - center[0]) / rx;
  const dy = (point.y - center[1]) / ry;
  const dz = (point.z - center[2]) / rz;
  return dx * dx + dy * dy + dz * dz <= 1;
}

function cutContainsPoint(cut, point) {
  const bounds = cut.worldBounds;
  if (cut.cutShape === 'box' || cut.cutShape === 'ramp' || cut.cutShape === 'window') return pointInBox(point, bounds);
  if (cut.cutShape === 'ellipsoid') return pointInEllipsoid(point, bounds);
  return false;
}

function rampFloorY(cut, point) {
  const profile = cut.ascentProfile || {};
  const bounds = cut.worldBounds;
  const run = Math.max(0.001, bounds.max[2] - bounds.min[2]);
  const t = Math.max(0, Math.min(1, (point.z - bounds.min[2]) / run));
  const startY = Number.isFinite(profile.floorStartY) ? profile.floorStartY : bounds.min[1] + 1.0;
  const endY = Number.isFinite(profile.floorEndY) ? profile.floorEndY : bounds.min[1] + 3.0;
  const landingStart = Math.max(0.05, Math.min(0.8, profile.landingStart ?? 0.42));
  const landingEnd = Math.max(landingStart + 0.05, Math.min(0.95, profile.landingEnd ?? 0.58));
  const midY = startY + (endY - startY) * 0.5;
  if (t < landingStart) return startY + (midY - startY) * (t / landingStart);
  if (t <= landingEnd) return midY;
  return midY + (endY - midY) * ((t - landingEnd) / Math.max(0.001, 1 - landingEnd));
}

function rampProfileMetrics(cut) {
  const bounds = cut.worldBounds;
  const samples = [];
  let maxRisePerRun = 0;
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const z = bounds.min[2] + (bounds.max[2] - bounds.min[2]) * t;
    const y = rampFloorY(cut, { z });
    samples.push({ t, z, y });
    if (samples.length > 1) {
      const prev = samples[samples.length - 2];
      maxRisePerRun = Math.max(maxRisePerRun, Math.abs(y - prev.y) / Math.max(0.001, Math.abs(z - prev.z)));
    }
  }
  const landingStart = cut.ascentProfile?.landingStart ?? 0.42;
  const landingEnd = cut.ascentProfile?.landingEnd ?? 0.58;
  return {
    kind: cut.ascentProfile?.kind || 'walkable_ramp',
    maxRisePerRun,
    landingRun: (bounds.max[2] - bounds.min[2]) * Math.max(0, landingEnd - landingStart),
    samples,
  };
}

export const CARVED_VOXEL_FORTRESS_CUTS = [
  {
    id: 'spawn_alcove',
    purpose: 'sheltered start cut facing into the mass',
    cutShape: 'box',
    worldBounds: makeBounds(0, 0.2, -24, 8, 5, 11),
    connectsFrom: null,
    connectsTo: 'battery_court',
    tacticalRole: 'safe_orientation',
    verticalRole: 'low_entry',
    readabilityCue: 'bright alcove mouth frames the first court',
    anchor: [0, -0.5, -25],
  },
  {
    id: 'battery_court',
    purpose: 'main combat hollow carved from the center of the rock',
    cutShape: 'ellipsoid',
    worldBounds: makeBounds(0, 0.6, -12, 18, 7, 15),
    connectsFrom: 'spawn_alcove',
    connectsTo: 'trench_cut',
    tacticalRole: 'first_combat_bowl',
    verticalRole: 'low_court',
    readabilityCue: 'wide carved void with broken sky edge',
    anchor: [0, -0.6, -12],
  },
  {
    id: 'first_mount_lip',
    purpose: 'reachable carved lip that teaches jump-to-mount scale before the route climbs',
    cutShape: 'box',
    worldBounds: makeBounds(-4, 1.0, -12, 12, 3, 8),
    connectsFrom: 'battery_court',
    connectsTo: 'trench_cut',
    tacticalRole: 'first_mount_scale_check',
    verticalRole: 'low_mount_lip',
    readabilityCue: 'low stone bite catches the first jump instead of a full-height block',
    anchor: [-4, 0.8, -12],
    mountTopY: 1.45,
  },
  {
    id: 'trench_cut',
    purpose: 'narrow imperial service trench gouged along the west side',
    cutShape: 'box',
    worldBounds: makeBounds(-10, 0.2, 1, 7, 5, 20),
    connectsFrom: 'battery_court',
    connectsTo: 'carved_stair',
    tacticalRole: 'side_pressure_lane',
    verticalRole: 'low_branch',
    readabilityCue: 'straight shadowed cut pulls left around the blocked gate',
    anchor: [-10, -0.5, 1],
  },
  {
    id: 'carved_stair',
    purpose: 'shallow carved road rising through the mass',
    cutShape: 'ramp',
    worldBounds: makeBounds(-6, 2.55, 13, 13, 8.5, 30),
    connectsFrom: 'trench_cut',
    connectsTo: 'overlook_window',
    tacticalRole: 'walkable_ascent',
    verticalRole: 'upward_transition',
    readabilityCue: 'broad shallow road climbs through the rock with a flat breath before the upper lip',
    anchor: [-7, 1.2, 12],
    ascentProfile: {
      kind: 'walkable_switchback_road',
      floorStartY: -0.7,
      floorEndY: 2.25,
      ceilingClearance: 4.25,
      landingStart: 0.42,
      landingEnd: 0.6,
      maxReadableRisePerRun: 0.24,
    },
  },
  {
    id: 'overlook_window',
    purpose: 'upper carved window looking back into the battery court',
    cutShape: 'window',
    worldBounds: makeBounds(-1, 4.5, 6, 14, 5, 25),
    connectsFrom: 'carved_stair',
    connectsTo: 'final_chamber',
    tacticalRole: 'route_memory_overlook',
    verticalRole: 'upper_overlook',
    readabilityCue: 'horizontal slit exposes the earlier court below',
    lineOfSightTo: 'battery_court',
    anchor: [-1, 3.9, 9],
  },
  {
    id: 'final_chamber',
    purpose: 'upper artillery chamber cut behind the overlook',
    cutShape: 'ellipsoid',
    worldBounds: makeBounds(4, 4.2, 23, 17, 7, 13),
    connectsFrom: 'overlook_window',
    connectsTo: null,
    tacticalRole: 'final_combat_room',
    verticalRole: 'upper_goal',
    readabilityCue: 'large high hollow with gun plinth silhouette',
    anchor: [4, 3.8, 23],
  },
  {
    id: 'secret_side_cut',
    purpose: 'optional side absence tucked off the upper route',
    cutShape: 'box',
    worldBounds: makeBounds(-13, 4.1, 15, 8, 5, 9),
    connectsFrom: 'overlook_window',
    connectsTo: 'overlook_window',
    tacticalRole: 'optional_secret',
    verticalRole: 'upper_side_branch',
    readabilityCue: 'thin side bite visible from the overlook edge',
    secret: true,
    anchor: [-14, 3.8, 21],
  },
  {
    id: 'broken_void_edge',
    purpose: 'void-facing fracture that reveals the fortress mass as floating stone',
    cutShape: 'box',
    worldBounds: makeBounds(12, 0.8, 2, 11, 18, 31),
    connectsFrom: 'battery_court',
    connectsTo: null,
    tacticalRole: 'hazard_read',
    verticalRole: 'exterior_void',
    readabilityCue: 'right side is torn open to empty air',
    anchor: [9, 2.0, 2],
  },
];

function createSolidMassField() {
  const min = vec3(-19, -8, -32);
  const max = vec3(19, 10, 34);
  const nx = Math.ceil((max.x - min.x) / CELL);
  const ny = Math.ceil((max.y - min.y) / CELL);
  const nz = Math.ceil((max.z - min.z) / CELL);
  const field = {
    cell: CELL,
    min,
    max,
    nx,
    ny,
    nz,
    voxels: new Uint8Array(nx * ny * nz),
    rockGrammar: {
      grammar: 'carved_imperial_structure',
      fieldGrammar: 'carved_imperial_structure',
      silhouette: 'single_carved_fortress_fragment',
      imperialFunction: 'imperial_fortress_cut_from_floating_rock',
      process: 'solid_mass_subtractive_engineering',
    },
  };
  field.voxels.fill(1);
  return field;
}

function carveCut(field, cut) {
  let removed = 0;
  for (let z = 0; z < field.nz; z += 1) {
    for (let y = 0; y < field.ny; y += 1) {
      for (let x = 0; x < field.nx; x += 1) {
        if (!getVoxel(field, x, y, z)) continue;
        const point = voxelCenter(field, x, y, z);
        if (cut.cutShape === 'ramp') {
          if (!pointInBox(point, cut.worldBounds)) continue;
          const floorY = rampFloorY(cut, point);
          const ceilingY = floorY + (cut.ascentProfile?.ceilingClearance ?? 4.0);
          if (point.y < floorY || point.y > ceilingY) continue;
        } else if (!cutContainsPoint(cut, point)) {
          continue;
        }
        setVoxel(field, x, y, z, 0);
        removed += 1;
      }
    }
  }
  return removed;
}

function connectCuts(a, b) {
  if (!a || !b) return false;
  return boundsOverlap(a.worldBounds, b.worldBounds, CELL * 1.1);
}

function hasLineOfSight(from, to, cuts) {
  if (!from || !to) return false;
  const start = boundsCenter(from.worldBounds);
  const end = boundsCenter(to.worldBounds);
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const point = {
      x: start[0] + (end[0] - start[0]) * t,
      y: start[1] + (end[1] - start[1]) * t,
      z: start[2] + (end[2] - start[2]) * t,
    };
    if (!cuts.some((cut) => cutContainsPoint(cut, point))) return false;
  }
  return true;
}

export function buildCarvedVoxelFortressData() {
  const field = createSolidMassField();
  const solidVoxelCountBeforeCuts = countSolid(field);
  const cutStats = [];
  for (const cut of CARVED_VOXEL_FORTRESS_CUTS) {
    cutStats.push({ id: cut.id, removedVoxels: carveCut(field, cut) });
  }
  const solidVoxelCountAfterCuts = countSolid(field);
  const byId = new Map(CARVED_VOXEL_FORTRESS_CUTS.map((cut) => [cut.id, cut]));
  const mainRoute = [
    'spawn_alcove',
    'battery_court',
    'first_mount_lip',
    'trench_cut',
    'carved_stair',
    'overlook_window',
    'final_chamber',
  ];
  const firstMount = byId.get('first_mount_lip');
  const battery = byId.get('battery_court');
  const carvedStair = byId.get('carved_stair');
  const firstMountDelta = Math.abs((firstMount?.mountTopY ?? 0) - (battery?.anchor?.[1] ?? 0));
  const carvedStairProfile = rampProfileMetrics(carvedStair);
  return {
    id: 'carved_voxel_fortress',
    field,
    cuts: CARVED_VOXEL_FORTRESS_CUTS.map((cut) => ({ ...cut })),
    cutStats,
    metrics: {
      solidVoxelCountBeforeCuts,
      solidVoxelCountAfterCuts,
      airVolumeCreated: solidVoxelCountBeforeCuts - solidVoxelCountAfterCuts,
      routeConnections: mainRoute.slice(0, -1).map((id, index) => ({
        from: id,
        to: mainRoute[index + 1],
        connected: connectCuts(byId.get(id), byId.get(mainRoute[index + 1])),
      })),
      firstMountLipReachable: firstMountDelta <= 2.15,
      firstMountLipDelta: firstMountDelta,
      carvedStairProfile,
      carvedStairWalkable: carvedStairProfile.maxRisePerRun <= (carvedStair.ascentProfile?.maxReadableRisePerRun ?? 0.24)
        && carvedStairProfile.landingRun >= field.cell * 2,
      overlookLineOfSight: hasLineOfSight(byId.get('overlook_window'), byId.get('battery_court'), CARVED_VOXEL_FORTRESS_CUTS),
      secretReturns: connectCuts(byId.get('secret_side_cut'), byId.get('overlook_window')),
    },
    anchors: {
      spawn: [0, -0.5, -25],
      exit: [4, 3.8, 28],
      enemies: [],
      rooms: mainRoute.map((id) => {
        const cut = byId.get(id);
        return {
          id,
          label: cut.purpose,
          center: cut.anchor,
          bounds: {
            minX: cut.worldBounds.min[0],
            maxX: cut.worldBounds.max[0],
            minZ: cut.worldBounds.min[2],
            maxZ: cut.worldBounds.max[2],
          },
          sockets: {},
        };
      }),
    },
  };
}
