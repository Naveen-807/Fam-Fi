import { test } from "node:test";
import assert from "node:assert/strict";
import { familySummary } from "../src/family-summary.js";
const parent="0x0000000000000000000000000000000000000001";
function chain() {
  const pin=(at:any)=>assert.equal(at.blockTag,42);
  return {runner:{provider:{getBlockNumber:async()=>42}},
    missionCount:async(at:any)=>{pin(at);return 3n;},fundCount:async(at:any)=>{pin(at);return 3n;},
    accounts:async(a:string,at:any)=>{pin(at);return {role:2,familyId:a==="other"?2:1};},
    streams:async(_:string,at:any)=>{pin(at);return {remaining:100n};},accrued:async(_:string,at:any)=>{pin(at);return 30n;},
    missions:async(id:number,at:any)=>{pin(at);return {parent:id===3?"other":parent,status:id===2?4:2,reward:50n};},
    funds:async(id:number,at:any)=>{pin(at);return {parent:id===3?"other":parent,status:id===2?2:1,funded:80n};},
  } as any;
}
test("commitments are pinned, family scoped and exclude paid/released amounts",async()=>{
  const result=await familySummary(chain(),parent,1,[{id:"teen"},{id:"other"}],true);
  assert.deepEqual(result,{coverage:"complete",blockNumber:42,allowance:"70",missions:"50",futureFunds:"80"});
});
test("incomplete roster never yields a complete allowance total",async()=>{
  const result=await familySummary(chain(),parent,1,[{id:"teen"}],false);
  assert.equal(result.coverage,"partial");assert.equal(result.allowance,null);assert.equal(result.missions,"50");
});
test("scan limit and RPC failure give unavailable rather than zero",async()=>{
  const large={...chain(),missionCount:async()=>501n};assert.equal((await familySummary(large,parent,1,[],true)).missions,null);
  const failed={...chain(),fundCount:async()=>{throw Error("offline");}};assert.equal((await familySummary(failed,parent,1,[],true)).coverage,"unavailable");
});
