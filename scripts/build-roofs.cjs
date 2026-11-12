/**
 * build-roofs.cjs — Genera cubiertas a cuatro aguas reales (hip roofs) para el
 * Hotel La Fontana a partir de las huellas (Catastro + Revit) usando el
 * esqueleto recto (straight skeleton, CGAL vía Wasm).
 *
 * Uso:  npm i straight-skeleton earcut@2.2.4   (en cualquier carpeta)
 *       NODE_PATH=<esa carpeta>/node_modules node scripts/build-roofs.cjs
 *
 * Salida: data/geometry/hotel-roofs.json
 */
const fs = require('fs');
const path = require('path');
// La librería está compilada para navegador: simulamos window/self en Node
globalThis.window = globalThis.window || globalThis;
globalThis.self = globalThis.self || globalThis;
const { SkeletonBuilder } = require('straight-skeleton');
const earcut = require('earcut');

const ROOT = path.join(__dirname, '..');
const SLOPE_DEG = 30;               // pendiente teja de barro (≈58%)
const S = Math.tan((SLOPE_DEG * Math.PI) / 180);
const OVERHANG = 0.75;              // alero (m)
const T_MAX = 6.5;                  // limita la cumbrera en bloques muy anchos
const MIN_ROOF_HEIGHT = 6.5;        // volúmenes más bajos = terraza plana

const r = (v) => Math.round(v * 100) / 100;

function signedArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function clean(pts) {
  let p = pts.map(([x, y]) => [x, y]);
  if (p.length > 1) {
    const a = p[0], b = p[p.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) p.pop();
  }
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length && p.length > 3; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const sinA = Math.abs(cross) / Math.max(l1 * l2, 1e-9);
      if (l1 < 0.35 || sinA < 0.06) { p.splice(i, 1); changed = true; i--; }
    }
  }
  if (signedArea(p) < 0) p.reverse();
  return p;
}

function offsetOutward(p, d) {
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const e1 = norm([b[0] - a[0], b[1] - a[1]]), e2 = norm([c[0] - b[0], c[1] - b[1]]);
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];       // normales exteriores (CCW)
    let m = [n1[0] + n2[0], n1[1] + n2[1]];
    const ml = Math.hypot(m[0], m[1]);
    if (ml < 1e-6) m = n1; else m = [m[0] / ml, m[1] / ml];
    const cosHalf = Math.max(m[0] * n1[0] + m[1] * n1[1], 0.35);
    const k = d / cosHalf;
    out.push([b[0] + m[0] * k, b[1] + m[1] * k]);
  }
  return out;
}
function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

/** Recorta un polígono [x,y,t] en t<=tmax (inferior) y t>=tmax (superior). */
function clipT(poly, tmax, keepBelow) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const inA = keepBelow ? A[2] <= tmax : A[2] >= tmax;
    const inB = keepBelow ? B[2] <= tmax : B[2] >= tmax;
    if (inA) out.push(A);
    if (inA !== inB) {
      const s = (tmax - A[2]) / (B[2] - A[2]);
      out.push([A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, tmax]);
    }
  }
  return out;
}

