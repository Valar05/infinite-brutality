import * as THREE from 'three';

export function createEnemyCombatApi(deps) {
  const {
    runtime: enemyRuntime,
    getEnemy,
    player,
    input,
    attackDebug,
    getHurtAction,
    cameraAimDirection,
    fallbackEnemyHitBox,
    findBoneByAliases,
    clamp,
    makeVec,
    isEnemyCorpseActive,
    getEnemyNavState,
    enemyCombatGoalPoint,
    findNearestGauntletRoomIndex,
    clearEnemyRoute,
    rebuildEnemyRoute,
    advanceEnemyJump,
    findEnemySupport,
    enemyHasDirectCombatPath,
    shiftEnemyRouteWaypoint,
    sampleEnemyMoveSupport,
    enemyCanJumpBetween,
    startEnemyJump,
    applyEnemyMove,
    setEnemyMode,
    spawnEnemyAttackSweepDebug,
    updateEnemyRagdollDeath,
    despawnEnemyCorpse,
    startEnemyDeath,
    triggerHitJuice,
    setStatus,
    playArmAction,
    playThud,
    constants,
  } = deps;
  const {
    ENEMY_ATTACK_DEFS,
    ENEMY_ATTACK_RECOVERY,
    ENEMY_ATTACK_WINDUP,
    ENEMY_ATTACK_ACTIVE_END,
    ENEMY_ATTACK_COOLDOWN,
    ENEMY_ATTACK_RANGE,
    ENEMY_LUNGE_SPEED,
    ENEMY_RETREAT_DURATION,
    ENEMY_RETREAT_SPEED,
    ENEMY_RUN_SPEED,
    ENEMY_WALK_SPEED,
    ENEMY_SIDESTEP_SPEED,
    ENEMY_RING_RADIUS,
    ENEMY_RING_TOLERANCE,
    ENEMY_COMMIT_TIMEOUT,
    ENEMY_NAV_REPATH_INTERVAL,
    ENEMY_NAV_STALL_LIMIT,
    ENEMY_STEP_UP,
    ENEMY_STEP_DOWN,
    ENEMY_AI_SLEEP_DISTANCE,
    ENEMY_AI_WAKE_DISTANCE,
    ENEMY_AI_SLEEP_ROOM_DELTA,
    ENEMY_AI_WAKE_ROOM_DELTA,
    ENEMY_HIT_HEAD_SIDE_THRESHOLD,
    ENEMY_HIT_HEAD_NORMALIZED_Y,
    PLAYER_EYE_HEIGHT,
    PLAYER_SOLID_RADIUS,
    PLAYER_MAX_HEALTH,
    ATTACK_LAB,
  } = constants;

function chooseEnemyHitReaction(attack) {
  const enemy = getEnemy();
  const aim = cameraAimDirection();
  const targetRoot = enemyRuntime.model || enemy;
  const hitBox = enemy?.userData?.hitBox || fallbackEnemyHitBox();
  const horizontalAim = Math.hypot(aim.x, aim.z);
  const centerLocal = hitBox.getCenter(new THREE.Vector3());
  const centerWorld = targetRoot.localToWorld(centerLocal.clone());
  const horizontalDistance = Math.hypot(centerWorld.x - player.position.x, centerWorld.z - player.position.z);
  const travel = horizontalDistance / Math.max(0.001, horizontalAim);
  const impact = player.position.clone().addScaledVector(aim, travel);
  const unclampedLocalImpact = targetRoot.worldToLocal(impact.clone());
  const clampedLocalImpact = unclampedLocalImpact.clone().clamp(hitBox.min, hitBox.max);
  const size = hitBox.getSize(new THREE.Vector3());
  const normalizedX = size.x > 0.001 ? (clampedLocalImpact.x - hitBox.min.x) / size.x : 0.5;
  const normalizedY = size.y > 0.001 ? (clampedLocalImpact.y - hitBox.min.y) / size.y : 0.5;
  const centeredX = normalizedX - 0.5;
  const zone = normalizedY >= ENEMY_HIT_HEAD_NORMALIZED_Y ? 'head' : 'body';
  let name = 'reactBodyCenter';
  if (zone === 'head') name = centeredX <= -ENEMY_HIT_HEAD_SIDE_THRESHOLD ? 'reactHeadLeft' : 'reactHeadRight';
  return {
    name,
    zone,
    worldImpact: targetRoot.localToWorld(clampedLocalImpact.clone()),
    localX: clampedLocalImpact.x,
    localY: clampedLocalImpact.y,
    normalizedX,
    normalizedY,
    centeredX,
    aim: aim.clone(),
    attackName: attack?.def?.name || '',
  };
}

function playEnemyAction(name, fade = 0.16, options = {}) {
  if (isEnemyCorpseActive()) return;
  const next = enemyRuntime.actions.get(name) || enemyRuntime.actions.get('idle');
  if (!next) return;
  const restart = !!options.restart;
  if (next === enemyRuntime.currentAction && !restart) return;
  if (enemyRuntime.currentAction && enemyRuntime.currentAction !== next) enemyRuntime.currentAction.fadeOut(fade);
  next.reset().fadeIn(fade).play();
  enemyRuntime.currentAction = next;
}

function updateEnemyMixer(dt) {
  const enemy = getEnemy();
  if (!enemyRuntime.mixer || enemy?.userData?.dead || enemy?.userData?.suppressEnemyMixer || isEnemyCorpseActive()) return;
  enemyRuntime.mixer.update(dt);
  if (!enemy?.userData?.dead && enemyRuntime.currentAction) {
    const clipName = enemyRuntime.currentAction.getClip().name;
    const oneShotReturns = ['jumping', 'react'];
    if (oneShotReturns.includes(clipName) && enemyRuntime.currentAction.time >= enemyRuntime.currentAction.getClip().duration - 0.05) {
      playEnemyAction('idle', 0.12);
      return;
    }
  }
  if (!enemyRuntime.currentAction) {
    const idle = enemyRuntime.actions.get('idle');
    if (idle) {
      idle.reset().fadeIn(0.01).play();
      enemyRuntime.currentAction = idle;
    }
  }
}

function getEnemyAttackDefinition(name, clipDuration = ENEMY_ATTACK_RECOVERY) {
  const source = ENEMY_ATTACK_DEFS[name];
  if (!source) {
    return {
      name,
      handAliases: [],
      activeStart: ENEMY_ATTACK_WINDUP,
      activeEnd: ENEMY_ATTACK_ACTIVE_END,
      lungeStart: 0,
      lungeEnd: Math.min(0.1, clipDuration),
      sweepHalfExtents: new THREE.Vector3(0.16, 0.16, 0.12),
      sweepRangePadding: 0.3,
      damage: 1,
      knockback: 1.65,
      fallbackOffset: new THREE.Vector3(0.72, 1.18, 0),
      clipDuration: clipDuration,
    };
  }
  const duration = Math.max(0.001, clipDuration || ENEMY_ATTACK_RECOVERY);
  const activeStart = source.activeStartTime !== undefined
    ? clamp(source.activeStartTime, 0, duration)
    : clamp(duration * source.activeStartNorm, 0, duration);
  const activeEnd = source.activeEndTime !== undefined
    ? clamp(source.activeEndTime, activeStart, duration)
    : (source.activeEndNorm !== undefined
      ? clamp(duration * source.activeEndNorm, activeStart, duration)
      : clamp(activeStart + source.activeDuration, activeStart, duration));
  const lungeStart = source.lungeStartNorm !== undefined ? clamp(duration * source.lungeStartNorm, 0, duration) : Math.max(0, activeStart - (source.lungeLead || 0));
  const lungeEnd = source.lungeDuration !== undefined ? clamp(lungeStart + source.lungeDuration, lungeStart, duration) : activeEnd;
  return {
    name,
    handAliases: [...(source.handAliases || [])],
    activeStart,
    activeEnd,
    lungeStart,
    lungeEnd,
    sweepHalfExtents: source.sweepHalfExtents ? source.sweepHalfExtents.clone() : new THREE.Vector3(0.16, 0.16, 0.12),
    sweepRangePadding: source.sweepRangePadding ?? 0.3,
    damage: source.damage ?? 1,
    knockback: source.knockback ?? 1.65,
    fallbackOffset: source.fallbackOffset ? source.fallbackOffset.clone() : new THREE.Vector3(0.72, 1.18, 0),
    clipDuration: duration,
  };
}

function resolveEnemyAttackHandBone(attackDef) {
  const enemy = getEnemy();
  if (!enemy || !attackDef) return null;
  enemy.userData.attackBones = enemy.userData.attackBones || {};
  const cached = enemy.userData.attackBones[attackDef.name];
  if (cached?.parent) return cached;
  const bone = findBoneByAliases(enemyRuntime.model || enemy, attackDef.handAliases || []);
  if (bone) enemy.userData.attackBones[attackDef.name] = bone;
  return bone;
}

function sampleEnemyAttackHandWorld(attackDef, target = new THREE.Vector3()) {
  const enemy = getEnemy();
  const bone = resolveEnemyAttackHandBone(attackDef);
  if (bone) return bone.getWorldPosition(target);
  target.copy(attackDef?.fallbackOffset || new THREE.Vector3(0.72, 1.18, 0));
  return enemy.localToWorld(target);
}

function getPlayerDamageCapsule(targetA, targetB) {
  const feetY = player.position.y - PLAYER_EYE_HEIGHT;
  targetA.set(player.position.x, feetY + PLAYER_SOLID_RADIUS, player.position.z);
  targetB.set(player.position.x, player.position.y + 0.06, player.position.z);
  return PLAYER_SOLID_RADIUS;
}

function segmentSegmentDistanceSq(a0, a1, b0, b1) {
  const EPS = 1e-6;
  const u = a1.clone().sub(a0);
  const v = b1.clone().sub(b0);
  const w = a0.clone().sub(b0);
  const a = u.dot(u);
  const b = u.dot(v);
  const c = v.dot(v);
  const d = u.dot(w);
  const e = v.dot(w);
  const D = a * c - b * b;
  let sN, sD = D;
  let tN, tD = D;
  if (D < EPS) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = (b * e - c * d);
    tN = (a * e - b * d);
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }
  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if ((-d + b) < 0) sN = 0;
    else if ((-d + b) > a) sN = sD;
    else {
      sN = (-d + b);
      sD = a;
    }
  }
  const sc = Math.abs(sN) < EPS ? 0 : sN / sD;
  const tc = Math.abs(tN) < EPS ? 0 : tN / tD;
  const dP = w.add(u.multiplyScalar(sc)).sub(v.multiplyScalar(tc));
  return dP.lengthSq();
}

