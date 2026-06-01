// @ts-check
// Entry point — DOM refs, state, flow, and event wiring.

import { makeDeck, shuffle } from "./evaluator.js";
import { VARIANTS, maxPlayersForVariant } from "./variants.js";
import { analyzeStreet, analyzeHand } from "./analysis.js";
import { renderCardsInto, renderBreakdown, renderTrajectory, renderExplanation, escapeHtml, setupGlossaryPopover } from "./ui.js";
import { streetSummary } from "./explain.js";
import { recordAndSave, loadStats, resetStats, summarize } from "./stats.js";

/** @typedef {import("./evaluator.js").Card} Card */

// ---------- DOM refs ----------
const cardsEl = /** @type {HTMLElement} */ (document.getElementById("cards"));
const boardEl = /** @type {HTMLElement} */ (document.getElementById("board"));
const dealBtn = /** @type {HTMLButtonElement} */ (document.getElementById("deal"));
const playBtn = /** @type {HTMLButtonElement} */ (document.getElementById("play"));
const foldBtn = /** @type {HTMLButtonElement} */ (document.getElementById("fold"));
const callActions = /** @type {HTMLElement} */ (document.getElementById("callActions"));
const variantSel = /** @type {HTMLSelectElement} */ (document.getElementById("variant"));
const playersSel = /** @type {HTMLSelectElement} */ (document.getElementById("players"));
const revealOnFoldEl = /** @type {HTMLInputElement} */ (document.getElementById("revealOnFold"));
const statusEl = /** @type {HTMLElement} */ (document.getElementById("status"));
const promptEl = /** @type {HTMLElement} */ (document.getElementById("prompt"));
const resultEl = /** @type {HTMLElement} */ (document.getElementById("result"));
const winPctEl = /** @type {HTMLElement} */ (document.getElementById("winPct"));
const thresholdEl = /** @type {HTMLElement} */ (document.getElementById("threshold"));
const thresholdLabelEl = /** @type {HTMLElement} */ (document.getElementById("thresholdLabel"));
const verdictEl = /** @type {HTMLElement} */ (document.getElementById("verdict"));
const feedbackEl = /** @type {HTMLElement} */ (document.getElementById("feedback"));
const breakdownEl = /** @type {HTMLElement} */ (document.getElementById("breakdown"));
const explanationEl = /** @type {HTMLElement} */ (document.getElementById("explanation"));
const trajectoryEl = /** @type {HTMLElement} */ (document.getElementById("trajectory"));
const gameNameEl = /** @type {HTMLElement} */ (document.getElementById("gameName"));
const gameMetaEl = /** @type {HTMLElement} */ (document.getElementById("gameMeta"));
const settingsToggleEl = /** @type {HTMLButtonElement} */ (document.getElementById("settingsToggle"));
const settingsPanelEl = /** @type {HTMLElement} */ (document.getElementById("settingsPanel"));
const themeSel = /** @type {HTMLSelectElement} */ (document.getElementById("theme"));
const webFontsEl = /** @type {HTMLInputElement} */ (document.getElementById("webFonts"));
const statsSummaryEl = /** @type {HTMLElement} */ (document.getElementById("statsSummary"));
const statsResetEl = /** @type {HTMLButtonElement} */ (document.getElementById("statsReset"));

// ---------- hand-in-progress state ----------
/** @type {Card[]} */ let deck = [];
let cursor = 0;
let streetIdx = 0;
/** @type {Card[]} */ let userRevealed = [];
/** @type {Card[]} */ let boardRevealed = [];
let resultsVisible = false;
let handInProgress = false;

/**
 * Snapshots of every street the user actually saw, captured right after the
 * cards are dealt. Powers the equity-by-street chart at the hand's end.
 * @type {Array<{label: string, user: Card[], board: Card[]}>}
 */
let streetHistory = [];

// ---------- variant + street helpers ----------
function currentVariant() { return VARIANTS[variantSel.value]; }
function currentStreet() { return currentVariant().streets[streetIdx]; }
function isFinalStreet() { return streetIdx === currentVariant().streets.length - 1; }

