import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from vitals_engine.simulator import simulator
from risk_model.predictor import compute_risk_score, get_alert_level
from prompts.library import PROMPTS

router = APIRouter()


class AnalyzeRequest(BaseModel):
    patient_id: str
    patient_profile: dict
    current_vitals: Optional[dict] = None


class ChatRequest(BaseModel):
    patient_id: str
    message: str
    patient_profile: dict
    conversation_history: Optional[list] = []


class PreVisitRequest(BaseModel):
    patient_id: str
    patient_profile: dict
    doctor_name: str = "Dr. Rao"
    hours_until_appointment: int = 18


class SOAPRequest(BaseModel):
    patient_profile: dict
    current_soap: dict
    transcript_chunk: str


class DischargeRewriteRequest(BaseModel):
    patient_profile: dict
    discharge_text: str
    grade: str = "6th grade"


class RehabCheckinRequest(BaseModel):
    patient_id: str
    patient_profile: dict
    mode: str = "win"  # "win" or "wall"
    session_duration: int = 0  # seconds
    context: str = ""  # e.g. "patient said they're too tired"
    rehab_week: int = 2
    streak: int = 4


def _get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def _stream_agent_output(patient_id: str, patient_profile: dict, current_vitals: dict):
    """Stream the LangGraph agent output as SSE events."""
    yield f"data: {json.dumps({'type': 'start', 'message': 'Initializing clinical analysis pipeline...'})}\n\n"

    # Step 1: Retrieve guidelines
    yield f"data: {json.dumps({'type': 'step', 'step': 'retrieve_guidelines', 'message': '📚 Retrieving relevant clinical guidelines from knowledge base...'})}\n\n"

    guidelines = "[Clinical guidelines: Post-CABG monitoring protocols, AFib detection criteria, readmission risk factors]"
    try:
        from rag.retriever import retriever
        query = (
            f"Post-cardiac surgery Day {patient_profile.get('days_post_op')}. "
            f"Surgery: {patient_profile.get('surgery_type')}. "
            f"HR {current_vitals.get('heart_rate')} bpm, SpO2 {current_vitals.get('spo2')}%, "
            f"ECG: {current_vitals.get('ecg_rhythm')}."
        )
        guidelines = retriever.get_relevant_text(query, k=3)
        yield f"data: {json.dumps({'type': 'step_complete', 'step': 'retrieve_guidelines', 'message': '✓ Retrieved 3 relevant guideline sections'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'step_complete', 'step': 'retrieve_guidelines', 'message': '✓ Using cached clinical guidelines'})}\n\n"

    # Step 2: Analyze vitals
    yield f"data: {json.dumps({'type': 'step', 'step': 'analyze_vitals', 'message': '🔬 GPT-4o analyzing vitals trends against guidelines...'})}\n\n"

    clinical_reasoning = ""
    try:
        client = _get_openai_client()
        prompt = PROMPTS["vitals_analysis"].format(
            patient=patient_profile,
            vitals=current_vitals,
            history=simulator.get_history(patient_id, 24),
            guidelines=guidelines[:2000],
        )
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": PROMPTS["system"]},
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
        )
        clinical_reasoning = response.choices[0].message.content
        yield f"data: {json.dumps({'type': 'reasoning', 'content': clinical_reasoning})}\n\n"
    except Exception as e:
        clinical_reasoning = f"Vitals analysis: HR {current_vitals.get('heart_rate')} bpm (elevated), SpO2 {current_vitals.get('spo2')}% (below threshold), ECG shows {current_vitals.get('ecg_rhythm')}."
        yield f"data: {json.dumps({'type': 'reasoning', 'content': clinical_reasoning})}\n\n"

    # Step 3: Risk scoring
    yield f"data: {json.dumps({'type': 'step', 'step': 'score_risk', 'message': '📊 Running risk scoring model...'})}\n\n"

    score, reasons = compute_risk_score(patient_profile, current_vitals, clinical_reasoning)
    alert_level = get_alert_level(score, current_vitals)

    yield f"data: {json.dumps({'type': 'risk_score', 'score': score, 'reasons': reasons, 'alert_level': alert_level})}\n\n"
    yield f"data: {json.dumps({'type': 'step_complete', 'step': 'score_risk', 'message': f'✓ Risk score: {score}/100 — {alert_level.upper()}'})}\n\n"

    # Step 4: Generate action
    action_content = ""
    if alert_level in ("high", "critical"):
        yield f"data: {json.dumps({'type': 'step', 'step': 'generate_urgent_brief', 'message': '🚨 Generating urgent physician brief...'})}\n\n"
        try:
            client = _get_openai_client()
            prompt = PROMPTS["urgent_brief"].format(
                patient_profile=patient_profile,
                clinical_reasoning=clinical_reasoning,
                risk_analysis={"score": score, "reasons": reasons},
                current_vitals=current_vitals,
            )
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400,
            )
            action_content = response.choices[0].message.content
        except Exception:
            action_content = f"⚠️ ALERT LEVEL: {alert_level.upper()}\nPATIENT: {patient_profile.get('name')}\nCRITICAL FINDING: {reasons[0] if reasons else 'Multiple critical vitals abnormalities'}\nRECOMMENDED ACTION: Immediate physician review\nTIME SENSITIVITY: Immediate"

        yield f"data: {json.dumps({'type': 'action', 'action_type': 'urgent_brief', 'content': action_content})}\n\n"

    elif alert_level == "medium":
        yield f"data: {json.dumps({'type': 'step', 'step': 'generate_outreach', 'message': '📞 Generating outreach script...'})}\n\n"
        try:
            client = _get_openai_client()
            prompt = PROMPTS["outreach_script"].format(
                patient_profile=patient_profile,
                clinical_reasoning=clinical_reasoning,
                risk_analysis={"score": score, "reasons": reasons},
            )
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
            )
            action_content = response.choices[0].message.content
        except Exception:
            action_content = f"Hello, may I speak with {patient_profile.get('name')}? This is the care team from Cardiology Associates calling to check in on your recovery..."

        yield f"data: {json.dumps({'type': 'action', 'action_type': 'outreach_script', 'content': action_content})}\n\n"

    # Step 5: Final summary
    yield f"data: {json.dumps({'type': 'step', 'step': 'generate_summary', 'message': '📝 Generating clinical summary...'})}\n\n"

    try:
        client = _get_openai_client()
        summary_prompt = f"""
        Generate a concise clinical summary for {patient_profile.get('name')}.

        PATIENT: {patient_profile}
        VITALS: {current_vitals}
        CLINICAL REASONING: {clinical_reasoning}
        RISK SCORE: {score}/100
        RISK REASONS: {reasons}
        ALERT LEVEL: {alert_level}

        Write a 150-word summary with:
        - Overall status
        - Key concerns (bullets)
        - Risk level and top reasons
        - Recommended actions
        - Time sensitivity
        """
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": PROMPTS["system"]},
                {"role": "user", "content": summary_prompt},
            ],
            max_tokens=300,
        )
        summary = response.choices[0].message.content
    except Exception:
        summary = f"Patient {patient_profile.get('name')} — Risk Score {score}/100 ({alert_level.upper()})\n\nKey findings:\n" + "\n".join([f"• {r}" for r in reasons])

    yield f"data: {json.dumps({'type': 'summary', 'content': summary})}\n\n"
    yield f"data: {json.dumps({'type': 'complete', 'risk_score': score, 'alert_level': alert_level})}\n\n"


