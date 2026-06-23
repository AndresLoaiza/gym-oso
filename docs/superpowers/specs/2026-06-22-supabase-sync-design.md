# Migración GitHub Gist → Supabase (gym-oso)

**Fecha:** 2026-06-22
**Estado:** Diseño aprobado
**Objetivo:** Reemplazar el backup/sync por GitHub Gist de gym-oso por sync multi-dispositivo en Supabase, con realtime por fila y autenticación. Reusa el proyecto Supabase existente de la app de viajes (restricción de free tier: máx. 2 proyectos, ya ocupados por la web AltaComedia y la app de viajes).

---

## 1. Contexto

- **gym-oso** (`index.html`): PWA de una sola página, sin frameworks ni build step, servida desde GitHub Pages sobre un **repo público**. Persistencia = un blob JSON (`DB`) en `localStorage` clave `elosoGymV2`. Backup en la nube actual = GitHub Gist privado (`syncToGist`/`restoreFromGist`/`scheduleGistSync`/`mergeRestoredDB`, ver `index.html:295-371`).
- **app de viajes** (`Consulta_Viajes/viajes-app`): React/Vite, Supabase project `gbfxpzsblnrasfvxnquk.supabase.co`. Modelo "privacidad por oscuridad": RLS abierta a la anon key + gate por código de acceso, sin login. Anon key inyectada en build vía GitHub Actions secrets.
- **Restricción:** Supabase free tier = máx. 2 proyectos. Ya usados (web + viajes). → gym-oso **comparte el proyecto de viajes**.

## 2. Decisiones aprobadas

| Decisión | Elección |
|---|---|
| Proyecto Supabase | Compartir el de viajes (`gbfxpzsblnrasfvxnquk`) — restricción free tier |
| Modelo de datos | Normalizado pragmático: tabla por entidad top-level, `jsonb` para lo anidado |
| Sync | Realtime por fila (subscripciones Supabase) |
| Auth | Email+password de Supabase, 1 cuenta, RLS `auth.uid() = user_id` |
| Telemetría | **Queda 100% local** — nunca sincroniza (igual que con Gist) |
| Cliente JS | `@supabase/supabase-js` **vendorizado local** (no CDN) — offline-first |

## 3. Esquema de tablas (prefijo `gym_`)

Todas keyed por `user_id uuid` = `auth.uid()`. Prefijo `gym_` evita colisión con las tablas del viaje en el proyecto compartido.

| Tabla | Filas | Columnas | Realtime |
|---|---|---|---|
| `gym_profile` | 1 | `user_id`, `data jsonb` (peso, estatura, edad, knee, baseline), `updated_at` | sí (raro) |
| `gym_plan` | 1 | `user_id`, `data jsonb` (`start`, `weeks`, `generatedBy`), `updated_at` | sí |
| `gym_sessions` | N (1×sesión) | `id uuid`, `user_id`, `data jsonb` (date, exercises, planRef, kneeStatus, note), `created_at` | **sí — caso fuerte**: sesión nueva en un equipo aparece en el otro |
| `gym_active_session` | 1 | `user_id`, `data jsonb` (`sessionSets` + flags `_currentRef`/`_kneeStatus`/`_adaptedSession`/`_sessionNote`), `updated_at` | sí (sync mid-workout) |
| `gym_settings` | 1 | `user_id`, `data jsonb` (`wake`, `autoProgress`, `telemetry`), `updated_at` | sí |

**Notas de schema:**
- `REPLICA IDENTITY FULL` en todas (necesario para DELETE realtime con filtro — convención del proyecto de viajes).
- Añadir las 5 tablas a `publication supabase_realtime`.
- `telemetry` **no** tiene tabla: se queda en `localStorage` (puede pesar 100KB+, sin valor sincronizar).
- Campos `settings.githubSync`/`githubToken`/`gistId` se **eliminan** del modelo (migran a config Supabase / desaparecen).

## 4. RLS

