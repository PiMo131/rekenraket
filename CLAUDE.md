# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RekenRaket is a static, gamified math-practice webapp (Dutch, for children ~6–10): addition, subtraction, times tables 1–10 and matching division. Vanilla ES modules + HTML + CSS. No build step, no dependencies, no tests, no linter, no backend — all progress lives in `localStorage`.

All UI text and code comments are in Dutch; keep that convention.

## Running locally

ES modules don't load over `file://`, so serve the project root:

```bash
python -m http.server 8000   # or: npx serve .
```

Deployment is GitHub Pages from `main`, root folder. All asset paths must stay relative (`./css/...`, `./js/...`) so the app works under a `/<repo>/` sub-path.

## Architecture

`index.html` contains **all screens** as `<section class="screen" id="screen-<name>">`; `show(name)` in `app.js` toggles which one is active. Navigation buttons use `data-go="<name>"` attributes that are bound generically. Passing a name without a matching `screen-<name>` id blanks the app.

- `js/app.js` — entry point. Screen navigation, the round loop (`startRound` → `nextQuestion` → `submitAnswer` → `endRound`), the `session` object, numpad + keyboard input, XP/stars/streak bookkeeping, all event binding.
- `js/questions.js` — question generation. A question is `{ cat, text, answer, key }`; `key` is the canonical fact id (`a:3+4`, `s:9-2`, `m:7x8`, `d:56/7`) that links a question to its progress record. Level definitions (`MAX_LEVEL`, `LEVEL_DESC`, `TABLE_GROUPS`) live here.
- `js/engine.js` — adaptive engine, the core of the learning system. Per fact key it stores `{ n, c, t, m, w }` (attempts, correct, exponential-average answer time, mastery 0–5, recent-wrong counter) in `state.facts`. Rounds are built by weighted sampling (weight ≈ `(6 − mastery)² + wrong bonus`), wrong answers requeue 3 slots later in the same round (max 4 extras), mastery above 3 only grows for answers within 6 s, and level-up requires 2 consecutive rounds with ≥ 80% first-try accuracy.
- `js/storage.js` — single localStorage key `rekenraket.v1`. `freshState()` defines the entire state shape; `loadState()` merges stored data over a fresh state, so new fields are backwards-compatible by default.
- `js/code.js` — "secret" progress codes for moving between devices: 20 bits (category levels, XP in steps of 100, stars in steps of 10) encoded as 4 base32 chars + 1 checksum char, format `RAKET-XXXX-C`. The leading word is decoration and ignored on decode; legacy 8-char v1 codes are still accepted. The tables selection and the `facts` model are deliberately not encoded.
- `js/minigame.js` — Snake break game, offered after every 3 rounds (`ROUNDS_PER_BREAK`).

Two round modes flow through `startRound(settings)`:
- `{ mode: 'classic', cat, level }` — random generation per category/level; counts toward level-up.
- `{ mode: 'tables', cat: 'mul', tables }` — enumerates the `n × table` facts of the chosen tables (multiplication only, school form with the table number last); no level-up.

## Conventions

- Mobile-first; respect the reduced-motion setting (`state.settings.reducedMotion`, body class `reduced-motion`) when adding any animation or timed delay.
- The only external dependency is Google Fonts; don't add others (offline/PWA support is a planned next step in README.md).
- Subtraction questions must never go negative; division questions must always divide evenly — preserve these invariants when touching generation.
