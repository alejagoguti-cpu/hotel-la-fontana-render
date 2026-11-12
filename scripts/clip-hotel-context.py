"""
clip-hotel-context.py — Elimina los choques entre los volúmenes de Catastro del hotel
y el ala modelada en Revit (Piso 2 + pisos superiores).

Resta la huella Revit (con 0.25 m de holgura) a cada volumen de Catastro marcado
isHotel que la intersecta, y reescribe data/geometry/catastro-buildings-3d.json.
Si un volumen queda partido, se conservan las piezas mayores de 8 m².

Uso:  pip install shapely
      python3 scripts/clip-hotel-context.py
      NODE_PATH=... node scripts/build-roofs.cjs   (regenerar cubiertas)
"""
import json, math, os
from shapely.geometry import Polygon, MultiPolygon
from shapely.geometry.polygon import orient

ROOT = os.path.join(os.path.dirname(__file__), '..')
CAT = os.path.join(ROOT, 'data/geometry/catastro-buildings-3d.json')
ARCH = os.path.join(ROOT, 'data/geometry/p2-architecture.json')

cat = json.load(open(CAT))
arch = json.load(open(ARCH))
loop = arch['slabLoops'][0]['loops'][0]
main = Polygon([(x / 1000, -y / 1000) for x, y in loop]).buffer(0.25, join_style=2)

out, changed = [], 0
for b in cat:
    skipped_by_builder = b.get('isHotel') and math.hypot(b['center'][0] - 16, b['center'][1] - 1) < 22
    if not b.get('isHotel') or skipped_by_builder or not b.get('pts'):
        out.append(b)
        continue
    P = Polygon(b['pts']).buffer(0)
    if P.intersection(main).area < 0.5:
        out.append(b)
        continue
    D = P.difference(main)
    parts = list(D.geoms) if isinstance(D, MultiPolygon) else [D]
    parts = [p for p in parts if p.area >= 8]
    changed += 1
    for k, p in enumerate(parts):
        p = orient(p.simplify(0.05), 1.0)
        nb = dict(b)
        nb['pts'] = [[round(x, 2), round(z, 2)] for x, z in list(p.exterior.coords)[:-1]]
        nb['center'] = [round(p.centroid.x, 2), round(p.centroid.y, 2)]
        if k:
            nb['id'] = f"{b['id']}-{k}"
        out.append(nb)

json.dump(out, open(CAT, 'w'), separators=(',', ':'))
print(f'volúmenes recortados: {changed} → total {len(out)}')
