# Multi-perfil (Fase A: infraestructura) — Design

**Fecha:** 2026-07-20
**Estado:** Aprobado (diseño). Pendiente implementación.
**Alcance:** Solo Fase A (infraestructura). Fase B (motor por objetivo) = spec aparte.

## Contexto y problema

La app es mono-usuario por diseño: `_gymUid` fijo hardcodeado (`ea8ea549-eacb-465c-9883-778cad0fcf20`) + una sola clave `localStorage 'elosoGymV2'`. Sync a Supabase con RLS abierta (anon) sobre tablas `gym_*` keyed por `user_id`.

Se quiere una segunda persona (Melisa) en **otro dispositivo**. Si Melisa instala la misma PWA y hace onboarding, su device empuja a **las mismas filas `gym_*`** → pisa los datos de Andrés; realtime los cruza. El onboarding por sí solo no aísla nada — el problema de raíz es el UID fijo.

Melisa tiene un objetivo/condición distintos (no trekking/PFPS), pero eso (Fase B) está **bloqueado** hasta conocer su objetivo real y requiere generalizar el motor del plan. Fase A es independiente y shippable: deja a Melisa existiendo, aislada, con su nombre, y reserva el gancho para B.

## Decisiones tomadas

- **1 perfil por dispositivo, elección explícita** (no varios perfiles namespaced en un device; no auto-UID silencioso). `STORE_KEY` sigue único.
- **Selector de perfil al primer arranque** (no cada boot; se recuerda la elección).
- **Nombre parametrizado** en copys personales; marca "El Oso Gym" + mascota se mantienen.
- **Decomposición:** A ahora, B (objetivos múltiples / PFPS opcional / ejercicios por objetivo) como spec posterior.

## Arquitectura

### 1. Registro de perfiles (baked en la app)

```js
const PROFILES = [
  { id: 'andres', name: 'Andrés', uid: 'ea8ea549-eacb-465c-9883-778cad0fcf20' }, // legacy
  { id: 'melisa', name: 'Melisa', uid: '8554bae7-752c-4f37-ad4d-00dba477fe38' },
];
```

- Agregar una persona = añadir un objeto al array.
- `_gymUid`: cambia de `const` a `let`, resuelto en boot según el perfil elegido.
- `DB.profile.objective`: campo reservado, default `'trekking_n4_pfps'`. Gancho para Fase B; en Fase A no se ramifica nada por su valor.

### 2. Resolución de identidad (`resolveProfileId`, lógica pura)

Función pura testeable:

```js
// storedId: localStorage['gymProfileId'] | null
// hasLocalProfile: !!DB.profile (datos locales existentes)
// -> devuelve el id de perfil a usar, o null si hay que mostrar el selector
function resolveProfileId(storedId, hasLocalProfile){
  if(storedId && PROFILES.some(p => p.id === storedId)) return storedId;
  if(hasLocalProfile) return 'andres'; // migración: device existente = Andrés (legacy)
  return null; // device fresh -> selector
}
```

Flujo en boot (antes de `bootWithSession`):
1. `storedId = localStorage['gymProfileId']`.
2. `id = resolveProfileId(storedId, !!DB.profile)`.
3. Si `id` no nulo → `localStorage['gymProfileId'] = id` (persiste migración), `_gymUid = uidOf(id)`, correr `bootWithSession()`.
4. Si `id` nulo → render **selector**; al elegir perfil `p`: `localStorage['gymProfileId'] = p.id`, `_gymUid = p.uid`, correr `bootWithSession()`.

**Migración de Andrés (crítica, sin fricción):** su device ya tiene `elosoGymV2` con profile → `resolveProfileId(null, true) = 'andres'` → uid legacy → hidrata sus filas de nube existentes. Cero selector, cero pérdida.

### 3. Selector de perfil (UI)

- Pantalla full-screen reutilizando el contenedor/estilo de onboarding (`#onboarding` o uno análogo).
- Título "¿Quién eres?" + un botón por perfil (nombre + oso `bearSVG('dumbbell')`).
- Solo se muestra cuando `resolveProfileId` devuelve null (device fresh sin datos).
- Al elegir → persiste id, set `_gymUid`, arranca boot (hidrata esa nube → onboarding si vacía).

### 4. Nombre parametrizado

