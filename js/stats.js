// @ts-check
// On-device decision-calibration stats. Pure and DOM-free: the record/derive
// logic takes a plain stats object, and the persistence helpers take an
// injected Storage-like object (localStorage in the app, a stub in tests), so
// nothing here touches the DOM or a global. Strictly on-device — these numbers
// are the source of truth in this repo and are never designed to leave it.

/**
 * @typedef {Object} Stats
 * @property {number} hands          hands that reached a terminal decision
 * @property {number} agreements     terminal decisions that matched the math
 *                                   (a TOSS-UP always counts as agreement)
 * @property {number} foldWhenPlay   folded a hand the math said PLAY (too tight)
 * @property {number} playWhenFold   played to showdown when the math said FOLD
 *                                   (too loose)
 * @property {Record<string, number>} byVariant  hands per variant key
 */

export const STATS_KEY = "stats";

/** @returns {Stats} */
export function emptyStats() {
  return { hands: 0, agreements: 0, foldWhenPlay: 0, playWhenFold: 0, byVariant: {} };
}

/**
 * Fold one terminal decision into the stats, returning a NEW object (pure).
 *
 * @param {Stats} stats
 * @param {Object} decision
 * @param {string} decision.variant
 * @param {"play"|"fold"} decision.choice   what the user did
 * @param {"PLAY"|"FOLD"|"TOSS-UP"} decision.verdict  what the math said
 * @returns {Stats}
 */
export function recordHand(stats, { variant, choice, verdict }) {
  const tossup = verdict === "TOSS-UP";
  const agreed = tossup || (choice === "play" ? verdict === "PLAY" : verdict === "FOLD");
  return {
    hands: stats.hands + 1,
    agreements: stats.agreements + (agreed ? 1 : 0),
    foldWhenPlay: stats.foldWhenPlay + (choice === "fold" && verdict === "PLAY" ? 1 : 0),
    playWhenFold: stats.playWhenFold + (choice === "play" && verdict === "FOLD" ? 1 : 0),
    byVariant: { ...stats.byVariant, [variant]: (stats.byVariant[variant] || 0) + 1 },
  };
}

/**
 * @typedef {Object} StatsSummary
 * @property {number} hands
 * @property {number|null} agreementPct  null when no hands recorded yet
 * @property {"tight"|"loose"|"balanced"|null} lean  null when no hands yet
 * @property {number} foldWhenPlay
 * @property {number} playWhenFold
 * @property {Record<string, number>} byVariant
 */

/**
 * Human-facing rollup: agreement rate and which way the user leans. "tight"
 * means they fold hands the math would play more often than the reverse;
 * "loose" is the opposite; "balanced" when the two cancel out.
 *
 * @param {Stats} stats
 * @returns {StatsSummary}
 */
export function summarize(stats) {
  const { hands, agreements, foldWhenPlay, playWhenFold, byVariant } = stats;
  /** @type {"tight"|"loose"|"balanced"|null} */
  let lean = null;
  if (hands > 0) {
    if (foldWhenPlay > playWhenFold) lean = "tight";
    else if (playWhenFold > foldWhenPlay) lean = "loose";
    else lean = "balanced";
  }
  return {
    hands,
    agreementPct: hands > 0 ? Math.round((agreements / hands) * 100) : null,
    lean,
    foldWhenPlay,
    playWhenFold,
    byVariant,
  };
}

/**
 * Read stats from injected storage, tolerating a missing/corrupt/blocked store
 * and merging onto the empty shape so older payloads stay forward-compatible.
 * @param {Pick<Storage, "getItem">} [storage]
 * @returns {Stats}
 */
export function loadStats(storage) {
  if (!storage) return emptyStats();
  try {
    const raw = storage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    return { ...emptyStats(), ...parsed, byVariant: { ...(parsed && parsed.byVariant) } };
  } catch (_) {
    return emptyStats();
  }
}

/**
 * @param {Pick<Storage, "setItem">|undefined} storage
 * @param {Stats} stats
 */
export function saveStats(storage, stats) {
  if (!storage) return;
  try { storage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
}

/**
 * Convenience for the app path: load → record → save, returning the new stats.
 * @param {(Pick<Storage, "getItem"> & Pick<Storage, "setItem">)|undefined} storage
 * @param {{ variant: string, choice: "play"|"fold", verdict: "PLAY"|"FOLD"|"TOSS-UP" }} decision
 * @returns {Stats}
 */
export function recordAndSave(storage, decision) {
  const next = recordHand(loadStats(storage), decision);
  saveStats(storage, next);
  return next;
}

/**
 * Wipe stats back to empty (the Settings "Reset" action).
 * @param {(Pick<Storage, "setItem">)|undefined} storage
 * @returns {Stats}
 */
export function resetStats(storage) {
  const fresh = emptyStats();
  saveStats(storage, fresh);
  return fresh;
}
