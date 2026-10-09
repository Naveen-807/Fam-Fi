// The "nothing is pre-made" path. Run against `node scripts/start-testnet.mjs`: no seeded people, no Judge Mode,
// every person is a brand-new wallet with their own Fam-ID, and the parent types every number the teen gets.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "./shots";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
let failures = 0;
const log = (ok, m) => { console.log(`${ok ? "PASS" : "FAIL"}  ${m}`); if (!ok) failures++; };
const see = async (page, text, timeout = 20000) => {
  try { await page.getByText(text, { exact: false }).first().waitFor({ timeout }); return true; } catch { return false; }
};
const fresh = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 950 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [${name} pageerror]`, e.message.slice(0, 160)));
  return page;
};
const tag = Math.floor(Math.random() * 1e6);
const parentName = `mum${tag}`, teenName = `kid${tag}`;

try {
  // 1. a visitor sees no ready-made people
  const parent = await fresh("parent");
  await parent.goto(BASE + "/");
  log(!(await parent.getByText("Judge Mode").first().isVisible().catch(() => false)), "home page shows no ready-made demo people");

  // 2. a brand-new parent creates their own account and family
  await parent.goto(BASE + "/parent");
  await parent.getByRole("button", { name: "Create a demo account" }).click();
  await parent.getByLabel("Fam-ID").fill(parentName);
  log(await see(parent, "Available"), "a new Fam-ID is checked against the chain as it is typed");
  await parent.getByRole("button", { name: "Create my family" }).click();
  log(await see(parent, "Your balance"), "parent has an empty account of their own");
  log(await see(parent, "No teen yet"), "no teen exists until the parent invites one");

  // 3. real USDC arrives from the treasury
  await parent.getByRole("button", { name: "+ Add test USDC" }).click();
  log(await see(parent, "Added 5"), "parent receives USDC from the treasury");

  // 4. the parent chooses every number
  await parent.getByLabel("Level 1 daily limit").fill("2");
  await parent.getByLabel("Level 2 daily limit").fill("4");
  await parent.getByLabel("Level 3 daily limit").fill("6");
  await parent.getByLabel("Level 4 daily limit").fill("8");
  await parent.getByLabel("New payee hold amount").fill("1");
  await parent.getByLabel("First day hold amount").fill("1");
  await parent.getByLabel("Hold minutes").fill("1");
  await parent.getByRole("button", { name: "Create invite link" }).click();
  const invite = await parent.getByLabel("Invite link").inputValue({ timeout: 20000 });
  log(invite.includes("&t=") && invite.includes("&s="), "invite link carries the parent's signed numbers");

  // 5. a brand-new teen wallet joins with exactly those numbers
  const teen = await fresh("teen");
  await teen.goto(invite);
  await teen.getByRole("button", { name: "Create a demo account" }).click();
  log(await see(teen, "Daily spending limit: 2.00 to start, rising to 8.00"), "the teen is shown the parent's own numbers");
  await teen.getByLabel("Fam-ID").fill(teenName);
  await teen.getByRole("button", { name: "Join my family" }).click();
  await teen.waitForURL("**/teen", { timeout: 40000 });
  log(await see(teen, "Daily limit 2.00"), "teen's limit is the parent's number, not a built-in one");
  log(await see(teen, `@${teenName}`), "teen has their own Fam-ID");

  // 6. the parent starts a real allowance
  await parent.reload();
  log(await see(parent, teenName.charAt(0).toUpperCase() + teenName.slice(1)), "parent now sees their own teen");
  await parent.getByLabel("Allowance budget").fill("3");
  await parent.getByLabel("Allowance per hour").fill("3600");
  await parent.getByRole("button", { name: "Start allowance" }).click();
  log(await see(parent, "allowance is flowing"), "parent starts an allowance from their own USDC");
  await teen.waitForTimeout(4000);
  await teen.reload();
  log(await see(teen, "allowance flowing in"), "the teen sees the allowance arriving");

  // 7. the teen pays the parent; the parent's own thresholds decide what is held
  await teen.getByLabel("Pay to Fam-ID").fill(parentName);
  await teen.getByLabel("Amount", { exact: true }).fill("0.50");
  await teen.getByRole("button", { name: "Pay", exact: true }).click();
  const sent = await see(teen, `Sent 0.50 to @${parentName}`);
  if (!sent) { await teen.screenshot({ path: `${SHOTS}/22-real-teen-fail.png`, fullPage: true }); console.log("  teen page text:", (await teen.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700)); }
  log(sent, "a payment under the parent's thresholds goes straight through");
  await teen.getByLabel("Amount", { exact: true }).fill("1.50");
  await teen.getByRole("button", { name: "Pay", exact: true }).click();
  log(await see(teen, "on hold"), "a payment over the parent's first-day number is held");
  await parent.reload();
  log(await see(parent, `${teenName.charAt(0).toUpperCase() + teenName.slice(1)} wants to pay`), "the parent is alerted to that exact payment");
  await parent.screenshot({ path: `${SHOTS}/20-real-parent.png`, fullPage: true });
  await teen.screenshot({ path: `${SHOTS}/21-real-teen.png`, fullPage: true });
} catch (e) {
  console.log("CRASH", e.message.split("\n")[0]);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "\nALL REAL-PATH CHECKS PASSED" : `\n${failures} REAL-PATH CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
