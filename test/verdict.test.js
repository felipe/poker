// node --test
// The play/fold/toss-up decision model.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { verdictFor, TOSSUP_BAND } from "../js/verdict.js";

test("TOSSUP_BAND is the documented ±1pp window", () => {
  assert.equal(TOSSUP_BAND, 0.01);
});

test("clearly above the fair-share line is a PLAY", () => {
  const v = verdictFor(0.60, 0.25);
  assert.equal(v.text, "PLAY");
  assert.equal(v.cls, "play");
});

test("clearly below the fair-share line is a FOLD", () => {
  const v = verdictFor(0.10, 0.25);
  assert.equal(v.text, "FOLD");
  assert.equal(v.cls, "fold");
});

test("within ±1pp of the line is a TOSS-UP, either side", () => {
  assert.equal(verdictFor(0.255, 0.25).text, "TOSS-UP"); // just above
  assert.equal(verdictFor(0.245, 0.25).text, "TOSS-UP"); // just below
  assert.equal(verdictFor(0.25, 0.25).text, "TOSS-UP");  // exactly on
});

test("the band is inclusive — a difference of exactly TOSSUP_BAND is a TOSS-UP", () => {
  // Math.abs(0.01 - 0) is bit-identical to TOSSUP_BAND, so this exercises the
  // `<=` boundary without the floating-point drift an intermediate sum like
  // (0.25 + 0.01) would introduce.
  assert.equal(verdictFor(TOSSUP_BAND, 0).text, "TOSS-UP"); // diff == band, above
  assert.equal(verdictFor(0, TOSSUP_BAND).text, "TOSS-UP"); // diff == band, below
  // A clear margin outside the band tips to PLAY / FOLD.
  assert.equal(verdictFor(0.05, 0).text, "PLAY");
  assert.equal(verdictFor(0, 0.05).text, "FOLD");
});
