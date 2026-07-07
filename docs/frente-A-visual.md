# Frente A — Visual (spec pendiente)

> Especificación para la próxima sesión. Los frentes C (coach adaptativo) y B1/B2/B3/B4
> ya están implementados (ver context.md §11b-11e). Este doc define el frente visual
> que quedó fuera del alcance de esa sesión. Restricción global: single-file, presupuesto
> de KB, dark + lila `#c4a7ff`, mobile-first 480px, nada decorativo que pese.

## A1 — Home como panel de progreso real

Hoy el home muestra card "Hoy" + 3 stats (sesiones/series/semanas). Agregar:

1. **Racha de sesiones**: sesiones en los últimos 14 días vs frecuencia objetivo (2-3/sem).
   Pure fn `sessionStreak(sessions, nowISO)` → `{ last14: n, streakWeeks: m }` (semanas
   consecutivas con ≥2 sesiones). Mostrar como stat extra o en el badge del header
   (hoy dice "Sem X/8" — puede alternar).
2. **Volumen semanal vs semana pasada**: `weeklyVolume(sessions, nowISO)` →
   `{ thisWeek, lastWeek }` usando `sessionVolume()` (ya existe). Mostrar delta con flecha
   ↑/↓ y color (verde/gris — nunca rojo, no es fallo).
3. **Mini-sparkline 1RM estimado** de los 3 compuestos base (prensa/banca/pulldown):
   `est1RMSeries(sessions, exId)` → puntos `epley1RM(topW, topReps)` por sesión (fórmula
   híbrida ya existe). Render: SVG inline generado por JS (polyline 60×20px), NO Chart.js
   en home (Chart.js solo carga su canvas en Hist). 3 sparklines en fila con label + último valor.
4. **Estado de rodilla últimos 14 días**: fila de puntos (verde/amarillo/rojo) desde
   `kneeStatus` (pre) y `postKnee` (24h) por sesión. Pure fn `kneeTimeline(sessions, nowISO, days=14)`
   → array `{date, worst}` (worst de pre/post). Puntos de 10px, tooltip con fecha via `title`.

Tests: `sessionStreak`, `weeklyVolume`, `est1RMSeries`, `kneeTimeline` (casos: vacío,
límite de semana, worst pre vs post).

## A2 — Gráficas de progreso más expertas (Historial)

Además de peso máx / reps prom actuales:

1. **1RM estimado en el tiempo**: dataset extra en `drawChart` con `epley1RM(top, repsAtTop)`.
   Ojo: usar las reps del top set, no reps prom.
2. **Volumen semanal por grupo muscular**: agrupar `muscleTokens(CATALOGO[id].muscle)` →
   volumen (`reps×peso` done) por semana ISO. Selector de vista (por ejercicio / por músculo).
   Chart bar apilado o líneas — mantener 2 ejes máx.
3. **Comparativa L vs R en unilaterales**: para `crossover`, `mancuernas`, `remo_isolateral`:
   `asymmetry(sessions, exId)` → serie `{date, L: topW×reps, R: topW×reps, pct}`.
   **Flag visual si asimetría >15%** (relevante trekking: pierna débil = riesgo en descenso).
   Mostrar badge naranja en el selector + línea de referencia.

Tests: `asymmetry` (sin sides → null, asimetría 20% → flag, lados iguales → 0%).

## A3 — Jerarquía visual en sesión activa

1. **Card del ejercicio actual domina**: el primer ejercicio no completado lleva clase
   `.current` (borde lila 2px + fondo `--surface2` levemente más claro); los demás no
   colapsados bajan a opacity 0.75. Ya existe auto-colapso de completados — esto es el
   paso siguiente: atenuar los pendientes no actuales.
2. **Chips tempo/descanso más prominentes en `.current`**: subir a font-size 13px,
   padding 8px 12px, touch target ≥44px (se consultan a mitad de serie con manos ocupadas).
3. Implementación CSS pura en `elosogym.css` (`.card.current .chip {...}`) + 1 línea JS
   en `renderRutinaInner` para asignar `.current` (y re-asignar al completar card).
   Recordar: cambios en elosogym.css también requieren bump de `CACHE` en sw.js.

## A4 — Identidad / pulido

- Revisar jerarquía tipográfica: h2/h3 de cards vs chips (hoy compiten). Bebas Neue solo
  para títulos de pantalla, DM Sans pesos 500/700 para cards.
- Espaciado: unificar `margin-top` de cards (hoy mezcla 8/10/12/14px inline) → tokens
  `--sp-2/3/4` ya existen en `:root`.
- Estados vacíos: Historial sin sesiones y Catálogo sin resultados de búsqueda merecen
  estado vacío con oso `rest` pequeño + texto guía (REGLA: oso solo en estados positivos
  — "aún no hay sesiones" es neutral-positivo, OK; "error" no).
- Nada de imágenes nuevas; reusar `BEARS_PNG`.

## B5 — Preparación trekking medible (también pendiente)

Sección "¿qué tan listo estoy para nivel 4?" con indicadores proxy + umbral objetivo.
Requiere investigación con fuentes (demanda física trekking nivel 4: desnivel ~1000-1500m+,
6-8h, mochila 8-12kg) antes de fijar umbrales. Indicadores candidatos desde datos existentes:
- Progresión StairMaster: nivel × minutos (telemetría + reps string del plan).
- Step-up: carga × reps por pierna (proxy de ascenso con mochila).
- Cadena posterior: volumen RDL + prone curl (proxy de descenso/estabilidad).
- Resistencia: minutos Z2 semanales (trotadora + stairmaster).
Definir umbrales con fuentes (ACSM, literatura trekking/hiking readiness) y mostrar
barras de progreso por indicador. Todo pure functions + tests.
