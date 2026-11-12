import * as THREE from 'three';

/**
 * CatalogModels — modelos paramétricos 1:1 de la matriz de amoblamiento. REGLA: nada se inventa. Cada modelo copia la FOTO de
 * referencia de la matriz (forma, color, acabado) con las MEDIDAS de la columna "Medidas"; si la foto y el texto de la
 * especificación no coinciden, manda la foto (indicado por el cliente).
 * Cada modelo se dibuja centrado en el origen, apoyado en y = 0, en metros, con el "frente" hacia +z.
 *
 * MA-01 Mesa de noche · ø 40 cm × H 60 cm — foto: cilindro tapizado en cuero marrón terracota mate con una ranura vertical al frente
 *   (dos paños que se unen), zócalo hundido en sombra y tapa delgada de piedra BLANCA.
 */
const matCache = new WeakMap();
const cached = (lib, key, make) => { let m = matCache.get(lib); if (!m) matCache.set(lib, (m = new Map())); if (!m.has(key)) m.set(key, make()); return m.get(key); };

/** Lathe con perfil (r, y) en metros y UV a escala real (u = perímetro, v = longitud del perfil), para que la textura no se estire. */
function lathe(profile, seg, perimeterM) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, seg);
  const uv = g.attributes.uv; let len = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) { len += pts[i].distanceTo(pts[i - 1]); cum.push(len); }
  for (let i = 0; i < uv.count; i++) { const row = i % pts.length, col = Math.floor(i / pts.length); uv.setXY(i, (col / seg) * perimeterM, cum[row]); }
  uv.needsUpdate = true; g.computeVertexNormals();
  return g;
}

/** Perfil con aristas redondeadas: tramo recto de radio r entre y0 e y1 y radio de arista e. */
function roundedProfile(r, y0, y1, e, steps = 5) {
  const p = [[0, y0]];
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI / 2; p.push([r - e + Math.sin(a) * e, y0 + e - Math.cos(a) * e]); }
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, y1 - e + Math.sin(a) * e]); }
  p.push([0, y1]);
  return p;
}

function mesaNoche(lib) {
  const g = new THREE.Group(); g.name = 'MA-01 Mesa de noche';
  const R = 0.20, H = 0.60, plinth = 0.025, slab = 0.025;
  // cuero marrón terracota mate (como en la foto): grano muy leve
  const leather = cached(lib, 'cuero', () => lib.realMaterial('cuero_cognac', 0.35, { roughness: 0.82, normalScale: 0.1, envMapIntensity: 0.45 }));
  // tapa blanca (como en la foto)
  const top = cached(lib, 'tapa', () => new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.32, metalness: 0, envMapIntensity: 0.9 }));
  // zócalo hundido: en la foto se lee como una sombra oscura
  const shadow = cached(lib, 'zocalo', () => new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.9 }));
  const mk = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  mk(lathe(roundedProfile(R - 0.025, 0, plinth, 0.003), 48, 2 * Math.PI * R), shadow);

  // cuerpo: cilindro tapizado con una ranura vertical al frente (+z). La ranura se hunde con perfil suave (v) y recorre toda la altura.
  const bodyH = H - plinth - slab, e = 0.01, seg = 96;
  const prof = [[0, plinth]];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; prof.push([R - e + Math.sin(a) * e, plinth + e - Math.cos(a) * e]); }
  for (let i = 1; i < 14; i++) prof.push([R, plinth + e + (bodyH - 2 * e) * (i / 14)]);
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; prof.push([R - e + Math.cos(a) * e, plinth + bodyH - e + Math.sin(a) * e]); }
  prof.push([0, plinth + bodyH]);
  const body = lathe(prof, seg, 2 * Math.PI * R);
  const pos = body.attributes.position, depth = 0.014, halfW = 0.028;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r < R * 0.9) continue;                       // solo el manto, no las tapas
    const ang = Math.atan2(x, z);                    // 0 = frente (+z)
    const d = Math.abs(ang) * r;                     // distancia en arco a la ranura
    if (d < halfW) { const k = Math.pow(1 - d / halfW, 1.6) * depth; pos.setXYZ(i, x * (1 - k / r), pos.getY(i), z * (1 - k / r)); }
  }
  pos.needsUpdate = true; body.computeVertexNormals();
  mk(body, leather);

  // tapa delgada blanca con canto suavizado y un pequeño voladizo
  mk(lathe(roundedProfile(R, 0, slab, 0.006), 96, 2 * Math.PI * R), top, H - slab);
  return g;
}

const std = (lib, key, params) => cached(lib, key, () => new THREE.MeshStandardMaterial(params));
const add = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

