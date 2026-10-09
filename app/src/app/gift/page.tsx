"use client";
import Link from "next/link";
import { Button, Card, Empty, GoalCard, Shell } from "@/components/ui";
import { Q, useGql } from "@/lib/gql";
import { useMe } from "@/lib/hooks";

export default function GiftIndex() {
  const { acct } = useMe();
  const { data } = useGql<{ Goal: any[] }>(Q.openGoals, {}, "open", 2500);
  return (
    <Shell famId={acct?.famId}>
      <Card title="Goals you can help with">
        <p className="mb-4 text-sm text-slate-600">
          Lock a gift behind a goal. Every dollar the teen saves releases a dollar of yours, and you can take back whatever isn&apos;t used.
        </p>
        {!data ? (
          <Empty>Loading…</Empty>
        ) : data.Goal.length === 0 ? (
          <Empty>No goals are open for gifts yet. A parent has to approve one first.</Empty>
        ) : (
          <div className="space-y-3">
            {data.Goal.map((g) => (
              <GoalCard key={g.id} g={g}>
                <Link href={`/gift/${g.id}`}><Button>Help with this goal</Button></Link>
              </GoalCard>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
