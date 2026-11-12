import * as THREE from 'three';
import { FacadeWindows } from '../scene/FacadeWindows.js';

/**
 * WindowEditor — Editor para que el usuario ponga y quite ventanas sobre las fachadas.
 *
 *  · Clic sobre un muro → pone una ventana (tipo, ancho y alto del panel).
 *  · Shift + clic → borra la ventana más cercana (propia o automática).
 *  · Ctrl/Cmd + Z → deshacer.
 *  · Se guarda en este navegador y se puede exportar a JSON; si el archivo
 *    data/geometry/custom-windows.json existe en el repositorio, se carga al iniciar.
 */
const STORAGE_KEY = 'lafontana.customWindows.v1';

export class WindowEditor {
  constructor(scene) {
    this.scene = scene;                 // MasterplanScene
    this.builder = scene.buildingBuilder;
    this.active = false;
    this.data = { added: [], hidden: [] };
    this.history = [];
    this.group = new THREE.Group();
    this.scene.scene.add(this.group);
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.preview = this.makePreview();
    this.scene.scene.add(this.preview);
    this.buildUI();
    this.bind();
    this.loadInitial();
  }

  makePreview() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x25d366, transparent: true, opacity: 0.45, depthTest: false, side: THREE.DoubleSide }));
    m.renderOrder = 999;
    m.visible = false;
    return m;
  }

  // ---------- datos ----------
  async loadInitial() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { stored = null; }
    if (!stored) {
      try {
        const r = await fetch('./data/geometry/custom-windows.json', { cache: 'no-store' });
        if (r.ok) stored = await r.json();
      } catch (e) { /* sin archivo */ }
    }
    if (stored && Array.isArray(stored.added)) this.data = { added: stored.added, hidden: stored.hidden || [] };
    // esperar a que el edificio exista para ocultar ventanas automáticas
    const tryApply = () => {
      if (this.builder.facadeSets?.every((f) => f.meshes)) this.refresh();
      else setTimeout(tryApply, 500);
    };
    tryApply();
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* modo privado */ }
    this.countEl.textContent = `${this.data.added.length} añadidas · ${this.data.hidden.length} quitadas`;
  }

  refresh() {
    // ventanas añadidas por el usuario
    this.group.clear();
    const hotel = new FacadeWindows(this.builder.materials);
    const plain = new FacadeWindows(this.builder.materials, { plain: true });
    this.data.added.forEach((w) => (w.type === 'plain' ? plain : hotel).add(w.x, w.y, w.z, w.nx, w.nz, w.w, w.h));
    this.userSets = [hotel, plain];
    this.group.add(hotel.build(), plain.build());
    // ventanas automáticas ocultas
    const keys = new Set(this.data.hidden);
    this.builder.facadeSets.forEach((f) => f.hideKeys(keys));
    this.save();
  }

  // ---------- UI ----------
  buildUI() {
    const bar = document.querySelector('.top-right-bar');
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'mode-pill-btn';
    this.toggleBtn.style.cssText = 'background: rgba(38,40,44,0.76); border:1px solid rgba(255,255,255,0.18); color:#fff;';
    this.toggleBtn.title = 'Poner y quitar ventanas en las fachadas';
    this.toggleBtn.innerHTML = '<svg class="ui-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/></svg> Ventanas';
    bar?.insertBefore(this.toggleBtn, bar.firstChild);

    const p = document.createElement('div');
    p.className = 'window-editor-panel';
    p.innerHTML = `
      <div class="we-title">Editor de ventanas</div>
      <div class="we-help">Clic en un muro: poner ventana<br>Shift + clic: quitar ventana<br>Ctrl + Z: deshacer</div>
      <label>Tipo
        <select class="we-type">
          <option value="hotel">Hotel (barandal + jardinera)</option>
          <option value="plain">Vano simple (torre)</option>
        </select>
      </label>
      <label>Ancho <span class="we-wv">1.20 m</span><input class="we-w" type="range" min="0.5" max="3" step="0.05" value="1.2"></label>
      <label>Alto <span class="we-hv">1.50 m</span><input class="we-h" type="range" min="0.4" max="3" step="0.05" value="1.5"></label>
      <label class="we-check"><input class="we-snap" type="checkbox" checked> Alinear a pisos (3.1 m)</label>
      <div class="we-count"></div>
      <div class="we-row">
        <button class="we-undo">Deshacer</button>
        <button class="we-export">Exportar JSON</button>
      </div>
      <div class="we-row">
        <label class="we-import">Importar<input type="file" accept="application/json" hidden></label>
        <button class="we-reset">Restablecer</button>
      </div>`;
    document.body.appendChild(p);
    this.panel = p;
    this.countEl = p.querySelector('.we-count');
    const style = document.createElement('style');
    style.textContent = `
      .window-editor-panel{position:absolute;top:104px;right:18px;z-index:40;width:250px;padding:14px;border-radius:14px;
        background:rgba(28,30,33,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;
        font:12px var(--font-main,Roboto,sans-serif);box-shadow:0 8px 28px rgba(0,0,0,.35);display:none}
      .window-editor-panel.open{display:block}
      .window-editor-panel .we-title{font-weight:600;font-size:13px;margin-bottom:6px}
      .window-editor-panel .we-help{opacity:.75;line-height:1.5;margin-bottom:10px}
      .window-editor-panel label{display:block;margin:8px 0 2px}
      .window-editor-panel select,.window-editor-panel input[type=range]{width:100%;margin-top:4px}
      .window-editor-panel select{background:#2b2e32;color:#fff;border:1px solid #444;border-radius:6px;padding:4px}
      .window-editor-panel .we-row{display:flex;gap:6px;margin-top:8px}
      .window-editor-panel button,.window-editor-panel .we-import{flex:1;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.2);
        background:rgba(255,255,255,.08);color:#fff;cursor:pointer;text-align:center;margin:0}
      .window-editor-panel .we-count{margin-top:8px;opacity:.8}
      .window-editor-panel .we-check{display:flex;gap:6px;align-items:center}
      @media (max-width:640px){.window-editor-panel{top:auto;bottom:140px;right:12px;width:220px}}`;
    document.head.appendChild(style);

    const w = p.querySelector('.we-w'), h = p.querySelector('.we-h');
    w.oninput = () => { p.querySelector('.we-wv').textContent = `${(+w.value).toFixed(2)} m`; };
    h.oninput = () => { p.querySelector('.we-hv').textContent = `${(+h.value).toFixed(2)} m`; };
    p.querySelector('.we-undo').onclick = () => this.undo();
    p.querySelector('.we-export').onclick = () => this.exportJSON();
    p.querySelector('.we-reset').onclick = () => {
      if (!confirm('¿Quitar todas las ventanas añadidas y restaurar las automáticas?')) return;
      this.history.push(JSON.stringify(this.data));
      this.data = { added: [], hidden: [] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* */ }
      location.reload();
    };
    p.querySelector('.we-import input').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        this.history.push(JSON.stringify(this.data));
        this.data = { added: d.added || [], hidden: d.hidden || [] };
        this.refresh();
      } catch (err) { alert('Archivo no válido'); }
    };
    this.toggleBtn.onclick = () => this.setActive(!this.active);
  }

  setActive(on) {
    this.active = on;
    this.panel.classList.toggle('open', on);
    this.toggleBtn.style.background = on ? 'rgba(37,211,102,0.3)' : 'rgba(38,40,44,0.76)';
    this.preview.visible = false;
    this.save();
  }

  // ---------- interacción ----------
  bind() {
    const el = this.scene.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointermove', (e) => { if (this.active) this.updatePreview(e); });
    el.addEventListener('pointerup', (e) => {
      if (!this.active || !down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 5 || e.button !== 0) return;
      const hit = this.pick(e);
      if (!hit) return;
      if (e.shiftKey) this.removeAt(hit.point);
      else this.addAt(hit);
    });
    window.addEventListener('keydown', (e) => {
      if (this.active && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); }
    });
  }

  pick(e) {
    const rect = this.scene.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.scene.camera);
    const targets = [];
    this.builder.rootGroup.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible) targets.push(o); });
    const hits = this.ray.intersectObjects(targets, false);
    for (const h of hits) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (Math.abs(n.y) > 0.3) continue;          // solo muros verticales
      if (n.dot(this.ray.ray.direction) > 0) n.negate();
      n.y = 0; n.normalize();
      return { point: h.point.clone(), normal: n };
    }
    return null;
  }

  params() {
    const p = this.panel;
    return { type: p.querySelector('.we-type').value, w: +p.querySelector('.we-w').value, h: +p.querySelector('.we-h').value, snap: p.querySelector('.we-snap').checked };
  }

  sillY(hitY, h, snap) {
    if (!snap) return hitY - h / 2;
    const floor = Math.max(0, Math.floor(hitY / 3.1));
    return floor * 3.1 + 0.9;
  }

  updatePreview(e) {
    const hit = this.pick(e);
    if (!hit) { this.preview.visible = false; return; }
    const { w, h, snap } = this.params();
    const y = this.sillY(hit.point.y, h, snap);
    this.preview.visible = true;
    this.preview.scale.set(w, h, 1);
    this.preview.position.set(hit.point.x + hit.normal.x * 0.05, y + h / 2, hit.point.z + hit.normal.z * 0.05);
    this.preview.rotation.set(0, Math.atan2(hit.normal.x, hit.normal.z), 0);
  }

  addAt(hit) {
    const { type, w, h, snap } = this.params();
    this.history.push(JSON.stringify(this.data));
    this.data.added.push({
      type, x: +hit.point.x.toFixed(3), y: +this.sillY(hit.point.y, h, snap).toFixed(3), z: +hit.point.z.toFixed(3),
      nx: +hit.normal.x.toFixed(4), nz: +hit.normal.z.toFixed(4), w, h: h / 1.5
    });
    this.refresh();
  }

  removeAt(p) {
    // primero ventanas del usuario
    let best = -1, bd = 1.5;
    this.data.added.forEach((w, i) => {
      const d = Math.hypot(w.x - p.x, w.y + 0.75 - p.y, w.z - p.z);
      if (d < bd) { bd = d; best = i; }
    });
    this.history.push(JSON.stringify(this.data));
    if (best >= 0) { this.data.added.splice(best, 1); this.refresh(); return; }
    for (const f of this.builder.facadeSets) {
      const key = f.hideNear(p, 1.5);
      if (key) { this.data.hidden.push(key); this.save(); return; }
    }
    this.history.pop();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    const wasHidden = new Set(this.data.hidden);
    this.data = JSON.parse(prev);
    // si se restauró una ventana automática, recargar para volver a mostrarla
    if ([...wasHidden].some((k) => !this.data.hidden.includes(k))) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* */ }
      location.reload();
      return;
    }
    this.refresh();
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'custom-windows.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
