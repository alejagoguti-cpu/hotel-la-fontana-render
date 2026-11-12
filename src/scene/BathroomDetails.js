import * as THREE from 'three';

/**
 * BathroomDetails — lo que el render del baño tiene y el modelo de Revit no exporta:
 *  · espejo con marco de luz LED difusa (retroiluminado),
 *  · tira LED en el nicho de mármol de la ducha,
 *  · toallas dobladas en el entrepaño bajo el mesón + espejo redondo de maquillaje,
 *  · barra cromada con dos toallas colgadas.
 * Las posiciones salen del propio GLB (esquinas del mesón, espejo y nicho), en metros de mundo; la cota Y es relativa al piso 2.
 * Solo la habitación 215 tiene el baño modelado (en la 216 el GLB no trae mesón, espejo ni nicho).
 */
const P2 = 3.02;

export const BATH_DETAILS = {
  'HAB-215': {
    // pared del mesón: z = −10,23 m, el baño queda hacia −z
    wallZ: -10.23,
    mirror: { x0: -2.82, x1: -2.07, y0: 1.08, y1: 1.90 },
    shelf: { x0: -2.86, x1: -2.03, z0: -10.69, z1: -10.23, top: 0.34 },
    niche: { x0: -3.58, x1: -2.97, y0: 0.97, y1: 1.38, backZ: -12.24 },
    towelBar: { x: -3.04, y: 1.28, len: 0.3 }
  }
};

function metricUV(geo, w, h, d) {
  const uv = geo.attributes.uv, sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * sizes[f][0], uv.getY(i) * sizes[f][1]); }
  uv.needsUpdate = true;
}

