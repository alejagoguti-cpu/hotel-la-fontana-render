import * as THREE from 'three';

/**
 * Traffic — Tráfico realista en la intersección Calle 127 × Carrera 15.
 *
 *  · Modelo IDM (Intelligent Driver Model): cada carro acelera/frena según la
 *    distancia y velocidad del carro de adelante → mantiene distancia, nunca choca.
 *  · Semáforos con fases (verde / amarillo / todo-rojo): los carros frenan antes
 *    de la línea de pare y arrancan en verde. Postes con luces que cambian de color.
 *  · Movimientos: Calle 127 oriente/occidente (2 carriles), Cra 15 hacia la 127 con
 *    giro, y giro de la 127 hacia la Cra 15. Los carros reaparecen al inicio solo
 *    cuando la entrada está libre.
 */

const LANE = 1.7;            // desplazamiento de carril desde el eje
const CAR_LEN = 4.6;

// Fases: A = Calle 127 recto, C = giro protegido de la 127 a la Cra 15,
// B = Cra 15 → Calle 127. Entre fases: amarillo 3 s + todo-rojo 2 s.
const CYCLE = [
  { A: 'green', B: 'red', C: 'red', t: 24 },
  { A: 'yellow', B: 'red', C: 'red', t: 3 },
  { A: 'red', B: 'red', C: 'red', t: 2 },
  { A: 'red', B: 'red', C: 'green', t: 10 },
  { A: 'red', B: 'red', C: 'yellow', t: 3 },
  { A: 'red', B: 'red', C: 'red', t: 2 },
  { A: 'red', B: 'green', C: 'red', t: 15 },
  { A: 'red', B: 'yellow', C: 'red', t: 3 },
  { A: 'red', B: 'red', C: 'red', t: 2 }
];

function offsetPath(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
  });
}

/** Suaviza esquinas con curvas (Catmull-Rom) para giros naturales. */
function smooth(pts, step = 2.0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
  const n = Math.max(2, Math.round(curve.getLength() / step));
  return curve.getSpacedPoints(n).map((v) => [v.x, v.z]);
}

function resample(pts, step = 1.5) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

function makePath(pts) {
  pts = resample(pts);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { P: pts, cum, len: cum[cum.length - 1] };
}

function sample(path, s) {
  const { P, cum } = path;
  s = Math.max(0, Math.min(s, path.len));
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < s) lo = mid + 1; else hi = mid; }
  const a = P[lo - 1], b = P[lo];
  const t = (s - cum[lo - 1]) / Math.max(cum[lo] - cum[lo - 1], 1e-6);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, hx: b[0] - a[0], hz: b[1] - a[1] };
}

/** Distancia a lo largo del recorrido hasta el primer punto donde pred(x,z) se cumple. */
function sAt(path, pred) {
  const { P, cum } = path;
  for (let i = 0; i < P.length; i++) if (pred(P[i][0], P[i][1])) return cum[i];
  return null;
}

