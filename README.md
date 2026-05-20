# El Oso Gym

App PWA de entrenamiento personal para preparación de trekking nivel 4, adaptada a Síndrome de Dolor Patelofemoral (PFPS).

**Demo:** https://andresloaiza.github.io/gym-oso/

## Stack

- HTML + CSS + JS vanilla en `index.html` (~1000 líneas)
- `manifest.json` + `sw.js` → PWA instalable
- `catalogo-imgs.js` → catálogo de 25 máquinas del gym con thumbnails base64
- Chart.js (CDN) para gráficas de progreso
- Anthropic API (opcional) para regenerar plan con IA
- localStorage clave `elosoGymV2`

## Features

- Onboarding 4 pasos con test de baseline (fórmula Epley para 1RM estimado)
- Plan 8 semanas periodizado (adaptación → fuerza → resistencia trekking → taper)
- Reglas PFPS automáticas: ROM parcial, vasto medial oblicuo, cardio bajo impacto
- Catálogo de 25 máquinas con tags de seguridad (safe / caution / avoid)
- Sesión interactiva: kg/reps por serie, timer descanso 1:30/3:00 con vibración
- Historial + gráfica peso máx + reps prom por ejercicio
- Glosario clickeable (RIR, ROM, PFPS, VMO, 1RM, Epley)
- Wake lock pantalla (no se apaga durante sesión)
- Funciona offline (service worker)

## Instalar en iPhone

1. Abrir https://andresloaiza.github.io/gym-oso/ en Safari
2. Compartir → "Añadir a pantalla de inicio"
3. Abre como app standalone

## Desarrollo local

```bash
# Servidor estático (Python 3)
python -m http.server 8080
# Abrir http://localhost:8080
```

> Service worker requiere HTTPS o localhost. No funciona con `file://`.

## Regenerar thumbnails

Si cambias el catálogo de máquinas:

```bash
# Convertir HEIC a JPG (requiere pillow-heif)
pip install pillow-heif Pillow
python convert.py

# Generar catalogo-imgs.js con base64
python gen_thumbs.py
```

## Estructura de localStorage

```json
{
  "profile": { "weight":75, "height":175, "age":32, "knee":"bien",
               "baseline":{ "legPress1RM":42, "w":30, "r":12 } },
  "apiKey": "sk-ant-…",
  "plan": { "start":"2026-05-20", "weeks":[[{...}]] },
  "sessions": [{ "date":"...", "exercises":[...] }],
  "sessionSets": {},
  "settings": { "wake": false }
}
```
