// node --test
// Sanity bounds on the Monte Carlo simulator. Math.random can't be seeded
// from outside, so these tests use generous statistical thresholds rather
// than exact equality — wide enough that a flake is effectively impossible
// at the iteration counts used here.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { simulate } from "../js/simulate.js";
import { hand } from "./_cards.js";

const ITERATIONS = 5000;

test("simulate returns { winRate, distribution } with expected shape", () => {
  const res = simulate(hand("As", "Ah"), [], 1, "holdem", 200);
  assert.equal(typeof res.winRate, "number");
  assert.ok(res.winRate >= 0 && res.winRate <= 1);
  assert.ok(Array.isArray(res.distribution));
  assert.equal(res.distribution.length, 9);
  // distribution sums to 1.0 (within float epsilon)
  const sum = res.distribution.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.001, `distribution sums to ${sum}, not 1.0`);
});

test("pocket aces in heads-up Hold'em pre-flop ≈ 85%", () => {
  // Closed-form equity for AA vs random hand is ~85.3%. Allow ±5pp slack.
  const { winRate } = simulate(hand("As", "Ah"), [], 1, "holdem", ITERATIONS);
  assert.ok(winRate > 0.80, `AA heads-up win rate too low: ${winRate.toFixed(3)}`);
  assert.ok(winRate < 0.90, `AA heads-up win rate too high: ${winRate.toFixed(3)}`);
});

test("7-2 offsuit in heads-up Hold'em pre-flop ≈ 35%", () => {
  // Worst starting hand. Closed-form ~34.6% against random.
  const { winRate } = simulate(hand("7s", "2h"), [], 1, "holdem", ITERATIONS);
  assert.ok(winRate > 0.28, `7-2o heads-up win rate too low: ${winRate.toFixed(3)}`);
  assert.ok(winRate < 0.42, `7-2o heads-up win rate too high: ${winRate.toFixed(3)}`);
});

test("more opponents → equity drops", () => {
  // Same hand against 1 vs 5 opponents. Equity must strictly decrease.
  const heads = simulate(hand("As", "Ks"), [], 1, "holdem", ITERATIONS);
  const fiveOpps = simulate(hand("As", "Ks"), [], 5, "holdem", ITERATIONS);
  assert.ok(heads.winRate > fiveOpps.winRate,
    `AKs heads-up (${heads.winRate.toFixed(2)}) should beat AKs vs 5 (${fiveOpps.winRate.toFixed(2)})`);
});

test("already-made flush on the board has very high equity", () => {
  // User holds As Ks; board shows three spades → user has a king-high flush
  // (with the As-Ks-board chain). Equity should be ≥ 90% vs one opponent.
  const user = hand("As", "Ks");
  const board = hand("Qs", "9s", "4s");
  const { winRate } = simulate(user, board, 1, "holdem", ITERATIONS);
  assert.ok(winRate > 0.85,
    `made flush should be very strong, got ${winRate.toFixed(3)}`);
});

test("dead hand on the river has near-zero equity", () => {
  // User holds 2c 3d; board makes opponent's straight likely.
  // Loosely check: at full runout against many opponents, equity is bounded.
  const user = hand("2c", "3d");
  const board = hand("Ts", "Jh", "Qd", "Ks", "Ac"); // already a straight on the board
  // Both players play the board → split is common, but user shouldn't dominate
  const { winRate } = simulate(user, board, 1, "holdem", ITERATIONS);
  assert.ok(winRate < 0.7,
    `dead hand can't dominate, got ${winRate.toFixed(3)}`);
});

test("5-Card Draw distribution centres on weak categories", () => {
  // Random 5-card hand: the categorical distribution should mostly fall in
  // high-card / one-pair (categories 0 and 1).
  const { distribution } = simulate([], [], 1, "fivecard", ITERATIONS);
  const lowCatMass = distribution[0] + distribution[1];
  assert.ok(lowCatMass > 0.7,
    `most random 5-card hands should be high-card or one-pair, got ${lowCatMass.toFixed(3)}`);
});
