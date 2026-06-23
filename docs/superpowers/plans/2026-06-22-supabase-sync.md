# Migración GitHub Gist → Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el backup/sync por GitHub Gist de gym-oso por sync multi-dispositivo en Supabase, con auth email+password (RLS por `auth.uid()`), realtime por fila, y `supabase-js` vendorizado, reusando el proyecto Supabase de la app de viajes.

**Architecture:** El objeto `DB` en memoria + `localStorage` siguen siendo la fuente primaria en sesión (offline-first intacto). Una capa nueva mapea `DB` a 5 tablas `gym_*` (`jsonb` por entidad), las hidrata al boot tras login, y se subscribe a cambios realtime. La lógica de transformación (DB↔filas, merge realtime) es pura y TDD-testeada; el cliente Supabase (auth, upsert, subscripciones) es glue fino verificado manualmente.

**Tech Stack:** HTML/JS inline sin frameworks · `@supabase/supabase-js` v2 (UMD vendorizado) · Supabase (Postgres + Auth + Realtime) · Node.js test harness casero (`tests/test.js`).

**Referencia:** spec en `docs/superpowers/specs/2026-06-22-supabase-sync-design.md`.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `index.html` | App completa. Capa sync Gist (`index.html:295-371`), boot (`2599-2618`), Config UI (`168-188`, `2470-2544`), finalizar sesión (`2275`) | Modificar |
| `vendor/supabase.js` | UMD de `@supabase/supabase-js` vendorizado (offline) | Crear |
| `sw.js` | Service worker — bump cache + precache `vendor/supabase.js` | Modificar |
| `tests/test.js` | Suite Node. Reemplaza tests Gist por tests de transformación Supabase | Modificar |
| `CLAUDE.md`, `context.md`, `README.md` | Docs | Modificar |
| `docs/supabase-setup.sql` | SQL de creación de tablas + RLS + realtime (referencia/setup) | Crear |

**Decisión de simplicidad (desvío menor del spec §6):** en cada sync debounced se hace upsert de las **4 tablas de fila única** (`gym_profile`/`gym_plan`/`gym_settings`/`gym_active_session`), sin dirty-tracking. Son 4 upserts idempotentes baratos; el dirty-tracking es optimización prematura (YAGNI). `gym_sessions` se inserta una sola vez al finalizar cada sesión.

---

## Task 0: Setup manual en Supabase (Andrés, guiado)

**No-código.** Se hace en el dashboard del proyecto de viajes (`https://supabase.com/dashboard` → proyecto `gbfxpzsblnrasfvxnquk`). Necesario antes de poder probar Tasks 4-7.

**Files:**
- Create: `docs/supabase-setup.sql` (referencia del SQL ejecutado)

- [ ] **Step 1: Crear el archivo SQL de referencia**

Create `docs/supabase-setup.sql`:

```sql
-- gym-oso: tablas en el proyecto compartido con la app de viajes.
-- Prefijo gym_ evita colisión. RLS por auth.uid(). Ejecutar en SQL Editor del dashboard.

-- 4 tablas de fila única + 1 de sesiones
create table gym_profile        (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_plan           (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_settings       (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_active_session (user_id uuid primary key references auth.users(id), data jsonb, updated_at timestamptz default now());
create table gym_sessions       (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), data jsonb, created_at timestamptz default now());

-- REPLICA IDENTITY FULL: necesario para DELETE realtime con filtro (convención del proyecto de viajes)
alter table gym_profile        replica identity full;
alter table gym_plan           replica identity full;
alter table gym_settings       replica identity full;
alter table gym_active_session replica identity full;
alter table gym_sessions       replica identity full;

-- RLS: cada usuario solo ve/escribe sus filas
do $$ declare t text;
begin
  foreach t in array array['gym_profile','gym_plan','gym_settings','gym_active_session','gym_sessions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Realtime: publicar las 5 tablas
alter publication supabase_realtime add table gym_profile, gym_plan, gym_settings, gym_active_session, gym_sessions;
```

- [ ] **Step 2: Ejecutar el SQL**

En dashboard → **SQL Editor** → pegar el contenido de `docs/supabase-setup.sql` → **Run**. Verificar: Table Editor muestra las 5 tablas `gym_*`.

- [ ] **Step 3: Crear la cuenta de auth**

