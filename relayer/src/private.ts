import { ethers } from "ethers";
import type { Express } from "express";

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

const MISSION = "id familyId parentFamId teen teenFamId reward deadline goalId status title description feedback createdAt submittedAt resolvedAt savedToGoal txHash lastTxHash";
const PENDING = "id fromFamId toFamId amount kind status releaseAt memo createdAt refKind txHash";
const GOAL = "id teenFamId target saved matched status deadline memo sponsorOpen";
const PROGRESS = "id teenFamId missionsCompleted missionRewards savedTotal goalsCompleted paymentsCompleted lastEventTs lastEventBlock";
const WEEK = "id teen teenFamId week weekStart missionsCompleted missionRewards savedTotal goalsCompleted paymentsCompleted allowanceFunded heldCount";
const PEVENT = "id teen kind amount text weekId ts blockNumber txHash";
const FUND = "id teenFamId name purpose target funded horizon status createdAt releasedAt";
const FENTRY = "id fundId teen kind amount text ts blockNumber txHash";
const QUALIFYING = `["MISSION_APPROVED","SAVED","GOAL_COMPLETED","PAYMENT"]`;

/** The only queries that exist. Each takes only values the server derived from the chain. */
const PARENT_QUERY = `query($f:Int!, $fs:String!, $a:String!){
  family: Family(where:{id:{_eq:$fs}}){ id tzOffset }
  missions: Mission(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:100){ ${MISSION} }
  holds: Pending(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:60){ ${PENDING} }
  goals: Goal(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:60){ ${GOAL} }
  requests: Request(where:{toAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}, limit:40){ id fromFamId amount memo createdAt }
  progress: TeenProgress(where:{familyId:{_eq:$f}}){ ${PROGRESS} }
  weeks: WeeklyStat(where:{familyId:{_eq:$f}}, order_by:{week:desc}, limit:60){ ${WEEK} }
  history: ProgressEvent(where:{familyId:{_eq:$f}, kind:{_in:${QUALIFYING}}}, order_by:{ts:desc}, limit:60){ ${PEVENT} }
  funds: FutureFund(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}, limit:40){ ${FUND} }
  fundEntries: FundEntry(where:{familyId:{_eq:$f}}, order_by:{ts:desc}, limit:100){ ${FENTRY} }
}`;

const TEEN_QUERY = `query($f:Int!, $fs:String!, $a:String!){
  family: Family(where:{id:{_eq:$fs}}){ id tzOffset }
  missions: Mission(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:100){ ${MISSION} }
  goals: Goal(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:40){ ${GOAL} }
  progress: TeenProgress(where:{id:{_eq:$a}}){ ${PROGRESS} }
  weeks: WeeklyStat(where:{teen:{_eq:$a}}, order_by:{week:desc}, limit:12){ ${WEEK} }
  history: ProgressEvent(where:{teen:{_eq:$a}, kind:{_in:${QUALIFYING}}}, order_by:{ts:desc}, limit:40){ ${PEVENT} }
  funds: FutureFund(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}, limit:20){ ${FUND} }
  fundEntries: FundEntry(where:{teen:{_eq:$a}}, order_by:{ts:desc}, limit:100){ ${FENTRY} }
}`;

export interface PrivateDeps {
  app: Express;
  famfiRead: ethers.Contract;
  chainId: bigint | (() => Promise<bigint>);
  envioUrl: string;
  limited: (key: string) => boolean;
}

export function mountPrivate({ app, famfiRead, chainId, envioUrl, limited }: PrivateDeps) {
  app.post("/private/query", async (req, res) => {
    try {
      if (!envioUrl) return res.status(503).json({ error: "private reads are not configured (set ENVIO_URL)" });
      const auth = req.body?.auth;
      if (!auth || !ethers.isAddress(auth.reader) || typeof auth.signature !== "string" || typeof auth.expiry !== "number")
        return res.status(400).json({ error: "bad auth" });
      const now = Math.floor(Date.now() / 1000);
      if (auth.expiry < now) return res.status(401).json({ error: "sign-in expired, please sign in again" });
      if (auth.expiry > now + MAX_AUTH_SECONDS) return res.status(400).json({ error: "auth lasts too long" });

      const cid = typeof chainId === "function" ? await chainId() : chainId;
      const domain = { name: "FamFiRead", version: "1", chainId: cid };
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
      const r = await fetch(envioUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const json: any = await r.json().catch(() => ({}));
      if (json.errors?.length) return res.status(502).json({ error: "the indexer could not answer: " + json.errors[0].message });
      res.json({ role: role === ROLE_PARENT ? "PARENT" : "TEEN", familyId, data: json.data });
    } catch (e: any) {
      res.status(500).json({ error: e?.shortMessage || e?.message || "read failed" });
    }
  });
}