function sweepEnemyAttackHitsPlayer(previousHand, currentHand, attackDef) {
  if (!previousHand || !currentHand || !attackDef) return { hit: false, reason: 'invalid' };
  const center = previousHand.clone().add(currentHand).multiplyScalar(0.5);
  const horizontalDistance = Math.hypot(center.x - player.position.x, center.z - player.position.z);
  const travelLength = previousHand.distanceTo(currentHand);
  const capsuleStart = new THREE.Vector3();
  const capsuleEnd = new THREE.Vector3();
  const playerRadius = getPlayerDamageCapsule(capsuleStart, capsuleEnd);
  const sweepRadius = Math.max(attackDef.sweepHalfExtents.x, attackDef.sweepHalfExtents.y);
  const distanceSq = segmentSegmentDistanceSq(previousHand, currentHand, capsuleStart, capsuleEnd);
  const threshold = playerRadius + sweepRadius;
  const thresholdSq = threshold * threshold;
  if (distanceSq > thresholdSq) {
    return {
      hit: false,
      reason: 'distance',
      center,
      distanceSq,
      thresholdSq,
      horizontalDistance,
      handTravel: travelLength,
      sweepRadius,
    };
  }
  return {
    hit: true,
    reason: 'hit',
    center,
    distanceSq,
    thresholdSq,
    horizontalDistance,
    handTravel: travelLength,
    sweepRadius,
    direction: new THREE.Vector3(player.position.x - center.x, 0, player.position.z - center.z).normalize(),
  };
}

