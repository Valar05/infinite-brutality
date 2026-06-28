const WALL_THICKNESS = 0.72;
const FLOOR_THICKNESS = 0.34;
const WALL_HEIGHT = 3.35;
const PARAPET_HEIGHT = 1.05;

function roomById(plan, id) {
  return plan.rooms.find((room) => room.id === id) || null;
}

function primitive(id, kind, assemblyId, roomId, shape, options = {}) {
  return {
    id,
    kind,
    assemblyId,
    roomId,
    builtPhase: options.builtPhase || 'initial_construction',
    materialGeneration: options.materialGeneration || 'old_cistern_stone',
    supportRole: options.supportRole || 'structural',
    supportedBy: options.supportedBy || ['carved_retaining_shelf'],
    touches: options.touches || ['room', 'stone'],
    routeRole: options.routeRole || 'official_route',
    collisionPolicy: options.collisionPolicy || 'solid',
    visualPriority: options.visualPriority || 'primary',
    validationTags: options.validationTags || [],
    materialKey: options.materialKey || 'wall',
    shape,
  };
}

function addFloor(plan, room) {
  plan.primitives.push(primitive(
    room.id + '-floor',
    room.kind === 'outside_cut' ? 'cliff cut' : 'floor plate',
    room.assemblyId,
    room.id,
    {
      type: 'box',
      center: [room.center[0], room.topY - FLOOR_THICKNESS * 0.5, room.center[1]],
      size: [room.size[0], FLOOR_THICKNESS, room.size[1]],
    },
    {
      supportRole: 'circulation',
      collisionPolicy: 'walkable',
      materialKey: room.kind === 'outside_cut' ? 'stone2' : 'connectorFloor',
      validationTags: ['walkable', 'supported_room_floor'],
    },
  ));
}

function wallSegments(room, side, gaps = []) {
  const isHorizontal = side === 'north' || side === 'south';
  const span = isHorizontal ? room.size[0] : room.size[1];
  const half = span * 0.5;
  const sorted = [...gaps]
    .map((gap) => ({ from: Math.max(-half, gap.from), to: Math.min(half, gap.to), connectorId: gap.connectorId }))
    .filter((gap) => gap.to - gap.from > 0.35)
    .sort((a, b) => a.from - b.from);
  const ranges = [];
  let cursor = -half;
  for (const gap of sorted) {
    if (gap.from - cursor > 0.45) ranges.push([cursor, gap.from]);
    cursor = Math.max(cursor, gap.to);
  }
  if (half - cursor > 0.45) ranges.push([cursor, half]);
  return ranges.map(([from, to]) => {
    const length = to - from;
    const alongCenter = (from + to) * 0.5;
    if (isHorizontal) {
      const z = room.center[1] + (side === 'north' ? room.size[1] * 0.5 : -room.size[1] * 0.5);
      return {
        center: [room.center[0] + alongCenter, room.topY + WALL_HEIGHT * 0.5, z],
        size: [length, WALL_HEIGHT, WALL_THICKNESS],
      };
    }
    const x = room.center[0] + (side === 'east' ? room.size[0] * 0.5 : -room.size[0] * 0.5);
    return {
      center: [x, room.topY + WALL_HEIGHT * 0.5, room.center[1] + alongCenter],
      size: [WALL_THICKNESS, WALL_HEIGHT, length],
    };
  });
}

function addWalls(plan, room) {
  for (const side of ['north', 'south', 'east', 'west']) {
    const gaps = room.openings?.[side] || [];
    for (const [index, segment] of wallSegments(room, side, gaps).entries()) {
      plan.primitives.push(primitive(
        room.id + '-' + side + '-wall-' + index,
        room.wallKind || 'wall bay',
        room.assemblyId,
        room.id,
        { type: 'box', ...segment },
        {
          supportRole: side === 'west' && room.id === 'cistern_court' ? 'retaining' : 'load_bearing',
          supportedBy: [room.id + '-floor'],
          touches: ['room', side === 'west' ? 'cliff_cut' : 'adjacent_wall'],
          materialKey: room.wallMaterial || 'plaster',
          validationTags: ['room_boundary', 'has_opening_contract'],
        },
      ));
    }
  }
}