function renderGameHeader() {
  const n = parseInt(playersSel.value, 10);
  gameNameEl.textContent = currentVariant().name;
  gameMetaEl.textContent = `${n} ${n === 1 ? "player" : "players"}`;
}

function renderHand() {
  const v = currentVariant();
  const firstUser = v.streets[0].user;
  renderCardsInto(cardsEl, userRevealed, firstUser);
  renderCardsInto(boardEl, boardRevealed, 0);
  if (boardRevealed.length > 0) boardEl.classList.remove("hidden");
  else boardEl.classList.add("hidden");
}

function applyPlayerCap() {
  const max = maxPlayersForVariant(variantSel.value);
  for (const opt of playersSel.options) {
    const v = parseInt(opt.value || opt.text, 10);
    opt.disabled = v > max;
  }
  if (parseInt(playersSel.value, 10) > max) {
    playersSel.value = String(max);
  }
}

// ---------- flow ----------
// Zero the hand-in-progress data (deck through history). The live/visible
// flags are set by the callers, since reset() and deal() want them different.
function clearHandState() {
  deck = [];
  cursor = 0;
  streetIdx = 0;
  userRevealed = [];
  boardRevealed = [];
  streetHistory = [];
}

// Blank the result panel + per-hand feedback so a fresh hand starts clean.
// (Does not touch the status line — reset() and deal() manage that differently.)
function clearResultPanels() {
  resultEl.classList.add("hidden");
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  breakdownEl.innerHTML = "";
  explanationEl.innerHTML = "";
  trajectoryEl.innerHTML = "";
}

function reset() {
  clearHandState();
  resultsVisible = false;
  handInProgress = false;
  renderHand();
  clearResultPanels();
  callActions.style.display = "none";
  statusEl.textContent = "";
  // Reserve the prompt slot with the only available action so the Deal
  // button sits at the same vertical position it'll occupy mid-hand —
  // no jump when Play/Fold swap in (or back out to Deal).
  promptEl.textContent = "Ready to deal";
  dealBtn.disabled = false;
  dealBtn.textContent = "Deal";
  variantSel.disabled = false;
  playersSel.disabled = false;
  document.body.classList.remove("in-hand");
  applyPlayerCap();
  renderGameHeader();
}

/** @param {number} idx */
function dealStreet(idx) {
  const s = currentVariant().streets[idx];
  while (userRevealed.length < s.user) userRevealed.push(deck[cursor++]);
  while (boardRevealed.length < s.board) boardRevealed.push(deck[cursor++]);
}

function snapshotStreet() {
  streetHistory.push({
    label: currentStreet().label,
    user: userRevealed.slice(),
    board: boardRevealed.slice(),
  });
}

function advanceStreet() {
  streetIdx++;
  dealStreet(streetIdx);
  snapshotStreet();
}

function revealRemaining() {
  const last = currentVariant().streets.length - 1;
  while (streetIdx < last) {
    streetIdx++;
    dealStreet(streetIdx);
  }
}

function deal() {
  clearHandState();
  deck = shuffle(makeDeck());
  handInProgress = true;
  resultsVisible = false;
  dealStreet(0);
  snapshotStreet();
  document.body.classList.add("in-hand");
  // Sticky: once you've played at all, the intro header + tagline stay
  // hidden for good. Re-showing them between hands is noise — you've
  // read them once. The flag lives on <html> so the head's early-paint
  // script can also restore it before <body> exists.
  if (!document.documentElement.classList.contains("has-played")) {
    document.documentElement.classList.add("has-played");
    try { localStorage.setItem("hasPlayed", "1"); } catch (_) {}
  }
  renderHand();
  clearResultPanels();
  dealBtn.disabled = true;
  dealBtn.textContent = "Deal";
  promptDecision();
}

function promptDecision() {
  promptEl.textContent = `${currentStreet().label} — play or fold?`;
  callActions.style.display = "flex";
}

/**
 * Shared control-lock discipline for the (async) simulation flows. Disables the
 * inputs that could race an in-flight sim, yields once so the "Simulating…"
 * status can paint, runs `body`, then re-enables on the way out — Deal stays
 * locked while a hand is still live so a stray click can't abandon it. The
 * body owns what to compute and render (and bails itself if the hand was reset
 * during the yield).
 *
 * @template T
 * @param {() => T | Promise<T>} body
 * @returns {Promise<T>}
 */
