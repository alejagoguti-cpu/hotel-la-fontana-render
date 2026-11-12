import { store } from '../state/store.js';

export class SidebarFilters {
  constructor(container, onSelectRoom) {
    this.container = container;
    this.onSelectRoom = onSelectRoom;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="left-sidebar">
        <button class="sidebar-close-btn" id="btn-collapse-sidebar" title="Ocultar panel">✕</button>
        
        <!-- BACO STUDIO Brand Header -->
        <div class="sidebar-brand-header">
          <img src="./assets/branding/baco-studio-logo.png" alt="BACO STUDIO" class="baco-sidebar-logo" />
          <div class="baco-brand-info">
            <div class="baco-brand-name">BACO STUDIO</div>
            <div class="baco-brand-project">HOTEL LA FONTANA · PISO 2</div>
          </div>
        </div>

        <div class="sidebar-header-controls">
          <div class="toggle-row">
            <div class="umbra-switch on" id="toggle-show-rooms">
              <div class="umbra-switch-knob"></div>
            </div>
            <span class="toggle-label">Mostrar habitaciones 3D</span>
          </div>
        </div>

        <div class="sidebar-body">
          <!-- Sector / Ala Filter -->
          <div class="filter-section">
            <div class="filter-section-label">Filtrar por Sector</div>
            <div class="baco-pill-stack" id="wing-filters">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Room list cards -->
          <div class="filter-section">
            <div class="filter-section-label">Habitaciones Piso 2 (12 Suites)</div>
            <div class="baco-room-stack" id="room-list-buttons">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Typology Filter -->
          <div class="filter-section">
            <div class="filter-section-label">Tipologías</div>
            <div class="filter-grid-2" id="typology-filters">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <div class="sidebar-collapse-tab" id="sidebar-tab" title="Mostrar/Ocultar">
          ‹
        </div>
      </div>
    `;

    this.bindEvents();
    store.subscribe(() => this.render());
  }

  bindEvents() {
    const toggle = this.container.querySelector('#toggle-show-rooms');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = !store.state.showRoomsOverlay;
        toggle.classList.toggle('on', next);
        store.setState({ showRoomsOverlay: next });
      });
    }

    const collapseBtn = this.container.querySelector('#btn-collapse-sidebar');
    const collapseTab = this.container.querySelector('#sidebar-tab');
    const toggleCollapse = () => {
      this.container.classList.toggle('collapsed');
      const isCollapsed = this.container.classList.contains('collapsed');
      if (collapseTab) collapseTab.textContent = isCollapsed ? '›' : '‹';
    };
    if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);
    if (collapseTab) collapseTab.addEventListener('click', toggleCollapse);
  }

  render() {
    const { rooms, activeWing, activeTypology, selectedRoomId } = store.state;
    if (!rooms || rooms.length === 0) return;

    // 1. Wings
    const wings = [...new Set(rooms.map(r => r.wing))];
    const wingContainer = this.container.querySelector('#wing-filters');
    if (wingContainer) {
      wingContainer.innerHTML = `
        <button class="baco-pill-btn ${!activeWing ? 'active' : ''}" data-wing="">Todas las Alas</button>
        ${wings.map(w => `
          <button class="baco-pill-btn ${activeWing === w ? 'active' : ''}" data-wing="${w}">
            ${w}
          </button>
        `).join('')}
      `;

      wingContainer.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const w = btn.dataset.wing || null;
          store.setState({ activeWing: w });
        };
      });
    }

    // 2. Room cards (Redesigned with comfortable breathing room, no cut-offs)
    const filtered = store.getFilteredRooms();
    const roomContainer = this.container.querySelector('#room-list-buttons');
    if (roomContainer) {
      roomContainer.innerHTML = filtered.map(r => `
        <div class="baco-room-card ${selectedRoomId === r.id ? 'active' : ''}" data-id="${r.id}">
          <div class="baco-room-main">
            <span class="baco-room-title">Hab. ${r.number}</span>
            <span class="baco-room-type">${r.typology}</span>
          </div>
          <div class="baco-room-badge">${r.areaPrivateM2} m²</div>
        </div>
      `).join('');

      roomContainer.querySelectorAll('.baco-room-card').forEach(card => {
        card.onclick = () => {
          const id = card.dataset.id;
          this.onSelectRoom(id);
        };
      });
    }

    // 3. Typologies
    const typologies = [...new Set(rooms.map(r => r.typology))];
    const typoContainer = this.container.querySelector('#typology-filters');
    if (typoContainer) {
      typoContainer.innerHTML = `
        <button class="baco-pill-btn ${!activeTypology ? 'active' : ''}" data-typo="" style="grid-column: span 2">Todas</button>
        ${typologies.map(t => `
          <button class="baco-pill-btn ${activeTypology === t ? 'active' : ''}" data-typo="${t}">
            ${t}
          </button>
        `).join('')}
      `;

      typoContainer.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const t = btn.dataset.typo || null;
          store.setState({ activeTypology: t });
        };
      });
    }
  }
}
