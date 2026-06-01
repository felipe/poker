// node --test
// Hand evaluator coverage: one test per category, wheel straight, kicker
// tie-breaks, and a few 7-card best-of-five scenarios.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { makeDeck, shuffle, evaluate, evaluateOmaha, CATEGORY_DIVISOR } from "../js/evaluator.js";
import { hand } from "./_cards.js";

/** @param {number} score */
const cat = score => Math.floor(score / CATEGORY_DIVISOR);

// ---------- deck + shuffle ----------

test("makeDeck returns 52 unique cards", () => {
  const deck = makeDeck();
  assert.equal(deck.length, 52);
  const keys = new Set(deck.map(c => `${c.rank}-${c.suit}`));
  assert.equal(keys.size, 52);
  // sanity: every rank/suit combo present
  for (let r = 2; r <= 14; r++) {
    for (let s = 0; s < 4; s++) {
      assert.ok(keys.has(`${r}-${s}`), `missing ${r}-${s}`);
    }
  }
});

test("shuffle preserves contents", () => {
  const deck = makeDeck();
  const before = deck.map(c => `${c.rank}-${c.suit}`).sort();
  shuffle(deck);
  const after = deck.map(c => `${c.rank}-${c.suit}`).sort();
  assert.deepEqual(after, before);
  assert.equal(deck.length, 52);
});

// ---------- category boundaries ----------

test("category: straight flush", () => {
  assert.equal(cat(evaluate(hand("5s", "6s", "7s", "8s", "9s"))), 8);
  // wheel straight flush
  assert.equal(cat(evaluate(hand("As", "2s", "3s", "4s", "5s"))), 8);
  // royal flush (high straight flush)
  assert.equal(cat(evaluate(hand("Ts", "Js", "Qs", "Ks", "As"))), 8);
});

test("category: four of a kind", () => {
  assert.equal(cat(evaluate(hand("7s", "7h", "7d", "7c", "2s"))), 7);
});

test("category: full house", () => {
  assert.equal(cat(evaluate(hand("7s", "7h", "7d", "8s", "8h"))), 6);
});

test("category: flush", () => {
  assert.equal(cat(evaluate(hand("2s", "5s", "7s", "9s", "Js"))), 5);
});

test("category: straight (high + wheel)", () => {
  assert.equal(cat(evaluate(hand("5s", "6h", "7d", "8s", "9c"))), 4);
  // wheel: ace plays low
  assert.equal(cat(evaluate(hand("As", "2h", "3d", "4s", "5c"))), 4);
  // 10-high straight
  assert.equal(cat(evaluate(hand("6s", "7h", "8d", "9s", "Tc"))), 4);
});

test("category: three of a kind", () => {
  assert.equal(cat(evaluate(hand("7s", "7h", "7d", "2s", "5h"))), 3);
});

test("category: two pair", () => {
  assert.equal(cat(evaluate(hand("7s", "7h", "8d", "8s", "2h"))), 2);
});

test("category: one pair", () => {
  assert.equal(cat(evaluate(hand("7s", "7h", "2s", "5h", "9c"))), 1);
});

test("category: high card", () => {
  assert.equal(cat(evaluate(hand("As", "9h", "7d", "4s", "2c"))), 0);
});

// ---------- category ordering (higher beats lower) ----------

test("straight flush > four of a kind", () => {
  const sf = evaluate(hand("5s", "6s", "7s", "8s", "9s"));
  const quads = evaluate(hand("As", "Ah", "Ad", "Ac", "Ks"));
  assert.ok(sf > quads);
});

test("four of a kind > full house", () => {
  const quads = evaluate(hand("2s", "2h", "2d", "2c", "3s"));
  const fh = evaluate(hand("As", "Ah", "Ad", "Ks", "Kh"));
  assert.ok(quads > fh);
});

test("full house > flush", () => {
  const fh = evaluate(hand("2s", "2h", "2d", "3s", "3h"));
  const fl = evaluate(hand("As", "Ks", "Qs", "Js", "9s"));
  assert.ok(fh > fl);
});

