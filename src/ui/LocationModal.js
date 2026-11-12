export class LocationModal {
  constructor() {
    this.modal = null;
    this.map = null;
    this.init();
  }

  init() {
    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.id = 'location-modal';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3>Dónde estamos · Hotel Estelar La Fontana</h3>
          <button class="icon-circle-btn" id="btn-close-location">✕</button>
        </div>

        <div class="modal-body">
          <div id="osm-map-container"></div>
          <div class="location-info-sidebar">
            <h4 style="font-size: 15px; font-weight: 600;">Hotel Estelar La Fontana</h4>
            <div class="coord-badge">
              4.704585° N, -74.043696° W
            </div>
            
            <p style="font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.45;">
              Ubicado en el exclusivo sector de <strong>Usaquén / Santa Bárbara</strong>, frente a la Calle 124 y a pasos del Centro Comercial Unicentro y las Avenidas 127 y Carrera 15.
            </p>

            <div style="font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.5); font-weight: 600; margin-top: 6px;">
              Puntos de Interés Cercanos
            </div>

            <div class="poi-list">
              <div class="poi-item">
                <span>C.C. Unicentro Bogotá</span>
                <strong style="color: #ff858d;">150 m</strong>
              </div>
              <div class="poi-item">
                <span>Av. Calle 127</span>
                <strong style="color: #ff858d;">120 m</strong>
              </div>
              <div class="poi-item">
                <span>Av. Carrera 15</span>
                <strong style="color: #ff858d;">180 m</strong>
              </div>
              <div class="poi-item">
                <span>Plaza Central Usaquén</span>
                <strong style="color: #ff858d;">1.2 km</strong>
              </div>
            </div>

            <div style="margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 11px; color: rgba(255,255,255,0.6);">
              Altitud: 2,552 msnm · Bogotá D.C.
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  bindEvents() {
    this.modal.querySelector('#btn-close-location').onclick = () => this.close();
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };
  }

  open() {
    this.modal.classList.add('open');
    if (!this.map && window.L) {
      setTimeout(() => {
        this.map = L.map('osm-map-container').setView([4.704585254832645, -74.04369633465852], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        const icon = L.divIcon({
          className: 'custom-pin',
          html: '<div style="background:#d81e28; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 14px rgba(216,30,40,0.8);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([4.704585254832645, -74.04369633465852], { icon })
          .addTo(this.map)
          .bindPopup('<b>Hotel Estelar La Fontana</b><br>Calle 124 # 15A-10')
          .openPopup();
      }, 150);
    } else if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }

  close() {
    this.modal.classList.remove('open');
  }
}
