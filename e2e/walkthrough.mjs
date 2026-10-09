// Drives the real UI in separate browser contexts (parent, teen, friend, relative) against the local stack.
// Run `node scripts/local-stack.mjs --app` from the repo root first, then `npm run walkthrough` here.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "./shots";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
let failures = 0;
const log = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

async function person(name, path) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 950 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [${name} pageerror]`, e.message));
  await page.goto(BASE + "/");
  await page.locator("button", { hasText: `@${name}` }).click();
  await page.waitForURL("**" + path.split("?")[0]);
  return page;
}
const see = async (page, text, timeout = 15000) => {
  try { await page.getByText(text, { exact: false }).first().waitFor({ timeout }); return true; } catch { return false; }
};
const shot = (page, n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

try {
  const parent = await person("priya", "/parent");
  log(await see(parent, "Your balance"), "parent dashboard loads (Judge Mode)");
  log(await see(parent, "Alex"), "parent sees Alex");
  await shot(parent, "01-parent");

  const alex = await person("alex", "/teen");
  log(await see(alex, "You can spend"), "teen home loads");
  await shot(alex, "02-teen");

  // 1. a normal payment
  await alex.getByLabel("Pay to Fam-ID").fill("canteen");
  await alex.getByLabel("Amount", { exact: true }).fill("1.50");
  await alex.getByLabel("Note", { exact: true }).fill("snack");
  await alex.getByRole("button", { name: "Pay", exact: true }).click();
  log(await see(alex, "Sent 1.50 to @canteen"), "teen pays canteen by Fam-ID");
  log(await see(alex, "Paid in"), "payment shows its measured time");
  await shot(alex, "03-paid");

  // 2. over the daily limit -> held for the parent
  await alex.getByLabel("Pay to Fam-ID").fill("canteen");
  await alex.getByLabel("Amount", { exact: true }).fill("4.50");
  await alex.getByRole("button", { name: "Pay", exact: true }).click();
  log(await see(alex, "over today's limit"), "over-limit payment is held");
  await parent.reload();
  log(await see(parent, "Alex wants to pay Canteen"), "parent is alerted");
  await shot(parent, "04-parent-alert");
  await parent.getByRole("button", { name: "Approve", exact: true }).first().click();
  log(await see(parent, "Approved"), "parent approves the held payment");

  // 3. goal + matched gift
  await alex.reload();
  await alex.getByLabel("Goal name").fill("Headphones");
  await alex.getByLabel("Goal cost").fill("10");
  await alex.getByRole("button", { name: "Ask my parent" }).click();
  log(await see(alex, "Sent to your parent"), "teen proposes a goal");
  await parent.reload();
  log(await see(parent, "wants to save"), "parent sees the goal");
  await parent.getByRole("button", { name: "Approve and open for gifts" }).click();
  log(await see(parent, "Goal approved and open for gifts"), "parent approves the goal");

  const aunt = await person("aunt", "/gift");
  await aunt.getByRole("link", { name: "Help with this goal" }).first().click();
  await aunt.waitForURL("**/gift/*");
  await aunt.getByLabel("Gift amount").fill("5");
  await shot(aunt, "05-gift");
  await aunt.getByRole("button", { name: "Lock my gift" }).click();
  log(await see(aunt, "Gift locked"), "relative locks a 1:1 gift");

  await alex.reload();
  await alex.getByText("+ Add test USDC").click();
  log(await see(alex, "Added"), "teen tops up test money");
  await alex.getByLabel("Save toward Headphones").fill("5");
  await alex.getByRole("button", { name: "Save", exact: true }).click();
  log(await see(alex, "gift money joined it"), "saving releases the gift in the same step");
  log(await see(alex, "Level up"), "goal completes and the teen levels up");
  await alex.reload();
  log(await see(alex, "Level 2"), "teen shows Level 2");
  await shot(alex, "06-goal-done");

  // 4. split a bill; a friend pays through the link
  await alex.getByLabel("Bill total").fill("6");
  await alex.getByLabel("Friends who owe").fill("3");
  await alex.getByLabel("Bill note").fill("pizza");
  await alex.getByRole("button", { name: "Create split link" }).click();
  const link = await alex.getByLabel("Split link").inputValue({ timeout: 15000 });
  log(/\/split\/\d+$/.test(link), `split link created (${link})`);
  const riya = await person("riya", "/teen");
  await riya.goto(link);
  log(await see(riya, "Your share is"), "friend sees the split");
  await riya.getByRole("button", { name: /Pay \$2\.00/ }).click();
  log(await see(riya, "You've paid your share"), "friend pays their share");
  await alex.goto(link);
  log(await see(alex, "1 of 3 have paid"), "creator sees progress update");
  await shot(riya, "07-split");

  // 5. freeze blocks spending
  await parent.reload();
  await parent.getByRole("button", { name: "Freeze spending" }).first().click();
  log(await see(parent, "Spending frozen"), "parent freezes spending");
  await alex.goto(BASE + "/teen");
  await alex.getByLabel("Pay to Fam-ID").fill("canteen");
  await alex.getByLabel("Amount", { exact: true }).fill("0.50");
  await alex.getByRole("button", { name: "Pay", exact: true }).click();
  log(await see(alex, "frozen"), "frozen teen is blocked with a clear message");
  await shot(alex, "08-frozen");

  // 6. the REAL onboarding path: a parent writes their own numbers, and a brand-new wallet joins with them
  await parent.reload();
  await parent.getByLabel("Level 1 daily limit").fill("2");
  await parent.getByLabel("Level 2 daily limit").fill("4");
  await parent.getByLabel("Level 3 daily limit").fill("6");
  await parent.getByLabel("Level 4 daily limit").fill("8");
  await parent.getByLabel("New payee hold amount").fill("1");
  await parent.getByLabel("First day hold amount").fill("1");
  await parent.getByLabel("Hold minutes").fill("1");
  await parent.getByRole("button", { name: "Create invite link" }).click();
  const invite = await parent.getByLabel("Invite link").inputValue({ timeout: 15000 });
  log(invite.includes("&t="), "parent's own numbers are signed into the invite link");
  const kidCtx = await browser.newContext({ viewport: { width: 430, height: 950 } });
  const kid = await kidCtx.newPage();
  await kid.goto(invite);
  await kid.getByRole("button", { name: "Create a demo account" }).click();
  log(await see(kid, "The rules your parent chose"), "new teen is shown the parent's rules before joining");
  log(await see(kid, "Daily spending limit: 2.00 to start, rising to 8.00"), "the rules shown are the numbers the parent typed");
  const kidName = "kid" + Math.floor(Math.random() * 1e6);
  await kid.getByLabel("Fam-ID").fill(kidName);
  await kid.getByRole("button", { name: "Join my family" }).click();
  await kid.waitForURL("**/teen", { timeout: 30000 });
  log(await see(kid, "Daily limit 2.00"), "a brand-new wallet joined and got the parent's limit, not a built-in one");
  await shot(kid, "10-new-teen");

  // 7. timeline tells the story
  await alex.getByRole("tab", { name: "Timeline" }).click();
  log(await see(alex, "saved 5.00 toward"), "timeline tells the story in plain language");
  await shot(alex, "09-timeline");
} catch (e) {
  console.log("CRASH", e.message);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "\nALL UI CHECKS PASSED" : `\n${failures} UI CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
