# Fase B: Motor por objetivo + plan de Melisa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer el motor de plan consciente del objetivo (`OBJECTIVES` map + `activeObjective()`), añadir el objetivo `strength_fitness` con un plan full-body de fuerza (Melisa), y hacer PFPS/onboarding opcionales — sin alterar el comportamiento de Andrés (`trekking_n4_pfps`).

**Architecture:** Aditivo y aislado. `OBJECTIVE` singleton → `OBJECTIVES` map. Todos los puntos de decisión ramifican por `DB.profile.objective` con fallback a `trekking_n4_pfps`. Los builders `dayA/B/C` de trekking quedan intactos; se añaden `dayFB_A/B/C`. `kneeSafe` apaga el check-in y `adaptSessionForKnee`. El onboarding gana un paso de objetivo y vuelve su flujo dinámico.

**Tech Stack:** HTML/JS inline (`index.html`), harness Node (`tests/test.js`, `node tests/test.js`).

**Spec:** `docs/superpowers/specs/2026-07-20-fase-b-motor-por-objetivo-design.md`

---

## File Structure

- `index.html` — todo. Cambios: `OBJECTIVE`→`OBJECTIVES`+`activeObjective` (~L987), refs `OBJECTIVE.` (L1018-1019, L2007, L2097, L3222), `EX_TYPE` additions (~L1001), `generateLocalPlan` branch + `dayFB_A/B/C` (~L1965-2007), `adaptSessionForKnee` kneeSafe (~L2242), `renderRutina` check-in gating (~L2266), onboarding flujo dinámico (~L1710-1864 + dots L29-34).
- `tests/test.js` — tests de objetivos + expose bindings.
- `sw.js`, `CLAUDE.md`, memoria.

---

## Task 1: OBJECTIVES map + activeObjective + reemplazo de refs

**Files:**
- Modify: `index.html` (`OBJECTIVE` def + 5 refs)
- Test: `tests/test.js`

- [ ] **Step 1: Escribir tests que fallan**

En `tests/test.js`, antes de `/* ============= FRENTE C`, añadir:

```js
console.log('\n--- Fase B: motor por objetivo ---');
test('OBJECTIVES: ambos objetivos, kneeSafe correcto', () => {
  assertTrue(!!OBJECTIVES.trekking_n4_pfps, 'trekking presente');
  assertTrue(!!OBJECTIVES.strength_fitness, 'strength presente');
  assertEq(OBJECTIVES.trekking_n4_pfps.kneeSafe, false);
  assertEq(OBJECTIVES.strength_fitness.kneeSafe, true);
});
test('OBJECTIVES.strength_fitness cubre los types que usan sus ejercicios', () => {
  const w = OBJECTIVES.strength_fitness.windows;
  ['strength','hypertrophy','endurance','posterior'].forEach(t =>
    assertTrue(!!w[t] && !!w[t].str, 'ventana para '+t));
});
test('activeObjective: sin profile → trekking; strength → strength; basura → trekking', () => {
  DB.profile = null;
  assertEq(activeObjective().id, 'trekking_n4_pfps');
  DB.profile = { objective: 'strength_fitness' };
  assertEq(activeObjective().id, 'strength_fitness');
  DB.profile = { objective: 'zzz' };
  assertEq(activeObjective().id, 'trekking_n4_pfps');
  DB.profile = null;
});
test('windowOf usa las ventanas del objetivo activo', () => {
  DB.profile = { objective: 'trekking_n4_pfps' };
  const wt = windowOf('leg_press_45', 'str');   // strength en trekking: [5,8]
  assertEq(wt.repMin, 5); assertEq(wt.repMax, 8);
  DB.profile = { objective: 'strength_fitness' }; // strength en strength_fitness: [4,6]
  const ws = windowOf('leg_press_45', 'str');
  assertEq(ws.repMin, 4); assertEq(ws.repMax, 6);
  DB.profile = null;
});
```

Añadir bindings en `exposeReturn` (`tests/test.js`), en la línea `PROFILES, resolveProfileId, uidOf, profileName,`:
```js
    PROFILES, resolveProfileId, uidOf, profileName,
    OBJECTIVES, activeObjective,
```

- [ ] **Step 2: Correr → fallan**

Run: `node tests/test.js`
Expected: FAIL `OBJECTIVES is not defined`.

- [ ] **Step 3: Implementar `OBJECTIVES` + `activeObjective`**

En `index.html`, REEMPLAZAR el bloque que hoy empieza en `const OBJECTIVE = {` y termina en la línea `};` de cierre (el objeto singleton completo, actualmente L987-999) por:

