// @ts-check
// Ultimate Poker prose: 3 hole cards, a Hold'em board, threes wild.
//
// Wilds change what a hand is worth. Heads-up, a straight or better takes
// about 72% of pots and one pair is the best hand at the table only about 1
// time in 20 (docs/ultimate-odds.md has the numbers). The strength remarks
// here are calibrated to that, not to Hold'em. Every made hand is named from
// `scoreFor("ultimate", ...)`, the same score the simulator uses, so the prose
// can't name a hand the evaluator wouldn't give you.

import { rankName, rankPlural, rankCounts, suitCounts, aOrAn } from "./core.js";
import { scoreFor, CATEGORY_DIVISOR } from "../evaluator.js";
import { VARIANTS } from "../variants.js";
import { rngFor, pick } from "../prose.js";

/** @typedef {import("../evaluator.js").Card} Card */

const WILD = /** @type {number} */ (VARIANTS.ultimate.wildRank);

// Strength remarks per made-hand category. The hand name in front of each one
// is fixed; only this remark varies.
const MADE_TAILS = {
  high: [
    "with wilds in play that almost never wins.",
    "about the weakest holding in a wild game.",
    "far behind what usually wins here.",
  ],
  pair: [
    "weak here; wilds push most winning hands well past a pair.",
    "thin in a wild game, where a pair rarely holds up.",
    "rarely enough once wilds are around.",
  ],
  twoPair: [
    "behind any three of a kind, and most pots go to a straight or better.",
    "a Hold'em hand in a wild game; most pots need a straight or better.",
    "vulnerable; wilds make straights and full houses common.",
  ],
  trips: [
    "below what usually wins; most pots here go to a straight or better.",
    "modest; with wilds around, straights and better take most pots.",
    "playable, but wild games usually run past three of a kind.",
  ],
  straight: [
    "decent, but wilds make flushes and full houses common.",
    "solid, though full houses turn up often with wilds.",
    "good, not great, in a wild game.",
  ],
  flush: [
    "good, but wilds put full houses and quads in play.",
    "strong, though full houses come easily with wilds.",
    "solid; the full houses wilds make are the worry.",
  ],
  fullHouse: [
    "strong, but four of a kind is common with wilds.",
    "a big hand, though wilds make four of a kind reachable.",
    "strong; quads are the main threat in a wild game.",
  ],
  quads: [
    "very strong, though wilds make bigger quads and five of a kind possible.",
    "a monster, but a wild game can still produce five of a kind.",
    "near the top; only higher quads, a straight flush, or five of a kind beat it.",
  ],
  straightFlush: [
    "beaten only by a higher straight flush or five of a kind.",
    "almost unbeatable; only five of a kind or a higher straight flush tops it.",
    "near-certain; five of a kind is the only real threat.",
  ],
  fiveKind: [
    "only a higher five of a kind beats it.",
    "the top category; just a higher five of a kind beats it.",
    "about as good as it gets: only a higher five of a kind wins.",
  ],
};

/** @param {Card[]} cards */
const wildsIn = cards => cards.filter(c => c.rank === WILD).length;
/** @param {Card[]} cards */
const naturals = cards => cards.filter(c => c.rank !== WILD);
/** @param {string} s */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/** @param {number} n */
const wildWord = n => ["no wilds", "one wild", "two wilds", "three wilds", "four wilds"][n];

/**
 * Single-snapshot read. Pre-flop reads the three hole cards; from the flop on
 * it names the best five-card hand and says where the wilds are.
 * @param {Card[]} user
 * @param {Card[]} board
 */
export function ultimateSnapshot(user, board) {
  if (board.length === 0) return ultimatePreflop(user);
  const score = scoreFor("ultimate", user, board);
  const rng = rngFor("ultimate", "made", user, board);
  const parts = [`${handName(score)} — ${pick(rng, tailFor(Math.floor(score / CATEGORY_DIVISOR)))}`];
  const where = wildsLine(wildsIn(user), wildsIn(board));
  if (where) parts.push(where);
  return parts.join(" ");
}

/**
 * Name a packed score as a hand: "Four kings", "Queens full of nines".
 * @param {number} score
 */
export function handName(score) {
  const category = Math.floor(score / CATEGORY_DIVISOR);
  const k = [];
  let rest = score % CATEGORY_DIVISOR;
  for (let i = 0; i < 5; i++) { k.unshift(rest % 100); rest = Math.floor(rest / 100); }
  switch (category) {
    case 9: return `Five ${rankPlural(k[0])}`;
    case 8: return k[0] === 14 ? "A royal flush" : `A ${rankName(k[0])}-high straight flush`;
    case 7: return `Four ${rankPlural(k[0])}`;
    case 6: return `${cap(rankPlural(k[0]))} full of ${rankPlural(k[1])}`;
    case 5: return `${cap(rankName(k[0]))}-high flush`;
    case 4: return `${cap(rankName(k[0]))}-high straight`;
    case 3: return `Three ${rankPlural(k[0])}`;
    case 2: return `Two pair, ${rankPlural(k[0])} and ${rankPlural(k[1])}`;
    case 1: return `A pair of ${rankPlural(k[0])}`;
    default: return `${cap(rankName(k[0]))} high`;
  }
}

