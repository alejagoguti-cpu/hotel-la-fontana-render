import * as THREE from 'three';

/**
 * RoofBuilder — Cubiertas a cuatro aguas del Hotel La Fontana.
 * La geometría (planos de cubierta, limatesas/cumbreras, aleros) se genera
 * offline con esqueleto recto en scripts/build-roofs.cjs → data/geometry/hotel-roofs.json.
 * Aquí se construyen las mallas: teja de barro española, caballetes, frente de
 * alero y la galería acristalada bajo el alero (último piso).
 */

const TILE_W = 1.6;   // m que cubre la textura a lo largo del alero (8 tejas)
const TILE_H = 2.8;   // m que cubre a lo largo de la pendiente (8 hiladas)

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeTejaTexture() {
  const W = 512, H = 512, cols = 8, rows = 8;
  const cw = W / cols, rh = H / rows;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = seeded(7);
  const palette = ['#c56c45', '#bb6040', '#cf7b52', '#b4573a', '#c87449', '#d0845c', '#a9513a'];
  g.fillStyle = '#7a3a24';
  g.fillRect(0, 0, W, H);

  // hiladas de abajo (canvas abajo = alero) hacia arriba
  for (let r = rows - 1; r >= 0; r--) {
    const y0 = r * rh;
    const shift = (r % 2) * 0; // tejas españolas alineadas en canal
    for (let k = 0; k < cols; k++) {
      const x0 = k * cw + shift;
      const base = palette[Math.floor(rnd() * palette.length)];
      // cuerpo de la teja (barril): degradado transversal
      const grd = g.createLinearGradient(x0, 0, x0 + cw, 0);
      grd.addColorStop(0.0, 'rgba(40,14,6,0.85)');
      grd.addColorStop(0.12, base);
      grd.addColorStop(0.42, lighten(base, 26));
      grd.addColorStop(0.62, base);
      grd.addColorStop(0.9, darken(base, 30));
      grd.addColorStop(1.0, 'rgba(40,14,6,0.9)');
      g.fillStyle = grd;
      g.fillRect(x0 + 1, y0, cw - 2, rh + 6);
      // pátina / manchas de envejecimiento
      for (let n = 0; n < 6; n++) {
        g.fillStyle = `rgba(${40 + rnd() * 30},${30 + rnd() * 25},${20 + rnd() * 15},${0.05 + rnd() * 0.1})`;
        g.beginPath();
        g.ellipse(x0 + rnd() * cw, y0 + rnd() * rh, 2 + rnd() * 9, 2 + rnd() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
      // borde inferior de la teja (solape) con sombra
      const sg = g.createLinearGradient(0, y0 + rh - 10, 0, y0 + rh + 6);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.55, 'rgba(255,220,190,0.18)');
      sg.addColorStop(0.62, 'rgba(25,8,3,0.55)');
      sg.addColorStop(1, 'rgba(25,8,3,0)');
      g.fillStyle = sg;
      g.fillRect(x0 + 1, y0 + rh - 10, cw - 2, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(1 / TILE_W, 1 / TILE_H);

  // bump: canales oscuros, lomos claros
  const b = document.createElement('canvas');
  b.width = 256; b.height = 256;
  const bg = b.getContext('2d');
  for (let k = 0; k < 8; k++) {
    const x0 = k * 32;
    const grd = bg.createLinearGradient(x0, 0, x0 + 32, 0);
    grd.addColorStop(0, '#000'); grd.addColorStop(0.45, '#fff'); grd.addColorStop(1, '#000');
    bg.fillStyle = grd; bg.fillRect(x0, 0, 32, 256);
  }
  for (let r = 0; r < 8; r++) {
    bg.fillStyle = 'rgba(0,0,0,0.6)';
    bg.fillRect(0, r * 32 + 28, 256, 4);
  }
  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(tex.repeat);
  return { tex, bump };
}

function lighten(hex, a) { return shade(hex, a); }
function darken(hex, a) { return shade(hex, -a); }
function shade(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + a));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + a));
  const b = Math.max(0, Math.min(255, (n & 255) + a));
  return `rgb(${r},${g},${b})`;
}

