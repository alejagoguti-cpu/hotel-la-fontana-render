import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * FacadeWindows — Ventanería del Hotel La Fontana (familia "HLF-VENTANA FACHADA BARANDAL").
 * Todas las ventanas se dibujan con InstancedMesh (una malla por componente), apoyadas
 * exactamente sobre el plano de fachada y orientadas con la normal exterior del muro:
 *   vano oscuro (sombra del derrame) · marco · vidrio reflectivo · parteluz y travesaño ·
 *   barandal blanco · alféizar · jardinera con hiedra colgante (como en las fotos).
 *
 * Geometría local: x ∈ [-0.5, 0.5] (ancho unitario, se escala), y = 0 en el alféizar,
 * +z hacia afuera del muro.
 */

const H = 1.5;          // alto de ventana (m)
const DEPTH = 0.06;     // espesor del marco

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function buildParts() {
  const f = 0.055;                // marco (en ancho unitario ≈ 6–7 cm)
  const transomY = H * 0.38;

  const frame = mergeGeometries([
    box(f, H, DEPTH, -0.5 + f / 2, H / 2, DEPTH / 2),
    box(f, H, DEPTH, 0.5 - f / 2, H / 2, DEPTH / 2),
    box(1, f, DEPTH, 0, H - f / 2, DEPTH / 2),
    box(1, f, DEPTH, 0, f / 2, DEPTH / 2),
    box(1 - 2 * f, 0.045, DEPTH, 0, transomY, DEPTH / 2),
    box(0.04, H - transomY - f, DEPTH * 0.8, 0, transomY + (H - transomY - f) / 2, DEPTH / 2)
  ]);

  const reveal = new THREE.PlaneGeometry(1.06, H + 0.06);
  reveal.translate(0, H / 2, 0.006);

  const glass = new THREE.PlaneGeometry(1 - 2 * f, H - 2 * f);
  glass.translate(0, H / 2, 0.022);

  const rails = [
    box(1 - 2 * f, 0.035, 0.035, 0, transomY - 0.03, 0.085),
    box(1 - 2 * f, 0.025, 0.03, 0, f + 0.03, 0.085)
  ];
  const nB = 6;
  for (let i = 1; i < nB; i++) {
    const x = -0.5 + f + (i * (1 - 2 * f)) / nB;
    rails.push(box(0.018, transomY - f - 0.05, 0.02, x, f + (transomY - f) / 2, 0.085));
  }
  const railing = mergeGeometries(rails);

  const sill = box(1.12, 0.06, 0.16, 0, -0.03, 0.06);

  const planter = box(1.08, 0.24, 0.3, 0, -0.18, 0.17);

  // Hiedra: cara superior + cortina colgante frontal + laterales
  const ivyTop = new THREE.PlaneGeometry(1.1, 0.32);
  ivyTop.rotateX(-Math.PI / 2 + 0.35);
  ivyTop.translate(0, -0.02, 0.17);
  const ivyFront = new THREE.PlaneGeometry(1.16, 0.55);
  ivyFront.translate(0, -0.32, 0.33);
  const ivy = mergeGeometries([ivyTop, ivyFront]);

  return { frame, reveal, glass, railing, sill, planter, ivy };
}

export class FacadeWindows {
  /**
   * opts.plain: ventana de vano simple (torre y alas de la carrera 15): marco oscuro,
   * sin barandal, jardinera ni hiedra. opts.heightScale: escala vertical (1 = 1.5 m).
   */
  constructor(materials, opts = {}) {
    this.materials = materials;
    this.plain = !!opts.plain;
    this.heightScale = opts.heightScale || 1;
    this.items = [];   // { x, y, z, nx, nz, w }
  }

  /** Agrega una ventana: (x,z) sobre el muro, y = alféizar, (nx,nz) normal exterior. */
  add(x, y, z, nx, nz, w = 1.2, h = 0) {
    this.items.push({ x, y, z, nx, nz, w, h });
  }

