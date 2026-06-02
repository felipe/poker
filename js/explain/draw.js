// @ts-check
// 5-Card Draw and 7-Stud prose. No community board, so a "snapshot" is just a
// read of the cards in front of you — partial while cards are still to come,
// then the made hand once you hold five.

import { rankName, rankPlural, rankCounts, suitCounts, categoryOf } from "./core.js";
import { rngFor, cardsKey, pick } from "../prose.js";

/** @typedef {import("../evaluator.js").Card} Card */

// Editorial tails for the boardless read. The factual core (hand name) stays
// fixed; only the remark varies.
const DRAW_TAILS = {
  partialTrips: ["trips with cards to come.", "trips already, and more cards coming.", "a strong start — trips with cards still to come."],
  partialPair: ["a foundation to draw to.", "something to build on.", "a base to draw from."],
  partialFlush: ["a live drawing hand.", "a real drawing hand.", "a hand with flush potential."],
  highLead: ["High card so far", "Nothing made yet", "Just high card for now"],
  madeHighTail: ["no pair, no draw, just card-rank.", "nothing made — just high card.", "no pair and no draw to speak of."],
  madePair: ["okay, but easily beaten in a multiway pot.", "modest; vulnerable in a multiway pot.", "playable, but thin against several opponents."],
  twoPair: ["decent, often enough at small tables.", "decent; often good enough short-handed.", "a fair hand, frequently a winner at small tables."],
  trips: ["strong.", "a strong hand.", "powerful."],
  straight: ["strong.", "a strong made hand.", "powerful."],
  flush: ["strong.", "a strong made hand.", "powerful."],
  fullHouse: ["very strong.", "a big hand.", "very powerful."],
  quads: ["nearly a lock.", "almost unbeatable.", "a near-certain winner."],
  straightFlush: ["the nuts.", "unbeatable.", "the best hand possible."],
};

/** @param {Card[]} cards */
export function noBoardRead(cards) {
  const rng = rngFor(`draw|read|${cardsKey(cards)}`);
  if (cards.length < 5) {
    const rc = rankCounts(cards);
    const sc = suitCounts(cards);
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 3) return `Three ${rankPlural(r)} already — ${pick(rng, DRAW_TAILS.partialTrips)}`;
    }
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 2) return `A pair of ${rankPlural(r)} — ${pick(rng, DRAW_TAILS.partialPair)}`;
    }
    if (Math.max(...sc) >= 3) return `Three to a flush — ${pick(rng, DRAW_TAILS.partialFlush)}`;
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `${pick(rng, DRAW_TAILS.highLead)} — your best is the ${rankName(ranks[0])}.`;
  }

  const category = categoryOf(cards);
  const rc = rankCounts(cards);
  if (category === 0) {
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `Your high card is the ${rankName(ranks[0])} — ${pick(rng, DRAW_TAILS.madeHighTail)}`;
  }
  if (category === 1) {
    let pr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) { pr = r; break; }
    return `A pair of ${rankPlural(pr)} — ${pick(rng, DRAW_TAILS.madePair)}`;
  }
  if (category === 2) {
    /** @type {number[]} */ const ps = [];
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) ps.push(r);
    return `Two pair, ${rankPlural(ps[0])} and ${rankPlural(ps[1])} — ${pick(rng, DRAW_TAILS.twoPair)}`;
  }
  if (category === 3) {
    let tr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 3) { tr = r; break; }
    return `Three of a kind, ${rankPlural(tr)} — ${pick(rng, DRAW_TAILS.trips)}`;
  }
  if (category === 4) return `A straight — ${pick(rng, DRAW_TAILS.straight)}`;
  if (category === 5) return `A flush — ${pick(rng, DRAW_TAILS.flush)}`;
  if (category === 6) return `A full house — ${pick(rng, DRAW_TAILS.fullHouse)}`;
  if (category === 7) return `Four of a kind — ${pick(rng, DRAW_TAILS.quads)}`;
  return `A straight flush — ${pick(rng, DRAW_TAILS.straightFlush)}`;
}
