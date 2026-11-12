import * as THREE from 'three';

/**
 * LaFontanaTower — Torre de ladrillo del conjunto sobre la Carrera 15 (foto de la plaza):
 *  · Torre esbelta de 9 pisos SIN cubierta de teja: remata en un mirador acristalado
 *    con una losa-alero oscura y delgada en voladizo.
 *  · Vanos pequeños y escasos (cuadrados y verticales) sin jardineras; un balcón
 *    metálico en voladizo cerca del remate.
 *  · Loggia de madera (balcón corrido con pies derechos y baranda) en el ala vecina.
 *  · Acceso en arco con escalinata de piedra y faroles octogonales sobre pedestales.
 */

function edgesOf(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const sgn = a > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    return { p, q, len, ux, uz, nx: sgn * uz, nz: -sgn * ux };
  });
}

function placeOnEdge(mesh, e, t, y, out = 0) {
  mesh.position.set(e.p[0] + e.ux * t + e.nx * out, y, e.p[1] + e.uz * t + e.nz * out);
  mesh.rotation.y = Math.atan2(e.nx, e.nz);
}

export class LaFontanaTower {
  constructor(materials) {
    this.materials = materials;
    this.brick = materials.get('BRICK_FACADE');
    this.dark = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.55, metalness: 0.35 });
    this.glass = new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.1, transparent: true, opacity: 0.55 });
    this.glassOpaque = new THREE.MeshStandardMaterial({ color: 0x1d2427, roughness: 0.1, metalness: 0.0, envMapIntensity: 0.8 });
    this.wood = new THREE.MeshStandardMaterial({ color: 0x5b3a26, roughness: 0.75 });
    this.stone = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.85 });
  }

  /** Remate de la torre: mirador acristalado + losa alero oscura en voladizo. */
  buildCrown(pts, height, group) {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    // losa de cubierta del cuerpo de ladrillo
    const capGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    capGeo.rotateX(-Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, this.brick);
    cap.position.y = height;
    group.add(cap);
    // mirador acristalado (retrocedido 0.3 m) de 2.6 m
    const E = edgesOf(pts);
    const ph = 2.6;
    E.forEach((e) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(e.len - 0.6, ph), this.glass);
      placeOnEdge(pane, e, e.len / 2, height + 0.25 + ph / 2, -0.3);
      group.add(pane);
      for (let t = 0.3; t <= e.len - 0.29; t += Math.max(0.9, (e.len - 0.6) / Math.max(1, Math.round((e.len - 0.6) / 1.2)))) {
        const mul = new THREE.Mesh(new THREE.BoxGeometry(0.07, ph, 0.07), this.dark);
        placeOnEdge(mul, e, t, height + 0.25 + ph / 2, -0.3);
        group.add(mul);
      }
    });
    // núcleo interior oscuro (para que no se vea vacío)
    const coreGeo = new THREE.ExtrudeGeometry(shape, { depth: ph, bevelEnabled: false });
    coreGeo.rotateX(-Math.PI / 2);
    coreGeo.scale(0.82, 1, 0.82);
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    const core = new THREE.Mesh(coreGeo, this.glassOpaque);
    core.position.set(c[0] * 0.18, height + 0.25, c[1] * 0.18);
    group.add(core);
    // losa alero oscura delgada en voladizo (1.1 m) levemente inclinada
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 1.1, bevelThickness: 0.05, bevelSegments: 1 });
    roofGeo.rotateX(-Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, this.dark);
    roof.position.y = height + 0.25 + ph;
    roof.castShadow = true;
    group.add(roof);
  }

  /** Vanos pequeños tipo torre: ventana vertical + ventanucos cuadrados alternados. */
  addTowerOpenings(pts, height, floors, plainWindows, group) {
    const E = edgesOf(pts).filter((e) => e.len >= 2.0);
    const fh = height / floors;
    E.forEach((e, ei) => {
      for (let f = 1; f < floors; f++) {
        const y = f * fh + 0.9;
        if ((f + ei) % 3 === 2) {
          // ventanuco cuadrado
          const sq = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), this.glassOpaque);
          placeOnEdge(sq, e, e.len * (0.35 + 0.3 * ((f + ei) % 2)), y + 0.5, 0.02);
          group.add(sq);
        } else {
          const t = e.len * (0.5 + (((f * 7 + ei) % 3) - 1) * 0.12);
          plainWindows.add(e.p[0] + e.ux * t, y, e.p[1] + e.uz * t, e.nx, e.nz, 0.95);
        }
      }
      // balcón metálico en voladizo cerca del remate, en la cara más larga
      if (ei === 0) {
        const y = (floors - 2) * fh;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.9), this.dark);
        placeOnEdge(slab, e, e.len / 2, y, 0.45);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.04), this.dark);
        placeOnEdge(rail, e, e.len / 2, y + 1.0, 0.88);
        group.add(slab, rail);
        for (let k = -2; k <= 2; k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.0, 0.02), this.dark);
          placeOnEdge(b, e, e.len / 2 + k * 0.42, y + 0.5, 0.88);
          group.add(b);
        }
      }
    });
  }

  /** Loggia de madera: balcón corrido con pies derechos, baranda y alero. */
  buildLoggia(p0, p1, y, group, { depth = 1.7, height = 2.7 } = {}) {
    const e = edgesOf([p0, p1, [p1[0] + 1e-3, p1[1] + 1e-3]])[0];
    // asegurar normal hacia fuera = izquierda del recorrido p0→p1 invertida si hace falta
    const len = e.len;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, depth), this.brick);
    placeOnEdge(slab, e, len / 2, y, depth / 2);
    slab.castShadow = true;
    group.add(slab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.18, depth + 0.5), this.wood);
    placeOnEdge(roof, e, len / 2, y + height, depth / 2 + 0.1);
    roof.castShadow = true;
    group.add(roof);
    const n = Math.max(2, Math.round(len / 1.25));
    for (let i = 0; i <= n; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.16), this.wood);
      placeOnEdge(post, e, (len * i) / n, y + height / 2, depth - 0.1);
      group.add(post);
    }
    [0.95, 0.15].forEach((h) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.08), this.wood);
      placeOnEdge(r, e, len / 2, y + 0.15 + h, depth - 0.1);
      group.add(r);
    });
    for (let t = 0.12; t < len; t += 0.16) {
      const bal = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), this.wood);
      placeOnEdge(bal, e, t, y + 0.6, depth - 0.1);
      group.add(bal);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(len, height - 0.3), this.glassOpaque);
    placeOnEdge(back, e, len / 2, y + 0.15 + (height - 0.3) / 2, 0.04);
    group.add(back);
  }

  /** Acceso en arco con escalinata y faroles octogonales sobre pedestales de piedra. */
  buildArchEntrance(e, group) {
    const t = e.len / 2;
    const portal = new THREE.Group();
    // vano en arco (rectángulo + medio punto) oscuro con puerta de madera
    const shape = new THREE.Shape();
    shape.moveTo(-1.1, 0); shape.lineTo(1.1, 0); shape.lineTo(1.1, 2.6);
    shape.absarc(0, 2.6, 1.1, 0, Math.PI, false); shape.lineTo(-1.1, 0);
    const arch = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), this.wood);
    arch.position.set(0, 0.85, 0.03);
    portal.add(arch);
    const reveal = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), new THREE.MeshStandardMaterial({ color: 0x3a2a20 }));
    reveal.scale.set(1.12, 1.06, 1);
    reveal.position.set(0, 0.8, 0.02);
    portal.add(reveal);
    // escalinata de piedra 5 peldaños
    for (let s = 0; s < 5; s++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(5.6 + (4 - s) * 0.5, 0.17, 0.35 * (5 - s) + 0.4), this.stone);
      st.position.set(0, s * 0.17 + 0.085, (0.35 * (5 - s) + 0.4) / 2);
      st.receiveShadow = true;
      portal.add(st);
    }
    placeOnEdge(portal, e, t, 0, 0);
    group.add(portal);
    // faroles octogonales sobre pedestales cónicos en la plaza
    const glow = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd28a, emissiveIntensity: 0.35, roughness: 0.25, transparent: true, opacity: 0.9 });
    [-6, -2.6, 2.6, 6].forEach((dx) => {
      const lamp = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.9, 8), this.stone);
      ped.position.y = 0.45;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8), this.dark);
      pole.position.y = 2.7;
      const lant = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.75, 8), glow);
      lant.position.y = 4.85;
      const capL = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 8), this.dark);
      capL.position.y = 5.38;
      lamp.add(ped, pole, lant, capL);
      placeOnEdge(lamp, e, t + dx, 0, 3.4);
      group.add(lamp);
    });
  }
}
