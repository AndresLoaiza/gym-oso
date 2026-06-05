"""
gen_icons.py — genera los iconos PWA/iOS de El Oso Gym desde la mascota (oso con mancuerna).
Fuente de verdad: BEARS.dumbbell en index.html (design system). Render SVG→PNG con svglib+reportlab.
Salida: icon-512.png, icon-192.png, apple-touch-icon-180.png (fondo sólido #0a0a0a, sin transparencia).

Uso: pip install svglib reportlab Pillow ; python gen_icons.py
"""
import re, os
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
# Icono de marca: fondo lila (accent) + oso oscuro monocromo + detalles blancos = alto contraste a tamaño home-screen.
BG = "#c4a7ff"      # fondo = color de marca (accent lila)
INK = "#17171c"     # acentos del oso que eran lila → oscuros (placas, ojos, orejas internas)

# 1. Extraer el oso "dumbbell" (pose-logo) de index.html
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
m = re.search(r"dumbbell:\s*`(<svg.*?</svg>)`", html, re.S)
if not m:
    raise SystemExit("No se encontró BEARS.dumbbell en index.html")
bear = m.group(1)
inner = re.sub(r"^<svg[^>]*>", "", bear)
inner = re.sub(r"</svg>\s*$", "", inner)
# El fondo es lila → recolorear los acentos lila del oso a oscuro (si no, se funden con el fondo)
inner = inner.replace("#c4a7ff", INK)

# 2. Master 1024: fondo de marca + oso centrado en safe-zone (~74%, dentro del 80% maskable)
#    Bear art ~100x100 (y 3..92). scale 7.6 → 760px; centrado x132; y150.
master = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
    f'<rect width="1024" height="1024" fill="{BG}"/>'
    '<g transform="translate(132,150) scale(7.6)">'
    f'{inner}'
    '</g></svg>'
)
master_path = os.path.join(ROOT, "_icon_master.svg")
open(master_path, "w", encoding="utf-8").write(master)

# 3. Render a PNG 1024
drawing = svg2rlg(master_path)
png1024 = os.path.join(ROOT, "_icon_1024.png")
renderPM.drawToFile(drawing, png1024, fmt="PNG")

# 4. Downscale con Pillow (alta calidad) + aplanar sobre fondo sólido (sin alfa para iOS)
base = Image.open(png1024).convert("RGBA")
flat = Image.new("RGBA", base.size, BG)
flat.alpha_composite(base)
flat = flat.convert("RGB")

targets = {"icon-512.png": 512, "icon-192.png": 192, "apple-touch-icon-180.png": 180}
for name, size in targets.items():
    img = flat.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(ROOT, name), "PNG", optimize=True)
    print(f"  OK {name} ({size}x{size})")

# limpieza de intermedios
for f in (master_path, png1024):
    try: os.remove(f)
    except OSError: pass
print("Iconos generados.")
