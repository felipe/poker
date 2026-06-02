// @ts-check
// Texas Hold'em prose: the per-street snapshot read, the trajectory walk that
// describes what changed between streets, and the whole-hand recap.

import {
  rankName, rankPlural, aOrAn, rankCounts, suitCounts,
  categoryOf, decap, drawPctText,
} from "./core.js";
import { rngFor, cardsKey, pick } from "../prose.js";

/** @typedef {import("../evaluator.js").Card} Card */

// Editorial tails for the made-hand read. The factual core (e.g. "Top pair,
// kings, ace kicker") is fixed — it carries the tokens the invariants and the
// inline glossary key off — and only this framing varies, drawn per situation
// by a seeded RNG. Every entry in a pool must be faithful for that strength
// bucket and must not contradict any threat line that can render alongside it.
const MADE_TAILS = {
  overpair: [
    "strong.",
    "a strong made hand.",
    "you're ahead of one pair.",
    "a commanding overpair.",
  ],
  underpair: [
    "vulnerable to anyone who's hit a pair on the flop.",
    "exposed if someone paired the board.",
    "behind any top pair.",
    "weak here; overcards on the board beat you if they connected.",
  ],
  boardPair: [
    "you're effectively playing for kicker.",
    "it's a kicker battle from here.",
    "your hand plays the board's pair, so kickers decide it.",
    "what you really hold is your kicker.",
  ],
  topPair: [
    "a solid one-pair hand.",
    "strong for one pair.",
    "a good one-pair holding.",
    "a decent top pair.",
  ],
  bottomPair: [
    "weak, easily outkicked or outdrawn.",
    "thin, easily outkicked.",
    "a weak pair you can't get attached to.",
    "marginal at best.",
  ],
  middlePair: [
    "okay, but two board cards beat it.",
    "marginal; overcards have it in trouble.",
    "playable, though higher pairs are ahead.",
    "a middling pair; tread carefully.",
  ],
  twoPair: [
    "strong, but a paired board can already be a full house for someone.",
    "strong, though a paired board threatens a boat.",
    "a powerful two pair; mind a paired board.",
    "strong, just wary of a board pair making a full house.",
  ],
  set: [
    "Well hidden, very strong.",
    "Disguised and powerful.",
    "A big hand, and hard to read.",
    "Concealed and strong.",
  ],
  boardTrips: [
    "you have the trips, but so does everyone else. It comes down to kickers, and anyone with a pocket pair has a full house.",
    "everyone at the table plays these trips — kickers decide it, and a pocket pair makes a full house.",
    "the trips are shared; your kicker is what matters, and any pocket pair beats you with a boat.",
    "you hold trips along with the whole table. Kickers break the tie, and a pocket pair already has a full house.",
  ],
  trips: [
    "strong, but the paired board already gives a full house to anyone with a pocket pair that matches another board card.",
    "strong, though the paired board hands a full house to a matching pocket pair.",
    "a strong hand, wary that the paired board makes a boat for some pocket pairs.",
    "powerful, but a paired board means a pocket pair could already have a full house.",
  ],
  straight: [
    "strong, though a flush can still beat you and a paired board threatens a full house.",
    "strong, but flushes and full houses outrank it.",
    "a strong made hand; higher straights, flushes, and boats are the worry.",
    "strong, just mindful of flushes and a paired board.",
  ],
  flush: [
    "strong. Watch for a higher flush or a paired board.",
    "strong; a higher flush or a boat are the threats.",
    "a powerful hand; only a bigger flush or a full house tops it.",
    "strong, with a higher flush or a paired board the main concerns.",
  ],
  fullHouse: [
    "almost always the winner. Quads or a higher boat are the only real threats.",
    "a near-lock; only quads or a bigger boat beat it.",
    "very strong; bigger full houses and quads are the only worry.",
    "almost the winner, watching only for quads or a higher full house.",
  ],
  quads: [
    "almost a lock.",
    "all but unbeatable.",
    "a virtual lock.",
    "as good as it gets, short of a straight flush.",
  ],
  straightFlush: [
    "the nuts.",
    "unbeatable.",
    "the best possible hand.",
    "as good as poker gets.",
  ],
  highCardLead: [
    "You haven't paired anything yet",
    "Nothing's connected yet",
    "No pair so far",
    "Nothing made yet",
  ],
};

