/* ============================================================
   app.js – schermen, spel-lus en invoer
   ============================================================ */

import { loadState, saveState, resetState } from './storage.js';
import { MAX_LEVEL, CATEGORY_NAME, LEVEL_DESC } from './questions.js';
import {
  buildRound, recordAnswer, requeue, starsFor, checkLevelUp,
  ROUND_SIZE,
} from './engine.js';
import { encodeCode, decodeCode, applyDecoded } from './code.js';
import { startMinigame, stopMinigame } from './minigame.js';

let state = loadState();
let session = null;            // actuele ronde
let lastSettings = null;       // voor "Nog een rondje!"

const $ = (id) => document.getElementById(id);
const screens = document.querySelectorAll('.screen');

const ROUNDS_PER_BREAK = 3;    // speelpauze na 3 rondes
const FEEDBACK_GOOD = ['Goed zo! 🎯', 'Super! 🚀', 'Top! ⭐', 'Knap! 💪', 'Yes! 🎉'];

/* ---------------- schermen ---------------- */

function show(name) {
  if (name !== 'minigame') stopMinigame();
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  $('topbar').hidden = (name === 'welcome' || name === 'game' || name === 'minigame');
  if (name === 'category') refreshCategoryCards();
  if (name === 'info') {
    $('info-code').textContent = encodeCode(state);
    $('toggle-motion').checked = state.settings.reducedMotion;
  }
  window.scrollTo(0, 0);
}

function refreshTopbar() {
  const level = Math.floor(state.xp / 100) + 1;
  $('pilot-level').textContent = `Piloot niveau ${level}`;
  $('xp-text').textContent = `${state.xp} XP`;
  $('fuel-bar').style.width = (state.xp % 100) + '%';
  $('star-total').textContent = state.stars;
}