export class Traffic {
  constructor(axes, group, makeCar) {
    this.group = group;
    this.makeCar = makeCar;
    this.time = 0;
    this.phaseIdx = 0;
    this.phaseT = 0;
    this.cars = [];

    const inBox = (x, z) => x > 73 && x < 109 && z > 40 && z < 84; // caja de la intersección
    const route = (pts, group) => {
      const path = makePath(pts);
      // línea de pare = 2 m antes de entrar a la caja
      const sb = sAt(path, inBox);
      path.stop = sb !== null && sb > 6 ? sb - 2.0 : null;
      path.signal = group;
      return path;
    };

    // Calle 127 sentido oriente (2 carriles, recto)
    const eb = [route(offsetPath(axes.eb, -LANE), 'A'), route(offsetPath(axes.eb, LANE), 'A')];
    // Calle 127 sentido occidente (2 carriles recto + giro hacia la Cra 15)
    const wbL = offsetPath(axes.wb, -LANE), wbR = offsetPath(axes.wb, LANE);
    const wb = [route(wbL, 'A'), route(wbR, 'A')];
    const nbAxis = offsetPath(axes.nb, LANE);
    const wbTurn = route(smooth([...wbR.slice(0, 2), [110, wbR[1][1] - 1.5], [nbAxis[0][0] + 0.5, 62], nbAxis[0], ...nbAxis.slice(1)]), 'C');
    // Cra 15 hacia la 127, gira hacia el oriente por la 127
    const sbAx = offsetPath(axes.sb, LANE);
    const ebR = offsetPath(axes.eb, LANE);
    const cra = route(smooth([...sbAx.slice(0, sbAx.length - 1), [sbAx[sbAx.length - 1][0] + 1.2, 41], [92, 46.2], ...ebR.filter((p) => p[0] > 100)]), 'B');

    this.sources = [
      { routes: [eb[0], eb[1]], weights: [0.5, 0.5], rate: 3.2, next: 0 },
      { routes: [wb[0], wb[1], wbTurn], weights: [0.4, 0.35, 0.25], rate: 3.6, next: 1.5 },
      { routes: [cra], weights: [1], rate: 9.0, next: 0.8 }
    ];
    this.routes = [...eb, ...wb, wbTurn, cra];

    this.buildSignals();
  }

