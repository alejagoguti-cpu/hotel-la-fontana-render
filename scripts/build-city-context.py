"""Descarga las construcciones de Catastro Bogotá (servicio ArcGIS público) en un radio
alrededor del Hotel La Fontana y las guarda compactas para el contexto urbano 3D.

Salida: data/geometry/city-context.json
  {"v":1, "b":[[altura_dm, x0_dm, z0_dm, dx1, dz1, ...], ...]}  (coordenadas locales de la escena,
  delta-codificadas en decímetros; X = este, Z = sur, igual que process-catastro.cjs)
Uso: python3 scripts/build-city-context.py [radio_m] [carpeta_cache]
"""
import json, math, os, sys, time, urllib.request, urllib.parse

B = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/construccion/MapServer/0/query"
LON0, LAT0 = -74.043696, 4.704585
MLON, MLAT = 110945, 110574
ALIGN_DX, ALIGN_DZ = -13.47, 7.15
HOTEL_LOTE = "008401019001"

R = float(sys.argv[1]) if len(sys.argv) > 1 else 1100
CACHE = sys.argv[2] if len(sys.argv) > 2 else None
N = 6
dlon, dlat = R / MLON, R / MLAT


def fetch_cell(i, j):
    fn = CACHE and os.path.join(CACHE, f"t_{i}_{j}.json")
    if fn and os.path.exists(fn):
        return json.load(open(fn))
    x0 = LON0 - dlon + 2 * dlon * i / N; x1 = x0 + 2 * dlon / N
    y0 = LAT0 - dlat + 2 * dlat * j / N; y1 = y0 + 2 * dlat / N
    feats, off = [], 0
    while True:
        q = dict(where="1=1", geometry=f"{x0},{y0},{x1},{y1}", geometryType="esriGeometryEnvelope",
                 inSR=4326, outSR=4326, spatialRel="esriSpatialRelIntersects",
                 outFields="CONNPISOS,CONALTURA,LOTECODIGO", returnGeometry="true",
                 geometryPrecision=6, f="json", resultOffset=off, resultRecordCount=2000)
        d = None
        for a in range(8):
            try:
                d = json.load(urllib.request.urlopen(B + "?" + urllib.parse.urlencode(q), timeout=90))
                break
            except Exception as e:
                print("reintento", i, j, e, flush=True); time.sleep(3 + a * 2)
        if d is None:
            raise SystemExit("Catastro no respondió")
        fs = d.get("features", []); feats += fs; off += len(fs)
        if not d.get("exceededTransferLimit") or not fs:
            break
    if fn:
        json.dump(feats, open(fn, "w"))
    print(f"celda {i},{j}: {len(feats)}", flush=True)
    return feats


def area(p):
    return 0.5 * sum(p[k][0] * p[(k + 1) % len(p)][1] - p[(k + 1) % len(p)][0] * p[k][1] for k in range(len(p)))


out, seen = [], set()
for i in range(N):
    for j in range(N):
        for f in fetch_cell(i, j):
            a = f.get("attributes", {})
            if a.get("LOTECODIGO") == HOTEL_LOTE:
                continue
            for ring in f.get("geometry", {}).get("rings", [])[:1]:
                pts = [((lon - LON0) * MLON + ALIGN_DX, -(lat - LAT0) * MLAT + ALIGN_DZ) for lon, lat in ring]
                if len(pts) > 3 and pts[0] == pts[-1]:
                    pts = pts[:-1]
                # simplificación: quita vértices a menos de 0.6 m del anterior
                simp = [pts[0]]
                for p in pts[1:]:
                    if math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) > 0.6:
                        simp.append(p)
                if len(simp) < 3 or abs(area(simp)) < 12:
                    continue
                cx = sum(p[0] for p in simp) / len(simp); cz = sum(p[1] for p in simp) / len(simp)
                if math.hypot(cx, cz) > R:
                    continue
                key = (round(cx, 1), round(cz, 1))
                if key in seen:
                    continue
                seen.add(key)
                h = a.get("CONALTURA") or 0
                fl = a.get("CONNPISOS") or 1
                if not h or h <= 0:
                    h = max(3.0, fl * 2.9)
                h = min(h, 140)
                q = [round(v * 10) for p in simp for v in p]
                rec = [round(h * 10), q[0], q[1]]
                for k in range(2, len(q)):
                    rec.append(q[k] - q[k - 2])
                out.append(rec)

os.makedirs("data/geometry", exist_ok=True)
with open("data/geometry/city-context.json", "w") as fh:
    json.dump({"v": 1, "r": R, "b": out}, fh, separators=(",", ":"))
print("edificios:", len(out), "bytes:", os.path.getsize("data/geometry/city-context.json"))
