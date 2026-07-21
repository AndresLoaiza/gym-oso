# Fase B: Motor por objetivo + plan de Melisa — Design

**Fecha:** 2026-07-20
**Estado:** Aprobado (diseño). Pendiente implementación.
**Depende de:** Fase A (multi-perfil) — ya implementada. `DB.profile.objective` reservado ahí.

## Contexto y problema

El motor de plan está 100% cableado a **trekking nivel 4 + PFPS** (Andrés): `OBJECTIVE` singleton, split 3 días A(pierna/cuádriceps)/B(tren superior)/C(trekking-cardio), wall sit isométrico, foco VMO, caps PFPS, ventanas endurance-heavy, `adaptSessionForKnee` con restricciones de rodilla, y un paso de onboarding de estado de rodilla.

Melisa (segunda persona, otro device, aislada por Fase A) quiere **más fuerza + estar más en forma** y **no tiene problemas de salud** (sin PFPS). Necesita un motor distinto: full-body orientado a fuerza, ROM completo, sin restricciones de rodilla, con acondicionamiento ligero.

## Principio rector

**Aditivo y aislado.** Cuando `objective === 'trekking_n4_pfps'`, todo el código de Andrés corre idéntico (cero regresión). La lógica nueva solo se activa para `strength_fitness`. Se logra ramificando por objetivo en los puntos de decisión, sin reescribir los builders existentes.

## Decisiones (evidencia)

- **3 días/semana full-body** (elección user). Frecuencia 3×/músculo superior en principiantes (Schoenfeld 2016 meta de frecuencia).
- **Fuerza primero + cardio ligero POST-pesas** (user delegó a evidencia). Wilson 2012 meta: dosis baja de cardio concurrente no interfiere con fuerza/hipertrofia; hacerlo después de las pesas evita mermar la fuerza (Coffey & Hawley).
- **Full ROM** sin PFPS (Schoenfeld 2020 ROM: rango completo ≥ parcial para hipertrofia/fuerza en sanos).
- **Sobrecarga progresiva + doble progresión** (reusa el motor existente: Helms RP, Schoenfeld 2017).

## Arquitectura

### 1. Registro de objetivos

`OBJECTIVE` (singleton) → **`OBJECTIVES`** (map keyed por id):

```js
const OBJECTIVES = {
  trekking_n4_pfps: { /* el OBJECTIVE actual, + kneeSafe:false */ },
  strength_fitness: {
    id: 'strength_fitness',
    name: 'Fuerza + estado físico',
    description: 'Fuerza general full-body + acondicionamiento, ROM completo, sin restricción de rodilla',
    pattern: 'straight_sets',
    kneeSafe: true,
    windows: {
      strength:  { adapt:[8,12],  str:[4,6],  end:[10,14], taper:[6,10] },
      hypertrophy:{ adapt:[10,15], str:[8,12], end:[12,18], taper:[10,14] },
      endurance: { adapt:[12,18], str:[10,15], end:[15,20], taper:[12,15] },
      posterior: { adapt:[8,15],  str:[6,10], end:[12,15], taper:[8,12] },
      pfps:      { adapt:[10,15], str:[8,12], end:[12,18], taper:[10,14] }, // no usado; presente por completitud de EX_TYPE
    },
  },
};
function activeObjective(){ return OBJECTIVES[DB.profile?.objective] || OBJECTIVES.trekking_n4_pfps; }
```

- `trekking_n4_pfps` gana `kneeSafe:false`. Se conservan sus `windows` actuales EXACTAS.
- Todas las referencias `OBJECTIVE.` en el código pasan a `activeObjective().` (auditar: `windowOf`, `tagPlanWithWindows`, Home card, Plan render, cualquier `OBJECTIVE.name`/`.windows`/`.id`).
- `EX_TYPE` sigue global (el tipo es propiedad del ejercicio). Las ventanas salen del objetivo activo. Cada objetivo debe declarar `windows` para todos los `type` que sus ejercicios usan.

### 2. `windowOf` / `tagPlanWithWindows` objective-aware

`windowOf(exId, ph)` lee `activeObjective().windows[type][ph]` en vez de `OBJECTIVE.windows`. Igual `tagPlanWithWindows`. El plan se taggea con las ventanas del objetivo con el que se generó.

Un `type` sin ventana en el objetivo activo → `windowOf` devuelve null (fallback simple de progresión, ya soportado). Para `strength_fitness`, los ejercicios full-body usan types `strength`/`hypertrophy`/`posterior`/`endurance` (ver EX_TYPE abajo).

### 3. EX_TYPE — nuevos ids y ajuste

Los días de Melisa usan estos ids del CATALOGO (todos existen): `sentadilla_hack`, `leg_press_45`, `jack_squat`, `peso_muerto`, `hiper_inversa`, `curl_femoral`, `prone_leg_curl`, `banco_plano`, `banco_declinado`, `press_hombros_107`, `pec_deck_polea`, `pulldown`, `remo_isolateral`, `tirador_largo`, `camber_curl`, `pantorrilla_sentado`, `mancuernas`, `leg_ext`, `stairmaster`, `trotadora`.

