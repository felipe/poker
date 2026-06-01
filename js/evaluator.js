// @ts-check
// Card model, deck utilities, and the 5–7 card hand evaluator.

/**
 * @typedef {Object} Card
 * @property {number} rank  2..14 (11=J, 12=Q, 13=K, 14=A)
 * @property {number} suit  0..3 indexing SUITS
 */

export const SUITS = /** @type {const} */ (["s", "h", "d", "c"]);
export const SUIT_GLYPH = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_COLOR = { s: "black", c: "black", h: "red", d: "red" };
export const RANK_GLYPH = { 11: "J", 12: "Q", 13: "K", 14: "A" };

/** @param {number} r */
export const rankToStr = r => RANK_GLYPH[/** @type {keyof typeof RANK_GLYPH} */ (r)] || String(r);

/** @returns {Card[]} */
export function makeDeck() {
  /** @type {Card[]} */
  const d = [];
  for (let r = 2; r <= 14; r++)
    for (let s = 0; s < 4; s++)
      d.push({ rank: r, suit: s });
  return d;
}

/**
 * Fisher–Yates in place.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export const CATEGORY_NAMES = [
  "High card", "One pair", "Two pair", "Three of a kind", "Straight",
  "Flush", "Full house", "Four of a kind", "Straight flush",
];

// Score = category * 100^5 + 5 kickers packed (2 digits each, ranks 2..14).
// Used to divide a packed score back into its category index.
export const CATEGORY_DIVISOR = 100 ** 5;

/**
 * Returns a packed integer score for the best 5-card hand inside `cards`.
 * Higher beats lower. Accepts 5..7 cards.
 * @param {Card[]} cards
 * @returns {number}
 */
export function evaluate(cards) {
  const rankCount = new Array(15).fill(0);
  const suitCount = new Array(4).fill(0);
  /** @type {number[][]} */
  const bySuit = [[], [], [], []];
  for (const c of cards) {
    rankCount[c.rank]++;
    suitCount[c.suit]++;
    bySuit[c.suit].push(c.rank);
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;

  /**
   * Highest top-rank of 5 consecutive ranks present in `rankSet`.
   * Ace also plays low for the wheel (A-2-3-4-5).
   * @param {boolean[]} rankSet
   */
  function highestStraight(rankSet) {
    for (let top = 14; top >= 5; top--) {
      if (rankSet[top] && rankSet[top - 1] && rankSet[top - 2] && rankSet[top - 3] && rankSet[top - 4]) {
        return top;
      }
    }
    if (rankSet[14] && rankSet[2] && rankSet[3] && rankSet[4] && rankSet[5]) return 5;
    return 0;
  }

  const presentSet = new Array(15).fill(false);
  for (let r = 2; r <= 14; r++) presentSet[r] = rankCount[r] > 0;
  const straightTop = highestStraight(presentSet);

  let sfTop = 0;
  if (flushSuit >= 0) {
    const flushSet = new Array(15).fill(false);
    for (const r of bySuit[flushSuit]) flushSet[r] = true;
    sfTop = highestStraight(flushSet);
  }

  /** @type {number[]} */ const fours = [];
  /** @type {number[]} */ const threes = [];
  /** @type {number[]} */ const pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (rankCount[r] === 4) fours.push(r);
    else if (rankCount[r] === 3) threes.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
  }

  /**
   * @param {number} category 0..8
   * @param {number[]} kickers up to 5 ranks (2..14)
   */
  function pack(category, kickers) {
    const k = kickers.slice(0, 5);
    while (k.length < 5) k.push(0);
    let n = category;
    for (const v of k) n = n * 100 + v;
    return n;
  }

  if (sfTop) return pack(8, [sfTop]);
  if (fours.length) {
    const four = fours[0];
    let kicker = 0;
    for (let r = 14; r >= 2; r--) if (r !== four && rankCount[r] > 0) { kicker = r; break; }
    return pack(7, [four, kicker]);
  }
  if (threes.length && (threes.length >= 2 || pairs.length)) {
    const trip = threes[0];
    const pairRank = threes[1] !== undefined ? threes[1] : pairs[0];
    return pack(6, [trip, pairRank]);
  }
  if (flushSuit >= 0) {
    const flushRanks = bySuit[flushSuit].slice().sort((a, b) => b - a).slice(0, 5);
    return pack(5, flushRanks);
  }
  if (straightTop) return pack(4, [straightTop]);
  if (threes.length) {
    const trip = threes[0];
    /** @type {number[]} */ const kickers = [];
    for (let r = 14; r >= 2 && kickers.length < 2; r--)
      if (r !== trip && rankCount[r] > 0) kickers.push(r);
    return pack(3, [trip, ...kickers]);
  }
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    let kicker = 0;
    for (let r = 14; r >= 2; r--) if (r !== p1 && r !== p2 && rankCount[r] > 0) { kicker = r; break; }
    return pack(2, [p1, p2, kicker]);
  }
  if (pairs.length === 1) {
    const p = pairs[0];
    /** @type {number[]} */ const kickers = [];
    for (let r = 14; r >= 2 && kickers.length < 3; r--)
      if (r !== p && rankCount[r] > 0) kickers.push(r);
    return pack(1, [p, ...kickers]);
  }
  /** @type {number[]} */ const highs = [];
  for (let r = 14; r >= 2 && highs.length < 5; r--)
    if (rankCount[r] > 0) highs.push(r);
  return pack(0, highs);
}

/**
 * Omaha showdown rule: the player MUST use exactly 2 of their 4 hole cards
 * combined with exactly 3 of the 5 board cards. Unlike Hold'em, you can't
 * "play the board" or use 3 from your hand even if it would make a better
 * hand. The classic trap: a single ace of hearts in hole + 4 hearts on the
 * board is NOT a flush in Omaha — you need 2 hearts in your hand.
 *
 * Enumerates C(4,2)=6 hole pairs × C(5,3)=10 board triples = 60 combos and
 * returns the max score. Same packed-integer format as `evaluate`.
 *
 * Accepts partial boards (3 or 4 cards) for street-by-street snapshots, in
 * which case it uses C(boardLen,3) board triples instead. Returns 0 if the
 * board has fewer than 3 cards (pre-flop) — there's no 5-card hand to score.
 *
 * @param {Card[]} hole   exactly 4 cards
 * @param {Card[]} board  3, 4, or 5 cards
 * @returns {number}
 */
export function evaluateOmaha(hole, board) {
  if (hole.length !== 4) throw new RangeError(`evaluateOmaha: hole must be 4 cards, got ${hole.length}`);
  if (board.length < 3) return 0;
  if (board.length > 5) throw new RangeError(`evaluateOmaha: board must be ≤ 5 cards, got ${board.length}`);
  let best = 0;
  for (let h1 = 0; h1 < 3; h1++) {
    for (let h2 = h1 + 1; h2 < 4; h2++) {
      for (let b1 = 0; b1 < board.length - 2; b1++) {
        for (let b2 = b1 + 1; b2 < board.length - 1; b2++) {
          for (let b3 = b2 + 1; b3 < board.length; b3++) {
            const score = evaluate([hole[h1], hole[h2], board[b1], board[b2], board[b3]]);
            if (score > best) best = score;
          }
        }
      }
    }
  }
  return best;
}
