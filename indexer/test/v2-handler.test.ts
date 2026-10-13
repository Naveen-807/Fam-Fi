import {test} from "node:test";
import assert from "node:assert/strict";
import {declineGoalEvent} from "../v2/goal-decline";
test("V2 decline history identifies the parent and teen and duplicate delivery is inert",async()=>{
  let goal={id:"1",status:"PROPOSED",teen:"teen",teenFamId:"alex",familyId:1};const history:any[]=[];
  const context={Goal:{get:async()=>goal,set:(value:any)=>{goal=value;}},Family:{get:async()=>({parent:"parent"})},TimelineEntry:{set:(value:any)=>history.push(value)}};
  const event={params:{goalId:1},transaction:{hash:"0xabc"},block:{timestamp:100},logIndex:0};
  await declineGoalEvent({event,context});await declineGoalEvent({event,context});
  assert.equal(goal.status,"DECLINED");assert.equal(history.length,1);assert.equal(history[0].actor,"parent");assert.equal(history[0].counterparty,"teen");
});
