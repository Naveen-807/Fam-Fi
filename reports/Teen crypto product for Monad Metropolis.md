# Pivot Fam-Fi into Potluck, the pot teens run

**Recommendation.** Do not ship Fam-Fi as an allowance wallet. Rebuild its strongest parts (passkey co-sign, emergency freeze, gasless relay, Envio feed, earned autonomy) around a different job. That job is group money that teenagers run: team dues, club funds, trip and competition money. Anyone, anywhere, can chip in with Face ID. Every spend needs a teen captain and an adult steward, and every family can see every receipt.

**Why the pivot.** Supervised teen spending is already a free commodity. Venmo Teen, Apple Cash Family, Google Wallet's under-18 balance, Cash App and India's UPI Circle all offer it ([PayPal](https://newsroom.paypal-corp.com/2023-05-22-Introducing-the-Venmo-Teen-Account); [TechCrunch](https://techcrunch.com/?p=3150666); [Business Today](https://www.businesstoday.in/amp/personal-finance/banking/story/what-is-upi-circle-how-the-new-feature-is-making-digital-payments-safer-for-families-teenagers-534941-2026-06-05)). "Programmable teen allowance" has also been built at least five times at hackathons, once on Monad testnet ([HackQuest Pocket Money](https://hackquest.io/projects/Pocket-Money)). Group treasuries are different. They have hard evidence of failure: booster-club treasurers keep moving funds through personal Venmo accounts, including **$44,821.92 in one Tennessee case** ([TN Comptroller](https://www.comptroller.tn.gov/content/dam/cot/ia/advanced-search/2026/school-support-organization/DeKalbCountyBandBoostersReport.pdf)). No researched product offers a teen-run treasury. The idea also matches Track 02's own example, "shared wallets and group spending that settle without an intermediary" ([monad.xyz/metropolis](https://www.monad.xyz/metropolis)).

**Stack.** Use **Mera passkeys rather than Dynamic** and **AUSD as the unit**. That combination reportedly unlocks Agora Cross-Border ($10k), both Mera bounties ($2.5k + $2.5k), Chainlink CRE ($3k), Envio ($1k) and Alchemy credits. The integrations are things the product needs anyway.

**Scores and odds.** On the requested weighted matrix, Potluck scores **77.5 as first conceived and 81 after the judge-driven revisions**. Fam-Fi scores **53** as specified and **58** with its gameable autonomy fixed. Potluck has a realistic shot at a Track 02 podium. The grand champion title depends on execution polish and on a field we cannot see.

Labels used throughout:

| Label | Meaning |
|---|---|
| **[OFFICIAL]** | Monad's public pages |
| **[REPORTED]** | Participant READMEs quoting the login-gated rules; unverified |
| **[INFERENCE]** | Analysis that goes beyond the sources |
| **[ASSUMPTION]** / **[HYPOTHESIS]** | Untested premises |

Nothing in this report is legal advice.

---

## 1. Hackathon facts: six official dates, a reported 3-minute cap, and a Mera-vs-Dynamic fork worth $10k

### The officially confirmed core

| Fact | Status | Detail |
|---|---|---|
| Build window | **[OFFICIAL]** | 1 Sep – 13 Oct 2026 (six weeks) ([monad.xyz/metropolis](https://www.monad.xyz/metropolis)) |
| Submission deadline | **[OFFICIAL]** 13 Oct; **[REPORTED]** "11:59 PM ET" | Late entries reportedly not accepted. Edits allowed until the deadline ([merchant-rails README](https://github.com/precious-akpan/monad-metropolis-merchant-rails)). Rise In's page contradicts itself (12 Oct / 2 Nov) ([Rise In](https://www.risein.com/monad/monad-metropolis-hackathon)) |
| Judging / winners | **[OFFICIAL]** | 14–27 Oct / 3 Nov |
| Deliverables | **[OFFICIAL]** | "A working product with a public project profile: a demo, a short write-up, and a link to the code" ([dev page](https://monad.xyz/developers/hackathons/metropolis)) |
| Open source | **[OFFICIAL]** "encouraged but not required"; **[REPORTED]** OSI license + public GitHub required (§7.2) | Conflict. Follow the stricter reading |
| New-work rule | **[OFFICIAL]** | Existing projects are allowed "if the work you submit is new" |
| Tracks | **[OFFICIAL]** | 4 tracks. Choose one at application. **$30k per track split evenly across 3 teams ($10k each)**. **Grand champion $25k** across all tracks |
| Total pool | **[OFFICIAL]** "$250k+" headline; **[REPORTED]** $145k core | The headline includes sponsor bounties |
| Track 02 wording | **[OFFICIAL]** | "Product teams focused on the user's first five minutes more than the underlying architecture." Examples: "A payments app that never mentions a blockchain to users"; "subscriptions that charge by the second"; "shared wallets and group spending that settle without an intermediary" |
| Participant age | **[REPORTED]** 18+ | The team must be adults. Teen *users* are a product question, so personas in the video are played by adults |
| Team size | **[REPORTED]** 1–5 | One project per participant and one track |
| Demo video | **[REPORTED]** **≤3 minutes**, public | Must show real Monad interactions (§4.1, §9.4) |
| AI disclosure | **[REPORTED]** | AI tools allowed but must be disclosed in the README (§4.1.4). Corroborated by two more READMEs ([TakumiPay](https://github.com/Planckify-Labs/monad-submission), [Loft](https://github.com/neromtoobad/loft)) |
| Network | **[REPORTED]** "mainnet or testnet (either is fine)" | Contract addresses or tx hashes and a "why Monad" explanation are required (§9.2) |
| Judging rubric | **[REPORTED]**, two conflicting versions | A: 5 × 20% (Product Quality, Technical Excellence, Monad Integration, Track Fit, Innovation & Impact) ([merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails)). B: Technical 20, Design 20, Originality 15, **Founder & Market Readiness 25**, Traction 20 ([Mawee](https://github.com/maulana-tech/meeaw-app)). Optimise for both, which means getting real pilot or waitlist evidence |
| Bounty judging | **[REPORTED]** | 40% adherence to published requirements, 30% technical, 20% Monad integration, 10% innovation ([curb #5](https://github.com/emmanuelist/curb/issues/5)) |
| Stacking | **Unverified** | One README says Mera and Envio bounties "stack" with a track prize ([Mawee](https://github.com/maulana-tech/meeaw-app)). No official cap was found |
| Judges | **[OFFICIAL]** | 73 judges, including Keone Hon, VCs (Paradigm, Dragonfly, Pantera, Electric Capital), **Haythem Sellami (Category Labs, maker of Mera)**, Denham (Envio), Alex Svanevik (Nansen) and Dynamic/Fireblocks staff |

### Bounty landscape: which stack to claim

The official page lists 21 open bounties by title and prize. The requirement text below comes from a README's "dashboard capture" **[REPORTED]** ([merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails)).

| Bounty | Prize | Reported requirement | Fit for a teen group-money product |
|---|---|---|---|
| Agora: Best Cross-Border Payments App | $10,000 | "mobile app letting users send AUSD across borders **using Mera passkey onboarding** and instant settlement". A PWA reportedly counts | **Natural.** Relatives abroad chip in. Loft, a direct AUSD+Mera+CRE+Envio remittance entry, competes ([Loft](https://github.com/neromtoobad/loft)) |
| Monad Foundation: Best Mera-Powered UX | $2,500 | Mera is "the entire account layer — no seed phrase, no extension, no custody backend" | **Natural** |
| Monad Foundation: Mera "One Passkey, Many Keys" | $2,500 | Most creative **non-wallet** use of PRF-derived key material ([kaskad PR #5](https://github.com/mryavascann/kaskad/pull/5)) | **Natural.** Encrypt the private details of minors (names, receipts) |
| Chainlink: Best workflow with CRE | $3,000 | CRE workflow as orchestration layer | **Natural.** Deadline refunds and scheduled chip-ins |
| Envio: Best Use of Envio | $1,000 | HyperIndex/HyperSync/HyperRPC powering a core feature | **Natural.** The ledger wall and feed |
| Alchemy | $1,000 credits | Deployed on Monad plus one Alchemy service | Easy. Use Alchemy RPC for the relayer |
| Dynamic | $5,000 | **"mutually exclusive with the Mera bounties"** | Forgo it |
| Privy | $5,000 | "login-only does not qualify"; **"also mutually exclusive with Mera"** | Forgo it |
| Aurora Intents | $5,000 | Any-chain deposits/swaps | Stretch only: "uncle pays from another chain" |
| Monad Foundation: Best Community Team Project | $5,000 | **No requirement text found** | Ask organizers. Do not assume |
| Nansen, Kuru, Perpl, Agora Mobile Trading, AI-credit bounties, Cleanverse, MetaMask | various | Mostly unknown | Not natural. Trading is 🔴 for teens; Cleanverse docs were not found |

**The fork, with arithmetic.** Agora Cross-Border reportedly *requires* Mera, and Dynamic and Privy reportedly exclude Mera. Mera therefore opens **$15k** (Agora $10k + 2 × $2.5k), against **$5k** for Dynamic. Exclusivity appears to apply to bounties you *claim*, not SDKs you touch, since Mawee uses Privy but claims Mera ([Mawee](https://github.com/maulana-tech/meeaw-app)). Two more points favour Mera, though neither is quantified:

- Mera is Monad-native and its maker sits on the judging panel **[INFERENCE]**.
- Dynamic's native gas sponsorship is 7702-based, limited to V3 MPC wallets, and **Monad was not visible on its sponsorship chain list** ([Dynamic docs](https://www.dynamic.xyz/docs/react/smart-wallets/evm-gas-sponsorship)).

**Decision: switch from Dynamic to Mera.**

---

## 2. Teen problem map: dependency is universal, but money is materially broken only in group and cross-border flows

The teen's core complaint is **being under 18**. Almost every rail runs through an adult account:

- AdSense for YouTube is 18+ ([Google](https://support.google.com/adsense/answer/2533300?hl=en)).
- Stripe Express/Custom is a hard 18+ ([Stripe](https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account)).
- Roblox's Tipalti payout step reportedly demands an 18+ birthdate ([DevForum](https://devforum.roblox.com/t/devex-incongruent-age-requeriments/2302836)).
- Western Union requires recipients to be 18+ ([Western Union](https://www.westernunion.com/us/en/frequently-asked-questions/faq-receive-money.html)).
- Paytm Pocket Money blocks international payments ([The Paypers](https://thepaypers.com/payments/news/paytm-launches-pocket-money-upi-feature-for-teenagers)).

The best-quantified social pain is group cost-sharing. Both surveys below come from payment companies, which is a bias:

- **73% of Gen Z (16–26) have had a major negative cost-sharing experience** ([Cash App](https://cash.app/press/cash-app-gen-z-money-report)).
- **76% who fronted a group expense were not repaid** ([eMarketer](https://www.emarketer.com/content/gen-z-spending-repayment-habits-group-events-breaks-with-older-generations-)).

Parents pay **$5.99–$19.98/month** (Greenlight) and **£3.99–£9.99** (GoHenry), and the upper tiers sell *safety* rather than money features ([Greenlight](https://help.greenlight.com/hc/en-us/articles/235739508-How-much-does-Greenlight-cost); [GoHenry](https://gohenry.com/uk/pricing)).

| Problem | Teens complain? | Parents pay? | Crypto materially better? | Evidence quality |
|---|---|---|---|---|
| Group money: dues, team trips, club funds, treasurer theft | Yes, fronting and repayment (73%/76%) | Yes, adults want fraud prevention | **Strong**: transparent ledger, multi-party approval, purpose locks. These map onto the auditor's recommended controls ([TN Comptroller](https://www.comptroller.tn.gov/content/dam/cot/ia/advanced-search/2026/school-support-organization/DeKalbCountyBandBoostersReport.pdf)) | Fraud cases are documented but involve **adult-run** boosters. Teen-run clubs are an [ASSUMPTION] |
| Gifts from relatives abroad | Likely | Likely | **Strong**: borderless, sub-cent, final in under a second. Off-ramp and KYC remain | Rules verified (WU 18+). Frequency not quantified |
| 18+ payout wall for earners | Yes | Maybe | Partial: platforms would still need to integrate, and tax and KYC remain | Rules verified. Size unknown |
| Overspending / in-game spending | Low | Yes | Moderate: rule-based limits. Incumbents already do this free | Mostly older or European data ([Video Games Europe](https://www.videogameseurope.eu/publication/in-game-purchases-in-european-markets-2024/)) |
| Scams / sextortion | As victims | Yes | **Weak or negative**: irreversible transfers raise the risk unless payees are allowlisted | FTC: younger people lose money more often ([FKKS/FTC](https://advertisinglaw.fkks.com/post/102k3c2/ftc-announces-top-scams-of-2024)) |
| Domestic everyday payments in India | Low | Low | **No**: UPI is free and instant | Strong |

**Segments [INFERENCE].** These follow from the evidence above:

| Age | Profile | Best wedge |
|---|---|---|
| 13–15 | Parent-controlled and gaming-heavy | A participant in pots |
| 16–17 | Captains, treasurers, earners; hit the 18+ walls | **The ideal pot captain** |
| 18–19 | Legally adult and crypto-curious; bill-splitting pain | College club treasurer |

The strongest persona is the **16–17-year-old team captain or club treasurer**. They already handle money informally, want the status of running it, and sit inside a group of 10–40 families who can audit them.

Two more observations on attitudes. UK data show **27% of 15–18s have used a crypto product but only 23% feel they understand it** ([BCB Group](https://www.bcbgroup.com/insights/young-people-and-cryptocurrency-what-the-next-generation-really-thinks-about-digital-finance)). That supports hiding the chain. The **71% of Gen Z who "would consider" stablecoins** measures intent, not use ([Motley Fool](https://www.fool.com/the-ascent/research/study-americans-cryptocurrency)).

---

## 3. Competitor war room: supervised spending is free, allowance is crowded, group money is open

| Player | Model | Price | Gap a crypto product can exploit |
|---|---|---|---|
| Greenlight | Parent-owned card, chores | $5.99–$19.98/mo | No group money; closed. Anecdotes of billing past 18 |
| GoHenry/Acorns | Card + lessons; family can invest | Subscription | ~6M subscribers combined at acquisition ([TechCrunch](https://techcrunch.com/?p=2522716)); no group money |
| Venmo Teen / Cash App / Apple Cash Family | Free supervised P2P | Free | Domestic only; P2P but no shared treasury with approvals |
| Google Wallet <18 | Tap-to-pay balance | Free | No P2P, no online, parent money only |
| Revolut Kids & Teens | Parent sub-account | Free for 1 child | Parent is liable; no group money |
| Binance Junior | Custodial crypto savings with yield | Free | Closed; teen sends only to parent or other Junior accounts ([Decrypt](https://decrypt.co/350792/binance-new-crypto-savings-account-kids)) |
| UPI Circle / Paytm Pocket Money / FamApp / Junio | Delegated INR | Free | Spend-only, domestic, no group treasury |
| Copper (dead) | BaaS teen banking | n/a | **Shut down in 24 hours** after Synapse froze ~$160M across fintechs ([TechCrunch](https://techcrunch.com/2024/05/21/teen-fintech-copper-had-to-emergency-discontinue-its-banking-debit-products); [TechCrunch](https://techcrunch.com/2024/08/22/synapses-collapse-has-frozen-nearly-160m-from-fintech-users-heres-how-it-happened)) |
| Playroom, Piggy Wallet, TeenFi, **Pocket Money (Monad testnet)**, MinorMint | Hackathon allowance wallets | n/a | Shows judges have seen "parent sets allowance via delegation" many times ([Playroom](https://ethglobal.com/showcase/playroom-wykmm); [Piggy](https://ethglobal.com/showcase/piggy-wallet-szyeh); [TeenFi](https://www.hackquest.io/projects/ERC7715-Hackathon-TeenFi-Allowance-POC); [Pocket Money](https://hackquest.io/projects/Pocket-Money); [MinorMint](https://lablab.ai/submissions/wbbwhpyu2t6cn8sthba641ux)) |
| Loft, Polaris, TakumiPay, Weir (Metropolis Track 02) | Remittance, BNPL, payments | n/a | **Loft overlaps on the Agora stack.** No teen or group-treasury entry was seen ([Loft](https://github.com/neromtoobad/loft); [Polaris](https://github.com/nickthelegend/polaris-monad)) |

**The white space.** None of the closed, custodial, domestic, parent-funded incumbents lets a teen do any of these [INFERENCE from absence]:

- Run a **shared group treasury with multi-party approval and a ledger every contributor can audit**.
- Receive money **from family abroad**.
- **Earn** from the open world into a supervised account.
- Keep a **portable record past 18 and past the provider's death**.

Fam-Fi as specified sits in the crowded middle. The pivot moves it into the first two gaps at once. It also produces the portable record as a by-product.

---

## 4. The crypto wedge and Monad's advantage, stated honestly

**Updated chain facts.**

| Fact | Detail | Source |
|---|---|---|
| Block time | **300ms**, down from 400ms since 23 Jul 2026 | [Monad blog](https://monad.xyz/blog/300ms-block-times) |
| Speculative finality | 300ms ("Voted") | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |
| Deterministic finality | **600ms** ("Finalized"); "Verified" (state root) comes 3 blocks later | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |
| P256 precompile | Native at `0x0100` (EIP-7951). Verified live, about 6.9k gas | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |
| EIP-7702 | Supported | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |
| Gas | **Charged on the gas *limit*, not gas used** | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |
| Reserve rule | **10 MON reserve** on every EOA. It bites only on 7702-delegated EOAs that send MON out | [reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance) |
| Transfer cost | A USDC transfer estimates at 83,207 gas, about **0.0085 MON**: roughly $0.0002–0.0003 at an undated, uncertain MON price | Live probe in the research notes |
| Contract size | 128KB | [Monad summary](https://docs.monad.xyz/developer-essentials/summary) |

| Mechanic in Potluck | Monad-specific? | Honest comparison |
|---|---|---|
| A teen proposes, an adult approves, and the vendor sees **final** settlement, all inside one "at the counter" moment | **Yes, strongest claim** | Base Flashblocks give ~200ms *perceived* inclusion, but that is a sequencer pre-confirmation, not finality ([Base docs](https://docs.base.org/base-chain/flashblocks/apps.md)). Arbitrum's L1 finality is ~13 min |
| Multi-party settlement: 12 families chip in, threshold met, payout. Each step is final in 600ms | **Yes** | On optimistic L2s, intermediate states are only sequencer-confirmed |
| Native P256 for enclave-signed approvals | **No** | RIP-7212 exists on major L2s (not re-verified this pass) |
| Sub-cent sponsored gas | **No** | Base and Arbitrum are also sub-cent. Monad's edge is fee stability from headroom (~14% block fill at probe; 500M gas/s) |
| Rich single-contract policy engine | Mild | The 128KB contract limit and storage-page pricing reward packed per-pot state ([differences](https://docs.monad.xyz/developer-essentials/differences)) |
| Monad-native passkey accounts (Mera) and ecosystem support (Envio, CRE, AUSD) | Ecosystem, not physics | CRE lists Monad mainnet and testnet ([Chainlink](https://docs.chain.link/cre/supported-networks-ts.md)); Envio HyperSync supports Monad ([Envio](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks)) |

**Design consequences.**

| Gotcha | What Potluck does |
|---|---|
| 7702 delegation | Not used. Funds live in the Pot contract and users hold plain zero-MON Mera EOAs, so the reserve rule never bites |
| Relayer funding | The relayer is a normal sender and needs a MON float |
| Gas-limit charging | The relayer must use `eth_estimateGas` + ~15% buffer, never a blanket limit. Category Labs warns padding "significantly overcharge[s]" ([Category Labs](https://www.category.xyz/blogs/setting-your-gas-limit-on-monad)) |
| Timestamp granularity | `block.timestamp` has 1-second granularity, so cooling-off windows are counted in seconds or blocks, not sub-second |
| Short `eth_getLogs` ranges | Ranges are 100–1,000 blocks ([RPC differences](https://docs.monad.xyz/reference/rpc-differences)), so the feed must come from Envio |
| Settlement confirmation | Show "done" at `safe` (300ms) and release the vendor receipt at `finalized` (600ms) |
| Tooling | Use Foundry ≥1.8.0 and viem ≥2.40.0 |

**The pitch line that survives an infra judge:** *"Every chip-in and every co-signed spend is final, not pre-confirmed, in 600ms, without trusting a sequencer. That is what lets 12 families and a coach treat a pot like cash on the table."*

---

## 5. Nineteen concepts scored: Potluck leads by 7 points

The weights are as specified: severity 15, teen adoption 10, parent trust 10, crypto necessity 15, Monad advantage 10, feasibility 10, novelty 10, viral 5, business 5, bounty 5, demo wow 5. Each criterion is scored 1–10 and the weighted total is out of 100. The scores are analyst judgment grounded in the evidence above **[INFERENCE]**.

| # | Concept (domain) | Sev | Adopt | Trust | Crypto | Monad | Feas | Novel | Viral | Biz | Bounty | Wow | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Potluck**: teen-run team/club pot, adult co-sign, chip-in from anywhere (club treasury + cross-border) | 8 | 7 | 8 | 8 | 7 | 7 | 8 | 9 | 7 | 9 | 8 | **77.5** |
| 2 | Grandma Link: cross-border gifts into a teen goal pot (cross-border) | 6 | 6 | 7 | 9 | 7 | 7 | 7 | 6 | 6 | 9 | 7 | **70.5** |
| 3 | Booster Ledger: adult booster-club treasury (club, not teen) | 9 | 3 | 8 | 8 | 6 | 8 | 6 | 6 | 7 | 6 | 6 | **69.0** |
| 4 | Trip deposit escrow with auto-refund (student life) | 6 | 5 | 8 | 7 | 6 | 8 | 6 | 6 | 6 | 6 | 6 | **64.5** |
| 5 | Front-Free Split: escrowed group buys so nobody fronts (P2P) | 7 | 8 | 5 | 6 | 7 | 7 | 5 | 8 | 4 | 5 | 7 | **63.5** |
| 6 | Guardian Payroll: earnings wallet past the 18+ wall (earning) | 7 | 7 | 6 | 6 | 5 | 5 | 7 | 5 | 6 | 5 | 6 | **60.5** |
| 7 | Commission escrow for teen Roblox/Discord freelancers (gaming/earning) | 6 | 6 | 5 | 7 | 6 | 6 | 7 | 5 | 5 | 4 | 6 | **59.5** |
| 8 | Graduation Key / Money Passport at 18 (identity) | 5 | 5 | 7 | 7 | 5 | 6 | 8 | 4 | 4 | 5 | 7 | **59.0** |
| 9 | Under-18 creator tip jar (creator) | 6 | 6 | 5 | 6 | 5 | 7 | 6 | 7 | 5 | 5 | 6 | **58.5** |
| 10 | Fam-Fi refined: discipline ladder, freeze, graduation (independence) | 5 | 6 | 8 | 5 | 6 | 7 | 5 | 4 | 5 | 6 | 7 | **58.0** |
| 11 | Fam-Fi original: daily limit, 3 purchases = level up | 5 | 5 | 7 | 4 | 6 | 8 | 3 | 4 | 5 | 6 | 6 | **53.0** |
| 12 | Dorm/roommate bill splitter, 18–19 (student life) | 6 | 6 | 3 | 5 | 5 | 8 | 3 | 5 | 5 | 5 | 5 | **51.5** |
| 13 | Scam Shield wallet with allowlists and cooling-off (safety) | 7 | 3 | 8 | 3 | 4 | 7 | 5 | 3 | 6 | 4 | 5 | **51.0** |
| 14 | Per-second subscriptions with parent caps (payments) | 3 | 4 | 6 | 6 | 6 | 7 | 5 | 3 | 4 | 5 | 6 | **50.5** |
| 15 | AI money mentor with policy-bounded agent wallet (AI) | 4 | 5 | 5 | 4 | 4 | 6 | 5 | 5 | 5 | 6 | 7 | **48.5** |
| 16 | Savings commitment vault + parent match (saving) | 4 | 4 | 8 | 4 | 4 | 9 | 3 | 3 | 4 | 5 | 4 | **48.0** |
| 17 | Streaming allowance + autonomy (allowance) | 3 | 5 | 6 | 4 | 4 | 8 | 3 | 4 | 4 | 6 | 6 | **46.5** |
| 18 | Stewardship credential alone (identity) | 3 | 3 | 5 | 6 | 4 | 7 | 6 | 3 | 3 | 4 | 4 | **45.5** |
| 19 | Market/trading simulator (simulation; casino risk) | 2 | 6 | 3 | 3 | 5 | 8 | 2 | 6 | 3 | 4 | 5 | **40.5** |

| Tier | Concepts |
|---|---|
| **Top 10** | Rows 1–10 |
| **Top 5** | Potluck, Grandma Link, Booster Ledger, Trip Escrow, Front-Free Split |
| **Top 3** | Potluck, Grandma Link, Booster Ledger |

The top three share **one primitive**: a purpose-locked, multi-contributor pot with threshold spending and visible receipts. Potluck wins because it takes Booster Ledger's evidence and Grandma Link's bounty fit while keeping a *teen* at the centre.

Three concepts scored poorly for clear reasons:

| Concept | Why it scored low |
|---|---|
| Fam-Fi original (53) | Its crypto necessity is low: a daily-limit card is what Venmo, Apple and Google give away free. Its "3 purchases → level up" mechanic rewards spending volume, which the behavioural evidence says to avoid |
| Simulator | Weak problem and casino-adjacent |
| Scam Shield | Crypto makes scams *worse* |

### THE ONE IDEA: **Potluck**, a refined Fam-Fi narrowed to one job

**What Fam-Fi keeps:**

- Passkey co-sign by a parent in real time
- Emergency freeze
- Gasless relayer
- Envio feed
- Earned autonomy, rebuilt as a *Trust Ladder* that rewards stewardship

**What it drops:**

- The personal daily-limit spending wallet
- The purchase-count levels
- Dynamic

**What it adds:**

- Contributions from anyone, anywhere, through a link
- Purpose-locked pots
- Receipts bound to every spend
- PRF-encrypted private details
- CRE deadline refunds

The family "goal pot" (a teen saving for a laptop with grandparents abroad chipping in) is *the same contract with one captain*. It is a configuration, not a second product.

*Working name. Trademark not checked [ASSUMPTION].*

---

## 6. Potluck, specified: pitches, loop, journeys, build plan, architecture, contracts, sponsors

### Pitches

**One-liner.** *The group wallet teens run and families trust: anyone, anywhere chips in with Face ID, every spend needs a teen and an adult, and everyone sees the receipts.*

**10 seconds.** "Team money runs on a treasurer's personal Venmo, and treasurers keep walking off with it. Potluck is a shared pot teens run. Family anywhere chips in with Face ID. Every spend needs a teen plus an adult. Every receipt is visible to everyone who paid."

**30 seconds.** "Maya is 16 and captains her robotics team. They need $1,200 for a championship. Today that means cash envelopes, a parent's Venmo, and nobody knowing where it went. One Tennessee booster treasurer moved $44,821 out of the club's Venmo. With Potluck, Maya creates a pot and her coach co-signs it into existence. Families, and grandma in Dubai, chip in from a link with Face ID: no app, no fees. When Maya pays the registration fee, the coach approves on his phone and it's final in under a second, receipt attached. Every family sees every dollar."

**2 minutes.** Open with the problem: money for teen teams, trips and clubs is collected through personal Venmo accounts and cash, with one person in control and no receipts. Auditors keep finding the same failure. The $44,821.92 Venmo diversion and $74K of unreceipted disbursements in DeKalb County are one example; $411,761 allegedly diverted at Aliso Niguel is another ([FOX LA](https://www.foxla.com/news/aliso-niguel-high-school-booster-club-treasurer-wire-fraud-arrest)). The fix auditors recommend is separation of duties, dual signatures and independent review. Banks make that painful and Venmo makes it impossible.

Potluck makes it the default:

- A pot has a purpose, a goal and a deadline.
- A teen captain proposes spends and adult stewards co-sign them.
- Anyone (teammates' families, a grandparent abroad) chips in from a link using only a passkey.
- Every spend carries a receipt. Amounts are publicly verifiable and names and photos are end-to-end encrypted to members.
- Captains who keep receipts on time climb a Trust Ladder to small solo-spend limits.
- If the goal is missed, everyone is refunded automatically.

It runs on Monad because twelve families and a coach need every step final, not pre-confirmed, in 600ms, for fractions of a cent. Close: "Teens get real responsibility. Adults get dual control. Families see everything."

### Product loop

```
Captain creates pot ──► Steward activates (consent) ──► Link shared in team chat
        ▲                                                      │
        │                                                      ▼
 New pots (next season,          Contributors chip in (Face ID, gasless, AUSD) ─► progress bar, final in 600ms
 other teams, siblings)                                        │
        ▲                                                      ▼
 Trust Ladder promotion ◄── receipts on time ◄── Captain proposes spend ─► Steward co-signs ─► vendor paid
        │                                                      │
        └── Stewardship record (owned by teen's passkey account) ◄── Ledger wall visible to every family
```

### Teen journey (captain, 16)

| Step | What Maya does | What she sees | Onchain |
|---|---|---|---|
| 1 | Opens potluck link (PWA). Face ID creates a passkey | "You're in." No seed phrase | Nothing yet; the Mera EOA is derived locally |
| 2 | Creates "Robotics Worlds Fund": $1,200 by 20 Nov, steward = Coach | Draft pot, "waiting for coach" | `PotDrafted` |
| 3 | Shares link in the team group chat | Live progress bar | `Contributed` events stream in |
| 4 | Proposes $480 registration to the approved vendor and attaches a receipt photo | "Coach approving…" then "Paid ✓" | `SpendProposed` → `Approved` → `SpendExecuted` |
| 5 | Hits 4 weeks of on-time receipts | "Coach can promote you to Level 1 (solo spends up to $25)" | `TrustLevelSet` |
| 6 | Turns 18 or graduates | "Your stewardship record is yours: export it" | Events keyed to her EOA, exportable via Mera mnemonic |

### Parent / coach journey (steward)

| Step | What the adult does | Why they trust it |
|---|---|---|
| 1 | Gets "Maya invited you to steward a pot" and accepts with Face ID | Nothing is live without adult consent; the adult is the legal user |
| 2 | Sets rules: approval threshold, vendor allowlist, new-payee delay, solo limit 0 | Rules are code; the app can't move funds |
| 3 | Gets a push, sees vendor, amount and receipt, and taps Approve (Face ID) | Dual control, the auditor's recommended control |
| 4 | Taps **Freeze** if anything looks wrong | One steward can freeze; unfreezing needs two (or steward + 24h) |
| 5 | Any contributing parent opens the Ledger Wall | Independent review without trusting the treasurer |

### Feature priority

| Priority | Feature |
|---|---|
| **MUST** | Mera passkey onboarding (PWA; iOS Safari + Android Chrome) |
| **MUST** | Pot create + steward activation |
| **MUST** | Link-to-contribute, gasless AUSD via EIP-3009 authorization |
| **MUST** | Propose/approve/execute spend with threshold |
| **MUST** | Vendor allowlist + new-payee delay |
| **MUST** | Freeze/unfreeze |
| **MUST** | Envio-powered ledger wall and feed |
| **MUST** | Mainnet AUSD deployment with real tx hashes |
| **MUST** | README with AI disclosure, OSI license, addresses, "why Monad" |
| **SHOULD** | PRF-derived encryption of receipts and member names (Mera bounty 2) |
| **SHOULD** | Trust Ladder (onchain counters, steward-signed promotions, auto-demotion) |
| **SHOULD** | CRE workflow: deadline auto-refund + scheduled chip-ins |
| **SHOULD** | Alchemy RPC in the relayer |
| **SHOULD** | Real pilot: one real team or club |
| **WOW** | Enclave-signed big approvals: raw WebAuthn assertion verified onchain via the P256 precompile `0x0100`, same passkey (timebox 4h) |
| **WOW** | Live "ledger wall" QR for a parents' meeting |
| **WOW** | Aurora Intents deposit from another chain (only if Day 4 is ahead) |
| **CUT** | Personal daily-limit debit wallet |
| **CUT** | Chores/allowance |
| **CUT** | AI coach |
| **CUT** | Yield (sAUSD/earnAUSD) |
| **CUT** | Reward tokens |
| **CUT** | Fiat on/off-ramps (Mercuryo is a *winner* perk, not a bounty) |
| **CUT** | Native app |
| **CUT** | Dynamic/Privy |
| **CUT** | Nansen |
| **CUT** | Peer P2P between minors |

### Five-day build plan

The plan assumes a team of 3–4 adults. Thursday 8 Oct is Day 1. The reported deadline is Tuesday 13 Oct, 11:59 PM ET, and the plan aims to submit by noon ET.

| Day | Contracts | Frontend (PWA) | Infra (relayer, Envio, CRE) | Product / video / BD | Exit gate |
|---|---|---|---|---|---|
| **D1 Thu 8 Oct** | Foundry ≥1.8 skeleton: `PotluckCore` storage layout and EIP-712 types | **Spike Mera PRF** on iPhone Safari, Android Chrome and desktop (PRF fails on desktop Chrome without Google Password Manager) | **Spike AUSD EIP-3009 on mainnet**; Envio init on testnet HyperSync | DM 5 real team captains or coaches for a pilot; write the landing page | Mera signs a tx on 2 phones. AUSD auth path confirmed or fallback chosen |
| **D2 Fri 9** | create/activate/contribute/propose/approve/execute/freeze; Foundry tests; testnet deploy with testnet USDC | Create pot, steward accept, contribute-by-link screens | Relayer (viem ≥2.40, Alchemy RPC, estimateGas + 15%, per-pot rate limit) | Design system (near-adult, not childish) | End-to-end chip-in on testnet |
| **D3 Sat 10** | Payee allowlist + new-payee delay; receipt hash binding; **mainnet deploy, AUSD allowlisted** | Spend propose/approve, push notification (web push), freeze | Envio HyperIndex entities: Pot, Contribution, Spend, Approval, MemberRecord; ledger wall | PRF-derived x25519 key and encrypted receipt blob | Real mainnet spend executed and visible in the Envio feed |
| **D4 Sun 11** | Trust Ladder counters, `setTrustLevel`, auto-demotion; `settleDeadline` refunds | Trust Ladder UI; ledger wall QR | **CRE workflow** (cron → `settleDeadline`, submit pre-signed scheduled chip-ins); **P256 enclave co-sign timebox** | Pilot pot live with a real team if possible | **Feature freeze 22:00** |
| **D5 Mon 12** | Bug fixes only; verify contracts on Monadscan | Real-device bug bash; empty and error states | Monitoring; relayer MON float | **Record video** (≥3 takes, ≤3:00); README; submission copy | Video and README final |
| **D6 Tue 13** | none | none | none | Buffer; submit by 12:00 ET; post on X | Submitted |

### Architecture

```
 ┌───────────── PWA (Next.js/React, viem ≥2.40) ─────────────┐
 │  Captain UI   Steward UI   Contributor link   Ledger Wall │
 │  Mera: createPasskeyWithPrfOutput / getPasskeyPrfOutput   │
 │   ├─ PRF → BIP-44 EOA (secp256k1)  → EIP-712 / EIP-3009   │
 │   └─ PRF → HKDF("potluck.enc.v1") → x25519 → HPKE-wrap    │
 │       pot key → AES-GCM receipts/names (non-wallet use)   │
 └───────┬───────────────────────────┬───────────────────────┘
         │ signed intents            │ GraphQL
         ▼                           ▼
 ┌──────────────┐   tx (tight gas) ┌────────────────────────┐
 │ Relayer      │ ───────────────► │ Monad (143 / 10143)    │
 │ (Alchemy RPC)│                  │ PotluckCore.sol        │
 │ pays MON gas │                  │  ├ AUSD 0x0000…9012a   │
 └──────────────┘                  │  ├ USDC 0x7547…b603    │
 ┌──────────────┐  cron / writes   │  └ P256 precompile 0x0100 (WOW)
 │ Chainlink CRE│ ───────────────► │                        │
 │ deadlines,   │                  └──────────┬─────────────┘
 │ scheduled    │                             │ events
 │ chip-ins     │                  ┌──────────▼────────────┐
 └──────────────┘                  │ Envio HyperIndex      │
 Encrypted blobs: object store     │ (monad.hypersync.xyz) │
 (ciphertext only; hash onchain)   └───────────────────────┘
```

**Wallet: Mera.** The bounty arithmetic is in section 1, and the Mera docs are at [Monad docs](https://docs.monad.xyz/guides/mera). Mera has two known caveats:

- Its PRF-derived key sits in JS memory at signing time, so XSS is the main risk. Use a strict CSP, no third-party scripts on signing pages, and keep the contract's bounded powers as the real guard.
- Losing the passkey means losing the account ([Mera](https://mera.category.xyz/getting-started/)). Mitigate with steward-based role recovery, described in the contract design below.

**Stablecoin: AUSD primary, USDC allowed.**

| Token | Network | Address | Status |
|---|---|---|---|
| AUSD | Mainnet | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (6 decimals) | From Monad's token list and an Aave governance assessment; verify on Monadscan ([token list](https://github.com/monad-crypto/token-list/blob/main/tokenlist-mainnet.json); [Aave](https://governance.aave.com/t/agora-usd-ausd-on-aave-monad-assessments/25251)) |
| AUSD | Testnet | No official address found | Polaris's `0x3F95…9723` is their own mock |
| USDC | Mainnet | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Circle-confirmed ([Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses)) |
| USDC | Testnet | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | Circle-confirmed |

Develop on testnet with USDC. **Shoot the demo on mainnet with a few dollars of team-owned AUSD**, because Agora requires AUSD.

AUSD support for EIP-3009 `receiveWithAuthorization` is reported only by Loft's README **[REPORTED]**. USDC's EIP-3009 support is background knowledge **[ASSUMPTION]**. Verify both on Day 1. If neither works, fall back to a relayer MON drip for a single `approve`, because a zero-MON undelegated EOA cannot pay its own gas ([reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)). Do not use sAUSD or earnAUSD: yield for teens is 🔴.

**Indexing: Envio HyperIndex.** Mainnet endpoint `monad.hypersync.xyz`; testnet `monad-testnet.hypersync.xyz` ([Envio](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks)).

**Chainlink CRE.** Requires TS SDK ≥1.18 (mainnet) or ≥1.19 (testnet). Two jobs, both natural:

- **Deadline settlement.** If the goal is missed, refund contributors pro rata, or roll over only with steward + captain consent.
- **Scheduled chip-ins.** Grandma pre-signs three EIP-3009 authorizations with staggered `validAfter` dates, and CRE submits each one when it becomes valid. This is non-custodial with no standing allowance [INFERENCE].

Loft also uses CRE "standing orders", so emphasise deadline-escrow semantics.

**AI.** Not core. Receipt OCR would be genuinely useful but sends minors' data to a model provider. Defer it.

### Smart contract design

```solidity
// PotluckCore.sol — singleton; pots packed in consecutive slots (Monad page pricing)
struct Pot { address token; uint96 goal; uint64 deadline; uint32 flags; // frozen, active, closed
             uint8 stewardThreshold; uint8 stewardCount; uint96 raised; uint96 spent; bytes32 purposeHash; }
roles: CAPTAIN (teen proposer), STEWARD (adult approver/legal user), MEMBER (can view/decrypt), anyone = contributor
createPot(cfg, captain, stewards[])            // draft; inactive until ≥1 steward accepts
acceptSteward(potId, sig)                      // adult consent activates pot
contributeWithAuth(potId, from, amt, validAfter, validBefore, nonce, v,r,s) // EIP-3009 → pot
proposeSpend(potId, payee, amt, receiptHash, sigCaptain) → spendId
approveSpend(spendId, sigSteward | webauthnP256) // executes atomically when threshold met
attachReceipt(spendId, receiptHash, cipherRef)
addPayee(potId, payee)   // steward-only; active after NEW_PAYEE_DELAY (e.g., 24h)
freeze(potId)            // any single steward, instant
unfreeze(potId)          // 2 stewards, or 1 steward + 24h timelock
setTrustLevel(potId, captain, level, sigSteward) // bounded by onchain criteria
settleDeadline(potId)    // callable by CRE or anyone: pro-rata refund if goal unmet
replaceCaptain(potId, newAddr) // stewards' threshold; recovery for lost passkeys
```

**Permissions and flows.** Only these routes move money:

- An executed spend to an allowlisted payee
- A deadline refund to the original contributors

Stewards can never send funds to themselves except through the same propose/approve path, which needs captain + steward. Solo spends are capped by the captain's trust level. EIP-712 domains bind chainId 143/10143, the contract, potId, nonce and expiry, so neither the relayer nor anyone else can replay signatures.

**Security assumptions.**

| Assumption | Consequence |
|---|---|
| The relayer is untrusted for safety | It can censor but cannot forge |
| Stewards are trusted not to collude | Two colluding adults plus a coerced captain could pay a sham vendor. That is the same as bank dual-signature; transparency and the payee delay are the deterrent |
| Token issuers can freeze | AUSD and USDC freeze lists would apply |
| No upgradeability in the hackathon build | Avoids admin-key risk |
| Reentrancy | Standard tokens; checks-effects-interactions |
| Gas-limit charging | Relayer applies per-pot and per-IP rate limits so spam can't drain the MON float |

**Anti-gaming Trust Ladder.** It rewards discipline, never spending. Promotion criteria are counted onchain:

- Distinct *weeks* (not transactions) with all receipts attached within 48h
- Zero freezes in the last 30 days
- At least 14 days at the current level
- The pot within its stated goal

Spends under $5, or to non-allowlisted payees, never count. A steward must sign each promotion, and the contract refuses promotions that the counters do not support. A late receipt or a freeze demotes the captain automatically.

| Level | Solo-spend limit | Extra rights |
|---|---|---|
| L0 | None | Every spend needs a steward |
| L1 | ≤ $25 to allowlisted payees | none |
| L2 | ≤ $75 | Can propose new payees (still subject to the 24h delay) |
| L3 | ≤ $150 | none |

At every level, the solo limit is also capped at ≤10% of the pot balance.

### Sponsor stack (natural integrations only)

| Sponsor | Requirement (reported) | Integration | Product relevance | Difficulty | Prize |
|---|---|---|---|---|---|
| Agora Cross-Border | Mobile app, AUSD across borders, Mera onboarding, instant settlement | Relatives abroad chip in AUSD from a link in a PWA | Core (cross-border family money) | Medium | $10,000 |
| Monad Foundation Mera UX | Mera is the entire account layer | All roles are Mera EOAs; no other wallet SDK | Core | Low–Med | $2,500 |
| Monad Foundation Mera "Many Keys" | Non-wallet use of PRF material | PRF → x25519 → encrypts minors' names and receipts; amounts stay public | Core (child privacy) | Medium | $2,500 |
| Chainlink CRE | CRE workflow as orchestrator | Deadline refunds + scheduled chip-ins | High | Medium | $3,000 |
| Envio | Core feature on real onchain data | Ledger wall, feed, Trust Ladder stats | Core | Low–Med | $1,000 |
| Alchemy | Deployed on Monad + one Alchemy service | Relayer and frontend RPC | Medium | Low | $1,000 credits |
| Aurora Intents (stretch) | Any-chain deposits | "Uncle pays from another chain" | Medium | Unknown | $5,000 |
| Community Team Project (ask first) | Unknown | Club treasury | Possibly high | n/a | $5,000 |

**Realistic natural ceiling:** $19k cash plus $1k credits from bounties, on top of $10k (track) and $25k (champion). Stacking is unconfirmed.

---

## 7. The 3-minute demo script, timed to the reported cap

Set-up: two phones on screen (captain and coach), one laptop (grandma), and a Monadscan tab. All tx are on mainnet in small amounts. Personas are played by adult team members, and the video says so in the end card. If a teammate is actually in another country, use them as "grandma".

| Time | Screen | Narration | User action | Onchain | Beat |
|---|---|---|---|---|---|
| 0:00–0:15 | Headlines collage: DeKalb $44,821.92 via Venmo; Aliso Niguel $411,761; White House HS (Sept 2026) ([WSMV](https://www.wsmv.com/2026/09/24/former-midstate-high-school-booster-club-treasurer-indicted-misappropriating-thousands-comptroller-says/)) | "Team money runs on one person's Venmo. It keeps disappearing." | none | none | Stakes |
| 0:15–0:40 | Maya's phone | "Maya, 16, captains robotics. She needs $1,200 for the championship." | Face ID → pot "Worlds Fund, $1,200 by Nov 20" → invites Coach; coach's phone: Face ID accept | `PotDrafted`, `StewardAccepted` | No seed phrase, no app store |
| 0:40–1:10 | Team chat → laptop → explorer split | "Families chip in from the link. Grandma's in Dubai." | Dad $40; grandma $50 AUSD with Face ID; ticks "$20 monthly until Nov" | `Contributed` ×2 (EIP-3009). Explorer shows **Finalized** within ~1s | **Cross-border in under a second, $0 fees to grandma** |
| 1:10–1:50 | Maya at "vendor checkout" → coach's phone buzzes | "Registration is $480. Maya can't spend alone, and nobody should." | Maya proposes with receipt photo; coach Face ID approves | `SpendProposed` → `Approved` → `SpendExecuted`. Vendor balance updates on the third screen | **WOW: two phones, one tap, final payment.** Explorer shows only a receipt *hash* |
| 1:50–2:10 | Attack attempt | "What if Maya's phone is stolen?" | $300 to a new address → blocked (new payee, 24h delay); Mom taps **Freeze** | `SpendRejected`, `Frozen` | Guardrails anyone understands |
| 2:10–2:30 | Trust Ladder | "Responsibility is earned with receipts, not spending." | Coach promotes Maya to L1; she buys $18 of snacks solo from an allowlisted store | `TrustLevelSet`, `SpendExecuted` | The teen's status moment |
| 2:30–2:50 | Ledger Wall on a parent's laptop via QR | "Every family sees every dollar. Names and receipts are encrypted to members only. Miss the goal and everyone's refunded automatically." | Scan QR; open decrypted receipt | Envio feed; CRE workflow shown in console | Transparency vs privacy |
| 2:50–3:00 | Logo + end card | "Potluck. Teens run it. Adults co-sign it. Everyone sees it. Final in 600ms on Monad." | none | Contract + tx hashes on card | Close |

---

## 8. Legal and safety classification, and behavioural rules

This is not legal advice. Sources: COPPA ([White & Case](https://www.whitecase.com/insight-alert/unpacking-ftcs-coppa-amendments-what-you-need-know)), GENIUS ([Orrick](https://www.orrick.com/en/Insights/2025/07/Stablecoin-Framework-Signed-into-Law)), FinCEN ([Jones Day](https://www.jonesday.com/en/insights/2019/06/fincen-consolidates-guidance)), EU EMT/PSD2 ([DLA Piper](https://www.dlapiper.com/insights/publications/2025/07/interplay-between-mica-and-psd2-for-transfers-of-electronic-money-tokens-eba-no-action-letter)), GDPR Art. 8 ages ([Bird & Bird](https://childreninthedigitalworld.twobirds.com/home/eu)), UK promotions ([FCA](https://www.fca.org.uk/publications/good-and-poor-practice/assessing-compliance-back-end-cryptoasset-financial-promotions-rules)), the UK regime go-live of 25 Oct 2027 ([Regulation Tomorrow](https://www.regulationtomorrow.com/2026/06/fca-publishes-cryptoassets-regime-policy-statements-finalised-guidance-and-two-further-guidance-consultations/)), the Children's Code ([Hunton](https://hunton.com/privacy-and-information-security-law/age-appropriate-design-ico-issues-draft-code-of-practice-for-online-services-used-by-children)), India VDA tax ([Income Tax Dept](https://incometaxindia.gov.in/w/taxation-of-virtual-digital-asset-vda-)), FIU-IND ([Drishti](https://www.drishtiias.com/daily-updates/daily-news-analysis/guidelines-for-virtual-digital-assets/print_manually)) and DPDP ([LiveLaw](https://www.livelaw.in/amp/top-stories/digital-personal-data-protection-rules-2025-notified-309928)).

| Feature | US | EU | UK | India |
|---|---|---|---|---|
| Hackathon demo (adult personas, team funds) | 🟢 | 🟢 | 🟢 | 🟢 |
| Non-custodial pots, adult steward as legal user, teen 13+ as delegated captain, existing regulated stablecoin | 🟡 (FinCEN treats "users" as non-MSB; relayer and app control untested) | 🟡 (custodial EMT wallets are PSD2 payment accounts; non-custodial treatment unconfirmed) | 🟡 (stablecoin activity is authorised from Oct 2027) | 🔴 for real money (30% VDA tax, 1% TDS, FIU-IND for providers); testnet demo only |
| Cross-border chip-ins from relatives | 🟡 (travel/AML at scale) | 🟡 (Transfer of Funds Regulation) | 🟡 | 🔴 |
| Teen data (names, receipts) | 🟡 (COPPA for under-13s → exclude under-13s) | 🟡 (consent ages 13–16 → require parental consent for all under-16s) | 🟡 (Children's Code: high-privacy defaults) | 🟡/🔴 (DPDP: verifiable parental consent for under-18s; no behavioural monitoring) |
| Trust Ladder (steward-approved, deterministic) | 🟢 | 🟢 | 🟡 (no engagement nudges; notifications off by default) | 🟡 (behavioural-monitoring ban → parent-directed purpose) |
| Fiat on/off-ramp | 🟡 (licensed partner) | 🟡 (licensed partner) | 🟡 (licensed partner) | 🔴 |
| Yield on pot balances, reward token, trading, swaps, prediction markets, random rewards, "buy crypto" CTAs | 🔴 | 🔴 | 🔴 | 🔴 |
| Self-issued "family dollar" | 🔴 (GENIUS: permitted issuers only) | 🔴 | 🔴 | 🔴 |

**Behavioural principles, applied.**

| Principle | Evidence | How Potluck applies it |
|---|---|---|
| Autonomy as the reward | Autonomy support correlates with well-being and psychological control with ill-being ([PubMed](https://pubmed.ncbi.nlm.nih.gov/39052356/)). Teens respond to status and respect ([Yeager et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC5758430)) | Captaincy *is* the status. The Trust Ladder grants capability, not points |
| Deterministic progression | Loot-box spending links to problem gambling more strongly in 16–18s than in adults ([REPHRAIN](https://www.rephrain.ac.uk/paper/adolescents-and-loot-boxes-links-with-problem-gambling-and-motivations-for-purchase-2/)) | No spins, mystery rewards, or rewards for transaction count or amount |
| Forgiving, quiet design | Children's Code disfavours sticky reward loops | No streak shaming. Notifications are off except approval requests |
| Mentor, not surveillant | Same SDT evidence | Stewards see pot money, not the teen's personal life. The teen sees exactly what stewards see |
| Positive friction | FCA concept | A new-payee delay and a confirmation before any first-time payee |

---

## 9. Viral loop, business model, moat

**Viral loop [HYPOTHESIS].** The product is multiplayer by construction. One captain's pot pulls every contributing family through a no-install passkey link. Each contributor sees the Ledger Wall and is one tap from starting a pot for another child's team or trip. Relatives abroad become cross-border nodes. No source gives typical club sizes or K-factor, so validate with the pilot.

**Who pays [HYPOTHESIS].** Families and contributors are free, because big tech has set teen money at $0. Revenue options:

- A per-pot "Club" plan for organisations that want exports, audit reports and multiple pots.
- School or district licences, modelled on the B2B2C distribution banks already use for Greenlight ([Commerce Bank](https://www.commercebank.com/personal/bank/kid-debit-card)).
- Later, a revenue share on licensed on-ramp FX for cross-border chip-ins.

The only price evidence is consumer: $5.99–$19.98/month per family for Greenlight. **No club-treasury pricing evidence was found.** Gas cost per action is negligible, at roughly $0.0002–0.0003 per stablecoin transfer at the uncertain MON price.

**Moat.**

- Distribution density: once a school's teams run on Potluck, the parent graph is captured.
- A trust brand with schools.
- Compliance work, which grows harder to replicate as regulation tightens.

The stewardship record is deliberately portable and owned by the teen. That is a selling point, *not* a lock-in. Copper's 24-hour shutdown is the story it answers.

---

## 10. Judge simulation and the revisions it forced

| Judge | Excited by | Confused by | Worried by | Rejection reason | "This should exist" trigger | One change |
|---|---|---|---|---|---|---|
| Monad core | Multi-party, final-in-600ms settlement; Mera-native | "Is this just a Safe?" | Gas-limit padding cost | "Could be any EVM" | Explorer shows Finalized as the coach taps | Show block-tag progression (Proposed → Voted → Finalized) live |
| Consumer fintech founder | No-install contribute link | Who is the customer, teen or coach? | Vendors don't take AUSD | "No last mile" | Grandma pays with Face ID | Be explicit: the adult steward is the customer, and payees are vendors or the steward's off-ramp |
| Infra engineer | P256 precompile co-sign | PRF salt reuse | Mera key in JS (XSS) | "Toy security" | Freeze + new-payee delay blocks the attack | Domain-separated HKDF; strict CSP; enclave-signed big approvals |
| VC | Booster-fraud wedge into a B2B2C school channel | Market size | Regulatory drag | "Feature, not company" | A real club using it this week | Show pilot evidence and a district-licence path |
| Parent | Dual control, visibility | "Crypto?" | Kid's name on a blockchain | "Not for my kid" | Encrypted names; public amounts only | Say "dollars" everywhere; privacy explainer |
| 17-year-old | Being captain, the Trust Ladder | "Why does Coach approve snacks?" | Looking babyish | "My mom's app" | Solo $25 at L1 | Near-adult design; the first promotion reachable in ~2 weeks |

**Revisions adopted.**

| Revision | What changes |
|---|---|
| Live finality | Show a finality ticker in the demo |
| "Is this a Safe?" | State the answer outright: Safe is a great adult multisig; Potluck adds purpose locks, receipt binding, a teen role ladder, link contributions with no wallet, and deadline refunds. It could later ship as Safe modules |
| Last mile | Name the last mile honestly |
| Security | HKDF domain separation for PRF keys; CSP |
| Traction | Get one real pilot (rubric B weights founder/market 25%) |
| Language | Make "dollars, not crypto" UI copy a hard rule |

---

## 11. Attacking the idea

| Weakness | Severity | Redesign |
|---|---|---|
| Vendors don't accept AUSD | High | Payees are allowlisted vendors that accept stablecoins *or* the steward's own off-ramp address. Be honest that on/off-ramps need a licensed partner (Mercuryo is a winner perk) |
| Fraud evidence is from **adult** booster clubs; teen-run club severity is unproven | High | Position the product as "student teams and trips, captained by teens, stewarded by adults". The adult-club market is a fallback ICP, not a pivot |
| Loft competes for Agora with the same stack | Medium | Differentiate on recipients who are minors, threshold spending and purpose-locked group pots. Loft is person-to-person remittance |
| Public ledger of minors' activity | High | No PII onchain; random pot IDs; PRF-encrypted names and receipts. Still pseudonymous linkage, so disclose it |
| Mera passkey loss, PRF gaps on desktop Chrome | Medium | Steward-threshold `replaceCaptain`; device test matrix on Day 1; "use your phone" UX |
| Stewards can collude | Medium | 24h new-payee delay; any contributor can flag; ledger visibility. Same residual risk as bank dual signature |
| "Just a multisig" | Medium | Teen-centred role ladder plus contributions by link are the product. Show them in the first 40 seconds |
| India real-money use is 🔴 | Medium | Lead GTM in the US. India is cross-border inbound only after legal review |
| Scope creep (personal wallet, AI, ramps) | High | The CUT list is binding. The family goal pot is the same contract |
| Bounty stacking unconfirmed; Community bounty text unknown | Low | Ask organizers on Day 1; do not design around unknowns |
| 3-minute cap | Medium | The script is timed. Rehearse to 2:55 |
| EIP-3009 support on AUSD unverified | Medium | Day 1 spike; MON-drip `approve` fallback |

---

## 12. Submission and landing copy

**Description.** Potluck is a shared money pot for teen teams, clubs and trips. Teens run it, adults co-sign it, and anyone, anywhere, can chip in with Face ID.

**Problem.** Money for student teams and trips is collected through one person's Venmo and cash envelopes, with no dual control and no receipts. Auditors keep documenting the result: $44,821.92 moved out of one club's Venmo, and $74K of disbursements without receipts. Relatives abroad can't easily contribute, because remittance services require 18+ recipients.

**Solution.**

- A purpose-locked pot with a goal and deadline.
- A teen captain proposes spends and adult stewards approve them with a passkey.
- Every spend carries a receipt.
- Contributors pay from a link: no app, no seed phrase, no gas.
- Missed goals refund automatically.
- Captains earn solo-spend limits by keeping receipts on time.

**Technical implementation.**

| Layer | Implementation |
|---|---|
| Accounts | Mera passkey EOAs for every role |
| Contract | `PotluckCore` singleton on Monad mainnet (AUSD) and testnet (USDC) |
| Contributions | EIP-3009 gasless |
| Approvals | EIP-712 threshold, executed atomically |
| Relay | Relayer with tight gas limits for Monad's gas-limit charging |
| Indexing | Envio HyperIndex ledger |
| Orchestration | Chainlink CRE for deadline settlement and scheduled chip-ins |
| Privacy | PRF-derived x25519 keys encrypt names and receipts |
| WOW (optional) | WebAuthn approvals verified via the P256 precompile |
| Contract addresses, tx hashes and AI-use disclosure | Listed in the README |

**Why Monad.** A pot is many parties settling against one balance. On Monad each chip-in and each co-signed spend is *final*, not sequencer-pre-confirmed, in 600ms, at a fraction of a cent. Monad-native Mera, Envio and CRE give passkey accounts, indexing and automation without a custody backend.

**Future vision.** Every school team, club and trip runs a pot. Stewardship records follow teens past 18 into college clubs and first jobs, with licensed ramps per country.

**Innovation.** The first teen-centred group treasury that combines:

- Threshold co-sign
- Receipt binding
- Contributions by link with no wallet
- A deterministic Trust Ladder that rewards stewardship, never spending

**Bounty explanations.**

| Bounty | What Potluck does |
|---|---|
| Agora | AUSD crosses borders from relatives' passkeys, final in 600ms, in a mobile PWA |
| Mera UX | Mera is the only account layer |
| Mera Many Keys | PRF material derives encryption keys that protect minors' data |
| CRE | Deadline refunds and scheduled chip-ins |
| Envio | The Ledger Wall |
| Alchemy | RPC |

**Landing page.**

| Element | Copy |
|---|---|
| Hero | **Team money, without the trust fall.** |
| Subhead | The shared pot teens run and families trust. Anyone can chip in with Face ID. Every spend needs a teen and an adult. Everyone sees the receipts. |
| CTA | **Start a pot for your team** |
| Benefit 1 | **Chip in from anywhere:** one link, Face ID, no app, no fees. |
| Benefit 2 | **Two keys on every spend:** captain proposes, steward approves, done in a second. |
| Benefit 3 | **Every dollar visible:** a live ledger for every family, with names and receipts kept private. |
| For parents and coaches | Dual control, instant freeze, automatic refunds if the goal is missed, and nobody's personal Venmo. |
| For teens | Run the money for real. Keep receipts, earn your own spending limit, and keep your track record. |
| Crypto and Monad, plainly | Your dollars are digital dollars (AUSD/USDC) held by a public program, not by us. It runs on Monad, where payments are final in under a second and cost a fraction of a cent. We never hold your money. |

**60–90 second pitch script.** "Raise your hand if you've fronted money for a team and never got it back. Seventy-six percent of Gen Z who fronted a group expense say they weren't repaid. At the adult level it's worse: booster-club treasurers keep getting indicted for moving team money through personal Venmo. One case was $44,821. Potluck fixes the structure. Maya, sixteen, starts a pot for her robotics team, and her coach co-signs it into existence. Families chip in from a link with Face ID, including her grandma in Dubai, in under a second, with no fees. When Maya pays the $480 registration, her coach approves on his phone and it's final before he looks up. Receipt attached, every family sees it. Names stay encrypted to members. Miss the goal and everyone's refunded automatically. Keep receipts on time and you earn a solo spending limit, because responsibility should be earned with discipline, not spending. It's built on Monad because twelve families and a coach need every step final, not pre-confirmed, in 600 milliseconds. Teens run it. Adults co-sign it. Everyone sees it. That's Potluck."

---

## 13. Final score and the bet

| Dimension (weight) | v1 | v2 (after revisions) |
|---|---|---|
| Problem severity (15) | 8 | 8 |
| Teen adoption (10) | 7 | 7 |
| Parent trust (10) | 8 | 9 |
| Crypto necessity (15) | 8 | 8 |
| Monad advantage (10) | 7 | 8 |
| Hackathon feasibility (10) | 7 | 7 |
| Novelty (10) | 8 | 8 |
| Viral (5) | 9 | 9 |
| Business (5) | 7 | 7 |
| Sponsor bounty (5) | 9 | 9 |
| Demo wow (5) | 8 | 9 |
| **Total / 100** | **77.5** | **81.0** |

**Would I bet on v1 to win?** Not yet. A judge could dismiss it as "a multisig with a teen skin". It had no Monad-only moment on screen and no traction for rubric B's 25% market-readiness weight. Its privacy story for minors was also unaddressed.

**Changes in v2:**

- Live finality on screen.
- Encrypted minors' data, which doubles as the Mera bounty.
- Enclave-signed approvals as a timeboxed WOW.
- A steward-consent activation flow that makes the adult the legal user.
- One real pilot pot.

**Would I bet on v2?** Yes for what is controllable:

- Track 02 podium contention.
- The Mera UX and Envio bounties, where the integration *is* the product.
- CRE, where deadline escrow is a natural workflow.

Agora is a fair fight against Loft. The grand champion title is plausible but not something to bet the team on. It turns on video polish and on rival entries this research could not see.

What would most change the odds is not more features. It is **a real team's pot with real families' chip-ins on mainnet before 13 Oct**, together with a demo that never says "blockchain" until the last ten seconds.

## Conclusion

Fam-Fi's instincts were right: passkeys, co-sign, freeze, and autonomy as the reward. Its unit of value was wrong. A single teen's spending wallet competes with free products from PayPal, Apple, Google and NPCI, and with several hackathon clones. Group money is where opaque, single-custodian rails demonstrably fail, and where final multi-party settlement is a structural advantage rather than a talking point.

The scoring surfaced a further point. The three strongest concepts (teen club pot, cross-border goal pot, booster ledger) are one contract with different configurations. The team therefore does not have to choose between the cross-border bounty and the fraud story: one primitive tells both in a single 3-minute narrative.

The biggest open risks are outside the code: vendor acceptance, licensed ramps, and minors' privacy on a public ledger. Naming those risks openly in the submission will read as founder maturity to a VC-heavy panel, not as weakness.
