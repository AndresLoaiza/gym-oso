# context.md — Mapa del código (El Oso Gym)

> Propósito: entender **qué hace** la app sin leer las ~2400 líneas de `index.html`.
> Si cambias lógica, actualiza este archivo + `CLAUDE.md` + tests.
> Convención: referencias por **nombre de función** (las líneas se mueven). `index.html` = todo HTML+JS inline.

-----

## 1. Arquitectura en una frase

Single-file PWA (`index.html`). Sin frameworks. Estado global `DB` (objeto JS) ↔ `localStorage['elosoGymV2']`. CSS en `elosogym.css`. Toda mutación llama `saveDB()`. Navegación = mostrar/ocultar `<section class="screen">` con `show(name)`.

## 2. Flujo de arranque (boot)

1. `loadDB()` lee localStorage, merge con `DEFAULT_DB`.
2. Migraciones idempotentes en boot:
   - **Fórmula v2** (`formulaVersion !== 2`): recalcula 1RMs de `baseline.tests` (Epley/Mayhew) + regenera plan.
   - `tagPlanWithWindows()`: inyecta `{type,phase,repMin,repMax}` a cada ejercicio del plan (double progression).
   - `migrateDayCV3()`: reconstruye Day C (cadena posterior vía RDL `peso_muerto`), preserva pesos progresados.
3. Si no hay `profile` → onboarding. Si hay → home.
4. Registra service worker (`sw.js`).

## 3. Estado: el objeto `DB`

Claves persistentes (ver `CLAUDE.md` § localStorage para el shape completo):
- `profile` — perfil + `baseline` (3 tests compuestos → 1RM).
- `plan` — `weeks[w][d] = {focus, notes, exercises:[...]}`. 8 semanas × 3 días.
- `sessions[]` — historial. Cada sesión: `{date, exercises[], planRef:{w,d}, kneeStatus, note}`.
- `sessionSets{}` — **sesión en curso** (work buffer). `{idx: {id,name,isCardio,noWeight,unilateral,rest,sets[],note,userNote}}`.
- `settings` — `{wake, autoProgress, telemetry}`.
- `telemetry` — `{events[], sessionId, startedAt, version}` (FIFO cap 2000).

Claves efímeras (prefijo `_`, no en `DEFAULT_DB`): `_currentRef`, `_kneeStatus`, `_adaptedSession`, `_sessionNote`, `_collapsedEx`/`_userExpanded` (Sets in-memory), `_progSnapshot`, `_swapReason`.

`sessionSets` vs `sessions`: `sessionSets` es lo que estás haciendo AHORA (editable). Al `Finalizar sesión` se serializa a `sessions[]` y `sessionSets` se vacía.

## 4. Catálogo de máquinas — `CATALOGO[]`

25 objetos: `{id, img, name, muscle, safety, knee:'safe'|'caution'|'avoid', isCardio?, unilateral?, priority?, uncertain?, note?}`.
- `muscle`: string separado por `·` (ej. `'Cuádriceps · Glúteo'`). Se tokeniza para sugerir swaps.
- `knee`: bandera PFPS por máquina. `leg_ext` = `avoid` (PFJ directo).
- `unilateral`: `crossover`, `mancuernas`, `remo_isolateral`.
- IDs en snake_case. `_wall_sit` (id con `_`) es sintético del plan, no del catálogo.
- Thumbnails: `thumb(id, size)` → base64 desde `catalogo-imgs.js`.

## 5. Generación del plan — `generateLocalPlan()` + helpers

- `phase(week)` → `'adapt'|'str'|'end'|'taper'`. Sem 1-2 adapt, 3-5 str, 6-7 end, 8 taper.
- `wLeg(f)`/`wBench(f)`/`wPull(f)` → peso desde el 1RM correspondiente × factor, redondea a 2.5kg.
- Pesos de máquinas derivados por **ratios NSCA** desde los 3 baselines.
- Day A=pierna, B=tren superior, C=trekking-cardio.
- **Day C** orden fijo `DAYC_ORDER`: trotadora → jack_squat → peso_muerto(RDL) → step-up → abductor → stairmaster. `rdlExercise(week)` da peso/reps del RDL por fase.
- `taperize(day)` → -1 set por ejercicio (sem 8).
- Cardio/isométrico: `reps` es **string** (`'10 min'`, `'30s'`), `isCardio:true` o `noWeight:true`.
- Tras generar: `tagPlanWithWindows()`.

