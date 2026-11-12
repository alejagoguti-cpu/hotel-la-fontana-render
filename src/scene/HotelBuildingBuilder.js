import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoofBuilder } from './RoofBuilder.js';
import { FacadeWindows } from './FacadeWindows.js';
import { SiteDetails } from './SiteDetails.js';
import { applyPBR, SURFACES } from './PBRSurfaces.js';
import { LaFontanaTower } from './LaFontanaTower.js';
import { Traffic } from './Traffic.js';
import { RealTrees } from './RealTrees.js';

// Torre de la Carrera 15 y su ala vecina (foto de la plaza): estilo distinto
const TOWER_CENTER = [47.58, -0.93];
const TOWER_WING_CENTER = [31.46, -23.14];
const near = (c, ref, r = 1.5) => Math.hypot(c[0] - ref[0], c[1] - ref[1]) < r;
const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);

const MM_TO_M = 0.001;

/**
 * Ejes de calzada (x, z) medidos sobre los polígonos de Catastro. El eje es la línea
 * que divide los dos carriles de cada calzada; el tráfico circula a ±1.7 m de él.
 * El orden de los puntos = sentido de circulación.
 */
export const ROAD_AXES = {
  eb: [[-150, 16.25], [-120, 21.25], [-80, 26.0], [-40, 30.75], [0, 34.75], [40, 39.0], [60, 41.0], [120, 48.75], [160, 52.25]],
  wb: [[160, 80.5], [120, 77.0], [60, 68.75], [40, 66.75], [0, 63.5], [-40, 60.25], [-80, 55.75], [-120, 51.25], [-150, 46.25]],
  sb: [[88.5, -100], [87.5, -80], [85.5, -40], [83.5, 0], [81.5, 30], [80.5, 44]],
  nb: [[100, 30], [101.75, 0], [103.75, -40], [106, -80], [107, -100]]
};

/**
 * Converts a 2D Revit polygon loop ([[x_mm, y_mm], ...]) into a THREE.Shape
 */
export function loopToShape(loopMm) {
  const shape = new THREE.Shape();
  if (!loopMm || loopMm.length < 3) return shape;
  shape.moveTo(loopMm[0][0] * MM_TO_M, loopMm[0][1] * MM_TO_M);
  for (let i = 1; i < loopMm.length; i++) {
    shape.lineTo(loopMm[i][0] * MM_TO_M, loopMm[i][1] * MM_TO_M);
  }
  shape.closePath();
  return shape;
}

/** Punto dentro de polígono [[x,z],...] (ray casting). */
export function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Converts 2D world meter points ([[x, z], ...]) into a THREE.Shape
 * For extrusion rotated by -PI/2 around X:
 * Shape (x, y) becomes 3D (x, height, -y)
 */
export function ptsToShape(pts) {
  const shape = new THREE.Shape();
  if (!pts || pts.length < 3) return shape;
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], -pts[i][1]);
  }
  shape.closePath();
  return shape;
}

/**
 * Architectural Triplanar UV generator for Red Brick Facades.
 * Eliminates texture stretching, skewing or smearing across extruded geometries.
 * Tiles horizontally and vertically at exact Revit 1.35m x 1.35m architectural scale.
 */
export function applyArchitecturalBrickUVs(geometry, scaleH = 1.35, scaleV = 1.35) {
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    let nx = 0, ny = 1, nz = 0;
    if (norm) {
      nx = Math.abs(norm.getX(i));
      ny = Math.abs(norm.getY(i));
      nz = Math.abs(norm.getZ(i));
    }

    let u = 0, v = 0;
    if (ny > 0.65) {
      // Horizontal roof / floor caps
      u = x / scaleH;
      v = z / scaleH;
    } else if (nx > nz) {
      // Vertical facades facing East/West
      u = z / scaleH;
      v = y / scaleV;
    } else {
      // Vertical facades facing North/South
      u = x / scaleH;
      v = y / scaleV;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/**
 * Projects world (X, Z) coordinates onto the roof cap vertices (materialIndex 0)
 * matching the satellite aerial orthophoto bounds
 */
export function applySatelliteRoofUVs(geometry, xMin = -380.03, xMax = 396.58, zMin = -282.00, zMax = 315.10) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;
  const spanX = xMax - xMin;
  const spanZ = zMax - zMin;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.4) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const u = (x - xMin) / spanX;
      const v = 1.0 - (z - zMin) / spanZ;
      uv.setXY(i, u, v);
    }
  }
  uv.needsUpdate = true;
}

export class HotelBuildingBuilder {
  constructor(materials) {
    this.materials = materials;
    this.rootGroup = new THREE.Group();
    this.lowerBuildingGroup = new THREE.Group();
    this.upperBuildingGroup = new THREE.Group(); // Floors 3-6 + Roof (hidden in interior mode)
    this.exteriorShellPiso2 = new THREE.Group(); // Exterior brick shell of Piso 2 (hidden in interior mode)
    this.contextGroup = new THREE.Group();

    this.rootGroup.add(this.contextGroup);
    this.rootGroup.add(this.lowerBuildingGroup);
    this.rootGroup.add(this.exteriorShellPiso2);
    this.rootGroup.add(this.upperBuildingGroup);
  }

  build(architectureData, catastroBuildings = [], urbanNetwork = {}, revitWindows = [], roofData = null) {
    this.roofData = roofData;
    this.roofBuilder = new RoofBuilder();
    const mainFootprint = architectureData.slabLoops?.[0]?.loops?.[0] || [
      [24840, 3760], [31226, -2626], [28800, -5052], [28800, -11000],
      [32800, -15250], [38900, -15250], [49125, -5025], [29450, 14650],
      [3200, 14650], [3200, 12300], [-14000, 12300], [-14000, 3800]
    ];

    this.ctxWindows = new FacadeWindows(this.materials);
    this.towerWindows = new FacadeWindows(this.materials, { plain: true, heightScale: 0.9 });
    this.tower = new LaFontanaTower(this.materials);
    this.facadeSets = [this.ctxWindows, this.towerWindows];
    this.siteDetails = new SiteDetails(this.materials);
    this.buildUrbanContext(catastroBuildings, urbanNetwork);
    this.contextGroup.add(this.ctxWindows.build());
    this.contextGroup.add(this.towerWindows.build());
    this.buildHotelMassing(mainFootprint, revitWindows);
    return this.rootGroup;
  }

