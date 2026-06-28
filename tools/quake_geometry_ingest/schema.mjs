export const DEFAULT_QUAKE_UNITS_PER_IB_UNIT = 32;

export function assertNeutralGeometry(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('neutral geometry must be an object');
  if (!Array.isArray(payload.brushes)) throw new Error('neutral geometry requires brushes[]');
  if (!Array.isArray(payload.entities)) throw new Error('neutral geometry requires entities[]');
  for (const brush of payload.brushes) {
    if (!brush.id) throw new Error('brush missing id');
    if (!Array.isArray(brush.min) || brush.min.length !== 3) throw new Error(`brush ${brush.id} missing min[3]`);
    if (!Array.isArray(brush.max) || brush.max.length !== 3) throw new Error(`brush ${brush.id} missing max[3]`);
  }
  return payload;
}

export function quakeToIbPoint(point, scale = DEFAULT_QUAKE_UNITS_PER_IB_UNIT) {
  return [point[0] / scale, point[2] / scale, point[1] / scale];
}

export function quakeBrushToIbBox(brush, scale = DEFAULT_QUAKE_UNITS_PER_IB_UNIT) {
  const a = quakeToIbPoint(brush.min, scale);
  const b = quakeToIbPoint(brush.max, scale);
  return {
    id: brush.id,
    kind: brush.kind || 'solid',
    tags: [...(brush.tags || [])],
    material: brush.material || 'stone',
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  };
}

export function boxCenter(box) {
  return [
    (box.min[0] + box.max[0]) * 0.5,
    (box.min[1] + box.max[1]) * 0.5,
    (box.min[2] + box.max[2]) * 0.5,
  ];
}

export function boxSize(box) {
  return [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
}

export function horizontalOverlap(a, b, margin = 0) {
  return a.min[0] <= b.max[0] + margin
    && a.max[0] >= b.min[0] - margin
    && a.min[2] <= b.max[2] + margin
    && a.max[2] >= b.min[2] - margin;
}

export function horizontalDistance(a, b) {
  const dx = a.max[0] < b.min[0] ? b.min[0] - a.max[0] : (b.max[0] < a.min[0] ? a.min[0] - b.max[0] : 0);
  const dz = a.max[2] < b.min[2] ? b.min[2] - a.max[2] : (b.max[2] < a.min[2] ? a.min[2] - b.max[2] : 0);
  return Math.hypot(dx, dz);
}

export function pointDistance2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
