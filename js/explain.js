// @ts-check
// Plain-prose reading of a poker hand: what you have, what threats are out
// there, and how player count changes the picture. Pure functions, fed the
// same cards the simulator sees. No randomness, no LLM — every sentence
// here is a deterministic function of the cards.
//
// This module is the public facade + cross-variant orchestration. The actual
// per-variant narrative lives in ./explain/{holdem,omaha,draw}.js, with shared
// primitives in ./explain/core.js. Adding a variant means adding a module and
// one entry in the SNAPSHOTS table below — not growing this file.

import { categoryFor, decap } from "./explain/core.js";
import { rngFor, pick } from "./prose.js";
import { holdemSnapshot, holdemTrajectoryParagraphs, recapHand } from "./explain/holdem.js";
import { omahaSnapshot } from "./explain/omaha.js";
import { noBoardRead } from "./explain/draw.js";

/** @typedef {import("./evaluator.js").Card} Card */

export { recapHand };

/**
 * Per-variant single-snapshot prose. Each entry takes (user, board) and returns
 * one paragraph. Variants with no entry (5-Card Draw, 7-Stud) fall back to the
 * board-less read.
 * @type {Record<string, (user: Card[], board: Card[]) => string>}
 */
const SNAPSHOTS = {
  holdem: holdemSnapshot,
  omaha: omahaSnapshot,
};

/** @param {Card[]} user @param {Card[]} board @param {string} variant */
function snapshotParagraph(user, board, variant) {
  return (SNAPSHOTS[variant] || noBoardRead)(user, board);
}

/**
 * Single-snapshot prose for one street's worth of cards, plus the player-count
 * tip. Returns a one-paragraph read of where the hand sits right now.
 *
 * @param {Object} ctx
 * @param {Card[]} ctx.userCards
 * @param {Card[]} ctx.boardCards
 * @param {number} ctx.numPlayers
 * @param {string} ctx.variant
 * @returns {string}
 */
export function explain(ctx) {
  const { userCards, boardCards, numPlayers, variant } = ctx;
  const para = snapshotParagraph(userCards, boardCards, variant);
  return [para, playerCountLine(numPlayers)].filter(Boolean).join(" ");
}

/**
 * Trajectory prose. Walks the player's street-by-street snapshots and emits a
 * paragraph per street. For Hold'em this explicitly calls out improvements,
 * bricks, and waterings since the previous street; the boardless and Omaha
 * variants get a labelled fresh snapshot per street. The last paragraph is the
 * player-count adjustment so the reader ends with table-size context.
 *
 * @param {Object} ctx
 * @param {Array<{label: string, user: Card[], board: Card[]}>} ctx.trajectory
 * @param {number} ctx.numPlayers
 * @param {string} ctx.variant
 * @returns {string[]}  one entry per paragraph; join with blank lines to render
 */
export function explainTrajectory(ctx) {
  const { trajectory, numPlayers, variant } = ctx;
  /** @type {string[]} */
  const paragraphs = [];

  if (!trajectory || trajectory.length === 0) {
    paragraphs.push(playerCountLine(numPlayers));
    return paragraphs;
  }

  if (variant === "holdem") {
    paragraphs.push(...holdemTrajectoryParagraphs(trajectory));
  } else {
    // 5-Card Draw, 7-Stud, and Omaha — each street is a fresh snapshot. (For
    // Omaha we don't yet do Hold'em's between-street "improved / bricked /
    // picked up a draw" diffing; that's a follow-up.) Label each one so the
    // progression is clear.
    for (const s of trajectory) {
      const para = snapshotParagraph(s.user, s.board, variant);
      paragraphs.push(trajectory.length > 1 ? `${s.label}: ${decap(para)}` : para);
    }
  }

  paragraphs.push(playerCountLine(numPlayers));
  return paragraphs;
}

/**
 * One-street read without the player-count tip. For the mid-hand status line,
 * where the player-count context has already been internalized and repeating
 * it after every street would be noise.
 *
 * @param {Object} ctx
 * @param {Card[]} ctx.userCards
 * @param {Card[]} ctx.boardCards
 * @param {string} ctx.variant
 * @returns {string}
 */
export function streetSummary(ctx) {
  return snapshotParagraph(ctx.userCards, ctx.boardCards, ctx.variant);
}

