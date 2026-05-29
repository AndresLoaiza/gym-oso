"""Refina plan basado en sesión real sem 1 día 1 (2026-05-22).
Reglas: ver mensaje del agente. Mantiene baseline intacto.
"""
import json, sys, pathlib, copy

SRC = pathlib.Path(__file__).parent / "elosogym-backup-2026-05-22-23-00.json"
DST = pathlib.Path(__file__).parent / "elosogym-refined-2026-05-23.json"

db = json.loads(SRC.read_text(encoding="utf-8"))

# Mapa por (semana_idx, ex.id) → (peso_nuevo_o_None, nota_opcional)
# Las semanas son 0-indexadas. Días: 0=pierna, 1=tren sup, 2=trekking.
def bump_prensa(week_idx, ex):
    # Sem 1-2 (idx 0,1): adapt 12reps → 40kg
    # Sem 3-5 (idx 2,3,4): str 6reps → 52.5kg
    # Sem 6-7 (idx 5,6): end 15reps → 42.5kg
    # Sem 8  (idx 7): taper 10reps → 42.5kg
    if week_idx in (0,1):   ex["weight"] = 40
    elif week_idx in (2,3,4): ex["weight"] = 52.5
    elif week_idx in (5,6): ex["weight"] = 42.5
    elif week_idx == 7:     ex["weight"] = 42.5

def bump_legext(week_idx, ex):
    ex["weight"] = 15  # todas las semanas

def bump_pantorrilla(week_idx, ex):
    ex["weight"] = 40

def bump_pronecurl(week_idx, ex):
    # Sem 1 ya hecho a 20 (datos), sem 2+ → 22.5
    if week_idx >= 1:
        ex["weight"] = 22.5

REFINE = {
    "leg_press_45":       bump_prensa,
    "leg_ext":            bump_legext,
    "pantorrilla_sentado":bump_pantorrilla,
    "prone_leg_curl":     bump_pronecurl,
}

weeks = db["plan"]["weeks"]
for wi, week in enumerate(weeks):
    for day in week:
        for ex in day.get("exercises", []):
            fn = REFINE.get(ex["id"])
            if fn:
                fn(wi, ex)

# Marca evolución en notes del día 1 sem 1 (referencia)
weeks[0][0]["notes"] += " | Refinado 2026-05-22: pesos sem 1-2 ajustados según sesión real (40/15/40)."

# Timestamp de export refinado
db["lastExport"] = "2026-05-22T23:30:00.000Z"

DST.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"OK -> {DST}")
print(f"Sesiones preservadas: {len(db['sessions'])}")
print(f"Baseline intacto: legPress1RM={db['profile']['baseline']['legPress1RM']}")
