const fs = require('fs');
const path = require('path');

const lon0 = -74.043696;
const lat0 = 4.704585;
const M_PER_DEG_LON = 110945;
const M_PER_DEG_LAT = 110574;
const ALIGN_DX = -13.47;
const ALIGN_DZ = 7.15;

function toThree(lon, lat) {
  const x = (lon - lon0) * M_PER_DEG_LON + ALIGN_DX;
  const z = -(lat - lat0) * M_PER_DEG_LAT + ALIGN_DZ;
  return [parseFloat(x.toFixed(2)), parseFloat(z.toFixed(2))];
}

function extractPolygons(geoJsonPath) {
  if (!fs.existsSync(geoJsonPath)) return [];
  const raw = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  const polys = [];

  for (const f of raw.features || []) {
    if (!f.geometry) continue;
    const type = f.geometry.type;
    const coords = f.geometry.coordinates;

    if (type === 'Polygon') {
      if (coords[0] && coords[0].length >= 3) {
        polys.push(coords[0].map(([lon, lat]) => toThree(lon, lat)));
      }
    } else if (type === 'MultiPolygon') {
      for (const poly of coords) {
        if (poly[0] && poly[0].length >= 3) {
          polys.push(poly[0].map(([lon, lat]) => toThree(lon, lat)));
        }
      }
    }
  }
  return polys;
}

function extractPoints(geoJsonPath) {
  if (!fs.existsSync(geoJsonPath)) return [];
  const raw = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  const pts = [];

  for (const f of raw.features || []) {
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    const pt = toThree(lon, lat);
    // Filter within 240m radius
    if (Math.hypot(pt[0], pt[1]) <= 240) {
      pts.push(pt);
    }
  }
  return pts;
}

const geomDir = path.join(__dirname, '../data/geometry');

const dataset = {
  calzadas: extractPolygons(path.join(geomDir, 'urban-calzadas.json')),
  andenes: extractPolygons(path.join(geomDir, 'urban-andenes.json')),
  separadores: extractPolygons(path.join(geomDir, 'urban-separadores.json')),
  ciclorrutas: extractPolygons(path.join(geomDir, 'urban-ciclorrutas.json')),
  arboles: extractPoints(path.join(geomDir, 'urban-arbolado.json'))
};

const outPath = path.join(geomDir, 'urban-roads-trees-3d.json');
fs.writeFileSync(outPath, JSON.stringify(dataset), 'utf8');

console.log('Generated urban-roads-trees-3d.json:');
console.log(' - Calzadas (Roadways):', dataset.calzadas.length);
console.log(' - Andenes (Sidewalks):', dataset.andenes.length);
console.log(' - Separadores / Alamedas:', dataset.separadores.length);
console.log(' - Ciclorrutas (Bikeways):', dataset.ciclorrutas.length);
console.log(' - Arboles (Trees JBB):', dataset.arboles.length);
console.log('File size:', Math.round(fs.statSync(outPath).size / 1024), 'KB');
