// node --test
// Pure hand analysis: simulate + derive verdict, no DOM.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { analyzeStreet, analyzeHand } from "../js/analysis.js";
import { hand } from "./_cards.js";

// With zero opponents the user can't be beaten, so winRate is exactly 1 every
// iteration — deterministic, which lets us assert the verdict wiring exactly.

test("analyzeStreet: no opponents → certain win, PLAY above the fair-share line", () => {
  const { winRate, verdict } = analyzeStreet(hand("As", "Ah"), hand("Kd", "Qc", "2s"), 0, "holdem", 0.5, 200);
  assert.equal(winRate, 1);
  assert.equal(verdict.text, "PLAY");
  assert.equal(verdict.cls, "play");
});

test("analyzeStreet: derives the verdict from the threshold it's given", () => {
  // Same certain win, but a threshold at/above 1 makes it a TOSS-UP — proves
  // the verdict comes from verdictFor(winRate, threshold), not a fixed rule.
  const { verdict } = analyzeStreet(hand("As", "Ah"), hand("Kd", "Qc", "2s"), 0, "holdem", 1, 200);
  assert.equal(verdict.text, "TOSS-UP");
});

test("analyzeHand: one result per street, final is the last, verdict derives from it", () => {
  const history = [
    { label: "Pre-flop", user: hand("As", "Ah"), board: [] },
    { label: "Flop", user: hand("As", "Ah"), board: hand("Kd", "Qc", "2s") },
    { label: "River", user: hand("As", "Ah"), board: hand("Kd", "Qc", "2s", "7h", "9d") },
  ];
  const out = analyzeHand(history, 0, "holdem", 0.5, 200);

  assert.equal(out.trajectory.length, 3);
  assert.deepEqual(out.trajectory.map(t => t.label), ["Pre-flop", "Flop", "River"]);
  assert.equal(out.final, out.trajectory[2]);
  assert.equal(out.winRate, out.final.winRate);
  assert.equal(out.winRate, 1);
  assert.equal(out.verdict.text, "PLAY");
});

test("analyzeHand: each street carries the simulator fields the chart needs", () => {
  const history = [{ label: "Hand", user: hand("As", "Ah", "Ad", "Kc", "Qs"), board: [] }];
  const out = analyzeHand(history, 1, "fivecard", 0.5, 200);
  const street = out.trajectory[0];
  assert.equal(street.label, "Hand");
  assert.ok(Array.isArray(street.distribution) && street.distribution.length === 9);
  assert.ok(Array.isArray(street.beatenBy) && street.beatenBy.length === 9);
  assert.ok(street.winRate >= 0 && street.winRate <= 1);
});
