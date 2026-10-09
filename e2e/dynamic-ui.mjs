// Renders the real sign-in form with a placeholder Dynamic environment ID. It cannot complete a login
// (that needs a real environment), but it proves the new headless sign-in loads, validates and fails gracefully.
import { chromium } from "playwright-core";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = process.env.SHOT || "./dynamic-signin.png";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage();
// Answer Dynamic's API like it answers a wrong environment ID (404), so this test needs no network or account.
await page.route(/dynamic(auth)?\.(com|xyz)/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "environment not found" }) }));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let failures = 0;
const log = (ok, m) => { console.log(`${ok ? "PASS" : "FAIL"}  ${m}`); if (!ok) failures++; };
await page.goto(BASE + "/parent", { timeout: 120000 });
log(await page.getByLabel("Email", { exact: true }).waitFor({ timeout: 60000 }).then(() => true).catch(() => false), "email sign-in form renders (Dynamic mode)");
log((await page.getByRole("button", { name: "Email me a code" }).isDisabled()), "send button is disabled until the email looks valid");
await page.getByLabel("Email", { exact: true }).fill("parent@example.com");
log(!(await page.getByRole("button", { name: "Email me a code" }).isDisabled()), "send button enables for a valid email");
log(await page.getByText("Already turned on Face ID or fingerprint?").isVisible(), "passkey shortcut is offered");
await page.screenshot({ path: SHOT });
await page.getByRole("button", { name: "Email me a code" }).click();
// With a placeholder environment the request fails; the page must stay usable and say so in words.
await page.waitForTimeout(6000);
const stillThere = await page.getByLabel("Email", { exact: true }).isVisible().catch(() => false);
const codeStep = await page.getByLabel("One-time code").isVisible().catch(() => false);
log(stillThere || codeStep, "page stays usable after a failed or successful send");
log(await page.getByText("Sign-in isn't set up correctly yet").isVisible().catch(() => false), "a wrong environment ID is explained in plain words");
const unexpected = errors.filter((e) => !/environment not found/i.test(e));
log(unexpected.length === 0, `no unexpected page errors${unexpected.length ? ": " + unexpected.join(" | ").slice(0, 200) : ""}`);
await browser.close();
process.exit(failures ? 1 : 0);
