// Ultimate Poker odds: 3 hole cards + 5 board cards, best five, threes wild.
//
//   node scripts/ultimate-odds.js
//
// Writes two files:
//   test/fixtures/ultimate-odds.json  exact counts the unit tests check the
//                                     simulator against
//   docs/ultimate-odds.md             the same numbers as readable tables,
//                                     plus simulated equities
//
// Part 1 is exact: it scores every one of the C(52,8) = 752,538,150 eight-card
// hands with the real evaluator, split across worker threads (about a minute
// on a 10-core laptop). Part 2 is closed-form counting. Part 3 uses the app's
// own Monte Carlo simulator, so it carries a stated sampling error.

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeDeck, evaluateWild, CATEGORY_NAMES, CATEGORY_DIVISOR } from "../js/evaluator.js";
import { VARIANTS } from "../js/variants.js";

const WILD = VARIANTS.ultimate.wildRank;
const N_CARDS = VARIANTS.ultimate.hole + VARIANTS.ultimate.board; // 8
const N_CAT = CATEGORY_NAMES.length;

/** @param {number} n @param {number} k */
function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}

function exactCategoryCounts() {
  /** @type {Array<{a: number, b: number}>} */
  const jobs = [];
  for (let a = 0; a < 45; a++) for (let b = a + 1; b < 46; b++) jobs.push({ a, b });
  // Biggest jobs first so the tail doesn't wait on one slow worker.
  jobs.sort((x, y) => choose(51 - y.b, 6) - choose(51 - x.b, 6));
  const total = new Array(N_CAT).fill(0);
  const threads = Math.max(1, availableParallelism() - 1);
  return new Promise((resolve, reject) => {
    let next = 0, done = 0;
    const self = fileURLToPath(import.meta.url);
    for (let t = 0; t < threads; t++) {
      const w = new Worker(self);
      const feed = () => w.postMessage(next < jobs.length ? jobs[next++] : null);
      w.on("message", counts => {
        for (let i = 0; i < N_CAT; i++) total[i] += counts[i];
        done++;
        if (done % 100 === 0) process.stderr.write(`  ${done}/${jobs.length} slices\r`);
        if (done === jobs.length) resolve(total);
        feed();
      });
      w.on("error", reject);
      feed();
    }
  });
}

/** Chance of exactly k wilds among n cards drawn from the deck. @param {number} n @param {number} k */
function pWilds(n, k) {
  return choose(4, k) * choose(48, n - k) / choose(52, n);
}

/** @param {number} p */
const pct = p => (p * 100 >= 0.1 ? (p * 100).toFixed(2) : (p * 100).toPrecision(2)) + "%";
/** @param {number} p */
const oneIn = p => (p > 0 ? Math.round(1 / p).toLocaleString("en-US") : "never");

