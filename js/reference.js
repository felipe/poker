// @ts-check
// Reference overlays opened from the toolbar: the browsable glossary (with a
// per-game filter) and the hand-rankings ladder. Both render into a target
// element using the same card components and escaping as the rest of the view.

import { cardEl, placeholderEl, escapeHtml } from "./ui.js";
import { GLOSSARY } from "./glossary.js";
import { VARIANTS } from "./variants.js";

/** @typedef {import("./evaluator.js").Card} Card */

/**
 * Render the full glossary as a definition list into `target`, with a game
 * filter. A term shows when the filter is "all", when it's universal (no
 * `games`), or when its `games` include the selected variant. The filter
 * defaults to `currentVariant` so a player sees just their game's vocabulary
 * (Omaha terms don't clutter a Hold'em view).
 *
 * @param {HTMLElement} target
 * @param {string} [currentVariant]  default filter; falls back to "all"
 */
export function renderGlossaryList(target, currentVariant) {
  const options = [`<option value="all">All games</option>`]
    .concat(Object.entries(VARIANTS).map(([k, v]) => `<option value="${k}">${escapeHtml(v.name)}</option>`))
    .join("");
  const rows = Object.entries(GLOSSARY)
    .map(([term, entry]) =>
      `<div class="ref-row" data-games="${entry.games ? entry.games.join(" ") : "all"}"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(entry.def)}</dd></div>`)
    .join("");
  target.innerHTML =
    `<div class="ref-title">Glossary</div>` +
    `<label class="ref-filter"><span>Game</span><select class="gloss-filter">${options}</select></label>` +
    `<dl class="ref-list">${rows}</dl>`;

  const select = /** @type {HTMLSelectElement} */ (target.querySelector(".gloss-filter"));
  const apply = (/** @type {string} */ v) => {
    for (const row of target.querySelectorAll(".ref-row")) {
      const games = row.getAttribute("data-games") || "all";
      const show = v === "all" || games === "all" || games.split(" ").includes(v);
      row.classList.toggle("hidden", !show);
    }
  };
  // Default to the current game; fall back to "all" if it's not a listed option.
  select.value = currentVariant && [...select.options].some(o => o.value === currentVariant) ? currentVariant : "all";
  select.addEventListener("change", () => apply(select.value));
  apply(select.value);
}

const RANK_FROM = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
const SUIT_FROM = { s: 0, h: 1, d: 2, c: 3 };

/** Parse a short card string like "As" / "Td" / "9c" into a Card. @param {string} str */
function parseCard(str) {
  const r = str.slice(0, -1);
  const s = str.slice(-1);
  return { rank: RANK_FROM[/** @type {keyof typeof RANK_FROM} */ (r)] || Number(r), suit: SUIT_FROM[/** @type {keyof typeof SUIT_FROM} */ (s)] };
}

// The standard nine categories, strongest first (straight flush capped by the
// royal). `cards` lists only the cards that DEFINE the category; the remaining
// slots up to five render as "any card" placeholders, so a learner sees exactly
// what makes the hand (four aces + one any card, not four aces + a specific
// kicker that looks like it matters).
const HAND_CARDS = 5;
const HAND_RANKINGS = [
  { name: "Straight flush", note: "Five in a row, all one suit. The top end is the royal flush, A-K-Q-J-10.", cards: ["As", "Ks", "Qs", "Js", "Ts"] },
  { name: "Four of a kind", note: "All four cards of one rank.", cards: ["Ah", "Ad", "As", "Ac"] },
  { name: "Full house", note: "Three of a kind plus a pair.", cards: ["Kh", "Kd", "Ks", "5c", "5h"] },
  { name: "Flush", note: "Five cards of one suit, in any order.", cards: ["Ad", "Jd", "8d", "6d", "3d"] },
  { name: "Straight", note: "Five in a row of mixed suits.", cards: ["9c", "8d", "7s", "6h", "5c"] },
  { name: "Three of a kind", note: "Three cards of one rank.", cards: ["Qs", "Qh", "Qd"] },
  { name: "Two pair", note: "Two different pairs.", cards: ["Js", "Jh", "4s", "4d"] },
  { name: "One pair", note: "Two cards of the same rank.", cards: ["Ts", "Th"] },
  { name: "High card", note: "No pair — your highest card plays.", cards: ["Ad"] },
];

/**
 * Render the hand-rankings ladder (strongest first) into `target`, each row with
 * a name, a one-line description, and a small example hand. The cards that make
 * the hand are real; the rest are "any card" placeholders.
 * @param {HTMLElement} target
 */
export function renderHandRankings(target) {
  target.innerHTML = `<div class="ref-title">Hand rankings — strongest first</div>`;
  for (const r of HAND_RANKINGS) {
    const row = document.createElement("div");
    row.className = "ref-rank";

    const head = document.createElement("div");
    head.className = "ref-rank-head";
    head.innerHTML = `<span class="ref-rank-name">${escapeHtml(r.name)}</span><span class="ref-rank-note">${escapeHtml(r.note)}</span>`;

    const cards = document.createElement("div");
    cards.className = "ref-rank-cards card-row";
    for (const c of r.cards) cards.appendChild(cardEl(parseCard(c)));
    for (let i = r.cards.length; i < HAND_CARDS; i++) {
      const ph = placeholderEl();
      ph.setAttribute("aria-label", "any card");
      cards.appendChild(ph);
    }

    row.appendChild(head);
    row.appendChild(cards);
    target.appendChild(row);
  }
}
