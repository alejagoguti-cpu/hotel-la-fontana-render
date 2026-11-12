import * as THREE from 'three';
import { load as loadPBR } from './PBRSurfaces.js';
import { orthoTexture } from './Unicentro.js';

/**
 * HotelGround — piso MODELADO de todo el predio del conjunto La Fontana (sin foto aérea a la vista).
 *  · Límite del predio: polígono "Hotel Fontana Plaza" de OpenStreetMap (© colaboradores de OSM, ODbL).
 *  · La ortofoto se usa solo como guía (muy desenfocada) para saber qué es jardín, qué es adoquín y qué es
 *    vía interna; lo que se ve son materiales fotogramétricos reales a escala: césped, adoquín de arcilla
 *    en espina de pescado y asfalto. Así el trazado es el real pero nunca se ve una foto pixelada.
 *  · Bajo este polígono se recorta la malla de Google (GoogleContext.addMask).
 */
export const HOTEL_LOT = [[76.4, -110.7], [-65.8, -121.5], [-74.9, 16.8], [52, 28.8], [53.7, 16.5], [51.7, 14.6], [53.8, 3.9], [58.2, 3.5], [61.4, -2.2], [59, -4.2], [60.3, -7.1], [59.5, -9.7], [51.9, -14.8], [54.9, -25.4], [64.6, -39.7], [73.6, -39]];

// franja entre el predio y el andén de la Cra 15 / esquina con la Calle 127 (antes se veía la foto borrosa)
export const HOTEL_LOT_EAST = [[51.5, 28.8], [79.5, 31.5], [82.5, -40], [64.6, -39.7], [54.9, -25.4], [51.9, -14.8], [59.5, -9.7], [60.3, -7.1], [59, -4.2], [61.4, -2.2], [58.2, 3.5], [53.8, 3.9], [51.7, 14.6], [53.7, 16.5]];

export class HotelGround {
  constructor(group) {
    const ortho = orthoTexture(HOTEL_LOT);
    const T = { g: loadPBR('leafy_grass', 'diff', true), p: loadPBR('concrete_pavement', 'diff', true), a: loadPBR('asphalt_02', 'diff', true), pn: loadPBR('concrete_pavement', 'nor_gl', false) };
    const shapes = [HOTEL_LOT, HOTEL_LOT_EAST].map((P) => new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geo = new THREE.ShapeGeometry(shapes);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.4, normalMap: T.pn });
    mat.normalScale.set(0.6, 0.6);
    const uni = { tSat: { value: ortho.tex }, uSatB: { value: ortho.bounds }, tGrass: { value: T.g }, tPav: { value: T.p }, tAsph: { value: T.a } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xz;')
        .replace('#include <normal_vertex>', '#include <normal_vertex>');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec2 vGW; uniform sampler2D tSat, tGrass, tPav, tAsph; uniform vec4 uSatB;`)
        .replace('#include <map_fragment>', `
          vec2 st = (vGW - uSatB.xy) / uSatB.zw; st.y = 1.0 - st.y;
          vec3 s = texture2D(tSat, st, 3.5).rgb;                  // solo la distribución, muy desenfocada
          // (valores lineales: asfalto en la foto ≈ 0.03–0.07, adoquín/concreto ≈ 0.15–0.4)
          // las sombras de la foto NO son asfalto: solo vegetación (césped) vs. adoquín
          float veg = smoothstep(0.003, 0.016, s.g - max(s.r, s.b) * 0.95);
          float asphalt = 0.0;
          mat2 R = mat2(0.7986, -0.6018, 0.6018, 0.7986);
          vec3 grass = mix(texture2D(tGrass, vGW / 2.4).rgb, texture2D(tGrass, R * vGW / 3.7 + 0.3).rgb, 0.5) * vec3(0.46, 0.86, 0.52);
          vec3 pav = mix(texture2D(tPav, vGW / 3.0).rgb, texture2D(tPav, R * vGW / 4.3 + 0.37).rgb, 0.35) * vec3(1.45, 1.42, 1.4);
          vec3 asph = texture2D(tAsph, vGW / 4.5).rgb * 1.05;
          vec3 g = mix(mix(pav, asph, asphalt), grass, veg);
          diffuseColor.rgb *= g;`);
    };
    mat.customProgramCacheKey = () => 'hlfLotGround';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.012;
    mesh.receiveShadow = true;
    mesh.name = 'HotelLotGround';
    group.add(mesh);
    this.mesh = mesh;
  }
}
