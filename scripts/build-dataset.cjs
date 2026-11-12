const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\aleja\\.gemini\\antigravity\\scratch\\hotel-la-fontana-masterplan';
const HOTEL_DIR = 'c:\\Users\\aleja\\Videos\\Hotel';
const SCRIPTS_DIR = path.join(HOTEL_DIR, '04_MODELADO', '01_Revit', '_scripts');
const IMG_DIR = path.join(SCRIPTS_DIR, '_img');
const TEX_DIR = path.join(HOTEL_DIR, '04_MODELADO', '01_Revit', '_tex');
const AXOS_DIR = path.join(HOTEL_DIR, 'axos');
const CLAUDE_DIR = path.join(HOTEL_DIR, 'Claude outputs');

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  }
  console.warn('Missing:', src);
  return false;
}

// 1. Copy real PBR textures (lightweight & seamless)
const texturesToCopy = [
  'hlf_ladrillo.png',
  'hlf_ladrillo_bump.png',
  'hlf_hiedra.png',
  'hlf_piso_madera.png',
  'hlf_ref01_veta_seamless.png',
  'hlf_mosaico2.png',
  'hlf_alfombra_hall.jpg',
  'hlf_marmol.png',
  'hlf_marmol3.png',
  'hlf_nogal4_v.png',
  'hlf_roble_claro_v.png',
  'hlf_piedra_bone.png',
  'hlf_piedra_grey.png',
  'hlf_grasscloth.png',
  'hlf_boucle_taupe.png',
  'hlf_tejido_avena.png',
  'hlf_tejido_oliva.png',
  'hlf_tejido_terracota.png',
  'hlf_quilt_oscuro.png',
  'hlf_tapete_base.png',
  'hlf_tapete_ta01.png',
  'hlf_tapete_ta02.png',
  'hlf_tapete_ta04.png',
  'hlf_lino_cortina.png'
];

for (const tex of texturesToCopy) {
  copyIfExists(path.join(TEX_DIR, tex), path.join(ROOT, 'assets', 'textures', tex));
}

// 2. Copy Renders
const rendersMap = {
  'suite_d_alcoba.png': path.join(CLAUDE_DIR, 'SuiteD_render_camara_alcoba.png'),
  'suite_d_alcoba_estar.png': path.join(CLAUDE_DIR, 'SuiteD_render_camara_alcoba_estar.png'),
  'suite_d_sala.png': path.join(CLAUDE_DIR, 'SuiteD_render_camara_sala.png'),
  'suite_d_comedor.png': path.join(CLAUDE_DIR, 'SuiteD_render_camara_comedor.png'),
  'suite_d_closet_tv.png': path.join(CLAUDE_DIR, 'SuiteD_alcoba_closet_tv_v2.png'),
  'suite_d_cabecero.png': path.join(CLAUDE_DIR, 'SuiteD_alcoba_frontal_v2.png'),
  'suite_d_bano_meson.png': path.join(CLAUDE_DIR, 'SuiteD_bano_meson.png'),
  'suite_d_bano_nicho.png': path.join(CLAUDE_DIR, 'SuiteD_bano_nicho.png'),
  'doble_cabeceros.png': path.join(IMG_DIR, 'chk_camara_cabeceros - Vista 3D - HAB DOBLE - CAMARA CABECEROS.png'),
  'doble_ventana.png': path.join(IMG_DIR, 'chk_camara_ventana - Vista 3D - HAB DOBLE - CAMARA VENTANA.png'),
  'doble_bano.png': path.join(IMG_DIR, 'v2_camara_bano - Vista 3D - HAB DOBLE - CAMARA BANO.png'),
  'hall_corredor.png': path.join(IMG_DIR, 'chk_camara_corredor - Vista 3D - HALL - CAMARA CORREDOR.png'),
  'hall_puertas.png': path.join(IMG_DIR, 'v2_camara_puertas - Vista 3D - HALL - CAMARA PUERTAS.png'),
  'fachada_general.png': path.join(CLAUDE_DIR, 'Ventana_fachada_general.png'),
  'fachada_detalle.png': path.join(CLAUDE_DIR, 'Ventana_fachada_cerca.png')
};

for (const [destName, srcPath] of Object.entries(rendersMap)) {
  copyIfExists(srcPath, path.join(ROOT, 'assets', 'renders', destName));
}

