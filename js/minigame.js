/* ============================================================
   minigame.js – "Slang" (Snake) als speelpauze
   ------------------------------------------------------------
   Een rustige brain break, geen wedstrijd. Eet appeltjes, word
   langer, verzamel punten. Besturing:
     - mobiel : vegen (swipe) op het speelveld
     - desktop: pijltjestoetsen of WASD
   Geen harde "game over": bots je tegen jezelf of de rand, dan
   krimpt de slang weer tot het begin en speel je gewoon door.
   De score (gegeten appels) blijft staan. Na de tijd stopt het
   spel en gaat het kind terug naar de volgende rekenronde.

   Aanroep (zelfde signatuur als de vorige mini-game):
     startMinigame(arena, scoreEl, timerEl, reducedMotion, onDone)
   - arena : container-element (krijgt een <canvas>)
   - onDone(score) : aangeroepen als de tijd op is
   ============================================================ */

const GAME_SECONDS = 45;        // iets langer dan vangen: rustiger tempo
const GRID = 15;                // speelveld is GRID × GRID vakjes
const COL_SNAKE = '#3ddc97';
const COL_HEAD = '#21b377';
const COL_APPLE = '#ff5e5b';
const COL_BG = 'rgba(255,255,255,.06)';
const COL_GRID = 'rgba(255,255,255,.05)';

let raf = null;
let clock = null;
let cleanup = [];
let running = false;

export function startMinigame(arena, scoreEl, timerEl, reducedMotion, onDone) {
  stopMinigame();
  running = true;

  // --- canvas opzetten, vierkant en scherp op retina ---
  arena.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'snake-canvas';
  canvas.setAttribute('aria-label', 'Slangspel: veeg of gebruik de pijltjes');
  arena.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let cell = 20;            // pixelgrootte per vakje, gezet in resize()

  function resize() {
    const size = Math.min(arena.clientWidth, arena.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    cell = Math.floor(size / GRID);
    const px = cell * GRID;
    canvas.style.width = px + 'px';
    canvas.style.height = px + 'px';
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // --- spelstaat ---
  let snake, dir, nextDir, apple, score, stepMs, lastStep;

  function reset(keepScore) {
    snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    if (!keepScore) score = 0;
    placeApple();
    scoreEl.textContent = String(score);
  }

  function placeApple() {
    let p;
    do {
      p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    apple = p;
  }

  // --- besturing: richting wijzigen (nooit direct omkeren) ---
  function setDir(x, y) {
    if (x === -dir.x && y === -dir.y) return;   // niet terug in jezelf
    nextDir = { x, y };
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { setDir(0, -1); e.preventDefault(); }
    else if (k === 'arrowdown' || k === 's') { setDir(0, 1); e.preventDefault(); }
    else if (k === 'arrowleft' || k === 'a') { setDir(-1, 0); e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { setDir(1, 0); e.preventDefault(); }
  }
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));

  // --- swipe ---
  let touchStart = null;
  function onStart(e) {
    const t = e.touches ? e.touches[0] : e;
    touchStart = { x: t.clientX, y: t.clientY };
  }
  function onMove(e) {
    if (!touchStart) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const THRESH = 24;
    if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;     // één richting per veeg
    if (e.cancelable) e.preventDefault();
  }
  function onEnd() { touchStart = null; }
  canvas.addEventListener('touchstart', onStart, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);
  cleanup.push(() => {
    canvas.removeEventListener('touchstart', onStart);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('touchend', onEnd);
  });

  // --- spel-lus (tijd-gestuurd, niet elke frame een stap) ---
  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // rand of jezelf geraakt → zacht herstarten, score blijft
    const hitWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      flash();
      reset(true);
      return;
    }

    snake.unshift(head);
    if (head.x === apple.x && head.y === apple.y) {
      score += 1;
      scoreEl.textContent = String(score);
      placeApple();
      // heel licht sneller worden, met een bodem zodat het rustig blijft
      stepMs = Math.max(reducedMotion ? 160 : 110, stepMs - 4);
    } else {
      snake.pop();
    }
  }

  let flashUntil = 0;
  function flash() { flashUntil = performance.now() + 250; }

  function draw() {
    const px = cell * GRID;
    // achtergrond
    ctx.fillStyle = performance.now() < flashUntil ? 'rgba(255,94,91,.25)' : COL_BG;
    ctx.fillRect(0, 0, px, px);
    // subtiel raster
    ctx.fillStyle = COL_GRID;
    for (let i = 1; i < GRID; i++) {
      ctx.fillRect(i * cell, 0, 1, px);
      ctx.fillRect(0, i * cell, px, 1);
    }
    // appel
    drawCell(apple.x, apple.y, COL_APPLE, true);
    // slang
    snake.forEach((s, i) => drawCell(s.x, s.y, i === 0 ? COL_HEAD : COL_SNAKE, false));
  }

  function drawCell(x, y, color, round) {
    const pad = Math.max(1, Math.floor(cell * 0.08));
    ctx.fillStyle = color;
    const r = round ? cell / 2 : Math.floor(cell * 0.25);
    const px = x * cell + pad, py = y * cell + pad, s = cell - pad * 2;
    ctx.beginPath();
    ctx.roundRect(px, py, s, s, r);
    ctx.fill();
  }

  function loop(now) {
    if (!running) return;
    if (now - lastStep >= stepMs) { step(); lastStep = now; }
    draw();
    raf = requestAnimationFrame(loop);
  }

  // --- starten ---
  stepMs = reducedMotion ? 220 : 160;   // ms per stap (lager = sneller)
  score = 0;
  reset(false);

  const ro = new ResizeObserver(resize);
  ro.observe(arena);
  cleanup.push(() => ro.disconnect());
  resize();

  lastStep = performance.now();
  raf = requestAnimationFrame(loop);

  let timeLeft = GAME_SECONDS;
  timerEl.textContent = String(timeLeft);
  clock = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = String(timeLeft);
    if (timeLeft <= 0) {
      const finalScore = score;
      stopMinigame();
      onDone(finalScore);
    }
  }, 1000);
}

export function stopMinigame() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  if (clock) clearInterval(clock);
  raf = null; clock = null;
  for (const fn of cleanup) fn();
  cleanup = [];
}
