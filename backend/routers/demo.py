import json
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from vitals_engine.simulator import simulator
from vitals_engine.scenarios import SCENARIOS

router = APIRouter()


class SetScenarioRequest(BaseModel):
    patient_id: str
    scenario_key: str


class TriggerAlertRequest(BaseModel):
    patient_id: str
    alert_type: str = "yellow"
    message: str = "Demo alert triggered"


class SpikeVitalsRequest(BaseModel):
    patient_id: str
    metric: str = "heart_rate"
    delta: float = 20.0


@router.get("/scenarios")
def list_scenarios():
    return [
        {
            "key": key,
            "label": scenario["label"],
            "description": scenario["description"],
            "risk_score": scenario["risk_score"],
            "has_alert": scenario["alert"] is not None,
            "alert_type": scenario["alert"]["type"] if scenario["alert"] else None,
        }
        for key, scenario in SCENARIOS.items()
    ]


@router.post("/set-scenario")
async def set_scenario(request: SetScenarioRequest):
    try:
        simulator.set_scenario(request.patient_id, request.scenario_key)
        scenario = SCENARIOS[request.scenario_key]

        event = {
            "type": "scenario_change",
            "patient_id": request.patient_id,
            "scenario_key": request.scenario_key,
            "scenario_label": scenario["label"],
            "risk_score": scenario["risk_score"],
            "alert": scenario.get("alert"),
        }
        await simulator.broadcast_demo_event(event)

        if scenario.get("alert"):
            await simulator.broadcast_alert(request.patient_id, {
                "type": "alert",
                "patient_id": request.patient_id,
                **scenario["alert"],
            })

        return {"success": True, "scenario": request.scenario_key, "label": scenario["label"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trigger-alert")
async def trigger_alert(request: TriggerAlertRequest):
    alert = {
        "type": "alert",
        "patient_id": request.patient_id,
        "alert_type": request.alert_type,
        "message": request.message,
    }
    await simulator.broadcast_alert(request.patient_id, alert)
    await simulator.broadcast_demo_event({
        "type": "alert_triggered",
        "patient_id": request.patient_id,
        **alert,
    })
    return {"success": True}


@router.post("/spike-vitals")
async def spike_vitals(request: SpikeVitalsRequest):
    event = {
        "type": "vitals_spike",
        "patient_id": request.patient_id,
        "metric": request.metric,
        "delta": request.delta,
    }
    await simulator.broadcast_demo_event(event)
    return {"success": True}


@router.websocket("/events")
async def demo_events_stream(websocket: WebSocket):
    await websocket.accept()
    queue = asyncio.Queue()
    simulator.register_demo_client(queue)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30)
                await websocket.send_text(msg)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"ping": True}))
    except WebSocketDisconnect:
        pass
    finally:
        simulator.unregister_demo_client(queue)
