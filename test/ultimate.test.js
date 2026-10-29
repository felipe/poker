// node --test
// Ultimate Poker: 3 hole cards, a Hold'em board, threes wild.
//
//   (1) Wild evaluator: hand-picked cases for each rule.
//   (2) Oracle: seeded random hands scored by both evaluateWild and the
//       brute-force oracle in _wild-oracle.js. scripts/verify-wild.js runs
//       the same check over all 2,598,960 five-card hands.
//   (3) Odds: the exact table in fixtures/ultimate-odds.json (every 8-card
//       hand, from scripts/ultimate-odds.js) must match what the app's own
//       simulator deals, and closed-form wild counts.
//   (4) Simulator and prose: equity sanity bounds, and the explainer naming
//       the same hand the evaluator scores.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  makeDeck, evaluate, evaluateWild, scoreFor, CATEGORY_DIVISOR, CATEGORY_NAMES, NUM_CATEGORIES,
} from "../js/evaluator.js";
import { VARIANTS, maxPlayersForVariant } from "../js/variants.js";
import { simulate } from "../js/simulate.js";
import { streetSummary, betterHandsCallout, explainTrajectory } from "../js/explain.js";
import { handName } from "../js/explain/ultimate.js";
import { setSessionSeed, mulberry32 } from "../js/prose.js";
import { oracleWild } from "./_wild-oracle.js";
import { hand } from "./_cards.js";

const W = 3;
/** @param {number} score */
const cat = score => Math.floor(score / CATEGORY_DIVISOR);
/** @param {...string} cs */
const wild = (...cs) => evaluateWild(hand(...cs), W);

/* ---------- (1) wild evaluator rules ---------- */

test("variant: 3 hole + 5 board, threes wild, Hold'em streets", () => {
  const v = VARIANTS.ultimate;
  assert.equal(v.hole, 3);
  assert.equal(v.board, 5);
  assert.equal(v.wildRank, 3);
  assert.deepEqual(v.streets.map(s => [s.label, s.user, s.board]),
    [["Pre-flop", 3, 0], ["Flop", 3, 3], ["Turn", 3, 4], ["River", 3, 5]]);
  // 52 - 3 - 5 = 44 cards, 3 per opponent → 14 opponents; capped at 10 players.
  assert.equal(maxPlayersForVariant("ultimate"), 10);
});

test("no wilds: identical to the standard evaluator", () => {
  const cards = hand("As", "Kd", "Kh", "9c", "9s", "2d", "7h", "Jc");
  assert.equal(evaluateWild(cards, W), evaluate(cards));
});

test("8 cards, two trips and a pair: the pair can outrank the second trips", () => {
  const cards = hand("7s", "7h", "7d", "4s", "4h", "4d", "As", "Ah");
  assert.equal(evaluate(cards), evaluate(hand("7s", "7h", "7d", "As", "Ah")));
  assert.equal(handName(evaluateWild(cards, W)), "Sevens full of aces");
  assert.equal(evaluateWild(cards, W), oracleWild(cards, W));
});

test("five of a kind: a wild plus four aces, and it beats a royal flush", () => {
  const five = wild("As", "Ah", "Ad", "Ac", "3s");
  assert.equal(cat(five), 9);
  assert.ok(five > wild("As", "Ks", "Qs", "Js", "Ts"), "five of a kind should beat a royal flush");
});

test("four wilds plus anything is five of a kind of that card's rank", () => {
  assert.equal(wild("3s", "3h", "3d", "3c", "7h"), wild("7s", "7h", "7d", "7c", "3s"));
  assert.equal(cat(wild("3s", "3h", "3d", "3c", "2h")), 9);
});

test("higher five of a kind wins", () => {
  assert.ok(wild("Ks", "Kh", "Kd", "3s", "3h") > wild("Qs", "Qh", "Qd", "Qc", "3s"));
});

test("a wild fills an inside straight flush", () => {
  const s = wild("9h", "8h", "6h", "5h", "3c");
  assert.equal(cat(s), 8);
  assert.equal(s, evaluate(hand("9h", "8h", "7h", "6h", "5h")));
});

