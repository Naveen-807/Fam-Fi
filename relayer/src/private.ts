import { ethers } from "ethers";
import type { Express } from "express";
import { liveGoalsReader } from "./live-goals.js";
import { liveApprovalsReader } from "./live-approvals.js";
import { familyRosterReader } from "./roster.js";
import { familySummary } from "./family-summary.js";

/**
 * Authenticated reads for family-private data (missions, Progress Passport, Weekly Brief, FutureFund).
 *
 * Why this exists: Envio's GraphQL endpoint is public, so filtering by family in the browser is not access control.
 * Here the caller proves who they are with an EIP-712 signature, the role and family come from the FamFi contract
 * (never from the request), and only fixed, parameterised queries run. There is no raw GraphQL passthrough.
 *
 * Limits, stated plainly: this protects the app's aggregated views. Every FamFi event is still public on Monad,
 * and the indexer's own endpoint should not be exposed to browsers in a production deployment.
 */
export const READ_SCOPE = "famfi-private-read";
export const READ_TYPES = {
  ReadAuth: [
    { name: "reader", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "scope", type: "string" },
  ],
};
const MAX_AUTH_SECONDS = 3600;
const ROLE_PARENT = 1n;
const ROLE_TEEN = 2n;
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Live reads timed out")), 6000); })]); }
  finally { if (timer) clearTimeout(timer); }
}

const MISSION = "id familyId parentFamId teen teenFamId reward deadline goalId status title description feedback createdAt submittedAt resolvedAt savedToGoal txHash lastTxHash";
const PENDING = "id fromFamId toFamId amount kind status releaseAt memo createdAt refKind txHash";
const GOAL = "id teen teenFamId target saved matched status deadline memo sponsorOpen";
const PROGRESS = "id teenFamId missionsCompleted missionRewards savedTotal matchedTotal goalsCompleted paymentsCompleted lastEventTs lastEventBlock";
const WEEK = "id teen teenFamId week weekStart missionsCompleted missionRewards savedTotal matchedTotal goalsCompleted paymentsCompleted allowanceFunded heldCount";
const PEVENT = "id teen kind amount text weekId ts blockNumber txHash";
const FUND = "id teen teenFamId name purpose target funded horizon status createdAt releasedAt";
const FENTRY = "id fundId teen kind amount text ts blockNumber txHash";
const QUALIFYING = `["MISSION_APPROVED","SAVED","MATCHED","GOAL_COMPLETED","PAYMENT"]`;
const RECEIPT = "id goalId teen teenFamId goalName ownAmount matchedAmount totalAfter target source missionId missionTitle ts blockNumber txHash";
const MATCH = "id receiptId goalId giftId sponsorFamId amount ts blockNumber txHash";
const ACHIEVEMENT = "id teen familyId kind sourceEvent txHash blockNumber ts logIndex";
const GIFT = "id goalId sponsorFamId escrow released deadline";

/** The only queries that exist. Each takes only values the server derived from the chain. */
const PARENT_QUERY = `query($f:Int!, $fs:String!, $a:String!){
  family: Family(where:{id:{_eq:$fs}}){ id tzOffset }
  teens: User(where:{familyId:{_eq:$f}, role:{_eq:"TEEN"}}){ id famId level frozen }
  missions: Mission(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:100){ ${MISSION} }
  holds: Pending(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:60){ ${PENDING} }
  goals: Goal(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:60){ ${GOAL} }
  requests: Request(where:{toAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}, limit:40){ id fromFamId amount memo createdAt }
  outgoingRequests: Request(where:{fromAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}, limit:40){ id toFamId amount memo createdAt }
  progress: TeenProgress(where:{familyId:{_eq:$f}}){ ${PROGRESS} }
  weeks: WeeklyStat(where:{familyId:{_eq:$f}}, order_by:{week:desc}, limit:60){ ${WEEK} }
  history: ProgressEvent(where:{familyId:{_eq:$f}, kind:{_in:${QUALIFYING}}}, order_by:{ts:desc}, limit:60){ ${PEVENT} }
  funds: FutureFund(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:40){ ${FUND} }
  fundEntries: FundEntry(where:{familyId:{_eq:$f}}, order_by:{ts:desc}, limit:100){ ${FENTRY} }
  savingReceipts: SavingReceipt(where:{familyId:{_eq:$f}}, order_by:{blockNumber:desc}, limit:40){ ${RECEIPT} }
  matchReleases: MatchRelease(where:{familyId:{_eq:$f}}, order_by:{blockNumber:desc}, limit:100){ ${MATCH} }
  achievements: Achievement(where:{familyId:{_eq:$f}}){ ${ACHIEVEMENT} }
  gifts: Gift(where:{familyId:{_eq:$f}}){ ${GIFT} }
  timeline: TimelineEntry(where:{_or:[{familyId:{_eq:$f}},{counterpartyFamilyId:{_eq:$f}}]},order_by:{ts:desc},limit:60){id text amount ts kind actor counterparty txHash}
}`;

