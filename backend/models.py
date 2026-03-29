"""SQLAlchemy ORM models for CardioCommand."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Integer, DateTime, JSON, Text
from database import Base


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class CallRecord(Base):
    """
    Stores every voice call — both inbound (patient -> Cora) and
    outbound (Cora -> patient initiated from doctor dashboard).
    """
    __tablename__ = "call_records"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, nullable=False, index=True)
    patient_name = Column(String, nullable=True)
    surgery_type = Column(String, nullable=True)
    days_post_op = Column(Integer, nullable=True)

    # 'inbound'  = patient called Cora (from Patient App)
    # 'outbound' = Cora called patient (from Doctor Dashboard)
    call_type = Column(String, nullable=False)
    # 'patient' | 'doctor'
    initiated_by = Column(String, nullable=False)

    started_at = Column(DateTime, default=_now)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    vapi_call_id = Column(String, nullable=True, index=True)

    # 'in_progress' | 'completed' | 'failed' | 'no_answer'
    status = Column(String, default="in_progress")

    # Full transcript: [{speaker, text, timestamp}]
    transcript = Column(JSON, default=list)

    # Full GPT-4o analysis object
    analysis = Column(JSON, nullable=True)

    # Quick-access fields extracted from analysis
    severity = Column(String, nullable=True)        # low/medium/high/critical
    wellbeing_score = Column(Integer, nullable=True)  # 1-10
    flags = Column(JSON, default=list)              # list of concern strings
    medication_adherence = Column(String, nullable=True)

    doctor_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "surgery_type": self.surgery_type,
            "days_post_op": self.days_post_op,
            "call_type": self.call_type,
            "initiated_by": self.initiated_by,
            "started_at": (
                self.started_at.isoformat() if self.started_at else None
            ),
            "ended_at": (
                self.ended_at.isoformat() if self.ended_at else None
            ),
            "duration_seconds": self.duration_seconds,
            "vapi_call_id": self.vapi_call_id,
            "status": self.status,
            "transcript": self.transcript or [],
            "analysis": self.analysis,
            "severity": self.severity,
            "wellbeing_score": self.wellbeing_score,
            "flags": self.flags or [],
            "medication_adherence": self.medication_adherence,
            "doctor_notes": self.doctor_notes,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }


class RecoveryPlan(Base):
    """Stores the latest doctor-authored recovery plan and AI coaching prompt."""
    __tablename__ = "recovery_plans"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, nullable=False, index=True)

    doctor_plan = Column(Text, nullable=False)
    generated_prompt = Column(Text, nullable=False)
    scheduled_call_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "doctor_plan": self.doctor_plan,
            "generated_prompt": self.generated_prompt,
            "scheduled_call_at": (
                self.scheduled_call_at.isoformat() if self.scheduled_call_at else None
            ),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "updated_at": (
                self.updated_at.isoformat() if self.updated_at else None
            ),
        }
class WhoopConnection(Base):
    """Stores a patient's WHOOP OAuth tokens and latest synced summary."""
    __tablename__ = "whoop_connections"

    patient_id = Column(String, primary_key=True)
    whoop_user_id = Column(String, nullable=True, index=True)
    email = Column(String, nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    scope = Column(String, nullable=True)
    token_type = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    is_connected = Column(Boolean, default=False)
    latest_payload = Column(JSON, default=dict)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    def to_summary(self) -> dict:
        return {
            "patient_id": self.patient_id,
            "connected": bool(self.is_connected and self.access_token),
            "provider": "whoop",
            "whoop_user_id": self.whoop_user_id,
            "email": self.email,
            "last_sync_at": (
                self.last_sync_at.isoformat() if self.last_sync_at else None
            ),
            "latest": self.latest_payload or {},
        }
