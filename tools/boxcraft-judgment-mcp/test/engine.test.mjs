import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adaptRoomRecipe, generateBlock, hashSeed, judgeControllerArena, parseBlockRequest, rng, validatePressurePack } from "../src/engine.mjs";
const request=({grammar="WALK",require="START, READ, BUILD, COMMIT, RESOLVE, RECOVER, EXIT"}={})=>`BLOCK REQUEST 1
id: test-walk
seed: fixed-seed
controller_axis: 50
grammar: ${grammar}
center: MANDALA
pressures: mandala@1, quake@1, doom@1, modern-war@1, modern-fps@1, clustertruck@1, quake-anime-bullshit@1
population: 2
generations: 1
bounds: 20x20x3
require: ${require}
forbid:
`;
test("compiler is strict and never infers prose",()=>{assert.equal(parseBlockRequest("make a brutal room").status,"UNKNOWN");assert.match(parseBlockRequest(request()+"teleport: yes\n").errors.join(" "),/unknown field/);assert.match(parseBlockRequest(request().replace("EXIT","TELEPORT")).errors.join(" "),/unknown beat/)});
test("seed hash and PRNG are stable",()=>{assert.equal(hashSeed("alpha"),1569418667);const r=rng(hashSeed("alpha"));assert.deepEqual([r(),r(),r()].map(x=>+x.toFixed(10)),[0.5000494202,0.2615349302,0.9985202181])});
test("generation is byte deterministic, complete, and has one atom across the full axis",async()=>{const a=await mkdtemp(join(tmpdir(),"boxcraft-a-")),b=await mkdtemp(join(tmpdir(),"boxcraft-b-"));const oldRandom=Math.random,oldFetch=globalThis.fetch;Math.random=()=>{throw Error("forbidden randomness")};globalThis.fetch=()=>{throw Error("forbidden network")};try{const x=await generateBlock(request(),{artifactRoot:a}),y=await generateBlock(request(),{artifactRoot:b});assert.equal(x.digest,y.digest);assert.equal(x.status,"OBSERVE");assert.equal(x.candidates.length,2);assert.equal(x.manifest.files.length,404);assert.equal(new Set(x.winner.mapHashes).size>1,true);assert.equal(new Set(x.candidates.map(c=>c.coreSignature)).size,1);assert.deepEqual(JSON.parse(await readFile(join(x.runDir,"run.json"))),JSON.parse(await readFile(join(y.runDir,"run.json"))));const lo=await readFile(join(x.runDir,"candidates/000/axis-000.map"),"utf8"),hi=await readFile(join(x.runDir,"candidates/000/axis-100.map"),"utf8");assert.match(lo,/axis_label: MODERN_WAR/);assert.match(hi,/axis_label: QUAKE_ANIME_BULLSHIT/);assert.equal(lo.match(/core_signature: (\w+)/)[1],hi.match(/core_signature: (\w+)/)[1])}finally{Math.random=oldRandom;globalThis.fetch=oldFetch}});
test("hard gates outrank averages",async()=>{const r=await generateBlock(request({require:"START, CHANGE, EXIT"}),{persist:false});assert.equal(r.status,"REJECT");assert.match(r.judgment.hardFailures.join(" "),/required_beat_missing:CHANGE/)});
test("legacy recipe adapter is exact and unknowns stay UNKNOWN",async()=>{const ok=await adaptRoomRecipe({recipeId:"ib_2c_straight_lip_bridge",persist:false});assert.equal(ok.status,"OBSERVE");assert.deepEqual(ok.atoms,["START","READ","BUILD","COMMIT","RESOLVE","EXIT"]);const bad=await adaptRoomRecipe({recipeId:"ib_4c_void_ring",persist:false});assert.equal(bad.status,"UNKNOWN");assert.match(bad.errors.join(" "),/ring_walk/)});
test("current box scatter is a named red specimen",async()=>{const r=await judgeControllerArena({persist:false});assert.equal(r.status,"REJECT");assert.deepEqual(r.hardFailures,["authored_sequence_identity","pressure_provenance","full_axis_scaling"]);assert.match(r.map,/BLOCKMAP 1/)});
test("pressure pack schema exposes unknown metrics",()=>{assert.equal(validatePressurePack({id:"x",rail:"r",source:"s",metric:"magic",target:[0,1]}).valid,false)});