const TEEN_QUERY = `query($f:Int!, $fs:String!, $a:String!){
  family: Family(where:{id:{_eq:$fs}}){ id tzOffset }
  missions: Mission(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:100){ ${MISSION} }
  goals: Goal(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:40){ ${GOAL} }
  incomingRequests: Request(where:{toAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}, limit:40){ id fromFamId amount memo createdAt }
  outgoingRequests: Request(where:{fromAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}, limit:40){ id toFamId amount memo createdAt }
  progress: TeenProgress(where:{id:{_eq:$a}}){ ${PROGRESS} }
  weeks: WeeklyStat(where:{teen:{_eq:$a}}, order_by:{week:desc}, limit:12){ ${WEEK} }
  history: ProgressEvent(where:{teen:{_eq:$a}, kind:{_in:${QUALIFYING}}}, order_by:{ts:desc}, limit:40){ ${PEVENT} }
  funds: FutureFund(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:20){ ${FUND} }
  fundEntries: FundEntry(where:{teen:{_eq:$a}}, order_by:{ts:desc}, limit:100){ ${FENTRY} }
  savingReceipts: SavingReceipt(where:{teen:{_eq:$a}}, order_by:{blockNumber:desc}, limit:40){ ${RECEIPT} }
  matchReleases: MatchRelease(where:{teen:{_eq:$a}}, order_by:{blockNumber:desc}, limit:100){ ${MATCH} }
  achievements: Achievement(where:{teen:{_eq:$a}}){ ${ACHIEVEMENT} }
  gifts: Gift(where:{teen:{_eq:$a}}){ ${GIFT} }
  timeline: TimelineEntry(where:{_or:[{actor:{_eq:$a}},{counterparty:{_eq:$a}}]},order_by:{ts:desc},limit:60){id text amount ts kind actor counterparty txHash}
}`;

export interface PrivateDeps {
  app: Express;
  famfiRead: ethers.Contract;
  chainId: bigint | (() => Promise<bigint>);
  envioUrl: string;
  limited: (key: string) => boolean;
  knownTeens?: () => string[];
}