function refreshCategoryCards() {
  for (const cat of ['add', 'sub', 'mul', 'div']) {
    const lvl = state.levels[cat];
    $(`lvl-${cat}`).textContent = `Level ${lvl} · ${LEVEL_DESC[cat][lvl - 1]}`;
  }
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function applyMotionSetting() {
  document.body.classList.toggle('reduced-motion', state.settings.reducedMotion);
}

/* ---------------- ronde starten ---------------- */

function startRound(settings) {
  lastSettings = settings;
  session = {
    settings,
    queue: buildRound(state, settings),
    index: 0,
    asked: 0,
    correctFirst: 0,
    firstTryTotal: 0,
    extraUsed: 0,
    streak: 0,
    input: '',
    qStart: 0,
    locked: false,
  };
  $('streak-num').textContent = '0';
  show('game');
  nextQuestion();
}

function currentQuestion() {
  return session.queue[session.index];
}

function renderDots() {
  const dots = $('round-dots');
  dots.innerHTML = '';
  session.queue.forEach((q, i) => {
    const d = document.createElement('span');
    d.className = 'dot';
    if (q.result === true) d.classList.add('good');
    if (q.result === false) d.classList.add('bad');
    if (i === session.index) d.classList.add('now');
    dots.appendChild(d);
  });
}

function nextQuestion() {
  if (session.index >= session.queue.length) { endRound(); return; }
  const q = currentQuestion();
  session.input = '';
  session.locked = false;
  session.qStart = performance.now();
  $('question-text').textContent = q.text;
  $('answer-text').textContent = '';
  const fb = $('feedback');
  fb.textContent = q.retry ? 'Nog een keertje deze! 🔁' : '';
  fb.className = 'feedback';
  renderDots();
}

/* ---------------- antwoord verwerken ---------------- */

function pressKey(key) {
  if (!session || session.locked) return;
  if (key === 'back') {
    session.input = session.input.slice(0, -1);
  } else if (key === 'ok') {
    submitAnswer();
    return;
  } else if (session.input.length < 4) {
    session.input += key;
  }
  $('answer-text').textContent = session.input;
}

function submitAnswer() {
  if (!session || session.locked || session.input === '') return;
  session.locked = true;

  const q = currentQuestion();
  const ms = performance.now() - session.qStart;
  const correct = parseInt(session.input, 10) === q.answer;

  recordAnswer(state, q, correct, ms);

  const card = $('question-card');
  const fb = $('feedback');
  q.result = correct;

  if (!q.retry) {
    session.firstTryTotal += 1;
    if (correct) session.correctFirst += 1;
  }

  if (correct) {
    session.streak += 1;
    $('streak-num').textContent = String(session.streak);
    const gained = (q.retry ? 5 : 10) + (session.streak >= 3 ? 2 : 0);
    state.xp += gained;
    session.xpGained = (session.xpGained || 0) + gained;
    fb.textContent = FEEDBACK_GOOD[Math.floor(Math.random() * FEEDBACK_GOOD.length)];
    fb.className = 'feedback good';
    card.classList.remove('flash-good', 'flash-oops');
    void card.offsetWidth; // animatie opnieuw laten afspelen
    card.classList.add('flash-good');
  } else {
    session.streak = 0;
    $('streak-num').textContent = '0';
    fb.textContent = `Bijna! Het is ${q.text} = ${q.answer}`;
    fb.className = 'feedback oops';
    card.classList.remove('flash-good', 'flash-oops');
    void card.offsetWidth;
    card.classList.add('flash-oops');
    // gespreide herhaling binnen de ronde
    if (requeue(session.queue, session.index, q, session.extraUsed)) {
      session.extraUsed += 1;
    }
  }

  renderDots();
  saveState(state);
  refreshTopbar();

  const delay = correct ? 700 : 1700; // bij fout: even het goede antwoord laten zien
  setTimeout(() => {
    session.index += 1;
    nextQuestion();
  }, state.settings.reducedMotion ? Math.min(delay, 900) : delay);
}

/* ---------------- ronde afsluiten ---------------- */

function endRound() {
  const total = session.firstTryTotal || ROUND_SIZE;
  const correct = session.correctFirst;
  const stars = starsFor(correct, total);
  state.stars += stars;
  state.roundsDone += 1;
  state.roundsSinceBreak += 1;

  const cat = session.settings.cat;
  let leveledUp = false;
  if (session.settings.mode === 'classic') {
    leveledUp = checkLevelUp(state, cat, correct, total, MAX_LEVEL[cat]);
  }

  // samenvatting vullen
  $('summary-emoji').textContent = stars === 3 ? '🏆' : stars === 2 ? '🎉' : stars === 1 ? '👍' : '💪';
  $('summary-title').textContent =
    stars === 3 ? 'Fantastisch!' : stars === 2 ? 'Goed gedaan!' : stars === 1 ? 'Lekker bezig!' : 'Goed geprobeerd!';
  $('summary-stars').textContent = stars > 0 ? '⭐'.repeat(stars) : '🌱';
  $('summary-score').textContent = `${correct} van de ${total} in één keer goed`;
  $('summary-xp').textContent = `+${session.xpGained || 0} XP`;
  $('summary-levelup').hidden = !leveledUp;
  if (leveledUp) {
    $('summary-levelup').textContent = `🚀 Level omhoog! ${CATEGORY_NAME[cat]} level ${state.levels[cat]}`;
  }

  // speelpauze verdiend?
  const breakReady = state.roundsSinceBreak >= ROUNDS_PER_BREAK;
  $('btn-minigame').hidden = !breakReady;

  $('secret-code').textContent = encodeCode(state);

  saveState(state);
  refreshTopbar();
  session = null;
  show('summary');
}

/* ---------------- tafels-kiezer ---------------- */

function buildTableChips() {
  const grid = $('table-grid');
  grid.innerHTML = '';
  for (let t = 1; t <= 10; t++) {
    const label = document.createElement('label');
    label.className = 'table-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(t);
    input.checked = state.tables.includes(t);
    const span = document.createElement('span');
    span.textContent = String(t);
    label.append(input, span);
    grid.appendChild(label);
  }
  // soort sommen terugzetten
  document.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.op === state.tablesOp);
  });
}