/** M-01 Mesa de centro · ø 80 × H 75 — foto: tapa redonda delgada de piedra gris con vetas blancas sobre base cónica marrón. */
function mesaCentro(lib) {
  const g = new THREE.Group(); g.name = 'M-01 Mesa de centro';
  const stone = cached(lib, 'phantom', () => lib.realMaterial('phantom_grey', 0.8, { roughness: 0.28, normalScale: 0.05, envMapIntensity: 0.9 }));
  const base = std(lib, 'cono_marron', { color: 0x4a3426, roughness: 0.55, metalness: 0.15 });
  const R = 0.40, th = 0.03, H = 0.75;
  add(g, lathe(roundedProfile(R, 0, th, 0.006), 96, 2 * Math.PI * R), stone, 0, H - th);
  add(g, lathe([[0, 0], [0.17, 0], [0.17, 0.004], [0.06, H - th - 0.004], [0.06, H - th], [0, H - th]], 64, 1.1), base);
  return g;
}

/** MA-02 Mesa auxiliar · ø 40 × H 50 — foto: tapa redonda de nogal, patas de platina negra y travesaño en X. */
function mesaAuxiliar(lib) {
  const g = new THREE.Group(); g.name = 'MA-02 Mesa auxiliar';
  const wood = cached(lib, 'nogal', () => lib.realMaterial('sikuani', 0.6, { roughness: 0.55, normalScale: 0.05 }));
  const steel = std(lib, 'acero_negro', { color: 0x16130f, roughness: 0.5, metalness: 0.4 });
  const R = 0.20, H = 0.50, th = 0.025;
  add(g, lathe(roundedProfile(R, 0, th, 0.004), 64, 2 * Math.PI * R), wood, 0, H - th);
  const legH = H - th, w = 0.02, t = 0.006;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, x = Math.sin(a) * (R - 0.04), z = Math.cos(a) * (R - 0.04);
    const leg = add(g, new THREE.BoxGeometry(w, legH, t), steel, x, legH / 2, z); leg.rotation.y = a;
  }
  for (let i = 0; i < 2; i++) { const bar = add(g, new THREE.BoxGeometry((R - 0.04) * 2 * 1.41, w, t), steel, 0, 0.14, 0); bar.rotation.y = i * Math.PI / 2 + Math.PI / 4; }
  return g;
}

/** TA-01 Tapete · ø 250 — foto: anillos concéntricos de trazos radiales (beige / marrón / crema). */
function tapeteRedondo(lib) {
  const g = new THREE.Group(); g.name = 'TA-01 Tapete';
  const mat = cached(lib, 'anillos', () => lib.realMaterial('tapete_anillos', 2.5, { roughness: 0.95, normalScale: 0.15 }));
  const geo = new THREE.CircleGeometry(1.25, 96); geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5);
  add(g, geo, mat, 0, 0.012);
  const edge = new THREE.CylinderGeometry(1.25, 1.25, 0.012, 96, 1, true);
  add(g, edge, mat, 0, 0.006);
  return g;
}

/** LP-04 Lámpara de escritorio · base ø 14 × H 45 — foto: latón cepillado; base circular plana, fuste delgado que se curva en arco y cabeza cilíndrica orientada hacia abajo. */
function lamparaMesa(lib) {
  const g = new THREE.Group(); g.name = 'LP-04 Lámpara de escritorio';
  const brass = std(lib, 'laton', { color: 0xb9a36a, roughness: 0.38, metalness: 0.85 });
  const lamp = std(lib, 'laton_luz', { color: 0xb9a36a, roughness: 0.38, metalness: 0.85, emissive: 0xffe2b0, emissiveIntensity: 0.15 });
  add(g, lathe([[0, 0], [0.07, 0], [0.07, 0.012], [0, 0.012]], 48, 0.44), brass, 0.0, 0);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.034, 0.012, 0), new THREE.Vector3(0.06, 0.2, 0), new THREE.Vector3(0.082, 0.34, 0),
    new THREE.Vector3(0.09, 0.385, 0), new THREE.Vector3(0.07, 0.41, 0), new THREE.Vector3(0.0, 0.43, 0), new THREE.Vector3(-0.14, 0.455, 0)
  ], false, 'centripetal');
  add(g, new THREE.TubeGeometry(curve, 64, 0.0045, 12), brass);
  add(g, lathe([[0, 0], [0.012, 0], [0.008, 0.125], [0, 0.125]], 24, 0.07), lamp, -0.14, 0.34);
  return g;
}