test("the wheel always needs a wild, since the three is wild", () => {
  // A-2-4-5 plus a wild: the wild could pair the ace, but the straight ranks
  // higher, so it's the wheel, which tops at the five.
  const s = wild("Ac", "2d", "4h", "5s", "3c");
  assert.equal(cat(s), 4);
  assert.equal(s % CATEGORY_DIVISOR, 5 * 100 ** 4);
});

test("wild picks the highest straight it can", () => {
  // K-Q-J-T + wild: the wild is the ace (broadway), not the nine.
  assert.equal(wild("Ks", "Qd", "Jh", "Tc", "3s"), evaluate(hand("As", "Ks", "Qd", "Jh", "Tc")));
});

test("flush with a wild: the wild is the highest missing card, never a second ace", () => {
  const s = wild("Ah", "9h", "7h", "5h", "3c");
  assert.equal(s, evaluate(hand("Ah", "Kh", "9h", "7h", "5h")));
});

test("two wilds make three of a kind out of the best card, beating any two pair", () => {
  const s = wild("Kd", "9c", "7h", "3s", "3h");
  assert.equal(cat(s), 3);
  assert.equal(s, evaluate(hand("Kd", "Kc", "Ks", "9c", "7h")));
});

test("a wild with two pair makes a full house of the higher pair", () => {
  assert.equal(wild("Kd", "Kc", "8h", "8s", "3h"), evaluate(hand("Kd", "Kc", "Kh", "8h", "8s")));
});

test("a wild with a natural pair makes three of a kind; alone it pairs the top card", () => {
  assert.equal(cat(wild("Jd", "Jc", "9h", "6s", "3h")), 3);
  assert.equal(wild("Ad", "Jc", "9h", "6s", "3h"), evaluate(hand("Ad", "As", "Jc", "9h", "6s")));
});

test("scoreFor: threes are wild in Ultimate only", () => {
  const hole = hand("3s", "Ah", "Kd");
  const board = hand("Ad", "Ac", "8h", "5c", "2s");
  assert.equal(cat(scoreFor("ultimate", hole, board)), 7); // four aces
  assert.equal(cat(scoreFor("holdem", hand("Ah", "Kd"), board)), 3); // just trips in Hold'em
});

/* ---------- (2) oracle ---------- */

/**
 * Deal `n` cards with exactly `wilds` threes in them, from a seeded RNG.
 * @param {() => number} rng @param {number} n @param {number} wilds
 */
function dealWith(rng, n, wilds) {
  const deck = makeDeck();
  const threes = deck.filter(c => c.rank === W);
  const rest = deck.filter(c => c.rank !== W);
  const take = (/** @type {any[]} */ pool, k) => {
    const out = [];
    for (let i = 0; i < k; i++) out.push(pool.splice((rng() * pool.length) | 0, 1)[0]);
    return out;
  };
  return take(threes, wilds).concat(take(rest, n - wilds));
}

test("oracle: 5-card hands with 0-4 wilds", () => {
  const rng = mulberry32(20261029);
  for (const [wilds, count] of [[0, 400], [1, 1500], [2, 400], [3, 60], [4, 10]]) {
    for (let i = 0; i < count; i++) {
      const cards = dealWith(rng, 5, wilds);
      assert.equal(evaluateWild(cards, W), oracleWild(cards, W), JSON.stringify(cards));
    }
  }
});

test("oracle: 8-card hands (3 hole + 5 board) with 0-3 wilds", () => {
  const rng = mulberry32(8);
  for (const [wilds, count] of [[0, 100], [1, 200], [2, 30], [3, 3]]) {
    for (let i = 0; i < count; i++) {
      const cards = dealWith(rng, 8, wilds);
      assert.equal(evaluateWild(cards, W), oracleWild(cards, W), JSON.stringify(cards));
    }
  }
});

/* ---------- (3) odds ---------- */

const ODDS = JSON.parse(readFileSync(new URL("./fixtures/ultimate-odds.json", import.meta.url), "utf8"));

/** @param {number} n @param {number} k */
function choose(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}

