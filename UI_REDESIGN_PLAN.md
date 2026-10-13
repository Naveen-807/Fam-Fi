# Fam-Fi UI plan: money in motion

Status: implemented local family-wallet release; see FAMILY_WALLET_DELIVERY.md for changes, tests and outstanding live acceptance. This document retains the original design rationale.

## Direction

Preserve the light/dark theme choice and the slow moving glow the user likes. Build a visual, approachable family money product: personal goals, connected family contributions, clear actions and quiet motion. Reduce the amount of text visible before an interaction. Do not turn the app into an animated brochure.

The screenshot's primary problem is information hierarchy: three empty sections consume the page, disclaimers repeat, and indexer details compete with the product. Adding more animation alone will not fix it.

## Information hierarchy

Every screen should answer in a few seconds:

1. What is happening with my money?
2. What needs my attention?
3. What can I do next?

Each main region gets a short title, a visual or real amount, a one-line explanation when needed, and one primary action. Supporting history and technical proof belong behind accessible Details/Receipt controls. Critical information about money ownership, fees, limits, holds and locked funds stays visible when relevant and before confirmation.

## Motion language

| Effect | Purpose | When it moves |
| --- | --- | --- |
| Slow soft halo behind a featured goal | Adds depth and identifies the focal object | Gentle decorative loop; at most one prominent loop per viewport |
| Light travelling along a card perimeter | Draws attention to a selected/focused opportunity or review item | Focus/hover or one featured region, rather than every panel |
| Static contribution arcs around a goal illustration | Shows personal savings versus released family matching | Fill changes only from confirmed data; outer decoration is visually separate |
| A short light travelling from a contributor to a goal | Explains the matching contribution | Once after confirmation, never an endless money-transfer loop |
| Receipt unfolding from one transaction row | Reveals provenance without a wall of text | On selection; focus moves correctly and returns when closed |
| A mission completion stamp | Celebrates actual approval | Once on confirmed completion, not just submission |
| Subtle outlined empty illustration | Makes the next step inviting | Minimal decorative motion; no invented balances or percentages |

Use existing CSS/SVG components first. Expand `AnimatedOutline` and `FlowDiagram` into a small reusable visual system rather than creating unrelated effects per page. Use transform/opacity for transitions, avoid large expensive animated blur surfaces, pause offscreen/background decoration and honor reduced-motion preferences. Always retain static text labels so motion is never the sole explanation.

## Screen plan

### Savings & future — implement first

Replace the three stacked prose sections with:

- **Goal focus:** a large illustration selected for the actual goal (bike, books, headphones), a real progress arc, amount remaining and the next action. Two contribution styles distinguish personal saving from family matching.
- **Family help:** compact contributor chips with released amounts. A selected contributor reveals commitment/release details. Reserved gifts must remain distinct from money already released into the goal.
- **FutureFund:** a smaller horizon strip with actual amount held, target date, locked-cash label and parent controls. The date visual describes a horizon, not guaranteed investment growth or returns.
- **Recent movement:** short event rows, each opening the existing Envio receipt. Show the own-plus-matched equation in the expanded receipt rather than repeating paragraphs on the overview.

When empty, replace all three generic notices with one contextual scene and useful action:

- Teen with no goal: outlined goal illustration, "What are you saving for?", Create goal.
- Parent with no teens: connected empty family illustration, "Start with your teen", Invite teen.
- Parent with teens but no goal: "Their next goal starts with them", one short explanation that the teen proposes and the parent approves, then View family. Do not invent parent goal-creation authority.
- No FutureFund: a compact secondary Create future fund action if supported by the deployment; no separate page-sized empty panel.
- Indexer unavailable: show unavailable state and retry, not "no goals"; absence of data must not be confused with an empty account.

### Parent overview

Balance and active family state come first. Place the next review item alongside the balance, not underneath a large marketing paragraph. If there are no reviews, show a quiet completed state with a useful family action. Summarize active goals visually. Keep wallet funding collapsed as an optional action. Move long product explanations to onboarding or contextual help.

### Teen overview

Lead with spendable money, remaining daily allowance/limit and Pay. Show one active personal goal and one current mission with real status. Let confirmed saving briefly advance the goal; do not animate an estimated balance into confirmed money. Keep progress achievements personal and evidence-based, without public wealth rankings.