export function mountPrivate({ app, famfiRead, chainId, envioUrl, limited, knownTeens }: PrivateDeps) {
  const readGoals = liveGoalsReader(famfiRead);
  const readApprovals = liveApprovalsReader(famfiRead);
  const readRoster = familyRosterReader(famfiRead);
  app.post("/private/query", async (req, res) => {
    try {
      if (!envioUrl) return res.status(503).json({ error: "private reads are not configured (set ENVIO_URL)" });
      const auth = req.body?.auth;
      if (!auth || !ethers.isAddress(auth.reader) || typeof auth.signature !== "string" || !Number.isSafeInteger(auth.expiry))
        return res.status(400).json({ error: "bad auth" });
      const now = Math.floor(Date.now() / 1000);
      if (auth.expiry <= now) return res.status(401).json({ error: "sign-in expired, please sign in again" });
      if (auth.expiry > now + MAX_AUTH_SECONDS) return res.status(400).json({ error: "auth lasts too long" });

      const cid = typeof chainId === "function" ? await chainId() : chainId;
      const domain = { name: "FamFiRead", version: "1", chainId: cid, verifyingContract: await famfiRead.getAddress() };
      let signer: string;
      try {
        signer = ethers.verifyTypedData(domain, READ_TYPES, { reader: auth.reader, expiry: BigInt(auth.expiry), scope: READ_SCOPE }, auth.signature);
      } catch {
        return res.status(401).json({ error: "bad signature" });
      }
      if (signer.toLowerCase() !== String(auth.reader).toLowerCase()) return res.status(401).json({ error: "bad signature" });
      if (limited("read:" + signer.toLowerCase())) return res.status(429).json({ error: "slow down" });

      // Role and family come from the contract, never from the request.
      const acct = await famfiRead.accounts(signer);
      const role = BigInt(acct.role);
      const familyId = Number(acct.familyId);
      if ((role !== ROLE_PARENT && role !== ROLE_TEEN) || familyId === 0)
        return res.status(403).json({ error: "only a parent or teen in a family can read this" });

      const variables = { f: familyId, fs: String(familyId), a: signer.toLowerCase() };
      const query = role === ROLE_PARENT ? PARENT_QUERY : TEEN_QUERY;
      let json: any = {};
      let indexerError: string | null = null;
      try {
        const r = await fetch(envioUrl, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000),
        });
        json = await r.json().catch(() => ({}));
        if (!r.ok || !json.data) throw new Error(json.errors?.[0]?.message || "The indexer is unavailable");
      } catch (e: any) {
        indexerError = e?.name === "TimeoutError" ? "Family history timed out" : e?.message || "Family history is unavailable";
        // These are absent summaries, never synthetic events or balances.
        json = { data: Object.fromEntries(["family", "missions", "goals", "progress", "weeks", "history", "funds", "fundEntries", "savingReceipts", "matchReleases"].map((key) => [key, []])) };
      }
      const [goalsResult, approvalsResult] = await Promise.allSettled([
        bounded(readGoals(signer, familyId, role === ROLE_PARENT, json.data.goals ?? [])),
        bounded(readApprovals(signer, familyId, role === ROLE_PARENT, json.data)),
      ]);
      let liveGoals: "verified" | "unavailable" = "unavailable";
      if (goalsResult.status === "fulfilled") {
        json.data.goals = goalsResult.value;
        liveGoals = "verified";
      }
      let liveApprovals: "verified" | "unavailable" = "unavailable";
      if (approvalsResult.status === "fulfilled") {
        const current = approvalsResult.value;
        json.data.outgoingRequests = current.outgoingRequests;
        if (role === ROLE_PARENT) { json.data.requests = current.incomingRequests; json.data.holds = current.holds; }
        else { json.data.incomingRequests = current.incomingRequests; json.data.teenHolds = current.holds; }
        liveApprovals = "verified";
      }
      if (role === ROLE_PARENT) {
        const candidates = [...(knownTeens?.() ?? []), ...(json.data.teens ?? []).map((t: any) => t.id), ...(json.data.goals ?? []).map((g: any) => g.teen).filter(Boolean), ...(approvalsResult.status === "fulfilled" ? approvalsResult.value.candidates : [])];
        try { json.data.teens = await bounded(readRoster(familyId, candidates)); }
        catch { /* Keep indexed roster, with the history/sync notices shown by the app. */ }
      }
      if (indexerError && liveGoals === "unavailable" && liveApprovals === "unavailable") return res.status(502).json({ error: indexerError });
      const fresh = json.extensions?.freshness;
      const rosterComplete = !indexerError && fresh?.indexedBlock != null && fresh?.lagBlocks != null && fresh.lagBlocks <= 10 && !fresh.error;
      let commitments;
      if (role === ROLE_PARENT) {
        try { commitments = await bounded(familySummary(famfiRead, signer, familyId, json.data.teens ?? [], rosterComplete)); }
        catch { commitments = { coverage: "unavailable", blockNumber: null, allowance: null, missions: null, futureFunds: null }; }
      }
      let identities;
      try {
        const parentAddress = await famfiRead.familyParent(familyId);
        const parent = await famfiRead.accounts(parentAddress);
        identities = { parent: { id: parentAddress.toLowerCase(), famId: ethers.decodeBytes32String(parent.famId) } };
      } catch { /* Identity stays unavailable. */ }
      res.json({ role: role === ROLE_PARENT ? "PARENT" : "TEEN", familyId, data: json.data, identities, commitments, liveGoals, liveApprovals, indexerError, freshness: fresh });
    } catch (e: any) {
      res.status(500).json({ error: e?.shortMessage || e?.message || "read failed" });
    }
  });
}