Dashboard → **Authentication → Users → Add user** → email de Andrés + password. (Opcional endurecer: **Authentication → Providers → Email → Disable signups** tras crear la cuenta.)

- [ ] **Step 4: Copiar credenciales**

Dashboard → **Settings → API**. Anotar:
- `Project URL` = `https://gbfxpzsblnrasfvxnquk.supabase.co`
- `anon public` key (la usa Task 4).

- [ ] **Step 5: Commit del SQL de referencia**

```bash
git add docs/supabase-setup.sql
git commit -m "chore: SQL de setup Supabase gym-oso (tablas gym_*, RLS, realtime)"
```

---

## Task 1: Vendorizar supabase-js + precache en SW

**Files:**
- Create: `vendor/supabase.js`
- Modify: `index.html` (`<head>`, agregar `<script src>`)
- Modify: `sw.js` (cache name + lista de precache)

- [ ] **Step 1: Descargar el UMD de supabase-js**

Run:
```bash
cd "d:/ANDRES/Claude_Projects/App_gym" && mkdir -p vendor && curl -L "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" -o vendor/supabase.js
```
Expected: `vendor/supabase.js` existe, >100KB. Verificar:
```bash
head -c 200 vendor/supabase.js
```
Expected: contiene `supabase` / minified JS (no HTML de error).

- [ ] **Step 2: Cargar el vendor en index.html**

En `index.html`, ANTES del `<script>` principal de la app (que empieza tras la línea `const STORE_KEY`), agregar en el `<head>` o justo antes del `<script>` inline:

```html
<script src="vendor/supabase.js"></script>
```

Expone `window.supabase.createClient`.

- [ ] **Step 3: Bump cache + precache en sw.js**

En `sw.js`, localizar `const CACHE = 'oso-gym-vN'` y subir N en uno. Agregar `'vendor/supabase.js'` a la lista de assets precacheados (junto a `elosogym.css`, `osos-imgs.js`, fonts).

- [ ] **Step 4: Verificar carga**

Run:
```bash
cd "d:/ANDRES/Claude_Projects/App_gym" && python -m http.server 8080
```
Abrir `http://localhost:8080`, consola del navegador:
```js
typeof supabase.createClient
```
Expected: `"function"`.

- [ ] **Step 5: Commit**

```bash
git add vendor/supabase.js index.html sw.js
git commit -m "feat: vendoriza supabase-js (offline) + precache en SW"
```

---

## Task 2: Capa pura de transformación DB ↔ filas (TDD)

Funciones puras: `pickSyncSettings`, `gymStateRows`, `hydrateGymDB`. Sin I/O.