/** @param {number} category */
function tailFor(category) {
  return [
    MADE_TAILS.high, MADE_TAILS.pair, MADE_TAILS.twoPair, MADE_TAILS.trips,
    MADE_TAILS.straight, MADE_TAILS.flush, MADE_TAILS.fullHouse, MADE_TAILS.quads,
    MADE_TAILS.straightFlush, MADE_TAILS.fiveKind,
  ][category];
}

/**
 * Where the wilds are. Board wilds play for every player, so they don't set
 * you apart; wilds in your hand do.
 * @param {number} mine @param {number} onBoard
 */
function wildsLine(mine, onBoard) {
  const board = onBoard === 1
    ? "The wild on the board plays for everyone."
    : onBoard > 1 ? `The ${onBoard} wilds on the board play for everyone.` : "";
  if (mine === 0) return board || null;
  const yours = mine === 1 ? "You hold one wild." : `You hold ${wildWord(mine)}.`;
  return board ? `${yours} ${board}` : yours;
}

/** @param {Card[]} hole */
function ultimatePreflop(hole) {
  const rng = rngFor("ultimate", "preflop", hole);
  const w = wildsIn(hole);
  const nat = naturals(hole).map(c => c.rank).sort((a, b) => b - a);

  if (w === 3) {
    return `Three wilds — ${pick(rng, [
      "four of a kind at worst once the board comes, and five of a kind if it pairs.",
      "you'll hold at least four of a kind by the river, five of a kind on any paired board.",
      "four of a kind is guaranteed once the board is out; a paired board makes five.",
    ])}`;
  }
  if (w === 2) {
    return `Two wilds with ${aOrAnRank(nat[0])} — ${pick(rng, [
      `three ${rankPlural(nat[0])} already, and any ${rankName(nat[0])} or wild on the board makes four.`,
      `already three ${rankPlural(nat[0])}, with four of a kind one card away.`,
      `three ${rankPlural(nat[0])} before the flop; one more ${rankName(nat[0])} or wild makes four.`,
    ])}`;
  }
  const rc = rankCounts(naturals(hole));
  const pairRank = nat.find(r => rc[r] >= 2);
  if (w === 1) {
    if (pairRank) {
      return `A wild with a pair of ${rankPlural(pairRank)} — ${pick(rng, [
        `three ${rankPlural(pairRank)} already, a strong start in this game.`,
        `already three ${rankPlural(pairRank)}, well ahead of a typical hand.`,
      ])}`;
    }
    return `A wild with ${aOrAnRank(nat[0])} and ${aOrAnRank(nat[1])} — ${pick(rng, [
      `a pair of ${rankPlural(nat[0])} now, and the wild fills straights and flushes later.`,
      `already a pair of ${rankPlural(nat[0])}, with the wild free to finish a straight or flush.`,
      `that's a pair of ${rankPlural(nat[0])}, and the wild can complete a draw later.`,
    ])}`;
  }
  if (rc[nat[0]] === 3) {
    return `Three ${rankPlural(nat[0])} with no wild — ${pick(rng, [
      "strong, and any wild that comes makes it four of a kind.",
      "a strong start; a wild on the board turns it into four.",
    ])}`;
  }
  if (pairRank) {
    return `A pair of ${rankPlural(pairRank)} and no wild — ${pick(rng, [
      "you'll want the board to help, since wilds make three of a kind easy for everyone else.",
      "playable, but it needs to improve in a game where three of a kind is routine.",
      "it needs help from the board; wilds make three of a kind common.",
    ])}`;
  }
  const suited = Math.max(...suitCounts(hole)) === 3;
  const span = nat[0] - nat[2];
  const shape = suited && span <= 4 ? "suited and connected" : suited ? "all one suit" : span <= 4 ? "connected" : "";
  if (shape) {
    return `No wild, ${cap(rankName(nat[0]))} high, ${shape} — ${pick(rng, [
      "it plays for straights and flushes, and any wild on the board helps.",
      "drawing hands like this improve a lot when a wild lands.",
      "a drawing hand; a wild on the board goes a long way.",
    ])}`;
  }
  return `No wild and no pair, ${rankName(nat[0])} high — ${pick(rng, [
    "one of the weakest starts in a wild game.",
    "a long shot that needs a lot of help from the board.",
    "weak; hands like this win less than their fair share at any table size.",
  ])}`;
}

/** "an ace", "a king". @param {number} r */
function aOrAnRank(r) {
  return `${aOrAn(rankName(r))} ${rankName(r)}`;
}
