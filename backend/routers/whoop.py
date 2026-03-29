import base64
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote_plus

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import WhoopConnection

router = APIRouter()

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2"
DEFAULT_SCOPE = "offline read:profile read:recovery read:sleep read:workout read:cycles"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _redirect_uri() -> str:
    return os.getenv(
        "WHOOP_REDIRECT_URI",
        f"{os.getenv('PUBLIC_BASE_URL', 'http://127.0.0.1:3003')}/integrations/whoop/callback",
    )


def _patient_app_url(patient_id: str) -> str:
    base = os.getenv("PATIENT_APP_URL", "http://127.0.0.1:5174")
    return f"{base}/?whoop=connected&patient_id={patient_id}"


def _patient_app_base_url() -> str:
    return os.getenv("PATIENT_APP_URL", "http://127.0.0.1:5174")


def _patient_redirect_with_error(patient_id: str | None, error_code: str, detail: str) -> RedirectResponse:
    base = _patient_app_url(patient_id) if patient_id else _patient_app_base_url()
    separator = "&" if "?" in base else "?"
    url = (
        f"{base}{separator}wearable_error={quote_plus(error_code)}"
        f"&wearable_detail={quote_plus(detail)}"
    )
    return RedirectResponse(url=url, status_code=302)


def _whoop_configured() -> bool:
    return bool(os.getenv("WHOOP_CLIENT_ID") and os.getenv("WHOOP_CLIENT_SECRET"))


def _public_base_configured() -> bool:
    base = os.getenv("PUBLIC_BASE_URL", "")
    return bool(base and "YOUR-ACTUAL-RAILWAY-URL" not in base and "your-railway-url" not in base)


def _require_whoop_env() -> tuple[str, str]:
    client_id = os.getenv("WHOOP_CLIENT_ID")
    client_secret = os.getenv("WHOOP_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "WHOOP is not configured yet. Add WHOOP_CLIENT_ID and "
                "WHOOP_CLIENT_SECRET to backend/.env first."
            ),
        )
    return client_id, client_secret


def _encode_state(patient_id: str) -> str:
    return base64.urlsafe_b64encode(
        json.dumps({"patient_id": patient_id}).encode("utf-8")
    ).decode("utf-8")


def _decode_state(state: str) -> str:
    try:
        payload = json.loads(
            base64.urlsafe_b64decode(state.encode("utf-8")).decode("utf-8")
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid WHOOP state") from exc
    patient_id = payload.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Missing patient_id in WHOOP state")
    return patient_id


async def _api_get(
    client: httpx.AsyncClient,
    access_token: str,
    path: str,
    params: dict | None = None,
):
    response = await client.get(
        f"{WHOOP_API_BASE}{path}",
        params=params,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    response.raise_for_status()
    return response.json()


async def _refresh_access_token(connection: WhoopConnection):
    client_id, client_secret = _require_whoop_env()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            WHOOP_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": connection.refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        token_data = response.json()

    connection.access_token = token_data["access_token"]
    connection.refresh_token = token_data.get("refresh_token", connection.refresh_token)
    connection.scope = token_data.get("scope", connection.scope)
    connection.token_type = token_data.get("token_type", connection.token_type)
    connection.expires_at = _utc_now() + timedelta(
        seconds=int(token_data.get("expires_in", 3600))
    )


async def _sync_connection(connection: WhoopConnection):
    if not connection.access_token:
        raise HTTPException(
            status_code=400,
            detail="WHOOP is not connected for this patient yet",
        )

    if connection.expires_at and connection.expires_at <= _utc_now() + timedelta(seconds=60):
        await _refresh_access_token(connection)

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            profile = await _api_get(client, connection.access_token, "/user/profile/basic")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 401 or not connection.refresh_token:
                raise
            await _refresh_access_token(connection)
            profile = await _api_get(client, connection.access_token, "/user/profile/basic")

        recovery_data = await _api_get(client, connection.access_token, "/recovery", {"limit": 1})
        sleep_data = await _api_get(client, connection.access_token, "/activity/sleep", {"limit": 1})
        workout_data = await _api_get(client, connection.access_token, "/activity/workout", {"limit": 1})
        cycle_data = await _api_get(client, connection.access_token, "/cycle", {"limit": 1})

    latest_recovery = (recovery_data.get("records") or [None])[0] or {}
    latest_sleep = (sleep_data.get("records") or [None])[0] or {}
    latest_workout = (workout_data.get("records") or [None])[0] or {}
    latest_cycle = (cycle_data.get("records") or [None])[0] or {}

    recovery_score = latest_recovery.get("score") or {}
    sleep_score = latest_sleep.get("score") or {}
    sleep_stage = sleep_score.get("stage_summary") or {}
    cycle_score = latest_cycle.get("score") or {}
    workout_score = latest_workout.get("score") or {}

    if profile.get("user_id") is not None:
        connection.whoop_user_id = str(profile["user_id"])
    connection.email = profile.get("email")
    connection.is_connected = True
    connection.last_sync_at = _utc_now()
    connection.latest_payload = {
        "recovery_score": recovery_score.get("recovery_score"),
        "resting_heart_rate": recovery_score.get("resting_heart_rate"),
        "hrv_ms": recovery_score.get("hrv_rmssd_milli"),
        "spo2_percentage": recovery_score.get("spo2_percentage"),
        "skin_temp_celsius": recovery_score.get("skin_temp_celsius"),
        "recovery_updated_at": latest_recovery.get("updated_at"),
        "sleep_hours": round(
            (sleep_stage.get("total_in_bed_time_milli") or 0) / 3600000, 1
        ) if sleep_stage.get("total_in_bed_time_milli") else None,
        "sleep_performance": sleep_score.get("sleep_performance_percentage"),
        "respiratory_rate": sleep_score.get("respiratory_rate"),
        "sleep_updated_at": latest_sleep.get("updated_at"),
        "cycle_strain": cycle_score.get("strain"),
        "average_heart_rate": cycle_score.get("average_heart_rate"),
        "max_heart_rate": cycle_score.get("max_heart_rate"),
        "workout_strain": workout_score.get("strain"),
        "workout_average_heart_rate": workout_score.get("average_heart_rate"),
        "workout_sport_name": latest_workout.get("sport_name"),
        "workout_start": latest_workout.get("start"),
        "workout_end": latest_workout.get("end"),
    }


@router.get("/connect")
async def connect_whoop(patient_id: str = Query(..., min_length=1)):
    if not _whoop_configured():
        return _patient_redirect_with_error(
            patient_id,
            "whoop_not_ready",
            "WHOOP credentials are missing on the backend deployment.",
        )
    if not _public_base_configured():
        return _patient_redirect_with_error(
            patient_id,
            "callback_not_ready",
            "PUBLIC_BASE_URL is still using a placeholder. Add the real Railway URL and redeploy.",
        )
    client_id, _ = _require_whoop_env()
    query = urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": _redirect_uri(),
            "scope": os.getenv("WHOOP_SCOPE", DEFAULT_SCOPE),
            "state": _encode_state(patient_id),
        }
    )
    return RedirectResponse(url=f"{WHOOP_AUTH_URL}?{query}", status_code=307)


