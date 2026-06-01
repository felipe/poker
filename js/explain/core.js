// @ts-check
// Shared primitives for the prose modules: rank/suit naming, card counting,
// the variant-aware hand category, and a couple of formatting helpers. No
// variant-specific narrative lives here — that's holdem.js / omaha.js / draw.js.

import { evaluate, evaluateOmaha, CATEGORY_DIVISOR } from "../evaluator.js";

/** @typedef {import("../evaluator.js").Card} Card */

const RANK_NAMES = {
  14: "ace", 13: "king", 12: "queen", 11: "jack", 10: "ten",
  9: "nine", 8: "eight", 7: "seven", 6: "six", 5: "five",
  4: "four", 3: "three", 2: "deuce",
};
const RANK_PLURAL = {
  14: "aces", 13: "kings", 12: "queens", 11: "jacks", 10: "tens",
  9: "nines", 8: "eights", 7: "sevens", 6: "sixes", 5: "fives",
  4: "fours", 3: "threes", 2: "deuces",
};

/** @param {number} r */
export function rankName(r) { return RANK_NAMES[/** @type {keyof typeof RANK_NAMES} */ (r)] || String(r); }
/** @param {number} r */
export function rankPlural(r) { return RANK_PLURAL[/** @type {keyof typeof RANK_PLURAL} */ (r)] || (String(r) + "s"); }
/** "an" before ace/eight, "a" otherwise. @param {string} word */
export function aOrAn(word) { return /^[aeiou]/i.test(word) ? "an" : "a"; }

/** @param {Card[]} cards */
export function rankCounts(cards) {
  const c = new Array(15).fill(0);
  for (const x of cards) c[x.rank]++;
  return c;
}
/** @param {Card[]} cards */
export function suitCounts(cards) {
  const c = new Array(4).fill(0);
  for (const x of cards) c[x.suit]++;
  return c;
}

/**
 * Best-5 hand category (0..8) of a flat card list — the Hold'em / Draw / Stud
 * rule where you take the best five of everything you can see.
 * @param {Card[]} cards
 */
export function categoryOf(cards) {
  return Math.floor(evaluate(cards) / CATEGORY_DIVISOR);
}

/**
 * Hand category (0..8) under the rules of a given variant. This is the single
 * place that owns *which evaluator a variant uses*: Hold'em, 5-Card Draw and
 * 7-Stud are "best 5 of hole+board"; Omaha is the exactly-2-hole + exactly-3-
 * board rule. Routing every prose path and the simulator through this means
 * they can't silently disagree (e.g. the prose calling a hand a flush that the
 * Omaha rule disallows).
 *
 * @param {string} variant
 * @param {Card[]} hole
 * @param {Card[]} board
 */
export function categoryFor(variant, hole, board) {
  if (variant === "omaha") return Math.floor(evaluateOmaha(hole, board) / CATEGORY_DIVISOR);
  return categoryOf(hole.concat(board));
}

/** @param {string} s */
export function decap(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

/**
 * "By the river" probability of completing a draw with `outs` outs, given how
 * many cards are already on the board. Assumes the Hold'em unseen-card counts
 * (47 on the flop, 46 on the turn); good enough as an approximation for the
 * Omaha flush-draw line too.
 *
 * Returns a string like "~35%" for the prose to splice in. The leading tilde
 * makes it clear this is rounded; banker's poker references typically quote
 * rule-of-4 approximations (which round up), but we use the exact value
 * because the trainer is meant to calibrate, not parrot folklore.
 *
 * @param {number} outs
 * @param {number} boardLen  3 (flop) or 4 (turn) — caller guarantees < 5
 */
export function drawPctText(outs, boardLen) {
  const unseen = 47 - (boardLen - 3); // 47 on flop, 46 on turn
  const remaining = 5 - boardLen;
  let pMiss = 1;
  for (let i = 0; i < remaining; i++) {
    pMiss *= (unseen - outs - i) / (unseen - i);
  }
  return `~${Math.round((1 - pMiss) * 100)}%`;
}
