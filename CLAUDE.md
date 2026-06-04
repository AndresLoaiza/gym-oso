# El Oso Gym — CLAUDE.md

## Contexto del proyecto

App web móvil PWA de entrenamiento para **Andrés "El Oso" Loaiza** (Medellín). Objetivo: preparación física para **trekking nivel 4** con plan adaptado a **Síndrome de Dolor Patelofemoral (PFPS)**. Sin fecha fija para el trek — preparación continua.

**Repo:** https://github.com/AndresLoaiza/gym-oso
**URL pública:** https://andresloaiza.github.io/gym-oso/
**Archivo principal:** `index.html` — toda la app en un solo archivo HTML/CSS/JS, sin frameworks.
**Mapa del código:** `context.md` — qué hace cada función/pantalla sin leer las ~2400 líneas. Leerlo primero para entender el flujo; actualizarlo al cambiar lógica.

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

- `index.html` (HTML + JS inline, sin frameworks ni bundlers; el CSS vive en `elosogym.css`)
- `elosogym.css` → **design system** (Claude Design handoff): tokens `:root` (color, tipografía, espaciado, radios, motion) + componentes con el vocabulario de clases real de la app. Retematizar = cambiar variables. Drop-in pixel-idéntico al `<style>` inline anterior.
  - **A11y**: `:focus-visible` global (ring de teclado/switch, no molesta a touch) + `@media (prefers-reduced-motion: reduce)` (mata animaciones/transiciones/scroll; el `scrollIntoView` JS también lo respeta vía `matchMedia`). `.modal::before` = grabber de bottom-sheet (affordance de desechar; tap-backdrop ya cierra). `.btn.small` min-height 36px, `.ex-act` 40px (touch). `details.card` = sección plegable con aspecto de card.
- `fonts/` → 16 woff2 **self-hosted** (Bebas Neue · DM Sans 300-700 · DM Mono 400/500, OFL, subsets latin+latin-ext). Sin dependencia de Google Fonts → funciona 100% offline.
- **Mascota El Oso** (`BEARS` dict + `bearSVG(name,size)` en `index.html`): 5 osos chibi SVG **inline** (rest/dumbbell/press/bike/stairs), del design system. Offline, sin requests. **Regla: solo en estados positivos/motivacionales** — logo header (dumbbell 30px), bienvenida onboarding (dumbbell 140px), card "Hoy" (`bearForFocus`), plan completo + fin de sesión + modal de progresión (rest). NUNCA en carga/error/destructivo. Las fotos de máquinas (`thumb()`/`catalogo-imgs.js`) NO se reemplazan — el oso es aditivo.
- `manifest.json` + `sw.js` → PWA instalable + offline cache (precachea `elosogym.css` + los 16 fonts)
- `catalogo-imgs.js` → 25 thumbnails base64 (229 KB)
- `Chart.js@4.4.1` vía CDN para gráficas
- Persistencia: `localStorage` clave **`elosoGymV2`**
- Theme: dark + acento lila violeta `#c4a7ff`, acento2 naranja `#ff6b35`

## Scripts auxiliares

- `convert.py` — convierte HEIC → JPG (requiere `pillow-heif`, `Pillow`)
- `gen_thumbs.py` — genera `catalogo-imgs.js` (thumbnails 220px JPEG q70 base64)

## Tests

`tests/test.js` — suite Node.js. Correr **siempre** antes de commit:

```bash
node tests/test.js
```

Exit 0 = pass, 1 = fail. Cobertura actual (141 tests): parseHoldSec/isHoldEx (aguante isométrico), muscleTokens/suggestSwaps (swap PFPS-safe mismo músculo), escHtml, epley1RM/workWeight, parseNum (coma decimal es-CO), phaseOfWeek/windowOf, OBJECTIVE windows, CATALOGO integrity (no stale ids, flags unilateral), HOWTO/TEMPO/EX_TYPE coverage por id, analyzeWeightPattern (constant/asc/desc/mixed/unilateral + drop), decideBump (double progression + knee + shortfalls + caps + cardio skip), PROG_CAPS recalibrados, applyProgression sync de peso probado (propaga proven, respeta cap, no sube en bump negativo, ignora drop), DAYC_ORDER + rdlExercise + migrateDayCV3 (rebuild RDL + idempotencia + preserva pesos), generateLocalPlan Day C composición, DEFAULT_DB.