async function withSimLock(body) {
  variantSel.disabled = true;
  playersSel.disabled = true;
  dealBtn.disabled = true;
  statusEl.textContent = "Simulating…";
  await new Promise(r => setTimeout(r, 20));
  try {
    return await body();
  } finally {
    variantSel.disabled = false;
    playersSel.disabled = false;
    dealBtn.disabled = handInProgress;
  }
}

/** @param {"play" | "fold"} userChoice */
async function handleCall(userChoice) {
  callActions.style.display = "none";
  promptEl.textContent = "";

  if (userChoice === "fold") {
    const foldText = currentStreet().foldText;
    const summary = foldText ? `You folded ${foldText}.` : "You folded.";
    // Sim at the fold state — equity reflects the decision the user just made,
    // not what they'd have ended up with after the rest of the runout.
    recordOutcome("fold", await runSimulationAndRender());
    if (revealOnFoldEl.checked) {
      revealRemaining();
      renderHand();
    }
    endHand(summary);
    return;
  }

  if (isFinalStreet()) {
    recordOutcome("play", await runSimulationAndRender());
    endHand("Showdown — hand complete.");
    return;
  }

  // Mid-hand play. Snapshot inputs before the yield so a later change can't
  // alter the sim's effective parameters.
  const playedStreet = currentStreet();
  const variantKey = variantSel.value;
  const userSnap = userRevealed.slice();
  const boardSnap = boardRevealed.slice();
  const numPlayers = parseInt(playersSel.value, 10);
  const threshold = 1 / numPlayers;

  await withSimLock(() => {
    // Bail if the hand was abandoned during the yield — advanceStreet() would
    // otherwise run against a stale (possibly shorter) street list.
    if (!handInProgress) return;
    const { winRate, verdict } = analyzeStreet(userSnap, boardSnap, numPlayers - 1, variantKey, threshold);

    advanceStreet();
    renderHand();
    const pct = (winRate * 100).toFixed(0);
    const reason = streetSummary({ userCards: userSnap, boardCards: boardSnap, variant: variantKey });
    statusEl.innerHTML =
      `<div class="math-note">${playedStreet.label}: math said ` +
      `<span class="verdict ${verdict.cls}">${verdict.text}</span>` +
      ` (${pct}% win chance)</div>` +
      `<div class="reason">${escapeHtml(reason)}</div>`;
    promptEl.textContent = `${currentStreet().label} — play or fold?`;
    callActions.style.display = "flex";
  });
}

/** @param {string} summary */
function endHand(summary) {
  handInProgress = false;
  callActions.style.display = "none";
  document.body.classList.remove("in-hand");
  dealBtn.disabled = false;
  dealBtn.textContent = "Deal again";
  variantSel.disabled = false;
  playersSel.disabled = false;
  statusEl.textContent = "Click Deal again for another hand.";
  // Keep the prompt slot filled so the Deal button doesn't jump up.
  promptEl.textContent = "Ready to deal";
  feedbackEl.textContent = summary;
  feedbackEl.className = "feedback";
}

/**
 * Run the terminal simulation, render the result panel, and return the math's
 * verdict + variant so a caller acting on a real decision (fold / showdown) can
 * record it. Returns null if the body was skipped. Player-count re-sims ignore
 * the return — they re-render but aren't a new decision.
 * @returns {Promise<{ verdict: "PLAY"|"FOLD"|"TOSS-UP", variant: string }|null>}
 */
