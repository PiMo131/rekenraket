/* ============================================================
   minigame.js – "Sterren vangen"
   Korte speelpauze (30 sec) als beloning na geconcentreerd
   oefenen. Simpel, veilig, zonder netwerk: tik op vallende
   sterren voordat ze de bodem raken.
   ============================================================ */

const GAME_SECONDS = 30;
const EMOJI = ['⭐', '🌟', '✨', '💫'];

let running = false;
let timers = [];

export function startMinigame(arena, scoreEl, timerEl, reducedMotion, onDone) {
  stopMinigame();
  running = true;
  arena.innerHTML = '';
  let score = 0;
  let timeLeft = GAME_SECONDS;
  scoreEl.textContent = '0';
  timerEl.textContent = String(timeLeft);

  const fallMs = reducedMotion ? 9000 : 4500;
  const spawnEvery = reducedMotion ? 1100 : 750;

  function spawnStar() {
    if (!running) return;
    const star = document.createElement('button');
    star.className = 'mini-star';
    star.type = 'button';
    star.setAttribute('aria-label', 'Ster');
    star.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    star.style.left = Math.random() * 85 + '%';
    star.style.top = '-50px';
    star.style.transitionDuration = fallMs + 'ms';
    arena.appendChild(star);

    // volgende frame: laat hem vallen (CSS-transitie op top)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      star.style.top = 'calc(100% + 60px)';
    }));

    const cleanup = setTimeout(() => star.remove(), fallMs + 200);
    timers.push(cleanup);

    star.addEventListener('pointerdown', () => {
      if (star.classList.contains('pop')) return;
      score += 1;
      scoreEl.textContent = String(score);
      // bevries de ster op zijn plek en laat hem ploffen
      const rect = star.getBoundingClientRect();
      const arenaRect = arena.getBoundingClientRect();
      star.style.transitionDuration = '0ms';
      star.style.top = (rect.top - arenaRect.top) + 'px';
      star.classList.add('pop');
      setTimeout(() => star.remove(), 320);
    }, { once: true });
  }

  const spawner = setInterval(spawnStar, spawnEvery);
  timers.push(spawner);
  spawnStar();

  const clock = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = String(timeLeft);
    if (timeLeft <= 0) {
      stopMinigame();
      onDone(score);
    }
  }, 1000);
  timers.push(clock);
}

export function stopMinigame() {
  running = false;
  for (const t of timers) { clearInterval(t); clearTimeout(t); }
  timers = [];
}