// 3. Copy Axos (3D cutaways)
const axosMap = {
  'p2_ala_recta_3d.png': path.join(AXOS_DIR, 'P2_3D_ala_recta.png'),
  'p2_ala_diagonal_3d.png': path.join(AXOS_DIR, 'P2_3D_ala_diagonal.png'),
  'suite_d_3d_acabados.png': path.join(AXOS_DIR, 'SuiteD_3D_acabados.png'),
  'suite_d_3d_ne.png': path.join(CLAUDE_DIR, 'SuiteD_3D_mobiliario_NE.png'),
  'suite_d_3d_so.png': path.join(CLAUDE_DIR, 'SuiteD_3D_mobiliario_SO.png'),
  'suite_d_bano_ducha.png': path.join(AXOS_DIR, 'SuiteD_bano_mobiliario_ducha_wc.png'),
  'suite_d_bano_meson.png': path.join(AXOS_DIR, 'SuiteD_bano_mobiliario_meson.png'),
  'suite_c1_3d_acabados.png': path.join(AXOS_DIR, 'SuiteC1_3D_acabados.png'),
  'suite_c1_bano_3d.png': path.join(AXOS_DIR, 'SuiteC1_bano_3D.png'),
  'suite_c1_bano_ducha.png': path.join(AXOS_DIR, 'SuiteC1_bano_mobiliario_ducha.png'),
  'suite_c1_bano_meson.png': path.join(AXOS_DIR, 'SuiteC1_bano_mobiliario_meson.png'),
  'suite_fondo_a_43m2.png': path.join(CLAUDE_DIR, 'Suite_fondo_A_43m2.png'),
  'suite_fondo_b_43m2.png': path.join(CLAUDE_DIR, 'Suite_fondo_B_43m2.png'),
  'suite_fondo_c_26m2.png': path.join(CLAUDE_DIR, 'Suite_fondo_C_26m2.png'),
  'doble_3d_965191.png': path.join(IMG_DIR, 'dobles_fam - Vista 3D - CONTROL DOBLE 965191.png'),
  'doble_3d_965137.png': path.join(IMG_DIR, 'dobles_fam - Vista 3D - CONTROL DOBLE 965137.png'),
  'bano_doble_iso.png': path.join(IMG_DIR, 'iso2_bano - Vista 3D - VERIF BANO DOBLE.png'),
  'veta_pisos_general.png': path.join(IMG_DIR, 'veta_pisos6 - Vista 3D - VERIF VETA PISOS.png')
};

for (const [destName, srcPath] of Object.entries(axosMap)) {
  copyIfExists(srcPath, path.join(ROOT, 'assets', 'axos', destName));
}

// 4. Copy Plans & Sections
const plansMap = {
  'p2_planta_arquitectonica.png': path.join(IMG_DIR, 'rest - Plano de planta - PLANO ARQUITECTÓNICO.png'),
  'p2_planta_acotada.png': path.join(IMG_DIR, 'rest - Plano de planta - PLANO ARQUITECTONICO ACOTADO.png'),
  'p2_planta_acabados.png': path.join(CLAUDE_DIR, 'P2_planta_acabados.png'),
  'p2_planta_mobiliario.png': path.join(CLAUDE_DIR, 'P2_mobiliario_puertas.png'),
  'p2_planta_cielos.png': path.join(CLAUDE_DIR, 'P2_cielo_raso.png'),
  'suite_d_planta_mobiliario.png': path.join(CLAUDE_DIR, 'SuiteD_planta_mobiliario.png'),
  'suite_d_planta_pisos.png': path.join(AXOS_DIR, 'SuiteD_planta_pisos_enchapes.png'),
  'suite_d_planta_cielos.png': path.join(AXOS_DIR, 'SuiteD_planta_cielos.png'),
  'suite_d_seccion_a.png': path.join(AXOS_DIR, 'SuiteD_seccion_A.png'),
  'suite_d_seccion_b.png': path.join(AXOS_DIR, 'SuiteD_seccion_B.png'),
  'suite_d_seccion_c.png': path.join(AXOS_DIR, 'SuiteD_seccion_C.png'),
  'suite_d_seccion_d.png': path.join(AXOS_DIR, 'SuiteD_seccion_D.png'),
  'suite_c1_planta_pisos.png': path.join(AXOS_DIR, 'SuiteC1_planta_pisos_enchapes.png'),
  'suite_c1_planta_cielos.png': path.join(AXOS_DIR, 'SuiteC1_planta_cielos.png'),
  'suite_c1_seccion_a.png': path.join(AXOS_DIR, 'SuiteC1_seccion_A.png'),
  'suite_c1_seccion_b.png': path.join(AXOS_DIR, 'SuiteC1_seccion_B.png'),
  'suite_c1_seccion_c.png': path.join(AXOS_DIR, 'SuiteC1_seccion_C.png'),
  'suite_c1_seccion_d.png': path.join(AXOS_DIR, 'SuiteC1_seccion_D.png')
};

for (const [destName, srcPath] of Object.entries(plansMap)) {
  copyIfExists(srcPath, path.join(ROOT, 'assets', 'plans', destName));
}

// Helper: polygon area in m2 (coords in mm)
function polyAreaM2(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2 / 1e6;
}

function polyBounds(ring) {
  const xs = ring.map(p => p[0]);
  const ys = ring.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    minX, minY, maxX, maxY,
    centerX: Math.round((minX + maxX) / 2),
    centerY: Math.round((minY + maxY) / 2),
    widthMm: Math.round(maxX - minX),
    depthMm: Math.round(maxY - minY)
  };
}

// Load source Revit dumps
const roomsDump = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_rooms_dump.json'), 'utf8'));
const pisosHab = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'p2_pisos_hab_v2.json'), 'utf8'));
const suitesDump = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_suites_dump.json'), 'utf8'));
const wallsNow = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'p2_walls_now.json'), 'utf8'));
const hallDump = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_hall_dump.json'), 'utf8'));
const hallCielos = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_hall_cielos.json'), 'utf8'));
const enchapesTapetes = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'p2_enchapes_tapetes.json'), 'utf8'));
const sdAcabados = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_sd_acabados_v2.json'), 'utf8'));
const c1Acabados = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_c1_acabados.json'), 'utf8'));
const especs = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_especificaciones.json'), 'utf8'));