```sql
alter table gym_profile enable row level security;
-- (idem para las otras 4)

create policy "own rows" on gym_profile
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

→ Solo el usuario autenticado lee/escribe sus filas. La anon key pública **no** da acceso a `gym_*` sin login. Las tablas del viaje (RLS abierta) no se tocan.

## 5. Auth

- Email+password de Supabase. **1 cuenta** (la de Andrés).
- Pantalla de login mínima (modal `openModal` o pantalla dedicada), mostrada cuando no hay sesión Supabase activa. Una vez por dispositivo (sesión persiste vía `supabase-js` en `localStorage`, auto-refresh de token).
- Sin signup público — la cuenta se crea una vez (manual en dashboard o primer signup, luego deshabilitar signups si se quiere endurecer).
- Auth es a nivel de proyecto pero **no afecta a la app de viajes** (que sigue usando anon sin login).

## 6. Capa de código (reemplaza Gist)

- **Cliente:** `vendor/supabase.js` (UMD de `@supabase/supabase-js`) vendorizado, cargado en `index.html`. `createClient(SUPABASE_URL, ANON_KEY)` con ambos valores hardcodeados (URL + anon key del proyecto de viajes).
- **Boot:**
  1. Comprobar sesión Supabase. Sin sesión → pantalla login.
  2. Con sesión → hidratar `DB` desde las tablas `gym_*` (select por `user_id`). Si remoto vacío → primer push desde el `localStorage` local (migración del usuario existente).
  3. Abrir subscripciones realtime a las 5 tablas.
- **`saveDB()`:** mantiene el write a `localStorage` (fuente primaria en sesión). Reemplaza `scheduleGistSync()` por `scheduleSupabaseSync()`: upsert **debounced 4s** de las entidades que cambiaron a sus tablas (`gym_profile`/`gym_plan`/`gym_active_session`/`gym_settings` = upsert de la fila única; `gym_sessions` = insert al finalizar sesión).
- **Realtime inbound:** al recibir cambio de **otro** equipo (ignorar self-echo comparando `updated_at`/origen), actualizar la slice correspondiente de `DB` + re-render. **Last-write-wins** por fila.
- **Eliminar:** `syncToGist`, `restoreFromGist`, `scheduleGistSync`, `mergeRestoredDB`, `syncEnabled`, y la UI de token/gistId en Config (inputs `#github-token`, `#gist-id`, botones sync/restore). Reemplazar por estado de cuenta (logueado como X · cerrar sesión · sincronizar ahora).

## 7. Offline-first (sin regresión)

`localStorage` sigue siendo la **fuente primaria en sesión**. Supabase es capa **aditiva** de backup/sync. Se conservan intactas las 3 redes de durabilidad actuales (CLAUDE.md §Persistencia):
1. `saveDB()` resiliente a `QuotaExceededError` (recorta telemetría).
2. Flush en `visibilitychange`/`pagehide`.
3. Guard anti-pérdida en `renderRutina` (`sessionHasProgress`).

Offline: la app funciona normal (escribe a `localStorage`); los upserts pendientes se reintentan al volver la red. Mismo contrato de durabilidad que da el Gist hoy.

## 8. PWA / Service Worker

- Bump de versión de cache en `sw.js` (`const CACHE = 'oso-gym-vN'`).
- Precachear `vendor/supabase.js`.
- La REST/realtime de Supabase **no** se precachea para datos (online fresco; offline cae a `localStorage`, no a cache de red).

## 9. Seguridad (riesgo asumido al compartir proyecto)

- La anon key compartida ahora también vive en el **repo público** de gym-oso (texto plano). Pero la key **ya es pública**: cualquiera que cargue la app de viajes desplegada la extrae del bundle (view-source). Exposición marginal añadida: indexable por GitHub code-search.
- **Datos de gym:** protegidos por RLS `auth.uid()` → la key pública no los toca sin login. Seguro.
- **Riesgo real:** las tablas **abiertas del viaje** (RLS abierta) quedan algo más fáciles de descubrir. Para datos de viaje personal, riesgo bajo.
- **Mitigación futura (fuera de alcance):** migrar también la app de viajes a auth.

## 10. Costo / alcance

- **Lógica pura (141 tests): intacta** — los tests prueban la forma del objeto `DB` en memoria (`decideBump`, `parseHoldSec`, `applyProgression`…), no el storage.
- Cambian: capa de sync, boot, UI de Config, UI de auth (login), `sw.js` cache, tests de la capa de sync (pocos).
- Setup manual (Andrés, guiado): crear las 5 tablas + RLS + realtime publication + 1 cuenta auth en el dashboard del proyecto de viajes.

## 11. Fuera de alcance

- Normalización relacional completa de `plan.weeks[][]` a nivel de ejercicio (inmanejable, sin valor).
- Migrar la app de viajes a auth.
- Resolución de conflictos más fina que last-write-wins (innecesario para 1 usuario).
- Sincronizar telemetría.
