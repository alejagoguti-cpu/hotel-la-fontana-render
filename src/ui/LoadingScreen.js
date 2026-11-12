import * as THREE from 'three';

/**
 * LoadingScreen — pantalla de carga con los logos de BACO Studio y Hotel Estelar mientras se
 * descargan el modelo, las texturas, la ortofoto y el contexto urbano.
 */
export class LoadingScreen {
  constructor() {
    const el = document.createElement('div');
    el.className = 'ls-wrap';
    el.innerHTML = `
      <div class="ls-logos">
        <img src="./assets/branding/logo-baco.png" alt="BACO Studio">
        <span class="ls-sep"></span>
        <img src="./assets/branding/logo-estelar.png" alt="Hotel Estelar">
      </div>
      <div class="ls-title">Hotel Estelar La Fontana</div>
      <div class="ls-sub">Masterplan 3D · Remodelación Piso 2</div>
      <div class="ls-bar"><i></i></div>
      <div class="ls-msg">Preparando la escena…</div>`;
    const css = document.createElement('style');
    css.textContent = `
      .ls-wrap{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:radial-gradient(ellipse at 50% 40%,#ffffff 0%,#f3f1ed 60%,#e9e6e0 100%);font-family:Roboto,system-ui,sans-serif;
        transition:opacity .9s ease, visibility .9s}
      .ls-wrap.out{opacity:0;visibility:hidden}
      .ls-logos{display:flex;align-items:center;gap:38px;animation:lsIn 1.2s cubic-bezier(.2,.8,.2,1) both}
      .ls-logos img{width:150px;height:150px;object-fit:contain}
      .ls-sep{width:1px;height:110px;background:#c9c3b9}
      .ls-title{margin-top:30px;font-size:20px;letter-spacing:6px;text-transform:uppercase;color:#1e2a44;font-weight:300;animation:lsIn 1.2s .15s both}
      .ls-sub{margin-top:8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8a8378;animation:lsIn 1.2s .25s both}
      .ls-bar{margin-top:34px;width:260px;height:2px;background:#ddd8cf;border-radius:2px;overflow:hidden}
      .ls-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#0d2d6b,#c62828);transition:width .5s ease}
      .ls-msg{margin-top:12px;font-size:11px;color:#9a9388;letter-spacing:1px;min-height:14px}
      @keyframes lsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @media (max-width:600px){.ls-logos{gap:18px}.ls-logos img{width:105px;height:105px}.ls-sep{height:80px}.ls-title{font-size:15px;letter-spacing:4px}}`;
    document.head.appendChild(css);
    document.body.appendChild(el);
    this.el = el;
    this.bar = el.querySelector('.ls-bar i');
    this.msg = el.querySelector('.ls-msg');
    this.p = 0;
    this.t0 = performance.now();
    // progreso real de texturas y modelos (three.js)
    const mgr = THREE.DefaultLoadingManager;
    mgr.onProgress = (_url, loaded, total) => this.set(Math.max(this.p, 0.1 + 0.5 * (loaded / Math.max(total, 1))));
  }

  set(p, msg) {
    this.p = Math.min(1, Math.max(this.p, p));
    this.bar.style.width = `${Math.round(this.p * 100)}%`;
    if (msg) this.msg.textContent = msg;
  }

  /** Oculta la pantalla (mínimo 2.2 s visible para que se lean los logos). */
  done() {
    this.set(1, 'Listo');
    const wait = Math.max(0, 2200 - (performance.now() - this.t0));
    setTimeout(() => { this.el.classList.add('out'); setTimeout(() => this.el.remove(), 1000); }, wait);
  }
}
