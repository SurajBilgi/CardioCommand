import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from vitals_engine.simulator import simulator

router = APIRouter()


@router.websocket("/stream/{patient_id}")
async def vitals_stream(websocket: WebSocket, patient_id: str):
    await websocket.accept()
    try:
        async for reading in simulator.stream(patient_id):
            await websocket.send_text(reading)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@router.websocket("/alerts/stream/{patient_id}")
async def alerts_stream(websocket: WebSocket, patient_id: str):
    import asyncio
    await websocket.accept()
    queue = asyncio.Queue()
    simulator.register_alert_client(patient_id, queue)
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
        simulator.unregister_alert_client(patient_id, queue)


@router.get("/{patient_id}/history")
def get_vitals_history(patient_id: str, n: int = Query(default=240, ge=1, le=2400)):
    return simulator.get_history(patient_id, n)


@router.get("/{patient_id}/current")
def get_current_vitals(patient_id: str):
    return simulator.get_current(patient_id)
