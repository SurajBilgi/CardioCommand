"""
Vapi Voice Agent Integration
=============================
Handles Vapi assistant creation and outbound phone call initiation.

Required env vars:
  VAPI_API_KEY          — Private API key from dashboard.vapi.ai
  VAPI_PHONE_NUMBER_ID  — Phone number ID from Vapi dashboard (for outbound calls)

The frontend uses VITE_VAPI_PUBLIC_KEY (public key) directly with @vapi-ai/web SDK.
"""

import os
import httpx
from voice.config import VOICE_SCRIPT

VAPI_BASE = "https://api.vapi.ai"

# ── Recommended ElevenLabs voice IDs (all work without your own EL account via Vapi)
# Bella  — warm, natural, empathetic      : EXAVITQu4vr4xnSDxMaL
# Rachel — calm, professional, reassuring : 21m00Tcm4TlvDq8ikWAM
# Elli   — friendly, clear, upbeat        : MF3mGyEYCl7XYWbV9V6O
# Charlotte — mature, authoritative       : XB0fDUnXU5powFXDhCwa
VAPI_VOICE_ID = os.getenv("VAPI_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")   # Bella default


def _interpolate(text: str, patient: dict, script: dict) -> str:
    return (
        (text or "")
        .replace("{patient_name}",  patient.get("name", "there"))
        .replace("{agent_name}",    script.get("agent_name", "Cora"))
        .replace("{hospital_name}", script.get("hospital_name", "your care team"))
        .replace("{doctor_name}",   script.get("doctor_name", "your doctor"))
        .replace("{nurse_line}",    script.get("nurse_line", "your care team"))
        .replace("{surgery_type}",  patient.get("surgery_type", "your procedure"))
        .replace("{days_post_op}",  str(patient.get("days_post_op", "")))
    )


def _is_placeholder(text: str) -> bool:
    return not text or "[PLACEHOLDER" in text or "[YOUR" in text or "[DR." in text


def build_system_prompt(patient: dict, script: dict) -> str:
    """
    Builds Cora's system prompt for this specific patient.
    This is fed directly to GPT-4o via Vapi — the LLM conducts the call naturally,
    not step-by-step, so it sounds like a real conversation.
    """
    questions_block = "\n".join(
        f"  {i + 1}. [{q['category']}] {q['ask']}"
        + (f"\n     Doctor's note: {q['hint']}" if q.get("hint") else "")
        for i, q in enumerate(script.get("questions", []))
    )

    closing_raw = script.get("closing", "")
    closing = _interpolate(closing_raw, patient, script)
    if _is_placeholder(closing):
        closing = (
            f"Thank you so much for your time today, {patient.get('name', '')}. "
            f"I've noted everything and will pass it directly to your care team right away. "
            f"If you ever feel something is wrong, please don't hesitate to call your nurse line or emergency services. "
            f"Take care and have a wonderful day!"
        )

    doctor = script.get("doctor_name", "their doctor")
    if _is_placeholder(doctor):
        doctor = "their attending physician"

    hospital = script.get("hospital_name", "the hospital")
    if _is_placeholder(hospital):
        hospital = "CardioCommand Medical Center"

    return f"""You are Cora, a warm, professional, and empathetic AI health assistant at {hospital}.

PATIENT CONTEXT:
- Name: {patient.get("name")}
- Surgery: {patient.get("surgery_type")}
- Recovery day: Day {patient.get("days_post_op")} post-operation
- Ejection Fraction: {patient.get("ejection_fraction", "N/A")}%
- Attending: {doctor}
- Comorbidities: {", ".join(patient.get("comorbidities", [])) or "None"}

YOUR MISSION:
Conduct a warm, natural 2–3 minute wellness check-in call. You are NOT a robot — speak like a caring human health assistant. Use natural conversational language, appropriate empathy, and genuine concern.

QUESTIONS TO COVER (ask naturally, one at a time — do NOT rush):
{questions_block}

GUIDELINES:
- Ask ONE question at a time. Wait for a full response before continuing.
- Use natural acknowledgements: "I see", "That's really helpful", "I'm glad to hear that", "I understand", "That makes sense".
- If patient seems distressed, express genuine concern and note it will be flagged immediately.
- If patient reports chest pain, severe shortness of breath, or dizziness — treat as URGENT. Say: "That's really important — I want to make sure the care team reviews this immediately."
- If patient has already answered a later question in their response, acknowledge it and skip that question naturally.
- Keep your own responses SHORT — you are listening, not lecturing.
- Do NOT ask multiple questions at once.
- Do NOT use bullet points or lists when speaking — speak naturally.
- Total call should be 2–3 minutes.

CLOSING (use after all questions are answered):
{closing}"""