/**
 * When the user is favored to win (≥ 50%), surface the concrete hands that
 * could still beat them with their respective likelihoods. Below 50% this
 * returns null — the prose already covers "lots of things beat you" and a
 * laundry list would be noise.
 *
 * Returns a structured payload — callers (the UI in ui.js, the test suite)
 * decide how to present it. The simulator's beatenBy distribution is bucketed
 * by the *strongest* beating opponent per iteration, so with N > 1 opponents
 * each item's percentage is the chance your loss comes from a top hand in
 * that category, not "any opponent has X". The bar-chart presentation reads
 * naturally either way.
 *
 * @param {Object} ctx
 * @param {string} ctx.variant
 * @param {Array<{label: string, user: Card[], board: Card[], winRate: number, beatenBy: number[]}>} ctx.trajectory
 * @returns {{items: Array<{noun: string, p: number, pct: number}>}|null}
 */
export function betterHandsCallout(ctx) {
  const { trajectory, variant } = ctx;
  if (!trajectory || trajectory.length === 0) return null;
  const last = trajectory[trajectory.length - 1];
  if (!Array.isArray(last.beatenBy)) return null;
  if (!Number.isFinite(last.winRate) || last.winRate < 0.5) return null;

  // Need a complete 5-card hand to label the user's own category, otherwise
  // we can't say "a higher pair" vs "a pair" relative to what they hold. Use
  // the variant-aware category so Omaha doesn't claim a flush the rule forbids.
  const cards = last.user.concat(last.board);
  if (cards.length < 5) return null;
  const userCategory = categoryFor(variant, last.user, last.board);

  const items = /** @type {Array<{noun: string, p: number, pct: number}>} */ ([]);
  for (let c = 0; c < 9; c++) {
    const p = last.beatenBy[c];
    if (!Number.isFinite(p) || p < 0.01) continue;
    items.push({ noun: threatNoun(c, userCategory), p, pct: Math.round(p * 100) });
  }
  if (items.length === 0) return null;
  // Sort by raw probability so two threats that round to the same percentage
  // still order correctly (e.g. 1.4% vs 1.5%).
  items.sort((a, b) => b.p - a.p);
  return { items };
}

/**
 * Returns the noun-phrase to use for an opponent's beating category, knowing
 * what category the user themselves landed in. When the categories match, the
 * opponent must have a HIGHER hand of that category (higher kickers, higher
 * pair, etc.) — phrased that way so "a pair (8%)" doesn't read as redundant
 * when the user also has a pair.
 *
 * @param {number} oppCat  0..8
 * @param {number} userCat 0..8
 */
function threatNoun(oppCat, userCat) {
  const same = oppCat === userCat;
  switch (oppCat) {
    case 0: return same ? "a higher high card" : "a high-card hand";
    case 1: return same ? "a higher pair" : "a pair";
    case 2: return same ? "a higher two pair" : "two pair";
    case 3: return same ? "a higher three of a kind" : "three of a kind";
    case 4: return same ? "a higher straight" : "a straight";
    case 5: return same ? "a higher flush" : "a flush";
    case 6: return same ? "a higher full house" : "a full house";
    case 7: return same ? "a higher four of a kind" : "four of a kind";
    case 8: return same ? "a higher straight flush" : "a straight flush";
  }
  return "";
}

/** @param {number} n */
function playerCountLine(n) {
  // Keyed by table size, so the table-size note is stable within a session but
  // varies across sessions. The heads-up branch keeps "Heads-up, weaker hands
  // gain value" in every variant — the explainer cross-check anchors on it.
  const rng = rngFor("players", n);
  if (n === 2) return pick(rng, [
    "Heads-up, weaker hands gain value — fewer ways for an opponent to have you beat.",
    "Heads-up, weaker hands gain value; there's only one opponent who can have you beat.",
    "Heads-up, weaker hands gain value, since a single opponent has fewer ways to be ahead.",
  ]);
  if (n <= 4) return pick(rng, [
    `${n}-handed gives marginal hands more room to play.`,
    `Short-handed at ${n}, marginal hands gain some room to play.`,
    `With only ${n} at the table, marginal hands play a little better.`,
  ]);
  if (n <= 6) return pick(rng, [
    `With ${n} players, somebody usually has something — be careful with marginal hands.`,
    `At ${n} players, someone usually connects; tread carefully with marginal hands.`,
    `${n}-handed, expect somebody to have a piece — marginal hands want caution.`,
  ]);
  return pick(rng, [
    `At a full ${n}-handed table, expect strong hands to be out — fold marginal stuff without solid odds.`,
    `A full ${n}-handed table means strong hands are likely out; fold marginal holdings without odds.`,
    `With ${n} at the table, premium hands are usually represented — let marginal stuff go without solid odds.`,
  ]);
}
