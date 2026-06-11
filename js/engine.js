/* ============================================================
   engine.js – de adaptieve vraagmotor
   ------------------------------------------------------------
   Kern van het leersysteem. Per "feit" (een unieke som, bijv.
   m:7x8) houden we bij:

     n : aantal pogingen
     c : aantal keer goed
     t : gemiddelde antwoordtijd in ms (exponentieel gemiddelde)
     m : beheersingsscore 0–5 (mastery)
     w : "recent fout"-teller (0–2), geeft extra herhaalgewicht

   Principes:
   - Retrieval practice : het kind typt het antwoord zelf.
   - Gespreide herhaling: een fout gemaakte som komt 3 plekken
     later in dezelfde ronde terug, én krijgt in volgende rondes
     extra gewicht (w).
   - Adaptief           : sommen met lage mastery worden vaker
     gekozen; goed beheerste sommen blijven af en toe terugkomen
     (mix van bekend en nieuw).
   - Beheersing = goed ÉN vlot: mastery boven de 3 kan alleen
     groeien als het antwoord binnen de tijdsdrempel komt. Eén
     gelukje is dus niet genoeg.
   ============================================================ */

import { generateQuestion, enumerateTableFacts } from './questions.js';

export const ROUND_SIZE = 10;       // sommen per ronde (zonder herkansingen)
export const MAX_EXTRA = 4;         // max. extra herkansingen per ronde
const FAST_MS = 6000;               // "vlot" = antwoord binnen 6 seconden

/* Leeg feit-record. */
function newFact() {
  return { n: 0, c: 0, t: 0, m: 0, w: 0 };
}

export function getFact(facts, key) {
  return facts[key] || newFact();
}

/* ------------------------------------------------------------
   Gewicht van een som bij het samenstellen van een ronde.
   Lage mastery → kwadratisch hoger gewicht.
   Recent fout  → flinke bonus, zodat hij snel terugkomt.
   ------------------------------------------------------------ */
function weightOf(facts, key) {
  const f = facts[key];
  const m = f ? f.m : 0;          // onbekende som = mastery 0 = hoog gewicht
  const wrongBonus = f && f.w > 0 ? 8 * f.w : 0;
  return (6 - m) * (6 - m) + wrongBonus + 1;
}

/* Gewogen trekking zonder teruglegging. */
function weightedSample(candidates, facts, count) {
  const pool = [...candidates];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((q) => weightOf(facts, q.key));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    let idx = 0;
    while (r > weights[idx]) { r -= weights[idx]; idx++; }
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/* ------------------------------------------------------------
   Stel een ronde samen.
   mode 'classic': cat + level  → kandidaten via random generatie
   mode 'tables' : tables + op  → alle feiten van gekozen tafels
   ------------------------------------------------------------ */
export function buildRound(state, settings) {
  let candidates = [];

  if (settings.mode === 'tables') {
    candidates = enumerateTableFacts(settings.tables);
  } else {
    // Trek ruim kandidaten; dubbele sleutels overslaan zodat de
    // gewogen trekking iets te kiezen heeft.
    const seen = new Set();
    for (let i = 0; i < 80 && candidates.length < 40; i++) {
      const q = generateQuestion(settings.cat, settings.level);
      if (!seen.has(q.key)) { seen.add(q.key); candidates.push(q); }
    }
  }

  // Dubbele sleutels eruit (tafels in 2 richtingen kunnen botsen).
  const unique = [];
  const seenKeys = new Set();
  for (const q of candidates) {
    if (!seenKeys.has(q.key)) { seenKeys.add(q.key); unique.push(q); }
  }

  let queue = weightedSample(unique, state.facts, ROUND_SIZE);

  // Kleine pool (bijv. alleen tafel van 1)? Vul aan met herhaling,
  // maar nooit twee keer dezelfde som direct na elkaar.
  while (queue.length < ROUND_SIZE && unique.length > 0) {
    const extra = weightedSample(unique, state.facts, 1)[0];
    if (queue.length === 0 || queue[queue.length - 1].key !== extra.key) {
      queue.push({ ...extra });
    }
  }

  return queue;
}

/* ------------------------------------------------------------
   Resultaat verwerken in het voortgangsmodel.
   correct  : was het antwoord goed (eerste poging op deze plek)?
   ms       : antwoordtijd in milliseconden
   ------------------------------------------------------------ */
export function recordAnswer(state, q, correct, ms) {
  const f = state.facts[q.key] || newFact();
  f.n += 1;

  // Exponentieel gemiddelde van de antwoordtijd (zacht, 30% nieuw).
  f.t = f.t === 0 ? ms : Math.round(0.7 * f.t + 0.3 * ms);

  if (correct) {
    f.c += 1;
    f.w = Math.max(0, f.w - 1);
    // Tot mastery 3 telt elk goed antwoord; daarboven alleen vlotte
    // antwoorden. Zo vraagt echte beheersing ook tempo én herhaling.
    if (f.m < 3 || ms <= FAST_MS) f.m = Math.min(5, f.m + 1);
  } else {
    f.m = Math.max(0, f.m - 2);
    f.w = 2;
  }

  state.facts[q.key] = f;
}

/* Fout gemaakte som iets later in de ronde opnieuw aanbieden. */
export function requeue(queue, index, q, extraUsed) {
  if (extraUsed >= MAX_EXTRA) return false;
  const insertAt = Math.min(queue.length, index + 3);
  queue.splice(insertAt, 0, { ...q, retry: true });
  return true;
}

/* ------------------------------------------------------------
   Beloning na de ronde.
   Sterren op basis van eerste-poging-nauwkeurigheid;
   XP voor elk goed antwoord, met streak-bonus.
   ------------------------------------------------------------ */
export function starsFor(correctFirst, total) {
  const ratio = correctFirst / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

/* Mag het level omhoog? Pas na 2 goede rondes op rij (≥ 80%),
   zodat één gelukstreffer niet meteen level-up geeft. */
export function checkLevelUp(state, cat, correctFirst, total, maxLevel) {
  const good = correctFirst / total >= 0.8;
  state.levelStreak[cat] = good ? (state.levelStreak[cat] || 0) + 1 : 0;
  if (state.levelStreak[cat] >= 2 && state.levels[cat] < maxLevel) {
    state.levels[cat] += 1;
    state.levelStreak[cat] = 0;
    return true;
  }
  return false;
}
