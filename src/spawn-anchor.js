function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalize2(x, z) {
  const length = Math.hypot(x, z);
  if (length <= 0.0001) return { x: 0, z: 1 };
  return { x: x / length, z: z / length };
}

function buildSearchOffsets(preferred, rings) {
  const right = { x: -preferred.z, z: preferred.x };
  const offsets = [];
  for (const ring of rings) {
    if (ring === 0) {
      offsets.push([0, 0, 0]);
      continue;
    }
    offsets.push([preferred.x * ring, preferred.z * ring, ring]);
    offsets.push([-preferred.x * ring, -preferred.z * ring, ring + 0.08]);
    offsets.push([right.x * ring, right.z * ring, ring + 0.16]);
    offsets.push([-right.x * ring, -right.z * ring, ring + 0.24]);
    offsets.push([(preferred.x + right.x) * ring * 0.74, (preferred.z + right.z) * ring * 0.74, ring + 0.32]);
    offsets.push([(preferred.x - right.x) * ring * 0.74, (preferred.z - right.z) * ring * 0.74, ring + 0.40]);
  }
  return offsets;
}

export function evaluateSpawnCandidate({
  x,
  z,
  baseFeetY,
  eyeHeight,
  solidRadius,
  supportAtFeet,
  isTorsoBlocked,
  measureHeadroom,
  sampleRadius = Math.max(0.48, solidRadius * 1.35),
  maxSupportDelta = 0.34,
  minHeadroom = 1.35,
  maxHeadroomProbe = 2.4,
}) {
  const centerSupport = supportAtFeet(x, z, baseFeetY);
  if (!centerSupport) return null;
  const candidateY = centerSupport.topY + eyeHeight;
  if (isTorsoBlocked(x, z, candidateY)) return null;
  const headroom = measureHeadroom ? measureHeadroom(x, z, candidateY, maxHeadroomProbe) : maxHeadroomProbe;
  if (headroom < minHeadroom) return null;

  const sampleOffsets = [
    [0, 0],
    [sampleRadius, 0],
    [-sampleRadius, 0],
    [0, sampleRadius],
    [0, -sampleRadius],
    [sampleRadius * 0.72, sampleRadius * 0.72],
    [-sampleRadius * 0.72, sampleRadius * 0.72],
    [sampleRadius * 0.72, -sampleRadius * 0.72],
    [-sampleRadius * 0.72, -sampleRadius * 0.72],
  ];
  const tops = [];
  for (const [ox, oz] of sampleOffsets) {
    const sampleX = x + ox;
    const sampleZ = z + oz;
    const support = supportAtFeet(sampleX, sampleZ, centerSupport.topY);
    if (!support) return null;
    if (Math.abs(support.topY - centerSupport.topY) > maxSupportDelta) return null;
    if (measureHeadroom) {
      const sampleHeadroom = measureHeadroom(sampleX, sampleZ, support.topY + eyeHeight, maxHeadroomProbe);
      if (sampleHeadroom < minHeadroom) return null;
    }
    tops.push(support.topY);
  }
  const minTop = Math.min(...tops);
  const maxTop = Math.max(...tops);
  return {
    x,
    z,
    y: candidateY,
    topY: centerSupport.topY,
    variance: maxTop - minTop,
    headroom,
  };
}

export function findSpawnAnchor({
  point,
  lookTarget = null,
  eyeHeight,
  solidRadius,
  supportAtFeet,
  isTorsoBlocked,
  measureHeadroom,
  rings = [0, 0.85, 1.6, 2.5, 3.5, 4.8, 6.2, 7.8, 9.6],
}) {
  if (!point) return null;
  const preferred = normalize2(
    (lookTarget?.x ?? point.x) - point.x,
    (lookTarget?.z ?? point.z) - point.z,
  );
  const baseFeetY = point.y - eyeHeight;
  const offsets = buildSearchOffsets(preferred, rings);
  let best = null;
  for (const [ox, oz, distanceBias] of offsets) {
    const candidate = evaluateSpawnCandidate({
      x: point.x + ox,
      z: point.z + oz,
      baseFeetY,
      eyeHeight,
      solidRadius,
      supportAtFeet,
      isTorsoBlocked,
      measureHeadroom,
    });
    if (!candidate) continue;
    const headroomDeficit = clamp01(Math.max(0, 2.1 - candidate.headroom));
    const score = candidate.variance * 18
      + distanceBias * 0.15
      + headroomDeficit * 7
      - candidate.topY * 0.12
      - candidate.headroom * 1.4;
    if (!best || score < best.score) best = { ...candidate, score };
  }
  return best ? { x: best.x, y: best.y, z: best.z } : { x: point.x, y: point.y, z: point.z };
}
