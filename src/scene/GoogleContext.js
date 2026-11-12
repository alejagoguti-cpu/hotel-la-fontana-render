import * as THREE from 'three';

/**
 * GoogleContext — contexto urbano fotorrealista (Google Photorealistic 3D Tiles) alrededor del hotel.
 *  · La ciudad real (edificios, vías, árboles, cerros) llega como malla fotogramétrica con su foto.
 *  · Dentro del predio del hotel la malla se recorta con una máscara: ahí manda el modelo del proyecto.
 *  · El suelo de la foto se calibra a y = 0 midiendo la malla alrededor del predio.
 *  · El brillo sigue la hora del día del visor (sol bajo = foto más oscura y cálida).
 * Expone .group y .ready como CityContext, para que el resto del visor no cambie.
 */
const GKEY = 'AIzaSyCF2MXjc0DYRFrHk7j_BCyxVpWOdYqDIC4';
// mismo origen que CityContext: (0,0) local -> lon/lat
const LON0 = -74.043696, LAT0 = 4.704585, MLON = 110945, MLAT = 110574, DX = -13.47, DZ = 7.15;
const ORIGIN_LON = LON0 - DX / MLON, ORIGIN_LAT = LAT0 + DZ / MLAT;
const GROUND_H = 2575;                 // altura elipsoidal aproximada del suelo (luego se calibra)
const MASK = { x0: -112, z0: -152, size: 256, px: 1024 };   // cuadrado local que cubre el predio
const SITE = [[-24.0, 23.28], [50.0, 30.9], [50.0, -4.0], [-24.0, -4.0]]; // plazoleta (hasta el lindero oriental real)
const DILATE = 2.2;                    // la fotogrametría del hotel se desborda un poco de su huella

export class GoogleContext {
  constructor(scene, { renderer, camera, sky, hotelFootprints = [], low = false, mobile = false } = {}) {
    this.scene = scene; this.renderer = renderer; this.camera = camera; this.sky = sky;
    this.group = new THREE.Group(); this.group.name = 'GoogleContext';
    scene.add(this.group);
    this.goal = mobile ? 16 : (low ? 10 : 6);
    this.dy = 0; this.t = 0; this.calib = 0; this.failed = false; this.mats = new Set();
    this.uniforms = {
      uLuz: { value: new THREE.Color(1, 1, 1) },
      uMask: { value: this._makeMask(hotelFootprints) },
      uMaskBox: { value: new THREE.Vector3(MASK.x0, MASK.z0, MASK.size) },
      uSat: { value: 0.96 },
      uShadow: { value: 1 }
    };
    this._buildSiteGround();
    this.ready = new Promise((res) => { this._ready = res; });
    setTimeout(() => this._ready(), 14000);
    this._init().catch((e) => { console.warn('Malla de Google no disponible', e); this.failed = true; this._ready(); this.onFail?.(); });
  }

