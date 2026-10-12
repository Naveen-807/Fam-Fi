"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Money, Pill, Progress, Proof, Shell, SignIn } from "@/components/ui";
import { Onboard } from "@/components/onboard";
import { ROLE, readBalance } from "@/lib/chain";
import { faucet, relay, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useMe } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { big, cap, fmt } from "@/lib/format";

export default function SplitPage() {
  const { id } = useParams<{ id: string }>();
  const { signer } = useWallet();
  const { acct, loaded, refresh } = useMe();
  const split = useGql<{ Split: any[] }>(Q.split, { id }, `sp${id}`, 1000);
  const shares = useGql<{ SplitShare: any[] }>(Q.splitShares, { id }, `ss${id}`, 1000);
  const s = split.data?.Split?.[0];
  const paidBy: string[] = (shares.data?.SplitShare ?? []).map((x) => x.payerFamId);

  return (
    <Shell famId={acct?.famId}>
      <div className="mx-auto max-w-md space-y-5">
        {!split.data ? (
          <Empty>Loading…</Empty>
        ) : !s ? (
          <Card className="text-center"><h1 className="text-xl font-bold">We can&apos;t find that split</h1><p className="mt-2 text-sm text-muted">The link may be old or mistyped.</p></Card>
        ) : (
          <>
            <Card>
              <p className="text-sm text-dim">{cap(s.creatorFamId)} paid for</p>
              <h1 className="text-2xl font-bold">{s.memo}</h1>
              <p className="mt-1 text-sm text-muted">Your share is <b className="num">${fmt(big(s.perShare))}</b></p>
              <div className="mt-4">
                <Progress value={BigInt(s.paid)} max={BigInt(s.slots)} />
                <p className="num mt-1.5 text-xs text-dim">{s.paid} of {s.slots} have paid</p>
              </div>
              {paidBy.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {paidBy.map((n) => <Pill key={n} tone="mint">{cap(n)} ✓</Pill>)}
                </div>
              )}
            </Card>

            {!signer ? (
              <SignIn title="Pay your share" blurb="Sign in with your email to pay. It takes a minute." />
            ) : !loaded ? (
              <Empty>Loading…</Empty>
            ) : !acct || acct.role === ROLE.NONE ? (
              <Onboard kind="friend" onDone={refresh} />
            ) : (
              <Pay split={s} me={acct.famId} already={paidBy.includes(acct.famId)} />
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function Pay({ split, me, already }: { split: any; me: string; already: boolean }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxResult | null>(null);
  const share = big(split.perShare);
  const isCreator = signer!.address.toLowerCase() === split.creator;
  const full = Number(split.paid) >= Number(split.slots);

  const refreshBalance = useCallback(async () => setBalance(await readBalance(signer!.address)), [signer]);
  useEffect(() => {
    void refreshBalance();
    const t = setInterval(refreshBalance, 2500);
    return () => clearInterval(t);
  }, [refreshBalance]);

  if (isCreator)
    return <Card><p className="text-sm text-muted">This is your split. Send the link to your friends and watch it fill up above.</p></Card>;
  if (already || tx)
    return (
      <Card>
        <p className="font-semibold text-brand">You&apos;ve paid your share ✓</p>
        {tx?.held && <p className="mt-2 rounded-xl bg-warn/15 px-4 py-3 text-sm text-warn">Your payment is on hold for a moment {tx.held.kind === 0 ? "because it's over your daily limit, so a parent has to OK it" : "because it looks unusual, and a parent was alerted"}.</p>}
        <Proof tx={tx} label={tx?.held ? "Held" : "Paid"} />
      </Card>
    );
  if (full) return <Card><Empty>Everyone has already paid. Nothing to do here.</Empty></Card>;

  const short = balance !== null && balance < share;
  return (
    <Card title="Your share">
      <div className="flex items-center justify-between text-sm">
        <span className="text-dim">Your balance (@{me})</span>
        <Money value={balance ?? 0n} size="sm" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {short && (
          <Button variant="soft" busy={busy === "add"} onClick={() => run("add", async () => { const r = await faucet(me); await refreshBalance(); return r; }, (r) => `Added ${r.amount} test dollars`)}>
            + Add test USDC
          </Button>
        )}
        <Button
          busy={busy === "pay"}
          disabled={short}
          onClick={async () => { const r = await run("pay", () => relay(signer!, "paySplitShare", [BigInt(split.id)])); if (r) setTx(r); }}
        >
          Pay ${fmt(share)}
        </Button>
      </div>
    </Card>
  );
}