const mobSD = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_sd_mobiliario_v5.json'), 'utf8'));
const mobSuites = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_suites_mobiliario.json'), 'utf8'));
const mobDobles = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_dobles_mobiliario_v2.json'), 'utf8'));
const mobSencillas = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'hlf_sencillas_mobiliario.json'), 'utf8'));

// Bathroom rings lookup from pisosHab (REF02)
const bathById = {};
for (const p of pisosHab) {
  bathById[p.id] = p;
}

// Build structured 12 rooms of Piso 2 (Habitación 214 to 225)
const roomConfigs = [
  {
    id: 'HAB-214',
    number: '214',
    code: 'HLF-P2-214',
    title: 'Habitación 214 · Suite D',
    subtitle: 'Ala Recta Norte / Esquinera Occidental',
    wing: 'Ala Recta Norte',
    typology: 'Suite D',
    category: 'Suite Ejecutiva',
    floor: 2,
    revitFloorId: '693045',
    bathLoops: sdAcabados.floors.REF02 ? sdAcabados.floors.REF02.map(r => r[0]) : [],
    locationType: 'Esquinera Occidental · Vista Jardines Calle 124',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (2000×2000 mm) + Sala Curva + Comedor 4 Puestos',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (Veta hacia ventana)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30 Blanco + REF 28 Santorini Bone',
      walls: 'REF 03 Papel Colgadura Tessera Vescom + REF 04 Panel Melamínico Sikuani',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Circular Tejido + TA-04 Sala Curva'
    },
    sheetNumber: 'A01 / INT-605A@605C',
    gallery: [
      { title: 'Render Alcoba Principal', src: './assets/renders/suite_d_alcoba.png', type: 'Render' },
      { title: 'Render Alcoba y Estar', src: './assets/renders/suite_d_alcoba_estar.png', type: 'Render' },
      { title: 'Render Sala Curva', src: './assets/renders/suite_d_sala.png', type: 'Render' },
      { title: 'Render Comedor', src: './assets/renders/suite_d_comedor.png', type: 'Render' },
      { title: 'Render Clóset y Panel TV', src: './assets/renders/suite_d_closet_tv.png', type: 'Render' },
      { title: 'Render Baño Mesón Mármol', src: './assets/renders/suite_d_bano_meson.png', type: 'Render' },
      { title: 'Render Baño Nicho Iluminado', src: './assets/renders/suite_d_bano_nicho.png', type: 'Render' },
      { title: 'Axonométrico 3D Acabados', src: './assets/axos/suite_d_3d_acabados.png', type: 'Axonométrico' },
      { title: 'Axonométrico 3D Mobiliario NE', src: './assets/axos/suite_d_3d_ne.png', type: 'Axonométrico' },
      { title: 'Planta de Mobiliario', src: './assets/plans/suite_d_planta_mobiliario.png', type: 'Plano' },
      { title: 'Planta de Pisos y Enchapes', src: './assets/plans/suite_d_planta_pisos.png', type: 'Plano' },
      { title: 'Sección A-A\'', src: './assets/plans/suite_d_seccion_a.png', type: 'Sección' }
    ]
  },
  {
    id: 'HAB-215',
    number: '215',
    code: 'HLF-P2-215',
    title: 'Habitación 215 · Doble Twin',
    subtitle: 'Ala Recta Norte / Fachada Norte',
    wing: 'Ala Recta Norte',
    typology: 'Doble',
    category: 'Habitación Doble',
    floor: 2,
    revitFloorId: '965137',
    bathLoops: bathById[24] ? [bathById[24].ring] : [],
    extraLoops: bathById[38] ? [bathById[38].ring] : [],
    locationType: 'Medianera Norte · Vista Calle 124',
    reducedMobility: 'NO',
    bedConfig: '2 Camas Dobles (1600×2000 mm) + Poltrona + Escritorio',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Melamina Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular'
    },
    sheetNumber: 'A02',
    gallery: [
      { title: 'Render Cabeceros Doble', src: './assets/renders/doble_cabeceros.png', type: 'Render' },
      { title: 'Render Ventana y Poltrona', src: './assets/renders/doble_ventana.png', type: 'Render' },
      { title: 'Render Baño Renovado', src: './assets/renders/doble_bano.png', type: 'Render' },
      { title: 'Axonométrico Control 3D (965137)', src: './assets/axos/doble_3d_965137.png', type: 'Axonométrico' },
      { title: 'Axonométrico Ala Recta 3D', src: './assets/axos/p2_ala_recta_3d.png', type: 'Axonométrico' },
      { title: 'Isométrico Baño Tipo', src: './assets/axos/bano_doble_iso.png', type: 'Axonométrico' }
    ]
  },
  {
    id: 'HAB-216',
    number: '216',
    code: 'HLF-P2-216',
    title: 'Habitación 216 · Sencilla King',
    subtitle: 'Ala Recta Norte / Fachada Norte',
    wing: 'Ala Recta Norte',
    typology: 'Sencilla',
    category: 'Habitación Sencilla King',
    floor: 2,
    revitFloorId: '965222',
    bathLoops: bathById[27] ? [bathById[27].ring] : [],
    extraLoops: bathById[41] ? [bathById[41].ring] : [],
    locationType: 'Medianera Norte · Vista Calle 124',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (1800×2000 mm) + Sofá / Poltrona + Consola TV',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular'
    },
    sheetNumber: 'A03',
    gallery: [
      { title: 'Axonométrico Ala Recta 3D', src: './assets/axos/p2_ala_recta_3d.png', type: 'Axonométrico' },
      { title: 'Render Ventana y Estar', src: './assets/renders/doble_ventana.png', type: 'Render' },
      { title: 'Render Baño Tipo', src: './assets/renders/doble_bano.png', type: 'Render' },
      { title: 'Planta Acotada Piso 2', src: './assets/plans/p2_planta_acotada.png', type: 'Plano' }
    ]
  },
  {
    id: 'HAB-217',
    number: '217',
    code: 'HLF-P2-217',
    title: 'Habitación 217 · Doble Twin',
    subtitle: 'Ala Recta Norte / Fachada Norte',
    wing: 'Ala Recta Norte',
    typology: 'Doble',
    category: 'Habitación Doble',
    floor: 2,
    revitFloorId: '965111',
    bathLoops: bathById[25] ? [bathById[25].ring] : [],
    extraLoops: bathById[37] ? [bathById[37].ring] : [],
    locationType: 'Medianera Norte · Vista Calle 124',
    reducedMobility: 'NO',
    bedConfig: '2 Camas Dobles (1600×2000 mm) + Poltrona + Consola TV',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular'
    },
    sheetNumber: 'A04',
    gallery: [
      { title: 'Render Cabeceros Doble', src: './assets/renders/doble_cabeceros.png', type: 'Render' },
      { title: 'Render Ventana Fachada', src: './assets/renders/doble_ventana.png', type: 'Render' },
      { title: 'Axonométrico Ala Recta 3D', src: './assets/axos/p2_ala_recta_3d.png', type: 'Axonométrico' },
      { title: 'Isométrico Baño Tipo', src: './assets/axos/bano_doble_iso.png', type: 'Axonométrico' }
    ]
  },
  {
    id: 'HAB-218',
    number: '218',
    code: 'HLF-P2-218',
    title: 'Habitación 218 · Sencilla King',
    subtitle: 'Ala Recta Norte / Remate Oriental',
    wing: 'Ala Recta Norte',
    typology: 'Sencilla',
    category: 'Habitación Sencilla King',
    floor: 2,
    revitFloorId: '965163',
    bathLoops: bathById[26] ? [bathById[26].ring] : [],
    extraLoops: bathById[36] ? [bathById[36].ring] : [],
    locationType: 'Esquinera Interior Norte · Vista Jardín Central',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (1800×2000 mm) + 2 Mesas de Noche + Poltrona',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular'
    },
    sheetNumber: 'A05',
    gallery: [
      { title: 'Axonométrico Ala Recta 3D', src: './assets/axos/p2_ala_recta_3d.png', type: 'Axonométrico' },
      { title: 'Render Ventana y Estar', src: './assets/renders/doble_ventana.png', type: 'Render' },
      { title: 'Render Baño Renovado', src: './assets/renders/doble_bano.png', type: 'Render' },
      { title: 'Planta de Acabados Piso 2', src: './assets/plans/p2_planta_acabados.png', type: 'Plano' }
    ]
  },
  {
    id: 'HAB-219',
    number: '219',
    code: 'HLF-P2-219',
    title: 'Habitación 219 · Doble Diagonal',
    subtitle: 'Ala Diagonal / Sector Nororiente',
    wing: 'Ala Diagonal',
    typology: 'Doble',
    category: 'Habitación Doble',
    floor: 2,
    revitFloorId: '965191',
    bathLoops: bathById[31] ? [bathById[31].ring] : [],
    extraLoops: bathById[35] ? [bathById[35].ring] : [],
    locationType: 'Ala Diagonal · Vista Plazoleta & Jardín Interior',
    reducedMobility: 'NO',
    bedConfig: '2 Camas Dobles (1600×2000 mm) + Poltrona Club Chair + Consola',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (Veta 45° hacia ventana)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular'
    },
    sheetNumber: 'A06',
    gallery: [
      { title: 'Axonométrico Control Doble (965191)', src: './assets/axos/doble_3d_965191.png', type: 'Axonométrico' },
      { title: 'Axonométrico Ala Diagonal 3D', src: './assets/axos/p2_ala_diagonal_3d.png', type: 'Axonométrico' },
      { title: 'Render Cabeceros Doble', src: './assets/renders/doble_cabeceros.png', type: 'Render' },
      { title: 'Render Baño Renovado', src: './assets/renders/doble_bano.png', type: 'Render' }
    ]
  },
  {
    id: 'HAB-220',
    number: '220',
    code: 'HLF-P2-220',
    title: 'Habitación 220 · Sencilla King Diagonal',
    subtitle: 'Ala Diagonal / Centro',
    wing: 'Ala Diagonal',
    typology: 'Sencilla',
    category: 'Habitación Sencilla King',
    floor: 2,
    revitFloorId: '965017',
    bathLoops: bathById[30] ? [bathById[30].ring] : [],
    locationType: 'Ala Diagonal Central · Vista Jardín Interior',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (1800×2000 mm) + Poltrona Club Chair + Escritorio',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (Veta 45°)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular (3.80 m²)'
    },
    sheetNumber: 'A07',
    gallery: [
      { title: 'Axonométrico Ala Diagonal 3D', src: './assets/axos/p2_ala_diagonal_3d.png', type: 'Axonométrico' },
      { title: 'Render Ventana Fachada', src: './assets/renders/fachada_detalle.png', type: 'Render' },
      { title: 'Render Corredor y Portales', src: './assets/renders/hall_corredor.png', type: 'Render' },
      { title: 'Planta de Mobiliario Piso 2', src: './assets/plans/p2_planta_mobiliario.png', type: 'Plano' }
    ]
  },
  {
    id: 'HAB-221',
    number: '221',
    code: 'HLF-P2-221',
    title: 'Habitación 221 · Doble Diagonal Sur',
    subtitle: 'Ala Diagonal / Sector Suroriente',
    wing: 'Ala Diagonal',
    typology: 'Doble',
    category: 'Habitación Doble',
    floor: 2,
    revitFloorId: '965064',
    bathLoops: bathById[29] ? [bathById[29].ring] : [],
    extraLoops: bathById[39] ? [bathById[39].ring] : [],
    locationType: 'Ala Diagonal Sur · Vista Jardín Interior',
    reducedMobility: 'NO',
    bedConfig: '2 Camas Dobles (1600×2000 mm) + Poltrona Club Chair + Tapete TA-02',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (Veta 45°)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-02 Tapete Rectangular (8.74 m²) + TA-01'
    },
    sheetNumber: 'A08',
    gallery: [
      { title: 'Axonométrico Ala Diagonal 3D', src: './assets/axos/p2_ala_diagonal_3d.png', type: 'Axonométrico' },
      { title: 'Render Cabeceros Doble', src: './assets/renders/doble_cabeceros.png', type: 'Render' },
      { title: 'Render Baño Tipo', src: './assets/renders/doble_bano.png', type: 'Render' },
      { title: 'Verificación Veta de Pisos 3D', src: './assets/axos/veta_pisos_general.png', type: 'Axonométrico' }
    ]
  },
  {
    id: 'HAB-222',
    number: '222',
    code: 'HLF-P2-222',
    title: 'Habitación 222 · Suite Fondo A',
    subtitle: 'Sector Fondo / Esquinera Oriental',
    wing: 'Sector Suites Fondo',
    typology: 'Suite Fondo A',
    category: 'Suite Ejecutiva',
    floor: 2,
    revitFloorId: '964810',
    bathLoops: [bathById[23]?.ring, bathById[32]?.ring].filter(Boolean),
    extraLoops: [bathById[44]?.ring, bathById[45]?.ring].filter(Boolean),
    locationType: 'Esquinera Oriental · Doble Fachada con 3 Ventanas',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (2000×2000 mm) + Sala Independiente + Comedor + Doble Zona Húmeda',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (43.59 m²)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30 (7.26 m²)',
      walls: 'REF 03 Papel Colgadura Tessera + Enchape E-4 Pintura Sobre Las Nubes',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 + TA-02 Sala y Alcoba'
    },
    sheetNumber: 'A09',
    gallery: [
      { title: 'Axonométrico Control Suite A (43.6 m²)', src: './assets/axos/suite_fondo_a_43m2.png', type: 'Axonométrico' },
      { title: 'Render Sala Ejecutiva', src: './assets/renders/suite_d_sala.png', type: 'Render' },
      { title: 'Render Comedor Suite', src: './assets/renders/suite_d_comedor.png', type: 'Render' },
      { title: 'Planta General Acotada Piso 2', src: './assets/plans/p2_planta_acotada.png', type: 'Plano' }
    ]
  },
  {
    id: 'HAB-223',
    number: '223',
    code: 'HLF-P2-223',
    title: 'Habitación 223 · Junior Suite C',
    subtitle: 'Sector Fondo / Interior Occidental',
    wing: 'Sector Suites Fondo',
    typology: 'Junior Suite C',
    category: 'Junior Suite',
    floor: 2,
    revitFloorId: '964886',
    bathLoops: bathById[28] ? [bathById[28].ring] : [],
    locationType: 'Fachada Occidental · 2 Ventanas hacia Jardín',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (1800×2000 mm) + Zona de Estar Circular + Escritorio',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (26.29 m²)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30 (3.57 m²) + REF 28 Santorini Bone',
      walls: 'REF 03 Papel Colgadura Tessera + Enchape E-1 / E-4',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-01 Tapete Circular (2.39 m²)'
    },
    sheetNumber: 'A10',
    gallery: [
      { title: 'Axonométrico Control Suite C (26.3 m²)', src: './assets/axos/suite_fondo_c_26m2.png', type: 'Axonométrico' },
      { title: 'Render Alcoba y Estar', src: './assets/renders/suite_d_alcoba_estar.png', type: 'Render' },
      { title: 'Planta de Acabados Piso 2', src: './assets/plans/p2_planta_acabados.png', type: 'Plano' }
    ]
  },
  {
    id: 'HAB-224',
    number: '224',
    code: 'HLF-P2-224',
    title: 'Habitación 224 · Suite C1 (Mock-Up)',
    subtitle: 'Sector Fondo / Esquinera Suroccidental',
    wing: 'Sector Suites Fondo',
    typology: 'Suite C1',
    category: 'Suite Ejecutiva',
    floor: 2,
    revitFloorId: '692786',
    bathLoops: [
      suitesDump.floors['692779']?.loops?.[0],
      suitesDump.floors['692805']?.loops?.[0]
    ].filter(Boolean),
    locationType: 'Esquinera Suroccidental · 8 Ventanas Panorámicas',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (2000×2000 mm) + Sala Esquinera + Comedor + Baño Mock-Up INT-618',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (43.50 m²)',
      floorBath: 'REF 02 · Mos The Dream 30×30 (3.30 m²) + REF 28 Santorini Bone (1.62 m²)',
      walls: 'REF 03 Tessera + REF 04 Panel Melamínico Sikuani + REF 07 Lismore Vescom',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue + División Vidrio Templado 10mm',
      rugs: 'TA-01 + TA-02'
    },
    sheetNumber: 'INT-608A@608C / INT-618',
    gallery: [
      { title: 'Axonométrico Suite C1 Acabados', src: './assets/axos/suite_c1_3d_acabados.png', type: 'Axonométrico' },
      { title: 'Axonométrico Control Suite B/C1 (43.5 m²)', src: './assets/axos/suite_fondo_b_43m2.png', type: 'Axonométrico' },
      { title: 'Axonométrico 3D Baño Suite C1', src: './assets/axos/suite_c1_bano_3d.png', type: 'Axonométrico' },
      { title: 'Detalle Mobiliario Ducha Suite C1', src: './assets/axos/suite_c1_bano_ducha.png', type: 'Axonométrico' },
      { title: 'Detalle Mesón Baño Suite C1', src: './assets/axos/suite_c1_bano_meson.png', type: 'Axonométrico' },
      { title: 'Planta de Pisos y Enchapes Suite C1', src: './assets/plans/suite_c1_planta_pisos.png', type: 'Plano' },
      { title: 'Planta de Cielo Raso Suite C1', src: './assets/plans/suite_c1_planta_cielos.png', type: 'Plano' },
      { title: 'Sección A-A\' Suite C1', src: './assets/plans/suite_c1_seccion_a.png', type: 'Sección' },
      { title: 'Sección B-B\' Suite C1', src: './assets/plans/suite_c1_seccion_b.png', type: 'Sección' }
    ]
  },
  {
    id: 'HAB-225',
    number: '225',
    code: 'HLF-P2-225',
    title: 'Habitación 225 · Sencilla Especial Sur',
    subtitle: 'Sector Fondo / Fachada Sur',
    wing: 'Sector Suites Fondo',
    typology: 'Sencilla Especial',
    category: 'Habitación Sencilla King',
    floor: 2,
    revitFloorId: '964953',
    bathLoops: bathById[20] ? [bathById[20].ring] : [],
    locationType: 'Fachada Sur · 2 Ventanas con Estar',
    reducedMobility: 'NO',
    bedConfig: '1 Cama King (1800×2000 mm) + 2 Mesas de Noche + Poltrona Club Chair + Tapete TA-02',
    status: 'Disponible',
    finishes: {
      floorMain: 'REF 01 · Piso Vinílico Madera 5mm (24.53 m²)',
      floorBath: 'REF 02 · Porcelanato Mos The Dream 30×30 (5.03 m²)',
      walls: 'REF 03 Papel Colgadura Tessera + Cabecero Sikuani REF 08 + Enchape E-5/E-6',
      countertop: 'REF 14 · Mesón Mármol Antik Silver Blue',
      rugs: 'TA-02 Tapete Rectangular (4.95 m²)'
    },
    sheetNumber: 'A11',
    gallery: [
      { title: 'Render Alcoba King', src: './assets/renders/suite_d_cabecero.png', type: 'Render' },
      { title: 'Render Ventana Fachada', src: './assets/renders/fachada_general.png', type: 'Render' },
      { title: 'Render Baño Renovado', src: './assets/renders/doble_bano.png', type: 'Render' },
      { title: 'Planta General Arquitectónica Piso 2', src: './assets/plans/p2_planta_arquitectonica.png', type: 'Plano' }
    ]
  }
];

