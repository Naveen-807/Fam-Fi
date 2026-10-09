"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Empty, Field, Input, Shell, SignIn } from "@/components/ui";
import { useFamIdCheck } from "@/components/onboard";
import { famIdBytes, ROLE } from "@/lib/chain";
import { relay } from "@/lib/relay";
import { useAct, useMe } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";

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
  const { signer } = useWallet();
  const { acct, loaded } = useMe();
  const { busy, run } = useAct();
  const [name, setName] = useState("");
  const state = useFamIdCheck(name);

  const f = Number(q.get("f"));
  const inviteId = q.get("i") || "";
  const deadline = Number(q.get("d"));
  const sig = q.get("s") || "";
  const valid = Number.isInteger(f) && f > 0 && /^0x[0-9a-fA-F]{64}$/.test(inviteId) && deadline > 0 && /^0x[0-9a-fA-F]+$/.test(sig);

  if (!valid)
    return (
      <Shell>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">This invite link looks incomplete</h1>
          <p className="mt-2 text-sm text-slate-600">Ask your parent to create a fresh one from their Fam-Fi page.</p>
        </Card>
      </Shell>
    );
  if (!signer) return <Shell><SignIn title="Join your family" blurb="Sign in first, then pick your Fam-ID." /></Shell>;
  if (!loaded) return <Shell><Empty>Loading…</Empty></Shell>;
  if (acct && acct.role !== ROLE.NONE)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">You already have an account</h1>
          <p className="mt-2 text-sm text-slate-600">@{acct.famId} can&apos;t join another family. Sign out and open the link with a new login.</p>
          <Link href={acct.role === ROLE.TEEN ? "/teen" : "/parent"}><Button className="mt-4" variant="ghost">Go to my account</Button></Link>
        </Card>
      </Shell>
    );

  return (
    <Shell>
      <Card className="mx-auto mt-6 max-w-md">
        <h1 className="text-2xl font-bold">You&apos;re invited 🎉</h1>
        <p className="mt-1 text-sm text-slate-600">Pick a Fam-ID. Friends will use it to pay you, and you won&apos;t need to share any long codes.</p>
        <div className="mt-5 space-y-4">
          <Field label="Your Fam-ID" hint={{ empty: "3–20 letters, numbers or _", bad: "Use 3–20 lowercase letters, numbers or _", checking: "Checking…", free: "Available ✓", taken: "Already taken" }[state]}>
            <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="e.g. alex" maxLength={20} autoFocus aria-label="Fam-ID" />
          </Field>
          <Button
            full
            disabled={state !== "free"}
            busy={busy === "join"}
            onClick={async () => {
              const ok = await run("join", () => relay(signer, "acceptInvite", [f, inviteId, BigInt(deadline), sig, famIdBytes(name)]), `Welcome, @${name}!`);
              if (ok) router.push("/teen");
            }}
          >
            Join my family
          </Button>
        </div>
      </Card>
    </Shell>
  );
}
