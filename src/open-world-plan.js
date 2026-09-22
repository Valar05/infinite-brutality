function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function positionArray(value) {
  if (Array.isArray(value)) return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  return [Number(value?.x) || 0, Number(value?.y) || 0, Number(value?.z) || 0];
}

function organicPath(from, to, rng, bendScale = 1) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const nx = -dz / len;
  const nz = dx / len;
  const bend = Math.min(18, Math.max(3.5, len * 0.16)) * bendScale * (rng() < 0.5 ? -1 : 1);
  const lift = (rng() - 0.5) * Math.min(7, len * 0.08);
  return [
    [...from],
    [from[0] + dx * 0.34 + nx * bend, from[1] + (to[1] - from[1]) * 0.30 + lift, from[2] + dz * 0.34 + nz * bend],
    [from[0] + dx * 0.68 - nx * bend * 0.55, from[1] + (to[1] - from[1]) * 0.70 - lift * 0.35, from[2] + dz * 0.68 - nz * bend * 0.55],
    [...to],
  ];
}

function districtForRoom(plan, roomIndex) {
  const districtIndex = Math.max(0, Math.min(plan.districts.length - 1, plan.roomToDistrict?.[roomIndex] ?? 0));
  const district = plan.districts[districtIndex] || plan.districts[0];
  const localIndex = Math.max(0, roomIndex - (district?.roomStart || 0));
  return { district, districtIndex, localIndex };
}

function roomPosition(plan, roomIndex) {
  const { district, localIndex } = districtForRoom(plan, roomIndex);
  const origin = positionArray(district?.origin);
  const points = district?.roomOffsets?.length ? district.roomOffsets : district?.layoutPoints || [[0, 0, 0]];
  const point = positionArray(points[Math.min(localIndex, points.length - 1)] || points[points.length - 1] || [0, 0, 0]);
  return [origin[0] + point[0], origin[1] + point[2], origin[2] + point[1]];
}

function edgeId(a, b) {
  return a < b ? a + ':' + b : b + ':' + a;
}

export function buildOpenWorldPlan({ districtPlan, roomCount, roomSpecAt }) {
  if (!districtPlan?.districts?.length) throw new Error('open world plan requires district plan');
  if (!Number.isInteger(roomCount) || roomCount < 1) throw new Error('open world plan requires roomCount >= 1');
  const seed = (districtPlan.seed ?? 1) >>> 0;
  const rng = mulberry32(seed ^ 0x51f15e);
  const nodes = [];
  for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
    const info = districtForRoom(districtPlan, roomIndex);
    const spec = roomSpecAt(roomIndex) || {};
    const base = roomPosition(districtPlan, roomIndex);
    const position = [
      base[0] + (rng() - 0.5) * 5.5,
      base[1] + (rng() - 0.5) * 1.4,
      base[2] + (rng() - 0.5) * 5.5,
    ];
    nodes.push({
      id: 'world-node-' + roomIndex,
      roomIndex,
      districtId: info.district?.id || 'district-0',
      districtIndex: info.districtIndex,
      localIndex: info.localIndex,
      routeRole: roomIndex === 0 ? 'entry' : roomIndex === roomCount - 1 ? 'destination' : 'main',
      semanticRole: spec.semantic_role || spec.semanticRole || spec.junction_class || 'traversal',
      purpose: spec.batch_prompt || spec.purpose || '',
      position,
      massRadius: 13 + rng() * 5,
      massDepth: 9 + rng() * 5,
      sourceRoomId: spec.id || 'room-' + roomIndex,
    });
  }

  const edges = [];
  const seen = new Set();
  const addEdge = (a, b, routeRole, purpose, bendScale = 1) => {
    if (a === b || !nodes[a] || !nodes[b]) return;
    const key = edgeId(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      id: 'world-edge-' + edges.length,
      a,
      b,
      routeRole,
      purpose,
      width: routeRole === 'main' ? 7.0 : 5.4,
      path: organicPath(nodes[a].position, nodes[b].position, rng, bendScale),
    });
  };

  for (let i = 0; i < nodes.length - 1; i += 1) addEdge(i, i + 1, 'main', 'primary circulation');
  for (const district of districtPlan.districts) {
    for (const pair of district.branchPairs || []) {
      const a = (district.roomStart || 0) + pair[0];
      const b = (district.roomStart || 0) + pair[1];
      if (a < roomCount && b < roomCount) addEdge(a, b, 'branch', 'semantic district branch', 1.25);
    }
  }
  if (nodes.length >= 3) addEdge(nodes.length - 1, 0, 'return', 'open-world return loop', 1.45);

  return {
    schema: 'infinite-brutality.open-world-plan.v1',
    seed,
    levelIndex: districtPlan.levelIndex,
    topologyAuthority: 'semantic_nodes_edges',
    donorLineage: ['driftfield:semantic-route-graph', 'armorture:windowed-field', 'ruined-air:floating-mass'],
    nodes,
    edges,
    mainEdgeIds: edges.filter((edge) => edge.routeRole === 'main').map((edge) => edge.id),
    loopEdgeIds: edges.filter((edge) => edge.routeRole !== 'main').map((edge) => edge.id),
  };
}
