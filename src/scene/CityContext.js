import * as THREE from 'three';
import { makeTreeImpostors } from './RealTrees.js';
import { load as loadPBR } from './PBRSurfaces.js';

/**
 * CityContext — Contexto real de Bogotá alrededor del hotel (estilo masterplan Umbra / Google Earth):
 *  · Cerca del hotel (~900 m) el suelo es adoquín y césped fotogramétricos (Poly Haven); la ortofoto solo
 *    se usa como máscara de zonas verdes. Más lejos, ortofoto real (Esri) con el relieve de los Cerros.
 *  · Relieve real (Terrarium / Mapzen DEM): los Cerros Orientales aparecen en el horizonte.
 *  · ~6.400 construcciones reales de Catastro Bogotá (data/geometry/city-context.json), con la cubierta
 *    texturizada con la propia ortofoto y fachadas de ladrillo / pañete con ventanas por piso.
 *  · Arbolado detectado en la ortofoto (copas oscuras y texturizadas) como árboles 3D instanciados.
 * Todo se carga en segundo plano: la escena funciona igual mientras llegan las teselas.
 */
const LON0 = -74.043696, LAT0 = 4.704585, MLON = 110945, MLAT = 110574, DX = -13.47, DZ = 7.15;
const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const FLAT_R0 = 420, FLAT_R1 = 950; // dentro de FLAT_R0 el suelo es plano (calles modeladas)

const tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const tileY = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tile2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z));
const lx = (lon) => (lon - LON0) * MLON + DX;
const lz = (lat) => -(lat - LAT0) * MLAT + DZ;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function loadImg(url) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = url;
  });
}

async function pool(items, n, fn) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const it = items[k++]; await fn(it); } }));
}

/** Mosaico de teselas XYZ que cubre el cuadrado local [-half, half]² (más el desfase de alineación). */
function planMosaic(z, half) {
  const lonA = LON0 + (-half - DX) / MLON, lonB = LON0 + (half - DX) / MLON;
  const latN = LAT0 - (-half - DZ) / MLAT, latS = LAT0 - (half - DZ) / MLAT;
  const tx0 = Math.floor(tileX(lonA, z)), tx1 = Math.floor(tileX(lonB, z));
  const ty0 = Math.floor(tileY(latN, z)), ty1 = Math.floor(tileY(latS, z));
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
  return {
    z, tx0, ty0, nx, ny,
    x0: lx(tile2lon(tx0, z)), x1: lx(tile2lon(tx1 + 1, z)),
    zN: lz(tile2lat(ty0, z)), zS: lz(tile2lat(ty1 + 1, z))
  };
}

export class CityContext {
  constructor(scene, { renderer, mobile = false } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.mobile = mobile;
    this.group = new THREE.Group();
    this.group.name = 'CityContext';
    scene.add(this.group);
    this.h0 = 0;
    this.dem = null;
    this.levels = [];
    this.ready = this._init();
  }

  /** Altura del terreno (m, relativa al hotel) en coordenadas locales. */
  heightAt(x, z) {
    const r = Math.hypot(x, z);
    if (!this.dem || r < FLAT_R0) return 0;
    return smooth(FLAT_R0, FLAT_R1, r) * Math.max(-40, this._demSample(x, z) - this.h0);
  }

  _demSample(x, z) {
    const d = this.dem;
    const u = ((x - d.x0) / (d.x1 - d.x0)) * (d.w - 1), v = ((z - d.zN) / (d.zS - d.zN)) * (d.h - 1);
    const i = Math.max(0, Math.min(d.w - 2, Math.floor(u))), j = Math.max(0, Math.min(d.h - 2, Math.floor(v)));
    const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
    const a = d.data[j * d.w + i], b = d.data[j * d.w + i + 1], c = d.data[(j + 1) * d.w + i], e = d.data[(j + 1) * d.w + i + 1];
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv;
  }

