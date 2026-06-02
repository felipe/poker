// @ts-check
// Texas Hold'em editorial corpus: the interchangeable framing fragments the
// snapshot/recap logic in holdem.js draws from. Pure data — the factual core of
// every line lives in holdem.js; these pools only vary the wording around it.
// Kept separate so the corpus can be scanned and edited as content, apart from
// the realize logic.

// Editorial tails for the made-hand read. The factual core (e.g. "Top pair,
// kings, ace kicker") is fixed — it carries the tokens the invariants and the
// inline glossary key off — and only this framing varies, drawn per situation
// by a seeded RNG. Every entry in a pool must be faithful for that strength
// bucket and must not contradict any threat line that can render alongside it.
export const MADE_TAILS = {
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
export const PREFLOP_TAILS = {
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
export const DRAW_FRAGS = {
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
export const THREAT_FRAGS = {
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

// Whole-hand recap: the equity figures, the final-hand noun phrase, and the
// "biggest drop was on the [street]" clause are factual anchors and stay fixed;
// only the closing editorial moral varies.
export const RECAP_FRAGS = {
  climbedTail: [
    "the board helped you more than it helped opponents.",
    "the runout favored your hand over the field.",
    "the board kept breaking your way.",
    "each street helped you more than your opponents.",
  ],
  fellTail: [
    "Made hands can mislead — every card on the board that helps you can help opponents more.",
    "A made hand can deceive: the same cards that help you often help opponents more.",
    "Strength on paper isn't strength at showdown — the board helps everyone.",
    "Made hands can lull you; every helpful card can help the field more.",
  ],
  steady: [
    "Your equity stayed roughly steady",
    "Your equity barely moved",
    "Your equity held roughly flat",
    "Little in your equity changed",
  ],
};