**Files:**
- Modify: `index.html` (nuevo bloque de funciones, reemplaza la sección Gist `index.html:295-371`)
- Modify: `tests/test.js` (exposeReturn `:72-79` + bloque de tests `:466-496`)

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/test.js`, REEMPLAZAR el bloque `console.log('\n--- Sync GitHub Gist...` (`:466-496`) por:

```js
console.log('\n--- Sync Supabase: transformación DB ↔ filas ---');
test('pickSyncSettings: solo wake/autoProgress/telemetry (sin github*)', () => {
  const s = pickSyncSettings({ wake:true, autoProgress:false, telemetry:true, githubSync:true, githubToken:'x', gistId:'y' });
  assertDeep(s, { wake:true, autoProgress:false, telemetry:true });
});
test('gymStateRows: arma 4 filas de fila única con user_id + data', () => {
  const db = { profile:{w:75}, plan:{start:'2026'}, settings:{wake:true,autoProgress:true,telemetry:true},
    sessionSets:{'0':{id:'x'}}, _currentRef:{w:0,d:1}, _kneeStatus:'bien', _adaptedSession:null, _sessionNote:'hola' };
  const r = gymStateRows(db, 'UID');
  assertEq(r.profile.user_id, 'UID');
  assertDeep(r.profile.data, {w:75});
  assertDeep(r.plan.data, {start:'2026'});
  assertEq(r.settings.data.wake, true);
  assertEq(r.settings.data.githubToken, undefined, 'settings no lleva github*');
  assertDeep(r.active_session.data.sessionSets, {'0':{id:'x'}});
  assertEq(r.active_session.data._sessionNote, 'hola');
  assertDeep(r.active_session.data._currentRef, {w:0,d:1});
});
test('hydrateGymDB: reconstruye DB desde filas + conserva telemetría local', () => {
  const rows = {
    profile: { data:{w:80} }, plan: { data:{start:'X'} },
    settings: { data:{wake:true} },
    active_session: { data:{ sessionSets:{'0':{id:'a'}}, _currentRef:{w:1,d:0}, _kneeStatus:'leve', _adaptedSession:null, _sessionNote:'n' } },
    sessions: [ { data:{date:'d1'} }, { data:{date:'d2'} } ],
  };
  const localTel = { events:[{x:1}], version:1 };
  const db = hydrateGymDB(DEFAULT_DB, rows, localTel);
  assertDeep(db.profile, {w:80});
  assertDeep(db.plan, {start:'X'});
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
```

- [ ] **Step 2: Actualizar exposeReturn del harness**

En `tests/test.js:72-79`, en el objeto `return {...}`, reemplazar `syncEnabled, mergeRestoredDB` por:
```js
    pickSyncSettings, gymStateRows, hydrateGymDB
```

- [ ] **Step 3: Correr tests — deben fallar**

Run: `node tests/test.js`
Expected: FATAL o FAILs — `pickSyncSettings is not defined` (aún no existen).

- [ ] **Step 4: Implementar las funciones puras**

En `index.html`, REEMPLAZAR todo el bloque Gist (`index.html:295-371`: desde el comentario `/* ===== SYNC GITHUB GIST ... */` hasta `window.restoreFromGist = restoreFromGist;` inclusive) por:

```js
/* ============= SYNC SUPABASE (backup + multi-dispositivo) =============
   localStorage sigue siendo fuente primaria en sesión (offline-first).
   Estas tablas gym_* (jsonb por entidad) son capa aditiva de sync.
   Telemetría NUNCA sincroniza (puede pesar 100KB+, vive solo local). */

// Settings que SÍ se sincronizan (sin credenciales locales de plataforma)
function pickSyncSettings(settings){
  const s = settings || {};
  return { wake: !!s.wake, autoProgress: s.autoProgress !== false, telemetry: s.telemetry !== false };
}

// DB en memoria → payloads de las 4 tablas de fila única (sessions va aparte)
function gymStateRows(db, uid){
  return {
    profile:        { user_id: uid, data: db.profile ?? null },
    plan:           { user_id: uid, data: db.plan ?? null },
    settings:       { user_id: uid, data: pickSyncSettings(db.settings) },
    active_session: { user_id: uid, data: {
      sessionSets:     db.sessionSets || {},
      _currentRef:     db._currentRef ?? null,
      _kneeStatus:     db._kneeStatus ?? null,
      _adaptedSession: db._adaptedSession ?? null,
      _sessionNote:    db._sessionNote ?? '',
    } },
  };
}

// Filas remotas → DB en memoria. Conserva la telemetría LOCAL (nunca viene del remoto).
function hydrateGymDB(defaultDB, rows, localTelemetry){
  const as = rows.active_session?.data || {};
  return {
    ...defaultDB,
    profile:  rows.profile?.data ?? null,
    plan:     rows.plan?.data ?? null,
    sessions: (rows.sessions || []).map(r => r.data),
    sessionSets: as.sessionSets || {},
    settings: { ...defaultDB.settings, ...(rows.settings?.data || {}) },
    telemetry: localTelemetry ?? JSON.parse(JSON.stringify(defaultDB.telemetry)),
    _currentRef:     as._currentRef ?? null,
    _kneeStatus:     as._kneeStatus ?? null,
    _adaptedSession: as._adaptedSession ?? null,
    _sessionNote:    as._sessionNote ?? '',
  };
}
```

- [ ] **Step 4b: Evitar ref rota en saveDB**

El bloque Gist eliminado incluía `scheduleGistSync`, que `saveDB` aún llama. En `index.html:287`, **eliminar** la línea:
```js
  scheduleGistSync();  // backup en la nube (debounced, fire-and-forget) si está activado
```
(Task 5 Step 2 la reemplaza por `scheduleSupabaseSync()`. Entre Task 2 y Task 5 la app no sincroniza a la nube — localStorage sigue funcionando, cada commit queda ejecutable.)

- [ ] **Step 5: Quitar campos github* de DEFAULT_DB**

En `index.html:259-260`, cambiar la línea `settings:` de DEFAULT_DB de:
```js
  settings: { wake: false, autoProgress: true, telemetry: true,
              githubSync: false, githubToken: '', gistId: '' },
```
a:
```js
  settings: { wake: false, autoProgress: true, telemetry: true },
```

- [ ] **Step 6: Correr tests — deben pasar**

Run: `node tests/test.js`
Expected: PASS (todos). El conteo baja respecto a los 4 tests Gist viejos y sube por los 6 nuevos.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: capa pura DB↔filas Supabase + tests (reemplaza transform Gist)"
```

---

## Task 3: Merge de cambios realtime (TDD)

Función pura `applyGymRealtime(DB, table, row)` que aplica un cambio entrante de otro dispositivo a la slice correspondiente del `DB`, ignorando self-echo (si la data ya es idéntica). Devuelve `true` si hubo cambio (re-render).

**Files:**
- Modify: `index.html` (agregar tras `hydrateGymDB`)
- Modify: `tests/test.js` (exposeReturn + tests)

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/test.js`, tras el bloque de Task 2, agregar:

```js
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
```

- [ ] **Step 2: Agregar al exposeReturn**

En `tests/test.js`, en el `return {...}`, agregar `applyGymRealtime` a la lista (junto a `pickSyncSettings, gymStateRows, hydrateGymDB`).

- [ ] **Step 3: Correr — deben fallar**

Run: `node tests/test.js`
Expected: FAIL — `applyGymRealtime is not defined`.

- [ ] **Step 4: Implementar**

En `index.html`, tras la función `hydrateGymDB`, agregar:

```js
// Aplica un cambio realtime entrante a la slice del DB. Ignora self-echo (data ya idéntica).
// Devuelve true si el DB cambió (=> re-render).
function applyGymRealtime(db, table, row){
  const data = row?.data;
  if(table === 'gym_sessions'){
    if(!data) return false;
    db.sessions = db.sessions || [];
    if(db.sessions.some(s => s.date === data.date)) return false; // ya existe
    db.sessions.push(data);
    return true;
  }
  const sliceEq = (cur, next) => JSON.stringify(cur ?? null) === JSON.stringify(next ?? null);
  if(table === 'gym_profile'){
    if(sliceEq(db.profile, data)) return false;
    db.profile = data; return true;
  }
  if(table === 'gym_plan'){
    if(sliceEq(db.plan, data)) return false;
    db.plan = data; return true;
  }
  if(table === 'gym_settings'){
    const next = { ...(db.settings||{}), ...(data||{}) };
    if(sliceEq(db.settings, next)) return false;
    db.settings = next; return true;
  }
  if(table === 'gym_active_session'){
    const cur = { sessionSets: db.sessionSets, _currentRef: db._currentRef, _kneeStatus: db._kneeStatus, _adaptedSession: db._adaptedSession, _sessionNote: db._sessionNote };
    if(sliceEq(cur, data)) return false;
    db.sessionSets = data.sessionSets || {};
    db._currentRef = data._currentRef ?? null;
    db._kneeStatus = data._kneeStatus ?? null;
    db._adaptedSession = data._adaptedSession ?? null;
    db._sessionNote = data._sessionNote ?? '';
    return true;
  }
  return false;
}
```

- [ ] **Step 5: Correr — deben pasar**

Run: `node tests/test.js`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: merge de cambios realtime Supabase (pure) + tests"
```

---

## Task 4: Cliente Supabase + auth (login)

Glue de I/O. Verificación manual (el harness no corre red).

**Files:**
- Modify: `index.html` (constantes + init cliente + UI login + boot gate)

- [ ] **Step 1: Constantes del cliente**

En `index.html`, al inicio del `<script>` principal (cerca de `const STORE_KEY`), agregar:

```js
/* ===== Supabase (proyecto compartido con la app de viajes) ===== */
const SUPABASE_URL = 'https://gbfxpzsblnrasfvxnquk.supabase.co';
const SUPABASE_ANON_KEY = 'PEGAR_AQUI_LA_ANON_KEY';  // ← Andrés: anon public key de Settings→API (Task 0 Step 4)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
let _gymUid = null;  // uuid del usuario autenticado, o null
```

> Nota de seguridad: `SUPABASE_ANON_KEY` queda en el repo público. Es por diseño (anon key es publicable) y las tablas `gym_*` están protegidas por RLS `auth.uid()`. Ver spec §9.

- [ ] **Step 2: UI de login (modal)**

En `index.html`, agregar una función que muestra un modal de login usando el `openModal` existente. Colocar junto a las otras funciones de UI:

```js
function showLogin(errMsg){
  const err = errMsg ? `<div class="small" style="color:var(--danger);margin-top:8px;">${escHtml(errMsg)}</div>` : '';
  openModal(`
    <h2>Iniciar sesión</h2>
    <div class="small">Tu progreso se sincroniza en la nube (Supabase). Inicia sesión una vez por dispositivo.</div>
    <label class="field" style="margin-top:12px;"><span class="lbl">Email</span>
      <input type="email" id="login-email" class="input" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
    <label class="field"><span class="lbl">Contraseña</span>
      <input type="password" id="login-pass" class="input" autocomplete="current-password"></label>
    ${err}
    <button class="btn primary" style="margin-top:14px;width:100%;" id="login-go">Entrar</button>
  `, { dismissable: false });
  const go = document.getElementById('login-go');
  if(go) go.addEventListener('click', async () => {
    const email = document.getElementById('login-email')?.value.trim();
    const pass  = document.getElementById('login-pass')?.value;
    go.disabled = true; go.textContent = 'Entrando…';
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error || !data?.user){ showLogin(error?.message || 'No se pudo entrar.'); return; }
    _gymUid = data.user.id;
    closeModal();
    await bootWithSession();
  });
}
```

> Si `openModal` no soporta el flag `{ dismissable:false }`, omitirlo — el login no es desechable porque no hay backdrop-close mientras no haya sesión; alternativamente, dejar el modal normal (el usuario no puede usar la app sin loguear porque el boot espera la sesión).

- [ ] **Step 3: Verificación manual del cliente**

Tras pegar la anon key real (Step 1) y servir local:
```js
// consola del navegador
await sb.auth.getSession()
```
Expected: objeto con `data.session` (null si no logueado). Sin errores de red/CORS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: cliente Supabase + modal de login (auth email+password)"
```