const roomsOutput = roomConfigs.map(cfg => {
  const dump = roomsDump[cfg.revitFloorId];
  const mainLoop = dump.loops[0];
  const mainArea = polyAreaM2(mainLoop);
  const bathArea = (cfg.bathLoops || []).reduce((acc, l) => acc + polyAreaM2(l), 0);
  const extraArea = (cfg.extraLoops || []).reduce((acc, l) => acc + polyAreaM2(l), 0);
  const privateArea = +(mainArea + bathArea + extraArea).toFixed(2);
  const builtArea = +(privateArea * 1.14).toFixed(2);
  const bounds = polyBounds([
    ...mainLoop,
    ...(cfg.bathLoops || []).flat(),
    ...(cfg.extraLoops || []).flat()
  ]);

  return {
    ...cfg,
    mainLoop,
    areaMainM2: +mainArea.toFixed(2),
    areaBathM2: +bathArea.toFixed(2),
    areaPrivateM2: privateArea,
    areaBuiltM2: builtArea,
    bounds,
    windows: dump.wins || [],
    revitFurnitureSummary: dump.furn || []
  };
});

// Project Config
const projectConfig = {
  projectId: 'HLF-BOG-2026',
  name: 'Hotel Estelar La Fontana',
  subtitle: 'Masterplan Interactivo · Remodelación Piso 2 & Contexto Urbano',
  location: {
    city: 'Bogotá D.C., Colombia',
    locality: 'Usaquén · Santa Bárbara / Unicentro',
    address: 'Avenida Calle 127 # 15A-10 (Costado Calle 124 con Carrera 15)',
    lat: 4.704585254832645,
    lng: -74.04369633465852,
    elevationM: 2552.1
  },
  revitSource: {
    document: 'Hotel_la_fontana_contexto.rvt',
    revitVersion: '2026 (Build 26.5.0.55)',
    elementCount: 48296,
    piso2ElevationMm: 3000.0,
    floorToFloorMm: 3000.0
  },
  wings: [
    'Ala Recta Norte',
    'Ala Diagonal',
    'Sector Suites Fondo'
  ],
  typologies: [
    'Suite D',
    'Suite C1',
    'Suite Fondo A',
    'Junior Suite C',
    'Doble',
    'Sencilla',
    'Sencilla Especial'
  ]
};