function buildRoof(ptsXZ, wallTop, opts = {}) {
  const base = clean(ptsXZ);
  if (base.length < 3) return null;
  const tMax = opts.tMax ?? T_MAX;
  const eave = offsetOutward(base, OVERHANG);
  const eaveY = wallTop - OVERHANG * S;

  const ring = eave.map(([x, y]) => [x, y]);
  ring.push([...ring[0]]);
  let sk = null;
  try { sk = SkeletonBuilder.buildFromPolygon([ring]); } catch (e) { sk = null; }
  if (!sk) return null;

  const slope = { positions: [], uvs: [], indices: [] };
  const flat = { positions: [], uvs: [], indices: [] };
  const ridges = [];
  const edgeSeen = new Set();
  const cosA = Math.cos(Math.atan(S));

  const emit = (target, poly, uvFn) => {
    if (poly.length < 3) return;
    const flat2 = [];
    poly.forEach((v) => flat2.push(v[0], v[1]));
    const tris = earcut(flat2);
    const off = target.positions.length / 3;
    poly.forEach((v) => {
      target.positions.push(r(v[0]), r(eaveY + v[2] * S), r(v[1]));
      const [u, w] = uvFn(v);
      target.uvs.push(r(u), r(w));
    });
    // earcut devuelve CW/CCW según entrada; normalizamos para normales hacia arriba
    for (let i = 0; i < tris.length; i += 3) {
      const a = poly[tris[i]], b = poly[tris[i + 1]], c = poly[tris[i + 2]];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      // en coordenadas (x,z) con y arriba, la cara mira arriba si cross < 0
      if (cross < 0) target.indices.push(off + tris[i], off + tris[i + 1], off + tris[i + 2]);
      else target.indices.push(off + tris[i], off + tris[i + 2], off + tris[i + 1]);
    }
  };

  for (const face of sk.polygons) {
    const verts = face.map((i) => sk.vertices[i]);
    // arista de alero: dos vértices consecutivos con t = 0
    let ea = null, eb = null;
    for (let i = 0; i < verts.length; i++) {
      const A = verts[i], B = verts[(i + 1) % verts.length];
      if (A[2] < 1e-6 && B[2] < 1e-6) { ea = A; eb = B; break; }
    }
    if (!ea) continue;
    const dir = norm([eb[0] - ea[0], eb[1] - ea[1]]);
    const uvSlope = (v) => [((v[0] - ea[0]) * dir[0] + (v[1] - ea[1]) * dir[1]), v[2] / cosA];

    emit(slope, clipT(verts, tMax, true), uvSlope);
    const top = clipT(verts, tMax, false);
    if (top.length >= 3) emit(flat, top.map((v) => [v[0], v[1], tMax]), (v) => [v[0], v[1]]);

    // cumbreras y limatesas: aristas internas del esqueleto
    for (let i = 0; i < face.length; i++) {
      const ia = face[i], ib = face[(i + 1) % face.length];
      const A = sk.vertices[ia], B = sk.vertices[ib];
      if (A[2] < 1e-6 && B[2] < 1e-6) continue;
      const key = ia < ib ? `${ia}_${ib}` : `${ib}_${ia}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      let P = A, Q = B;
      if (P[2] > tMax && Q[2] > tMax) continue;
      if (P[2] > tMax || Q[2] > tMax) {
        if (P[2] > tMax) [P, Q] = [Q, P];
        const s = (tMax - P[2]) / (Q[2] - P[2]);
        Q = [P[0] + (Q[0] - P[0]) * s, P[1] + (Q[1] - P[1]) * s, tMax];
      }
      if (Math.hypot(P[0] - Q[0], P[1] - Q[1], (P[2] - Q[2]) * S) < 0.2) continue;
      ridges.push([r(P[0]), r(eaveY + P[2] * S), r(P[1]), r(Q[0]), r(eaveY + Q[2] * S), r(Q[1])]);
    }
  }

  return {
    wallTop: r(wallTop),
    eaveY: r(eaveY),
    footprint: base.map(([x, z]) => [r(x), r(z)]),
    eave: eave.map(([x, z]) => [r(x), r(z)]),
    slope, flat, ridges
  };
}

(async () => {
  await SkeletonBuilder.init();
  const catastro = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geometry/catastro-buildings-3d.json'), 'utf8'));
  const arch = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geometry/p2-architecture.json'), 'utf8'));

  const out = { slopeDeg: SLOPE_DEG, overhang: OVERHANG, context: [], main: null };

  for (const b of catastro) {
    if (!b.isHotel || !b.pts || b.pts.length < 3) continue;
    if (Math.hypot(b.center[0] - 16, b.center[1] - 1) < 22) continue; // ala Revit
    const h = Math.max(3.2, Math.min(b.height, 65));
    if (h < MIN_ROOF_HEIGHT) { out.context.push({ id: b.id, terrace: true, height: h }); continue; }
    const roof = buildRoof(b.pts, h);
    if (roof) out.context.push({ id: b.id, ...roof });
    else console.warn('sin cubierta:', b.id);
  }

  const loop = arch.slabLoops?.[0]?.loops?.[0];
  if (loop) {
    const pts = loop.map(([x, y]) => [x * 0.001, -y * 0.001]);
    out.main = buildRoof(pts, 18.0);
  }

  const file = path.join(ROOT, 'data/geometry/hotel-roofs.json');
  fs.writeFileSync(file, JSON.stringify(out));
  const n = out.context.filter((c) => c.slope).length;
  console.log(`cubiertas: ${n} contexto + ${out.main ? 1 : 0} principal → ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
})();