function addGate(plan, id, roomId, x, z, topY, width, height = 3.7) {
  const pierW = 1.05;
  const pierD = 1.2;
  const leftX = x - width * 0.5 - pierW * 0.5;
  const rightX = x + width * 0.5 + pierW * 0.5;
  for (const [label, px] of [['left', leftX], ['right', rightX]]) {
    plan.primitives.push(primitive(
      id + '-' + label + '-pier',
      'gate pier',
      id,
      roomId,
      { type: 'box', center: [px, topY + height * 0.5, z], size: [pierW, height, pierD] },
      {
        supportRole: 'load_bearing',
        supportedBy: [roomId + '-floor'],
        touches: ['threshold', 'lintel'],
        materialKey: 'stone2',
        validationTags: ['gatehouse', 'opening_support'],
      },
    ));
  }
  plan.primitives.push(primitive(
    id + '-lintel',
    'lintel',
    id,
    roomId,
    { type: 'box', center: [x, topY + height + 0.28, z], size: [width + pierW * 2.3, 0.56, pierD] },
    {
      supportRole: 'span',
      supportedBy: [id + '-left-pier', id + '-right-pier'],
      touches: ['gate pier'],
      materialKey: 'trim',
      validationTags: ['supported_lintel'],
    },
  ));
  plan.primitives.push(primitive(
    id + '-threshold',
    'threshold',
    id,
    roomId,
    { type: 'box', center: [x, topY + 0.05, z], size: [width + 1.1, 0.1, 1.6] },
    {
      supportRole: 'circulation',
      collisionPolicy: 'walkable',
      materialKey: 'bronze',
      validationTags: ['readable_threshold'],
    },
  ));
}

function addRetainingAndParapets(plan, room) {
  const westX = room.center[0] - room.size[0] * 0.5 - 1.0;
  plan.primitives.push(primitive(
    'spawn-west-retaining-course',
    'retaining wall',
    'carved_retaining_shelf',
    room.id,
    { type: 'box', center: [westX, room.topY + 1.95, room.center[1]], size: [1.6, 3.9, room.size[1] + 3.2] },
    {
      supportRole: 'retaining',
      supportedBy: ['natural_cliff_face'],
      touches: ['cliff_cut', 'cistern_court'],
      materialKey: 'wall',
      validationTags: ['terrain_building_fusion', 'retains_stone'],
    },
  ));
  const northZ = room.center[1] + room.size[1] * 0.5 + 0.45;
  plan.primitives.push(primitive(
    'spawn-cistern-north-parapet',
    'parapet',
    room.assemblyId,
    room.id,
    { type: 'box', center: [room.center[0], room.topY + PARAPET_HEIGHT * 0.5, northZ], size: [room.size[0] + 1.0, PARAPET_HEIGHT, 0.7] },
    {
      supportRole: 'edge_treatment',
      supportedBy: [room.id + '-floor'],
      touches: ['void_edge'],
      materialKey: 'trim',
      validationTags: ['edge_treatment'],
    },
  ));
}

function addStairPrimitive(plan, id, fromRoomId, toRoomId, from, to) {
  plan.primitives.push(primitive(
    id,
    'stair run',
    'service_stair_phrase',
    fromRoomId,
    { type: 'stair', from, to },
    {
      supportRole: 'circulation',
      supportedBy: [fromRoomId + '-floor', toRoomId + '-floor'],
      touches: [fromRoomId, toRoomId],
      routeRole: 'official_route',
      collisionPolicy: 'walkable',
      materialKey: 'platform',
      validationTags: ['connected_route', 'height_change'],
    },
  ));
}