### Missions

Use a compact status rail: Available, Submitted, Completed. Each mission presents title, reward, deadline and one action. Expand description and parent feedback when selected. Parent reviews show Approve/Send back and the actual reward destination. Do not celebrate submission as payment or imply unavailable contract features work.

### Family & rules

Use identity chips and a small connection diagram to show parent/teen relationships. Selecting a teen reveals allowance, current limit and controls. Group advanced rules behind an expandable section while showing a concise summary of the signed terms before an invite is created. The diagram is not a substitute for identity labels.

### Payments & approvals

A focused recipient/amount composer replaces multiple competing forms. After confirmation, show one result state. A held payment uses a clear pause symbol with reason and next action, not a success animation. Parent approval includes recipient, amount and consequence. Splits and requests are secondary flows reached through labeled actions.

### Activity

Group rows by day: actor/contributor, action, amount and state. Use a real-data contribution chart only when there is sufficient history; label it as saving contributions rather than a portfolio value chart. One row expands into proof and receipt details. A single page-level sync indicator replaces repeated developer paragraphs under each widget.

### Relative gift flow

Goal illustration and recipient first, then progress and a clear matching preview. Show the cap, ratio, expiry and unused-money rules before commitment. A visual example must be explicitly a preview. Confirmation shows a funded commitment; later releases show how the relative actually helped. Receiving wallet funds remains an optional advanced flow.

### Landing & sign-in

Keep the reference-inspired neutral presentation and animated connection diagrams. Reduce repetitive feature copy. Use illustrations to explain allowance, parent guidance and matching. Sign-in has one clear form, concise errors and account-creation recovery. Never require a decorative animation to finish before the person can act.

## Copy changes for the screenshot

| Current | Proposed first-layer UI |
| --- | --- |
| How your goals grew | Your goals |
| Save toward a goal and see your contribution... | What are you saving for? + contextual action |
| Long matching disclaimer under every receipt section | "Family matching" label; contribution-versus-return explanation in Details |
| Repeated Envio refresh paragraphs | One status chip: History updating / History unavailable / Current indexed state |
| FutureFund paragraph and large disclaimer box | "Held for later" + amount/date + "Locked cash · No yield" |
| No FutureFund yet | Small Create future fund action, if available |

The actual indexer state must drive the status chip. Do not invent a "Live" badge, declare empty history current, or hide a service failure behind decorative motion.

## Layout and theme rules

- Desktop: varied composition with one dominant region and compact supporting regions, not identical stacked panels.
- Mobile: one-column goal-first hierarchy; concise navigation, accessible labels, large tap targets and no horizontal chart dependency.
- Light: warm neutral canvas, quiet surfaces and subdued colored light. Dark: near-black canvas, legible surfaces and slightly stronger accents. Preserve the user's selection.
- Choose a consistent typography scale: expressive headings, compact labels, tabular money amounts; avoid making every explanatory paragraph large.
- Keep at most one main explanatory sentence per region before expansion. Do not apply this limit to critical confirmation terms or actionable error recovery.
- All hover-revealed actions must also work on touch and keyboard focus.

## Delivery sequence

1. Fix density and empty states in Savings & future; centralize sync status.
2. Build the reusable goal visual, contribution arcs and one restrained halo.
3. Apply the hierarchy to parent/teen overview and relative gift flow.
4. Refine missions, approvals, family rules and activity receipts.
5. Check real populated, empty, loading, unavailable and unsupported-deployment states in both themes and mobile/desktop widths.

## Acceptance

- A first-time tester can identify the main action without reading a paragraph.
- No screen needs several empty panels to say nothing has happened yet.
- Visible prose is substantially reduced in the screenshot's empty state; important money terms are retained at decision time.
- Motion directs attention or explains a confirmed outcome. Repeated decorative light does not imply recurring transfers or profit.
- Visuals are derived from real data or clearly nonnumeric illustrations/previews. No fake histories, yields or totals.
- Existing Dynamic wallet/session behavior, parent permissions, signed invitations, Envio provenance and payment confirmations stay intact.
- Reduced motion has a polished static equivalent; offscreen loops pause. Check accessible focus, readable contrast, narrow screens and responsiveness before finishing.

Reference for reduced-motion behavior: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
