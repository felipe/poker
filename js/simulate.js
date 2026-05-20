// @ts-check
// Monte Carlo simulator: deals out the remaining cards repeatedly and
// reports win rate + a distribution of final hand categories.

import { makeDeck, evaluate, CATEGORY_DIVISOR } from "./evaluator.js";
import { VARIANTS } from "./variants.js";

/** @typedef {import("./evaluator.js").Card} Card */

/**
 * @typedef {Object} SimResult
 * @property {number} winRate        0..1 (ties contribute 1/winners)
 * @property {number[]} distribution length 9, indexed by category 0..8.
 *                                   How often the user lands in each hand
 *                                   category.
 * @property {number[]} beatenBy     length 9, indexed by category 0..8. How
 *                                   often the user is beaten AND the
 *                                   strongest beating opponent had a hand of
 *                                   that category. Sum ≈ 1 - winRate (off by
 *                                   the tie share, which contributes to
 *                                   winRate as fractional wins rather than
 *                                   to beatenBy).
 */

/**
 * @param {Card[]} userRevealed
 * @param {Card[]} boardRevealed
 * @param {number} numOpponents
 * @param {string} variant
 * @param {number} iterations
 * @returns {SimResult}
 */
export function simulate(userRevealed, boardRevealed, numOpponents, variant, iterations) {
  const v = VARIANTS[variant];
  if (!v) throw new TypeError(`simulate: unknown variant "${variant}"`);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new RangeError(`simulate: iterations must be a positive integer, got ${iterations}`);
  }
  if (!Number.isInteger(numOpponents) || numOpponents < 0) {
    throw new RangeError(`simulate: numOpponents must be a non-negative integer, got ${numOpponents}`);
  }
  if (userRevealed.length > v.hole) {
    throw new RangeError(`simulate: userRevealed has ${userRevealed.length} cards, exceeds ${variant} hole=${v.hole}`);
  }
  if (boardRevealed.length > v.board) {
    throw new RangeError(`simulate: boardRevealed has ${boardRevealed.length} cards, exceeds ${variant} board=${v.board}`);
  }

  const used = new Set();
  for (const c of userRevealed) used.add(c.rank * 4 + c.suit);
  for (const c of boardRevealed) used.add(c.rank * 4 + c.suit);
  if (used.size !== userRevealed.length + boardRevealed.length) {
    throw new RangeError(`simulate: duplicate cards in userRevealed/boardRevealed`);
  }
  const remaining = makeDeck().filter(c => !used.has(c.rank * 4 + c.suit));

  const userExtra = v.hole - userRevealed.length;
  const boardExtra = v.board - boardRevealed.length;
  const oppCards = v.hole;
  const cardsNeeded = userExtra + boardExtra + numOpponents * oppCards;
  if (cardsNeeded > remaining.length) {
    throw new RangeError(`simulate: needs ${cardsNeeded} cards but only ${remaining.length} remain in the deck`);
  }

  let wins = 0;
  const distribution = new Array(9).fill(0);
  const beatenBy = new Array(9).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // Partial Fisher–Yates: only swap the prefix we'll actually use.
    for (let i = 0; i < cardsNeeded; i++) {
      const j = i + ((Math.random() * (remaining.length - i)) | 0);
      const t = remaining[i]; remaining[i] = remaining[j]; remaining[j] = t;
    }

    let ptr = 0;
    const userMore = remaining.slice(ptr, ptr + userExtra); ptr += userExtra;
    const boardMore = remaining.slice(ptr, ptr + boardExtra); ptr += boardExtra;
    const fullBoard = boardRevealed.concat(boardMore);
    const userHand = userRevealed.concat(userMore).concat(fullBoard);
    const userScore = evaluate(userHand);
    distribution[Math.floor(userScore / CATEGORY_DIVISOR)]++;

    // Iterate every opponent so we can find the strongest beating hand for
    // the beatenBy distribution. Slightly more work than the previous
    // first-beat-and-break, but only every iteration's loop, and the cost
    // shows up only on hands that have opponents at all.
    let bestOppScore = -1;
    let tiedWithUser = 0;
    for (let o = 0; o < numOpponents; o++) {
      const opp = remaining.slice(ptr + o * oppCards, ptr + (o + 1) * oppCards);
      const oppScore = evaluate(opp.concat(fullBoard));
      if (oppScore > bestOppScore) bestOppScore = oppScore;
      if (oppScore === userScore) tiedWithUser++;
    }
    if (bestOppScore > userScore) {
      beatenBy[Math.floor(bestOppScore / CATEGORY_DIVISOR)]++;
    } else {
      // Not beaten — user wins outright or splits with the tied opponents.
      wins += 1 / (1 + tiedWithUser);
    }
  }
  return {
    winRate: wins / iterations,
    distribution: distribution.map(c => c / iterations),
    beatenBy: beatenBy.map(c => c / iterations),
  };
}
