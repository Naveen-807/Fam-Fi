/** V2-only event derivation, isolated from the active V1 handler registrations. */
export async function declineGoalEvent({event,context}: any) {
  const goal = await context.Goal.get(String(event.params.goalId));
  if (!goal || goal.status !== "PROPOSED") return;
  context.Goal.set({...goal,status:"DECLINED"});
  const family = await context.Family.get(String(goal.familyId));
  context.TimelineEntry.set({id:event.transaction.hash+"-"+event.logIndex,ts:event.block.timestamp,kind:"goal_declined",text:`${goal.teenFamId}'s goal was declined. No money moved.`,actor:family?.parent ?? goal.teen,counterparty:goal.teen,familyId:goal.familyId,counterpartyFamilyId:goal.familyId,txHash:event.transaction.hash});
}