## 6. Objetivo + ventanas de progresión

- `OBJECTIVE` (singleton) = `trekking_n4_pfps`. `windows[type][phase] = [repMin, repMax]`.
- `EX_TYPE[id]` → `'strength'|'endurance'|'pfps'|'posterior'`.
- `windowOf(exId, phase)` / `phaseOfWeek(week)` → resuelven la ventana de reps.

## 7. Pantalla "Hoy" (rutina) — núcleo de la app

### Entrada
- `nextSession()` → primer `{weekIdx, dayIdx, session}` no completado (secuencial, no por calendario).
- `renderRutina()`:
  - **Guard de desync**: si `planRef` cambió, falta `_kneeStatus`, `sessionSets` stale o vacío → `askKneeCheckin()` y reconstruye `sessionSets` desde el plan adaptado.
  - **Check-in rodilla** (`adaptSessionForKnee(td, status)`): `bien` normal · `leve` cargas -20% · `dolor` quita ejercicios quad-heavy, -40%, agrega isométricos.
  - Construye `sessionSets`: si unilateral, duplica sets (`side:'L'` × N, luego `side:'R'` × N).
- `renderRutinaInner(ns, td)`: pinta una card por ejercicio.

### Card de ejercicio (renderRutinaInner)
- Header: thumb + nombre + chips (summary done, descanso, tempo, unilateral).
- Chips/botones: `ℹ Cómo usar` (si `HOWTO[id]`), `+ Serie`, `⏱ Aguante Ns` (solo isométricos, ver §8), `⏱ Serie`, `⏱ Cambio ej. 2:30`, `⇄ Cambiar` (swap, §9).
- **Input `📝 Nota`** por ejercicio (`data-act="ex-note"`) → `sessionSets[i].userNote` (§10).
- `renderSets(i)`: filas editables. Detecta time-based (`/s$|min/` en reps) → columnas colapsan a `# | Tiempo | ✓`, input texto, peso `—`.
- **Marcar ✓** (`set.done`): dispara `startTimer(rest,'serie')` + `vibrate(50)`. Si todos los sets done → **auto-colapsa** la card (salvo que el user la haya re-expandido, `_userExpanded`).
- `updateProgress()`: barra `done/total series`.

### Salida
- **Textarea `#session-note`** (bajo la lista) → `DB._sessionNote` (§10).
- `+ Añadir ejercicio`: modal catálogo (no-cardio), agrega a `sessionSets` con rest 75s.
- `↺ Reiniciar sesión`: vacía `sessionSets`, re-pregunta rodilla. Track `session_abandon`.
- `✓ Finalizar sesión`: serializa a `sessions[]` (incluye `note` + `userNote` por ejercicio), corre `applyProgression()` si `autoProgress`, muestra modal de progresión o de celebración.

## 8. Cronómetro de aguante isométrico (feature)

- `parseHoldSec(reps)`: `'30s'`→30, `'2 min'`→120, número→sí, no-tiempo→0.
- `isHoldEx(ex)`: `true` si time-based + `noWeight` + **no** cardio (wall sit, holds). Estos llevan botón cronómetro.
- Botón `⏱ Aguante Ns` en la card → `startTimer(sec, 'hold')`.
- `startTimer(sec, kind)`: cuenta regresiva. Label `'Aguante'|'Serie'|'Cambio'`. **Al llegar a 0: `navigator.vibrate([200,100,200,100,200])` + beep** → avisa fin del aguante. Solo isométricos (no cardio, por decisión).

## 9. Swap de ejercicio (feature: máquina ocupada/mala)

- `muscleTokens(m)`: tokeniza `muscle` por `· / , +`.
- `suggestSwaps(exId)`: alternativas del `CATALOGO` → no-cardio, knee `safe|caution`, ≥1 músculo en común. Orden: más solape, luego `safe` antes que `caution`.
- `openSwapModal(idx)`: modal con chips de razón (ocupada/mala/dolor → `_swapReason`) + lista de sugerencias.
- `doSwap(idx, newId)`: reemplaza `sessionSets[idx].id/name/note/unilateral`, **conserva reps/peso**; si cambia la condición unilateral reconstruye los sets. Track `ex_swap {from,to,reason}`.

## 10. Comentarios de sesión (feature: análisis de comportamiento)

