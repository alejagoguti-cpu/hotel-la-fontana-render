# Hotel Estelar La Fontana · Web Masterplan 3D & Revit AI Agent

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-success?style=flat-square&logo=github)](https://alejagoguti-cpu.github.io/hotel-la-fontana-masterplan/)
[![Revit Version](https://img.shields.io/badge/Autodesk%20Revit-2026%20BIM-0696D7?style=flat-square&logo=autodesk)](https://www.autodesk.com/products/revit/overview)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%20PBR-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

Gemelo digital interactivo y Web Masterplan 3D del **Hotel Estelar La Fontana** (Bogotá D.C.), integrando la remodelación integral del **Piso 2** y su contexto urbano (Usaquén / Santa Bárbara / Unicentro).


---

## Páginas del sitio

| Página | Contenido |
| :--- | :--- |
| `index.html` | Portada del proyecto: visualizaciones fotorrealistas, planta interactiva del Piso 2, galería de interiores y comparador modelo / visualización. Código en `src/landing/`. |
| `masterplan.html` | Gemelo digital 3D interactivo (antes `index.html`): exterior, corte del Piso 2, planta y agente BIM. |
| `catalogo.html` | Catálogo de mobiliario: foto de la matriz frente al modelo 3D. |

Las visualizaciones de `assets/hf/` se generaron con Higgsfield a partir de vistas del modelo 3D (exteriores capturados del gemelo digital, interiores de `assets/renders/`). Cada imagen `*.webp` tiene su vista de origen `*-base.webp`. Son ilustrativas: la IA puede alterar detalles frente al modelo.

---

## 📍 Ubicación y Georreferenciación

* **Coordenadas:** `4.704585254832645, -74.04369633465852`
* **Localidad / Sector:** Usaquén · Santa Bárbara / Unicentro
* **Dirección:** Avenida Calle 127 # 15A-10 (Costado Calle 124 con Carrera 15), Bogotá D.C., Colombia
* **Altitud:** 2,552 msnm

---

## 🏗️ Arquitectura de Carpetas del Repositorio

El repositorio está estructurado siguiendo principios de ingeniería de software para proyectos BIM y aplicaciones 3D en la nube:

```text
hotel-la-fontana-masterplan/
├── index.html                        # Punto de entrada HTML5 con import maps y estilos
├── README.md                         # Documentación completa, especificaciones y arquitectura
├── .gitignore                        # Archivos y temporales excluidos de control de versiones
│
├── data/                             # Base de datos estructurada del proyecto y BIM
│   ├── project-config.json           # Metadatos del hotel, georreferenciación y disciplinas
│   ├── rooms-piso2.json              # Inventario de 12 habitaciones con polígonos, áreas y dotación
│   ├── geometry/
│   │   ├── p2-architecture.json      # Muros, losas, columnas, escaleras y corredores (mm)
│   │   ├── p2-finishes.json          # Pisos REF 01/02/28, enchapes E-1..E-9 y tapetes
│   │   └── p2-furniture.json         # 421 primitivas 3D de mobiliario con mapeo de materiales
│   └── specs/
│       └── materiales-acabados.json  # Catálogo de acabados, especificaciones INT-605/608 y PBR
│
├── src/                              # Código fuente modular en JavaScript ES Modules
│   ├── main.js                       # Orquestador de la aplicación y ciclo de vida
│   ├── state/
│   │   └── store.js                  # Manejador de estado reactivo (filtros, selección, vistas)
│   ├── scene/
│   │   ├── MasterplanScene.js        # Motor Three.js, iluminación, sombras y raycasting
│   │   ├── MaterialLibrary.js        # Cargador PBR con texturas reales y calibración de brillo/rugosidad
│   │   ├── HotelBuildingBuilder.js   # Edificio hotel 6 pisos + contexto urbano Unicentro / Cra 15
│   │   ├── Piso2InteriorBuilder.js   # Interior 1:1 Piso 2 con metadatos BIM por elemento
│   │   └── RoomHighlighter.js        # Volúmenes interactivos rojos y wireframe por habitación
│   ├── ui/
│   │   ├── SidebarFilters.js         # Panel lateral izquierdo de filtros (Ala, Tipología, Habitación)
│   │   ├── RoomDetailCard.js         # Tarjeta flotante central glassmorphic con atributos
│   │   ├── BottomDock.js             # Dock inferior (Dónde estamos, Urbanismo, Habitaciones, Galería)
│   │   ├── BimInspectorPanel.js      # Panel activable Revit AI Agent & BIM Inspector
│   │   ├── GalleryModal.js           # Visor lightbox (Renders, Axonométricos, Planos)
│   │   └── LocationModal.js          # Modal de localización OpenStreetMap interactivo
│   └── styles/
│       └── masterplan.css            # Hoja de estilos con efectos glassmorphism idénticos a Centrum
│
├── assets/                           # Recursos multimedia optimizados para web
│   ├── textures/                     # 24 texturas PBR reales (ladrillo, hiedra, maderas, mármoles)
│   ├── renders/                      # Renders fotorrealistas de alcobas, salas, baños y corredores
│   ├── axos/                         # Axonométricos 3D de control de suites y alas
│   └── plans/                        # Planos arquitectónicos, acotados y de acabados en alta resolución
│
└── scripts/
    └── build-dataset.cjs             # Pipeline de extracción de volcados Revit a JSON web
```

---

## 🛏️ Inventario de Habitaciones (Piso 2)

| Habitación | Tipología | Ala / Sector | Área Privada | Dotación Principal | Ficha / Plano |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hab. 214** | Suite D | Ala Recta Norte | 51.84 m² | King + Sala Curva + Comedor | INT-605A@605C |
| **Hab. 215** | Doble Twin | Ala Recta Norte | 26.42 m² | 2 Camas Dobles + Poltrona | A02 |
| **Hab. 216** | Sencilla King | Ala Recta Norte | 24.45 m² | 1 Cama King + Estar | A03 |
| **Hab. 217** | Doble Twin | Ala Recta Norte | 26.36 m² | 2 Camas Dobles + Escritorio | A04 |
| **Hab. 218** | Sencilla King | Ala Recta Norte | 26.10 m² | 1 Cama King + 2 Mesas Noche | A05 |
| **Hab. 219** | Doble Diagonal | Ala Diagonal | 25.38 m² | 2 Camas Dobles + Club Chair | A06 |
| **Hab. 220** | Sencilla King | Ala Diagonal | 26.90 m² | 1 Cama King + Escritorio | A07 |
| **Hab. 221** | Doble Diagonal | Ala Diagonal | 26.88 m² | 2 Camas Dobles + TA-02 | A08 |
| **Hab. 222** | Suite Fondo A | Suites Fondo | 54.15 m² | King + Sala + Doble Baño | A09 |
| **Hab. 223** | Junior Suite C | Suites Fondo | 29.85 m² | King + Estar Circular | A10 |
| **Hab. 224** | Suite C1 (Mock-Up) | Suites Fondo | 48.42 m² | King + Baño Mock-Up INT-618 | INT-608A@608C |
| **Hab. 225** | Sencilla Especial | Suites Fondo | 29.56 m² | King + Estar Fachada Sur | A11 |

---

## ⚡ Revit AI Agent & BIM Inspector

Inspirado en el flujo de trabajo de agentes de IA sobre modelos Revit, la aplicación incluye una consola interactiva que se puede **activar y desactivar** en cualquier momento con el botón `⚡ Agente BIM`:

1. **Elemento Activo (What is this?):** Al hacer clic sobre cualquier objeto 3D del interior (un muro, un tramo de piso vinílico, una cama o un mesón de mármol), el panel lee sus parámetros Revit en vivo (ID de elemento, Categoría, Familia y Tipo, Nivel, Área y especificación técnica de acabados).
2. **Agente IA (Auditoría):** Permite ejecutar preguntas frecuentes sobre métricas del modelo como:
   * *¿Cuál es el área total de pisos REF 01 en Piso 2?* (412.38 m² en 18 recintos).
   * *¿Cuántas piezas de mobiliario están modeladas?* (421 elementos 3D).
   * *Relación de ventanería a piso (WWR)* (19.27%).
   * *Auditoría de integridad del modelo*.
3. **Indicadores de Confianza:** El agente reporta explícitamente cuándo los datos provienen de geometría nativa verificada o cuándo el modelo carece de parámetros declarados.
4. **Capas BIM:** Permite aislar y encender/apagar categorías (Pisos, Muros, Enchapes, Tapetes, Mobiliario).

---

## 🎨 Texturas PBR de la Vida Real

* **Fachada Exterior:** Ladrillo tradicional bogotano con mapa de relieve (`hlf_ladrillo.png` + `hlf_ladrillo_bump.png`) y mantos de hiedra natural (`hlf_hiedra.png`).
* **Habitaciones:** Piso vinílico apariencia madera REF 01 con veta orientada hacia las ventanas y bump de micro-poro (`hlf_piso_madera.png` + `hlf_ref01_veta_seamless.png`).
* **Baños:** Porcelanato decorativo Mos The Dream blanco 30×30 (`hlf_mosaico2.png`) y mesones en Mármol Antik Silver Blue (`hlf_marmol3.png`).
* **Zonas Comunes:** Alfombra Tweed de tráfico pesado para corredores (`hlf_alfombra_hall.jpg`) y borde perimetral en mármol.
* **Mobiliario:** Melamina Primadera Sikuani Nogal (`hlf_nogal4_v.png`), tapicería Bouclé Taupe (`hlf_boucle_taupe.png`), tejidos artesanales Oliva, Avena y Terracota, y cortinas en lino natural.

---

## 🚀 Despliegue y Ejecución Local

No requiere instalación de dependencias pesadas ni compilación. Puede ejecutarse directamente con cualquier servidor estático:

```bash
# Opción 1: Con Python
python -m http.server 8080

# Opción 2: Con Node.js (npx serve)
npx serve .

# Opción 3: Abrir directamente o publicar en GitHub Pages
```

Publicado en: `https://alejagoguti-cpu.github.io/hotel-la-fontana-masterplan/`
