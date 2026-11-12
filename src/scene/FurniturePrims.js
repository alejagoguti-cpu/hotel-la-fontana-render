import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * FurniturePrims — genera el mobiliario de cada habitación a partir de los datos de Revit (p2-furniture.json), con TODOS los tipos
 * de primitivos y no solo las extrusiones planas:
 *   ext  → contorno extruido (bases, paneles, cortinas plisadas…)
 *   loft → superficie lisa entre cortes (cabeceros, colchones, almohadas, sofás, poltronas) con normales suaves
 *   rev  → sólido de revolución (mesitas tambor, lámparas, patas cónicas, bases de mesa)
 *   rod  → varilla (patas, brazos de lámpara, cables)
 *   vext → perfil vertical extruido (cabeceros redondeados, molduras)
 * Coordenadas de Revit en mm → mundo: X = x, Z = −y, Y = piso 2 + z. Las UV son planares a escala real (metros).
 */
const P2 = 3.02, M = 0.001;
const W = (x, y, z) => new THREE.Vector3(x * M, P2 + z * M, -y * M);

/** Normales hacia afuera: si en promedio apuntan hacia el centro, invierte el orden de los triángulos. */
function orientOutward(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, c = new THREE.Vector3();
  const box = new THREE.Box3().setFromBufferAttribute(pos); box.getCenter(c);
  let s = 0; const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).sub(c); n.fromBufferAttribute(nor, i); s += v.dot(n); }
  if (s < 0) {
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
    nor.needsUpdate = true;
  }
}

/** Expande a triángulos sueltos y asigna UV planares (metros) según la cara dominante, conservando las normales suaves. */
function finish(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); C.fromBufferAttribute(pos, i + 2);
    e1.subVectors(B, A); e2.subVectors(C, A); e1.cross(e2);
    const ax = Math.abs(e1.x), ay = Math.abs(e1.y), az = Math.abs(e1.z);
    [A, B, C].forEach((p, k) => {
      let u, v;
      if (ay >= ax && ay >= az) { u = p.x; v = p.z; } else if (ax >= az) { u = p.z; v = p.y; } else { u = p.x; v = p.y; }
      uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = v;
    });
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}

function extGeo(p) {
  const pts = p.ring.map((q) => new THREE.Vector2(q[0] * M, q[1] * M));
  // contorno sin vértices repetidos (el triangulador falla con duplicados)
  const clean = pts.filter((q, i) => i === 0 || q.distanceTo(pts[i - 1]) > 1e-5);
  if (clean.length > 2 && clean[0].distanceTo(clean[clean.length - 1]) < 1e-5) clean.pop();
  if (clean.length < 3) return null;
  const shape = new THREE.Shape(clean);
  const depth = Math.max((p.z1 - p.z0) * M, 0.004);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, P2 + p.z0 * M, 0);
  g.deleteAttribute('uv');
  return g;
}

function loftGeo(p) {
  const L = p.loops, rows = L.length, n = L[0].length;
  if (rows < 2 || n < 3) return null;
  const pos = [], idx = [];
  L.forEach((loop) => loop.forEach((q) => { const w = W(q[0], q[1], q[2]); pos.push(w.x, w.y, w.z); }));
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < n; c++) {
    const a = r * n + c, b = r * n + (c + 1) % n, d = (r + 1) * n + c, e = (r + 1) * n + (c + 1) % n;
    idx.push(a, d, b, b, d, e);
  }
  // tapas: abanico hacia el centro de cada extremo
  const cap = (row, flip) => {
    let cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < n; c++) { cx += pos[(row * n + c) * 3]; cy += pos[(row * n + c) * 3 + 1]; cz += pos[(row * n + c) * 3 + 2]; }
    const ci = pos.length / 3; pos.push(cx / n, cy / n, cz / n);
    for (let c = 0; c < n; c++) { const a = row * n + c, b = row * n + (c + 1) % n; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  cap(0, false); cap(rows - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); orientOutward(g);
  return g;
}

function revGeo(p) {
  const pts = p.prof.map((q) => new THREE.Vector2(Math.max(q[0] * M, 0), q[1] * M));
  const g = new THREE.LatheGeometry(pts, 40);
  g.translate(p.c[0] * M, P2, -p.c[1] * M);
  g.computeVertexNormals(); orientOutward(g);
  g.deleteAttribute('uv');
  return g;
}

function rodGeo(p) {
  const a = W(p.p0[0], p.p0[1], p.p0[2]), b = W(p.p1[0], p.p1[1], p.p1[2]);
  const len = a.distanceTo(b); if (len < 1e-4) return null;
  const g = new THREE.CylinderGeometry(p.r * M, p.r * M, len, 8, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.deleteAttribute('uv');
  return g;
}

function vextGeo(p) {
  const pts = p.prof.map((q) => new THREE.Vector2(q[0] * M, q[1] * M));
  const clean = pts.filter((q, i) => i === 0 || q.distanceTo(pts[i - 1]) > 1e-5);
  if (clean.length > 2 && clean[0].distanceTo(clean[clean.length - 1]) < 1e-5) clean.pop();
  if (clean.length < 3) return null;
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(clean), { depth: p.d * M, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -p.d * M);
  // base: X = dirección s en planta, Y = arriba, Z = X × Y (la extrusión va hacia −Z local = perpendicular a la izquierda de s)
  const X = new THREE.Vector3(p.s[0], 0, -p.s[1]), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3().crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p.o[0] * M, P2 + p.o[2] * M, -p.o[1] * M);
  g.applyMatrix4(m); g.deleteAttribute('uv');
  return g;
}

const BUILD = { ext: extGeo, loft: loftGeo, rev: revGeo, rod: rodGeo, vext: vextGeo };

/** Material de la biblioteca para el código de material de Revit del primitivo. */
function materialFor(lib, code, cache) {
  const c = String(code || '').toUpperCase();
  if (cache.has(c)) return cache.get(c);
  let m;
  if (c.includes('TAPETE')) { m = lib.realMaterial('tapete_lana', 0.4, { roughness: 1, normalScale: 0.9, color: 0x6f5233 }); }
  else if (c === 'SHEER' || c.includes('VELO')) { m = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }); }
  else if (c === 'LAMPARA') { m = new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 0.6, emissive: 0xffd9a8, emissiveIntensity: 0.35, side: THREE.DoubleSide }); }
  else if (c === 'CORTINA') { m = lib.get('LINO').clone(); m.side = THREE.DoubleSide; }
  else if (c.includes('PIEDRA')) { m = new THREE.MeshStandardMaterial({ color: 0xd9d3c8, roughness: 0.45, metalness: 0.02 }); }
  else m = lib.resolveFurnitureMaterial(c);
  cache.set(c, m);
  return m;
}

/** Devuelve las mallas de una pieza (una por material) con sus metadatos BIM. */
export function buildItemMeshes(item, lib, cache) {
  const parts = new Map();
  for (const p of item.prims || []) {
    const fn = BUILD[p.t]; if (!fn) continue;
    let g = null;
    try { g = fn(p); } catch (e) { g = null; }
    if (!g) continue;
    g = finish(g);
    const key = String(p.mat || 'NOGAL').toUpperCase();
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(g);
  }
  const out = [];
  for (const [key, list] of parts) {
    const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mat = materialFor(lib, key, cache);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
