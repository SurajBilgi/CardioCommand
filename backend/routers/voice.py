"""
Voice API Router
================
Endpoints:
  GET  /voice/script                    → returns the full editable script config
  POST /voice/analyze-call              → GPT-4o transcript analysis
  POST /voice/vapi/assistant-config     → returns Vapi inline assistant config for browser SDK
  POST /voice/vapi/call                 → initiate Vapi outbound phone call
  GET  /voice/vapi/call/{call_id}       → poll call status + transcript (phone calls)
  POST /voice/twilio/call               → initiate real Twilio outbound call (legacy)
  GET  /voice/twilio/twiml              → Twilio webhook: opening TwiML
  POST /voice/twilio/gather             → Twilio webhook: per-question gather
"""

import os
import uuid
from typing import Optional
from fastapi import APIRouter, Request, Query
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

from voice.config import VOICE_SCRIPT
from voice.analysis import analyze_transcript
from voice import twilio_handler
from voice import vapi_handler

router = APIRouter()

# In-memory session store (keyed by session_id)
# Each session: { patient, transcript: [], q_index: int }
_sessions: dict[str, dict] = {}


# ── Schema models ────────────────────────────────────────────────────────────

class TranscriptEntry(BaseModel):
    speaker: str          # "agent" | "patient"
    text: str
    question_id: Optional[str] = None

class AnalyzeRequest(BaseModel):
    patient: dict
    transcript: list[TranscriptEntry]
    current_vitals: Optional[dict] = None

class TwilioCallRequest(BaseModel):
    patient_id: str
    patient_phone: str
    patient: dict

class VapiAssistantConfigRequest(BaseModel):
    patient: dict
    mode: Optional[str] = "outbound"   # "outbound" | "inbound"

class VapiPhoneCallRequest(BaseModel):
    patient: dict
    patient_phone: str


# ── Script config ────────────────────────────────────────────────────────────

@router.get("/script")
def get_script():
    """Return the full voice script config so the frontend can render it."""
    return VOICE_SCRIPT


# ── Post-call analysis ───────────────────────────────────────────────────────

@router.post("/analyze-call")
async def analyze_call(req: AnalyzeRequest):
    transcript_dicts = [t.model_dump() for t in req.transcript]
    result = await analyze_transcript(
        transcript=transcript_dicts,
        patient=req.patient,
        current_vitals=req.current_vitals,
    )
    return result


# ── Vapi: assistant config (used by browser Web SDK + vapi.start()) ──────────

@router.post("/vapi/assistant-config")
async def vapi_assistant_config(req: VapiAssistantConfigRequest):
    """
    Returns the inline Vapi assistant configuration for this patient.
    mode='outbound' → structured wellness check (doctor-initiated script)
    mode='inbound'  → open-ended supportive listener (patient called Cora)
    """
    if req.mode == "inbound":
        config = vapi_handler.build_inbound_assistant_config(req.patient)
    else:
        config = vapi_handler.build_assistant_config(req.patient)
    return {"config": config}


# ── Vapi: initiate real outbound phone call ───────────────────────────────────

@router.post("/vapi/call")
async def vapi_phone_call(req: VapiPhoneCallRequest):
    """Create a Vapi assistant then dial the patient's phone number."""
    # Step 1: create assistant
    assistant_result = await vapi_handler.create_assistant(req.patient)
    if not assistant_result["success"]:
        return {"success": False, "error": assistant_result["error"]}

    # Step 2: place the call
    call_result = await vapi_handler.initiate_phone_call(
        patient_phone=req.patient_phone,
        assistant_id=assistant_result["assistant_id"],
    )
    call_result["assistant_id"] = assistant_result["assistant_id"]
    return call_result


# ── Vapi: poll call status / get transcript after phone call ──────────────────

@router.get("/vapi/call/{call_id}")
async def vapi_get_call(call_id: str):
    """Poll call status and retrieve transcript for a completed Vapi phone call."""
    call_data = await vapi_handler.get_call(call_id)
    if not call_data:
        return JSONResponse(status_code=404, content={"error": "Call not found or VAPI_API_KEY missing"})

    transcript = vapi_handler.extract_transcript_from_vapi_call(call_data)
    return {
        "call_id": call_id,
        "status": call_data.get("status"),
        "duration": call_data.get("endedAt"),
        "transcript": transcript,
    }


# ── Twilio: initiate outbound call ───────────────────────────────────────────

@router.post("/twilio/call")
async def twilio_initiate_call(req: TwilioCallRequest, request: Request):
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "patient": req.patient,
        "transcript": [],
        "q_index": 0,
    }

    base_url = os.getenv("PUBLIC_BASE_URL", str(request.base_url).rstrip("/"))
    result = twilio_handler.initiate_call(
        patient_phone=req.patient_phone,
        session_id=session_id,
        base_url=base_url,
    )
    result["session_id"] = session_id
    return result


# ── Twilio: TwiML webhook (opening greeting) ─────────────────────────────────

@router.get("/twilio/twiml")
def twilio_twiml(session_id: str = Query(...)):
    session = _sessions.get(session_id)
    if not session:
        return Response(
            content='<?xml version="1.0"?><Response><Say>Session not found.</Say><Hangup/></Response>',
            media_type="application/xml",
        )
    base_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    twiml = twilio_handler.build_greeting_twiml(
        session_id=session_id,
        patient=session["patient"],
        base_url=base_url,
    )
    return Response(content=twiml, media_type="application/xml")


# ── Twilio: gather webhook (called after each patient utterance) ──────────────

@router.post("/twilio/gather")
async def twilio_gather(
    request: Request,
    session_id: str = Query(...),
    q_index: int = Query(...),
):
    session = _sessions.get(session_id)
    if not session:
        return Response(
            content='<?xml version="1.0"?><Response><Say>Session expired.</Say><Hangup/></Response>',
            media_type="application/xml",
        )

    form = await request.form()
    patient_speech = form.get("SpeechResult", "[No response]")

    questions = VOICE_SCRIPT.get("questions", [])
    question_id = questions[q_index]["id"] if q_index < len(questions) else "unknown"

    # Store patient response in session transcript
    session["transcript"].append({
        "speaker": "patient",
        "text": patient_speech,
        "question_id": question_id,
    })
    session["q_index"] = q_index + 1

    base_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    twiml = twilio_handler.build_question_twiml(
        session_id=session_id,
        patient=session["patient"],
        q_index=q_index,
        patient_response=patient_speech,
        base_url=base_url,
    )
    return Response(content=twiml, media_type="application/xml")


# ── Get Twilio session transcript (polled by frontend after call) ─────────────

@router.get("/twilio/session/{session_id}")
def get_twilio_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "session not found"})
    return {
        "session_id": session_id,
        "transcript": session["transcript"],
        "q_index": session["q_index"],
        "total_questions": len(VOICE_SCRIPT.get("questions", [])),
    }