function startTablesRound() {
  const chosen = [...document.querySelectorAll('#table-grid input:checked')]
    .map((i) => parseInt(i.value, 10));
  if (chosen.length === 0) { toast('Kies eerst minstens één tafel! ✖️'); return; }
  state.tables = chosen;
  state.tablesOp = document.querySelector('.seg-btn.active').dataset.op;
  saveState(state);
  startRound({
    mode: 'tables',
    cat: state.tablesOp === 'div' ? 'div' : 'mul',
    tables: chosen,
    op: state.tablesOp,
  });
}

/* ---------------- geheime code ---------------- */

function tryApplyCode() {
  const decoded = decodeCode($('code-input').value);
  if (!decoded) { $('code-error').hidden = false; return; }
  $('code-error').hidden = true;
  applyDecoded(state, decoded);
  saveState(state);
  refreshTopbar();
  $('code-input').value = '';
  toast('Welkom terug, piloot! 🚀');
  show('home');
}

async function copyCode(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Code gekopieerd! 📋');
  } catch {
    toast('Schrijf de code maar over ✏️');
  }
}

/* ---------------- events ---------------- */

function bindEvents() {
  // generieke navigatie
  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => show(btn.dataset.go));
  });

  $('btn-home').addEventListener('click', () => show('home'));
  $('btn-quit').addEventListener('click', () => { session = null; show('home'); });

  // categorie kiezen → klassieke ronde
  document.querySelectorAll('#category-grid .mode-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      startRound({ mode: 'classic', cat, level: state.levels[cat] });
    });
  });

  // tafels
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  $('btn-start-tables').addEventListener('click', startTablesRound);

  // numpad
  $('numpad').addEventListener('click', (e) => {
    const key = e.target.closest('.key')?.dataset.key;
    if (key) pressKey(key);
  });

  // toetsenbord
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('screen-game').classList.contains('active')) return;
    if (e.key >= '0' && e.key <= '9') pressKey(e.key);
    else if (e.key === 'Backspace') { e.preventDefault(); pressKey('back'); }
    else if (e.key === 'Enter') pressKey('ok');
  });

  // samenvatting
  $('btn-again').addEventListener('click', () => {
    if (!lastSettings) { show('home'); return; }
    if (lastSettings.mode === 'classic') {
      // level kan net omhoog zijn gegaan
      lastSettings.level = state.levels[lastSettings.cat];
    }
    startRound(lastSettings);
  });
  $('btn-copy-code').addEventListener('click', () => copyCode($('secret-code').textContent));
  $('btn-copy-code2').addEventListener('click', () => copyCode($('info-code').textContent));

  // mini-game
  $('btn-minigame').addEventListener('click', () => {
    state.roundsSinceBreak = 0;
    saveState(state);
    show('minigame');
    startMinigame(
      $('mini-arena'), $('mini-score'), $('mini-timer'),
      state.settings.reducedMotion,
      (score) => {
        toast(`Je ving ${score} sterren! ✨ Op naar de volgende ronde!`);
        show('home');
      },
    );
  });

  // code invoeren
  $('btn-apply-code').addEventListener('click', tryApplyCode);
  $('code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryApplyCode();
  });
  $('btn-code-back').addEventListener('click', () => {
    const isFresh = state.xp === 0 && state.roundsDone === 0;
    show(isFresh ? 'welcome' : 'home');
  });

  // info / instellingen
  $('toggle-motion').addEventListener('change', (e) => {
    state.settings.reducedMotion = e.target.checked;
    applyMotionSetting();
    saveState(state);
  });
  $('btn-reset').addEventListener('click', () => {
    if (confirm('Weet je zeker dat je alle voortgang wilt wissen?')) {
      state = resetState();
      applyMotionSetting();
      refreshTopbar();
      buildTableChips();
      toast('Voortgang gewist');
      show('welcome');
    }
  });
}

/* ---------------- start ---------------- */

function init() {
  applyMotionSetting();
  refreshTopbar();
  buildTableChips();
  bindEvents();

  // Eerste keer (of na wissen): welkom + kans om code in te voeren.
  const isFresh = state.xp === 0 && state.roundsDone === 0;
  show(isFresh ? 'welcome' : 'home');
}

init();
