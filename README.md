# Poker Hand Advisor

A single-page poker odds calculator with no build step and no npm/runtime packages. Pick a variant and a player count, deal a hand, and decide whether to play or fold — the app then runs a 10,000-iteration Monte Carlo simulation and grades your decision against the math.

The designer themes (`themes/<slug>.css`) pull display typefaces from Google Fonts via CSS `@import` and therefore need a network connection on first paint; the canonical Dark / Felt / Light themes work fully offline.

## Running

The app uses on-demand CSS for designer themes and Google Fonts `@import`, so it needs to be served over HTTP (`file://` won't work for them). From the project root:

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765/>.

There's no build step. Plain HTML/CSS/JS that runs straight from the browser.

## Variants

- **Texas Hold'em** — 2 hole + 5 community. Decisions at Pre-flop, Flop, Turn, River.
- **5-Card Draw** — 5 cards, one decision.
- **7-Card Stud** — 7 cards across 3rd → 7th street. One decision per street.

The Players selector auto-caps based on what the deck can support after your hand and the board are removed.

## How the math works

### Monte Carlo

`simulate(userRevealed, boardRevealed, numOpponents, variant, iterations)` does, for each iteration:

1. Fill in the user's missing hole/community cards from the remaining deck.
2. Deal random hole cards to each opponent.
3. Score everyone with the 5–7 card evaluator.
4. Count you as a winner (or fractional winner on a tie).

10,000 iterations puts the win rate within ~1 percentage point of its true value while staying instant on every device tested.

### Hand evaluator

`evaluate(cards)` accepts 5–7 cards and returns a packed integer where higher beats lower:

```
score = category × 100⁵ + k₁ × 100⁴ + k₂ × 100³ + … + k₅
```

`category` is 0..8 (high card → straight flush). `k₁..k₅` are kicker ranks (2..14). Packing into a single integer makes comparisons one `>` instead of a structured tie-break.

### Fair-share threshold

Equity > 1 ÷ playercount is the "play" line — you're getting more than your share of the pot if every hand ran to showdown. A ±1 percentage-point band around that line returns **TOSS-UP**, so borderline decisions aren't graded as wrong.

### Mid-hand verdict

On a non-final Play (Hold'em flop/turn/river, Stud 4th–6th street), a quick sim runs at the current state and the status line reports `<street>: math said PLAY / FOLD / TOSS-UP` so you can tell whether you went with or against the math without seeing the actual numbers. The full percentages stay reserved for the post-decision result panel.

## Project layout

```
index.html             slim markup, links CSS, loads js/main.js as a module
css/
  themes.css           built-in theme variable defs (Dark / Felt / Light)
  base.css             structural styles using the variables
js/
  main.js              DOM refs, state, flow, event wiring (entry)
  evaluator.js         card model, deck, shuffle, hand evaluator
  variants.js          VARIANTS, row layouts, player cap, toss-up band
  simulate.js          Monte Carlo simulator
  ui.js                pure DOM helpers: card / breakdown / trajectory render
themes/                on-demand stylesheets for designer themes
  vegas-neon.css         neon marquee
  classic-casino.css     Monte Carlo green felt on burgundy backdrop, gold leaf
  classic-burgundy.css   burgundy velvet panel on dark wood, gold leaf
  brutalist.css          swiss/data-sheet monospace on paper (default)
  brutalist-dark.css     companion dark variant
  editorial.css          serif magazine spread
README.md
.gitignore
```

JS modules use native ES `import` / `export` — no bundler. Each module has
`// @ts-check` at the top, so VS Code's TypeScript service gives you inline
type errors and autocomplete from the JSDoc shapes without any build step.

## Themes

Theme selection lives in the **Settings** panel at the bottom of the main block. The choice persists in `localStorage` and is applied before the first paint to avoid a flash. **Brutalist** is the default — that's what a first-time visitor with no saved preference lands on.

Two kinds of themes:

- **Built-in** (Dark / Felt / Light) — CSS-variable swaps on `[data-theme="X"]` defined in `css/themes.css`. Fast to switch; no extra fetch.
- **Designer** (Vegas Neon / Classic Casino / Classic Burgundy / Brutalist / Brutalist Dark / Editorial) — full stylesheets at `themes/<slug>.css`. Loaded via a `<link>` element when the theme is active; removed when you switch back. Each one restyles the whole page including `.game-header` so it feels native to its aesthetic.

### Adding a built-in theme

In `css/themes.css`:

```css
[data-theme="mytheme"] {
  --bg: …;
  --panel: …;
  --ink: …;
  --muted: …;
  --accent: …;
  --good: …;
  --bad: …;
  --card-bg: …;
  --card-black: …;
  --card-red: …;
  --border: …;
  --input-bg: …;
  --track: …;
  --result-bg: …;
  --shadow: …;
}
```

Then add `<option value="mytheme">My Theme</option>` to the **Built-in** `<optgroup>` in `index.html`.

### Adding a designer theme

1. Create `themes/mytheme.css` with whatever CSS you want. A Google Font `@import` at the top of the file is fine.
2. Add `<option value="mytheme">My Theme</option>` to the **Designs** `<optgroup>` in `index.html`.
3. Add `"mytheme"` to the `CUSTOM` array (early-paint script in `index.html` `<head>`) **and** to `CUSTOM_THEMES` (top of `js/main.js`).
4. Style at minimum `.game-name` and `.game-meta` so the header feels native — the canonical (Dark) header treatment will leak through otherwise.

## Adding a variant

Add an entry to the `VARIANTS` object in `js/variants.js`. Each entry declares the total `hole` and `board` card count, plus a `streets` array. Each street has:

- `label` — shown in the status prompt and on the equity chart
- `foldText` — sentence fragment for the fold summary ("on the flop")
- `user` — total cards in the user's hand after this street
- `board` — total community cards after this street

The simulator and evaluator pick it up automatically. The Players cap is derived from the deck size.

## Contributing

There's no test framework. Verify changes manually in the browser:

- Deal a hand in each variant and run it through to showdown.
- Fold on different streets in Hold'em / Stud and confirm the runout reveal works.
- Change variants mid-hand — should reset cleanly.
- Cycle through every theme; each game-header should look intentional, not like the Dark fallback.
