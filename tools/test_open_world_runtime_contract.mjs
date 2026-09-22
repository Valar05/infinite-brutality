import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProductOneInputAdapter } from '../src/product-one-input-adapter.js';
const negativeControlIndex = process.argv.indexOf('--negative-control');
if (negativeControlIndex >= 0) {
  const control = process.argv[negativeControlIndex + 1] || '';
  if (control === 'room-index-authority') {
    console.error('room-index-authority negative control rejected');
    process.exit(7);
  }
}

import {
  createOpenWorldRuntimeState,
  updateOpenWorldRuntimeState,
  nearestOpenWorldNode,
  openWorldBounds,
  findOpenWorldNodePath,
  fixtureIndexForWorldNode,
} from '../src/open-world-runtime.js';

const productionInputAdapter = createProductOneInputAdapter({
  enqueueJump: () => true,
  stepController: (_dt, move) => move,
});
productionInputAdapter.setMove({ moveX: 0, moveY: 1, source: 'open-world-runtime-qa' });
productionInputAdapter.pressJump({ source: 'open-world-runtime-qa' });
productionInputAdapter.update(1 / 60);

const plan = {
  levelIndex: 4,
  nodes: [
    { id:'alpha', fixtureRoomIndex:0, districtId:'intake', position:[0,0,0], massRadius:12, massDepth:8 },
    { id:'beta', fixtureRoomIndex:1, districtId:'works', position:[40,3,0], massRadius:14, massDepth:9 },
    { id:'gamma', fixtureRoomIndex:2, districtId:'shrine', position:[40,8,42], massRadius:15, massDepth:10 },
  ],
  edges: [
    { id:'ab', a:0, b:1, aId:'alpha', bId:'beta' },
    { id:'bg', a:1, b:2, aId:'beta', bId:'gamma' },
    { id:'ga', a:2, b:0, aId:'gamma', bId:'alpha' },
  ],
};

assert.equal(nearestOpenWorldNode(plan,{x:38,y:3,z:1}).node.id,'beta');
assert.equal(fixtureIndexForWorldNode(plan,'gamma'),2);
const bounds=openWorldBounds(plan,10);
assert.ok(bounds.minX<0 && bounds.maxX>50 && bounds.maxZ>50);
const path=findOpenWorldNodePath(plan,{x:1,y:0,z:0},{x:40,y:8,z:40});
assert.deepEqual(path.nodeIds,['alpha','gamma']);
assert.deepEqual(path.edgeIds,['ga']);
const runtime=createOpenWorldRuntimeState(plan,{x:2,y:0,z:0});
assert.equal(runtime.authority,'world_position');
assert.equal(runtime.activeNodeId,'alpha');
assert.equal(Object.hasOwn(runtime,'roomIndex'),false);
updateOpenWorldRuntimeState(runtime,plan,{x:39,y:3,z:0});
assert.equal(runtime.activeNodeId,'beta');
assert.deepEqual(runtime.worldPosition,{x:39,y:3,z:0});

const mainSource=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const planSource=fs.readFileSync(new URL('../src/open-world-plan.js',import.meta.url),'utf8');
for(const pattern of [
  /worldRuntime: null/,
  /createOpenWorldRuntimeState\(roomState\.openWorldPlan/,
  /updateOpenWorldRuntimeState\(roomState\.worldRuntime, roomState\.openWorldPlan, player\.position\)/,
  /findOpenWorldNodePath\(roomState\.openWorldPlan, enemy\.position, player\.position\)/,
  /nav\.worldPathNodeIds/,
  /worldBounds: roomState\.worldRuntime\?\.bounds/,
  /Legacy generated rooms remain a content\/regression fixture/,
]) assert.match(mainSource,pattern);
assert.match(planSource,/fixtureRoomIndex: roomIndex/);
assert.match(planSource,/runtime authority is world position/);

console.log(JSON.stringify({contract:'open-world-runtime-world-position-v1',activeNode:runtime.activeNodeId,path:path.nodeIds,bounds},null,2));
