// @ts-check
// Entry point — DOM refs, state, flow, and event wiring.

import { makeDeck, shuffle } from "./evaluator.js";
import { VARIANTS, maxPlayersForVariant, TOSSUP_BAND } from "./variants.js";
import { simulate } from "./simulate.js";
import { renderCardsInto, renderBreakdown, renderTrajectory, renderExplanation } from "./ui.js";
import { streetSummary } from "./explain.js";

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
function reset() {
  deck = [];
  cursor = 0;
  streetIdx = 0;
  userRevealed = [];
  boardRevealed = [];
  streetHistory = [];
  resultsVisible = false;
  handInProgress = false;
  renderHand();
  resultEl.classList.add("hidden");
  callActions.style.display = "none";
  statusEl.textContent = "";
  // Reserve the prompt slot with the only available action so the Deal
  // button sits at the same vertical position it'll occupy mid-hand —
  // no jump when Play/Fold swap in (or back out to Deal).
  promptEl.textContent = "Ready to deal";
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  breakdownEl.innerHTML = "";
  explanationEl.innerHTML = "";
  trajectoryEl.innerHTML = "";
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
  deck = shuffle(makeDeck());
  cursor = 0;
  streetIdx = 0;
  userRevealed = [];
  boardRevealed = [];
  streetHistory = [];
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
  resultEl.classList.add("hidden");
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  breakdownEl.innerHTML = "";
  explanationEl.innerHTML = "";
  trajectoryEl.innerHTML = "";
  dealBtn.disabled = true;
  dealBtn.textContent = "Deal";
  promptDecision();
}

function promptDecision() {
  promptEl.textContent = `${currentStreet().label} — play or fold?`;
  callActions.style.display = "flex";
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
    await runSimulationAndRender();
    if (revealOnFoldEl.checked) {
      revealRemaining();
      renderHand();
    }
    endHand(summary);
    return;
  }

  if (isFinalStreet()) {
    await runSimulationAndRender();
    endHand("Showdown — hand complete.");
    return;
  }

  // Mid-hand play. Snapshot inputs and lock variant/player selectors BEFORE
  // the yield — a variant change during the await otherwise triggers reset()
  // mid-flight and advanceStreet() would crash on a smaller streets[] array.
  const playedStreet = currentStreet();
  const variantKey = variantSel.value;
  const userSnap = userRevealed.slice();
  const boardSnap = boardRevealed.slice();
  const numPlayers = parseInt(playersSel.value, 10);
  const threshold = 1 / numPlayers;
  variantSel.disabled = true;
  playersSel.disabled = true;
  statusEl.textContent = "Simulating…";
  await new Promise(r => setTimeout(r, 20));
  if (!handInProgress) {
    variantSel.disabled = false;
    playersSel.disabled = false;
    return;
  }
  const { winRate } = simulate(userSnap, boardSnap, numPlayers - 1, variantKey, 10000);
  const verdict = Math.abs(winRate - threshold) <= TOSSUP_BAND
    ? { text: "TOSS-UP", cls: "tossup" }
    : winRate > threshold
      ? { text: "PLAY", cls: "play" }
      : { text: "FOLD", cls: "fold" };

  advanceStreet();
  renderHand();
  const pct = (winRate * 100).toFixed(0);
  const reason = streetSummary({ userCards: userSnap, boardCards: boardSnap, variant: variantKey });
  const escapeHtml = /** @param {string} s */ s => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  statusEl.innerHTML =
    `<div class="math-note">${playedStreet.label}: math said ` +
    `<span class="verdict ${verdict.cls}">${verdict.text}</span>` +
    ` (${pct}% win chance)</div>` +
    `<div class="reason">${escapeHtml(reason)}</div>`;
  promptEl.textContent = `${currentStreet().label} — play or fold?`;
  variantSel.disabled = false;
  playersSel.disabled = false;
  callActions.style.display = "flex";
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

async function runSimulationAndRender() {
  // Snapshot inputs before yielding so anything during the await can't change
  // the simulation's effective parameters.
  const numPlayers = parseInt(playersSel.value, 10);
  const numOpponents = numPlayers - 1;
  const variant = variantSel.value;
  const history = streetHistory.slice();
  const threshold = 1 / numPlayers;

  // Lock all controls BEFORE the yield so resets/deals/variant changes can't
  // race against the in-flight simulation.
  variantSel.disabled = true;
  playersSel.disabled = true;
  dealBtn.disabled = true;

  statusEl.textContent = "Simulating…";
  await new Promise(r => setTimeout(r, 20));

  // One sim per street the user saw — last is the terminal state used for
  // the headline verdict and breakdown, the rest power the equity chart.
  const trajectory = history.map(snap => {
    const res = simulate(snap.user, snap.board, numOpponents, variant, 10000);
    return { label: snap.label, user: snap.user, board: snap.board, ...res };
  });
  const final = trajectory[trajectory.length - 1];
  const winRate = final.winRate;

  /** @type {string} */ let verdictText;
  /** @type {string} */ let verdictClass;
  if (Math.abs(winRate - threshold) <= TOSSUP_BAND) {
    verdictText = "TOSS-UP";
    verdictClass = "tossup";
  } else if (winRate > threshold) {
    verdictText = "PLAY";
    verdictClass = "play";
  } else {
    verdictText = "FOLD";
    verdictClass = "fold";
  }

  winPctEl.textContent = (winRate * 100).toFixed(1) + "%";
  thresholdEl.textContent = (threshold * 100).toFixed(1) + "%";
  thresholdLabelEl.textContent = `Fair share (1 of ${numPlayers})`;
  verdictEl.textContent = verdictText;
  verdictEl.className = "result-val verdict " + verdictClass;
  renderBreakdown(breakdownEl, final.distribution, variant, final.user, final.board);
  renderExplanation(explanationEl, { trajectory, numPlayers, variant });
  renderTrajectory(trajectoryEl, trajectory, threshold);
  resultEl.classList.remove("hidden");
  resultsVisible = true;

  // Clear "Simulating…". If the hand is already wrapped up (player-count
  // change after a fold/showdown), restore the deal-again prompt; otherwise
  // endHand() will write the final message right after this returns.
  statusEl.textContent = handInProgress ? "" : "Click Deal again for another hand.";

  // Re-open controls. Variant change clears everything via reset();
  // player-count change re-runs the sim against the resolved hand state.
  // Deal stays disabled while a hand is in progress so a stray click can't
  // silently abandon the hand mid-street; endHand() re-enables it.
  playersSel.disabled = false;
  variantSel.disabled = false;
  dealBtn.disabled = handInProgress;
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

reset();

// Register the service worker for offline behavior. We wait for `load` so
// the SW install doesn't compete with the first paint, and we swallow
// registration errors — the app works fine without it, just not offline.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
