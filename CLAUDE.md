# El Oso Gym — CLAUDE.md

## Contexto del proyecto

App web móvil PWA de entrenamiento para **Andrés "El Oso" Loaiza** (Medellín). Objetivo: preparación física para **trekking nivel 4** con plan adaptado a **Síndrome de Dolor Patelofemoral (PFPS)**. Sin fecha fija para el trek — preparación continua.

**Repo:** https://github.com/AndresLoaiza/gym-oso
**URL pública:** https://andresloaiza.github.io/gym-oso/
**Archivo principal:** `index.html` — toda la app en un solo archivo HTML/CSS/JS, sin frameworks.

-----

## Usuario

- **Nivel:** Principiante en gimnasio
- **Frecuencia:** 2-3 días por semana
- **Condición clínica:** Síndrome de Dolor Patelofemoral (PFPS). Reglas duras del plan:
  - Sin flexión de rodilla bajo carga >30° (en sentadilla/prensa: no pasar 90° en la articulación)
  - Priorizar Vasto Medial Oblicuo (VMO) → abducción cadera, sentadilla con rotación externa
  - Leg Extension solo arco corto (últimos 30°), carga baja
  - Cardio bajo impacto: StairMaster progresivo, caminata inclinada 10-12%, bici
  - Evitar: trotar, box jumps, plyometría, lunges profundos
- **Gimnasio:** Gatehouse Gym & Wellness (Medellín) — 25 máquinas catalogadas
- **Dispositivo principal:** iPhone 15 Pro Max (PWA instalable)
- **Idioma:** Todo en español

-----

## Stack

- `index.html` (~1300 líneas HTML + CSS + JS inline, sin frameworks ni bundlers)
- `manifest.json` + `sw.js` → PWA instalable + offline cache
- `catalogo-imgs.js` → 25 thumbnails base64 (229 KB)
- `Chart.js@4.4.1` vía CDN para gráficas
- Anthropic API (`claude-sonnet-4-20250514`) opcional — solo para regenerar plan con IA. API key se guarda en localStorage del navegador.
- Persistencia: `localStorage` clave **`elosoGymV2`**
- Fuentes: Google Fonts (Bebas Neue, DM Sans, DM Mono)
- Theme: dark + acento lila violeta `#c4a7ff`, acento2 naranja `#ff6b35`

## Scripts auxiliares

- `convert.py` — convierte HEIC → JPG (requiere `pillow-heif`, `Pillow`)
- `gen_thumbs.py` — genera `catalogo-imgs.js` (thumbnails 220px JPEG q70 base64)

-----

## Estructura del localStorage

```json
{
  "profile": { "weight":75, "height":175, "age":32, "knee":"bien",
               "baseline":{ "legPress1RM":42, "w":30, "r":12, "date":"..." } },
  "apiKey": "sk-ant-…",
  "plan": { "start":"YYYY-MM-DD", "weeks":[[{focus,notes,exercises:[...]}, ...]], "generatedBy":"local|ai" },
  "sessions": [
    { "date":"ISO", "exercises":[...], "planRef":{w:0,d:0}, "kneeStatus":"bien|leve|dolor" }
  ],
  "sessionSets": { "0": {id, name, isCardio, note, sets:[{reps,weight,done}]} },
  "settings": { "wake": false },
  "lastExport": "ISO",
  "_currentRef": {w,d},
  "_kneeStatus": "bien|leve|dolor",
  "_adaptedSession": {...}
}
```

-----

## Pantallas

### Onboarding (4 pasos)
1. Bienvenida + qué hace la app
2. Perfil (peso, estatura, edad)
3. Condición PFPS (estado rodilla hoy)
4. Test baseline en Prensa 45° (Hammer) — calcula 1RM con fórmula Epley

