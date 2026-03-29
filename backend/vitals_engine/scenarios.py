SCENARIOS = {
    "normal_recovery": {
        "label": "Day 3 — Normal Recovery",
        "day": 3,
        "description": "Patient recovering well, all metrics in normal range",
        "vitals": {
            "heart_rate":       {"base": 72,    "noise": 3,   "trend": "stable"},
            "hrv":              {"base": 45,    "noise": 5,   "trend": "stable"},
            "spo2":             {"base": 97,    "noise": 0.5, "trend": "stable"},
            "respiratory_rate": {"base": 14,    "noise": 1,   "trend": "stable"},
            "skin_temperature": {"base": 98.1,  "noise": 0.2, "trend": "stable"},
            "ecg_rhythm":       {"value": "Normal Sinus Rhythm"},
            "afib_risk":        {"base": 8,     "noise": 2},
            "steps_today":      {"base": 1800,  "noise": 100},
            "activity_level":   {"value": "Light"},
            "sleep_quality":    {"base": 72,    "noise": 5},
            "sleep_hours":      {"base": 7.2,   "noise": 0.3},
            "stress_index":     {"base": 3,     "noise": 0.5},
        },
        "risk_score": 38,
        "alert": None
    },

    "early_warning": {
        "label": "Day 7 — Early Warning Signs",
        "day": 7,
        "description": "HR elevated, HRV declining, SpO2 dipping. Patient reports fatigue.",
        "vitals": {
            "heart_rate":       {"base": 96,    "noise": 4,   "trend": "rising"},
            "hrv":              {"base": 18,    "noise": 3,   "trend": "declining"},
            "spo2":             {"base": 93,    "noise": 1,   "trend": "declining"},
            "respiratory_rate": {"base": 19,    "noise": 1.5, "trend": "rising"},
            "skin_temperature": {"base": 99.1,  "noise": 0.3, "trend": "rising"},
            "ecg_rhythm":       {"value": "Sinus Tachycardia"},
            "afib_risk":        {"base": 28,    "noise": 4},
            "steps_today":      {"base": 600,   "noise": 80},
            "activity_level":   {"value": "Sedentary"},
            "sleep_quality":    {"base": 44,    "noise": 8},
            "sleep_hours":      {"base": 5.1,   "noise": 0.4},
            "stress_index":     {"base": 6.5,   "noise": 0.7},
        },
        "risk_score": 71,
        "alert": {
            "type": "yellow",
            "message": "HR elevated for 48hrs. HRV declining. SpO2 borderline. Recommend same-day outreach."
        }
    },

    "afib_detected": {
        "label": "Day 10 — AFib Event",
        "day": 10,
        "description": "Irregular rhythm detected. AFib risk high. CRITICAL alert.",
        "vitals": {
            "heart_rate":       {"base": 112,   "noise": 15,  "trend": "irregular"},
            "hrv":              {"base": 8,     "noise": 6,   "trend": "chaotic"},
            "spo2":             {"base": 91,    "noise": 2,   "trend": "declining"},
            "respiratory_rate": {"base": 22,    "noise": 2,   "trend": "rising"},
            "skin_temperature": {"base": 99.4,  "noise": 0.3},
            "ecg_rhythm":       {"value": "Atrial Fibrillation — DETECTED"},
            "afib_risk":        {"base": 87,    "noise": 5},
            "steps_today":      {"base": 200,   "noise": 50},
            "activity_level":   {"value": "Bedrest"},
            "sleep_quality":    {"base": 28,    "noise": 10},
            "sleep_hours":      {"base": 3.8,   "noise": 0.5},
            "stress_index":     {"base": 9,     "noise": 0.5},
        },
        "risk_score": 94,
        "alert": {
            "type": "critical",
            "message": "CRITICAL: Atrial Fibrillation detected. Irregular rhythm persisting >2hrs. Immediate physician review required."
        }
    },

    "pre_visit": {
        "label": "Day 13 — Pre-Visit",
        "day": 13,
        "description": "Appointment tomorrow. Metrics partially recovered but HR still elevated.",
        "vitals": {
            "heart_rate":       {"base": 88,    "noise": 3,   "trend": "stable"},
            "hrv":              {"base": 28,    "noise": 4},
            "spo2":             {"base": 95,    "noise": 0.5},
            "respiratory_rate": {"base": 16,    "noise": 1},
            "skin_temperature": {"base": 98.4,  "noise": 0.2},
            "ecg_rhythm":       {"value": "Normal Sinus Rhythm"},
            "afib_risk":        {"base": 19,    "noise": 3},
            "steps_today":      {"base": 1200,  "noise": 100},
            "activity_level":   {"value": "Light"},
            "sleep_quality":    {"base": 58,    "noise": 6},
            "sleep_hours":      {"base": 6.4,   "noise": 0.3},
            "stress_index":     {"base": 4.5,   "noise": 0.5},
        },
        "risk_score": 55,
        "alert": {
            "type": "yellow",
            "message": "Appointment tomorrow 2:00 PM. Pre-visit brief ready. HR still above baseline."
        }
    },

    "full_recovery": {
        "label": "Day 30 — Full Recovery",
        "day": 30,
        "description": "Patient has fully recovered. All metrics normalized.",
        "vitals": {
            "heart_rate":       {"base": 68,    "noise": 2,   "trend": "stable"},
            "hrv":              {"base": 52,    "noise": 4},
            "spo2":             {"base": 98,    "noise": 0.3},
            "respiratory_rate": {"base": 13,    "noise": 1},
            "skin_temperature": {"base": 97.9,  "noise": 0.2},
            "ecg_rhythm":       {"value": "Normal Sinus Rhythm"},
            "afib_risk":        {"base": 6,     "noise": 2},
            "steps_today":      {"base": 4200,  "noise": 300},
            "activity_level":   {"value": "Moderate"},
            "sleep_quality":    {"base": 81,    "noise": 4},
            "sleep_hours":      {"base": 7.8,   "noise": 0.2},
            "stress_index":     {"base": 2,     "noise": 0.4},
        },
        "risk_score": 14,
        "alert": None
    }
}
