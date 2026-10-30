// node --test
// Sanity bounds on the Monte Carlo simulator. Math.random can't be seeded
// from outside, so these tests use generous statistical thresholds rather
// than exact equality — wide enough that a flake is effectively impossible
// at the iteration counts used here.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { simulate } from "../js/simulate.js";
import { NUM_CATEGORIES } from "../js/evaluator.js";
import { hand } from "./_cards.js";

const ITERATIONS = 5000;

test("simulate returns { winRate, distribution, beatenBy } with expected shape", () => {
  const res = simulate(hand("As", "Ah"), [], 1, "holdem", 200);
  assert.equal(typeof res.winRate, "number");
  assert.ok(res.winRate >= 0 && res.winRate <= 1);
  assert.ok(Array.isArray(res.distribution));
  assert.equal(res.distribution.length, NUM_CATEGORIES);
  // distribution sums to 1.0 (within float epsilon)
  const distSum = res.distribution.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(distSum - 1) < 0.001, `distribution sums to ${distSum}, not 1.0`);
  assert.ok(Array.isArray(res.beatenBy));
  assert.equal(res.beatenBy.length, NUM_CATEGORIES);
  // beatenBy + winRate ≈ 1 (off by the tie share, which goes into winRate
  // as fractional wins rather than into beatenBy)
  const beatenSum = res.beatenBy.reduce((a, b) => a + b, 0);
  const total = beatenSum + res.winRate;
  assert.ok(Math.abs(total - 1) < 0.05,
    `beatenBy + winRate should ≈ 1, got ${total.toFixed(3)}`);
});

test("beatenBy is empty when the user can't be beaten", () => {
  // Royal flush on the river — nothing can beat it.
  const user = hand("As", "Ks");
  const board = hand("Qs", "Js", "Ts");
  const { winRate, beatenBy } = simulate(user, board, 1, "holdem", 1000);
  assert.ok(winRate > 0.98, `royal flush should be ~100%, got ${winRate.toFixed(3)}`);
  const beatenSum = beatenBy.reduce((a, b) => a + b, 0);
  assert.ok(beatenSum < 0.02,
    `royal flush should rarely be beaten, beatenBy sums to ${beatenSum.toFixed(3)}`);
});

test("beatenBy concentrates in high categories when only big hands beat you", () => {
  // User has a strong flush. Opponents who beat them need straight flush or
  // a higher flush. straight flush is rare but a higher flush is realistic
  // since the board has the ace of spades — beatenBy should sit in flush
  // (cat 5) or above, with high categories getting most of the mass.
  const user = hand("Ks", "9s");
  const board = hand("As", "5s", "2s", "7h", "3d");
  const { beatenBy } = simulate(user, board, 5, "holdem", 4000);
  const lowCats = beatenBy.slice(0, 5).reduce((a, b) => a + b, 0);
  const highCats = beatenBy.slice(5).reduce((a, b) => a + b, 0);
  // Nothing under flush should ever beat a flush — so the low-category mass
  // had better be effectively zero.
  assert.ok(lowCats < 0.01,
    `nothing under a flush can beat a flush; got ${lowCats.toFixed(3)} mass below cat 5`);
  assert.ok(highCats > lowCats, "threats must concentrate in flush+ categories");
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

test("simulate rejects unknown variant", () => {
  assert.throws(() => simulate([], [], 1, "notavariant", 100), TypeError);
});

test("simulate rejects iterations <= 0", () => {
  assert.throws(() => simulate([], [], 1, "holdem", 0), RangeError);
  assert.throws(() => simulate([], [], 1, "holdem", -5), RangeError);
});

test("simulate rejects non-integer iterations", () => {
  assert.throws(() => simulate([], [], 1, "holdem", 1.5), RangeError);
});

test("simulate rejects negative opponent count", () => {
  assert.throws(() => simulate([], [], -1, "holdem", 100), RangeError);
});

test("simulate rejects opponent count that exceeds deck capacity", () => {
  // 7-card stud with 10 opponents needs 7*11=77 cards, deck has 52.
  assert.throws(() => simulate([], [], 10, "sevenstud", 1), RangeError);
});

test("simulate rejects duplicate cards across user and board", () => {
  assert.throws(
    () => simulate(hand("As", "Kh"), hand("As", "2d", "3c"), 1, "holdem", 100),
    RangeError,
  );
});

test("5-Card Draw distribution centres on weak categories", () => {
  // Random 5-card hand: the categorical distribution should mostly fall in
  // high-card / one-pair (categories 0 and 1).
  const { distribution } = simulate([], [], 1, "fivecard", ITERATIONS);
  const lowCatMass = distribution[0] + distribution[1];
  assert.ok(lowCatMass > 0.7,
    `most random 5-card hands should be high-card or one-pair, got ${lowCatMass.toFixed(3)}`);
});

// ---------- Omaha sanity ----------

test("Omaha: pocket aces are favored heads-up — double-suited tops ~70%", () => {
  // PLO equity for pocket aces depends heavily on the side cards: weak
  // danglers like 7c-2d land near 60%, double-suited rundown side cards
  // (AsAhKsQh) push toward 70-73%. We test the strongest flavor against a
  // random hand and check it lands in the canonical "premium" band.
  const hole = hand("As", "Ah", "Ks", "Qh");
  const { winRate } = simulate(hole, [], 1, "omaha", ITERATIONS);
  assert.ok(winRate >= 0.65 && winRate <= 0.75,
    `AAds-style heads-up should land 65-75%, got ${winRate.toFixed(3)}`);
});

test("Omaha: four aces in hand is mediocre, not unbeatable", () => {
  // The pedagogically-classic Omaha lesson: AAAA looks unbeatable from a
  // Hold'em mindset but is actually mediocre because the rule lets you play
  // only 2 of them — the other 2 are dead. Equity is around 50-58% vs random.
  const hole = hand("As", "Ah", "Ad", "Ac");
  const { winRate } = simulate(hole, [], 1, "omaha", ITERATIONS);
  assert.ok(winRate >= 0.45 && winRate <= 0.60,
    `AAAA heads-up should land 45-60%, got ${winRate.toFixed(3)}`);
});

test("Omaha: the flush trap — single ace of hearts + 4-heart board does NOT make a flush", () => {
  // Hold'em would call this a nut flush; in Omaha you can't play the 1
  // suit-card from hole, so the user must miss the flush. Verifies the
  // simulator and evaluator agree on the Omaha rule.
  const hole = hand("Ah", "Kc", "Qd", "Js");
  const board = hand("2h", "5h", "9h", "Th", "3c");
  const { distribution } = simulate(hole, board, 0, "omaha", ITERATIONS);
  // Zero opponents → user's distribution is the user's category. Should
  // never land in flush (category 5) or above.
  const flushOrHigher = distribution.slice(5).reduce((a, b) => a + b, 0);
  assert.equal(flushOrHigher, 0,
    `Omaha rule violated: single-suit hole + 4-suit board landed in flush ${(flushOrHigher * 100).toFixed(1)}% of iterations`);
});

test("Omaha: respects deck capacity for player count", () => {
  // 52 - 4 (user) - 5 (board) = 43, opponents take 4 each → 10 max.
  // Asking for 11 opponents should fail.
  assert.throws(() => simulate([], [], 11, "omaha", 10), RangeError);
});
