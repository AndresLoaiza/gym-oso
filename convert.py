import os, glob
from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()

src = "photos"
dst = "photos_jpg"
os.makedirs(dst, exist_ok=True)

for f in sorted(glob.glob(f"{src}/*.HEIC")):
    name = os.path.splitext(os.path.basename(f))[0]
    out = f"{dst}/{name}.jpg"
    if os.path.exists(out):
        continue
    img = Image.open(f)
    # Resize keeping aspect, max 1024 long side
    img.thumbnail((1024, 1024))
    img.save(out, "JPEG", quality=85)
    print(out, img.size)
print("done")
