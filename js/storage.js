/* ============================================================
   storage.js – lokale opslag
   Alles blijft op het apparaat (localStorage). Geen netwerk.
   ============================================================ */

const KEY = 'rekenraket.v1';

export function freshState() {
  return {
    v: 1,
    xp: 0,
    stars: 0,
    levels: { add: 1, sub: 1, mul: 1, div: 1 },
    levelStreak: { add: 0, sub: 0, mul: 0, div: 0 },
    tables: [1, 2, 5, 10],     // laatst gekozen tafels
    tablesOp: 'mul',           // laatst gekozen soort (mul/div/both)
    facts: {},                 // voortgangsmodel per som (zie engine.js)
    roundsDone: 0,
    roundsSinceBreak: 0,       // teller richting speelpauze
    settings: { reducedMotion: false },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    // Toekomstige migraties kunnen hier op parsed.v controleren.
    return Object.assign(freshState(), parsed);
  } catch {
    return freshState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* opslag vol of geblokkeerd – spel blijft gewoon werken */
  }
}

export function resetState() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return freshState();
}
