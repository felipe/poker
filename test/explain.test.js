// node --test
// Three-pronged verification of the explainer in js/explain.js:
//
//   (1) Golden outputs — exact prose for a curated catalog of hand setups.
//       Any change to a fixed string here means the engine's wording moved
//       and the author has to consciously re-bless the expectation.
//   (2) Structural invariants — every named claim ("flush draw", "set of X",
//       "top pair", "overpair", "OESD", etc.) must correspond to the actual
//       cards on the table. Catches semantic drift that golden tests miss.
//   (3) Simulator cross-check — when prose calls a hand "premium" or "the
//       textbook worst", the Monte Carlo simulator's equity at that hand
//       must back it up. Catches mismatches between the prose's lean and
//       what the math actually says.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { simulate } from "../js/simulate.js";
import { explain, streetSummary, explainTrajectory, recapHand } from "../js/explain.js";
import { hand } from "./_cards.js";

const SIM_ITERATIONS = 4000;

/* ============================================================
 * (1) GOLDEN OUTPUTS — frozen prose for canonical setups.
 * ============================================================ */

/**
 * @param {string} name
 * @param {{ user: string[], board: string[], variant: string }} setup
 * @param {string} expected
 */
function golden(name, setup, expected) {
  test(`golden: ${name}`, () => {
    const prose = streetSummary({
      userCards: hand(...setup.user),
      boardCards: hand(...setup.board),
      variant: setup.variant,
    });
    assert.equal(prose, expected);
  });
}

// --- Hold'em pre-flop -------------------------------------------------

golden("AA pre-flop", { user: ["As", "Ah"], board: [], variant: "holdem" },
  "Pocket aces — the strongest starting hand in Hold'em.");

golden("KK pre-flop", { user: ["Ks", "Kh"], board: [], variant: "holdem" },
  "Pocket kings — second only to aces, with an ace on the flop the only real nightmare.");

golden("QQ pre-flop", { user: ["Qs", "Qh"], board: [], variant: "holdem" },
  "Pocket queens — premium, but you'll sweat every ace or king that comes.");

golden("JJ pre-flop", { user: ["Js", "Jh"], board: [], variant: "holdem" },
  "Pocket jacks — strong, but any overcard on the flop chips at your confidence.");

golden("88 pre-flop", { user: ["8s", "8h"], board: [], variant: "holdem" },
  "Pocket eights — a solid middle pair, ahead of most random hands but easily outflopped.");

golden("55 pre-flop", { user: ["5s", "5h"], board: [], variant: "holdem" },
  "Pocket fives — a small pair. Usually you need to flop a set or fold to action on overcards.");

golden("AKs pre-flop", { user: ["As", "Ks"], board: [], variant: "holdem" },
  "Ace-king suited — premium. Flops top pair often and has both flush and straight potential.");

golden("AKo pre-flop", { user: ["As", "Kh"], board: [], variant: "holdem" },
  "Ace-king off-suit — premium high-card hand, but you usually need to pair to win the pot.");

golden("AQs pre-flop", { user: ["As", "Qs"], board: [], variant: "holdem" },
  "Ace-queen suited — strong, with flush potential backing up the high cards.");

golden("AJo pre-flop", { user: ["As", "Jh"], board: [], variant: "holdem" },
  "Ace-jack off-suit — solid, but dominated by ace-king and bigger pairs.");

golden("A4s pre-flop", { user: ["As", "4s"], board: [], variant: "holdem" },
  "A suited ace with a weak kicker — playable for the nut-flush potential, but the kicker often costs you the pot.");

golden("A4o pre-flop", { user: ["As", "4h"], board: [], variant: "holdem" },
  "An ace with a weak off-suit kicker — easily dominated, especially in a multiway pot.");

golden("KQs pre-flop", { user: ["Ks", "Qs"], board: [], variant: "holdem" },
  "Suited broadway — flops top pair often and has straight and flush potential.");

golden("KJo pre-flop", { user: ["Ks", "Jh"], board: [], variant: "holdem" },
  "Broadway off-suit — decent, but vulnerable to bigger pairs and ace-high hands.");

