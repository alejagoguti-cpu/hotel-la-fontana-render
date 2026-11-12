import * as THREE from 'three';
import { applyPBR, SURFACES } from './PBRSurfaces.js';

/**
 * SiteDetails — Detalles del conjunto Hotel La Fontana según las fotos de sitio:
 *  · Pisos: adoquín de arcilla gris-café en la plazoleta, adoquín rojo en andenes.
 *  · Fuente: jardinera hexagonal de ladrillo con plantas y taza de bronce de dos niveles.
 *  · Marquesina con fleco de hierro calado; monolito "ESTELAR LA FONTANA".
 *  · Reja negra de lanzas con seto (photinia) y faroles sobre pilastras.
 *  · Pabellón acristalado "Plaza Café" con estructura negra, cortinas y materas.
 *  · Volumen de balcones voladizos de ladrillo con barandas oscuras y vidrio corrido.
 */

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Textura de adoquín de arcilla en trabado (running bond). */
export function makePaverTexture({ palette, mortar, size = 2048, cols = 12, rows = 26, seed = 3, speckle = 0.35 }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rnd = seeded(seed);
  g.fillStyle = mortar;
  g.fillRect(0, 0, size, size);
  const bw = size / cols, bh = size / rows, gap = Math.max(2, size / 400);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off, y = r * bh;
      g.fillStyle = palette[Math.floor(rnd() * palette.length)];
      g.fillRect(x + gap, y + gap, bw - 2 * gap, bh - 2 * gap);
      const bevel = g.createLinearGradient(x + gap, y + gap, x + bw - gap, y + bh - gap);
      bevel.addColorStop(0, 'rgba(255,255,255,0.22)');
      bevel.addColorStop(0.16, 'rgba(255,255,255,0.05)');
      bevel.addColorStop(0.84, 'rgba(0,0,0,0.02)');
      bevel.addColorStop(1, 'rgba(0,0,0,0.20)');
      g.fillStyle = bevel;
      g.fillRect(x + gap, y + gap, bw - 2 * gap, bh - 2 * gap);
      // moteado y desgaste
      const n = Math.floor(28 * speckle * 3);
      for (let i = 0; i < n; i++) {
        g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.05 + rnd() * 0.08})` : `rgba(0,0,0,${0.06 + rnd() * 0.1})`;
        g.fillRect(x + gap + rnd() * (bw - 3 * gap), y + gap + rnd() * (bh - 3 * gap), 1 + rnd() * 3, 1 + rnd() * 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class SiteDetails {
  constructor(materials) {
    this.materials = materials;
    this.animated = [];   // objetos con update(t)
    this.time = 0;

    // Plazoleta: adoquín de arcilla gris-café (foto de la plazoleta de acceso)
    this.courtTex = makePaverTexture({
      palette: ['#75665c', '#7f6e62', '#6a5c53', '#857466', '#5f534b', '#796a5f', '#8c7b6d', '#6e6159'],
      mortar: '#4a413b', cols: 10, rows: 22, seed: 11, speckle: 0.18
    });
    // Andenes: adoquín rojo (foto del andén con la reja)
    this.walkTex = makePaverTexture({
      palette: ['#b5563c', '#a94d35', '#c0644a', '#9e4530', '#b95e42', '#c9704f'],
      mortar: '#7d4a3a', cols: 8, rows: 17, seed: 5, speckle: 0.15
    });
  }

  /** Aplica adoquín rojo a los andenes (UV de ExtrudeGeometry en metros). */
  applySidewalkPaving() {
    const m = this.materials.get('SIDEWALK_PAVING');
    if (!m) return;
    // adoquín de arcilla real (fotogrametría CC0): color, relieve de juntas y rugosidad
    m.bumpMap = null;
    applyPBR(m, SURFACES.RED_PAVERS, { metersPerTile: 1.8, tint: 0xf2e6e0, normalScale: 1.3, rough: true, macro: { macroScale: 0.06, strength: 0.22 } });
  }

  /** Plano de plazoleta con adoquín de arcilla (w x d metros). */
  buildCourtPaving(cx, cz, w, d, group) {
    const t = this.courtTex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 3.0, d / 3.0);   // textura = 3 m
    const mat = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.045, roughness: 0.91, metalness: 0.0 });
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.05, cz);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  /** Plazoleta con adoquín de arcilla sobre un polígono [x,z] (llega hasta el andén). */
  buildCourtPavingPoly(pts, group) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
    applyPBR(mat, SURFACES.HERRINGBONE, { metersPerTile: 2.2, tint: 0xffffff, normalScale: 1.25, rough: true, macro: { macroScale: 0.05, strength: 0.25 } });
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.05;
    mesh.receiveShadow = true;
    group.add(mesh);
    // bordillo de piedra contra el andén
    return mesh;
  }

  /** Fuente: jardinera hexagonal de ladrillo + taza de bronce de dos niveles con chorro. */
  buildFountain(x, z, group) {
    const g = new THREE.Group();
    g.position.set(x, 0.05, z);
    const brick = this.materials.get('BRICK_FACADE');
    const bronze = new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 0.45, metalness: 0.55 });
    const plant = new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: 0.9 });
    const plant2 = new THREE.MeshStandardMaterial({ color: 0x55823a, roughness: 0.9 });
    const water = new THREE.MeshStandardMaterial({ color: 0x5f7f8c, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 });
    const spray = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fc4d6, emissiveIntensity: 0.25, transparent: true, opacity: 0.45, depthWrite: false });

    // jardinera hexagonal elevada (talud de ladrillo)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.3, 0.7, 6), brick);
    base.position.y = 0.35;
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x3b2b20 }));
    soil.position.y = 0.72;
    g.add(soil);
    // corona de plantas (setos bajos y flores)
    const rnd = seeded(9);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, r = 2.1 + rnd() * 0.6;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.32 + rnd() * 0.22, 8, 6), rnd() < 0.5 ? plant : plant2);
      s.position.set(Math.cos(a) * r, 0.85 + rnd() * 0.1, Math.sin(a) * r);
      s.scale.y = 0.7;
      g.add(s);
    }
    // taza inferior, pedestal, taza superior
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.2, 0.45, 32), bronze);
    bowl.position.y = 1.15;
    const water1 = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.04, 32), water);
    water1.position.y = 1.36;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.0, 16), bronze);
    ped.position.y = 1.75;
    const bowl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 0.3, 28), bronze);
    bowl2.position.y = 2.3;
    const water2 = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.03, 28), water);
    water2.position.y = 2.44;
    g.add(bowl, water1, ped, bowl2, water2);
    // chorro y cortina de agua (animados)
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 16, 1, true), spray);
    jet.position.y = 3.15;
    jet.rotation.x = Math.PI;
    const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.45, 0.95, 28, 1, true), spray);
    veil.position.y = 1.95;
    g.add(jet, veil);
    this.animated.push((t) => {
      jet.scale.set(1 + Math.sin(t * 9) * 0.06, 1 + Math.sin(t * 5.3) * 0.08, 1 + Math.cos(t * 8) * 0.06);
      spray.opacity = 0.4 + Math.sin(t * 7) * 0.05;
    });
    group.add(g);
    return g;
  }

  /** Fleco de hierro calado bajo la marquesina (textura con transparencia). */
  makeValanceMaterial() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    x.fillStyle = '#111';
    x.fillRect(0, 0, 256, 14);
    for (let i = 0; i < 8; i++) {
      const cx = i * 32 + 16;
      x.beginPath(); x.moveTo(cx - 14, 14); x.quadraticCurveTo(cx, 30, cx - 2, 52); x.lineTo(cx + 2, 52); x.quadraticCurveTo(cx, 30, cx + 14, 14); x.fill();
      x.beginPath(); x.arc(cx, 54, 4, 0, Math.PI * 2); x.fill();
      x.fillRect(i * 32, 14, 3, 22);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, color: 0xffffff, roughness: 0.5, metalness: 0.4 });
  }

  /** Monolito de señalización "ESTELAR LA FONTANA". */
  buildSignMonolith(x, z, rotY, group) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 192;
    const k = c.getContext('2d');
    k.fillStyle = '#26282a'; k.fillRect(0, 0, 512, 192);
    k.strokeStyle = '#8c8f91'; k.lineWidth = 3;
    k.beginPath(); k.arc(70, 96, 34, 0.3, Math.PI * 1.9); k.stroke();
    k.fillStyle = '#c9c6bf';
    k.font = '600 52px Georgia, serif'; k.fillText('ESTELAR', 130, 92);
    k.font = '400 30px Georgia, serif'; k.fillText('LA FONTANA', 132, 138);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const dark = new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.4, metalness: 0.3 });
    const front = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.35), [dark, dark, dark, dark, front, dark]);
    m.position.set(x, 0.55, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    group.add(m);
  }

  /** Reja negra de lanzas con pilastras, faroles y seto bajo. */
  buildFence(points, group, { gaps = [] } = {}) {
    const iron = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.5, metalness: 0.6 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x5c5a34, roughness: 0.95 }); // photinia: verde con brotes rojizos
    const hedgeRed = new THREE.MeshStandardMaterial({ color: 0x7a3a2c, roughness: 0.95 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc86a, emissiveIntensity: 0.4, roughness: 0.3 });
    const bars = [];
    const inGap = (x, z) => gaps.some(([x0, z0, x1, z1]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) - 0.5 && z <= Math.max(z0, z1) + 0.5);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      const ang = Math.atan2(ux, uz);
      for (let t = 0; t <= len; t += 0.14) {
        const x = ax + ux * t, z = az + uz * t;
        if (!inGap(x, z)) bars.push([x, z]);
      }
      // largueros, seto y pilastras con farol
      for (let t = 0; t < len; t += 2.0) {
        const seg = Math.min(2.0, len - t);
        const x = ax + ux * (t + seg / 2), z = az + uz * (t + seg / 2);
        if (inGap(x, z)) continue;
        [0.25, 1.45].forEach((y) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, seg), iron);
          rail.position.set(x, y, z); rail.rotation.y = ang; group.add(rail);
        });
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05 + Math.sin(t * 1.7) * 0.08, seg + 0.05), hedgeMat);
        hedge.material = hedgeMat;
        hedge.position.set(x - uz * 0.55, 0.55, z + ux * 0.55); hedge.rotation.y = ang;
        hedge.castShadow = true;
        group.add(hedge);
      }
      for (let t = 0; t <= len; t += 8) {
        const x = ax + ux * t, z = az + uz * t;
        if (inGap(x, z)) continue;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.18), iron);
        post.position.set(x, 1.15, z);
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.45, 6), glow);
        lantern.position.set(x, 2.55, z);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 6), iron);
        cap.position.set(x, 2.88, z);
        group.add(post, lantern, cap);
      }
    }
    const barGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.7, 5);
    barGeo.translate(0, 0.85, 0);
    const tipGeo = new THREE.ConeGeometry(0.035, 0.12, 4);
    tipGeo.translate(0, 1.76, 0);
    const bi = new THREE.InstancedMesh(barGeo, iron, bars.length);
    const ti = new THREE.InstancedMesh(tipGeo, iron, bars.length);
    const m = new THREE.Matrix4();
    bars.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); bi.setMatrixAt(i, m); ti.setMatrixAt(i, m); });
    group.add(bi, ti);
  }

  /** Pabellón acristalado "Plaza Café". Origen = esquina; ancho (x), fondo (z). */
  buildPlazaCafe(x0, z0, w, d, group) {
    const g = new THREE.Group();
    g.position.set(x0, 0.05, z0);
    const steel = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.45, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a3e, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.35, envMapIntensity: 1.0 });
    const tarp = new THREE.MeshStandardMaterial({ color: 0x2a2c2d, roughness: 0.8, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const brick = this.materials.get('BRICK_FACADE');
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3e6a2c, roughness: 0.9 });
    const leaf2 = new THREE.MeshStandardMaterial({ color: 0x5b8a3c, roughness: 0.9 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.85 });
    const H = 3.4;

    // muro bajo de ladrillo y piso
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshStandardMaterial({ color: 0x6b4d3c, roughness: 0.8 }));
    floor.position.set(w / 2, 0.15, d / 2);
    g.add(floor);
    const wallGeo = new THREE.BoxGeometry(w, 0.75, 0.3);
    const low = new THREE.Mesh(wallGeo, brick);
    low.position.set(w / 2, 0.45, d);
    g.add(low);
    // vidrio perimetral
    [[w / 2, d, w, 0], [0, d / 2, d, Math.PI / 2], [w, d / 2, d, Math.PI / 2]].forEach(([px, pz, len, rot]) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.3), glass);
      pane.position.set(px, 0.3 + (H - 0.3) / 2, pz);
      pane.rotation.y = rot;
      g.add(pane);
      // toldo enrollable oscuro en la mitad superior
      const t = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.35), tarp);
      t.position.set(px + (rot ? 0.02 : 0), H - 0.75, pz + (rot ? 0 : -0.02));
      t.rotation.y = rot;
      g.add(t);
    });
    // estructura: parales y vigas
    const posts = [];
    for (let t = 0; t <= w + 0.01; t += w / 5) posts.push([t, d]);
    for (let t = 0; t < d; t += d / 3) { posts.push([0, t]); posts.push([w, t]); }
    posts.forEach(([px, pz]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), steel);
      p.position.set(px, H / 2, pz);
      g.add(p);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.32, d + 0.3), steel);
    roof.position.set(w / 2, H + 0.16, d / 2);
    roof.castShadow = true;
    g.add(roof);
    // vegetación interior (jardín del café)
    const rnd = seeded(21);
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + rnd() * 0.45, 8, 6), rnd() < 0.5 ? leaf : leaf2);
      s.position.set(0.5 + rnd() * (w - 1), 0.6 + rnd() * 1.2, 0.5 + rnd() * (d - 1));
      g.add(s);
    }
    // letrero "Plaza Café"
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const k = c.getContext('2d');
    k.fillStyle = '#151515'; k.fillRect(0, 0, 256, 256);
    k.strokeStyle = '#e8e4dc'; k.lineWidth = 6;
    k.strokeRect(96, 70, 52, 44); k.beginPath(); k.arc(150, 92, 12, -Math.PI / 2, Math.PI / 2); k.stroke();
    k.fillStyle = '#e8e4dc'; k.font = '500 34px Georgia, serif'; k.textAlign = 'center'; k.fillText('Plaza Café', 128, 175);
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08), new THREE.MeshStandardMaterial({ map: st }));
    sign.position.set(w + 0.6, 1.2, d + 0.2);
    g.add(sign);
    // materas grises con arbustos al frente
    for (let i = 0; i < 4; i++) {
      const px = w + 1.4 + i * 1.0, pz = d - 0.2;
      const pot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.8), potMat);
      pot.position.set(px, 0.38, pz);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), leaf2);
      bush.position.set(px, 1.25, pz);
      bush.scale.y = 1.35;
      g.add(pot, bush);
    }
    for (let i = 0; i < 6; i++) {
      const pot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), potMat);
      pot.position.set(0.8 + i * 1.25, 0.25, d + 0.9);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), leaf);
      bush.position.set(0.8 + i * 1.25, 0.65, d + 0.9);
      bush.scale.set(1.2, 0.8, 0.8);
      g.add(pot, bush);
    }
    group.add(g);
    return g;
  }

  /**
   * Volumen de balcones voladizos de ladrillo (fotos del ala del Plaza Café):
   * losas en voladizo con antepecho de ladrillo, pasamanos oscuro y vidrio corrido.
   * (x0..x1) a lo largo de la fachada, zWall = plano de fachada, dir = +1 hacia +z.
   */
  buildBalconyStack(x0, x1, zWall, floors, group) {
    const brick = this.materials.get('BRICK_FACADE');
    const rail = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.5, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1c2428, roughness: 0.08, metalness: 0.0 });
    const soffit = new THREE.MeshStandardMaterial({ color: 0x7a4a36, roughness: 0.9 });
    const w = x1 - x0, depth = 1.7, cx = (x0 + x1) / 2;
    floors.forEach((y) => {
      // losa
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.28, depth), [brick, brick, soffit, soffit, brick, brick]);
      slab.position.set(cx, y, zWall + depth / 2);
      slab.castShadow = true;
      group.add(slab);
      // antepecho de ladrillo
      const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.75, 0.2), brick);
      par.position.set(cx, y + 0.14 + 0.375, zWall + depth - 0.1);
      par.castShadow = true;
      group.add(par);
      [x0 - 0.1, x1 + 0.1].forEach((sx) => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, depth), brick);
        side.position.set(sx, y + 0.515, zWall + depth / 2);
        group.add(side);
      });
      // pasamanos metálico
      const hr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.05, 0.08), rail);
      hr.position.set(cx, y + 1.05, zWall + depth - 0.1);
      group.add(hr);
      for (let t = x0; t <= x1 + 0.01; t += 1.2) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), rail);
        p.position.set(t, y + 0.95, zWall + depth - 0.1);
        group.add(p);
      }
      // vidrio corrido detrás
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), glass);
      gl.position.set(cx, y + 0.14 + 1.2, zWall + 0.03);
      group.add(gl);
      for (let t = x0; t <= x1 + 0.01; t += 1.5) {
        const mul = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), rail);
        mul.position.set(t, y + 1.34, zWall + 0.05);
        group.add(mul);
      }
    });
  }

  update(dt) {
    this.time += dt;
    for (const f of this.animated) f(this.time);
  }
}