def build_assistant_config(patient: dict) -> dict:
    """
    Returns the full Vapi inline assistant config object.
    This can be passed directly to vapi.start() in the browser SDK
    or used to create a persistent assistant via the Vapi API.
    """
    script = VOICE_SCRIPT

    # Build first message
    greeting_raw = script.get("greeting", "")
    greeting = _interpolate(greeting_raw, patient, script)
    if _is_placeholder(greeting):
        greeting = (
            f"Hi {patient.get('name', 'there')}, this is Cora calling from your care team. "
            f"I'm an AI health assistant checking in on your recovery — it's Day {patient.get('days_post_op', '')} "
            f"after your {patient.get('surgery_type', 'procedure')}. "
            f"Do you have a couple of minutes to chat?"
        )

    return {
        "name": f"Cora — {patient.get('name', 'Patient')}",
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "temperature": 0.6,
            "maxTokens": 180,
            "messages": [
                {"role": "system", "content": build_system_prompt(patient, script)}
            ],
        },
        "voice": {
            "provider": "11labs",
            "voiceId": VAPI_VOICE_ID,
            "stability": 0.45,          # 0–1: lower = more expressive
            "similarityBoost": 0.80,    # 0–1: voice consistency
            "style": 0.15,              # 0–1: style exaggeration
            "useSpeakerBoost": True,
            "optimizeStreamingLatency": 3,   # 0–4: higher = lower latency
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en",
            "smartFormat": True,
        },
        "firstMessage": greeting,
        "silenceTimeoutSeconds": 30,
        "maxDurationSeconds": 360,      # 6 min hard cap
        "backgroundDenoisingEnabled": True,
        "backchannelingEnabled": True,  # "mm-hmm", "I see" backchannels
        "backgroundSound": "off",
        "hipaaEnabled": False,
        # Allow patient to interrupt Cora mid-sentence naturally
        "stopSpeakingPlan": {
            "numWords": 1,
            "voiceSeconds": 0.2,
            "backoffSeconds": 1.5,
        },
    }


# ── Inbound (patient-initiated) assistant config ──────────────────────────────

def build_inbound_system_prompt(patient: dict) -> str:
    script = VOICE_SCRIPT
    doctor = script.get("doctor_name", "your doctor")
    if _is_placeholder(doctor): doctor = "your attending physician"
    hospital = script.get("hospital_name", "your care team")
    if _is_placeholder(hospital): hospital = "CardioCommand Medical Center"
    nurse_line = script.get("nurse_line", "your care team")
    if _is_placeholder(nurse_line): nurse_line = "your nurse line"

    return f"""You are Cora, a warm, caring, and patient AI health companion at {hospital}.

{patient.get("name", "A patient")} has called you — they are Day {patient.get("days_post_op", "?")} post {patient.get("surgery_type", "surgery")}.

YOUR ROLE:
You are NOT conducting a formal check-in. The patient called YOU because they need support. 
Be a warm, attentive listener. Let them lead the conversation.

The patient might want to:
- Report symptoms or pain they're experiencing
- Ask questions about their recovery ("Is this normal?")
- Express worry or anxiety about their health
- Just talk to someone who understands their situation
- Get guidance on medications or activities

GUIDELINES:
- Open warmly: "Hi {patient.get('name', 'there')}, I'm so glad you called. How can I help you today?"
- Let THEM talk first — don't interrogate. Ask short, open questions: "Tell me more about that", "When did that start?"
- Be genuinely empathetic: "I can hear that you're worried — that makes complete sense."
- NEVER diagnose or prescribe. Always say: "I'll make sure {doctor} and the care team see this right away."
- For URGENT symptoms (chest pain, severe difficulty breathing, fainting, arm/jaw pain):
  Say IMMEDIATELY: "Please hang up and call 911 or go to your nearest emergency room right now. This is urgent."
- For concerning but non-emergency symptoms: "I'm flagging this for {doctor} today."
- Gently cover these areas if natural: current symptoms, pain level (1–10), medications, sleep, mobility, emotional state
- Keep your responses SHORT and warm. You are a listener, not a lecturer.
- End the call by summarising: "I've noted everything you've shared and I'm sending this to your care team right now. You did the right thing by calling."

EMERGENCY NUMBERS TO MENTION IF NEEDED:
- Emergency: 911
- Care team line: {nurse_line}"""


