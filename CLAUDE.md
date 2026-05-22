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
               "baseline":{
                 "legPress1RM":42, "benchPress1RM":26, "pulldown1RM":30,
                 "tests": { "leg_press_45":{w,r}, "banco_plano":{w,r}, "pulldown":{w,r} },
                 "date":"..."
               } },
  "plan": { "start":"YYYY-MM-DD",
            "weeks":[[{focus,notes,exercises:[{id,name,sets,reps,weight,rest,isCardio,noWeight,note}]}, ...]],
            "generatedBy":"local" },
  "sessions": [
    { "date":"ISO", "exercises":[...], "planRef":{w:0,d:0}, "kneeStatus":"bien|leve|dolor" }
  ],
  "sessionSets": { "0": {id, name, isCardio, noWeight, rest, note,
                         sets:[{reps,weight,done,userAdded?}]} },
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
4. **Test baseline (3 compuestos):**
   - Prensa 45° Hammer (compound pierna)
   - Press de banca (compound empuje)
   - Pulldown (compound tracción vertical)
   - Cada uno calcula 1RM por **fórmula híbrida**: Epley (≤10 reps) / Mayhew (>10 reps). Mayhew evita sobreestimación cuando user empuja tests >12 reps (Epley invalida ~15% arriba). Plan deriva pesos del resto por ratios NSCA.
   - Migración v2 al boot: si `baseline.tests` existe y `formulaVersion !== 2`, recalcula 1RMs + regenera plan. Idempotente.

### 🏠 Inicio
- Card "Hoy" con próxima sesión del plan (Sem X · Día Y · Focus)
- Stats: sesiones, series, semanas activas
- Guía de carga PFPS (RIR, ROM, reglas)
- **Glosario clickeable** con definiciones (RIR, ROM, PFPS, VMO, 1RM, Epley, etc.)
- Action bar fija inferior: "▶ Empezar siguiente sesión"

### 📅 Plan
- Plan periodizado de 8 semanas (evidence-based ACSM 2026 + PFPS Physiopedia):
  - Sem 1-2 adaptación (3×10-12 @ 55%, rest 90s)
  - Sem 3-5 fuerza (4-5×6-8 compuestos @ 75-80%, rest 150-180s)
  - Sem 6-7 resistencia trekking (3-4×12-15 @ 55-60%, rest 60s)
  - Sem 8 taper (-1 set, intensidad mantenida)
  - 3 días/semana (A=pierna, B=tren superior, C=trekking-cardio)
- **Volumen por máquina** (no uniforme):
  - Compuestos multi-joint: 3-5 sets
  - Sóleo: 4-6 sets (alta proporción fibra I, crítico descenso)
  - VMO/abductor: 4-5 sets (prioridad PFPS)
  - Isométrico wall sit: 3-5 holds, tiempo periodizado 20→45s
  - Aislamiento pequeño (curl, leg ext, kickback): 2-3 sets
- **Pesos derivados por ratios NSCA** desde 3 baselines:
  - Banca→Press hombros 62%, Banca→Remo 90%, Banca→Curl 30%
  - Prensa→Sóleo 55%, Prensa→Leg ext 18%, Prensa→Prone curl 32%, Prensa→Jack sq 50%
- Cada ejercicio incluye `rest` (segundos) específico
- Strip semanas con contador `N/3` por semana, ✓ si completa
- Día completado se muestra con opacidad reducida
- Plan se genera al terminar onboarding y se auto-regenera al completar las 8 semanas (próxima sesión inicia nuevo ciclo con misma periodización)
- Sin botones de regeneración manual (plan deriva siempre de baseline + ciencia)

### 💪 Hoy (rutina)
- **Botón "ℹ Cómo usar"** en cada ejercicio (si existe `HOWTO[ex.id]`) abre modal con 3 secciones:
  - ⚙ Setup / Panel (config StairMaster botones MODE/USER/LEVEL/Manual, Hammer pies altos+anchos, leg ext tope mecánico, wall sit ~50cm pared, etc.)
  - 🎯 Configuración (ROM, tempo excéntrica, cargas progresión por semana)
  - 🦵 Reglas PFPS (ángulos seguros, alineación rodilla-pie, dolor-stop)
