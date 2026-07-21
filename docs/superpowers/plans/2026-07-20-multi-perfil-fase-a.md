# Multi-perfil (Fase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aislar los datos de cada persona por UID dinámico (perfil elegido) con selector al primer arranque, nombre parametrizado y "cambiar persona" seguro — sin tocar el motor del plan (Fase B aparte).

**Architecture:** Registro `PROFILES` baked (id/name/uid). `_gymUid` pasa de `const` a `let`, resuelto en boot por `resolveProfileId` (lógica pura) desde `localStorage['gymProfileId']` + presencia de datos locales. Device con datos = migra a 'andres' (uid legacy, sin fricción); device fresh = selector. Todas las fns de sync ya usan `_gymUid` → volverlo dinámico particiona las filas `gym_*`. `STORE_KEY` sigue único (1 perfil por device).

**Tech Stack:** HTML/JS inline sin frameworks (`index.html`), localStorage, Supabase (`@supabase/supabase-js` vendorizado), harness de tests Node casero (`tests/test.js`).

**Spec:** `docs/superpowers/specs/2026-07-20-multi-perfil-design.md`

---

## File Structure

- `index.html` — todo el código. Cambios: `PROFILES` + resolvers puros (~L250), `_gymUid` const→let, boot con resolución de identidad + selector (~L3126), copys con nombre (L59, L1398, L1701), `pushGymState` retorna boolean (~L378), botón+handler "Cambiar persona" (Config HTML ~L176 + handler ~L3071).
- `tests/test.js` — tests de `resolveProfileId`/`uidOf`/`profileName` + integridad `PROFILES`; exponer bindings.
- `sw.js` — bump de cache.
- `CLAUDE.md` — sección Multi-perfil + nota UID dinámico.
- Memoria `project_supabase_sync.md` — UID ya no es único fijo.

---

## Task 1: Registro PROFILES + resolvers puros

**Files:**
- Modify: `index.html:241-250` (tras `STORE_KEY` / antes o donde está `_gymUid`)
- Test: `tests/test.js`

- [ ] **Step 1: Escribir tests que fallan**

En `tests/test.js`, antes de `/* ============= FRENTE C` (misma zona que los tests de invariante plan), añadir:

```js
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
```

Y añadir los bindings nuevos al bloque `exposeReturn` (`tests/test.js:85`), en la línea que hoy termina en `sessionHasProgress, planIsValid,`:

```js
    parseHoldSec, isHoldEx, muscleTokens, suggestSwaps, escHtml, sessionHasProgress, planIsValid,
    PROFILES, resolveProfileId, uidOf, profileName,
```

- [ ] **Step 2: Correr tests → fallan**

Run: `node tests/test.js`
Expected: FAIL — `PROFILES is not defined` (o `resolveProfileId is not defined`).

- [ ] **Step 3: Implementar PROFILES + resolvers**

En `index.html`, reemplazar la línea 250:

```js
const _gymUid = 'ea8ea549-eacb-465c-9883-778cad0fcf20';  // UID fijo (único usuario)
```

por:

```js
// ===== Multi-perfil (1 perfil por dispositivo, elección explícita) =====
// Cada perfil sincroniza a SUS propias filas gym_* (keyed por uid) en el mismo proyecto Supabase.
// Agregar una persona = añadir un objeto aquí.
const PROFILES = [
  { id: 'andres', name: 'Andrés', uid: 'ea8ea549-eacb-465c-9883-778cad0fcf20' }, // legacy (datos existentes)
  { id: 'melisa', name: 'Melisa', uid: '8554bae7-752c-4f37-ad4d-00dba477fe38' },
];
const PROFILE_KEY = 'gymProfileId';
function uidOf(id){ return (PROFILES.find(p => p.id === id) || PROFILES[0]).uid; }
function profileName(id){ return (PROFILES.find(p => p.id === (id ?? localStorage.getItem(PROFILE_KEY))) || PROFILES[0]).name; }
// Decide qué perfil usar en boot. Devuelve id, o null si hay que mostrar el selector.
// hasLocalProfile: !!DB.profile — device con datos previos = Andrés (migración legacy).
function resolveProfileId(storedId, hasLocalProfile){
  if(storedId && PROFILES.some(p => p.id === storedId)) return storedId;
  if(hasLocalProfile) return 'andres';
  return null;
}
let _gymUid = uidOf('andres');  // valor provisional; boot lo fija según el perfil resuelto
```