- `profileName()` → nombre del perfil actual (lee PROFILES por `gymProfileId`), fallback `'Andrés'`.
- Reemplaza los 2 copys user-facing con "Andrés":
  - Onboarding, regla PFPS (aprox. línea 59): "Reglas para **{nombre}** con síndrome patelofemoral…".
  - `COACH_RULES` texto de cap (aprox. línea 1398): "Solo **{nombre}** decide subir un cap.".
- Bienvenida de onboarding saluda por nombre.
- Marca "El Oso Gym" (title, logo, meta, `<h1>`) y mascota → **no** cambian.

### 5. Config → "Cambiar persona"

- Botón en Config → modal `openModal()` con aviso claro: "Esto limpia los datos de entrenamiento de ESTE dispositivo y recarga como otro perfil. Los datos en la nube de cada persona quedan intactos."
- Al confirmar (**anti-pérdida**): `await pushGymState()` (push final síncrono, no el debounce fire-and-forget) para volcar cualquier cambio pendiente a la nube; **solo si el push resuelve OK** → borra `localStorage['gymProfileId']` + `localStorage['elosoGymV2']` → `location.reload()` → selector.
  - Si el push falla (offline) → **no borra**; avisa "sin conexión, no puedo cambiar de perfil sin perder datos; reintenta con internet". El wipe destructivo nunca corre con cambios sin subir.
- La nube de cada UID queda intacta; re-elegir un perfil re-hidrata desde su nube.
- Único mecanismo de "switch". **YAGNI:** sin UI de agregar/borrar perfiles (los perfiles son la lista baked).

### 6. Aislamiento de sync

- Todas las fns de sync (`pushGymState`, `pushSession`, `fetchGymRows`, `subscribeGymRealtime`, `bootWithSession`) ya referencian `_gymUid`. Volverlo dinámico basta para particionar: cada perfil → sus propias filas `gym_*` en el mismo proyecto Supabase.
- Sin cambio de schema, sin cambio de RLS (anon abierta, cualquier UID válido sirve como partición).
- **`pushGymState()` debe devolver `true/false`** (hoy es fire-and-forget y traga el error) para que "Cambiar persona" pueda esperar el push final y abortar el wipe si falló. El resto de callers ignoran el retorno (comportamiento igual).
- **Gap conocido de sesiones:** `pushGymState` sube las 5 tablas de fila única, NO `gym_sessions` (esas se insertan en `pushSession` al finalizar). Una sesión cuyo `pushSession` falló offline vive solo local y se perdería en el wipe. Fuera de alcance de A cerrarlo del todo (es el item pendiente "Reconciliación de `gym_sessions`" en CLAUDE.md); A mitiga exigiendo online para el switch, pero se documenta el borde. Cierre completo = feature de reconciliación aparte.

## Manejo de errores / bordes

- `gymProfileId` inválido (id no en PROFILES) → tratado como ausente → `resolveProfileId` ignora y re-decide (migración o selector).
- Perfil elegido con nube vacía y sin datos locales → onboarding normal.
- "Cambiar persona" es destructivo local → siempre detrás de confirmación (`openModal`, no `confirm()` nativo — bloqueado en PWA iOS standalone).

## Testing

Puros (harness Node existente):
- `resolveProfileId(storedId, hasLocalProfile)`: storedId válido → ese id; storedId inválido + local → 'andres'; null + local → 'andres'; null + sin local → null; storedId válido gana sobre migración.
- `profileName(id)` / `uidOf(id)`: id conocido → valor; desconocido → fallback.
- Integridad `PROFILES`: ids únicos, uids únicos, uids con forma UUID, 'andres' usa el uid legacy exacto.

Boot/selector/DOM y `location.reload` → no testeables con el harness (stub DOM). Toda la decisión se factoriza en funciones puras; la capa DOM queda delgada.

## Fuera de alcance (Fase B, spec posterior)

- Objetivos múltiples (hipertrofia / grasa / correr / fuerza general).
- Reglas PFPS opcionales (rodilla) según condición del perfil.
- Selección de ejercicios / uso del catálogo por objetivo.
- Ventanas de progresión por objetivo.
- Fase A solo **reserva** `DB.profile.objective`; no ramifica por él.

## Impacto en docs / infra

- `CLAUDE.md`: nueva sección "Multi-perfil" + nota en "Sync Supabase" (UID dinámico).
- `sw.js`: bump de cache.
- Memoria: actualizar `project_supabase_sync` (UID ya no es único fijo).
