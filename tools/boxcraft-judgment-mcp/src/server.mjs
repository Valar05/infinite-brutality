#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { adaptRoomRecipe, generateBlock, getBlock, judgeControllerArena, listCatalog, parseBlockRequest, validatePressurePack } from "./engine.mjs";
import { formatAssetRequest, judgeAsset, listAssetTargets, parseAssetRequest } from "./asset-engine.mjs";
const response=value=>({content:[{type:"text",text:JSON.stringify(value,null,2)}],structuredContent:value,isError:value?.status==="UNKNOWN"});
export function createServer(){
  const server=new McpServer({name:"punnett-boxcraft-judgment",version:"0.1.0"});
  server.registerTool("compile_block",{description:"Compile strict BLOCK REQUEST 1 text. Prose and unknown tokens return UNKNOWN.",inputSchema:{request:z.string()}},async({request})=>response(parseBlockRequest(request)));
  server.registerTool("generate_block",{description:"Deterministically evolve, judge, render, and store every candidate at all 101 controller-axis points.",inputSchema:{request:z.string(),persist:z.boolean().optional()}},async({request,persist=true})=>response(await generateBlock(request,{persist})));
  server.registerTool("judge_block",{description:"Judge a strict request, an exact legacy room recipe adapter, the existing controller arena red specimen, or a stored run.",inputSchema:{mode:z.enum(["spec","room_recipe","controller_arena","stored"]),request:z.string().optional(),recipeId:z.string().optional(),id:z.string().optional(),digest:z.string().optional(),persist:z.boolean().optional()}},async(a)=>{if(a.mode==="spec")return response(await generateBlock(a.request||"",{persist:a.persist??true}));if(a.mode==="room_recipe")return response(await adaptRoomRecipe({recipeId:a.recipeId||"",persist:a.persist??true}));if(a.mode==="controller_arena")return response(await judgeControllerArena({persist:a.persist??true}));return response(await getBlock({id:a.id||"",digest:a.digest||""}))});
  server.registerTool("get_block",{description:"Read a stored run by exact id and digest.",inputSchema:{id:z.string(),digest:z.string()}},async a=>response(await getBlock(a)));
  server.registerTool("list_pressures",{description:"List the immutable pressure catalog, verdicts, and controller-axis contract.",inputSchema:{}},async()=>response(listCatalog()));
  server.registerTool("validate_pressure_pack",{description:"Validate one explicit pressure pack; no missing field is inferred.",inputSchema:{pack:z.record(z.string(),z.unknown())}},async({pack})=>response({status:validatePressurePack(pack).valid?"PROCEED":"UNKNOWN",...validatePressurePack(pack)}));
  server.registerTool("compile_asset",{description:"Compile strict ASSET REQUEST 1 text against the Fleshpunk production catalog. Unknown targets return UNKNOWN; changed anatomy returns REJECT.",inputSchema:{request:z.string()}},async({request})=>response(parseAssetRequest(request)));
  server.registerTool("judge_asset",{description:"Apply anatomy, lineart, support, RegNet, and user-acceptance gates to one catalog-bound candidate.",inputSchema:{request:z.string(),candidate:z.record(z.string(),z.unknown())}},async({request,candidate})=>response(judgeAsset(request,candidate)));
  server.registerTool("list_asset_targets",{description:"List immutable Fleshpunk asset targets and component graph hashes, optionally by wave.",inputSchema:{wave:z.enum(["P0","P1","P2"]).optional()}},async({wave})=>response(listAssetTargets({wave})));
  server.registerPrompt("new_fleshpunk_asset",{description:"Strict prompt template for a production-bound Fleshpunk lineart asset.",argsSchema:{targetId:z.string().optional(),seed:z.string().optional()}},({targetId="fp_pressure_valve_gate",seed="314159"})=>({messages:[{role:"user",content:{type:"text",text:formatAssetRequest(targetId,seed)||`UNKNOWN target_id: ${targetId}`}}]}));
  server.registerPrompt("new_block",{description:"Strict prompt template for a deterministic traversable Block.",argsSchema:{id:z.string().optional(),seed:z.string().optional()}},({id="new-block",seed="seed-1"})=>({messages:[{role:"user",content:{type:"text",text:`BLOCK REQUEST 1\nid: ${id}\nseed: ${seed}\ncontroller_axis: 50\ngrammar: WALK\ncenter: MANDALA\npressures: mandala@1, quake@1, doom@1, modern-war@1, modern-fps@1, clustertruck@1, quake-anime-bullshit@1\npopulation: 8\ngenerations: 3\nbounds: 32x24x3\nrequire: START, READ, BUILD, COMMIT, RESOLVE, RECOVER, EXIT\nforbid:\n`}}]}));
  return server;
}
export async function main(){const server=createServer();await server.connect(new StdioServerTransport());console.error("punnett-boxcraft-judgment MCP ready on stdio")}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