// Editorial tails for the pre-flop read, same fixed-core/varied-tail rule. The
// equity-anchored lean tokens the simulator cross-checks assert — "the
// strongest starting hand", "textbook worst", "premium", "second only to aces"
// — appear in EVERY variant of their branch, so the claim stays true and
// testable however the line is phrased. No tail carries its own em-dash (the
// core already provides one).
const PREFLOP_TAILS = {
  aces: [
    "the strongest starting hand in Hold'em.",
    "the strongest starting hand in Hold'em; nothing's ahead of you.",
    "the strongest starting hand there is. Raise and build the pot.",
    "the strongest starting hand in the game, just don't slow-play into a multiway mess.",
  ],
  kings: [
    "second only to aces, with an ace on the flop the only real nightmare.",
    "second only to aces; an ace on the flop is the one card you fear.",
    "second only to aces, premium, but every ace that flops stings.",
    "second only to aces. Re-raise and play it fast.",
  ],
  queens: [
    "premium, but you'll sweat every ace or king that comes.",
    "a premium pair, though overcards on the flop will test your nerve.",
    "premium; strong, but an ace or king overhead is always a worry.",
    "a top-tier pair, just wary of the ace or king that flops.",
  ],
  jacks: [
    "strong, but any overcard on the flop chips at your confidence.",
    "a strong pair, though overcards on the flop are a constant worry.",
    "strong; you'd love a jack-high flop and dread anything bigger.",
    "powerful, but overcards make it a tricky hand to play.",
  ],
  midPair: [
    "a solid middle pair, ahead of most random hands but easily outflopped.",
    "a decent middle pair, usually best preflop but often awkward after it.",
    "a middling pair; you're ahead now, but overcards will come.",
    "playable, ahead of random hands but vulnerable once bigger cards land.",
  ],
  smallPair: [
    "a small pair. Usually you need to flop a set or fold to action on overcards.",
    "a small pair, so set-mine cheaply or fold to action on overcards.",
    "a speculative small pair; flop a set or let it go to overcards.",
    "a small pair. Without a set, fold to action on overcards.",
  ],
  aceKingSuited: [
    "premium. Flops top pair often and has both flush and straight potential.",
    "premium; big-card strength plus flush and straight upside.",
    "a premium holding, flopping top pair often with flush potential behind it.",
    "premium, pairing to a strong top pair with the suit to back it up.",
  ],
  aceKingOff: [
    "premium high-card hand, but you usually need to pair to win the pot.",
    "a premium high-card hand; you'll usually need to pair up to win.",
    "premium, though without a pair it's just ace-high at showdown.",
    "premium high cards, but pairing the board is the usual path to the pot.",
  ],
  aceBroadwaySuited: [
    "strong, with flush potential backing up the high cards.",
    "a strong suited hand; the flush draw backs up two big cards.",
    "strong, pairing well and carrying nut-flush upside.",
    "a solid suited ace with real flush potential behind it.",
  ],
  aceBroadwayOff: [
    "solid, but dominated by ace-king and bigger pairs.",
    "decent, though ace-king and the big pairs have it beat.",
    "playable, but wary of domination by stronger aces.",
    "a fair high-card hand, often behind a better ace.",
  ],
  weakAceSuited: [
    "playable for the nut-flush potential, but the kicker often costs you the pot.",
    "worth a look for the nut-flush draw, though the weak kicker is a trap.",
    "speculative; you're really playing the suit, not the ace.",
    "the nut-flush upside is the draw here, but the kicker bleeds chips.",
  ],
  weakAceOff: [
    "easily dominated, especially in a multiway pot.",
    "a weak ace, often outkicked when it pairs.",
    "trouble in a multiway pot; the kicker rarely holds up.",
    "thin, and frequently dominated by a better ace.",
  ],
  broadwaySuited: [
    "flops top pair often and has straight and flush potential.",
    "strong; it makes top pair a lot and carries straight and flush outs.",
    "a smooth suited hand with top-pair, straight, and flush upside.",
    "playable and flexible, with both straight and flush potential.",
  ],
  broadwayOff: [
    "decent, but vulnerable to bigger pairs and ace-high hands.",
    "playable, though bigger pairs and stronger aces are ahead.",
    "a fair high-card hand that wants a friendly flop.",
    "okay, but easily second-best against premium holdings.",
  ],
  sevenDeuce: [
    "the textbook worst starting hand in the game.",
    "the textbook worst starting hand in poker. Fold and move on.",
    "by reputation the textbook worst starting hand there is.",
    "the textbook worst starting hand; there's a reason it's the punchline.",
  ],
  suitedConnectors: [
    "speculative. You're playing for straights, flushes, and the occasional surprise two pair.",
    "speculative, but they make straights and flushes and can flop big.",
    "a fun speculative hand; you're drawing to straights and flushes.",
    "speculative. Great implied odds when they connect, easy to fold when they miss.",
  ],
  suitedDisconnected: [
    "the flush draw is the main reason to play; the straight is a long shot.",
    "mostly a flush-draw hand, with little straight potential.",
    "playable for the suit alone; the gap kills most straight chances.",
    "the flush is the draw that matters here, not the straight.",
  ],
  offsuitConnectors: [
    "speculative. Plays for straights, but easily dominated.",
    "speculative; straight potential, but no suit to fall back on.",
    "a marginal speculative hand, drawing thin to straights only.",
    "playable for straights, though it's often dominated.",
  ],
  marginalOff: [
    "needs a friendly flop to be worth more than fold equity.",
    "wants a friendly flop; otherwise there's little here.",
    "a weak holding that needs the board's help to matter.",
    "thin, and only worth playing when the flop cooperates.",
  ],
};