Harness: stub DOM/localStorage/navigator + `new Function(code + 'return {bindings};')()` para extraer const/function (indirect eval no expone bindings const). Bindings expuestos incluyen `DB`, `PROG_CAPS`, `DAYC_ORDER`, `rdlExercise`, `migrateDayCV3`, `generateLocalPlan` para tests que mutan `DB.plan`, más helpers puros `parseHoldSec`, `isHoldEx`, `muscleTokens`, `suggestSwaps`, `escHtml`. Test runner casero `test(name, fn)` con assertEq/assertDeep/assertTrue/assertFalse.

**Update tests al agregar lógica testeable** (nueva función pura, nuevo dict por id, nueva regla progresión, nuevo flag CATALOGO).

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
    { "date":"ISO", "exercises":[...], "planRef":{w:0,d:0}, "kneeStatus":"bien|leve|dolor",
      "note":"comentario libre de la sesión" }
  ],
  "sessionSets": { "0": {id, name, isCardio, noWeight, rest, note,
                         userNote:"nota del usuario por ejercicio",
                         sets:[{reps,weight,done,userAdded?}]} },
  "settings": { "wake": false },
  "lastExport": "ISO",
  "_currentRef": {w,d},
  "_kneeStatus": "bien|leve|dolor",
  "_adaptedSession": {...},
  "_sessionNote": "comentario en curso (se vuelca a session.note al finalizar)"
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
   - **Aviso reps altas** (en `calc()` onboarding): si user mete >20 reps en un test → banner naranja "peso muy liviano para estimar fuerza, el plan arrancará con cargas bajas, re-test con peso que falle a ~8-12 reps". Causa raíz documentada: baseline real de Andrés se hizo con 54/20/25 reps → 1RM al piso (cap r=30) → plan subestimado → re-edición masiva de peso. No bloquea (algunos no pueden añadir carga).
   - Migración v2 al boot: si `baseline.tests` existe y `formulaVersion !== 2`, recalcula 1RMs + regenera plan. Idempotente.

### 🏠 Inicio
- **Progressive disclosure** (reorg UX): el home lidera con la tarea — Card "Hoy" + Stats arriba. La referencia (Guía PFPS, Glosario) va en `<details class="card">` **plegados** (no muro de texto en cada visita; un tap para abrir).
- Card "Hoy" con próxima sesión del plan (Sem X · Día Y · Focus) + **oso** (`bearForFocus`: press/dumbbell/stairs según focus)
- Stats: sesiones, series, semanas activas
- Guía de carga PFPS (RIR, ROM, reglas) — plegable
- **Glosario clickeable** con definiciones (RIR, ROM, PFPS, VMO, 1RM, Epley, etc.) — plegable
- Action bar fija inferior: "▶ Empezar siguiente sesión"

### 📅 Plan
- Plan periodizado de 8 semanas (evidence-based ACSM 2026 + PFPS Physiopedia):
  - Sem 1-2 adaptación (3×10-12 @ 55%, rest 90s)
  - Sem 3-5 fuerza (4-5×6-8 compuestos @ 75-80%, rest 150-180s)
  - Sem 6-7 resistencia trekking (3-4×12-15 @ 55-60%, rest 60s)
  - Sem 8 taper (-1 set, intensidad mantenida)
  - 3 días/semana (A=pierna, B=tren superior, C=trekking-cardio)
  - **Day C reestructurado** (`DAYC_ORDER`): `trotadora → jack_squat → peso_muerto (RDL) → step-up → abductor → stairmaster (finisher)`. 6 ejercicios (antes 7).
    - **Cadena posterior vía PESO MUERTO RUMANO** (`peso_muerto`, hip hinge): reemplaza `hiper_inversa` (user reportó máquina mala) + glute kickback (`crossover` en Day C, incómodo). El RDL cubre glúteo + isquios + erectores en un movimiento PFPS-safe (hip-dominant, rodilla suave, sin estrés rotuliano) y es el mejor ejercicio de ascenso trekking. `peso_muerto` ya estaba pre-cableado (CATALOGO, EX_TYPE posterior, HOWTO/TEMPO) — solo no se usaba en el plan. Peso por fase vía `rdlExercise(week)`: adapt 3×12 @ wLeg(0.30)≈barra sola, str 4×8, end 3×15, taper 2×10. (`crossover` sigue en Day A como abducción VMO).
    - **Orden por prioridad-en-fresco** (Simão 2012, efecto del orden): cadena posterior al frente. StairMaster (cardio redundante con Day A) → finisher Z2 opcional, lo más prescindible al final.
    - Razón: telemetría mostró 0% de completado de la cadena posterior en Day C (sesión 57 min, 68% completado, se abandonaba al final — por equipo/comodidad, no fatiga). NO se bajó intensidad — el user sobre-rinde en carga; problema estructural + selección de ejercicio.
    - `migrateDayCV3()` (boot, idempotente): reconstruye Day C de planes existentes — preserva pesos/reps progresados de sobrevivientes (jack_squat, step-up, abductor, stairmaster), elimina hiper_inversa + kickback, inserta RDL fresco, llama `tagPlanWithWindows()` para taggear el RDL.
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
- **Botón "ℹ Cómo usar"** en cada ejercicio (si existe `HOWTO[ex.id]`) abre modal con 4 secciones:
  - ⚙ Setup / Panel (config StairMaster botones MODE/USER/LEVEL/Manual, Hammer pies altos+anchos, leg ext tope mecánico, wall sit ~50cm pared, etc.)
  - ⏱ **Tempo (cadencia)** — notación bajar·pausa·subir·pausa en segundos + label corto + razón científica
  - 🎯 Configuración (ROM, cargas progresión por semana)
  - 🦵 Reglas PFPS (ángulos seguros, alineación rodilla-pie, dolor-stop)
