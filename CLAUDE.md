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
- **Backup / Restore JSON** — exportar todo a archivo, importar desde archivo (sobrevive borrado de app, cambio de celular)
- Reiniciar onboarding (re-genera plan con baselines actualizados)
- _Sin API key ni integraciones externas — app 100% local_

-----

## Reglas de progresión

**Auto-aplicadas** al finalizar sesión (`applyProgression()` en `index.html`, ~line 770). Toggle en Config (`settings.autoProgress`, default ON).

- Compara reps reales por serie vs `targetReps` del plan (`DB.plan.weeks[w][d].exercises[i].reps`)
- **Compuestos**: ±2.5kg. **Aislamiento**: ±1.25kg.
- Todas series completas con reps ≥ target + `kneeStatus=bien` → **+bump**
- 1 shortfall → **mantiene** (margen tolerancia día malo)
- ≥2 shortfalls → **-bump**
- `kneeStatus=leve` → mantiene (no progresar con molestia)
- `kneeStatus=dolor` → -bump solo en `quadHeavy` (prensa, jack squat), resto mantiene
- Cardio / `noWeight` / time-based → skip
- Aplica a **todas las ocurrencias futuras** del mismo `(día, ex.id)` (no toca semanas pasadas)
- **Caps PFPS** (`PROG_CAPS`): leg_ext 17.5 max, crossover 12 max (VMO endurance), step-up 15 max
- Modal post-sesión muestra `nombre: viejo→nuevo kg ↑/↓` con botón "↶ Deshacer" (restaura snapshot del plan pre-progresión)

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
