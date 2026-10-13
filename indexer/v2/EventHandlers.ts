import "../src/EventHandlers";
import { indexer } from "envio";
import { declineGoalEvent } from "./goal-decline";
(indexer as any).onEvent({contract:"FamFi",event:"GoalDeclined"},declineGoalEvent);