```js
const OBJECTIVES = {
  trekking_n4_pfps: {
    id: 'trekking_n4_pfps',
    name: 'Trekking nivel 4',
    description: 'Endurance multihora bajo carga + protección PFPS + cadenas posteriores',
    pattern: 'straight_sets',
    kneeSafe: false,
    windows: {
      strength:  { adapt:[10,15], str:[5,8],  end:[12,18], taper:[8,12] },
      endurance: { adapt:[12,20], str:[12,18],end:[15,25], taper:[12,18] },
      pfps:      { adapt:[12,20], str:[12,18],end:[15,20], taper:[12,18] },
      posterior: { adapt:[8,15],  str:[8,12], end:[12,18], taper:[10,15] },
    },
  },
  strength_fitness: {
    id: 'strength_fitness',
    name: 'Fuerza + estado físico',
    description: 'Fuerza general full-body + acondicionamiento, ROM completo, sin restricción de rodilla',
    pattern: 'straight_sets',
    kneeSafe: true,
    windows: {
      strength:   { adapt:[8,12],  str:[4,6],  end:[10,14], taper:[6,10] },
      hypertrophy:{ adapt:[10,15], str:[8,12], end:[12,18], taper:[10,14] },
      endurance:  { adapt:[12,18], str:[10,15],end:[15,20], taper:[12,15] },
      posterior:  { adapt:[8,15],  str:[6,10], end:[12,15], taper:[8,12] },
      pfps:       { adapt:[10,15], str:[8,12], end:[12,18], taper:[10,14] },
    },
  },
};
function activeObjective(){ return OBJECTIVES[DB.profile?.objective] || OBJECTIVES.trekking_n4_pfps; }
```

- [ ] **Step 4: Reemplazar las 5 referencias `OBJECTIVE.`**

Cada una por su equivalente:
- En `windowOf` (hoy L1018-1019):
  ```js
  if(!t || !activeObjective().windows[t]?.[ph]) return null;
  const [repMin, repMax] = activeObjective().windows[t][ph];
  ```
- En `generateLocalPlan` (hoy L2007): `objective: OBJECTIVE.id` → `objective: (DB.profile?.objective || 'trekking_n4_pfps')`
- En `renderHome` card (hoy L2097): `🎯 ${OBJECTIVE.name} · Fase:` → `🎯 ${activeObjective().name} · Fase:`
- En la migración de boot (hoy L3222): `DB.plan.objective = OBJECTIVE.id;` → `DB.plan.objective = (DB.profile?.objective || 'trekking_n4_pfps');`

Verificar con grep que NO queda ninguna referencia `OBJECTIVE.` ni `OBJECTIVE ` suelta (solo debe existir `OBJECTIVES` y `activeObjective`):
```
grep -nE "OBJECTIVE[^S]" index.html
```
Debe salir vacío (o solo comentarios). Si hay más refs de código, reemplazarlas igual.

- [ ] **Step 5: Correr → pasan**

Run: `node tests/test.js`
Expected: PASS. Total 229 + 4 = 233. `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: OBJECTIVES map + activeObjective (Fase B)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: generateLocalPlan ramificado + días full-body + EX_TYPE

**Files:**
- Modify: `index.html` (`EX_TYPE` ~L1001, `generateLocalPlan` days + loop ~L1965-2007)
- Test: `tests/test.js`

- [ ] **Step 1: Escribir tests que fallan**

En `tests/test.js`, tras los tests de Task 1, añadir:

```js
test('generateLocalPlan strength_fitness: 8×3 full-body, sin wall sit, str reps 4-6', () => {
  DB.profile = { objective:'strength_fitness',
    baseline:{ legPress1RM:60, benchPress1RM:30, pulldown1RM:30, date:'x', tests:{} } };
  DB.sessions = [];
  generateLocalPlan();
  assertEq(DB.plan.objective, 'strength_fitness');
  assertEq(DB.plan.weeks.length, 8);
  DB.plan.weeks.forEach(wk => assertEq(wk.length, 3));
  // No wall sit en ningún día
  const allIds = DB.plan.weeks.flat().flatMap(d => d.exercises.map(e => e.id));
  assertFalse(allIds.includes('_wall_sit'), 'sin wall sit');
  // Cada día tiene ≥1 compuesto de pierna, ≥1 empuje, ≥1 tracción
  const legIds = ['sentadilla_hack','leg_press_45','jack_squat'];
  const pushIds = ['banco_plano','press_hombros_107','pec_deck_polea'];
  const pullIds = ['pulldown','remo_isolateral','tirador_largo'];
  DB.plan.weeks[0].forEach(d => {
    const ids = d.exercises.map(e => e.id);
    assertTrue(ids.some(i => legIds.includes(i)), 'día con pierna');
    assertTrue(ids.some(i => pushIds.includes(i)), 'día con empuje');
    assertTrue(ids.some(i => pullIds.includes(i)), 'día con tracción');
  });
  // Fase str (semana índice 3): compuesto principal reps en [4,6]
  const strDayA = DB.plan.weeks[3][0];
  const hack = strDayA.exercises.find(e => e.id === 'sentadilla_hack');
  assertTrue(hack.reps >= 4 && hack.reps <= 6, 'str reps 4-6, got '+hack.reps);
  DB.profile = null; DB.sessions = [];
});
test('generateLocalPlan trekking (default): días A/B/C intactos (no-regresión)', () => {
  DB.profile = { objective:'trekking_n4_pfps',
    baseline:{ legPress1RM:60, benchPress1RM:30, pulldown1RM:30, date:'x', tests:{} } };
  DB.sessions = [];
  generateLocalPlan();
  assertEq(DB.plan.objective, 'trekking_n4_pfps');
  const d0 = DB.plan.weeks[0][0];
  assertEq(d0.focus, 'Pierna · Cuádriceps');
  const ids = d0.exercises.map(e => e.id);
  assertTrue(ids.includes('_wall_sit'), 'trekking conserva wall sit');
  assertTrue(ids.includes('leg_press_45'), 'trekking conserva prensa');
  DB.profile = null; DB.sessions = [];
});
```

- [ ] **Step 2: Correr → fallan**

Run: `node tests/test.js`
Expected: FAIL (el plan strength aún no existe: `_wall_sit` presente / objective mismatch).

- [ ] **Step 3: Añadir types a `EX_TYPE`**

En `index.html`, dentro del objeto `EX_TYPE` (hoy L1001-1009), AÑADIR estas entradas (no modificar las existentes). Insertar antes del `};` de cierre:
```js
  sentadilla_hack:'strength', banco_declinado:'strength', tirador_largo:'strength',
  press_hombros_pl:'strength', pec_deck_polea:'hypertrophy', curl_femoral:'posterior',