export function buildSpawnCisternCustomsPlan({ origin, lowBand, buildBand, highBand }) {
  const plan = {
    id: 'spawn-cistern-customs-building',
    placeArchetype: 'Cistern Customs Terrace',
    stoneForm: 'carved retaining-gate shelf',
    formerUse: 'water customs checkpoint and cistern accounting court',
    damageOrPressure: 'cliff shelf sheared away and the west retaining wall was repaired under load',
    currentUse: 'spawn route through a fortified cistern court into the climb',
    rooms: [
      {
        id: 'arrival_cut',
        kind: 'outside_cut',
        assemblyId: 'arrival_cliff_cut',
        center: [origin.x, origin.z - 3.2],
        size: [10.4, 8.0],
        topY: lowBand + 0.42,
        purpose: 'spawn shelf carved from island stone',
        openings: { north: [{ from: -3.4, to: 3.4, connectorId: 'arrival_to_gate' }] },
        wallKind: 'cliff cut',
        wallMaterial: 'stone2',
      },
      {
        id: 'customs_gate',
        kind: 'gate_room',
        assemblyId: 'customs_gatehouse',
        center: [origin.x, origin.z + 6.0],
        size: [12.2, 10.0],
        topY: buildBand + 0.52,
        purpose: 'compressed gate room with a readable threshold',
        openings: {
          south: [{ from: -3.4, to: 3.4, connectorId: 'arrival_to_gate' }],
          north: [{ from: -3.8, to: 3.8, connectorId: 'gate_to_cistern' }],
          west: [{ from: -1.2, to: 2.8, connectorId: 'gate_to_service_ledges' }],
        },
        wallKind: 'wall bay',
        wallMaterial: 'plaster',
      },
      {
        id: 'cistern_court',
        kind: 'court_room',
        assemblyId: 'cistern_court',
        center: [origin.x - 5.8, origin.z + 17.0],
        size: [15.6, 12.2],
        topY: buildBand + 0.62,
        purpose: 'open cistern room with side walls and visible water measure',
        openings: {
          south: [{ from: -1.2, to: 6.4, connectorId: 'gate_to_cistern' }],
          east: [{ from: 1.0, to: 5.0, connectorId: 'cistern_to_roof_stair' }],
        },
        wallKind: 'wall bay',
        wallMaterial: 'plaster',
      },
      {
        id: 'stair_landing',
        kind: 'landing_room',
        assemblyId: 'service_stair_phrase',
        center: [origin.x - 1.0, origin.z + 27.0],
        size: [8.2, 7.4],
        topY: buildBand + 1.18,
        purpose: 'intermediate landing that turns the player toward the roof',
        openings: {
          south: [{ from: -2.8, to: 2.8, connectorId: 'cistern_to_roof_stair' }],
          north: [{ from: -2.8, to: 2.8, connectorId: 'landing_to_roof' }],
        },
        wallKind: 'service tunnel wall',
        wallMaterial: 'connectorWall',
      },
      {
        id: 'roof_overlook',
        kind: 'roof_route',
        assemblyId: 'roof_overlook',
        center: [origin.x + 2.4, origin.z + 36.0],
        size: [13.0, 8.6],
        topY: highBand + 0.38,
        purpose: 'upper overlook route showing the next district',
        openings: { south: [{ from: -3.0, to: 3.0, connectorId: 'landing_to_roof' }] },
        wallKind: 'parapet',
        wallMaterial: 'trim',
      },
    ],
    connectors: [
      { id: 'arrival_to_gate', type: 'threshold', from: 'arrival_cut', to: 'customs_gate' },
      { id: 'gate_to_cistern', type: 'threshold', from: 'customs_gate', to: 'cistern_court' },
      { id: 'cistern_to_roof_stair', type: 'stair', from: 'cistern_court', to: 'stair_landing' },
      { id: 'landing_to_roof', type: 'stair', from: 'stair_landing', to: 'roof_overlook' },
      { id: 'gate_to_service_ledges', type: 'recovery_ledge', from: 'customs_gate', to: 'arrival_cut' },
    ],
    rockInterfaces: [
      { id: 'natural_cliff_face', kind: 'cliff cut', roomId: 'arrival_cut' },
      { id: 'carved_retaining_shelf', kind: 'foundation shelf', roomId: 'customs_gate' },
      { id: 'west_cistern_repair', kind: 'retaining wall', roomId: 'cistern_court' },
      { id: 'stair_trench', kind: 'stair trench', roomId: 'stair_landing' },
    ],
    primitives: [],
  };

  for (const room of plan.rooms) {
    addFloor(plan, room);
    addWalls(plan, room);
  }
  const gateRoom = roomById(plan, 'customs_gate');
  const cisternRoom = roomById(plan, 'cistern_court');
  const landingRoom = roomById(plan, 'stair_landing');
  const roofRoom = roomById(plan, 'roof_overlook');
  addGate(plan, 'spawn-arrival-gate', 'customs_gate', gateRoom.center[0], gateRoom.center[1] - gateRoom.size[1] * 0.5 + 0.2, gateRoom.topY, 6.4);
  addGate(plan, 'spawn-cistern-gate', 'cistern_court', cisternRoom.center[0] + 2.4, cisternRoom.center[1] - cisternRoom.size[1] * 0.5 + 0.2, cisternRoom.topY, 7.0, 3.2);
  addRetainingAndParapets(plan, cisternRoom);
  addStairPrimitive(
    plan,
    'spawn-cistern-roof-stair-a',
    'cistern_court',
    'stair_landing',
    [cisternRoom.center[0] + 5.6, cisternRoom.topY, cisternRoom.center[1] + 3.0],
    [landingRoom.center[0], landingRoom.topY, landingRoom.center[1] - 2.8],
  );
  addStairPrimitive(
    plan,
    'spawn-landing-roof-stair-b',
    'stair_landing',
    'roof_overlook',
    [landingRoom.center[0], landingRoom.topY, landingRoom.center[1] + 2.6],
    [roofRoom.center[0] - 1.6, roofRoom.topY, roofRoom.center[1] - 3.3],
  );
  return plan;
}