### 🏠 Inicio
- Card "Hoy" con próxima sesión del plan (Sem X · Día Y · Focus)
- Stats: sesiones, series, semanas activas
- Guía de carga PFPS (RIR, ROM, reglas)
- **Glosario clickeable** con definiciones (RIR, ROM, PFPS, VMO, 1RM, Epley, etc.)
- Action bar fija inferior: "▶ Empezar siguiente sesión"

### 📅 Plan
- Plan periodizado de 8 semanas:
  - Sem 1-2 adaptación → 3-5 fuerza → 6-7 resistencia trekking → 8 taper (-volumen)
  - 3 días/semana (A=pierna, B=tren superior, C=trekking-cardio)
- Strip semanas con contador `N/3` por semana, ✓ si completa
- Día completado se muestra con opacidad reducida
- Action bar: "🤖 Regenerar plan con IA"

### 💪 Hoy (rutina)
- **Check-in rodilla pre-sesión** (modal, 3 opciones):
  - 😊 Bien → sesión normal
  - 😐 Molestia leve → cargas -20%, label "(-20% por molestia)"
  - 😣 Dolor >3/10 → quita Hack/Prensa/Leg Ext/Jack Squat, cargas restantes -40%, agrega isométricos + abductor VMO + StairMaster suave
- Series con kg/reps editables + check + 🗑 borrar individual
- Timer descanso 1:30 / 3:00 con vibración
- "+ Añadir ejercicio" desde catálogo
- "↺ Reiniciar esta sesión" (descarta progreso, re-pregunta rodilla)
- Action bar: "✓ Finalizar sesión"

### 📷 Catálogo
- 25 máquinas con thumbnail base64
- Tags PFPS: `safe` verde, `caution` amarillo, `avoid` rojo
- Tap thumbnail → lightbox tamaño completo
- Búsqueda por nombre/músculo
- (Sin scanner cámara — feature removida por decisión del usuario)

### 📊 Historial
- Stats totales
- Gráfica Chart.js (selector ejercicio → peso máx + reps prom en línea de tiempo)
- Lista sesiones con detalle expandible
- Borrar sesión individual / historial completo

### ⚙️ Config
- API key Anthropic (input password)
- Perfil editable + baseline visible
- Wake lock toggle (pantalla no se apaga durante sesión)
- **Backup / Restore JSON** — exportar todo a archivo, importar desde archivo (sobrevive borrado de app, cambio de celular)
- Reiniciar onboarding

-----

## Reglas de progresión

- Si completa todas las series con RIR 2+ → próxima sesión `+2.5kg`
- Si no completa → mantiene peso
- `nextSession()` retorna primer día no completado del plan (independiente del calendario — secuencial)
- `adaptSessionForKnee(td, status)` ajusta carga y ejercicios según check-in pre-sesión

## Convenciones de código

- Todo en español (UI, comentarios, variables descriptivas)
- Funciones camelCase: `renderRutina`, `nextSession`, `adaptSessionForKnee`, `epley1RM`
- `saveDB()` después de cada mutación
- `DB` objeto global, sincronizado con localStorage
- IDs catálogo en snake_case (`leg_press_45`, `prone_leg_curl`, `pantorrilla_sentado`)
- No usar `alert()` para flows importantes → usar `openModal()` ya implementado

## Deploy

```bash
# Local
python -m http.server 8080
# Abrir http://localhost:8080 (SW requiere localhost o HTTPS)

# Commit + push
git add -A
git commit -m "descripción"
git push  # GitHub Pages se actualiza ~1-2 min
```

Al modificar `index.html`, **bump versión cache** en `sw.js` (`const CACHE = 'oso-gym-vN'`) para invalidar service worker.

## Próximas mejoras posibles

- [ ] Sincronización iCloud / Supabase (multi-dispositivo)
- [ ] Correlación gráfica: progreso vs `kneeStatus` (¿la molestia frena ganancias?)
- [ ] Recordatorios push (requiere web push + permisos)
- [ ] Foto pre/post sesión para diario visual
- [ ] Plan auto-extendible (sem 9+ en mantenimiento al terminar las 8)