// Draw lines keep their factual stem fixed — "You're on a flush draw", the out
// count, the percentage, and the draw-type tokens the invariants anchor on —
// and vary only the lead verb and the trailing caveat.
const DRAW_FRAGS = {
  flushCaveat: [
    "but a higher flush is possible for anyone holding bigger cards in the suit.",
    "though anyone with two bigger cards in the suit would outflush you.",
    "but beware a higher flush from bigger cards in the same suit.",
    "with the caveat that a bigger flush is always possible.",
  ],
  nutFlourish: [
    "",
    " Nothing beats it if it gets there.",
    " The best flush draw there is.",
    "",
  ],
  straightLead: [
    "You've got",
    "You're on",
    "You hold",
    "You've picked up",
  ],
};

// Board-threat sentences are independent whole sentences, varied as units. Each
// variant keeps the key noun ("flush", "trips", "straight") so the glossary
// still tokenizes it.
const THREAT_FRAGS = {
  threeSuit: [
    "The board already has three of one suit — anyone holding two of that suit has made a flush.",
    "Three of one suit are out — anyone with two cards in it already has a flush.",
    "With three of a suit on the board, two matching cards make a flush for someone.",
  ],
  fourSuit: [
    "The board has four of one suit — anyone holding even a single card of that suit has made a flush.",
    "Four of one suit are out — a single matching card gives someone a flush.",
    "With four to a suit on the board, even one card of it makes a flush.",
  ],
  twoSuit: [
    "Two of one suit on the board means flush draws are live for anyone holding the suit.",
    "Two of a suit are out, so flush draws are live for anyone in that suit.",
    "A two-flush board means anyone holding the suit has a flush draw.",
  ],
  connected: [
    "The board's connected enough that a straight or straight draw is realistic.",
    "The board is connected enough that straights and straight draws are in play.",
    "Connected enough that someone could have a straight or a straight draw.",
  ],
};

