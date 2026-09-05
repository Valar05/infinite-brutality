#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { ASSET_CATALOG, assetGraphHash, formatAssetRequest } from "../boxcraft-judgment-mcp/src/asset-engine.mjs";
const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const OUT = resolve(ROOT, "generated/fleshpunk_lineart/p0");
const sha = value => createHash("sha256").update(value).digest("hex");
const esc = value => String(value).replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const atomic = async(path, value) => { await mkdir(resolve(path,".."),{recursive:true}); const tmp=path+".tmp"; await writeFile(tmp,value); await rename(tmp,path); };
const circle=(x,y,r,cls="ink")=>`<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
const line=(x1,y1,x2,y2,cls="ink")=>`<path class="${cls}" d="M${x1} ${y1}L${x2} ${y2}"/>`;
const box=(x,y,w,h,r=4,cls="ink")=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const pipe=(x1,y1,x2,y2)=>`<path class="pipe" d="M${x1} ${y1}L${x2} ${y1}Q${x2+12} ${y1} ${x2+12} ${y1+12}L${x2+12} ${y2}"/>`;
const tendon=(x1,y1,x2,y2,bend=18)=>`<path class="tendon" d="M${x1} ${y1}Q${(x1+x2)/2} ${y1-bend} ${x2} ${y2}"/>`;
function glyph(asset,x,y,scale=1,explode=0){
 const g=[], id=asset.id, ex=i=>explode*(i-1.5);
 g.push(`<g transform="translate(${x} ${y}) scale(${scale})" data-asset="${id}">`);
 if(id.includes("gate")){g.push(box(-62+ex(0),-70,124,140,3),line(-40+ex(0),-70,-40+ex(0),70),line(40+ex(0),-70,40+ex(0),70),circle(ex(1),-10,24,"valve"),line(-17+ex(1),-10,17+ex(1),-10,"valve"),line(ex(1),-27,ex(1),7,"valve"),pipe(-76+ex(2),-54,-76+ex(2),55),tendon(-40+ex(3),-52,40+ex(3),52,28));}
 else if(id.includes("winch")){g.push(box(-72+ex(0),48,144,20,2),circle(-34+ex(1),0,34),circle(34+ex(1),0,34),box(-34+ex(1),-12,68,24,12),circle(75+ex(2),-20,22,"valve"),pipe(-78+ex(3),-44,62+ex(3),30),tendon(-30+ex(0),0,78+ex(0),52,30));}
 else if(id.includes("lift")){g.push(line(-55+ex(0),-78,-55+ex(0),78),line(55+ex(0),-78,55+ex(0),78),box(-48+ex(1),25,96,48,6),`<path class="tissue" d="M${-48+ex(1)} 28Q0 -10 ${48+ex(1)} 28M${-48+ex(1)} 45Q0 5 ${48+ex(1)} 45"/>`,tendon(-42+ex(2),25,-20+ex(2),-74,16),tendon(42+ex(2),25,20+ex(2),-74,16),circle(72+ex(3),-5,17,"valve"),pipe(60+ex(3),-60,60+ex(3),62));}
 else if(id.includes("conduit")){g.push(pipe(-82+ex(0),-10,62+ex(0),25),circle(-34+ex(1),-10,21,"valve"),circle(34+ex(2),-10,21,"valve"),tendon(-58+ex(3),18,58+ex(3),18,-20),`<path class="tissue" d="M-8 -28Q0 -12 8 -28M-8 10Q0 -6 8 10"/>`);}
 else if(id.includes("hound")){g.push(`<!-- silhouette: predatory quadruped --><path class="ink" d="M-58 8Q-42-35 10-30Q48-27 58 2Q44 24 5 20Q-30 26-58 8Z"/>`,circle(61,-10,22),tendon(-36,16,-46,66,16),tendon(-5,18,-9,67,14),tendon(28,15,44,63,16),line(-48,66,-31,66),line(-14,67,3,67),line(39,63,57,63),pipe(-32,-12,34,2),circle(25,-10,9,"valve"));}
 else if(id.includes("crawler")){for(let i=0;i<5;i++)g.push(circle(-48+i*24+ex(i%4),-5+Math.abs(2-i)*7,19));g.push(pipe(-66,-34,56,30),circle(-2,-42,10,"valve"),tendon(-55,15,-72,58,12),tendon(50,15,70,58,12),line(-72,58,-58,50),line(70,58,56,50));}
 else if(id.includes("sentry")){g.push(box(-48+ex(0),40,96,27,3),circle(ex(1),22,34),box(-4+ex(2),-19,84,18,8),line(80+ex(2),-19,95+ex(2),-8),pipe(-38+ex(3),32,66+ex(3),-20),circle(-25+ex(1),-15,14,"valve"),tendon(-25,22,48,-10,20));}
 else {g.push(`<path class="ink" d="M-68 28Q-78-20-42-54Q0-80 43-53Q78-23 68 28Q40 68 0 54Q-42 70-68 28Z"/>`,pipe(-84,-42,67,34),circle(52,-24,15,"valve"),circle(-47,20,12,"valve"),tendon(-55,40,52,42,34),`<path class="tissue" d="M-42-22Q0-52 42-20M-54 6Q0-22 54 8M-42 31Q0 8 42 31"/>`);}
 asset.components.forEach((component,i)=>g.push(`<circle class="component-dot" data-component="${esc(component.id)}" cx="${-84+i*13}" cy="84" r="2"/>`));
 g.push(`</g>`); return g.join("");
}
function assetSvg(asset){
 const w=1200,h=700, graph=assetGraphHash(asset); const components=asset.components.map(c=>c.id).join(",");
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-schema="FLESHPUNK LINEART PLATE 1" data-graph-hash="${graph}">
<style>.ink,.pipe,.valve,.tendon,.tissue{fill:#fff;stroke:#000;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.pipe{stroke-width:8}.valve{stroke-width:4}.tendon{stroke-width:3}.tissue{stroke-width:2}.leader{fill:none;stroke:#000;stroke-width:2}.component-dot{fill:#000;stroke:none}.label{font:700 18px monospace;fill:#000}.small{font:14px monospace;fill:#000}</style>
<rect width="1200" height="700" fill="#fff"/><text class="label" x="38" y="42">${esc(asset.id)} — FUNCTIONAL FLESHPUNK PLATE</text><text class="small" x="38" y="66">${esc(asset.runtime_role)} | graph ${graph.slice(0,16)}</text>
<g aria-label="assembled">${glyph(asset,205,320,1.25,0)}<text class="label" x="120" y="555">ASSEMBLED</text></g>
<g aria-label="exploded">${glyph(asset,600,320,1.15,42)}<text class="label" x="510" y="555">EXPLODED</text></g>
<g aria-label="orthographic">${glyph(asset,965,320,.92,0)}${line(870,430,1060,430,"leader")}${line(870,215,1060,215,"leader")}<text class="label" x="880" y="555">ORTHOGRAPHIC</text></g>
<path class="leader" d="M30 590H1170"/><text class="small" x="38" y="620">PIPES transport • VALVES control • TENDONS transmit force • CONNECTIVE TISSUE anchors and seals</text><text class="small" x="38" y="650">host: ${esc(asset.host_surface)} | support: ${esc(asset.support_chain.join(" > "))}</text><metadata>${esc(JSON.stringify({asset:asset.id,components,graph}))}</metadata></svg>\n`;
 return svg;
}
await mkdir(OUT,{recursive:true}); const manifest={schema:"FLESHPUNK CANARY MANIFEST 1",family:ASSET_CATALOG.family,visualAcceptance:false,assets:[]};
for(const asset of ASSET_CATALOG.assets.filter(item=>item.wave==="P0")){
 const svg=assetSvg(asset), svgPath=resolve(OUT,`${asset.id}.svg`), request=formatAssetRequest(asset.id,"314159");
 await atomic(svgPath,svg); await atomic(resolve(OUT,`${asset.id}.asset-request.txt`),request);
 const caption=["drw_fleshpunk","clean black ink lineart on white","functional "+asset.runtime_role,"assembled exploded orthographic engineering plate",...asset.components.map(c=>c.system+" "+c.function),"no shading","no gray","no hatching","no flesh blob"].join(", ");
 await atomic(resolve(OUT,`${asset.id}.txt`),caption+"\n");
 const candidate={schema:"FLESHPUNK ASSET CANDIDATE 1",targetId:asset.id,seed:"314159",views:asset.required_views,componentIds:asset.components.map(c=>c.id),componentGraphHash:assetGraphHash(asset),lineArt:ASSET_CATALOG.lineart_contract,hostSurface:asset.host_surface,supportChain:asset.support_chain,serviceRoute:asset.service_route,silhouette:asset.silhouette,regnet:{status:"UNKNOWN"},visualAcceptance:false};
 await atomic(resolve(OUT,`${asset.id}.candidate.json`),JSON.stringify(candidate,null,2)+"\n");
 manifest.assets.push({id:asset.id,svg:`${asset.id}.svg`,svgSha256:sha(svg),request:`${asset.id}.asset-request.txt`,candidate:`${asset.id}.candidate.json`,caption:`${asset.id}.txt`,graphHash:assetGraphHash(asset)});
}
await atomic(resolve(OUT,"manifest.json"),JSON.stringify(manifest,null,2)+"\n"); console.log(JSON.stringify({status:"PROCEED",out:OUT,assets:manifest.assets.length,visualAcceptance:false}));