Añadir a `EX_TYPE` los ids que hoy no están mapeados y que usará el plan strength (sino `windowOf`→null→fallback, aceptable pero mejor tipar):
```
sentadilla_hack:'strength', banco_declinado:'strength', tirador_largo:'strength',
press_hombros_pl:'strength', pec_deck_polea:'hypertrophy', curl_femoral:'posterior',
```
(No se cambia ningún mapeo existente — solo se añaden. `hypertrophy` es un type nuevo solo con ventana en `strength_fitness`; en trekking ese type no aparece, sin efecto.)

### 4. Generador ramificado

`generateLocalPlan(opts)` decide el builder por objetivo:

```js
const obj = DB.profile?.objective || 'trekking_n4_pfps';
// ... helpers compartidos (round, wLeg, wBench, wPull, phase) permanecen ...
const buildDay = obj === 'strength_fitness'
  ? [dayFB_A, dayFB_B, dayFB_C]   // nuevos, full-body
  : [dayA, dayB, dayC];           // trekking, INTACTOS
for(let w=0; w<8; w++){
  const isTaper = phase(w)==='taper';
  const wk = buildDay.map(fn => isTaper ? taperize(fn(w)) : fn(w));
  weeks.push(wk);
}
DB.plan = { start: todayISO(), weeks, generatedBy:'local', objective: obj };
tagPlanWithWindows();
// ... carryover C3 igual ...
```

`dayA/dayB/dayC` (trekking) quedan **sin cambios**. Se añaden `dayFB_A/dayFB_B/dayFB_C` dentro de `generateLocalPlan` (comparten `wLeg/wBench/wPull/phase/round/rmLeg/rmBench/rmPull`).

### 5. Días full-body de Melisa (dayFB_A/B/C)

Pesos derivados de los mismos 3 baselines (prensa/banca/pulldown) por ratios. Cada día full-body:

- **dayFB_A — Squat + empuje horizontal** (`focus:'Full-body A · Sentadilla'`):
  - `stairmaster` calentamiento 6 min (isCardio)
  - `sentadilla_hack` — compuesto pierna principal, ROM completo, `wLeg` por fase (adapt 3×10 @0.55, str 4×6 @0.78, end 3×13 @0.58, taper 3×8 @0.62)
  - `peso_muerto` (RDL) — hinge posterior, `wLeg(0.40)` aprox por fase
  - `banco_plano` — empuje, `wBench` por fase (adapt 3×10 @0.65, str 4×6 @0.80, end 3×12 @0.62, taper 3×8 @0.70)
  - `pulldown` — tracción vertical, `wPull` por fase
  - `curl_femoral` — accesorio isquio, 3×12 `wLeg(0.30)`
  - `trotadora` finisher caminata inclinada 12 min (isCardio, post-pesas)
- **dayFB_B — Prensa + empuje vertical** (`focus:'Full-body B · Empuje'`):
  - `stairmaster` 6 min calentamiento
  - `leg_press_45` — compuesto pierna, ROM completo (SIN cue pies-altos; full ROM), `wLeg` por fase
  - `hiper_inversa` — posterior/glúteo, 3×12
  - `press_hombros_107` — empuje vertical, `wBench(0.62)` por fase
  - `remo_isolateral` — tracción horizontal, unilateral, `wBench(0.90*benchPct)`
  - `camber_curl` — bíceps, 3×12 `wBench(0.30)`
  - `stairmaster` finisher 12 min
- **dayFB_C — Mixto + conditioning** (`focus:'Full-body C · Mixto'`):
  - `trotadora` 6 min calentamiento
  - `jack_squat` — compuesto pierna, ROM completo, `wLeg(0.50)` por fase
  - `mancuernas` — step-up / split squat ROM completo, unilateral, carga moderada
  - `pec_deck_polea` o `banco_declinado` — empuje accesorio, `wBench` moderado
  - `tirador_largo` — tracción, `wPull` moderado
  - `pantorrilla_sentado` — pantorrilla, 4×15 `wLeg(0.55)`
  - `stairmaster` finisher 15 min (día con más cardio)

Sets/reps por fase siguen las ventanas de `strength_fitness` (compuestos 4-6 en str, etc.). Notas SIN lenguaje PFPS (no "ROM parcial", no "no pasar 90°"): en su lugar cues de técnica full-ROM y RIR. Ejercicios unilaterales (`mancuernas`, `remo_isolateral`, `crossover` si se usa) mantienen el flag `unilateral` y el manejo existente.

### 6. PFPS opcional (`kneeSafe`)

- **Onboarding:** el paso de estado de rodilla (step índice actual del knee) se muestra solo si el objetivo elegido tiene `kneeSafe===false`. Para `strength_fitness` se omite.
- **Check-in pre-sesión** (`renderRutina` → `askKneeCheckin`): si `activeObjective().kneeSafe`, NO se pide check-in; `DB._kneeStatus` se fija a `'bien'` directamente y la sesión arranca sin modal de rodilla.
- **`adaptSessionForKnee(td, status)`:** si `activeObjective().kneeSafe`, retorna `td` sin cambios (equivale al path 'bien').
- **`decideBump`:** las ramas de rodilla (`leve`/`dolor`) no disparan porque el status queda 'bien'. Sin cambios de código necesarios (ya cortocircuitan con 'bien'). Verificar que ningún path fuerce check-in.
- Sin wall sit, sin foco VMO forzado, leg ext a rango completo (los días full-body simplemente no incluyen wall sit ni `_wall_sit`).