test("flush > straight", () => {
  const fl = evaluate(hand("2s", "5s", "7s", "9s", "Js"));
  const str = evaluate(hand("Ts", "9h", "8d", "7s", "6c"));
  assert.ok(fl > str);
});

test("straight > three of a kind", () => {
  const str = evaluate(hand("5s", "6h", "7d", "8s", "9c"));
  const trips = evaluate(hand("As", "Ah", "Ad", "Ks", "Qh"));
  assert.ok(str > trips);
});

test("trip > two pair > one pair > high card", () => {
  const trip = evaluate(hand("2s", "2h", "2d", "3s", "4h"));
  const twoPair = evaluate(hand("As", "Ah", "Ks", "Kh", "Qd"));
  const onePair = evaluate(hand("As", "Ah", "Ks", "Qh", "Jd"));
  const high = evaluate(hand("As", "Kh", "Qd", "Js", "9c"));
  assert.ok(trip > twoPair);
  assert.ok(twoPair > onePair);
  assert.ok(onePair > high);
});

// ---------- tie-breaks within a category ----------

test("higher straight beats lower (wheel is the lowest)", () => {
  const wheel = evaluate(hand("As", "2h", "3d", "4s", "5c"));
  const low6 = evaluate(hand("2s", "3h", "4d", "5s", "6c"));
  const broadway = evaluate(hand("Ts", "Jh", "Qd", "Ks", "Ac"));
  assert.ok(low6 > wheel, "6-high straight should beat the wheel");
  assert.ok(broadway > low6);
});

test("kicker decides one pair", () => {
  const aceK = evaluate(hand("Ks", "Kh", "As", "9h", "5d"));
  const queenK = evaluate(hand("Ks", "Kh", "Qs", "9h", "5d"));
  assert.ok(aceK > queenK);
});

test("kicker decides two pair", () => {
  const aceKicker = evaluate(hand("Ks", "Kh", "Qs", "Qh", "As"));
  const jackKicker = evaluate(hand("Ks", "Kh", "Qs", "Qh", "Js"));
  assert.ok(aceKicker > jackKicker);
});

test("kicker decides four of a kind", () => {
  const aceKicker = evaluate(hand("7s", "7h", "7d", "7c", "As"));
  const twoKicker = evaluate(hand("7s", "7h", "7d", "7c", "2s"));
  assert.ok(aceKicker > twoKicker);
});

test("full house: higher trips win over higher pair", () => {
  // 9s over 2s vs 8s over Aces — 9s win even with worse pair
  const ninesOverTwos = evaluate(hand("9s", "9h", "9d", "2s", "2h"));
  const eightsOverAces = evaluate(hand("8s", "8h", "8d", "As", "Ah"));
  assert.ok(ninesOverTwos > eightsOverAces);
});

// ---------- 7-card best-of-five ----------

test("7 cards: picks the best 5", () => {
  // Trip kings + AJ kickers (the 5h and 2c are ignored)
  const cards = hand("Kc", "Ks", "Kh", "Ah", "Js", "5h", "2c");
  assert.equal(cat(evaluate(cards)), 3);
});

test("7 cards: a flush sneaks in", () => {
  // Five spades among the seven → flush
  const cards = hand("2s", "5s", "7s", "9s", "Js", "Ac", "3d");
  assert.equal(cat(evaluate(cards)), 5);
});

test("7 cards: straight flush ranked above trips", () => {
  // 5-9 spades + a stray pair
  const cards = hand("5s", "6s", "7s", "8s", "9s", "9h", "9d");
  assert.equal(cat(evaluate(cards)), 8);
});

test("evaluate is deterministic for the same input", () => {
  const h = hand("As", "Ah", "Ks", "Kh", "Qd");
  assert.equal(evaluate(h), evaluate(h));
});

// ---------- evaluateOmaha: must use exactly 2 hole + 3 board ----------

