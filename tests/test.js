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
    epley1RM, workWeight, phaseOfWeek, windowOf, isUnilateral,
    analyzeWeightPattern, decideBump, applyProgression, tagPlanWithWindows,
    PROG_CAPS, DB
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
test('cap mancuernas 20 (step-up knee load)', () => assertEq(PROG_CAPS.mancuernas.max, 20));
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

console.log('\n--- DB defaults ---');
test('DB.settings.autoProgress default true', () => assertEq(DEFAULT_DB.settings.autoProgress, true));
test('DB.settings.telemetry default true', () => assertEq(DEFAULT_DB.settings.telemetry, true));
test('DB.telemetry events array', () => assertTrue(Array.isArray(DEFAULT_DB.telemetry.events)));

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
