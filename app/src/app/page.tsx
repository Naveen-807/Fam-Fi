"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Shell } from "@/components/ui";
import { useWallet } from "@/lib/wallet";
import { cfg } from "@/lib/config";

const PERSONAS = [
  { name: "priya", label: "Parent", to: "/parent", blurb: "Approve payments, set limits, freeze" },
  { name: "alex", label: "Teen", to: "/teen", blurb: "Pay by Fam-ID, split bills, save" },
  { name: "riya", label: "Teen's friend", to: "/teen", blurb: "A second teen to split with" },
  { name: "aunt", label: "Relative", to: "/gift", blurb: "Match a teen's savings" },
];

export default function Home() {
  const router = useRouter();
  const { loginDemo } = useWallet();

  return (
    <Shell>
      <section className="pt-4 text-center">
        <h1 className="mx-auto max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          The allowance that <span className="text-mint-600">grows up</span> with your kid
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-600">
          Teens pay friends by name inside limits their parents set. Save toward a goal and a relative&apos;s gift matches every dollar
          you put in. Settled in about a second.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/parent">
            <Button>I&apos;m a parent</Button>
          </Link>
          <Link href="/teen">
            <Button variant="ghost">I&apos;m a teen</Button>
          </Link>
          <Link href="/gift">
            <Button variant="ghost">I want to give a gift</Button>
          </Link>
        </div>
      </section>

      {cfg.judgeMode && (
      <Card className="mt-10" title="Judge Mode">
        <p className="mb-4 text-sm text-slate-600">
          Pick a ready-made person and click around. Every action is a real transaction on the test network, and nobody needs any gas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                loginDemo(p.name);
                router.push(p.to);
              }}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-mint-500 hover:bg-mint-50"
            >
              <p className="font-semibold">
                {p.label} <span className="font-normal text-slate-400">@{p.name}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{p.blurb}</p>
            </button>
          ))}
        </div>
      </Card>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Spend inside limits", "A daily limit that rises as you hit goals. Bigger payments wait for a parent's tap."],
          ["Unusual? It pauses", "A first big payment to someone new is held for a few minutes and a parent is alerted. A delay and an alert, not a guarantee."],
          ["Gifts that match", "A relative locks a gift. Every dollar you save releases a dollar of theirs, in the same moment."],
        ].map(([t, d]) => (
          <Card key={t}>
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Testnet demo. The dollars here are test USDC and have no value. Unaudited software; do not use real money.
      </p>
    </Shell>
  );
}
