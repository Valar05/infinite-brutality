import * as THREE from 'three';
import { buildIslandBridgeSpec } from './island-geometry.js?v=0.8.175';

export function createDistrictGeometryApi(deps) {
  const {
    PLAYER_EYE_HEIGHT,
    MAT,
    roomGroup,
    rngFromSeed,
    hashRoomKey,
    buildDistrictStoryPlacementCandidates,
    crystalRulesForRole,
    makeVec,
    addCrystalGrowthCluster,
    addGroundedBeveledBox,
    addGroundedCylinder,
    addWalkableBox,
    addWallBox,
    addBatchStairRun,
    addBatchRouteSegment,
    addHangingMarketStall,
    addPlanterBed,
    addHangingPlanter,
    addTrellisWall,
    addCisternPool,
    addShrineNicheSet,
    addWellSet,
    addHangingJarCluster,
    addClothLineCluster,
    addWatchPost,
    addCrateBundle,
    addBenchTableSet,
    addArchFragment,
    addGateChokeSet,
    addBrazier,
    addHangingChain,
    resolveSupportHeight,
    addCounterweightFrame,
    addHangingWeightCluster,
    addPulleyDrum,
    addCargoCage,
    addHookPost,
    addToolBench,
    addBrakeLeverStand,
    addScreenWallSegment,
    addBeveledBox,
    activeTerrainLayer,
  } = deps;

  function addDistrictCrystalGrowths(district) {
    const rng = rngFromSeed(hashRoomKey('district-crystal:' + district.id + ':' + district.baseElevation.toFixed(2)));
    const candidates = buildDistrictStoryPlacementCandidates(district);
    let crystalIndex = 0;
    for (const candidate of candidates) {
      const rules = crystalRulesForRole(candidate.role);
      if (!rules.length) continue;
      for (const rule of rules) {
        if (rng() > (rule.chance ?? 1)) continue;
        const routeHalfWidth = Math.max(1.8, Math.min(4.2, Math.max(candidate.size?.[0] || 4.4, candidate.size?.[2] || 4.4) * 0.38));
        const clusterCount = Math.max(1, Math.floor(rule.count || 1));
        for (let variant = 0; variant < clusterCount; variant += 1) {
          const sideSign = Number.isFinite(rule.sideSign) && rule.sideSign !== 0
            ? rule.sideSign
            : (variant % 2 === 0 ? 1 : -1);
          const alongSpread = rule.alongSpread ?? 1.0;
          const alongOffset = (variant - (clusterCount - 1) * 0.5) * alongSpread + (rng() - 0.5) * 0.55;
          const edgeOffset = routeHalfWidth + (rule.edgeOffset ?? 2.6) + variant * 0.24 + rng() * 0.24;
          const perchLift = (rule.perchLift ?? 0.24) + (rng() - 0.5) * 0.12;
          const anchor = makeVec(
            candidate.worldPos.x + candidate.sideDir.x * sideSign * edgeOffset + candidate.forwardDir.x * alongOffset,
            candidate.worldPos.y + perchLift,
            candidate.worldPos.z + candidate.sideDir.z * sideSign * edgeOffset + candidate.forwardDir.z * alongOffset,
          );
          const scale = rule.scale * (0.92 + rng() * 0.18);
          const verticalSpan = (rule.verticalSpan ?? 3.6) * scale;
          const basePos = makeVec(anchor.x, anchor.y - verticalSpan, anchor.z);
          const normal = candidate.sideDir.clone().multiplyScalar(sideSign).addScaledVector(candidate.forwardDir, (rng() - 0.5) * 0.22);
          if (normal.lengthSq() < 0.0001) normal.copy(candidate.sideDir).multiplyScalar(sideSign || 1);
          normal.normalize();
          addCrystalGrowthCluster(roomGroup, 'district-' + district.id + '-crystal-' + crystalIndex, {
            seed: hashRoomKey(district.id + ':' + candidate.key + ':' + candidate.role + ':' + crystalIndex),
            basePos,
            anchorY: anchor.y,
            topLift: rule.topLift ?? 0.12,
            normal,
            habit: rule.habit,
            climbable: !!rule.climbable,
            scale,
          });
          crystalIndex += 1;
        }
      }
    }
  }



  function beginDistrictVisualCollisionContract(district) {
    const contract = {
      districtId: district?.id || 'unknown',
      visibleIslandCount: 0,
      islandMeshCount: 0,
      visibleBridgeCount: 0,
      bridgeMeshCount: 0,
      failures: [],
    };
    if (district) district.visualCollisionContract = contract;
    return contract;
  }

  function finalizeDistrictVisualCollisionContract(contract) {
    if (!contract) return;
    if (contract.visibleIslandCount > 0 && contract.islandMeshCount < contract.visibleIslandCount) {
      contract.failures.push('visible islands missing mesh support colliders');
    }
    if (contract.visibleBridgeCount > 0 && contract.bridgeMeshCount < contract.visibleBridgeCount) {
      contract.failures.push('visible bridges missing mesh support colliders');
    }
    if (contract.failures.length) {
      throw new Error('District visual-collision contract failed for ' + contract.districtId + ': ' + contract.failures.join('; '));
    }
  }

  function buildRuntimeIslandMesh(meshData, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
    geometry.setIndex(meshData.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return new THREE.Mesh(geometry, material);
  }

  function routeIslandSizeForRole(role) {
    switch (role) {
      case 'support_stair': return [7.6, 5.0, 7.6];
      case 'market_court':
      case 'kill_court':
      case 'bath_court':
      case 'execution_court': return [10.8, 7.2, 10.8];
      case 'bridge_landing':
      case 'cargo_stage':
      case 'roof_lane':
      case 'winch_gallery': return [8.8, 5.4, 8.2];
      case 'underdeck_pass':
      case 'undercroft_pass':
      case 'recovery_return':
      case 'undercroft_run': return [8.4, 5.0, 8.4];
      default: return [8.8, 5.2, 8.8];
    }
  }

  function addDistrictRouteIslands(district, contract) {
    return;
  }

  function addDistrictIslandMasses(district, contract) {
    const anchors = district?.massAnchors || [];
    if (!anchors.length) return;
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      const terrain = activeTerrainLayer?.();
      if (!terrain) throw new Error('TerrainLayer is required before district island terrain can be emitted');
      terrain.addIslandStamp({
        id: anchor.id,
        role: anchor.role || 'arena',
        origin: anchor.pos,
        size: anchor.size,
        yaw: anchor.yaw || 0,
        terraced: !!anchor.terraced,
        rockGrammar: anchor.rockGrammar || 'sedimentary_mesa',
        seed: hashRoomKey((anchor.terraced ? 'district-terraced-island:' : 'district-island:') + district.id + ':' + anchor.id + ':' + district.baseElevation.toFixed(2)),
        materialVariant: i,
        source: 'district-island-voxel:' + anchor.id,
      });
      contract.visibleIslandCount += 1;
      contract.islandMeshCount += 1;
    }
  }

  function addDistrictIslandBridges(district, contract) {
    const anchors = district?.massAnchors || [];
    if (anchors.length < 2) return;
    for (let i = 0; i < anchors.length - 1; i += 1) {
      const spec = buildIslandBridgeSpec(anchors[i], anchors[i + 1]);
      if (!spec.visible) continue;
      const terrain = activeTerrainLayer?.();
      if (!terrain) throw new Error('TerrainLayer is required before district bridge terrain can be emitted');
      terrain.addBridgeSpan({
        id: district.id + '-island-bridge-' + i,
        length: spec.horizontalLength,
        width: spec.deckSize[0],
        thickness: 1.6,
        origin: [spec.center.x, spec.center.y, spec.center.z],
        yaw: spec.yaw,
        seed: hashRoomKey('district-island-bridge:' + district.id + ':' + i),
        source: 'district-island-bridge-voxel:' + district.id + ':' + i,
      });
      contract.visibleBridgeCount += 1;
      contract.bridgeMeshCount += 1;
    }
  }

  function addDistrictStoryNookVisual(parent, prefix, placement) {
    const [x, y, z] = placement.worldPos;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = placement.yaw || 0;
    group.name = prefix;
    if (placement.nookFamily === 'shelter') {
      addGroundedBeveledBox(group, prefix + '-bedroll', [1.18, 0.12, 0.76], [0, 0.02, 0], MAT.cloth, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-bundle', [0.34, 0.18, 0.34], [-0.48, 0.02, 0.1], MAT.timber, false, 0.01, 1);
      addGroundedCylinder(group, prefix + '-bowl', 0.12, 0.06, [0.42, 0.02, 0.12], MAT.ceramic, 6);
      addGroundedBeveledBox(group, prefix + '-screen', [0.94, 0.54, 0.08], [0, 0.02, -0.42], MAT.cloth, false, 0.01, 1);
    } else if (placement.nookFamily === 'shrine') {
      addGroundedBeveledBox(group, prefix + '-back', [1.08, 1.46, 0.16], [0, 0.02, -0.22], MAT.plaster, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-shelf', [0.84, 0.1, 0.28], [0, 0.56, 0], MAT.timber, false, 0.01, 1);
      addGroundedCylinder(group, prefix + '-votive-a', 0.1, 0.16, [-0.22, 0.66, 0.02], MAT.ceramic, 6);
      addGroundedCylinder(group, prefix + '-votive-b', 0.08, 0.2, [0.18, 0.66, 0.04], MAT.bronze, 6);
      addGroundedBeveledBox(group, prefix + '-tongue', [0.16, 0.52, 0.08], [0, 0.84, -0.02], MAT.bronze, false, 0.01, 1);
    } else if (placement.nookFamily === 'repair') {
      addGroundedBeveledBox(group, prefix + '-bench', [1.26, 0.26, 0.68], [0, 0.02, 0], MAT.timber, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-tool-a', [0.42, 0.08, 0.12], [-0.28, 0.32, -0.06], MAT.iron, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-tool-b', [0.18, 0.18, 0.18], [0.24, 0.32, 0.08], MAT.bronze, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-ledger', [0.28, 0.04, 0.2], [0.06, 0.32, -0.14], MAT.plaster, false, 0.01, 1);
    } else if (placement.nookFamily === 'ration') {
      addGroundedBeveledBox(group, prefix + '-crate', [0.94, 0.34, 0.72], [0, 0.02, 0], MAT.timber, false, 0.01, 1);
      addGroundedCylinder(group, prefix + '-jar-a', 0.14, 0.34, [-0.2, 0.34, -0.08], MAT.ceramic, 6);
      addGroundedCylinder(group, prefix + '-jar-b', 0.12, 0.28, [0.16, 0.34, 0.1], MAT.ceramic, 6);
      addGroundedCylinder(group, prefix + '-bowl', 0.12, 0.06, [0.34, 0.02, -0.18], MAT.ceramic, 6);
    } else if (placement.nookFamily === 'burial') {
      addGroundedBeveledBox(group, prefix + '-bundle', [1.32, 0.22, 0.54], [0, 0.02, 0], MAT.cloth, false, 0.01, 1);
      addGroundedBeveledBox(group, prefix + '-tablet', [0.18, 0.82, 0.12], [-0.34, 0.02, -0.2], MAT.plaster, false, 0.01, 1);
      addGroundedCylinder(group, prefix + '-lamp', 0.09, 0.12, [0.34, 0.02, 0.14], MAT.bronze, 6);
      addGroundedBeveledBox(group, prefix + '-ash', [0.46, 0.03, 0.3], [0.28, 0.02, -0.12], MAT.bloodDark, false, 0.01, 1);
    }
    parent.add(group);
    return group;
  }

  function addDistrictStoryNooks(district) {
    const placements = district?.storyNookPlacements || [];
    for (let i = 0; i < placements.length; i += 1) {
      const placement = placements[i];
      addDistrictStoryNookVisual(roomGroup, 'district-' + district.id + '-story-' + i, placement);
    }
  }

  function addHangingMarketDistrictSkeleton(district) {
    const origin = district.origin;
    const lowBand = district.circulationBands?.[0]?.y ?? district.baseElevation + 3.2;
    const midBand = district.circulationBands?.[1]?.y ?? district.baseElevation + 7.6;
    const highBand = district.circulationBands?.[2]?.y ?? district.baseElevation + 12.8;

    const terraceLowCenter = [origin.x - 34, lowBand - 0.22, origin.z + 66];
    const terraceMidCenter = [origin.x + 8, midBand - 0.24, origin.z + 160];
    const terraceHighCenter = [origin.x + 42, highBand - 0.18, origin.z + 228];
    const bridgeCenter = [origin.x + 78, highBand + 0.28, origin.z + 286];
    const undercroftCenter = [origin.x - 6, lowBand - 0.82, origin.z + 226];

    addWalkableBox(roomGroup, 'district-' + district.id + '-terrace-low', [34, 0.52, 30], terraceLowCenter, MAT.stone2, false, 0.1);
    addWalkableBox(roomGroup, 'district-' + district.id + '-terrace-mid', [46, 0.58, 38], terraceMidCenter, MAT.stone2, false, 0.1);
    addWalkableBox(roomGroup, 'district-' + district.id + '-terrace-high', [24, 0.48, 30], terraceHighCenter, MAT.platform, false, 0.08);
    addWalkableBox(roomGroup, 'district-' + district.id + '-bridge-remnant', [18, 0.46, 44], bridgeCenter, MAT.bridge, true, 0.06);
    addWalkableBox(roomGroup, 'district-' + district.id + '-undercroft-return', [28, 0.42, 32], undercroftCenter, MAT.connectorFloor, false, 0.08);

    addWallBox(roomGroup, 'district-' + district.id + '-retaining-wall-west-a', [6.0, 10.5, 34], [origin.x - 58, district.baseElevation + 3.2, origin.z + 92], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-retaining-wall-west-b', [6.0, 12.0, 40], [origin.x - 48, district.baseElevation + 5.0, origin.z + 166], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-retaining-wall-west-c', [6.0, 12.5, 34], [origin.x - 40, district.baseElevation + 5.6, origin.z + 240], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-court-basin-wall-north', [40, 5.2, 3.4], [origin.x + 6, district.baseElevation + 5.0, origin.z + 178], MAT.plaster, false);
    addWallBox(roomGroup, 'district-' + district.id + '-court-basin-wall-south', [34, 4.8, 3.2], [origin.x + 10, district.baseElevation + 4.8, origin.z + 138], MAT.plaster, false);
    addWallBox(roomGroup, 'district-' + district.id + '-court-basin-wall-east', [3.4, 5.0, 24], [origin.x + 28, district.baseElevation + 4.9, origin.z + 158], MAT.plaster, false);
    addWallBox(roomGroup, 'district-' + district.id + '-undercroft-back-wall', [24, 7.4, 3.2], [origin.x - 6, district.baseElevation + 0.2, origin.z + 244], MAT.connectorWall, false);

    for (let i = 0; i < 5; i += 1) {
      const z = origin.z + 178 + i * 26;
      const x = origin.x - 20 + (i % 2) * 18;
      addGroundedCylinder(roomGroup, 'district-' + district.id + '-support-column-' + i, 1.15, Math.max(10, highBand - district.baseElevation + 9), [x, district.baseElevation - 10.2, z], MAT.iron, 7);
      addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-support-buttress-' + i, [1.4, 8.6 + i * 0.45, 1.4], [x + 5.8, district.baseElevation - 8.6, z + 4.4], MAT.trim, false, 0.03, 1).rotation.z = 0.38;
    }

    for (let i = 0; i < 3; i += 1) {
      const ax = origin.x + 60 + i * 9;
      addGroundedCylinder(roomGroup, 'district-' + district.id + '-aqueduct-pier-' + i, 1.0, 8.8 + i * 0.6, [ax, highBand - 7.8, origin.z + 286 + (i % 2) * 3], MAT.stone2, 6);
      addBeveledBox(roomGroup, 'district-' + district.id + '-aqueduct-arch-' + i, [8.8, 1.3, 2.0], [ax + 4.2, highBand + 1.7, origin.z + 286], MAT.trim, false, 0.03, 1);
    }
    addBeveledBox(roomGroup, 'district-' + district.id + '-aqueduct-crown', [28, 1.1, 3.0], [origin.x + 78, highBand + 3.0, origin.z + 286], MAT.trim, false, 0.03, 1);

    addBatchStairRun(roomGroup, 'district-' + district.id + '-entry-terrace-rise', makeVec(origin.x - 52, lowBand + PLAYER_EYE_HEIGHT, origin.z + 28), makeVec(origin.x - 20, lowBand + PLAYER_EYE_HEIGHT, origin.z + 86), lowBand - 0.08, midBand - 2.8, MAT.platform);
    addBatchStairRun(roomGroup, 'district-' + district.id + '-court-rise', makeVec(origin.x - 6, midBand + PLAYER_EYE_HEIGHT, origin.z + 122), makeVec(origin.x + 28, highBand + PLAYER_EYE_HEIGHT, origin.z + 212), midBand - 0.06, highBand - 0.16, MAT.platform);
    addBatchRouteSegment(roomGroup, 'district-' + district.id + '-upper-gallery-run', makeVec(origin.x + 20, highBand, origin.z + 204), makeVec(origin.x + 62, highBand + 0.26, origin.z + 258), highBand + 0.14, 4.0, MAT.bridge, 0.95);
    addBatchRouteSegment(roomGroup, 'district-' + district.id + '-bridge-commit', makeVec(origin.x + 60, highBand + 0.2, origin.z + 260), makeVec(origin.x + 88, highBand + 0.58, origin.z + 304), highBand + 0.3, 3.8, MAT.bridge, 0.85);
    addBatchRouteSegment(roomGroup, 'district-' + district.id + '-undercroft-run', makeVec(origin.x - 28, lowBand - 0.44, origin.z + 174), makeVec(origin.x + 14, lowBand - 0.78, origin.z + 246), lowBand - 0.34, 3.2, MAT.connectorFloor, 0.95);

    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-low-a', origin.x - 26, lowBand + 0.08, origin.z + 84, 4.6, 2.8, 0.14);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-low-b', origin.x - 8, lowBand + 0.08, origin.z + 110, 4.2, 2.6, -0.08);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-low-c', origin.x - 20, lowBand + 0.08, origin.z + 138, 4.0, 2.4, 0.24);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-mid-a', origin.x + 4, midBand + 0.08, origin.z + 150, 5.2, 3.0, 0.06);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-mid-b', origin.x + 24, midBand + 0.08, origin.z + 180, 4.8, 2.8, -0.12);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-mid-c', origin.x - 10, midBand + 0.08, origin.z + 176, 4.4, 2.6, 0.18);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-high-a', origin.x + 48, highBand + 0.08, origin.z + 232, 4.4, 2.6, 0.18);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-high-b', origin.x + 74, highBand + 0.08, origin.z + 276, 4.0, 2.4, -0.18);
    addHangingMarketStall(roomGroup, 'district-' + district.id + '-stall-high-c', origin.x + 58, highBand + 0.08, origin.z + 258, 3.8, 2.2, 0.08);

    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-low-a', origin.x - 18, lowBand + 0.02, origin.z + 74, 3.0, 1.1, 5);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-low-b', origin.x - 2, lowBand + 0.02, origin.z + 118, 2.6, 1.0, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-low-c', origin.x - 30, lowBand + 0.02, origin.z + 96, 2.8, 1.0, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-mid-a', origin.x + 8, midBand + 0.02, origin.z + 142, 3.4, 1.2, 5);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-mid-b', origin.x + 30, midBand + 0.02, origin.z + 188, 2.8, 1.0, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-mid-c', origin.x - 12, midBand + 0.02, origin.z + 160, 2.6, 0.94, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-high-a', origin.x + 54, highBand + 0.02, origin.z + 238, 2.4, 0.94, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-high-b', origin.x + 68, highBand + 0.02, origin.z + 298, 2.2, 0.88, 4);
    addHangingPlanter(roomGroup, 'district-' + district.id + '-hanger-a', origin.x + 40, origin.z + 214, highBand + 2.6, highBand + 0.62);
    addHangingPlanter(roomGroup, 'district-' + district.id + '-hanger-b', origin.x + 74, origin.z + 270, highBand + 3.0, highBand + 0.74);
    addHangingPlanter(roomGroup, 'district-' + district.id + '-hanger-c', origin.x - 6, origin.z + 154, midBand + 2.2, midBand + 0.58);
    addHangingPlanter(roomGroup, 'district-' + district.id + '-hanger-d', origin.x + 24, origin.z + 202, highBand + 2.0, highBand + 0.54);
    addTrellisWall(roomGroup, 'district-' + district.id + '-trellis-a', origin.x + 26, midBand + 0.04, origin.z + 134, 4.6, 2.4, 0.02);
    addTrellisWall(roomGroup, 'district-' + district.id + '-trellis-b', origin.x - 10, lowBand - 0.18, origin.z + 214, 3.8, 2.2, -0.3);
    addTrellisWall(roomGroup, 'district-' + district.id + '-trellis-c', origin.x + 62, highBand + 0.04, origin.z + 246, 3.4, 2.0, -0.12);

    addCisternPool(roomGroup, 'district-' + district.id + '-cistern', origin.x + 2, district.baseElevation + 3.42, origin.z + 158, 7.4, 5.4);
    addShrineNicheSet(roomGroup, 'district-' + district.id + '-shrine-niche', origin.x - 14, district.baseElevation + 0.12, origin.z + 228, 0.18);
    addShrineNicheSet(roomGroup, 'district-' + district.id + '-shrine-small', origin.x + 34, highBand + 0.02, origin.z + 222, -0.22);
    addWellSet(roomGroup, 'district-' + district.id + '-well', origin.x + 16, midBand + 0.02, origin.z + 170);
    addHangingJarCluster(roomGroup, 'district-' + district.id + '-jars-low', origin.x - 4, lowBand + 0.02, origin.z + 126, 5, 1.4);
    addHangingJarCluster(roomGroup, 'district-' + district.id + '-jars-mid', origin.x + 18, midBand + 0.02, origin.z + 194, 6, 1.6);
    addHangingJarCluster(roomGroup, 'district-' + district.id + '-jars-high', origin.x + 70, highBand + 0.02, origin.z + 288, 5, 1.2);
    addClothLineCluster(roomGroup, 'district-' + district.id + '-cloth-line-a', origin.x - 2, lowBand + 0.02, origin.z + 102, 4.6, 0.08);
    addClothLineCluster(roomGroup, 'district-' + district.id + '-cloth-line-b', origin.x + 36, highBand + 0.02, origin.z + 248, 4.2, -0.12);
    addClothLineCluster(roomGroup, 'district-' + district.id + '-cloth-line-c', origin.x + 12, midBand + 0.02, origin.z + 156, 5.0, 0.18);
    addWatchPost(roomGroup, 'district-' + district.id + '-watch-post', origin.x + 88, highBand + 0.02, origin.z + 294, -0.18);
    addWatchPost(roomGroup, 'district-' + district.id + '-watch-post-mid', origin.x - 28, midBand + 0.02, origin.z + 196, 0.22);
    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-low-a', origin.x - 30, lowBand + 0.02, origin.z + 146, 0.12, 5);
    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-mid-a', origin.x + 30, midBand + 0.02, origin.z + 206, -0.18, 6);
    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-under-a', origin.x - 2, lowBand - 0.42, origin.z + 236, 0.28, 5);
    addBenchTableSet(roomGroup, 'district-' + district.id + '-bench-set-a', origin.x - 14, lowBand + 0.02, origin.z + 96, 0.08);
    addBenchTableSet(roomGroup, 'district-' + district.id + '-bench-set-b', origin.x + 20, midBand + 0.02, origin.z + 174, -0.14);
    addArchFragment(roomGroup, 'district-' + district.id + '-arch-a', origin.x + 42, midBand + 0.02, origin.z + 144, 0.18);
    addArchFragment(roomGroup, 'district-' + district.id + '-arch-b', origin.x + 82, highBand + 0.02, origin.z + 306, -0.12);
    addGateChokeSet(roomGroup, 'district-' + district.id + '-gate-a', origin.x - 16, lowBand + 0.02, origin.z + 86, 0.02);
    addGateChokeSet(roomGroup, 'district-' + district.id + '-gate-b', origin.x + 56, highBand + 0.02, origin.z + 260, -0.16);

    addBrazier(roomGroup, 'district-' + district.id + '-brazier-entry', [origin.x - 18, lowBand + 0.18, origin.z + 92], { kind: 'flame' });
    addBrazier(roomGroup, 'district-' + district.id + '-brazier-court', [origin.x + 12, midBand + 0.18, origin.z + 166], { kind: 'corpsefire' });
    addBrazier(roomGroup, 'district-' + district.id + '-brazier-bridge', [origin.x + 78, highBand + 0.18, origin.z + 282], { kind: 'flame' });

    for (let i = 0; i < 4; i += 1) {
      addHangingChain(roomGroup, 'district-' + district.id + '-bridge-chain-' + i, origin.x + 58 + i * 8, origin.z + 250 + i * 10, highBand + 3.2, 6, MAT.iron, rngFromSeed(hashRoomKey(district.id + '-ancient-chain-' + i)), { length: 2.4 + (i % 2) * 0.5, sway: 0.02, dropStone: false });
    }

    const landmark = district.landmarkAnchor;
    if (landmark) {
      addBrazier(roomGroup, 'district-' + district.id + '-landmark', [landmark.x, landmark.y - PLAYER_EYE_HEIGHT + 0.4, landmark.z], { kind: 'corpsefire' });
      addBeveledBox(roomGroup, 'district-' + district.id + '-landmark-crown', [6.4, 0.7, 2.0], [landmark.x, landmark.y + 1.2, landmark.z], MAT.bronze, false, 0.03, 1);
    }
  }


  function addLiftCourtDistrictSkeleton(district) {
    const origin = district.origin;
    const lowBand = district.circulationBands?.[0]?.y ?? district.baseElevation + 3.2;
    const midBand = district.circulationBands?.[1]?.y ?? district.baseElevation + 9.0;
    const highBand = district.circulationBands?.[2]?.y ?? district.baseElevation + 16.2;

    addWalkableBox(roomGroup, 'district-' + district.id + '-gate-terrace', [28, 0.56, 24], [origin.x - 22, lowBand - 0.18, origin.z + 56], MAT.stone2, false, 0.1);
    addWalkableBox(roomGroup, 'district-' + district.id + '-kill-court', [42, 0.62, 36], [origin.x + 6, midBand - 0.18, origin.z + 144], MAT.plaster, false, 0.1);
    addWalkableBox(roomGroup, 'district-' + district.id + '-tower-platform', [18, 0.56, 18], [origin.x + 42, midBand + 4.4, origin.z + 198], MAT.platform, false, 0.08);
    addWalkableBox(roomGroup, 'district-' + district.id + '-upper-gallery', [18, 0.48, 40], [origin.x + 78, highBand - 0.16, origin.z + 258], MAT.bridge, true, 0.08);
    addWalkableBox(roomGroup, 'district-' + district.id + '-undercroft-return', [28, 0.42, 26], [origin.x - 2, lowBand - 0.76, origin.z + 220], MAT.connectorFloor, false, 0.08);

    addWallBox(roomGroup, 'district-' + district.id + '-retaining-west-a', [5.8, 9.2, 30], [origin.x - 40, district.baseElevation + 1.8, origin.z + 84], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-retaining-west-b', [5.8, 11.4, 42], [origin.x - 30, district.baseElevation + 3.8, origin.z + 152], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-retaining-east', [4.8, 8.8, 26], [origin.x + 34, district.baseElevation + 5.4, origin.z + 146], MAT.wall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-court-screen-north', [36, 3.8, 1.8], [origin.x + 4, midBand + 1.6, origin.z + 126], MAT.plaster, false);
    addWallBox(roomGroup, 'district-' + district.id + '-court-screen-south', [30, 3.2, 1.8], [origin.x + 12, midBand + 1.4, origin.z + 164], MAT.plaster, false);
    addWallBox(roomGroup, 'district-' + district.id + '-tower-core', [10.0, 22.0, 10.0], [origin.x + 42, district.baseElevation + 11.0, origin.z + 198], MAT.connectorWall, false);
    addWallBox(roomGroup, 'district-' + district.id + '-undercroft-back', [24, 6.2, 2.4], [origin.x - 2, lowBand + 1.2, origin.z + 234], MAT.connectorWall, false);

    addBatchStairRun(roomGroup, 'district-' + district.id + '-entry-rise', makeVec(origin.x - 38, lowBand + PLAYER_EYE_HEIGHT, origin.z + 22), makeVec(origin.x - 12, lowBand + PLAYER_EYE_HEIGHT, origin.z + 92), lowBand - 0.08, midBand - 2.4, MAT.platform);
    addBatchStairRun(roomGroup, 'district-' + district.id + '-court-rise', makeVec(origin.x + 10, midBand + PLAYER_EYE_HEIGHT, origin.z + 158), makeVec(origin.x + 54, highBand + PLAYER_EYE_HEIGHT, origin.z + 214), midBand + 0.1, highBand - 0.2, MAT.platform);
    addBatchRouteSegment(roomGroup, 'district-' + district.id + '-gallery-run', makeVec(origin.x + 48, highBand, origin.z + 214), makeVec(origin.x + 92, highBand + 0.24, origin.z + 268), highBand + 0.14, 4.0, MAT.bridge, 0.95);
    addBatchRouteSegment(roomGroup, 'district-' + district.id + '-undercroft-run', makeVec(origin.x - 20, lowBand - 0.52, origin.z + 178), makeVec(origin.x + 8, lowBand - 0.62, origin.z + 238), lowBand - 0.38, 3.0, MAT.connectorFloor, 0.92);

    const liftSupportTop = (x, z, fallbackY) => resolveSupportHeight(x, z, fallbackY + 0.24, 0)?.topY ?? fallbackY;

    addCounterweightFrame(roomGroup, 'district-' + district.id + '-tower-frame', origin.x + 42, midBand + 0.3, origin.z + 198, 10.8, 0);
    addHangingWeightCluster(roomGroup, 'district-' + district.id + '-weights-a', origin.x + 46, midBand + 0.3, origin.z + 190, highBand + 5.2, 0);
    addHangingWeightCluster(roomGroup, 'district-' + district.id + '-weights-b', origin.x + 38, midBand + 0.3, origin.z + 206, highBand + 4.8, 0);
    addPulleyDrum(roomGroup, 'district-' + district.id + '-drum-a', origin.x + 20, midBand + 0.1, origin.z + 136, 0.82, 2.2, 0.2);
    addPulleyDrum(roomGroup, 'district-' + district.id + '-drum-b', origin.x + 66, highBand + 0.1, origin.z + 244, 0.72, 1.8, -0.12);
    addCargoCage(roomGroup, 'district-' + district.id + '-cage-a', origin.x + 4, liftSupportTop(origin.x + 4, origin.z + 148, midBand) + 0.02, origin.z + 148, 0.08);
    addCargoCage(roomGroup, 'district-' + district.id + '-cage-b', origin.x + 76, liftSupportTop(origin.x + 76, origin.z + 264, highBand) + 0.02, origin.z + 264, -0.14);
    addHookPost(roomGroup, 'district-' + district.id + '-hook-a', origin.x - 8, liftSupportTop(origin.x - 8, origin.z + 132, midBand) + 0.02, origin.z + 132, 0.12);
    addHookPost(roomGroup, 'district-' + district.id + '-hook-b', origin.x + 62, liftSupportTop(origin.x + 62, origin.z + 254, highBand) + 0.02, origin.z + 254, -0.22);
    addToolBench(roomGroup, 'district-' + district.id + '-bench-a', origin.x - 10, liftSupportTop(origin.x - 10, origin.z + 154, midBand) + 0.02, origin.z + 154, -0.08);
    addToolBench(roomGroup, 'district-' + district.id + '-bench-b', origin.x - 6, liftSupportTop(origin.x - 6, origin.z + 226, lowBand - 0.42) + 0.02, origin.z + 226, 0.18);
    addBrakeLeverStand(roomGroup, 'district-' + district.id + '-lever-a', origin.x + 34, liftSupportTop(origin.x + 34, origin.z + 176, midBand) + 0.02, origin.z + 176, 0.16);
    addBrakeLeverStand(roomGroup, 'district-' + district.id + '-lever-b', origin.x + 84, liftSupportTop(origin.x + 84, origin.z + 248, highBand) + 0.02, origin.z + 248, -0.18);
    addScreenWallSegment(roomGroup, 'district-' + district.id + '-screen-a', origin.x - 10, liftSupportTop(origin.x - 10, origin.z + 124, midBand) + 0.02, origin.z + 124, 6.2, 0.02);
    addScreenWallSegment(roomGroup, 'district-' + district.id + '-screen-b', origin.x + 20, liftSupportTop(origin.x + 20, origin.z + 166, midBand) + 0.02, origin.z + 166, 5.8, -0.22);

    addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-execution-dais', [6.2, 0.82, 3.8], [origin.x + 10, midBand + 0.1, origin.z + 140], MAT.trim, true, 0.05, 1);
    addGroundedBeveledBox(roomGroup, 'district-' + district.id + '-execution-block', [1.8, 1.0, 1.4], [origin.x + 10, midBand + 0.92, origin.z + 138], MAT.bronze, true, 0.04, 1);
    addBeveledBox(roomGroup, 'district-' + district.id + '-guillotine-post-left', [0.28, 3.6, 0.28], [origin.x + 8.7, midBand + 2.3, origin.z + 140], MAT.timber, false, 0.02, 1);
    addBeveledBox(roomGroup, 'district-' + district.id + '-guillotine-post-right', [0.28, 3.6, 0.28], [origin.x + 11.3, midBand + 2.3, origin.z + 140], MAT.timber, false, 0.02, 1);
    addBeveledBox(roomGroup, 'district-' + district.id + '-guillotine-beam', [2.9, 0.22, 0.28], [origin.x + 10, midBand + 4.0, origin.z + 140], MAT.timber, false, 0.02, 1);
    const blade = addBeveledBox(roomGroup, 'district-' + district.id + '-guillotine-blade', [0.94, 1.3, 0.12], [origin.x + 10, midBand + 2.74, origin.z + 140], MAT.iron, false, 0.01, 1);
    blade.rotation.z = Math.PI * 0.25;

    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-court-a', origin.x - 10, liftSupportTop(origin.x - 10, origin.z + 138, midBand) + 0.02, origin.z + 138, 0.22, 5);
    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-court-b', origin.x + 28, liftSupportTop(origin.x + 28, origin.z + 154, midBand) + 0.02, origin.z + 154, -0.2, 5);
    addCrateBundle(roomGroup, 'district-' + district.id + '-crates-gallery', origin.x + 82, liftSupportTop(origin.x + 82, origin.z + 276, highBand) + 0.02, origin.z + 276, -0.12, 4);
    addBenchTableSet(roomGroup, 'district-' + district.id + '-bench-set', origin.x - 16, liftSupportTop(origin.x - 16, origin.z + 72, lowBand) + 0.02, origin.z + 72, 0.06);
    addHangingJarCluster(roomGroup, 'district-' + district.id + '-jars-court', origin.x + 24, liftSupportTop(origin.x + 24, origin.z + 162, midBand) + 0.02, origin.z + 162, 5, 1.4);
    addHangingJarCluster(roomGroup, 'district-' + district.id + '-jars-undercroft', origin.x - 8, liftSupportTop(origin.x - 8, origin.z + 232, lowBand - 0.42) + 0.02, origin.z + 232, 4, 1.1);
    addClothLineCluster(roomGroup, 'district-' + district.id + '-cloth-line', origin.x - 18, liftSupportTop(origin.x - 18, origin.z + 88, lowBand) + 0.02, origin.z + 88, 4.8, 0.1);
    addWatchPost(roomGroup, 'district-' + district.id + '-watch-post', origin.x + 84, liftSupportTop(origin.x + 84, origin.z + 258, highBand) + 0.02, origin.z + 258, -0.16);
    addShrineNicheSet(roomGroup, 'district-' + district.id + '-shrine', origin.x - 10, liftSupportTop(origin.x - 10, origin.z + 226, lowBand - 0.56), origin.z + 226, 0.18);
    addWellSet(roomGroup, 'district-' + district.id + '-water-station', origin.x - 4, liftSupportTop(origin.x - 4, origin.z + 148, midBand) + 0.02, origin.z + 148);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-a', origin.x - 24, liftSupportTop(origin.x - 24, origin.z + 64, lowBand) + 0.02, origin.z + 64, 2.8, 1.0, 4);
    addPlanterBed(roomGroup, 'district-' + district.id + '-planter-b', origin.x + 70, liftSupportTop(origin.x + 70, origin.z + 246, highBand) + 0.02, origin.z + 246, 2.2, 0.9, 3);
    addTrellisWall(roomGroup, 'district-' + district.id + '-trellis', origin.x - 26, liftSupportTop(origin.x - 26, origin.z + 58, lowBand) + 0.02, origin.z + 58, 4.0, 2.2, 0);

    for (let i = 0; i < 4; i += 1) {
      addHangingChain(roomGroup, 'district-' + district.id + '-tower-chain-' + i, origin.x + 36 + i * 4.6, origin.z + 190 + i * 6.5, highBand + 5.8, 7, MAT.iron, rngFromSeed(hashRoomKey(district.id + '-tower-chain-' + i)), { length: 3.1 + (i % 2) * 0.6, sway: 0.015, dropStone: false });
    }

    addBrazier(roomGroup, 'district-' + district.id + '-court-brazier-a', [origin.x - 8, liftSupportTop(origin.x - 8, origin.z + 132, midBand) + 0.18, origin.z + 132], { kind: 'flame' });
    addBrazier(roomGroup, 'district-' + district.id + '-court-brazier-b', [origin.x + 28, liftSupportTop(origin.x + 28, origin.z + 158, midBand) + 0.18, origin.z + 158], { kind: 'corpsefire' });
    addBrazier(roomGroup, 'district-' + district.id + '-gallery-brazier', [origin.x + 84, liftSupportTop(origin.x + 84, origin.z + 252, highBand) + 0.18, origin.z + 252], { kind: 'flame' });

    const landmark = district.landmarkAnchor;
    if (landmark) {
      addBrazier(roomGroup, 'district-' + district.id + '-landmark', [landmark.x, landmark.y - PLAYER_EYE_HEIGHT + 0.4, landmark.z], { kind: 'corpsefire' });
      addBeveledBox(roomGroup, 'district-' + district.id + '-landmark-crown', [4.8, 0.64, 4.8], [landmark.x, landmark.y + 0.8, landmark.z], MAT.bronze, false, 0.03, 1);
    }
  }

  function addDistrictSkeletonGeometry(district) {
    if (!district) return;
    const contract = beginDistrictVisualCollisionContract(district);
    addDistrictIslandMasses(district, contract);
    addDistrictIslandBridges(district, contract);
    addDistrictRouteIslands(district, contract);
    finalizeDistrictVisualCollisionContract(contract);
  }

  return {
    addDistrictSkeletonGeometry,
  };
}
