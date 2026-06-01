// @ts-check
// Pot-Limit Omaha prose.
//
// Omaha's defining rule: at showdown you MUST use exactly 2 of your 4 hole
// cards combined with exactly 3 of the 5 board cards. The classic trap is
// "I have a flush!" when you have only 1 of the suit in your hand and the
// board is 3- or 4-suited — that's not a flush in Omaha. Every made-hand
// category here comes from `categoryFor("omaha", ...)` (the shared, rule-aware
// boundary) and the draw analysis uses the Omaha rule, so the trap doesn't
// make it into print.
//
// Scope of this first cut: name the category, surface the flush draw under the
// Omaha rule (and warn explicitly on the 1-hole-suited-card trap), and call out
// flush/full-house board threats with their Omaha framings. Wraps and Omaha-
// specific straight-draw out counts are a follow-up.

import { rankName, rankPlural, rankCounts, suitCounts, categoryFor, drawPctText } from "./core.js";

/** @typedef {import("../evaluator.js").Card} Card */

/**
 * Single-snapshot Omaha read. Evaluates the Omaha category once and threads it
 * through the made-hand / draws / threats lines so we don't re-run the 60-combo
 * evaluator three times per render.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 */
export function omahaSnapshot(user, board) {
  if (board.length === 0) return omahaPreflop(user);
  const category = categoryFor("omaha", user, board);
  const parts = [omahaMadeHand(category)];
  const draws = omahaDraws(user, board, category);
  if (draws) parts.push(draws);
  const threats = omahaBoardThreats(user, board, category);
  if (threats) parts.push(threats);
  return parts.join(" ");
}

/** @param {Card[]} hole */
function omahaPreflop(hole) {
  const rc = rankCounts(hole);
  const sc = suitCounts(hole);
  // Pairs first — they anchor the hand.
  /** @type {number[]} */ const pairs = [];
  for (let r = 14; r >= 2; r--) if (rc[r] >= 2) pairs.push(r);
  // Suit structure — double-suited, single-suited, or rainbow.
  const suitMaxes = sc.slice().sort((a, b) => b - a);
  let suitedness = "rainbow";
  if (suitMaxes[0] >= 2 && suitMaxes[1] >= 2) suitedness = "double-suited";
  else if (suitMaxes[0] >= 2) suitedness = "single-suited";

  if (pairs.length >= 1 && pairs[0] >= 12) {
    return `Big pocket pair — ${rankPlural(pairs[0])} in hand, ${suitedness}. A premium Omaha starter; you'll want to see flops where the rest of your hand can connect.`;
  }
  if (pairs.length >= 1) {
    return `Pocket pair of ${rankPlural(pairs[0])}, ${suitedness}. Middle Omaha hands depend on how the other two cards connect with the board.`;
  }
  // No pair — look at how the ranks span. Tight rundowns (4 consecutive) are
  // premium, gappers are weaker.
  const sortedRanks = hole.map(c => c.rank).sort((a, b) => b - a);
  const span = sortedRanks[0] - sortedRanks[3];
  const top = rankName(sortedRanks[0]);
  const cap = top.charAt(0).toUpperCase() + top.slice(1);
  if (span <= 3) {
    return `${cap}-high rundown, ${suitedness}. Connected hands like this make a lot of straights and combo draws — Omaha's sweet spot.`;
  }
  if (span <= 5) {
    return `${cap}-high semi-connected, ${suitedness}. Some straight potential, but gaps cut your wrap chances.`;
  }
  return `${cap}-high scattered, ${suitedness}. Hard to connect with the board cleanly — Omaha penalizes loose 4-card hands.`;
}

/**
 * Names the user's current best hand under the Omaha rule. Simpler than the
 * Hold'em version's kicker-by-kicker breakdown — replicating that for Omaha
 * means tracking which 2-of-4 hole cards actually played in the best line,
 * which is a follow-up. For now we name the category and add one strength
 * remark per category.
 *
 * @param {number} category  0..8, from categoryFor("omaha", ...)
 */