export function buildBathroomDetails(lib, parent, rooms) {
  const ids = new Set((rooms || []).map((r) => r.id));
  const group = new THREE.Group(); group.name = 'DetallesBaño';
  const chrome = lib.get('CROMO');
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d8).multiplyScalar(2.1), toneMapped: false });
  const ledWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc98a).multiplyScalar(1.9), toneMapped: false });
  const towelA = new THREE.MeshStandardMaterial({ color: 0xf1ece3, roughness: 1, metalness: 0 });
  const towelB = new THREE.MeshStandardMaterial({ color: 0xe0d6c6, roughness: 1, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xdfe5e8, roughness: 0.03, metalness: 1 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xd9cdb9, roughness: 0.5, metalness: 0.05 });

  let cur = group;   // subgrupo de la habitación en curso
  const subs = {};
  const lights = new THREE.Group(); lights.name = 'LucesBaño';
  const add = (geo, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, P2 + y, z); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true; cur.add(m); return m;
  };
  const box = (w, h, d, mat, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); metricUV(g, w, h, d); return add(g, mat, x, y, z, ry); };

  for (const [id, c] of Object.entries(BATH_DETAILS)) {
    if (!ids.has(id)) continue;
    cur = new THREE.Group(); cur.name = 'Baño ' + id; group.add(cur); subs[id] = cur;
    // 1. espejo con marco LED (la luz se ve alrededor, retroiluminado)
    {
      const m = c.mirror, w = m.x1 - m.x0, h = m.y1 - m.y0, cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2, z = c.wallZ - 0.012, t = 0.022;
      box(w + 2 * t, t, 0.012, led, cx, m.y1 + t / 2, z);
      box(w + 2 * t, t, 0.012, led, cx, m.y0 - t / 2, z);
      box(t, h, 0.012, led, m.x0 - t / 2, cy, z);
      box(t, h, 0.012, led, m.x1 + t / 2, cy, z);
      // marco fino de acero oscuro por fuera de la luz
      const f = 0.012, zf = c.wallZ - 0.016;
      box(w + 2 * (t + f), f, 0.016, chrome, cx, m.y1 + t + f / 2, zf);
      box(w + 2 * (t + f), f, 0.016, chrome, cx, m.y0 - t - f / 2, zf);
      box(f, h + 2 * t, 0.016, chrome, m.x0 - t - f / 2, cy, zf);
      box(f, h + 2 * t, 0.016, chrome, m.x1 + t + f / 2, cy, zf);
    }
    // 2. nicho de la ducha: tira LED bajo el borde superior, luz cálida que baña el mármol
    {
      const n = c.niche, w = n.x1 - n.x0, cx = (n.x0 + n.x1) / 2;
      box(w - 0.04, 0.014, 0.014, ledWarm, cx, n.y1 - 0.03, n.backZ + 0.07);
    }
    // 3. entrepaño bajo el mesón: toallas dobladas + espejo redondo de maquillaje
    {
      const s = c.shelf, zc = (s.z0 + s.z1) / 2, top = s.top;
      const stack = (x, n, mats, w, d) => { for (let i = 0; i < n; i++) box(w - (i % 2) * 0.012, 0.062, d - (i % 2) * 0.01, mats[i % mats.length], x, top + 0.031 + i * 0.064, zc, (i % 2 ? 0.03 : -0.02)); };
      stack(-2.50, 4, [towelA, towelB, towelA], 0.3, 0.22);
      stack(-2.20, 3, [towelB, towelA], 0.28, 0.22);
      // espejo de maquillaje: pie, disco de vidrio y aro crema, inclinado hacia el frente
      const mx = -2.76;
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.012, 24), cream, mx, top + 0.006, zc);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10), chrome, mx, top + 0.06, zc);
      const ring = add(new THREE.CylinderGeometry(0.095, 0.095, 0.02, 32), cream, mx, top + 0.15, zc);
      const face = add(new THREE.CylinderGeometry(0.083, 0.083, 0.004, 32), glass, mx, top + 0.15, zc - 0.0105);
      for (const o of [ring, face]) o.rotation.x = Math.PI / 2 + 0.12;   // eje hacia −z (el baño)
      face.position.z = zc - 0.011;
    }
    // 0. luz del baño: downlights del cielo y luz del espejo (solo 2 luces: cada una pesa en cada píxel)
    {
      const l1 = new THREE.PointLight(0xffe0b4, 2.2, 5.5, 1.6); l1.position.set(-2.8, P2 + 2.3, -11.2); lights.add(l1);
      const l2 = new THREE.PointLight(0xfff0d8, 0.9, 3.0, 2); l2.position.set(-2.45, P2 + 1.5, -10.7); lights.add(l2);
    }
    // 4. barra cromada con dos toallas colgadas, junto al espejo
    {
      const b = c.towelBar, z = c.wallZ - 0.06;
      add(new THREE.CylinderGeometry(0.008, 0.008, b.len, 12), chrome, b.x, b.y, z, 0).rotation.z = Math.PI / 2;
      for (const s of [-0.07, 0.07]) box(0.007, 0.05, 0.05, chrome, b.x + s * 2.0, b.y, c.wallZ - 0.03);
      box(0.13, 0.62, 0.018, towelA, b.x - 0.07, b.y - 0.28, z - 0.012);
      box(0.13, 0.55, 0.018, towelB, b.x + 0.075, b.y - 0.255, z - 0.012);
    }
  }
  group.userData.subs = subs;
  if (lights.children.length) group.add(lights);
  group.userData.lights = lights;
  if (group.children.length) parent.add(group);
  return group;
}

/** Copia el baño de la 215 en las demás dobles (matriz de cada habitación clonada). Las luces no se copian: se mueven con la habitación. */
export function addBathInstances(group, instances) {
  const src = group.userData.subs?.['HAB-215'];
  if (!src || group.userData.bathInst) return;
  group.userData.bathInst = true;
  for (const i of instances) {
    const copy = src.clone(true); copy.name = 'Baño ' + i.id;
    copy.matrixAutoUpdate = false; copy.matrix.copy(i.matrix); copy.matrixWorldNeedsUpdate = true;
    group.add(copy);
  }
}
