# Improvements — App Gym (El Oso Gym)

## Contexto
PWA single-file HTML+JS. Plan 8 semanas PFPS-safe. Doble progresión. Telemetría local. 39 tests pasando. Desplegada en GitHub Pages.

---

## Mejoras por prioridad

### 🔴 Alta prioridad

#### ~~1. Sincronización de backup (GitHub Gist)~~ ✅ HECHO (2026-06-03)
GitHub Gist fire-and-forget implementado en `saveDB()`. Toggle en Config. `restoreFromGist()` para dispositivo nuevo. Telemetría excluida del sync.

**Solución B (automática):** Supabase tier gratis. En `saveDB()`, agregar sync opcional.

```javascript
async function syncToSupabase(db) {
  if (!DB.settings.supabaseSync || !DB.settings.supabaseKey) return;
  await fetch(`${SUPABASE_URL}/rest/v1/gym_data`, {
    method: 'POST',
    headers: {
      'apikey': DB.settings.supabaseKey,
      'Authorization': `Bearer ${DB.settings.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ id: DB.settings.userId, data: db })
  });
}
```

Toggle en Config: `☁️ Sync automático (Supabase)`. Off por defecto.

---

#### 2. Recordatorios push
**Problema:** no hay recordatorio de "tienes sesión hoy". El usuario tiene que acordarse.  
**Solución:** Web Push API + service worker. Requiere un servidor mínimo para guardar subscriptions y mandar el push (puede ser un script en GitHub Actions con una cron).

```javascript
// sw.js — agregar:
self.addEventListener('push', (e) => {
  const d = e.data?.json() ?? {};
  self.registration.showNotification(d.title ?? 'El Oso Gym', {
    body: d.body ?? 'Tienes sesión hoy 💪',
    icon: '/icons/icon-192.png',
    tag: 'gym-reminder'
  });
});
```

Alternativa más simple: iOS Shortcuts automático que abra la app a la hora configurada.

---

### 🟡 Media prioridad

#### 3. Correlación knee vs progreso
**Problema:** no hay datos visuales de si la molestia leve realmente frena el progreso.  
**Solución:** nueva gráfica en Historial — scatter plot `kneeStatus × weight_progression`.

```javascript
function renderKneeProgressCorrelation() {
  const byKnee = { bien: [], leve: [], dolor: [] };
  DB.sessions.forEach(s => {
    const rate = calcProgressRate(s);  // peso ganado respecto al plan
    if (s.kneeStatus) byKnee[s.kneeStatus].push(rate);
  });
  // Chart.js: box plot o violin plot por categoría de rodilla
  // Responde: "con molestia leve progreso X% menos que con rodilla bien"
}
```

---

#### 4. Warm-up guiado pre-sesión PFPS
5 ejercicios de activación antes de cada sesión. Especialmente relevante para rodillas.

```javascript
const WARMUP_PFPS = [
  { name: 'Activación VMO', desc: 'Pared, doblar rodilla 0-30°, 10 reps × 2', time: 90 },
  { name: 'Clam shells',    desc: 'Tumbado lateral, abrir rodillas, 15 reps', time: 60 },
  { name: 'Quad sets',      desc: 'Tumbado, contraer cuádriceps 5s, 10 reps', time: 60 },
  { name: 'Bici estática',  desc: '5 min nivel 1, sin resistencia', time: 300 },
  { name: 'Glute bridges',  desc: '10 reps lentas, pausa 2s arriba', time: 90 },
];
// Modal antes del check-in de rodilla: "¿Quieres hacer warm-up? (5 min, recomendado)"
```

---

#### 5. Modo deload automático
Después de 4 semanas completadas sin interrupción, sugerir una semana de descarga (-30% volumen):

```javascript
function shouldSuggestDeload() {
  const consecutive = countConsecutiveCompletedWeeks(DB.sessions);
  return consecutive >= 4 && !DB.plan.deloadDone;
}
// Si true → modal: "Completaste 4 semanas seguidas. ¿Hacer semana de descarga? (científicamente recomendado)"
// Si acepta → generateDeloadWeek(): mismos ejercicios, -1 set por ejercicio, -20% peso
```

---

#### 6. Análisis automático de telemetría
**Problema:** hay que exportar el JSON manualmente y pasarlo a Claude. Fricción alta.  
**Solución:** botón "Analizar con IA" en Config que construye un resumen del JSON (no mandar 120KB completos) y llama a un endpoint local.

```javascript
async function analyzeTelemetry() {
  const summary = {
    totalSessions: DB.sessions.length,
    avgDuration: avg(DB.telemetry.events.filter(e => e.type === 'session_finish').map(e => e.durSec)),
    topHowtos: topN(DB.telemetry.events.filter(e => e.type === 'howto_open'), 'exId', 5),
    kneeDist: countBy(DB.telemetry.events.filter(e => e.type === 'knee_check'), 'status'),
    abandonRate: ...,
    topEdits: topN(DB.telemetry.events.filter(e => e.type === 'set_edit'), 'exId', 5),
  };
  // Llamar endpoint local o abrir ventana con el JSON formateado + prompt para Claude
}
```

---

#### 7. Compartir sesión como imagen
Modal post-sesión con botón "Compartir logro" → canvas 1080x1080 con stats + mascota El Oso.

```javascript
function generateShareImage(session) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  // Fondo oscuro + acento lila
  // Texto: "Día A — Piernas | Sem 3" + sets completados + PR si aplica
  // Mascota El Oso (dumbbell)
  canvas.toBlob(blob => {
    navigator.share({ files: [new File([blob], 'gym-session.png', { type: 'image/png' })] });
  });
}
```

---

### 🟢 Baja prioridad

#### 8. Plan auto-extendible semana 9+
Al terminar las 8 semanas, en vez de resetear al onboarding, ofrecer "Modo mantenimiento":
- Mismos ejercicios
- Volumen -20% (una sesión menos por semana)
- Pesos = lo que el usuario llegó al final de la semana 8
- Sin periodización de fases, indefinido hasta que el usuario reinicie

#### 9. RPE (esfuerzo percibido) por serie
Campo opcional (1-10) en cada set. Ayuda a detectar sobreentrenamiento y a calibrar si el usuario está muy cerca del fallo (>9 RPE sostenido = señal de alerta para PFPS).

#### 10. Integración Senderismo → App Gym
Cuando se marca una ruta como "hecha" en la app Senderismo, ofrecer crear automáticamente una sesión de cardio en App Gym con duración = duración de la ruta y tipo = StairMaster/caminata.

---

## Rutinas locales nuevas

| Script | Trigger | Acción |
|--------|---------|--------|
| Análisis mensual | Manual desde Config | Exporta telemetría → Claude analiza → top 3 fricciones UX |

## Notas técnicas
- Bump `sw.js` cache version al cambiar `index.html` o `elosogym.css`
- Tests con `node tests/test.js` antes de cualquier commit
- Todo en español. Funciones camelCase. `saveDB()` después de cada mutación.
