// @ts-check
// Monte Carlo simulator: deals out the remaining cards repeatedly and
// reports win rate + a distribution of final hand categories.

import { makeDeck, evaluate, CATEGORY_DIVISOR } from "./evaluator.js";
import { VARIANTS } from "./variants.js";

/** @typedef {import("./evaluator.js").Card} Card */

/**
 * @typedef {Object} SimResult
 * @property {number} winRate        0..1 (ties contribute 1/winners)
 * @property {number[]} distribution length 9, indexed by category 0..8
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
  const used = new Set();
  for (const c of userRevealed) used.add(c.rank * 4 + c.suit);
  for (const c of boardRevealed) used.add(c.rank * 4 + c.suit);
  const remaining = makeDeck().filter(c => !used.has(c.rank * 4 + c.suit));

  const userExtra = v.hole - userRevealed.length;
  const boardExtra = v.board - boardRevealed.length;
  const oppCards = v.hole;
  const cardsNeeded = userExtra + boardExtra + numOpponents * oppCards;

  let wins = 0;
  const distribution = new Array(9).fill(0);

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

    let winners = 1;
    let beaten = false;
    for (let o = 0; o < numOpponents; o++) {
      const opp = remaining.slice(ptr + o * oppCards, ptr + (o + 1) * oppCards);
      const oppScore = evaluate(opp.concat(fullBoard));
      if (oppScore > userScore) { beaten = true; break; }
      if (oppScore === userScore) winners++;
    }
    if (!beaten) wins += 1 / winners;
  }
  return {
    winRate: wins / iterations,
    distribution: distribution.map(c => c / iterations),
  };
}