  /** Postes de semáforo en cada línea de pare. */
  buildSignals() {
    this.signalHeads = { A: [], B: [], C: [] };
    const pole = new THREE.MeshStandardMaterial({ color: 0x2b2e30, roughness: 0.5, metalness: 0.6 });
    const housing = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.6 });
    // un poste por acceso: agrupar carriles del mismo acceso y tomar el más exterior
    const approaches = new Map();
    this.routes.forEach((r) => {
      if (r.stop == null) return;
      const p = sample(r, r.stop);
      const l = Math.hypot(p.hx, p.hz) || 1, hx = p.hx / l, hz = p.hz / l;
      const key = `${r.signal}_${Math.round(Math.atan2(hx, hz) * 2)}`;
      const right = p.x * -hz + p.z * hx;
      const cur = approaches.get(key);
      if (!cur || right > cur.right) approaches.set(key, { r, p, hx, hz, right });
    });
    approaches.forEach(({ r, p, hx, hz }) => {
      // poste a la derecha de la vía, brazo sobre los carriles
      const g = new THREE.Group();
      g.position.set(p.x - hz * 3.4, 0, p.z + hx * 3.4);
      g.rotation.y = Math.atan2(-hx, -hz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.2, 10), pole);
      post.position.y = 3.1;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.2, 8), pole);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-2.5, 6.0, 0);
      g.add(post, arm);
      const head = new THREE.Group();
      head.position.set(-4.6, 5.25, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.15, 0.3), housing);
      head.add(box);
      const lamps = {};
      [['red', 0xff2a1a, 0.36], ['yellow', 0xffb21a, 0], ['green', 0x1aff6a, -0.36]].forEach(([k, c, y]) => {
        const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: c, emissiveIntensity: 0, roughness: 0.3 });
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), m);
        lamp.position.set(0, y, 0.152);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 12, 1, true, -Math.PI / 2, Math.PI), housing);
        visor.rotation.x = Math.PI / 2;
        visor.position.set(0, y + 0.02, 0.23);
        head.add(lamp, visor);
        lamps[k] = m;
      });
      // segunda cabeza en el poste para peatones/vehículos cercanos
      const head2 = head.clone();
      head2.position.set(-0.25, 3.3, 0);
      const lamps2 = {};
      head2.children.forEach((ch) => { if (ch.material && ch.material.emissive && ch.geometry.type === 'CircleGeometry') { ch.material = ch.material.clone(); } });
      head2.children.filter((ch) => ch.geometry.type === 'CircleGeometry').forEach((ch, i) => { lamps2[['red', 'yellow', 'green'][i]] = ch.material; });
      g.add(head, head2);
      this.group.add(g);
      this.signalHeads[r.signal].push(lamps, lamps2);
    });
    this.applySignalColors();
  }

  state(group) { return CYCLE[this.phaseIdx][group]; }

  applySignalColors() {
    ['A', 'B', 'C'].forEach((grp) => {
      const st = this.state(grp);
      this.signalHeads[grp].forEach((L) => {
        for (const k in L) L[k].emissiveIntensity = k === st ? 3.2 : 0.04;
      });
    });
  }

  spawn(src) {
    let r = 0, acc = 0;
    const u = Math.random();
    for (let i = 0; i < src.routes.length; i++) { acc += src.weights[i]; if (u <= acc) { r = i; break; } }
    const route = src.routes[r];
    // entrada libre?
    for (const c of this.cars) if (c.route === route && c.s < 14) return false;
    const car = { route, s: 0, v: 8 + Math.random() * 2, v0: 10.5 + Math.random() * 2.5, obj: this.makeCar() };
    if (!car.obj) return false;
    this.group.add(car.obj);
    this.cars.push(car);
    this.place(car, 0);
    return true;
  }

  place(car) {
    const p = sample(car.route, car.s);
    car.x = p.x; car.z = p.z;
    const h = Math.atan2(p.hx, p.hz);
    car.obj.position.set(p.x, 0.02, p.z);
    let d = h - car.obj.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    car.obj.rotation.y += d * (car.placed ? 0.25 : 1);
    car.placed = true;
    car.hx = Math.sin(car.obj.rotation.y); car.hz = Math.cos(car.obj.rotation.y);
  }

  update(dt) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    // fases de semáforo
    this.phaseT += dt;
    if (this.phaseT >= CYCLE[this.phaseIdx].t) {
      this.phaseT = 0;
      this.phaseIdx = (this.phaseIdx + 1) % CYCLE.length;
      this.applySignalColors();
    }
    // generación
    for (const src of this.sources) {
      src.next -= dt;
      if (src.next <= 0 && this.cars.length < 34) {
        if (this.spawn(src)) src.next = src.rate * (0.6 + Math.random() * 0.9);
        else src.next = 0.8;
      }
    }
    // IDM
    const a = 1.4, b = 2.8, s0 = 2.6, T = 1.3;
    for (const c of this.cars) {
      let gap = 1e9, vLead = c.v;
      // carro de adelante (en la misma trayectoria o fusionándose): cono frontal
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const along = dx * c.hx + dz * c.hz;
        if (along <= 0 || along > 60) continue;
        const lat = Math.abs(dx * c.hz - dz * c.hx);
        if (lat > 1.5) continue;
        if (o.hx * c.hx + o.hz * c.hz < 0.2) continue;
        const g = along - CAR_LEN;
        if (g < gap) { gap = g; vLead = o.v; }
      }
      // semáforo: línea de pare como obstáculo detenido
      const r = c.route;
      if (r.stop != null && c.s < r.stop + 0.5) {
        const st = this.state(r.signal);
        const dStop = r.stop - c.s;
        const canStop = dStop > (c.v * c.v) / (2 * b) * 0.9;
        if (st === 'red' || (st === 'yellow' && canStop)) {
          if (dStop - 0.5 < gap) { gap = Math.max(dStop - 0.5, 0.01); vLead = 0; }
        }
      }
      const sStar = s0 + Math.max(0, c.v * T + (c.v * (c.v - vLead)) / (2 * Math.sqrt(a * b)));
      let acc = a * (1 - Math.pow(c.v / c.v0, 4) - Math.pow(sStar / Math.max(gap, 0.1), 2));
      acc = Math.max(acc, -9);
      c.v = Math.max(0, c.v + acc * dt);
      if (gap < 0.3) c.v = 0;
      c.s += c.v * dt;
    }
    // mover y retirar al final
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.s >= c.route.len) {
        this.group.remove(c.obj);
        this.cars.splice(i, 1);
        continue;
      }
      this.place(c);
      // giro de ruedas visual: cabeceo leve al frenar
      c.obj.rotation.x = 0;
    }
  }
}