  /**
   * Creates the authentic 1:1 Revit window component matching:
   * Family: 'HLF-VENTANA FACHADA BARANDAL'
   * Visual Reference: User photos 1, 2, 3
   */
  createRevitWindowComponent(width = 1.34, height = 1.50, isLit = false) {
    const winGroup = new THREE.Group();
    const frameMat = this.materials.get('REVIT_WIN_FRAME');
    const glassMat = isLit ? this.materials.get('REVIT_WIN_GLASS_LIT') : this.materials.get('REVIT_WIN_GLASS');
    const railingMat = this.materials.get('REVIT_WIN_RAILING');
    const planterMat = this.materials.get('REVIT_WIN_PLANTER');
    const ivyMat = this.materials.get('REVIT_WIN_IVY');

    const fThick = 0.055;
    const fDepth = 0.07;
    const halfW = width / 2;

    // 1. Perimeter Frame (Dark green-slate #333e3b)
    const jambGeo = new THREE.BoxGeometry(fThick, height, fDepth);
    const leftJamb = new THREE.Mesh(jambGeo, frameMat);
    leftJamb.position.set(-halfW + fThick / 2, height / 2, 0);
    const rightJamb = new THREE.Mesh(jambGeo, frameMat);
    rightJamb.position.set(halfW - fThick / 2, height / 2, 0);

    const headGeo = new THREE.BoxGeometry(width, fThick, fDepth);
    const head = new THREE.Mesh(headGeo, frameMat);
    head.position.set(0, height - fThick / 2, 0);

    const baseSillGeo = new THREE.BoxGeometry(width, fThick, fDepth);
    const baseSill = new THREE.Mesh(baseSillGeo, frameMat);
    baseSill.position.set(0, fThick / 2, 0);

    // Horizontal Transom Bar (dividing upper 62% from lower 38%)
    const transomY = height * 0.38;
    const transomGeo = new THREE.BoxGeometry(width - 2 * fThick, 0.045, fDepth);
    const transom = new THREE.Mesh(transomGeo, frameMat);
    transom.position.set(0, transomY, 0);

    winGroup.add(leftJamb, rightJamb, head, baseSill, transom);

    // 2. Upper 62%: Sliding 2-leaf glazed window
    const upperH = height - transomY - fThick;
    const upperW = width - 2 * fThick;
    const leafW = upperW / 2;

    // Center vertical mullion
    const mullionGeo = new THREE.BoxGeometry(0.045, upperH, fDepth * 0.85);
    const mullion = new THREE.Mesh(mullionGeo, frameMat);
    mullion.position.set(0, transomY + upperH / 2, 0);
    winGroup.add(mullion);

    // Upper glass panes
    const glassPaneGeo = new THREE.PlaneGeometry(leafW - 0.03, upperH - 0.03);
    const glassLeft = new THREE.Mesh(glassPaneGeo, glassMat);
    glassLeft.position.set(-leafW / 2, transomY + upperH / 2, 0.015);
    const glassRight = new THREE.Mesh(glassPaneGeo, glassMat);
    glassRight.position.set(leafW / 2, transomY + upperH / 2, -0.015);
    winGroup.add(glassLeft, glassRight);

    // 3. Lower 38%: White Baluster Railing (Barandal de balaustres blancos)
    const lowerH = transomY - fThick;
    const lowerW = width - 2 * fThick;

    const handrailGeo = new THREE.BoxGeometry(lowerW, 0.032, 0.035);
    const handrail = new THREE.Mesh(handrailGeo, railingMat);
    handrail.position.set(0, transomY - 0.02, 0.045);

    const botRailGeo = new THREE.BoxGeometry(lowerW, 0.024, 0.035);
    const botRail = new THREE.Mesh(botRailGeo, railingMat);
    botRail.position.set(0, fThick + 0.015, 0.045);
    winGroup.add(handrail, botRail);

    // Protective glass behind railing
    const lowerGlassGeo = new THREE.PlaneGeometry(lowerW, lowerH);
    const lowerGlass = new THREE.Mesh(lowerGlassGeo, this.materials.get('REVIT_WIN_GLASS'));
    lowerGlass.position.set(0, fThick + lowerH / 2, 0.01);
    winGroup.add(lowerGlass);

    // Vertical Pickets (spaced ~75mm apart)
    const numPickets = Math.max(3, Math.floor(lowerW / 0.075));
    const picketSpacing = lowerW / (numPickets + 1);
    const picketH = lowerH - 0.055;
    const picketGeo = new THREE.BoxGeometry(0.02, picketH, 0.02);

    for (let p = 1; p <= numPickets; p++) {
      const px = -lowerW / 2 + p * picketSpacing;
      const picket = new THREE.Mesh(picketGeo, railingMat);
      picket.position.set(px, fThick + 0.025 + picketH / 2, 0.045);
      winGroup.add(picket);
    }

    // 4. Exterior Cantilevered Concrete Planter Box (Jardinera exterior bajo antepecho)
    const planterW = width + 0.16;
    const planterH = 0.24;
    const planterD = 0.26;
    const planterGeo = new THREE.BoxGeometry(planterW, planterH, planterD);
    const planter = new THREE.Mesh(planterGeo, planterMat);
    planter.position.set(0, -planterH / 2 + 0.02, planterD / 2 + 0.03);
    winGroup.add(planter);

    // 5. Lush Green Hanging Ivy (Hiedra trepadora / enredadera colgante)
    if (ivyMat) {
      const ivyFrontGeo = new THREE.PlaneGeometry(planterW + 0.04, 0.42);
      const ivyFront = new THREE.Mesh(ivyFrontGeo, ivyMat);
      ivyFront.position.set(0, -0.20, planterD + 0.04);

      const ivyTopGeo = new THREE.PlaneGeometry(planterW, planterD * 0.85);
      const ivyTop = new THREE.Mesh(ivyTopGeo, ivyMat);
      ivyTop.rotation.x = -Math.PI / 2;
      ivyTop.position.set(0, 0.02, planterD / 2 + 0.03);

      const ivySideGeo = new THREE.PlaneGeometry(planterD, 0.36);
      const ivyLeft = new THREE.Mesh(ivySideGeo, ivyMat);
      ivyLeft.rotation.y = -Math.PI / 2;
      ivyLeft.position.set(-planterW / 2 - 0.01, -0.16, planterD / 2 + 0.03);

      const ivyRight = new THREE.Mesh(ivySideGeo, ivyMat);
      ivyRight.rotation.y = Math.PI / 2;
      ivyRight.position.set(planterW / 2 + 0.01, -0.16, planterD / 2 + 0.03);

      winGroup.add(ivyFront, ivyTop, ivyLeft, ivyRight);
    }

    return winGroup;
  }

