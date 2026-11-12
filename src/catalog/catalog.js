import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MaterialLibrary } from '../scene/MaterialLibrary.js';
import { buildItemMeshes } from '../scene/FurniturePrims.js';
import { customModel } from '../scene/CatalogModels.js';

/**
 * Catálogo de mobiliario: cada fila de la matriz de amoblamiento (xlsx) con su foto de referencia al lado del MODELO 3D de la pieza,
 * generado desde los mismos datos de Revit que usa el recorrido (p2-furniture.json), y la comparación de medidas modeladas vs matriz.
 */
const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// De qué habitación del Revit se toma el modelo de cada hoja de la matriz
const SHEET_SRC = {
  'Habitacion King': { list: 'sencillas', grp: 'S965222' },
  'Habitacion Twin': { list: 'dobles', grp: '965137' },
  'Junior Suite Tipo B (225)': { list: 'sencillas', grp: 'S964953' },
  'Junior Suite Tipo C1 (223)': { list: 'suitesFondo', grp: 'U964886' },
  'Junior Suite Tipo C2 (222-224)': { list: 'suitesFondo', grp: 'U964810' },
  'Suite Tipo D (214-314-414)': { list: 'suiteD', grp: null }
};
// La matriz y el Revit se numeran distinto en estos dos códigos (aplique de cabecero / lámpara colgante)
const CODE_MAP = { 'LP-01': 'LP-03', 'LP-03': 'LP-01' };

const state = { data: null, furn: null, sheet: null, item: null, wire: false, models: new Map(), q: '' };
let renderer, scene, camera, controls, lib, stage, matCache = new Map(), current = null;

async function boot() {
  const [data, furn] = await Promise.all([fetch('./data/catalog/catalogo.json').then((r) => r.json()), fetch('./data/geometry/p2-furniture.json').then((r) => r.json())]);
  state.data = data; state.furn = furn; state.sheet = data.sheets[0];
  initThree();
  buildTabs(); buildList();
  select(data.items.find((i) => i.sheet === state.sheet));
}

// ------------------------------------------------------------------ 3D
function initThree() {
  const host = $('#cat-canvas');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.2; controls.maxPolarAngle = Math.PI * 0.52;
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(2.5, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, new THREE.HemisphereLight(0xfff6ea, 0x5a4c3a, 0.55));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 0.9 })); disc.rotation.x = -Math.PI / 2; disc.position.y = -0.002; disc.receiveShadow = true; scene.add(disc);
  stage = new THREE.Group(); scene.add(stage);
  lib = new MaterialLibrary(renderer); lib.initAll();
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();
  const loop = () => { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
  loop();
  $('#cat-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'rotate') { controls.autoRotate = !controls.autoRotate; b.classList.toggle('on', controls.autoRotate); }
    else if (a === 'wire') { state.wire = !state.wire; b.classList.toggle('on', state.wire); applyWire(); }
    else view(a);
  });
}

function applyWire() { stage.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.wireframe = state.wire; }); }); }

function frame(group) {
  const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 0.2), d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  camera.position.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.66); controls.target.copy(c); controls.minDistance = r * 0.8; controls.maxDistance = d * 4; controls.update();
  state.frame = { c, d };
}
function view(a) {
  const { c, d } = state.frame || {}; if (!c) return; controls.autoRotate = false; $('#cat-tools [data-act=rotate]').classList.remove('on');
  const p = a === 'front' ? [0, 0.05, 1] : a === 'side' ? [1, 0.05, 0] : [0, 1, 0.001];
  camera.position.set(c.x + p[0] * d, c.y + p[1] * d, c.z + p[2] * d); controls.target.copy(c); controls.update();
}

// ------------------------------------------------------------------ datos → modelo
function findItems(ci) {
  const src = SHEET_SRC[ci.sheet] || { list: 'sencillas', grp: 'S965222' };
  const codes = ci.code.split('+').map((c) => c.trim());
  const out = [];
  for (const raw of codes) {
    const code = CODE_MAP[raw] || raw;
    const inGroup = (it) => it.code.replace(/\s*\[.*\]/, '') === code;
    let it = (state.furn[src.list] || []).filter((i) => !src.grp || i.code.includes('[' + src.grp + ']')).find(inGroup);
    if (!it) for (const l of ['sencillas', 'dobles', 'suitesFondo', 'suiteD']) { it = (state.furn[l] || []).find(inGroup); if (it) break; }
    if (it) out.push({ it, code: raw });
  }
  return out;
}

