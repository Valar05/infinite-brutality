import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const climbSource = fs.readFileSync(new URL('../src/player-climb.js', import.meta.url), 'utf8');

assert.match(mainSource, /const CLIMB_JUMP_REGRAB_LOCK_MS = 500;/, 'climb jump must suppress regrab for exactly 0.5s');
assert.match(mainSource, /createPlayerClimbApi \} from '\.\/player-climb\.js\?v=0\.8\.200'/, 'runtime must import cache-busted climb module');
assert.match(mainSource, /createPhysicsWorld, ensurePhysicsReady \} from '\.\/physics-world\.js\?v=0\.8\.200'/, 'runtime must import cache-busted physics module');
assert.match(mainSource, /climbRegrabUntil: 0,/, 'player state must track climb regrab lockout');
assert.match(mainSource, /player\.climbRegrabUntil = performance\.now\(\) \+ CLIMB_JUMP_REGRAB_LOCK_MS;/, 'jumping from climb must start regrab lockout');
assert.match(mainSource, /player\.velocity\.set\(normal\.x \* CLIMB_DETACH_BACK, CLIMB_DETACH_UP, normal\.z \* CLIMB_DETACH_BACK\);/, 'jumping while climbing must detach with upward and backward impulse');
assert.match(mainSource, /function findMantleTopSupport\(x, z, targetTopY\)/, 'mantle must be able to use nearby support, not only the climbed collider top');
assert.match(mainSource, /findMantleTopSupport,/, 'climb API must receive mantle support probe');
assert.match(mainSource, /if \(player\.mode === 'climb'\) \{\s+jump\(pointerId\);\s+\} else if \(player\.grounded\) \{/m, 'mobile jump button must call jump while climbing before the grounded-only charge path');
assert.match(mainSource, /tryBeginClimb\(true, physicsMove\.collisions\)/, 'Rapier wall contacts must feed airborne auto-climb');
assert.match(mainSource, /CLIMB_TERRAIN_LATERAL_SPAN: 3\.4/, 'freeform voxel climb must have a bounded lateral projection span');

assert.match(climbSource, /if \(player\.climbRegrabUntil && performance\.now\(\) < player\.climbRegrabUntil\) return false;/, 'tryBeginClimb must respect regrab suppression');
assert.match(climbSource, /function tryBeginClimb\(attachForward = true, wallContacts = \[\]\)/, 'tryBeginClimb must accept physics wall contacts');
assert.match(climbSource, /contact\?\.isWall/, 'freeform climb must only attach to wall-class physics contacts');
assert.match(climbSource, /kind: 'terrain'/, 'player climb state must support freeform terrain projection');
assert.match(climbSource, /function enterTerrainClimb/, 'terrain wall contacts must enter a dedicated climb projection path');
assert.match(climbSource, /findMantleTopSupport,/, 'climb module must accept a mantle support probe');
assert.match(climbSource, /findMantleTopSupport\?\.\(candidate\.x, candidate\.z, targetTopY\)/, 'terrain mantle must probe visible terrain support near the current lip');
assert.match(climbSource, /findMantleTopSupport\?\.\(candidate\.x, candidate\.z, climb\.topY\)/, 'surface mantle must probe support near the top');
assert.match(climbSource, /findMantleTopSupport\?\.\(x, z, solid\.maxY\)/, 'solid mantle must probe nearby support when the wall top is too thin');
assert.match(climbSource, /supportCandidates = \[/, 'solid mantle must test more than one exact edge point');
assert.match(climbSource, /if \(!target\) target = \{ x: endX, z: endZ, topY: solid\.maxY \};/, 'solid mantle must not silently fail on thin wall tops');

console.log(JSON.stringify({ ok: true, contract: 'player-climb-mantle-jump' }));
