import * as THREE from 'three';

/**
 * PBRSurfaces — Superficies fotogramétricas reales (Poly Haven, licencia CC0) con
 * mapas de color, normal y rugosidad, y variación macro anti-repetición al estilo
 * de los "material layers" de Unreal: la textura se muestrea dos veces (detalle +
 * escala grande girada) para romper el patrón repetido y añadir manchas y desgaste
 * a gran escala.
 */
// Copia local en assets/textures/pbr (ver .github/workflows/fetch-pbr-textures.yml);
// si aún no existe, se usa el CDN de Poly Haven como respaldo.
const LOCAL = './assets/textures/pbr';
const CDN = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

export function load(id, kind, srgb) {
  const t = loader.load(`${LOCAL}/${id}_${kind}_1k.jpg`, undefined, undefined, () => {
    loader.load(`${CDN}/${id}/${id}_${kind}_1k.jpg`, (img) => { t.image = img.image; t.needsUpdate = true; });
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Inyecta variación macro + anti-tiling en el shader estándar. */
function addMacroVariation(mat, { macroScale = 0.071, strength = 0.35 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroScale = { value: macroScale };
    shader.uniforms.uMacroStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMacroScale;\nuniform float uMacroStrength;')
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  // segunda muestra girada 37° y escalada: rompe la repetición visible
  mat2 rotM = mat2(0.7986, -0.6018, 0.6018, 0.7986);
  vec4 alt = texture2D( map, rotM * vMapUv * 0.73 + vec2(0.31, 0.17) );
  float blendN = smoothstep(0.35, 0.65, texture2D( map, vMapUv * uMacroScale * 0.5 + 0.5 ).g);
  sampledDiffuseColor = mix( sampledDiffuseColor, alt, blendN * 0.55 );
  // manchas/desgaste a gran escala
  float macro = dot( texture2D( map, rotM * vMapUv * uMacroScale ).rgb, vec3(0.3333) );
  float macro2 = dot( texture2D( map, vMapUv * uMacroScale * 0.37 + 0.6 ).rgb, vec3(0.3333) );
  float m = (macro * 0.6 + macro2 * 0.4);
  sampledDiffuseColor.rgb *= mix( 1.0 - uMacroStrength, 1.0 + uMacroStrength * 0.6, smoothstep(0.15, 0.75, m) );
  diffuseColor *= sampledDiffuseColor;
#endif
`);
  };
  mat.customProgramCacheKey = () => `macro_${macroScale}_${strength}`;
  mat.needsUpdate = true;
}

/**
 * Aplica un material PBR real a `mat` (MeshStandardMaterial existente).
 * metersPerTile: tamaño real de la textura en metros; uvScale: unidades UV por metro
 * de la geometría (1 para ExtrudeGeometry en metros; 1/ancho para PlaneGeometry).
 */
export function applyPBR(mat, id, { metersPerTile = 4, uvRepeat = null, tint = 0xffffff, normalScale = 1.0, macro = {}, minRoughness = 0.78, rough = false } = {}) {
  const rep = uvRepeat || new THREE.Vector2(1 / metersPerTile, 1 / metersPerTile);
  const maps = { map: load(id, 'diff', true), normalMap: load(id, 'nor_gl', false) };
  for (const k in maps) { maps[k].repeat.copy(rep); mat[k] = maps[k]; }
  mat.color.setHex(tint);
  // superficie exterior mate: sin reflejos de espejo (la rugosidad fotogramétrica
  // se usa solo como variación sobre un mínimo alto)
  if (rough) {
    // rugosidad fotogramétrica real (juntas, desgaste, brillo de la piedra pulida por el uso)
    const r = load(id, 'rough', false); r.repeat.copy(rep);
    mat.roughnessMap = r; mat.roughness = 1.0;
  } else {
    mat.roughnessMap = null;
    mat.roughness = minRoughness + 0.15;
  }
  mat.envMapIntensity = 0.45;
  mat.metalness = 0.0;
  mat.normalScale = new THREE.Vector2(normalScale, normalScale);
  addMacroVariation(mat, macro);
  return mat;
}

export const SURFACES = {
  GRASS: 'leafy_grass',                 // césped real con variación
  ASPHALT: 'asphalt_02',                 // asfalto con fisuras, parches y desgaste
  CONCRETE_WORN: 'concrete_floor_worn_001', // concreto desgastado con manchas
  CONCRETE_PAVEMENT: 'concrete_pavement',   // placas de concreto con juntas
  RED_PAVERS: 'red_brick_pavers',          // adoquín de arcilla roja (andenes de Bogotá)
  HERRINGBONE: 'herringbone_pavement'      // adoquín en espina de pescado (plazoleta)
};