- **Chip tempo en card** del ejercicio durante sesión (`⏱ Tempo: 3·1·2·0` clickeable abre HOWTO)
- **Auto-colapsar card** al completar todos los sets: card baja opacidad + oculta sets/botones, queda solo header con chip "✓ N/N completo". Click header → toggle expand/collapse manual. Hint visible "▾ ocultar / ▸ expandir". Scroll suave al próximo ej no completo. Estado in-memory `_collapsedEx Set` + `_userExpanded Set` (user que re-expande no se vuelve a colapsar). Reset al cambiar de día. Telemetría `ex_collapse_toggle`.
- Dict `HOWTO` cubre 16 ejercicios. Dict `TEMPO` (`index.html`) define cadencia evidence-based por ejercicio:
  - **Compuestos pierna PFPS** (prensa, jack sq): 3·1·2·0 eccentric overload (LaStayo 2003)
  - **Wall sit**: ISO hold puro (Naugle/Holden PFPS isometrics)
  - **Step-up**: 1·0·2·0 (subir 1s · bajar 2s) eccentric quad = trekking descenso
  - **Leg ext**: 2·0·2·2 pausa apex 2s (Distefano 2009 VMO EMG)
  - **Prone leg curl**: 1·1·3·0 eccentric isquio (balance H:Q)
  - **Sóleo**: 1·1·2·1 pausa stretch + apex (HSR Kongsgaard 2009)
  - **Abducción / VMO**: 2·0·2·1 pausa apex glúteo medio (Distefano 2009)
  - **Tren superior**: 2·0·1·0 concentric explosive intent (González-Badillo)
  - **Aislamiento tracción**: 2·0·1·1 pausa peak contracción
  - **Cardio**: cadencia constante, no aplica
- Texto basado en NSCA + Physiopedia PFPS + Z2 HR trekking (113-132 bpm para HRmax 188) + Roig 2009 + LaStayo 2003 + Distefano 2009 + González-Badillo + Kongsgaard 2009 HSR + Schoenfeld 2015 tempo.
- **Check-in rodilla pre-sesión** (modal, 3 opciones):
  - 😊 Bien → sesión normal
  - 😐 Molestia leve → cargas -20%, label "(-20% por molestia)"
  - 😣 Dolor >3/10 → quita Hack/Prensa/Leg Ext/Jack Squat, cargas restantes -40%, agrega isométricos + abductor VMO + StairMaster suave
- Banner modo: series rectas (no circuito), 2-3 min entre ejercicios, glosario reps/series
- Header columnas por ejercicio: `# | REPS | PESO (kg) | ✓`
- Chip "⏱ Descanso: M:SS" por ejercicio (rest específico)
- Series con kg/reps editables + check + 🗑 borrar individual (solo user-added; defaults protegidos)
- **Time-only ex** (wall sit, cardio): columnas colapsan a `# | Tiempo | ✓`, input `type=text`, peso muestra "—"
- **Acciones por card — fila única de 3 botones** (reorg UX, evita el wrap de 5 botones):
  - `+ Serie` · **un solo timer contextual** · `⇄ Cambiar`. Touch target ≥40px (`.ex-act`).
  - El timer contextual es **uno solo**: holds → `⏱ Aguante Ns` (`.ex-act-hold`, naranja) · resto → `⏱ Descanso M:SS` (serie). No se muestran ambos.
