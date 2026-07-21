/* Test suite App_gym — corre con: node tests/test.js
   Extrae el bloque <script> de index.html, stub DOM/localStorage,
   eval indirecto para que funciones queden en globalThis, ejecuta asserts.
   Exit code 0 = pass, 1 = fail. Mantener actualizado al cambiar lógica. */

const fs = require('fs');
const path = require('path');

// ============= DOM STUBS =============
const noop = () => {};
function stubEl(){
  const el = {
    addEventListener: noop, removeEventListener: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {},
    querySelectorAll: () => [], querySelector: () => stubEl(),
    appendChild: noop, removeChild: noop,
    textContent: '', innerHTML: '', value: '',
    children: [], childNodes: [],
    scrollIntoView: noop, click: noop, focus: noop,
    getAttribute: () => null, setAttribute: noop, removeAttribute: noop,
    closest: () => null,
  };
  return el;
}
globalThis.document = {
  querySelector: (s) => stubEl(),
  querySelectorAll: () => [],
  getElementById: () => stubEl(),
  createElement: () => stubEl(),
  addEventListener: noop,
  removeEventListener: noop,
  documentElement: stubEl(),
  body: stubEl(),
  head: stubEl(),
  visibilityState: 'visible',
};
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
globalThis.localStorage = {
  _store: {},
  getItem(k){ return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; },
  setItem(k, v){ this._store[k] = String(v); },
  removeItem(k){ delete this._store[k]; },
  clear(){ this._store = {}; },
};
globalThis.navigator = {
  vibrate: noop,
  serviceWorker: { register: () => Promise.resolve() },
  wakeLock: undefined,
};
globalThis.URL = { createObjectURL: () => 'blob:stub', revokeObjectURL: noop };
globalThis.Blob = class { constructor(parts, opts){ this.parts = parts; this.type = opts?.type; } };
globalThis.Chart = class { constructor(){} destroy(){} };
// Stub de Supabase: el boot ejecuta createClient + auth.getSession al cargar el script.
const _sbBuilder = { upsert: async()=>({}), insert: async()=>({}),
  select(){ return this; }, eq(){ return this; }, order(){ return this; }, maybeSingle: async()=>({ data:null }) };
globalThis.supabase = { createClient: () => ({
  auth: {
    getSession: async()=>({ data:{ session:null } }),
    getUser: async()=>({ data:{ user:null } }),
    signInWithPassword: async()=>({ data:{ user:null }, error:{ message:'stub' } }),
    signOut: async()=>({}),
  },
  channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
  from: () => _sbBuilder,
}) };
globalThis.alert = noop;
globalThis.confirm = () => true;
globalThis.prompt = () => null;

// ============= LOAD APP =============
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) { console.error('No <script> block found in index.html'); process.exit(2); }
const code = m[1];

// Function() compila el código en su propio scope. Retornamos refs a const/function
// para exponerlos en globalThis (indirect eval no expone bindings const/let).
let exposed;
try {
  const exposeReturn = `return {
    DEFAULT_DB, OBJECTIVE, CATALOGO, HOWTO, TEMPO, EX_TYPE,
    epley1RM, workWeight, parseNum, phaseOfWeek, windowOf, isUnilateral,
    analyzeWeightPattern, decideBump, applyProgression, tagPlanWithWindows,
    PROG_CAPS, DB, DAYC_ORDER, migrateDayCV3, rdlExercise, generateLocalPlan,
    parseHoldSec, isHoldEx, muscleTokens, suggestSwaps, escHtml, sessionHasProgress, planIsValid,
    PROFILES, resolveProfileId, uidOf, profileName,
    pickSyncSettings, gymStateRows, hydrateGymDB, applyGymRealtime,
    COACH_RULES, exerciseHistory, progressionVelocity, adaptiveStep,
    kneeLoadCorrelation, carryoverWeights, phaseCompliance,
    sessionVolume, sessionPRs, estimateSessionSec,
    sessionHasFatigueDrop, needsDeload, applyDeloadToWeek,
    pendingPostKnee, lastNoteFor
  };`;
  exposed = new Function(code + '\n' + exposeReturn)();
} catch(e) {
  console.error('FATAL: app code threw during load:', e.message);
  console.error(e.stack);
  process.exit(2);
}
Object.assign(globalThis, exposed);