async function runSimulationAndRender() {
  // Snapshot inputs before yielding so anything during the await can't change
  // the simulation's effective parameters.
  const numPlayers = parseInt(playersSel.value, 10);
  const numOpponents = numPlayers - 1;
  const variant = variantSel.value;
  const history = streetHistory.slice();
  const threshold = 1 / numPlayers;

  return withSimLock(() => {
    const { trajectory, final, winRate, verdict } = analyzeHand(history, numOpponents, variant, threshold);

    winPctEl.textContent = (winRate * 100).toFixed(1) + "%";
    thresholdEl.textContent = (threshold * 100).toFixed(1) + "%";
    thresholdLabelEl.textContent = `Fair share (1 of ${numPlayers})`;
    verdictEl.textContent = verdict.text;
    verdictEl.className = "result-val verdict " + verdict.cls;
    renderBreakdown(breakdownEl, final.distribution, variant, final.user, final.board);
    renderExplanation(explanationEl, { trajectory, numPlayers, variant });
    renderTrajectory(trajectoryEl, trajectory, threshold);
    resultEl.classList.remove("hidden");
    resultsVisible = true;

    // Clear "Simulating…". If the hand is already wrapped up (player-count
    // change after a fold/showdown), restore the deal-again prompt; otherwise
    // endHand() writes the final message right after this returns.
    statusEl.textContent = handInProgress ? "" : "Click Deal again for another hand.";

    return { verdict: verdict.text, variant };
  });
}

// ---------- stats (on-device decision calibration) ----------
const statsStore = (() => { try { return localStorage; } catch (_) { return undefined; } })();

/** @param {import("./stats.js").Stats} stats */
function renderStats(stats) {
  if (!statsSummaryEl) return;
  const sum = summarize(stats);
  if (sum.hands === 0) {
    statsSummaryEl.textContent = "No hands yet — play one to start tracking.";
    return;
  }
  const lean = sum.lean === "tight"
    ? "Leaning tight — you fold hands the math would play."
    : sum.lean === "loose"
      ? "Leaning loose — you play hands the math would fold."
      : "Your play/fold balance looks even.";
  // Content is all fixed strings + integers, so no escaping is needed.
  statsSummaryEl.innerHTML =
    `<div class="stats-main">Agreed with the math on <strong>${stats.agreements} of ${sum.hands}</strong> hands (${sum.agreementPct}%).</div>` +
    `<div class="stats-lean">${lean}</div>`;
}

/**
 * Record one terminal decision against the math, persist it, and refresh the
 * panel. No-op if the sim was skipped.
 * @param {"play"|"fold"} choice
 * @param {{ verdict: "PLAY"|"FOLD"|"TOSS-UP", variant: string }|null} res
 */
function recordOutcome(choice, res) {
  if (!res) return;
  renderStats(recordAndSave(statsStore, { variant: res.variant, choice, verdict: res.verdict }));
}

// ---------- theme ----------
const CUSTOM_THEMES = ["vegas-neon", "classic-casino", "classic-burgundy", "brutalist", "brutalist-dark", "print", "terminal", "editorial"];

// Single source of truth (read at module load) for the asset-version query
// string. The <meta name="asset-version"> lives in index.html's <head>; bump
// it there and the corresponding <link>/<script> versions, and applyTheme
// + the early-paint script both pick the new value up automatically.
const ASSET_VERSION = document.querySelector('meta[name="asset-version"]')?.getAttribute("content") || "1";

/** @param {string} slug */
function applyTheme(slug) {
  let link = /** @type {HTMLLinkElement | null} */ (document.getElementById("theme-css"));
  if (CUSTOM_THEMES.indexOf(slug) >= 0) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = "theme-css";
      document.head.appendChild(link);
    }
    link.href = `themes/${slug}.css?v=${ASSET_VERSION}`;
    document.documentElement.removeAttribute("data-theme");
  } else {
    if (link) link.remove();
    document.documentElement.dataset.theme = slug;
  }
  try { localStorage.setItem("theme", slug); } catch (_) {}
  applyWebFonts();
}

// ---------- web fonts (opt-in) ----------
// Each designer theme uses a specific Google Fonts URL. When the user opts in
// via the settings toggle, we inject a <link> to fetch it; the SW caches the
// response so subsequent loads work offline. Default = off → themes render in
// system fallbacks (monospace / Georgia / serif), which still look on-brand.
/** @type {Record<string, string>} */
const THEME_FONT_URLS = {
  "brutalist":         "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap",
  "brutalist-dark":    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap",
  "print":             "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap",
  "terminal":          "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap",
  "classic-casino":    "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500;1,700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap",
  "classic-burgundy":  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500;1,700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap",
  "editorial":         "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;0,8..60,900;1,8..60,400;1,8..60,600;1,8..60,700&display=swap",
  "vegas-neon":        "https://fonts.googleapis.com/css2?family=Monoton&family=Bebas+Neue&display=swap",
};