- Timer descanso diferenciado (banner flotante `startTimer(sec, kind)`):
  - **Serie** (naranja): usa `rest` del ejercicio, auto-dispara al marcar ✓
  - **Aguante** (naranja): cuenta regresiva del hold, vibra fuerte + beep al terminar
  - **Cambio ejercicio** (lila): 2:30, **auto-dispara** al completar una card si queda otro ejercicio (antes botón manual — eliminado). Telemetría `rest_start {kind:'ejercicio', auto:true}`.
  - Label visible en banner del timer (`Serie`/`Aguante`/`Cambio`)
- "+ Añadir ejercicio" desde catálogo (auto-asigna rest 75s)
- **⇄ Cambiar ejercicio** (botón por card): para máquina ocupada/mala/dolor. `suggestSwaps(exId)` propone alternativas del CATALOGO que comparten ≥1 músculo (`muscleTokens`), no-cardio, knee `safe|caution`, orden safe-primero. Modal con chips de razón (ocupada/mala/dolor → `_swapReason`). `doSwap()` reemplaza id/name/note/unilateral **conservando reps/peso** (reconstruye sets si cambia condición unilateral). Telemetría `ex_swap {from,to,reason}`.
- **⏱ Aguante (cronómetro isométrico)**: solo ejercicios de aguante (`isHoldEx`: time-based + `noWeight` + no cardio, ej. wall sit). Botón `⏱ Aguante Ns` (`parseHoldSec` parsea `'30s'`/`'2 min'`) → `startTimer(sec,'hold')` cuenta regresiva. **Al terminar vibra fuerte (`vibrate([200,100,200,100,200])`) + beep** para avisar fin del hold. Cardio NO lleva este timer (decisión user).
- **Comentarios de sesión** (para análisis de comportamiento, texto completo en telemetría — ver §Telemetría):
  - **Por ejercicio**: toggle `📝` en el header de la card (`.note-toggle`, estado `_noteOpen`). Oculto si vacío, resaltado (`has-note`) si hay nota, abre input inline 1 tap. `sessionSets[i].userNote` → `session.exercises[i].userNote`, telemetría `ex_note`.
  - **De sesión**: `<details>` colapsable al pie de la rutina (no ocupa espacio idle; auto-`open` si ya hay texto). `_sessionNote` → `session.note`, telemetría `session_note`.
  - Se muestran en Historial (detalle). Todo input escapado con `escHtml()`.
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
- `session_preserved { reason }` — guard preservó sesión con progreso en vez de descartarla (anti-pérdida)
- `set_add { exId, idx }`
- `set_delete { exId, idx }`
- `set_edit { exId, idx, field, old, new }` — reps o weight
- `set_check { exId, idx, done, reps, weight }`
- `rest_start { kind, sec }` — `serie` | `ejercicio` | `hold` (aguante isométrico)
- `ex_swap { from, to, idx, reason }` — cambio de ejercicio (ocupada/mala/dolor)
- `ex_note { exId, idx, len, text }` — nota por ejercicio (incluye **texto** para análisis)
- `session_note { len, text, planRef }` — comentario de la sesión (incluye **texto** para análisis)

**Nota:** `ex_note`/`session_note` guardan el **texto completo** de los comentarios en el buffer de telemetría → el export de telemetría (el que el user pasa a Claude para análisis de comportamiento) ya trae los comentarios, no solo `len`. El texto también vive en `sessions[]` (`session.note`, `exercise.userNote`) para el backup JSON.

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
- `unilateral`: lados L/R analizados por separado (`_patternRaw`). dropDetected solo si AMBOS lados drop ≥10% (lado débil naturalmente menor peso ≠ fatiga). topSet = max peso entre ambos lados.

`topSet`: serie con max peso que cumplió `targetReps` (Helms RP top-set assessment).

### Ejercicios unilaterales
Flag `unilateral:true` en CATALOGO + plan generator + ex objects. Helper `isUnilateral(exId)` lee CATALOGO.

**Ejercicios marcados unilaterales:**
- `crossover` (abducción cadera + glute kickback)
- `mancuernas` (step-up)
- `remo_isolateral`

**SessionSets creation:** si `ex.unilateral`, duplica sets con tag `side: 'L'` o `'R'`. Orden: todas las L primero, luego todas las R (estándar gym: cambias de lado una vez, no entre sets).

