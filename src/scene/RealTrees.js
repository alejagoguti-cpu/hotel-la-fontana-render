import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWind, windUniforms } from './Wind.js';

/**
 * RealTrees — Árboles realistas a partir de las texturas del archivo SKPTrees.skp de Aleja
 * (ramas con hojas recortadas de fresno/urapán, almez, eucalipto, pino y palma; cortezas reales).
 *
 * Cada árbol se genera con tronco y ramas reales (tubos con corteza) y cientos de "ramilletes"
 * de hojas orientados hacia afuera, con sombreado volumétrico (normales esféricas) y oscurecido
 * hacia el interior de la copa. Se generan algunas variantes por especie y se dibujan con
 * InstancedMesh (una llamada de dibujo por variante). La copa se mueve con el viento (Wind.js).
 *
 * Para la ciudad lejana se usan "impostores": una imagen del árbol completo que siempre mira
 * a la cámara (2 triángulos por árbol).
 */
const BASE = './assets/trees/';
// [u0, v0, ancho, alto, aspecto] dentro del atlas de hojas (v desde abajo)
const RECTS = {
  ash: [0.0029296875, 0.708984375, 0.3271484375, 0.2880859375, 1.1355932203389831],
  celtis: [0.3359375, 0.67578125, 0.287109375, 0.3212890625, 0.8936170212765957],
  euc: [0.6689453125, 0.6484375, 0.3271484375, 0.3486328125, 0.938375350140056],
  pine: [0.0029296875, 0.2705078125, 0.3271484375, 0.2265625, 1.4439655172413792],
  palm: [0.3359375, 0.4072265625, 0.3271484375, 0.08984375, 3.641304347826087],
  billboard: [0.6689453125, 0.0029296875, 0.3134765625, 0.494140625, 0.6343873517786561]
};

export const SPECIES = {
  ash: { kind: 'broad', leaf: 'ash', bark: 'ash', h: 9, trunkFrac: 0.42, crownR: 3.4, crownH: 5.8, branches: 8, cards: 170, card: 1.35 },
  celtis: { kind: 'broad', leaf: 'celtis', bark: 'celtis', h: 7.5, trunkFrac: 0.38, crownR: 3.6, crownH: 4.8, branches: 7, cards: 160, card: 1.25 },
  euc: { kind: 'broad', leaf: 'euc', bark: 'euc', h: 12, trunkFrac: 0.5, crownR: 2.8, crownH: 6.5, branches: 7, cards: 140, card: 1.6 },
  pine: { kind: 'conifer', leaf: 'pine', bark: 'pine', h: 10, crownR: 2.6, cards: 150, card: 1.3 },
  palm: { kind: 'palm', leaf: 'palm', bark: 'palm', h: 8.5, fronds: 15, card: 3.4 }
};

