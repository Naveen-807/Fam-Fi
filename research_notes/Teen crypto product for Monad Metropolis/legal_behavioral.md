# Legal/Regulatory Reality of Minors Using Crypto/Stablecoins + Behavioral Design for Teen Money Products

*Research date: 2026-10-08. NOT LEGAL ADVICE. Sources are mostly law-firm briefings, news, and regulator pages surfaced via search; several were only seen as search summaries, not read in full. Items marked "[background, unverified]" come from general knowledge and were not confirmed by a source in this session; the report writer should either flag them or leave them out.*

---

## Q1. Minors' contractual capacity, holding crypto, custodial models, parental consent

### Takeaway
No jurisdiction we checked sets a crypto-specific minimum age. In practice the limits come from general contract-capacity law, KYC rules, and platform terms, which in practice mean 18+ for exchanges. Products that work for minors (Greenlight in the US, RBI minor accounts in India, UPI Circle) route value through a regulated institution, and the adult is the legal account holder or primary user. The minor gets delegated, capped access.

### Cited Findings
- GDPR Art. 8 data-consent ages do **not** set contractual capacity: "A 15-year-old may have data protection capacity to consent in one Member State but lack contractual capacity to enter into a binding agreement." — [sota.io GDPR Art. 8 guide (2026)](https://sota.io/blog/gdpr-art-8-childrens-consent-age-verification-parental-authorization-digital-services-developer-guide-2026)
- Greenlight is "a financial technology company, not a bank"; its banking services run through Community Federal Savings Bank (Member FDIC), which issues the prepaid card under a Mastercard license. — [Mercantile Bank Greenlight page](https://mercbank.com/personal-banking/personal-cards/greenlight); [MyBankTracker review](https://www.mybanktracker.com/checking/reviews/greenlight-teen-debit-card-review-432088)
- Greenlight investing is custodial, so the parent technically owns the account. Trades go through brokerage accounts in the parent's name, so that part of the app has no age limit. — [Contrary Research on Greenlight](https://research.contrary.com/report/greenlight)
- Banks such as Commerce Bank, US Bank and credit unions distribute Greenlight as a bundled benefit (a B2B2C model). — [Commerce Bank](https://www.commercebank.com/personal/bank/kid-debit-card); [US Bank](https://usbank.com/greenlight)
- India: under the RBI circular of 21 Apr 2025 (effective 1 Jul 2025), banks *may* let minors aged 10+ open and operate savings/term deposit accounts independently, with limits the bank sets. Minors of any age may hold accounts operated through a guardian. Overdrafts are never allowed. Banks *may* offer net banking and debit cards based on their own risk policy. — [Business Standard](https://www.business-standard.com/amp/finance/news/rbi-permits-minors-above-10-yrs-to-operate-bank-accounts-independently-125042101090_1.html); [AZB & Partners](https://www.azbpartners.com/bank/rbi-issues-revised-guidelines-on-deposit-accounts-of-minors/); [Business Today](https://www.businesstoday.in/amp/personal-finance/banking/story/rbi-eases-bank-account-rules-for-minors-above-the-age-of-10-what-parents-need-to-know-before-july-1-473026-2025-04-22)
- When the minor reaches majority, the bank collects fresh operating instructions and a specimen signature, and the balance is confirmed if a guardian operated the account. — [AZB & Partners](https://www.azbpartners.com/bank/rbi-issues-revised-guidelines-on-deposit-accounts-of-minors/)

### Inferences
- Legally, the parent should be the customer and the asset owner (the vault owner). The teen is a delegated user with capped permissions. This matches how Greenlight (the parent owns the investment account), RBI guardian accounts and UPI Circle (the primary user is liable and monitors) all work.
- The independent-operation route for 10+ minors in the RBI circular is permissive, not mandatory, and covers bank deposits only. It does not extend to crypto/VDAs.

### Gaps
- US UTMA/UGMA mechanics for crypto (whether custodians accept stablecoins in UTMA accounts) were not researched in this session. [background, unverified: UTMA/UGMA assets irrevocably belong to the minor, and control transfers at the state-set age of majority, usually 18–21.]
- Voidability of minors' contracts (US common law; Indian Contract Act s.11, under which a minor's agreement is void per *Mohori Bibee*, 1903) was not source-checked in this session. [background, unverified]
- Venmo Teen / PayPal teen account structure was not researched.

---

## Q2. United States: COPPA, money transmission, GENIUS Act, FinCEN, CFPB

### Takeaway
COPPA governs data from under-13s. The amended Rule took effect 23 Jun 2025, with full compliance due 22 Apr 2026. Any custodial handling of stablecoins for others raises money-transmitter risk under FinCEN and the states. A non-custodial smart wallet where the parent controls the keys is the low-risk prototype pattern. The GENIUS Act regulates stablecoin *issuers*, not wallet users. It says nothing about minors.

### Cited Findings
- The amended COPPA Rule was published 22 Apr 2025 and took effect 23 Jun 2025. The general compliance deadline was 22 Apr 2026. Safe-harbor program deadlines came earlier (one source gives 22 Oct 2025). — [White & Case](https://www.whitecase.com/insight-alert/unpacking-ftcs-coppa-amendments-what-you-need-know); [Ashurst Perkins Coie](https://www.ashurstperkinscoie.com/en/insights/ftc-finally-publishes-amended-coppa-rule-compliance-deadlines-set/); [Mondaq](https://www.mondaq.com/unitedstates/privacy-protection/1626104/childrens-online-privacy-protection-act-amendments-effective-june-23-2025). (Perkins Coie gives 21 Jun 2025. Most sources say 23 Jun.)
- On 25 Feb 2026 the FTC issued a Policy Statement limiting COPPA enforcement where mixed/general-audience operators collect children's data *solely to verify age* without first getting parental consent. This applies only if the operator is otherwise COPPA-compliant. — [Mondaq: "COPPA's amended rule is now in full effect"](https://webiis10.mondaq.com/unitedstates/privacy-protection/1790866/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know)
- GENIUS Act (P.L. 119-27, signed July 2025). Only permitted issuers or registered foreign issuers may issue payment stablecoins in the US; violations carry up to $1M in fines and 5 years in prison. Reserves must be 1:1 and segregated. Monthly reserve reports must be examined by a registered accounting firm. Issuers must publish a redemption policy. Issuers may not pay interest to holders (the law does not define "holders", and exchanges are not barred from paying interest). Issuers are subject to the BSA, and FinCEN must write tailored AML rules. — [Orrick](https://www.orrick.com/en/Insights/2025/07/Stablecoin-Framework-Signed-into-Law); [Gibson Dunn](https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/); [CRS IN12553 (Aug 2026)](https://www.everycrsreport.com/files/2026-08-20_IN12553_0b329134f6be0cc12f78017358552f4053d52c5e.html)
- GENIUS takes effect at the earlier of 18 months after enactment or 120 days after final regulations. Three years after that, digital asset service providers may offer only stablecoins from permitted or registered foreign issuers. — [Baker McKenzie](https://insightplus.bakermckenzie.com/bm/banking-finance_1/united-states-the-genius-act-a-new-federal-framework-for-stablecoin-issuers-custodians-and-banks); [Orrick](https://www.orrick.com/en/Insights/2025/07/Stablecoin-Framework-Signed-into-Law)
- FinCEN's May 2019 CVC guidance (FIN-2019-G001) consolidated earlier rulings. CVC "exchangers" and "administrators" are generally money transmitters that must register as MSBs, while "users" are not. The guidance covers wallet business models. — [Jones Day](https://www.jonesday.com/en/insights/2019/06/fincen-consolidates-guidance); [O'Melveny](https://www.omm.com/resources/alerts-and-publications/alerts/fincen-speaks-crypto-new-guidance/)

### Inferences
- The prototype should use an existing GENIUS-permitted/regulated stablecoin (e.g., USDC on Monad testnet). It should not issue its own token. Self-issuing a "family dollar" token would be 🔴.
- Under FIN-2019-G001, the hosted vs. unhosted distinction makes the non-custodial design (the parent holds the passkey or owner key, and the app never controls funds) the main lever for avoiding MSB status. The guidance's discussion of unhosted wallets was not read in full here, so this is marked an inference.
- A teen passkey wallet for under-13s brings COPPA into play, because the passkey device, any email, and the transaction history tied to the child count as personal info. Targeting 13+ in the prototype avoids COPPA. Under-13s should use a parent-operated mode only.

### Gaps
- State money transmitter law and the 2025–26 rollout of the CSBS Money Transmission Modernization Act were not researched.
- CFPB 2025–26 posture (larger-participant digital payments rule status, enforcement retreat) was not researched. [background, unverified: the CFPB's digital-payment-app larger-participant rule was disapproved by Congress via the CRA in 2025.]
- Whether FinCEN has issued GENIUS AML implementing rules by Oct 2026 is unknown.

---

## Q3. European Union: MiCA, GDPR Art. 8, PSD2/PSD3, AMLR

### Takeaway
In the EU a USD/EUR stablecoin is generally an e-money token (EMT). Under the EBA's June 2025 no-action letter, custodial EMT wallets/transfers are also PSD2 payment services, so a provider may need both a CASP and a PI/EMI licence. GDPR digital-consent age varies by state from 13 to 16. MiCA sets no minimum age that we could find.

### Cited Findings
- An EMT references a single official currency and is functionally e-money. Issuers must be credit institutions or EMIs, and MiCA adds further obligations. — [DLA Piper (9 Jul 2025)](https://www.dlapiper.com/insights/publications/2025/07/interplay-between-mica-and-psd2-for-transfers-of-electronic-money-tokens-eba-no-action-letter)
- Under the EBA No Action Letter (June 2025), transfers of EMTs on behalf of clients and custody/administration of EMTs count as PSD2 payment services. A custodial wallet that can send and receive EMTs to and from third parties is a PSD2 "payment account". The EBA advised a transition until 1 Mar 2026 for CASPs to get PI/EMI authorisation. — [DLA Piper](https://www.dlapiper.com/insights/publications/2025/07/interplay-between-mica-and-psd2-for-transfers-of-electronic-money-tokens-eba-no-action-letter)
- One law-firm guide says MiCA CASP transitional regimes end 1 Jul 2026 (secondary source). — [legalgeek.pl MiCA guide](https://legalgeek.pl/en/mica/)
- The EU Transfer of Funds Regulation (travel rule) requires originator and beneficiary data on crypto transfers. — [law4devs.eu MiCA compliance](https://law4devs.eu/compliance/mica)
- GDPR Art. 8: the default consent age is 16, and member states may lower it to 13. Ages: **13**: BE, DK, EE, FI, LV, PT, SE; **14**: AT, BG, CY, IT, LT, ES; **15**: CZ, FR, GR, SI; **16**: HR, DE, HU, IE, LU, MT, NL, PL, RO, SK. Sources conflict on Czechia (13 vs 15). — [Bird & Bird Children in the Digital World](https://childreninthedigitalworld.twobirds.com/home/eu); [Presencis Art. 8](https://presencis.com/regulations/gdpr/article-8/)

### Inferences
- An EU product that holds EMTs custodially for families needs a CASP plus EMI/PI licence, or a partnership with a licensed provider. That is 🟡/🔴 for a startup. A non-custodial smart-account design likely falls outside CASP custody, but MiCA recital 83 and national interpretations were not checked.
- Per-country consent ages mean the EU onboarding flow should default to parental consent for all under-16s.

### Gaps
- No source found on a MiCA minimum customer age or on AMLR (Reg. (EU) 2024/1624, applying from 10 Jul 2027) rules for minors' CDD. [background, unverified: AMLR applies from July 2027, and AMLA is operational in Frankfurt.]
- PSD3/PSR status in 2026 was not checked.

---

## Q4. United Kingdom: crypto promotions, 2027 regime, Children's Code, Online Safety Act

### Takeaway
UK crypto promotion rules (PS23/6, in force 8 Oct 2023) require appropriateness tests, risk warnings and a 24-hour cooling-off period, and they were designed with adult retail investors in mind. The FCA's full cryptoasset regime (final rules June 2026) goes live 25 Oct 2027, with applications open 30 Sep 2026 to 28 Feb 2027. The ICO Children's Code applies to any service likely to be accessed by under-18s and restricts nudges and "sticky" engagement features.

### Cited Findings
- PS23/6 requires direct-offer financial promotions (DOFPs) to first-time investors to carry a 24-hour cooling-off period, a personalised risk warning, an appropriateness assessment (with at least 24 hours before a retest from the second attempt), and warnings that FSCS/FOS protection does not apply. "Buy now" buttons are a DOFP trigger. — [FCA good/poor practice review](https://www.fca.org.uk/publications/good-and-poor-practice/assessing-compliance-back-end-cryptoasset-financial-promotions-rules); [Kroll](https://www.kroll.com/en/publications/financial-compliance-regulation/new-rules-financial-promotions-cryptoassets); [Elliptic](https://www.elliptic.co/analysis/fca-introduces-tough-new-rules-for-marketing-cryptoassets/) (Elliptic gives 8 Oct 2023 as the start date)
- The FCA published final cryptoasset-regime policy statements on 30 Jun 2026. They cover admissions/disclosures, market abuse, stablecoin issuance, regulated activities, prudential rules (PS26/12) and Handbook application (PS26/13). The application window runs 30 Sep 2026 to 28 Feb 2027, with go-live on **25 Oct 2027**. Existing MLR/EMR registrations do not convert automatically. — [Regulation Tomorrow (Jun 2026)](https://www.regulationtomorrow.com/2026/06/fca-publishes-cryptoassets-regime-policy-statements-finalised-guidance-and-two-further-guidance-consultations/); [Ashurst](https://www.ashurst.com/en/insights/uk-cryptoasset-regime-more-application-details-announced/); [A&O Shearman](https://www.aoshearman.com/en/insights/ao-shearman-on-fintech-and-digital-assets/final-rules-for-new-uk-crypto-regime); [Sidley (Jul 2026)](https://www.sidley.com/ja/insights/newsupdates/2026/07/uk-eu-investment-management-update---july-2026)
- The FCA consulted on transitional deferrals (CP26/32, closing 12 Oct 2026) and on a perimeter policy statement expected Sep 2026. — [Linklaters](https://financialregulation.linklaters.com/post/102o0if/uk-fca-proposes-new-transitional-provisions-for-selected-crypto-rules)
- The Children's Code (Age Appropriate Design Code) applies to services *likely to be accessed* by under-18s, including those ostensibly aimed at adults. Nudges must not push children to give unnecessary data or weaken privacy, and settings must be high privacy by default. Commentary on the draft says the Code targets "sticky features" such as reward loops, continuous scroll, notifications and autoplay. — [Hunton](https://hunton.com/privacy-and-information-security-law/age-appropriate-design-ico-issues-draft-code-of-practice-for-online-services-used-by-children); [TechCrunch](https://techcrunch.com/2020/01/22/uk-watchdog-sets-out-age-appropriate-design-code-for-online-services-to-keep-kids-privacy-safe); [ESRB commentary](https://www.esrb.org/privacy-certified-blog/the-icos-age-appropriate-design-code-uses-detrimental-to-children/)

### Inferences
- Showing teens any "buy crypto/invest" CTA in the UK is 🔴. Stablecoins used only as a payment rail (no speculative framing) fit better, but UK stablecoin issuance and custody will be authorised activities from Oct 2027.
- Children's Code: streaks or push notifications built on a teen's data to maximise engagement are a compliance risk. Reward loops should be tied to the user's own goals, be easy to turn off, and stay off by default.

### Gaps
- Online Safety Act duties (mostly for user-to-user services) were not researched. A peer-payment feed with messages could count as user-to-user content.
- No source found on whether the FCA regime sets age limits for crypto customers.

---

## Q5. India: RBI, PPI/UPI, UPI Circle, crypto tax, FIU, DPDP

### Takeaway
India is strongly pro-delegation for *fiat* (UPI Circle, RBI accounts for 10+) and heavily taxed and AML-regulated for crypto (VDAs). The DPDP Rules 2025 (notified 13 Nov 2025) require verifiable parental consent for all under-18s and ban tracking, behavioural monitoring and targeted ads aimed at children. For India, crypto-for-teens is 🔴 for real money. The safe analogue is UPI Circle-style delegation.

### Cited Findings
- UPI Circle full delegation: ₹15,000/month per delegation and ₹5,000 per transaction, with ₹5,000/day in the first 24 hours. Validity can be set from 1 month to 5 years (BHIM). Partial delegation: the secondary user initiates and the primary approves with their UPI PIN, under normal UPI limits. Up to 5 secondary users per primary, and each secondary has only one primary. Secondary users authenticate by passcode or biometrics. Primary users can monitor all transactions. Full delegation rolled out on BHIM in Nov 2025. — [Business Today (Aug 2024)](https://www.businesstoday.in/amp/personal-finance/news/story/upi-circle-what-is-the-new-feature-and-how-will-it-work-for-multiple-users-check-top-5-points-441849-2024-08-17); [Business Today (Nov 2025)](https://www.businesstoday.in/amp/personal-finance/news/story/bhim-introduces-upi-circle-delegation-for-seniors-young-users-to-transact-independently-within-preset-limits-503697-2025-11-25); [Razorpay](https://razorpay.com/blog/what-is-upi-circle/)
- VDA tax: a flat 30% on transfer income (plus surcharge and 4% cess) since 1 Apr 2022. Only cost of acquisition is deductible, and losses cannot be set off or carried forward. TDS is 1% under s.194S, with thresholds of ₹50,000 (specified individuals/HUFs) or ₹10,000 (others). — [Income Tax Dept](https://incometaxindia.gov.in/w/taxation-of-virtual-digital-asset-vda-); [Drishti IAS (Jan 2026)](https://www.drishtiias.com/daily-updates/daily-news-analysis/guidelines-for-virtual-digital-assets/print_manually)
- Since March 2023, VDA service providers (exchanges, wallet providers) are PMLA reporting entities and must register with FIU-IND. A new s.285BAA standardized transaction-reporting obligation starts April 2026. India has signalled it will join OECD CARF crypto info exchange from 2027. — [Drishti IAS](https://www.drishtiias.com/daily-updates/daily-news-analysis/guidelines-for-virtual-digital-assets/print_manually); [Anantam IAS](https://anantamias.com/crypto-assets-virtual-digital-assets/?pdf=1)
- DPDP Rules 2025 were notified 13 Nov 2025. The Act defines a child as under 18. Data fiduciaries must obtain verifiable parental consent, verified against identity and age data they already hold or through tokens from an authorised entity such as DigiLocker. Tracking, behavioural monitoring and targeted ads aimed at children are banned. There are exemptions for education and health purposes and a permitted purpose for real-time child location for safety. Enforcement is phased. — [LiveLaw](https://www.livelaw.in/amp/top-stories/digital-personal-data-protection-rules-2025-notified-309928); [Mondaq](https://www.mondaq.com/regulatory-update-notification-of-the-digital-personal-data-protection-rules-2025/1713500); [EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025)

### Inferences
- Every on-chain stablecoin transfer by an Indian resident is potentially a VDA transfer. Gains are taxed at 30%, and 1% TDS applies above the thresholds. Allowances and gig pay in USDC would create tax and TDS friction for families. For India, demo on testnet and frame mainnet as "INR rails via UPI Circle, and stablecoins where permitted".
- The DPDP "behavioural monitoring of children" ban is in tension with spend analytics, nudges and streaks built on a teen's data. The product would need to rely on a permitted exemption or parent-directed purposes. This needs counsel.

### Gaps
- The exact phased commencement date for DPDP children's obligations (reported as 18 months after notification, i.e. ~May 2027) was not confirmed from a primary source.
- RBI PPI rules for minors (e.g., small PPIs for minors / FamPay's model on bank-partner PPIs) were not researched.
- No source found on Indian exchange age limits (in practice 18+ KYC) or on whether a minor may legally hold VDAs.

---

## Q6. Red-line mechanics: rewards as income, loot boxes, prediction markets, trading

### Takeaway
Randomised reward mechanics for minors have documented links to problem gambling. Speculative crypto promotion is tightly restricted (UK PS23/6), and India taxes VDA trading punitively. Prediction markets, trading, leverage, yield and "mystery reward" mechanics should be 🔴 for a teen product.

### Cited Findings
- Zendle, Meyer & Over (2019, Royal Society Open Science) surveyed n=1,155 16–18-year-olds and found a link between loot-box spending and problem gambling (η² = 0.120), "moderate to large" and stronger than in adults. The sample was self-selected from ~100 gaming subreddits, and causality is unresolved. — [REPHRAIN summary](https://www.rephrain.ac.uk/paper/adolescents-and-loot-boxes-links-with-problem-gambling-and-motivations-for-purchase-2/); [Zendle & Cairns written evidence to UK Parliament](https://committees.parliament.uk/writtenevidence/98535/html/)
- A meta-analysis of problem gambling vs loot-box spending exists (all ages); pooled results were not read. — [UTas figshare](https://figshare.utas.edu.au/articles/journal_contribution/Meta-analysis_of_the_relationship_between_problem_gambling_excessive_gaming_and_loot_box_spending/22996898/1/files/40746986.pdf)
- GENIUS bars issuers from paying interest to stablecoin holders. — [Orrick](https://www.orrick.com/en/Insights/2025/07/Stablecoin-Framework-Signed-into-Law)

### Inferences
- 🔴 for teens: randomised rewards, spin wheels, mystery boxes, prediction markets, token speculation, yield on balances (an issuer-interest ban in the US and securities-like risk elsewhere), leaderboards ranked by spend, and a native reward token with a market price (possible securities or VDA status, plus taxable income).
- 🟡: gig earnings paid by third parties (non-family). These raise child-labour, tax-reporting and platform-liability questions (US 1099 thresholds, India TDS) and need age-appropriate task limits.

### Gaps
- US state law on prediction markets/sweepstakes for minors and the CFTC position on event contracts were not researched.

---

## Q7. Parent-owned non-custodial vault with teen delegated spending — does it reduce risk? Who is the "user"?

### Takeaway
Probably yes, at least for licensing. If the app never holds keys or funds, it looks more like non-custodial software than a money transmitter or CASP. The parent, as owner and signer, is the contracting "user". The teen is a delegated key with on-chain caps, which mirrors UPI Circle and Greenlight's parent-owned structure. Privacy law (COPPA/GDPR/DPDP) still applies to the teen's data regardless of custody.

### Cited Findings
- Under FinCEN, CVC "users" are not MSBs, while exchangers and administrators are. Wallet business models are covered by the 2019 guidance. — [Jones Day](https://www.jonesday.com/en/insights/2019/06/fincen-consolidates-guidance)
- EU: *custodial* wallets that send and receive EMTs are PSD2 payment accounts and EMT custody is a payment service. Non-custodial is not addressed in the source. — [DLA Piper](https://www.dlapiper.com/insights/publications/2025/07/interplay-between-mica-and-psd2-for-transfers-of-electronic-money-tokens-eba-no-action-letter)
- In UPI Circle the primary user delegates within caps, keeps monitoring rights, and the secondary has only one primary. — [Razorpay](https://razorpay.com/blog/what-is-upi-circle/)

### Inferences
- **Suggested classification for the prototype** (inference, not legal advice):
  - 🟢 Testnet-only demo; parent-owned smart-account vault; teen passkey as a session/delegated key with per-tx, daily and monthly caps (UPI Circle-like numbers make a good analogy); merchant/peer allowlists; allowance streams from the parent; savings goals locked in the parent's vault; parent-approved "chores/gigs" paid by the parent; "earned autonomy" raising caps based on behaviour, with the parent approving each tier change; no custody by the app; using an existing regulated stablecoin.
  - 🟡 Mainnet with real USDC; fiat on/off-ramps (need a licensed partner); peer payments between unrelated minors (AML, scams); third-party gig marketplaces; any teen data analytics (COPPA <13, GDPR 13–16, DPDP <18 VPC plus the no-behavioural-monitoring rule); EU/UK go-live (CASP + EMI; FCA regime from Oct 2027); India (VDA 30%/1% TDS, FIU-IND registration if the app becomes a service provider).
  - 🔴 Self-issued stablecoin or reward token with value; yield/interest; trading, swaps or DeFi for teens; prediction markets; loot-box/random rewards; "buy crypto" promotions to UK users; app-held custody without licences; dropping parental consent below the jurisdiction's age.
- Legal "user": the parent, who signs ToS, does KYC (if any) and holds the owner key. The teen is an authorised user. Without a regulated partner, nobody on the teen side is a KYC'd customer, which is a plus for a hackathon and a gap for production (AML on teen peer flows).

### Gaps
- No regulator guidance found specifically on smart-account delegation or session keys for minors. Whether account-abstraction "guardians" or relayers sponsored by the app create "control" for MSB/CASP purposes is untested.

---

## Q8. Behavioral design: motivating teens without casino mechanics

### Takeaway
The evidence favours autonomy-supportive design: choice, rationale, respect and status-earning competence. It does not favour control or engagement-maximising loops. Gamification has RCT evidence for helping *adults* hit savings goals, but adolescent-specific causal evidence is thin. Habits and executive function form early, and the teen years (13–21 per CFPB) are the window for financial knowledge and decision-making. A teen product should reward discipline behaviours, treat the teen as a near-adult, and avoid childish aesthetics and spend-driven loops.

### Cited Findings
- CFPB "Building Blocks" (2016): executive function develops from ages 3–5, financial habits and norms from 6–12, and financial knowledge and decision-making skills later (the youth/young-adult stage). All three are needed for adult financial capability. Habits form largely by observing adults and peers. — [CFPB Building Blocks](https://www.consumerfinance.gov/consumer-tools/educator-tools/youth-financial-education/learn/); [CFPB announcement](https://www.consumerfinance.gov/about-us/newsroom/consumer-financial-protection-bureau-unveils-youth-financial-education-initiatives); [NGPF summary](https://dev3.ngpf.org/blog/financial-literacy/question-building-blocks-financial-capability) (the 13–21 range is widely cited but was not confirmed in the fetched text)
- Whitebread & Bingham (Cambridge, 2013, for the Money Advice Service): by about age 7 children grasp core money concepts and can plan ahead and delay decisions. Parents are the biggest influence, and simply giving information is not effective. — [Gulf News](https://gulfnews.com/how-to/your-money/money-teach-them-while-theyre-young-1.1188795); [MAS Senedd submission](https://business.senedd.wales/documents/s29574/FEI%2019%20-%20The%20Money%20Advice%20Service.pdf)
- SDT: autonomy support (choices, perspective-taking, rationales) correlates with child well-being (r = .30, 2025 meta-analysis, k = 238), and psychological control correlates with ill-being (r = .26). Maternal controlling parenting predicted adolescent depressive symptoms from ages 13–17. — [PMC longitudinal study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9135772/); [PubMed 39052356](https://pubmed.ncbi.nlm.nih.gov/39052356/); [Van Petegem et al. 2017](https://selfdeterminationtheory.org/wp-content/uploads/2019/07/2017_VanPetegemZimmer-GembeckSoenensVansteenkiste_JCFS.pdf)
- Yeager, Dahl & Dweck (2018): interventions for adolescents fail when they ignore teens' heightened desire for status and respect and succeed when they align with it. Example: framing healthy eating as rebelling against manipulative marketers, chosen by higher-status older peers, cut unhealthy snacking. A "mentor mindset" means high standards plus high support. — [PMC5758430](https://pmc.ncbi.nlm.nih.gov/articles/PMC5758430); [UCLA Center for the Developing Adolescent](https://developingadolescent.semel.ucla.edu/topics/item/why-interventions-to-influence-adolescent-behavior-often-fail-but-could-succeed)
- Gamification RCT (adults): participants randomised to a gamified savings-logging app were more likely to reach a 4-week savings goal than controls. — [City, University of London TFI report](https://openaccess.city.ac.uk/26272/1/TFI-Final-Tech-Report-Gamification_Can_Help_Consumers_Reach_Their_Saving_Goals.pdf)
- Adolescent gamified-finance evidence is mostly design studies, intentions or protocols. Financial app users show higher *subjective* but not objective knowledge. — [Emerald IJBM 2019](https://www.emerald.com/insight/content/doi/10.1108/IJBM-04-2018-0086/full/html); [11:FS on gamification](https://11fs.com/article/gamification-in-fintech-financial-literacy-or-just-engagement)
- The ICO Children's Code discourages reward loops and notifications that extend engagement through children's data. — [Hunton](https://hunton.com/privacy-and-information-security-law/age-appropriate-design-ico-issues-draft-code-of-practice-for-online-services-used-by-children)

### Inferences (design principles)
1. **Earned autonomy is the core reward.** Higher limits, fewer approvals, and new capabilities (peer pay, then merchant categories, then savings-goal self-unlock) are granted for demonstrated discipline. This maps to SDT competence and autonomy and to Yeager's status. Make criteria transparent and rule-based, and show the rationale.
2. **Reward the behaviour, not the volume.** Points or tiers come from: days under budget, savings-goal milestones, commitments kept (save X by date), gigs completed and verified, cooling-off respected before big purchases. Never reward spend amount or transaction count.
3. **Deterministic, not random.** No variable-ratio rewards, spins or mystery drops (loot-box evidence). Use known, predictable bonuses such as parent "match" on savings (a well-established matching nudge), and keep parent matching off-chain or framed as a parent gift, not as yield.
4. **Forgiving streaks.** Streaks with freezes and grace periods and no loss-aversion shaming. Streaks should be opt-out, and notifications off by default (Children's Code).
5. **Respect, not childishness.** Use a near-adult visual language, the teen's own goals, private-by-default peer features, and no public spend leaderboards. Status comes from milestones the teen chooses to share (e.g., "Level 3: Self-managed").
6. **Parent as mentor, not surveillant.** Default to summaries rather than line-item surveillance for older teens. Make the transparency two-way so teens know exactly what parents see. Parent "nudges" should explain why (autonomy-supportive rationale). The DPDP behavioural-monitoring ban also argues for minimal teen profiling.
7. **Friction where it protects.** Cooling-off before large or unusual payments (borrowing the FCA "positive friction" concept), and confirmation for first-time peer recipients (scam protection).

### Gaps
- No peer-reviewed evidence found on the effectiveness of Greenlight, GoHenry or FamPay mechanics, or on Duolingo-style streaks for teen finance. Claims about what "made them stick" would be speculative.
- No rigorous evidence found on allowance-giving and adult financial capability in this session. [background, unverified: studies show mixed results; conditional vs unconditional allowance effects are debated.]
- No source found specifically on teens' aversion to "childish" fintech UI. This rests on Yeager's status framework only (inference).