  /** Máscara del predio: huellas del hotel engrosadas + plazoleta. Blanco = aquí va el modelo. */
  _makeMask(footprints) {
    const cv = document.createElement('canvas'); cv.width = cv.height = MASK.px;
    const g = cv.getContext('2d'), k = MASK.px / MASK.size;
    g.fillStyle = '#000'; g.fillRect(0, 0, MASK.px, MASK.px);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineJoin = 'round';
    const poly = (pts, grow) => {
      g.beginPath();
      pts.forEach(([x, z], i) => { const X = (x - MASK.x0) * k, Y = (z - MASK.z0) * k; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.closePath(); g.fill();
      if (grow) { g.lineWidth = grow * 2 * k; g.stroke(); }
    };
    footprints.forEach((p) => poly(p, DILATE));
    poly(SITE, 0.6);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    this.maskCanvas = cv;
    return tex;
  }

  /** Suelo propio dentro del predio (andén perimetral), con sombras del modelo. */
  _buildSiteGround() {
    const s = MASK.size, geo = new THREE.PlaneGeometry(s, s);
    geo.rotateX(-Math.PI / 2); geo.translate(MASK.x0 + s / 2, 0, MASK.z0 + s / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - MASK.x0) / s, (pos.getZ(i) - MASK.z0) / s);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f4234, roughness: 0.98, metalness: 0, alphaMap: this.uniforms.uMask.value, alphaTest: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -0.03; m.receiveShadow = true; m.userData.dynamic = true;
    this.siteGround = m; this.group.add(m);
  }

  async _init() {
    const [TR, PL, { DRACOLoader }] = await Promise.all([
      import('3d-tiles-renderer'), import('3d-tiles-renderer/plugins'), import('three/addons/loaders/DRACOLoader.js')
    ]);
    const draco = new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
    const tiles = new TR.TilesRenderer();
    tiles.registerPlugin(new PL.GoogleCloudAuthPlugin({ apiToken: GKEY, autoRefreshToken: true }));
    tiles.registerPlugin(new PL.GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.setCamera(this.camera); tiles.setResolutionFromRenderer(this.camera, this.renderer);
    tiles.errorTarget = 40;
    const D2R = Math.PI / 180, frame = new THREE.Matrix4();
    TR.WGS84_ELLIPSOID.getEastNorthUpFrame(ORIGIN_LAT * D2R, ORIGIN_LON * D2R, frame);
    frame.multiply(new THREE.Matrix4().makeTranslation(0, 0, GROUND_H));
    this.M = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(frame.invert());   // este = +X, arriba = +Y, sur = +Z
    tiles.group.matrixAutoUpdate = false;
    this.tiles = tiles; this._place();

    const aniso = this.renderer.capabilities.getMaxAnisotropy(), U = this.uniforms;
    tiles.addEventListener('load-model', ({ scene: s }) => s.traverse((c) => {
      let m = c.isMesh && c.material; if (!m || !m.map) return;
      m.map.anisotropy = aniso;
      // material con luces (aunque la foto va como emisivo) para poder leer el mapa de sombras del sol
      const map = m.map; m.dispose?.();
      m = c.material = new THREE.MeshStandardMaterial({ emissiveMap: map, emissive: 0xffffff, color: 0x000000, roughness: 1, metalness: 0, envMapIntensity: 0, flatShading: true });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vHlfXZ;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvHlfXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
          // la malla no trae normales: sin una normal valida el sesgo de la sombra da NaN y la sombra no se dibuja
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 0.0, 1.0);');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vHlfXZ; uniform sampler2D uMask; uniform vec3 uMaskBox; uniform vec3 uLuz; uniform float uSat; uniform float uShadow;')
          .replace('#include <shadowmap_pars_fragment>', sh.fragmentShader.includes('shadowmask_pars_fragment') ? '#include <shadowmap_pars_fragment>' : '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            { vec2 muv = (vHlfXZ - uMaskBox.xy) / uMaskBox.z;
              if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0 && texture2D(uMask, muv).r > 0.5) discard; }`)
          .replace('#include <opaque_fragment>', `{ vec3 c = pow(max(outgoingLight, 0.0), vec3(0.80));   // abre las sombras de la foto: el tono fílmico del visor las cerraba
              float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
              c = max(mix(vec3(l), c, uSat), 0.0);
              // sombra del hotel sobre la foto: oscurece y enfría, como una sombra real a cielo abierto
              float sh = 1.0 - getShadowMask();
              c *= mix(vec3(1.0), vec3(0.42, 0.46, 0.55), sh * uShadow);
              outgoingLight = c * uLuz; }
            #include <opaque_fragment>`);
      };
      m.customProgramCacheKey = () => 'hlfGoogleS';
      m.needsUpdate = true;
      c.castShadow = false; c.receiveShadow = true;
      this.mats.add(m);
    }));
    tiles.addEventListener('dispose-model', ({ scene: s }) => s.traverse((c) => { if (c.isMesh) this.mats.delete(c.material); }));
    let errs = 0;
    tiles.addEventListener('load-error', (e) => { if (++errs === 1) console.warn('tesela de Google', e?.error?.message || e); });
    this.group.add(tiles.group);
  }

  _place() {
    const g = this.tiles.group;
    g.matrix.makeTranslation(0, this.dy, 0).multiply(this.M);
    g.matrixWorldNeedsUpdate = true; g.updateMatrixWorld(true);
  }

  /** Pone el suelo de la foto en y = 0 midiendo la malla en la calle, alrededor del predio. */
  _calibrate() {
    const st = this.tiles.stats;
    if (st.downloading + st.parsing > 4 || this.tiles.errorTarget > 16) return false;
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), hits = [];
    const pts = [];
    for (let x = -30; x <= 70; x += 10) pts.push([x, 40], [x, 46]);          // Calle frente a la plazoleta
    for (let z = -100; z <= 30; z += 10) pts.push([82, z], [-78, z]);        // costados oriental y occidental
    for (const [x, z] of pts) {
      rc.set(new THREE.Vector3(x, 500, z), down);
      const h = rc.intersectObject(this.tiles.group, true)[0];
      if (h && Math.abs(h.point.y) < 80) hits.push(h.point.y);
    }
    if (hits.length < 12) return false;
    hits.sort((a, b) => a - b);
    this.dy -= hits[Math.floor(hits.length * 0.2)];
    this._place();
    return true;
  }

  update(dt) {
    const tl = this.tiles; if (!tl || this.failed) return;
    try {
      tl.setResolutionFromRenderer(this.camera, this.renderer);
      this.camera.updateMatrixWorld(); tl.update();
      const st = tl.stats;
      if (tl.errorTarget > this.goal && st.downloading === 0 && st.parsing === 0 && st.visible > 3) tl.errorTarget = Math.max(this.goal, Math.round(tl.errorTarget * 0.62));
      this.t += dt;
      if (this.calib < 2 && this.t > [2.5, 10][this.calib]) { if (this._calibrate()) { this.calib++; this._ready(); } else this.t -= 1; }
      // la foto sigue la hora del visor
      const d = this.sky?.sunDir;
      if (d) {
        const day = THREE.MathUtils.smoothstep(d.y, -0.04, 0.42), low = 1 - THREE.MathUtils.smoothstep(d.y, 0.05, 0.5);
        const b = 0.14 + 0.92 * day;
        this.uniforms.uShadow.value = THREE.MathUtils.smoothstep(d.y, 0.02, 0.22);   // sin sol no hay sombra arrojada
        this.uniforms.uLuz.value.setRGB(b * (1 + 0.10 * low), b * (1 - 0.03 * low), b * (1 - 0.22 * low));
      }
      if ((this._at = (this._at || 0) - dt) <= 0) {
        this._at = 2;
        const el = this._attrib || (this._attrib = this._makeAttrib());
        const t = tl.getAttributions().filter((a) => a.type === 'string').map((a) => a.value).join(' · ');
        el.textContent = /^google/i.test(t) ? t : 'Google' + (t ? ' · ' + t : '');
      }
    } catch (e) { if (!this._warned) { this._warned = true; console.warn('malla de Google', e); } }
  }

  _makeAttrib() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:4px;z-index:4;font:10px/1.2 system-ui,sans-serif;color:rgba(255,255,255,.75);text-shadow:0 1px 2px rgba(0,0,0,.8);pointer-events:none;max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(el);
    return el;
  }
}