- [ ] **Step 4: Correr tests → pasan**

Run: `node tests/test.js`
Expected: PASS. Total sube a 223 + 6 = 229. `All tests passed.`

- [ ] **Step 5: Commit**

```bash
git add index.html tests/test.js
git commit -m "feat: registro PROFILES + resolvers puros (multi-perfil A)"
```

---

## Task 2: Selector de perfil + resolución de identidad en boot

**Files:**
- Modify: `index.html` — HTML del selector (junto a `#onboarding`), y el boot (~`index.html:3126-3150`)

- [ ] **Step 1: Añadir el markup del selector**

Buscar el contenedor de onboarding (`<div id="onboarding" ...>`). Inmediatamente ANTES de ese div, insertar:

```html
<!-- Selector de perfil (1 perfil por dispositivo) -->
<div id="profile-picker" style="display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;gap:16px;">
  <div style="display:flex;justify-content:center;">
    <span id="picker-bear" style="display:inline-flex;width:120px;height:120px;"></span>
  </div>
  <h1 style="text-align:center;">¿Quién eres?</h1>
  <div class="small" style="text-align:center;max-width:280px;">Cada persona tiene su propio plan y sus datos. Elige tu perfil en este dispositivo.</div>
  <div id="picker-list" style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;margin-top:8px;"></div>
</div>
```

- [ ] **Step 2: Añadir las funciones de selector y arranque de perfil**

Justo ANTES de `async function bootWithSession(){` (~`index.html:3126`), insertar:

```js
function showProfilePicker(){
  const pb = $('#picker-bear'); if(pb) pb.innerHTML = bearSVG('dumbbell', 120);
  const list = $('#picker-list');
  list.innerHTML = PROFILES.map(p =>
    `<button class="btn primary" data-pid="${p.id}" style="padding:16px;font-size:16px;">${escHtml(p.name)}</button>`
  ).join('');
  list.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => pickProfile(b.dataset.pid)));
  $('#profile-picker').style.display = 'flex';
  $('#onboarding').style.display = 'none';
  $('#app').style.display = 'none';
}
function pickProfile(id){
  localStorage.setItem(PROFILE_KEY, id);
  _gymUid = uidOf(id);
  $('#profile-picker').style.display = 'none';
  bootWithSession();
}
```

- [ ] **Step 3: Reemplazar la llamada de arranque**

Reemplazar la última línea del archivo de script que hoy es:

```js
bootWithSession();
```

por:

```js
// Resolución de identidad antes del boot. Device con datos previos = Andrés (migración
// legacy, sin selector). Device fresh sin elección = selector. Elección guardada = directo.
(function startApp(){
  const storedId = localStorage.getItem(PROFILE_KEY);
  const id = resolveProfileId(storedId, !!DB.profile);
  if(id){
    if(id !== storedId) localStorage.setItem(PROFILE_KEY, id);  // persiste migración
    _gymUid = uidOf(id);
    bootWithSession();
  } else {
    showProfilePicker();
  }
})();
```

- [ ] **Step 4: Verificación manual (harness no cubre DOM/boot)**

Run: `python -m http.server 8080` y abrir `http://localhost:8080`.
Casos a comprobar:
- **Tu caso (datos locales):** con `localStorage.elosoGymV2` poblado y SIN `gymProfileId` → NO aparece selector, entra directo; en consola `localStorage.gymProfileId === 'andres'`.
- **Device fresh:** en una ventana incógnito (sin `elosoGymV2` ni `gymProfileId`) → aparece "¿Quién eres?" con botones Andrés/Melisa. Elegir Melisa → `gymProfileId==='melisa'`, arranca onboarding (nube de Melisa vacía).
- **Elección recordada:** recargar tras elegir → NO reaparece el selector.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: selector de perfil + resolución de identidad en boot (multi-perfil A)"
```

---

## Task 3: Nombre parametrizado en copys personales

**Files:**
- Modify: `index.html:59` (guía Home), `index.html:1398` (COACH_RULES cap), `index.html:1701` (bienvenida onboarding), `renderHome` (~`index.html:2049`)

- [ ] **Step 1: Guía Home — inyectar nombre**

En `index.html:59`, cambiar el texto `Reglas para Andrés con síndrome` para usar un span rellenable:

```html
      <div class="small" style="margin-top:8px;">Reglas para <span id="pfps-guide-name">Andrés</span> con síndrome patelofemoral (<span class="term" onclick="openTerm('PFPS')">PFPS</span>). <b>Toca los términos en amarillo para ver qué significan.</b></div>