function buildModel(ci) {
  const key = ci.sheet + '|' + ci.code;
  if (state.models.has(key)) return state.models.get(key);
  const custom = customModel(ci.code, lib);
  if (custom) { const model = { group: custom, has: true, exact: true }; state.models.set(key, model); return model; }
  const found = findItems(ci), g = new THREE.Group();
  let x = 0;
  for (const f of found) {
    let item = f.it;
    if (ci.code === 'SO-02') item = { ...item, prims: item.prims.filter((p) => p.mat === 'TERRACOTA') };   // los cojines son parte del sofá en el Revit
    const sub = new THREE.Group();
    buildItemMeshes(item, lib, matCache).forEach((m) => sub.add(m));
    const b = new THREE.Box3().setFromObject(sub); if (b.isEmpty()) continue;
    const c = b.getCenter(new THREE.Vector3());
    sub.position.set(-c.x + x, -b.min.y, -c.z);
    g.add(sub); x += b.getSize(new THREE.Vector3()).x + 0.2;
  }
  if (g.children.length > 1) { const b = new THREE.Box3().setFromObject(g); g.position.x = -b.getCenter(new THREE.Vector3()).x; }
  if (/^TA-0?1$/.test(ci.code) && g.children.length) {   // el tapete redondo: la base de lana va en el envolvente; aquí se muestra con su disco
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.014, 64), lib.realMaterial('tapete_lana', 0.4, { roughness: 1, normalScale: 0.9 }));
    base.position.y = 0.007; base.receiveShadow = true; g.add(base);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const model = { group: g, has: g.children.length > 0 };
  state.models.set(key, model);
  return model;
}

// ------------------------------------------------------------------ medidas
function parseCm(str) {
  const s = String(str || '').replace(/,/g, '.'), out = [];
  const re = /(\d+(?:\.\d+)?)\s*(cm|mm|m)?\b/gi; let m;
  const unitAfter = (idx) => { const t = /\b(cm|mm|m)\b/i.exec(s.slice(idx, idx + 14)); return t ? t[1].toLowerCase() : null; };
  while ((m = re.exec(s))) {
    const v = parseFloat(m[1]); if (!isFinite(v)) continue;
    const u = (m[2] || unitAfter(m.index + m[0].length) || 'cm').toLowerCase();
    if (!m[2] && s[m.index - 1] && /[A-Za-z]/.test(s[m.index - 1]) && !/[øØ]/.test(s[m.index - 1])) continue;   // parte de un código (p. ej. "05-6428")
    const cm = u === 'm' ? v * 100 : u === 'mm' ? v / 10 : v;
    if (cm >= 2 && cm <= 700) out.push(cm);
  }
  return out;
}

function showDims(ci, model) {
  const box = $('#cat-dims'); box.innerHTML = '';
  const spec = parseCm(ci.dims);
  let modelHtml = '<div class="v">—</div><div class="st warn">Sin modelo 3D para este código</div>', stHtml = '';
  if (model.has) {
    const b = new THREE.Box3().setFromObject(model.group), s = b.getSize(new THREE.Vector3()).multiplyScalar(100);
    const mdl = [s.x, s.z, s.y].map((v) => Math.round(v));
    modelHtml = `<div class="v">${mdl[0]} × ${mdl[1]} × H ${mdl[2]} cm${model.exact ? ' <span class="badge">modelo 1:1</span>' : ''}</div>`;
    const want = [...spec].sort((a, b) => b - a).slice(0, 3), have = [...mdl].sort((a, b) => b - a).slice(0, want.length);
    const ok = want.length && want.every((w, i) => Math.abs(w - have[i]) / w < 0.12);
    stHtml = want.length ? (ok ? '<div class="st ok">✓ Las medidas modeladas coinciden con la matriz</div>' : '<div class="st warn">⚠ Revisar: difiere de la matriz (o la matriz da medidas de otro tipo)</div>') : '<div class="st warn">La matriz no trae medidas numéricas</div>';
  }
  box.append(el('div', 'box', `<div class="k">Medidas del modelo</div>${modelHtml}${stHtml}`), el('div', 'box', `<div class="k">Medidas de la matriz</div><div class="v">${esc(ci.dims || '—')}</div>`));
}