---

## Task 5: Boot con sesión, hidratación, sync y realtime

Glue. Conecta todo: gate de login al boot, hidratar desde tablas, upsert debounced en `saveDB`, insert de sesión al finalizar, subscripciones realtime.

**Files:**
- Modify: `index.html` (`saveDB` `:274-288`, boot `:2599-2618`, finalizar sesión `:2275`)

- [ ] **Step 1: Funciones de push (upsert)**

En `index.html`, junto a la capa de sync (tras `applyGymRealtime`), agregar:

```js
let _sbSyncTimer = null;
let _sbReady = false;  // true tras hidratar; evita upserts durante la hidratación inicial

// Debounced: upsert de las 4 tablas de fila única (idempotente, barato)
function scheduleSupabaseSync(){
  if(!_sbReady || !_gymUid) return;
  try {
    clearTimeout(_sbSyncTimer);
    _sbSyncTimer = setTimeout(pushGymState, 4000);
  } catch(e){ /* nunca romper saveDB */ }
}
async function pushGymState(){
  if(!_gymUid) return;
  try {
    const r = gymStateRows(DB, _gymUid);
    const stamp = new Date().toISOString();
    await Promise.all([
      sb.from('gym_profile').upsert({ ...r.profile, updated_at: stamp }),
      sb.from('gym_plan').upsert({ ...r.plan, updated_at: stamp }),
      sb.from('gym_settings').upsert({ ...r.settings, updated_at: stamp }),
      sb.from('gym_active_session').upsert({ ...r.active_session, updated_at: stamp }),
    ]);
  } catch(e){ /* offline / error de red: el estado vive en localStorage, se reintenta al próximo saveDB */ }
}
// Insert de una sesión recién finalizada
async function pushSession(session){
  if(!_gymUid) return;
  try { await sb.from('gym_sessions').insert({ user_id: _gymUid, data: session }); }
  catch(e){ /* se reintenta: ver nota abajo */ }
}
```