golden("76s pre-flop", { user: ["7s", "6s"], board: [], variant: "holdem" },
  "Suited connectors — speculative. You're playing for straights, flushes, and the occasional surprise two pair.");

golden("T9o pre-flop", { user: ["Ts", "9h"], board: [], variant: "holdem" },
  "Off-suit connectors — speculative. Plays for straights, but easily dominated.");

golden("72o pre-flop", { user: ["7c", "2d"], board: [], variant: "holdem" },
  "Seven-deuce off-suit — the textbook worst starting hand in the game.");

golden("J3o pre-flop", { user: ["Jh", "3d"], board: [], variant: "holdem" },
  "A marginal off-suit hand — needs a friendly flop to be worth more than fold equity.");

// --- Hold'em post-flop ------------------------------------------------

golden("AA overpair on rainbow flop",
  { user: ["As", "Ah"], board: ["7c", "4d", "2s"], variant: "holdem" },
  "Your pocket aces are an overpair to the board — strong.");

golden("AA overpair, 2-flush threat",
  { user: ["As", "Ah"], board: ["7d", "8d", "3c"], variant: "holdem" },
  "Your pocket aces are an overpair to the board — strong. Two of one suit on the board means flush draws are live for anyone holding the suit.");

golden("AKo top pair, ace kicker",
  { user: ["As", "Kh"], board: ["Ac", "7d", "2s"], variant: "holdem" },
  "Top pair, aces, king kicker — a solid one-pair hand.");

golden("AKo top pair on K-high board",
  { user: ["As", "Kh"], board: ["Kc", "7d", "2s"], variant: "holdem" },
  "Top pair, kings, ace kicker — a solid one-pair hand.");

golden("88 underpair on overcard flop",
  { user: ["8s", "8h"], board: ["Ks", "Qh", "2c"], variant: "holdem" },
  "Your pocket eights are under the board's high card — vulnerable to anyone who's hit a pair on the flop.");

golden("55 set on dry flop",
  { user: ["5s", "5h"], board: ["5c", "9h", "Qs"], variant: "holdem" },
  "A set of fives — your pocket pair hit the board. Well hidden, very strong.");

golden("trips on paired board",
  { user: ["Ks", "Th"], board: ["Kc", "Kd", "4s"], variant: "holdem" },
  "Trips, kings — strong, but the case king in someone's hand makes quads.");

golden("board trips (player not contributing)",
  { user: ["7c", "8d"], board: ["5s", "5h", "5c"], variant: "holdem" },
  "Three fives on the board — you have the trips, but so does everyone else. It comes down to kickers, and anyone with a pocket pair has a full house.");

golden("flush draw on 2-flush board",
  { user: ["Jd", "9d"], board: ["6d", "Kd", "2s"], variant: "holdem" },
  "You haven't paired anything yet — king-high. You're on a flush draw — nine cards complete it.");

golden("open-ended straight draw",
  { user: ["9h", "Th"], board: ["7c", "8s", "2d"], variant: "holdem" },
  "You haven't paired anything yet — ten-high. You've got an open-ended straight draw — eight cards complete it.");

golden("gutshot straight draw",
  // 6-7-8-T with the 9 missing in the middle — exactly four cards complete.
  { user: ["7h", "Tc"], board: ["8d", "6s", "2c"], variant: "holdem" },
  "You haven't paired anything yet — ten-high. You've got a gutshot straight draw — four cards complete it.");

golden("three of a suit on board, user not in suit",
  { user: ["As", "Kh"], board: ["2d", "8d", "Jd"], variant: "holdem" },
  "You haven't paired anything yet — ace-high. The board already has three of one suit — anyone holding two of that suit has made a flush.");

golden("four of a suit on board, user not in suit",
  { user: ["As", "Kh"], board: ["2d", "8d", "Jd", "5d"], variant: "holdem" },
  "You haven't paired anything yet — ace-high. The board has four of one suit — anyone holding even a single card of that suit has made a flush.");

