import { ethers } from "ethers";

export function capabilitiesReader(contract: ethers.Contract) {
  let cached: { at: number; data: { missions: boolean | null; futureFund: boolean | null; goalDecline: boolean | null; missionReviewTimeout: boolean | null } } | undefined;
  return async () => {
    if (cached && Date.now() - cached.at < 60000) return cached.data;
    const probe = async (method: string): Promise<boolean | null> => {
      try { await contract[method](); return true; }
      catch (e: any) { return e?.code === "CALL_EXCEPTION" || e?.code === "BAD_DATA" ? false : null; }
    };
    const [missions, futureFund] = await Promise.all([probe("missionCount"), probe("fundCount")]);
    const v2probe = async (name: string) => {
      try {
        const v2 = new ethers.Contract(await contract.getAddress(), [`function ${name}() view returns (bool)`], contract.runner);
        return Boolean(await v2[name]());
      } catch (e: any) { return e?.code === "CALL_EXCEPTION" || e?.code === "BAD_DATA" || !contract.runner ? false : null; }
    };
    const [goalDecline, missionReviewTimeout] = await Promise.all([v2probe("supportsGoalDecline"), v2probe("supportsMissionReviewTimeout")]);
    const data = { missions, futureFund, goalDecline, missionReviewTimeout };
    if (missions !== null && futureFund !== null) cached = { at: Date.now(), data };
    return data;
  };
}