- Dict `HOWTO` (`index.html`) cubre 16 ejercicios: stairmaster, trotadora, leg_press_45, leg_ext, prone_leg_curl, pantorrilla_sentado, crossover, _wall_sit, banco_plano, jack_squat, mancuernas (step-up), press_hombros_107, remo_isolateral, pulldown, hiper_inversa, camber_curl, adductor_abductor.
- Texto basado en NSCA + Physiopedia PFPS + Z2 HR trekking (113-132 bpm para HRmax 188).
- **Check-in rodilla pre-sesión** (modal, 3 opciones):
  - 😊 Bien → sesión normal
  - 😐 Molestia leve → cargas -20%, label "(-20% por molestia)"
  - 😣 Dolor >3/10 → quita Hack/Prensa/Leg Ext/Jack Squat, cargas restantes -40%, agrega isométricos + abductor VMO + StairMaster suave
- Banner modo: series rectas (no circuito), 2-3 min entre ejercicios, glosario reps/series
- Header columnas por ejercicio: `# | REPS | PESO (kg) | ✓`
- Chip "⏱ Descanso: M:SS" por ejercicio (rest específico)
- Series con kg/reps editables + check + 🗑 borrar individual (solo user-added; defaults protegidos)
- **Time-only ex** (wall sit, cardio): columnas colapsan a `# | Tiempo | ✓`, input `type=text`, peso muestra "—"
- Timer descanso diferenciado:
  - **Serie** (naranja): usa `rest` del ejercicio, auto-dispara al marcar ✓
  - **Cambio ejercicio** (lila): 2:30 fijo
  - Label visible en banner del timer
- "+ Añadir ejercicio" desde catálogo (auto-asigna rest 75s)
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
- Perfil editable + **3 baselines visibles** (Prensa, Banca, Pulldown con sus 1RM + peso×reps usados)
- Wake lock toggle (pantalla no se apaga durante sesión)
- **Auto-progresión** toggle (default ON) — ajusta pesos del plan al finalizar sesión
- **Telemetría UX** toggle (default ON) — acumula eventos de uso para análisis de fricciones, 100% local. Botón export JSON + clear. Summary muestra count + días + top tipos
- **Backup / Restore JSON** — exportar todo a archivo, importar desde archivo (sobrevive borrado de app, cambio de celular)
- Reiniciar onboarding (re-genera plan con baselines actualizados)
- _Sin API key ni integraciones externas — app 100% local_

## Telemetría UX

Buffer local en `DB.telemetry.events` (FIFO cap 2000, ~120KB). 100% local — nunca sale del dispositivo hasta export manual.

**Helper:** `track(type, data)` en `index.html`. Skip silencioso si `settings.telemetry === false`. Nunca rompe la app (try/catch).

**Schema evento:** `{ t: ISO, type: string, sid?: sessionId, ...data }`

**Tipos hookeados:**
- `screen_view { screen }` — nav entre tabs
- `modal_open { name }` — implícito vía openModal/Howto/Term
- `glosario_open { term }`
- `howto_open { exId }`
- `knee_check { status }` — bien/leve/dolor
- `session_start { planRef, knee, exCount, focus }` — inicia sessionId
- `session_finish { planRef, knee, totalSets, doneSets, durSec, completedRatio }` — calcula duración desde session_start
- `session_abandon { doneSets, exCount }` — botón reset
- `set_add { exId, idx }`
- `set_delete { exId, idx }`
- `set_edit { exId, idx, field, old, new }` — reps o weight
- `set_check { exId, idx, done, reps, weight }`
- `rest_start { kind, sec }` — serie o ejercicio

**Análisis offline:** user exporta JSON desde Config → pasa a Claude → identifica:
- HOWTO/glosario más abiertos = conceptos confusos
- Sets con muchos edits = pesos/reps default mismatch
- Session abandons = friction points
- durSec por sesión vs estimado
- Rest start vs sin start = compliance timer
- Knee check distribution = adherencia + estado real PFPS

-----

## Objetivo + ventanas de progresión

**`OBJECTIVE`** (singleton, `index.html`): `trekking_n4_pfps`. Define `windows[type][phase] = [repMin, repMax]` para double progression. Extensible a múltiples objetivos en el futuro.

**`EX_TYPE`** mapea cada `ex.id` a un tipo: `strength` (compuestos), `endurance` (sóleo, mancuernas), `pfps` (leg ext, abductor, crossover), `posterior` (hiper inversa, prone curl).

**Pattern recomendado**: `straight_sets`. Evidencia: Schoenfeld 2017 meta — equivale a pyramid/drop volume-equated, sin penalización + tracking limpio + estrés rotuliano constante (PFPS).

**Ventanas (`OBJECTIVE.windows`)** — [repMin, repMax]:
- `strength`: adapt [10,15] · str [5,8] · end [12,18] · taper [8,12]
- `endurance`: adapt [12,20] · str [12,18] · end [15,25] · taper [12,18]
- `pfps`: adapt [12,20] · str [12,18] · end [15,20] · taper [12,18]
- `posterior`: adapt [8,15] · str [8,12] · end [12,18] · taper [10,15]

