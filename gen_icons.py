"""
gen_icons.py — genera los iconos PWA/iOS de El Oso Gym desde la mascota raster.
Fuente de verdad: assets/osos-src/dumbbell.png (1024 transparente, Ideogram).
Salida: icon-512.png, icon-192.png, apple-touch-icon-180.png (fondo lila sólido, sin alfa para iOS).

Correr si se cambia la mascota: python gen_icons.py   (requiere Pillow)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "assets", "osos-src", "dumbbell.png")
BG = (196, 167, 255)  # #c4a7ff — fondo de marca (accent lila)
CANVAS = 1024
BEAR = 880            # tamaño del oso dentro del lienzo (safe-zone maskable ~86%)

# 1. Lienzo de marca + oso centrado
bear = Image.open(SRC).convert("RGBA").resize((BEAR, BEAR), Image.LANCZOS)
master = Image.new("RGBA", (CANVAS, CANVAS), BG + (255,))
off = (CANVAS - BEAR) // 2
master.alpha_composite(bear, (off, off))
flat = master.convert("RGB")  # sin alfa (iOS no soporta transparencia en app icon)

# 2. Downscale alta calidad a cada tamaño
targets = {"icon-512.png": 512, "icon-192.png": 192, "apple-touch-icon-180.png": 180}
for name, size in targets.items():
    img = flat.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(ROOT, name), "PNG", optimize=True)
    print(f"  OK {name} ({size}x{size})")
print("Iconos generados.")
