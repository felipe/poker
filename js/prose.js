// @ts-check
// Deterministic prose engine: a seeded RNG plus fragment-grammar combinators, so
// the explainer can vary its surface wording without an LLM and without losing
// reproducibility. Pure and DOM-free.
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
 * A PRNG for one situation: folds the situation key together with the session
 * seed, so the same spot in the same session is stable, and different spots
 * (or sessions) diverge.
 * @param {string} key  e.g. "holdem|made|AsKh|QdJc2s"
 * @returns {() => number}
 */
export function rngFor(key) {
  return mulberry32(hash(key) ^ sessionSeed);
}

/**
 * Pick one element of a non-empty pool, deterministically from `rng`.
 * @template T
 * @param {() => number} rng
 * @param {T[]} pool
 * @returns {T}
 */
export function pick(rng, pool) {
  return pool[(rng() * pool.length) | 0];
}

/**
 * Include `frag` with probability `p`, else "" — the "drop a fragment" lever that
 * varies sentence shape (terse vs. wordy) rather than just vocabulary.
 * @param {() => number} rng
 * @param {number} p     0..1
 * @param {string} frag
 * @returns {string}
 */
export function maybe(rng, p, frag) {
  return rng() < p ? frag : "";
}

// Words whose spelling and sound disagree, so the bare vowel rule gets them
// wrong. "one"/"once" look vowel-ish but sound like "w"; "hour"/"honest" start
// with a silent "h". Small list — enough for the card vocabulary.
const SOUNDS_CONSONANT = /^(one|once)/i;
const SOUNDS_VOWEL = /^(hour|honest|honou?r|heir)/i;

/** a/an for `word` by sound, with the few spelling/sound exceptions. @param {string} word */
export function articleFor(word) {
  if (SOUNDS_CONSONANT.test(word)) return "a";
  if (SOUNDS_VOWEL.test(word)) return "an";
  return aOrAn(word);
}

/**
 * Fix a/an agreement so fragments can write "a"/"an" loosely and still read
 * right (essential where the next word is a variable rank: "a [ace|king]").
 * Preserves the article's capitalization. Uses `articleFor`, which knows the
 * sound exceptions, so it won't "correct" a deliberate "a one-pair hand".
 * @param {string} s
 */
function fixArticles(s) {
  return s.replace(/\b(an?)\s+([A-Za-z]\w*)/gi, (_m, art, word) => {
    let fixed = articleFor(word);
    if (art[0] === art[0].toUpperCase()) fixed = fixed[0].toUpperCase() + fixed.slice(1);
    return `${fixed} ${word}`;
  });
}

/**
 * Assemble fragments into one clean sentence: drop empties, collapse whitespace,
 * fix a/an agreement, capitalize the first letter, tidy space-before-punctuation,
 * and ensure terminal punctuation.
 * @param {string[]} parts
 * @returns {string}
 */
export function assemble(parts) {
  let s = parts.filter(p => p && p.trim()).join(" ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = fixArticles(s);
  s = s.replace(/\s+([,.;:!?])/g, "$1");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?…]$/.test(s)) s += ".";
  return s;
}

/** The three voice registers a session can speak in. @type {const} */
export const VOICES = /** @type {const} */ (["formal", "casual", "terse"]);

/**
 * The session's voice register — one stable choice per session, derived from the
 * session seed so it's deterministic and reproducible under a fixed seed.
 * @returns {"formal"|"casual"|"terse"}
 */
export function voiceFor() {
  return VOICES[((hash("voice") ^ sessionSeed) >>> 0) % VOICES.length];
}
