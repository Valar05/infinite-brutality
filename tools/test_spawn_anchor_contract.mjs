import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateSpawnCandidate, findSpawnAnchor } from '../src/spawn-anchor.js';

const eyeHeight = 1.68;
const solidRadius = 0.38;

const centerPlatform = (x, z) => Math.abs(x) <= 1.0 && Math.abs(z) <= 1.0;
const sideSlope = (x, z) => x >= 1.1 && x <= 2.4 && Math.abs(z) <= 1.0;
const topShelf = (x, z) => x >= 2.6 && x <= 4.8 && Math.abs(z) <= 1.4;

function supportAtFeet(x, z) {
  if (centerPlatform(x, z)) return { topY: 0.85 };
  if (sideSlope(x, z)) return { topY: 0.35 };
  if (topShelf(x, z)) return { topY: 1.15 };
  return null;
}

function isTorsoBlocked() {
  return false;
}

function measureHeadroom(x, z) {
  if (centerPlatform(x, z)) return 0.18;
  if (sideSlope(x, z)) return 1.2;
  if (topShelf(x, z)) return 2.4;
  return 0;
}

const blockedCenter = evaluateSpawnCandidate({
  x: 0,
  z: 0,
  baseFeetY: 0.85,
  eyeHeight,
  solidRadius,
  supportAtFeet,
  isTorsoBlocked,
  measureHeadroom,
});
assert.equal(blockedCenter, null, 'supported points under a low rock ceiling must be rejected as spawn candidates');

const shelf = evaluateSpawnCandidate({
  x: 3.2,
  z: 0,
  baseFeetY: 0.85,
  eyeHeight,
  solidRadius,
  supportAtFeet,
  isTorsoBlocked,
  measureHeadroom,
});
assert.ok(shelf, 'an open top shelf should remain a valid spawn candidate');
assert.ok(shelf.topY > 1.0, 'valid spawn shelf should preserve a higher top surface');
assert.ok(shelf.headroom >= 2.0, 'valid spawn shelf should have open headroom');

const chosen = findSpawnAnchor({
  point: { x: 0, y: eyeHeight + 0.85, z: 0 },
  lookTarget: { x: 0, y: eyeHeight + 0.85, z: 5 },
  eyeHeight,
  solidRadius,
  supportAtFeet,
  isTorsoBlocked,
  measureHeadroom,
});
assert.ok(chosen.x >= 2.5, 'spawn search must leave the blocked center and choose the open top shelf');
assert.ok(chosen.y > eyeHeight + 1.0, 'spawn search must prefer the higher shelf over low side ejection');

const mainSource = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
assert.match(mainSource, /measurePlayerHeadroomAtPosition/, 'runtime spawn logic must measure headroom above the player, not only torso clearance');
assert.match(mainSource, /measureHeadroom: measurePlayerHeadroomAtPosition/, 'runtime spawn search must wire headroom checks into the chooser');
assert.match(mainSource, /import \{ evaluateSpawnCandidate as evaluateSpawnAnchorCandidate, findSpawnAnchor as findBestSpawnAnchor \} from '\.\/spawn-anchor\.js\?v=0\.8\.\d+';/, 'main.js must use the shared spawn-anchor helper');

console.log(JSON.stringify({ ok: true, contract: 'spawn-anchor', chosen }));