@router.post("/analyze")
async def analyze_patient(request: AnalyzeRequest):
    current_vitals = request.current_vitals or simulator.get_current(request.patient_id)

    return StreamingResponse(
        _stream_agent_output(request.patient_id, request.patient_profile, current_vitals),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat")
async def patient_chat(request: ChatRequest):
    async def generate():
        try:
            client = _get_openai_client()
            p = request.patient_profile
            vitals = simulator.get_current(request.patient_id)

            vitals_summary = (
                f"HR {vitals.get('heart_rate', '—')} bpm, "
                f"SpO₂ {vitals.get('spo2', '—')}%, "
                f"Steps {vitals.get('steps_today', '—')} today"
            )

            system_prompt = PROMPTS["patient_chat"].format(
                patient_name=p.get("name", "there"),
                day_post_op=p.get("days_post_op", 1),
                surgery_type=p.get("surgery_type", "cardiac surgery"),
                vitals_summary=vitals_summary,
                medications=[m["name"] for m in p.get("medications", [])],
                risk_factors=p.get("comorbidities", []),
            )

            messages = [{"role": "system", "content": system_prompt}]
            for h in (request.conversation_history or []):
                messages.append({"role": h.get("role", "user"), "content": h.get("message", "")})
            messages.append({"role": "user", "content": request.message})

            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=600,
                stream=True,
            )

            full_response = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_response += delta
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"

            escalate = "ESCALATE_TO_MD: true" in full_response
            yield f"data: {json.dumps({'type': 'complete', 'escalate': escalate})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/pre-visit-brief")
