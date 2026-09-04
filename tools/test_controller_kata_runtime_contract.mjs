import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createControllerKataCore } from '../src/controller-kata-core.js';
import { createControllerKataWorld } from '../src/controller-kata-world.js';
import { projectNoodleFrame } from '../src/noodle-svg-terminal.js';
import { CONTROLLER_KATA_BUILD_MANIFEST } from '../src/controller-kata-svg-build-manifest.js';
const text=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=text('../controller-kata.html'),runtime=text('../src/controller-kata-runtime.js'),coreSource=text('../src/controller-kata-core.js'),worldSource=text('../src/controller-kata-world.js'),terminalSource=text('../src/noodle-svg-terminal.js');
const provenance=JSON.parse(text('../src/noodle-svg-terminal.provenance.json'));
assert.match(html,/<svg id="game"/);assert.doesNotMatch(html,/<canvas|importmap|three\.module|WebGL/i);
assert.match(runtime,/createControllerKataWorld/);assert.match(runtime,/createNoodleSvgTerminal/);assert.match(runtime,/first-movement/);assert.match(runtime,/end-test-button/);
assert.doesNotMatch([runtime,coreSource,worldSource,terminalSource].join('\n'),/from ['"]three|THREE\.|rapier|WebGLRenderer|CanvasRenderingContext/i);
assert.deepEqual(provenance.authority.archive_sha256,'3a3888479d8048025c9cbfbd554aacb8df013664c44c4f27d554ea61a42f9d6b');
assert.deepEqual(provenance.authority.noodle3d_html_sha256,'9862656c631d2c2b2f1035774cef51060b38ff83f0977d35eecd5d89b262d749');
assert.equal(provenance.authority.baseline_controller_commit,'128f67fca0a3a4dbd602bcf30f6c7dc2ed7131a7');
for(const [path,expected] of Object.entries(CONTROLLER_KATA_BUILD_MANIFEST.modules)){const actual=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');assert.equal(actual,expected,`manifest hash drift: ${path}`)}
assert.equal(createHash('sha256').update(JSON.stringify(CONTROLLER_KATA_BUILD_MANIFEST.modules)).digest('hex'),CONTROLLER_KATA_BUILD_MANIFEST.graphSha256);
const freeWorld={movePlayer({eyePosition,desiredDelta}){const next={x:eyePosition.x+desiredDelta.x,y:eyePosition.y+desiredDelta.y,z:eyePosition.z+desiredDelta.z};let grounded=false,my=desiredDelta.y;if(next.y<=1.68){next.y=1.68;my=next.y-eyePosition.y;grounded=true}return{eyePosition:next,movement:{x:desiredDelta.x,y:my,z:desiredDelta.z},grounded,collisions:[]}}};
const snap=(label,tick,p)=>({label,tick,position:[p.position.x,p.position.y,p.position.z],velocity:[p.velocity.x,p.velocity.y,p.velocity.z],yaw:p.yaw,grounded:p.grounded,mode:p.mode,runCharge:p.runCharge,isRunning:p.isRunning,lastRunIntent:p.lastRunIntent});
function run(name,segments){const core=createControllerKataCore({world:freeWorld,spawn:{x:0,y:1.68,z:0}}),frames=[];let tick=0;for(const seg of segments){if(seg.jump)core.jump();for(let i=0;i<seg.ticks;i++){core.setMove(seg.input);core.update(1/60);tick++;if(seg.capture?.includes(i+1))frames.push(snap(seg.label,tick,core.state))}}return{name,frames}}
const actualTapes=[run('forward-release',[{label:'forward',ticks:60,input:{moveX:0,moveY:1},capture:[1,10,30,60]},{label:'release',ticks:60,input:{moveX:0,moveY:0},capture:[1,10,30,60]}]),run('right-strafe',[{label:'right',ticks:30,input:{moveX:1,moveY:0},capture:[1,10,30]}]),run('running-jump',[{label:'run',ticks:61,input:{moveX:0,moveY:1},capture:[60,61]},{label:'jump',ticks:1,input:{moveX:0,moveY:1},jump:true,capture:[1]},{label:'air',ticks:30,input:{moveX:.35,moveY:1},capture:[1,10,30]}])];
const golden=JSON.parse(text('../.qa/fixtures/controller-kata-baseline-128f67f.json'));
function near(a,b,path){if(typeof a==='number')assert.ok(Math.abs(a-b)<1e-10,`${path}: ${a} != ${b}`);else if(Array.isArray(a))a.forEach((x,i)=>near(x,b[i],path+'['+i+']'));else if(a&&typeof a==='object')for(const key of Object.keys(a))near(a[key],b[key],path+'.'+key);else assert.equal(a,b,path)}
near(actualTapes,golden.tapes,'baseline');
function mounted(topY){const world=createControllerKataWorld({autostepHeight:.62,snapToGround:.48});world.addCuboid({size:[20,.5,20],position:[0,-.25,0],source:'floor',kind:'floor'});world.addCuboid({size:[4,topY,2],position:[0,topY/2,1],source:'ledge',kind:'walkable'});return world}
function drive(topY,{jumpTick=-1,ticks=180,disableMantle=false}={}){const actualWorld=mounted(topY),world=disableMantle?{...actualWorld,getWalkableCuboid:()=>null}:actualWorld;const events=[],core=createControllerKataCore({world,spawn:{x:0,y:1.68,z:-1.5},onEvent:e=>events.push(e)});let maxY=core.state.position.y;for(let tick=0;tick<ticks;tick++){core.setMove({moveX:0,moveY:1});if(tick===jumpTick)core.jump();core.update(1/60);maxY=Math.max(maxY,core.state.position.y);if(events.some(e=>e.type==='mantle-complete'))break}return{core,events,maxY}}
const step=drive(.4,{ticks:90});assert.ok(step.maxY>=2.079999,'low step must autostep');assert.equal(step.events.some(e=>e.type==='mantle-start'),false);
const mantle=drive(1,{ticks:90});assert.ok(mantle.events.some(e=>e.type==='mantle-start'),'ordinary contact must mantle');assert.ok(mantle.events.some(e=>e.type==='mantle-complete'),'ordinary mantle must complete');assert.equal(mantle.core.state.grounded,true);assert.deepEqual([mantle.core.state.velocity.x,mantle.core.state.velocity.y,mantle.core.state.velocity.z],[0,0,0]);
const ablated=drive(1,{ticks:90,disableMantle:true});assert.equal(ablated.events.some(e=>e.type==='mantle-start'),false,'mantle ablation must change outcome');assert.ok(ablated.core.state.position.y<2.5);
const impossible=drive(5.5,{jumpTick:8,ticks:180});assert.equal(impossible.events.some(e=>e.type==='mantle-start'),false,'above-eye control must reject mantle');
const frame={camera:{x:0,y:1.68,z:0,yaw:0,pitch:0},gridStep:4,gridHalf:12,cuboids:[{id:'near',center:[0,1,-.15],size:[1,2,.2],kind:'course'}]};
const clipped=projectNoodleFrame(frame,{width:800,height:450});assert.ok(clipped.faces.length>0,'near-plane intersecting cuboid must remain visible');assert.deepEqual(clipped,projectNoodleFrame(JSON.parse(JSON.stringify(frame)),{width:800,height:450}));
const view=(camera)=>projectNoodleFrame({camera,gridStep:4,gridHalf:12,cuboids:[{id:'direction',center:[0,1,5],size:[2,2,2],kind:'course'}]},{width:800,height:450});
const cx=(projected)=>projected.faces.flatMap(f=>f.points).reduce((s,p)=>s+p[0],0)/projected.faces.flatMap(f=>f.points).length;
const center=view({x:0,y:1.68,z:0,yaw:Math.PI,pitch:0});assert.ok(center.faces.length>0);assert.ok(cx(view({x:-1,y:1.68,z:0,yaw:Math.PI,pitch:0}))<cx(center),'move-right must shift world left');assert.ok(cx(view({x:0,y:1.68,z:0,yaw:Math.PI-.2,pitch:0}))<cx(center),'look-right must shift old forward target left');
console.log(JSON.stringify({ok:true,contract:'controller-kata-noodle-v2',baseline:'128f67f',terminal:'svg',physics:'engine-neutral-cuboids',visual_acceptance:false}));
