"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Field, GoalCard, Input, Money, Pill, Proof, Shell, SignIn, useToast } from "@/components/ui";
import { Onboard } from "@/components/onboard";
import { ROLE, readBalance } from "@/lib/chain";
import { faucet, relay, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useMe } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { big, cap, fmt, parseAmount } from "@/lib/format";

export default function GiftPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const { signer } = useWallet();
  const { acct, loaded, refresh } = useMe();
  const goal = useGql<{ Goal: any[] }>(Q.goal, { id: goalId }, `goal${goalId}`);
  const gifts = useGql<{ Gift: any[] }>(Q.giftsOfGoal, { id: goalId }, `gifts${goalId}`);
  const g = goal.data?.Goal?.[0];

  return (
    <Shell famId={acct?.famId}>
      {!goal.data ? (
        <Empty>Loading…</Empty>
      ) : !g ? (
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">We can&apos;t find that goal</h1>
          <p className="mt-2 text-sm text-slate-600">The link may be old or mistyped.</p>
          <Link href="/gift"><Button className="mt-4" variant="ghost">See open goals</Button></Link>
        </Card>
      ) : (
        <div className="mx-auto max-w-md space-y-5">
          <Card>
            <p className="text-sm text-slate-500">{cap(g.teenFamId)} is saving for</p>
            <h1 className="mb-4 text-2xl font-bold">{g.memo}</h1>
            <GoalCard g={g} />
            {(gifts.data?.Gift ?? []).length > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Already backed by {gifts.data!.Gift.map((x) => `${cap(x.sponsorFamId)} (${fmt(big(x.amount))})`).join(", ")}.
              </p>
            )}
          </Card>

          {!signer ? (
            <SignIn title="Give a gift" blurb="Sign in with your email. It takes a minute, and you never need a wallet." personas={[{ name: "aunt", label: "Judge Mode: Aunt" }]} />
          ) : !loaded ? (
            <Empty>Loading…</Empty>
          ) : !acct || acct.role === ROLE.NONE ? (
            <Onboard kind="relative" onDone={refresh} />
          ) : acct.role === ROLE.SPONSOR || acct.role === ROLE.PARENT ? (
            g.status === "ACTIVE" ? <Give goal={g} gifts={gifts.data?.Gift ?? []} famId={acct.famId} /> : <Card><Empty>This goal isn&apos;t open for gifts right now ({g.status.toLowerCase()}).</Empty></Card>
          ) : (
            <Card><Empty>Gifts come from relatives and parents. This account is a {acct.role === ROLE.TEEN ? "teen" : "shop"}.</Empty></Card>
          )}
        </div>
      )}
    </Shell>
  );
}

function Give({ goal, gifts, famId }: { goal: any; gifts: any[]; famId: string }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const toast = useToast();
  const [amount, setAmount] = useState("20");
  const [ratio, setRatio] = useState("1000000");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxResult | null>(null);
  const me = signer!.address.toLowerCase();
  const mine = gifts.filter((x) => x.sponsor === me);

  const refreshBalance = useCallback(async () => setBalance(await readBalance(signer!.address)), [signer]);
  useEffect(() => {
    void refreshBalance();
    const t = setInterval(refreshBalance, 2500);
    return () => clearInterval(t);
  }, [refreshBalance]);

  const amt = parseAmount(amount);
  const short = amt !== null && balance !== null && balance < amt;
  const per = Number(ratio) / 1e6;

  async function lock() {
    if (!amt) return toast.err("Enter how much to put behind this goal.");
    const deadline = Number(goal.deadline) + 7 * 86400;
    const r = await run("lock", () => relay(signer!, "lockMatch", [BigInt(goal.id), amt, BigInt(ratio), BigInt(deadline)]));
    if (r) { setTx(r); toast.ok(`${fmt(amt)} is now behind "${goal.memo}"`); void refreshBalance(); }
  }

  return (
    <>
      <Card title="Your gift">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Your balance (@{famId})</span>
          <Money value={balance ?? 0n} size="sm" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Put behind the goal"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Gift amount" /></Field>
          <Field label="Match">
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} aria-label="Match ratio" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="500000">50¢ for every $1 saved</option>
              <option value="1000000">$1 for every $1 saved</option>
              <option value="2000000">$2 for every $1 saved</option>
            </select>
          </Field>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Each time {cap(goal.teenFamId)} saves $1, <b>${per.toFixed(2)}</b> of your gift joins it automatically. Anything not matched, you can take back once the goal is reached or ends.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {short && (
            <Button variant="soft" busy={busy === "add"} onClick={() => run("add", async () => { const r = await faucet(famId); await refreshBalance(); return r; }, (r) => `Added ${r.amount} test dollars`)}>
              + Add test money
            </Button>
          )}
          <Button busy={busy === "lock"} disabled={short || !amt} onClick={lock}>Lock my gift</Button>
        </div>
        {short && <p className="mt-2 text-xs text-slate-500">You need a little more test money first.</p>}
        <Proof tx={tx} label="Gift locked" />
      </Card>

      {mine.length > 0 && (
        <Card title="Your gifts here">
          <div className="space-y-2">
            {mine.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  {fmt(big(x.amount))} locked · <b>{fmt(big(x.released))}</b> released · {fmt(big(x.escrow))} unused
                </span>
                {big(x.escrow) > 0n && (
                  <Button variant="ghost" busy={busy === "rc" + x.id} onClick={() => run("rc" + x.id, () => relay(signer!, "reclaimGift", [BigInt(x.id)]), "Taken back")}>
                    Take back unused
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">You can take back what&apos;s unused once the goal is reached or its time is up.</p>
        </Card>
      )}
      <Pill tone="slate">{`Goal #${goal.id}`}</Pill>
    </>
  );
}