golden("top pair with weak hole-card kicker (board outranks)",
  // K7 on KQT — the seven is in the hole but Q and T both outkick it.
  { user: ["Ks", "7h"], board: ["Kc", "Qd", "Tc"], variant: "holdem" },
  "Top pair, kings, with the seven in the hole — a solid one-pair hand. Two of one suit on the board means flush draws are live for anyone holding the suit. The board's connected enough that a straight or straight draw is realistic.");

golden("paired board, no kings in hand",
  { user: ["Ah", "Qs"], board: ["Kd", "Kc", "4s"], variant: "holdem" },
  "The board has a pair of kings that doesn't involve your hand — you're effectively playing for kicker. The paired kings on the board mean anyone holding the case card has trips already.");

golden("connected board, no piece",
  { user: ["Ah", "Ks"], board: ["6d", "7c", "8s"], variant: "holdem" },
  "You haven't paired anything yet — ace-high. The board's connected enough that a straight or straight draw is realistic.");

golden("made flush at showdown",
  { user: ["9d", "Jd"], board: ["2d", "5d", "7d", "Ks", "3c"], variant: "holdem" },
  "A flush — strong. Watch for a higher flush or a paired board.");

golden("made straight at showdown",
  { user: ["Js", "Td"], board: ["9c", "8h", "7s", "2c", "3d"], variant: "holdem" },
  "A straight — strong, though a flush can still beat you and a paired board threatens a full house.");

golden("full house — set with paired board",
  { user: ["5s", "5h"], board: ["5c", "9h", "9d", "Qs", "2c"], variant: "holdem" },
  "A full house — almost always the winner. Quads or a higher boat are the only real threats.");

golden("four of a kind",
  { user: ["Ks", "Kh"], board: ["Kc", "Kd", "7s", "2h", "3c"], variant: "holdem" },
  "Four of a kind — almost a lock.");

// --- 5-Card Draw ------------------------------------------------------

golden("5cd: pair of aces",
  { user: ["As", "Ah", "7d", "5c", "2s"], board: [], variant: "fivecard" },
  "A pair of aces — okay, but easily beaten in a multiway pot.");

golden("5cd: two pair",
  { user: ["As", "Ah", "7d", "7c", "2s"], board: [], variant: "fivecard" },
  "Two pair, aces and sevens — decent, often enough at small tables.");

golden("5cd: trips",
  { user: ["As", "Ah", "Ad", "7c", "2s"], board: [], variant: "fivecard" },
  "Three of a kind, aces — strong.");

// --- 7-Stud ----------------------------------------------------------

golden("7-stud: rolled-up trips on 3rd street",
  { user: ["Js", "Jh", "Jd"], board: [], variant: "sevenstud" },
  "Three jacks already — trips with cards to come.");

golden("7-stud: pair on 3rd street",
  { user: ["Js", "Jh", "3d"], board: [], variant: "sevenstud" },
  "A pair of jacks — a foundation to draw to.");

golden("7-stud: three to a flush",
  { user: ["Jd", "8d", "3d"], board: [], variant: "sevenstud" },
  "Three to a flush — a live drawing hand.");

/* ============================================================
 * (2) STRUCTURAL INVARIANTS — claims must match the cards.
 * ============================================================ */

/**
 * A handful of named setups we sweep with property checks. Diverse enough
 * to exercise each claim type without ballooning the test count.
 *
 * @type {Array<{ name: string, user: string[], board: string[], variant: string }>}
 */
