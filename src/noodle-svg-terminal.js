// Projection, near-plane clipping, backface culling, and painter ordering are
// source-faithful extractions from verified noodle3d.html. This module is the
// terminal SVG opinion; it owns no game state, input, collision, or timing.
const NS = 'http://www.w3.org/2000/svg';
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function projectNoodleFrame(frame, viewport = {}) {
  const width = Number(viewport.width) || 800;
  const height = Number(viewport.height) || 450;
  const focal = Number(viewport.focal) || Math.min(width, height) * 1.05;
  const near = Number(viewport.near) || 0.12;
  const camera = frame.camera;
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const toCamera = (point) => {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    const x = dx * cy - dz * sy;
    const flatZ = -dx * sy - dz * cy;
    return { x, y: dy * cp - flatZ * sp, z: dy * sp + flatZ * cp };
  };
  const project = (point) => ({ x: width / 2 + focal * point.x / point.z, y: height / 2 - focal * point.y / point.z, z: point.z });
  const clipLine = (first, second) => {
    let a = toCamera(first);
    let b = toCamera(second);
    if (a.z < near && b.z < near) return null;
    if (a.z < near) {
      const t = (near - a.z) / (b.z - a.z);
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near };
    }
    if (b.z < near) {
      const t = (near - b.z) / (a.z - b.z);
      b = { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t, z: near };
    }
    return [project(a), project(b)];
  };
  const clipPolygon = (points) => {
    const output = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index], previous = points[(index + points.length - 1) % points.length];
      const currentInside = current.z >= near, previousInside = previous.z >= near;
      if (currentInside !== previousInside) {
        const t = (near - previous.z) / (current.z - previous.z);
        output.push({ x: previous.x + (current.x - previous.x) * t, y: previous.y + (current.y - previous.y) * t, z: near });
      }
      if (currentInside) output.push(current);
    }
    return output;
  };
  const polygon = (points, fill, kind, id) => {
    const cameraPoints = clipPolygon(points.map(toCamera));
    if (cameraPoints.length < 3) return null;
    const screen = cameraPoints.map(project);
    let area = 0;
    for (let index = 0; index < screen.length; index += 1) {
      const a = screen[index];
      const b = screen[(index + 1) % screen.length];
      area += a.x * b.y - b.x * a.y;
    }
    if (area >= 0) return null;
    return {
      depth: cameraPoints.reduce((sum, point) => sum + point.z, 0) / cameraPoints.length,
      fill,
      kind,
      id,
      points: screen.map((point) => [point.x, point.y]),
    };
  };

  const lines = [];
  const gridStep = Number(frame.gridStep) || 4;
  const gridHalf = Number(frame.gridHalf) || 48;
  for (let value = -gridHalf; value <= gridHalf; value += gridStep) {
    for (const segment of [
      [{ x: value, y: 0, z: -gridHalf }, { x: value, y: 0, z: gridHalf }],
      [{ x: -gridHalf, y: 0, z: value }, { x: gridHalf, y: 0, z: value }],
    ]) {
      const clipped = clipLine(segment[0], segment[1]);
      if (clipped) lines.push(clipped);
    }
  }

  const faces = [];
  for (const object of frame.cuboids || []) {
    const center = object.center;
    const size = object.size;
    const x0 = center[0] - size[0] / 2;
    const x1 = center[0] + size[0] / 2;
    const y0 = center[1] - size[1] / 2;
    const y1 = center[1] + size[1] / 2;
    const z0 = center[2] - size[2] / 2;
    const z1 = center[2] + size[2] / 2;
    const vertices = [
      { x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 },
      { x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 },
    ];
    const palette = object.kind === 'exit'
      ? ['#8fffff', '#53dce8', '#32aebd', '#6cf4ff', '#238b99']
      : object.kind === 'course'
        ? ['#d6a642', '#8a6120', '#bb852c', '#72501b', '#9a6b21']
        : ['#72838a', '#34474e', '#50636b', '#293a40', '#42555c'];
    const definitions = [
      [[4, 5, 6, 7], 0], [[0, 4, 7, 3], 1], [[1, 2, 6, 5], 2], [[0, 1, 5, 4], 3], [[3, 7, 6, 2], 4],
    ];
    for (const definition of definitions) {
      const face = polygon(definition[0].map((index) => vertices[index]), palette[definition[1]], object.kind || 'box', object.id || '');
      if (face) faces.push(face);
    }
  }
  faces.sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
  return { width, height, lines, faces };
}

export function createNoodleSvgTerminal(options = {}) {
  const svg = options.svg;
  if (!svg || typeof svg.replaceChildren !== 'function') throw new TypeError('SVG terminal requires one SVG owner');
  const scene = svg.querySelector('[data-noodle-scene]');
  if (!scene) throw new TypeError('SVG terminal scene layer missing');
  function element(name, attributes) {
    const node = svg.ownerDocument.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  return Object.freeze({
    render(frame) {
      const width = Math.max(1, svg.clientWidth || 800);
      const height = Math.max(1, svg.clientHeight || 450);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      const reticle = svg.querySelector('#reticle');
      if (reticle) reticle.setAttribute('d', 'M' + (width / 2 - 10) + ' ' + (height / 2) + 'h20M' + (width / 2) + ' ' + (height / 2 - 10) + 'v20');
      const projected = projectNoodleFrame(frame, { width, height });
      const fragment = svg.ownerDocument.createDocumentFragment();
      for (const line of projected.lines) {
        fragment.append(element('path', {
          class: 'noodle-gridline',
          d: 'M' + line[0].x.toFixed(1) + ' ' + line[0].y.toFixed(1) + 'L' + line[1].x.toFixed(1) + ' ' + line[1].y.toFixed(1),
        }));
      }
      for (const face of projected.faces) {
        fragment.append(element('polygon', {
          class: 'noodle-face',
          'data-kind': face.kind,
          'data-source': face.id,
          points: face.points.map((point) => point[0].toFixed(1) + ',' + point[1].toFixed(1)).join(' '),
          fill: face.fill,
        }));
      }
      scene.replaceChildren(fragment);
      return { lines: projected.lines.length, faces: projected.faces.length };
    },
  });
}
