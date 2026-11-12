import { store } from '../state/store.js';

export class BottomDock {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks || {};
    this.init();
  }

  init() {
    this.container.className = 'bottom-dock-container';
    this.container.innerHTML = `
      <div class="dock-collapse-handle" id="btn-toggle-dock">▼</div>
      <div class="bottom-dock">
        <!-- BACO STUDIO Brand Badge -->
        <div class="baco-dock-brand">
          <img src="./assets/branding/baco-studio-logo.png" alt="BACO STUDIO" class="baco-dock-avatar" />
          <div class="baco-dock-meta">
            <strong class="baco-dock-name">BACO STUDIO</strong>
            <span class="baco-dock-sub">HOTEL LA FONTANA · PISO 2</span>
          </div>
        </div>

        <!-- 4 Action Tabs -->
        <button class="dock-tab-btn" data-tab="ubicacion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Dónde estamos
        </button>

        <button class="dock-tab-btn" data-tab="urbanismo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Urbanismo
        </button>

        <button class="dock-tab-btn active" data-tab="inmuebles">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/>
          </svg>
          Habitaciones
        </button>

        <button class="dock-tab-btn" data-tab="galeria">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Galería
        </button>
      </div>
    `;

    this.bindEvents();
    store.subscribe((state) => {
      this.container.querySelectorAll('.dock-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
      });
    });
  }

  bindEvents() {
    this.container.querySelectorAll('.dock-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        store.setState({ activeTab: tab });
        if (this.callbacks.onTabClick) this.callbacks.onTabClick(tab);
      };
    });

    const collapseBtn = this.container.querySelector('#btn-toggle-dock');
    if (collapseBtn) {
      collapseBtn.onclick = () => {
        const dock = this.container.querySelector('.bottom-dock');
        const isHidden = dock.style.display === 'none';
        dock.style.display = isHidden ? 'flex' : 'none';
        collapseBtn.textContent = isHidden ? '▼' : '▲';
      };
    }
  }
}