```

En `renderHome()` (`index.html`, dentro de la función que arranca en ~L2049), añadir al final del cuerpo (antes de cerrar la función):

```js
  const gn = $('#pfps-guide-name'); if(gn) gn.textContent = profileName();
```

- [ ] **Step 2: Bienvenida onboarding — saludo por nombre**

En `index.html:1701`, cambiar:

```js
     <p>Entrenamiento personal para preparación de trekking nivel 4 — adaptado a tu síndrome patelofemoral.</p>
```

por (saludo con el nombre del perfil activo):

```js
     <p>Hola, ${escHtml(profileName())} 👋 Entrenamiento personal adaptado a tu objetivo y a tu rodilla.</p>
```

- [ ] **Step 3: COACH_RULES cap — despersonalizar a "tú"**

En `index.html:1398`, cambiar `Solo Andrés decide subir un cap.` por `Solo tú decides subir un cap.` (dict estático → "tú" evita templating por-render; lee bien para cualquier persona).

- [ ] **Step 4: Verificación manual**

Run: `python -m http.server 8080`. Como Melisa (perfil elegido): la guía Home dice "Reglas para Melisa…", la bienvenida "Hola, Melisa 👋". El modal ¿por qué? de un cap dice "Solo tú decides…".

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: nombre parametrizado en copys personales (multi-perfil A)"
```

---

## Task 4: pushGymState retorna boolean

**Files:**
- Modify: `index.html:378-391`

- [ ] **Step 1: Hacer que devuelva éxito/fallo**

Reemplazar la función `pushGymState` (`index.html:378`) para que retorne boolean sin cambiar el comportamiento de los callers actuales (ignoran el retorno):

```js
async function pushGymState(){
  if(!_gymUid) return false;
  try {
    const r = gymStateRows(DB, _gymUid);
    const stamp = new Date().toISOString();
    await Promise.all([
      sb.from('gym_profile').upsert({ ...r.profile, updated_at: stamp }),
      sb.from('gym_plan').upsert({ ...r.plan, updated_at: stamp }),
      sb.from('gym_settings').upsert({ ...r.settings, updated_at: stamp }),
      sb.from('gym_active_session').upsert({ ...r.active_session, updated_at: stamp }),
      sb.from('gym_telemetry').upsert({ ...r.telemetry, updated_at: stamp }),
    ]);
    return true;
  } catch(e){ /* offline / error de red: el estado vive en localStorage, se reintenta al próximo saveDB */ return false; }
}
```

- [ ] **Step 2: Verificación**

Run: `node tests/test.js`
Expected: PASS (sin cambios de count — `pushGymState` no está en el harness; se valida que no rompe carga). Total 229. `All tests passed.`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: pushGymState retorna boolean para flush verificable (multi-perfil A)"
```

---

## Task 5: Config → "Cambiar persona" (flush antes de wipe)

**Files:**
- Modify: `index.html:176-179` (card Config), `index.html:3071` (zona de handlers de Config)

- [ ] **Step 1: Añadir el botón en Config**

En `index.html`, dentro de la card "Reiniciar onboarding" (L176-179), añadir un botón nuevo (o una card aparte encima). Reemplazar el bloque L176-179:

```html
    <div class="card">
      <h3>Reiniciar onboarding</h3>
      <button class="btn danger" id="reset-onb">Volver a hacer onboarding</button>
    </div>
```

por:

```html
    <div class="card">
      <h3>Cambiar persona</h3>
      <div class="small">Este dispositivo usa 1 perfil. Cambiar sube tus datos a la nube y luego los limpia de este dispositivo para entrar como otra persona. En la nube nada se pierde.</div>
      <button class="btn" id="switch-profile" style="margin-top:8px;">Cambiar persona</button>
    </div>
    <div class="card">
      <h3>Reiniciar onboarding</h3>
      <button class="btn danger" id="reset-onb">Volver a hacer onboarding</button>
    </div>
```

- [ ] **Step 2: Añadir el handler (flush verificado → wipe → reload)**

Junto al handler `#reset-onb` (`index.html:3071`), añadir:

