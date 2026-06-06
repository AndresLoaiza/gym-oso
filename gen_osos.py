# -*- coding: utf-8 -*-
"""
Genera osos-imgs.js (mascota El Oso Gym en base64) desde assets/osos-src/*.png.

Fuente: PNG 1024x1024 transparentes generados con Ideogram
        (ver tools/ideogram_gen.py + memoria reference-ideogram).
Salida: osos-imgs.js  ->  const BEARS_PNG = { rest:"data:image/png;base64,..." , ... }

Optimiza: resize a 384px (nitido a 140px@2x retina) + quantize 96 colores
(ilustracion plana, pocos colores) preservando alpha -> ~15-30 KB c/u.

Correr si se regeneran los osos. Requiere Pillow.
"""
import base64, io, pathlib
from PIL import Image

SRC = pathlib.Path(__file__).parent / "assets" / "osos-src"
OUT = pathlib.Path(__file__).parent / "osos-imgs.js"
NAMES = ["rest", "dumbbell", "press", "bike", "stairs"]
SIZE = 384
COLORS = 96

entries = []
for name in NAMES:
    img = Image.open(SRC / f"{name}.png").convert("RGBA")
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    # quantize preservando transparencia (FASTOCTREE soporta alpha)
    q = img.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE)
    buf = io.BytesIO()
    q.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    kb = len(buf.getvalue()) // 1024
    entries.append(f'  {name}: "data:image/png;base64,{b64}"')
    print(f"[{name}] {kb} KB")

js = ("/* Mascota El Oso Gym — 5 osos PNG base64 (Ideogram). Generado por gen_osos.py. */\n"
      "const BEARS_PNG = {\n" + ",\n".join(entries) + "\n};\n")
OUT.write_text(js, encoding="utf-8")
total = len(js) // 1024
print(f"-> {OUT.name} ({total} KB total)")
