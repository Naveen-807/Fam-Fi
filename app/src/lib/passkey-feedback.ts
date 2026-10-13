/** Keep registration failures visible without exposing service response bodies. */
export function passkeyErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name ?? "";
  const message = error instanceof Error ? error.message : "";
  if (/not enabled/i.test(message)) return "Passkey authentication is disabled in this Dynamic environment. Enable it for the environment used by Fam-Fi, then reload this page.";
  if (/NoWebAuthN|not supported/i.test(name + message)) return "This browser cannot create passkeys. Open Fam-Fi in a supported browser such as Safari and sign in with email first.";
  if (/NotAllowed|Abort|cancel/i.test(name + message)) return "Passkey setup was cancelled or the browser could not complete it. No success has been recorded. Try again and complete the device prompt.";
  if (/SecurityError|rp.?id|relying party|origin/i.test(name + message)) return "The browser rejected the passkey website configuration. Check the allowed origin and relying-party settings in Dynamic for this exact website.";
  if (/InvalidState|already registered/i.test(name + message)) return "A passkey may already exist for this account. Try passkey sign-in, or choose another authenticator.";
  if (/forbidden|unauthorized|401|403/i.test(message)) return "Dynamic denied passkey registration. Sign out and sign back in with the same email, then retry. If it repeats, check the environment's passkey permissions.";
  return "Passkey setup did not complete. Check your connection and browser prompt, then retry. Email sign-in is still available.";
}

export function passkeyBrowserError(secureContext: boolean, supportsCredentials: boolean): string | null {
  if (!secureContext) return "Passkeys need HTTPS or localhost. Open Fam-Fi on localhost for local testing, or its HTTPS deployment.";
  if (!supportsCredentials) return "This browser cannot create passkeys. Open Fam-Fi in a supported browser such as Safari and sign in with email first.";
  return null;
}
