// Brute-force reference for wild-card hands. Deliberately written without
// js/evaluator.js so it can catch that evaluator's mistakes: it tries every
// 5-card subset and every rank and suit each wild could stand for, scores the
// result with a small sort-based 5-card scorer, and keeps the best.
//
// Slow (13^k × 4 substitutions per subset with k wilds), so the unit tests
// sample it and scripts/verify-wild.js runs it over every 5-card hand.

/** @typedef {{rank: number, suit: number}} Card */

/** Same packing as js/evaluator.js, so scores compare directly. @param {number} cat @param {number[]} ks */
function pack(cat, ks) {
  let n = cat;
  for (let i = 0; i < 5; i++) n = n * 100 + (ks[i] || 0);
  return n;
}

/**
 * Score exactly five concrete cards. Duplicate cards are allowed (a wild can
 * copy a card you hold), but a flush needs five different cards of one suit.
 * @param {Card[]} five
 */
export function scoreFive(five) {
  const ranks = five.map(c => c.rank).sort((a, b) => b - a);
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  // Groups ordered by size, then rank: [[rank, size], ...]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const distinct = groups.length === 5;
  const flush = distinct && five.every(c => c.suit === five[0].suit);
  let straightTop = 0;
  if (distinct) {
    if (ranks[0] - ranks[4] === 4) straightTop = ranks[0];
    else if (ranks.join() === "14,5,4,3,2") straightTop = 5;
  }
  const order = groups.map(g => g[0]);
  if (groups[0][1] === 5) return pack(9, [order[0]]);
  if (flush && straightTop) return pack(8, [straightTop]);
  if (groups[0][1] === 4) return pack(7, order);
  if (groups[0][1] === 3 && groups[1][1] === 2) return pack(6, order);
  if (flush) return pack(5, ranks);
  if (straightTop) return pack(4, [straightTop]);
  if (groups[0][1] === 3) return pack(3, order);
  if (groups[0][1] === 2 && groups[1][1] === 2) return pack(2, order);
  if (groups[0][1] === 2) return pack(1, order);
  return pack(0, ranks);
}

/**
 * Best score of `cards` (5 or more) with every card of `wildRank` wild.
 *
 * Giving all the wilds in a subset the same suit loses nothing: suits only
 * matter for flushes, and a flush needs all five cards in one suit anyway.
 *
 * @param {Card[]} cards
 * @param {number} wildRank
 */
export function oracleWild(cards, wildRank) {
  let best = 0;
  const n = cards.length;
  const idx = [0, 1, 2, 3, 4];
  for (;;) {
    const subset = idx.map(i => cards[i]);
    const naturals = subset.filter(c => c.rank !== wildRank);
    const k = 5 - naturals.length;
    const combos = 13 ** k;
    for (let suit = 0; suit < 4; suit++) {
      for (let m = 0; m < combos; m++) {
        const five = naturals.slice();
        let x = m;
        for (let j = 0; j < k; j++) { five.push({ rank: 2 + (x % 13), suit }); x = Math.floor(x / 13); }
        const s = scoreFive(five);
        if (s > best) best = s;
      }
      if (k === 0) break; // no wilds: suit loop is pointless
    }
    // next 5-combination of n
    let i = 4;
    while (i >= 0 && idx[i] === n - 5 + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
  }
  return best;
}
