"""
Voice Agent Script Configuration
=================================
Edit the values in VOICE_SCRIPT to customise everything the AI says during a call.
Placeholders are marked with [  ] — fill them in before your demo.

Template variables you can use inside any string:
  {patient_name}    → e.g. "John Mercer"
  {agent_name}      → value of VOICE_SCRIPT["agent_name"]
  {hospital_name}   → value of VOICE_SCRIPT["hospital_name"]
  {doctor_name}     → value of VOICE_SCRIPT["doctor_name"]
  {surgery_type}    → e.g. "Coronary Artery Bypass Graft"
  {days_post_op}    → e.g. "8"
"""

VOICE_SCRIPT = {

    # ── Identity ──────────────────────────────────────────────────────────────
    "hospital_name": "[YOUR HOSPITAL NAME]",       # e.g. "UCSF Medical Center"
    "agent_name":    "Cora",                        # AI agent name spoken on calls
    "doctor_name":   "[DR. FULL NAME]",             # e.g. "Dr. Kavitha Rao"
    "nurse_line":    "[NURSE LINE NUMBER]",         # e.g. "1-800-555-0199"

    # ── Greeting (spoken immediately after patient picks up) ─────────────────
    "greeting": (
        "Hi {patient_name}, this is {agent_name} calling from {hospital_name}. "
        "I'm an AI health assistant supporting {doctor_name}'s care team. "
        "I'm calling to do a quick wellness check-in — it has been {days_post_op} days "
        "since your {surgery_type}. "
        "This will only take about two to three minutes. "
        "Is now a good time?"
    ),

    # ── What to say after patient confirms they can talk ─────────────────────
    "greeting_confirmation": (
        "[PLACEHOLDER — e.g. 'Wonderful, let's get started!' "
        "or 'Great, I really appreciate you taking the time.']"
    ),

    # ── Questions (asked in order) ────────────────────────────────────────────
    # Each question has:
    #   id          → unique key used in analysis
    #   category    → label shown in the UI and analysis report
    #   ask         → the question spoken to the patient
    #   follow_up   → optional response after patient answers (leave placeholder to skip)
    #   hint        → brief note for the doctor (shown in UI, not spoken)
    "questions": [
        {
            "id": "wellbeing",
            "category": "Overall Wellbeing",
            "ask": (
                "On a scale of 1 to 10, with 1 being very poor and 10 being excellent, "
                "how would you rate your overall wellbeing today?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'Thank you for sharing that.' "
                "or 'A score of [X] — let's explore that a little further.']"
            ),
            "hint": "Baseline subjective wellbeing — flag anything below 5",
        },
        {
            "id": "cardiac_symptoms",
            "category": "Cardiac Symptoms",
            "ask": (
                "Have you experienced any chest pain, pressure, tightness, "
                "shortness of breath, or heart palpitations in the last 24 hours?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'Can you describe what the chest discomfort feels like?' "
                "or 'Good, no symptoms is exactly what we want to hear.']"
            ),
            "hint": "Any 'yes' here should be immediately flagged as critical",
        },
        {
            "id": "medications",
            "category": "Medication Adherence",
            "ask": (
                "Have you been able to take all of your prescribed medications today "
                "at the right times?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'Which medication did you miss, and do you know why?' "
                "or 'Excellent — staying consistent with your medications is so important.']"
            ),
            "hint": "Ask which medication was missed if answer is no",
        },
        {
            "id": "activity",
            "category": "Physical Activity",
            "ask": (
                "How much have you been moving around today? "
                "Have you managed any light walking or gentle activity?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'That's great progress!' "
                "or 'Even a short 5-minute walk around the house can help with recovery.']"
            ),
            "hint": "Target: 10–15 min light walking by day 7+",
        },
        {
            "id": "sleep",
            "category": "Sleep Quality",
            "ask": (
                "How did you sleep last night? "
                "Were you able to get a solid night's rest, or did you have trouble sleeping?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'Poor sleep can slow recovery — I'll flag this for Dr. {doctor_name}.' "
                "or 'Good sleep is so important for healing — well done.']"
            ),
            "hint": "Poor sleep may indicate pain, anxiety, or medication side effects",
        },
        {
            "id": "swelling",
            "category": "Fluid & Swelling",
            "ask": (
                "Have you noticed any swelling in your ankles, feet, or legs, "
                "or any sudden weight gain in the last couple of days?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'Swelling can sometimes indicate fluid retention — "
                "I'll make sure {doctor_name} reviews this.' "
                "or 'Perfect, no swelling is a great sign.']"
            ),
            "hint": "Oedema or rapid weight gain (>2lb/day) may indicate decompensation",
        },
        {
            "id": "open_concerns",
            "category": "Open Concerns",
            "ask": (
                "Is there anything else on your mind — any worries, questions, "
                "or anything you'd like {doctor_name} to know about?"
            ),
            "follow_up": (
                "[PLACEHOLDER — e.g. 'That's really helpful, I'll make sure the care team sees this.' "
                "or 'Great — it sounds like things are progressing well.']"
            ),
            "hint": "Open-ended — capture any unstructured concerns",
        },
    ],

    # ── Closing (spoken after all questions are answered) ────────────────────
    "closing": (
        "[PLACEHOLDER — e.g. 'Thank you so much for your time today, {patient_name}. "
        "I've noted everything you shared and will pass it directly to {doctor_name} right away. "
        "If you experience any sudden chest pain, difficulty breathing, or feel something is wrong, "
        "please call our nurse line immediately at {nurse_line}, or call 9-1-1. "
        "Otherwise, take it easy and have a wonderful rest of your day. Take care!']"
    ),

    # ── TTS voice settings (Web Speech API / browser demo) ───────────────────
    "tts": {
        "preferred_voice": "Samantha",   # macOS: "Samantha" | Chrome: "Google US English"
        "rate":   0.88,                  # 0.1–2.0  (1.0 = normal speed)
        "pitch":  1.05,                  # 0.0–2.0
        "volume": 1.0,                   # 0.0–1.0
    },

    # ── STT settings (Web Speech API) ────────────────────────────────────────
    "stt": {
        "language":        "en-US",
        "max_listen_sec":  20,    # hard cutoff per question
        "silence_gap_sec": 2.5,   # stop listening after this many seconds of silence
    },

    # ── Twilio settings (only used when Twilio mode is enabled) ──────────────
    "twilio": {
        "tts_voice": "Polly.Joanna",   # Amazon Polly voice via Twilio
        "tts_rate":  "85%",            # Twilio SSML rate
        "gather_timeout": 10,          # seconds to wait for speech input
        "gather_speech_timeout": 5,    # seconds of silence before gather ends
    },
}