  async _loadDEM() {
    const m = planMosaic(11, 26000);
    const cv = document.createElement('canvas');
    cv.width = m.nx * 256; cv.height = m.ny * 256;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const jobs = [];
    for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) jobs.push([i, j]);
    await pool(jobs, 8, async ([i, j]) => {
      const img = await loadImg(`${DEM}${m.z}/${m.tx0 + i}/${m.ty0 + j}.png`);
      if (img) ctx.drawImage(img, i * 256, j * 256);
    });
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const data = new Float32Array(cv.width * cv.height);
    for (let k = 0; k < data.length; k++) data[k] = px[k * 4] * 256 + px[k * 4 + 1] + px[k * 4 + 2] / 256 - 32768;
    this.dem = { ...m, w: cv.width, h: cv.height, data };
    this.h0 = this._demSample(0, 0);
  }

  _makeLevel(z, half, segs, y, opts = {}) {
    const m = planMosaic(z, half);
    const cv = document.createElement('canvas');
    cv.width = m.nx * 256; cv.height = m.ny * 256;
    const ctx = cv.getContext('2d', { willReadFrequently: !!opts.keepPixels });
    ctx.fillStyle = '#6f6c62';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 4;

    const w = m.x1 - m.x0, d = m.zS - m.zN;
    const geo = new THREE.PlaneGeometry(w, d, segs, segs);
    geo.rotateX(-Math.PI / 2);
    geo.translate((m.x0 + m.x1) / 2, 0, (m.zN + m.zS) / 2);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0, color: 0xffffff, envMapIntensity: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.receiveShadow = !!opts.shadow;
    mesh.renderOrder = -0.5;
    this.group.add(mesh);
    const level = { ...m, half, canvas: cv, ctx, tex, mesh, geo, y };
    this.levels.push(level);
    return level;
  }

  /** Nivel lejano: ortofoto real (contexto urbano y montaña), con un recorte donde está el nivel cercano. */
  _photoMat(level, H) {
    const mat = level.mesh.material;
    mat.map = level.tex; mat.color.setHex(0xe4e4e4); mat.roughness = 1;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCtxW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCtxW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCtxW;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (abs(vCtxW.x - ${H.cx.toFixed(2)}) < ${H.hx.toFixed(2)} && abs(vCtxW.y - ${H.cz.toFixed(2)}) < ${H.hz.toFixed(2)}) discard;`);
    };
    mat.customProgramCacheKey = () => `ctxhole_${H.cx.toFixed(1)}_${H.cz.toFixed(1)}_${H.hx.toFixed(1)}_${H.hz.toFixed(1)}`;
    mat.needsUpdate = true;
  }

  /**
   * Suelo realista: césped / asfalto / concreto PBR a escala real. La ortofoto se lee muy desenfocada
   * solo como máscara (verde → césped; gris oscuro → asfalto; gris claro → concreto), así el trazado de
   * parques y calles de Bogotá es el real pero no se ve ninguna foto pixelada.
   */
  _groundMat(level, H) {
    if (!CityContext._gtex) {
      CityContext._gtex = { g: loadPBR('leafy_grass', 'diff', true), a: loadPBR('asphalt_02', 'diff', true), c: loadPBR('herringbone_pavement', 'diff', true) };
    }
    const T = CityContext._gtex;
    const mat = level.mesh.material;
    const uni = {
      tSat: { value: level.tex }, uSatB: { value: new THREE.Vector4(level.x0, level.zN, level.x1 - level.x0, level.zS - level.zN) },
      tGrass: { value: T.g }, tAsph: { value: T.a }, tConc: { value: T.c }
    };
    const holeGLSL = H ? `if (abs(vGW.x - ${H.cx.toFixed(2)}) < ${H.hx.toFixed(2)} && abs(vGW.z - ${H.cz.toFixed(2)}) < ${H.hz.toFixed(2)}) discard;` : '';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vGW;
        uniform sampler2D tSat, tGrass, tAsph, tConc; uniform vec4 uSatB;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${holeGLSL}`)
        .replace('#include <map_fragment>', `
          vec2 w = vGW.xz;
          vec2 st = (w - uSatB.xy) / uSatB.zw; st.y = 1.0 - st.y;
          vec3 s = texture2D(tSat, st, 0.6).rgb;               // calco del trazado real (sin desenfoque)
          float gr = (s.g - max(s.r, s.b)) / max(s.g, 0.015);
          float veg = smoothstep(0.09, 0.15, gr);
          float lum = dot(s, vec3(0.3, 0.59, 0.11));
          float dist = length(vGW - cameraPosition);
          float far = smoothstep(260.0, 1400.0, dist);
          mat2 R = mat2(0.7986, -0.6018, 0.6018, 0.7986);
          // promedios (último nivel de mipmap) para la lejanía: sin repetición ni moiré
          vec3 gAvg = texture2D(tGrass, vec2(0.5), 14.0).rgb, aAvg = texture2D(tAsph, vec2(0.5), 14.0).rgb, cAvg = texture2D(tConc, vec2(0.5), 14.0).rgb;
          vec3 grass = gAvg, asph = aAvg, conc = cAvg;
          if (far < 0.999) {
            float mx = smoothstep(0.35, 0.65, texture2D(tGrass, w / 61.0).g / max(gAvg.g * 2.0, 0.01));
            grass = mix(texture2D(tGrass, w / 2.4).rgb, texture2D(tGrass, R * w / 3.7 + 0.31).rgb, mx);
            grass *= mix(0.82, 1.12, texture2D(tConc, R * w / 83.0).r / max(cAvg.r * 2.0, 0.01));
            asph = mix(texture2D(tAsph, w / 4.5).rgb, texture2D(tAsph, R * w / 6.9 + 0.5).rgb, 0.5);
            conc = mix(texture2D(tConc, w / 2.2).rgb, texture2D(tConc, R * w / 2.9 + 0.4).rgb, 0.0);
            grass = mix(grass, gAvg, far); asph = mix(asph, aAvg, far); conc = mix(conc, cAvg, far);
          }
          // el parque se tiñe levemente con el verde real (zonas secas / sombreadas)
          // césped uniforme (sin manchas de la foto)
          // todo lo que no es zona verde es adoquín (en espiga); el asfalto de las vías ya está modelado
          // adoquín gris de concreto (espiga) para andenes, plazoletas y patios; asfalto donde la foto es oscura
          conc = mix(vec3(dot(conc, vec3(0.3, 0.59, 0.11))), conc, 0.22) * 1.15;
          vec3 paved = mix(asph, conc, smoothstep(0.055, 0.085, lum));
          vec3 ground = mix(paved, grass, veg);
          // borde exterior: se funde con la ortofoto del nivel lejano (sin costura)
          vec2 eb = min(st, 1.0 - st) * uSatB.zw;
          float edge = 1.0 - smoothstep(20.0, 180.0, min(eb.x, eb.y));
          ground = mix(ground, texture2D(tSat, st).rgb * 0.9, edge);
          diffuseColor.rgb *= ground;
        `);
    };
    mat.customProgramCacheKey = () => `ground_${H ? `${H.cx.toFixed(1)}_${H.cz.toFixed(1)}_${H.hx.toFixed(1)}` : 'full'}`;
    mat.needsUpdate = true;
  }

  _applyHeights(level) {
    const pos = level.geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.heightAt(pos.getX(k), pos.getZ(k)));
    pos.needsUpdate = true;
    level.geo.computeVertexNormals();
    level.geo.computeBoundingSphere();
  }

  async _fillLevel(level) {
    const jobs = [];
    const c = [(level.nx - 1) / 2, (level.ny - 1) / 2];
    for (let j = 0; j < level.ny; j++) for (let i = 0; i < level.nx; i++) jobs.push([i, j]);
    jobs.sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
    let n = 0;
    await pool(jobs, 10, async ([i, j]) => {
      const img = await loadImg(`${IMG}${level.z}/${level.ty0 + j}/${level.tx0 + i}`);
      if (img) level.ctx.drawImage(img, i * 256, j * 256);
      if (++n % 12 === 0) level.tex.needsUpdate = true;
    });
    level.tex.needsUpdate = true;
  }

  async _init() {
    const mob = this.mobile;
    // Niveles de detalle (del más lejano al más cercano); cada uno un poco más abajo para evitar z-fighting
    const L3 = this._makeLevel(12, 22000, mob ? 96 : 160, -3.0);
    const L2 = this._makeLevel(15, mob ? 2400 : 3200, mob ? 96 : 140, -1.2);
    const L1 = this._makeLevel(mob ? 17 : 18, mob ? 650 : 900, 90, -0.45, { keepPixels: true, shadow: true });
    const L0 = mob ? null : this._makeLevel(19, 340, 40, -0.16, { shadow: true });
    const hole = (L) => ({ cx: (L.x0 + L.x1) / 2, cz: (L.zN + L.zS) / 2, hx: (L.x1 - L.x0) / 2 - 1, hz: (L.zS - L.zN) / 2 - 1 });
    // Los niveles lejanos no se dibujan bajo los cercanos
    // Lejos (ciudad y Cerros Orientales): la ortofoto real se conserva. Cerca del hotel: adoquín / césped reales.
    this._photoMat(L3, hole(L2)); this._photoMat(L2, hole(L1));
    this._groundMat(L1, L0 ? hole(L0) : null); if (L0) this._groundMat(L0, null);

    // construcciones: archivo precalculado del repositorio o, si no está, consulta en vivo al Catastro de Bogotá
    const cityP = fetch('./data/geometry/city-context.json')
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => (d?.b?.length ? d : this._fetchCatastro(1100).catch((e) => { console.warn('Catastro en vivo no disponible', e); return null; })));
    const far3 = this._fillLevel(L3); // pocas teselas: el horizonte aparece enseguida
    const near = Promise.all([L0 && this._fillLevel(L0), this._fillLevel(L1)]);
    const far2 = near.then(() => this._fillLevel(L2));
    try { await this._loadDEM(); } catch (e) { console.warn('DEM no disponible', e); }
    [L3, L2, L1, L0].forEach((L) => L && this._applyHeights(L));
    const city = await cityP;
    if (city?.b?.length) this._buildBuildings(city.b, L0 || L1, L1, L2);
    await near;
    try { this._buildTrees(L1); } catch (e) { console.warn('árboles satelitales', e); }
    await Promise.all([far2, far3]);
    // las fotos ya no se leen en CPU: libera memoria
    this.levels.forEach((L) => { L.ctx = null; });
  }

  /** Consulta en vivo al servicio ArcGIS público de Catastro Bogotá (mismo formato que build-city-context.py). */
  async _fetchCatastro(R) {
    const SRV = 'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/construccion/MapServer/0/query';
    const dlon = R / MLON, dlat = R / MLAT;
    const base = {
      where: '1=1', geometry: `${LON0 - dlon},${LAT0 - dlat},${LON0 + dlon},${LAT0 + dlat}`, geometryType: 'esriGeometryEnvelope',
      inSR: 4326, spatialRel: 'esriSpatialRelIntersects', f: 'json'
    };
    const cnt = await fetch(`${SRV}?${new URLSearchParams({ ...base, returnCountOnly: true })}`).then((r) => r.json());
    const pages = Math.ceil((cnt.count || 0) / 2000);
    const feats = (await Promise.all(Array.from({ length: pages }, (_, i) => fetch(`${SRV}?${new URLSearchParams({
      ...base, outSR: 4326, outFields: 'CONNPISOS,CONALTURA,LOTECODIGO', returnGeometry: true, geometryPrecision: 6,
      resultOffset: i * 2000, resultRecordCount: 2000, orderByFields: 'OBJECTID'
    })}`).then((r) => r.json()).then((d) => d.features || []).catch(() => [])))).flat();
    const out = [], seen = new Set();
    for (const f of feats) {
      const a = f.attributes || {};
      if (a.LOTECODIGO === '008401019001') continue; // el hotel se modela aparte (Revit)
      const ring = f.geometry?.rings?.[0];
      if (!ring || ring.length < 4) continue;
      let pts = ring.map(([lon, lat]) => [lx(lon), lz(lat)]);
      if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
      const simp = [pts[0]];
      for (const p of pts.slice(1)) if (Math.hypot(p[0] - simp[simp.length - 1][0], p[1] - simp[simp.length - 1][1]) > 0.6) simp.push(p);
      if (simp.length < 3) continue;
      let ar = 0; simp.forEach((p, k) => { const q = simp[(k + 1) % simp.length]; ar += p[0] * q[1] - q[0] * p[1]; });
      if (Math.abs(ar / 2) < 12) continue;
      const cx = simp.reduce((s2, p) => s2 + p[0], 0) / simp.length, cz = simp.reduce((s2, p) => s2 + p[1], 0) / simp.length;
      if (Math.hypot(cx, cz) > R) continue;
      const key = `${cx.toFixed(1)},${cz.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let h = a.CONALTURA > 0 ? a.CONALTURA : Math.max(3, (a.CONNPISOS || 1) * 2.9);
      h = Math.min(h, 140);
      const q = simp.flatMap((p) => [Math.round(p[0] * 10), Math.round(p[1] * 10)]);
      const rec = [Math.round(h * 10), q[0], q[1]];
      for (let k = 2; k < q.length; k++) rec.push(q[k] - q[k - 2]);
      out.push(rec);
    }
    return { v: 1, r: R, b: out };
  }

  _buildBuildings(recs, A, B, C) {
    const pos = [], nor = [], uv = [], cen = [];
    const v = new THREE.Vector2();
    for (const r of recs) {
      const h = r[0] / 10;
      let x = r[1], z = r[2];
      const pts = [[x / 10, z / 10]];
      for (let k = 3; k < r.length; k += 2) { x += r[k]; z += r[k + 1]; pts.push([x / 10, z / 10]); }
      // orientación antihoraria vista desde arriba (en XZ con Z al sur)
      let ar = 0;
      for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }
      if (ar > 0) pts.reverse();
      let cx = 0, cz = 0; pts.forEach((p) => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
      const g = this.heightAt(cx, cz);
      const y0 = g - 1.5, y1 = g + h;
      // muros
      let per = 0;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], q = pts[(k + 1) % pts.length];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 0.05) continue;
        const nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L;
        const quad = [[p, y0, per], [q, y0, per + L], [q, y1, per + L], [p, y0, per], [q, y1, per + L], [p, y1, per]];
        for (const [pp, yy, uu] of quad) {
          pos.push(pp[0], yy, pp[1]); nor.push(nx, 0, nz); uv.push(uu, yy - g); cen.push(cx, cz);
        }
        per += L;
      }
      // cubierta plana
      try {
        const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
        const tris = THREE.ShapeUtils.triangulateShape(contour, []);
        for (const t of tris) {
          for (const idx of [t[0], t[2], t[1]]) {
            const p = pts[idx];
            pos.push(p[0], y1, p[1]); nor.push(0, 1, 0); uv.push(-1, -1); cen.push(cx, cz);
          }
        }
      } catch (e) { /* polígono degenerado */ }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 2));
    geo.computeBoundingSphere();

    const bounds = (L) => new THREE.Vector4(L.x0, L.zN, L.x1 - L.x0, L.zS - L.zN);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, envMapIntensity: 0.5 });
    const uni = {
      tSatA: { value: A.tex }, uSatA: { value: bounds(A) },
      tSatB: { value: B.tex }, uSatB: { value: bounds(B) },
      tSatC: { value: C.tex }, uSatC: { value: bounds(C) }
    };
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uni);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aCenter;\nvarying vec2 vCen;\nvarying vec3 vCW;\nvarying vec2 vFac;\nvarying float vUp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCen = aCenter;\nvFac = uv;\nvUp = normal.y;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vCen; varying vec3 vCW; varying vec2 vFac; varying float vUp;
          uniform sampler2D tSatA, tSatB, tSatC; uniform vec4 uSatA, uSatB, uSatC;
          float hsh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          vec2 satUV(vec4 b, vec2 w){ vec2 t = (w - b.xy) / b.zw; return vec2(t.x, 1.0 - t.y); }
          bool inside(vec2 t){ return t.x > 0.002 && t.x < 0.998 && t.y > 0.002 && t.y < 0.998; }
          vec3 sat(vec2 w, float bias){
            vec2 a = satUV(uSatA, w); if (inside(a)) return texture2D(tSatA, a, bias).rgb;
            vec2 b = satUV(uSatB, w); if (inside(b)) return texture2D(tSatB, b, bias).rgb;
            return texture2D(tSatC, satUV(uSatC, w), bias).rgb;
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float rnd = hsh(vCen);
          float facRough = 0.0;
          if (vUp > 0.5) {
            // cubierta: la propia ortofoto (con el relieve de la foto) + un toque de contraste
            vec3 c = sat(vCW.xz, 0.0);
            diffuseColor.rgb *= pow(c, vec3(1.08)) * 1.08;
          } else {
            // fachada: paleta bogotana (ladrillo, pañete crema, gris) teñida con el color de su cubierta
            vec3 roofC = sat(vCen, 4.0);
            vec3 brick = vec3(0.56, 0.27, 0.17), cream = vec3(0.80, 0.76, 0.68), grey = vec3(0.66, 0.66, 0.65);
            vec3 base = rnd < 0.55 ? brick : (rnd < 0.82 ? cream : grey);
            base = mix(base, roofC * 0.9, 0.25) * (0.85 + 0.3 * hsh(vCen + 3.1));
            float fh = 2.75 + 0.35 * hsh(vCen + 7.7), cw = 2.6 + 1.2 * hsh(vCen + 1.3);
            float fy = fract(vFac.y / fh), fx = fract(vFac.x / cw);
            vec2 fw = fwidth(vFac);
            float aa = smoothstep(0.18, 0.5, max(fw.x / cw, fw.y / fh)); // a distancia: color medio (sin moiré)
            float win = step(0.25, fx) * step(fx, 0.75) * step(0.36, fy) * step(fy, 0.82) * step(1.2, vFac.y);
            float lit = step(0.95, hsh(floor(vec2(vFac.x / cw, vFac.y / fh)) + vCen));
            vec3 glass = mix(vec3(0.06, 0.075, 0.09), vec3(0.24, 0.27, 0.3), 0.3 * hsh(floor(vec2(vFac.x / cw, vFac.y / fh)) + vCen)) + lit * vec3(0.08, 0.07, 0.04);
            float band = step(fract(vFac.y / fh), 0.06) * 0.25;
            diffuseColor.rgb = mix(mix(base * (1.0 - band), glass, win), mix(base, vec3(0.16, 0.18, 0.2), 0.2), aa);
            facRough = mix(win, 0.25, aa);
          }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, facRough);');
    };
    this.buildings = new THREE.Mesh(geo, mat);
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;
    this.group.add(this.buildings);
  }

  /** Árboles a partir de la ortofoto: píxeles verdes, oscuros y con textura (copas, no césped). */



  /** Árboles de contexto detectados en ortofoto, con copas continuas y distribución agrupada. */
  _buildTrees(L) {
    if (!L.ctx) return;
    const W = L.canvas.width, H = L.canvas.height;
    const px = L.ctx.getImageData(0, 0, W, H).data;
    const mpp = (L.x1 - L.x0) / W;
    // Menos ejemplares y mayor separación: el fondo conserva la lectura del barrio y no
    // compite con los árboles 3D detallados junto al hotel.
    const step = this.mobile ? 12 : 9.5;
    const max = this.mobile ? 850 : 3200;
    const greenAt = (u, v) => {
      if (u < 0 || v < 0 || u >= W || v >= H) return false;
      const i = (v * W + u) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      return g - r > 9 && g - b > 12 && g > 24 && g < 165;
    };
    const lum = (i) => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    const rand = (x, z, seed = 0) => {
      const v = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };
    const pts = [];
    for (let z = L.zN + 5; z < L.zS - 5; z += step) {
      for (let x = L.x0 + 5; x < L.x1 - 5; x += step) {
        const jx = x + (rand(x, z, 1) - 0.5) * step * 0.55;
        const jz = z + (rand(x, z, 2) - 0.5) * step * 0.55;
        if (Math.hypot(jx - 10, jz - 5) < 245) continue; // el arbolado próximo ya está modelado
        const u = Math.floor((jx - L.x0) / mpp), v = Math.floor((jz - L.zN) / mpp);
        if (u < 5 || v < 5 || u >= W - 5 || v >= H - 5) continue;

        // Aceptar manchas vegetales, no píxeles verdes aislados de cubiertas o señalización.
        let greenNeighbors = 0;
        for (let dv = -4; dv <= 4; dv += 2) {
          for (let du = -4; du <= 4; du += 2) {
            if (greenAt(u + du, v + dv)) greenNeighbors++;
          }
        }
        if (greenNeighbors < 7) continue;
        const i = (v * W + u) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
        let s = 0, s2 = 0, n = 0;
        for (let dv = -3; dv <= 3; dv += 2) for (let du = -3; du <= 3; du += 2) {
          const value = lum(((v + dv) * W + u + du) * 4);
          s += value; s2 += value * value; n++;
        }
        const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
        if (sd < 7) continue;
        pts.push([jx, jz, r, g, b, rand(x, z, 3), rand(x, z, 4), rand(x, z, 5)]);
        if (pts.length >= max) break;
      }
      if (pts.length >= max) break;
    }
    if (!pts.length) return;

    // Arboleda de la ciudad: la imagen real del fresno (SKPTrees) girada siempre hacia la cámara,
    // teñida suavemente con el color de la ortofoto (2 triángulos por árbol).
    const crowns = makeTreeImpostors(pts.length);
    const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(), position = new THREE.Vector3(), color = new THREE.Color();
    const white = new THREE.Color(1, 1, 1);
    pts.forEach(([x, z, r, g, b, variation, widthVariation, hueVariation], k) => {
      const groundY = this.heightAt(x, z);
      const h = 6.5 + variation * 6 + widthVariation * 2;
      matrix.compose(position.set(x, groundY - 0.1, z), rotation, scale.set(h * (0.9 + hueVariation * 0.3), h, 1));
      crowns.setMatrixAt(k, matrix);
      color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiplyScalar(2.2);
      crowns.setColorAt(k, white.clone().lerp(color, 0.3));
    });
    crowns.castShadow = false;
    crowns.receiveShadow = false;
    this.group.add(crowns);
    this.trees = crowns;
  }


}
