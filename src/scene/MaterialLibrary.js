import * as THREE from 'three';

/**
 * Real-life PBR Material Library for Hotel La Fontana
 * Uses the actual Revit appearance textures from ./assets/textures/
 */
export class MaterialLibrary {
  constructor(renderer) {
    this.loader = new THREE.TextureLoader();
    this.maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
    this.textures = new Map();
    this.materials = new Map();
  }

  getTexture(url, repeatX = 1, repeatY = 1, isSRGB = true) {
    const key = `${url}_${repeatX}_${repeatY}`;
    if (this.textures.has(key)) return this.textures.get(key);

    const tex = this.loader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = this.maxAnisotropy;
    if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(key, tex);
    return tex;
  }

  /** Material interior "de render": textura fotográfica real (Poly Haven CC0, recoloreada a la paleta
   *  del proyecto) + mapa normal + rugosidad. `meters` = tamaño real de una repetición (UV en metros). */
  realMaterial(name, meters, { roughness = 1, normalScale = 1, envMapIntensity = 0.45, color = 0xffffff, polygonOffset = false } = {}) {
    const base = './assets/textures/real/' + name;
    const rep = 1 / meters;
    const m = new THREE.MeshStandardMaterial({
      map: this.getTexture(base + '.webp', rep, rep, true),
      normalMap: this.getTexture(base + '_n.webp', rep, rep, false),
      roughnessMap: this.getTexture(base + '_r.webp', rep, rep, false),
      roughness, metalness: 0, color, envMapIntensity
    });
    m.normalScale = new THREE.Vector2(normalScale, normalScale);
    if (polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    return m;
  }

  initAll() {
    // 1. Exterior Brick Facade (Iconic Hotel Estelar La Fontana Bogotá red brick - 1:1 Revit material)
    const brickMap = this.getTexture('./assets/textures/hlf_ladrillo.png', 1.0, 1.0, true);
    const brickBump = this.getTexture('./assets/textures/hlf_ladrillo_bump.png', 1.0, 1.0, false);
    this.materials.set('BRICK_FACADE', new THREE.MeshStandardMaterial({
      map: brickMap,
      bumpMap: brickBump,
      bumpScale: 0.048,
      color: 0xffffff, // 100% pure Revit texture - no color distortion
      roughness: 0.78,
      metalness: 0.02
    }));

    // 1B. Spanish Terracotta Clay Roof Tiles (Teja de barro colonial roja - Photo 1 & 2 reference)
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 256;
    tileCanvas.height = 256;
    const tctx = tileCanvas.getContext('2d');
    // Terracotta clay base
    tctx.fillStyle = '#b84d2f';
    tctx.fillRect(0, 0, 256, 256);
    // Spanish barrel tile fluting lines
    for (let y = 0; y < 256; y += 16) {
      tctx.fillStyle = (y % 32 === 0) ? '#8f381e' : '#ca5d3b';
      tctx.fillRect(0, y, 256, 3);
      tctx.fillStyle = 'rgba(0,0,0,0.18)';
      tctx.fillRect(0, y + 3, 256, 2);
    }
    for (let x = 0; x < 256; x += 32) {
      const grad = tctx.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.28)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.14)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.32)');
      tctx.fillStyle = grad;
      tctx.fillRect(x, 0, 32, 256);
    }
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = THREE.RepeatWrapping;
    tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(4, 4);

    this.materials.set('ROOF_CLAY_TILE', new THREE.MeshStandardMaterial({
      map: tileTex,
      bumpMap: tileTex,
      bumpScale: 0.06,
      color: 0xb54d30,
      roughness: 0.76,
      metalness: 0.04
    }));

    // 1C. Overhanging Dark Timber Eaves & Beams (Alero colonial de madera oscura)
    this.materials.set('ROOF_EAVES_TIMBER', new THREE.MeshStandardMaterial({
      color: 0x2e231a,
      roughness: 0.85,
      metalness: 0.05
    }));

    // 1D. Revit Window Family "HLF-VENTANA FACHADA BARANDAL" Materials (Photo 2 Reference)
    this.materials.set('REVIT_WIN_FRAME', new THREE.MeshStandardMaterial({
      color: 0x333e3b, // Dark green-slate Revit window frame RGB(58, 72, 68)
      roughness: 0.45,
      metalness: 0.25
    }));

    this.materials.set('REVIT_WIN_GLASS', new THREE.MeshPhysicalMaterial({
      color: 0x8daab3, // Architectural reflective glass RGB(170, 195, 200)
      roughness: 0.08,
      metalness: 0.85,
      transparent: true,
      opacity: 0.82,
      transmission: 0.35,
      ior: 1.52
    }));

    this.materials.set('REVIT_WIN_GLASS_LIT', new THREE.MeshStandardMaterial({
      color: 0xffecb8, // Warm cozy interior room glow visible through curtains
      roughness: 0.25,
      emissive: 0xffcd63,
      emissiveIntensity: 0.38
    }));

    this.materials.set('REVIT_WIN_RAILING', new THREE.MeshStandardMaterial({
      color: 0xe8ebe8, // Crisp white / light grey picket baluster bars RGB(214, 214, 208)
      roughness: 0.32,
      metalness: 0.15
    }));

    this.materials.set('REVIT_WIN_PLANTER', new THREE.MeshStandardMaterial({
      color: 0x585652, // Concrete cantilevered planter sill RGB(96, 94, 90)
      roughness: 0.88,
      metalness: 0.05
    }));

    const ivyTex = this.getTexture('./assets/textures/hlf_hiedra.png', 1.0, 1.0, true);
    this.materials.set('REVIT_WIN_IVY', new THREE.MeshStandardMaterial({
      map: ivyTex,
      transparent: true,
      alphaTest: 0.22,
      side: THREE.DoubleSide,
      color: 0x3d7028, // Lush vibrant green foliage
      roughness: 0.78,
      metalness: 0.0
    }));

    // 1B. Architectural Context Buildings (Umbra3D Studio signature frosted white look)
    this.materials.set('CONTEXT_ARCH', new THREE.MeshStandardMaterial({
      color: 0xe6ebf2,
      roughness: 0.32,
      metalness: 0.08,
      transparent: true,
      opacity: 0.78
    }));

    // 1C. Dark Architectural Context / Podium
    this.materials.set('CONTEXT_DARK', new THREE.MeshStandardMaterial({
      color: 0x363a42,
      roughness: 0.5,
      metalness: 0.2
    }));

    // 2. Exterior Ivy Greenery
    const ivyMap = this.getTexture('./assets/textures/hlf_hiedra.png', 0.5, 0.5, true);
    this.materials.set('IVY', new THREE.MeshStandardMaterial({
      map: ivyMap,
      bumpMap: ivyMap,
      bumpScale: 0.04,
      roughness: 0.86,
      metalness: 0.0
    }));

    // 3. REF 01 — Wood Vinyl Bedroom Floor (with real wood grain & bump)
    // ExtrudeGeometry uses meters as UVs, so repeat 0.65 = ~1.5m plank pattern
    const woodMap = this.getTexture('./assets/textures/hlf_piso_madera.png', 0.65, 0.65, true);
    const woodBump = this.getTexture('./assets/textures/hlf_ref01_veta_seamless.png', 0.65, 0.65, false);
    this.materials.set('REF01', new THREE.MeshStandardMaterial({
      map: woodMap,
      bumpMap: woodBump,
      bumpScale: 0.018,
      roughness: 0.48,
      metalness: 0.05
    }));

    // 4. REF 02 — Bathroom Mosaic Porcelain (Mos The Dream 30x30)
    const mosMap = this.getTexture('./assets/textures/hlf_mosaico2.png', 1.4, 1.4, true);
    this.materials.set('REF02', new THREE.MeshStandardMaterial({
      map: mosMap,
      bumpMap: mosMap,
      bumpScale: 0.012,
      roughness: 0.35,
      metalness: 0.08
    }));

    // 5. REF 28 / REF 09 — Santorini Bone / Grey Stone Porcelain
    const boneMap = this.getTexture('./assets/textures/hlf_piedra_bone.png', 0.8, 0.8, true);
    this.materials.set('REF28', new THREE.MeshStandardMaterial({
      map: boneMap,
      roughness: 0.42,
      metalness: 0.05
    }));

    const greyStoneMap = this.getTexture('./assets/textures/hlf_piedra_grey.png', 0.8, 0.8, true);
    this.materials.set('REF09', new THREE.MeshStandardMaterial({
      map: greyStoneMap,
      roughness: 0.45,
      metalness: 0.05
    }));

    // 6. Corridor Tweed Carpet & Marble Border
    const hallCarpetMap = this.getTexture('./assets/textures/hlf_alfombra_hall.jpg', 0.9, 0.9, true);
    this.materials.set('HALL_ALFOMBRA', new THREE.MeshStandardMaterial({
      map: hallCarpetMap,
      bumpMap: hallCarpetMap,
      bumpScale: 0.02,
      roughness: 0.9,
      metalness: 0.0
    }));

    const marbleLightMap = this.getTexture('./assets/textures/hlf_marmol.png', 0.7, 0.7, true);
    this.materials.set('HALL_MARMOL', new THREE.MeshStandardMaterial({
      map: marbleLightMap,
      roughness: 0.22,
      metalness: 0.1
    }));

    // 7. Antik Silver Blue Marble (Countertops & Niches)
    const marbleDarkMap = this.getTexture('./assets/textures/hlf_marmol3.png', 0.9, 0.9, true);
    this.materials.set('MARMOL', new THREE.MeshStandardMaterial({
      map: marbleDarkMap,
      roughness: 0.2,
      metalness: 0.12
    }));

    // 8. Sikuani Walnut Wood (Headboards, Doors, Closets, Consoles)
    const walnutMap = this.getTexture('./assets/textures/hlf_nogal4_v.png', 0.9, 0.9, true);
    this.materials.set('NOGAL', new THREE.MeshStandardMaterial({
      map: walnutMap,
      bumpMap: walnutMap,
      bumpScale: 0.01,
      roughness: 0.46,
      metalness: 0.06
    }));

    // 9. Wallpaper Tessera & Lismore + Paint "Sobre Las Nubes"
    const grassMap = this.getTexture('./assets/textures/hlf_grasscloth.png', 1.2, 1.2, true);
    this.materials.set('WALL_TESSERA', new THREE.MeshStandardMaterial({
      map: grassMap,
      bumpMap: grassMap,
      bumpScale: 0.012,
      roughness: 0.85,
      metalness: 0.0
    }));

    const oakWallMap = this.getTexture('./assets/textures/hlf_roble_claro_v.png', 1.0, 1.0, true);
    this.materials.set('WALL_LISMORE', new THREE.MeshStandardMaterial({
      map: oakWallMap,
      roughness: 0.75,
      metalness: 0.0
    }));

    this.materials.set('WALL_PAINT', new THREE.MeshStandardMaterial({
      color: 0xece5d8,
      roughness: 0.86,
      metalness: 0.0
    }));

    // Acabados interiores con texturas fotográficas reales (iguales a los renders de referencia)
    this.materials.set('REF01', this.realMaterial('piso_madera', 2.0, { roughness: 0.9, normalScale: 0.8 }));
    this.materials.set('NOGAL', this.realMaterial('sikuani', 1.0, { roughness: 0.85, normalScale: 0.6 }));
    this.materials.set('WALL_TESSERA', this.realMaterial('papel_tessera', 0.9, { roughness: 1, normalScale: 1.1, polygonOffset: true }));
    this.materials.set('WALL_LISMORE', this.realMaterial('roble_claro', 1.2, { roughness: 0.9, normalScale: 0.6, polygonOffset: true }));
    this.materials.set('WALL_PAINT', new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.92, metalness: 0 }));
    this.materials.set('CEILING_PAINT', this.realMaterial('cielo', 1.5, { roughness: 1, normalScale: 0.3 }));

    // 10. Rugs TA-01, TA-02, TA-04
    const ta01Map = this.getTexture('./assets/textures/hlf_tapete_ta01.png', 1.2, 1.2, true);
    this.materials.set('TA01', new THREE.MeshStandardMaterial({
      map: ta01Map,
      bumpMap: ta01Map,
      bumpScale: 0.02,
      roughness: 0.92
    }));

    const ta02Map = this.getTexture('./assets/textures/hlf_tapete_ta02.png', 1.0, 1.0, true);
    this.materials.set('TA02', new THREE.MeshStandardMaterial({
      map: ta02Map,
      bumpMap: ta02Map,
      bumpScale: 0.02,
      roughness: 0.92
    }));

    const ta04Map = this.getTexture('./assets/textures/hlf_tapete_ta04.png', 1.0, 1.0, true);
    this.materials.set('TA04', new THREE.MeshStandardMaterial({
      map: ta04Map,
      bumpMap: ta04Map,
      bumpScale: 0.02,
      roughness: 0.92
    }));

    // 11. Furniture Fabrics & Finishes
    const boucleMap = this.getTexture('./assets/textures/hlf_boucle_taupe.png', 2.0, 2.0, true);
    this.materials.set('TAPIZ', new THREE.MeshStandardMaterial({
      map: boucleMap,
      roughness: 0.88
    }));

    const olivaMap = this.getTexture('./assets/textures/hlf_tejido_oliva.png', 2.2, 2.2, true);
    this.materials.set('OLIVA', new THREE.MeshStandardMaterial({
      map: olivaMap,
      roughness: 0.88
    }));

    const avenaMap = this.getTexture('./assets/textures/hlf_tejido_avena.png', 2.2, 2.2, true);
    this.materials.set('AVENA', new THREE.MeshStandardMaterial({
      map: avenaMap,
      roughness: 0.88
    }));

    const terracotaMap = this.getTexture('./assets/textures/hlf_tejido_terracota.png', 2.2, 2.2, true);
    this.materials.set('TERRACOTA', new THREE.MeshStandardMaterial({
      map: terracotaMap,
      roughness: 0.88
    }));

    const quiltMap = this.getTexture('./assets/textures/hlf_quilt_oscuro.png', 1.6, 1.6, true);
    this.materials.set('QUILT', new THREE.MeshStandardMaterial({
      map: quiltMap,
      roughness: 0.78
    }));

    const linoMap = this.getTexture('./assets/textures/hlf_lino_cortina.png', 1.5, 1.5, true);
    this.materials.set('LINO', new THREE.MeshStandardMaterial({
      map: linoMap,
      roughness: 0.88
    }));

    this.materials.set('LENCERIA', new THREE.MeshStandardMaterial({
      color: 0xf6f4ee,
      roughness: 0.82
    }));

    // Acabados calibrados contra los renders de referencia (mismas texturas que los GLB de Revit):
    // telas taupe / avena / oliva / rosa-salmón, sábanas de trama fina, tapetes, alfombra de pasillo y piedra del baño.
    this.materials.set('TAPIZ', this.realMaterial('boucle_taupe', 0.45, { roughness: 1, normalScale: 1 }));
    this.materials.set('AVENA', this.realMaterial('tejido_avena', 0.45, { roughness: 1, normalScale: 1 }));
    this.materials.set('OLIVA', this.realMaterial('tejido_oliva', 0.45, { roughness: 1, normalScale: 1 }));
    this.materials.set('TERRACOTA', this.realMaterial('tejido_terracota', 0.45, { roughness: 1, normalScale: 1 }));
    this.materials.set('LENCERIA', this.realMaterial('cama_blanca', 0.9, { roughness: 1, normalScale: 0.12, color: 0xf6f1e8 }));
    this.materials.set('HALL_ALFOMBRA', this.realMaterial('alfombra_hall', 1.6, { roughness: 1, normalScale: 0.9 }));
    this.materials.set('TA01', this.realMaterial('tapete_lana', 0.4, { roughness: 1, normalScale: 0.9 }));
    this.materials.set('TA02', this.realMaterial('tapete_puntos', 0.55, { roughness: 1, normalScale: 0.9 }));
    this.materials.set('TA04', this.realMaterial('tapete_puntos', 0.55, { roughness: 1, normalScale: 0.9 }));
    this.materials.set('REF09', this.realMaterial('piedra_arena', 1.2, { roughness: 0.6, normalScale: 0.45 }));
    this.materials.set('REF28', this.realMaterial('piedra_arena', 1.2, { roughness: 0.6, normalScale: 0.45 }));

    this.materials.set('ACERO', new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.35,
      metalness: 0.8
    }));

    this.materials.set('ORO', new THREE.MeshStandardMaterial({
      color: 0xc59b4e,
      roughness: 0.28,
      metalness: 0.85
    }));

    this.materials.set('CROMO', new THREE.MeshStandardMaterial({
      color: 0xd8dce0,
      roughness: 0.15,
      metalness: 0.92
    }));

    this.materials.set('TV', new THREE.MeshStandardMaterial({
      color: 0x0d0f12,
      roughness: 0.12,
      metalness: 0.5
    }));

    this.materials.set('LED', new THREE.MeshStandardMaterial({
      color: 0xffecc4,
      emissive: 0xffd584,
      emissiveIntensity: 0.85,
      roughness: 0.2
    }));

    this.materials.set('VIDRIO', new THREE.MeshPhysicalMaterial({
      color: 0xdcf0f5,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.65
    }));

    this.materials.set('WINDOW_EXT', new THREE.MeshStandardMaterial({
      color: 0x162636,
      roughness: 0.12,
      metalness: 0.85,
      emissive: 0xffde9b,
      emissiveIntensity: 0.22
    }));

    this.materials.set('ROOF_SLATE', new THREE.MeshStandardMaterial({
      color: 0x2d3138,
      roughness: 0.72,
      metalness: 0.18
    }));

    // 12. Clean Architectural White Volume for Context Buildings (As requested: "mejor deja todos los volumenes blancos")
    this.materials.set('CONTEXT_WHITE', new THREE.MeshStandardMaterial({
      color: 0xf4f7fa,
      roughness: 0.3,
      metalness: 0.04,
      transparent: true,
      opacity: 0.92
    }));

    // 13. Photorealistic Botanical Trees matching Reference Image (Alpha-tested leafy clusters + ground shadows)
    try {
      const leafTexRoble = new THREE.CanvasTexture(this.createBotanicalLeafCanvas('roble'));
      const leafTexChicala = new THREE.CanvasTexture(this.createBotanicalLeafCanvas('chicala'));
      const leafTexUrapan = new THREE.CanvasTexture(this.createBotanicalLeafCanvas('urapan'));
      const leafTexFlower = new THREE.CanvasTexture(this.createBotanicalLeafCanvas('flower'));
      const leafTexAcacia = new THREE.CanvasTexture(this.createBotanicalLeafCanvas('acacia'));

      // Species A: Sabana Oak (Roble) - Deep rich emerald foliage
      this.materials.set('TREE_ROBLE', new THREE.MeshStandardMaterial({
        map: leafTexRoble,
        alphaTest: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.02
      }));

      // Species B: Chicalá - Fresh vibrant sunny green foliage
      this.materials.set('TREE_CHICALA', new THREE.MeshStandardMaterial({
        map: leafTexChicala,
        alphaTest: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.82,
        metalness: 0.02
      }));

      // Species C: Sauco / Urapán - Warm olive-sage upright foliage
      this.materials.set('TREE_SAUCO', new THREE.MeshStandardMaterial({
        map: leafTexUrapan,
        alphaTest: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.84,
        metalness: 0.02
      }));

      // Species D: Guayacán Amarillo en flor - Golden yellow floral bursts matching reference photo
      this.materials.set('TREE_FLOWER_YELLOW', new THREE.MeshStandardMaterial({
        map: leafTexFlower,
        alphaTest: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.02
      }));

      // Species E: Acacia / Árbol Joven - Light bright chartreuse foliage
      this.materials.set('TREE_ACACIA', new THREE.MeshStandardMaterial({
        map: leafTexAcacia,
        alphaTest: 0.18,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.82,
        metalness: 0.02
      }));

      // Soft circular contact shadow decal on the ground under each tree
      const shadowCanvas = this.createTreeShadowCanvas();
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      this.materials.set('TREE_SHADOW', new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      }));

      // Soft rectangular vehicle contact shadow on the road
      const carShadowCanvas = this.createCarShadowCanvas();
      const carShadowTex = new THREE.CanvasTexture(carShadowCanvas);
      this.materials.set('CAR_SHADOW', new THREE.MeshBasicMaterial({
        map: carShadowTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      }));
    } catch (e) {
      this.materials.set('TREE_ROBLE', new THREE.MeshStandardMaterial({ color: 0x2e5c26, roughness: 0.8 }));
      this.materials.set('TREE_CHICALA', new THREE.MeshStandardMaterial({ color: 0x569632, roughness: 0.8 }));
      this.materials.set('TREE_SAUCO', new THREE.MeshStandardMaterial({ color: 0x3d742e, roughness: 0.8 }));
      this.materials.set('TREE_FLOWER_YELLOW', new THREE.MeshStandardMaterial({ color: 0xdfa622, roughness: 0.8 }));
      this.materials.set('TREE_ACACIA', new THREE.MeshStandardMaterial({ color: 0x7ecf3c, roughness: 0.8 }));
      this.materials.set('TREE_SHADOW', new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 }));
      this.materials.set('CAR_SHADOW', new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5 }));
    }

    // 14. Bright Realistic Urban Materials (Matching Reference Image)
    this.materials.set('ROAD_ASPHALT', new THREE.MeshStandardMaterial({
      color: 0x3f444c,
      roughness: 0.82,
      metalness: 0.04
    }));

    this.materials.set('SIDEWALK_PAVING', new THREE.MeshStandardMaterial({
      color: 0xd2c5b2, // Warm architectural stone / sand tone
      roughness: 0.72,
      metalness: 0.02
    }));

    this.materials.set('BIKEWAY_BLUE', new THREE.MeshStandardMaterial({
      color: 0x1c78b8, // Vibrant blue ribbon matching reference image
      roughness: 0.65,
      metalness: 0.08
    }));

    this.materials.set('TURF_GRASS', new THREE.MeshStandardMaterial({
      color: 0x487e35, // Lush vibrant lawn
      roughness: 0.88,
      metalness: 0.0
    }));

    this.materials.set('PEDESTRIAN_PLAZA', new THREE.MeshStandardMaterial({
      color: 0xd9ccba,
      roughness: 0.76,
      metalness: 0.03
    }));
  }

  createBotanicalLeafCanvas(species = 'roble') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // 1. Transparent background so leaves have feathery alpha edges (NO SOLID SPHERES)
    ctx.clearRect(0, 0, 512, 512);

    let colors;
    if (species === 'flower') {
      // Golden yellow Guayacán blossoms with green leaf clusters
      colors = ['#f5bf26', '#edaf15', '#fcd644', '#df9f12', '#ffe066', '#4a8e2e', '#367020'];
    } else if (species === 'chicala') {
      // Fresh bright green foliage
      colors = ['#52a32c', '#67bf38', '#7ed647', '#3f8221', '#98e855', '#2c6116'];
    } else {
      // Rich deep emerald Sabana Oak
      colors = ['#234a1a', '#2e5e23', '#3d782e', '#4c9138', '#1a3a13', '#5ea844'];
    }

    // 2. Render dense sprays of botanical leaves across the canvas
    const center = 256;
    const sprays = 40;

    for (let s = 0; s < sprays; s++) {
      const sprayAngle = Math.random() * Math.PI * 2;
      const sprayDist = 20 + Math.random() * 190;
      const sx = center + Math.cos(sprayAngle) * sprayDist;
      const sy = center + Math.sin(sprayAngle) * sprayDist;
      const leafCount = 35 + Math.floor(Math.random() * 25);

      for (let i = 0; i < leafCount; i++) {
        const offsetDist = Math.random() * 45;
        const offsetAngle = Math.random() * Math.PI * 2;
        const lx = sx + Math.cos(offsetAngle) * offsetDist;
        const ly = sy + Math.sin(offsetAngle) * offsetDist;
        const leafLen = 10 + Math.random() * 14;
        const leafWidth = 5 + Math.random() * 7;
        const leafAngle = offsetAngle + (Math.random() - 0.5) * 0.8;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(leafAngle);

        // Pointed oval leaf shape
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        ctx.moveTo(0, -leafLen / 2);
        ctx.quadraticCurveTo(leafWidth / 2, 0, 0, leafLen / 2);
        ctx.quadraticCurveTo(-leafWidth / 2, 0, 0, -leafLen / 2);
        ctx.closePath();
        ctx.fill();

        // Dark delicate leaf vein
        ctx.strokeStyle = 'rgba(10, 25, 8, 0.4)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -leafLen / 2);
        ctx.lineTo(0, leafLen / 2);
        ctx.stroke();

        ctx.restore();
      }
    }

    return c;
  }

  createTreeShadowCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 126);
    grad.addColorStop(0, 'rgba(15, 20, 25, 0.75)');
    grad.addColorStop(0.5, 'rgba(20, 25, 30, 0.45)');
    grad.addColorStop(0.85, 'rgba(25, 30, 35, 0.15)');
    grad.addColorStop(1, 'rgba(30, 35, 40, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createCarShadowCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);

    // Soft rounded rectangular drop shadow for underbody ambient occlusion
    const grad = ctx.createRadialGradient(128, 64, 20, 128, 64, 110);
    grad.addColorStop(0, 'rgba(10, 14, 18, 0.85)');
    grad.addColorStop(0.5, 'rgba(12, 16, 20, 0.45)');
    grad.addColorStop(0.85, 'rgba(15, 20, 25, 0.12)');
    grad.addColorStop(1, 'rgba(20, 25, 30, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
    return c;
  }

  createGlassFacadeCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Dark structural background
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, 512, 512);

    const floorH = 128;
    const bayW = 128;

    for (let f = 0; f < 4; f++) {
      const y = f * floorH;

      // Floor slab spandrel
      ctx.fillStyle = '#262d38';
      ctx.fillRect(0, y, 512, 28);
      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(0, y + 26, 512, 2);

      // 4 bays per floor
      for (let b = 0; b < 4; b++) {
        const x = b * bayW;

        // Mullion frame
        ctx.fillStyle = '#0f1217';
        ctx.fillRect(x + 6, y + 32, bayW - 12, floorH - 36);

        // Glass pane gradient
        const grad = ctx.createLinearGradient(0, y + 34, 0, y + floorH - 6);
        const hasLight = (f * 7 + b * 13) % 5 === 0;
        if (hasLight) {
          grad.addColorStop(0, '#354558');
          grad.addColorStop(1, '#484032');
        } else {
          grad.addColorStop(0, '#24374c');
          grad.addColorStop(1, '#15212e');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x + 9, y + 35, bayW - 18, floorH - 42);

        // Vertical center mullion
        ctx.fillStyle = '#10141a';
        ctx.fillRect(x + bayW / 2 - 1, y + 35, 2, floorH - 42);
      }
    }
    return c;
  }

  createBrickFacadeCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Bogotá brick terracotta clay background
    ctx.fillStyle = '#8f3b2a';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle brick joint texture
    ctx.fillStyle = '#7a3123';
    for (let row = 0; row < 64; row++) {
      const ry = row * 8;
      ctx.fillRect(0, ry, 512, 1);
      const offset = (row % 2) * 12;
      for (let col = 0; col < 24; col++) {
        ctx.fillRect(col * 24 + offset, ry, 1, 8);
      }
    }

    const floorH = 128;
    const bayW = 128;

    for (let f = 0; f < 4; f++) {
      const y = f * floorH;

      // Concrete floor slab band
      ctx.fillStyle = '#d2cabc';
      ctx.fillRect(0, y, 512, 22);
      ctx.fillStyle = '#9b9285';
      ctx.fillRect(0, y + 20, 512, 2);

      // Windows
      for (let b = 0; b < 4; b++) {
        const x = b * bayW;

        // Window opening / lintel
        ctx.fillStyle = '#56241a';
        ctx.fillRect(x + 24, y + 32, 80, 82);

        // Glass pane
        ctx.fillStyle = '#182432';
        ctx.fillRect(x + 28, y + 36, 72, 74);

        // Sill
        ctx.fillStyle = '#d2cabc';
        ctx.fillRect(x + 22, y + 110, 84, 6);

        // Mullion cross
        ctx.fillStyle = '#111822';
        ctx.fillRect(x + 63, y + 36, 2, 74);
        ctx.fillRect(x + 28, y + 68, 72, 2);
      }
    }
    return c;
  }

  createStoneFacadeCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Architectural limestone / concrete
    ctx.fillStyle = '#d0cbc0';
    ctx.fillRect(0, 0, 512, 512);

    const floorH = 128;
    const bayW = 128;

    for (let f = 0; f < 4; f++) {
      const y = f * floorH;

      // Floor line
      ctx.fillStyle = '#b3aca0';
      ctx.fillRect(0, y, 512, 16);
      ctx.fillStyle = '#8f887c';
      ctx.fillRect(0, y + 15, 512, 2);

      // Punched windows
      for (let b = 0; b < 4; b++) {
        const x = b * bayW;
        ctx.fillStyle = '#22252a';
        ctx.fillRect(x + 26, y + 28, 76, 86);

        ctx.fillStyle = '#1e2d3d';
        ctx.fillRect(x + 30, y + 32, 68, 78);

        ctx.fillStyle = '#151c24';
        ctx.fillRect(x + 63, y + 32, 2, 78);
      }
    }
    return c;
  }

  get(key) {
    return this.materials.get(key) || this.materials.get('WALL_PAINT');
  }

  resolveFurnitureMaterial(matCode) {
    if (!matCode) return this.get('NOGAL');
    const c = matCode.toUpperCase();
    if (c.includes('OLIVA')) return this.get('OLIVA');
    if (c.includes('AVENA')) return this.get('AVENA');
    if (c.includes('TERRACOTA')) return this.get('TERRACOTA');
    if (c.includes('TAPIZ') || c.includes('BOUCLE')) return this.get('TAPIZ');
    if (c.includes('QUILT')) return this.get('QUILT');
    if (c.includes('LENCERIA') || c.includes('BLANC')) return this.get('LENCERIA');
    if (c.includes('MARMOL') || c.includes('PIEDRA')) return this.get('MARMOL');
    if (c.includes('ORO') || c.includes('LATON')) return this.get('ORO');
    if (c.includes('CROMO') || c.includes('INOX')) return this.get('CROMO');
    if (c.includes('ACERO') || c.includes('NEGRO')) return this.get('ACERO');
    if (c.includes('TV')) return this.get('TV');
    if (c.includes('LED') || c.includes('LAMPARA')) return this.get('LED');
    if (c.includes('LINO') || c.includes('CORTINA') || c.includes('VELO')) return this.get('LINO');
    if (c.includes('VIDRIO') || c.includes('ESPEJO')) return this.get('VIDRIO');
    return this.get('NOGAL');
  }
}
