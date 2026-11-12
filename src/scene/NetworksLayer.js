import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * NetworksLayer — Capa de REDES (instalaciones / MEP).
 *
 * Al encenderla, la arquitectura se vuelve transparente (rayos X) y se dibujan las redes
 * (tuberías, ductos, bandejas, aparatos) con el color de su sistema. Cada sistema se puede
 * prender/apagar en el panel.
 *
 * Archivo esperado: ./data/geometry/redes-piso2.json  (también se puede cargar desde el panel
 * para probarlo antes de subirlo). Formato:
 * {
 *   "units": "mm",                 // "mm" (por defecto) o "m"
 *   "zRef": "absolute",            // "absolute": Z del proyecto Revit · "piso2": Z medida desde el piso 2
 *   "systems": { "Agua fría": { "color": "#2f80ed" } },          // opcional (colores propios)
 *   "elements": [
 *     { "system": "Agua fría", "category": "Pipes", "diameter": 25,  "points": [[x,y,z],[x,y,z], ...] },
 *     { "system": "Aire acondicionado", "category": "Ducts", "width": 400, "height": 250, "points": [[x,y,z],[x,y,z]] },
 *     { "system": "Eléctrica", "category": "CableTray", "width": 300, "height": 100, "points": [[x,y,z],[x,y,z]] },
 *     { "system": "Sanitaria", "category": "Fixture", "position": [x,y,z], "size": 400, "name": "Sifón" }
 *   ]
 * }
 * X, Y son las mismas coordenadas de planta de Revit que usan las habitaciones (mm); Z es la altura.
 * También se acepta "segments": [[x1,y1,z1,x2,y2,z2,diámetro], ...] dentro de cada sistema.
 */
const FILE = './data/geometry/redes-piso2.json';
const EXAMPLE = './data/geometry/redes-piso2.example.json';
const P2 = 3.02;
const PALETTE = [
  [/fr[ií]a|potable|af\b/i, '#2f80ed'],
  [/caliente|ac\b|retorno/i, '#eb5757'],
  [/sanitar|desag|aguas negras|residual/i, '#8d6e63'],
  [/lluvia|pluvial/i, '#26a69a'],
  [/incendio|rci|sprink|rociad/i, '#ff1744'],
  [/gas/i, '#f2c94c'],
  [/el[eé]ctr|fuerza|potencia|ilumin/i, '#f2994a'],
  [/datos|voz|red|comunic|cctv|tv/i, '#9b51e0'],
  [/aire|hvac|ducto|clima|suministro/i, '#56ccf2'],
  [/extrac|ventila/i, '#6fcf97']
];
const FALLBACK = ['#2f80ed', '#eb5757', '#f2994a', '#9b51e0', '#27ae60', '#56ccf2', '#f2c94c', '#8d6e63'];

export class NetworksLayer {
  constructor(app) {
    this.app = app;                  // MasterplanScene
    this.on = false;
    this.opacity = 0.14;
    this.group = new THREE.Group();
    this.group.name = 'Redes';
    this.group.visible = false;
    app.scene.add(this.group);
    this.systems = new Map();        // nombre -> { color, mesh, count, visible }
    this.ghosted = new Map();        // material original -> material transparente
    this.data = null;
    this._buildUI();
  }

  // ------------------------------------------------------------------ datos
  async loadDefault() {
    try {
      const r = await fetch(FILE, { cache: 'no-store' });
      if (r.ok) { this.setData(await r.json(), 'redes-piso2.json'); return true; }
    } catch (e) { /* sin archivo todavía */ }
    this._status('Aún no hay archivo de redes en el proyecto. Puedes cargar uno para probarlo o ver el ejemplo.');
    return false;
  }

  async loadExample() {
    try {
      const r = await fetch(EXAMPLE, { cache: 'no-store' });
      if (r.ok) this.setData(await r.json(), 'ejemplo');
    } catch (e) { this._status('No se pudo cargar el ejemplo.'); }
  }

