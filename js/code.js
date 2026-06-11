/* ============================================================
   code.js – geheime voortgangscodes (v2)
   ------------------------------------------------------------
   Er is geen account, dus de "savegame" is een korte code die
   het kind kan opschrijven. Inhoud (grof, bewust):

     - level per categorie   plus/min 1–6, keer/delen 1–4
     - XP per 100            = precies het pilotenniveau (max 64)
     - sterren per 10        (max 16 bakjes)

   In plaats van bit-velden gebruiken we gemengde radix:
   576 (levels) × 64 (xp) × 16 (sterren) = 589.824 < 2^20.
   20 bits → 4 tekens base32 + 1 checksum-teken.

   Formaat: WOORD-XXXX-C   bijv. RAKET-7K2M-9

   Het woord vooraan is decoratie (afgeleid van de checksum,
   dus dezelfde voortgang geeft hetzelfde woord) en wordt bij
   het inlezen genegeerd. De checksum vangt typfouten af.
   Dit is bewust géén beveiliging – het is een spaarcode.

   De gekozen tafels zitten niet meer in de code: opnieuw
   aanvinken kost twee seconden en bespaarde 10 bits.

   Oude codes (8 tekens, v1) worden nog wel herkend en ingelezen.
   ============================================================ */

/* Base32-alfabet zonder verwarrende tekens (geen 0/O/1/I). */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const WORDS = ['RAKET', 'STER', 'MAAN', 'KOMEET', 'DRAAK', 'ROBOT', 'PANDA', 'TIJGER'];

const XP_STEP = 100;     // 1 bakje = 1 pilotenniveau
const STAR_STEP = 10;

function checksumChar(data) {
  let sum = 0;
  for (const ch of data) sum += ALPHABET.indexOf(ch);
  return ALPHABET[sum % 32];
}

/* ---------- state → code ---------- */
export function encodeCode(state) {
  // Levels als gemengde radix: (((add·6)+sub)·4+mul)·4+div
  const lvlIdx =
    ((((state.levels.add - 1) * 6 + (state.levels.sub - 1)) * 4 +
      (state.levels.mul - 1)) * 4 + (state.levels.div - 1));

  const xpB = Math.min(63, Math.floor(state.xp / XP_STEP));
  const starB = Math.min(15, Math.floor(state.stars / STAR_STEP));

  let value = (lvlIdx * 64 + xpB) * 16 + starB;   // < 2^20

  let data = '';
  for (let i = 0; i < 4; i++) {
    data = ALPHABET[value % 32] + data;
    value = Math.floor(value / 32);
  }

  const check = checksumChar(data);
  const word = WORDS[ALPHABET.indexOf(check) % WORDS.length];
  return `${word}-${data}-${check}`;
}

/* ---------- code → genormaliseerd object (of null) ----------
   Resultaat: { levels:{add,sub,mul,div}, xp, stars, tables|null } */
export function decodeCode(input) {
  const clean = (input || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const parts = clean.split('-').filter(Boolean);
  if (parts.length < 2) return null;

  // Eerste deel is het sierwoord; de rest samen = data + checksum.
  const joined = parts.slice(1).join('');
  const data = joined.slice(0, -1);
  const check = joined.slice(-1);
  if (checksumChar(data) !== check) return null;

  if (data.length === 4) return decodeV2(data);
  if (data.length === 7) return decodeV1(data);   // oude codes
  return null;
}

function fromBase32(s) {
  let value = 0;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = value * 32 + v;
  }
  return value;
}

/* ---------- v2: 20 bits, gemengde radix ---------- */
function decodeV2(data) {
  let value = fromBase32(data);
  if (value === null) return null;

  const starB = value % 16; value = Math.floor(value / 16);
  const xpB = value % 64;   value = Math.floor(value / 64);
  const div = value % 4;    value = Math.floor(value / 4);
  const mul = value % 4;    value = Math.floor(value / 4);
  const sub = value % 6;    value = Math.floor(value / 6);
  const add = value;
  if (add > 5) return null; // buiten bereik → ongeldige code

  return {
    levels: { add: add + 1, sub: sub + 1, mul: mul + 1, div: div + 1 },
    xp: xpB * XP_STEP,
    stars: starB * STAR_STEP,
    tables: null,
  };
}

/* ---------- v1 (legacy): 35 bits, bit-velden ----------
   [add 3][sub 3][mul 3][div 3][xp/25 8][tafels 10][sterren/5 5] */
function decodeV1(data) {
  let bits = 0n;
  for (const ch of data) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    bits = (bits << 5n) | BigInt(v);
  }

  const take = (width) => {
    const v = Number(bits & BigInt((1 << width) - 1));
    bits >>= BigInt(width);
    return v;
  };

  const stars5 = take(5);
  const tablesMask = take(10);
  const xp25 = take(8);
  const div = take(3), mul = take(3), sub = take(3), add = take(3);

  const tables = [];
  for (let t = 1; t <= 10; t++) {
    if (tablesMask & (1 << (t - 1))) tables.push(t);
  }

  return {
    levels: {
      add: Math.min(6, add + 1), sub: Math.min(6, sub + 1),
      mul: Math.min(4, mul + 1), div: Math.min(4, div + 1),
    },
    xp: xp25 * 25,
    stars: stars5 * 5,
    tables: tables.length ? tables : null,
  };
}

/* ---------- genormaliseerd object → state toepassen ---------- */
export function applyDecoded(state, v) {
  state.levels = { ...v.levels };
  state.xp = v.xp;
  state.stars = v.stars;
  if (v.tables) state.tables = v.tables;   // alleen oude codes hebben dit
  return state;
}