function makeGalleryTexture() {
  // Galería acristalada bajo el alero: vidrio oscuro con marcos blancos
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#3b4a52'); sky.addColorStop(1, '#1d262b');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
  // reflejos
  g.fillStyle = 'rgba(200,220,230,0.10)';
  g.beginPath(); g.moveTo(30, 0); g.lineTo(90, 0); g.lineTo(40, 128); g.lineTo(-20, 128); g.fill();
  g.fillStyle = '#e9e4da';
  g.fillRect(0, 0, 256, 8);          // dintel
  g.fillRect(0, 120, 256, 8);        // antepecho
  g.fillRect(0, 44, 256, 4);         // travesaño
  for (let x = 0; x <= 256; x += 64) g.fillRect(x - 4, 0, 8, 128); // parteluces
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RoofBuilder {
  constructor() {
    const { tex, bump } = makeTejaTexture();
    this.tileMat = new THREE.MeshStandardMaterial({
      map: tex, bumpMap: bump, bumpScale: 0.9,
      roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide
    });
    this.ridgeMat = new THREE.MeshStandardMaterial({ color: 0xa65136, roughness: 0.8 });
    this.flatMat = new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.95 });
    this.fasciaMat = new THREE.MeshStandardMaterial({ color: 0x9a4a30, roughness: 0.85 });
    this.soffitMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9, side: THREE.DoubleSide });
    this.terraceMat = new THREE.MeshStandardMaterial({ color: 0xb06a4c, roughness: 0.92 });
    const gt = makeGalleryTexture();
    this.galleryTex = gt;
    this.galleryMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide });
  }

  /** Construye una cubierta del JSON y la agrega al grupo. */
  addRoof(r, group, { gallery = false, ivyMat = null } = {}) {
    if (!r || !r.slope) return;

    // 1. Faldones de teja
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(r.slope.positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(r.slope.uvs, 2));
    geo.setIndex(r.slope.indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.tileMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 2. Cubierta plana superior en bloques muy anchos
    if (r.flat && r.flat.indices.length) {
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(r.flat.positions, 3));
      fg.setIndex(r.flat.indices);
      fg.computeVertexNormals();
      const fm = new THREE.Mesh(fg, this.flatMat);
      fm.receiveShadow = true;
      group.add(fm);
    }

    // 3. Caballetes (cumbreras y limatesas) con teja de caballete
    if (r.ridges && r.ridges.length) {
      const cyl = new THREE.CylinderGeometry(0.15, 0.15, 1, 10, 1, true); // mitad queda embebida
      cyl.translate(0, 0.5, 0);
      const inst = new THREE.InstancedMesh(cyl, this.ridgeMat, r.ridges.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      r.ridges.forEach((s, i) => {
        a.set(s[0], s[1] + 0.02, s[2]);
        b.set(s[3], s[4] + 0.02, s[5]);
        d.subVectors(b, a);
        const len = d.length();
        q.setFromUnitVectors(up, d.normalize());
        m.compose(a, q, new THREE.Vector3(1, len, 1));
        inst.setMatrixAt(i, m);
      });
      inst.castShadow = true;
      group.add(inst);
    }

    // 4. Alero: frente (fascia)
    this._addEaves(r, group);

    // 5. Galería acristalada bajo el alero (último piso, como en las fotos)
    if (gallery) this._addGallery(r, group, ivyMat);
  }

  _addEaves(r, group) {
    const e = r.eave, y = r.eaveY;
    const pos = [], idx = [];
    for (let i = 0; i < e.length; i++) {
      const p = e[i], q = e[(i + 1) % e.length];
      const o = pos.length / 3;
      pos.push(p[0], y - 0.2, p[1], q[0], y - 0.2, q[1], q[0], y + 0.03, q[1], p[0], y + 0.03, p[1]);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.fasciaMat.side = THREE.DoubleSide;
    group.add(new THREE.Mesh(g, this.fasciaMat));

  }

  _addGallery(r, group, ivyMat = null) {
    const fp = r.footprint;
    const top = r.wallTop - 0.42, bot = r.wallTop - 2.45;
    const pos = [], uv = [], idx = [];
    let acc = 0;
    for (let i = 0; i < fp.length; i++) {
      const p = fp[i], q = fp[(i + 1) % fp.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const nx = dz / len * 0.05, nz = -dx / len * 0.05;
      const o = pos.length / 3;
      pos.push(p[0] + nx, bot, p[1] + nz, q[0] + nx, bot, q[1] + nz, q[0] + nx, top, q[1] + nz, p[0] + nx, top, p[1] + nz);
      const u0 = acc / 4.4, u1 = (acc + len) / 4.4;
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      acc += len;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.galleryMat);
    mesh.receiveShadow = true;
    group.add(mesh);

    // Jardinera corrida con hiedra colgante bajo la galería (como en las fotos)
    if (ivyMat) {
      const ip = [], iu = [], ii = [], lp = [], li = [];
      let a2 = 0;
      for (let i = 0; i < fp.length; i++) {
        const p = fp[i], q = fp[(i + 1) % fp.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
        if (len < 0.5) continue;
        const ox = dz / len, oz = -dx / len;
        const o = ip.length / 3, k = 0.26;
        ip.push(p[0] + ox * k, bot - 0.75, p[1] + oz * k, q[0] + ox * k, bot - 0.75, q[1] + oz * k,
                q[0] + ox * k, bot + 0.12, q[1] + oz * k, p[0] + ox * k, bot + 0.12, p[1] + oz * k);
        iu.push(a2 / 1.1, 0, (a2 + len) / 1.1, 0, (a2 + len) / 1.1, 1, a2 / 1.1, 1);
        ii.push(o, o + 1, o + 2, o, o + 2, o + 3);
        // repisa de la jardinera
        const ol = lp.length / 3, kk = 0.24;
        lp.push(p[0], bot - 0.05, p[1], q[0], bot - 0.05, q[1], q[0] + ox * kk, bot - 0.05, q[1] + oz * kk, p[0] + ox * kk, bot - 0.05, p[1] + oz * kk);
        li.push(ol, ol + 1, ol + 2, ol, ol + 2, ol + 3);
        a2 += len;
      }
      const ig = new THREE.BufferGeometry();
      ig.setAttribute('position', new THREE.Float32BufferAttribute(ip, 3));
      ig.setAttribute('uv', new THREE.Float32BufferAttribute(iu, 2));
      ig.setIndex(ii);
      ig.computeVertexNormals();
      group.add(new THREE.Mesh(ig, ivyMat));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      lg.setIndex(li);
      lg.computeVertexNormals();
      group.add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 0.9, side: THREE.DoubleSide })));
    }
  }

  /** Terraza plana para volúmenes bajos (podios). */
  addTerrace(shape, height, group) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, this.terraceMat);
    m.position.y = height;
    m.receiveShadow = true;
    group.add(m);
  }
}