  setData(json, label = '') {
    this.data = json;
    this.group.clear();
    this.systems.clear();
    const k = String(json.units || 'mm').toLowerCase() === 'm' ? 1 : 0.001;
    const relP2 = String(json.zRef || 'absolute').toLowerCase().startsWith('piso');
    // Revit (x, y planta; z altura) → escena (x, y=altura, z=-y)
    const toV = (p) => new THREE.Vector3(p[0] * k, (relP2 ? P2 : 0.02) + (p[2] || 0) * k, -p[1] * k);
    const parts = new Map(); // sistema -> geometrías
    const push = (sys, g) => { if (!parts.has(sys)) parts.set(sys, []); parts.get(sys).push(g); };

    const addRun = (sys, pts, el) => {
      const isBox = el.width != null && el.height != null;
      const rad = Math.max(((el.diameter || el.size || 50) * k) / 2, 0.018);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
        if (L < 1e-4) continue;
        const g = isBox
          ? new THREE.BoxGeometry(Math.max(el.width * k, 0.03), Math.max(el.height * k, 0.03), L)
          : new THREE.CylinderGeometry(rad, rad, L, 14, 1, true).rotateX(Math.PI / 2);
        const m = new THREE.Matrix4().lookAt(a, b, Math.abs(b.y - a.y) > 0.99 * L ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
        m.setPosition(a.clone().add(b).multiplyScalar(0.5));
        g.applyMatrix4(m);
        push(sys, g);
        if (!isBox) push(sys, new THREE.SphereGeometry(rad * 1.18, 12, 8).translate(b.x, b.y, b.z)); // uniones
      }
      if (!isBox && pts[0]) push(sys, new THREE.SphereGeometry(rad * 1.18, 12, 8).translate(pts[0].x, pts[0].y, pts[0].z));
    };

    for (const el of json.elements || []) {
      const sys = el.system || el.category || 'Sin sistema';
      if (Array.isArray(el.points) && el.points.length > 1) addRun(sys, el.points.map(toV), el);
      else if (Array.isArray(el.position)) {
        const s = Math.max((el.size || 300) * k, 0.08);
        push(sys, new THREE.BoxGeometry(s, s, s).translate(...toV(el.position).toArray()));
      }
    }
    // variante "systems": { nombre: { segments: [[x1,y1,z1,x2,y2,z2,d], ...] } }
    for (const [name, def] of Object.entries(json.systems || {})) {
      for (const sgm of def.segments || []) addRun(name, [toV(sgm.slice(0, 3)), toV(sgm.slice(3, 6))], { diameter: sgm[6] });
    }

    let idx = 0;
    for (const [name, geos] of parts) {
      const color = json.systems?.[name]?.color || PALETTE.find(([re]) => re.test(name))?.[1] || FALLBACK[idx % FALLBACK.length];
      idx++;
      const geo = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.systems.set(name, { color, mesh, count: geos.length, visible: true });
    }
    this._renderSystems();
    const n = (json.elements || []).length;
    this._status(this.systems.size ? `${label ? label + ' · ' : ''}${this.systems.size} sistemas · ${n} elementos` : 'El archivo no tiene elementos con geometría.');
  }

  // ------------------------------------------------------- arquitectura rayos X
  _archRoots() {
    const a = this.app;
    return [a.buildingBuilder?.rootGroup, a.interiorBuilder?.group, a.tour?.group].filter(Boolean);
  }

  _ghost(on) {
    const swap = (m) => {
      if (!m) return m;
      if (on) {
        if (m.userData?.isGhost) return m;
        let g = this.ghosted.get(m);
        if (!g) {
          g = m.clone();
          g.transparent = true; g.depthWrite = false; g.opacity = this.opacity * (m.opacity ?? 1);
          if ('emissiveIntensity' in g) g.emissiveIntensity = (m.emissiveIntensity || 0) * 0.3;
          g.userData = { isGhost: true, original: m };
          this.ghosted.set(m, g);
        }
        return g;
      }
      return m.userData?.isGhost ? m.userData.original : m;
    };
    for (const root of this._archRoots()) {
      root.traverse((o) => {
        if (!o.material || o === this.group) return;
        o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
        if (on) { o.userData._cs = o.castShadow; o.castShadow = false; } else if (o.userData._cs != null) o.castShadow = o.userData._cs;
      });
    }
  }

  setOpacity(v) {
    this.opacity = v;
    for (const [m, g] of this.ghosted) g.opacity = v * (m.opacity ?? 1);
  }

  async toggle(force) {
    const on = force ?? !this.on;
    if (on === this.on) return;
    this.on = on;
    this.btn.classList.toggle('active', on);
    this.panel.classList.toggle('open', on);
    if (on && !this.data) await this.loadDefault();
    this.group.visible = on;
    this._ghost(on);
  }