```

- [ ] **Step 4: Añadir los builders full-body y ramificar el loop**

En `generateLocalPlan`, INMEDIATAMENTE DESPUÉS del cierre de `const dayC = (week) => { ... };` (hoy termina en `};` en ~L1989, la línea antes de `// Taper semana 8`), insertar los tres builders full-body:

```js
  // ===== Días full-body objetivo strength_fitness (Melisa) =====
  // Sets/reps por fase compartidos: compuesto vs accesorio (ventanas strength_fitness).
  const sComp = (ph) => ph==='adapt' ? {sets:3, reps:10, rest:90}
                      : ph==='str'   ? {sets:4, reps:6,  rest:165}
                      : ph==='end'   ? {sets:3, reps:13, rest:90}
                      :                {sets:3, reps:8,  rest:120};
  const sAcc  = (ph) => ph==='adapt' ? {sets:3, reps:12, rest:75}
                      : ph==='str'   ? {sets:3, reps:10, rest:90}
                      : ph==='end'   ? {sets:3, reps:15, rest:60}
                      :                {sets:2, reps:12, rest:75};
  const dayFB_A = (week) => {
    const ph = phase(week); const comp = sComp(ph), acc = sAcc(ph);
    const legPct  = ph==='adapt'?0.55: ph==='str'?0.78: ph==='end'?0.58:0.62;
    const benchPct= ph==='adapt'?0.65: ph==='str'?0.80: ph==='end'?0.62:0.70;
    const pullPct = ph==='adapt'?0.65: ph==='str'?0.78: ph==='end'?0.62:0.70;
    return { focus:'Full-body A · Sentadilla',
      notes:'Full-body fuerza. Compuestos primero, ROM completo, RIR 2. Cardio al final.',
      exercises:[
        { id:'stairmaster', name:'StairMaster (calentamiento)', sets:1, reps:'6 min', rest:0, isCardio:true },
        { id:'sentadilla_hack', name:'Sentadilla Hack (ROM completo)', ...comp, weight:wLeg(legPct), note:`Compuesto pierna principal. ${comp.sets} sets. Profundidad cómoda completa. RIR 2.` },
        { id:'peso_muerto', name:'Peso muerto rumano (RDL)', ...comp, weight:wLeg(ph==='str'?0.55:0.42), note:`Cadena posterior (hip hinge). Espalda neutra. ${comp.sets} sets.` },
        { id:'banco_plano', name:'Press de banca', ...comp, weight:wBench(benchPct), note:`Empuje horizontal. ${comp.sets} sets @ ${Math.round(benchPct*100)}% 1RM.` },
        { id:'pulldown', name:'Pulldown (polea alta)', sets:comp.sets, reps:comp.reps+2, rest:acc.rest, weight:wPull(pullPct), note:`Tracción vertical. ${comp.sets} sets.` },
        { id:'curl_femoral', name:'Curl femoral sentado', ...acc, weight:wLeg(0.30), note:`Accesorio isquio. ${acc.sets} sets.` },
        { id:'trotadora', name:'Caminata inclinada (finisher)', sets:1, reps:'12 min', rest:0, isCardio:true, note:'Cardio Z2 post-pesas (no merma fuerza). Inclinación 8-12%.' }
      ] };
  };
  const dayFB_B = (week) => {
    const ph = phase(week); const comp = sComp(ph), acc = sAcc(ph);
    const legPct  = ph==='adapt'?0.55: ph==='str'?0.78: ph==='end'?0.58:0.62;
    const benchPct= ph==='adapt'?0.65: ph==='str'?0.80: ph==='end'?0.62:0.70;
    return { focus:'Full-body B · Empuje',
      notes:'Full-body fuerza. Empuje vertical + prensa + tracción horizontal. ROM completo, RIR 2.',
      exercises:[
        { id:'trotadora', name:'Caminata inclinada (calentamiento)', sets:1, reps:'6 min', rest:0, isCardio:true },
        { id:'leg_press_45', name:'Prensa 45° (ROM completo)', ...comp, weight:wLeg(legPct), note:`Compuesto pierna. ${comp.sets} sets. ROM completo, sin restricción. RIR 2.` },
        { id:'hiper_inversa', name:'Hiperextensión inversa', ...acc, weight:0, note:`Cadena posterior/glúteo. ${acc.sets} sets. Añade disco si es fácil.` },
        { id:'press_hombros_107', name:'Press de hombros', ...comp, weight:wBench(0.62), note:`Empuje vertical. ${comp.sets} sets ≈62% banca.` },
        { id:'remo_isolateral', name:'Remo Iso-Lateral', sets:comp.sets, reps:comp.reps+2, rest:comp.rest, weight:wBench(0.90*benchPct), unilateral:true, note:`UNILATERAL: ${comp.sets} sets × ${comp.reps+2} POR BRAZO. Un lado completo, luego el otro.` },
        { id:'camber_curl', name:'Curl bíceps Camber', ...acc, weight:wBench(0.30), note:`Accesorio bíceps. ${acc.sets} sets.` },
        { id:'stairmaster', name:'StairMaster (finisher)', sets:1, reps:'12 min', rest:0, isCardio:true, note:'Cardio Z2 post-pesas.' }
      ] };
  };
  const dayFB_C = (week) => {
    const ph = phase(week); const comp = sComp(ph), acc = sAcc(ph);
    const legPct  = ph==='adapt'?0.50: ph==='str'?0.70: ph==='end'?0.52:0.55;
    const benchPct= ph==='adapt'?0.55: ph==='str'?0.68: ph==='end'?0.55:0.60;
    const pullPct = ph==='adapt'?0.60: ph==='str'?0.72: ph==='end'?0.58:0.65;
    return { focus:'Full-body C · Mixto',
      notes:'Full-body + más acondicionamiento. Compuestos + accesorios, ROM completo. Cardio final más largo.',
      exercises:[
        { id:'stairmaster', name:'StairMaster (calentamiento)', sets:1, reps:'6 min', rest:0, isCardio:true },
        { id:'jack_squat', name:'Jack Squat (ROM completo)', ...comp, weight:wLeg(legPct), note:`Compuesto pierna. ${comp.sets} sets. ROM completo.` },
        { id:'mancuernas', name:'Split squat / Step-up con mancuernas', sets:acc.sets, reps:12, rest:acc.rest, weight:Math.min(20, Math.max(6, Math.round(rmBench*0.20/2.5)*2.5)), unilateral:true, note:`UNILATERAL: ${acc.sets} sets × 12 POR PIERNA. ROM completo, bajada controlada.` },
        { id:'pec_deck_polea', name:'Pec Deck / Polea', ...acc, weight:wBench(benchPct), note:`Empuje accesorio pecho. ${acc.sets} sets.` },
        { id:'tirador_largo', name:'Tirador largo', ...acc, weight:wPull(pullPct), note:`Tracción. ${acc.sets} sets.` },
        { id:'pantorrilla_sentado', name:'Pantorrilla sentado', sets:4, reps:15, rest:60, weight:wLeg(0.55), note:'Pantorrilla: 4×15, pausa arriba.' },
        { id:'trotadora', name:'Caminata inclinada (finisher largo)', sets:1, reps:'15 min', rest:0, isCardio:true, note:'Día con más cardio. Z2, inclinación 8-12%, post-pesas.' }
      ] };
  };
```

