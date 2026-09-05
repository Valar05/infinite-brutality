import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROLLER_AXIS, CORE_BEATS, PRESSURE_PACKS, catalogHash, controllerEnvelope, validatePressurePack } from "./catalog.mjs";

export const PROJECT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
export const DEFAULT_ARTIFACT_ROOT=resolve(PROJECT_ROOT,"generated/boxcraft_blocks/v1");
const sha=v=>createHash("sha256").update(typeof v==="string"?v:stable(v)).digest("hex");
export const stable=v=>Array.isArray(v)?`[${v.map(stable).join(",")}]`:v&&typeof v==="object"?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")}}`:JSON.stringify(v);
export function hashSeed(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const int=(r,n)=>Math.floor(r()*n);
const slug=s=>String(s).replace(/[^a-zA-Z0-9_.-]+/g,"-");
const atomic=async(path,text)=>{await mkdir(dirname(path),{recursive:true});const tmp=`${path}.tmp`;await writeFile(tmp,text);await rename(tmp,path)};
const json=async(path,v)=>atomic(path,JSON.stringify(v,null,2)+"\n");

export function parseBlockRequest(input){
  if(typeof input!=="string") return {status:"UNKNOWN",errors:["request must be text"]};
  const lines=input.replace(/\r/g,"").split("\n").filter(x=>x.trim()&&!x.trim().startsWith("#"));
  if(lines.shift()?.trim()!=="BLOCK REQUEST 1") return {status:"UNKNOWN",errors:["first line must be BLOCK REQUEST 1"]};
  const allowed=new Set(["id","seed","controller_axis","grammar","center","pressures","population","generations","bounds","require","forbid"]), raw={}, errors=[];
  for(const line of lines){const m=line.match(/^([a-z_]+):\s*(.*)$/);if(!m){errors.push(`invalid line: ${line}`);continue}if(!allowed.has(m[1])){errors.push(`unknown field: ${m[1]}`);continue}if(m[1] in raw)errors.push(`duplicate field: ${m[1]}`);raw[m[1]]=m[2].trim()}
  for(const k of allowed)if(!(k in raw))errors.push(`missing field: ${k}`);
  if(errors.length)return {status:"UNKNOWN",errors};
  const number=k=>/^\d+$/.test(raw[k])?Number(raw[k]):NaN;
  const axis=number("controller_axis"), population=number("population"), generations=number("generations");
  const bm=raw.bounds.match(/^(\d+)x(\d+)x(\d+)$/), list=k=>raw[k]?raw[k].split(",").map(x=>x.trim()).filter(Boolean):[];
  const bounds=bm?{width:+bm[1],height:+bm[2],layers:+bm[3]}:null;
  if(!Number.isInteger(axis)||axis<0||axis>100)errors.push("controller_axis must be 0..100");
  if(!["WALK","LOOP"].includes(raw.grammar))errors.push("grammar must be WALK or LOOP");
  if(!/^[A-Z][A-Z0-9_]*$/.test(raw.center))errors.push("center must be an uppercase center id");
  if(!Number.isInteger(population)||population<2||population>64)errors.push("population must be 2..64");
  if(!Number.isInteger(generations)||generations<1||generations>16)errors.push("generations must be 1..16");
  if(!bounds||bounds.width<16||bounds.width>64||bounds.height<16||bounds.height>64||bounds.layers<1||bounds.layers>8)errors.push("bounds must be WIDTHxHEIGHTxLAYERS within 16..64 x 16..64 x 1..8");
  if(bounds&&bounds.width*bounds.height*bounds.layers*population*generations*101>32000000)errors.push("request exceeds 32m cell work budget");
  const pressures=list("pressures");for(const p of pressures)if(!PRESSURE_PACKS.some(x=>x.id===p))errors.push(`unknown pressure: ${p}`);
  const require=list("require"), forbid=list("forbid");for(const b of [...require,...forbid])if(!CORE_BEATS.includes(b)&&b!==raw.center)errors.push(`unknown beat: ${b}`);
  if(!/^[a-zA-Z0-9_.-]+$/.test(raw.id))errors.push("id contains unsupported characters");
  return errors.length?{status:"UNKNOWN",errors}:{status:"PROCEED",spec:{id:raw.id,seed:raw.seed,controller_axis:axis,grammar:raw.grammar,center:raw.center,pressures,population,generations,bounds,require,forbid}};
}

function coreSequence(spec){
  const trunk=spec.grammar==="LOOP"?["START","READ","BUILD","COMMIT",spec.center,"CHANGE","RETURN","RESOLVE","EXIT"]:["START","READ","BUILD","COMMIT",spec.center,"RESOLVE","EXIT"];
  return {trunk,recovery:["COMMIT","RECOVER","RESOLVE"],edges:[...trunk.slice(0,-1).map((x,i)=>[x,trunk[i+1]]),["COMMIT","RECOVER"],["RECOVER","RESOLVE"]]};
}
const genotype=(r,i)=>({id:i,hand:r()<.5?-1:1,runway:.65+r()*.7,risk:.25+r()*.75,rise:.2+r()*.8,recovery:.65+r()*.35,satelliteThreshold:.25+r()*.65,turn:.2+r()*.8});
function mutate(g,r,generation){const keys=["runway","risk","rise","recovery","satelliteThreshold","turn"],k=keys[int(r,keys.length)];return {...g,id:g.id,[k]:Math.max(0,Math.min(1.4,g[k]+(r()-.5)/(generation+2)))}}
function cross(a,b,r,i,generation){const out={id:i,hand:r()<.5?a.hand:b.hand};for(const k of ["runway","risk","rise","recovery","satelliteThreshold","turn"])out[k]=r()<.5?a[k]:b[k];return mutate(out,r,generation)}
const set=(grid,x,y,c)=>{if(y>0&&y<grid.length-1&&x>0&&x<grid[0].length-1)grid[y][x]=c};
const carveLine=(grid,a,b,c=".")=>{let[x,y]=a,[tx,ty]=b;while(x!==tx){set(grid,x,y,c);x+=Math.sign(tx-x)}while(y!==ty){set(grid,x,y,c);y+=Math.sign(ty-y)}set(grid,x,y,c)};
function render(spec,g,axis){
  const {width:w,height:h}=spec.bounds,t=axis/100,grid=Array.from({length:h},()=>Array(w).fill("#"));
  const cy=Math.floor(h/2), margin=2, start=[margin,cy], read=[Math.max(3,Math.floor(w*.14)),cy];
  const commit=[Math.floor(w*(.36+.08*g.runway)),cy], center=[Math.floor(w*.54),cy-Math.round(g.turn*3)*g.hand], resolveP=[Math.floor(w*.74),cy], exit=[w-margin-1,cy];
  const pts=[start,read,commit,center,resolveP,exit];for(let i=0;i<pts.length-1;i++)carveLine(grid,pts[i],pts[i+1]);
  const recovery=[commit[0],Math.max(2,Math.min(h-3,cy+Math.round((3+4*g.recovery))*-g.hand))];carveLine(grid,commit,recovery,",");carveLine(grid,recovery,resolveP,",");
  if(spec.grammar==="LOOP"){const change=[center[0],Math.max(2,Math.min(h-3,center[1]+Math.round(4+4*g.turn)*g.hand))];carveLine(grid,center,change,"+");carveLine(grid,change,resolveP,"+");set(grid,change[0],change[1],"G")}
  const gap=Math.max(1,Math.round(g.risk*(1+6*t)));for(let x=commit[0]+1;x<Math.min(center[0],commit[0]+1+gap);x++)set(grid,x,cy,"~");
  if(spec.bounds.layers>1){set(grid,center[0]-1,center[1],"^");set(grid,center[0]+1,center[1],"v")}
  const satellite=t>=g.satelliteThreshold?"*":"s";set(grid,center[0],Math.max(2,center[1]-4),satellite);set(grid,center[0],Math.min(h-3,center[1]+4),satellite);
  set(grid,start[0],start[1],"S");set(grid,exit[0],exit[1],"X");set(grid,read[0],read[1],"R");set(grid,commit[0],commit[1],"C");set(grid,center[0],center[1],"M");set(grid,resolveP[0],resolveP[1],"O");
  const core=coreSequence(spec), signature=sha(core), map=["BLOCKMAP 1",`id: ${spec.id}`,`candidate: ${g.id}`,`axis: ${axis}`,`axis_label: ${axis===0?CONTROLLER_AXIS.zero:axis===100?CONTROLLER_AXIS.hundred:"INTERPOLATED"}`,`core_signature: ${signature}`,`legend: # mass . route , recovery ~ risk ^ up v down s dormant * active S start X exit R read C commit M center O resolve G gate`,...grid.map(row=>row.join(""))].join("\n")+"\n";
  const envelope=controllerEnvelope(axis), metrics={center_coherence:+(1-Math.abs(.75-g.turn)*.25).toFixed(4),flow:+Math.min(1,.45+.4*g.runway+.15*t).toFixed(4),commit_read:+Math.min(1,.5+.35*g.risk).toFixed(4),grounding:+Math.max(0,1-t*.25-g.rise*.15).toFixed(4),telegraph:+Math.min(1,.55+.3*g.runway).toFixed(4),recovery:+Math.min(1,.45+.5*g.recovery).toFixed(4),spectacle:+Math.min(1,.2+.65*t+.15*g.rise).toFixed(4)};
  const failures=[];if(g.risk*(1+6*t)>envelope.maxGap+.001)failures.push("gap_exceeds_controller_envelope");if(2+2*g.recovery<envelope.minRecoveryWidth)failures.push("recovery_too_narrow");
  return {axis,map,mapHash:sha(map),pipe:["PIPE 1",`axis: ${axis}`,`ground_speed: ${envelope.groundSpeed}`,`max_gap: ${envelope.maxGap}`,`max_rise: ${envelope.maxRise}`,`air_control: ${envelope.airControl}`,`satellite_authority: ${envelope.satelliteAuthority}`].join("\n")+"\n",metrics,failures,coreSignature:signature,activeSatellite:satellite==="*"};
}
function weights(axis,id){const t=axis/100;if(id==="modern-war@1")return 1-t;if(id==="quake-anime-bullshit@1")return t;if(id==="quake@1"||id==="clustertruck@1")return .35+.65*t;return 1}
function assess(spec,g){
  const maps=Array.from({length:101},(_,axis)=>render(spec,g,axis)), failures=[];
  const core=new Set(maps.map(x=>x.coreSignature));if(core.size!==1)failures.push("core_sequence_changed_across_axis");
  const seq=coreSequence(spec);for(const b of spec.require)if(!seq.trunk.includes(b)&&!seq.recovery.includes(b))failures.push(`required_beat_missing:${b}`);for(const b of spec.forbid)if(seq.trunk.includes(b)||seq.recovery.includes(b))failures.push(`forbidden_beat_present:${b}`);
  for(const m of maps)for(const f of m.failures)failures.push(`axis_${m.axis}:${f}`);
  let weighted=0,total=0,worst=1;for(const m of maps){let s=0,sw=0;for(const id of spec.pressures){const p=PRESSURE_PACKS.find(x=>x.id===id),w=weights(m.axis,id);s+=m.metrics[p.metric]*w;sw+=w}const n=sw?s/sw:1;weighted+=n;total++;worst=Math.min(worst,n)}
  const hard=[...new Set(failures)], mean=weighted/total, verdict=hard.length?"REJECT":"OBSERVE";
  return {id:g.id,genotype:g,maps,hardFailures:hard,worstAxisScore:+worst.toFixed(6),meanScore:+mean.toFixed(6),complexity:+Object.values(g).filter(v=>typeof v==="number").reduce((a,b)=>a+Math.abs(b),0).toFixed(5),verdict,coreSequence:seq};
}
const rank=(a,b)=>a.hardFailures.length-b.hardFailures.length||b.worstAxisScore-a.worstAxisScore||b.meanScore-a.meanScore||a.complexity-b.complexity||sha(a.genotype).localeCompare(sha(b.genotype));
export async function generateBlock(input,{artifactRoot=DEFAULT_ARTIFACT_ROOT,persist=true}={}){
  const parsed=typeof input==="string"?parseBlockRequest(input):{status:"PROCEED",spec:input};if(parsed.status!=="PROCEED")return parsed;const spec=parsed.spec,r=rng(hashSeed(`${spec.seed}|${stable(spec)}|${catalogHash()}`));
  let pop=Array.from({length:spec.population},(_,i)=>genotype(r,i));let assessed=[];
  for(let generation=0;generation<spec.generations;generation++){assessed=pop.map(g=>assess(spec,g)).sort(rank);if(generation<spec.generations-1){const parents=assessed.slice(0,Math.max(2,Math.ceil(assessed.length/2)));pop=Array.from({length:spec.population},(_,i)=>cross(parents[int(r,parents.length)].genotype,parents[int(r,parents.length)].genotype,r,i,generation))}}
  assessed.sort(rank);const winner=assessed[0],candidateSummaries=assessed.map(c=>({id:c.id,genotype:c.genotype,verdict:c.verdict,hardFailures:c.hardFailures,worstAxisScore:c.worstAxisScore,meanScore:c.meanScore,complexity:c.complexity,coreSignature:c.maps[0].coreSignature,mapHashes:c.maps.map(m=>m.mapHash)}));
  const digest=sha({spec,catalog:catalogHash(),candidates:candidateSummaries,winner:winner.id});const runDir=resolve(artifactRoot,slug(spec.id),digest);
  const judgment={schema:"PUNNETT JUDGMENT 1",verdict:winner.verdict,hardGatesFirst:true,winner:winner.id,coreSignature:winner.maps[0].coreSignature,ruling:winner.verdict==="OBSERVE"?"Structurally valid; controller endpoint feel remains deliberately unmeasured.":"Hard gate failure; averages cannot overrule it.",hardFailures:winner.hardFailures,axis:CONTROLLER_AXIS};
  const receipt={source:"Home Center Google Drive",title:"PUNNETT — Saint Mendel Judgment Jar",fileId:"1PwBBLVxmjRHyd6KqQiDb96d2-POhVWBl-fHRdYaWW-E",modifiedTime:"2026-08-13T10:18:47.104Z",contract:["visible rails","no secret weights","hard gates louder than averages","corrigible verdict enum"],writeBoundary:"READ_ONLY_DO_NOT_APPEND_HOME_CENTER",pressureReferences:Object.fromEntries(PRESSURE_PACKS.map(p=>[p.id,p.references]))};
  const manifest={schema:"BOXCRAFT RUN 1",digest,specHash:sha(spec),catalogHash:catalogHash(),candidateCount:assessed.length,axisSamples:101,winner:winner.id,files:[]};
  if(persist){for(const c of assessed)for(const m of c.maps){const base=`candidates/${String(c.id).padStart(3,"0")}/axis-${String(m.axis).padStart(3,"0")}`;await atomic(resolve(runDir,base+".map"),m.map);await atomic(resolve(runDir,base+".pipe"),m.pipe);manifest.files.push({path:base+".map",sha256:m.mapHash},{path:base+".pipe",sha256:sha(m.pipe)})}await json(resolve(runDir,"run.json"),{schema:"BOXCRAFT RUN 1",digest,spec,candidates:candidateSummaries});await json(resolve(runDir,"judgment.json"),judgment);await json(resolve(runDir,"source-receipt.json"),receipt);await json(resolve(runDir,"manifest.json"),manifest)}
  return {status:winner.verdict,digest,runDir,spec,judgment,winner:candidateSummaries[0],candidates:candidateSummaries,manifest};
}
export async function getBlock({id,digest,artifactRoot=DEFAULT_ARTIFACT_ROOT}){const base=resolve(artifactRoot,slug(id),slug(digest));try{return {status:"PROCEED",run:JSON.parse(await readFile(resolve(base,"run.json"),"utf8")),judgment:JSON.parse(await readFile(resolve(base,"judgment.json"),"utf8")),manifest:JSON.parse(await readFile(resolve(base,"manifest.json"),"utf8"))}}catch(e){return {status:"UNKNOWN",errors:[`stored block not found: ${e.code||e.message}`]}}}
export async function adaptRoomRecipe({recipeId,roomFile=resolve(PROJECT_ROOT,"data/room_junction_batch.json"),artifactRoot=DEFAULT_ARTIFACT_ROOT,persist=true}){
  const data=JSON.parse(await readFile(roomFile,"utf8")),rooms=Array.isArray(data)?data:(data.room_specs||data.rooms||data.recipes||Object.values(data).find(Array.isArray)||[]),room=rooms.find(x=>x.id===recipeId);if(!room)return {status:"UNKNOWN",errors:[`room recipe not found: ${recipeId}`]};
  const route=room.route_sentence||room.route||room.sequence||[], mapping={entry_read:"READ",acceleration_runway:"BUILD",lip:"COMMIT",bridge_landing:"RESOLVE",exit_read:"EXIT",commitment:"COMMIT",recovery:"RECOVER",return_route:"RETURN",change:"CHANGE"}, unknown=route.filter(x=>!mapping[x]);if(unknown.length)return {status:"UNKNOWN",errors:unknown.map(x=>`unknown route token: ${x}`)};
  const mapped=route.map(x=>mapping[x]), atoms=["START",...mapped,...(mapped.at(-1)==="EXIT"?[]:["EXIT"])],text=["BLOCKMAP 1",`id: room-${recipeId}`,"adapter: exact-route-token-map",`atoms: ${atoms.join(" -> ")}`,"S....R....C~~~~M....O....X"].join("\n")+"\n",digest=sha(text),runDir=resolve(artifactRoot,"adapters",slug(recipeId),digest);if(persist){await atomic(resolve(runDir,"axis-000.map"),text);await json(resolve(runDir,"judgment.json"),{verdict:"OBSERVE",ruling:"Legacy route mapped only through declared tokens; no geometry was inferred.",atoms})}return {status:"OBSERVE",digest,runDir,atoms,map:text};
}
export async function judgeControllerArena({artifactRoot=DEFAULT_ARTIFACT_ROOT,persist=true}={}){const mod=await import("../../../src/controller-kata.js");const arena=mod.generateControllerArena?mod.generateControllerArena({seed:"boxcraft-red-specimen"}):{cubes:[]};const boxes=arena.cubes||[];const size=25,g=Array.from({length:size},()=>Array(size).fill("#"));for(const b of boxes){const x=Math.max(1,Math.min(size-2,Math.round((b.center?.[0]??0)/4)+12)),y=Math.max(1,Math.min(size-2,Math.round((b.center?.[2]??0)/4)+12));g[y][x]="b"}g[12][1]="S";g[12][23]="X";const map=["BLOCKMAP 1","id: controller-kata-red-specimen","legend: # unknown mass b scattered box S/X asserted endpoints",...g.map(x=>x.join(""))].join("\n")+"\n",result={status:"REJECT",verdict:"REJECT",ruling:"Deterministic box scatter is not deterministic level design.",hardFailures:["authored_sequence_identity","pressure_provenance","full_axis_scaling"],map};if(persist){const dir=resolve(artifactRoot,"adapters/controller-kata-red-specimen");await atomic(resolve(dir,"axis-000.map"),map);await json(resolve(dir,"judgment.json"),result)}return result}
export function listCatalog(){return {status:"PROCEED",verdicts:["PROCEED","REJECT","REVISE","UNKNOWN","OBSERVE","UNCLE"],controllerAxis:CONTROLLER_AXIS,pressurePacks:PRESSURE_PACKS,catalogHash:catalogHash()}}
export { validatePressurePack };