const loader = new THREE.TextureLoader();
function tex(file, srgb = true) {
  const t = loader.load(BASE + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

function rand(seed) {
  let s = (seed * 9301 + 49297) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const _up = new THREE.Vector3(0, 1, 0);

/** Tubo cónico entre p0 y p1 con UV de corteza a escala. */
function limb(p0, p1, r0, r1, seg = 7) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / (2 * Math.PI * Math.max(r0, 0.05)) * 0.5);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
  g.applyQuaternion(q);
  g.translate(p0.x, p0.y, p0.z);
  return g;
}

/**
 * Ramillete de hojas: un plano con la imagen de rama, anclado en `p`, creciendo hacia `out`.
 * Normales "esféricas" (desde el centro de la copa) para un sombreado de volumen suave.
 */
function leafCard(p, out, size, rect, rnd, center, shade, pos, nor, uv, col, idx) {
  const asp = rect[4];
  const w = size * Math.sqrt(asp), h = size / Math.sqrt(asp);
  const o = out.clone().normalize();
  // eje "derecha" perpendicular a la dirección de crecimiento, con giro aleatorio
  let side = new THREE.Vector3().crossVectors(o, _up);
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  side.normalize().applyAxisAngle(o, (rnd() - 0.5) * 2.2);
  const base = p.clone().addScaledVector(o, -h * 0.15);
  const corners = [
    base.clone().addScaledVector(side, -w / 2), base.clone().addScaledVector(side, w / 2),
    base.clone().addScaledVector(side, w / 2).addScaledVector(o, h), base.clone().addScaledVector(side, -w / 2).addScaledVector(o, h)
  ];
  const [u0, v0, uw, vh] = rect;
  const uvs = [[u0, v0], [u0 + uw, v0], [u0 + uw, v0 + vh], [u0, v0 + vh]];
  const v = pos.length / 3;
  corners.forEach((c, k) => {
    pos.push(c.x, c.y, c.z);
    const n = new THREE.Vector3().subVectors(c, center).normalize();
    n.y += 0.35; n.normalize();
    nor.push(n.x, n.y, n.z);
    uv.push(uvs[k][0], uvs[k][1]);
    // más oscuro hacia adentro y hacia abajo de la copa (oclusión del follaje)
    const dist = c.distanceTo(center);
    const g = shade * (0.55 + 0.45 * Math.min(1, dist / 3.2)) * (0.8 + 0.2 * Math.min(1, Math.max(0, (c.y - center.y + 3) / 6)));
    col.push(g * (0.92 + rnd() * 0.12), g * (0.95 + rnd() * 0.1), g * (0.9 + rnd() * 0.1));
  });
  idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
}

function buildLeafGeo(pos, nor, uv, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Árbol de hoja ancha (fresno/urapán, almez, eucalipto). */
function broadleaf(sp, seed) {
  const rnd = rand(seed);
  const H = sp.h * (0.88 + rnd() * 0.25);
  const trunkTop = H * sp.trunkFrac;
  const R = sp.crownR * (0.85 + rnd() * 0.3);
  const CH = sp.crownH * (0.85 + rnd() * 0.25);
  const center = new THREE.Vector3(0, trunkTop + CH * 0.5, 0);
  const wood = [];
  const r0 = 0.13 + H * 0.012;
  // tronco con leve inclinación y quiebres
  const lean = new THREE.Vector3((rnd() - 0.5) * 0.35, 0, (rnd() - 0.5) * 0.35);
  let prev = new THREE.Vector3(0, 0, 0), pr = r0;
  const leader = [];
  for (let s = 1; s <= 5; s++) {
    const t = s / 5;
    const p = new THREE.Vector3(lean.x * t + (rnd() - 0.5) * 0.12, H * 0.92 * t, lean.z * t + (rnd() - 0.5) * 0.12);
    const r = r0 * (1 - t * 0.82);
    wood.push(limb(prev, p, pr, r));
    leader.push(p.clone());
    prev = p; pr = r;
  }
  wood.push(limb(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.4, 0), r0 * 1.5, r0)); // base ensanchada

  const pos = [], nor = [], uv = [], col = [], idx = [];
  const rect = RECTS[sp.leaf];
  const tips = [];
  // ramas principales (ángulo áureo) con secundarias
  for (let b = 0; b < sp.branches; b++) {
    const t = 0.15 + 0.85 * (b / sp.branches);
    const y = trunkTop * 0.85 + (H * 0.88 - trunkTop * 0.85) * t * 0.85;
    const az = b * 2.39996 + rnd() * 0.5;
    const elev = THREE.MathUtils.degToRad(30 + rnd() * 25 + t * 15);
    const L = R * (1.05 - t * 0.35) * (0.8 + rnd() * 0.3);
    const p0 = new THREE.Vector3(lean.x * (y / H), y, lean.z * (y / H));
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    const mid = p0.clone().addScaledVector(dir, L * 0.55);
    const end = mid.clone().addScaledVector(dir.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize(), L * 0.45);
    const br = r0 * (0.42 - t * 0.2);
    wood.push(limb(p0, mid, br, br * 0.6, 5), limb(mid, end, br * 0.6, br * 0.25, 5));
    tips.push(end, mid.clone().lerp(end, 0.5));
    for (let s = 0; s < 2; s++) {
      const sd = dir.clone().applyAxisAngle(_up, (s ? 1 : -1) * (0.6 + rnd() * 0.5)); sd.y += 0.3; sd.normalize();
      const sp0 = p0.clone().lerp(mid, 0.6 + rnd() * 0.4);
      const se = sp0.clone().addScaledVector(sd, L * 0.45);
      wood.push(limb(sp0, se, br * 0.45, br * 0.15, 4));
      tips.push(se);
    }
  }
  // follaje: ramilletes en puntas de ramas + relleno del volumen de la copa (más denso en la capa exterior)
  const nTips = Math.min(tips.length * 3, Math.floor(sp.cards * 0.4));
  for (let i = 0; i < nTips; i++) {
    const tp = tips[i % tips.length].clone().add(new THREE.Vector3((rnd() - 0.5) * 0.9, (rnd() - 0.3) * 0.7, (rnd() - 0.5) * 0.9));
    const out = new THREE.Vector3().subVectors(tp, center); out.y = out.y * 0.6 + 0.35;
    leafCard(tp, out, sp.card * (0.75 + rnd() * 0.5), rect, rnd, center, 1, pos, nor, uv, col, idx);
  }
  for (let i = nTips; i < sp.cards; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    const rr = Math.pow(rnd(), 0.35);           // sesgo hacia la superficie
    const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const p = center.clone().add(new THREE.Vector3(d.x * R * rr, d.y * CH * 0.5 * rr, d.z * R * rr));
    if (p.y < trunkTop * 0.9) p.y = trunkTop * 0.9 + rnd() * 0.6;
    const out = d.clone(); out.y = out.y * 0.7 + 0.25;
    leafCard(p, out, sp.card * (0.7 + rnd() * 0.6), rect, rnd, center, 1, pos, nor, uv, col, idx);
  }
  return { wood: mergeGeometries(wood, false), leaves: buildLeafGeo(pos, nor, uv, col, idx), height: H };
}

/** Pino: tronco recto y verticilos de ramas que se acortan hacia la punta. */
function conifer(sp, seed) {
  const rnd = rand(seed);
  const H = sp.h * (0.85 + rnd() * 0.3);
  const r0 = 0.12 + H * 0.012;
  const wood = [limb(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, H, 0), r0, 0.03, 7)];
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const rect = RECTS[sp.leaf];
  const center = new THREE.Vector3(0, H * 0.55, 0);
  const levels = 9;
  let n = 0;
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const y = H * (0.28 + 0.7 * t);
    const L = sp.crownR * (1 - t * 0.85) * (0.85 + rnd() * 0.3);
    const k = 5 + Math.round(3 * (1 - t));
    for (let b = 0; b < k; b++) {
      const az = (b / k) * Math.PI * 2 + l * 0.7 + rnd() * 0.3;
      const dir = new THREE.Vector3(Math.cos(az), -0.12 - rnd() * 0.12, Math.sin(az)).normalize();
      const p0 = new THREE.Vector3(0, y, 0), end = p0.clone().addScaledVector(dir, L);
      wood.push(limb(p0, end, r0 * 0.25 * (1 - t * 0.6), 0.015, 4));
      for (let c = 0; c < 2 && n < sp.cards; c++, n++) {
        const pp = p0.clone().lerp(end, 0.35 + c * 0.45);
        const out = dir.clone(); out.y += 0.15 + rnd() * 0.2;
        leafCard(pp, out, sp.card * (1 - t * 0.4) * (0.8 + rnd() * 0.4), rect, rnd, center, 0.95, pos, nor, uv, col, idx);
      }
    }
  }
  for (; n < sp.cards; n++) {
    const y = H * (0.3 + rnd() * 0.68), rr = sp.crownR * (1 - (y / H - 0.3) / 0.7 * 0.85) * Math.pow(rnd(), 0.4);
    const az = rnd() * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(az) * rr, y, Math.sin(az) * rr);
    const out = new THREE.Vector3(Math.cos(az), 0.1, Math.sin(az));
    leafCard(p, out, sp.card * (0.8 + rnd() * 0.4), rect, rnd, center, 0.95, pos, nor, uv, col, idx);
  }
  return { wood: mergeGeometries(wood, false), leaves: buildLeafGeo(pos, nor, uv, col, idx), height: H };
}

