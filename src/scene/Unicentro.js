import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Unicentro — Centro comercial Unicentro (Av. 15 × Calle 127), al sur-oriente del hotel.
 *  · Huellas reales de OpenStreetMap (data/geometry/unicentro.json, © colaboradores de OSM, ODbL):
 *    centro comercial (3 niveles), edificio de parqueaderos (4 niveles), marquesina y locales.
 *  · Cubiertas texturizadas con la ortofoto real (Esri World Imagery): claraboyas y equipos tal cual son.
 *  · Fachada de ladrillo con franjas de concreto por piso, vitrinas en primer piso y letrero.
 *  · Parqueaderos en superficie llenos de carros 3D (instanciados: 1 llamada de dibujo por pieza de modelo).
 */
const LON0 = -74.043696, LAT0 = 4.704585, MLON = 110945, MLAT = 110574, DX = -13.47, DZ = 7.15;
const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const toLon = (x) => LON0 + (x - DX) / MLON;
const toLat = (z) => LAT0 - (z - DZ) / MLAT;
const tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const tileY = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tile2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z));

const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i][1] > z) !== (P[j][1] > z)) && (x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; };
const area = (P) => { let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; };
/** Signo que hace que (s*ez, -s*ex) apunte hacia AFUERA del polígono (probado contra el propio polígono). */
const outSign = (P) => { let bi = 0, bl = 0; P.forEach((a, i) => { const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; bi = i; } }); const a = P[bi], b = P[(bi + 1) % P.length]; const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) / bl * 0.05, mz = (a[1] + b[1]) / 2 - (b[0] - a[0]) / bl * 0.05; return inPoly(mx, mz, P) ? -1 : 1; };
// colores de carro más comunes en Bogotá (blanco, plata, gris, negro, rojo, azul) como multiplicador del atlas
const PAINT = [0xffffff, 0xffffff, 0xd8dade, 0xa9adb3, 0x55585c, 0x2a2c30, 0x9b2a26, 0x3a4f78, 0xe9e4da].map((h) => new THREE.Color(h));
const hash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };

/** Desplaza el polígono hacia afuera `d` metros con inglete (esquinas continuas). */
function offsetPoly(P, d) {
  const s = outSign(P), n = P.length;
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [s * e1[1] / l1, -s * e1[0] / l1], n2 = [s * e2[1] / l2, -s * e2[0] / l2];
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = Math.min(3, 1 / Math.max(0.35, mx * n1[0] + mz * n1[1]));
    return [p[0] + mx * d * k, p[1] + mz * d * k];
  });
}

/** Muro vertical continuo a lo largo del polígono (UV: u = metros recorridos, v = altura en metros). */
function wallRing(P, y0, y1, { uScale = 1, vScale = 1, edgeFilter = null } = {}) {
  const pos = [], uv = [], nor = [];
  const s = outSign(P);
  let run = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) continue;
    const nx = s * (b[1] - a[1]) / L, nz = -s * (b[0] - a[0]) / L;
    if (!edgeFilter || edgeFilter(a, b, L, i)) {
      const q = [[a, y0, run], [b, y0, run + L], [b, y1, run + L], [a, y0, run], [b, y1, run + L], [a, y1, run]];
      for (const [p, y, u] of q) { pos.push(p[0], y, p[1]); nor.push(nx, 0, nz); uv.push(u / uScale, (y - y0) / vScale); }
    }
    run += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Banda saliente (franja de concreto / remate): cara exterior + cara superior + cara inferior. */
