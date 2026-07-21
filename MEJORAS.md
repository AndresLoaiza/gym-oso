# MEJORAS — App_gym (gym-oso)

> PWA single-file de entrenamiento PFPS-safe para trekking nivel 4. Coach adaptativo
> (Frente C) completo, 216 tests. Pendiente principal: Frente A visual (spec ya escrita).
> Prompts listos para pegar en Claude Code (Fable 5) desde esta carpeta.

---

## 1. Frente A — Home como panel de progreso [PLAN]

```
Ejecuta la spec completa que ya está en docs/frente-A-visual.md:
- Home como panel de progreso: racha, volumen semanal, sparklines de 1RM,
  timeline de rodilla de 14 días.
- Gráficas expertas: 1RM en el tiempo, volumen por músculo, flag de asimetría
  L/R >15% en ejercicios unilaterales.
- Jerarquía visual en sesión activa y pulido de identidad (acento #c4a7ff).

Reglas duras del proyecto: single-file index.html, mobile-first 480px, localStorage
elosoGymV2 primario, toda interacción crítica con openModal (iOS no soporta confirm/
alert), Chart.js ya disponible. Entra en plan mode primero, divide en tareas y
ejecútalas con subagentes. Actualiza tests/test.js con cada función pura nueva y
corre `node tests/test.js` antes de cada commit (regla del repo: SIEMPRE).
```

## 2. B5 — Preparación trekking medible

```
La spec de frente-A menciona B5: indicador "qué tan listo estoy para trekking nivel 4"
con umbrales por investigar. Investiga umbrales evidence-based (fuerza relativa de
prensa/peso corporal, resistencia de sóleo, wall-sit isométrico, capacidad StairMaster
Z2 sostenida — busca literatura de hiking readiness + PFPS) y propón un score 0-100
computado del historial real. Mostrarlo en home con desglose por componente y qué
falta para subir. Todo determinista y local (sin IA en runtime, regla del proyecto).
Documenta cada umbral con su fuente en el modal "¿por qué?" (patrón COACH_RULES).
```

## 3. Cerrar catálogo de máquinas

```
Quedan 8 máquinas del catálogo sin confirmar (pendiente refotografiar). Cuando estén
las fotos en photos/: procesarlas con gen_thumbs.py, agregar entradas al CATALOGO con
tags PFPS + HOWTO + TEMPO + EX_TYPE (mismo estándar de las 25 existentes, evidencia
citada), y actualizar los tests de integridad de catálogo. Si alguna máquina habilita
un ejercicio mejor para VMO o cadena posterior que los actuales, proponer el swap en
el plan generator con su justificación científica.
```

## 4. Análisis de telemetría acumulada

```
La telemetría UX local lleva meses acumulando eventos (cap 2000 FIFO + backup en
Supabase). Escribe scripts/analyze_telemetry.py que lea el export JSON y responda:
qué HOWTO/glosario se abren más (conceptos confusos), qué ejercicios tienen más
edits de peso (defaults desalineados), dónde ocurren abandons de sesión (friction),
y duración real vs estimada por día de plan. Salida: reporte markdown con las 5
mejoras de UX más justificadas por datos. No cambies la app todavía — solo el análisis.
```

## 5. Integración con Senderismoso

```
Diseña la integración bidireccional mínima con la app de senderismo (proyecto
D:\ANDRES\Claude_Projects\Senderismo, mismo patrón PWA):
- Una caminata registrada (GPX importado) cuenta como sesión de cardio en el
  historial del gym y alimenta el deload/fatiga del coach.
- El score B5 de preparación (mejora #2) se muestra junto al warning PFPS de cada
  ruta nivel ≥4 del catálogo.
Canal: ambas apps ya comparten proyecto Supabase — define tabla puente o lectura
cruzada, sin acoplar los repos. Propón el contrato antes de tocar código.
```
