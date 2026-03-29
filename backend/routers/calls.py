"""
Call History Router
===================
Endpoints:
  POST   /calls/start          -> create call record (returns call_id)
  PATCH  /calls/{id}/end       -> mark ended + store transcript + analysis
  GET    /calls                -> all calls (doctor dashboard, paginated)
  GET    /calls/patient/{pid}  -> calls for a specific patient
  GET    /calls/{id}           -> single call detail
  PATCH  /calls/{id}/notes     -> doctor adds notes to a completed call
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import CallRecord

router = APIRouter()


# ── Request schemas ───────────────────────────────────────────────────────────


class StartCallBody(BaseModel):
    patient_id: str
    patient_name: Optional[str] = None
    surgery_type: Optional[str] = None
    days_post_op: Optional[int] = None
    call_type: str          # 'inbound' | 'outbound'
    initiated_by: str       # 'patient' | 'doctor'
    vapi_call_id: Optional[str] = None


class EndCallBody(BaseModel):
    transcript: Optional[list] = None
    analysis: Optional[dict] = None
    vapi_call_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = "completed"


class DoctorNotesBody(BaseModel):
    notes: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _extract_summary_fields(analysis: dict | None) -> dict:
    if not analysis:
        return {}
    return {
        "severity": analysis.get("severity"),
        "wellbeing_score": analysis.get("wellbeing_score"),
        "flags": analysis.get("flags", []),
        "medication_adherence": analysis.get("medication_adherence"),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/start", status_code=201)
def start_call(body: StartCallBody, db: Session = Depends(get_db)):
    """Create a call record when a call begins. Returns the internal call ID."""
    record = CallRecord(
        patient_id=body.patient_id,
        patient_name=body.patient_name,
        surgery_type=body.surgery_type,
        days_post_op=body.days_post_op,
        call_type=body.call_type,
        initiated_by=body.initiated_by,
        vapi_call_id=body.vapi_call_id,
        status="in_progress",
        transcript=[],
        flags=[],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"call_id": record.id, "status": "in_progress"}


@router.patch("/{call_id}/end")
def end_call(
    call_id: str,
    body: EndCallBody,
    db: Session = Depends(get_db),
):
    """Mark call ended, store transcript + analysis, compute summary fields."""
    record = db.query(CallRecord).filter(
        CallRecord.id == call_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Call record not found")

    record.ended_at = datetime.now(timezone.utc)
    record.status = body.status or "completed"

    if body.transcript is not None:
        record.transcript = body.transcript

    if body.analysis is not None:
        record.analysis = body.analysis
        summary = _extract_summary_fields(body.analysis)
        record.severity = summary.get("severity")
        record.wellbeing_score = summary.get("wellbeing_score")
        record.flags = summary.get("flags", [])
        record.medication_adherence = summary.get("medication_adherence")

    if body.vapi_call_id:
        record.vapi_call_id = body.vapi_call_id

    if body.duration_seconds is not None:
        record.duration_seconds = body.duration_seconds
    elif record.started_at and record.ended_at:
        started = record.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        delta = record.ended_at - started
        record.duration_seconds = int(delta.total_seconds())

    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.get("")
def list_calls(
    limit: int = 50,
    offset: int = 0,
    call_type: Optional[str] = None,
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all calls. Supports filtering by type/patient."""
    q = db.query(CallRecord)
    if call_type:
        q = q.filter(CallRecord.call_type == call_type)
    if patient_id:
        q = q.filter(CallRecord.patient_id == patient_id)
    total = q.count()
    records = (
        q.order_by(CallRecord.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"total": total, "calls": [r.to_dict() for r in records]}


@router.get("/patient/{patient_id}")
def patient_calls(
    patient_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """All calls for a specific patient, most recent first."""
    records = (
        db.query(CallRecord)
        .filter(CallRecord.patient_id == patient_id)
        .order_by(CallRecord.started_at.desc())
        .limit(limit)
        .all()
    )
    return [r.to_dict() for r in records]


@router.get("/{call_id}")
def get_call(call_id: str, db: Session = Depends(get_db)):
    """Full detail for a single call including transcript and analysis."""
    record = db.query(CallRecord).filter(
        CallRecord.id == call_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Call not found")
    return record.to_dict()


@router.patch("/{call_id}/notes")
def update_doctor_notes(
    call_id: str,
    body: DoctorNotesBody,
    db: Session = Depends(get_db),
):
    """Doctor adds or updates their notes on a completed call."""
    record = db.query(CallRecord).filter(
        CallRecord.id == call_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Call not found")
    record.doctor_notes = body.notes
    db.commit()
    return {"status": "ok"}
