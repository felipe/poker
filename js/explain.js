// @ts-check
// Plain-prose reading of a poker hand: what you have, what threats are out
// there, and how player count changes the picture. Pure functions, fed the
// same cards the simulator sees. No randomness, no LLM — every sentence
// here is a deterministic function of the cards.

import { evaluate, CATEGORY_DIVISOR } from "./evaluator.js";

/** @typedef {import("./evaluator.js").Card} Card */

const RANK_NAMES = {
  14: "ace", 13: "king", 12: "queen", 11: "jack", 10: "ten",
  9: "nine", 8: "eight", 7: "seven", 6: "six", 5: "five",
  4: "four", 3: "three", 2: "deuce",
};
const RANK_PLURAL = {
  14: "aces", 13: "kings", 12: "queens", 11: "jacks", 10: "tens",
  9: "nines", 8: "eights", 7: "sevens", 6: "sixes", 5: "fives",
  4: "fours", 3: "threes", 2: "deuces",
};

/** @param {number} r */
function rankName(r) { return RANK_NAMES[/** @type {keyof typeof RANK_NAMES} */ (r)] || String(r); }
/** @param {number} r */
function rankPlural(r) { return RANK_PLURAL[/** @type {keyof typeof RANK_PLURAL} */ (r)] || (String(r) + "s"); }

/** @param {Card[]} cards */
function rankCounts(cards) {
  const c = new Array(15).fill(0);
  for (const x of cards) c[x.rank]++;
  return c;
}
/** @param {Card[]} cards */
function suitCounts(cards) {
  const c = new Array(4).fill(0);
  for (const x of cards) c[x.suit]++;
  return c;
}
/** @param {Card[]} cards */
function categoryOf(cards) {
  return Math.floor(evaluate(cards) / CATEGORY_DIVISOR);
}

/**
 * Single-snapshot prose for one street's worth of cards. Returns a one-paragraph
 * read of where the hand sits right now.
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
 * paragraph per street that explicitly calls out improvements, bricks, and
 * waterings since the previous street. The last paragraph is the player-count
 * adjustment so the reader ends with table-size context.
 *
 * @param {Object} ctx
 * @param {Array<{label: string, user: Card[], board: Card[]}>} ctx.streetHistory
 * @param {number} ctx.numPlayers
 * @param {string} ctx.variant
 * @returns {string[]}  one entry per paragraph; join with blank lines to render
 */
