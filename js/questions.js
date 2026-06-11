/* ============================================================
   questions.js – het genereren van sommen
   Elke som is een object:
   { cat, text, answer, key }
   - cat:    'add' | 'sub' | 'mul' | 'div'
   - text:   weergave, bijv. "7 × 8"
   - answer: het juiste antwoord (getal)
   - key:    unieke sleutel voor het voortgangsmodel, bijv. "m:7x8"
   ============================================================ */

export const MAX_LEVEL = { add: 6, sub: 6, mul: 4, div: 4 };

export const CATEGORY_NAME = {
  add: 'Plussommen',
  sub: 'Minsommen',
  mul: 'Keersommen',
  div: 'Deelsommen',
};

/* Tafelgroepen voor de klassieke leerlijn (kleine stapjes):
   eerst 1/2/5/10, dan 3/4/6 erbij, dan 7/8/9, dan alles. */
const TABLE_GROUPS = [
  [1, 2, 5, 10],
  [1, 2, 3, 4, 5, 6, 10],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
];

export function tablesForLevel(level) {
  return TABLE_GROUPS[Math.min(level, TABLE_GROUPS.length) - 1];
}

/* Korte omschrijving per level, voor op de categoriekaartjes. */
export const LEVEL_DESC = {
  add: ['t/m 5', 't/m 10', 't/m 20', 'over de 10', 't/m 50', 't/m 100'],
  sub: ['t/m 5', 't/m 10', 't/m 20', 'over de 10', 't/m 50', 't/m 100'],
  mul: ['tafels 1, 2, 5, 10', '+ tafels 3, 4, 6', '+ tafels 7, 8, 9', 'alles door elkaar'],
  div: ['tafels 1, 2, 5, 10', '+ tafels 3, 4, 6', '+ tafels 7, 8, 9', 'alles door elkaar'],
};

const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- optellen ---------- */
function genAdd(level) {
  let a, b;
  switch (level) {
    case 1: { a = ri(1, 4); b = ri(1, 5 - a); break; }                 // som t/m 5
    case 2: { a = ri(1, 9); b = ri(1, 10 - a); break; }                // som t/m 10
    case 3: { a = ri(1, 19); b = ri(1, 20 - a); break; }               // som t/m 20
    case 4: {                                                          // tientaloverschrijding
      do { a = ri(2, 9); b = ri(2, 9); } while (a + b <= 10);
      break;
    }
    case 5: { a = ri(5, 45); b = ri(2, 50 - a); break; }               // som t/m 50
    default:{ a = ri(10, 90); b = ri(5, 100 - a); break; }             // som t/m 100
  }
  return { cat: 'add', text: `${a} + ${b}`, answer: a + b, key: `a:${a}+${b}` };
}

/* ---------- aftrekken (nooit negatief) ---------- */
function genSub(level) {
  let a, b;
  switch (level) {
    case 1: { a = ri(1, 5); b = ri(0, a); break; }
    case 2: { a = ri(2, 10); b = ri(1, a); break; }
    case 3: { a = ri(5, 20); b = ri(1, a); break; }
    case 4: {                                                          // door het tiental heen
      a = ri(11, 18); b = ri((a % 10) + 1, 9);
      break;
    }
    case 5: { a = ri(10, 50); b = ri(2, a - 1); break; }
    default:{ a = ri(20, 100); b = ri(5, a - 1); break; }
  }
  return { cat: 'sub', text: `${a} − ${b}`, answer: a - b, key: `s:${a}-${b}` };
}

/* ---------- keersommen ---------- */
function makeMul(t, i) {
  // beide richtingen oefenen: 7 × 3 én 3 × 7
  const [a, b] = Math.random() < 0.5 ? [t, i] : [i, t];
  return { cat: 'mul', text: `${a} × ${b}`, answer: a * b, key: `m:${a}x${b}` };
}

/* ---------- deelsommen (altijd kloppend) ---------- */
function makeDiv(t, i) {
  return { cat: 'div', text: `${t * i} ÷ ${t}`, answer: i, key: `d:${t * i}/${t}` };
}

/* Eén willekeurige som voor de klassieke modus. */
export function generateQuestion(cat, level) {
  if (cat === 'add') return genAdd(level);
  if (cat === 'sub') return genSub(level);
  const tables = tablesForLevel(level);
  const t = pick(tables);
  const i = ri(1, 10);
  return cat === 'mul' ? makeMul(t, i) : makeDiv(t, i);
}

/* Alle mogelijke sommen voor gekozen tafels (tafels-kiezer).
   op: 'mul' | 'div' | 'both' */
export function enumerateTableFacts(tables, op) {
  const out = [];
  for (const t of tables) {
    for (let i = 1; i <= 10; i++) {
      if (op === 'mul' || op === 'both') out.push(makeMul(t, i));
      if (op === 'div' || op === 'both') out.push(makeDiv(t, i));
    }
  }
  return out;
}
