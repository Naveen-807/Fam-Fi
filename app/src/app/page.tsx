"use client";
import Link from "next/link";
import { Button, Card, Shell } from "@/components/ui";

export default function Home() {
  return (
    <Shell>
      <section className="relative pt-6">
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

      </section>

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
        This runs on a test network. The dollars here are test USDC and have no value. Unaudited software; do not use real money.
      </p>
    </Shell>
  );
}
