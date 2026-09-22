function position3(value) {
  if (Array.isArray(value)) return { x:Number(value[0])||0, y:Number(value[1])||0, z:Number(value[2])||0 };
  return { x:Number(value?.x)||0, y:Number(value?.y)||0, z:Number(value?.z)||0 };
}
function nodeIdForIndex(plan,index){ return plan?.nodes?.[index]?.id || null; }
function nodeById(plan,id){ return plan?.nodes?.find((node)=>node.id===id) || null; }
function graphForPlan(plan){
  const adjacency=new Map();
  for(const node of plan?.nodes||[]) adjacency.set(node.id,[]);
  for(const edge of plan?.edges||[]){
    const aId=edge.aId||nodeIdForIndex(plan,edge.a), bId=edge.bId||nodeIdForIndex(plan,edge.b);
    if(!aId||!bId) continue;
    adjacency.get(aId)?.push({nodeId:bId,edgeId:edge.id});
    adjacency.get(bId)?.push({nodeId:aId,edgeId:edge.id});
  }
  return adjacency;
}
export function nearestOpenWorldNode(plan,position){
  const p=position3(position); let best=null,bestDistanceSq=Infinity;
  for(const node of plan?.nodes||[]){
    const n=position3(node.position),dx=p.x-n.x,dy=p.y-n.y,dz=p.z-n.z;
    const distanceSq=dx*dx+dy*dy*0.16+dz*dz;
    if(distanceSq<bestDistanceSq){best=node;bestDistanceSq=distanceSq;}
  }
  return best?{node:best,distanceSq:bestDistanceSq}:null;
}
export function openWorldBounds(plan,padding=36){
  const nodes=plan?.nodes||[];
  if(!nodes.length) return {minX:-padding,maxX:padding,minY:-padding,maxY:padding,minZ:-padding,maxZ:padding};
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const node of nodes){
    const p=position3(node.position),r=Math.max(0,Number(node.massRadius)||0),d=Math.max(0,Number(node.massDepth)||0);
    minX=Math.min(minX,p.x-r); maxX=Math.max(maxX,p.x+r);
    minY=Math.min(minY,p.y-d); maxY=Math.max(maxY,p.y+d);
    minZ=Math.min(minZ,p.z-r); maxZ=Math.max(maxZ,p.z+r);
  }
  return {minX:minX-padding,maxX:maxX+padding,minY:minY-padding,maxY:maxY+padding,minZ:minZ-padding,maxZ:maxZ+padding};
}
export function findOpenWorldNodePath(plan,fromPosition,toPosition){
  const start=nearestOpenWorldNode(plan,fromPosition)?.node||null, goal=nearestOpenWorldNode(plan,toPosition)?.node||null;
  if(!start||!goal) return {startNodeId:null,goalNodeId:null,nodeIds:[],edgeIds:[]};
  if(start.id===goal.id) return {startNodeId:start.id,goalNodeId:goal.id,nodeIds:[start.id],edgeIds:[]};
  const adjacency=graphForPlan(plan),queue=[start.id],seen=new Set([start.id]),previous=new Map();
  while(queue.length){
    const id=queue.shift(); if(id===goal.id) break;
    for(const step of adjacency.get(id)||[]){ if(seen.has(step.nodeId)) continue; seen.add(step.nodeId); previous.set(step.nodeId,{nodeId:id,edgeId:step.edgeId}); queue.push(step.nodeId); }
  }
  if(!seen.has(goal.id)) return {startNodeId:start.id,goalNodeId:goal.id,nodeIds:[start.id,goal.id],edgeIds:[]};
  const nodeIds=[goal.id],edgeIds=[]; let cursor=goal.id;
  while(cursor!==start.id){ const step=previous.get(cursor); if(!step) break; edgeIds.push(step.edgeId); cursor=step.nodeId; nodeIds.push(cursor); }
  nodeIds.reverse(); edgeIds.reverse();
  return {startNodeId:start.id,goalNodeId:goal.id,nodeIds,edgeIds};
}
export function createOpenWorldRuntimeState(plan,position=null){
  const worldPosition=position3(position||plan?.nodes?.[0]?.position||[0,0,0]), nearest=nearestOpenWorldNode(plan,worldPosition)?.node||null;
  return {schema:'infinite-brutality.open-world-runtime.v1',authority:'world_position',levelIndex:plan?.levelIndex??0,worldPosition,activeNodeId:nearest?.id||null,activeDistrictId:nearest?.districtId||null,bounds:openWorldBounds(plan),navigation:{startNodeId:nearest?.id||null,goalNodeId:nearest?.id||null,nodeIds:nearest?[nearest.id]:[],edgeIds:[]}};
}
export function updateOpenWorldRuntimeState(state,plan,position){
  const next=state?.schema==='infinite-brutality.open-world-runtime.v1'?state:createOpenWorldRuntimeState(plan,position);
  const worldPosition=position3(position),nearest=nearestOpenWorldNode(plan,worldPosition)?.node||null;
  next.levelIndex=plan?.levelIndex??next.levelIndex??0; next.worldPosition=worldPosition; next.activeNodeId=nearest?.id||null; next.activeDistrictId=nearest?.districtId||null; next.bounds=openWorldBounds(plan);
  return next;
}
export function fixtureIndexForWorldNode(plan,nodeId){
  const node=nodeById(plan,nodeId); if(!node) return -1;
  if(Number.isInteger(node.fixtureRoomIndex)) return node.fixtureRoomIndex;
  return Number.isInteger(node.roomIndex)?node.roomIndex:-1;
}
