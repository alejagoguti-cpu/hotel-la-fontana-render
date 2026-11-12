import { store } from '../state/store.js';

export class RoomDetailCard {
  constructor(container, onOpenGallery) {
    this.container = container;
    this.onOpenGallery = onOpenGallery;
    this.init();
  }

  init() {
    this.container.className = 'room-detail-card';
    this.bindEvents();
    store.subscribe(() => this.render());
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#btn-close-detail')) {
        this.container.classList.remove('visible');
      } else if (e.target.closest('#btn-view-gallery')) {
        const room = store.getSelectedRoom();
        if (room) this.onOpenGallery(room);
      } else if (e.target.closest('#btn-view-interior-3d')) {
        const room = store.getSelectedRoom();
        const tour = window.__masterplan?.tour;
        if (room && tour) tour.enterRoom(room.id);
        else store.setState({ viewMode: 'interior' });
      }
    });
  }

  render() {
    const room = store.getSelectedRoom();
    if (!room) {
      this.container.classList.remove('visible');
      return;
    }

    this.container.innerHTML = `
      <button class="detail-close-btn" id="btn-close-detail">✕</button>
      
      <div class="detail-title">${room.title}</div>
      <div class="detail-subtitle">${room.subtitle}</div>

      <div class="detail-props">
        <div class="detail-prop-line"><span class="label">Piso:</span> ${room.floor}</div>
        <div class="detail-prop-line"><span class="label">Tipología:</span> ${room.typology}</div>
        <div class="detail-prop-line"><span class="label">Área construida:</span> ${room.areaBuiltM2} m²</div>
        <div class="detail-prop-line"><span class="label">Área privada:</span> ${room.areaPrivateM2} m²</div>
        <div class="detail-prop-line"><span class="label">Ubicación:</span> ${room.locationType}</div>
        <div class="detail-prop-line"><span class="label">Movilidad reducida:</span> ${room.reducedMobility}</div>
        <div class="detail-prop-line"><span class="label">Dotación:</span> ${room.bedConfig}</div>
      </div>

      <div class="detail-actions">
        <button class="detail-gallery-btn" id="btn-view-gallery">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Ver galería (${room.gallery?.length || 0})
        </button>
        <button class="detail-interior-btn" id="btn-view-interior-3d">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          Recorrer habitación en 3D
        </button>
      </div>
    `;

    this.container.classList.add('visible');
  }
}