function applyEnemyAttackHit(attackDef, toPlayerDir, hit) {
  const hurtAction = getHurtAction?.() || null;
  const direction = hit?.direction?.lengthSq() ? hit.direction.clone() : toPlayerDir.clone();
  direction.y = 0;
  if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
  direction.normalize();
  const damage = attackDef?.damage || 1;
  player.healthPulse = 0.45;
  player.health = Math.max(0, (player.health ?? player.maxHealth ?? PLAYER_MAX_HEALTH) - damage);
  player.damageTaken = (player.damageTaken || 0) + damage;
  player.damageFlash = Math.min(1, Math.max(player.damageFlash || 0, 0.95));
  player.lastDamageAt = performance.now();
  player.attack = null;
  player.attackTimer = 0;
  player.hurtTimer = Math.max(0.18, hurtAction?.getClip?.().duration || 0.46);
  player.hurtRecoverTimer = 0;
  if (hurtAction) playArmAction(hurtAction, 0.03, true);
  player.velocity.addScaledVector(direction, attackDef?.knockback || 1.65);
  playThud(1.05);
}

function startEnemyAttack() {
  const enemy = getEnemy();
  if (!enemy || isEnemyCorpseActive() || enemy.userData.attackTimer > 0) return;
  const attackName = enemyRuntime.actions.has('attackHorizontal') ? 'attackHorizontal' : '';
  if (!attackName) {
    console.warn('enemy attack missing attackHorizontal; refusing fallback attack');
    return;
  }
  const clipDuration = enemyRuntime.actions.get(attackName)?.getClip?.().duration || ENEMY_ATTACK_RECOVERY;
  const attackDef = getEnemyAttackDefinition(attackName, clipDuration);
  enemy.userData.attackName = attackName;
  enemy.userData.attackDefKey = attackName;
  enemy.userData.attackDef = attackDef;
  enemy.userData.attackTimer = Math.max(clipDuration, ENEMY_ATTACK_RECOVERY);
  enemy.userData.attackElapsed = 0;
  enemy.userData.attackHitDone = false;
  enemy.userData.attackCurrentHand = sampleEnemyAttackHandWorld(attackDef);
  enemy.userData.attackPrevHand = enemy.userData.attackCurrentHand.clone();
  enemy.userData.attackContactPoint = null;
  playEnemyAction(attackName, 0.055, { restart: true });
}

