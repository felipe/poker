// @ts-check
// Pure DOM helpers — given target elements and data, draw the view.

import { SUITS, SUIT_GLYPH, SUIT_COLOR, rankToStr, CATEGORY_NAMES } from "./evaluator.js";
import { VARIANTS, rowLayout } from "./variants.js";

/** @typedef {import("./evaluator.js").Card} Card */

/**
 * Render an array of cards (or `placeholderCount` outlines if `cards` is empty)
 * into `target`. Cards are grouped into rows by `rowLayout`.
 *
 * @param {HTMLElement} target
 * @param {Card[]} cards
 * @param {number} placeholderCount
 */
export function renderCardsInto(target, cards, placeholderCount) {
  target.innerHTML = "";
  const empty = cards.length === 0;
  const count = empty ? placeholderCount : cards.length;
  if (count === 0) return;
  const layout = rowLayout(count);
  let idx = 0;
  for (const rowSize of layout) {
    const row = document.createElement("div");
    row.className = "card-row";
    for (let i = 0; i < rowSize; i++) {
      if (empty) {
        const ph = document.createElement("div");
        ph.className = "card placeholder";
        row.appendChild(ph);
      } else {
        const c = cards[idx++];
        const div = document.createElement("div");
        div.className = "card " + SUIT_COLOR[SUITS[c.suit]];
        const r = rankToStr(c.rank);
        const s = SUIT_GLYPH[SUITS[c.suit]];
        div.innerHTML = `<div class="top">${r}${s}</div><div class="mid">${s}</div><div class="bot">${r}${s}</div>`;
        row.appendChild(div);
      }
    }
    target.appendChild(row);
  }
}

import { explainTrajectory } from "./explain.js";

/**
 * Plain-prose read of the whole hand's evolution — one paragraph per street,
 * calling out where the hand grew, bricked, or got watered down, and what
 * threats appeared along the way. Built from the cards alone; the percentage
 * panel above already shows the odds.
 *
 * @param {HTMLElement} target
 * @param {Object} params
 * @param {Array<{label: string, user: Card[], board: Card[]}>} params.streetHistory
 * @param {number} params.numPlayers
 * @param {string} params.variant
 */
export function renderExplanation(target, params) {
  const paragraphs = explainTrajectory(params);
  const escape = /** @param {string} s */ s => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  target.innerHTML = paragraphs.map(p => `<p>${escape(p)}</p>`).join("");
}

/**
 * Render the "Hands you'll likely make" / "Your hand" bar chart.
 *
 * @param {HTMLElement} target
 * @param {number[]} distribution  length 9, indexed by category 0..8
 * @param {string} variant
 * @param {Card[]} userAtSim
 * @param {Card[]} boardAtSim
 */
export function renderBreakdown(target, distribution, variant, userAtSim, boardAtSim) {
  const v = VARIANTS[variant];
  // Locked = the user's final hand is fully known at sim time, so the
  // distribution collapses to a single category (their actual hand).
  const locked = userAtSim.length >= v.hole && boardAtSim.length >= v.board;
  const title = locked ? "Your hand" : "Hands you'll likely make";
  const ordered = distribution
    .map((p, i) => ({ p, i }))
    .filter(x => x.p >= 0.005)
    .sort((a, b) => b.p - a.p);
  const rows = ordered.map(({ p, i }) => {
    const pct = (p * 100).toFixed(p >= 0.1 ? 0 : 1) + "%";
    const w = Math.max(p * 100, 2);
    return `<div class="bar-row">
      <span class="bar-name">${CATEGORY_NAMES[i]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${w}%"></span></span>
      <span class="bar-pct">${pct}</span>
    </div>`;
  });
  target.innerHTML = `<div class="breakdown-title">${title}</div>${rows.join("")}`;
}

/**
 * @typedef {Object} TrajectoryPoint
 * @property {string} label
 * @property {number} winRate
 */

/**
 * Equity-by-street SVG line chart. A single point isn't a trajectory.
 *
 * @param {HTMLElement} target
 * @param {TrajectoryPoint[]} trajectory
 * @param {number} threshold  fair-share line (1 / numPlayers)
 */
export function renderTrajectory(target, trajectory, threshold) {
  if (trajectory.length < 2) {
    target.innerHTML = "";
    return;
  }

  const W = 400, H = 180;
  const padL = 40, padR = 16, padT = 22, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  /** @param {number} v */
  const y = v => padT + innerH * (1 - v);
  /** @param {number} i */
  const x = i => padL + i * innerW / (trajectory.length - 1);

  const parts = [`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`];

  for (let v = 0; v <= 1.0001; v += 0.25) {
    const yv = y(v);
    parts.push(`<line class="grid" x1="${padL}" x2="${W - padR}" y1="${yv}" y2="${yv}"/>`);
    parts.push(`<text class="grid-label" x="${padL - 6}" y="${yv + 4}">${Math.round(v * 100)}%</text>`);
  }

  const tY = y(threshold);
  parts.push(`<line class="threshold" x1="${padL}" x2="${W - padR}" y1="${tY}" y2="${tY}"/>`);
  parts.push(`<text class="threshold-label" x="${W - padR}" y="${tY - 4}">fair share</text>`);

  const pathD = trajectory.map((t, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(t.winRate)}`).join(" ");
  parts.push(`<path class="line" d="${pathD}"/>`);

  trajectory.forEach((t, i) => {
    const px = x(i), py = y(t.winRate);
    parts.push(`<circle class="point" cx="${px}" cy="${py}" r="4"/>`);
    parts.push(`<text class="point-label" x="${px}" y="${py - 8}">${(t.winRate * 100).toFixed(0)}%</text>`);
    parts.push(`<text class="street-label" x="${px}" y="${H - 10}">${t.label}</text>`);
  });

  parts.push(`</svg>`);
  target.innerHTML = `<div class="trajectory-title">Equity by street</div>${parts.join("")}`;
}