  buildUrbanContext(catastroBuildings = [], urbanNetwork = {}) {
    const facadeBrickMat = this.materials.get('BRICK_FACADE');
    const roofClayMat = this.materials.get('ROOF_CLAY_TILE');
    const timberEavesMat = this.materials.get('ROOF_EAVES_TIMBER');
    const contextWhiteMat = this.materials.get('CONTEXT_WHITE');
    const stoneMat = this.materials.get('REF28');
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65
    });

    const ORTHO_X_MIN = -380.03;
    const ORTHO_X_MAX = 396.58;
    const ORTHO_Z_MIN = -282.00;
    const ORTHO_Z_MAX = 315.10;

    // 1. High-Resolution Satellite Aerial Photography Ground Plane
    const groundW = ORTHO_X_MAX - ORTHO_X_MIN;
    const groundH = ORTHO_Z_MAX - ORTHO_Z_MIN;
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xebf0f5,
      roughness: 0.9,
      metalness: 0.02
    });
    // Concreto real desgastado (fotogrametría CC0) con variación macro anti-repetición
    applyPBR(groundMat, SURFACES.CONCRETE_PAVEMENT, {
      uvRepeat: new THREE.Vector2(groundW / 4.0, groundH / 4.0), tint: 0xd8d4cc, normalScale: 1.05,
      macro: { macroScale: 0.05, strength: 0.14 }
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundW, groundH), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((ORTHO_X_MIN + ORTHO_X_MAX) / 2, -0.06, (ORTHO_Z_MIN + ORTHO_Z_MAX) / 2);
    ground.receiveShadow = true;
    this.groundPlane = ground;
    this.contextGroup.add(ground);

    // 1b. Cubiertas de teja a cuatro aguas del conjunto La Fontana (precalculadas)
    if (this.roofData?.context) {
      this.roofData.context.forEach((r) => {
        if (!r.slope) return;
        // la torre no lleva teja: remata en mirador acristalado (ver LaFontanaTower)
        if (r.footprint && near(centroid(r.footprint), TOWER_CENTER, 2.5)) return;
        this.roofBuilder.addRoof(r, this.contextGroup, { gallery: true, ivyMat: this.materials.get('REVIT_WIN_IVY') });
      });
    }

    // 2. Real Bogotá Catastro Buildings
    if (Array.isArray(catastroBuildings) && catastroBuildings.length > 0) {
      for (let i = 0; i < catastroBuildings.length; i++) {
        const b = catastroBuildings[i];
        if (!b.pts || b.pts.length < 3) continue;

        // Skip the main Revit wing so it doesn't double-render
        if (b.isHotel && Math.hypot(b.center[0] - 16, b.center[1] - 1) < 22) {
          continue;
        }

        try {
          const shape = ptsToShape(b.pts);
          const height = Math.max(3.2, Math.min(b.height, 65));
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
          });
          geo.rotateX(-Math.PI / 2);

          if (b.isHotel) {
            // ==============================================================
            // HOTEL ESTELAR LA FONTANA: 100% LADRILLO ROJO BOGOTANO (Revit 1.35m scale)
            // ==============================================================
            applyArchitecturalBrickUVs(geo, 1.35, 1.35);
            const hotelMesh = new THREE.Mesh(geo, [facadeBrickMat, facadeBrickMat]);
            hotelMesh.castShadow = true;
            hotelMesh.receiveShadow = true;
            this.contextGroup.add(hotelMesh);

            if (this.roofData) {
              // Cubierta real a cuatro aguas (esqueleto recto) o terraza en podios bajos
              if (height < 6.5) this.roofBuilder.addTerrace(shape, height, this.contextGroup);
            } else {
              // Spanish Terracotta Clay Roof Tiles (Teja de barro roja - Photo 1 & 2)
              const roofGeo = new THREE.ExtrudeGeometry(shape, {
                depth: 1.5,
                bevelEnabled: true,
                bevelSize: -0.35,
                bevelThickness: 0.75,
                bevelSegments: 2
              });
              roofGeo.rotateX(-Math.PI / 2);
              applyArchitecturalBrickUVs(roofGeo, 1.35, 1.35);
              const roofMesh = new THREE.Mesh(roofGeo, [roofClayMat, roofClayMat]);
              roofMesh.position.y = height;
              roofMesh.castShadow = true;
              this.contextGroup.add(roofMesh);

              // Overhanging Dark Timber Eaves Trim
              const eavesGeo = new THREE.ExtrudeGeometry(shape, {
                depth: 0.18,
                bevelEnabled: true,
                bevelSize: 0.22,
                bevelThickness: 0.08,
                bevelSegments: 1
              });
              eavesGeo.rotateX(-Math.PI / 2);
              const eaves = new THREE.Mesh(eavesGeo, timberEavesMat);
              eaves.position.y = height - 0.08;
              this.contextGroup.add(eaves);
            }

            // Add authentic windows on every floor of this hotel wing
            // Ventanas en todos los pisos (el último, bajo el alero, es la galería acristalada)
            const floors = Math.max(1, b.floors || Math.round(height / 3.1));
            const fh = height / floors;
            const topSkip = (this.roofData && height >= 6.5) ? 1 : 0;
            const sills = [];
            for (let k = 0; k < floors - topSkip; k++) sills.push(k * fh + 0.9);
            if (near(b.center, TOWER_CENTER)) {
              // Torre: vanos pequeños, mirador acristalado, balcón metálico y acceso en arco
              this.tower.buildCrown(b.pts, height, this.contextGroup);
              this.tower.addTowerOpenings(b.pts, height, floors, this.towerWindows, this.contextGroup);
              const E = b.pts.map((p, i) => [p, b.pts[(i + 1) % b.pts.length]]);
              const [a0, a1] = E.reduce((best, e) => (Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) > Math.hypot(best[1][0] - best[0][0], best[1][1] - best[0][1]) ? e : best));
              let ar = 0; b.pts.forEach((p, i) => { const q = b.pts[(i + 1) % b.pts.length]; ar += p[0] * q[1] - q[0] * p[1]; });
              const sg = ar > 0 ? 1 : -1, L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
              const ux = (a1[0] - a0[0]) / L, uz = (a1[1] - a0[1]) / L;
              this.tower.buildArchEntrance({ p: a0, q: a1, len: L, ux, uz, nx: sg * uz, nz: -sg * ux }, this.contextGroup);
            } else if (near(b.center, TOWER_WING_CENTER)) {
              // Ala vecina: vanos simples sin jardinera + loggia de madera junto a la torre
              this.towerWindows.addAlongPolygon(b.pts, sills, { spacing: 3.2, width: 1.0 });
              this.tower.buildLoggia([58.3, -7.8], [54.2, -1.8], fh * (floors - 3), this.contextGroup);
            } else {
              this.ctxWindows.addAlongPolygon(b.pts, sills);
            }
          } else {
            // Surrounding non-hotel urban context: frosted architectural white volumes
                        const mesh = new THREE.Mesh(geo, contextWhiteMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.contextGroup.add(mesh);

            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
            this.contextGroup.add(edges);
          }
        } catch (e) {}
      }
    }

    // 3. Official Bogotá Road Network (Calzadas, Andenes, Separadores, Ciclorrutas)
    const calzadaMat = this.materials.get('ROAD_ASPHALT');
    // Asfalto real con fisuras, parcheo y desgaste (UV de ExtrudeGeometry en metros)
    applyPBR(calzadaMat, SURFACES.ASPHALT, { metersPerTile: 5.0, tint: 0xb8b8b8, normalScale: 1.0, macro: { macroScale: 0.06, strength: 0.38 } });
    const andenMat = this.materials.get('SIDEWALK_PAVING');
    const alamedaMat = this.materials.get('TURF_GRASS');
    applyPBR(alamedaMat, SURFACES.GRASS, { metersPerTile: 2.4, tint: 0xd8e2c8, normalScale: 1.25, rough: true, macro: { macroScale: 0.045, strength: 0.35 } });
    const cicloMat = this.materials.get('BIKEWAY_BLUE');

    for (const poly of (urbanNetwork.calzadas || [])) {
      try {
        const shape = ptsToShape(poly);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, calzadaMat);
        mesh.position.y = 0.0;
        mesh.receiveShadow = true;
        this.contextGroup.add(mesh);
      } catch (e) {}
    }

    for (const poly of (urbanNetwork.andenes || [])) {
      try {
        const shape = ptsToShape(poly);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, andenMat);
        mesh.position.y = 0.0;
        mesh.receiveShadow = true;
        this.contextGroup.add(mesh);
      } catch (e) {}
    }

    for (const poly of (urbanNetwork.separadores || [])) {
      try {
        const shape = ptsToShape(poly);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, alamedaMat);
        mesh.position.y = 0.0;
        mesh.receiveShadow = true;
        this.contextGroup.add(mesh);
      } catch (e) {}
    }

    for (const poly of (urbanNetwork.ciclorrutas || [])) {
      try {
        const shape = ptsToShape(poly);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, cicloMat);
        mesh.position.y = 0.15;
        this.contextGroup.add(mesh);
      } catch (e) {}
    }

    // 4. Photorealistic Road Surface Markings & Signage
    this.buildRoadMarkings();

    // 5. Hotel La Fontana Central Courtyard & Traditional Multi-Tier Stone Fountain (Photos 1, 2, 3)
    this.buildCourtyard(andenMat, stoneMat);

    // 6. Realistic Botanical Trees (5 native Bogota species, varied frondosidad, safe off-road placement)
    this.buildRealisticTrees(urbanNetwork.arboles, urbanNetwork.calzadas);

    // 7. Photorealistic 3D Vehicles (100% inside vehicular calzadas & courtyard parking: Sedans, SUVs, Bogota Taxis, Sports)
    this.buildRealisticVehicles(urbanNetwork.calzadas);
  }

  buildCourtyard(andenMat, stoneMat) {
    const sd = this.siteDetails;
    // Andenes en adoquín rojo; plazoleta en adoquín de arcilla gris-café (fotos de sitio)
    sd.applySidewalkPaving();
    // Plazoleta continua hasta el andén (sin franjas de terreno vacío)
    sd.buildCourtPavingPoly([[-24.0, 23.28], [54.72, 31.39], [55.3, 25.78], [60.0, 26.25], [60.0, -4.0], [-24.0, -4.0]], this.contextGroup);

    // Fuente sobre jardinera hexagonal de ladrillo, frente a la escalinata
    sd.buildFountain(16, 6.2, this.contextGroup);

    // Monolito de marca entre la vegetación, a la derecha del acceso
    sd.buildSignMonolith(27.6, 0.9, -0.35, this.contextGroup);

    // Reja negra de lanzas con seto y faroles hacia la calle (portón vehicular abierto)
    sd.buildFence([[-24.0, 23.28], [54.72, 31.39]], this.contextGroup, { gaps: [[23.5, 28.0, 32.5, 29.2]] });

    // Pabellón acristalado Plaza Café (extremo occidental de la plazoleta)
    sd.buildPlazaCafe(-21, -2.5, 11, 7, this.contextGroup);

    // Vintage Courtyard Cast-Iron Lamp Posts (Photo 3 Reference)
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.35, metalness: 0.85 });
    const lanternGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffe29a,
      emissive: 0xffba42,
      emissiveIntensity: 0.65,
      roughness: 0.2
    });

    const lampPositions = [
      [4.2, 2.6], [27.8, 2.6], [5.5, 14.0], [26.5, 14.0]
    ];

    lampPositions.forEach(([lx, lz]) => {
      const lamp = new THREE.Group();
      lamp.position.set(lx, 0.04, lz);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 3.2, 8), lampMat);
      pole.position.y = 1.6;
      pole.castShadow = true;

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.32), lanternGlassMat);
      head.position.y = 3.2;

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 4), lampMat);
      cap.position.y = 3.5;
      cap.rotation.y = Math.PI / 4;

      lamp.add(pole, head, cap);
      this.contextGroup.add(lamp);
    });
  }

  /**
   * Demarcación vial: línea discontinua blanca de división de carriles exactamente
   * sobre el eje de cada calzada (el mismo que usa el tráfico) y cebras centradas
   * en la calzada, perpendiculares al sentido de circulación.
   */
  buildRoadMarkings() {
    const markGroup = new THREE.Group();
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f7fa });
    const ROAD_W = 7.0;

    // punto y dirección sobre un eje a partir de una coordenada (x para E-O, z para N-S)
    const pointOnAxis = (pts, key, value) => {
      const k = key === 'x' ? 0 : 1;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const lo = Math.min(a[k], b[k]), hi = Math.max(a[k], b[k]);
        if (value >= lo && value <= hi) {
          const t = (value - a[k]) / ((b[k] - a[k]) || 1);
          const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
          return { x: a[0] + dx * t, z: a[1] + dz * t, ux: dx / l, uz: dz / l };
        }
      }
      return null;
    };

    const addZebra = (axisKey, key, value) => {
      const p = pointOnAxis(ROAD_AXES[axisKey], key, value);
      if (!p) return;
      const stripes = 7, stripeW = 0.5, stripeL = 3.6;
      const ang = Math.atan2(p.ux, p.uz);
      for (let i = 0; i < stripes; i++) {
        const off = -ROAD_W / 2 + (ROAD_W / stripes) * (i + 0.5);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(stripeW, stripeL), whiteMat);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(-Math.PI / 2, ang, 0);
        mesh.position.set(p.x + p.uz * off, 0.053, p.z - p.ux * off);
        markGroup.add(mesh);
      }
    };

    // línea discontinua continua a lo largo de una polilínea (3 m trazo / 4.5 m espacio)
    const addDashedPolyline = (pts, skip = () => false, dash = 3.0, gap = 4.5) => {
      let carry = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        const ux = dx / len, uz = dz / len, ang = Math.atan2(ux, uz);
        let d = carry;
        while (d < len) {
          const s0 = Math.max(d, 0), s1 = Math.min(d + dash, len);
          if (s1 > s0 + 0.05) {
            const mid = (s0 + s1) / 2, x = a[0] + ux * mid, z = a[1] + uz * mid;
            if (!skip(x, z)) {
              const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, s1 - s0), whiteMat);
              m.rotation.order = 'YXZ';
              m.rotation.set(-Math.PI / 2, ang, 0);
              m.position.set(x, 0.052, z);
              markGroup.add(m);
            }
          }
          d += dash + gap;
        }
        carry = d - len;
      }
    };

    // sin demarcación dentro de la intersección Calle 127 × Carrera 15
    const inIntersection = (x, z) => x > 72 && x < 112 && z > 36 && z < 86;
    Object.values(ROAD_AXES).forEach((pts) => addDashedPolyline(pts, inIntersection));

    // cebras en los accesos a la intersección y frente al hotel
    addZebra('eb', 'x', -12);
    addZebra('wb', 'x', -12);
    addZebra('eb', 'x', 66);
    addZebra('wb', 'x', 66);
    addZebra('sb', 'z', 28);
    addZebra('nb', 'z', 26);

    this.contextGroup.add(markGroup);
  }

  buildRealisticTrees(treePoints = [], calzadaPolys = []) {
    const treeGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x362b21,
      roughness: 0.94,
      metalness: 0.02
    });

    const speciesConfig = [
      {
        mat: this.materials.get('TREE_ROBLE'),
        name: 'Roble',
        baseHeight: 8.2,
        baseWidth: 7.8,
        trunkH: 2.8,
        cards: 8,
        discs: 4,
        puffs: 6
      },
      {
        mat: this.materials.get('TREE_SAUCO'),
        name: 'Urapan',
        baseHeight: 7.4,
        baseWidth: 4.8,
        trunkH: 2.6,
        cards: 6,
        discs: 2,
        puffs: 3
      },
      {
        mat: this.materials.get('TREE_CHICALA'),
        name: 'Chicala',
        baseHeight: 5.2,
        baseWidth: 5.4,
        trunkH: 2.0,
        cards: 6,
        discs: 3,
        puffs: 4
      },
      {
        mat: this.materials.get('TREE_FLOWER_YELLOW'),
        name: 'Guayacan',
        baseHeight: 6.8,
        baseWidth: 7.2,
        trunkH: 2.4,
        cards: 8,
        discs: 3,
        puffs: 5
      },
      {
        mat: this.materials.get('TREE_ACACIA'),
        name: 'Acacia',
        baseHeight: 4.0,
        baseWidth: 3.8,
        trunkH: 1.8,
        cards: 4,
        discs: 2,
        puffs: 2
      }
    ];

    const shadowMat = this.materials.get('TREE_SHADOW');

    const inPoly = (pt, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1];
        const xj = poly[j][0], zj = poly[j][1];
        const intersect = ((zi > pt[1]) !== (zj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const distToPolyEdge = (pt, poly) => {
      let minD = 999;
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
        const len2 = dx * dx + dz * dz;
        let t = len2 === 0 ? 0 : ((pt[0] - p1[0]) * dx + (pt[1] - p1[1]) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
        const projX = p1[0] + t * dx;
        const projZ = p1[1] + t * dz;
        const d = Math.hypot(pt[0] - projX, pt[1] - projZ);
        if (d < minD) minD = d;
      }
      return minD;
    };

    const isInsideRoadway = (x, z) => {
      if (!Array.isArray(calzadaPolys) || calzadaPolys.length === 0) return false;
      for (const poly of calzadaPolys) {
        if (!poly || poly.length < 3) continue;
        if (inPoly([x, z], poly)) return true;
        if (distToPolyEdge([x, z], poly) < 2.0) return true;
      }
      return false;
    };

    const candidatePoints = [];
    if (Array.isArray(treePoints)) {
      for (const pt of treePoints) candidatePoints.push(pt);
    }

    // Plazoleta de acceso despejada (fotos): árboles solo en los costados, nunca
    // delante de la escalinata ni dentro del edificio
    const courtyardTrees = [
      [2.0, 5.5], [2.0, 12.0], [27.3, 3.0], [26.8, 11.5], [27.5, 18.0], [25.0, -0.8], [-1.5, 18.5]
    ];
    candidatePoints.push(...courtyardTrees);

    for (let x = -75; x <= 0; x += 10.0) candidatePoints.push([x, 19.5]);
    for (let x = -75; x <= 85; x += 9.5) candidatePoints.push([x, 85.0]);
    for (let x = 12; x <= 72; x += 8.5) candidatePoints.push([x, 54.5]);
    for (let z = -90; z <= 25; z += 9.0) candidatePoints.push([100.0, z]);

    const addSafeGrove = (cx, cz, count, radius) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.sin(i * 3.7) * 0.5;
        const r = (0.25 + 0.75 * Math.abs(Math.cos(i * 2.3))) * radius;
        candidatePoints.push([+(cx + Math.cos(angle) * r).toFixed(2), +(cz + Math.sin(angle) * r).toFixed(2)]);
      }
    };
    addSafeGrove(-85, 10, 16, 14);
    addSafeGrove(45, -18, 12, 10);
    addSafeGrove(-30, -55, 15, 12);
    addSafeGrove(115, 75, 18, 15);

    // Árboles reales (texturas del archivo SKPTrees de Aleja), instanciados y con viento
    const points = [];
    for (let i = 0; i < candidatePoints.length; i++) {
      const [tx, tz] = candidatePoints[i];
      if (isInsideRoadway(tx, tz)) continue;
      const explicitTree = courtyardTrees.some(([cx, cz]) => cx === tx && cz === tz);
      if (!explicitTree && tx >= -16 && tx <= 50 && tz >= -16 && tz <= 15) {
        const inCourtyard = (tx >= 6.5 && tx <= 25.5 && tz >= -5.8 && tz <= 9.8);
        if (!inCourtyard) continue;
      }
      // plazoleta: urapanes y almeces (sin pinos ni palmas pegados a la fachada)
      points.push(explicitTree ? [tx, 0.05, tz, i % 2 ? 'ash' : 'celtis'] : [tx, 0.05, tz]);
    }
    this.realTrees = this.realTrees || new RealTrees();
    this.realTrees.plant(points, treeGroup);
    this.contextGroup.add(treeGroup);
  }

  /**
   * Tráfico vehicular animado sobre las calzadas reales (trazados medidos de los
   * polígonos de Catastro): Calle 127 (dos calzadas) y Carrera 15 (dos calzadas),
   * dos carriles por sentido con separación constante entre carros (no se chocan),
   * un taxi que da la vuelta a la fuente y carros estacionados junto a la fachada.
   */
  buildRealisticVehicles(calzadaPolys = []) {
    const carGroup = new THREE.Group();
    carGroup.userData.dynamic = true; // carros y semáforos se mueven/cambian: no se fusionan
    const carShadowMat = this.materials.get('CAR_SHADOW');
    this.trafficCars = [];

    // Ejes de calzada (x, z) — sentido de circulación = orden de los puntos
    const AXES = ROAD_AXES;
    const offsetPath = (pts, off) => pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];   // desplazamiento a la derecha
    });
    const makePath = (pts, closed = false) => {
      const P = closed ? [...pts, pts[0]] : pts;
      const cum = [0];
      for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      return { P, cum, len: cum[cum.length - 1], closed };
    };
    const lanes = [];
    const types = ['sedan', 'suv', 'taxi', 'sedan', 'suv', 'taxi', 'sedan', 'sports'];
    // Las calles usan el modelo de tráfico con semáforos (Traffic.js); aquí solo el taxi de la fuente
    // vuelta de dejada de pasajeros alrededor de la fuente (elipse)
    const loop = [];
    for (let i = 0; i < 48; i++) {
      const a = -(i / 48) * Math.PI * 2;
      loop.push([16 + Math.cos(a) * 9.0, 6.4 + Math.sin(a) * 5.4]);
    }
    lanes.push({ path: makePath(loop, true), n: 1, speed: 3.2, forceType: 'taxi' });

    const parked = [-6.0, -3.2, -0.4, 2.4, 5.2].map((x, i) => ({ pos: [x, -1.45], rot: Math.PI, type: ['suv', 'sedan', 'taxi', 'suv', 'sedan'][i] }));

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);
    const modelCache = {};
    const loadModel = (url) => loader.loadAsync(url).catch(err => { console.warn('Vehicle model load fallback for:', url, err); return null; });

    const makeCar = (type, colorIdx) => {
      const car = new THREE.Group();
      if (carShadowMat) {
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.2), carShadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.03;
        car.add(shadow);
      }
      const gltf = modelCache[type] || modelCache.sedan;
      if (gltf && gltf.scene) {
        const m = SkeletonUtils.clone(gltf.scene);
        m.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) child.material = Array.isArray(child.material) ? child.material.map(x => x.clone()) : child.material.clone();
            if (type === 'sports' && child.name === 'body' && child.material) {
              child.material.color.setHex(colorIdx % 2 ? 0x181c22 : 0xcc1824);
              child.material.metalness = 0.9; child.material.roughness = 0.18;
            }
          }
        });
        m.scale.setScalar(type === 'sports' ? 0.96 : 0.92);
        if (type === 'sports') m.rotation.y = Math.PI;
        car.add(m);
      }
      return car;
    };

    Promise.all([
      loadModel('./assets/models/sedan.glb').then(g => { if (g) modelCache.sedan = g; }),
      loadModel('./assets/models/suv.glb').then(g => { if (g) modelCache.suv = g; }),
      loadModel('./assets/models/taxi.glb').then(g => { if (g) modelCache.taxi = g; }),
      loadModel('./assets/models/ferrari.glb').then(g => { if (g) modelCache.sports = g; })
    ]).then(() => {
      let c = 0;
      lanes.forEach((lane, li) => {
        for (let i = 0; i < lane.n; i++) {
          const type = lane.forceType || types[(li * 3 + i) % types.length];
          const car = makeCar(type, c++);
          carGroup.add(car);
          // separación uniforme + desfase por carril: velocidad común en el carril ⇒ sin choques
          this.trafficCars.push({ obj: car, lane, s: (lane.path.len / lane.n) * i + li * 7.3 });
        }
      });
      parked.forEach((p, i) => {
        const car = makeCar(p.type, i);
        car.position.set(p.pos[0], 0, p.pos[1]);
        car.rotation.y = p.rot;
        carGroup.add(car);
      });
      this.updateTraffic(0);
      // Tráfico de la Calle 127 × Cra 15 con semáforos y seguimiento vehicular (sin choques)
      let k = 0;
      const mix = ['sedan', 'suv', 'sedan', 'taxi', 'suv', 'sedan', 'taxi', 'sedan'];
      this.traffic = new Traffic(ROAD_AXES, carGroup, () => makeCar(mix[k++ % mix.length], k));
    });

    this.contextGroup.add(carGroup);
  }

  updateTraffic(dt) {
    if (!this.trafficCars) return;
    for (const c of this.trafficCars) {
      const { P, cum, len } = c.lane.path;
      const ns = c.s + c.lane.speed * dt;
      const wrapped = ns >= len;
      c.s = ns % len;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < c.s) i++;
      const a = P[i - 1], b = P[i];
      const t = (c.s - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-6);
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
      c.obj.position.set(x, 0.02, z);
      // giro suave
      let d = heading - c.obj.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.obj.rotation.y += (dt > 0 && !(wrapped && !c.lane.path.closed)) ? d * Math.min(1, dt * 6) : d;
    }
  }

  update(dt) {
    this.updateTraffic(dt);
    this.traffic?.update(dt);
    this.siteDetails?.update(dt);
  }

  buildHotelMassing(footprintMm, revitWindows = []) {
    const shape = loopToShape(footprintMm);
    const pts3D = footprintMm.map(([x, y]) => [x * MM_TO_M, -y * MM_TO_M]);
    const brickMat = this.materials.get('BRICK_FACADE');
    const roofClayMat = this.materials.get('ROOF_CLAY_TILE');
    const timberEavesMat = this.materials.get('ROOF_EAVES_TIMBER');
    const stoneMat = this.materials.get('REF28');

    // ==============================================================
    // 1. Ground floor Podium / Lobby (Y = 0 to 3.0m) - 100% LADRILLO ROJO REVIT
    // ==============================================================
    const p1Geo = new THREE.ExtrudeGeometry(shape, { depth: 2.95, bevelEnabled: false });
    p1Geo.rotateX(-Math.PI / 2);
    applyArchitecturalBrickUVs(p1Geo, 1.35, 1.35);
    const p1Mesh = new THREE.Mesh(p1Geo, [brickMat, brickMat]);
    p1Mesh.castShadow = true;
    p1Mesh.receiveShadow = true;
    this.lowerBuildingGroup.add(p1Mesh);

    // Stone Cornice Band
    // Fachada real: ladrillo continuo, sin cornisas claras por piso; una sola banda de
    // ladrillo oscuro sobre el 2º piso (ver fotos de la fachada principal)
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x5a2a1d, roughness: 0.85 });
    const beltGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.02, bevelSegments: 1 });
    beltGeo.rotateX(-Math.PI / 2);

    // Iconic Lobby Entrance Canopy ("HOTEL ESTELAR LA FONTANA") in Courtyard (Photos 2 & 3)
    this.buildEntranceCanopy(16.0, 0, -3.78, 0);

    // Ground floor storefront / restaurant ribbon glazing
    this.addGroundRibbonWindows(pts3D, this.lowerBuildingGroup);

    // ==============================================================
    // 2. Piso 2 Exterior Shell with Real Bogotá Brick Facade & Exact Revit Windows
    // ==============================================================
    const p2ShellGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.92, bevelEnabled: false });
    p2ShellGeo.rotateX(-Math.PI / 2);
    applyArchitecturalBrickUVs(p2ShellGeo, 1.35, 1.35);
    const p2ShellMesh = new THREE.Mesh(p2ShellGeo, [brickMat, brickMat]);
    p2ShellMesh.position.y = 3.02;
    p2ShellMesh.castShadow = true;
    p2ShellMesh.receiveShadow = true;
    this.exteriorShellPiso2.add(p2ShellMesh);

    // Ventanas Revit ajustadas al plano de fachada (Piso 2) + vanos en fachadas sin ventanas Revit
    const allSlots = this.computeFacadeWindowSlots(pts3D, revitWindows);
    // Volumen de balcones voladizos en el extremo occidental de la fachada principal
    const inBalconyZone = (w) => Math.abs(w.z + 3.76) < 0.35 && w.x < -1.5;
    const facadeSlots = allSlots.filter((w) => !inBalconyZone(w));
    this.siteDetails.buildBalconyStack(-8.03, -1.6, -3.76, [3.0, 6.0, 9.0, 12.0], this.upperBuildingGroup);
    const p2Windows = new FacadeWindows(this.materials);
    this.facadeSets.push(p2Windows);
    facadeSlots.forEach((w) => p2Windows.add(w.x, 3.02 + 0.85, w.z, w.nx, w.nz, w.w));
    this.exteriorShellPiso2.add(p2Windows.build());
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = 5.86;
    this.exteriorShellPiso2.add(belt);
    const upperWindows = new FacadeWindows(this.materials);
    this.facadeSets.push(upperWindows);

    // ==============================================================
    // 3. Upper Floors 3 to 6 with Real Bogotá Brick Facade & Exact Revit Windows
    // ==============================================================
    for (let floor = 3; floor <= 6; floor++) {
      const yBase = (floor - 1) * 3.0;
      const floorGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.88, bevelEnabled: false });
      floorGeo.rotateX(-Math.PI / 2);
      applyArchitecturalBrickUVs(floorGeo, 1.35, 1.35);
      const floorMesh = new THREE.Mesh(floorGeo, [brickMat, brickMat]);
      floorMesh.position.y = yBase;
      floorMesh.castShadow = true;
      floorMesh.receiveShadow = true;
      this.upperBuildingGroup.add(floorMesh);

      // el piso 6 es la galería acristalada bajo el alero (RoofBuilder)
      if (floor <= 5) facadeSlots.forEach((w) => upperWindows.add(w.x, yBase + 0.85, w.z, w.nx, w.nz, w.w));
    }

    this.upperBuildingGroup.add(upperWindows.build());

    // ==============================================================
    // 4. Sloped Spanish Terracotta Clay Tile Roof with Timber Eaves (Photos 1, 2, 3)
    // ==============================================================
    const roofBaseY = 18.0;

    if (this.roofData?.main) {
      // Cubierta real a cuatro aguas con teja de barro, caballetes y alero (esqueleto recto)
      this.roofBuilder.addRoof(this.roofData.main, this.upperBuildingGroup, { gallery: true, ivyMat: this.materials.get('REVIT_WIN_IVY') });
    } else {
      // A. Overhanging Dark Timber Eaves with Rafters
      const eavesGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.28,
        bevelEnabled: true,
        bevelSize: 0.45,
        bevelThickness: 0.14,
        bevelSegments: 1
      });
      eavesGeo.rotateX(-Math.PI / 2);
      const eavesMesh = new THREE.Mesh(eavesGeo, timberEavesMat);
      eavesMesh.position.y = roofBaseY;
      eavesMesh.castShadow = true;
      this.upperBuildingGroup.add(eavesMesh);

      // B. Spanish Terracotta Clay Tile Hip Roof (Teja de barro roja)
      const roofTileGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 2.2,
        bevelEnabled: true,
        bevelSize: -0.65,
        bevelThickness: 1.2,
        bevelSegments: 2
      });
      roofTileGeo.rotateX(-Math.PI / 2);
      applyArchitecturalBrickUVs(roofTileGeo, 1.35, 1.35);
      const roofMesh = new THREE.Mesh(roofTileGeo, [roofClayMat, roofClayMat]);
      roofMesh.position.y = roofBaseY + 0.22;
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      this.upperBuildingGroup.add(roofMesh);
    }

    // C. Traditional Brick Chimneys (Photo 1 Reference)
    const chimneyPositions = [
      [34.0, 10.0], [28.0, 0.0], [12.0, 10.0], [-4.0, 8.0], [42.0, -8.0]
    ];
    chimneyPositions.filter(([cx, cz]) => pointInPolygon(cx, cz, pts3D)).forEach(([cx, cz]) => {
      const chim = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.6, 1.4), brickMat);
      applyArchitecturalBrickUVs(chim.geometry, 1.35, 1.35);
      chim.position.set(cx, roofBaseY + 2.3, cz);
      chim.castShadow = true;
      const chimCap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 1.7), stoneMat);
      chimCap.position.set(cx, roofBaseY + 4.7, cz);
      this.upperBuildingGroup.add(chim, chimCap);
    });
  }

  /**
   * Acceso principal "HOTEL ESTELAR LA FONTANA" (fotos de la fachada):
   * escalinata ancha de 6 peldaños (huella de baldosa oscura + contrahuella de ladrillo),
   * muretes laterales con materas de cipreses, marquesina negra con letrero dorado,
   * luces cálidas en el borde y el plafón, tensores al muro y portal iluminado.
   * Origen = centro del acceso sobre el plano de fachada, +z hacia el patio.
   */
  buildEntranceCanopy(cx, cy, cz, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;

    const brickMat = this.materials.get('BRICK_FACADE');
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x5b3426, roughness: 0.7 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.35 });
    const warmGlow = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb84d, emissiveIntensity: 1.6 });
    const portalMat = new THREE.MeshStandardMaterial({ color: 0xf2c98a, emissive: 0xe8a050, emissiveIntensity: 0.55, roughness: 0.6 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8e3f25, roughness: 0.8 });
    const cypressMat = new THREE.MeshStandardMaterial({ color: 0x2f4a26, roughness: 0.9 });

    // 1. Escalinata: 6 peldaños, contrahuella 0.17, huella 0.36, ancho 13 m
    const W = 13.0, RISE = 0.17, RUN = 0.36, N = 6, LANDING = 1.3;
    const landingY = N * RISE;
    for (let s = 0; s < N; s++) {
      const depth = LANDING + (N - s) * RUN;
      const geo = new THREE.BoxGeometry(W - s * 0.12, RISE, depth);
      applyArchitecturalBrickUVs(geo, 1.35, 1.35);
      // grupos BoxGeometry: +x,-x,+y,-y,+z,-z → huella oscura arriba, ladrillo en contrahuella
      const step = new THREE.Mesh(geo, [brickMat, brickMat, treadMat, treadMat, brickMat, brickMat]);
      step.position.set(0, s * RISE + RISE / 2, depth / 2);
      step.castShadow = true;
      step.receiveShadow = true;
      g.add(step);
    }

    // 2. Muretes laterales escalonados con materas y cipreses
    [-1, 1].forEach((side) => {
      const wallGeo = new THREE.BoxGeometry(0.5, landingY + 0.45, LANDING + N * RUN);
      applyArchitecturalBrickUVs(wallGeo, 1.35, 1.35);
      const wall = new THREE.Mesh(wallGeo, brickMat);
      wall.position.set(side * (W / 2 + 0.25), (landingY + 0.45) / 2, (LANDING + N * RUN) / 2);
      wall.castShadow = true;
      g.add(wall);
      for (let k = 0; k < 3; k++) {
        const z = 0.6 + k * 1.15, y = landingY + 0.45;
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 14), potMat);
        pot.position.set(side * (W / 2 - 0.6), landingY + 0.27, z);
        const tree = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.1 - k * 0.3, 10), cypressMat);
        tree.position.set(side * (W / 2 - 0.6), landingY + 0.55 + (2.1 - k * 0.3) / 2, z);
        tree.castShadow = true;
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), cypressMat);
        top.position.set(side * (W / 2 + 0.25), y + 0.3, z);
        g.add(pot, tree, top);
      }
    });

    // 3. Portal iluminado del lobby (vanos cálidos detrás de la marquesina)
    for (let i = -2; i <= 2; i++) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8), portalMat);
      v.position.set(i * 2.45, landingY + 1.4, 0.06);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.0, 0.08), blackMat);
      fr.position.set(i * 2.45, landingY + 1.5, 0.02);
      g.add(fr, v);
    }

    // 4. Marquesina negra con letrero "HOTEL ESTELAR LA FONTANA"
    const CW = 13.6, CD = 3.4, CH = 0.55, cy0 = landingY + 3.35;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), blackMat);
    canopy.position.set(0, cy0, CD / 2);
    canopy.castShadow = true;
    g.add(canopy);

    const c = document.createElement('canvas');
    c.width = 2048; c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = '#121212'; x.fillRect(0, 0, 2048, 96);
    x.fillStyle = '#d8b46a';
    x.font = '600 58px Georgia, "Times New Roman", serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (x.letterSpacing !== undefined) x.letterSpacing = '6px';
    x.fillText('HOTEL ESTELAR LA FONTANA', 1024, 50);
    const signTex = new THREE.CanvasTexture(c);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH),
      new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 }));
    sign.position.set(0, cy0, CD + 0.006);
    g.add(sign);

    // fleco de hierro calado (como en las fotos)
    const valMat = this.siteDetails ? this.siteDetails.makeValanceMaterial() : null;
    if (valMat) {
      const vf = new THREE.Mesh(new THREE.PlaneGeometry(CW, 0.42), valMat.clone());
      vf.material.map = valMat.map.clone(); vf.material.map.needsUpdate = true; vf.material.map.repeat.set(CW / 0.9, 1);
      vf.position.set(0, cy0 - CH / 2 - 0.2, CD + 0.01);
      g.add(vf);
      [-1, 1].forEach((sd) => {
        const vs = new THREE.Mesh(new THREE.PlaneGeometry(CD, 0.42), valMat);
        vs.material.map.repeat.set(CD / 0.9, 1);
        vs.position.set(sd * (CW / 2 + 0.01), cy0 - CH / 2 - 0.2, CD / 2);
        vs.rotation.y = Math.PI / 2;
        g.add(vs);
      });
    }

    // luces: guirnalda en el borde inferior + plafón
    const bulbGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const lights = [];
    for (let t = -CW / 2 + 0.2; t <= CW / 2 - 0.2; t += 0.45) lights.push([t, cy0 - CH / 2 - 0.05, CD - 0.05]);
    for (let r = 0; r < 3; r++) for (let t = -CW / 2 + 0.8; t <= CW / 2 - 0.8; t += 1.3) lights.push([t, cy0 - CH / 2 - 0.03, 0.7 + r * 1.0]);
    const inst = new THREE.InstancedMesh(bulbGeo, warmGlow, lights.length);
    const m = new THREE.Matrix4();
    lights.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m); });
    g.add(inst);
    const pl = new THREE.PointLight(0xffc070, 6, 9, 2);
    pl.position.set(0, cy0 - 0.8, CD / 2);
    g.add(pl);

    // tensores al muro
    [-5.2, 0, 5.2].forEach((tx) => {
      const a = new THREE.Vector3(tx, cy0 + 0.2, CD - 0.2), b = new THREE.Vector3(tx, cy0 + 2.6, 0.05);
      const len = a.distanceTo(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), blackMat);
      rod.position.copy(a).add(b).multiplyScalar(0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(rod);
    });

    this.lowerBuildingGroup.add(g);
  }

  addGroundRibbonWindows(pts3D, targetGroup) {
    if (!Array.isArray(pts3D) || pts3D.length < 3) return;
    const frameMat = this.materials.get('REVIT_WIN_FRAME');
    const glassMat = this.materials.get('REVIT_WIN_GLASS_LIT');

    for (let i = 0; i < pts3D.length; i++) {
      const p1 = pts3D[i];
      const p2 = pts3D[(i + 1) % pts3D.length];
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const len = Math.hypot(dx, dz);
      if (len < 3.5) continue;

      const numBays = Math.max(1, Math.floor(len / 3.2));
      const spacing = len / (numBays + 1);
      const dirX = dx / len;
      const dirZ = dz / len;
      const rotY = Math.atan2(-dirZ, dirX);

      for (let k = 1; k <= numBays; k++) {
        const wx = p1[0] + dirX * k * spacing;
        const wz = p1[1] + dirZ * k * spacing;
        const win = new THREE.Group();

        const f = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.12), frameMat);
        const g = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), glassMat);
        g.position.z = 0.02;
        win.add(f, g);

        win.position.set(wx, 1.45, wz);
        win.rotation.y = rotY;
        targetGroup.add(win);
      }
    }
  }

  /**
   * Ajusta las ventanas Revit al plano real de la fachada (algunas venían desplazadas
   * hasta 1.2 m del muro), las orienta con la normal exterior, elimina duplicados y
   * completa con vanos regulares las fachadas que no tienen ventanas Revit.
   */
  computeFacadeWindowSlots(pts, revitWindows = []) {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sgn = area > 0 ? 1 : -1;
    const edges = pts.map((a, i) => {
      const b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      return { a, ux, uz, len, nx: sgn * uz, nz: -sgn * ux, slots: [] };
    });
    (revitWindows || []).forEach((w) => {
      if (!w || !w.pos) return;
      let best = null;
      edges.forEach((e) => {
        const t = Math.max(0.6, Math.min(e.len - 0.6, (w.pos[0] - e.a[0]) * e.ux + (w.pos[1] - e.a[1]) * e.uz));
        const px = e.a[0] + e.ux * t, pz = e.a[1] + e.uz * t;
        const d = Math.hypot(w.pos[0] - px, w.pos[1] - pz);
        if (!best || d < best.d) best = { e, t, d };
      });
      if (!best || best.d > 1.5 || best.e.len < 1.4) return;
      if (best.e.slots.some((s) => Math.abs(s.t - best.t) < 1.0)) return;
      best.e.slots.push({ t: best.t, w: Math.max(0.9, Math.min(1.4, (w.width || 1.2) * 1.3)) });
    });
    const out = [];
    edges.forEach((e) => {
      if (!e.slots.length && e.len >= 2.4) {
        const k = Math.max(1, Math.floor((e.len - 0.6) / 2.7));
        for (let i = 0; i < k; i++) e.slots.push({ t: (e.len / k) * (i + 0.5), w: 1.2 });
      }
      e.slots.forEach((s) => out.push({ x: e.a[0] + e.ux * s.t, z: e.a[1] + e.uz * s.t, nx: e.nx, nz: e.nz, w: s.w }));
    });
    return out;
  }

  addWindowsAlongPolygon(pts3D, yFloorBase, floorHeight, targetGroup) {
    if (!Array.isArray(pts3D) || pts3D.length < 3) return;

    const winW = 1.34;
    const winH = 1.50;
    const sillY = yFloorBase + 0.85;

    for (let i = 0; i < pts3D.length; i++) {
      const p1 = pts3D[i];
      const p2 = pts3D[(i + 1) % pts3D.length];
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const len = Math.hypot(dx, dz);
      if (len < 2.5) continue;

      const numWindows = Math.max(1, Math.floor(len / 3.0));
      const spacing = len / (numWindows + 1);
      const dirX = dx / len;
      const dirZ = dz / len;
      const outNx = -dirZ;
      const outNz = dirX;
      const rotY = Math.atan2(outNx, outNz);

      for (let k = 1; k <= numWindows; k++) {
        const distAlong = k * spacing;
        const wx = p1[0] + dirX * distAlong;
        const wz = p1[1] + dirZ * distAlong;
        const wy = sillY;

        const isLit = (k + i) % 3 !== 0;
        const win = this.createRevitWindowComponent(winW, winH, isLit);
        win.position.set(wx, wy, wz);
        win.rotation.y = rotY;
        targetGroup.add(win);
      }
    }
  }
}
