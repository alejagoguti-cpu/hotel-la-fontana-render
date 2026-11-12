// Portada del proyecto: escenas del hero, planta interactiva del Piso 2 y comparador modelo/visualización.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Barra superior: fondo sólido al salir del hero ── */
const nav = document.getElementById('nav');
const hero = document.querySelector('.hero');
new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting), {
  rootMargin: '-72px 0px 0px 0px',
}).observe(hero);

/* ── Hero: tres escenas con avance automático ── */
const DWELL = 9000;
const scenes = [...document.querySelectorAll('.scene')];
const tabs = [...document.querySelectorAll('.tab')];
const pauseBtn = document.getElementById('pause');
let current = 0;
let timer = null;
let paused = reduceMotion;

hero.style.setProperty('--dwell', `${DWELL}ms`);

function show(i) {
  current = (i + scenes.length) % scenes.length;
  scenes.forEach((s, k) => {
    const on = k === current;
    if (on) {
      // reinicia el zoom lento cada vez que la escena entra
      const img = s.querySelector('img');
      img.loading = 'eager';
      img.style.animation = 'none';
      void img.offsetWidth;
      img.style.animation = '';
    }
    s.classList.toggle('is-active', on);
  });
  tabs.forEach((t, k) => {
    const on = k === current;
    t.classList.remove('is-active');
    void t.offsetWidth;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
  schedule();
}

function schedule() {
  clearTimeout(timer);
  if (!paused && !document.hidden) timer = setTimeout(() => show(current + 1), DWELL);
}

function setPaused(p) {
  paused = p;
  hero.classList.toggle('is-paused', p);
  pauseBtn.setAttribute('aria-pressed', String(p));
  pauseBtn.setAttribute('aria-label', p ? 'Reanudar la animación' : 'Pausar la animación');
  schedule();
}

tabs.forEach((t, k) => t.addEventListener('click', () => show(k)));
pauseBtn.addEventListener('click', () => setPaused(!paused));
document.addEventListener('visibilitychange', schedule);
setPaused(paused);

/* ── Planta del Piso 2 ── */
// Posición de cada habitación sobre la imagen de corte (porcentaje del ancho y alto).
const PINS = {
  214: [15, 29], 215: [24.9, 27.2], 216: [29.1, 32.3], 217: [34.1, 27.2], 218: [38.6, 32.3],
  219: [66.3, 32.9], 220: [67.6, 42], 221: [73.4, 45.2],
  222: [85.8, 59.6], 223: [69.1, 61.1], 224: [71.8, 74.8], 225: [79.5, 78],
};

const canvas = document.getElementById('plan-canvas');
const card = document.getElementById('room-card');
const list = document.getElementById('room-list');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const m2 = (n) => (typeof n === 'number' ? `${n.toFixed(2).replace('.', ',')} m²` : '—');

function renderRoom(room) {
  card.innerHTML = `
    <div class="num">${esc(room.number)}</div>
    <div class="typ">${esc(room.typology)}</div>
    <div class="wing">${esc(room.wing)}</div>
    <dl>
      <div><dt>Área</dt><dd>${m2(room.areaPrivateM2)}</dd></div>
      <div><dt>Dotación</dt><dd>${esc(room.bedConfig)}</dd></div>
      <div><dt>Ubicación</dt><dd>${esc(room.locationType)}</dd></div>
    </dl>
    <a href="./masterplan.html">Recorrerla en el modelo 3D →</a>`;
  document.querySelectorAll('[data-room]').forEach((el) => el.classList.toggle('is-active', el.dataset.room === room.number));
}

async function initPlan() {
  let rooms = [];
  try {
    rooms = await (await fetch('./data/rooms-piso2.json')).json();
  } catch {
    card.textContent = 'No se pudo cargar el inventario de habitaciones.';
    return;
  }
  for (const room of rooms) {
    const pos = PINS[room.number];
    if (pos) {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin';
      pin.dataset.room = room.number;
      pin.style.left = `${pos[0]}%`;
      pin.style.top = `${pos[1]}%`;
      pin.textContent = room.number;
      pin.setAttribute('aria-label', `Habitación ${room.number}, ${room.typology}`);
      pin.addEventListener('click', () => renderRoom(room));
      canvas.append(pin);
    }
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.room = room.number;
    b.textContent = room.number;
    b.setAttribute('aria-label', `Habitación ${room.number}, ${room.typology}`);
    b.addEventListener('click', () => renderRoom(room));
    li.append(b);
    list.append(li);
  }
  if (rooms.length) renderRoom(rooms[0]);
}
initPlan();

/* ── Comparador modelo / visualización ── */
const frame = document.getElementById('compare-frame');
const range = document.getElementById('cmp-range');
const before = document.getElementById('cmp-before');
const after = document.getElementById('cmp-after');
const syncRange = () => frame.style.setProperty('--pos', `${range.value}%`);
range.addEventListener('input', syncRange);
syncRange();

document.querySelectorAll('.compare-thumbs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.compare-thumbs button').forEach((b) => b.classList.toggle('is-active', b === btn));
    const k = btn.dataset.k;
    frame.style.aspectRatio = btn.dataset.r;
    before.src = `./assets/hf/${k}-base.webp`;
    after.src = `./assets/hf/${k}-1200.webp`;
    range.value = 50;
    syncRange();
  });
});

/* ── Aparición suave de bloques ── */
const targets = document.querySelectorAll('.section h2, .section .eyebrow, .prose, .stats > div, .g-item, .compare, .plan, .cta-card, .facts');
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}