- [ ] **Step 2: Cablear saveDB**

En `index.html`, en `saveDB()` (donde antes estaba `scheduleGistSync()`, eliminado en Task 2 Step 4b — al final de la función, tras el `try/catch` de quota), agregar la línea:
```js
  scheduleSupabaseSync();  // sync en la nube (debounced, fire-and-forget) si hay sesión
```

- [ ] **Step 3: Cablear el insert de sesión al finalizar**

En `index.html:2275`, justo después de `DB.sessions.push(session);`, agregar:
```js
  pushSession(session);
```

- [ ] **Step 4: Subscripciones realtime**

En `index.html`, agregar una función que abre las subscripciones:

```js
function subscribeGymRealtime(){
  if(!_gymUid) return;
  const tables = ['gym_profile','gym_plan','gym_settings','gym_active_session','gym_sessions'];
  const ch = sb.channel('gym-sync');
  tables.forEach(t => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `user_id=eq.${_gymUid}` },
      (payload) => {
        const row = payload.new && Object.keys(payload.new).length ? payload.new : null;
        if(!row) return;
        const changed = applyGymRealtime(DB, t, row);
        if(changed){
          try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch(e){}  // persistir sin re-disparar sync
          const active = document.querySelector('.tab.active')?.dataset?.tab || 'home';
          show(active);  // re-render de la pantalla actual
        }
      });
  });
  ch.subscribe();
}
```

