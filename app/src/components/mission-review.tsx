"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { cfg } from "@/lib/config";
import { provider } from "@/lib/chain";
import { useCapabilities } from "./flow-status";
import { Button, ConfirmDialog } from "./ui";
import { useAct } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { relay } from "@/lib/relay";
import type { Changed } from "./missions";

export function MissionReview({ id, onChanged }: { id: string; onChanged: Changed }) {
  const capabilities = useCapabilities();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const { signer } = useWallet(); const { busy, run } = useAct();
  useEffect(() => {
    if (capabilities.missionReviewTimeout !== true) return;
    let alive = true;
    const read = async () => {
      try {
        const contract = new ethers.Contract(cfg.famfi, ["function missionReviewDeadline(uint256) view returns(uint256)"], provider);
        const value = Number(await contract.missionReviewDeadline(id));
        if (alive) setDeadline(value);
      } catch { if (alive) setDeadline(null); }
    };
    void read(); const timer = setInterval(read,4000);
    return () => {alive=false;clearInterval(timer);};
  },[id,capabilities.missionReviewTimeout]);
  if (capabilities.missionReviewTimeout !== true) return <p className="text-xs text-muted mt-2">On this deployment, submitted rewards stay reserved until the parent decides.</p>;
  const ended = deadline !== null && Date.now()/1000 >= deadline;
  return <div className="mt-2 text-xs"><p>{deadline ? `Review ends ${new Date(deadline*1000).toLocaleString()}.` : "Checking the review deadline…"} After that, expiry returns the reward to the parent.</p>
    {ended && <Button variant="ghost" onClick={()=>setAsk(true)}>Expire and refund reward</Button>}
    <ConfirmDialog open={ask} title="Expire this submitted mission?" lines={["The reserved reward returns to the parent. The teen is not paid.","The mission closes permanently."]} busy={busy==="expire"} confirmLabel="Expire and refund" onCancel={()=>setAsk(false)} onConfirm={async()=>{const result=await run("expire",()=>relay(signer!,"expireMission",[BigInt(id)]),"Reward refunded to the parent");if(result){setAsk(false);await onChanged();}}}/>
  </div>;
}
