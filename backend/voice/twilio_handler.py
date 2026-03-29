"""
Twilio Voice Integration
========================
Handles outbound call initiation and TwiML webhook responses.

Prerequisites:
  1. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in backend/.env
  2. Expose your local backend publicly (e.g. `ngrok http 8000`) and set
     PUBLIC_BASE_URL=https://xxxx.ngrok.io in backend/.env
  3. Add `twilio` to requirements.txt and pip install it

Twilio call flow:
  POST /voice/twilio/call  →  Twilio dials patient's phone
  Twilio hits  GET  /voice/twilio/twiml?session_id=...  →  returns opening TwiML
  Patient speaks  →  Twilio hits POST /voice/twilio/gather?session_id=...&q_index=0
  ... repeats for each question ...
  Final question done  →  returns closing TwiML + hangup
"""

import os
import json
from typing import Optional
from voice.config import VOICE_SCRIPT


def _interpolate(text: str, patient: dict) -> str:
    return text.format(
        patient_name=patient.get("name", "there"),
        agent_name=VOICE_SCRIPT.get("agent_name", "Cora"),
        hospital_name=VOICE_SCRIPT.get("hospital_name", "your care team"),
        doctor_name=VOICE_SCRIPT.get("doctor_name", "your doctor"),
        nurse_line=VOICE_SCRIPT.get("nurse_line", "your care team"),
        surgery_type=patient.get("surgery_type", "your procedure"),
        days_post_op=str(patient.get("days_post_op", "")),
    )


def _say(text: str) -> str:
    """Wrap text in TwiML <Say> with configured Polly voice."""
    cfg = VOICE_SCRIPT.get("twilio", {})
    voice = cfg.get("tts_voice", "Polly.Joanna")
    rate = cfg.get("tts_rate", "85%")
    return (
        f'<Say voice="{voice}">'
        f'<prosody rate="{rate}">{text}</prosody>'
        f"</Say>"
    )


def build_greeting_twiml(session_id: str, patient: dict, base_url: str) -> str:
    """TwiML for the opening greeting + first question."""
    greeting = _interpolate(VOICE_SCRIPT.get("greeting", "Hello."), patient)
    first_q = VOICE_SCRIPT["questions"][0]["ask"] if VOICE_SCRIPT.get("questions") else ""
    cfg = VOICE_SCRIPT.get("twilio", {})
    timeout = cfg.get("gather_timeout", 10)
    speech_timeout = cfg.get("gather_speech_timeout", 5)
    gather_url = f"{base_url}/voice/twilio/gather?session_id={session_id}&q_index=0"

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  {_say(greeting)}
  <Pause length="1"/>
  <Gather input="speech" action="{gather_url}" method="POST"
          timeout="{timeout}" speechTimeout="{speech_timeout}" language="en-US">
    {_say(first_q)}
  </Gather>
  <Redirect method="POST">{gather_url}</Redirect>
</Response>"""


def build_question_twiml(
    session_id: str,
    patient: dict,
    q_index: int,
    patient_response: str,
    base_url: str,
) -> str:
    """TwiML for follow-up response + next question (or closing)."""
    questions = VOICE_SCRIPT.get("questions", [])
    cfg = VOICE_SCRIPT.get("twilio", {})
    timeout = cfg.get("gather_timeout", 10)
    speech_timeout = cfg.get("gather_speech_timeout", 5)

    # Speak follow-up for the question just answered
    parts = []
    if q_index < len(questions):
        follow_up = questions[q_index].get("follow_up", "")
        if follow_up and "[PLACEHOLDER" not in follow_up:
            parts.append(_say(_interpolate(follow_up, patient)))

    next_index = q_index + 1

    if next_index < len(questions):
        next_q = questions[next_index]["ask"]
        gather_url = f"{base_url}/voice/twilio/gather?session_id={session_id}&q_index={next_index}"
        parts.append(f"""
  <Gather input="speech" action="{gather_url}" method="POST"
          timeout="{timeout}" speechTimeout="{speech_timeout}" language="en-US">
    {_say(next_q)}
  </Gather>
  <Redirect method="POST">{gather_url}</Redirect>""")
    else:
        # All questions done — closing
        closing = _interpolate(
            VOICE_SCRIPT.get("closing", "Thank you. Goodbye!"), patient
        )
        if "[PLACEHOLDER" in closing:
            closing = f"Thank you so much for your time, {patient.get('name', 'there')}. I'll pass everything on to your care team right away. Take care!"
        parts.append(_say(closing))
        parts.append("<Hangup/>")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  {''.join(parts)}
</Response>"""


def initiate_call(patient_phone: str, session_id: str, base_url: str) -> dict:
    """
    Initiates a Twilio outbound call.
    Returns {"success": True, "call_sid": "..."} or {"success": False, "error": "..."}.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")

    if not all([account_sid, auth_token, from_number]):
        return {
            "success": False,
            "error": (
                "Twilio credentials not configured. "
                "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in backend/.env"
            ),
        }

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        twiml_url = f"{base_url}/voice/twilio/twiml?session_id={session_id}"
        call = client.calls.create(
            to=patient_phone,
            from_=from_number,
            url=twiml_url,
            method="GET",
        )
        return {"success": True, "call_sid": call.sid}
    except ImportError:
        return {"success": False, "error": "twilio package not installed. Run: pip install twilio"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
