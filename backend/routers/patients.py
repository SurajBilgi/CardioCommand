import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from vitals_engine.simulator import simulator
from vitals_engine.scenarios import SCENARIOS

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent / "data" / "patients.json"


def _load_patients() -> list:
    return json.loads(_DATA_PATH.read_text())["patients"]


def _get_patient(patient_id: str) -> dict:
    patients = _load_patients()
    for p in patients:
        if p["id"] == patient_id:
            return p
    raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")


@router.get("")
def list_patients():
    patients = _load_patients()
    result = []
    for p in patients:
        current = simulator.get_current(p["id"])
        p_copy = dict(p)
        p_copy["current_vitals"] = current
        p_copy["risk_score"] = current.get("risk_score", 0)
        p_copy["alert"] = current.get("alert")
        p_copy["active_scenario"] = simulator.get_scenario(p["id"])
        result.append(p_copy)
    return result


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    p = _get_patient(patient_id)
    current = simulator.get_current(patient_id)
    p["current_vitals"] = current
    p["risk_score"] = current.get("risk_score", 0)
    p["alert"] = current.get("alert")
    p["active_scenario"] = simulator.get_scenario(patient_id)
    return p


@router.get("/locations")
def get_all_locations():
    """Snapshot of all patient locations + vitals for map initialisation."""
    patients = _load_patients()
    result = []
    for p in patients:
        current = simulator.get_current(p["id"])
        result.append({
            "id": p["id"],
            "name": p["name"],
            "photo_initials": p["photo_initials"],
            "surgery_type": p["surgery_type"],
            "days_post_op": p["days_post_op"],
            "home_location": p.get("home_location", {}),
            "location": current.get("location", {}),
            "risk_score": current.get("risk_score", 0),
            "alert": current.get("alert"),
            "heart_rate": current.get("heart_rate"),
            "spo2": current.get("spo2"),
            "active_scenario": simulator.get_scenario(p["id"]),
        })
    return result


@router.get("/{patient_id}/timeline")
def get_timeline(patient_id: str):
    _get_patient(patient_id)
    scenario_key = simulator.get_scenario(patient_id)
    scenario = SCENARIOS.get(scenario_key, {})
    alert = scenario.get("alert")

    timeline = []

    if alert:
        timeline.append({
            "id": "a1",
            "type": "alert",
            "icon": "🤖",
            "label": "AI Analysis Complete",
            "detail": alert["message"],
            "time": "09:41am",
            "day": f"Day {scenario.get('day', 1)}",
        })

    timeline.append({
        "id": "a2",
        "type": "vitals_sync",
        "icon": "❤️",
        "label": "Wearable Sync",
        "detail": f"HR {scenario.get('vitals', {}).get('heart_rate', {}).get('base', '—')}bpm · "
                  f"SpO₂ {scenario.get('vitals', {}).get('spo2', {}).get('base', '—')}% · "
                  f"Steps: {scenario.get('vitals', {}).get('steps_today', {}).get('base', '—')}",
        "time": "07:15am",
        "day": f"Day {scenario.get('day', 1)}",
    })

    timeline.append({
        "id": "a3",
        "type": "chat",
        "icon": "💬",
        "label": "Patient Message via Cora",
        "detail": "\"Feeling very tired, slight chest soreness\" → Flagged for review",
        "time": "02:30pm",
        "day": f"Day {max(1, scenario.get('day', 1) - 1)}",
    })

    timeline.append({
        "id": "a4",
        "type": "discharge",
        "icon": "🏥",
        "label": "Discharged from Hospital",
        "detail": "Post-operative care plan activated. Remote monitoring initiated.",
        "time": "10:00am",
        "day": "Day 1",
    })

    return timeline
