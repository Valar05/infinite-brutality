import * as THREE from 'three';
import { generateControllerArena } from './controller-kata.js';
import { applyWorldGridOverlay } from './controller-grid-material.js';
import { createPhysicsWorld, ensurePhysicsReady } from './physics-world.js';

const C={eye:1.68,radius:.38,jumpCharge:.18,jump:7.1,jumpExtra:.95,runJump:4.45,runJumpY:.5,jumpHold:11.75,groundAccel:28,friction:13.5,walk:5.2,run:8.8,air:6.2,airMax:8.8,airTurn:14,airBrake:19.5,airDrag:3.4,runBuild:1,stick:1.28,smoothGround:13.5,smoothAir:9.5,gravity:14.4,dt:1/60};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const forward=y=>new THREE.Vector3(-Math.sin(y),0,-Math.cos(y));
const right=y=>new THREE.Vector3(Math.cos(y),0,-Math.sin(y));

export async function createControllerKataRuntime(o={}){
 const d=o.document||document,w=o.window||window,canvas=o.canvas||d.getElementById('kata');
 const status=d.getElementById('status'),hint=d.getElementById('hint'),stick=d.getElementById('stick'),knob=stick.querySelector('i'),jumpButton=d.getElementById('jump'),gyroButton=d.getElementById('gyro');
 const baseSeed=new URLSearchParams(w.location.search).get('seed')||'vlad';
 await ensurePhysicsReady();
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(1,w.devicePixelRatio||1)); renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(); scene.background=new THREE.Color(0x071014); scene.fog=new THREE.Fog(0x071014,42,112);
 const camera=new THREE.PerspectiveCamera(74,1,.05,130); camera.rotation.order='YXZ';
 scene.add(new THREE.HemisphereLight(0xc8f8ff,0x122126,1.8)); const sun=new THREE.DirectionalLight(0xe7fdff,1.8); sun.position.set(-12,24,-8); scene.add(sun);
 let physics=createPhysicsWorld(),group=null,arena,runIndex=0,startedAt=performance.now(),best=Number(w.localStorage.getItem('controller-kata-best')||0);
 const player={position:new THREE.Vector3(),velocity:new THREE.Vector3(),yaw:Math.PI,pitch:0,grounded:true,runCharge:0,isRunning:false,lastRunIntent:false};
 const input={moveX:0,moveY:0,smoothMoveX:0,smoothMoveY:0,stickPointer:null,lookPointer:null,lastLookX:0,lastLookY:0,gyro:false,gyroYaw:0,gyroPitch:0,gyroBaseGamma:null,gyroBaseBeta:null,jumpPointer:null,jumpHoldStart:0,jumpCharging:false};

 function buildArena(){
  if(group){scene.remove(group);group.traverse(x=>{x.geometry?.dispose();if(x.material){(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m.dispose())}});physics.dispose();physics=createPhysicsWorld()}
  group=new THREE.Group();scene.add(group);arena=generateControllerArena({seed:runIndex?`${baseSeed}:${runIndex}`:baseSeed});
  const fm=applyWorldGridOverlay(new THREE.MeshStandardMaterial({color:0x10262d,roughness:.92}),{gridColor:0x9cefff,gridScale:1,gridThickness:.58,gridStrength:.3,edgeStrength:.12});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(...arena.floor.size),fm);floor.position.fromArray(arena.floor.center);group.add(floor);physics.addCuboid({size:arena.floor.size,position:arena.floor.center,source:'floor',kind:'floor'});
  const boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x607078,roughness:.88}),arena.cubes.length),m=new THREE.Matrix4();
  arena.cubes.forEach((cube,i)=>{m.compose(new THREE.Vector3().fromArray(cube.center),new THREE.Quaternion(),new THREE.Vector3().fromArray(cube.size));boxes.setMatrixAt(i,m);physics.addCuboid({size:cube.size,position:cube.center,source:cube.id,kind:'cube'})});boxes.instanceMatrix.needsUpdate=true;group.add(boxes);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,6,8),new THREE.MeshBasicMaterial({color:0x49efff}));beam.position.set(arena.exit[0],3,arena.exit[2]);group.add(beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(arena.exitRadius-.12,arena.exitRadius,32),new THREE.MeshBasicMaterial({color:0x49efff,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(arena.exit[0],.012,arena.exit[2]);group.add(ring);
  player.position.fromArray(arena.spawn);player.velocity.set(0,0,0);player.yaw=Math.PI;player.pitch=0;player.grounded=true;player.runCharge=0;player.isRunning=false;input.smoothMoveX=0;input.smoothMoveY=0;startedAt=performance.now();
 }
 function commitJump(force=0,charge=0,keep=false){
  if(!player.grounded)return;const f=forward(player.yaw).normalize(),r=right(player.yaw).normalize(),blend=new THREE.Vector3().addScaledVector(f,input.moveY).addScaledVector(r,input.moveX);if(blend.lengthSq()>1)blend.normalize();
  const horizontal=new THREE.Vector3(player.velocity.x,0,player.velocity.z),speed=horizontal.length(),dir=speed>.05?horizontal.multiplyScalar(1/speed):(blend.lengthSq()>.0001?blend.normalize():f);
  const ratio=clamp(charge/C.jumpCharge,0,1),chargeBoost=(1-Math.pow(1-ratio,4))*C.jumpExtra;
  player.velocity.y=Math.max(player.velocity.y,player.isRunning?C.jump+C.runJumpY+force+Math.min(.4,speed*.07):C.jump+chargeBoost+force);
  if(player.isRunning){const boost=C.runJump+Math.min(1.6,speed*.28)+force;player.velocity.x+=dir.x*boost;player.velocity.z+=dir.z*boost}player.grounded=false;
  if(!keep){input.jumpCharging=false;input.jumpHoldStart=0;input.jumpPointer=null}
 }
 function jump(id=null){if(!player.grounded)return;if(player.isRunning){commitJump(.75);return}input.jumpPointer=id;input.jumpCharging=true;input.jumpHoldStart=performance.now();commitJump(0,0,true)}
 function step(dt){
  const now=performance.now(),rate=player.grounded?C.smoothGround:C.smoothAir,blend=1-Math.exp(-rate*dt);input.smoothMoveX+=(input.moveX-input.smoothMoveX)*blend;input.smoothMoveY+=(input.moveY-input.smoothMoveY)*blend;
  if(Math.abs(input.moveX)<.001&&Math.abs(input.smoothMoveX)<.015)input.smoothMoveX=0;if(Math.abs(input.moveY)<.001&&Math.abs(input.smoothMoveY)<.015)input.smoothMoveY=0;
  const x=input.smoothMoveX,y=input.smoothMoveY,desired=new THREE.Vector3().addScaledVector(forward(player.yaw),y).addScaledVector(right(player.yaw),x);if(desired.lengthSq()>1)desired.normalize();const magnitude=Math.hypot(x,y),building=player.grounded&&y>.56&&Math.abs(x)<=Math.max(.001,y)&&magnitude>.55;
  if(building)player.runCharge=Math.min(C.runBuild,player.runCharge+dt);else if(player.grounded)player.runCharge=Math.max(0,player.runCharge-dt*2.2);else player.runCharge=Math.max(0,player.runCharge-dt*.15);player.isRunning=player.grounded&&player.runCharge>=C.runBuild;if(player.isRunning)player.lastRunIntent=true;else if(player.grounded&&magnitude<.18)player.lastRunIntent=false;
  const wishSpeed=player.grounded?C.walk+(C.run-C.walk)*clamp(player.runCharge/C.runBuild,0,1):C.air;
  if(player.grounded){const speed=Math.hypot(player.velocity.x,player.velocity.z);if(speed>.001){const next=Math.max(0,speed-speed*C.friction*dt);player.velocity.x*=next/speed;player.velocity.z*=next/speed}}
  const dir=desired.lengthSq()>.0001?desired.normalize():desired;
  if(!player.grounded){const h=new THREE.Vector3(player.velocity.x,0,player.velocity.z),speed=h.length();if(dir.lengthSq()>.0001){const add=wishSpeed-h.dot(dir);if(add>0)h.addScaledVector(dir,Math.min(C.airTurn*Math.max(.35,magnitude)*dt,add));else if(add<0)h.addScaledVector(dir,Math.min(-add,C.airBrake*dt))}if(speed>C.airMax){const over=speed-C.airMax,drag=Math.min(over,C.airDrag*dt+over*.12*dt);h.multiplyScalar((speed-drag)/speed)}player.velocity.x=h.x;player.velocity.z=h.z}
  else if(dir.lengthSq()>.0001){const add=wishSpeed-player.velocity.dot(dir);if(add>0)player.velocity.addScaledVector(dir,Math.min(C.groundAccel*wishSpeed*dt,add))}
  if(!player.grounded&&input.jumpCharging&&input.jumpHoldStart&&player.velocity.y>0){const held=clamp((now-input.jumpHoldStart)/1000,0,C.jumpCharge);player.velocity.y+=C.jumpHold*(1-held/C.jumpCharge)*dt}
  player.velocity.y-=C.gravity*dt;const move=physics.movePlayer({eyePosition:player.position,desiredDelta:{x:player.velocity.x*dt,y:player.velocity.y*dt,z:player.velocity.z*dt},eyeHeight:C.eye,radius:C.radius});player.position.set(move.eyePosition.x,move.eyePosition.y,move.eyePosition.z);player.velocity.x=move.movement.x/dt;player.velocity.z=move.movement.z/dt;player.velocity.y=move.grounded&&player.velocity.y<=0?0:move.movement.y/dt;const wasGrounded=player.grounded;player.grounded=move.grounded;
  if(!wasGrounded&&player.grounded&&player.isRunning&&input.jumpCharging&&input.jumpHoldStart&&player.lastRunIntent&&now-input.jumpHoldStart>35)commitJump(.15);player.position.x=clamp(player.position.x,-48,48);player.position.z=clamp(player.position.z,-48,48);
  if(player.position.y<-10){player.position.fromArray(arena.spawn);player.velocity.set(0,0,0)}
  if(player.grounded&&Math.hypot(player.position.x-arena.exit[0],player.position.z-arena.exit[2])<arena.exitRadius){const elapsed=(performance.now()-startedAt)/1000;if(!best||elapsed<best){best=elapsed;w.localStorage.setItem('controller-kata-best',String(best))}runIndex++;buildArena()}
  camera.position.copy(player.position);camera.rotation.y=player.yaw+input.gyroYaw;camera.rotation.x=player.pitch+input.gyroPitch;
 }
 function moveStick(e){const rect=stick.getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),max=rect.width*.36,len=Math.min(max,Math.hypot(dx,dy)),a=Math.atan2(dy,dx),x=Math.cos(a)*len,y=Math.sin(a)*len;knob.style.transform=`translate(${x}px,${y}px)`;input.moveX=Math.sign(x)*Math.pow(Math.abs(x/max),C.stick);input.moveY=Math.sign(-y)*Math.pow(Math.abs(y/max),C.stick)}
 function endPointer(e){if(e.pointerId===input.stickPointer){input.stickPointer=null;input.moveX=0;input.moveY=0;knob.style.transform='translate(0,0)';stick.classList.remove('active')}if(e.pointerId===input.lookPointer)input.lookPointer=null;if(e.pointerId===input.jumpPointer){input.jumpPointer=null;input.jumpCharging=false;input.jumpHoldStart=0}}
 canvas.addEventListener('pointerdown',e=>{hint.hidden=true;if(e.clientX<w.innerWidth*.44){input.stickPointer=e.pointerId;stick.style.left=`${clamp(e.clientX-63,6,w.innerWidth*.44-126)}px`;stick.style.top=`${clamp(e.clientY-63,6,w.innerHeight-132)}px`;stick.classList.add('active');moveStick(e)}else{input.lookPointer=e.pointerId;input.lastLookX=e.clientX;input.lastLookY=e.clientY}e.preventDefault()});
 w.addEventListener('pointermove',e=>{if(e.pointerId===input.stickPointer)moveStick(e);if(e.pointerId===input.lookPointer){player.yaw-=(e.clientX-input.lastLookX)*.0065;player.pitch=clamp(player.pitch-(e.clientY-input.lastLookY)*.0053,-1.15,1.1);input.lastLookX=e.clientX;input.lastLookY=e.clientY}if(e.pointerId===input.stickPointer||e.pointerId===input.lookPointer)e.preventDefault()},{passive:false});w.addEventListener('pointerup',endPointer);w.addEventListener('pointercancel',endPointer);jumpButton.addEventListener('pointerdown',e=>{jump(e.pointerId);e.preventDefault()});
 const keys={KeyW:['moveY',1],KeyS:['moveY',-1],KeyA:['moveX',-1],KeyD:['moveX',1]};w.addEventListener('keydown',e=>{if(keys[e.code])input[keys[e.code][0]]=keys[e.code][1];if(e.code==='Space'&&!e.repeat){jump();e.preventDefault()}});w.addEventListener('keyup',e=>{const k=keys[e.code];if(k&&input[k[0]]===k[1])input[k[0]]=0;if(e.code==='Space'){input.jumpCharging=false;input.jumpHoldStart=0}});
 gyroButton?.addEventListener('click',async()=>{if(!input.gyro&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')return;input.gyro=!input.gyro;input.gyroBaseGamma=null;input.gyroBaseBeta=null;input.gyroYaw=0;input.gyroPitch=0;gyroButton.classList.toggle('active',input.gyro)});
 w.addEventListener('deviceorientation',e=>{if(!input.gyro)return;const g=Number(e.gamma||0),b=Number(e.beta||0);if(input.gyroBaseGamma===null){input.gyroBaseGamma=g;input.gyroBaseBeta=b}input.gyroYaw=clamp(THREE.MathUtils.degToRad(g-input.gyroBaseGamma)*.72,-.42,.42);input.gyroPitch=clamp(THREE.MathUtils.degToRad(b-input.gyroBaseBeta)*.44,-.28,.28)});
 function resize(){const x=Math.max(1,w.innerWidth),y=Math.max(1,w.innerHeight);renderer.setSize(x,y,false);camera.aspect=x/y;camera.updateProjectionMatrix()}w.addEventListener('resize',resize);resize();buildArena();
 let previous=performance.now(),accumulator=0;function frame(now){accumulator=Math.min(.1,accumulator+(now-previous)/1000);previous=now;while(accumulator>=C.dt){step(C.dt);accumulator-=C.dt}const elapsed=(now-startedAt)/1000,speed=Math.hypot(player.velocity.x,player.velocity.z),motion=player.grounded?(player.isRunning?'RUN':'GROUND'):'AIR';status.value=`K03  ${motion}  ${speed.toFixed(1)}m/s  60Hz  seed ${arena.seedText}  cubes ${arena.cubes.length}  ${elapsed.toFixed(1)}s${best?`  best ${best.toFixed(1)}s`:''}`;renderer.render(scene,camera);w.requestAnimationFrame(frame)}w.requestAnimationFrame(frame);
 return{renderer,scene,camera,get physics(){return physics},player,input};
}
createControllerKataRuntime().catch(error=>{console.error(error);const el=document.getElementById('status');if(el)el.value=`boot error: ${error.message||error}`});
