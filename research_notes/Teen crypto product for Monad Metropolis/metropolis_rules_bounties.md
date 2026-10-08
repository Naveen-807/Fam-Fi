# Monad Metropolis Hackathon (2026): Rules, Tracks, Judging, Submission, Sponsor Bounties

Research date: 8 Oct 2026 (5 days before the 13 Oct deadline). Verification levels used below:
- **[OFFICIAL]**: monad.xyz/metropolis or monad.xyz/developers/hackathons/metropolis (public pages).
- **[UNVERIFIED, 3rd-party README]**: text that participant repos say they transcribed from the login-gated rules modal or dashboard on hackathon.monad.xyz. I could not open the platform, so treat these as reported, not confirmed.

## 1. Timeline, submission requirements, eligibility, judging, mainnet vs testnet, "built in 6 weeks" rule

### Takeaway
The official site confirms these dates: 1 Sep start, 13 Oct deadline, judging 14–27 Oct, winners 3 Nov. It also confirms the deliverables: a working product with a public profile, a demo, a short write-up, and a code link. Age 18+, team size 1–5, judging weights, the testnet-OK rule and the 3-minute video cap come only from participant READMEs quoting the gated "Rules v3.0". Two READMEs give **conflicting** judging rubrics.

### Cited Findings
- **[OFFICIAL] Timeline:**
  - 1 Sep: registration opens and the build window starts.
  - 1 Sep–13 Oct: six-week build window with mentorship.
  - 13 Oct: submission deadline.
  - 14–27 Oct: judging.
  - 3 Nov: winners announced.
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[OFFICIAL] In-person "Metropolis Lounge" one-day activations:**
  - NYC 18 Sep, Hangzhou 19 Sep, Shenzhen 26 Sep, SF 26 Sep, London 2 Oct, Buenos Aires 3 Oct, Singapore 6 Oct.
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **Deadline wording varies:**
  - Monad's X post says "Submissions end October 13th" — [X/@monad](https://x.com/monad/status/2094826883049205806).
  - Rise In's header says "apply before" Oct 12 and gives an end date of Nov 2. Its own timeline says 13 Oct and Nov 3, so the page contradicts itself — [Rise In](https://www.risein.com/monad/monad-metropolis-hackathon).
  - A README quotes Rules §4.2 as "October 13, 2026, 11:59 PM ET". The same README says submissions can be edited until the deadline and late ones are not accepted [UNVERIFIED] — [merchant-rails README](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[OFFICIAL] What to submit:** "A working product with a public project profile: a demo, a short write-up, and a link to the code." — [monad.xyz/developers/hackathons/metropolis](https://monad.xyz/developers/hackathons/metropolis)
- **[OFFICIAL] Open source:** "Open sourcing is encouraged but not required". Judges must be able to verify what was built during the six weeks — [official page](https://monad.xyz/developers/hackathons/metropolis).
  - **CONFLICT:** a README says Rules §7.2 requires an OSI-approved license and quotes "Code must be publicly accessible on GitHub throughout and after the Hackathon" [UNVERIFIED] — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[OFFICIAL] New-work rule:** existing projects are allowed "if the work you submit is new". Existing teams and context are fine, but what you show on 13 Oct must have been built during the six weeks — [monad.xyz/metropolis](https://www.monad.xyz/metropolis).
  - README version [UNVERIFIED]: the commit history must cover the build window, and pre-existing code is allowed only as an identified foundation — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[OFFICIAL] Eligibility:**
  - "Anyone building a product on Monad". Solo builders and teams are welcome. No onchain experience or funding is needed.
  - "Metropolis is online and open globally." Restrictions are "listed in the official rules on the application platform."
  - Source: [official page](https://monad.xyz/developers/hackathons/metropolis)
- **[UNVERIFIED] Rules v3.0 (last updated 3 Sep 2026), as quoted in a README:**
  - Participants must be **18+**. This matters for a teen product: the team must be adults, while teen end-users are a product question.
  - OFAC, EU and UN sanctioned jurisdictions are excluded.
  - Employees of the Monad Foundation, sponsors and judges, and their immediate family, can participate but cannot win.
  - **Team size 1–5** (§2.4), with one primary contact who receives prize money.
  - One project per participant, one track. A project cannot win multiple main-track prizes.
  - Source: [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails); 18+, sanctions and team size are also in its [summary](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[UNVERIFIED] Demo video:** maximum **3 minutes**, publicly hosted. It must show the product working with real Monad interactions (§4.1, §9.4).
- **[UNVERIFIED] AI disclosure:** AI coding tools are allowed but must be disclosed in the README (§4.1.4).
  - Separately confirmed in spirit: two other READMEs cite "Section 4.1 Clause 4" and §4.1.4 for AI disclosure — [Planckify/TakumiPay](https://github.com/Planckify-Labs/monad-submission), [Loft](https://github.com/neromtoobad/loft).
  - Source for the video and AI rules: [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails)
- **[UNVERIFIED] Mainnet vs testnet:**
  - "mainnet or testnet (either is fine)". Contract addresses or transaction hashes are required, plus an explanation of why the project uses Monad's capabilities (§9.2) — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
  - Example: TakumiPay deploys to both mainnet (chainId 143) and testnet (chainId 10143) — [Planckify](https://github.com/Planckify-Labs/monad-submission).
- **[UNVERIFIED] Judging rubric, version A (Rules §5.2):** five criteria at 20% each:
  1. Product Quality & Completeness
  2. Technical Excellence
  3. Monad Integration
  4. Track Fit & Problem Relevance
  5. Innovation & Impact
  - **Sponsor bounties** are judged 40% adherence to published requirements, 30% technical implementation, 20% Monad integration, 10% innovation.
  - Sources: [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails). The 40% "adherence to the published bounty requirements" figure is also cited in [curb issue #5](https://github.com/emmanuelist/curb/issues/5).
- **[UNVERIFIED] Judging rubric, version B (paraphrased in a different README):**
  - Technical Execution 20%
  - Design & Craft 20%
  - Originality & Track Insight 15%
  - Founder & Market Readiness 25%
  - Traction & Path Forward 20%
  - Source: [Mawee/meeaw-app](https://github.com/maulana-tech/meeaw-app). **This conflicts with version A.** It may be a track-specific rubric or a later rules version.
- **[UNVERIFIED] Review is non-confidential (§5.3):** judges include investors. Do not put keys or secrets in the repo — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[UNVERIFIED] Prize payment:**
  - Paid in USDC or equivalent to the primary contact's wallet, within 30 days of the winner announcement or KYC completion, whichever is later.
  - KYC may be required, and winners handle their own taxes.
  - Source: [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails)
- **[OFFICIAL] After the hackathon:** the project profile stays live. Top teams get ecosystem support and an invitation to a residency. Any team can join DeltaV ("800+ Monad startups" get credits, intros and office hours) — [monad.xyz/metropolis](https://www.monad.xyz/metropolis).

### Inferences
- Plan for the stricter reading of the gated rules: a public GitHub repo with an OSI license, a demo video of 3 minutes or less showing real Monad transactions, an AI-use disclosure in the README, a commit history inside 1 Sep–13 Oct, and contract addresses or transaction hashes. Testnet appears acceptable.
- The 18+ rule applies to participants. A teen product is still fine, but every team member must be an adult. The pitch should also address how minors are onboarded, for example parent-owned accounts.
- Two rubrics are circulating, so a submission should cover both. Product polish, Monad integration and track fit appear in version A. Version B adds founder and market readiness and traction, which favours showing real users or a waitlist.

### Gaps
- I could not access hackathon.monad.xyz or the Rules v3.0 modal directly, so age, team size, license, video and rubric are all unconfirmed.
- I could not find whether winners in multiple sponsor bounties can stack. One README says Mera and Envio bounties are "track-agnostic, they stack" with a track prize — [Mawee](https://github.com/maulana-tech/meeaw-app). I found no stated cap on the number of bounties one team can win.

## 2. Tracks (exact wording) and prize split

### Takeaway
There are four tracks, and teams **choose one at application**. Each track pays $30k, split evenly across 3 teams ($10k each). The grand champion gets $25k. The official "$250k+" headline includes sponsor money. The gated rules reportedly put the core pool at $145k.

### Cited Findings
- **[OFFICIAL] Track structure:** "Each track has a $30,000 prize pool split evenly between 3 teams". The grand champion receives "$25,000, picked across all four tracks". You "choose one when you apply" — [monad.xyz/metropolis](https://www.monad.xyz/metropolis).
- **[OFFICIAL] Track 01, Onchain Finance & Trading:**
  - Fit: teams who have shipped trading, lending or market-making products.
  - Examples: fully onchain order books with no offchain matching engine; perps with funding that updates every block; undercollateralised lending priced on onchain credit history.
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[OFFICIAL] Track 02, Consumer Products & Payments:**
  - Fit: "Product teams focused on the user's first five minutes more than the underlying architecture."
  - Examples: "A payments app that never mentions a blockchain to users"; "subscriptions that charge by the second"; "shared wallets and group spending that settle without an intermediary."
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[OFFICIAL] Track 03, Social, Attention & Culture:**
  - Fit: teams who have grown a community, not only built one.
  - Examples: a feed where curation is paid for by its beneficiaries; ticketing and access that follow a person rather than an email address; markets on cultural outcomes.
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[OFFICIAL] Track 04, Trust, Identity & AI Infrastructure:**
  - Fit: "Teams comfortable with cryptography, protocol design, or agent frameworks."
  - Examples: "Passkey-native accounts using P256 and WebAuthn with no seed phrase"; "agent identity and reputation under ERC-8004"; "provenance for generated media that survives re-encoding."
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[UNVERIFIED] Prize pool:** $145,000 core ($25k overall plus 4×$30k) per Rules §3.2. The "$250,000+" headline includes sponsor bounties, which "may be added and announced during the Hackathon period, each with their own terms" — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- **[UNVERIFIED] Track 02 summary in another README:** "a consumer financial experience where the blockchain stays invisible" — [Mawee](https://github.com/maulana-tech/meeaw-app).

### Inferences
- A family allowance and vault app fits Track 02 most naturally: invisible blockchain, shared wallets and group spending. Passkey-native accounts are a Track 04 example, but a team can enter only one track.

### Gaps
- No official statement on whether the grand champion also keeps its track prize.

## 3. Sponsor bounties: full list, requirements, exclusivity

### Takeaway
The official page lists **21 open bounties** by sponsor, title and prize, with the note "And more, listed in full on the platform". It also lists 8 "awarded to winners" in-kind prizes. Requirement text and the **Dynamic/Privy vs Mera mutual exclusivity** appear only in participant READMEs. For a passkey, AUSD, family-payments product, the stack that is both compatible and lucrative is:
- Agora Cross-Border Payments ($10k, which reportedly *requires* Mera)
- Mera UX ($2.5k)
- Mera "One Passkey, Many Keys" ($2.5k)
- Chainlink CRE ($3k)
- Envio ($1k)
- Alchemy ($1k credits)
- possibly Nansen and Kimi, Qwen or Hunyuan AI credits

Dynamic and Privy are reportedly *mutually exclusive* with Mera.

### Cited Findings — official bounty list (open to any team) [OFFICIAL] — [monad.xyz/developers/hackathons/metropolis](https://monad.xyz/developers/hackathons/metropolis), [monad.xyz/metropolis](https://www.monad.xyz/metropolis)

Requirement texts in the table are [UNVERIFIED]. They come from the merchant-rails README's "dashboard capture 2026-09-22" ([merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails)) unless another source is named.

| Sponsor | Bounty (official title) | Prize | Reported requirement / notes |
|---|---|---|---|
| Agora | Best Mobile Trading App on Monad | $10,000 | No requirement text found. Reportedly AUSD-based. One team asked whether a mobile web app qualifies ([curb #5](https://github.com/emmanuelist/curb/issues/5)). |
| Agora | Best Cross-Border Payments App on Monad | $10,000 | "Build a mobile app letting users send AUSD across borders using Mera passkey onboarding and instant settlement". **Mera required.** An organizer reportedly said a **PWA counts as a "mobile app"**. |
| Kuru | Build the Next Consumer Trading App on Kuru | $5,000 | No requirement text found. |
| Kuru | Bring New Assets and Markets to Kuru | $5,000 | No requirement text found. |
| Dynamic | Best Use of Dynamic | $5,000 | Auth/wallet SDK. **"mutually exclusive with the Mera bounties above"**. AUSD requirement **not found** in any source. |
| Privy | "Privy!" | $5,000 | Must go beyond authentication; "login-only does not qualify". **"also mutually exclusive with Mera"**. Another README describes it as "embedded wallets doing real work" ([polaris](https://github.com/nickthelegend/polaris-monad)). |
| Nansen AI | Best use of Nansen | $5,000 | "Nansen data behind a product decision" ([polaris](https://github.com/nickthelegend/polaris-monad)). |
| Perpl | Best use of Perpl's API | $5,000 | No requirement text found. |
| Perpl | Best Analytics / Risk Tool | $3,000 | No requirement text found. |
| Alibaba Cloud | Best Builds with Qwen 3.8 Max | $5,000 in credits | No requirement text found. |
| Kimi | Best Builds Powered by KIMI | $3,000 in credits | No requirement text found. TakumiPay uses "Kimi K2.6" for an in-app agent ([Planckify](https://github.com/Planckify-Labs/monad-submission)). |
| Kepler Plan by Tencent | Build with Hunyuan | $2,000 in credits | No requirement text found. |
| Chainlink | Best workflow with CRE | $3,000 | Use a CRE workflow as an orchestration layer. |
| Cleanverse | Best Integration of CVI/CVA | $2,000 | No requirement text found. |
| Envio | Best Use of Envio | $1,000 | Use HyperIndex, HyperSync or HyperRPC to power a core feature with real onchain data. |
| Alchemy | Best Projects using Alchemy | $1,000 in credits | Deployed on Monad and integrates at least one Alchemy service. |
| Aurora Intents | Bring Any-Chain Liquidity to Monad | $5,000 | Integrate Aurora Intents for any-chain deposits, swaps or deposit-and-execute flows. |
| Monad Foundation | Best Mera-Powered UX on Monad | $2,500 | "Build an app on Monad where Mera is the entire account layer — no seed phrase, no extension, no custody backend." |
| Monad Foundation | Mera: One Passkey, Many Keys | $2,500 | Reportedly asks for the most creative **non-wallet** use of Mera's PRF-derived key material ([kaskad PR #5](https://github.com/mryavascann/kaskad/pull/5)). Example submissions: a Poseidon note secret plus an x25519 viewing key derived from PRF ([Mawee](https://github.com/maulana-tech/meeaw-app)); a private watchlist sealed in the browser ([kaskad](https://github.com/mryavascann/kaskad/pull/5)); passkey-to-encryption-address via HPKE ([letterlock](https://github.com/edycutjong/letterlock)). |
| MetaMask | Best Agent Wallet Plugin | $2,500 | No requirement text found. |
| Monad Foundation | Best Community Team Project | $5,000 | No requirement text found. |

**[OFFICIAL] "Awarded to winners" prizes** (in-kind, added on top for winning teams; not separate bounties) — [monad.xyz/metropolis](https://www.monad.xyz/metropolis):
- ack3: $15k in security scans for every winning team
- Chainstack: $10k in annual Pro plans for the Track 01 winners and the overall winner
- Crouton Digital: $10k in 3 months of unlimited RPC
- **Mercuryo: $10k in product credits plus integration support for winning teams.** This is an in-kind winner perk, not an open bounty.
- BlockVision: $8k in 3 months of Pro per track winner
- Zerion: $6k in 3 months of API Builder
- Envio: $5k in Envio Cloud hosting
- Spectrum Nodes: $3k

### Cited Findings — exclusivity and stacking
- [UNVERIFIED] Dynamic is "mutually exclusive with the Mera bounties above", and Privy is "also mutually exclusive with Mera" — [merchant-rails](https://github.com/precious-akpan/monad-metropolis-merchant-rails).
- [UNVERIFIED] Mawee *uses* Privy for sign-in but states it is "not claimed", while claiming Mera "One Passkey, Many Keys". This implies exclusivity applies to which bounties you *claim*, not which SDKs you use — [Mawee](https://github.com/maulana-tech/meeaw-app).
- No source says Dynamic requires AUSD. That claim is **unconfirmed**. The AUSD requirement found is attached to the Agora bounty.

### Inferences
- Agora Cross-Border reportedly *requires* Mera, and Dynamic and Privy exclude Mera. Picking Mera as the account layer therefore unlocks up to $15k (Agora $10k plus 2×$2.5k Mera). Picking Dynamic or Privy unlocks $5k.
- A teen/family allowance app can be framed as "send AUSD across borders", for example a parent abroad sending allowance. That makes it a candidate for Agora Cross-Border.
- For "One Passkey, Many Keys", the PRF secret could encrypt the parent-control vault policy, or derive a separate viewing key for parents. Both are non-wallet uses.
- Plausible add-ons:
  - Chainlink CRE for scheduled allowances, as Loft does with "standing orders" ([Loft](https://github.com/neromtoobad/loft))
  - Envio for the activity feed
  - Alchemy RPC
  - Nansen data, for example spend-risk or counterparty checks
  - Kimi, Qwen or Hunyuan for a teen money coach (credits only)

### Gaps
- No requirement text found for Kuru, Perpl, Cleanverse, MetaMask, the Agora Mobile Trading App, the Community Team Project, or the AI-credit bounties.
- The "listed in full on the platform" bounties beyond these 21 are unknown.
- Whether one team can win several bounties is not confirmed officially.

## 4. Mera, Cleanverse CVI/CVA, and Agora AUSD

### Takeaway
Mera is Category Labs' free, open-source, client-side library. It turns a passkey's WebAuthn PRF output into standard BIP-44 EVM accounts, with no backend or contracts. AUSD on Monad mainnet is reported at `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (6 decimals). I found no official testnet AUSD address. Cleanverse is a compliance identity and "clean money" layer. The CVI/CVA expansion is unconfirmed.

### Cited Findings
- **Mera:**
  - Built by Category Labs, it "derives standard EVM accounts directly from a passkey using the WebAuthn PRF extension". It needs no seed phrase, bundler, MPC or backend custody.
  - Users create and recover accounts with Face ID, Touch ID or a security key. The same passkey gives the same accounts on web and native iOS/Android.
  - Accounts are BIP-44 EOAs, so a mnemonic can be exported to MetaMask or Rabby. Mera can also derive Solana accounts.
  - "Secret vaults" store imported keys.
  - It is free and open source.
  - Guides: [web](https://docs.monad.xyz/guides/mera), [React Native](https://docs.monad.xyz/guides/mera/react-native). Docs: [mera.category.xyz](https://mera.category.xyz/). Code: [github.com/category-labs/mera](https://github.com/category-labs/mera).
  - Source: [Monad docs, embedded wallets](https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets)
- **Mera install and launch:**
  - Install with `npm install @category-labs/mera`.
  - Signing sessions pre-authorize actions, so users aren't prompted on every click. Nothing is deployed onchain. It works on any chain.
  - Announced 30 Jul 2026.
  - Source: [Monad blog, Introducing Mera](https://monad.xyz/blog/introducing-mera)
- **Mera API names used in projects:** `createPasskeyWithPrfOutput`, `getPasskeyPrfOutput`, `createSecp256k1SigningSession`, `toViemAccount`. Monad has a P-256 verification precompile at `0x0100` — per search summary of [letterlock](https://github.com/edycutjong/letterlock) and related repos [UNVERIFIED].
- **Other embedded wallet providers on Monad:**
  - Monad docs also list Privy (TEE+SSS; subsidises testnet, contact monad@privy.io) and Dynamic (TEE and TSS-MPC).
  - Para, Privy and Turnkey offer subsidised testnet usage.
  - MetaMask Embedded Wallet, Turnkey and others are listed.
  - Source: [Monad docs](https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets)
- **AUSD on Monad mainnet:**
  - `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, deployed and verified at the same address as on Ethereum, 6 decimals.
  - "the testnet vanity address holds no code on mainnet". Dated 30 Jun / 1 Jul 2026.
  - Source: [Aave governance assessment](https://governance.aave.com/t/agora-usd-ausd-on-aave-monad-assessments/25251) (third party; verify on monadscan).
- **AUSD features and related addresses:**
  - AUSD supports EIP-3009 (`receiveWithAuthorization`), which Loft uses for gasless funding — [Loft](https://github.com/neromtoobad/loft).
  - The Polaris team used a **MockAUSD** on testnet at `0x3F9554F15f58Bb5900822224f37A05be81eF9723`. This is their own mock, not official.
  - Chainlink AUSD/USD feed on mainnet: `0xE20751C7B5867bCBef815ffc1b284c3f412a9e13`.
  - Source: [polaris-monad](https://github.com/nickthelegend/polaris-monad) [UNVERIFIED]
- **Cleanverse:**
  - Compliance-native infrastructure built on **APASS**, a non-transferable onchain identity credential tied to bank-verified identity, and **A-tokens**, mirrors of regulated stablecoins that move only between APASS-verified members.
  - Cleanverse says it is not a licensed issuer or custodian.
  - Sources: [The Asian Banker](https://www.theasianbanker.com/updates-and-articles/clean-identity-and-clean-money-enable-accountable-web3-adoption), [SecurityBrief](https://securitybrief.asia/story/cleanverse-launches-labs-clevrgo-for-verified-finance)
  - One demo site maps "Identity (CVI)" to the A-Pass credential and "Clean funds (CVA)" to aUSDC, on Monad testnet [UNVERIFIED, low-quality source] — [demo](https://klyveth.159.69.241.122.sslip.io/).

### Inferences
- For family vaults, Cleanverse CVI could serve as a "verified parent" credential. That fits the $2k bounty, but integration docs were not found.

### Gaps
- No official Agora documentation page with the Monad address was found. No official AUSD testnet address was found.
- Official Cleanverse SDK and docs for CVI/CVA on Monad were not found.

## 5. Free resources, judges, and past winners

### Takeaway
Free participant resources include Quicknode, Tenderly, Zerion, Dwellir, Spectrum and BlockVision plans. The judges are 73 VCs, Monad Foundation staff and sponsors. I found no published judge quotes. In past Monad hackathons, a payments app (OwnPay) was among the top 5.

### Cited Findings
- **[OFFICIAL] Free resources:**
  - Quicknode: 3 months of the Build plan per team
  - Tenderly: Pro license
  - Zerion: 1 month of API Builder
  - Dwellir: 3 months of the Developer plan
  - Spectrum Nodes: 2 months of Business per team
  - BlockVision: 2 months of Lite
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **[OFFICIAL] Judges** (partial list of 73, some marked "Mentor · Judge"):
  - Monad Foundation: Keone Hon, Eunice Giarta, Tina Qi, Swaraj, Charles
  - Will Nuelle (Galaxy)
  - Maria Shen (Electric Capital)
  - Alex Svanevik (Nansen)
  - Wyatt Khosrowshahi (Castle Island)
  - Frankie (Paradigm)
  - Elton Chang (Dragonfly)
  - Joey Shin (Pantera)
  - Evan Feng (CoinFund)
  - Yiping Lu (IOSG)
  - Tony Liu (Primitive)
  - Carl Vogel (6th Man)
  - Tommy Hang (Archetype)
  - Uttam Singh (Alchemy)
  - Francesco Andreoli (MetaMask)
  - Kim Luu and Matt (Dynamic/Fireblocks)
  - Arthur (Mercuryo)
  - Denham (Envio)
  - Sahil Sen (Quicknode)
  - Haythem Sellami (Category Labs, maker of Mera)
  - Aurora Intents reps
  - Source: [monad.xyz/metropolis](https://www.monad.xyz/metropolis)
- **Past winners, evm/accathon 2025 (Monad's first hackathon):**
  - Top 5: KiSignals, StageFun, **OwnPay**, Gorillionaire, StitchAI.
  - 350+ builders, 86 submissions.
  - Bounty winners included MonFundMe (fundraising), Butter-Fi and Poink.
  - Sources: [TechFlow](https://www.techflowpost.com/en-US/newsletter/80450), [Envio blog](https://docs.envio.dev/blog/announcing-the-monad-envio-hackathon-winners)
- **Monad Blitz:** one-day in-person consumer-app prototype events on testnet, with peer or audience-voted prizes. Examples: Jogja $2k pool, Bangalore V5 $1.5k — [Luma Jogja](https://luma.com/blitz-jogja-apr-2026?locale=id), [Luma Bangalore](https://luma.com/7p2arf8w).

### Inferences
- Many judges are VCs, and one circulating rubric weights "Founder & Market Readiness" at 25%. Market framing and traction evidence likely matter.
- Category Labs (Mera) and Dynamic both have judges on the panel.

### Gaps
- I found no published judge statements about what they value.
- No Monad Blitz or Mission-series winner lists were found.
- I found no other teen or family payments projects among Metropolis entries. Visible Track 02 competitors include TakumiPay, Loft (AUSD remittance with Mera, CRE and Envio, a direct overlap), Polaris (AUSD BNPL and subscriptions), Weir (passkey direct debit) and Merchant Rails.
  - Sources: [Loft](https://github.com/neromtoobad/loft), [Polaris](https://github.com/nickthelegend/polaris-monad), [Weir](https://github.com/ArhamKhan117/Weir)