/**
 * Single-snapshot Hold'em read: made hand, then any draws and board threats.
 * @param {Card[]} user
 * @param {Card[]} board
 */
export function holdemSnapshot(user, board) {
  if (board.length === 0) return holdemPreflop(user);
  const parts = [holdemMadeHand(user, board)];
  const draws = holdemDraws(user, board);
  if (draws) parts.push(draws);
  const threats = holdemBoardThreats(user, board);
  if (threats) parts.push(threats);
  return parts.join(" ");
}

/**
 * Builds one paragraph per Hold'em street, threading state through so each
 * paragraph can describe what *changed* (improved, bricked, or watered) rather
 * than re-stating the static read.
 *
 * @param {Array<{label: string, user: Card[], board: Card[]}>} history
 * @returns {string[]}
 */
export function holdemTrajectoryParagraphs(history) {
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
 * Whole-hand synthesis. Names the final hand in plain terms, summarizes the
 * equity arc end-to-end, and explicitly calls out the biggest single-street
 * drop with the board change that caused it. Captures the "why did my odds
 * go down when I made a full house" moment.
 *
 * Hold'em only — other variants have no community board to water a made hand,
 * so each street already says what happened in line. Returns null when there's
 * not enough trajectory to recap (single-street hands, pre-flop folds).
 *
 * @param {Object} ctx
 * @param {Array<{label: string, user: Card[], board: Card[], winRate: number}>} ctx.trajectory
 * @param {string} ctx.variant
 * @returns {string|null}
 */
export function recapHand(ctx) {
  const { trajectory, variant } = ctx;
  if (!trajectory || trajectory.length < 2) return null;
  if (variant !== "holdem") return null;
  // Defensive: the recap depends on winRate at every snapshot. If a caller
  // passes trajectory without simulated equities, skip rather than emit NaN%.
  if (trajectory.some(t => !Number.isFinite(t.winRate))) return null;

  const first = trajectory[0];
  const last = trajectory[trajectory.length - 1];
  const startPct = Math.round(first.winRate * 100);
  const endPct = Math.round(last.winRate * 100);
  const delta = last.winRate - first.winRate;
  const finalHand = describeFinalHand(last.user, last.board);

  const SIG = 0.05;

  // Find the biggest single-street equity drop and where it happened.
  let bigDrop = 0;
  let dropIdx = -1;
  for (let i = 1; i < trajectory.length; i++) {
    const d = trajectory[i - 1].winRate - trajectory[i].winRate;
    if (d > bigDrop) { bigDrop = d; dropIdx = i; }
  }

  if (delta >= SIG) {
    return `You ended with ${finalHand}, and your equity climbed from ${startPct}% to ${endPct}% along the way — the board helped you more than it helped opponents.`;
  }

  if (delta <= -SIG) {
    let why = "";
    if (dropIdx >= 0 && bigDrop > SIG) {
      const dropStreet = trajectory[dropIdx];
      const prev = trajectory[dropIdx - 1];
      const reason = reasonForDrop(prev.board, dropStreet.board, last.user);
      const dropPP = Math.round(bigDrop * 100);
      if (reason) {
        why = ` The biggest drop was on the ${dropStreet.label.toLowerCase()} (${dropPP} points): ${reason}.`;
      } else {
        why = ` The biggest single-street drop was on the ${dropStreet.label.toLowerCase()} (${dropPP} points).`;
      }
    }
    return `You ended with ${finalHand}, but your equity fell from ${startPct}% to ${endPct}%.${why} Made hands can mislead — every card on the board that helps you can help opponents more.`;
  }

  return `Your equity stayed roughly steady (${startPct}% → ${endPct}%), ending with ${finalHand}.`;
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

/**
 * Short, prose-friendly description of the best 5-card hand. "Nines full of
 * jacks", "top pair, kings", "ace-high", etc. Differs from holdemMadeHand by
 * dropping the advice tail and using a noun phrase the recap can slot into a
 * sentence ("You ended with ___").
 *
 * @param {Card[]} user
 * @param {Card[]} board
 */
function describeFinalHand(user, board) {
  const all = user.concat(board);
  if (all.length < 5) {
    // Folded before reaching a full hand — describe the holding state instead.
    if (board.length === 0) return "your starting hand";
    return "the hand at the fold point";
  }
  const cat = categoryOf(all);
  const rc = rankCounts(all);

  if (cat === 8) return "a straight flush";
  if (cat === 7) {
    let q = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 4) { q = r; break; }
    return `four ${rankPlural(q)}`;
  }
  if (cat === 6) {
    let t = 0, p = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] >= 3 && !t) t = r;
    for (let r = 14; r >= 2; r--) if (rc[r] >= 2 && r !== t && !p) p = r;
    return `${rankPlural(t)} full of ${rankPlural(p)}`;
  }
  if (cat === 5) return "a flush";
  if (cat === 4) return "a straight";
  if (cat === 3) {
    let t = 0;
    for (let r = 14; r >= 2; r--) if (rc[r] === 3) { t = r; break; }
    return `three ${rankPlural(t)}`;
  }
  if (cat === 2) {
    /** @type {number[]} */ const ps = [];
    for (let r = 14; r >= 2; r--) if (rc[r] >= 2) ps.push(r);
    return `two pair, ${rankPlural(ps[0])} and ${rankPlural(ps[1])}`;
  }
  if (cat === 1) {
    for (let r = 14; r >= 2; r--) if (rc[r] === 2) return `a pair of ${rankPlural(r)}`;
  }
  const highs = all.map(c => c.rank).sort((a, b) => b - a);
  return `${rankName(highs[0])}-high`;
}