// ------------------------------------------------------------------ UI
function buildTabs() {
  const t = $('#cat-tabs'); t.innerHTML = '';
  state.data.sheets.forEach((s) => { const b = el('button', s === state.sheet ? 'on' : '', esc(s.replace('Junior Suite Tipo ', 'JS ').replace('Habitacion ', 'Hab. ').replace('Suite Tipo ', 'Suite '))); b.title = s; b.onclick = () => { state.sheet = s; buildTabs(); buildList(); const first = state.data.items.find((i) => i.sheet === s); if (first) select(first); }; t.append(b); });
}
function buildList() {
  const L = $('#cat-list'); L.innerHTML = '';
  const q = state.q.toLowerCase(); let sec = null;
  state.data.items.filter((i) => i.sheet === state.sheet && (!q || (i.code + ' ' + i.item + ' ' + i.ref).toLowerCase().includes(q))).forEach((i) => {
    const label = i.anulado ? 'Anulados (mock-up)' : (i.section || 'Mobiliario');
    if (label !== sec) { sec = label; L.append(el('div', 'cat-sec', esc(label))); }
    const has = findItems(i).length > 0 || !!customModel(i.code, lib);
    const r = el('button', 'cat-row' + (i.anulado ? ' anul' : '') + (state.item === i ? ' on' : ''), `<b>${esc(i.code)}</b><span>${esc(i.item)}<br><small>${esc(i.qty ? 'Cant. ' + parseFloat(i.qty) : '')}</small></span><span class="tag ${has ? 'ok' : 'no'}">${has ? '3D' : 'sin 3D'}</span>`);
    r.onclick = () => select(i); i._btn = r; L.append(r);
  });
}
function select(ci) {
  if (!ci) return; state.item = ci;
  document.querySelectorAll('.cat-row').forEach((b) => b.classList.remove('on')); ci._btn?.classList.add('on');
  $('#cat-head').innerHTML = `<h2><span class="code">${esc(ci.code)}</span>${esc(ci.item)}</h2><div class="sub">${esc(ci.sheet)} · ${esc(ci.ref)} · ${esc(ci.supplier)}${ci.qty ? ' · Cantidad ' + parseFloat(ci.qty) : ''}</div>`;
  $('#cat-ref-img').innerHTML = ci.img ? `<img src="./${ci.img}" alt="Referencia ${esc(ci.code)}" />` : '<div class="none">Sin imagen en la matriz.<br>Remitirse a planimetría de detalle de mobiliario.</div>';
  stage.clear();
  const model = buildModel(ci); stage.add(model.group); applyWire();
  if (model.has) frame(model.group); else { camera.position.set(1.6, 1.2, 1.8); controls.target.set(0, 0.4, 0); }
  showDims(ci, model);
  const info = $('#cat-info'); info.innerHTML = '';
  const card = (h, body, extra = '') => body || extra ? info.append(el('div', 'card', `<h3>${h}</h3>${body ? '<p>' + esc(body) + '</p>' : ''}${extra}`)) : null;
  card('Especificación', ci.spec);
  card('Tela / material', ci.material, ci.finish ? `<img src="./${ci.finish}" alt="Acabado" />` : '');
  card('Observaciones', ci.obs);
  if (ci.link) card('Enlace / referencia web', '', /^https?:/.test(ci.link) ? `<p><a href="${esc(ci.link)}" target="_blank" rel="noopener">${esc(ci.link)}</a></p>` : `<p>${esc(ci.link)}</p>`);
}

$('#cat-q').addEventListener('input', (e) => { state.q = e.target.value; buildList(); });
boot().catch((e) => { document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;padding:20px">${esc(e.stack || e)}</pre>`); });