test("odds table: covers every 8-card hand once, in the app's category order", () => {
  assert.equal(ODDS.totalHands, choose(52, 8));
  assert.equal(ODDS.counts.reduce((a, b) => a + b, 0), choose(52, 8));
  assert.deepEqual(ODDS.categories, CATEGORY_NAMES);
  assert.equal(ODDS.wildRank, VARIANTS.ultimate.wildRank);
  for (const n of ODDS.counts) assert.ok(n > 0);
});

test("odds table: the simulator deals the same hand distribution", () => {
  // Nothing revealed and no opponents, so each iteration deals one random
  // 8-card hand; its category frequencies should match the exact table. The
  // tolerance is 5 standard errors per category: a false alarm is ~1 in 10^6.
  const N = 40000;
  const { distribution } = simulate([], [], 0, "ultimate", N);
  for (let i = 0; i < NUM_CATEGORIES; i++) {
    const p = ODDS.counts[i] / ODDS.totalHands;
    const se = Math.sqrt(p * (1 - p) / N);
    assert.ok(Math.abs(distribution[i] - p) <= 5 * se,
      `${CATEGORY_NAMES[i]}: simulated ${(distribution[i] * 100).toFixed(2)}%, exact ${(p * 100).toFixed(2)}%`);
  }
});

test("odds: chance of holding a wild matches the closed form", () => {
  // At least one three among 3 hole cards: 1 - C(48,3)/C(52,3) ≈ 21.7%.
  const pAny = 1 - choose(48, 3) / choose(52, 3);
  assert.ok(Math.abs(pAny - 0.2174) < 0.0001);
  const N = 40000;
  let hits = 0;
  const deck = makeDeck();
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 3; k++) {
      const j = k + ((Math.random() * (52 - k)) | 0);
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    if (deck[0].rank === W || deck[1].rank === W || deck[2].rank === W) hits++;
  }
  const se = Math.sqrt(pAny * (1 - pAny) / N);
  assert.ok(Math.abs(hits / N - pAny) <= 5 * se);
});

/* ---------- (4) simulator + prose ---------- */

const ITER = 5000;

test("sim: three wilds is a huge favourite heads-up", () => {
  const { winRate, distribution } = simulate(hand("3s", "3h", "3d"), [], 1, "ultimate", ITER);
  assert.ok(winRate > 0.85, `got ${winRate.toFixed(3)}`);
  // Never worse than four of a kind.
  assert.equal(distribution.slice(0, 7).reduce((a, b) => a + b, 0), 0);
});

test("sim: a wild beats no wild, all else equal", () => {
  const withWild = simulate(hand("3s", "Kh", "9d"), [], 1, "ultimate", ITER).winRate;
  const noWild = simulate(hand("4s", "Kh", "9d"), [], 1, "ultimate", ITER).winRate;
  assert.ok(withWild > noWild + 0.1, `wild ${withWild.toFixed(3)} vs none ${noWild.toFixed(3)}`);
});

test("sim: low unsuited cards with no wild are an underdog heads-up", () => {
  const { winRate } = simulate(hand("7s", "4d", "2c"), [], 1, "ultimate", ITER);
  assert.ok(winRate < 0.4, `got ${winRate.toFixed(3)}`);
});

test("sim: the prose's 'less than fair share' holds even for the best unpaired no-wild hand", () => {
  // Ace-king high, no wild, no pair, no suit or straight shape: the strongest
  // hand that gets the "No wild and no pair" read. ~42% heads-up, under 50%.
  for (const players of [2, 6]) {
    const { winRate } = simulate(hand("As", "Kd", "8c"), [], players - 1, "ultimate", 20000);
    assert.ok(winRate < 1 / players - 0.03, `${players} players: ${winRate.toFixed(3)}`);
  }
});

test("sim: five of a kind on the river with no opponents is locked in", () => {
  const { distribution } = simulate(hand("Ah", "3c", "Kd"), hand("As", "Ad", "Ac", "8h", "2s"), 0, "ultimate", 100);
  assert.equal(distribution[9], 1);
});

