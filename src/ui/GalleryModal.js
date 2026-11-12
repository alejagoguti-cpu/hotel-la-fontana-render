import { store } from '../state/store.js';

export class GalleryModal {
  constructor() {
    this.modal = null;
    this.init();
  }

  init() {
    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.id = 'gallery-modal';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3 id="gallery-modal-title">Galería de Imágenes</h3>
          <div class="modal-filter-pills">
            <button class="mode-pill-btn active" id="gfilter-all">Todas</button>
            <button class="mode-pill-btn" id="gfilter-renders">Renders</button>
            <button class="mode-pill-btn" id="gfilter-axos">Axonométricos</button>
            <button class="mode-pill-btn" id="gfilter-plans">Planos</button>
          </div>
          <button class="icon-circle-btn" id="btn-close-gallery">✕</button>
        </div>

        <div class="modal-body">
          <div class="gallery-main-stage">
            <img id="gallery-main-img" src="" alt="Vista previa"/>
            <div class="gallery-caption" id="gallery-caption"></div>
          </div>
          <div class="gallery-thumbs-sidebar" id="gallery-thumbs"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  bindEvents() {
    this.modal.querySelector('#btn-close-gallery').onclick = () => this.close();
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };

    const filterBtns = this.modal.querySelectorAll('.modal-filter-pills button');
    filterBtns.forEach(btn => {
      btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterType = btn.id.replace('gfilter-', '');
        this.renderThumbs(filterType);
      };
    });
  }

  open(title, items = []) {
    this.items = items;
    this.activeFilter = 'all';
    this.modal.querySelector('#gallery-modal-title').textContent = title || 'Galería';
    this.modal.classList.add('open');
    this.renderThumbs('all');
    if (this.items.length > 0) {
      this.selectImage(0);
    }
  }

  close() {
    this.modal.classList.remove('open');
  }

  renderThumbs(filter) {
    const container = this.modal.querySelector('#gallery-thumbs');
    const filtered = this.items.filter(item => {
      if (filter === 'renders') return item.type === 'Render';
      if (filter === 'axos') return item.type === 'Axonométrico';
      if (filter === 'plans') return item.type === 'Plano' || item.type === 'Sección';
      return true;
    });

    container.innerHTML = filtered.map((item, idx) => `
      <div class="gallery-thumb-item ${idx === 0 ? 'active' : ''}" data-idx="${this.items.indexOf(item)}">
        <img src="${item.src}" alt="${item.title}"/>
        <div class="gallery-thumb-info">
          <strong>${item.title}</strong>
          <span>${item.type}</span>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.gallery-thumb-item').forEach(thumb => {
      thumb.onclick = () => {
        container.querySelectorAll('.gallery-thumb-item').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const idx = Number(thumb.dataset.idx);
        this.selectImage(idx);
      };
    });
  }

  selectImage(idx) {
    const item = this.items[idx];
    if (!item) return;
    const img = this.modal.querySelector('#gallery-main-img');
    const caption = this.modal.querySelector('#gallery-caption');
    img.src = item.src;
    caption.textContent = `${item.title} · ${item.type}`;
  }
}
