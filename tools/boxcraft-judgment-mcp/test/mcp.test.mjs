import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.mjs";
test("MCP exposes block and Fleshpunk asset tools with strict compile behavior",async()=>{const server=createServer(),client=new Client({name:"boxcraft-test",version:"1"});const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);try{const listed=await client.listTools();assert.deepEqual(listed.tools.map(x=>x.name).sort(),["compile_asset","compile_block","generate_block","get_block","judge_asset","judge_block","list_asset_targets","list_pressures","validate_pressure_pack"].sort());const out=await client.callTool({name:"compile_block",arguments:{request:"please make a room"}});assert.equal(JSON.parse(out.content[0].text).status,"UNKNOWN");const assets=await client.callTool({name:"list_asset_targets",arguments:{wave:"P0"}});assert.equal(JSON.parse(assets.content[0].text).assets.length,8)}finally{await client.close();await server.close()}});