/** Palma: estípite curvo y hojas (frondas) arqueadas. */
function palm(sp, seed) {
  const rnd = rand(seed);
  const H = sp.h * (0.85 + rnd() * 0.3);
  const bend = new THREE.Vector3((rnd() - 0.5) * 1.4, 0, (rnd() - 0.5) * 1.4);
  const wood = [];
  let prev = new THREE.Vector3();
  for (let s = 1; s <= 6; s++) {
    const t = s / 6;
    const p = new THREE.Vector3(bend.x * t * t, H * t, bend.z * t * t);
    wood.push(limb(prev, p, 0.24 - 0.05 * (t - 1 / 6), 0.24 - 0.05 * t, 8));
    prev = p;
  }
  const top = prev.clone();
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const [u0, v0, uw, vh] = RECTS.palm;
  const center = top.clone().add(new THREE.Vector3(0, -0.5, 0));
  for (let f = 0; f < sp.fronds; f++) {
    const az = (f / sp.fronds) * Math.PI * 2 + rnd() * 0.3;
    const up = 0.55 - (f % 3) * 0.35 + rnd() * 0.2;              // unas suben, otras cuelgan
    const L = sp.card * (0.85 + rnd() * 0.3), W = L / RECTS.palm[4] * 2.2;
    const dirH = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dirH.z, 0, dirH.x).applyAxisAngle(dirH, 0.5);
    const segs = 5;
    const v = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const p = top.clone().addScaledVector(dirH, L * t).add(new THREE.Vector3(0, L * (up * t - 0.55 * t * t), 0));
      for (const e of [-1, 1]) {
        const c = p.clone().addScaledVector(side, e * W * 0.5 * (1 - t * 0.6));
        pos.push(c.x, c.y, c.z);
        const n = new THREE.Vector3().subVectors(c, center).normalize(); n.y += 0.5; n.normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(u0 + uw * t, v0 + vh * (e < 0 ? 0 : 1));
        const g = 0.8 + 0.2 * t;
        col.push(g, g, g * 0.95);
      }
      if (s < segs) { const a = v + s * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
  }
  return { wood: mergeGeometries(wood, false), leaves: buildLeafGeo(pos, nor, uv, col, idx), height: H };
}

