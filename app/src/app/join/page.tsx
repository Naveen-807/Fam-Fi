"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ActionError, Button, Card, Empty, Field, Input, Shell, SignIn } from "@/components/ui";
import { useFamIdCheck } from "@/components/onboard";
import { fam, famIdBytes, provider, ROLE } from "@/lib/chain";
import { relay } from "@/lib/relay";
import { useAct, useMe, useNow } from "@/lib/hooks";
import { describeTerms } from "@/lib/terms";
import { useWallet } from "@/lib/wallet";
import { cfg } from "@/lib/config";
import { inviteSigner, parseInvite } from "@/lib/invite";

export default function JoinPage() {
  return (
    <Suspense fallback={<Shell><Empty>Loading…</Empty></Shell>}>
      <Join />
    </Suspense>
  );
}

function Join() {
  const q = useSearchParams();
  const router = useRouter();
  const { signer, logout } = useWallet();
  const { acct, loaded, error: accountError, refresh } = useMe();
  const { busy, run, error: actionError } = useAct();
  const [name, setName] = useState("");
  const [signingRecovery, setSigningRecovery] = useState(false);
  const state = useFamIdCheck(name);

  const key = q.toString();
  const { invite, error: linkError } = useMemo(() => parseInvite(new URLSearchParams(key), cfg), [key]);
  const [check, setCheck] = useState<{ key: string; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const now = useNow(1000);
  useEffect(() => {
    setCheck(null);
    if (!invite) return;
    let alive = true;
    void (async () => {
      try {
        let parentSigner: string;
        try { parentSigner = inviteSigner(invite, cfg); }
        catch { throw new Error("This invite signature is invalid. Ask your parent for a fresh link."); }
        const [parent, used, block] = await Promise.all([fam.familyParent(invite.familyId), fam.usedInvite(invite.inviteId), provider.getBlock("latest")]);
        if (parentSigner.toLowerCase() !== String(parent).toLowerCase()) throw new Error("This invite doesn't match the parent's signature for this family. Ask for a fresh link.");
        if (used) throw new Error("This invite has already been used. Ask your parent to create another one.");
        if (block && block.timestamp > invite.deadline) throw new Error("This invite has expired. Ask your parent for a fresh link.");
        if (alive) setCheck({ key, error: null });
      } catch (e: any) {
        if (alive) setCheck({ key, error: e?.message?.startsWith("This invite") ? e.message : "Couldn't check this invite on the network. Try again in a moment." });
      }
    })();
    return () => { alive = false; };
  }, [invite, key, retry]);
  const problem = linkError || (invite && Math.floor(now / 1000) > invite.deadline ? "This invite has expired. Ask your parent for a fresh link." : check?.key === key ? check.error : null);

  if (problem || !invite)
    return (
      <Shell>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">We couldn't open this invite</h1>
          <p className="mt-2 text-sm text-muted" role="alert">{problem}</p>
          {invite && <Button className="mt-4" variant="ghost" onClick={() => setRetry((n) => n + 1)}>Check again</Button>}
        </Card>
      </Shell>
    );
  if (check?.key !== key) return <Shell><Empty>Checking your invite…</Empty></Shell>;
  if (!signer) return <Shell><SignIn title="Join your family" blurb="Use your own email, separate from your parent's. Sign in, then pick your Fam-ID. Your invite stays open while you sign in." /></Shell>;
  if (!loaded) return <Shell><Empty>Loading…</Empty></Shell>;
  if (accountError) return <Shell><Card title="Couldn't check your account"><p role="alert">{accountError}</p><Button onClick={() => void refresh()}>Try again</Button></Card></Shell>;
  if (acct && acct.role !== ROLE.NONE)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">You already have an account</h1>
          <p className="mt-2 text-sm text-muted">You're signed in as @{acct.famId}. Your teen needs their own email. Switch accounts here; this invite stays open.</p>
          <Button className="mt-4" onClick={logout}>Sign out and use teen's email</Button>
          <Link href={acct.role === ROLE.TEEN ? "/teen" : "/parent"} className="link-button link-button-secondary mt-4">Go to my account</Link>
        </Card>
      </Shell>
    );

  return (
    <Shell>
      <Card className="mx-auto mt-6 max-w-md">
        <h1 className="text-2xl font-bold">You&apos;re invited 🎉</h1><ActionError error={actionError}/>
        <p className="mt-1 text-sm text-muted">Pick a Fam-ID. Friends will use it to pay you, and you won&apos;t need to share any long codes.</p>
        <div className="mt-4 rounded-xl bg-card2 p-4 text-sm text-muted">
          <p className="mb-1 font-semibold text-fg">The rules your parent chose</p>
          <ul className="list-disc space-y-1 pl-5">{describeTerms(invite.terms).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Your Fam-ID" hint={{ empty: "3–20 letters, numbers or _", bad: "Use 3–20 lowercase letters, numbers or _", checking: "Checking…", free: "Available ✓", taken: "Already taken", unavailable: "Couldn't check availability. Retrying…" }[state]}>
            <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="e.g. alex" maxLength={20} autoFocus aria-label="Fam-ID" />
          </Field>
          <Button
            full
            disabled={state !== "free"}
            busy={busy === "join"}
            onClick={async () => {
              setSigningRecovery(false);
              const ok = await run("join", async () => {
                try {
                  return await relay(signer, "acceptInvite", [invite.familyId, invite.inviteId, BigInt(invite.deadline), invite.terms, invite.sig, famIdBytes(name)]);
                } catch (e: any) {
                  if (/wallet signing access|forbidden|unauthorized/i.test(e?.message ?? "")) setSigningRecovery(true);
                  throw e;
                }
              }, `Welcome, @${name}!`);
              if (ok) router.push("/teen");
            }}
          >
            Join my family
          </Button>
          {signingRecovery && <div role="alert" className="rounded-xl bg-card2 p-4 text-sm">
            <p>Sign in again with the same teen email to renew wallet access. This invite stays open.</p>
            <Button variant="ghost" className="mt-3" onClick={logout}>Sign out and reconnect</Button>
          </div>}
        </div>
      </Card>
    </Shell>
  );
}