async function main() {
  const { simulate } = await import("../js/simulate.js");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const totalHands = choose(52, N_CARDS);

  console.error(`Scoring all ${totalHands.toLocaleString("en-US")} eight-card hands…`);
  const t0 = Date.now();
  const counts = await exactCategoryCounts();
  const sum = counts.reduce((x, y) => x + y, 0);
  if (sum !== totalHands) throw new Error(`counted ${sum} hands, expected ${totalHands}`);
  console.error(`\n  done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  const holeWilds = [0, 1, 2, 3].map(k => pWilds(3, k));
  const handWilds = [0, 1, 2, 3, 4].map(k => pWilds(8, k));

  // Monte Carlo parts, through the same simulator the app uses.
  const ITER = 200000;
  const ranks = "  23456789TJQKA";
  /** @param {string} s */
  const parse = s => s.split(" ").map(t => ({ rank: ranks.indexOf(t[0]), suit: "shdc".indexOf(t[1]) }));
  const starters = [
    ["3s 3h 3d", "three wilds"],
    ["3s 3h As", "two wilds and an ace"],
    ["3s Ah Kh", "a wild with suited ace-king"],
    ["3s 9h 4d", "a wild with junk"],
    ["As Ah Ad", "trip aces, no wild"],
    ["Ah Kh Qh", "suited ace-king-queen"],
    ["As Ad Kc", "pocket aces with a king"],
    ["9s 8s 7s", "suited nine-eight-seven"],
    ["Ks 9d 4c", "king high, no wild"],
    ["7s 4d 2c", "the worst kind of hand: low, unsuited, no wild"],
  ];
  const tableSizes = [2, 4, 6, 9];
  console.error(`Simulating ${starters.length} starting hands at ${tableSizes.length} table sizes, ${ITER.toLocaleString("en-US")} deals each…`);
  const equities = starters.map(([cards, note]) => ({
    cards, note,
    equity: tableSizes.map(n => simulate(parse(cards), [], n - 1, "ultimate", ITER).winRate),
  }));
  // What a winning hand looks like: the strongest hand at the table, by size.
  const winners = tableSizes.map(n => ({ players: n, best: bestHandAtTable(n, ITER) }));

  // ---- write the fixture ----
  const fixture = {
    variant: "ultimate",
    wildRank: WILD,
    cards: N_CARDS,
    totalHands,
    categories: CATEGORY_NAMES,
    counts,
    note: "Exact counts of the best five-card hand over every 8-card hand, threes wild. Generated by scripts/ultimate-odds.js.",
  };
  mkdirSync(join(root, "test/fixtures"), { recursive: true });
  writeFileSync(join(root, "test/fixtures/ultimate-odds.json"), JSON.stringify(fixture, null, 2) + "\n");

  // ---- write the doc ----
  const lines = [];
  lines.push("# Ultimate Poker odds", "");
  lines.push("Generated by `node scripts/ultimate-odds.js`. Do not edit by hand; rerun the script.", "");
  lines.push("**Rules.** Each player gets 3 hole cards. Five community cards come flop (3), turn (1), river (1), as in Hold'em. Your hand is the best five of your eight cards, using any mix of hole and board. Every three is wild. Five of a kind is the top hand, above a straight flush. A wild can copy a card you already hold, except in a flush, where it becomes the highest card of that suit you don't have.", "");

  lines.push("## Your final hand (exact)", "");
  lines.push(`Every one of the ${totalHands.toLocaleString("en-US")} possible eight-card hands, scored by the same evaluator the app uses.`, "");
  lines.push("| Hand | Hands | Probability | About 1 in |", "|---|---:|---:|---:|");
  for (let i = N_CAT - 1; i >= 0; i--) {
    const p = counts[i] / totalHands;
    lines.push(`| ${CATEGORY_NAMES[i]} | ${counts[i].toLocaleString("en-US")} | ${pct(p)} | ${oneIn(p)} |`);
  }
  lines.push(`| **Total** | **${totalHands.toLocaleString("en-US")}** | **100%** | |`, "");

  // Ranking-order check: wilds make some hands more common than hands ranked
  // below them. High card is left out; it's rare in any 8-card game.
  const inversions = [];
  for (let i = 2; i < N_CAT; i++) {
    for (let j = 1; j < i; j++) {
      if (counts[i] > counts[j]) inversions.push(`${CATEGORY_NAMES[i]} (${pct(counts[i] / totalHands)}) is more common than ${CATEGORY_NAMES[j].toLowerCase()} (${pct(counts[j] / totalHands)})`);
    }
  }
  lines.push("### Rankings versus rarity", "");
  if (inversions.length) {
    lines.push("The standard ranking is kept, but some hands are more common than hands ranked below them:", "");
    for (const s of inversions) lines.push(`- ${s}`);
    lines.push("");
    lines.push("A wild always makes the strongest hand it can, so a hand holding one often jumps past three of a kind to a straight, flush or full house. That leaves three of a kind rarer than the hands ranked just above it. Two pair beats one pair on frequency for a different reason: with eight cards, two pairs show up often even without wilds. Home games keep the standard order rather than reranking by rarity, which would change with every choice of wild rank.", "");
  } else {
    lines.push("Every hand is rarer than every hand ranked below it, so the standard ranking matches rarity.", "");
  }

  lines.push("## Wild cards (exact)", "");
  lines.push("| Wilds | In your 3 hole cards | In your 8 cards |", "|---:|---:|---:|");
  for (let k = 0; k <= 4; k++) {
    lines.push(`| ${k} | ${k <= 3 ? pct(holeWilds[k]) : "—"} | ${pct(handWilds[k])} |`);
  }
  lines.push("");
  lines.push(`You see at least one wild in your hole cards ${pct(1 - holeWilds[0])} of the time and somewhere in your eight cards ${pct(1 - handWilds[0])} of the time.`, "");

  lines.push("## Starting-hand equity (simulated)", "");
  lines.push(`Chance to win at showdown against random hands, everyone staying in to the river. ${ITER.toLocaleString("en-US")} deals per cell; each figure is within about ±0.3 points.`, "");
  lines.push(`| Hole cards | | ${tableSizes.map(n => `${n} players`).join(" | ")} |`, `|---|---|${tableSizes.map(() => "---:").join("|")}|`);
  for (const e of equities) lines.push(`| ${e.cards} | ${e.note} | ${e.equity.map(p => pct(p)).join(" | ")} |`);
  lines.push(`| | fair share | ${tableSizes.map(n => pct(1 / n)).join(" | ")} |`, "");

  lines.push("## What wins (simulated)", "");
  lines.push(`The best hand at the table at showdown, by table size. ${ITER.toLocaleString("en-US")} deals each.`, "");
  lines.push(`| Best hand at the table | ${tableSizes.map(n => `${n} players`).join(" | ")} |`, `|---|${tableSizes.map(() => "---:").join("|")}|`);
  for (let i = N_CAT - 1; i >= 0; i--) {
    const row = winners.map(w => w.best[i]);
    if (row.every(p => p < 0.0005)) continue;
    lines.push(`| ${CATEGORY_NAMES[i]} | ${row.map(p => pct(p)).join(" | ")} |`);
  }
  lines.push("");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs/ultimate-odds.md"), lines.join("\n"));
  console.error("Wrote test/fixtures/ultimate-odds.json and docs/ultimate-odds.md");
}

/**
 * Distribution of the strongest hand among `players` random hands on a random
 * board. Deals straight from a shuffled deck rather than going through
 * simulate(), which reports results from one player's point of view.
 * @param {number} players @param {number} iterations
 */
function bestHandAtTable(players, iterations) {
  const deck = makeDeck();
  const need = 5 + 3 * players;
  const dist = new Array(N_CAT).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < need; i++) {
      const j = i + ((Math.random() * (deck.length - i)) | 0);
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    const board = deck.slice(0, 5);
    let best = 0;
    for (let p = 0; p < players; p++) {
      const s = evaluateWild(deck.slice(5 + 3 * p, 8 + 3 * p).concat(board), WILD);
      if (s > best) best = s;
    }
    dist[Math.floor(best / CATEGORY_DIVISOR)]++;
  }
  return dist.map(c => c / iterations);
}

// Entry point last, so every helper above is initialised before main() runs.
if (!isMainThread) {
  // Worker: score every 8-card hand whose two lowest deck indexes are (a, b).
  const deck = makeDeck();
  parentPort.on("message", job => {
    if (job === null) { process.exit(0); }
    const { a, b } = job;
    const counts = new Array(N_CAT).fill(0);
    const cards = new Array(N_CARDS);
    cards[0] = deck[a]; cards[1] = deck[b];
    for (let c = b + 1; c < 47; c++) { cards[2] = deck[c];
    for (let d = c + 1; d < 48; d++) { cards[3] = deck[d];
    for (let e = d + 1; e < 49; e++) { cards[4] = deck[e];
    for (let f = e + 1; f < 50; f++) { cards[5] = deck[f];
    for (let g = f + 1; g < 51; g++) { cards[6] = deck[g];
    for (let h = g + 1; h < 52; h++) { cards[7] = deck[h];
      counts[Math.floor(evaluateWild(cards, WILD) / CATEGORY_DIVISOR)]++;
    }}}}}}
    parentPort.postMessage(counts);
  });
} else {
  await main();
}