@router.get("/callback")
async def whoop_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
):
    patient_id = None
    if state:
        try:
            patient_id = _decode_state(state)
        except HTTPException:
            patient_id = None

    if error:
        return _patient_redirect_with_error(
            patient_id,
            error,
            error_description or "WHOOP did not complete the authorization flow.",
        )

    if not code or not state:
        return _patient_redirect_with_error(
            patient_id,
            "missing_callback_data",
            "WHOOP returned without the code or state we need to finish connection.",
        )

    if patient_id is None:
        return _patient_redirect_with_error(
            None,
            "invalid_state",
            "WHOOP returned an invalid state token. Start the connection again from the app.",
        )

    try:
        client_id, client_secret = _require_whoop_env()
    except HTTPException:
        return _patient_redirect_with_error(
            patient_id,
            "whoop_not_ready",
            "WHOOP credentials are missing on the backend deployment.",
        )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                WHOOP_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": _redirect_uri(),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            token_data = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:180] if exc.response is not None else str(exc)
        return _patient_redirect_with_error(
            patient_id,
            "token_exchange_failed",
            f"WHOOP token exchange failed. Check redirect URL and backend env. {detail}",
        )
    except httpx.HTTPError as exc:
        return _patient_redirect_with_error(
            patient_id,
            "whoop_network_error",
            f"WHOOP could not be reached from the backend. {exc}",
        )

    connection = (
        db.query(WhoopConnection)
        .filter(WhoopConnection.patient_id == patient_id)
        .first()
    )
    if not connection:
        connection = WhoopConnection(patient_id=patient_id)
        db.add(connection)

    connection.access_token = token_data["access_token"]
    connection.refresh_token = token_data.get("refresh_token")
    connection.scope = token_data.get("scope")
    connection.token_type = token_data.get("token_type")
    connection.expires_at = _utc_now() + timedelta(
        seconds=int(token_data.get("expires_in", 3600))
    )
    connection.is_connected = True

    try:
        await _sync_connection(connection)
    except httpx.HTTPStatusError as exc:
        db.rollback()
        detail = exc.response.text[:180] if exc.response is not None else str(exc)
        return _patient_redirect_with_error(
            patient_id,
            "sync_failed",
            f"WHOOP connected, but pulling profile data failed. {detail}",
        )
    except httpx.HTTPError as exc:
        db.rollback()
        return _patient_redirect_with_error(
            patient_id,
            "whoop_network_error",
            f"WHOOP connected, but sync failed due to a network issue. {exc}",
        )
    db.commit()

    return RedirectResponse(url=_patient_app_url(patient_id), status_code=302)


@router.get("/latest/{patient_id}")
def latest_whoop(patient_id: str, db: Session = Depends(get_db)):
    connection = (
        db.query(WhoopConnection)
        .filter(WhoopConnection.patient_id == patient_id)
        .first()
    )
    if not connection:
        return {
            "patient_id": patient_id,
            "configured": _whoop_configured(),
            "connected": False,
            "provider": "whoop",
            "latest": {},
            "setup_required": True,
        }
    summary = connection.to_summary()
    summary["configured"] = _whoop_configured()
    return summary


@router.post("/sync/{patient_id}")
async def sync_whoop(patient_id: str, db: Session = Depends(get_db)):
    connection = (
        db.query(WhoopConnection)
        .filter(WhoopConnection.patient_id == patient_id)
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="WHOOP is not connected yet")

    try:
        await _sync_connection(connection)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"WHOOP sync failed: {exc}") from exc

    db.commit()
    db.refresh(connection)
    return connection.to_summary()


@router.post("/webhook")
async def whoop_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    user_id = payload.get("user_id") or payload.get("userId")

    if user_id is not None:
        connection = (
            db.query(WhoopConnection)
            .filter(WhoopConnection.whoop_user_id == str(user_id))
            .first()
        )
        if connection:
            try:
                await _sync_connection(connection)
                db.commit()
            except Exception:
                db.rollback()

    return {"status": "ok"}
