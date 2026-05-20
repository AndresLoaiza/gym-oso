import os, glob, base64, io, json
from PIL import Image

# Mapeo id catálogo → archivo IMG
MAPPING = {
    'pec_deck_polea':'IMG_6100','banco_declinado':'IMG_6101','banco_plano':'IMG_6102',
    'press_hombros_pl':'IMG_6103','remo_isolateral':'IMG_6104','tirador_largo':'IMG_6105',
    'pulldown':'IMG_6106','press_hombros_107':'IMG_6107','camber_curl':'IMG_6108',
    'curl_femoral':'IMG_6109','stairmaster':'IMG_6110','trotadora':'IMG_6111',
    'pantorrilla_sentado':'IMG_6112','jaula_crossover':'IMG_6113','hiper_inversa':'IMG_6114',
    'sentadilla_hack':'IMG_6115','adductor_abductor':'IMG_6116','jack_squat':'IMG_6117',
    'leg_press_45':'IMG_6118','rack_barras':'IMG_6119','crossover':'IMG_6120',
    'rack_ez':'IMG_6122','mancuernas':'IMG_6123','prone_leg_curl':'IMG_6124','leg_ext':'IMG_6125'
}

out = {}
src = 'photos_jpg'
for cid, img_name in MAPPING.items():
    path = os.path.join(src, img_name + '.jpg')
    if not os.path.exists(path):
        print('MISS', path); continue
    img = Image.open(path)
    img.thumbnail((220, 220))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=70, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    out[cid] = 'data:image/jpeg;base64,' + b64
    print(cid, len(b64)//1024, 'KB')

js = 'window.CAT_IMGS = ' + json.dumps(out) + ';'
with open('catalogo-imgs.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('total bytes', sum(len(v) for v in out.values())//1024, 'KB')