  /**
   * Distribuye ventanas a lo largo de un polígono (huella en metros [x,z]).
   * floors: lista de cotas de alféizar.
   */
  addAlongPolygon(pts, sills, { spacing = 2.7, width = 1.2, minEdge = 2.4, skipEdge = null } = {}) {
    const p = pts.slice();
    if (p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6) p.pop();
    let area = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sgn = area > 0 ? 1 : -1;   // CCW (x,z): normal exterior = (dz, -dx)
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < minEdge) continue;
      if (skipEdge && skipEdge(i, a, b)) continue;
      const ux = dx / len, uz = dz / len;
      const nx = sgn * uz, nz = -sgn * ux;
      const n = Math.max(1, Math.floor((len - 0.6) / spacing));
      const step = len / n;
      for (let k = 0; k < n; k++) {
        const t = step * (k + 0.5);
        for (const y of sills) this.add(a[0] + ux * t, y, a[1] + uz * t, nx, nz, width);
      }
    }
  }

  build() {
    const group = new THREE.Group();
    const n = this.items.length;
    if (!n) return group;
    const parts = buildParts();

    // Marco claro (crema) como en las fotos del hotel
    const frameMat = this.plain
      ? new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.5, metalness: 0.3 })
      : new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.55, metalness: 0.05 });
    const revealMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 });
    // Vidrio OPACO oscuro: nunca deja ver el ladrillo detrás; solo un reflejo suave del cielo (Fresnel)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.14, metalness: 0.0, envMapIntensity: 0.7 });
    const railMat = this.materials.get('REVIT_WIN_RAILING') || new THREE.MeshStandardMaterial({ color: 0xe8ebe8 });
    const sillMat = new THREE.MeshStandardMaterial({ color: 0xc9b9a3, roughness: 0.85 });
    const planterMat = this.materials.get('REVIT_WIN_PLANTER') || new THREE.MeshStandardMaterial({ color: 0x585652 });
    const ivyMat = this.materials.get('REVIT_WIN_IVY') || new THREE.MeshStandardMaterial({ color: 0x3d7028 });

    const meshes = {
      reveal: new THREE.InstancedMesh(parts.reveal, revealMat, n),
      frame: new THREE.InstancedMesh(parts.frame, frameMat, n),
      glass: new THREE.InstancedMesh(parts.glass, glassMat, n),
      railing: new THREE.InstancedMesh(parts.railing, railMat, n),
      sill: new THREE.InstancedMesh(parts.sill, sillMat, n),
      planter: new THREE.InstancedMesh(parts.planter, planterMat, n),
      ivy: new THREE.InstancedMesh(parts.ivy, ivyMat, n)
    };
    if (this.plain) { delete meshes.railing; delete meshes.planter; delete meshes.ivy; }
    this.meshes = meshes;

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const glassTints = [0x1a2125, 0x1e262a, 0x232a2d, 0x1c2023, 0x2a2724, 0x252d31]; // interiores oscuros / cortinas
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    this.items.forEach((it, i) => {
      q.setFromAxisAngle(up, Math.atan2(it.nx, it.nz));
      p.set(it.x + it.nx * 0.01, it.y, it.z + it.nz * 0.01);
      s.set(it.w, it.h || this.heightScale, 1);
      m.compose(p, q, s);
      for (const k in meshes) meshes[k].setMatrixAt(i, m);
      col.setHex(glassTints[Math.floor(rnd() * glassTints.length)]);
      meshes.glass.setColorAt(i, col);
    });

    for (const k in meshes) {
      const mesh = meshes[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = k === 'planter' || k === 'sill';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }

  static keyOf(it) { return `${it.x.toFixed(1)},${it.y.toFixed(1)},${it.z.toFixed(1)}`; }

  /** Oculta la ventana más cercana a p (Vector3) dentro de r metros; devuelve su clave. */
  hideNear(p, r = 1.2) {
    if (!this.meshes) return null;
    let best = -1, bd = r;
    this.items.forEach((it, i) => {
      if (it.hidden) return;
      const d = Math.hypot(it.x - p.x, it.y + 0.7 - p.y, it.z - p.z);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return null;
    this.hideIndex(best);
    return FacadeWindows.keyOf(this.items[best]);
  }

  hideIndex(i) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.items[i].hidden = true;
    for (const k in this.meshes) { this.meshes[k].setMatrixAt(i, zero); this.meshes[k].instanceMatrix.needsUpdate = true; }
  }

  hideKeys(keys) {
    if (!this.meshes || !keys?.size) return;
    this.items.forEach((it, i) => { if (keys.has(FacadeWindows.keyOf(it))) this.hideIndex(i); });
  }
}