Luego, REEMPLAZAR el loop de armado de semanas (hoy L1997-2007):
```js
  const weeks = [];
  for(let w = 0; w < 8; w++){
    const isTaper = w === 7;
    const wk = [
      isTaper ? taperize(dayA(w)) : dayA(w),
      isTaper ? taperize(dayB(w)) : dayB(w),
      isTaper ? taperize(dayC(w)) : dayC(w)
    ];
    weeks.push(wk);
  }
  DB.plan = { start: todayISO(), weeks, generatedBy: 'local', objective: OBJECTIVE.id };
```
por:
```js
  const objId = DB.profile?.objective || 'trekking_n4_pfps';
  const days = objId === 'strength_fitness' ? [dayFB_A, dayFB_B, dayFB_C] : [dayA, dayB, dayC];
  const weeks = [];
  for(let w = 0; w < 8; w++){
    const isTaper = w === 7;
    const wk = days.map(fn => isTaper ? taperize(fn(w)) : fn(w));
    weeks.push(wk);
  }
  DB.plan = { start: todayISO(), weeks, generatedBy: 'local', objective: objId };
```
(NOTA: la ref `OBJECTIVE.id` de esta línea ya fue reemplazada en Task 1 por `(DB.profile?.objective || 'trekking_n4_pfps')`; aquí se sustituye por `objId`, equivalente. Usar `objId`.)

