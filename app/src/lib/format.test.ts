import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, parseAmount } from "./format";
test("money reviews preserve every USDC base unit instead of displaying zero or truncating", () => {
  assert.equal(fmt(1n), "0.000001");
  assert.equal(fmt(1000n), "0.001");
  assert.equal(fmt(1234567n), "1.234567");
  assert.equal(fmt(-1234567n), "-1.234567");
  assert.equal(fmt(1234567000n), "1,234.567");
  assert.equal(fmt(4790000n), "4.79");
  assert.equal(fmt(0n), "0.00");
});
test("entered amount and displayed approval agree for fractional cents", () => {
  for (const text of ["0.000001", "0.001", "1.234567", "12.3456"]) assert.equal(fmt(parseAmount(text)!), text);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("0.0000001"), null);
});
