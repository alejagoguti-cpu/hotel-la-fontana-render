import * as THREE from 'three';

/**
 * Wind — viento en el follaje: desplaza los vértices de las copas en el shader (sin costo de CPU).
 * El desplazamiento crece con la altura (el tronco/base queda quieto) y cada árbol tiene su fase
 * según su posición, así no se mueven todos al tiempo. Funciona con mallas normales, instanciadas
 * y fusionadas (StaticBatcher), porque calcula en coordenadas de mundo.
 */
export const windUniforms = {
  uWindTime: { value: 0 },
  uWindAmp: { value: 0.22 }
};

const done = new WeakSet();

export function applyWind(material, { amp = 1, from = 1.2, to = 9.0 } = {}) {
  if (!material || done.has(material)) return;
  done.add(material);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindAmp = windUniforms.uWindAmp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime; uniform float uWindAmp;')
      .replace('#include <project_vertex>', `
        vec4 wPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wPos = instanceMatrix * wPos;
        #endif
        wPos = modelMatrix * wPos;
        float kW = uWindAmp * ${amp.toFixed(3)} * smoothstep(${from.toFixed(2)}, ${to.toFixed(2)}, wPos.y);
        float ph = wPos.x * 0.21 + wPos.z * 0.17;
        float t = uWindTime;
        vec2 sway = vec2(sin(t * 1.25 + ph) + 0.45 * sin(t * 2.9 + ph * 2.3),
                         0.6 * cos(t * 1.05 + ph * 1.3) + 0.3 * sin(t * 3.6 + ph * 3.1));
        float gust = 0.75 + 0.25 * sin(t * 0.35 + ph * 0.2);
        wPos.xz += sway * kW * gust;
        wPos.y += sin(t * 4.2 + ph * 5.0 + position.x * 3.0) * kW * 0.12;   // aleteo de hojas
        vec4 mvPosition = viewMatrix * wPos;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|wind' + amp + from + to;
  material.needsUpdate = true;
}
