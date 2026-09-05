import { createHash } from "node:crypto";

export const VERDICTS = Object.freeze(["PROCEED", "REJECT", "REVISE", "UNKNOWN", "OBSERVE", "UNCLE"]);
export const CORE_BEATS = Object.freeze(["START", "READ", "BUILD", "COMMIT", "RESOLVE", "RECOVER", "CHANGE", "RETURN", "EXIT"]);
export const REALIZATION_BEATS = Object.freeze(["RUNWAY", "LIP", "GAP", "LANDING", "CORNER", "STAIR", "GATE", "SIDE", "TRIGGER", "SHORTCUT"]);
export const CONTROLLER_AXIS = Object.freeze({
  id: "ib_war_to_anime@1", min: 0, max: 100, step: 1,
  zero: "MODERN_WAR", hundred: "QUAKE_ANIME_BULLSHIT",
  evidenceStatus: "structural-contract-unmeasured"
});
export const PRESSURE_PACKS = Object.freeze([
  {id:"mandala@1", rail:"centered repetition with legible return", source:"mandala spatial organization", references:["DECLARED_INSPIRATION:first-atom-mandala"], metric:"center_coherence", target:[0.65,1]},
  {id:"quake@1", rail:"speed routes remain readable under vertical aggression", source:"Quake movement grammar", references:["https://store.steampowered.com/app/282440/Quake_Live/"], metric:"flow", target:[0.55,1]},
  {id:"doom@1", rail:"commitment produces combat-readable spatial reveals", source:"Doom encounter readability", references:["https://bethesda.net/en-US/news/slay-or-be-slayed-a-closer-look-at-doom-eternals-battlemode"], metric:"commit_read", target:[0.55,1]},
  {id:"modern-war@1", rail:"low-axis traversal stays grounded and recoverable", source:"modern military shooter locomotion", references:["https://blog.activision.com/call-of-duty/2019-10/The-Basics-of-Call-of-Duty-Modern-Warfare-Movement"], metric:"grounding", target:[0.6,1]},
  {id:"modern-fps@1", rail:"approach, threshold, and recovery are visually distinct", source:"modern shooter route telegraphing", references:["https://www.callofduty.com/modernwarfare/multiplayer/"], metric:"telegraph", target:[0.6,1]},
  {id:"clustertruck@1", rail:"moving-platform brutality remains recoverable", source:"Clustertruck traversal pressure", references:["https://landfall.se/clustertruck-presskit"], metric:"recovery", target:[0.55,1]},
  {id:"quake-anime-bullshit@1", rail:"high-axis spectacle expands without rewriting the atom", source:"declared controller endpoint", references:["DECLARED_AXIS_ENDPOINT:quake-anime-bullshit"], metric:"spectacle", target:[0.45,1]}
]);
export const KNOWN_METRICS = Object.freeze(["center_coherence","flow","commit_read","grounding","telegraph","recovery","spectacle"]);
export const KNOWN_OPERATORS = Object.freeze(["eq","gte","lte","between"]);
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(",")}]`:v&&typeof v==="object"?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")}}`:JSON.stringify(v);
export const catalogHash=()=>createHash("sha256").update(canonical({PRESSURE_PACKS,CONTROLLER_AXIS,CORE_BEATS,REALIZATION_BEATS})).digest("hex");
export function controllerEnvelope(axis){
  const t=axis/100;
  return {groundSpeed:+(4.8+8*t).toFixed(3),accelerationDistance:+(7+5*t).toFixed(3),maxGap:+(1+6*t).toFixed(3),maxRise:+(.6+3.4*t).toFixed(3),airControl:+(.05+.95*t).toFixed(3),minRecoveryWidth:+(3.4-1.4*t).toFixed(3),satelliteAuthority:+Math.max(0,(t-.25)/.75).toFixed(3)};
}
export function validatePressurePack(pack){
  const errors=[];
  if(!pack||typeof pack!=="object") return {valid:false,errors:["pack must be an object"]};
  for(const key of ["id","rail","source","metric"]) if(typeof pack[key]!=="string"||!pack[key].trim()) errors.push(`${key} must be a non-empty string`);
  if(!KNOWN_METRICS.includes(pack.metric)) errors.push(`unknown metric: ${pack.metric}`);
  if(!Array.isArray(pack.target)||pack.target.length!==2||pack.target.some(n=>typeof n!=="number")||pack.target[0]>pack.target[1]) errors.push("target must be [min,max]");
  return {valid:errors.length===0,errors};
}