def build_inbound_assistant_config(patient: dict) -> dict:
    """
    Vapi assistant config for patient-initiated calls.
    Open-ended, empathetic — Cora listens and supports.
    """
    name = patient.get("name", "there")
    return {
        "name": f"Cora (Inbound) — {name}",
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "temperature": 0.7,
            "maxTokens": 200,
            "messages": [
                {"role": "system", "content": build_inbound_system_prompt(patient)}
            ],
        },
        "voice": {
            "provider": "11labs",
            "voiceId": VAPI_VOICE_ID,
            "stability": 0.5,
            "similarityBoost": 0.80,
            "style": 0.2,
            "useSpeakerBoost": True,
            "optimizeStreamingLatency": 3,
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en",
            "smartFormat": True,
        },
        "firstMessage": (
            f"Hi {name}, this is Cora from your care team. "
            f"I'm so glad you reached out. How are you doing — what's on your mind?"
        ),
        "silenceTimeoutSeconds": 40,
        "maxDurationSeconds": 600,      # 10 min max for patient calls
        "backgroundDenoisingEnabled": True,
        "backchannelingEnabled": True,
        "backgroundSound": "off",
        "stopSpeakingPlan": {
            "numWords": 1,
            "voiceSeconds": 0.2,
            "backoffSeconds": 1.5,
        },
    }


# ── API calls ──────────────────────────────────────────────────────────────────

async def create_assistant(patient: dict) -> dict:
    """Create a Vapi assistant (persisted in Vapi's system) for this patient."""
    api_key = os.getenv("VAPI_API_KEY")
    if not api_key:
        return {"success": False, "error": "VAPI_API_KEY not configured in backend/.env"}

    config = build_assistant_config(patient)

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{VAPI_BASE}/assistant",
            headers={"Authorization": f"Bearer {api_key}"},
            json=config,
        )

    if r.is_success:
        data = r.json()
        return {"success": True, "assistant_id": data["id"], "config": config}
    return {"success": False, "error": r.text}


async def initiate_phone_call(patient_phone: str, assistant_id: str) -> dict:
    """Initiate a real outbound phone call via Vapi."""
    api_key = os.getenv("VAPI_API_KEY")
    phone_number_id = os.getenv("VAPI_PHONE_NUMBER_ID")

    if not api_key:
        return {"success": False, "error": "VAPI_API_KEY not configured in backend/.env"}
    if not phone_number_id:
        return {
            "success": False,
            "error": (
                "VAPI_PHONE_NUMBER_ID not configured. "
                "Get a phone number from dashboard.vapi.ai → Phone Numbers → Add."
            ),
        }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{VAPI_BASE}/call",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "assistantId": assistant_id,
                "phoneNumberId": phone_number_id,
                "customer": {"number": patient_phone},
            },
        )

    if r.is_success:
        data = r.json()
        return {"success": True, "call_id": data["id"], "status": data.get("status")}
    return {"success": False, "error": r.text}


async def get_call(call_id: str) -> dict | None:
    """Fetch call details + transcript from Vapi after a phone call ends."""
    api_key = os.getenv("VAPI_API_KEY")
    if not api_key:
        return None

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{VAPI_BASE}/call/{call_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )

    return r.json() if r.is_success else None


def extract_transcript_from_vapi_call(call_data: dict) -> list[dict]:
    """Convert Vapi call artifact transcript → our standard transcript format."""
    transcript = []
    artifact = call_data.get("artifact", {})
    messages = artifact.get("messages", [])

    for msg in messages:
        role = msg.get("role", "")
        text = msg.get("message", "") or msg.get("content", "")
        if not text:
            continue
        transcript.append({
            "speaker": "agent" if role == "bot" else "patient",
            "text": text,
            "timestamp": msg.get("time", ""),
        })

    return transcript