**UI:**
- Chip header card: `🦵 Unilateral: N×Y reps POR LADO (L primero, R después)`
- Badge por set row: `L1, L2, ... R1, R2, ...` con colores distintos (L=accent lila, R=accent2 naranja)
- Plan notes explicitan "POR PIERNA" / "POR BRAZO"

**Telemetría:** `set_check` incluye `side`.

**Auto-progresión:** funciona naturalmente con sets duplicados — `done.length === ex.sets.length` espera 2N completos, shortfalls cuenta cualquier lado. Patrón unilateral evita falso-positivo drop por asimetría.

### Aplicación (`applyProgression`)
- **Sync de peso probado (clave anti-fricción)**: el peso base para semanas futuras = `max(planWeight, provenW)`, donde `provenW` = peso de la serie más pesada que cumplió las reps target **y no fue drop de fatiga**. Se propaga con **cualquier patrón** (no solo `constant`) y **aunque el bump de peso sea 0** (ej. double progression que solo sube reps). Esto sincroniza el plan con lo que el user realmente levanta → elimina la re-edición manual de peso cada sesión y corrige baselines subestimados sin esperar +2.5 incrementales. Caso real que motivó el cambio: baseline derivado de tests con 54/20/25 reps (1RM al piso por cap r=30) → plan arrancó muy por debajo del peso usable; el user re-editaba ~30 pesos por sesión (telemetría).
- **Weight bump > 0** (decideBump): se suma sobre `max(syncBase, oldW)` por semana, capeado.
- **Weight bump < 0** (dolor / ≥2 shortfalls): reduce **desde el plan** (`syncBase = planWeight`), NO sincroniza arriba el peso probado.
- Todo el peso se aplica a semanas futuras same-phase (no cruza fases — %1RM distinto).
- **Rep bump > 0** (escalación intra-window): solo a próxima semana same-day same-phase, clamp a `repMax`
- **Rep bump < 0** (reset por repMax alcanzado): a todas same-phase futuras, reset a `repMin`
- **Caps PFPS recalibrados** (`PROG_CAPS`) — solo donde hay carga directa de rótula:
  - `leg_ext` 17.5 (extensión rodilla = PFJ directo, cap duro) · `mancuernas` step-up 25 (banco BAJO <90° → la carga no estresa la rótula; limitante es ROM, no peso. User reportó step-up "muy sencillo" → progresar por carga+reps, NO subir altura del banco)
  - `crossover` 25 y `adductor_abductor` 45 (abducción/kickback de cadera = open-chain, NO carga rótula → cap solo seguridad de máquina; antes 12/22.5 frenaban progreso real — el user usaba 32×15 cómodo en abductor)
  - `camber_curl` sin cap (curl bíceps, sin relación PFPS)
  - Justificación: PFJ stress depende de flexión de rodilla bajo carga (Powers 2010); ejercicios sin flexión de rodilla cargada no estresan la rótula.
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

## Persistencia y durabilidad de la sesión

La rutina en curso (`sessionSets`) se guarda en `localStorage` en **cada** mutación (set-check, edit de peso/reps, add/delete de serie, swap, nota). Además, 3 redes de seguridad para que cerrar la app por error **nunca** pierda progreso:

1. **`saveDB()` resiliente a quota**: try/catch; si `localStorage.setItem` lanza `QuotaExceededError` (la telemetría crece sin techo), recorta `telemetry.events` a la mitad y reintenta. El progreso de la rutina nunca se pierde por falta de espacio.
2. **Flush al backgroundear/cerrar**: `visibilitychange` (hidden) + `pagehide` → `saveDB()`. iOS puede matar la PWA al backgroundear entre dos cambios; esto flushea el estado final.
3. **Guard anti-pérdida** (`renderRutina`): el guard `staleSession` (que vacía `sessionSets` cuando diverge del plan, ej. tras swap o migración de plan) **ya no descarta** una sesión con trabajo real. `sessionHasProgress(sessionSets)` (serie `done` o `userAdded`) → si hay progreso, se preserva la sesión sobre el sync con el plan. Telemetría `session_preserved`. Solo se vacía si NO hay progreso.

## Convenciones de código

- Todo en español (UI, comentarios, variables descriptivas)
- Funciones camelCase: `renderRutina`, `nextSession`, `adaptSessionForKnee`, `epley1RM`
- `saveDB()` después de cada mutación (es resiliente a quota — ver § Persistencia)
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
