// @ts-check
// The play/fold/toss-up decision model: compare the user's equity to their
// fair share of the pot. Pure and DOM-free, so it can be reused wherever the
// equity is known — the trainer UI, the tests, or any downstream consumer.

/**
 * Equity within this band of the fair-share threshold counts as a TOSS-UP —
 * either decision is reasonable, so we don't second-guess the user.
 */
export const TOSSUP_BAND = 0.01; // ±1 percentage point

/**
 * @typedef {Object} Verdict
 * @property {"PLAY"|"FOLD"|"TOSS-UP"} text  display label
 * @property {"play"|"fold"|"tossup"} cls    CSS class suffix for styling
 */

/**
 * The math's verdict for a win probability measured against the fair-share
 * line (e.g. `1 / numPlayers`). Inside TOSSUP_BAND of the line it's a wash;
 * above the line it's a play, below it a fold.
 *
 * @param {number} winRate    0..1, the user's win probability
 * @param {number} threshold  fair share to clear
 * @returns {Verdict}
 */
export function verdictFor(winRate, threshold) {
  if (Math.abs(winRate - threshold) <= TOSSUP_BAND) return { text: "TOSS-UP", cls: "tossup" };
  return winRate > threshold
    ? { text: "PLAY", cls: "play" }
    : { text: "FOLD", cls: "fold" };
}