const STRUCTURAL_FIXTURES = [
  { name: "AA preflop",          user: ["As", "Ah"], board: [],                             variant: "holdem" },
  { name: "72o preflop",         user: ["7c", "2d"], board: [],                             variant: "holdem" },
  { name: "AKs preflop",         user: ["As", "Ks"], board: [],                             variant: "holdem" },
  { name: "55 preflop",          user: ["5s", "5h"], board: [],                             variant: "holdem" },
  { name: "AA on rainbow",       user: ["As", "Ah"], board: ["7c", "4d", "2s"],             variant: "holdem" },
  { name: "AA on 2-flush",       user: ["As", "Ah"], board: ["7d", "8d", "3c"],             variant: "holdem" },
  { name: "top pair K-high",     user: ["As", "Kh"], board: ["Kc", "7d", "2s"],             variant: "holdem" },
  { name: "set of fives",        user: ["5s", "5h"], board: ["5c", "9h", "Qs"],             variant: "holdem" },
  { name: "trips kings",         user: ["Ks", "Th"], board: ["Kc", "Kd", "4s"],             variant: "holdem" },
  { name: "board trips fives",   user: ["7c", "8d"], board: ["5s", "5h", "5c"],             variant: "holdem" },
  { name: "flush draw",          user: ["Jd", "9d"], board: ["6d", "Kd", "2s"],             variant: "holdem" },
  { name: "OESD 89-on-7T",       user: ["9h", "Th"], board: ["7c", "8s", "2d"],             variant: "holdem" },
  { name: "gutshot",             user: ["7h", "Tc"], board: ["8d", "6s", "2c"],             variant: "holdem" },
  { name: "3-flush board",       user: ["As", "Kh"], board: ["2d", "8d", "Jd"],             variant: "holdem" },
  { name: "paired board",        user: ["Ah", "Qs"], board: ["Kd", "Kc", "4s"],             variant: "holdem" },
  { name: "made flush river",    user: ["9d", "Jd"], board: ["2d", "5d", "7d", "Ks", "3c"], variant: "holdem" },
  { name: "made straight",       user: ["Js", "Td"], board: ["9c", "8h", "7s", "2c", "3d"], variant: "holdem" },
];

function proseFor(f) {
  return streetSummary({
    userCards: hand(...f.user),
    boardCards: hand(...f.board),
    variant: f.variant,
  });
}

test("invariant: 'flush draw' ⟹ user has ≥1 card in a 4-card flush suit", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    if (!/You're on a flush draw/.test(prose)) continue;
    const userCards = hand(...f.user);
    const boardCards = hand(...f.board);
    const counts = new Array(4).fill(0);
    for (const c of [...userCards, ...boardCards]) counts[c.suit]++;
    let suit = -1;
    for (let s = 0; s < 4; s++) if (counts[s] === 4) { suit = s; break; }
    assert.ok(suit >= 0, `${f.name}: claims flush draw but no 4-card flush exists`);
    assert.ok(userCards.some(c => c.suit === suit),
      `${f.name}: claims flush draw without user contributing a card in the flush suit`);
  }
});

test("invariant: 'set of X' ⟹ user holds a pocket pair of X and board has one X", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    const m = /A set of (aces|kings|queens|jacks|tens|nines|eights|sevens|sixes|fives|fours|threes|deuces)/.exec(prose);
    if (!m) continue;
    const rank = nameToRank(m[1]);
    const userCards = hand(...f.user);
    const boardCards = hand(...f.board);
    const userCount = userCards.filter(c => c.rank === rank).length;
    const boardCount = boardCards.filter(c => c.rank === rank).length;
    assert.equal(userCount, 2, `${f.name}: claims set of ${m[1]} but user holds ${userCount}, not 2`);
    assert.equal(boardCount, 1, `${f.name}: claims set of ${m[1]} but board has ${boardCount}, not 1`);
  }
});

test("invariant: 'trips, X' (not set) ⟹ user has one X, board has two X", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    if (/A set of/.test(prose) || /Three .+ on the board/.test(prose)) continue;
    const m = /Trips, (aces|kings|queens|jacks|tens|nines|eights|sevens|sixes|fives|fours|threes|deuces)/.exec(prose);
    if (!m) continue;
    const rank = nameToRank(m[1]);
    const userCards = hand(...f.user);
    const boardCards = hand(...f.board);
    assert.equal(userCards.filter(c => c.rank === rank).length, 1,
      `${f.name}: claims trips ${m[1]} but user doesn't hold exactly 1`);
    assert.equal(boardCards.filter(c => c.rank === rank).length, 2,
      `${f.name}: claims trips ${m[1]} but board doesn't have exactly 2`);
  }
});

