function projectBounds(rooms) {
  const minX = Math.min(...rooms.map((room) => room.bounds.min[0]));
  const maxX = Math.max(...rooms.map((room) => room.bounds.max[0]));
  const minZ = Math.min(...rooms.map((room) => room.bounds.min[2]));
  const maxZ = Math.max(...rooms.map((room) => room.bounds.max[2]));
  return { minX, maxX, minZ, maxZ };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

export function renderRouteGraphSvg(structure) {
  const rooms = structure.rooms;
  const bounds = projectBounds(rooms);
  const width = 900;
  const height = 640;
  const pad = 48;
  const sx = (width - pad * 2) / Math.max(1, bounds.maxX - bounds.minX);
  const sz = (height - pad * 2) / Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(sx, sz);
  const px = (x) => pad + (x - bounds.minX) * scale;
  const pz = (z) => height - pad - (z - bounds.minZ) * scale;
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    '<rect width="100%" height="100%" fill="#111318"/>',
    '<text x="24" y="28" fill="#e8dcc2" font-family="monospace" font-size="18">quake geometry ingest route graph</text>',
  ];
  for (const edge of structure.roomGraph.edges) {
    const a = roomById.get(edge.from);
    const b = roomById.get(edge.to);
    if (!a || !b) continue;
    const color = edge.kind === 'locked_gate' ? '#ff6a5e' : (edge.kind === 'ledge' ? '#f3bf4f' : '#7cc7ff');
    lines.push(`<line x1="${px(a.center[0]).toFixed(1)}" y1="${pz(a.center[2]).toFixed(1)}" x2="${px(b.center[0]).toFixed(1)}" y2="${pz(b.center[2]).toFixed(1)}" stroke="${color}" stroke-width="4" opacity="0.85"/>`);
    const mx = (px(a.center[0]) + px(b.center[0])) * 0.5;
    const my = (pz(a.center[2]) + pz(b.center[2])) * 0.5;
    lines.push(`<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" fill="${color}" font-family="monospace" font-size="12">${escapeXml(edge.kind)}</text>`);
  }
  for (const room of rooms) {
    const x = px(room.bounds.min[0]);
    const y = pz(room.bounds.max[2]);
    const w = Math.max(8, (room.bounds.max[0] - room.bounds.min[0]) * scale);
    const h = Math.max(8, (room.bounds.max[2] - room.bounds.min[2]) * scale);
    const fill = room.role === 'secret' ? '#50375f' : (room.role === 'side' ? '#3f4f5f' : '#2d333d');
    lines.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="#d7c7a7" stroke-width="2" opacity="0.88"/>`);
    lines.push(`<circle cx="${px(room.center[0]).toFixed(1)}" cy="${pz(room.center[2]).toFixed(1)}" r="5" fill="#f4e9cd"/>`);
    lines.push(`<text x="${(x + 6).toFixed(1)}" y="${(y + 18).toFixed(1)}" fill="#f4e9cd" font-family="monospace" font-size="13">${escapeXml(room.label)}</text>`);
  }
  for (const candidate of structure.roomGraph.sidePathCandidates) {
    const room = roomById.get(candidate.roomId);
    if (!room) continue;
    lines.push(`<text x="${px(room.center[0] + 0.25).toFixed(1)}" y="${pz(room.center[2] - 0.25).toFixed(1)}" fill="#ffcb6b" font-family="monospace" font-size="14">${escapeXml(candidate.kind)}</text>`);
  }
  lines.push('</svg>');
  return lines.join('\n') + '\n';
}
