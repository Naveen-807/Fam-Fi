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
      <section className="relative grid items-center gap-8 pt-6 sm:grid-cols-[1.1fr_.9fr]">
        <div className="animate-fadeUp">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
            <span className="h-2 w-2 animate-pulseRing rounded-full bg-brand" /> Live on Monad · settles in ~1 second
          </span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            Allowance that <span className="yellow-grad bg-clip-text text-transparent">grows up</span> with your kid.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            Teens pay friends by name inside limits their parents set. Save toward a goal and a relative&apos;s gift matches every dollar
            you put in. Settled in about a second.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
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
        </div>

        <div className="relative mx-auto w-full max-w-xs animate-float" aria-hidden>
          <div className="absolute -inset-6 rounded-full bg-brand/20 blur-3xl" />
          <div className="yellow-grad stripe relative aspect-[1.58] w-full rounded-3xl p-5 text-onbrand shadow-glow">
            <div className="flex items-center justify-between">
              <span className="text-lg font-black">Fam-Fi</span>
              <span className="rounded-full bg-onbrand px-2.5 py-0.5 text-[10px] font-extrabold text-brand">LEVEL 2</span>
            </div>
            <p className="mt-6 text-xs font-bold opacity-70">You can spend</p>
            <p className="num text-4xl font-black tracking-tight">$24.50</p>
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-xs font-bold">
              <span>@alex</span>
              <span className="opacity-70">Daily limit 10.00</span>
            </div>
          </div>
        </div>
      </section>

      {cfg.judgeMode && (
      <Card className="mt-10" title="Judge Mode">
        <p className="mb-4 text-sm text-muted">
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
              className="rounded-xl border border-line p-4 text-left transition hover:border-brand hover:bg-brand/10"
            >
              <p className="font-semibold">
                {p.label} <span className="font-normal text-dim">@{p.name}</span>
              </p>
              <p className="mt-0.5 text-sm text-dim">{p.blurb}</p>
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
            <h3 className="font-extrabold text-brand">{t}</h3>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-dim">
        Testnet demo. The dollars here are test USDC and have no value. Unaudited software; do not use real money.
      </p>
    </Shell>
  );
}