fs.writeFileSync(path.join(ROOT, 'data', 'project-config.json'), JSON.stringify(projectConfig, null, 2));
fs.writeFileSync(path.join(ROOT, 'data', 'rooms-piso2.json'), JSON.stringify(roomsOutput, null, 2));

// Architecture geometry (walls, corridor, slabs, stairs, columns)
const architectureData = {
  slabLoops: hallDump.floors,
  corridorCarpetLoop: suitesDump.floors['1153461']?.loops || [],
  corridorMarbleBorderLoops: suitesDump.floors['1153565']?.loops || [],
  stairs: hallDump.stairs,
  columns: wallsNow.cols || hallDump.columns || [],
  walls: wallsNow.walls,
  ceilings: hallCielos
};
fs.writeFileSync(path.join(ROOT, 'data', 'geometry', 'p2-architecture.json'), JSON.stringify(architectureData));

// Finishes geometry (floors, rugs, wall cladding segments)
const finishesData = {
  roomFloors: pisosHab,
  suiteFloors: suitesDump.floors,
  suiteD: sdAcabados,
  suiteC1: c1Acabados,
  wallCladdingSegments: enchapesTapetes.segs,
  rugs: enchapesTapetes.rugs
};
fs.writeFileSync(path.join(ROOT, 'data', 'geometry', 'p2-finishes.json'), JSON.stringify(finishesData));