function updateEnemyEngagement(dt) {
  const enemy = getEnemy();
  if (!enemy) return;
  enemy.userData.hitTimer = Math.max(0, enemy.userData.hitTimer - dt);
  enemy.userData.deathTimer = Math.max(0, enemy.userData.deathTimer || 0);
  const nav = getEnemyNavState();
  const baseY = Number.isFinite(enemy.userData.baseY) ? enemy.userData.baseY : enemy.position.y;
  if (!enemy.visible) return;
  if (enemy.userData.dead || isEnemyCorpseActive()) {
    enemy.scale.setScalar(1);
    updateEnemyRagdollDeath(dt);
    if (enemy.userData.deathTimer > 0) {
      enemy.userData.deathTimer = Math.max(0, enemy.userData.deathTimer - dt);
      if (enemy.userData.deathTimer <= 0) despawnEnemyCorpse();
    }
    return;
  }
  updateEnemyMixer(dt);
  enemy.position.y = baseY + Math.sin(performance.now() * 0.002) * 0.025;
  enemy.scale.setScalar(enemy.userData.hitTimer > 0 ? 1.08 : 1);

  const support = findEnemySupport(enemy.position.x, enemy.position.z, baseY, ENEMY_STEP_UP, ENEMY_STEP_DOWN);
  if (support) {
    enemy.userData.baseY = support.topY;
    if (nav) nav.lastValidSupport = makeVec(enemy.position.x, support.topY, enemy.position.z);
  }
  const previousGoal = nav?.goal ? nav.goal.clone() : null;
  const playerGoalY = player.grounded ? (player.position.y - PLAYER_EYE_HEIGHT) : (previousGoal?.y ?? (player.position.y - PLAYER_EYE_HEIGHT));
  const routeGoal = makeVec(player.position.x, playerGoalY, player.position.z);
  const playerFloorY = playerGoalY;
  const verticalGap = playerFloorY - enemy.userData.baseY;
  const directCombatGoal = enemyCombatGoalPoint();
  const toPlayer = player.position.clone().sub(enemy.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const toPlayerDir = dist > 0.001 ? toPlayer.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1);

  let playerRoomIndex = findNearestGauntletRoomIndex(player.position);
  let enemyRoomIndex = findNearestGauntletRoomIndex(enemy.position);
  if (nav) {
    nav.lastSeenPlayer = player.position.clone();
    nav.repathTimer = Math.max(0, nav.repathTimer - dt);
    if (nav.jump) {
      advanceEnemyJump(dt);
      return;
    }
    const roomDelta = (playerRoomIndex >= 0 && enemyRoomIndex >= 0)
      ? Math.abs(playerRoomIndex - enemyRoomIndex)
      : Number.POSITIVE_INFINITY;
    const shouldWake = dist <= ENEMY_AI_WAKE_DISTANCE || roomDelta <= ENEMY_AI_WAKE_ROOM_DELTA;
    const shouldSleep = dist >= ENEMY_AI_SLEEP_DISTANCE || roomDelta > ENEMY_AI_SLEEP_ROOM_DELTA;
    if (nav.asleep ? !shouldWake : shouldSleep) {
      if (!nav.asleep) {
        nav.asleep = true;
        clearEnemyRoute(nav);
      }
      nav.goal = null;
      nav.jump = null;
      nav.repathTimer = ENEMY_NAV_REPATH_INTERVAL;
      nav.stallCount = 0;
      enemy.userData.attackTimer = 0;
      enemy.userData.attackElapsed = 0;
      enemy.userData.attackHitDone = false;
      enemy.userData.attackName = '';
      enemy.userData.attackDefKey = '';
      enemy.userData.attackDef = null;
      enemy.userData.attackPrevHand = null;
      enemy.userData.attackCurrentHand = null;
      enemy.userData.attackContactPoint = null;
      enemy.userData.mode = 'hold';
      enemy.userData.modeTimer = 0;
      playEnemyAction('idle', 0.16);
      return;
    }
    if (nav.asleep) {
      nav.asleep = false;
      nav.repathTimer = 0;
      nav.lastEnemyRoomIndex = -1;
      nav.lastPlayerRoomIndex = -1;
    }
    nav.goal = routeGoal.clone();
    const goalChanged = !previousGoal || (player.grounded ? previousGoal.distanceToSquared(nav.goal) > 0.36 : ((previousGoal.x - nav.goal.x) ** 2 + (previousGoal.z - nav.goal.z) ** 2 > 0.36));
    const roomChanged = nav.lastEnemyRoomIndex !== enemyRoomIndex || nav.lastPlayerRoomIndex !== playerRoomIndex;
    const staleRoute = nav.waypoints.length === 0 || nav.repathTimer <= 0 || roomChanged || goalChanged;
    if (staleRoute) rebuildEnemyRoute(roomChanged || nav.waypoints.length === 0);
    nav.lastEnemyRoomIndex = enemyRoomIndex;
    nav.lastPlayerRoomIndex = playerRoomIndex;
  }
  enemy.rotation.y = Math.atan2(enemy.position.x - player.position.x, enemy.position.z - player.position.z);

  enemy.userData.attackCooldown = Math.max(0, (enemy.userData.attackCooldown || 0) - dt);
  enemy.userData.commitTimer = Math.max(0, (enemy.userData.commitTimer || 0) - dt);
  enemy.userData.modeTimer = Math.max(0, (enemy.userData.modeTimer || 0) - dt);
  if (enemy.userData.hitTimer > 0) return;

  if (enemy.userData.attackTimer > 0) {
    const attackDef = enemy.userData.attackDef || getEnemyAttackDefinition(enemy.userData.attackDefKey || enemy.userData.attackName || 'attackHorizontal', enemy.userData.attackTimer);
    enemy.userData.attackDef = attackDef;
    enemy.userData.attackElapsed += dt;
    enemy.userData.attackTimer = Math.max(0, enemy.userData.attackTimer - dt);
    enemy.updateMatrixWorld(true);
    const previousHand = enemy.userData.attackPrevHand ? enemy.userData.attackPrevHand.clone() : null;
    const preDashHand = sampleEnemyAttackHandWorld(attackDef);
    const preTravel = previousHand ? previousHand.distanceTo(preDashHand) : 0;
    if (enemy.userData.attackElapsed >= attackDef.lungeStart && enemy.userData.attackElapsed <= attackDef.lungeEnd) {
      applyEnemyMove(toPlayerDir, ENEMY_LUNGE_SPEED, dt);
    }
    enemy.updateMatrixWorld(true);
    const currentHand = sampleEnemyAttackHandWorld(attackDef);
    const postTravel = previousHand ? previousHand.distanceTo(currentHand) : 0;
    enemy.userData.attackCurrentHand = currentHand.clone();
    const attackActive = enemy.userData.attackElapsed >= attackDef.activeStart && enemy.userData.attackElapsed <= attackDef.activeEnd;
    let attackProbe = null;
    let attackHit = null;
    if (!enemy.userData.attackHitDone && attackActive && previousHand) {
      attackProbe = sweepEnemyAttackHitsPlayer(previousHand, currentHand, attackDef);
      if (attackProbe?.hit) {
        attackHit = attackProbe;
        enemy.userData.attackHitDone = true;
        enemy.userData.attackContactPoint = attackHit.center.clone();
        applyEnemyAttackHit(attackDef, toPlayerDir, attackHit);
      }
    }
    if (attackActive && previousHand) {
      spawnEnemyAttackSweepDebug(previousHand, preDashHand, attackDef, null, { color: 0xff6f91 });
      spawnEnemyAttackSweepDebug(previousHand, currentHand, attackDef, attackHit || attackProbe, { color: 0x6fffd5 });
    }
    if (DEBUG_ATTACK_SWEEP) {
      enemy.userData.attackDebug = {
        active: attackActive,
        hitDone: !!enemy.userData.attackHitDone,
        prev: previousHand ? previousHand.clone() : null,
        curr: currentHand.clone(),
        elapsed: enemy.userData.attackElapsed,
        total: attackDef.clipDuration || 0,
        activeStart: attackDef.activeStart,
        activeEnd: attackDef.activeEnd,
        lungeStart: attackDef.lungeStart,
        lungeEnd: attackDef.lungeEnd,
        distToPlayer: dist,
        contactPoint: enemy.userData.attackContactPoint ? enemy.userData.attackContactPoint.clone() : null,
        preHandTravel: preTravel,
        handTravel: postTravel,
        probeReason: attackProbe?.reason || '-',
        probeDistanceSq: attackProbe?.distanceSq ?? -1,
        probeThresholdSq: attackProbe?.thresholdSq ?? -1,
        probeHorizontalDistance: attackProbe?.horizontalDistance ?? -1,
      };
    }
    attackDebug.snapshot = {
      name: enemy.userData.attackName || attackDef.name,
      elapsed: enemy.userData.attackElapsed || 0,
      total: attackDef.clipDuration || 0,
      activeStart: attackDef.activeStart,
      activeEnd: attackDef.activeEnd,
      lungeStart: attackDef.lungeStart,
      lungeEnd: attackDef.lungeEnd,
      preDist: dist,
      postDist: enemy.position.distanceTo(player.position),
      active: attackActive,
      reason: attackProbe?.reason || '-',
      actual: attackProbe?.distanceSq >= 0 ? Math.sqrt(attackProbe.distanceSq) : 0,
      threshold: attackProbe?.thresholdSq >= 0 ? Math.sqrt(attackProbe.thresholdSq) : (PLAYER_SOLID_RADIUS + Math.max(attackDef.sweepHalfExtents.x, attackDef.sweepHalfExtents.y)),
      preTravel: preTravel,
      postTravel: postTravel,
    };
    if (!enemy.userData.attackPrevHand) enemy.userData.attackPrevHand = currentHand.clone();
    else enemy.userData.attackPrevHand.copy(currentHand);
    if (enemy.userData.attackTimer <= 0) {
      enemy.userData.attackCooldown = ENEMY_ATTACK_COOLDOWN;
      enemy.userData.attackName = '';
      enemy.userData.attackDefKey = '';
      enemy.userData.attackDef = null;
      enemy.userData.attackPrevHand = null;
      enemy.userData.attackCurrentHand = null;
      enemy.userData.attackContactPoint = null;
      setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
      playEnemyAction('idle', 0.12);
    }
    return;
  }

  attackDebug.snapshot = ATTACK_LAB ? {
    name: enemy.userData.attackName || 'idle',
    elapsed: 0,
    total: 0,
    activeStart: 0,
    activeEnd: 0,
    lungeStart: 0,
    lungeEnd: 0,
    preDist: dist,
    postDist: dist,
    active: false,
    reason: '-',
    actual: 0,
    threshold: 0,
    preTravel: 0,
    postTravel: 0,
  } : null;

  if (ATTACK_LAB) {
    if (enemy.userData.attackCooldown <= 0 && dist <= ENEMY_ATTACK_RANGE) {
      startEnemyAttack();
      return;
    }
    const moved = applyEnemyMove(toPlayerDir, dist > ENEMY_ATTACK_RANGE ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED, dt);
    playEnemyAction(dist > ENEMY_ATTACK_RANGE + 0.2 ? 'run' : 'walk', 0.12);
    if (!moved) enemy.rotation.y = Math.atan2(enemy.position.x - player.position.x, enemy.position.z - player.position.z);
    return;
  }

  const mode = enemy.userData.mode || 'approach';
  const directCombatPath = enemyHasDirectCombatPath();
  if (nav && directCombatPath && nav.waypoints.length && !nav.jump) {
    clearEnemyRoute(nav);
    nav.routePath.length = 0;
    nav.repathTimer = ENEMY_NAV_REPATH_INTERVAL * 0.5;
  }
  const tangent = new THREE.Vector3(-toPlayerDir.z, 0, toPlayerDir.x).multiplyScalar(enemy.userData.orbitSign || 1);
  const navTarget = nav?.waypoints?.length ? nav.waypoints[0].clone() : null;
  const navKind = nav?.waypointKinds?.[0] || 'flat';
  const toNavTarget = navTarget ? navTarget.clone().sub(enemy.position) : null;
  if (toNavTarget) toNavTarget.y = 0;
  const navDist = toNavTarget ? toNavTarget.length() : dist;
  const navDir = toNavTarget && navDist > 0.001 ? toNavTarget.clone().multiplyScalar(1 / navDist) : toPlayerDir;
  const needsClimb = player.grounded && verticalGap > 0.22;
  const separatedByGraph = enemyRoomIndex >= 0 && playerRoomIndex >= 0 && enemyRoomIndex !== playerRoomIndex;
  const traversalActive = Boolean(navTarget) && (separatedByGraph || (nav?.routePath?.length || 0) > 0 || navKind !== 'flat' || navDist > ENEMY_ATTACK_RANGE + 0.45);

  if (navTarget && navDist < 0.36) {
    shiftEnemyRouteWaypoint(nav);
    nav.repathTimer = 0;
  }
  if (nav?.jump) {
    advanceEnemyJump(dt);
    return;
  }

  if (traversalActive) {
    setEnemyMode('approach');
    const segmentNeedsJump = !sampleEnemyMoveSupport(enemy.position, navTarget) && enemyCanJumpBetween(enemy.position, navTarget);
    if (segmentNeedsJump) {
      startEnemyJump(navTarget);
      return;
    }
    const navSpeed = (navKind === 'stair' || navKind === 'drop')
      ? ENEMY_WALK_SPEED
      : (navDist > ENEMY_RING_RADIUS + 1.75 || navKind === 'bridge' || navKind === 'branch' || navKind === 'jump' ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED);
    const moved = applyEnemyMove(navDir, navSpeed, dt);
    playEnemyAction(navSpeed > ENEMY_WALK_SPEED + 0.1 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    } else if (nav) {
      nav.stallCount = 0;
      nav.lastValidSupport = makeVec(enemy.position.x, baseY, enemy.position.z);
    }
    return;
  }

  if (needsClimb) {
    setEnemyMode('approach');
    const climbDir = navTarget ? navDir : toPlayerDir;
    const moved = applyEnemyMove(climbDir, ENEMY_RUN_SPEED, dt);
    playEnemyAction('run', 0.16);
    if (!moved && nav) {
      nav.stallCount += 1;
      nav.repathTimer = 0;
      rebuildEnemyRoute(true);
    }
    return;
  }

  if (dist <= ENEMY_ATTACK_RANGE && enemy.userData.attackCooldown <= 0 && mode !== 'retreat' && !needsClimb && !traversalActive) {
    startEnemyAttack();
    return;
  }

  if (mode === 'commit') {
    enemy.userData.commitElapsed += dt;
    const moved = applyEnemyMove(navTarget ? navDir : toPlayerDir, ENEMY_RUN_SPEED, dt);
    playEnemyAction('run', 0.12);
    if (dist <= ENEMY_ATTACK_RANGE && enemy.userData.attackCooldown <= 0) {
      startEnemyAttack();
      return;
    }
    if (!moved || enemy.userData.commitElapsed >= ENEMY_COMMIT_TIMEOUT) {
      setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
      if (nav) nav.repathTimer = 0;
    }
    return;
  }

  if (mode === 'retreat') {
    const retreatDir = toPlayerDir.clone().multiplyScalar(-0.85).addScaledVector(tangent, 0.42);
    const moved = applyEnemyMove(retreatDir, ENEMY_RETREAT_SPEED, dt);
    playEnemyAction(enemy.userData.orbitSign > 0 ? 'sidestepRight' : 'sidestepLeft', 0.14);
    if (!moved || enemy.userData.modeTimer <= 0 || dist >= ENEMY_RING_RADIUS + ENEMY_RING_TOLERANCE) {
      setEnemyMode('hold', 0.55);
      if (nav) nav.repathTimer = 0;
    }
    return;
  }

  if (navTarget) {
    const moved = applyEnemyMove(navDir, navDist > ENEMY_RING_RADIUS + 2.2 ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED, dt);
    playEnemyAction(navDist > ENEMY_RING_RADIUS + 2.2 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    } else if (nav) {
      nav.stallCount = 0;
      nav.lastValidSupport = makeVec(enemy.position.x, baseY, enemy.position.z);
    }
    return;
  }

  if (dist > ENEMY_RING_RADIUS + ENEMY_RING_TOLERANCE) {
    setEnemyMode('approach');
    const moved = applyEnemyMove(toPlayerDir, dist > ENEMY_RING_RADIUS + 2.2 ? ENEMY_RUN_SPEED : ENEMY_WALK_SPEED, dt);
    playEnemyAction(dist > ENEMY_RING_RADIUS + 2.2 ? 'run' : 'walk', 0.16);
    if (!moved) {
      if (nav) {
        nav.stallCount += 1;
        nav.repathTimer = 0;
        rebuildEnemyRoute(true);
      }
    }
    return;
  }

  if (dist < ENEMY_ATTACK_RANGE * 0.78 && !needsClimb) {
    setEnemyMode('retreat', ENEMY_RETREAT_DURATION);
    return;
  }

  setEnemyMode('hold');
  if (enemy.userData.commitTimer <= 0 && enemy.userData.attackCooldown <= 0) {
    setEnemyMode('commit');
    return;
  }

  const radialError = dist - ENEMY_RING_RADIUS;
  const holdMove = tangent.clone().addScaledVector(toPlayerDir, radialError * 0.22);
  const moved = applyEnemyMove(holdMove, ENEMY_SIDESTEP_SPEED, dt);
  if (!moved) {
    enemy.userData.orbitSign *= -1;
    enemy.userData.commitTimer = Math.min(enemy.userData.commitTimer || 0, 0.25);
    if (nav) {
      nav.stallCount += 1;
      nav.repathTimer = 0;
      if (nav.stallCount >= ENEMY_NAV_STALL_LIMIT) rebuildEnemyRoute(true);
    }
  } else if (nav) {
    nav.stallCount = 0;
  }
  playEnemyAction(enemy.userData.orbitSign > 0 ? 'sidestepRight' : 'sidestepLeft', 0.18);
}


