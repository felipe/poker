// @ts-check
// 5-Card Draw and 7-Stud prose. No community board, so a "snapshot" is just a
// read of the cards in front of you — partial while cards are still to come,
// then the made hand once you hold five.

import { rankName, rankPlural, rankCounts, suitCounts, categoryOf } from "./core.js";

/** @typedef {import("../evaluator.js").Card} Card */

/** @param {Card[]} cards */
export function noBoardRead(cards) {
  if (cards.length < 5) {
    const rc = rankCounts(cards);
    const sc = suitCounts(cards);
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 3) return `Three ${rankPlural(r)} already — trips with cards to come.`;
    }
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 2) return `A pair of ${rankPlural(r)} — a foundation to draw to.`;
    }
    if (Math.max(...sc) >= 3) return "Three to a flush — a live drawing hand.";
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `High card so far — your best is the ${rankName(ranks[0])}.`;
  }

  const category = categoryOf(cards);
  const rc = rankCounts(cards);
  if (category === 0) {
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `Your high card is the ${rankName(ranks[0])} — no pair, no draw, just card-rank.`;
  }
  if (category === 1) {
    let pr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) { pr = r; break; }
    return `A pair of ${rankPlural(pr)} — okay, but easily beaten in a multiway pot.`;
  }
  if (category === 2) {
    /** @type {number[]} */ const ps = [];
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) ps.push(r);
    return `Two pair, ${rankPlural(ps[0])} and ${rankPlural(ps[1])} — decent, often enough at small tables.`;
  }
  if (category === 3) {
    let tr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 3) { tr = r; break; }
    return `Three of a kind, ${rankPlural(tr)} — strong.`;
  }
  if (category === 4) return "A straight — strong.";
  if (category === 5) return "A flush — strong.";
  if (category === 6) return "A full house — very strong.";
  if (category === 7) return "Four of a kind — nearly a lock.";
  return "A straight flush — the nuts.";
}