/** LP-02 Lámpara de piso · ø 23 × H 135 — foto: arco negro con cabeza cónica. */
function lamparaPiso(lib) {
  const g = new THREE.Group(); g.name = 'LP-02 Lámpara de piso';
  const black = std(lib, 'negro_mate', { color: 0x14120f, roughness: 0.5, metalness: 0.5 });
  const glow = std(lib, 'cabeza_luz', { color: 0x14120f, roughness: 0.5, metalness: 0.5, emissive: 0xffd9a0, emissiveIntensity: 0.25 });
  add(g, new THREE.CylinderGeometry(0.115, 0.125, 0.02, 48), black, 0, 0.01);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.1, 0.02, 0), new THREE.Vector3(-0.1, 1.45, 0), new THREE.Vector3(0.2, 1.2, 0));
  add(g, new THREE.TubeGeometry(curve, 40, 0.01, 10), black);
  const head = add(g, lathe([[0.0, 0], [0.04, 0.0], [0.115, 0.13], [0.0, 0.13]], 40, 0.7), glow, 0.2, 1.12);
  head.rotation.x = Math.PI; head.position.y = 1.25;
  return g;
}

/** PO-01 Poltrona giratoria · ancho 60 × fondo 50 × H 80 — foto: carcasa envolvente de fieltro gris claro (respaldo alto con alas que se curvan hacia el frente), asiento acolchado redondeado, columna giratoria y base de 4 patas de roble abiertas en pirámide. */
function poltrona(lib) {
  const g = new THREE.Group(); g.name = 'PO-01 Poltrona';
  const felt = cached(lib, 'fieltro', () => lib.realMaterial('tela_flint', 0.45, { roughness: 1, normalScale: 0.6, color: 0xc9cdd4 }));
  const oak = std(lib, 'roble_claro', { color: 0xc4a07a, roughness: 0.6 });
  const dark = std(lib, 'giratorio', { color: 0x1b1a18, roughness: 0.5, metalness: 0.5 });
  // asiento: cojín redondeado 50 × 50
  const seat = add(g, lathe(roundedProfile(0.25, 0, 0.075, 0.03), 48, 1.6), felt, 0, 0.45); seat.scale.set(1.0, 1, 0.9);
  // carcasa envolvente: sector de anillo (abierto al frente +z) de R 0.30 y 0.03 de espesor, h 0.36 sobre el asiento
  const R = 0.29, t = 0.03, open = 72 * Math.PI / 180, A0 = -Math.PI / 2 + open, A1 = -Math.PI / 2 - open + 2 * Math.PI;
  const shell = new THREE.Shape();
  shell.absarc(0, 0, R, A0, A1, false);
  shell.absarc(0, 0, R - t, A1, A0, true);
  shell.closePath();
  const eg = new THREE.ExtrudeGeometry(shell, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 40 });
  eg.rotateX(-Math.PI / 2);
  add(g, eg, felt, 0, 0.47, 0.0);
  // columna y base de 4 patas de roble en pirámide
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 24), dark, 0, 0.36);
  add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24), dark, 0, 0.28);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, len = 0.34, leg = add(g, new THREE.BoxGeometry(0.04, 0.035, len), oak);
    const dx = Math.sin(a), dz = Math.cos(a);
    leg.position.set(dx * 0.15, 0.14, dz * 0.15); leg.lookAt(dx * 0.3, 0, dz * 0.3); leg.rotateX(0);
  }
  return g;
}

export const CATALOG_MODELS = {
  'MA-01': { build: mesaNoche, dims: 'ø 40 cm × H 60 cm', inRoom: true },
  'M-01': { build: mesaCentro, dims: 'ø 80 cm × H 75 cm' },
  'MA-02': { build: mesaAuxiliar, dims: 'ø 40 cm × H 50 cm' },
  'TA-01': { build: tapeteRedondo, dims: 'ø 250 cm' },
  'LP-04': { build: lamparaMesa, dims: 'base ø 14 cm × H 45 cm' },
  'PO-01': { build: poltrona, dims: '60 × 50 cm · H 80 cm', inRoom: true },
  'LP-02': { build: lamparaPiso, dims: 'ø 23 cm × H 135 cm' }
};

/** Solo MA-01 está validado para colocarse en los cuartos; los demás se ven en el catálogo hasta verificar su ubicación/orientación contra Revit. */
export function customModel(code, lib, forRoom = false) {
  const c = CATALOG_MODELS[code];
  return c && (!forRoom || c.inRoom) ? c.build(lib) : null;
}

/** Giro propio de piezas con frente: la poltrona abre hacia el lado contrario al centro de su carcasa (dato de Revit: 1.er loft vs. el pedestal). Devuelve undefined si no aplica. */
export function customYaw(code, item) {
  if (code !== 'PO-01') return undefined;
  const rev = (item.prims || []).find((p) => p.t === 'rev'), loft = (item.prims || []).find((p) => p.t === 'loft');
  if (!rev || !loft) return undefined;
  const pts = loft.loops[0], n = pts.length;
  const bx = pts.reduce((a, q) => a + q[0], 0) / n - rev.c[0], bz = -(pts.reduce((a, q) => a + q[1], 0) / n - rev.c[1]);   // dirección hacia el respaldo (mundo)
  return Math.atan2(-bx, -bz);
}