// ============= TEST FRAMEWORK =============
let passed = 0, failed = 0;
const failures = [];
function test(name, fn){
  try { fn(); passed++; console.log('OK   ' + name); }
  catch(e){ failed++; failures.push({ name, msg: e.message }); console.log('FAIL ' + name + '  →  ' + e.message); }
}
function assertEq(actual, expected, label){
  if(actual !== expected) throw new Error(`${label || ''} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}
function assertDeep(actual, expected, label){
  if(JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${label || ''} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}
function assertTrue(v, label){ if(!v) throw new Error(`${label || 'expected truthy'} got ${JSON.stringify(v)}`); }
function assertFalse(v, label){ if(v) throw new Error(`${label || 'expected falsy'} got ${JSON.stringify(v)}`); }

// ============= TESTS =============

console.log('\n--- Util: formulas ---');
test('epley1RM 30×10 = 40', () => assertEq(epley1RM(30, 10), 40));
test('epley1RM 40×5 ≈ 47', () => assertEq(epley1RM(40, 5), 47));
test('epley1RM 40×20 Mayhew >0', () => assertTrue(epley1RM(40, 20) > 0));
test('epley1RM cap r=30', () => assertEq(epley1RM(40, 100), epley1RM(40, 30)));
test('workWeight rounds to 2.5 (100×0.51 → 50)', () => assertEq(workWeight(100, 0.51), 50));
test('workWeight rounds up (100×0.52 → 52.5)', () => assertEq(workWeight(100, 0.52), 52.5));
test('parseNum coma decimal "7,5" → 7.5', () => assertEq(parseNum('7,5'), 7.5));
test('parseNum punto "37.5" → 37.5', () => assertEq(parseNum('37.5'), 37.5));
test('parseNum vacío/inválido → 0', () => { assertEq(parseNum(''), 0); assertEq(parseNum('abc'), 0); });

console.log('\n--- Periodización ---');
test('phaseOfWeek 0 → adapt', () => assertEq(phaseOfWeek(0), 'adapt'));
test('phaseOfWeek 1 → adapt', () => assertEq(phaseOfWeek(1), 'adapt'));
test('phaseOfWeek 2 → str', () => assertEq(phaseOfWeek(2), 'str'));
test('phaseOfWeek 4 → str', () => assertEq(phaseOfWeek(4), 'str'));
test('phaseOfWeek 5 → end', () => assertEq(phaseOfWeek(5), 'end'));
test('phaseOfWeek 6 → end', () => assertEq(phaseOfWeek(6), 'end'));
test('phaseOfWeek 7 → taper', () => assertEq(phaseOfWeek(7), 'taper'));

console.log('\n--- Objective windows ---');
test('OBJECTIVE.id = trekking_n4_pfps', () => assertEq(OBJECTIVE.id, 'trekking_n4_pfps'));
test('strength adapt window [10,15]', () => assertDeep(OBJECTIVE.windows.strength.adapt, [10,15]));
test('strength str window [5,8]', () => assertDeep(OBJECTIVE.windows.strength.str, [5,8]));
test('pfps adapt window [12,20]', () => assertDeep(OBJECTIVE.windows.pfps.adapt, [12,20]));
test('endurance end window [15,25]', () => assertDeep(OBJECTIVE.windows.endurance.end, [15,25]));
test('posterior str window [8,12]', () => assertDeep(OBJECTIVE.windows.posterior.str, [8,12]));

test('windowOf leg_press_45 adapt = strength [10,15]', () => {
  const w = windowOf('leg_press_45', 'adapt');
  assertEq(w.type, 'strength'); assertEq(w.repMin, 10); assertEq(w.repMax, 15);
});
test('windowOf leg_ext str = pfps [12,18]', () => {
  const w = windowOf('leg_ext', 'str');
  assertEq(w.type, 'pfps'); assertEq(w.repMin, 12); assertEq(w.repMax, 18);
});
test('windowOf hiper_inversa adapt = posterior [8,15]', () => {
  const w = windowOf('hiper_inversa', 'adapt');
  assertEq(w.type, 'posterior'); assertDeep([w.repMin, w.repMax], [8,15]);
});

console.log('\n--- Catálogo ---');
test('CATALOGO peso_muerto exists IMG_6113', () => {
  const e = CATALOGO.find(c => c.id === 'peso_muerto');
  assertTrue(e, 'peso_muerto missing'); assertEq(e.img, 'IMG_6113');
});
test('CATALOGO no stale jaula_crossover', () => {
  assertFalse(CATALOGO.find(c => c.id === 'jaula_crossover'), 'jaula_crossover should be removed');
});
test('CATALOGO crossover IMG_6120 unilateral', () => {
  const e = CATALOGO.find(c => c.id === 'crossover');
  assertEq(e.img, 'IMG_6120'); assertEq(e.unilateral, true);
});
test('CATALOGO mancuernas unilateral', () => assertEq(CATALOGO.find(c => c.id === 'mancuernas').unilateral, true));
test('CATALOGO remo_isolateral unilateral', () => assertEq(CATALOGO.find(c => c.id === 'remo_isolateral').unilateral, true));
test('CATALOGO leg_press_45 not unilateral', () => assertFalse(CATALOGO.find(c => c.id === 'leg_press_45').unilateral));
test('isUnilateral crossover = true', () => assertEq(isUnilateral('crossover'), true));
test('isUnilateral leg_press_45 = false', () => assertEq(isUnilateral('leg_press_45'), false));

console.log('\n--- Coverage HOWTO/TEMPO/EX_TYPE ---');
const PLAN_IDS_LIFTING = ['leg_press_45','leg_ext','prone_leg_curl','pantorrilla_sentado','crossover','banco_plano','jack_squat','mancuernas','press_hombros_107','remo_isolateral','pulldown','hiper_inversa','camber_curl','adductor_abductor','peso_muerto'];
const PLAN_IDS_BODY = ['_wall_sit'];
const PLAN_IDS_CARDIO = ['stairmaster','trotadora'];
const PLAN_IDS_ALL = [...PLAN_IDS_LIFTING, ...PLAN_IDS_BODY, ...PLAN_IDS_CARDIO];
for(const id of PLAN_IDS_ALL){
  test(`HOWTO has ${id}`, () => assertTrue(HOWTO[id], `HOWTO[${id}] missing`));
  test(`TEMPO has ${id}`, () => assertTrue(TEMPO[id], `TEMPO[${id}] missing`));
}
for(const id of PLAN_IDS_LIFTING){
  test(`EX_TYPE has ${id}`, () => assertTrue(EX_TYPE[id], `EX_TYPE[${id}] missing`));
}

console.log('\n--- Pattern: straight sets ---');
test('analyzeWeightPattern constant 40×3', () => {
  const p = analyzeWeightPattern([{reps:12,weight:40,done:true},{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}], 12);
  assertEq(p.kind, 'constant'); assertEq(p.dropDetected, false); assertEq(p.topSet.weight, 40);
});
test('analyzeWeightPattern ascending pyramid', () => {
  const p = analyzeWeightPattern([{reps:12,weight:30,done:true},{reps:12,weight:35,done:true},{reps:12,weight:40,done:true}], 12);
  assertEq(p.kind, 'ascending'); assertEq(p.dropDetected, false); assertEq(p.topSet.weight, 40);
});
test('analyzeWeightPattern descending drop detected', () => {
  const p = analyzeWeightPattern([{reps:12,weight:40,done:true},{reps:12,weight:35,done:true},{reps:12,weight:30,done:true}], 12);
  assertEq(p.kind, 'descending'); assertEq(p.dropDetected, true);
});
test('analyzeWeightPattern descending <10% no drop', () => {
  const p = analyzeWeightPattern([{reps:12,weight:40,done:true},{reps:12,weight:38,done:true},{reps:12,weight:37,done:true}], 12);
  assertEq(p.kind, 'descending'); assertEq(p.dropDetected, false);
});
test('analyzeWeightPattern mixed', () => {
  const p = analyzeWeightPattern([{reps:12,weight:40,done:true},{reps:12,weight:35,done:true},{reps:12,weight:40,done:true}], 12);
  assertEq(p.kind, 'mixed'); assertEq(p.dropDetected, false);
});

console.log('\n--- Pattern: unilateral ---');
test('analyzeWeightPattern unilateral asymmetry NOT drop (lado débil)', () => {
  const p = analyzeWeightPattern([
    {reps:12,weight:10,done:true,side:'L'},{reps:12,weight:10,done:true,side:'L'},
    {reps:12,weight:8,done:true,side:'R'},{reps:12,weight:8,done:true,side:'R'},
  ], 12);
  assertEq(p.kind, 'unilateral'); assertEq(p.dropDetected, false);
  assertEq(p.topSet.weight, 10);
});
test('analyzeWeightPattern unilateral solo L drop NOT mark', () => {
  const p = analyzeWeightPattern([
    {reps:12,weight:12,done:true,side:'L'},{reps:12,weight:10,done:true,side:'L'},{reps:12,weight:8,done:true,side:'L'},
    {reps:12,weight:12,done:true,side:'R'},{reps:12,weight:12,done:true,side:'R'},{reps:12,weight:12,done:true,side:'R'},
  ], 12);
  assertEq(p.dropDetected, false, 'solo L drop, R constante');
});
test('analyzeWeightPattern unilateral AMBOS drop ≥10% mark', () => {
  const p = analyzeWeightPattern([
    {reps:12,weight:10,done:true,side:'L'},{reps:12,weight:8,done:true,side:'L'},
    {reps:12,weight:10,done:true,side:'R'},{reps:12,weight:8,done:true,side:'R'},
  ], 12);
  assertEq(p.dropDetected, true);
});

console.log('\n--- decideBump double progression ---');
function _bump(exId, sets, knee, targetReps, planEx){
  const done = sets.filter(s => s.done);
  const pat = analyzeWeightPattern(done, targetReps);
  return decideBump({ id: exId, sets }, knee, targetReps, pat, planEx);
}
test('decideBump strength <repMax → +1 rep', () => {
  const r = _bump('leg_press_45', [{reps:12,weight:40,done:true},{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, {repMin:10, repMax:15, phase:'adapt'});
  assertEq(r.weightBump, 0); assertEq(r.repBump, 1);
});
test('decideBump strength en repMax → +2.5kg + reset reps a repMin', () => {
  const r = _bump('leg_press_45', [{reps:15,weight:40,done:true},{reps:15,weight:40,done:true},{reps:15,weight:40,done:true}], 'bien', 15, {repMin:10, repMax:15, phase:'adapt'});
  assertEq(r.weightBump, 2.5); assertEq(r.repBump, -5);
});
test('decideBump aislamiento (leg_ext) <repMax → +1 rep', () => {
  const r = _bump('leg_ext', [{reps:15,weight:15,done:true},{reps:15,weight:15,done:true}], 'bien', 15, {repMin:12, repMax:20, phase:'adapt'});
  assertEq(r.weightBump, 0); assertEq(r.repBump, 1);
});
test('decideBump aislamiento en repMax → +1.25kg + reset', () => {
  const r = _bump('leg_ext', [{reps:20,weight:15,done:true},{reps:20,weight:15,done:true}], 'bien', 20, {repMin:12, repMax:20, phase:'adapt'});
  assertEq(r.weightBump, 1.25); assertEq(r.repBump, -8);
});
test('decideBump sin planEx (fallback) → +2.5 compuesto', () => {
  const r = _bump('leg_press_45', [{reps:12,weight:40,done:true},{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, null);
  assertEq(r.weightBump, 2.5); assertEq(r.repBump, 0);
});

console.log('\n--- decideBump skip / down ---');
test('decideBump knee=leve mantiene', () => {
  const r = _bump('leg_press_45', [{reps:12,weight:40,done:true}], 'leve', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, 0); assertEq(r.repBump, 0);
});
test('decideBump knee=dolor + quadHeavy → -2.5kg', () => {
  const r = _bump('leg_press_45', [{reps:12,weight:40,done:true}], 'dolor', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, -2.5);
});
test('decideBump knee=dolor + jack_squat → -2.5kg', () => {
  const r = _bump('jack_squat', [{reps:12,weight:40,done:true}], 'dolor', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, -2.5);
});
test('decideBump knee=dolor + banca (no quadHeavy) → 0', () => {
  const r = _bump('banco_plano', [{reps:10,weight:30,done:true}], 'dolor', 10, {repMin:5,repMax:10});
  assertEq(r.weightBump, 0);
});
test('decideBump 2+ shortfalls → -2.5', () => {
  const r = _bump('leg_press_45', [{reps:8,weight:40,done:true},{reps:7,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, -2.5);
});
test('decideBump 1 shortfall → 0 (margen)', () => {
  const r = _bump('leg_press_45', [{reps:8,weight:40,done:true},{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, 0); assertEq(r.repBump, 0);
});
test('decideBump drop detectado → 0', () => {
  const r = _bump('leg_press_45', [{reps:12,weight:40,done:true},{reps:12,weight:30,done:true}], 'bien', 12, {repMin:10,repMax:15});
  assertEq(r.weightBump, 0); assertEq(r.repBump, 0);
});
test('decideBump cardio skip', () => {
  const r = decideBump({ id:'stairmaster', isCardio:true, sets:[{reps:'8 min',done:true}] }, 'bien', null, {kind:'constant'}, null);
  assertEq(r.weightBump, 0); assertEq(r.repBump, 0);
});
test('decideBump time-based wall sit skip', () => {
  const r = decideBump({ id:'_wall_sit', noWeight:true, sets:[{reps:'20s',done:true}] }, 'bien', null, {kind:'constant'}, null);
  assertEq(r.weightBump, 0);
});

console.log('\n--- PROG_CAPS (caps PFPS recalibrados) ---');
test('cap leg_ext 17.5 (PFJ directo, se mantiene)', () => assertEq(PROG_CAPS.leg_ext.max, 17.5));
test('cap mancuernas 25 (step-up banco bajo, limitante ROM no peso)', () => assertEq(PROG_CAPS.mancuernas.max, 25));
test('cap adductor_abductor subido a 45 (open-chain cadera)', () => assertEq(PROG_CAPS.adductor_abductor.max, 45));
test('camber_curl sin cap (bíceps, no PFPS)', () => assertEq(PROG_CAPS.camber_curl.max, undefined));
test('crossover cap 25 (open-chain cadera)', () => assertEq(PROG_CAPS.crossover.max, 25));

console.log('\n--- applyProgression sync de peso probado ---');
// Construye un plan mínimo de 2 semanas same-phase (adapt) en DB para probar
// la propagación del peso realmente levantado por el user.
function _planEx(id, weight, reps, extra){
  return Object.assign({ id, name:id, sets:3, reps, weight, rest:60, phase:'adapt' }, extra||{});
}
function _setupPlan(exFactory){
  DB.plan = { weeks: [ [ { exercises: [exFactory()] } ], [ { exercises: [exFactory()] } ] ] };
}
function _session(id, name, sets, knee){
  return { planRef:{w:0,d:0}, kneeStatus:knee||'bien', exercises:[{ id, name, sets }] };
}

test('sync: user usa 32 (plan 17.5), repBump escala y peso se propaga a futuro', () => {
  _setupPlan(() => _planEx('adductor_abductor', 17.5, 15, { repMin:12, repMax:20 }));
  const sets = [ {reps:15,weight:32,done:true},{reps:15,weight:32,done:true},
                 {reps:15,weight:32,done:true},{reps:15,weight:32,done:true} ];
  // ojo: plan ex tiene sets:3 pero la sesión trae 4 done; allComplete usa ex.sets.length
  const sess = _session('adductor_abductor', 'Abductor', sets);
  // ajustar plan ex sets a 4 para allComplete
  DB.plan.weeks[0][0].exercises[0].sets = 4;
  DB.plan.weeks[1][0].exercises[0].sets = 4;
  const changes = applyProgression(sess);
  const future = DB.plan.weeks[1][0].exercises[0];
  assertEq(future.weight, 32, 'peso futuro sincronizado al probado');
  assertEq(future.reps, 16, 'reps escaladas +1 (double prog <repMax)');
});

test('sync respeta cap: user 60kg en adductor → capado a 45', () => {
  _setupPlan(() => _planEx('adductor_abductor', 17.5, 15, { repMin:12, repMax:20, sets:4 }));
  const sets = [ {reps:15,weight:60,done:true},{reps:15,weight:60,done:true},
                 {reps:15,weight:60,done:true},{reps:15,weight:60,done:true} ];
  applyProgression(_session('adductor_abductor', 'Abductor', sets));
  assertEq(DB.plan.weeks[1][0].exercises[0].weight, 45, 'capado a 45');
});

test('sync NO sube en bump negativo (2 shortfalls reducen desde plan)', () => {
  _setupPlan(() => _planEx('leg_press_45', 40, 12, { repMin:10, repMax:15, sets:3 }));
  // user usó 50 pero falló reps en 2 sets → -peso, sin sincronizar el 50 arriba
  const sets = [ {reps:8,weight:50,done:true},{reps:7,weight:50,done:true},{reps:8,weight:50,done:true} ];
  applyProgression(_session('leg_press_45', 'Prensa', sets));
  assertEq(DB.plan.weeks[1][0].exercises[0].weight, 37.5, 'reduce desde plan (40-2.5), no sube a 50');
});

test('sync ignora drop de fatiga (topSet no propaga si dropDetected)', () => {
  _setupPlan(() => _planEx('banco_plano', 30, 10, { repMin:5, repMax:10, sets:2 }));
  // descending con drop ≥10%: 40→30. dropDetected → sin progreso ni sync arriba
  const sets = [ {reps:10,weight:40,done:true},{reps:10,weight:30,done:true} ];
  applyProgression(_session('banco_plano', 'Banca', sets));
  assertEq(DB.plan.weeks[1][0].exercises[0].weight, 30, 'queda en plan, no sincroniza 40 (drop)');
});

console.log('\n--- Day C composición + orden (RDL posterior) ---');
test('DAYC_ORDER: RDL al frente, stairmaster finisher, sin hiper_inversa/kickback', () => {
  assertDeep(DAYC_ORDER, ['trotadora','jack_squat','peso_muerto','mancuernas','adductor_abductor','stairmaster']);
});
test('rdlExercise: peso_muerto posterior PFPS-safe, peso por fase', () => {
  DB.profile = { baseline: { legPress1RM:66 } };
  const r0 = rdlExercise(0);  // adapt
  assertEq(r0.id, 'peso_muerto');
  assertEq(r0.reps, 12); assertEq(r0.sets, 3);
  assertEq(r0.weight, 20, 'adapt wLeg(0.30) de 66 → 20 (barra sola)');
  assertEq(rdlExercise(3).reps, 8, 'str 4x8');
});
test('generateLocalPlan: Day C = trotadora..peso_muerto..stairmaster, sin hiper/kickback', () => {
  DB.profile = { baseline: { legPress1RM:66, benchPress1RM:45, pulldown1RM:56 } };
  generateLocalPlan();
  const dayC = DB.plan.weeks[0][2];
  assertTrue(/Trekking/i.test(dayC.focus), 'day index 2 = Trekking');
  const ids = dayC.exercises.map(e => e.id);
  assertEq(ids[0], 'trotadora', 'arranca con cardio warm-up');
  assertEq(ids[ids.length-1], 'stairmaster', 'termina con finisher');
  assertTrue(ids.includes('peso_muerto'), 'RDL presente');
  assertFalse(ids.includes('hiper_inversa'), 'hiper_inversa fuera de Day C');
  assertFalse(ids.includes('crossover'), 'glute kickback fuera de Day C');
  assertTrue(ids.indexOf('peso_muerto') < ids.indexOf('adductor_abductor'), 'posterior antes que isolation');
});
test('migrateDayCV3: rebuild reemplaza hiper/kickback por RDL, preserva pesos', () => {
  // plan viejo: orden antiguo con hiper_inversa + crossover kickback, pesos progresados
  const oldDayC = { focus:'Trekking · Cardio funcional', exercises: [
    { id:'trotadora', isCardio:true, reps:'15 min' },
    { id:'stairmaster', isCardio:true, reps:'10 min' },
    { id:'jack_squat', weight:32.5, reps:12 },
    { id:'adductor_abductor', weight:32, reps:15 },
    { id:'mancuernas', weight:7, reps:10, unilateral:true },
    { id:'hiper_inversa', weight:10, reps:12 },
    { id:'crossover', weight:10, reps:12, unilateral:true },
  ]};
  DB.profile = { baseline: { legPress1RM:66 } };
  DB.plan = { weeks: [ [ {focus:'Pierna',exercises:[]}, {focus:'Tren',exercises:[]}, JSON.parse(JSON.stringify(oldDayC)) ] ] };
  migrateDayCV3();
  const ids = DB.plan.weeks[0][2].exercises.map(e => e.id);
  assertDeep(ids, DAYC_ORDER);
  assertFalse(ids.includes('hiper_inversa'), 'hiper_inversa eliminado');
  assertFalse(ids.includes('crossover'), 'glute kickback eliminado');
  const exById = id => DB.plan.weeks[0][2].exercises.find(e => e.id === id);
  assertEq(exById('adductor_abductor').weight, 32, 'peso progresado preservado');
  assertEq(exById('jack_squat').weight, 32.5, 'peso progresado preservado');
  assertEq(exById('peso_muerto').weight, 20, 'RDL fresco wLeg(0.30)');
  assertTrue(exById('peso_muerto').repMin !== undefined, 'RDL taggeado con window posterior');
  assertTrue(DB.plan._dayCV3, 'flag seteado');
});
test('migrateDayCV3 idempotente (2ª corrida no cambia nada)', () => {
  const before = JSON.stringify(DB.plan.weeks[0][2].exercises.map(e => e.id));
  migrateDayCV3();
  const after = JSON.stringify(DB.plan.weeks[0][2].exercises.map(e => e.id));
  assertEq(after, before);
});

console.log('\n--- DB defaults ---');
test('DB.settings.autoProgress default true', () => assertEq(DEFAULT_DB.settings.autoProgress, true));
test('DB.settings.telemetry default true', () => assertEq(DEFAULT_DB.settings.telemetry, true));
test('DB.telemetry events array', () => assertTrue(Array.isArray(DEFAULT_DB.telemetry.events)));

console.log('\n--- Aguante isométrico: parseHoldSec / isHoldEx ---');
test('parseHoldSec "30s" → 30', () => assertEq(parseHoldSec('30s'), 30));
test('parseHoldSec "45 s" → 45', () => assertEq(parseHoldSec('45 s'), 45));
test('parseHoldSec "2 min" → 120', () => assertEq(parseHoldSec('2 min'), 120));
test('parseHoldSec número 40 → 40', () => assertEq(parseHoldSec(40), 40));
test('parseHoldSec "12" reps → 12', () => assertEq(parseHoldSec('12'), 12));
test('parseHoldSec vacío → 0', () => assertEq(parseHoldSec(''), 0));
test('isHoldEx wall sit (noWeight+30s) → true', () =>
  assertTrue(isHoldEx({ noWeight: true, isCardio: false, sets: [{ reps: '30s' }] })));
test('isHoldEx cardio → false', () =>
  assertFalse(isHoldEx({ noWeight: true, isCardio: true, sets: [{ reps: '10 min' }] })));
test('isHoldEx ejercicio con peso → false', () =>
  assertFalse(isHoldEx({ noWeight: false, isCardio: false, sets: [{ reps: 12 }] })));
test('isHoldEx reps numéricas sin tiempo (noWeight) → false', () =>
  assertFalse(isHoldEx({ noWeight: true, isCardio: false, sets: [{ reps: 0 }] })));

console.log('\n--- Swap de ejercicio: muscleTokens / suggestSwaps ---');
test('muscleTokens divide por ·', () =>
  assertDeep(muscleTokens('Cuádriceps · Glúteo'), ['cuádriceps', 'glúteo']));
test('muscleTokens divide por / y +', () =>
  assertDeep(muscleTokens('Aductores / Abductores'), ['aductores', 'abductores']));
test('suggestSwaps prensa → incluye hack squat (mismo músculo, no cardio)', () => {
  const ids = suggestSwaps('leg_press_45').map(c => c.id);
  assertTrue(ids.includes('sentadilla_hack'), 'hack squat sugerido');
});
test('suggestSwaps nunca incluye cardio', () => {
  const all = suggestSwaps('leg_press_45');
  assertFalse(all.some(c => c.isCardio), 'sin cardio');
});
test('suggestSwaps nunca incluye el mismo ejercicio', () => {
  const ids = suggestSwaps('leg_press_45').map(c => c.id);
  assertFalse(ids.includes('leg_press_45'), 'sin self');
});
test('suggestSwaps solo knee safe|caution', () => {
  const all = suggestSwaps('leg_press_45');
  assertTrue(all.every(c => c.knee === 'safe' || c.knee === 'caution'), 'knee ok');
});

console.log('\n--- escHtml ---');
test('escHtml escapa < > & "', () =>
  assertEq(escHtml('<b>"a&b"</b>'), '&lt;b&gt;&quot;a&amp;b&quot;&lt;/b&gt;'));
test('escHtml null → vacío', () => assertEq(escHtml(null), ''));

console.log('\n--- Persistencia: sessionHasProgress (anti-pérdida) ---');
test('sessionHasProgress: serie completada → true', () =>
  assertTrue(sessionHasProgress({ '0': { sets: [{ reps: 10, weight: 20, done: true }] } })));
test('sessionHasProgress: serie añadida por user → true', () =>
  assertTrue(sessionHasProgress({ '0': { sets: [{ reps: 10, weight: 20, done: false, userAdded: true }] } })));
test('sessionHasProgress: sesión recién armada (nada done) → false', () =>
  assertFalse(sessionHasProgress({ '0': { sets: [{ reps: 10, weight: 20, done: false }] }, '1': { sets: [{ reps: 8, weight: 0, done: false }] } })));
test('sessionHasProgress: vacío → false', () => assertFalse(sessionHasProgress({})));
test('sessionHasProgress: null → false', () => assertFalse(sessionHasProgress(null)));
test('sessionHasProgress: progreso en 2º ejercicio → true', () =>
  assertTrue(sessionHasProgress({ '0': { sets: [{ done: false }] }, '1': { sets: [{ done: true }] } })));

console.log('\n--- Sync Supabase: transformación DB ↔ filas ---');
test('pickSyncSettings: solo wake/autoProgress/telemetry (sin github*)', () => {
  const s = pickSyncSettings({ wake:true, autoProgress:false, telemetry:true, githubSync:true, githubToken:'x', gistId:'y' });
  assertDeep(s, { wake:true, autoProgress:false, telemetry:true });
});
test('gymStateRows: arma 4 filas de fila única con user_id + data', () => {
  const plan = { start:'2026', weeks:[[{focus:'A',exercises:[]}]] };
  const db = { profile:{w:75}, plan, settings:{wake:true,autoProgress:true,telemetry:true},
    sessionSets:{'0':{id:'x'}}, _currentRef:{w:0,d:1}, _kneeStatus:'bien', _adaptedSession:null, _sessionNote:'hola' };
  const r = gymStateRows(db, 'UID');
  assertEq(r.profile.user_id, 'UID');
  assertDeep(r.profile.data, {w:75});
  assertDeep(r.plan.data, plan);
  assertEq(r.settings.data.wake, true);
  assertEq(r.settings.data.githubToken, undefined, 'settings no lleva github*');
  assertDeep(r.active_session.data.sessionSets, {'0':{id:'x'}});
  assertEq(r.active_session.data._sessionNote, 'hola');
  assertDeep(r.active_session.data._currentRef, {w:0,d:1});
});
test('gymStateRows: incluye fila telemetry (push-only backup)', () => {
  const tel = { events:[{t:'x',type:'screen_view'}], sessionId:null, startedAt:'s', version:1 };
  const r = gymStateRows({ telemetry: tel }, 'UID');
  assertEq(r.telemetry.user_id, 'UID');
  assertDeep(r.telemetry.data, tel);
});
test('hydrateGymDB: ignora telemetry remota aunque venga en rows (local manda)', () => {
  const rows = { sessions:[], telemetry: { data:{ events:[{x:'remoto'}], version:1 } } };
  const localTel = { events:[], version:1 };
  const db = hydrateGymDB(DEFAULT_DB, rows, localTel);
  assertDeep(db.telemetry, localTel);
});
test('hydrateGymDB: reconstruye DB desde filas + conserva telemetría local', () => {
  const rows = {
    profile: { data:{w:80} }, plan: { data:{start:'X', weeks:[[{focus:'A',exercises:[]}]]} },
    settings: { data:{wake:true} },
    active_session: { data:{ sessionSets:{'0':{id:'a'}}, _currentRef:{w:1,d:0}, _kneeStatus:'leve', _adaptedSession:null, _sessionNote:'n' } },
    sessions: [ { data:{date:'d1'} }, { data:{date:'d2'} } ],
  };
  const localTel = { events:[{x:1}], version:1 };
  const db = hydrateGymDB(DEFAULT_DB, rows, localTel);
  assertDeep(db.profile, {w:80});
  assertDeep(db.plan, {start:'X', weeks:[[{focus:'A',exercises:[]}]]});
  assertEq(db.sessions.length, 2);
  assertEq(db.sessions[0].date, 'd1');
  assertDeep(db.sessionSets, {'0':{id:'a'}});
  assertEq(db.settings.wake, true);
  assertEq(db.settings.autoProgress, true, 'default preservado');
  assertEq(db._kneeStatus, 'leve');
  assertDeep(db.telemetry, localTel, 'telemetría local conservada, nunca remota');
});
test('hydrateGymDB: filas vacías → DEFAULT_DB limpio', () => {
  const db = hydrateGymDB(DEFAULT_DB, { sessions:[] }, null);
  assertEq(db.profile, null);
  assertEq(db.plan, null);
  assertDeep(db.sessions, []);
  assertDeep(db.sessionSets, {});
});
test('DEFAULT_DB.settings ya no tiene campos github*', () => {
  assertEq(DEFAULT_DB.settings.githubSync, undefined);
  assertEq(DEFAULT_DB.settings.githubToken, undefined);
  assertEq(DEFAULT_DB.settings.gistId, undefined);
});

console.log('\n--- Sync Supabase: merge realtime ---');
test('applyGymRealtime: profile entrante actualiza DB.profile', () => {
  const db = { profile:{w:70} };
  const changed = applyGymRealtime(db, 'gym_profile', { data:{w:90} });
  assertTrue(changed);
  assertDeep(db.profile, {w:90});
});
test('applyGymRealtime: self-echo (data idéntica) → no cambia, devuelve false', () => {
  const db = { profile:{w:70} };
  const changed = applyGymRealtime(db, 'gym_profile', { data:{w:70} });
  assertFalse(changed);
});
test('applyGymRealtime: active_session entrante actualiza sessionSets + flags', () => {
  const db = { sessionSets:{}, _kneeStatus:null };
  const changed = applyGymRealtime(db, 'gym_active_session', { data:{ sessionSets:{'0':{id:'z'}}, _kneeStatus:'dolor', _currentRef:null, _adaptedSession:null, _sessionNote:'' } });
  assertTrue(changed);
  assertDeep(db.sessionSets, {'0':{id:'z'}});
  assertEq(db._kneeStatus, 'dolor');
});
test('applyGymRealtime: gym_sessions nueva se agrega si no existe (por date)', () => {
  const db = { sessions:[{date:'d1'}] };
  const changed = applyGymRealtime(db, 'gym_sessions', { data:{date:'d2'} });
  assertTrue(changed);
  assertEq(db.sessions.length, 2);
});
test('applyGymRealtime: gym_sessions duplicada (misma date) → no agrega', () => {
  const db = { sessions:[{date:'d1'}] };
  const changed = applyGymRealtime(db, 'gym_sessions', { data:{date:'d1'} });
  assertFalse(changed);
  assertEq(db.sessions.length, 1);
});

console.log('\n--- Invariante plan válido (anti gym_plan vacío) ---');
test('planIsValid: null / {} / sin weeks / weeks vacío → false', () => {
  assertFalse(planIsValid(null));
  assertFalse(planIsValid(undefined));
  assertFalse(planIsValid({}));
  assertFalse(planIsValid({ start:'x' }));
  assertFalse(planIsValid({ weeks: [] }));
  assertFalse(planIsValid({ weeks: 'nope' }));
});
test('planIsValid: plan con weeks[] no vacío → true', () => {
  assertTrue(planIsValid({ weeks: [[{ focus:'A', exercises:[] }]] }));
});
test('gymStateRows: NUNCA persiste un plan inválido ({} → null)', () => {
  assertEq(gymStateRows({ plan: {} }, 'UID').plan.data, null);
  assertEq(gymStateRows({ plan: { weeks: [] } }, 'UID').plan.data, null);
  const good = { weeks: [[{ focus:'A', exercises:[] }]] };
  assertDeep(gymStateRows({ plan: good }, 'UID').plan.data, good);
});
test('hydrateGymDB: plan remoto vacío ({}) NO se hidrata → null (dispara auto-sana)', () => {
  const db = hydrateGymDB(DEFAULT_DB, { plan:{ data:{} }, sessions:[] }, null);
  assertEq(db.plan, null);
});
test('hydrateGymDB: plan remoto válido sí se hidrata', () => {
  const good = { weeks: [[{ focus:'A', exercises:[] }]] };
  const db = hydrateGymDB(DEFAULT_DB, { plan:{ data:good }, sessions:[] }, null);
  assertDeep(db.plan, good);
});
test('applyGymRealtime: eco de gym_plan inválido ({}) NO pisa el plan bueno', () => {
  const good = { weeks: [[{ focus:'A', exercises:[] }]] };
  const db = { plan: good };
  const changed = applyGymRealtime(db, 'gym_plan', { data: {} });
  assertFalse(changed);
  assertDeep(db.plan, good);  // preservado
});
test('applyGymRealtime: eco de gym_plan válido sí actualiza', () => {
  const good = { weeks: [[{ focus:'B', exercises:[] }]] };
  const db = { plan: null };
  const changed = applyGymRealtime(db, 'gym_plan', { data: good });
  assertTrue(changed);
  assertDeep(db.plan, good);
});

console.log('\n--- Multi-perfil: resolución de identidad ---');
test('PROFILES: ids y uids únicos, andres usa uid legacy', () => {
  const ids = PROFILES.map(p => p.id);
  const uids = PROFILES.map(p => p.uid);
  assertEq(new Set(ids).size, ids.length, 'ids únicos');
  assertEq(new Set(uids).size, uids.length, 'uids únicos');
  const andres = PROFILES.find(p => p.id === 'andres');
  assertEq(andres.uid, 'ea8ea549-eacb-465c-9883-778cad0fcf20');
  PROFILES.forEach(p => assertTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p.uid), 'uid con forma UUID: '+p.id));
});
test('resolveProfileId: storedId válido → ese id', () => {
  assertEq(resolveProfileId('melisa', false), 'melisa');
  assertEq(resolveProfileId('andres', true), 'andres');
});
test('resolveProfileId: storedId inválido se ignora → migración o null', () => {
  assertEq(resolveProfileId('fantasma', true), 'andres');
  assertEq(resolveProfileId('fantasma', false), null);
});
test('resolveProfileId: sin storedId + datos locales → andres (migración)', () => {
  assertEq(resolveProfileId(null, true), 'andres');
});
test('resolveProfileId: sin storedId + sin datos → null (selector)', () => {
  assertEq(resolveProfileId(null, false), null);
});
test('uidOf / profileName: conocido → valor; desconocido → fallback', () => {
  assertEq(uidOf('melisa'), '8554bae7-752c-4f37-ad4d-00dba477fe38');
  assertEq(profileName('andres'), 'Andrés');
  assertEq(profileName('xxx'), 'Andrés', 'fallback');
});

/* ============= FRENTE C: COACH ADAPTATIVO ============= */

// Helper: sesión sintética con un ejercicio de fuerza y sets done
function _histSession(date, exId, topW, topReps, extra){
  return Object.assign({
    date,
    kneeStatus: 'bien',
    exercises: [{ id: exId, name: exId, sets: [
      { reps: topReps, weight: topW, done: true },
      { reps: topReps, weight: topW, done: true },
    ]}]
  }, extra || {});
}

console.log('\n--- C1: exerciseHistory / progressionVelocity / adaptiveStep ---');
test('exerciseHistory extrae top-set por sesión, ignora no-done y cardio', () => {
  const ss = [
    { date:'d1', exercises:[{ id:'x', sets:[{reps:10,weight:20,done:true},{reps:10,weight:25,done:true},{reps:10,weight:30,done:false}] }] },
    { date:'d2', exercises:[{ id:'x', isCardio:true, sets:[{reps:'10 min',done:true}] }] },
    { date:'d3', exercises:[{ id:'x', sets:[{reps:11,weight:25,done:true}] }] },
  ];
  const h = exerciseHistory(ss, 'x');
  assertEq(h.length, 2);
  assertEq(h[0].topW, 25, 'top done = 25, no 30 (not done)');
  assertEq(h[1].topReps, 11);
});
test('progressionVelocity <4 sesiones → sin_datos', () => {
  const ss = [_histSession('a','x',20,10), _histSession('b','x',22.5,10), _histSession('c','x',25,10)];
  assertEq(progressionVelocity(ss, 'x').class, 'sin_datos');
});
test('progressionVelocity estancado: 4 sesiones sin ganancia', () => {
  const ss = ['a','b','c','d'].map(d => _histSession(d, 'x', 20, 10));
  const v = progressionVelocity(ss, 'x');
  assertEq(v.class, 'estancado');
  assertEq(v.kgPerSession, 0);
});
test('progressionVelocity rapido: +2.5kg/sesión', () => {
  const ss = [20, 22.5, 25, 27.5, 30].map((w,i) => _histSession('d'+i, 'x', w, 10));
  assertEq(progressionVelocity(ss, 'x').class, 'rapido');
});
test('progressionVelocity normal: solo reps suben', () => {
  const ss = [10, 11, 12, 13].map((r,i) => _histSession('d'+i, 'x', 20, r));
  assertEq(progressionVelocity(ss, 'x').class, 'normal');
});
test('adaptiveStep estancado compuesto → medio paso 1.25 + ruleId resp_lento', () => {
  const ss = ['a','b','c','d'].map(d => _histSession(d, 'leg_press_45', 40, 12));
  const a = adaptiveStep('leg_press_45', ss);
  assertEq(a.step, 1.25); assertEq(a.ruleId, 'resp_lento');
});
test('adaptiveStep estancado aislamiento → piso 1.25 (no baja más)', () => {
  const ss = ['a','b','c','d'].map(d => _histSession(d, 'leg_ext', 15, 15));
  assertEq(adaptiveStep('leg_ext', ss).step, 1.25);
});
test('adaptiveStep sin datos → paso estándar sin ruleId', () => {
  const a = adaptiveStep('leg_press_45', []);
  assertEq(a.step, 2.5); assertEq(a.ruleId, null);
});
test('decideBump acepta opts.step (micro-progresión en repMax)', () => {
  const r = _bump2('leg_press_45', [{reps:15,weight:40,done:true},{reps:15,weight:40,done:true},{reps:15,weight:40,done:true}], 'bien', 15, {repMin:10,repMax:15}, {step:1.25, micro:true});
  assertEq(r.weightBump, 1.25);
  assertEq(r.ruleId, 'resp_lento');
});
function _bump2(exId, sets, knee, targetReps, planEx, opts){
  const done = sets.filter(s => s.done);
  const pat = analyzeWeightPattern(done, targetReps);
  return decideBump({ id: exId, sets }, knee, targetReps, pat, planEx, opts);
}

console.log('\n--- C4: ruleIds de decideBump existen en COACH_RULES ---');
test('decideBump ruleIds: double_prog_rep', () => {
  const r = _bump2('leg_press_45', [{reps:12,weight:40,done:true},{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, {repMin:10,repMax:15});
  assertEq(r.ruleId, 'double_prog_rep');
  assertTrue(COACH_RULES[r.ruleId], 'regla existe');
});
test('decideBump ruleIds: knee_leve / knee_dolor / drop_fatiga / shortfalls', () => {
  assertEq(_bump2('leg_press_45', [{reps:12,weight:40,done:true}], 'leve', 12, {}).ruleId, 'knee_leve');
  assertEq(_bump2('leg_press_45', [{reps:12,weight:40,done:true}], 'dolor', 12, {}).ruleId, 'knee_dolor');
  assertEq(_bump2('leg_press_45', [{reps:12,weight:40,done:true},{reps:12,weight:30,done:true}], 'bien', 12, {}).ruleId, 'drop_fatiga');
  assertEq(_bump2('leg_press_45', [{reps:8,weight:40,done:true},{reps:7,weight:40,done:true},{reps:12,weight:40,done:true}], 'bien', 12, {}).ruleId, 'shortfalls');
});
test('COACH_RULES: todas las reglas tienen name/rule/evidence', () => {
  for(const [id, r] of Object.entries(COACH_RULES)){
    assertTrue(r.name && r.rule && r.evidence, `${id} incompleta`);
  }
});
for(const rid of ['double_prog_rep','double_prog_weight','drop_fatiga','knee_leve','knee_dolor','shortfalls','margen_dia_malo','sync_peso','cap_pfps','resp_lento','knee_pattern','cycle_avanza','cycle_mantiene','deload']){
  test(`COACH_RULES tiene ${rid}`, () => assertTrue(COACH_RULES[rid]));
}

console.log('\n--- C2: kneeLoadCorrelation ---');
test('kneeLoadCorrelation flaggea ejercicio que precede molestia (postKnee)', () => {
  const mk = (d, exId, post) => _histSession(d, exId, 20, 12, { postKnee: post });
  const ss = [
    mk('d1','leg_ext','leve'), mk('d2','leg_ext','leve'), mk('d3','leg_ext','dolor'),
    _histSession('d4','banco_plano',30,10), _histSession('d5','banco_plano',30,10), _histSession('d6','banco_plano',30,10),
  ];
  const flags = kneeLoadCorrelation(ss);
  assertEq(flags.length, 1);
  assertEq(flags[0].id, 'leg_ext');
  assertEq(flags[0].bad, 3);
});
test('kneeLoadCorrelation usa pre check-in de la sesión SIGUIENTE', () => {
  const ss = [
    _histSession('d1','leg_ext',15,15), _histSession('d2','leg_ext',15,15, { kneeStatus:'leve' }),
    _histSession('d3','leg_ext',15,15, { kneeStatus:'leve' }), _histSession('d4','banco_plano',30,10, { kneeStatus:'dolor' }),
    _histSession('d5','banco_plano',30,10), _histSession('d6','banco_plano',30,10),
  ];
  // leg_ext ejecutado en d1,d2,d3; siguientes check-ins: leve, leve, dolor → 3/3
  const flags = kneeLoadCorrelation(ss);
  assertTrue(flags.some(f => f.id === 'leg_ext'), 'leg_ext flaggeado');
});
test('kneeLoadCorrelation <3 ejecuciones no flaggea', () => {
  const ss = [
    _histSession('d1','leg_ext',15,15,{postKnee:'dolor'}),
    _histSession('d2','leg_ext',15,15,{postKnee:'dolor'}),
    _histSession('d3','banco_plano',30,10), _histSession('d4','banco_plano',30,10), _histSession('d5','banco_plano',30,10),
  ];
  assertFalse(kneeLoadCorrelation(ss).some(f => f.id === 'leg_ext'));
});
test('kneeLoadCorrelation guard tasa base: si TODO duele, nada se flaggea', () => {
  const ss = ['d1','d2','d3','d4'].map(d => {
    const s = _histSession(d, 'leg_ext', 15, 15, { postKnee:'leve' });
    s.exercises.push({ id:'banco_plano', name:'b', sets:[{reps:10,weight:30,done:true}] });
    return s;
  });
  assertEq(kneeLoadCorrelation(ss).length, 0, 'ratio no supera base+0.15');
});
test('kneeLoadCorrelation ignora cardio y ejercicios sin sets done', () => {
  const ss = ['d1','d2','d3'].map(d => ({
    date: d, postKnee: 'leve',
    exercises: [
      { id:'stairmaster', isCardio:true, sets:[{reps:'10 min',done:true}] },
      { id:'leg_ext', sets:[{reps:15,weight:15,done:false}] },
    ]
  }));
  assertEq(kneeLoadCorrelation(ss).length, 0);
});

console.log('\n--- C3: carryoverWeights / phaseCompliance ---');
test('carryoverWeights: última semana de la fase pisa a las anteriores', () => {
  const plan = { weeks: [
    [ { exercises: [{ id:'x', weight:40 }] } ],   // w0 adapt
    [ { exercises: [{ id:'x', weight:45 }] } ],   // w1 adapt (progresado)
    [ { exercises: [{ id:'x', weight:60 }] } ],   // w2 str
  ]};
  const c = carryoverWeights(plan);
  assertEq(c['0|x|adapt'], 45);
  assertEq(c['0|x|str'], 60);
});
test('carryoverWeights ignora cardio/noWeight', () => {
  const plan = { weeks: [[ { exercises: [{ id:'sm', isCardio:true, weight:0 }, { id:'ws', noWeight:true }] } ]] };
  assertDeep(carryoverWeights(plan), {});
});
test('phaseCompliance: sesión con 100% targets → rate 1', () => {
  const plan = { weeks: [[ { exercises: [{ id:'x', reps:12, sets:2 }] } ]] };
  const ss = [{ planRef:{w:0,d:0}, exercises:[{ id:'x', sets:[{reps:12,weight:40,done:true},{reps:12,weight:40,done:true}] }] }];
  const c = phaseCompliance(ss, plan);
  assertEq(c.adapt.rate, 1);
  assertEq(c.adapt.sessions, 1);
  assertEq(c.str.sessions, 0);
});
test('phaseCompliance: sesión con shortfalls → rate 0', () => {
  const plan = { weeks: [[ { exercises: [{ id:'x', reps:12, sets:3 }] } ]] };
  const ss = [{ planRef:{w:0,d:0}, exercises:[{ id:'x', sets:[{reps:8,weight:40,done:true},{reps:8,weight:40,done:true},{reps:12,weight:40,done:true}] }] }];
  assertEq(phaseCompliance(ss, plan).adapt.rate, 0);
});
test('generateLocalPlan con prevPlan: carryover + avance de fase cumplida + cap', () => {
  DB.sessions = [];
  DB.profile = { baseline: { legPress1RM:66, benchPress1RM:45, pulldown1RM:56 } };
  generateLocalPlan();  // plan base
  const prev = JSON.parse(JSON.stringify(DB.plan));
  // Simular ciclo anterior: prensa progresó a 50kg en la última semana adapt (w1, d0)
  const prensaPrev = prev.weeks[1][0].exercises.find(e => e.id === 'leg_press_45');
  prensaPrev.weight = 50;
  // Compliance adapt 100%: una sesión cumpliendo targets del d0 w0 del prev
  const planD0 = prev.weeks[0][0];
  const sessOk = { planRef:{w:0,d:0}, kneeStatus:'bien', date:'2026-01-01',
    exercises: planD0.exercises.filter(e => !e.isCardio && !e.noWeight).map(e => ({
      id: e.id, name: e.name,
      sets: Array.from({length: e.sets}, () => ({ reps: e.reps, weight: e.weight, done: true }))
    })) };
  generateLocalPlan({ prevPlan: prev, sessions: [sessOk] });
  const nueva = DB.plan.weeks[0][0].exercises.find(e => e.id === 'leg_press_45');
  // derivado adapt = wLeg(0.55) de 66 = 37.5 · carryover 50 · avance +2.5 → 52.5
  assertEq(nueva.weight, 52.5, 'carryover 50 + avance 2.5');
  assertTrue((DB.plan.cycleNotes || []).some(n => n.phase === 'adapt' && n.action === 'avanza'), 'cycleNote avanza');
  // leg_ext con cap 17.5: nunca lo supera
  const le = DB.plan.weeks[0][0].exercises.find(e => e.id === 'leg_ext');
  assertTrue(le.weight <= 17.5, 'cap leg_ext respetado');
});
test('generateLocalPlan con prevPlan sin sesiones: carryover sin avance', () => {
  DB.sessions = [];
  DB.profile = { baseline: { legPress1RM:66, benchPress1RM:45, pulldown1RM:56 } };
  generateLocalPlan();
  const prev = JSON.parse(JSON.stringify(DB.plan));
  prev.weeks[1][0].exercises.find(e => e.id === 'leg_press_45').weight = 50;
  generateLocalPlan({ prevPlan: prev, sessions: [] });
  assertEq(DB.plan.weeks[0][0].exercises.find(e => e.id === 'leg_press_45').weight, 50, 'carryover sin avance');
});
test('generateLocalPlan aplica reducción C2 por patrón de rodilla + kneeAdjust', () => {
  DB.profile = { baseline: { legPress1RM:66, benchPress1RM:45, pulldown1RM:56 } };
  const mk = (d) => _histSession(d, 'leg_ext', 15, 15, { postKnee:'leve' });
  const ss = [ mk('d1'), mk('d2'), mk('d3'),
    _histSession('d4','banco_plano',30,10), _histSession('d5','banco_plano',30,10), _histSession('d6','banco_plano',30,10) ];
  generateLocalPlan({ sessions: ss });
  assertTrue((DB.plan.kneeAdjust || []).some(k => k.id === 'leg_ext'), 'kneeAdjust registrado');
  const le = DB.plan.weeks[0][0].exercises.find(e => e.id === 'leg_ext');
  assertTrue(/Coach: reduje/.test(le.note), 'nota explicativa en el ejercicio');
});

console.log('\n--- B1: sessionVolume / sessionPRs / estimateSessionSec ---');
test('sessionVolume suma reps×peso de done, ignora cardio/hold/no-done', () => {
  const exs = [
    { id:'x', sets:[{reps:10,weight:40,done:true},{reps:10,weight:40,done:false}] },
    { id:'sm', isCardio:true, sets:[{reps:'10 min',done:true}] },
    { id:'ws', noWeight:true, sets:[{reps:'30s',done:true}] },
  ];
  assertEq(sessionVolume(exs), 400);
});
test('sessionPRs: peso récord detectado', () => {
  const prev = [ _histSession('d1','x',40,10) ];
  const sess = _histSession('d2','x',45,10);
  const prs = sessionPRs(sess, prev);
  assertEq(prs.length, 1);
  assertEq(prs[0].type, 'peso');
  assertEq(prs[0].prev, 40); assertEq(prs[0].now, 45);
});
test('sessionPRs: reps récord al mismo peso máximo', () => {
  const prev = [ _histSession('d1','x',40,10) ];
  const sess = _histSession('d2','x',40,12);
  const prs = sessionPRs(sess, prev);
  assertEq(prs.length, 1);
  assertEq(prs[0].type, 'reps');
  assertEq(prs[0].now, 12);
});
test('sessionPRs: sin superación → sin PR; primera vez → sin PR', () => {
  const prev = [ _histSession('d1','x',40,10) ];
  assertEq(sessionPRs(_histSession('d2','x',40,10), prev).length, 0);
  assertEq(sessionPRs(_histSession('d2','nuevo',40,10), prev).length, 0, 'primera vez no es PR');
});
test('estimateSessionSec: cardio + fuerza + cambio de ejercicio', () => {
  const exs = [
    { id:'sm', isCardio:true, sets:[{reps:'10 min',done:false}] },        // 600
    { id:'x', rest:60, sets:[{reps:12,weight:40},{reps:12,weight:40}] },  // 2×(40+60)=200
  ];
  assertEq(estimateSessionSec(exs), 600 + 200 + 150);
});
test('estimateSessionSec: hold isométrico usa duración del hold', () => {
  const exs = [ { id:'ws', noWeight:true, rest:60, sets:[{reps:'30s'},{reps:'30s'}] } ];
  assertEq(estimateSessionSec(exs), 2 * (30 + 60));
});

console.log('\n--- B4: needsDeload / applyDeloadToWeek ---');
function _dropSession(date){
  return { date, kneeStatus:'bien', exercises: [
    { id:'x', sets:[{reps:12,weight:40,done:true},{reps:12,weight:34,done:true}] }  // drop ≥10%
  ]};
}
test('needsDeload: 2 sesiones seguidas con drop → fatiga', () => {
  const r = needsDeload([_dropSession('2026-01-01'), _dropSession('2026-01-03')], '2026-01-04');
  assertTrue(r.needed); assertEq(r.reason, 'fatiga');
});
test('needsDeload: 1 sola sesión con drop → no', () => {
  const r = needsDeload([_histSession('2026-01-01','x',40,12), _dropSession('2026-01-03')], '2026-01-04');
  assertFalse(r.needed);
});
test('needsDeload: 2+ rodilla leve/dolor en 7 días → rodilla', () => {
  const ss = [
    _histSession('2026-01-01','x',40,12, { kneeStatus:'leve' }),
    _histSession('2026-01-04','x',40,12, { postKnee:'dolor' }),
  ];
  const r = needsDeload(ss, '2026-01-05');
  assertTrue(r.needed); assertEq(r.reason, 'rodilla');
});
test('needsDeload: reportes viejos (>7 días) no cuentan', () => {
  const ss = [
    _histSession('2025-12-01','x',40,12, { kneeStatus:'leve' }),
    _histSession('2026-01-04','x',40,12, { postKnee:'dolor' }),
  ];
  assertFalse(needsDeload(ss, '2026-01-05').needed);
});
test('applyDeloadToWeek: -40% series (mín 1), no toca cardio ni días done', () => {
  const plan = { weeks: [[
    { focus:'A', exercises:[{ id:'x', sets:5 }, { id:'sm', isCardio:true, sets:1 }] },
    { focus:'B', exercises:[{ id:'y', sets:2 }] },
  ]]};
  const touched = applyDeloadToWeek(plan, 0, new Set([1]));
  assertTrue(touched);
  assertEq(plan.weeks[0][0].exercises[0].sets, 3, '5×0.6=3');
  assertEq(plan.weeks[0][0].exercises[1].sets, 1, 'cardio intacto');
  assertTrue(plan.weeks[0][0].deload);
  assertTrue(/DESCARGA/.test(plan.weeks[0][0].focus));
  assertFalse(plan.weeks[0][1].deload, 'día done no tocado');
});
test('applyDeloadToWeek idempotente por día (deload:true no re-reduce)', () => {
  const plan = { weeks: [[ { focus:'A', exercises:[{ id:'x', sets:5 }] } ]] };
  applyDeloadToWeek(plan, 0);
  applyDeloadToWeek(plan, 0);
  assertEq(plan.weeks[0][0].exercises[0].sets, 3, 'no aplica dos veces');
});

console.log('\n--- B2: pendingPostKnee ---');
test('pendingPostKnee: 24h después → índice de la última sesión', () => {
  const ss = [{ date:'2026-01-01T18:00:00Z' }];
  assertEq(pendingPostKnee(ss, '2026-01-02T18:00:00Z'), 0);
});
test('pendingPostKnee: <12h → -1 (aún no)', () => {
  const ss = [{ date:'2026-01-01T18:00:00Z' }];
  assertEq(pendingPostKnee(ss, '2026-01-02T00:00:00Z'), -1);
});
test('pendingPostKnee: >96h → -1 (ventana cerrada)', () => {
  const ss = [{ date:'2026-01-01T18:00:00Z' }];
  assertEq(pendingPostKnee(ss, '2026-01-07T18:00:00Z'), -1);
});
test('pendingPostKnee: ya respondido u omitido → -1', () => {
  assertEq(pendingPostKnee([{ date:'2026-01-01T18:00:00Z', postKnee:'bien' }], '2026-01-02T18:00:00Z'), -1);
  assertEq(pendingPostKnee([{ date:'2026-01-01T18:00:00Z', postKneeSkipped:true }], '2026-01-02T18:00:00Z'), -1);
});
test('pendingPostKnee: sin sesiones → -1', () => assertEq(pendingPostKnee([], '2026-01-02'), -1));

console.log('\n--- B3: lastNoteFor ---');
test('lastNoteFor devuelve la nota más reciente del ejercicio', () => {
  const ss = [
    { date:'d1', exercises:[{ id:'x', userNote:'asiento en 4' }] },
    { date:'d2', exercises:[{ id:'x', userNote:'molestó al final' }] },
    { date:'d3', exercises:[{ id:'y' }] },
  ];
  const n = lastNoteFor(ss, 'x');
  assertEq(n.text, 'molestó al final');
  assertEq(n.date, 'd2');
});
test('lastNoteFor sin notas → null', () => {
  assertEq(lastNoteFor([{ date:'d1', exercises:[{ id:'x' }] }], 'x'), null);
  assertEq(lastNoteFor([], 'x'), null);
});

// ============= REPORT =============
console.log('\n' + '='.repeat(60));
console.log(`Total: ${passed + failed}  ·  Passed: ${passed}  ·  Failed: ${failed}`);
if(failed){
  console.log('\nFailures:');
  for(const f of failures) console.log(`  - ${f.name}  →  ${f.msg}`);
  process.exit(1);
}
console.log('All tests passed.');
process.exit(0);