test("invariant: 'Three X on the board' ⟹ board has 3 X and user has 0 X", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    const m = /Three (aces|kings|queens|jacks|tens|nines|eights|sevens|sixes|fives|fours|threes|deuces) on the board/.exec(prose);
    if (!m) continue;
    const rank = nameToRank(m[1]);
    const userCards = hand(...f.user);
    const boardCards = hand(...f.board);
    assert.equal(boardCards.filter(c => c.rank === rank).length, 3, `${f.name}: board doesn't have 3 ${m[1]}`);
    assert.equal(userCards.filter(c => c.rank === rank).length, 0, `${f.name}: user shouldn't hold any ${m[1]}`);
  }
});

test("invariant: 'overpair' ⟹ user has pocket pair higher than every board card", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    if (!/overpair to the board/.test(prose)) continue;
    const userCards = hand(...f.user);
    const boardCards = hand(...f.board);
    assert.equal(userCards.length, 2);
    assert.equal(userCards[0].rank, userCards[1].rank, `${f.name}: 'overpair' without pocket pair`);
    const maxBoard = Math.max(...boardCards.map(c => c.rank));
    assert.ok(userCards[0].rank > maxBoard,
      `${f.name}: pocket pair ${userCards[0].rank} not greater than max board ${maxBoard}`);
  }
});

test("invariant: 'Top pair, X' ⟹ X is the highest rank on the board", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    const m = /Top pair, (aces|kings|queens|jacks|tens|nines|eights|sevens|sixes|fives|fours|threes|deuces)/.exec(prose);
    if (!m) continue;
    const rank = nameToRank(m[1]);
    const boardCards = hand(...f.board);
    const maxBoard = Math.max(...boardCards.map(c => c.rank));
    assert.equal(rank, maxBoard, `${f.name}: top pair claims ${m[1]} but board top is ${maxBoard}`);
  }
});

test("invariant: 'open-ended straight draw' ⟹ 4 consecutive ranks present", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    if (!/open-ended straight draw/.test(prose)) continue;
    const allRanks = new Set([...hand(...f.user), ...hand(...f.board)].map(c => c.rank));
    let found = false;
    for (let top = 14; top >= 5 && !found; top--) {
      if (allRanks.has(top) && allRanks.has(top - 1) && allRanks.has(top - 2) && allRanks.has(top - 3)) {
        found = true;
      }
    }
    assert.ok(found, `${f.name}: claims OESD but no 4-in-a-row exists`);
  }
});

test("invariant: 'gutshot straight draw' ⟹ exactly 4 of 5 in a window with an inside miss", () => {
  for (const f of STRUCTURAL_FIXTURES) {
    const prose = proseFor(f);
    if (!/gutshot straight draw/.test(prose)) continue;
    const ranks = new Set([...hand(...f.user), ...hand(...f.board)].map(c => c.rank));
    if (ranks.has(14)) ranks.add(1); // ace plays low for the wheel
    let found = false;
    for (let top = 14; top >= 5 && !found; top--) {
      let present = 0, missing = -1;
      for (let r = top; r >= top - 4; r--) {
        if (ranks.has(r)) present++;
        else if (missing === -1) missing = r;
        else { present = -1; break; }
      }
      if (present === 4 && missing !== top && missing !== top - 4) found = true;
    }
    assert.ok(found, `${f.name}: claims gutshot but no inside-miss-4-of-5 window exists`);
  }
});

/* ============================================================
 * (3) SIMULATOR CROSS-CHECK — prose lean must match math.
 * ============================================================ */

test("cross-check: AA is genuinely the strongest pre-flop hand (heads-up >80%)", () => {
  const prose = proseFor({ user: ["As", "Ah"], board: [], variant: "holdem" });
  assert.match(prose, /the strongest starting hand/);
  const { winRate } = simulate(hand("As", "Ah"), [], 1, "holdem", SIM_ITERATIONS);
  assert.ok(winRate > 0.80, `AA heads-up equity ${winRate.toFixed(3)} contradicts "strongest" claim`);
});

test("cross-check: 72o is genuinely the worst — heads-up <40%", () => {
  const prose = proseFor({ user: ["7c", "2d"], board: [], variant: "holdem" });
  assert.match(prose, /textbook worst starting hand/);
  const { winRate } = simulate(hand("7c", "2d"), [], 1, "holdem", SIM_ITERATIONS);
  assert.ok(winRate < 0.40, `72o heads-up equity ${winRate.toFixed(3)} too high to call it "worst"`);
});