// Furniture 3D primitives combined
const furnitureData = {
  suiteD: mobSD.items,
  suitesFondo: mobSuites.items,
  dobles: mobDobles.items,
  sencillas: mobSencillas.items,
  tagsSuiteD: mobSD.tags || []
};
fs.writeFileSync(path.join(ROOT, 'data', 'geometry', 'p2-furniture.json'), JSON.stringify(furnitureData));

// Technical specifications & PBR Material Map
const materialsSpecs = {
  especificaciones: especs,
  pbrCatalog: {
    'REF01': { name: 'HLF-REF 01 PISO VINILICO MADERA 5mm', texture: './assets/textures/hlf_piso_madera.png', bump: './assets/textures/hlf_ref01_veta_seamless.png', scaleMm: 1800, color: '#966442', roughness: 0.62, metalness: 0.05 },
    'REF02': { name: 'HLF-REF 02 PORCELANATO MOS THE DREAM 30x30 BLANCO', texture: './assets/textures/hlf_mosaico2.png', scaleMm: 700, color: '#d6c8ac', roughness: 0.55, metalness: 0.05 },
    'REF03': { name: 'HLF-REF 03 PAPEL COLGADURA TESSERA 1071.27 VESCOM', texture: './assets/textures/hlf_grasscloth.png', scaleMm: 600, color: '#c8b696', roughness: 0.88, metalness: 0.0 },
    'REF04': { name: 'HLF-REF 04 PANEL MELAMINICO SIKUANI PRIMADERA', texture: './assets/textures/hlf_nogal4_v.png', scaleMm: 1000, color: '#60422c', roughness: 0.58, metalness: 0.05 },
    'REF06': { name: 'HLF-REF 06 PINTURA SOBRE LAS NUBES TR136-P PINTUCO', texture: null, scaleMm: 0, color: '#ece5d8', roughness: 0.9, metalness: 0.0 },
    'REF07': { name: 'HLF-REF 07 PAPEL COLGADURA LISMORE 1097.28 VESCOM', texture: './assets/textures/hlf_roble_claro_v.png', scaleMm: 900, color: '#d2b892', roughness: 0.8, metalness: 0.0 },
    'REF08': { name: 'HLF-REF 08 CABECERO MELAMINA SIKUANI', texture: './assets/textures/hlf_nogal4_v.png', scaleMm: 1000, color: '#60422c', roughness: 0.55, metalness: 0.05 },
    'REF09': { name: 'HLF-REF 09 PORCELANATO SANTORINI GREY 120x120', texture: './assets/textures/hlf_piedra_grey.png', scaleMm: 1200, color: '#cec2aa', roughness: 0.72, metalness: 0.05 },
    'REF10': { name: 'HLF-REF 10/14 MARMOL ANTIK SILVER BLUE', texture: './assets/textures/hlf_marmol3.png', scaleMm: 900, color: '#8a7866', roughness: 0.25, metalness: 0.1 },
    'REF28': { name: 'HLF-REF 28 PORCELANATO SANTORINI BONE 120x60', texture: './assets/textures/hlf_piedra_bone.png', scaleMm: 1200, color: '#d4c6aa', roughness: 0.72, metalness: 0.05 },
    'HALL_ALFOMBRA': { name: 'HLF-PISO HALL ALFOMBRA TWEED 10mm', texture: './assets/textures/hlf_alfombra_hall.jpg', scaleMm: 1200, color: '#58524c', roughness: 0.92, metalness: 0.0 },
    'HALL_MARMOL': { name: 'HLF-PISO HALL BORDE MARMOL 20mm', texture: './assets/textures/hlf_marmol.png', scaleMm: 1000, color: '#d8d0c2', roughness: 0.28, metalness: 0.08 },
    'LADRILLO': { name: 'HLF-FACHADA LADRILLO A LA VISTA BOGOTA', texture: './assets/textures/hlf_ladrillo.png', bump: './assets/textures/hlf_ladrillo_bump.png', scaleMm: 1200, color: '#9c4f36', roughness: 0.82, metalness: 0.02 },
    'HIEDRA': { name: 'HLF-VEGETACION FACHADA HIEDRA', texture: './assets/textures/hlf_hiedra.png', scaleMm: 900, color: '#3b5e34', roughness: 0.85, metalness: 0.0 },
    'NOGAL': { name: 'HLF-MOB MELAMINA SIKUANI NOGAL', texture: './assets/textures/hlf_nogal4_v.png', scaleMm: 1000, color: '#60422c', roughness: 0.52, metalness: 0.05 },
    'TAPIZ': { name: 'HLF-MOB TAPIZ TRAILBLAZER 32 MARBLE', texture: './assets/textures/hlf_boucle_taupe.png', scaleMm: 300, color: '#967a62', roughness: 0.88, metalness: 0.0 },
    'AVENA': { name: 'HLF-MOB TEJIDO AVENA', texture: './assets/textures/hlf_tejido_avena.png', scaleMm: 300, color: '#c0b6a6', roughness: 0.88, metalness: 0.0 },
    'OLIVA': { name: 'HLF-MOB TEJIDO OLIVA', texture: './assets/textures/hlf_tejido_oliva.png', scaleMm: 250, color: '#706c42', roughness: 0.88, metalness: 0.0 },
    'TERRACOTA': { name: 'HLF-MOB TEJIDO TERRACOTA', texture: './assets/textures/hlf_tejido_terracota.png', scaleMm: 250, color: '#d48a70', roughness: 0.88, metalness: 0.0 },
    'QUILT': { name: 'HLF-MOB QUILT OSCURO', texture: './assets/textures/hlf_quilt_oscuro.png', scaleMm: 400, color: '#3e3026', roughness: 0.75, metalness: 0.05 },
    'MARMOL': { name: 'HLF-MOB MARMOL ANTIK SILVER', texture: './assets/textures/hlf_marmol3.png', scaleMm: 900, color: '#887868', roughness: 0.25, metalness: 0.1 },
    'PIEDRA': { name: 'HLF-MOB PIEDRA SINTERIZADA ALTEA PHANTOM DARK', texture: './assets/textures/hlf_marmol.png', scaleMm: 900, color: '#5a5654', roughness: 0.35, metalness: 0.1 },
    'TA01': { name: 'HLF-TAPETE TA-01', texture: './assets/textures/hlf_tapete_ta01.png', scaleMm: 600, color: '#e2d0b0', roughness: 0.92, metalness: 0.0 },
    'TA02': { name: 'HLF-TAPETE TA-02', texture: './assets/textures/hlf_tapete_ta02.png', scaleMm: 600, color: '#b9a076', roughness: 0.92, metalness: 0.0 },
    'TA04': { name: 'HLF-TAPETE TA-04', texture: './assets/textures/hlf_tapete_ta04.png', scaleMm: 600, color: '#8c9298', roughness: 0.92, metalness: 0.0 }
  }
};
fs.writeFileSync(path.join(ROOT, 'data', 'specs', 'materiales-acabados.json'), JSON.stringify(materialsSpecs, null, 2));

console.log('Dataset built! Rooms count:', roomsOutput.length);
for (const r of roomsOutput) {
  console.log(`  ${r.id}: ${r.title} | Privada: ${r.areaPrivateM2} m2 | Construida: ${r.areaBuiltM2} m2 | Galería: ${r.gallery.length} imgs`);
}