function updateAttack(dt) {
  const enemy = getEnemy();
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  const attack = player.attack;
  if (!attack) return;
  attack.elapsed += dt;
  const def = attack.def;
  if (!attack.hitDone && attack.elapsed >= def.hitAt) {
    attack.hitDone = true;
    const toEnemy = enemy.position.clone().sub(player.position);
    toEnemy.y = 0;
    const dist = toEnemy.length();
    const alignment = dist > 0.001 ? attack.direction.dot(toEnemy.normalize()) : 0;
    if (enemy.visible && !enemy.userData.dead && dist < def.range && alignment > 0.5) {
      const reaction = chooseEnemyHitReaction(attack);
      const reactionName = enemyRuntime.actions.has(reaction.name) ? reaction.name : 'react';
      const reactionAction = enemyRuntime.actions.get(reactionName) || enemyRuntime.actions.get('react');
      enemy.userData.health -= def.damage;
      enemy.userData.attackTimer = 0;
      enemy.userData.attackElapsed = 0;
      enemy.userData.attackHitDone = false;
      enemy.userData.attackName = '';
      enemy.userData.hitTimer = Math.max(0.24, Math.min(0.7, reactionAction?.getClip?.().duration || 0.32));
      enemy.userData.lastHitReaction = reactionName;
      enemy.userData.lastHitZone = reaction.zone;
      enemy.userData.lastHitLocalX = reaction.localX;
      enemy.userData.lastHitLocalY = reaction.localY;
      enemy.position.addScaledVector(attack.direction, 0.28 + def.damage * 0.12);
      playEnemyAction(reactionName, 0.012, { restart: true });
      triggerHitJuice(reaction.worldImpact, attack.direction, def.damage);
      playThud(1.05 + def.damage * 0.16);
      if (enemy.userData.health <= 0) {
        startEnemyDeath(attack.direction, def.damage);
        if (enemy.userData.dead) setStatus('orc berserker down. survive another room.');
      }
    }
  }
  if (attack.elapsed >= def.duration) {
    player.attack = null;
    player.attackTimer = 0;
  }
}
  return {
    chooseEnemyHitReaction,
    playEnemyAction,
    updateEnemyMixer,
    getEnemyAttackDefinition,
    resolveEnemyAttackHandBone,
    sampleEnemyAttackHandWorld,
    getPlayerDamageCapsule,
    segmentSegmentDistanceSq,
    sweepEnemyAttackHitsPlayer,
    applyEnemyAttackHit,
    startEnemyAttack,
    updateEnemyEngagement,
    updateAttack,
  };
}
