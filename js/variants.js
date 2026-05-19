// @ts-check
// Variant config — how many cards each player holds, how many are on the
// board, and what streets the user sees.

/**
 * @typedef {Object} Street
 * @property {string} label      shown above the prompt and on the chart
 * @property {string} foldText   sentence fragment for the fold summary
 * @property {number} user       total cards in user's hand after this street
 * @property {number} board      total community cards after this street
 */

/**
 * @typedef {Object} Variant
 * @property {string} name
 * @property {number} hole   total cards a player holds at showdown
 * @property {number} board  total community cards at showdown
 * @property {Street[]} streets
 */

/** @type {Record<string, Variant>} */
export const VARIANTS = {
  holdem: {
    name: "Texas Hold'em", hole: 2, board: 5,
    streets: [
      { label: "Pre-flop", foldText: "pre-flop",     user: 2, board: 0 },
      { label: "Flop",     foldText: "on the flop",  user: 2, board: 3 },
      { label: "Turn",     foldText: "on the turn",  user: 2, board: 4 },
      { label: "River",    foldText: "on the river", user: 2, board: 5 },
    ],
  },
  fivecard: {
    name: "5-Card Draw", hole: 5, board: 0,
    streets: [{ label: "Hand", foldText: "", user: 5, board: 0 }],
  },
  sevenstud: {
    name: "7-Card Stud", hole: 7, board: 0,
    streets: [
      { label: "3rd street", foldText: "on 3rd street", user: 3, board: 0 },
      { label: "4th street", foldText: "on 4th street", user: 4, board: 0 },
      { label: "5th street", foldText: "on 5th street", user: 5, board: 0 },
      { label: "6th street", foldText: "on 6th street", user: 6, board: 0 },
      { label: "7th street", foldText: "on 7th street", user: 7, board: 0 },
    ],
  },
};

// Row layout per total card count, so the cards keep their shape instead of
// squashing onto a single line.
/** @type {Record<number, number[]>} */
export const ROW_LAYOUTS = { 2: [2], 3: [3], 4: [4], 5: [3, 2], 6: [3, 3], 7: [4, 3] };

/** @param {number} n */
export function rowLayout(n) { return ROW_LAYOUTS[n] || [n]; }

/**
 * Max players the deck can support for a given variant, capped at the UI's 10.
 * @param {string} key
 */
export function maxPlayersForVariant(key) {
  const v = VARIANTS[key];
  const maxOpponents = Math.floor((52 - v.hole - v.board) / v.hole);
  return Math.min(10, 1 + maxOpponents);
}

// Equity within this band of the fair-share threshold counts as a TOSS-UP —
// either decision is reasonable, so we don't second-guess the user.
export const TOSSUP_BAND = 0.01; // ±1 percentage point