test("cross-check: 'premium' pre-flop hands beat fair share at a full 6-handed table", () => {
  // Anything labeled "premium" should at minimum exceed its fair share when
  // 6 players sit down. (1/6 ≈ 16.7%.)
  const PREMIUM = [
    ["As", "Ah"],  // AA
    ["Ks", "Kh"],  // KK
    ["As", "Ks"],  // AKs
    ["As", "Kh"],  // AKo
  ];
  for (const cards of PREMIUM) {
    const prose = proseFor({ user: cards, board: [], variant: "holdem" });
    // KK doesn't say "premium" — it says "second only to aces", which is the
    // same lean. Accept either wording.
    assert.match(prose, /premium|strongest|second only to aces/,
      `prose for ${cards.join("")} doesn't read as a premium-lean hand`);
    const { winRate } = simulate(hand(...cards), [], 5, "holdem", SIM_ITERATIONS);
    assert.ok(winRate > 1 / 6 + 0.04,
      `${cards.join("")} reads as premium but only ${winRate.toFixed(3)} at a 6-player table`);
  }
});

test("cross-check: a set on the flop has >55% heads-up equity", () => {
  // "Well hidden, very strong" — back that up with the math.
  const { winRate } = simulate(hand("5s", "5h"), hand("5c", "9h", "Qs"), 1, "holdem", SIM_ITERATIONS);
  const prose = proseFor({ user: ["5s", "5h"], board: ["5c", "9h", "Qs"], variant: "holdem" });
  assert.match(prose, /A set of fives/);
  assert.match(prose, /very strong/);
  assert.ok(winRate > 0.55,
    `set of fives heads-up equity ${winRate.toFixed(3)} too low for "very strong"`);
});

test("cross-check: heads-up note is actually emitted, and the math backs it up", () => {
  // First half: at numPlayers=2 the explainer should emit the heads-up note.
  // (streetSummary skips the player-count line — the note lives in explain()
  // and explainTrajectory().)
  const prose = explain({
    userCards: hand("As", "4d"),
    boardCards: [],
    numPlayers: 2,
    variant: "holdem",
  });
  assert.match(prose, /Heads-up, weaker hands gain value/,
    `explain() at numPlayers=2 didn't emit the heads-up note: ${prose}`);

  // Second half: the math the note implies — going from 6-handed to heads-up
  // should pick A4o up by at least 15pp of equity.
  const cards = hand("As", "4d");
  const headsUp = simulate(cards, [], 1, "holdem", SIM_ITERATIONS).winRate;
  const sixHanded = simulate(cards, [], 5, "holdem", SIM_ITERATIONS).winRate;
  assert.ok(headsUp - sixHanded > 0.15,
    `A4o heads-up ${headsUp.toFixed(3)} vs 6-handed ${sixHanded.toFixed(3)} — gap too small to justify "heads-up gains value"`);
});

test("cross-check: 'flush draw' has ~35% equity to complete by the river (heads-up, on the flop)", () => {
  // Classic poker number: flush draw on the flop ~35% to complete by river.
  const cards = hand("Jd", "9d");
  const board = hand("6d", "Kd", "2s");
  const prose = proseFor({ user: ["Jd", "9d"], board: ["6d", "Kd", "2s"], variant: "holdem" });
  assert.match(prose, /flush draw/);
  const { winRate } = simulate(cards, board, 1, "holdem", SIM_ITERATIONS);
  // Equity is "win at showdown", which is slightly more than the raw draw
  // completion (the existing J-high also wins some rivers vs. random hands).
  assert.ok(winRate > 0.35 && winRate < 0.65,
    `flush-draw equity ${winRate.toFixed(3)} outside expected band 35-65%`);
});

/* ============================================================
 * (4) RECAP — whole-hand synthesis.
 * ============================================================ */