> `show(active)` re-renderiza la pantalla visible. Si el nombre del helper de navegación difiere, usar el que ya usa la app (en `index.html:1606` `show('home')` / `function show(tab)`).

- [ ] **Step 5: Boot con sesión**

En `index.html`, reemplazar el bloque BOOT (`:2599-2618`, desde `migrateBaselineFormula();` hasta el registro del service worker) por una secuencia gated por login:

```js
/* ============= BOOT ============= */
function showApp(){ $('#onboarding').style.display='none'; $('#ob-actions').style.display='none'; $('#app').style.display=''; const lb = $('#logo-bear'); if(lb) lb.innerHTML = bearSVG('dumbbell', 30); show('home'); }

async function fetchGymRows(uid){
  const [profile, plan, settings, active, sessions] = await Promise.all([
    sb.from('gym_profile').select('data').eq('user_id', uid).maybeSingle(),
    sb.from('gym_plan').select('data').eq('user_id', uid).maybeSingle(),
    sb.from('gym_settings').select('data').eq('user_id', uid).maybeSingle(),
    sb.from('gym_active_session').select('data').eq('user_id', uid).maybeSingle(),
    sb.from('gym_sessions').select('data').eq('user_id', uid).order('created_at', { ascending: true }),
  ]);
  return {
    profile: profile.data, plan: plan.data, settings: settings.data,
    active_session: active.data, sessions: sessions.data || [],
  };
}

async function bootWithSession(){
  // Hidratar desde la nube si hay datos remotos; si no, primer push desde el localStorage local.
  let remote = null;
  try { remote = await fetchGymRows(_gymUid); } catch(e){ remote = null; }
  const remoteHasData = remote && (remote.profile || remote.plan || (remote.sessions && remote.sessions.length));
  if(remoteHasData){
    DB = hydrateGymDB(DEFAULT_DB, remote, DB.telemetry);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch(e){}
  }
  // Migraciones (idempotentes) sobre el DB ya hidratado
  migrateBaselineFormula();
  if(DB.plan?.weeks){
    const firstEx = DB.plan.weeks[0]?.[0]?.exercises?.find(e => !e.isCardio && !e.noWeight);
    if(firstEx && (firstEx.type === undefined || firstEx.repMin === undefined)){
      tagPlanWithWindows(); DB.plan.objective = OBJECTIVE.id; saveDB();
    }
  }
  migrateDayCV3();
  _sbReady = true;
  subscribeGymRealtime();
  if(!remoteHasData) pushGymState();  // primer push del estado local a la nube
  if(!DB.profile){ showOnboarding(); } else { showApp(); }
}

(async () => {
  const { data } = await sb.auth.getSession();
  if(data?.session?.user){ _gymUid = data.session.user.id; await bootWithSession(); }
  else { showLogin(); }
})();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
```

- [ ] **Step 6: Verificación manual end-to-end**