- [ ] **Step 5: Correr → pasan**

Run: `node tests/test.js`
Expected: PASS. Total 233 + 2 = 235. `All tests passed.` (Los tests de composición strength y de no-regresión trekking pasan.)

- [ ] **Step 6: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: plan full-body strength_fitness + generador ramificado por objetivo (Fase B)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: kneeSafe — apagar PFPS (adaptSessionForKnee + check-in)

**Files:**
- Modify: `index.html` (`adaptSessionForKnee` ~L2242, `renderRutina` check-in ~L2266)
- Test: `tests/test.js`

- [ ] **Step 1: Escribir test que falla**

En `tests/test.js`, tras los tests de Task 2, añadir:

```js
test('adaptSessionForKnee: objetivo kneeSafe → retorna plan sin tocar (aunque status=dolor)', () => {
  DB.profile = { objective:'strength_fitness' };
  const td = { focus:'X', notes:'n', exercises:[{ id:'leg_press_45', name:'P', sets:4, reps:6, weight:50 }] };
  const out = adaptSessionForKnee(td, 'dolor');
  assertEq(out.focus, 'X', 'focus sin sufijo de dolor');
  assertEq(out.exercises[0].weight, 50, 'peso sin reducir');
  assertEq(out.exercises.length, 1, 'sin ejercicios extra de PFPS');
  DB.profile = null;
});
test('adaptSessionForKnee: objetivo PFPS (no kneeSafe) sigue adaptando por dolor', () => {
  DB.profile = { objective:'trekking_n4_pfps' };
  const td = { focus:'X', notes:'n', exercises:[{ id:'leg_press_45', name:'P', sets:4, reps:6, weight:50 }] };
  const out = adaptSessionForKnee(td, 'dolor');
  assertTrue(/ADAPTADO POR DOLOR/.test(out.focus), 'trekking sí adapta');
  DB.profile = null;
});
```

- [ ] **Step 2: Correr → falla**

Run: `node tests/test.js`
Expected: FAIL (kneeSafe aún no cortocircuita; `strength_fitness` adapta como dolor).

- [ ] **Step 3: kneeSafe en adaptSessionForKnee**

En `index.html`, en `adaptSessionForKnee(td, status)` (hoy L2242), añadir como PRIMERA línea del cuerpo (antes de `if(status === 'bien') return td;`):
```js
  if(activeObjective().kneeSafe) return td;  // objetivo sin PFPS: nunca adapta por rodilla
```

- [ ] **Step 4: Saltar el check-in pre-sesión para objetivos kneeSafe**

En `renderRutina` (hoy ~L2266) está el bloque:
```js
  if(refChanged || !DB._kneeStatus || staleSession || ssKeys.length === 0){
    askKneeCheckin(() => {
```
Reemplazar SOLO la llamada `askKneeCheckin(` de esa línea por un helper que la saltea cuando el objetivo es kneeSafe. Primero, añadir el helper JUSTO ANTES de `function askKneeCheckin(onDone){` (hoy L2210 aprox):
```js
// Pide el check-in de rodilla solo si el objetivo NO es kneeSafe; si lo es, arranca directo con 'bien'.
function requestKneeCheckin(onDone){
  if(activeObjective().kneeSafe){ DB._kneeStatus = 'bien'; onDone(); return; }
  askKneeCheckin(onDone);
}
```
Luego, en `renderRutina`, cambiar la línea `askKneeCheckin(() => {` por `requestKneeCheckin(() => {`. (Es la única ocurrencia dentro de `renderRutina`; NO tocar la definición de `askKneeCheckin`.)

- [ ] **Step 5: Correr → pasan**