/**
 * Identifies what new threat appeared on the board between two snapshots.
 * Returns a fragment that can be spliced into the recap sentence after
 * "the [street] [reason]" — e.g., "the ace on the board means anyone holding
 * an ace makes a full house bigger than your nines-full-of-jacks". Returns
 * null when the change isn't categorically interesting.
 *
 * @param {Card[]} prevBoard
 * @param {Card[]} curBoard
 * @param {Card[]} userCards
 */
function reasonForDrop(prevBoard, curBoard, userCards) {
  if (curBoard.length <= prevBoard.length) return null;
  const prevRC = rankCounts(prevBoard);
  const curRC = rankCounts(curBoard);
  const newCards = curBoard.slice(prevBoard.length);

  // User's pocket pair (Hold'em pre-flop holding), if any.
  let userPair = 0;
  if (userCards.length === 2 && userCards[0].rank === userCards[1].rank) {
    userPair = userCards[0].rank;
  }

  // The key "made-hand-but-equity-fell" case: board already had trips and the
  // new street brought a rank higher than the user's pocket pair. Anyone with
  // that new rank in hand now has a bigger boat.
  let boardTrips = 0;
  for (let r = 14; r >= 2; r--) if (prevRC[r] >= 3) { boardTrips = r; break; }
  if (boardTrips && userPair) {
    for (const c of newCards) {
      if (c.rank !== boardTrips && c.rank > userPair) {
        return `the ${rankName(c.rank)} on the board means anyone holding ${aOrAn(rankName(c.rank))} ${rankName(c.rank)} makes a full house bigger than your ${rankPlural(boardTrips)}-full-of-${rankPlural(userPair)}`;
      }
    }
  }

  // Board just turned into three-of-a-kind.
  for (let r = 14; r >= 2; r--) {
    if (prevRC[r] < 3 && curRC[r] === 3) {
      return `the third ${rankName(r)} put trips on the board — any pocket pair beats one pair, and full houses come easy`;
    }
  }

  // Board just paired (including the flop landing already-paired).
  for (let r = 14; r >= 2; r--) {
    if (prevRC[r] < 2 && curRC[r] === 2) {
      return `the board paired on ${rankPlural(r)}, opening trips and full houses for anyone with that rank`;
    }
  }

  // Three-of-a-suit appeared.
  const prevSC = suitCounts(prevBoard);
  const curSC = suitCounts(curBoard);
  for (let s = 0; s < 4; s++) {
    if (prevSC[s] < 3 && curSC[s] >= 3) {
      return `a third card of one suit hit the board — anyone holding two of that suit has a flush`;
    }
  }

  // Overcard to the user's strongest holding.
  if (userCards.length > 0) {
    const userMax = Math.max(...userCards.map(c => c.rank));
    for (const c of newCards) {
      if (c.rank > userMax) {
        return `the ${rankName(c.rank)} outranks your hand — anyone holding ${aOrAn(rankName(c.rank))} ${rankName(c.rank)} just made top pair`;
      }
    }
  }

  return null;
}

