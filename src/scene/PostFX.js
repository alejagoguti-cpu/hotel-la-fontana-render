import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

/**
 * PostFX — Cadena de posproceso tipo "cinematic" (equivalente a Post Process Volume de Unreal):
 *  · MSAA 4x en el render target.
 *  · GTAO (Ground-Truth Ambient Occlusion): oclusión de contacto en esquinas, aleros,
 *    ventanas, bordillos y bajo los carros — es lo que más quita el aspecto "videojuego".
 *  · Bloom suave solo en luces muy brillantes (faroles, semáforos, sol en vidrios).
 *  · Gradación de color: curva fílmica, saturación contenida, balance cálido y viñeta.
 *  · Tone mapping AgX (rango dinámico realista, sin colores quemados).
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.06 },
    uSaturation: { value: 0.9 },
    uWarm: { value: new THREE.Vector3(1.02, 1.0, 0.975) },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.012 },
    uTime: { value: 0 },
    uLift: { value: 0.035 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uContrast, uSaturation, uVignette, uGrain, uTime, uLift; uniform vec3 uWarm;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uWarm;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.18) * uContrast + 0.18;          // contraste alrededor del gris medio (lineal)
      col += uLift * (1.0 - smoothstep(0.0, 0.35, col)) * vec3(0.9, 0.95, 1.05); // sombras abiertas y frescas (luz de cielo)
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain * (0.3 + l);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`
};

export class PostFX {
  constructor(renderer, scene, camera, container) {
    this.renderer = renderer;
    const w = container.clientWidth, h = container.clientHeight;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // Perfil de calidad según la GPU: en gráficos integrados (Intel UHD/Iris, móviles) se apaga la
    // oclusión ambiental en exterior (costaba ~100 ms por cuadro) y se baja el antialiasing.
    let gpu = '';
    try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { /* sin datos */ }
    this.low = mobile || /Intel|UHD|HD Graphics|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Microsoft Basic/i.test(gpu);
    this.gpu = gpu;

    // Tono "render de masterplan": ACES, luminoso y saturado (como los renders de Umbra / Lumion)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.low ? 2 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.maxPixelRatio = Math.max(1, Math.min(window.devicePixelRatio, this.low ? 1.25 : (mobile ? 1.5 : 2)));
    this.composer.setPixelRatio(this.maxPixelRatio);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(scene, camera));

    if (!mobile) {
      this.ao = new GTAOPass(scene, camera, w, h);
      this.ao.output = GTAOPass.OUTPUT.Default;
      if (this.low) { const ss = this.ao.setSize.bind(this.ao); this.ao.setSize = (aw, ah) => ss(Math.max(1, Math.ceil(aw * 0.5)), Math.max(1, Math.ceil(ah * 0.5))); this.ao.setSize(w, h); }   // GPU integrada: AO a media resolución
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 2.0, scale: 1.0, samples: this.low ? 8 : 12, distanceFallOff: 1.0 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: this.low ? 6 : 12 });
      this.aoExterior = !this.low;      // en exterior solo con GPU dedicada
      this.ao.enabled = this.aoExterior;
      this.composer.addPass(this.ao);
    }

    // protección: un solo píxel NaN/Inf en HDR lo esparce el bloom por todo el cuadro (pantalla negra)
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bool bad = any(isnan(c.rgb)) || any(isinf(c.rgb)); gl_FragColor = vec4(bad ? vec3(0.0) : clamp(c.rgb, 0.0, 60.0), c.a); }'
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.4, 0.96);
    this.composer.addPass(this.bloom);

    // profundidad de campo sutil (solo dentro de las habitaciones y con GPU dedicada)
    this.bokeh = new BokehPass(scene, camera, { focus: 2.6, aperture: 0.0012, maxblur: 0.0035 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);

    this.grade = new ShaderPass(GradeShader);
    const u = this.grade.uniforms;
    // cámara real: color neutro, contraste suave, viñeta de lente leve
    u.uContrast.value = 1.04; u.uSaturation.value = 1.0; u.uVignette.value = 0.16;
    u.uWarm.value.set(1.0, 1.0, 0.99); u.uGrain.value = 0.004; u.uLift.value = 0.012;
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** Look "render de hotel boutique": cálido, contraste suave, viñeta de lente y desenfoque leve de fondo. */
  setInterior(on) {
    const u = this.grade.uniforms;
    if (on) {
      u.uContrast.value = 1.1; u.uSaturation.value = 0.94; u.uVignette.value = 0.26;
      u.uWarm.value.set(1.04, 1.0, 0.93); u.uLift.value = 0.006; u.uGrain.value = 0.006;
      this.bokeh.enabled = !this.low;
    } else {
      u.uContrast.value = 1.04; u.uSaturation.value = 1.0; u.uVignette.value = 0.16;
      u.uWarm.value.set(1.0, 1.0, 0.99); u.uLift.value = 0.012; u.uGrain.value = 0.004;
      this.bokeh.enabled = false;
    }
  }

  setPixelRatio(pr) {
    this.composer.setPixelRatio(pr);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    if (this.ao) this.ao.setSize(w, h);
  }

  render(dt) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