export class RealTrees {
  constructor() {
    this.leafTex = tex('leaves.webp');
    this.leafTex.anisotropy = 8;
    this.leafMat = new THREE.MeshStandardMaterial({
      map: this.leafTex, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true,
      roughness: 0.78, metalness: 0, envMapIntensity: 0.6
    });
    applyWind(this.leafMat, { amp: 0.9, from: 1.5, to: 10 });
    this.barkMats = {};
    for (const k of ['ash', 'celtis', 'euc', 'pine', 'palm']) {
      const t = tex(`bark_${k}.webp`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.barkMats[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0, color: 0xd8d0c8 });
    }
    this.variants = {};
  }

  variant(name, k) {
    const key = `${name}_${k}`;
    if (!this.variants[key]) {
      const sp = SPECIES[name];
      const seed = 17 + k * 101 + name.length * 7;
      this.variants[key] = sp.kind === 'palm' ? palm(sp, seed) : sp.kind === 'conifer' ? conifer(sp, seed) : broadleaf(sp, seed);
    }
    return this.variants[key];
  }

  /**
   * Siembra árboles en `points` ([x, y, z, especie?]) y los agrega a `group` como InstancedMesh.
   * `pick(i)` puede elegir la especie; si no, se reparte por un hash de la posición.
   */
  plant(points, group, { mix = ['ash', 'ash', 'celtis', 'euc', 'pine', 'palm'], variants = 3, shadows = true } = {}) {
    const buckets = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    points.forEach(([x, y, z, sp], i) => {
      const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      const name = sp || mix[Math.floor(h * mix.length) % mix.length];
      const k = Math.floor(((h * 7.31) % 1) * variants);
      const key = `${name}_${k}`;
      if (!buckets.has(key)) buckets.set(key, { name, k, mats: [] });
      q.setFromAxisAngle(_up, h * 6.283 * 3.1);
      const sc = 0.82 + ((h * 13.7) % 1) * 0.36;
      m.compose(p.set(x, y, z), q, s.set(sc, sc * (0.92 + ((h * 5.3) % 1) * 0.16), sc));
      buckets.get(key).mats.push(m.clone());
    });
    for (const { name, k, mats } of buckets.values()) {
      const v = this.variant(name, k);
      const wood = new THREE.InstancedMesh(v.wood, this.barkMats[SPECIES[name].bark], mats.length);
      const leaves = new THREE.InstancedMesh(v.leaves, this.leafMat, mats.length);
      mats.forEach((mm, i) => { wood.setMatrixAt(i, mm); leaves.setMatrixAt(i, mm); });
      wood.castShadow = leaves.castShadow = shadows;
      wood.receiveShadow = leaves.receiveShadow = true;
      wood.computeBoundingSphere(); leaves.computeBoundingSphere();
      group.add(wood, leaves);
    }
  }
}

/**
 * Impostores para la arboleda lejana de la ciudad: la imagen completa del fresno (del SKP),
 * siempre girada hacia la cámara (solo en el eje vertical), con tinte del color de la ortofoto.
 */
export function makeTreeImpostors(count, leafTex) {
  const [u0, v0, uw, vh, asp] = RECTS.billboard;
  const g = new THREE.PlaneGeometry(asp, 1);
  g.translate(0, 0.5, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * uw, v0 + uv.getY(i) * vh);
  const mat = new THREE.MeshStandardMaterial({ map: leafTex || tex('leaves.webp'), alphaTest: 0.45, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uImpT = windUniforms.uWindTime;
    sh.uniforms.uImpA = windUniforms.uWindAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uImpT; uniform float uImpA;')
      .replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = normalize(vec3(0.0, 0.5, 1.0));')
      .replace('#include <project_vertex>', `
        vec4 cW = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        right.y = 0.0; right = normalize(right + vec3(1e-5));
        vec3 wp = cW.xyz + right * transformed.x * sx + vec3(0.0, transformed.y * sy, 0.0);
        float ph = cW.x * 0.21 + cW.z * 0.17;
        wp.xz += vec2(sin(uImpT * 1.25 + ph), 0.6 * cos(uImpT * 1.05 + ph * 1.3)) * uImpA * 1.6 * transformed.y * transformed.y;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'tree-impostor';
  const mesh = new THREE.InstancedMesh(g, mat, count);
  mesh.frustumCulled = false;
  return mesh;
}