export function explainTrajectory(ctx) {
  const { streetHistory, numPlayers, variant } = ctx;
  /** @type {string[]} */
  const paragraphs = [];

  if (streetHistory.length === 0) {
    paragraphs.push(playerCountLine(numPlayers));
    return paragraphs;
  }

  if (variant === "holdem") {
    paragraphs.push(...holdemTrajectoryParagraphs(streetHistory));
  } else {
    // 5-Card Draw and 7-Stud — each street is a fresh snapshot, no community
    // board to threaten you. We label each one so the progression is clear.
    for (const s of streetHistory) {
      const para = snapshotParagraph(s.user, s.board, variant);
      paragraphs.push(streetHistory.length > 1 ? `${s.label}: ${decap(para)}` : para);
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

/** @param {Card[]} user @param {Card[]} board @param {string} variant */
function snapshotParagraph(user, board, variant) {
  if (variant === "holdem") {
    if (board.length === 0) return holdemPreflop(user);
    const parts = [holdemMadeHand(user, board)];
    const draws = holdemDraws(user, board);
    if (draws) parts.push(draws);
    const threats = holdemBoardThreats(user, board);
    if (threats) parts.push(threats);
    return parts.join(" ");
  }
  return noBoardRead(user);
}

/** @param {string} s */
function decap(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

/**
 * Builds one paragraph per Hold'em street, threading state through so each
 * paragraph can describe what *changed* (improved, bricked, or watered) rather
 * than re-stating the static read.
 *
 * @param {Array<{label: string, user: Card[], board: Card[]}>} history
 * @returns {string[]}
 */
function holdemTrajectoryParagraphs(history) {
  /** @type {string[]} */
  const paragraphs = [];
  /** @type {ReturnType<typeof readHoldemState> | null} */
  let prev = null;

  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    const state = readHoldemState(s.user, s.board);

    if (i === 0) {
      // Pre-flop (or whatever the first snapshot is for this hand).
      paragraphs.push(state.summary);
      prev = state;
      continue;
    }

    const lower = s.label.toLowerCase();
    /** @type {string[]} */
    const parts = [];

    if (prev && prev.category === -1) {
      // Pre-flop → flop. Neutral lead — the flop is the first time we have a
      // made-hand category at all, so "helped" or "brick" both feel wrong.
      parts.push(`On the ${lower}, ${decap(state.madeLine)}`);
    } else if (prev && state.category > prev.category) {
      parts.push(`The ${lower} helped — ${decap(state.madeLine)}`);
    } else if (prev && state.madeLine === prev.madeLine) {
      // Same made hand. The interesting question is whether the board got
      // worse — new threats appearing means the hand was watered even though
      // its category didn't budge.
      if (state.threats && state.threats !== prev.threats) {
        parts.push(`The ${lower} didn't improve your hand, but the board got worse for you.`);
      } else if (state.draws && state.draws !== prev.draws) {
        parts.push(`The ${lower} didn't improve your hand, but you picked up a draw.`);
      } else if (prev.draws && !state.draws && s.board.length === 5) {
        parts.push(`The ${lower} bricked — your draw didn't come in.`);
      } else {
        parts.push(`The ${lower} was a brick — nothing changed.`);
      }
    } else {
      parts.push(`On the ${lower}, ${decap(state.madeLine)}`);
    }

    // New draws and threats since the previous street get their own sentences.
    if (state.draws && (!prev || state.draws !== prev.draws)) parts.push(state.draws);
    if (state.threats && (!prev || state.threats !== prev.threats)) parts.push(state.threats);

    paragraphs.push(parts.join(" "));
    prev = state;
  }

  return paragraphs;
}

/**
 * @param {Card[]} user
 * @param {Card[]} board
 */
function readHoldemState(user, board) {
  if (board.length === 0) {
    return {
      summary: holdemPreflop(user),
      madeLine: holdemPreflop(user),
      draws: /** @type {string|null} */ (null),
      threats: /** @type {string|null} */ (null),
      category: -1,
    };
  }
  const madeLine = holdemMadeHand(user, board);
  const draws = holdemDraws(user, board);
  const threats = holdemBoardThreats(user, board);
  const summary = [madeLine, draws, threats].filter(Boolean).join(" ");
  return {
    summary,
    madeLine,
    draws,
    threats,
    category: categoryOf(user.concat(board)),
  };
}

/* ---------- Hold'em pre-flop ---------- */

/** @param {Card[]} cards */
function holdemPreflop(cards) {
  const [hi, lo] = cards[0].rank >= cards[1].rank ? cards : [cards[1], cards[0]];
  const suited = cards[0].suit === cards[1].suit;
  const gap = hi.rank - lo.rank;

  if (hi.rank === lo.rank) {
    if (hi.rank === 14) return "Pocket aces — the strongest starting hand in Hold'em.";
    if (hi.rank === 13) return "Pocket kings — second only to aces, with an ace on the flop the only real nightmare.";
    if (hi.rank === 12) return "Pocket queens — premium, but you'll sweat every ace or king that comes.";
    if (hi.rank === 11) return "Pocket jacks — strong, but any overcard on the flop chips at your confidence.";
    if (hi.rank >= 8) return `Pocket ${rankPlural(hi.rank)} — a solid middle pair, ahead of most random hands but easily outflopped.`;
    return `Pocket ${rankPlural(hi.rank)} — a small pair. Usually you need to flop a set or fold to action on overcards.`;
  }

  if (hi.rank === 14 && lo.rank === 13) {
    return suited
      ? "Ace-king suited — premium. Flops top pair often and has both flush and straight potential."
      : "Ace-king off-suit — premium high-card hand, but you usually need to pair to win the pot.";
  }
  if (hi.rank === 14 && lo.rank >= 11) {
    return suited
      ? `Ace-${rankName(lo.rank)} suited — strong, with flush potential backing up the high cards.`
      : `Ace-${rankName(lo.rank)} off-suit — solid, but dominated by ace-king and bigger pairs.`;
  }
  if (hi.rank === 14) {
    return suited
      ? "A suited ace with a weak kicker — playable for the nut-flush potential, but the kicker often costs you the pot."
      : "An ace with a weak off-suit kicker — easily dominated, especially in a multiway pot.";
  }
  if (hi.rank >= 12 && lo.rank >= 10) {
    return suited
      ? "Suited broadway — flops top pair often and has straight and flush potential."
      : "Broadway off-suit — decent, but vulnerable to bigger pairs and ace-high hands.";
  }
  if (hi.rank === 7 && lo.rank === 2 && !suited) {
    return "Seven-deuce off-suit — the textbook worst starting hand in the game.";
  }
  if (suited && gap <= 2) {
    return "Suited connectors — speculative. You're playing for straights, flushes, and the occasional surprise two pair.";
  }
  if (suited) {
    return "Suited but disconnected — the flush draw is the main reason to play; the straight is a long shot.";
  }
  if (gap <= 2 && hi.rank <= 10) {
    return "Off-suit connectors — speculative. Plays for straights, but easily dominated.";
  }
  return "A marginal off-suit hand — needs a friendly flop to be worth more than fold equity.";
}

/* ---------- Hold'em post-flop ---------- */

/**
 * @param {Card[]} user
 * @param {Card[]} board
 */
function holdemMadeHand(user, board) {
  const all = user.concat(board);
  const category = categoryOf(all);
  const userRC = rankCounts(user);
  const boardRC = rankCounts(board);
  const allRC = rankCounts(all);

  if (category === 0) {
    const high = user.reduce((a, b) => (a.rank > b.rank ? a : b));
    return `You haven't paired anything yet — your best card is the ${rankName(high.rank)}.`;
  }

  if (category === 1) {
    let pr = 0;
    for (let r = 14; r >= 2; r--) if (allRC[r] === 2) { pr = r; break; }
    if (userRC[pr] === 2) {
      const maxBoard = Math.max(...board.map(c => c.rank));
      if (pr > maxBoard) return `Your pocket ${rankPlural(pr)} are an overpair to the board — strong.`;
      return `Your pocket ${rankPlural(pr)} are under the board's high card — vulnerable to anyone who's hit a pair on the flop.`;
    }
    if (boardRC[pr] === 2) {
      return `The board has a pair of ${rankPlural(pr)} that doesn't involve your hand — you're effectively playing for kicker.`;
    }
    const boardSorted = board.map(c => c.rank).sort((a, b) => b - a);
    const idx = boardSorted.indexOf(pr);
    const kicker = user.find(c => c.rank !== pr);
    const kickerStr = kicker ? `, ${rankName(kicker.rank)} kicker` : "";
    if (idx === 0) return `Top pair, ${rankPlural(pr)}${kickerStr} — a solid one-pair hand.`;
    if (idx === boardSorted.length - 1) return `Bottom pair, ${rankPlural(pr)}${kickerStr} — weak, easily outkicked or outdrawn.`;
    return `Middle pair, ${rankPlural(pr)}${kickerStr} — okay, but two board cards beat it.`;
  }

  if (category === 2) {
    /** @type {number[]} */ const pairs = [];
    for (let r = 14; r >= 2; r--) if (allRC[r] >= 2) pairs.push(r);
    const [p1, p2] = pairs;
    return `Two pair, ${rankPlural(p1)} and ${rankPlural(p2)} — strong, but a paired board can already be a full house for someone.`;
  }

  if (category === 3) {
    let tr = 0;
    for (let r = 14; r >= 2; r--) if (allRC[r] === 3) { tr = r; break; }
    if (userRC[tr] === 2) return `A set of ${rankPlural(tr)} — your pocket pair hit the board. Well hidden, very strong.`;
    if (boardRC[tr] === 3) return `Three ${rankPlural(tr)} on the board — you have the trips, but so does everyone else. It comes down to kickers, and anyone with a pocket pair has a full house.`;
    return `Trips, ${rankPlural(tr)} — strong, but the case ${rankName(tr)} in someone's hand makes quads.`;
  }

  if (category === 4) return "A straight — strong, though a flush can still beat you and a paired board threatens a full house.";
  if (category === 5) return "A flush — strong. Watch for a higher flush or a paired board.";
  if (category === 6) return "A full house — almost always the winner. Quads or a higher boat are the only real threats.";
  if (category === 7) return "Four of a kind — almost a lock.";
  return "A straight flush — the nuts.";
}

/**
 * Draws only matter when there's a card to come.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 */
function holdemDraws(user, board) {
  if (board.length >= 5) return null;
  const all = user.concat(board);
  const category = categoryOf(all);
  if (category >= 4) return null; // Already on a straight or better — no point chasing.

  /** @type {string[]} */ const parts = [];
  const sc = suitCounts(all);
  for (let s = 0; s < 4; s++) {
    if (sc[s] === 4) {
      const userInSuit = user.filter(c => c.suit === s).length;
      if (userInSuit > 0) {
        parts.push("You're on a flush draw — nine cards complete it.");
      }
      break;
    }
  }

  const rankSet = new Set(all.map(c => c.rank));
  // Ace also plays low for the wheel (A-2-3-4-5).
  /** @type {Set<number>} */ const rs = new Set(rankSet);
  if (rs.has(14)) rs.add(1);

  let oesd = false;
  for (let top = 14; top >= 4; top--) {
    if (rs.has(top) && rs.has(top - 1) && rs.has(top - 2) && rs.has(top - 3)) {
      // Open-ended means both ends are in-deck. The wheel and broadway runs
      // (A-2-3-4 or J-Q-K-A) only complete on one side — those are gutshots.
      if (top <= 13 && (top - 3) >= 2) {
        oesd = true;
        break;
      }
    }
  }

  let gutshot = false;
  if (!oesd) {
    for (let top = 14; top >= 5; top--) {
      let present = 0;
      let missing = -1;
      for (let r = top; r >= top - 4; r--) {
        if (rs.has(r)) present++;
        else if (missing === -1) missing = r;
        else { present = -1; break; } // Two or more missing — not a 4-of-5 window.
      }
      // The miss has to be interior; an end-miss collapses to a 4-in-a-row case we already checked.
      if (present === 4 && missing !== top && missing !== top - 4) {
        gutshot = true;
        break;
      }
    }
  }

  if (oesd) parts.push("You've got an open-ended straight draw — eight cards complete it.");
  else if (gutshot) parts.push("You've got a gutshot straight draw — four cards complete it.");

  return parts.length ? parts.join(" ") : null;
}

/**
 * Tells about the board itself — flush threats, paired-board threats,
 * connected boards. Only fires when the threat is from someone else, not
 * when the same texture is already powering your hand.
 *
 * @param {Card[]} user
 * @param {Card[]} board
 */
function holdemBoardThreats(user, board) {
  /** @type {string[]} */ const parts = [];
  const bSC = suitCounts(board);
  const bRC = rankCounts(board);
  const category = categoryOf(user.concat(board));

  const moreToCome = board.length < 5;

  if (category < 5) {
    let threeSuit = -1;
    for (let s = 0; s < 4; s++) if (bSC[s] >= 3) { threeSuit = s; break; }
    if (threeSuit >= 0) {
      const userInSuit = user.filter(c => c.suit === threeSuit).length;
      if (userInSuit === 0) {
        parts.push("The board already has three of one suit — anyone holding two of that suit has made a flush.");
      }
      // userInSuit >= 1 means it's our flush draw, already named.
    } else if (moreToCome) {
      // Two-of-a-suit only matters when there's a card to come.
      let twoSuit = -1;
      for (let s = 0; s < 4; s++) if (bSC[s] === 2) { twoSuit = s; break; }
      if (twoSuit >= 0) {
        const userInSuit = user.filter(c => c.suit === twoSuit).length;
        if (userInSuit === 0) {
          parts.push("Two of one suit on the board means flush draws are live for anyone holding the suit.");
        }
      }
    }
  }

  if (category < 6) {
    let boardPair = 0;
    for (let r = 2; r <= 14; r++) if (bRC[r] === 2) boardPair = r;
    // Board-trips are already covered by the made-hand line, so skip here.
    if (boardPair && category < 3) {
      parts.push(`The paired ${rankPlural(boardPair)} on the board mean anyone holding the case card has trips already.`);
    }
  }

  if (category < 4 && board.length >= 3) {
    const uniq = Array.from(new Set(board.map(c => c.rank)));
    let connected = false;
    for (let lo = 2; lo <= 10; lo++) {
      let count = 0;
      for (const r of uniq) if (r >= lo && r <= lo + 4) count++;
      if (count >= 3) { connected = true; break; }
    }
    if (connected) {
      parts.push("The board's connected enough that a straight or straight draw is realistic.");
    }
  }

  return parts.length ? parts.join(" ") : null;
}

/* ---------- 5-Card Draw and 7-Stud ---------- */

/** @param {Card[]} cards */
function noBoardRead(cards) {
  if (cards.length < 5) {
    const rc = rankCounts(cards);
    const sc = suitCounts(cards);
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 3) return `Three ${rankPlural(r)} already — trips with cards to come.`;
    }
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 2) return `A pair of ${rankPlural(r)} — a foundation to draw to.`;
    }
    if (Math.max(...sc) >= 3) return "Three to a flush — a live drawing hand.";
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `High card so far — your best is the ${rankName(ranks[0])}.`;
  }

  const category = categoryOf(cards);
  const rc = rankCounts(cards);
  if (category === 0) {
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    return `Your high card is the ${rankName(ranks[0])} — no pair, no draw, just card-rank.`;
  }
  if (category === 1) {
    let pr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) { pr = r; break; }
    return `A pair of ${rankPlural(pr)} — okay, but easily beaten in a multiway pot.`;
  }
  if (category === 2) {
    /** @type {number[]} */ const ps = [];
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) ps.push(r);
    return `Two pair, ${rankPlural(ps[0])} and ${rankPlural(ps[1])} — decent, often enough at small tables.`;
  }
  if (category === 3) {
    let tr = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 3) { tr = r; break; }
    return `Three of a kind, ${rankPlural(tr)} — strong.`;
  }
  if (category === 4) return "A straight — strong.";
  if (category === 5) return "A flush — strong.";
  if (category === 6) return "A full house — very strong.";
  if (category === 7) return "Four of a kind — nearly a lock.";
  return "A straight flush — the nuts.";
}

/* ---------- Player-count modifier ---------- */

/** @param {number} n */
function playerCountLine(n) {
  if (n === 2) return "Heads-up, weaker hands gain value — fewer ways for an opponent to have you beat.";
  if (n <= 4) return `${n}-handed gives marginal hands more room to play.`;
  if (n <= 6) return `With ${n} players, somebody usually has something — be careful with marginal hands.`;
  return `At a full ${n}-handed table, expect strong hands to be out — fold marginal stuff without solid odds.`;
}
