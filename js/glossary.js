// @ts-check
// A small dictionary of the poker vocabulary the explainer uses, plus the pure
// matcher that finds which terms appear in a piece of prose. DOM-free: the UI
// layer does the wrapping, the popover, and the filtered list. Definitions are
// short, plain-English, and English-only by design.

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} def       one- or two-sentence definition
 * @property {string[]} [games] variants this term is relevant to (VARIANTS keys),
 *                              for the list view's game filter. Omitted = universal
 *                              (shown for every game). The inline glosser ignores
 *                              this — prose is already variant-appropriate.
 */

/**
 * Canonical lowercase term → entry. Phrases are matched as whole phrases (and
 * win over any shorter term they overlap), so "open-ended straight draw" is
 * glossed as one unit rather than just "outs".
 * @type {Record<string, GlossaryEntry>}
 */
export const GLOSSARY = {
  "outs": { def: "Cards still unseen that would complete your draw into a made hand. More outs, better odds of getting there." },
  "equity": { def: "Your share of the pot if the hand were dealt to showdown many times — effectively your chance of winning it." },
  "fair share": { def: "The break-even win rate at this table: 1 ÷ number of players. Clear it and the hand is worth playing." },
  "flush draw": { def: "Four cards toward a flush, needing one more of the suit to complete it (9 outs)." },
  "gutshot": { def: "An inside straight draw — only one specific rank fills it, so just 4 outs." },
  "open-ended straight draw": { def: "Four cards in a row that complete with a card on either end — 8 outs." },
  "kicker": { def: "The highest side card that isn't part of your pair or made hand. It breaks ties between otherwise-equal hands." },
  "the nuts": { def: "The best possible hand on a given board — it cannot be beaten." },
  "nut flush": { def: "The highest possible flush (ace-high), which beats every other flush." },
  // Community-card concepts (need a board) — Hold'em + Omaha only.
  "overpair": { def: "A pocket pair higher than every card on the board — usually a strong made hand.", games: ["holdem", "omaha"] },
  "top pair": { def: "A pair made with the highest card on the board: a solid one-pair hand.", games: ["holdem", "omaha"] },
  "middle pair": { def: "A pair made with a middle board card; the higher board cards can outrank it.", games: ["holdem", "omaha"] },
  "set": { def: "Three of a kind made from a pocket pair plus one matching board card — well disguised and very strong.", games: ["holdem", "omaha"] },
  "trips": { def: "Three of a kind made from one hole card plus a pair already on the board.", games: ["holdem", "omaha"] },
  // Two-hole-card starting hand.
  "suited connectors": { def: "Two cards of the same suit and adjacent rank (like 8♥7♥) — they make straights and flushes.", games: ["holdem"] },
  // Omaha-specific.
  "rundown": { def: "An Omaha starting hand of four connected ranks (like 9-8-7-6) that makes a lot of straights.", games: ["omaha"] },
  "double-suited": { def: "An Omaha hand with two separate pairs of suits, giving two different flush possibilities.", games: ["omaha"] },
  "single-suited": { def: "An Omaha hand with exactly two cards of one suit (one flush possibility).", games: ["omaha"] },
  "wrap": { def: "An Omaha straight draw that uses all four hole cards, often with far more outs than a Hold'em draw.", games: ["omaha"] },
};

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(REGEX_SPECIAL, "\\$&");
}

/**
 * @typedef {Object} GlossaryMatch
 * @property {string} term   the canonical key
 * @property {number} start  index into `text`
 * @property {number} end    index into `text` (exclusive)
 * @property {string} def    the definition
 */

/**
 * Find the first occurrence of each known term in `text`, case-insensitively
 * and on word boundaries (so "outshone" never matches "outs"). Overlapping
 * matches are resolved in favor of the longer term, so a phrase wins over a
 * word inside it. Returns non-overlapping matches sorted by position — at most
 * one per term, i.e. first-occurrence-per-call.
 *
 * @param {string} text
 * @returns {GlossaryMatch[]}
 */
export function findGlossaryTerms(text) {
  /** @type {GlossaryMatch[]} */
  const candidates = [];
  for (const [term, entry] of Object.entries(GLOSSARY)) {
    const m = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").exec(text);
    if (m) candidates.push({ term, start: m.index, end: m.index + m[0].length, def: entry.def });
  }
  // Longest first so phrases claim their span before the words inside them.
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  /** @type {GlossaryMatch[]} */
  const kept = [];
  for (const c of candidates) {
    if (kept.some(k => c.start < k.end && k.start < c.end)) continue; // overlaps something already kept
    kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}