### 7. Onboarding objective-aware

- **Nuevo paso "¿Cuál es tu objetivo?"** insertado **inmediatamente después de Bienvenida (step 0) y antes de Perfil** — debe ir antes del paso de estado de rodilla porque éste depende del objetivo. 2 botones →
  - "Trekking + cuidado de rodilla" → `objective='trekking_n4_pfps'`
  - "Fuerza + estar en forma" → `objective='strength_fitness'`
  - Guarda en un buffer de onboarding; al finalizar se escribe `DB.profile.objective`.
- El **paso de estado de rodilla** solo se renderiza si el objetivo elegido tiene `kneeSafe===false`.
- **Baseline (3 lifts: prensa, banca, pulldown)** se mantiene para ambos objetivos (derivan todas las cargas).
- **Copys** del onboarding condicionados por objetivo donde mencionan PFPS/trekking (usar el `name`/`description` del objetivo activo, o texto neutro).
- **Andrés:** su perfil ya tiene `objective='trekking_n4_pfps'` (migración Fase A) y no re-onboardea → sin cambios. Si re-hace onboarding, el paso objetivo aparece pre-seleccionable.

### 8. Caps PFPS

`PROG_CAPS` se mantienen (seguridad de máquina). Para una principiante rara vez topan. Relajarlos por objetivo queda **fuera de alcance** de Fase B (revisable si estorban el progreso real de Melisa).

## Manejo de errores / bordes

- Objetivo desconocido en `DB.profile.objective` → `activeObjective()` cae a `trekking_n4_pfps` (fallback seguro).
- Plan generado con un objetivo y luego cambia el objetivo del perfil: fuera de alcance (el objetivo se fija en onboarding y no se edita en Fase B). Si se editara, `generateLocalPlan` en el próximo ciclo usaría el nuevo objetivo; el plan vigente sigue con el viejo hasta regenerar. Aceptable.
- `windowOf` con type sin ventana en el objetivo activo → null → fallback de progresión simple (ya soportado, no rompe).
- Interacción con la invariante `planIsValid` (Fase reciente): sin cambios; el plan strength también tiene `weeks[]`.

## Testing

Puros (harness Node):
- `OBJECTIVES` integridad: ambos ids presentes; `trekking_n4_pfps.kneeSafe===false`, `strength_fitness.kneeSafe===true`; `strength_fitness.windows` cubre los types que sus ejercicios usan.
- `activeObjective()`: sin `DB.profile.objective` → trekking; `='strength_fitness'` → strength; valor basura → trekking (fallback).
- `windowOf` bajo cada objetivo: mismo exId, distinta ventana según objetivo activo.
- `generateLocalPlan` con `DB.profile.objective='strength_fitness'`: produce 8 semanas × 3 días; los días son full-body (contienen al menos un compuesto pierna + un empuje + una tracción); NO contienen `_wall_sit`; reps de compuestos en fase str dentro de [4,6]; `DB.plan.objective==='strength_fitness'`.
- `generateLocalPlan` con objetivo trekking (o sin objetivo): produce los días A/B/C actuales SIN cambios (test de no-regresión — comparar ids/estructura clave contra el comportamiento previo).
- `adaptSessionForKnee` con objetivo `kneeSafe`: retorna el plan sin modificar aunque se pase status `'dolor'` (porque el objetivo lo hace kneeSafe) — **decisión de implementación:** `adaptSessionForKnee` consulta `activeObjective().kneeSafe` y cortocircuita.
- `tagPlanWithWindows` sobre un plan strength: taggea con ventanas de `strength_fitness`.

DOM/onboarding/boot → verificación manual (server local + incógnito como Melisa: elegir objetivo "Fuerza+forma", confirmar que NO pide estado de rodilla, que el plan generado es full-body, y que NO aparece check-in de rodilla al iniciar sesión).

## Impacto en docs / infra

- `CLAUDE.md`: sección "Objetivos / motor por objetivo" (OBJECTIVES, activeObjective, kneeSafe); actualizar §Objetivo+ventanas, §Plan, §Onboarding para reflejar que son objective-aware.
- `sw.js`: bump de cache.
- Memoria: `project_supabase_sync` ya menciona Melisa; añadir/actualizar que su objetivo real (`strength_fitness`) ya está implementado.

## Fuera de alcance

- Relajar `PROG_CAPS` por objetivo.
- Editar el objetivo de un perfil ya onboardeado desde Config.
- Objetivos adicionales (hipertrofia pura, pérdida de grasa, correr) — el registro `OBJECTIVES` los deja triviales de añadir después.
- Cambiar el catálogo o las fotos.
