import * as THREE from 'three';

export function createPlayerClimbApi(deps) {
  const {
    player,
    input,
    solidColliders,
    climbSurfaces,
    cameraForwardYaw,
    faceYawFromNormal,
    canStandOnClimbSurfaceTop,
    canStandOnSolidTop,
    findMantleTopSupport,
    clamp,
    makeVec,
    constants,
  } = deps;
  const {
    PLAYER_EYE_HEIGHT,
    PLAYER_SOLID_RADIUS,
    CLIMB_MIN_HEIGHT,
    CLIMB_MIN_TOP_SIZE,
    CLIMB_ATTACH_DISTANCE,
    CLIMB_TOP_OUT_THRESHOLD,
    CLIMB_FACE_OFFSET,
    CLIMB_MANTLE_DURATION,
    CLIMB_MANTLE_FORWARD,
    CLIMB_SPEED_HORIZONTAL,
    CLIMB_SPEED_VERTICAL,
    CLIMB_TERRAIN_LATERAL_SPAN,
    CLIMB_TERRAIN_VERTICAL_SPAN,
  } = constants;

function normalizedHorizontalNormal(value) {
  if (!value) return null;
  const normal = makeVec(value.x || 0, 0, value.z || 0);
  if (normal.lengthSq() < 0.0001) return null;
  normal.normalize();
  return normal;
}

function terrainPoint(value) {
  if (!value) return null;
  return makeVec(value.x || 0, value.y || 0, value.z || 0);
}

function enterTerrainClimb(contact, normal, point, faceDot) {
  const right = new THREE.Vector3(-normal.z, 0, normal.x);
  const span = Math.max(1.8, CLIMB_TERRAIN_LATERAL_SPAN || 3.2);
  const verticalSpan = Math.max(2.4, CLIMB_TERRAIN_VERTICAL_SPAN || 3.2);
  const relX = player.position.x - point.x;
  const relZ = player.position.z - point.z;
  const lateral = clamp(relX * right.x + relZ * right.z, -span * 0.5, span * 0.5);
  player.mode = 'climb';
  player.climb = {
    kind: 'terrain',
    source: contact.source || '',
    terrainKind: contact.kind || '',
    center: point.clone(),
    normal: normal.clone(),
    right,
    minLateral: -span * 0.5,
    maxLateral: span * 0.5,
    minY: player.position.y - 1.1,
    maxY: player.position.y + verticalSpan,
    topY: player.position.y - PLAYER_EYE_HEIGHT + 1.15,
    attachFaceDot: faceDot,
  };
  player.mantle = null;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.runCharge = 0;
  player.isRunning = false;
  player.lastRunIntent = false;
  player.attack = null;
  player.attackTimer = 0;
  player.position.x = point.x + normal.x * CLIMB_FACE_OFFSET + right.x * lateral;
  player.position.z = point.z + normal.z * CLIMB_FACE_OFFSET + right.z * lateral;
  player.yaw = faceYawFromNormal(normal.clone().multiplyScalar(-1));
  return true;
}

function tryBeginClimb(attachForward = true, wallContacts = []) {
  if (player.climbRegrabUntil && performance.now() < player.climbRegrabUntil) return false;
  if (player.mode === 'climb' || player.mode === 'mantle') return false;
  if (player.attack) return false;
  const chestY = player.position.y - PLAYER_EYE_HEIGHT + 1.1;
  const facing = cameraForwardYaw(player.yaw).normalize();
  let best = null;
  let bestScore = Infinity;
  const candidateFaces = [];
  for (const solid of solidColliders) {
    if (solid.sizeY < CLIMB_MIN_HEIGHT) continue;
    if (Math.max(solid.sizeX, solid.sizeZ) < CLIMB_MIN_TOP_SIZE) continue;
    candidateFaces.push(
      { axis: 'x', plane: solid.minX, normal: makeVec(-1, 0, 0), rangeA: [solid.minZ, solid.maxZ] },
      { axis: 'x', plane: solid.maxX, normal: makeVec(1, 0, 0), rangeA: [solid.minZ, solid.maxZ] },
      { axis: 'z', plane: solid.minZ, normal: makeVec(0, 0, -1), rangeA: [solid.minX, solid.maxX] },
      { axis: 'z', plane: solid.maxZ, normal: makeVec(0, 0, 1), rangeA: [solid.minX, solid.maxX] },
    );
    for (const face of candidateFaces.splice(0)) {
      const towardWall = face.normal.clone().multiplyScalar(-1);
      const faceDot = facing.dot(towardWall);
      if (attachForward && faceDot < 0.38) continue;
      const distance = face.axis === 'x' ? Math.abs(player.position.x - face.plane) : Math.abs(player.position.z - face.plane);
      if (distance > CLIMB_ATTACH_DISTANCE) continue;
      const lateral = face.axis === 'x' ? player.position.z : player.position.x;
      if (lateral < face.rangeA[0] - PLAYER_SOLID_RADIUS || lateral > face.rangeA[1] + PLAYER_SOLID_RADIUS) continue;
      if (chestY < solid.minY + 0.2 || chestY > solid.maxY + 0.65) continue;
      const score = distance - faceDot * 0.15 + Math.abs(chestY - clamp(chestY, solid.minY + 0.45, solid.maxY - 0.2)) * 0.05;
      if (score < bestScore) {
        bestScore = score;
        best = { kind: 'solid', solid, face };
      }
    }
  }
  for (const surface of climbSurfaces) {
    const towardWall = surface.normal.clone().multiplyScalar(-1);
    const faceDot = facing.dot(towardWall);
    if (attachForward && faceDot < 0.34) continue;
    const relX = player.position.x - surface.center.x;
    const relZ = player.position.z - surface.center.z;
    const distance = Math.abs(relX * surface.normal.x + relZ * surface.normal.z);
    if (distance > surface.attachDistance) continue;
    const lateral = relX * surface.right.x + relZ * surface.right.z;
    if (lateral < -surface.width * 0.5 - PLAYER_SOLID_RADIUS || lateral > surface.width * 0.5 + PLAYER_SOLID_RADIUS) continue;
    if (chestY < surface.baseY + 0.2 || chestY > surface.topY + 0.65) continue;
    const score = distance - faceDot * 0.14 + Math.abs(chestY - clamp(chestY, surface.baseY + 0.5, surface.topY - 0.12)) * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = { kind: 'surface', surface, lateral };
    }
  }
  for (const contact of wallContacts || []) {
    if (!contact?.isWall) continue;
    const normal = normalizedHorizontalNormal(contact.normal);
    const point = terrainPoint(contact.point);
    if (!normal || !point) continue;
    const towardWall = normal.clone().multiplyScalar(-1);
    const faceDot = facing.dot(towardWall);
    if (attachForward && faceDot < 0.18) continue;
    if (chestY < point.y - 1.4 || chestY > point.y + 2.35) continue;
    const relX = player.position.x - point.x;
    const relZ = player.position.z - point.z;
    const distance = Math.abs(relX * normal.x + relZ * normal.z);
    if (distance > CLIMB_ATTACH_DISTANCE + 0.34) continue;
    const terrainBias = /terrain|voxel|carved|island|bridge/.test(String(contact.kind || contact.source || '')) ? -0.08 : 0;
    const score = distance - faceDot * 0.18 + Math.abs(chestY - point.y) * 0.04 + terrainBias;
    if (score < bestScore) {
      bestScore = score;
      best = { kind: 'terrain', contact, normal, point, faceDot };
    }
  }
  if (!best) return false;
  if (best.kind === 'terrain') {
    return enterTerrainClimb(best.contact, best.normal, best.point, best.faceDot);
  }
  if (best.kind === 'surface') {
    const surface = best.surface;
    const right = surface.right.clone();
    const lateral = clamp(best.lateral, -surface.width * 0.5 + PLAYER_SOLID_RADIUS * 0.2, surface.width * 0.5 - PLAYER_SOLID_RADIUS * 0.2);
    const hangY = clamp(player.position.y, surface.baseY + 0.4 + PLAYER_EYE_HEIGHT, surface.topY - 0.12 + PLAYER_EYE_HEIGHT);
    player.mode = 'climb';
    player.climb = {
      kind: 'surface',
      surface,
      center: surface.center.clone(),
      normal: surface.normal.clone(),
      right,
      minLateral: -surface.width * 0.5 + PLAYER_SOLID_RADIUS * 0.2,
      maxLateral: surface.width * 0.5 - PLAYER_SOLID_RADIUS * 0.2,
      minY: surface.baseY + 0.12 + PLAYER_EYE_HEIGHT,
      maxY: surface.topY - CLIMB_TOP_OUT_THRESHOLD + PLAYER_EYE_HEIGHT,
      topCenter: surface.topCenter.clone(),
      topWidth: surface.topWidth,
      topDepth: surface.topDepth,
      topY: surface.topY,
    };
    player.mantle = null;
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    player.runCharge = 0;
    player.isRunning = false;
    player.lastRunIntent = false;
    player.attack = null;
    player.attackTimer = 0;
    player.position.x = surface.center.x + surface.normal.x * CLIMB_FACE_OFFSET + right.x * lateral;
    player.position.z = surface.center.z + surface.normal.z * CLIMB_FACE_OFFSET + right.z * lateral;
    player.position.y = hangY;
    player.yaw = faceYawFromNormal(surface.normal.clone().multiplyScalar(-1));
    return true;
  }
  const { solid, face } = best;
  const right = new THREE.Vector3(-face.normal.z, 0, face.normal.x);
  const hangY = clamp(player.position.y, solid.minY + 0.4 + PLAYER_EYE_HEIGHT, solid.maxY - 0.12 + PLAYER_EYE_HEIGHT);
  const lateral = face.axis === 'x'
    ? clamp(player.position.z, solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS)
    : clamp(player.position.x, solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS);
  player.mode = 'climb';
  player.climb = {
    kind: 'solid',
    solid,
    normal: face.normal.clone(),
    right,
    planeAxis: face.axis,
    plane: face.plane,
    minLateral: face.rangeA[0] + PLAYER_SOLID_RADIUS,
    maxLateral: face.rangeA[1] - PLAYER_SOLID_RADIUS,
    minY: solid.minY + 0.12 + PLAYER_EYE_HEIGHT,
    maxY: solid.maxY - CLIMB_TOP_OUT_THRESHOLD + PLAYER_EYE_HEIGHT,
  };
  player.mantle = null;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.runCharge = 0;
  player.isRunning = false;
  player.lastRunIntent = false;
  player.attack = null;
  player.attackTimer = 0;
  if (face.axis === 'x') {
    player.position.x = face.plane + face.normal.x * CLIMB_FACE_OFFSET;
    player.position.z = lateral;
  } else {
    player.position.z = face.plane + face.normal.z * CLIMB_FACE_OFFSET;
    player.position.x = lateral;
  }
  player.position.y = hangY;
  player.yaw = faceYawFromNormal(face.normal.clone().multiplyScalar(-1));
  return true;
}

