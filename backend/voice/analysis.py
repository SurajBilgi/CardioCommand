"""
Post-call transcript analysis using GPT-4o.
Falls back to a rule-based summary when no OpenAI key is configured.
"""
import os
import json
import re
from typing import Optional

from voice.config import VOICE_SCRIPT


def _build_transcript_text(transcript: list[dict]) -> str:
    lines = []
    for t in transcript:
        speaker = "CORA (AI)" if t.get("speaker") == "agent" else "PATIENT"
        lines.append(f"{speaker}: {t.get('text', '')}")
    return "\n".join(lines)


def _rule_based_analysis(transcript: list[dict], patient: dict) -> dict:
    """Simple keyword-based fallback when GPT-4o is unavailable."""
    patient_turns = [t["text"].lower() for t in transcript if t.get("speaker") == "patient"]
    full_text = " ".join(patient_turns)

    flags = []
    if any(w in full_text for w in ["pain", "chest", "pressure", "tight"]):
        flags.append("⚠️ Possible cardiac symptom mentioned — chest pain/pressure")
    if any(w in full_text for w in ["breath", "breathe", "breathing"]):
        flags.append("⚠️ Breathing difficulty mentioned")
    if any(w in full_text for w in ["forgot", "missed", "didn't take", "no medication"]):
        flags.append("⚠️ Possible medication non-adherence")
    if any(w in full_text for w in ["swelling", "swollen", "weight"]):
        flags.append("⚠️ Possible fluid retention / oedema")
    if any(w in full_text for w in ["dizzy", "faint", "lightheaded"]):
        flags.append("⚠️ Dizziness mentioned")

    wellbeing_score = None
    for turn in patient_turns:
        numbers = re.findall(r'\b([1-9]|10)\b', turn)
        if numbers:
            wellbeing_score = int(numbers[0])
            break

    severity = "low"
    if flags:
        severity = "high" if len(flags) >= 2 else "medium"

    questions = VOICE_SCRIPT.get("questions", [])
    qa_pairs = []
    for i, q in enumerate(questions):
        patient_response = ""
        for t in transcript:
            if t.get("speaker") == "patient" and t.get("question_id") == q["id"]:
                patient_response = t.get("text", "")
                break
        qa_pairs.append({
            "category": q["category"],
            "question": q["ask"][:80] + ("…" if len(q["ask"]) > 80 else ""),
            "response": patient_response or "[No response captured]",
        })

    return {
        "summary": (
            f"Post-call summary for {patient.get('name', 'patient')} "
            f"(Day {patient.get('days_post_op', '?')} post-op). "
            + (f"Self-reported wellbeing: {wellbeing_score}/10. " if wellbeing_score else "")
            + (f"{len(flags)} concern(s) flagged." if flags else "No major concerns flagged.")
        ),
        "wellbeing_score": wellbeing_score,
        "flags": flags,
        "severity": severity,
        "recommended_actions": _default_actions(flags, severity),
        "qa_pairs": qa_pairs,
        "medication_adherence": "unknown",
        "generated_by": "rule_based",
    }


def _default_actions(flags: list, severity: str) -> list[str]:
    actions = []
    if severity == "high":
        actions.append("Schedule same-day physician review")
    if any("cardiac" in f or "chest" in f for f in flags):
        actions.append("Review ECG and latest vitals immediately")
    if any("medication" in f for f in flags):
        actions.append("Follow up on medication adherence — pharmacy check")
    if any("fluid" in f or "swelling" in f for f in flags):
        actions.append("Check daily weight log — consider diuretic adjustment")
    if not actions:
        actions.append("No immediate action required — routine follow-up at next appointment")
    return actions


async def analyze_transcript(
    transcript: list[dict],
    patient: dict,
    current_vitals: Optional[dict] = None,
) -> dict:
    """
    Analyse a call transcript with GPT-4o.
    Falls back to rule-based analysis if OpenAI is unavailable.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _rule_based_analysis(transcript, patient)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        transcript_text = _build_transcript_text(transcript)
        vitals_text = ""
        if current_vitals:
            vitals_text = (
                f"\nCurrent vitals: HR {current_vitals.get('heart_rate', '?')}bpm, "
                f"SpO₂ {current_vitals.get('spo2', '?')}%, "
                f"Risk score {current_vitals.get('risk_score', '?')}/100."
            )

        system_prompt = (
            "You are a clinical AI assistant analysing a post-surgery patient wellness call. "
            "Extract structured insights from the transcript. "
            "Be concise, clinical, and actionable. Return valid JSON only."
        )

        user_prompt = f"""
Patient: {patient.get('name')} | Surgery: {patient.get('surgery_type')} | Day {patient.get('days_post_op')} post-op{vitals_text}

CALL TRANSCRIPT:
{transcript_text}

Return a JSON object with these exact keys:
- summary (string, 2-3 sentences): Clinical summary of the call
- wellbeing_score (int or null): Self-reported wellbeing 1-10
- medication_adherence ("full" | "partial" | "none" | "unknown")
- flags (array of strings): Clinical concerns requiring attention (empty array if none)
- severity ("low" | "medium" | "high" | "critical"): Overall concern level
- recommended_actions (array of strings): 1-4 specific actions for the care team
- qa_pairs (array of {{"category": str, "question": str, "response": str}}): Key Q&A pairs
- mood_assessment (string): Brief assessment of patient's emotional state
- generated_by: "gpt4o"
"""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=800,
        )

        result = json.loads(response.choices[0].message.content)
        result["generated_by"] = "gpt4o"
        return result

    except Exception as exc:
        fallback = _rule_based_analysis(transcript, patient)
        fallback["error"] = str(exc)
        return fallback