Run: `node tests/test.js`
Expected: PASS. Total 235 + 2 = 237. `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: kneeSafe apaga adaptación + check-in de rodilla (Fase B)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Onboarding objective-aware (flujo dinámico)

**Files:**
- Modify: `index.html` (step-dots L29-34, onboarding L1710-1864)

Este task es DOM: el harness no lo cubre. Se verifica por grep + verificación manual.

- [ ] **Step 1: Estado del onboarding — añadir objective y flujo dinámico**

En `index.html`, en el bloque de onboarding, REEMPLAZAR:
```js
const OB_STEPS_COUNT = 4;
```
por:
```js
// Flujo dinámico: el paso de rodilla solo aparece si el objetivo NO es kneeSafe.
function obFlow(){
  const kneeSafe = OBJECTIVES[obData.objective || 'trekking_n4_pfps']?.kneeSafe;
  return ['welcome','objective','perfil', ...(kneeSafe ? [] : ['knee']), 'baseline'];
}
```
Y en el objeto `obData` (hoy L1711-1718), añadir `objective: null,` como primer campo (default se resuelve a trekking en `obFlow` hasta que el user elija).

- [ ] **Step 2: renderOnbStep por clave de flujo**

REEMPLAZAR toda la función `renderOnbStep()` (hoy L1727-1831) por esta versión keyed. Los screens pasan de array indexado a objeto por clave; se añade `objective`; el bloque condicional de knee/baseline usa la clave activa:

```js
function renderOnbStep(){
  const flow = obFlow();
  const key = flow[obStep];
  // Dots dinámicos según longitud del flujo
  const dots = $('.step-dots');
  if(dots){ dots.innerHTML = flow.map((_,i) => `<div class="dot${i<=obStep?' active':''}" data-dot="${i}"></div>`).join(''); }
  $('#ob-back').style.display = obStep === 0 ? 'none' : '';
  const wrap = $('#ob-step');
  const objName = OBJECTIVES[obData.objective || 'trekking_n4_pfps']?.name || '';
  const screens = {
    welcome:
      `<div style="display:flex;justify-content:center;margin:4px 0 12px;">${bearSVG('dumbbell', 140)}</div>
       <h1>EL OSO GYM</h1>
       <p>Hola, ${escHtml(profileName())} 👋 Entrenamiento personal adaptado a tu objetivo.</p>
       <h2>¿Qué hace esta app?</h2>
       <ul style="font-size:14px;color:var(--muted);margin:0 0 16px 20px;line-height:1.6;">
         <li>Genera un plan de 8 semanas evidence-based (ACSM 2026)</li>
         <li>Te guía sesión a sesión: series, reps, peso óptimo</li>
         <li>Catálogo de las 25 máquinas de tu gym pre-cargadas</li>
         <li>Progreso visual + ajuste automático de cargas</li>
       </ul>`,
    objective:
      `<h2>¿Cuál es tu objetivo?</h2>
       <p>Define tu plan y las reglas de entrenamiento.</p>
       <div class="pill-row" id="ob-obj" style="flex-direction:column;gap:10px;">
         <button class="pill" data-v="strength_fitness" style="padding:16px;text-align:left;">💪 <b>Fuerza + estar en forma</b><br><span class="small" style="opacity:.7">Full-body, ROM completo, sin restricciones. Para personas sanas.</span></button>
         <button class="pill" data-v="trekking_n4_pfps" style="padding:16px;text-align:left;">🥾 <b>Trekking + cuidado de rodilla</b><br><span class="small" style="opacity:.7">Preparación de montaña con protección patelofemoral (PFPS).</span></button>
       </div>`,
    perfil:
      `<h2>Tu perfil</h2>
       <p>Datos básicos para calibrar la app.</p>
       <label class="field"><span class="lbl">Peso corporal (kg)</span><input class="input" id="ob-w" type="text" inputmode="decimal" value="${obData.weight}"></label>
       <label class="field"><span class="lbl">Estatura (cm)</span><input class="input" id="ob-h" type="number" inputmode="numeric" value="${obData.height}"></label>
       <label class="field"><span class="lbl">Edad</span><input class="input" id="ob-a" type="number" inputmode="numeric" value="${obData.age}"></label>`,
    knee:
      `<h2>Tu condición clínica</h2>
       <div class="pfps-warn"><b>Síndrome de dolor patelofemoral (${term('PFPS')})</b><br>
       La app aplicará automáticamente:<br>
       • Sin flexión &gt;30° bajo carga<br>
       • Priorizar ${term('VMO','vasto medial oblicuo')}<br>
       • Cardio bajo impacto (StairMaster, bici, caminata inclinada)<br>
       • Evitar Leg Extension a ${term('ROM')} completo<br>
       • Box jumps OFF — step-ups OK</div>
       <p style="margin-top:14px;">¿Cómo está la rodilla hoy?</p>
       <div class="pill-row" id="ob-knee">
         <button class="pill" data-v="bien">Sin dolor</button>
         <button class="pill" data-v="leve">Molestia leve</button>
         <button class="pill" data-v="dolor">Dolor &gt;3/10</button>
       </div>`,
    baseline:
      `<h2>Test de baseline (3 máquinas)</h2>
       <p>Test seguro en los <b>3 compuestos principales</b>. Calculamos tu ${term('1RM')} con ${term('Epley')} y derivamos peso para cada máquina del plan.</p>
       <div class="pfps-warn"><b>Protocolo (mismo para los 3):</b><br>
       1. Calienta 5 min bici/StairMaster<br>
       2. 1-2 series ligeras de calentamiento<br>
       3. Carga peso que creas hacer <b>cómodo</b> el # reps indicado (${term('RIR')} 1-2)<br>
       4. Anota peso y reps reales. NO ir al fallo.<br>
       <b>Si nunca has hecho un ejercicio:</b> usa peso muy bajo, mide ahí. Mejor subestimar.</div>
       <div id="ob-tests"></div>
       <div id="ob-1rm" class="small" style="margin-top:8px;line-height:1.6;"></div>`,
  };
  wrap.innerHTML = screens[key];

  if(key === 'objective'){
    $$('#ob-obj .pill').forEach(p => {
      if(p.dataset.v === (obData.objective || '')) p.classList.add('active');
      p.addEventListener('click', () => {
        obData.objective = p.dataset.v;
        renderOnbStep();  // re-render: marca selección + recomputa flujo (knee on/off)
      });
    });
  }
  if(key === 'knee'){
    $$('#ob-knee .pill').forEach(p => {
      if(p.dataset.v === (obData.knee || 'bien')) p.classList.add('active');
      p.addEventListener('click', () => {
        $$('#ob-knee .pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        obData.knee = p.dataset.v;
      });
    });
    obData.knee = obData.knee || 'bien';
  }
  if(key === 'baseline'){
    const wrap2 = $('#ob-tests');
    wrap2.innerHTML = Object.entries(obData.tests).map(([id, t]) => `
      <div class="card" style="background:var(--surface2); padding:10px; margin-bottom:10px;">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px;">
          ${thumb(id,'md')}
          <div style="font-size:13px; flex:1;">
            <b>${t.name}</b><br>
            <span class="small" style="opacity:0.85">${t.hint}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <label class="field" style="flex:1;margin:0;"><span class="lbl">Peso (kg)</span><input class="input ob-tw" data-id="${id}" type="text" inputmode="decimal" value="${t.w}"></label>
          <label class="field" style="flex:1;margin:0;"><span class="lbl">Reps</span><input class="input ob-tr" data-id="${id}" type="number" inputmode="numeric" value="${t.r}"></label>
        </div>
      </div>`).join('');
    $$('#ob-tests .ob-tw').forEach(inp => inp.addEventListener('input', e => { obData.tests[e.target.dataset.id].w = parseNum(e.target.value); calc(); }));
    $$('#ob-tests .ob-tr').forEach(inp => inp.addEventListener('input', e => { obData.tests[e.target.dataset.id].r = +e.target.value || 0; calc(); }));
    calc();
  }
  $('#ob-next').textContent = key === 'baseline' ? 'Generar mi plan' : 'Siguiente';
}
```

IMPORTANTE: la versión previa de `renderOnbStep` tenía el bloque de baseline (`if(obStep === 3){ ... }`) con el HTML de los inputs `ob-tw`/`ob-tr` y los listeners. Está reproducido arriba dentro de `if(key === 'baseline')`. Antes de editar, LEE la función original completa (L1785-1830) para copiar EXACTAMENTE el markup de los inputs y la lógica de `calc()` que ya existe (arriba se transcribió; si difiere en algún atributo, respeta el original).

- [ ] **Step 2b: Verificar dependencias `term()`, `calc()`, `thumb()`**

`term(...)`, `calc()`, `thumb(...)` deben existir ya (se usan en el onboarding actual). Confirmar con grep que `function calc(` y `function term(` (o const) existen. No redefinir.

- [ ] **Step 3: Handlers ob-next / ob-back por clave**

REEMPLAZAR el handler `$('#ob-next').addEventListener(...)` completo (hoy L1833-1860) por:
```js
$('#ob-next').addEventListener('click', async () => {
  const flow = obFlow();
  const key = flow[obStep];
  if(key === 'objective' && !obData.objective){ obData.objective = 'strength_fitness'; }
  if(key === 'perfil'){
    obData.weight = parseNum($('#ob-w').value) || 75;
    obData.height = +$('#ob-h').value || 175;
    obData.age = +$('#ob-a').value || 32;
  }
  if(key === 'baseline'){
    const t = obData.tests;
    DB.profile = {
      weight: obData.weight, height: obData.height, age: obData.age,
      knee: obData.knee || 'bien',
      objective: obData.objective || 'trekking_n4_pfps',
      baseline: {
        legPress1RM:    epley1RM(t.leg_press_45.w, t.leg_press_45.r),
        benchPress1RM:  epley1RM(t.banco_plano.w,  t.banco_plano.r),
        pulldown1RM:    epley1RM(t.pulldown.w,     t.pulldown.r),
        tests: t,
        date: todayISO()
      }
    };
    saveDB();
    generateLocalPlan();
    showApp();
    return;
  }
  obStep = Math.min(flow.length - 1, obStep + 1);
  renderOnbStep();
});
```
El handler `$('#ob-back')` (hoy L1861-1864) queda igual (`obStep = Math.max(0, obStep-1); renderOnbStep();`).

- [ ] **Step 4: Ajustar los dos entry-points que fijan obStep**

Hay dos lugares que arrancan el onboarding en un paso fijo (hoy L3071 `obStep = 1;` en "reset onboarding" de Config, y L3129 `obStep = 0;`). Con el flujo nuevo, `obStep` es índice del flujo. Cambiar el de Config (el que dice `obStep = 1; showOnboarding();`) a `obStep = 0; showOnboarding();` para arrancar desde Bienvenida (el flujo recomputa knee según objetivo). El otro (`obStep = 0`) queda igual.

- [ ] **Step 5: Verificación (harness + manual)**

- Run `node tests/test.js` → sigue `Total: 237 · Passed: 237` / `All tests passed.` (el refactor no debe romper el parseo/carga; recordar que el harness ejecuta el script — si `renderOnbStep`/`obFlow` tienen error de sintaxis, fallará el load).
- Grep: `function obFlow` ×1, `key === 'objective'` presente, `id="ob-obj"` ×1, no queda `OB_STEPS_COUNT` en el archivo, no queda `obStep === 3` ni `obStep === 2` en los handlers.
- Manual (`python -m http.server 8080`, incógnito):
  - Como device fresh → selector → elegir Melisa → onboarding: paso Bienvenida → **Objetivo** → elegir "Fuerza + estar en forma" → siguiente va a **Perfil** → **Baseline** (SIN paso de rodilla). Generar plan → plan full-body, y al iniciar sesión NO pide check-in de rodilla.
  - Repetir eligiendo "Trekking + cuidado de rodilla" → aparece el paso de rodilla y el plan es el de trekking.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: onboarding objective-aware con flujo dinámico (Fase B)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Docs + cache bump + memoria

**Files:**
- Modify: `sw.js`, `CLAUDE.md`, `C:/Users/Home/.claude/projects/d--ANDRES-Claude-Projects-App-gym/memory/project_supabase_sync.md`

- [ ] **Step 1: sw cache bump**

En `sw.js:1`, subir `oso-gym-vN` → `oso-gym-v(N+1)`.

- [ ] **Step 2: CLAUDE.md**

- En `## Objetivo + ventanas de progresión`: cambiar la descripción de `OBJECTIVE` (singleton) por `OBJECTIVES` (map keyed por id) + `activeObjective()` (lee `DB.profile.objective`, fallback `trekking_n4_pfps`). Documentar que cada objetivo trae `kneeSafe` y sus `windows`.
- Añadir subsección "Objetivo `strength_fitness` (Melisa)": 3 días full-body, ROM completo, `kneeSafe:true` (sin check-in, sin `adaptSessionForKnee`, sin wall sit), cardio ligero post-pesas. Evidencia: Schoenfeld 2016 frecuencia, Wilson 2012 concurrente, Schoenfeld 2020 ROM.
- En `### Onboarding`: documentar el paso "objetivo" y que el paso de rodilla es condicional (`!kneeSafe`).
- En `## Coach adaptativo` / progresión: nota de que las ramas de rodilla de `decideBump` no aplican bajo objetivo `kneeSafe` (status siempre 'bien').

- [ ] **Step 3: Memoria**

Editar `project_supabase_sync.md`: la línea de Melisa — cambiar "Fase B ... pendiente" por que el objetivo `strength_fitness` (fuerza + estado físico, sin PFPS, full-body 3 días) ya está implementado. Spec `docs/superpowers/specs/2026-07-20-fase-b-motor-por-objetivo-design.md`.

- [ ] **Step 4: Tests + commit final + push**

Run: `node tests/test.js` → `All tests passed.` (237).
```bash
git add -A
git commit -m "docs: Fase B motor por objetivo (CLAUDE.md, sw cache, memoria)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Notas de ejecución

- Tras cada task, `node tests/test.js` en verde.
- Task 4 (onboarding) es el más delicado: LEER la función original antes de reemplazar para conservar el markup de baseline y `calc()`. El harness ejecuta el script completo, así que un error de sintaxis en el refactor lo detecta el propio `node tests/test.js` (fallo de load).
- No tocar catálogo, fotos, ni el motor de Andrés (`dayA/B/C`, reglas PFPS) salvo lo indicado.
- No-regresión de Andrés: el test 'días A/B/C intactos' debe seguir verde en cada task.
