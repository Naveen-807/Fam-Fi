import { test } from "node:test";
import assert from "node:assert/strict";
import { passkeyBrowserError, passkeyErrorMessage } from "./passkey-feedback";

test("unsupported origins and browsers stop before credential creation", () => {
  assert.match(passkeyBrowserError(false, true)!, /HTTPS or localhost/);
  assert.match(passkeyBrowserError(true, false)!, /cannot create/);
  assert.equal(passkeyBrowserError(true, true), null);
});
test("disabled environment, cancellation and origin denial have distinct recovery", () => {
  assert.match(passkeyErrorMessage(new Error("Passkey authenticator is not enabled")), /Dynamic environment/);
  assert.match(passkeyErrorMessage({ name: "NotAllowedError" }), /cancelled/);
  assert.match(passkeyErrorMessage({ name: "SecurityError" }), /configuration/);
});
test("unexpected service errors cannot expose credentials in feedback", () => {
  const response = passkeyErrorMessage(new Error("private-service-response-token"));
  assert.doesNotMatch(response, /private-service-response-token/);
  assert.match(response, /Email sign-in/);
});