test("recap: pocket jacks → trip-9s board → river ace produces the canonical 'made-but-fell' message", () => {
  // The exact scenario the recap layer was added for: full house on paper,
  // equity drops on the river because anyone holding an ace has a bigger boat.
  const user = hand("Jh", "Jd");
  const trajectory = [
    { label: "Pre-flop", user, board: [],                                            winRate: 0.38 },
    { label: "Flop",     user, board: hand("9c", "9s", "Ts"),                        winRate: 0.27 },
    { label: "Turn",     user, board: hand("9c", "9s", "Ts", "9d"),                  winRate: 0.55 },
    { label: "River",    user, board: hand("9c", "9s", "Ts", "9d", "Ah"),            winRate: 0.31 },
  ];
  const recap = recapHand({ trajectory, variant: "holdem" });
  assert.ok(recap, "recap returned null for a multi-street Hold'em hand");
  assert.match(recap, /nines full of jacks/);
  assert.match(recap, /equity fell from 38% to 31%/);
  assert.match(recap, /biggest drop was on the river/);
  // Article-correctness: must be "an ace", not "a ace".
  assert.match(recap, /anyone holding an ace/);
  assert.doesNotMatch(recap, /anyone holding a ace/);
});

test("recap: rising equity case ends with 'climbed' framing", () => {
  // Set on the flop, hand keeps improving on a dry runout — equity rises.
  const user = hand("5s", "5h");
  const trajectory = [
    { label: "Pre-flop", user, board: [],                                            winRate: 0.32 },
    { label: "Flop",     user, board: hand("5c", "9h", "Qs"),                        winRate: 0.78 },
    { label: "Turn",     user, board: hand("5c", "9h", "Qs", "2d"),                  winRate: 0.82 },
    { label: "River",    user, board: hand("5c", "9h", "Qs", "2d", "7c"),            winRate: 0.85 },
  ];
  const recap = recapHand({ trajectory, variant: "holdem" });
  assert.ok(recap);
  assert.match(recap, /three fives/);
  assert.match(recap, /climbed from 32% to 85%/);
});

test("recap: roughly-flat equity case uses 'steady' framing", () => {
  const user = hand("As", "Kh");
  const trajectory = [
    { label: "Pre-flop", user, board: [],                                            winRate: 0.40 },
    { label: "Flop",     user, board: hand("7c", "4d", "2s"),                        winRate: 0.41 },
    { label: "Turn",     user, board: hand("7c", "4d", "2s", "8h"),                  winRate: 0.40 },
    { label: "River",    user, board: hand("7c", "4d", "2s", "8h", "3c"),            winRate: 0.39 },
  ];
  const recap = recapHand({ trajectory, variant: "holdem" });
  assert.ok(recap);
  assert.match(recap, /roughly steady/);
});

test("recap: returns null when there's no trajectory to synthesize", () => {
  // Single-street fold or no trajectory at all — the per-street narrative
  // already says what happened, recap would be redundant.
  assert.equal(recapHand({ trajectory: [], variant: "holdem" }), null);
  assert.equal(recapHand({
    trajectory: [{ label: "Pre-flop", user: hand("As", "Kh"), board: [], winRate: 0.5 }],
    variant: "holdem",
  }), null);
});

test("recap: returns null for non-Hold'em variants (no community arc)", () => {
  const trajectory = [
    { label: "Hand", user: hand("As", "Ah", "Kd", "5c", "2s"), board: [], winRate: 0.6 },
  ];
  assert.equal(recapHand({ trajectory, variant: "fivecard" }), null);
});

/* ============================================================
 * Helpers
 * ============================================================ */

const RANK_BY_NAME = {
  ace: 14, aces: 14, king: 13, kings: 13, queen: 12, queens: 12,
  jack: 11, jacks: 11, ten: 10, tens: 10, nine: 9, nines: 9,
  eight: 8, eights: 8, seven: 7, sevens: 7, six: 6, sixes: 6,
  five: 5, fives: 5, four: 4, fours: 4, three: 3, threes: 3,
  deuce: 2, deuces: 2,
};
function nameToRank(name) {
  const r = RANK_BY_NAME[name];
  if (!r) throw new Error(`unknown rank name: ${name}`);
  return r;
}