/* ---------- Hold'em pre-flop ---------- */

/** @param {Card[]} cards */
function holdemPreflop(cards) {
  const [hi, lo] = cards[0].rank >= cards[1].rank ? cards : [cards[1], cards[0]];
  const suited = cards[0].suit === cards[1].suit;
  const gap = hi.rank - lo.rank;
  const rng = rngFor(`holdem|preflop|${cardsKey(cards)}`);
  const tail = key => pick(rng, PREFLOP_TAILS[key]);

  if (hi.rank === lo.rank) {
    if (hi.rank === 14) return `Pocket aces — ${tail("aces")}`;
    if (hi.rank === 13) return `Pocket kings — ${tail("kings")}`;
    if (hi.rank === 12) return `Pocket queens — ${tail("queens")}`;
    if (hi.rank === 11) return `Pocket jacks — ${tail("jacks")}`;
    if (hi.rank >= 8) return `Pocket ${rankPlural(hi.rank)} — ${tail("midPair")}`;
    return `Pocket ${rankPlural(hi.rank)} — ${tail("smallPair")}`;
  }

  if (hi.rank === 14 && lo.rank === 13) {
    return suited
      ? `Ace-king suited — ${tail("aceKingSuited")}`
      : `Ace-king off-suit — ${tail("aceKingOff")}`;
  }
  if (hi.rank === 14 && lo.rank >= 11) {
    return suited
      ? `Ace-${rankName(lo.rank)} suited — ${tail("aceBroadwaySuited")}`
      : `Ace-${rankName(lo.rank)} off-suit — ${tail("aceBroadwayOff")}`;
  }
  if (hi.rank === 14) {
    return suited
      ? `A suited ace with a weak kicker — ${tail("weakAceSuited")}`
      : `An ace with a weak off-suit kicker — ${tail("weakAceOff")}`;
  }
  if (hi.rank >= 12 && lo.rank >= 10) {
    return suited
      ? `Suited broadway — ${tail("broadwaySuited")}`
      : `Broadway off-suit — ${tail("broadwayOff")}`;
  }
  if (hi.rank === 7 && lo.rank === 2 && !suited) {
    return `Seven-deuce off-suit — ${tail("sevenDeuce")}`;
  }
  if (suited && gap <= 2) {
    return `Suited connectors — ${tail("suitedConnectors")}`;
  }
  if (suited) {
    return `Suited but disconnected — ${tail("suitedDisconnected")}`;
  }
  if (gap <= 2 && hi.rank <= 10) {
    return `Off-suit connectors — ${tail("offsuitConnectors")}`;
  }
  return `A marginal off-suit hand — ${tail("marginalOff")}`;
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
  // One RNG per situation: the same (session, hole, board) always renders the
  // same wording; a new session or different cards reshuffles the tail.
  const rng = rngFor(`holdem|made|${cardsKey(user)}|${cardsKey(board)}`);

  if (category === 0) {
    // "Best card" used to read off the user's hole only — misleading when the
    // board has a higher card (everyone shares it at showdown). Use combined
    // high and standard "ace-high" / "king-high" phrasing.
    const high = all.reduce((a, b) => (a.rank > b.rank ? a : b));
    return `${pick(rng, MADE_TAILS.highCardLead)} — ${rankName(high.rank)}-high.`;
  }

  if (category === 1) {
    let pr = 0;
    for (let r = 14; r >= 2; r--) if (allRC[r] === 2) { pr = r; break; }
    if (userRC[pr] === 2) {
      const maxBoard = Math.max(...board.map(c => c.rank));
      if (pr > maxBoard) return `Your pocket ${rankPlural(pr)} are an overpair to the board — ${pick(rng, MADE_TAILS.overpair)}`;
      return `Your pocket ${rankPlural(pr)} are under the board's high card — ${pick(rng, MADE_TAILS.underpair)}`;
    }
    if (boardRC[pr] === 2) {
      return `The board has a pair of ${rankPlural(pr)} that doesn't involve your hand — ${pick(rng, MADE_TAILS.boardPair)}`;
    }
    const boardSorted = board.map(c => c.rank).sort((a, b) => b - a);
    const idx = boardSorted.indexOf(pr);
    // The "kicker" the user actually gets to play in their best-5 is the
    // highest non-pair card across hand + board. Call it a "kicker" only if
    // the user's hole-card kicker leads (i.e., beats every non-pair board
    // card). Otherwise just describe what they hold in the hole, since the
    // board's higher kicker is shared by everyone and isn't a true edge.
    const holeKicker = user.find(c => c.rank !== pr);
    const boardKickerMax = Math.max(0, ...board.filter(c => c.rank !== pr).map(c => c.rank));
    let kickerStr = "";
    if (holeKicker) {
      kickerStr = holeKicker.rank > boardKickerMax
        ? `, ${rankName(holeKicker.rank)} kicker`
        : `, with the ${rankName(holeKicker.rank)} in the hole`;
    }
    if (idx === 0) return `Top pair, ${rankPlural(pr)}${kickerStr} — ${pick(rng, MADE_TAILS.topPair)}`;
    if (idx === boardSorted.length - 1) return `Bottom pair, ${rankPlural(pr)}${kickerStr} — ${pick(rng, MADE_TAILS.bottomPair)}`;
    return `Middle pair, ${rankPlural(pr)}${kickerStr} — ${pick(rng, MADE_TAILS.middlePair)}`;
  }

  if (category === 2) {
    /** @type {number[]} */ const pairs = [];
    for (let r = 14; r >= 2; r--) if (allRC[r] >= 2) pairs.push(r);
    const [p1, p2] = pairs;
    return `Two pair, ${rankPlural(p1)} and ${rankPlural(p2)} — ${pick(rng, MADE_TAILS.twoPair)}`;
  }

  if (category === 3) {
    let tr = 0;
    for (let r = 14; r >= 2; r--) if (allRC[r] === 3) { tr = r; break; }
    if (userRC[tr] === 2) return `A set of ${rankPlural(tr)} — your pocket pair hit the board. ${pick(rng, MADE_TAILS.set)}`;
    if (boardRC[tr] === 3) return `Three ${rankPlural(tr)} on the board — ${pick(rng, MADE_TAILS.boardTrips)}`;
    return `Trips, ${rankPlural(tr)} — ${pick(rng, MADE_TAILS.trips)}`;
  }

  if (category === 4) return `A straight — ${pick(rng, MADE_TAILS.straight)}`;
  if (category === 5) return `A flush — ${pick(rng, MADE_TAILS.flush)}`;
  if (category === 6) return `A full house — ${pick(rng, MADE_TAILS.fullHouse)}`;
  if (category === 7) return `Four of a kind — ${pick(rng, MADE_TAILS.quads)}`;
  return `A straight flush — ${pick(rng, MADE_TAILS.straightFlush)}`;
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
  const rng = rngFor(`holdem|draws|${cardsKey(user)}|${cardsKey(board)}`);

  /** @type {string[]} */ const parts = [];
  const sc = suitCounts(all);
  for (let s = 0; s < 4; s++) {
    if (sc[s] === 4) {
      const userInSuit = user.filter(c => c.suit === s);
      if (userInSuit.length > 0) {
        const pct = drawPctText(9, board.length);
        if (userInSuit.some(c => c.rank === 14)) {
          parts.push(`You're drawing to the nut flush — 9 outs, ${pct} by the river.${pick(rng, DRAW_FRAGS.nutFlourish)}`);
        } else {
          parts.push(`You're on a flush draw — 9 outs, ${pct} by the river, ${pick(rng, DRAW_FRAGS.flushCaveat)}`);
        }
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

  if (oesd) parts.push(`${pick(rng, DRAW_FRAGS.straightLead)} an open-ended straight draw — 8 outs, ${drawPctText(8, board.length)} by the river.`);
  else if (gutshot) parts.push(`${pick(rng, DRAW_FRAGS.straightLead)} a gutshot straight draw — 4 outs, ${drawPctText(4, board.length)} by the river.`);

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
  const rng = rngFor(`holdem|threats|${cardsKey(user)}|${cardsKey(board)}`);

  const moreToCome = board.length < 5;

  if (category < 5) {
    // Find the deepest single-suit board concentration. With 3 on board,
    // an opponent needs 2 of that suit in hand for a flush; with 4, just 1
    // (or even a pocket pair where one matches); with 5 on board, everyone
    // plays the board's flush — but in that case we'd already have a flush
    // ourselves and category would be >= 5, so we wouldn't be here.
    let flushSuit = -1;
    let flushCount = 0;
    for (let s = 0; s < 4; s++) if (bSC[s] >= 3 && bSC[s] > flushCount) { flushSuit = s; flushCount = bSC[s]; }
    if (flushSuit >= 0) {
      const userInSuit = user.filter(c => c.suit === flushSuit).length;
      if (userInSuit === 0) {
        if (flushCount === 3) {
          parts.push(pick(rng, THREAT_FRAGS.threeSuit));
        } else {
          // 4 on board.
          parts.push(pick(rng, THREAT_FRAGS.fourSuit));
        }
      }
      // userInSuit >= 1 means it's our flush draw (or our flush, in which
      // case category >= 5 and we wouldn't be here), already named.
    } else if (moreToCome) {
      // Two-of-a-suit only matters when there's a card to come.
      let twoSuit = -1;
      for (let s = 0; s < 4; s++) if (bSC[s] === 2) { twoSuit = s; break; }
      if (twoSuit >= 0) {
        const userInSuit = user.filter(c => c.suit === twoSuit).length;
        if (userInSuit === 0) {
          parts.push(pick(rng, THREAT_FRAGS.twoSuit));
        }
      }
    }
  }

  if (category < 6) {
    let boardPair = 0;
    for (let r = 2; r <= 14; r++) if (bRC[r] === 2) boardPair = r;
    // Board-trips are already covered by the made-hand line, so skip here.
    if (boardPair && category < 3) {
      const rp = rankPlural(boardPair);
      parts.push(pick(rng, [
        `The paired ${rp} on the board mean anyone holding the case card has trips already.`,
        `Those paired ${rp} give anyone with the case card trips already.`,
        `Watch the paired ${rp}: anyone holding the last one has trips.`,
      ]));
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
      parts.push(pick(rng, THREAT_FRAGS.connected));
    }
  }

  return parts.length ? parts.join(" ") : null;
}
