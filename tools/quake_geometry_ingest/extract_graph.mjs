import {
  boxCenter,
  boxSize,
  horizontalDistance,
  horizontalOverlap,
  pointDistance2,
  quakeBrushToIbBox,
  quakeToIbPoint,
} from './schema.mjs';

const STEP_MAX = 0.55;
const JUMP_MAX = 2.2;
const PORTAL_GAP = 1.35;
const HEADROOM = 1.75;

function tagsContain(item, pattern) {
  return (item.tags || []).some((tag) => pattern.test(String(tag)));
}

function hasHeadroom(surface, solids) {
  const probe = {
    min: [surface.bounds.min[0] + 0.08, surface.y + 0.05, surface.bounds.min[2] + 0.08],
    max: [surface.bounds.max[0] - 0.08, surface.y + HEADROOM, surface.bounds.max[2] - 0.08],
  };
  return !solids.some((solid) => solid.id !== surface.sourceBrushId
    && !tagsContain(solid, /gate|door|bar/i)
    && solid.max[1] > probe.min[1]
    && solid.min[1] < probe.max[1]
    && horizontalOverlap(solid, probe, 0));
}

function nearestRoomId(surface, roomHints) {
  if (!roomHints.length) return surface.id;
  const center = boxCenter(surface.bounds);
  let best = roomHints[0];
  let bestScore = Infinity;
  for (const room of roomHints) {
    const score = pointDistance2(center, room.origin);
    if (score < bestScore) {
      best = room;
      bestScore = score;
    }
  }
  return best.id;
}

function classifyEdge(a, b, blockers = []) {
  const dy = Math.abs(a.y - b.y);
  const gap = horizontalDistance(a.bounds, b.bounds);
  if (dy <= 0.18 && gap <= PORTAL_GAP) return 'portal';
  if (dy > 0.18 && dy <= STEP_MAX && gap <= PORTAL_GAP * 1.4) return 'stair_step';
  if (dy > STEP_MAX && dy <= JUMP_MAX && gap <= PORTAL_GAP * 1.7) return 'ledge';
  const gate = blockers.find((blocker) => tagsContain(blocker, /gate|door|locked/i)
    && horizontalDistance(a.bounds, blocker) <= PORTAL_GAP
    && horizontalDistance(b.bounds, blocker) <= PORTAL_GAP * 1.8);
  if (gate) return tagsContain(gate, /locked/i) ? 'locked_gate' : 'gate';
  return null;
}

function connectedComponents(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }
  const seen = new Set();
  const components = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id];
    const ids = [];
    seen.add(node.id);
    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      for (const next of adjacency.get(id) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(ids);
  }
  return components;
}

function graphHasCycle(nodeIds, edges) {
  const componentEdges = edges.filter((edge) => nodeIds.includes(edge.from) && nodeIds.includes(edge.to));
  return componentEdges.length >= nodeIds.length;
}