function omahaMadeHand(category) {
  if (category === 0) return "Nothing made yet — high card only, using exactly 2 of your hole cards plus 3 from the board.";
  if (category === 1) return "Your best 2-hole + 3-board combo makes one pair — modest in Omaha, where hands run stronger than Hold'em.";
  if (category === 2) return "Two pair through the Omaha rule — playable but vulnerable on a board this active.";
  if (category === 3) return "Three of a kind under the Omaha rule — strong, though full houses are common in Omaha.";
  if (category === 4) return "A straight, played through 2 of your hole cards — strong, but watch for higher straights and the flush.";
  if (category === 5) return "A flush, played through 2 of your hole cards — strong. Higher flushes are the main worry.";
  if (category === 6) return "A full house — very strong in Omaha.";
  if (category === 7) return "Four of a kind under the Omaha rule — nearly a lock.";
  return "A straight flush — the nuts.";
}

/**
 * Omaha-rule draws. Focus on the most-confused case: a flush draw is
 * "≥ 2 of one suit in hole AND ≥ 2 of that suit on the board". The classic
 * trap — 1 suit-card in hole + 3 suit-cards on board — *looks* like a Hold'em
 * flush draw but is nothing under the Omaha rule, so we call it out explicitly.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 * @param {number} category  the made-hand category, already computed
 */
function omahaDraws(user, board, category) {
  if (board.length >= 5) return null;
  if (category >= 5) return null;

  /** @type {string[]} */ const parts = [];
  const userSC = suitCounts(user);
  const boardSC = suitCounts(board);

  let flushDraw = false;
  let flushTrap = false;
  for (let s = 0; s < 4; s++) {
    if (userSC[s] >= 2 && boardSC[s] >= 2) {
      const outs = 13 - userSC[s] - boardSC[s];
      parts.push(`You've got an Omaha flush draw — 2 of one suit in hand backed by 2 on the board, ${outs} outs, ${drawPctText(outs, board.length)} by the river.`);
      flushDraw = true;
      break;
    }
    if (userSC[s] === 1 && boardSC[s] >= 3) flushTrap = true;
  }
  if (flushTrap && !flushDraw) {
    parts.push("Heads up — a single card of a 3-suited board doesn't make a flush in Omaha. You'd need 2 of that suit in your hand and you have only 1.");
  }
  return parts.length ? parts.join(" ") : null;
}

/**
 * Threats that an Omaha board enables for opponents. Same shape as the
 * Hold'em version, but the rules are re-stated for the Omaha audience —
 * "any opponent holding 2 of that suit" rather than the Hold'em phrasing
 * that varies with how many suit cards are already on board.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 * @param {number} category  the made-hand category, already computed
 */
function omahaBoardThreats(user, board, category) {
  /** @type {string[]} */ const parts = [];
  const bSC = suitCounts(board);
  const bRC = rankCounts(board);
  const moreToCome = board.length < 5;

  if (category < 5) {
    let maxBoardSuit = 0;
    for (let s = 0; s < 4; s++) if (bSC[s] > maxBoardSuit) maxBoardSuit = bSC[s];
    if (maxBoardSuit >= 3) {
      parts.push(`The board has ${maxBoardSuit} of one suit — any opponent holding 2 of that suit makes a flush.`);
    } else if (maxBoardSuit === 2 && moreToCome) {
      parts.push("Two of one suit on the board — opponents with 2 of that suit in hand have a flush draw.");
    }
  }
  let boardPair = 0;
  for (let r = 2; r <= 14; r++) if (bRC[r] === 2) boardPair = r;
  if (boardPair && category < 6) {
    parts.push(`The paired ${rankPlural(boardPair)} on the board means anyone playing a matching pair from their hand makes a full house.`);
  }
  return parts.length ? parts.join(" ") : null;
}