export function validateSpawnCisternCustomsPlan(plan) {
  const failures = [];
  const roomIds = new Set(plan.rooms.map((room) => room.id));
  const connectorIds = new Set(plan.connectors.map((connector) => connector.id));
  if (plan.rooms.length < 5) failures.push('spawn building needs at least five named spaces');
  for (const room of plan.rooms) {
    if (!room.purpose) failures.push(room.id + ' lacks purpose');
    if (!Number.isFinite(room.topY)) failures.push(room.id + ' lacks topY');
    const hasConnector = plan.connectors.some((connector) => connector.from === room.id || connector.to === room.id);
    if (!hasConnector) failures.push(room.id + ' is disconnected');
    for (const gaps of Object.values(room.openings || {})) {
      for (const gap of gaps) {
        if (!connectorIds.has(gap.connectorId)) failures.push(room.id + ' opening references missing connector ' + gap.connectorId);
      }
    }
  }
  for (const connector of plan.connectors) {
    if (!roomIds.has(connector.from) || !roomIds.has(connector.to)) failures.push(connector.id + ' connects missing rooms');
  }
  const graph = new Map([...roomIds].map((id) => [id, []]));
  for (const connector of plan.connectors) {
    graph.get(connector.from)?.push(connector.to);
    graph.get(connector.to)?.push(connector.from);
  }
  const seen = new Set();
  const stack = ['arrival_cut'];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of graph.get(id) || []) stack.push(next);
  }
  if (!seen.has('roof_overlook')) failures.push('arrival route cannot reach roof_overlook');
  const floors = new Set(plan.primitives.filter((primitive) => primitive.collisionPolicy === 'walkable').map((primitive) => primitive.id));
  for (const primitive of plan.primitives) {
    if (!primitive.kind || !primitive.assemblyId || !primitive.roomId) failures.push(primitive.id + ' is not typed');
    if (!roomIds.has(primitive.roomId)) failures.push(primitive.id + ' belongs to missing room');
    if (!primitive.supportedBy?.length) failures.push(primitive.id + ' lacks support');
    if (primitive.collisionPolicy === 'visual-only' && primitive.supportRole !== 'dressing') failures.push(primitive.id + ' is structural visual-only');
    if (primitive.kind !== 'floor plate' && primitive.kind !== 'cliff cut') {
      const supportOk = primitive.supportedBy.some((id) => floors.has(id) || id === 'natural_cliff_face' || id === 'carved_retaining_shelf');
      if (!supportOk && primitive.supportRole !== 'span') failures.push(primitive.id + ' is not supported by a floor or rock interface');
    }
  }
  return {
    ok: failures.length === 0,
    failures,
    roomCount: plan.rooms.length,
    connectorCount: plan.connectors.length,
    primitiveCount: plan.primitives.length,
    walkablePrimitiveCount: plan.primitives.filter((primitive) => primitive.collisionPolicy === 'walkable').length,
    solidPrimitiveCount: plan.primitives.filter((primitive) => primitive.collisionPolicy === 'solid').length,
  };
}
