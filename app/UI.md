# Fam-Fi appearance

Light is the first-visit default. The header offers Light, Dark and System, stored as `famfi-theme`. Initialization runs before body paint; blocked/invalid storage falls back to Light. System watches `prefers-color-scheme`. Theme changes do not remount wallet providers, routes or forms.

Tailwind's existing semantic color names resolve through RGB CSS variables, including opacity utilities. Neutral surfaces dominate; coral, blue and mint are decorative accents distinct from money/error statuses. QR codes retain their light backgrounds for scanning.

## Visual components

- `AnimatedOutline`: absolute, noninteractive decoration inside a positioned parent. Props: `accent` (coral/mint/blue), `radius` (20), `duration` (6 seconds), `delay` (0 seconds), `animated` (true). A ResizeObserver measures the actual box. Normalized SVG paths keep the colored segment at 14% of the perimeter. Unique filter IDs prevent collisions. Static outlines strengthen on invite hover/focus.
- `FlowDiagram`: allowance/guidance/saving schematic with an optional compact appearance. Accessible labels and captions identify illustrations; no simulated account data or transactions.
- Both effects pause through IntersectionObserver and document visibility. Reduced-motion CSS renders static strokes instead of looping motion. No additional animation dependency.
- `ThemeToggle`: a labeled native select in the shared header, supporting keyboard interaction.

## Verify

Run `npm run typecheck`, `npm run build`, and `node ../relayer/node_modules/tsx/dist/cli.mjs --test src/lib/invite.test.ts src/lib/theme.test.ts` from `app/`. Keep dev output in `.next-dyn` while building into `.next`.

Inspect landing and workspace views in both themes at 390/768/1024/1440px, theme persistence, System appearance, focus visibility, form preservation, unavailable-indexer notices and moving stroke geometry. Reduced motion should stop loops; offscreen/background effects should pause. Never submit a signature or money action merely to verify appearance. Real teen and populated goal/split workflows need the corresponding signed-in accounts and chain/indexer state.