Servir local, abrir app:
1. Aparece el modal de login → entrar con la cuenta de Task 0 Step 3.
2. App carga. Hacer un cambio (ej. completar una serie). Esperar ~4s.
3. Dashboard Supabase → Table Editor → `gym_active_session`: debe haber 1 fila con tu `user_id` y `data` actualizada.
4. Finalizar una sesión → `gym_sessions` gana 1 fila.
5. Abrir la app en otra pestaña/dispositivo logueado → realtime: el cambio aparece sin recargar.
6. Modo avión (offline): la app sigue funcionando (escribe a localStorage); al volver online el próximo `saveDB` reintenta el upsert.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: boot con login, hidratación, upsert debounced e insert de sesión + realtime"
```

---

## Task 6: Eliminar UI y restos de Gist

**Files:**
- Modify: `index.html` (HTML Config `:168-188`, `renderConfig` `:2475-2477`, listeners `:2526-2544`)

- [ ] **Step 1: Quitar la card de Gist en el HTML de Config**

En `index.html:168-188`, eliminar el bloque completo `<div class="card"> <h3>☁️ Sync con GitHub Gist</h3> ... </div>` (toggle `#cfg-gist`, inputs `#github-token`/`#gist-id`, `#gist-status`, botones `#gist-sync-now`/`#gist-restore`).

- [ ] **Step 2: Quitar refs a campos Gist en renderConfig**

En `index.html:2475-2477`, eliminar las 3 líneas:
```js
  const gistChk = $('#cfg-gist'); if(gistChk) gistChk.checked = !!DB.settings.githubSync;
  const gTok = $('#github-token'); if(gTok) gTok.value = DB.settings.githubToken || '';
  const gId = $('#gist-id'); if(gId) gId.value = DB.settings.gistId || '';
```

- [ ] **Step 3: Quitar los listeners de Gist**

En `index.html:2526-2544`, eliminar el bloque completo desde el comentario `/* ----- Sync GitHub Gist ... */` hasta `$('#gist-restore').addEventListener('click', () => restoreFromGist());` inclusive.

- [ ] **Step 4: Verificar que no quedan referencias**

Run:
```bash
cd "d:/ANDRES/Claude_Projects/App_gym" && grep -rn "gist\|githubToken\|githubSync\|syncToGist\|restoreFromGist\|scheduleGistSync\|mergeRestoredDB\|syncEnabled" index.html
```
Expected: sin resultados (o solo en comentarios históricos intencionales — eliminarlos también).

- [ ] **Step 5: Correr tests**

Run: `node tests/test.js`
Expected: PASS (todos). Ningún test referencia ya `syncEnabled`/`mergeRestoredDB`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "refactor: elimina UI y código residual de GitHub Gist"
```

---

## Task 7: UI de cuenta en Config (estado + cerrar sesión + sync ahora)

**Files:**
- Modify: `index.html` (HTML Config — donde estaba la card de Gist; `renderConfig`; nuevos listeners)

- [ ] **Step 1: Card de cuenta en el HTML**

En `index.html`, donde estaba la card de Gist (Task 6 Step 1), insertar:

```html
<div class="card">
  <h3>☁️ Sincronización (Supabase)</h3>
  <div class="small" id="account-status" style="margin-top:4px;color:var(--muted);min-height:16px;">—</div>
  <div class="small" id="sync-status" style="margin-top:2px;min-height:16px;color:var(--muted);"></div>
  <div class="btn-row" style="margin-top:10px;gap:8px;">
    <button class="btn primary" id="sync-now" style="flex:1;">⬆ Sincronizar ahora</button>
    <button class="btn" id="logout">Cerrar sesión</button>
  </div>
</div>
```

- [ ] **Step 2: Mostrar el email en renderConfig**

En `index.html`, dentro de `renderConfig()`, agregar (tras las líneas de telemetría):
```js
  const accEl = $('#account-status');
  if(accEl){ sb.auth.getUser().then(({ data }) => { accEl.textContent = data?.user ? ('Conectado: ' + data.user.email) : 'Sin sesión'; }); }
