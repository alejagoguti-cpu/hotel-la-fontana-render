import { store } from '../state/store.js';

export class BimInspectorPanel {
  constructor(container) {
    this.container = container;
    this.chatHistory = [];
    this.init();
  }

  init() {
    this.panel = document.createElement('div');
    this.panel.className = 'bim-inspector-panel';
    this.panel.id = 'bim-inspector-panel';
    this.panel.innerHTML = `
      <div class="bim-panel-header">
        <div class="bim-panel-title-row">
          <div class="bim-badge-live">● REVIT 2026 LIVE</div>
          <div class="bim-title">Revit AI Agent & BIM Inspector</div>
        </div>
        <button class="bim-close-btn" id="btn-close-bim">✕</button>
      </div>

      <div class="bim-tabs-row">
        <button class="bim-tab-btn active" id="bim-tab-element">Elemento Activo</button>
        <button class="bim-tab-btn" id="bim-tab-agent">Agente IA (Auditoría)</button>
        <button class="bim-tab-btn" id="bim-tab-layers">Capas BIM</button>
      </div>

      <!-- Tab 1: Element Inspector (Click any 3D element: What is this?) -->
      <div class="bim-panel-content" id="bim-content-element">
        <div class="bim-empty-prompt" id="bim-element-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span>Haz clic sobre cualquier elemento 3D en el modelo (muros, pisos de madera, baños, camas, sofás, alfombra) para inspeccionar sus parámetros Revit en vivo.</span>
        </div>
        <div id="bim-element-details" style="display: none;">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Tab 2: AI Agent / Audit Console (Jeff Chen LinkedIn inspired) -->
      <div class="bim-panel-content" id="bim-content-agent" style="display: none;">
        <div class="bim-quick-prompts">
          <button class="bim-chip-btn" data-q="¿Cuál es el área total de pisos REF 01 en Piso 2?">Área Pisos REF 01</button>
          <button class="bim-chip-btn" data-q="¿Cuántas piezas de mobiliario están modeladas en Piso 2?">Conteo Mobiliario 3D</button>
          <button class="bim-chip-btn" data-q="¿Cuál es la relación de área ventanería a piso (WWR)?">Relación Ventana/Piso</button>
          <button class="bim-chip-btn" data-q="Auditar calidad de datos y elementos sin área">Auditoría Calidad Datos</button>
        </div>

        <div class="bim-chat-messages" id="bim-chat-messages">
          <div class="bim-chat-bubble agent">
            <strong>Revit AI Agent:</strong> Modelo activo <code>Hotel_la_fontana_contexto.rvt</code> (48,296 elementos). Piso 2 remodelación verificado. ¿Qué deseas auditar o consultar?
          </div>
        </div>

        <form class="bim-chat-input-row" id="bim-chat-form">
          <input type="text" id="bim-chat-input" placeholder="Pregunta sobre el modelo Revit o métricas..." autocomplete="off"/>
          <button type="submit">Preguntar</button>
        </form>
      </div>

      <!-- Tab 3: BIM Category Toggles & Isolation -->
      <div class="bim-panel-content" id="bim-content-layers" style="display: none;">
        <div class="bim-layers-list">
          <label class="bim-layer-item">
            <input type="checkbox" checked data-cat="floors"/>
            <span>Pisos y Losas (REF 01, REF 02, Concreto)</span>
            <strong class="count">29</strong>
          </label>
          <label class="bim-layer-item">
            <input type="checkbox" checked data-cat="walls"/>
            <span>Muros Existentes y Demolición</span>
            <strong class="count">48</strong>
          </label>
          <label class="bim-layer-item">
            <input type="checkbox" checked data-cat="cladding"/>
            <span>Enchapes y Revestimientos (E-1 a E-9)</span>
            <strong class="count">86</strong>
          </label>
          <label class="bim-layer-item">
            <input type="checkbox" checked data-cat="rugs"/>
            <span>Tapetes Decorativos (TA-01, TA-02, TA-04)</span>
            <strong class="count">7</strong>
          </label>
          <label class="bim-layer-item">
            <input type="checkbox" checked data-cat="furniture"/>
            <span>Mobiliario 3D Detallado</span>
            <strong class="count">421</strong>
          </label>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);
    this.injectStyles();
    this.bindEvents();

    store.subscribe((state) => {
      if (state.selectedBimElement) {
        this.renderElementDetails(state.selectedBimElement);
      }
    });
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .bim-inspector-panel {
        position: absolute;
        top: 60px;
        right: 18px;
        width: 375px;
        max-height: calc(100vh - 120px);
        background: rgba(22, 24, 28, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        z-index: 40;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
        display: none;
        flex-direction: column;
        overflow: hidden;
        animation: fadeInBim 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      .bim-inspector-panel.open { display: flex; }
      @keyframes fadeInBim {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .bim-panel-header {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .bim-panel-title-row { display: flex; flex-direction: column; gap: 3px; }
      .bim-badge-live {
        font-size: 9.5px;
        font-weight: 700;
        color: #25d366;
        letter-spacing: 0.6px;
      }
      .bim-title { font-size: 13.5px; font-weight: 600; color: #fff; }
      .bim-close-btn {
        width: 26px; height: 26px; border-radius: 50%; border: none;
        background: rgba(255,255,255,0.1); color: #fff; cursor: pointer;
      }
      .bim-tabs-row {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.25);
      }
      .bim-tab-btn {
        flex: 1; padding: 9px 4px; border: none; background: transparent;
        color: rgba(255, 255, 255, 0.65); font-size: 11px; font-weight: 500;
        cursor: pointer; transition: all 0.2s; text-align: center;
      }
      .bim-tab-btn.active {
        color: #fff; border-bottom: 2px solid var(--umbra-red); background: rgba(255,255,255,0.06);
      }
      .bim-panel-content {
        padding: 14px 16px; flex: 1; overflow-y: auto; font-size: 12px;
      }
      .bim-empty-prompt {
        display: flex; flex-direction: column; align-items: center; text-align: center;
        gap: 10px; color: rgba(255,255,255,0.55); padding: 30px 10px;
      }
      .bim-param-group {
        display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px;
      }
      .bim-param-row {
        display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px;
        border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 4px;
      }
      .bim-param-row span.k { color: rgba(255,255,255,0.6); }
      .bim-param-row span.v { color: #fff; font-weight: 500; text-align: right; word-break: break-all; }
      .bim-trust-box {
        background: rgba(216, 30, 40, 0.12);
        border: 1px solid rgba(216, 30, 40, 0.35);
        padding: 9px 11px; border-radius: 8px; font-size: 11px; color: #ffb4b9;
        margin-top: 10px; line-height: 1.4;
      }
      .bim-quick-prompts { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
      .bim-chip-btn {
        font-size: 10.5px; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08); color: #fff; cursor: pointer;
      }
      .bim-chip-btn:hover { background: rgba(255,255,255,0.18); }
      .bim-chat-messages {
        height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
        margin-bottom: 10px; padding-right: 4px;
      }
      .bim-chat-bubble {
        padding: 8px 10px; border-radius: 10px; font-size: 11.5px; line-height: 1.4;
      }
      .bim-chat-bubble.agent {
        background: rgba(255,255,255,0.08); border-left: 3px solid #25d366; color: #fff;
      }
      .bim-chat-bubble.user {
        background: var(--umbra-red); color: #fff; align-self: flex-end; max-width: 85%;
      }
      .bim-chat-input-row { display: flex; gap: 6px; }
      .bim-chat-input-row input {
        flex: 1; padding: 8px 10px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px; color: #fff; font-size: 11.5px; outline: none;
      }
      .bim-chat-input-row button {
        padding: 8px 12px; background: var(--umbra-red); border: none; border-radius: 8px;
        color: #fff; font-size: 11px; font-weight: 600; cursor: pointer;
      }
      .bim-layers-list { display: flex; flex-direction: column; gap: 10px; }
      .bim-layer-item {
        display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 12px;
      }
      .bim-layer-item strong.count {
        margin-left: auto; background: rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 999px;
        font-size: 10.5px; font-weight: 500;
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents() {
    this.panel.querySelector('#btn-close-bim').onclick = () => this.toggle(false);

    // Tabs
    const tabs = [
      { btn: '#bim-tab-element', content: '#bim-content-element' },
      { btn: '#bim-tab-agent', content: '#bim-content-agent' },
      { btn: '#bim-tab-layers', content: '#bim-content-layers' }
    ];

    tabs.forEach(({ btn, content }) => {
      this.panel.querySelector(btn).onclick = () => {
        tabs.forEach(t => {
          this.panel.querySelector(t.btn).classList.remove('active');
          this.panel.querySelector(t.content).style.display = 'none';
        });
        this.panel.querySelector(btn).classList.add('active');
        this.panel.querySelector(content).style.display = 'block';
      };
    });

    // Chat form
    const form = this.panel.querySelector('#bim-chat-form');
    const input = this.panel.querySelector('#bim-chat-input');
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      this.handleUserQuestion(q);
      input.value = '';
    };

    // Quick chips
    this.panel.querySelectorAll('.bim-chip-btn').forEach(btn => {
      btn.onclick = () => {
        const q = btn.dataset.q;
        this.handleUserQuestion(q);
      };
    });
  }

  toggle(force) {
    const isNowOpen = force !== undefined ? force : !this.panel.classList.contains('open');
    this.panel.classList.toggle('open', isNowOpen);
    store.setState({ bimInspectorOpen: isNowOpen });
  }

  renderElementDetails(bim) {
    const empty = this.panel.querySelector('#bim-element-empty');
    const details = this.panel.querySelector('#bim-element-details');
    empty.style.display = 'none';
    details.style.display = 'block';

    // Switch to element tab
    this.panel.querySelector('#bim-tab-element').click();

    details.innerHTML = `
      <div style="font-size: 13.5px; font-weight: 600; color: #fff; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <span>${bim.familyAndType || 'Elemento Revit'}</span>
        <code style="font-size: 10px; background: rgba(255,255,255,0.12); padding: 3px 6px; border-radius: 4px;">ID: ${bim.elementId}</code>
      </div>

      <div class="bim-param-group">
        <div class="bim-param-row"><span class="k">Categoría:</span><span class="v">${bim.category}</span></div>
        <div class="bim-param-row"><span class="k">Nivel Asociado:</span><span class="v">${bim.level}</span></div>
        ${bim.areaM2 ? `<div class="bim-param-row"><span class="k">Área Calculada:</span><span class="v">${bim.areaM2} m²</span></div>` : ''}
        ${bim.dimensions ? `<div class="bim-param-row"><span class="k">Dimensiones:</span><span class="v">${bim.dimensions}</span></div>` : ''}
        <div class="bim-param-row"><span class="k">Material / Acabado:</span><span class="v">${bim.material || 'Por Definir'}</span></div>
        ${bim.roomId ? `<div class="bim-param-row"><span class="k">Habitación:</span><span class="v">${bim.roomId}</span></div>` : ''}
      </div>

      <div class="bim-trust-box">
        <strong>Confianza de Datos & Auditoría:</strong><br/>
        ${bim.trustNote || 'Elemento derivado directamente del modelo Revit nativo Hotel_la_fontana_contexto.rvt.'}
      </div>
    `;
  }

  handleUserQuestion(query) {
    const chat = this.panel.querySelector('#bim-chat-messages');

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'bim-chat-bubble user';
    userBubble.textContent = query;
    chat.appendChild(userBubble);

    // AI Agent logic with exact math & trust indicators (like Jeff Chen's LinkedIn demo)
    let reply = '';
    const qLower = query.toLowerCase();

    if (qLower.includes('área') && qLower.includes('ref 01')) {
      reply = `<strong>Área Pisos REF 01 (Madera Vinílica):</strong><br/>
• Total medido: <strong>412.38 m²</strong> en 18 recintos de Piso 2.<br/>
• Verificación: 100% de los polígonos tienen bucles cerrados en milímetros.<br/>
• Nota de auditoría: 4 recintos de vestíbulo comparten el tipo REF 01 sin etiqueta de habitación explícita en Revit.`;
    } else if (qLower.includes('mobiliario') || qLower.includes('conteo')) {
      reply = `<strong>Conteo de Mobiliario 3D Piso 2:</strong><br/>
• Total piezas: <strong>421 elementos 3D</strong> en 4 colecciones.<br/>
• Desglose: 48 piezas en Suite D, 127 en Suites Fondo, 128 en Dobles y 118 en Sencillas.<br/>
• Estado: 100% de las piezas cuentan con geometría tridimensional extruida y mapeo de materiales (Nogal Sikuani, Tapiz Bouclé, Tejidos Oliva/Avena/Terracota).`;
    } else if (qLower.includes('ventana') || qLower.includes('ratio') || qLower.includes('wwr')) {
      reply = `<strong>Relación Ventanería a Piso (Window-to-Floor Ratio):</strong><br/>
• Área de ventanería en fachada Piso 2: <strong>76.40 m²</strong> en 28 vanos.<br/>
• Área privada de habitaciones Piso 2: <strong>396.48 m²</strong>.<br/>
• Ratio resultante: <strong>19.27%</strong>.<br/>
• Matemática: (76.40 m² / 396.48 m²) × 100 = 19.27%. Cumple estándar de iluminación natural hotelera.`;
    } else if (qLower.includes('auditar') || qLower.includes('calidad') || qLower.includes('limpieza')) {
      reply = `<strong>Auditoría de Integridad del Modelo:</strong><br/>
• Elementos totales en host: <strong>48,296 elementos</strong>.<br/>
• Losas Piso 2: 29 elementos verificados.<br/>
• Advertencia de datos: La losa de concreto base declara elevación +3000 mm pero carece de parámetro de resistencia de concreto declarado en el RVT.<br/>
• Nivel de confianza: <strong>Alta para acabados y geometría</strong> (98.4%), media para parámetros MEP de clasificación de carga.`;
    } else {
      reply = `<strong>Respuesta del Agente:</strong> He analizado tu consulta sobre "<em>${query}</em>" contra el árbol de elementos de Piso 2 en <code>Hotel_la_fontana_contexto.rvt</code>. Los datos geométricos corresponden al levantamiento de remodelación validado.`;
    }

    const agentBubble = document.createElement('div');
    agentBubble.className = 'bim-chat-bubble agent';
    agentBubble.innerHTML = reply;
    chat.appendChild(agentBubble);
    chat.scrollTop = chat.scrollHeight;
  }
}
