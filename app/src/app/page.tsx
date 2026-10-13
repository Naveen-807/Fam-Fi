"use client";
import Link from "next/link";
import { Shell } from "@/components/ui";
import { AnimatedOutline, FlowDiagram } from "@/components/effects";

export default function Home() {
  return <Shell><main id="main-content" className="landing">
    <section className="landing-hero">
      <p className="eyebrow"><span className="status-dot"/> FAMILY MONEY. A LITTLE MORE INDEPENDENT.</p>
      <h1>A little freedom.<br/>A lot of possibility.</h1>
      <p className="landing-description">Their first allowance. A goal worth saving for.<br className="desktop-break"/> One place to build better money habits, together.</p>
      <div className="landing-actions"><Link href="/parent" className="landing-button">Start as a parent <span aria-hidden="true">↗</span></Link><Link href="/teen" className="landing-button landing-button-secondary">I'm a teen</Link></div>
      <Link href="/gift" className="text-link">Help someone reach their goal <span aria-hidden="true">↗</span></Link>
    </section>
    <div className="feature-ribbon" aria-label="Fam-Fi features"><span>Allowance, without the friction</span><i/><span>Limits you choose</span><i/><span>Goals worth saving for</span><i/><span>Every action, a clear story</span></div>
    <section id="how-it-works" className="landing-showcase">
      <div className="showcase-heading"><div><p className="eyebrow">ONE FAMILY. CONNECTED.</p><h2>Good habits.<br/>Built into everyday money.</h2></div><p>A little guidance now.<br/>More confidence for what comes next.</p></div>
      <div className="feature-panels">
        <article className="feature-panel"><span className="feature-number">01 / FREEDOM</span><h3>Their money.<br/>Their next step.</h3><p>Fund an allowance. Your teen pays friends by Fam-ID, within the limits you choose.</p><div className="diagram-frame"><AnimatedOutline accent="coral"/><FlowDiagram variant="allowance"/></div><Link href="/parent" className="feature-link">Set up your family <span aria-hidden="true">↗</span></Link></article>
        <article className="feature-panel"><span className="feature-number">02 / GUIDANCE</span><h3>A pause.<br/>When it matters.</h3><p>Unusual payments are held for review. Spending rules stay clear, with you in control.</p><div className="diagram-frame"><AnimatedOutline accent="blue" delay={2}/><FlowDiagram variant="guidance"/></div><Link href="/parent?view=family" className="feature-link">Choose their starting rules <span aria-hidden="true">↗</span></Link></article>
        <article className="feature-panel"><span className="feature-number">03 / MOMENTUM</span><h3>Small savings.<br/>Something bigger.</h3><p>A goal, a matched gift, a funded mission. Give their effort something real behind it.</p><div className="diagram-frame"><AnimatedOutline accent="mint" delay={4}/><FlowDiagram variant="saving"/></div><Link href="/gift" className="feature-link">Help a goal along <span aria-hidden="true">↗</span></Link></article>
      </div>
    </section>
    <section className="landing-closing"><p className="eyebrow">LOOKING A LITTLE FURTHER AHEAD</p><h2>A future of their own.<br/>A family behind them.</h2><p>FutureFund sets test money aside for a chosen horizon.<br/>It holds money in the contract ledger; it does not invest it or earn returns.</p><Link href="/parent?view=savings" className="landing-button">Explore savings & future <span aria-hidden="true">↗</span></Link><div className="orbit-mark" aria-hidden="true"><i/><i/><i/></div></section>
    <footer className="landing-footer"><span>fam-fi. <span className="footer-muted">Made for families, on Monad.</span></span><span>Testnet prototype · Test USDC has no real value.</span></footer>
  </main></Shell>;
}