  // ------------------------------------------------------------------- UI
  _buildUI() {
    const bar = document.querySelector('.top-right-bar');
    const btn = document.createElement('button');
    btn.className = 'mode-pill-btn net-toggle';
    btn.style.cssText = 'background: rgba(38,40,44,0.76); border:1px solid rgba(255,255,255,0.18); color:#fff;';
    btn.title = 'Capa de redes: arquitectura transparente + instalaciones';
    btn.innerHTML = '<svg class="ui-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg> Redes';
    btn.onclick = () => this.toggle();
    bar?.insertBefore(btn, bar.firstChild);
    this.btn = btn;

    const p = document.createElement('div');
    p.className = 'net-panel';
    p.innerHTML = `
      <div class="net-title">Redes · Instalaciones</div>
      <div class="net-status"></div>
      <div class="net-systems"></div>
      <label class="net-lbl">Transparencia de la arquitectura
        <input class="net-op" type="range" min="0.03" max="0.6" step="0.01" value="${this.opacity}"></label>
      <div class="net-row">
        <label class="net-btn">Cargar JSON<input type="file" accept=".json,application/json" hidden></label>
        <button class="net-btn net-ex">Ver ejemplo</button>
      </div>
      <div class="net-help">Archivo del proyecto: <code>data/geometry/redes-piso2.json</code> · coordenadas Revit en mm (X, Y de planta y Z de altura).</div>`;
    document.body.appendChild(p);
    this.panel = p;
    this.statusEl = p.querySelector('.net-status');
    this.listEl = p.querySelector('.net-systems');
    p.querySelector('.net-op').oninput = (e) => this.setOpacity(parseFloat(e.target.value));
    p.querySelector('.net-ex').onclick = () => this.loadExample();
    p.querySelector('input[type=file]').onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try { this.setData(JSON.parse(await f.text()), f.name); } catch (err) { this._status('El archivo no es un JSON válido: ' + err.message); }
      e.target.value = '';
    };
    this.listEl.onchange = (e) => {
      const name = e.target.dataset?.sys;
      const s = this.systems.get(name);
      if (s) { s.visible = e.target.checked; s.mesh.visible = s.visible; }
    };
    const css = document.createElement('style');
    css.textContent = `
      .net-toggle.active{background:#1f8bff !important;border-color:#7cc0ff !important}
      .net-panel{position:absolute;top:104px;right:18px;z-index:41;width:270px;padding:14px;border-radius:14px;background:rgba(20,22,26,.88);
        backdrop-filter:blur(14px);color:#fff;font:12px Roboto,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);display:none}
      .net-panel.open{display:block}
      .net-title{font-weight:600;font-size:13.5px;margin-bottom:6px}
      .net-status{opacity:.8;line-height:1.45;margin-bottom:8px}
      .net-systems{display:flex;flex-direction:column;gap:5px;max-height:34vh;overflow:auto;margin-bottom:8px}
      .net-systems label{display:flex;align-items:center;gap:8px;cursor:pointer}
      .net-systems i{width:12px;height:12px;border-radius:3px;display:inline-block;box-shadow:0 0 8px currentColor}
      .net-systems small{margin-left:auto;opacity:.6}
      .net-lbl{display:block;margin:6px 0}
      .net-lbl input{width:100%}
      .net-row{display:flex;gap:6px;margin:8px 0}
      .net-btn{flex:1;padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;text-align:center;font:inherit}
      .net-help{opacity:.6;line-height:1.45;font-size:11px}
      .net-help code{font-size:10.5px}
      body.ft-room .net-panel{top:70px}
      @media (max-width:640px){.net-panel{top:auto;bottom:140px;right:12px;width:230px}}`;
    document.head.appendChild(css);
  }

  _renderSystems() {
    this.listEl.innerHTML = [...this.systems].map(([name, s]) =>
      `<label><input type="checkbox" data-sys="${name.replace(/"/g, '&quot;')}" ${s.visible ? 'checked' : ''}><i style="background:${s.color};color:${s.color}"></i>${name}<small>${s.count}</small></label>`).join('');
  }

  _status(t) { if (this.statusEl) this.statusEl.textContent = t; }
}