function bandRing(P, y0, y1, out) {
  const O = offsetPoly(P, out);
  const geos = [wallRing(O, y0, y1)];
  for (const [y, up] of [[y1, 1], [y0, -1]]) {
    const pos = [], nor = [];
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      const quad = [P[i], P[j], O[j], P[i], O[j], O[i]];
      for (const p of quad) { pos.push(p[0], y, p[1]); nor.push(0, up, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    geos.push(g);
  }
  return geos;
}

function capGeo(P, y) {
  const pts = area(P) > 0 ? P : [...P].reverse();
  const tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const pos = [], nor = [];
  for (const t of tris) for (const k of [t[0], t[2], t[1]]) { pos.push(pts[k][0], y, pts[k][1]); nor.push(0, 1, 0); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.flatMap((v, i) => (i % 3 === 1 ? [] : [v / 5])), 2));   // UV en mundo (5 m por repetición)
  return g;
}

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Unicentro {
  constructor(scene, { renderer, mobile = false, low = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Unicentro';
    this.renderer = renderer;
    this.maxCars = mobile ? 220 : (low ? 380 : 650);
    scene.add(this.group);
    this.ready = fetch('./data/geometry/unicentro.json').then((r) => r.json()).then((d) => this._build(d))
      .catch((e) => console.warn('Unicentro no disponible', e));
  }

  async _build(d) {
    this.data = d;
    const ortho = this._orthoTexture(d.lot);
    const aniso = this.renderer?.capabilities.getMaxAnisotropy() || 8;

    // --- materiales ---
    const tl = new THREE.TextureLoader();
    const brickMap = tl.load('./assets/textures/hlf_ladrillo.webp'); brickMap.colorSpace = THREE.SRGBColorSpace;
    const brickBump = tl.load('./assets/textures/hlf_ladrillo_bump.webp');
    [brickMap, brickBump].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; });
    const brick = new THREE.MeshStandardMaterial({ map: brickMap, bumpMap: brickBump, bumpScale: 0.08, color: 0xf3e2d6, roughness: 0.88, envMapIntensity: 0.8 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.82, envMapIntensity: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ map: ortho.tex, roughness: 0.92, envMapIntensity: 0.3 });
    roofMat.onBeforeCompile = (sh) => {
      sh.uniforms.uOB = { value: ortho.bounds };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vOW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvOW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vOW; uniform vec4 uOB;')
        .replace('#include <map_fragment>', `vec2 ouv = (vOW - uOB.xy) / uOB.zw; ouv.y = 1.0 - ouv.y;
          diffuseColor.rgb *= pow(texture2D(map, ouv).rgb, vec3(1.05)) * 1.12;`);
    };
    roofMat.customProgramCacheKey = () => 'uniRoof';
    const shopTex = canvasTex(512, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#46535a'); gr.addColorStop(0.55, '#2c363b'); gr.addColorStop(1, '#5d564b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,236,200,0.18)'; g.fillRect(30, h * 0.35, w - 60, h * 0.55);   // interior iluminado de los locales
      g.fillStyle = '#c9ccc8'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(0, h * 0.24, w, 10); g.fillRect(0, 0, w, 12); g.fillRect(0, h - 16, w, 16);
    });
    const shopMat = new THREE.MeshStandardMaterial({ map: shopTex, roughness: 0.12, metalness: 0.35, envMapIntensity: 1.3 });
    const garageTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#16191b'; g.fillRect(0, 0, w, h);                            // vacío oscuro entre losas
      g.fillStyle = '#2a2f33'; g.fillRect(0, h * 0.62, w, h * 0.38);
      for (let i = 0; i < 6; i++) { g.fillStyle = ['#7d1d1d', '#c9c9c9', '#26303a', '#8a8f94', '#e6e2d8', '#1f2a44'][i]; g.fillRect(20 + i * 82, h * 0.6, 60, h * 0.14); }  // carros adentro
      g.fillStyle = '#cfcac0'; g.fillRect(0, 0, w, h * 0.36);                     // antepecho de concreto
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h * 0.33, w, 4);
      g.fillStyle = '#bdb8ad'; g.fillRect(0, 0, 18, h);                            // columna
    });
    const garageMat = new THREE.MeshStandardMaterial({ map: garageTex, roughness: 0.85, envMapIntensity: 0.6 });
    const stucco = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9, envMapIntensity: 0.6 });

    [brick, concrete, roofMat, shopMat, garageMat, stucco].forEach((m) => { m.side = THREE.DoubleSide; });
    const add = (geo, mat, { cast = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; this.group.add(m); return m; };

    // --- centro comercial: 3 niveles (4.6 m) + antepecho ---
    if (d.mall) {
      const P = d.mall.pts, H = 15.6;
      const geoB = wallRing(P, -2, H, { uScale: 1.35, vScale: 1.35 });
      add(geoB, brick);
      // franjas de concreto de cada placa y remate superior
      for (const [y0, y1] of [[4.4, 5.1], [9.0, 9.7], [H - 0.55, H + 0.05]]) bandRing(P, y0, y1, 0.22).forEach((g) => add(g, concrete));
      // vitrinas del primer piso (no en todos los tramos: hay muros ciegos, accesos de servicio y rampas)
      const shopG = wallRing(offsetPoly(P, 0.06), 0.15, 4.2, { uScale: 3.2, vScale: 4.05, edgeFilter: (a, b, L, i) => L > 6 && hash(i * 1.7, L) > 0.35 });
      add(shopG, shopMat, { cast: false });
      add(capGeo(P, H - 0.9), roofMat, { cast: false });
      this._signs(P, H);
      this.mallPts = P;
    }
    // --- edificio de parqueaderos: 4 niveles ---
    if (d.garage) {
      const P = d.garage.pts, lv = d.garage.levels || 4, fh = 3.0, H = lv * fh;
      add(wallRing(P, -2, -0.0, {}), concrete);
      add(wallRing(P, 0, H, { uScale: 8, vScale: fh }), garageMat);
      bandRing(P, H - 0.1, H + 1.0, 0.1).forEach((g) => add(g, concrete));
      add(capGeo(P, H + 0.95), roofMat, { cast: false });
    }
    // --- marquesina (cubierta sobre columnas) ---
    if (d.canopy) {
      const P = d.canopy, y = 5.2;
      add(capGeo(P, y + 0.45), roofMat, { cast: false });
      bandRing(P, y, y + 0.45, 0.01).forEach((g) => add(g, concrete));
      const col = new THREE.CylinderGeometry(0.22, 0.22, y, 10); col.translate(0, y / 2, 0);
      P.forEach((p, i) => { if (i % 2) return; const m = add(col, concrete); m.position.set(p[0], 0, p[1]); });
    }
    // --- locales sueltos ---
    for (const P of d.small || []) {
      add(wallRing(P, -2, 4.6, {}), stucco);
      add(capGeo(P, 4.6), roofMat, { cast: false });
    }
    // suelo propio del lote (la malla de Google se recorta aquí): ortofoto real + asfalto de los parqueaderos
    if (d.lot) add(capGeo(d.lot, 0.0), roofMat, { cast: false });
    const asph = tl.load('./assets/textures/pbr/asphalt_02_diff_1k.jpg'); asph.colorSpace = THREE.SRGBColorSpace; asph.wrapS = asph.wrapT = THREE.RepeatWrapping; asph.anisotropy = aniso;
    this.asphaltMat = new THREE.MeshStandardMaterial({ map: asph, color: 0xd6d6d2, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    for (const P of d.parking || []) add(capGeo(P, 0.04), this.asphaltMat, { cast: false });
    this.blockers = [d.mall?.pts, d.garage?.pts, d.canopy, ...(d.small || [])].filter(Boolean);
    await this._parkedCars(d.parking || []);
  }

  /** Letrero "UNICENTRO" sobre las fachadas que dan a la Av. 15 (occidente) y a la Calle 127 (norte). */
  _signs(P, H) {
    const tex = canvasTex(1024, 160, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = '700 128px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText('UNICENTRO', w / 2, h / 2 + 6);
      g.fillStyle = '#c8102e'; g.fillText('UNICENTRO', w / 2, h / 2 + 6);
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.4, emissive: 0x5a0a12, emissiveMap: tex, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const s = outSign(P);
    const edges = P.map((a, i) => { const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, L, nx: s * (b[1] - a[1]) / L, nz: -s * (b[0] - a[0]) / L }; });
    for (const [dx, dz] of [[-1, 0], [0, -1]]) {
      const e = edges.filter((e) => e.L > 26 && e.nx * dx + e.nz * dz > 0.8).sort((p, q) => q.L - p.L)[0];
      if (!e) continue;
      const w = Math.min(30, e.L * 0.7), m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 1024), mat);
      m.position.set((e.a[0] + e.b[0]) / 2 + e.nx * 0.35, H - 3.6, (e.a[1] + e.b[1]) / 2 + e.nz * 0.35);
      m.rotation.y = Math.atan2(e.nx, e.nz);
      this.group.add(m);
    }
  }

  /** Ortofoto Esri (z19) que cubre el lote, para las cubiertas. */
  _orthoTexture(lot) {
    const xs = lot.map((p) => p[0]), zs = lot.map((p) => p[1]);
    const z = 19, x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10, zN = Math.min(...zs) - 10, zS = Math.max(...zs) + 10;
    const tx0 = Math.floor(tileX(toLon(x0), z)), tx1 = Math.floor(tileX(toLon(x1), z));
    const ty0 = Math.floor(tileY(toLat(zN), z)), ty1 = Math.floor(tileY(toLat(zS), z));
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    const cv = document.createElement('canvas'); cv.width = nx * 256; cv.height = ny * 256;
    const g = cv.getContext('2d'); g.fillStyle = '#8a8780'; g.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const lx = (lon) => (lon - LON0) * MLON + DX, lz = (lat) => -(lat - LAT0) * MLAT + DZ;
    const bx0 = lx(tile2lon(tx0, z)), bx1 = lx(tile2lon(tx1 + 1, z)), bzN = lz(tile2lat(ty0, z)), bzS = lz(tile2lat(ty1 + 1, z));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { g.drawImage(im, i * 256, j * 256); tex.needsUpdate = true; };
      im.src = `${IMG}${z}/${ty0 + j}/${tx0 + i}`;
    }
    return { tex, bounds: new THREE.Vector4(bx0, bzN, bx1 - bx0, bzS - bzN) };
  }

  /** Parqueaderos en superficie: filas de carros reales (sedán, SUV, taxi) instanciados. */
  async _parkedCars(lots) {
    const loader = new GLTFLoader();
    const models = (await Promise.all(['sedan', 'suv', 'taxi', 'sedan', 'suv'].map((n) => loader.loadAsync(`./assets/models/lod/${n}.glb`).catch(() => null)))).filter(Boolean);
    if (!models.length) return;
    const spots = [], lines = [];
    for (const P of lots) {
      // dirección dominante = lado más largo del parqueadero
      let best = 0, ang = 0;
      P.forEach((a, i) => { const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } });
      const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
      const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
      const W = 2.55, PERIOD = 17.0;   // 2 filas de 5.2 m + calle interna de 6.6 m
      for (let v = -260; v < 260; v += PERIOD) for (const [dv, face] of [[2.6, -1], [7.8, 1]]) for (let u = -260; u < 260; u += W) {
        const x = cx + ux * u + vx * (v + dv), z = cz + uz * u + vz * (v + dv);
        const corners = [[1.1, 2.4], [-1.1, 2.4], [1.1, -2.4], [-1.1, -2.4]].map(([a, b]) => [x + ux * a + vx * b, z + uz * a + vz * b]);
        if (!corners.every(([px, pz]) => inPoly(px, pz, P))) continue;
        if (corners.some(([px, pz]) => this.blockers.some((B) => inPoly(px, pz, B))) || this.blockers.some((B) => inPoly(x, z, B))) continue;
        lines.push([x + ux * W / 2, z + uz * W / 2, Math.atan2(vx, vz)]);
        const h = hash(x, z);
        if (h > 0.82) continue;   // algunos cupos libres
        spots.push({ x, z, rot: Math.atan2(vx * face, vz * face) + (h - 0.4) * 0.06, m: Math.floor(hash(z, x) * models.length) });
      }
    }
    // demarcación blanca de cada cupo
    const lineM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 5.0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), Math.max(1, lines.length));
    const L4 = new THREE.Matrix4(), Lq = new THREE.Quaternion(), Ly = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), Lp = new THREE.Vector3();
    lines.forEach(([x, z, r], i) => lineM.setMatrixAt(i, L4.compose(Lp.set(x, 0.06, z), Lq.setFromAxisAngle(Ly, r), one)));
    lineM.count = lines.length; lineM.computeBoundingSphere(); lineM.receiveShadow = true; this.group.add(lineM);
    spots.sort((a, b) => hash(a.x, a.z) - hash(b.x, b.z));
    spots.length = Math.min(spots.length, this.maxCars);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(0.92, 0.92, 0.92), p = new THREE.Vector3();
    models.forEach((gltf, mi) => {
      const mine = spots.filter((s) => s.m === mi); if (!mine.length) return;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, mine.length);
        const paint = !/glass/i.test(o.material?.name || '') && mi !== 2;   // los taxis conservan su amarillo
        mine.forEach((s, i) => {
          M.compose(p.set(s.x, 0.07, s.z), q.setFromAxisAngle(up, s.rot), sc).multiply(o.matrixWorld); im.setMatrixAt(i, M);
          if (paint) im.setColorAt(i, PAINT[Math.floor(hash(s.x * 0.7, s.z * 1.3) * PAINT.length)]);
        });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
        im.receiveShadow = true;
        this.group.add(im);
      });
    });
    this.parkedCount = spots.length;
  }

  /** Asienta todo el conjunto sobre el suelo real de la malla de Google (mediana de alturas en los parqueaderos). */
  fitToGround(target) {
    if (!target || !this.data) return;
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), ys = [];
    for (const P of this.data.parking || []) {
      const xs = P.map((q) => q[0]), zs = P.map((q) => q[1]);
      for (let k = 0; k < 12; k++) {
        const x = Math.min(...xs) + hash(k, 1.3) * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + hash(2.1, k) * (Math.max(...zs) - Math.min(...zs));
        if (!inPoly(x, z, P) || this.blockers.some((B) => inPoly(x, z, B))) continue;
        rc.set(new THREE.Vector3(x, 400, z), down);
        const h = rc.intersectObject(target, true)[0];
        if (h && Math.abs(h.point.y) < 25) ys.push(h.point.y);
      }
    }
    if (ys.length < 5) return;
    ys.sort((a, b) => a - b);
    this.group.position.y = ys[Math.floor(ys.length * 0.5)];
  }
}

/** Ortofoto Esri z19 de un polígono (también la usa el piso del predio del hotel como guía). */
export const orthoTexture = (poly) => Unicentro.prototype._orthoTexture(poly);
