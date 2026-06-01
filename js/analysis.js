// @ts-check
// Pure hand analysis: run the Monte Carlo simulator over a hand (or a single
// street) and derive the play/fold verdict. DOM-free and importable — the app
// wires the results to the UI, but the compute lives here so it can be reused
// and unit-tested without a DOM.

import { simulate } from "./simulate.js";
import { verdictFor } from "./verdict.js";

/** @typedef {import("./evaluator.js").Card} Card */
/** @typedef {import("./verdict.js").Verdict} Verdict */

const DEFAULT_ITERATIONS = 10000;

/**
 * Equity + verdict for a single street snapshot — "where do I stand right
 * now". Used for the mid-hand status line, which doesn't need the full
 * per-street trajectory.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 * @param {number} numOpponents
 * @param {string} variant
 * @param {number} threshold     fair share to clear (1 / numPlayers)
 * @param {number} [iterations]
 * @returns {{ winRate: number, verdict: Verdict }}
 */
export function analyzeStreet(user, board, numOpponents, variant, threshold, iterations = DEFAULT_ITERATIONS) {
  const { winRate } = simulate(user, board, numOpponents, variant, iterations);
  return { winRate, verdict: verdictFor(winRate, threshold) };
}

/**
 * @typedef {Object} StreetResult
 * @property {string} label
 * @property {Card[]} user
 * @property {Card[]} board
 * @property {number} winRate
 * @property {number[]} distribution
 * @property {number[]} beatenBy
 */

/**
 * Full-hand analysis: one simulation per street the user saw. The last street
 * is the terminal state (headline verdict + breakdown); the earlier ones power
 * the equity-by-street chart.
 *
 * @param {Array<{label: string, user: Card[], board: Card[]}>} history
 * @param {number} numOpponents
 * @param {string} variant
 * @param {number} threshold
 * @param {number} [iterations]
 * @returns {{ trajectory: StreetResult[], final: StreetResult, winRate: number, verdict: Verdict }}
 */
export function analyzeHand(history, numOpponents, variant, threshold, iterations = DEFAULT_ITERATIONS) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new RangeError(`analyzeHand: history must have at least one street, got ${Array.isArray(history) ? 0 : typeof history}`);
  }
  const trajectory = history.map(snap => {
    const res = simulate(snap.user, snap.board, numOpponents, variant, iterations);
    return { label: snap.label, user: snap.user, board: snap.board, ...res };
  });
  const final = trajectory[trajectory.length - 1];
  return { trajectory, final, winRate: final.winRate, verdict: verdictFor(final.winRate, threshold) };
}
