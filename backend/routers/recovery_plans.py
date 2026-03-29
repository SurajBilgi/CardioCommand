import os
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import RecoveryPlan
from prompts.library import PROMPTS

router = APIRouter()


class RecoveryPlanRequest(BaseModel):
    patient_id: str
    patient_profile: dict
    doctor_plan: str
    current_vitals: Optional[dict] = None
    scheduled_call_at: Optional[datetime] = None


def _get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _extract_plan_items(doctor_plan: str) -> list[str]:
    pieces = []
    for line in doctor_plan.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = re.sub(r"^[-*•\d\.\)\s]+", "", cleaned).strip()
        if cleaned:
            pieces.append(cleaned)
    if pieces:
        return pieces
    sentences = [s.strip() for s in re.split(r"[.;]\s+", doctor_plan) if s.strip()]
    return sentences or [doctor_plan.strip()]


def _gamify_item(item: str) -> str:
    lower = item.lower()
    if "walk" in lower or "steps" in lower or "ambulat" in lower:
        return (
            "Mailbox mission: take an easy walk to the mailbox, front door, or hallway landmark, "
            "then come back and notice how your breathing feels."
        )
    if "breath" in lower or "spirom" in lower:
        return (
            "Balloon reset: pause in a chair, place one hand on your belly, and take five slow, smooth breaths "
            "like you're filling a balloon gently, not forcefully."
        )
    if "sleep" in lower or "rest" in lower:
        return (
            "Wind-down win: set up a calm bedtime lane tonight with lights lower, water nearby, "
            "and a phone-free ten-minute reset before sleep."
        )
    if "med" in lower or "pill" in lower:
        return (
            "Pillbox checkpoint: make a quick lap to your medication spot, check the next dose time, "
            "and treat it like keeping your recovery streak alive."
        )
    if "swelling" in lower or "weight" in lower or "fluid" in lower:
        return (
            "Morning detective check: look at your ankles, notice whether shoes feel tighter than usual, "
            "and log any quick changes for the care team."
        )
    return f"Home win: {item.rstrip('.')} and keep it gentle enough that you can talk comfortably the whole time."


def _fallback_prompt(patient_profile: dict, doctor_plan: str) -> str:
    first_name = patient_profile.get("name", "there").split(" ")[0]
    missions = _extract_plan_items(doctor_plan)[:3]
    mission_lines = "\n".join(
        f"{index + 1}. {_gamify_item(item)}"
        for index, item in enumerate(missions)
    ) or "1. Home win: take one small, gentle recovery action and stop before you feel overworked."

    return (
        "RECOVERY CALL THEME:\n"
        f"Make today's recovery feel like a few small wins for {first_name}, not a workout assignment.\n\n"
        "COACHING OPEN:\n"
        f"Hi {first_name}, Dr. Rao left a recovery game plan for today. Let's turn healing into a couple of simple wins you can do around home.\n\n"
        "TODAY'S MISSIONS:\n"
        f"{mission_lines}\n\n"
        "WHY IT HELPS:\n"
        "These small missions keep blood moving, build confidence, and support healing without making recovery feel intimidating.\n\n"
        "ENCOURAGING CLOSE:\n"
        "Keep it light, celebrate every small win, and remind the patient they are building strength one mission at a time.\n\n"
        "SAFETY STOP SIGNS:\n"
        "Stop right away and contact the care team for chest pain, severe shortness of breath, dizziness, fainting, or anything that suddenly feels wrong."
    )


def _generate_prompt(patient_profile: dict, current_vitals: Optional[dict], doctor_plan: str) -> str:
    try:
        client = _get_openai_client()
        prompt = PROMPTS["recovery_plan_gamified"].format(
            patient_profile=patient_profile,
            current_vitals=current_vitals or {},
            doctor_plan=doctor_plan,
        )
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a cardiac rehab coach who rewrites doctor instructions into safe, motivating, "
                        "gamified recovery missions for patients."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=600,
        )
        return response.choices[0].message.content or _fallback_prompt(patient_profile, doctor_plan)
    except Exception:
        return _fallback_prompt(patient_profile, doctor_plan)


@router.post("", status_code=201)
def create_recovery_plan(body: RecoveryPlanRequest, db: Session = Depends(get_db)):
    doctor_plan = body.doctor_plan.strip()
    if not doctor_plan:
        raise HTTPException(status_code=400, detail="doctor_plan is required")

    generated_prompt = _generate_prompt(
        patient_profile=body.patient_profile,
        current_vitals=body.current_vitals,
        doctor_plan=doctor_plan,
    )

    plan = RecoveryPlan(
        patient_id=body.patient_id,
        doctor_plan=doctor_plan,
        generated_prompt=generated_prompt,
        scheduled_call_at=body.scheduled_call_at,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan.to_dict()


@router.get("/patient/{patient_id}")
def get_latest_recovery_plan(patient_id: str, db: Session = Depends(get_db)):
    plan = (
        db.query(RecoveryPlan)
        .filter(RecoveryPlan.patient_id == patient_id)
        .order_by(RecoveryPlan.updated_at.desc(), RecoveryPlan.created_at.desc())
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    return plan.to_dict()