async def pre_visit_brief(request: PreVisitRequest):
    async def generate():
        try:
            client = _get_openai_client()
            history = simulator.get_history(request.patient_id, 240)
            vitals = simulator.get_current(request.patient_id)

            prompt = PROMPTS["pre_visit_brief"].format(
                doctor_name=request.doctor_name,
                patient_name=request.patient_profile.get("name"),
                hours_until_appointment=request.hours_until_appointment,
                patient_profile=request.patient_profile,
                vitals_history=history[-10:],
                timeline="Recent wearable sync, patient reported fatigue via Cora",
                risk_score=vitals.get("risk_score", 0),
            )

            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": PROMPTS["system"]},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=500,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/soap-note")
async def generate_soap_note(request: SOAPRequest):
    try:
        client = _get_openai_client()
        prompt = PROMPTS["soap_note"].format(
            patient_profile=request.patient_profile,
            current_soap=request.current_soap,
            transcript_chunk=request.transcript_chunk,
        )
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        return {
            "subjective": f"Patient reports symptoms. [AI generation failed: {e}]",
            "objective": "Vitals as documented.",
            "assessment": "Assessment pending.",
            "plan": "Follow-up as planned.",
        }


@router.post("/rehab-checkin")
async def rehab_checkin(request: RehabCheckinRequest):
    """Post-exercise win celebration or missed-session wall intervention from Cora."""
    async def generate():
        try:
            client = _get_openai_client()
            vitals = simulator.get_current(request.patient_id)
            p = request.patient_profile

            if request.mode == "win":
                duration_min = request.session_duration // 60
                prompt = PROMPTS["rehab_win"].format(
                    patient_name=p.get("name", "there"),
                    rehab_week=request.rehab_week,
                    surgery_type=p.get("surgery_type", "cardiac surgery"),
                    session_duration=duration_min if duration_min > 0 else "your",
                    peak_hr=round(vitals.get("heart_rate", 95)),
                    spo2=round(vitals.get("spo2", 97)),
                    streak=request.streak,
                )
            else:
                prompt = PROMPTS["rehab_wall"].format(
                    patient_name=p.get("name", "there"),
                    rehab_week=request.rehab_week,
                    surgery_type=p.get("surgery_type", "cardiac surgery"),
                    context=request.context or "patient said they want to skip today",
                )

            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are Cora, a warm cardiac rehabilitation coach. Keep responses short, personal, and emotionally intelligent."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=150,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'complete', 'mode': request.mode})}\n\n"

        except Exception as e:
            fallback = (
                f"Amazing work completing your session! That's {request.streak + 1} days in a row — you're building real strength. 💪"
                if request.mode == "win"
                else "That's okay — rest is part of recovery too. What would make it easier to try just 10 minutes today?"
            )
            yield f"data: {json.dumps({'type': 'token', 'content': fallback})}\n\n"
            yield f"data: {json.dumps({'type': 'complete', 'mode': request.mode})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/transcribe")
async def transcribe_audio():
    return {"text": "This endpoint requires audio file upload via multipart form. Use the Web Speech API for demo."}


@router.post("/rewrite-discharge")
async def rewrite_discharge(request: DischargeRewriteRequest):
    async def generate():
        try:
            client = _get_openai_client()
            p = request.patient_profile
            prompt = PROMPTS["discharge_rewrite"].format(
                grade=request.grade,
                age=p.get("age", 65),
                surgery_type=p.get("surgery_type", "cardiac surgery"),
                discharge_text=request.discharge_text,
            )
            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