test("evaluateOmaha: the classic flush trap — 1 hole suit-card + 4 board suit-cards is NOT a flush", () => {
  // User has one heart in hole, board has four hearts. In Hold'em this would
  // be a flush; in Omaha you must use exactly 2 hole cards of the suit, so
  // this resolves to "best non-flush hand reachable through 2+3".
  const hole = hand("Ah", "Kc", "Qc", "Jc");
  const board = hand("2h", "5h", "9h", "Th", "3s");
  const score = evaluateOmaha(hole, board);
  assert.ok(cat(score) < 5, `expected sub-flush category, got ${cat(score)} (${score})`);
});

test("evaluateOmaha: 2 hole suit-cards + 3 board suit-cards IS a flush", () => {
  const hole = hand("Ah", "Kh", "Qc", "Jc");
  const board = hand("2h", "5h", "9h", "3c", "4s");
  const score = evaluateOmaha(hole, board);
  assert.equal(cat(score), 5, `expected flush, got category ${cat(score)}`);
});

test("evaluateOmaha: four of a kind in hole is NOT four of a kind (you can only play 2)", () => {
  // Four aces in hand — but Omaha forces you to commit only 2 of them, so the
  // best you can do is a pair of aces plus 3 board kickers.
  const hole = hand("As", "Ah", "Ad", "Ac");
  const board = hand("Kh", "Qd", "Jc", "9s", "2c");
  const score = evaluateOmaha(hole, board);
  assert.equal(cat(score), 1, `expected one pair, got category ${cat(score)}`);
});

test("evaluateOmaha: straight requires using 2 hole cards", () => {
  // Hole: 7h 8c (any pair of) — board: 5d 6s 9h Tc 2c. Best line plays
  // 7+8 from hole with 5+6+9 from board for the straight 5-9. Confirms the
  // evaluator finds the 2+3 line that completes a straight.
  const hole = hand("7h", "8c", "2s", "3d");
  const board = hand("5d", "6s", "9h", "Tc", "2c");
  const score = evaluateOmaha(hole, board);
  assert.equal(cat(score), 4, `expected straight, got category ${cat(score)}`);
});

test("evaluateOmaha: full house from pocket pair + trips on board", () => {
  // Pocket twos + three nines on board = nines full of twos. Need trips on
  // the board (not just a pair) because the user can only commit 2 hole cards.
  const hole = hand("2s", "2h", "Kc", "Qd");
  const board = hand("9h", "9c", "9d", "5s", "7c");
  const score = evaluateOmaha(hole, board);
  assert.equal(cat(score), 6, `expected full house, got category ${cat(score)}`);
});

test("evaluateOmaha: requires exactly 4 hole cards", () => {
  assert.throws(() => evaluateOmaha(hand("As", "Ah", "Ad"), hand("Kh", "Qd", "Jc", "9s", "2c")));
  assert.throws(() => evaluateOmaha(hand("As", "Ah", "Ad", "Ac", "Kh"), hand("Kh", "Qd", "Jc", "9s", "2c")));
});

test("evaluateOmaha: returns 0 when board is shorter than 3 cards", () => {
  assert.equal(evaluateOmaha(hand("As", "Ah", "Kc", "Qc"), hand("Ah")), 0);
  assert.equal(evaluateOmaha(hand("As", "Ah", "Kc", "Qc"), hand()), 0);
});

test("evaluateOmaha: works with partial boards (flop + turn)", () => {
  const hole = hand("As", "Ah", "Kc", "Qc");
  // Flop only: best is just the pocket aces + best 3 board kickers.
  const flopOnly = evaluateOmaha(hole, hand("9d", "5h", "2c"));
  assert.equal(cat(flopOnly), 1, "flop-only should give a pair");
  // Turn: same line, kickers shift.
  const turn = evaluateOmaha(hole, hand("9d", "5h", "2c", "Jd"));
  assert.equal(cat(turn), 1, "turn should still be a pair (no improvement)");
  assert.ok(turn >= flopOnly, "more board cards can only help (or tie)");
});
