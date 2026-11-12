/**
 * Reactive Store for Hotel La Fontana Web Masterplan
 * Manages rooms, filters, 3D view modes, active tab, and gallery/location modals.
 */
export class MasterplanStore {
  constructor() {
    this.state = {
      projectConfig: null,
      rooms: [],
      showRoomsOverlay: true,        // "Mostrar inmuebles" switch
      sidebarCollapsed: false,
      activeWing: null,              // e.g., 'Ala Recta Norte', 'Ala Diagonal', 'Sector Suites Fondo'
      activeTypology: null,          // e.g., 'Suite D', 'Doble', 'Sencilla', etc.
      selectedRoomId: 'HAB-214',     // Default selected room on launch so user sees the card immediately
      hoveredRoomId: null,
      activeTab: 'inmuebles',        // 'ubicacion' | 'urbanismo' | 'inmuebles' | 'galeria'
      viewMode: 'exterior',          // 'exterior' (6-story hotel) | 'interior' (Piso 2 1:1 PBR cutaway) | 'top' (Planta 3D)
      galleryModalOpen: false,
      galleryItems: [],
      galleryTitle: '',
      galleryActiveIndex: 0,
      locationModalOpen: false
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  getFilteredRooms() {
    const { rooms, activeWing, activeTypology } = this.state;
    return rooms.filter(r => {
      if (activeWing && r.wing !== activeWing) return false;
      if (activeTypology && r.typology !== activeTypology) return false;
      return true;
    });
  }

  getSelectedRoom() {
    return this.state.rooms.find(r => r.id === this.state.selectedRoomId) || null;
  }
}

export const store = new MasterplanStore();