Dos niveles, ambos se guardan en `sessions[]` (exportables vía backup + telemetría):
- **Por ejercicio**: `sessionSets[i].userNote` (input en cada card) → viaja en `session.exercises[i].userNote`. Track `ex_note`.
- **De sesión**: `DB._sessionNote` (textarea) → `session.note` al finalizar. Track `session_note`.
- Se renderizan en **Historial** (detalle expandible). `escHtml()` escapa todo input de usuario.

## 11. Auto-progresión — `applyProgression(session)`

Double progression (Helms/Schoenfeld). Pipeline:
1. `analyzeWeightPattern(sets)` → `constant|ascending|descending|mixed|unilateral` + `dropDetected` + `topSet`.
2. `decideBump(ex, pattern, knee)` → `{weightBump, repBump, reason}`:
   - cardio/noWeight → skip · `leve` → 0 · `dolor`+quadHeavy → -step · drop → 0 · ≥2 shortfalls → -step · allComplete+bien → +1 rep o (+peso+reset reps) · 1 shortfall → 0.
3. **Sync de peso probado**: base futura = `max(planWeight, provenW)` (peso real levantado) → elimina re-edición manual. Solo sube, no con bump negativo.
4. `PROG_CAPS[id]`: tope de peso solo donde hay flexión de rodilla cargada (leg_ext 17.5, step-up 25, etc.).
5. Aplica a semanas futuras **same-phase**. Modal `showProgressionModal()` con `from→to` + `↶ Deshacer` (`_progSnapshot`).

## 12. Telemetría — `track(type, data)`

100% local. Skip si `settings.telemetry===false`. Nunca rompe la app (try/catch). FIFO cap 2000.
Tipos: `screen_view, modal_open, glosario_open, howto_open, knee_check, session_start/finish/abandon, set_add/delete/edit/check, rest_start (kind serie|ejercicio|hold), ex_collapse_toggle, ex_swap, ex_note, session_note`.
Export JSON desde Config → análisis offline (fricciones, conceptos confusos, abandonos, **ahora también notas de usuario**).

## 13. Otras pantallas

- **Onboarding** (4 pasos): bienvenida, perfil, rodilla, test baseline (3 compuestos → 1RM híbrido). `calc()` avisa si reps >20.
- **Plan**: strip de 8 semanas, detalle por día, contador `N/3`.
- **Catálogo** (`renderCatalogo`): 25 máquinas, tags PFPS, búsqueda, lightbox.
- **Historial** (`renderHist`): stats, Chart.js (peso máx + reps prom por ejercicio), lista de sesiones con detalle + notas, borrar.
- **Config**: perfil + 3 baselines, wake lock, auto-progresión, telemetría (export/clear), backup/restore JSON, reiniciar onboarding.

## 14. Mascota El Oso

`BEARS` dict + `bearSVG(name, size)`: 5 osos chibi SVG inline (rest/dumbbell/press/bike/stairs). **Solo estados positivos** (logo, bienvenida, card Hoy `bearForFocus`, fin de sesión, modal progresión). Nunca en error/carga/destructivo.

## 15. Utilidades clave

- `epley1RM(w, r)` — 1RM híbrido Epley(≤10)/Mayhew(>10), cap r=30.
- `workWeight(oneRM, factor)` — redondea a 2.5kg.
- `parseNum(str)` — coma decimal es-CO (`7,5`→7.5).
- `escHtml(s)` — escapa `< > & "` para HTML/atributos seguros.
- `openModal(html)`/`closeModal()` — modales (preferir sobre `alert/confirm` en PWA iOS).
- `saveDB()` — persiste `DB` a localStorage. **Llamar tras cada mutación.**

## 16. Tests — `tests/test.js`

Harness: stub DOM/localStorage/navigator + `new Function(code + 'return {bindings}')()` para extraer const/function. Bindings expuestos incluyen las funciones puras (`parseHoldSec, isHoldEx, muscleTokens, suggestSwaps, escHtml`, etc.). Correr `node tests/test.js` antes de commit. **Agregar tests al añadir lógica testeable.** 141 tests al día de hoy.

## 17. Deploy

Modificar `index.html` → **bump `CACHE` en `sw.js`** (`oso-gym-vN`) para invalidar SW. `git add -A && commit && push` → GitHub Pages ~1-2 min.
