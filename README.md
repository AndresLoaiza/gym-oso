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

## Sync automático con GitHub Gist (multi-dispositivo)

Backup automático de toda tu data (perfil, plan, historial, sesiones) en un **Gist privado** de GitHub. Sincroniza ~4s después de cada cambio. Gratis, sin servidor, token revocable.

### Setup (una sola vez)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → *Generate new token*
2. Permisos: **solo `Gists: Read and Write`** (nada más). Define una expiración si quieres.
3. Copia el token (`github_pat_...`).
4. En la app: **Config → ☁️ Sync con GitHub Gist** → pega el token → activa *Sync automático*.
5. Pulsa **⬆ Sincronizar ahora**. La app crea el Gist privado y muestra el **Gist ID**.

### Usar en otro dispositivo

1. En el equipo nuevo: Config → pega el **mismo token** + el **Gist ID** (cópialo del equipo original).
2. Pulsa **⬇ Restaurar** → recarga la app. Tienes toda tu data.

### Notas de seguridad

- El token vive en `localStorage` de tu dispositivo. Está scopeado **solo a Gists** y puedes **revocarlo** en GitHub cuando quieras.
- Un Gist "secret" (`public:false`) es **no listado**, pero accesible por su URL sin autenticación. La data **no va cifrada**. El Gist ID (32 hex) no es adivinable. Para datos de entrenamiento personales es un riesgo bajo y aceptable; no metas nada que no quieras que exista en un Gist.
- La **telemetría NO se sincroniza** (se excluye del payload; puede pesar 100KB+).

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