function startMantleFromClimb() {
  const climb = player.climb;
  if (!climb) return false;
  if (climb.kind === 'terrain') {
    const relX = player.position.x - climb.center.x;
    const relZ = player.position.z - climb.center.z;
    const lateral = clamp(relX * climb.right.x + relZ * climb.right.z, climb.minLateral, climb.maxLateral);
    const feetY = player.position.y - PLAYER_EYE_HEIGHT;
    const targetTopY = feetY + 1.05;
    const inward = climb.normal.clone().multiplyScalar(-1);
    const candidates = [
      player.position.clone().addScaledVector(inward, CLIMB_MANTLE_FORWARD + PLAYER_SOLID_RADIUS * 0.55),
      player.position.clone().addScaledVector(inward, CLIMB_MANTLE_FORWARD + PLAYER_SOLID_RADIUS * 1.15).addScaledVector(climb.right, PLAYER_SOLID_RADIUS * 0.75),
      player.position.clone().addScaledVector(inward, CLIMB_MANTLE_FORWARD + PLAYER_SOLID_RADIUS * 1.15).addScaledVector(climb.right, -PLAYER_SOLID_RADIUS * 0.75),
      climb.center.clone().addScaledVector(climb.right, lateral).addScaledVector(inward, CLIMB_MANTLE_FORWARD + PLAYER_SOLID_RADIUS),
    ];
    let target = null;
    for (const candidate of candidates) {
      const support = findMantleTopSupport?.(candidate.x, candidate.z, targetTopY);
      if (support) {
        target = { x: candidate.x, z: candidate.z, topY: support.topY };
        break;
      }
    }
    if (!target) return false;
    player.mode = 'mantle';
    player.mantle = {
      start: player.position.clone(),
      end: makeVec(target.x, target.topY + PLAYER_EYE_HEIGHT, target.z),
      elapsed: 0,
      duration: CLIMB_MANTLE_DURATION,
      faceYaw: player.yaw,
    };
    player.climb = null;
    player.velocity.set(0, 0, 0);
    return true;
  }
  if (climb.kind === 'surface') {
    const relX = player.position.x - climb.center.x;
    const relZ = player.position.z - climb.center.z;
    const lateral = clamp(relX * climb.right.x + relZ * climb.right.z, -climb.topWidth * 0.5 + PLAYER_SOLID_RADIUS, climb.topWidth * 0.5 - PLAYER_SOLID_RADIUS);
    const candidates = [
      climb.topCenter.clone().addScaledVector(climb.right, lateral),
      climb.topCenter.clone().addScaledVector(climb.right, lateral + PLAYER_SOLID_RADIUS * 0.55),
      climb.topCenter.clone().addScaledVector(climb.right, lateral - PLAYER_SOLID_RADIUS * 0.55),
      climb.topCenter.clone().addScaledVector(climb.right, lateral).addScaledVector(climb.normal, -PLAYER_SOLID_RADIUS * 0.65),
    ];
    let target = null;
    for (const candidate of candidates) {
      if (!canStandOnClimbSurfaceTop(climb, candidate.x, candidate.z)) continue;
      const support = findMantleTopSupport?.(candidate.x, candidate.z, climb.topY);
      target = {
        x: candidate.x,
        z: candidate.z,
        topY: support?.topY ?? climb.topY,
      };
      break;
    }
    if (!target) return false;
    player.mode = 'mantle';
    player.mantle = {
      start: player.position.clone(),
      end: makeVec(target.x, target.topY + PLAYER_EYE_HEIGHT, target.z),
      elapsed: 0,
      duration: CLIMB_MANTLE_DURATION,
      faceYaw: player.yaw,
    };
    player.climb = null;
    player.velocity.set(0, 0, 0);
    return true;
  }
  const solid = climb.solid;
  const topX = climb.planeAxis === 'x'
    ? solid.centerX
    : clamp(player.position.x + climb.normal.x * CLIMB_MANTLE_FORWARD, solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS);
  const topZ = climb.planeAxis === 'z'
    ? solid.centerZ
    : clamp(player.position.z + climb.normal.z * CLIMB_MANTLE_FORWARD, solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS);
  const endX = climb.planeAxis === 'x'
    ? clamp(climb.plane + climb.normal.x * (PLAYER_SOLID_RADIUS + CLIMB_MANTLE_FORWARD), solid.minX + PLAYER_SOLID_RADIUS, solid.maxX - PLAYER_SOLID_RADIUS)
    : topX;
  const endZ = climb.planeAxis === 'z'
    ? clamp(climb.plane + climb.normal.z * (PLAYER_SOLID_RADIUS + CLIMB_MANTLE_FORWARD), solid.minZ + PLAYER_SOLID_RADIUS, solid.maxZ - PLAYER_SOLID_RADIUS)
    : topZ;
  const supportCandidates = [
    [endX, endZ],
    [endX - climb.normal.x * PLAYER_SOLID_RADIUS * 0.9, endZ - climb.normal.z * PLAYER_SOLID_RADIUS * 0.9],
    [endX + climb.right.x * PLAYER_SOLID_RADIUS * 0.8, endZ + climb.right.z * PLAYER_SOLID_RADIUS * 0.8],
    [endX - climb.right.x * PLAYER_SOLID_RADIUS * 0.8, endZ - climb.right.z * PLAYER_SOLID_RADIUS * 0.8],
  ];
  let target = null;
  for (const [x, z] of supportCandidates) {
    if (canStandOnSolidTop(solid, x, z)) {
      target = { x, z, topY: solid.maxY };
      break;
    }
    const support = findMantleTopSupport?.(x, z, solid.maxY);
    if (support) {
      target = { x, z, topY: support.topY };
      break;
    }
  }
  if (!target) target = { x: endX, z: endZ, topY: solid.maxY };
  player.mode = 'mantle';
  player.mantle = {
    start: player.position.clone(),
    end: makeVec(target.x, target.topY + PLAYER_EYE_HEIGHT, target.z),
    elapsed: 0,
    duration: CLIMB_MANTLE_DURATION,
    faceYaw: player.yaw,
  };
  player.climb = null;
  player.velocity.set(0, 0, 0);
  return true;
}

