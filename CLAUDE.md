# El Oso Gym — CLAUDE.md

## Contexto del proyecto

App web móvil de entrenamiento para **Andrés “El Oso” Loaiza**, ingeniero de datos y comediante de stand-up en Medellín. El objetivo principal es preparación física para **trekkings de montaña nivel 4** en 1-2 meses.

El archivo principal es `index.html` — toda la app vive en un solo archivo HTML/CSS/JS.

-----

## Usuario

- **Nivel:** Principiante en gimnasio
- **Frecuencia:** 2-3 días por semana
- **Limitación física:** Molestia en rodilla → priorizar cuádriceps
- **Objetivo:** Resistencia cardiovascular y fuerza funcional para trekking nivel 4
- **Dispositivo principal:** Celular (la app debe funcionar perfectamente en móvil)
- **Idioma:** Todo en español

-----

## Stack

- **Un solo archivo:** `index.html` con HTML + CSS + JS inline
- **Sin frameworks ni bundlers** — debe correr directo en el navegador sin build steps
- **Fuentes:** Google Fonts (Bebas Neue, DM Sans, DM Mono)
- **IA:** Anthropic API (`claude-sonnet-4-20250514`) llamada desde el frontend
- **Persistencia:** `localStorage` con clave `elosoGym`
- **Deploy:** GitHub Pages → la URL pública es lo que el usuario abre en el celular

-----

## Estructura del localStorage

```json
{
  "sessions": [
    {
      "date": "ISO string",
      "exercises": [
        {
          "id": "leg_press",
          "name": "Leg Press",
          "muscle": "Cuádriceps · Glúteos",
          "sets": [{ "reps": 15, "weight": 30, "done": true }],
          "setsTarget": 3,
          "weight": 30,
          "isCardio": false
        }
      ]
    }
  ],
  "currentRoutine": [],
  "sessionSets": {}
}
```

-----

## Funcionalidades implementadas

### 📷 Pestaña Escanear

- Usuario toma foto de una máquina
- Se envía a Claude Vision (Anthropic API) con prompt especializado
- Claude devuelve JSON con: nombre, músculos, series, reps, peso inicial, tip técnico, beneficio para trekking, regla de progresión
- Se compara con historial: si completó todas las series la última vez → sugiere subir 2.5kg
- Botón para agregar la máquina a la rutina del día

### 💪 Pestaña Rutina

- Lista de máquinas del día con acordeón expandible
- Por cada máquina: inputs de kg y reps por serie, botón para marcar serie como completada
- Botón “Agregar serie” por máquina
- Barra de progreso global (series completadas / total)
- Timer de descanso con vibración al terminar (1, 1:30, 2, 3 min)
- Rutina predeterminada para trekking (7 ejercicios)
- Botón “Finalizar sesión” → guarda en historial y limpia sessionSets

### 📊 Pestaña Historial

- Stats: sesiones totales, series totales
- Lista de sesiones con fecha, ejercicios, peso máximo y reps promedio
- Borrar historial completo con confirmación

-----

## Rutina predeterminada (RUTINA_TREKKING)

|Ejercicio              |Series|Reps|Peso inicial|Prioridad       |
|-----------------------|------|----|------------|----------------|
|Leg Press              |3     |15  |30kg        |🔴 Alta (rodilla)|
|Extensión de Cuádriceps|3     |12  |15kg        |🔴 Alta (rodilla)|
|Curl Femoral           |3     |12  |15kg        |🟡 Media         |
|Abductor de Cadera     |3     |15  |20kg        |🟡 Media         |
|Remo en Polea Baja     |3     |12  |20kg        |🟡 Media         |
|Press de Hombros       |3     |12  |10kg        |🟢 Baja          |
|Elíptica/Bicicleta     |—     |—   |cardio      |🟡 Media         |

-----

## Reglas de progresión de peso

- Si completó **todas las series** en la última sesión → sugerir `+2.5kg`
- Si no completó todas → mantener el mismo peso
- El peso sugerido aparece pre-cargado en los inputs de la rutina
- La función clave es `getBestForMachine(machineId)` → busca la sesión más reciente con ese ejercicio

-----

## Prompt del sistema para reconocimiento de máquinas

El prompt está en la función `analyzeMachine()`. Contexto clave que debe mantener:

- Usuario principiante
- Molestia en rodilla → fortalecer cuádriceps
- Objetivo: trekking nivel 4 en 1-2 meses
- Responde **solo JSON válido**, sin backticks ni texto adicional
- Pesos en kg para principiante

-----

## Diseño y UX

- **Tema:** Dark, industrial, bold
- **Colores:** fondo `#0a0a0a`, acento `#e8ff47` (amarillo neón), acento2 `#ff6b35` (naranja)
- **Tipografía:** Bebas Neue (títulos/números), DM Sans (cuerpo), DM Mono (datos/labels)
- **Mobile-first:** max-width 430px, sin zoom, tap targets grandes
- **Nav fija** en la parte superior con 3 pestañas

-----

## Convenciones de código

- Todo en español (UI, comentarios, variables descriptivas)
- Funciones nombradas en camelCase descriptivo: `renderRutina`, `finalizarSesion`, `getBestForMachine`
- `saveDB()` se llama después de cada mutación del estado
- `DB` es el objeto global de estado, sincronizado con localStorage
- No usar `alert()` para cosas importantes → usar modales ya implementados

-----

## Próximas mejoras sugeridas

- [ ] Sincronización en la nube (Supabase o Firebase) para no depender de localStorage
- [ ] Gráfico de progreso de peso por ejercicio en el historial
- [ ] Modo “sesión activa” que evita que la pantalla se apague
- [ ] Notificación push cuando termina el descanso (requiere service worker)
- [ ] Exportar historial como CSV
- [ ] Selector de días de entrenamiento con plan semanal
- [ ] Peso corporal y métricas de condición física

-----

## Deploy

- **Repo:** `gym-oso` en GitHub
- **Branch principal:** `main`
- **Deploy:** GitHub Pages desde `main` / `root`
- **URL:** `https://[usuario].github.io/gym-oso`
- El celular apunta a esa URL guardada como acceso directo en la pantalla de inicio

-----

## Cómo trabajar en este proyecto

```bash
# Clonar
git clone https://github.com/[usuario]/gym-oso.git
cd gym-oso

# Editar — todo está en index.html
# Previsualizar localmente con Live Server (VS Code) o:
python3 -m http.server 8080

# Subir cambios
git add index.html
git commit -m "descripción del cambio"
git push origin main
# GitHub Pages se actualiza en ~1 minuto
```