// Inject or remove the <link id="webfont-css"> that pulls the active theme's
// Google Fonts CSS. Called from applyTheme (theme switched) and from the
// toggle change handler. No-op for built-in themes (dark/felt/light) which
// don't use custom fonts.
function applyWebFonts() {
  let link = /** @type {HTMLLinkElement | null} */ (document.getElementById("webfont-css"));
  let enabled = false;
  try { enabled = localStorage.getItem("webFonts") === "1"; } catch (_) {}
  const slug = themeSel.value;
  const url = enabled ? THEME_FONT_URLS[slug] : undefined;
  if (url) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = "webfont-css";
      document.head.appendChild(link);
    }
    if (link.href !== url) link.href = url;
    primeWebFontCache(url);
  } else if (link) {
    link.remove();
  }
}

// Belt-and-suspenders cache warming for the active theme's font URL. We fetch
// the CSS through the SW (which the browser's stylesheet loader sometimes
// bypasses), then parse out the WOFF2 URLs and fetch each one — because the
// browser's font loader ALSO sometimes bypasses the SW. Doing this from JS
// guarantees both the CSS and the WOFF2 files land in CacheStorage so the
// next load (online or offline) hits the cache. Errors are swallowed: if the
// user is offline on first opt-in, the toggle just doesn't take effect until
// next online visit.
/** @type {Set<string>} */
const fontUrlsPrimed = new Set();
/** @param {string} cssUrl */
function primeWebFontCache(cssUrl) {
  if (fontUrlsPrimed.has(cssUrl)) return;
  fontUrlsPrimed.add(cssUrl);
  fetch(cssUrl).then(r => r.text()).then(text => {
    const urls = new Set();
    const re = /url\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const u = m[1].replace(/^['"]|['"]$/g, "");
      if (u.startsWith("https://fonts.gstatic.com/")) urls.add(u);
    }
    for (const u of urls) fetch(u).catch(() => {});
  }).catch(() => {});
}

// ---------- event wiring ----------
dealBtn.addEventListener("click", deal);
playBtn.addEventListener("click", () => handleCall("play"));
foldBtn.addEventListener("click", () => handleCall("fold"));
variantSel.addEventListener("change", reset);
playersSel.addEventListener("change", () => {
  renderGameHeader();
  if (resultsVisible) runSimulationAndRender();
});

settingsToggleEl.addEventListener("click", () => {
  const open = settingsPanelEl.classList.toggle("hidden") === false;
  settingsToggleEl.setAttribute("aria-expanded", String(open));
});

// Storage may be disabled (private mode, blocked cookies, etc.) — mirror the
// early-paint script's fallback so the rest of the page still wires up.
let savedTheme = "brutalist";
try { savedTheme = localStorage.getItem("theme") || "brutalist"; } catch (_) {}
themeSel.value = savedTheme;
themeSel.addEventListener("change", () => applyTheme(themeSel.value));

// Web fonts toggle: read saved preference (default off — we don't want to
// reach out to Google's CDN without the user opting in), wire change handler.
let webFontsSaved = false;
try { webFontsSaved = localStorage.getItem("webFonts") === "1"; } catch (_) {}
webFontsEl.checked = webFontsSaved;
webFontsEl.addEventListener("change", () => {
  try { localStorage.setItem("webFonts", webFontsEl.checked ? "1" : "0"); } catch (_) {}
  applyWebFonts();
});
applyWebFonts();

// Stats: render what's stored, and wire the Reset button.
renderStats(loadStats(statsStore));
statsResetEl.addEventListener("click", () => renderStats(resetStats(statsStore)));

// Inline glossary popover for the explainer's jargon.
setupGlossaryPopover();

reset();

// Register the service worker for offline behavior. We wait for `load` so
// the SW install doesn't compete with the first paint, and we swallow
// registration errors — the app works fine without it, just not offline.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
