const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../data/geometry/context-buildings.json');
const outPath = path.join(__dirname, '../data/geometry/catastro-buildings-3d.json');

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

// Center of Hotel Estelar La Fontana
const lon0 = -74.043696;
const lat0 = 4.704585;

// Coordinate conversion factors for Bogota (lat ~4.7)
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 110945;

// Offset to align Catastro parcel center with Revit wing center
const ALIGN_DX = -13.47;
const ALIGN_DZ = 7.15;

const processedBuildings = [];

for (const feature of raw.features) {
  const props = feature.properties || {};
  const isHotel = props.LOTECODIGO === '008401019001';
  const floors = parseInt(props.CONNPISOS, 10) || (isHotel ? 6 : 3);
  let height = parseFloat(props.CONALTURA);
  if (!height || height <= 0) {
    height = Math.max(3.2, floors * 3.1);
  }

  // Get outer polygon ring
  let rings;
  if (feature.geometry.type === 'Polygon') {
    rings = [feature.geometry.coordinates[0]];
  } else if (feature.geometry.type === 'MultiPolygon') {
    rings = feature.geometry.coordinates.map(poly => poly[0]);
  } else {
    continue;
  }

  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;

    // Convert to Three.js coordinates (X: East, Z: South, so -Z is North)
    let cx = 0;
    let cz = 0;
    const pts = ring.map(([lon, lat]) => {
      const x = (lon - lon0) * M_PER_DEG_LON + ALIGN_DX;
      const z = -(lat - lat0) * M_PER_DEG_LAT + ALIGN_DZ;
      cx += x;
      cz += z;
      return [parseFloat(x.toFixed(2)), parseFloat(z.toFixed(2))];
    });

    cx /= ring.length;
    cz /= ring.length;

    // Filter to radius of 260m from hotel
    const dist = Math.hypot(cx, cz);
    if (dist > 260 && !isHotel) continue;

    processedBuildings.push({
      id: props.CONCODIGO || `BLD-${processedBuildings.length}`,
      isHotel,
      floors,
      height: parseFloat(height.toFixed(2)),
      center: [parseFloat(cx.toFixed(2)), parseFloat(cz.toFixed(2))],
      pts
    });
  }
}

fs.writeFileSync(outPath, JSON.stringify(processedBuildings), 'utf8');
console.log(`Successfully generated ${processedBuildings.length} 3D Catastro buildings in ${outPath}`);