export function extractSpatialStructure(neutral) {
  const scale = neutral.scale?.quakeUnitsPerIbUnit || 32;
  const solids = neutral.brushes
    .filter((brush) => (brush.kind || 'solid') !== 'trigger')
    .map((brush) => quakeBrushToIbBox(brush, scale));
  const entities = neutral.entities.map((entity) => ({
    ...entity,
    origin: entity.origin ? quakeToIbPoint(entity.origin, scale) : null,
  }));
  const roomHints = entities
    .filter((entity) => entity.classname === 'info_room' && entity.origin)
    .map((entity) => ({
      id: entity.id,
      label: entity.label || entity.id,
      role: entity.role || 'room',
      origin: entity.origin,
      tags: entity.tags || [],
    }));
  const secretHints = entities.filter((entity) => /secret/i.test(entity.classname || '') || (entity.tags || []).includes('secret'));
  const gateBrushes = solids.filter((solid) => tagsContain(solid, /gate|door|locked/i));
  const surfaces = solids
    .filter((solid) => !tagsContain(solid, /wall|ceiling|bar|gate|door/i))
    .map((solid, index) => ({
      id: `surface_${index}_${solid.id}`,
      sourceBrushId: solid.id,
      roomId: null,
      y: solid.max[1],
      bounds: {
        min: [solid.min[0], solid.max[1], solid.min[2]],
        max: [solid.max[0], solid.max[1], solid.max[2]],
      },
      size: [solid.max[0] - solid.min[0], solid.max[2] - solid.min[2]],
      tags: solid.tags,
    }))
    .filter((surface) => surface.size[0] >= 0.75 && surface.size[1] >= 0.75)
    .filter((surface) => hasHeadroom(surface, solids));

  for (const surface of surfaces) surface.roomId = nearestRoomId(surface, roomHints);

  const roomsById = new Map();
  for (const surface of surfaces) {
    const hint = roomHints.find((room) => room.id === surface.roomId);
    if (!roomsById.has(surface.roomId)) {
      roomsById.set(surface.roomId, {
        id: surface.roomId,
        label: hint?.label || surface.roomId,
        role: hint?.role || 'room',
        surfaces: [],
        bounds: null,
        center: hint?.origin || boxCenter(surface.bounds),
        tags: hint?.tags || [],
      });
    }
    roomsById.get(surface.roomId).surfaces.push(surface.id);
  }

  const rooms = [...roomsById.values()];
  for (const room of rooms) {
    const roomSurfaces = surfaces.filter((surface) => surface.roomId === room.id);
    room.bounds = {
      min: [
        Math.min(...roomSurfaces.map((surface) => surface.bounds.min[0])),
        Math.min(...roomSurfaces.map((surface) => surface.y)),
        Math.min(...roomSurfaces.map((surface) => surface.bounds.min[2])),
      ],
      max: [
        Math.max(...roomSurfaces.map((surface) => surface.bounds.max[0])),
        Math.max(...roomSurfaces.map((surface) => surface.y)),
        Math.max(...roomSurfaces.map((surface) => surface.bounds.max[2])),
      ],
    };
  }

  const surfaceEdges = [];
  for (let i = 0; i < surfaces.length; i += 1) {
    for (let j = i + 1; j < surfaces.length; j += 1) {
      const kind = classifyEdge(surfaces[i], surfaces[j], gateBrushes);
      if (!kind) continue;
      surfaceEdges.push({
        fromSurface: surfaces[i].id,
        toSurface: surfaces[j].id,
        fromRoom: surfaces[i].roomId,
        toRoom: surfaces[j].roomId,
        kind,
      });
    }
  }

  const roomEdgeKeys = new Set();
  const roomEdges = [];
  const addRoomEdge = (from, to, kind, routeRole = 'route') => {
    if (!from || !to || from === to) return;
    const key = [from, to, kind].sort().join('|');
    if (roomEdgeKeys.has(key)) return;
    roomEdgeKeys.add(key);
    roomEdges.push({ from, to, kind, routeRole });
  };
  for (const edge of surfaceEdges) {
    if (edge.fromRoom === edge.toRoom) continue;
    addRoomEdge(
      edge.fromRoom,
      edge.toRoom,
      edge.kind,
      edge.kind === 'locked_gate' ? 'blocked_goal' : (edge.kind === 'ledge' ? 'side_or_secret_candidate' : 'route'),
    );
  }

  for (const gate of gateBrushes) {
    const gateCenter = boxCenter(gate);
    const ranked = rooms
      .map((room) => ({ room, score: pointDistance2(room.center, gateCenter) }))
      .sort((a, b) => a.score - b.score);
    if (ranked.length >= 2) {
      addRoomEdge(
        ranked[0].room.id,
        ranked[1].room.id,
        tagsContain(gate, /locked/i) ? 'locked_gate' : 'gate',
        tagsContain(gate, /locked/i) ? 'blocked_goal' : 'route',
      );
    }
  }

  const components = connectedComponents(rooms, roomEdges);
  const loopbacks = [];
  for (const component of components) {
    if (graphHasCycle(component, roomEdges)) loopbacks.push({ rooms: component, kind: 'cycle' });
  }

  const sidePathCandidates = rooms
    .filter((room) => room.role === 'side' || room.role === 'secret' || room.tags.includes('side') || room.tags.includes('secret'))
    .map((room) => ({ roomId: room.id, kind: room.role === 'secret' || room.tags.includes('secret') ? 'secret' : 'side' }));
  for (const hint of secretHints) {
    if (!hint.origin) continue;
    let best = rooms[0];
    let bestScore = Infinity;
    for (const room of rooms) {
      const score = pointDistance2(hint.origin, room.center);
      if (score < bestScore) {
        best = room;
        bestScore = score;
      }
    }
    if (best && !sidePathCandidates.some((candidate) => candidate.roomId === best.id && candidate.kind === 'secret')) {
      sidePathCandidates.push({ roomId: best.id, kind: 'secret' });
    }
  }

  return {
    source: {
      id: neutral.id || 'unknown',
      schema: neutral.schema || 'neutral_quake_geometry.v1',
      copyrightBoundary: 'synthetic_or_local_analysis_only_no_shipped_quake_content',
      scale,
    },
    solids,
    rooms,
    walkableSurfaces: surfaces,
    surfaceEdges,
    roomGraph: {
      nodes: rooms.map((room) => ({
        id: room.id,
        label: room.label,
        role: room.role,
        center: room.center,
        bounds: room.bounds,
      })),
      edges: roomEdges,
      loopbacks,
      sidePathCandidates,
    },
    stairs: surfaceEdges
      .filter((edge) => edge.kind === 'stair_step')
      .map((edge) => ({ fromSurface: edge.fromSurface, toSurface: edge.toSurface })),
    ledges: surfaceEdges
      .filter((edge) => edge.kind === 'ledge')
      .map((edge) => ({ fromSurface: edge.fromSurface, toSurface: edge.toSurface })),
    gates: gateBrushes.map((gate) => ({
      id: gate.id,
      locked: tagsContain(gate, /locked/i),
      center: boxCenter(gate),
      size: boxSize(gate),
    })),
  };
}