function updatePlayerClimb(dt, moveX, moveY) {
  const climb = player.climb;
  if (!climb) {
    player.mode = 'air';
    return;
  }
  const lateralDelta = moveX * CLIMB_SPEED_HORIZONTAL * dt;
  const verticalDelta = moveY * CLIMB_SPEED_VERTICAL * dt;
  if (climb.kind === 'surface') {
    const relX = player.position.x - climb.center.x;
    const relZ = player.position.z - climb.center.z;
    let lateral = relX * climb.right.x + relZ * climb.right.z;
    lateral = clamp(lateral + lateralDelta, climb.minLateral, climb.maxLateral);
    const nextY = clamp(player.position.y + verticalDelta, climb.minY, climb.maxY + 0.28);
    player.position.x = climb.center.x + climb.normal.x * CLIMB_FACE_OFFSET + climb.right.x * lateral;
    player.position.z = climb.center.z + climb.normal.z * CLIMB_FACE_OFFSET + climb.right.z * lateral;
    player.position.y = nextY;
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    player.yaw = faceYawFromNormal(climb.normal.clone().multiplyScalar(-1));
    if (moveY > 0.18 && player.position.y >= climb.maxY - 0.02) startMantleFromClimb();
    else if (moveY < -0.45 && player.position.y <= climb.minY + 0.02) {
      player.mode = 'air';
      player.climb = null;
    }
    return;
  }
  if (climb.kind === 'terrain') {
    const relX = player.position.x - climb.center.x;
    const relZ = player.position.z - climb.center.z;
    let lateral = relX * climb.right.x + relZ * climb.right.z;
    lateral = clamp(lateral + lateralDelta, climb.minLateral, climb.maxLateral);
    const nextY = clamp(player.position.y + verticalDelta, climb.minY, climb.maxY + 0.28);
    player.position.x = climb.center.x + climb.normal.x * CLIMB_FACE_OFFSET + climb.right.x * lateral;
    player.position.z = climb.center.z + climb.normal.z * CLIMB_FACE_OFFSET + climb.right.z * lateral;
    player.position.y = nextY;
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    player.yaw = faceYawFromNormal(climb.normal.clone().multiplyScalar(-1));
    if (moveY > 0.18 && player.position.y >= climb.maxY - 0.02) startMantleFromClimb();
    else if (moveY < -0.45 && player.position.y <= climb.minY + 0.02) {
      player.mode = 'air';
      player.climb = null;
    }
    return;
  }
  let lateral = climb.planeAxis === 'x' ? player.position.z : player.position.x;
  lateral = clamp(lateral + lateralDelta, climb.minLateral, climb.maxLateral);
  const nextY = clamp(player.position.y + verticalDelta, climb.minY, climb.maxY + 0.28);
  if (climb.planeAxis === 'x') {
    player.position.x = climb.plane + climb.normal.x * CLIMB_FACE_OFFSET;
    player.position.z = lateral;
  } else {
    player.position.z = climb.plane + climb.normal.z * CLIMB_FACE_OFFSET;
    player.position.x = lateral;
  }
  player.position.y = nextY;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.yaw = faceYawFromNormal(climb.normal.clone().multiplyScalar(-1));
  if (moveY > 0.18 && player.position.y >= climb.maxY - 0.02) startMantleFromClimb();
  else if (moveY < -0.45 && player.position.y <= climb.minY + 0.02) {
    player.mode = 'air';
    player.climb = null;
  }
}

function updatePlayerMantle(dt) {
  const mantle = player.mantle;
  if (!mantle) {
    player.mode = 'ground';
    return;
  }
  mantle.elapsed = Math.min(mantle.duration, mantle.elapsed + dt);
  const t = clamp(mantle.elapsed / mantle.duration, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const lift = Math.sin(Math.PI * eased) * 0.18;
  player.position.lerpVectors(mantle.start, mantle.end, eased);
  player.position.y += lift;
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.yaw = mantle.faceYaw;
  if (t >= 1) {
    player.position.copy(mantle.end);
    player.mode = 'ground';
    player.mantle = null;
    player.grounded = true;
  }
}

  return { tryBeginClimb, startMantleFromClimb, updatePlayerClimb, updatePlayerMantle };
}
