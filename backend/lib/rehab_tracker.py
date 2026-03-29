from __future__ import annotations

from datetime import datetime, timezone

_rehab_state: dict[str, dict] = {}
_rehab_events: dict[str, list[dict]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_rehab_state(patient: dict | None) -> dict:
    patient = patient or {}
    days_post_op = patient.get("days_post_op", 8)
    insurance = patient.get("insurance") or {}
    rehab_sessions_used = insurance.get("rehab_sessions_used", 0)
    rehab_week = max(1, min(12, ((days_post_op - 1) // 7) + 1))

    if patient.get("id") == "john-mercer":
        streak = 4
        sessions_this_week = 2
    else:
        streak = max(1, min(3, rehab_sessions_used))
        sessions_this_week = min(2, rehab_sessions_used)

    return {
        "rehab_week": rehab_week,
        "streak_days": streak,
        "sessions_this_week": sessions_this_week,
        "sessions_goal": 3,
        "last_session_duration_seconds": 0,
        "last_completed_at": None,
        "last_skipped_reason": None,
        "last_barrier_label": None,
        "last_check_in_at": None,
        "last_mode": None,
        "coach_message": None,
    }


def get_rehab_state(patient_id: str, patient: dict | None = None) -> dict:
    state = _rehab_state.get(patient_id)
    if state is None:
        state = _default_rehab_state(patient)
        _rehab_state[patient_id] = state
    return dict(state)


def get_rehab_events(patient_id: str) -> list[dict]:
    return list(_rehab_events.get(patient_id, []))


def record_rehab_event(
    patient_id: str,
    patient: dict | None,
    *,
    mode: str,
    coach_message: str,
    session_duration: int = 0,
    barrier_reason: str | None = None,
) -> dict:
    state = get_rehab_state(patient_id, patient)
    timestamp = _now_iso()

    if mode == "win":
        state["streak_days"] = max(1, state.get("streak_days", 0) + 1)
        state["sessions_this_week"] = min(
            state.get("sessions_goal", 3),
            state.get("sessions_this_week", 0) + 1,
        )
        state["last_session_duration_seconds"] = session_duration
        state["last_completed_at"] = timestamp
        state["last_mode"] = "win"
        state["last_check_in_at"] = timestamp
        state["last_skipped_reason"] = None
        state["last_barrier_label"] = None
        state["coach_message"] = coach_message

        event = {
            "id": f"rehab-{patient_id}-{int(datetime.now(timezone.utc).timestamp())}",
            "type": "rehab_win",
            "icon": "🏃",
            "label": "Rehab Session Completed",
            "detail": (
                f"Completed a {max(1, session_duration // 60)} minute walk. "
                f"Streak is now {state['streak_days']} days."
            ),
            "time": datetime.now().astimezone().strftime("%I:%M%p").lower(),
            "day": f"Week {state['rehab_week']}",
            "created_at": timestamp,
        }
    else:
        state["last_mode"] = "wall"
        state["last_check_in_at"] = timestamp
        state["last_skipped_reason"] = barrier_reason
        state["last_barrier_label"] = barrier_reason
        state["coach_message"] = coach_message

        event = {
            "id": f"rehab-{patient_id}-{int(datetime.now(timezone.utc).timestamp())}",
            "type": "rehab_wall",
            "icon": "🧠",
            "label": "Barrier To Rehab Logged",
            "detail": barrier_reason or "Patient reported a barrier to completing rehab today.",
            "time": datetime.now().astimezone().strftime("%I:%M%p").lower(),
            "day": f"Week {state['rehab_week']}",
            "created_at": timestamp,
        }

    _rehab_state[patient_id] = state
    _rehab_events.setdefault(patient_id, []).insert(0, event)
    _rehab_events[patient_id] = _rehab_events[patient_id][:8]
    return dict(state)
