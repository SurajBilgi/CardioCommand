from typing import Tuple


def compute_risk_score(patient: dict, vitals: dict, reasoning: str = "") -> Tuple[int, list]:
    """
    Rule-based + weighted scoring. Deterministic for demo reliability.
    Returns (score: int 0-100, reasons: list[str])
    """
    score = 0
    reasons = []

    # Vitals scoring (max 70 pts)
    hr = vitals.get("heart_rate", 70)
    if hr > 100:
        pts = min(20, int((hr - 100) * 1.5))
        score += pts
        reasons.append(f"Heart rate elevated at {hr} bpm (target <100)")

    spo2 = vitals.get("spo2", 98)
    if spo2 < 95:
        pts = min(25, int((95 - spo2) * 8))
        score += pts
        reasons.append(f"SpO\u2082 at {spo2}% — below safe threshold of 95%")

    hrv = vitals.get("hrv", 40)
    if hrv < 20:
        score += 15
        reasons.append(f"HRV critically low at {hrv}ms — indicates cardiac stress")

    ecg = vitals.get("ecg_rhythm", "")
    if "Fibrillation" in str(ecg):
        score += 30
        reasons.append("Atrial Fibrillation detected on ECG rhythm analysis")

    # Respiratory rate
    rr = vitals.get("respiratory_rate", 14)
    if rr > 20:
        score += 10
        reasons.append(f"Elevated respiratory rate at {rr} brpm (normal 12-20)")

    # Patient profile scoring (max 30 pts)
    ef = patient.get("ejection_fraction", 55)
    if ef < 40:
        pts = int((40 - ef) * 1.2)
        score += min(pts, 20)
        reasons.append(f"Reduced ejection fraction of {ef}% (normal >55%)")

    comorbidities = patient.get("comorbidities", [])
    if any("Diabetes" in c for c in comorbidities):
        score += 8
        reasons.append("Diabetes increases post-surgical complication risk")

    if any("Heart Failure" in c for c in comorbidities):
        score += 10
        reasons.append("Heart failure history significantly elevates readmission risk")

    # Activity scoring (max 20 pts)
    steps = vitals.get("steps_today", 2000)
    if steps < 500:
        score += 15
        reasons.append(f"Near-zero mobility ({steps} steps) — strong readmission predictor")
    elif steps < 1000:
        score += 8
        reasons.append(f"Low mobility ({steps} steps) — activity target not met")

    sleep = vitals.get("sleep_quality", 70)
    if sleep < 45:
        score += 8
        reasons.append(f"Poor sleep quality ({sleep}%) — impairs cardiac recovery")

    stress = vitals.get("stress_index", 3)
    if stress > 7:
        score += 5
        reasons.append(f"High stress index ({stress}/10) — elevates cardiac demand")

    return min(score, 100), reasons[:4]


def get_alert_level(score: int, vitals: dict) -> str:
    ecg = vitals.get("ecg_rhythm", "")
    spo2 = vitals.get("spo2", 100)

    if "Fibrillation" in str(ecg) or spo2 < 90:
        return "critical"
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    if score >= 35:
        return "low"
    return "none"