```js
$('#switch-profile').addEventListener('click', () => {
  openModal(`
    <h2>¿Cambiar de persona?</h2>
    <div class="small" style="margin:8px 0 14px;">Voy a subir tus datos a la nube y limpiar este dispositivo para entrar como otra persona. Necesitas internet. En la nube nada se borra.</div>
    <button class="btn primary" id="switch-go" style="margin-bottom:8px;">Subir y cambiar</button>
    <button class="btn" id="switch-cancel">Cancelar</button>
  `);
  $('#switch-cancel').addEventListener('click', closeModal);
  $('#switch-go').addEventListener('click', async () => {
    const btn = $('#switch-go'); btn.disabled = true; btn.textContent = 'Subiendo…';
    const ok = await pushGymState();
    if(!ok){
      btn.disabled = false; btn.textContent = 'Subir y cambiar';
      $('#switch-go').insertAdjacentHTML('afterend', '<div class="small" style="color:var(--danger);margin-top:8px;" id="switch-err">Sin conexión: no puedo cambiar sin perder datos. Reintenta con internet.</div>');
      return;
    }
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(STORE_KEY);
    location.reload();
  });
});
```

- [ ] **Step 3: Verificación manual**

Run: `python -m http.server 8080`.
- Online → "Cambiar persona" → "Subir y cambiar" → recarga → aparece el selector. Re-elegir el mismo perfil → datos re-hidratados desde la nube (intactos).
- Simular offline (DevTools → Network → Offline) → "Subir y cambiar" → muestra el aviso rojo, NO borra, NO recarga.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: Config 'Cambiar persona' con flush verificado antes del wipe (multi-perfil A)"
```

---

## Task 6: Docs + cache bump + memoria

**Files:**
- Modify: `CLAUDE.md`, `sw.js`, `C:/Users/Home/.claude/projects/d--ANDRES-Claude-Projects-App-gym/memory/project_supabase_sync.md`

- [ ] **Step 1: Bump de cache SW**

En `sw.js:1`, subir el número de versión (`oso-gym-vN` → `oso-gym-v(N+1)`).

- [ ] **Step 2: CLAUDE.md — sección Multi-perfil**

Añadir tras la sección "Sync Supabase" un bloque nuevo:

```markdown
## Multi-perfil (Fase A)

1 perfil por dispositivo, elección explícita. `PROFILES` baked (id/name/uid); `_gymUid` dinámico según el perfil elegido → cada persona sincroniza a SUS filas `gym_*`. `resolveProfileId(storedId, hasLocalProfile)` (pura, testeada): elección guardada → directo; sin elección + datos locales → `andres` (migración legacy sin fricción); fresh → selector "¿Quién eres?". `profileName()`/`uidOf()` parametrizan nombre y UID. "Cambiar persona" (Config): `await pushGymState()` (flush verificado) → solo si OK borra `gymProfileId` + `elosoGymV2` local → reload → selector. La nube de cada UID queda intacta. Fase B (motor por objetivo / PFPS opcional) = pendiente, `DB.profile.objective` reservado.
```

Y en la sección "Sync Supabase", cambiar la mención de "UID fijo hardcodeado" por "UID dinámico por perfil (ver § Multi-perfil); Andrés conserva el UID legacy".

- [ ] **Step 3: Actualizar memoria**

Editar `C:/Users/Home/.claude/projects/d--ANDRES-Claude-Projects-App-gym/memory/project_supabase_sync.md`: el UID ya no es único fijo — ahora hay `PROFILES` con UID por persona; Andrés = uid legacy. `[[project_multi_perfil]]` opcional como enlace futuro.

- [ ] **Step 4: Correr tests + commit final**

Run: `node tests/test.js`
Expected: PASS. Total 229. `All tests passed.`

```bash
git add -A
git commit -m "docs: multi-perfil Fase A (CLAUDE.md, sw cache, memoria)"
git push
```

---

## Notas de ejecución

- Tras cada task, `node tests/test.js` debe seguir en verde.
- Las tasks 2, 3, 5 tocan DOM/boot → no cubiertas por el harness; usar la verificación manual descrita (server local + incógnito para simular device fresh).
- No tocar el motor del plan, `OBJECTIVE`, reglas de rodilla ni catálogo — eso es Fase B.
