// @ts-check
// Deterministic prose engine: a seeded RNG and a pool-pick, so the explainer can
// vary its surface wording without an LLM and without losing reproducibility.
// Pure and DOM-free. Surfaces own their fragment pools; this is just the
// per-situation RNG (rngFor) and the deterministic chooser (pick).
//
// Variety comes from a per-session seed XOR'd with a per-situation key: the same
// (session, cards) always renders the same prose — so tests pin it with a fixed
// seed — while different cards, or a new session (page load), vary it.

import { aOrAn } from "./explain/core.js";

/**
 * Mulberry32 — a tiny, fast, well-distributed seeded PRNG. Returns a function
 * that yields floats in [0, 1). Deterministic: same seed → same sequence.
 * @param {number} seed  32-bit
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a string hash → 32-bit unsigned. Used to fold a situation key into a seed.
 * @param {string} str
 * @returns {number}
 */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Stable per page load: a hand renders consistently within a session, but a new
// session reshuffles every surface form. Tests pin it via setSessionSeed.
let sessionSeed = (Math.random() * 0x100000000) >>> 0;

/** @param {number} n  the session seed (tests use a fixed value for reproducibility) */
export function setSessionSeed(n) { sessionSeed = n >>> 0; }
/** @returns {number} */
export function getSessionSeed() { return sessionSeed; }

/**
 * A stable, order-independent key for a set of cards, so the same cards always
 * seed the same way. Private — callers pass card arrays straight to rngFor.
 * @param {{rank:number, suit:number}[]} cards
 * @returns {string}
 */
function cardsKey(cards) {
  return cards.map(c => c.rank * 4 + c.suit).sort((a, b) => a - b).join(".");
}

/**
 * A PRNG for one situation, derived from the situation's key parts folded with
 * the session seed: the same spot in the same session is stable, different spots
 * (or sessions) diverge. Card arrays are serialized via cardsKey, scalars
 * stringified, then joined with "|" — so a call reads as its parts rather than a
 * hand-built template literal:
 *
 *   rngFor("holdem", "made", user, board)   // not `holdem|made|${cardsKey(user)}|...`
 *
 * @param {...(string|number|{rank:number,suit:number}[])} parts
 * @returns {() => number}
 */
export function rngFor(...parts) {
  const key = parts.map(p => Array.isArray(p) ? cardsKey(p) : String(p)).join("|");
  return mulberry32(hash(key) ^ sessionSeed);
}

/**
 * Pick one element of a non-empty pool, deterministically from `rng`. An empty
 * pool is a programming error (a fragment table built wrong), so fail loudly
 * rather than leak `undefined` into user-facing prose.
 * @template T
 * @param {() => number} rng
 * @param {T[]} pool
 * @returns {T}
 */
export function pick(rng, pool) {
  if (!pool.length) throw new Error("pick: empty pool");
  return pool[(rng() * pool.length) | 0];
}

// Words whose spelling and sound disagree, so the bare vowel rule gets them
// wrong. "one"/"once" look vowel-ish but sound like "w"; "hour"/"honest" start
// with a silent "h". Small list — enough for the card vocabulary.
const SOUNDS_CONSONANT = /^(one|once)/i;
const SOUNDS_VOWEL = /^(hour|honest|honou?r|heir)/i;

/**
 * a/an for `word` by sound, with the few spelling/sound exceptions. The
 * faithfulness suite uses this to check article agreement across every seed.
 * @param {string} word
 */
export function articleFor(word) {
  if (SOUNDS_CONSONANT.test(word)) return "a";
  if (SOUNDS_VOWEL.test(word)) return "an";
  return aOrAn(word);
}