```

- [ ] **Step 3: Listeners de cuenta**

En `index.html`, donde estaban los listeners de Gist (Task 6 Step 3), insertar:
```js
$('#sync-now').addEventListener('click', async () => {
  const st = $('#sync-status');
  if(!_gymUid){ if(st){ st.textContent = 'Sin sesión.'; st.style.color = 'var(--warn)'; } return; }
  if(st){ st.textContent = 'Sincronizando…'; st.style.color = 'var(--muted)'; }
  try {
    await pushGymState();
    if(st){ st.textContent = '✓ Sincronizado ' + new Date().toLocaleTimeString('es'); st.style.color = 'var(--success)'; }
  } catch(e){
    if(st){ st.textContent = '✗ Error de red.'; st.style.color = 'var(--danger)'; }
  }
});
$('#logout').addEventListener('click', async () => {
  if(!confirm('¿Cerrar sesión? Tus datos quedan en la nube y en este equipo.')) return;
  await sb.auth.signOut();
  location.reload();
});
```

- [ ] **Step 4: Verificación manual**

Servir local → Config: muestra "Conectado: <email>". "Sincronizar ahora" → "✓ Sincronizado HH:MM:SS". "Cerrar sesión" → recarga → aparece login.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: UI de cuenta Supabase en Config (estado, sync ahora, cerrar sesión)"
```

---

## Task 8: Docs, memoria y cierre

**Files:**
- Modify: `CLAUDE.md`, `context.md`, `README.md`
- Modify: memoria (`C:\Users\Home\.claude\projects\d--ANDRES-Claude-Projects-App-gym\memory\`)

- [ ] **Step 1: Actualizar CLAUDE.md**

En `CLAUDE.md`: reemplazar toda la sección **"## Sync con GitHub Gist"** y las referencias a Gist en "### ⚙️ Config" y "## Estructura del localStorage" (`settings.githubSync/githubToken/gistId`) por la descripción del sync Supabase: 5 tablas `gym_*`, auth email+password, RLS `auth.uid()`, realtime por fila, `supabase-js` vendorizado, telemetría local. Mencionar proyecto compartido con la app de viajes y la nota de seguridad (anon key pública, datos gym protegidos por RLS).

- [ ] **Step 2: Actualizar context.md**

En `context.md`: actualizar el mapa de funciones — quitar `syncToGist`/`restoreFromGist`/`scheduleGistSync`/`mergeRestoredDB`/`syncEnabled`; agregar `pickSyncSettings`/`gymStateRows`/`hydrateGymDB`/`applyGymRealtime`/`scheduleSupabaseSync`/`pushGymState`/`pushSession`/`subscribeGymRealtime`/`bootWithSession`/`fetchGymRows`/`showLogin`. Actualizar el conteo de tests y la versión de cache del SW.

- [ ] **Step 3: Actualizar README.md**

En `README.md`: reemplazar la sección de setup de Gist por el setup de Supabase (referencia a `docs/supabase-setup.sql`, crear cuenta, pegar anon key). Documentar que requiere login.

- [ ] **Step 4: Actualizar memoria**

Actualizar `project_my_data_y_repo_publico.md` (el auto-sync ya no es Gist sino Supabase) y agregar una línea en `MEMORY.md` si corresponde. Anotar: anon key de viajes compartida vive en repo público de gym (riesgo asumido, datos gym protegidos por RLS).

- [ ] **Step 5: Suite completa + verificación final**

Run: `node tests/test.js`
Expected: exit 0, todos PASS.

Run (sin referencias Gist):
```bash
cd "d:/ANDRES/Claude_Projects/App_gym" && grep -rn "gist\|githubToken" index.html CLAUDE.md context.md README.md
```
Expected: sin resultados.

- [ ] **Step 6: Commit + push**

```bash
git add -A
git commit -m "docs: actualiza CLAUDE.md/context.md/README a sync Supabase"
git push
```

---

## Notas de implementación

- **Reintento de `pushSession` offline:** si el insert de sesión falla offline, la sesión queda en `DB.sessions` (localStorage) pero no en `gym_sessions`. Mitigación simple incluida vía `pushGymState` (que NO cubre sessions). **Mejora opcional post-MVP:** al hidratar/reconectar, comparar `DB.sessions` vs `gym_sessions` remoto e insertar las faltantes (reconciliación). Fuera del alcance del MVP — documentarlo como TODO en `CLAUDE.md §Próximas mejoras`.
- **`openModal` no-dismissable:** verificar la firma real de `openModal` (`index.html`). Si no acepta opciones, el login funciona igual porque el boot no llama `showApp()` sin sesión.
- **Bump de cache del SW:** cada cambio de `index.html` requiere subir `CACHE` en `sw.js` (regla del proyecto). Hacerlo en el último commit que toque `index.html` (Task 7) además del de Task 1.
```
