const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const targetFile = path.join(repoDir, 'src/scene/MaterialLibrary.js');

let content = fs.readFileSync(targetFile, 'utf8');

// Replace BRICK_FACADE
const brickTarget = `    // 1. Exterior Brick Facade (Bogotá classic brick + bump) - properly tiled at architectural scale
    const brickMap = this.getTexture('./assets/textures/hlf_ladrillo.png', 3.5, 3.5, true);
    const brickBump = this.getTexture('./assets/textures/hlf_ladrillo_bump.png', 3.5, 3.5, false);
    this.materials.set('BRICK_FACADE', new THREE.MeshStandardMaterial({
      map: brickMap,
      bumpMap: brickBump,
      bumpScale: 0.02,
      roughness: 0.78,
      metalness: 0.02
    }));`;

const brickReplacement = `    // 1. Exterior Brick Facade (Iconic Hotel Estelar La Fontana Bogotá red brick)
    const brickMap = this.getTexture('./assets/textures/hlf_ladrillo.png', 1.0, 1.0, true);
    const brickBump = this.getTexture('./assets/textures/hlf_ladrillo_bump.png', 1.0, 1.0, false);
    this.materials.set('BRICK_FACADE', new THREE.MeshStandardMaterial({
      map: brickMap,
      bumpMap: brickBump,
      bumpScale: 0.04,
      color: 0xc44f33, // Warm vibrant Bogotá red brick tint
      roughness: 0.74,
      metalness: 0.02
    }));`;

// Replace WINDOW_EXT
const winTarget = `    this.materials.set('WINDOW_EXT', new THREE.MeshPhysicalMaterial({
      color: 0x243848,
      roughness: 0.12,
      metalness: 0.65,
      transparent: true,
      opacity: 0.82
    }));`;

const winReplacement = `    this.materials.set('WINDOW_EXT', new THREE.MeshStandardMaterial({
      color: 0x162636,
      roughness: 0.12,
      metalness: 0.85,
      emissive: 0xffde9b,
      emissiveIntensity: 0.22
    }));`;

content = content.replace(/\r\n/g, '\n');
const bTargetNorm = brickTarget.replace(/\r\n/g, '\n');
const wTargetNorm = winTarget.replace(/\r\n/g, '\n');

if (content.includes(bTargetNorm) && content.includes(wTargetNorm)) {
  content = content.replace(bTargetNorm, brickReplacement);
  content = content.replace(wTargetNorm, winReplacement);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('SUCCESS: MaterialLibrary.js updated!');
} else {
  console.error('ERROR: Targets not found in MaterialLibrary.js');
  process.exit(1);
}