test("handName names each category from the packed score", () => {
  assert.equal(handName(wild("As", "Ah", "Ad", "Ac", "3s")), "Five aces");
  assert.equal(handName(wild("As", "Ks", "Qs", "Js", "3c")), "A royal flush");
  assert.equal(handName(wild("9h", "8h", "6h", "5h", "3c")), "A nine-high straight flush");
  assert.equal(handName(wild("Kd", "Kc", "8h", "8s", "3h")), "Kings full of eights");
  assert.equal(handName(wild("Ah", "9h", "7h", "5h", "3c")), "Ace-high flush");
  assert.equal(handName(wild("Kd", "9c", "7h", "3s", "3h")), "Three kings");
  assert.equal(handName(wild("Ad", "Jc", "9h", "6s", "3h")), "A pair of aces");
  assert.equal(handName(evaluate(hand("Ad", "Jc", "9h", "6s", "2h"))), "Ace high");
});

/**
 * @param {string} name
 * @param {string[]} user @param {string[]} board
 * @param {string} expected
 */
function golden(name, user, board, expected) {
  test(`golden: ${name}`, () => {
    setSessionSeed(0);
    assert.equal(streetSummary({ userCards: hand(...user), boardCards: hand(...board), variant: "ultimate" }), expected);
  });
}

golden("three wilds pre-flop", ["3s", "3h", "3d"], [],
  "Three wilds — four of a kind is guaranteed once the board is out; a paired board makes five.");
golden("two wilds and an ace pre-flop", ["3s", "3h", "As"], [],
  "Two wilds with an ace — three aces already, and any ace or wild on the board makes four.");
golden("wild with ace-king pre-flop", ["3s", "Ah", "Kh"], [],
  "A wild with an ace and a king — already a pair of aces, with the wild free to finish a straight or flush.");
golden("no wild, junk pre-flop", ["7s", "4d", "2c"], [],
  "No wild and no pair, seven high — weak; hands like this win less than their fair share at any table size.");
golden("five of a kind on the flop", ["3s", "Ah", "Kd"], ["As", "Ad", "Ac"],
  "Five aces — only a higher five of a kind beats it. You hold one wild.");
golden("board wild plays for everyone", ["Kh", "Kd", "9c"], ["3h", "7s", "2d"],
  "Three kings — below what usually wins; most pots here go to a straight or better. The wild on the board plays for everyone.");

test("prose: names the hand the evaluator scores, for random deals on every street", () => {
  setSessionSeed(1);
  const rng = mulberry32(42);
  for (let i = 0; i < 300; i++) {
    const cards = dealWith(rng, 8, (rng() * 3) | 0);
    for (const boardLen of [3, 4, 5]) {
      const user = cards.slice(0, 3), board = cards.slice(3, 3 + boardLen);
      const prose = streetSummary({ userCards: user, boardCards: board, variant: "ultimate" });
      const name = handName(scoreFor("ultimate", user, board));
      assert.ok(prose.startsWith(name + " — "), `expected "${name}" in: ${prose}`);
    }
  }
});

test("prose: a full trajectory renders one paragraph per street plus the table note", () => {
  const user = hand("3s", "Ah", "Kh");
  const board = hand("Qh", "Jh", "2c", "9d", "5s");
  const trajectory = [0, 3, 4, 5].map((n, i) => ({ label: VARIANTS.ultimate.streets[i].label, user, board: board.slice(0, n), winRate: 0.5 }));
  const paras = explainTrajectory({ trajectory, numPlayers: 4, variant: "ultimate" });
  assert.equal(paras.length, 5);
  assert.match(paras[3], /^River: a royal flush/);
});

test("callout: five of a kind is a named threat", () => {
  const beatenBy = new Array(NUM_CATEGORIES).fill(0);
  beatenBy[9] = 0.04;
  beatenBy[7] = 0.10;
  const out = betterHandsCallout({
    variant: "ultimate",
    trajectory: [{ label: "River", user: hand("3s", "Kh", "Kd"), board: hand("Ks", "8h", "8c", "2d", "Jc"), winRate: 0.8, beatenBy }],
  });
  assert.deepEqual(out?.items.map(i => i.noun), ["a higher four of a kind", "five of a kind"]);
});
