// Exhaustive check of evaluateWild over every 5-card hand (2,598,960 of them),
// plus a large random sample of 8-card hands.
// Each hand is scored twice, once by js/evaluator.js and once by the
// brute-force oracle in test/_wild-oracle.js, and any disagreement is printed.
// Also prints the category counts, which for --wild=2 can be compared with the
// published Deuces Wild frequency table.
//
//   node scripts/verify-wild.js            # threes wild (Ultimate Poker)
//   node scripts/verify-wild.js --wild=2   # deuces wild, for the published table
//
// Takes a few minutes. The unit suite runs a sampled version of the same check.

import { makeDeck, evaluateWild, CATEGORY_NAMES, CATEGORY_DIVISOR } from "../js/evaluator.js";
import { oracleWild } from "../test/_wild-oracle.js";

const arg = process.argv.find(a => a.startsWith("--wild="));
const wildRank = arg ? Number(arg.slice(7)) : 3;
const deck = makeDeck();
const counts = new Array(CATEGORY_NAMES.length).fill(0);
let hands = 0, mismatches = 0;

for (let a = 0; a < 48; a++)
for (let b = a + 1; b < 49; b++)
for (let c = b + 1; c < 50; c++)
for (let d = c + 1; d < 51; d++)
for (let e = d + 1; e < 52; e++) {
  const cards = [deck[a], deck[b], deck[c], deck[d], deck[e]];
  const got = evaluateWild(cards, wildRank);
  const want = oracleWild(cards, wildRank);
  if (got !== want) {
    if (mismatches < 20) console.error("MISMATCH", JSON.stringify(cards), got, want);
    mismatches++;
  }
  counts[Math.floor(got / CATEGORY_DIVISOR)]++;
  hands++;
}

// Then a random sample of 8-card hands (Ultimate's 3 hole + 5 board), the same
// oracle check at the size the game actually scores. Random, so a rerun covers
// different hands; --eight=N sets the sample size.
const eightArg = process.argv.find(a => a.startsWith("--eight="));
const EIGHT = eightArg ? Number(eightArg.slice(8)) : 200000;
let eightMismatches = 0;
for (let i = 0; i < EIGHT; i++) {
  for (let k = 0; k < 8; k++) {
    const j = k + ((Math.random() * (52 - k)) | 0);
    const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
  }
  const cards = deck.slice(0, 8);
  const got = evaluateWild(cards, wildRank);
  const want = oracleWild(cards, wildRank);
  if (got !== want) {
    if (eightMismatches < 20) console.error("MISMATCH (8 cards)", JSON.stringify(cards), got, want);
    eightMismatches++;
  }
}
mismatches += eightMismatches;
console.log(`8-card sample: ${EIGHT} hands, ${eightMismatches} mismatches`);

// Wizard of Odds, "Wild Five-Card Stud Combinations", 2's wild column
// (https://wizardofodds.com/games/poker/). Their "four wilds" (48) and "five of
// a kind" (624) rows are both five of a kind here. High card first.
const PUBLISHED_DEUCES_WILD = [799680, 1225008, 95040, 355080, 62232, 14472, 12672, 31552, 2552, 672];

console.log(`wild rank ${wildRank}: ${hands} five-card hands, ${mismatches - eightMismatches} mismatches`);
for (let i = counts.length - 1; i >= 0; i--) console.log(`${CATEGORY_NAMES[i].padEnd(16)} ${counts[i]}`);
let tableOff = false;
if (wildRank === 2) {
  tableOff = counts.some((n, i) => n !== PUBLISHED_DEUCES_WILD[i]);
  console.log(tableOff ? "DIFFERS from the published Deuces Wild table" : "matches the published Deuces Wild table");
}
process.exit(mismatches || tableOff ? 1 : 0);