`tagPlanWithWindows()` inyecta `{type, phase, repMin, repMax}` a cada ex del plan. Llamado tras `generateLocalPlan()` y como migración boot para planes existentes.

## Reglas de progresión

**Auto-aplicadas** al finalizar sesión (`applyProgression()`). Toggle Config (`settings.autoProgress`, default ON).

### Double progression (Helms RP, Schoenfeld 2017)
1. Cumples reps target en todas las series + rodilla bien → **+1 rep next session** (sin tocar peso) hasta llegar a `repMax`
2. Llegas a `repMax` con todas series completas → **+peso + reset reps a `repMin`**
3. Sin window (plan viejo sin migrar) → fallback simple (+peso constante)

### Decisión (`decideBump`)
Devuelve `{ weightBump, repBump, reason }`. Orden:
1. Cardio / `noWeight` / time-based → skip
2. `kneeStatus=leve` → 0 (no progresar con molestia)
3. `kneeStatus=dolor` + `quadHeavy` → -step peso (prensa, jack squat)
4. `dropDetected` (descending ≥10% intra-sesión, González-Badillo) → 0
5. ≥2 shortfalls reps → -step peso
6. `allComplete` + `bien` → double progression (+1 rep o +peso+reset)
7. 1 shortfall → 0 (margen día malo)

### Detección patrón intra-sesión (`analyzeWeightPattern`)
- `constant`: max=min → bump normal
- `ascending` (pyramid up): warm-up implícito (Mangine 2018) → bump normal usando top set
- `descending`: si `last <= first × 0.9` → `dropDetected=true` (fatiga ceiling)
- `mixed`: bump normal flagueado en modal

`topSet`: serie con max peso que cumplió `targetReps` (Helms RP top-set assessment).

### Aplicación (`applyProgression`)
- **Weight bump**: a todas las semanas futuras del mismo `(d, ex.id)` con mismo `phase` (no cruza fases — strength vs endurance tienen %1RM distintos)
- **Rep bump > 0** (escalación intra-window): solo a próxima semana same-day same-phase, clamp a `repMax`
- **Rep bump < 0** (reset por repMax alcanzado): a todas same-phase futuras, reset a `repMin`
- **Weight base** = `max(topSet con reps target, planWeight)` — evita peso obsoleto
- **Sync sin bump**: si user usó peso constante distinto al plan, propaga ese peso
- **Caps PFPS** (`PROG_CAPS`): leg_ext 17.5 max, crossover 12 max, step-up 15 max, abductor 22.5 max
- Modal post-sesión muestra `from→to kg · from→to reps` + razón + "↶ Deshacer"

### Adaptación al objetivo trekking
- Compuestos: progresar a ceiling phase (str repMax=8 ≈ 6RM práctico), después mantener (powerlifting irrelevante)
- Sóleo/posterior chain: ventanas amplias (15-25 reps end phase) → endurance dominante
- PFPS aislamiento: ventana fija 12-20 reps todas fases + caps duros peso → neuromuscular > carga
- Cardio (stairmaster/trotadora): progresión por tiempo hardcoded en plan generator (`reps:${10+week} min`)

Otras reglas:
- `nextSession()` retorna primer día no completado del plan (independiente del calendario — secuencial)
- `adaptSessionForKnee(td, status)` ajusta carga y ejercicios según check-in pre-sesión

## Helpers de generación de plan

- `wLeg(f)`, `wBench(f)`, `wPull(f)` → derivan peso desde 1RM correspondiente, redondea a 2.5kg
- `phase(week)` → `'adapt'|'str'|'end'|'taper'`
- `taperize(day)` → reduce 1 set por ejercicio (semana 8)
- Wall sit hold periodizado por fase (20-45s)
- Ejercicios sin carga llevan `noWeight:true` (UI esconde columna peso)
- Time-based ex (cardio + isométrico) usan `reps` string ("8 min", "30s") + input `type=text`

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

⚠ PWA iOS standalone: `confirm()` / `alert()` nativos pueden quedar bloqueados. Para flows críticos usar siempre `openModal()` con botones HTML (`window.openModal`/`window.closeModal` expuestos).

## Próximas mejoras posibles

- [ ] Sincronización iCloud / Supabase (multi-dispositivo)
- [ ] Correlación gráfica: progreso vs `kneeStatus` (¿la molestia frena ganancias?)
- [ ] Recordatorios push (requiere web push + permisos)
- [ ] Foto pre/post sesión para diario visual
- [ ] Plan auto-extendible (sem 9+ en mantenimiento al terminar las 8)
