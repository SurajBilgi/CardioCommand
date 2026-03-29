export const PATIENT_ID = 'john-mercer'

export const REHAB_PROGRAM = {
  currentWeek: 2,
  totalWeeks: 12,
  currentStreak: 4,
  bestStreak: 9,
  sessionsThisWeek: 2,
  sessionsGoal: 3,
  prescribedWalkMinutes: 20,
}

function buildNextAppointment(daysAhead = 3) {
  const appointment = new Date()
  appointment.setDate(appointment.getDate() + daysAhead)
  appointment.setHours(14, 0, 0, 0)
  return appointment.toISOString()
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getWeekProgressPercent(currentWeek, totalWeeks) {
  if (!totalWeeks) return 0
  return Math.min(100, Math.max(0, (currentWeek / totalWeeks) * 100))
}

export const DEMO_INSURANCE = {
  provider: 'Medicare',
  plan_name: 'Medicare Advantage — Blue Shield',
  member_id: '1EG4-TE5-MK72',
  group_number: 'GRP-00341',
  coverage_type: 'Primary',
  copay_office: '$20',
  copay_specialist: '$50',
  rehab_sessions_covered: 36,
  rehab_sessions_used: 4,
  deductible_met: true,
  customer_service: '1-800-633-4227',
  rx_bin: '610014',
  rx_pcn: 'PRVDR',
}

export const DEMO_MEDICATIONS = [
  {
    name: 'Metoprolol',
    dose: '25mg',
    frequency: 'twice daily',
    time: ['08:00', '20:00'],
    why: 'Keeps your heart rate from going too fast and reduces stress on your heart.',
    sideEffects: 'May make you feel tired or slightly lightheaded. Do not skip doses.',
    timingLabel: 'Morning and evening (8:00 AM, 8:00 PM)',
  },
  {
    name: 'Lisinopril',
    dose: '10mg',
    frequency: 'once daily',
    time: ['08:00'],
    why: 'Helps your heart muscle recover and keeps blood pressure in a safe range.',
    sideEffects: 'May cause a dry cough in some people. Tell us if that bothers you.',
    timingLabel: 'Once daily in the morning',
  },
  {
    name: 'Aspirin',
    dose: '81mg',
    frequency: 'once daily',
    time: ['08:00'],
    why: 'Helps prevent blood clots and protects the new bypass grafts.',
    sideEffects: 'May cause mild stomach upset. Taking it with food often helps.',
    timingLabel: 'Once daily in the morning',
  },
  {
    name: 'Atorvastatin',
    dose: '40mg',
    frequency: 'nightly',
    time: ['21:00'],
    why: 'Helps lower cholesterol and keeps plaque in your arteries more stable.',
    sideEffects: 'Rarely causes muscle aches. Tell us if your muscles feel unusually sore.',
    timingLabel: 'Once daily at bedtime (9:00 PM)',
  },
  {
    name: 'Furosemide',
    dose: '20mg',
    frequency: 'once daily',
    time: ['08:00'],
    why: 'Helps your body clear extra fluid and reduces swelling.',
    sideEffects: 'You may urinate more often. Taking it in the morning helps you sleep better.',
    timingLabel: 'Once daily in the morning',
  },
]

export const DEMO_PATIENT = {
  id: PATIENT_ID,
  name: 'John Mercer',
  age: 67,
  surgery_type: 'Coronary Artery Bypass Graft (CABG)',
  days_post_op: 8,
  ejection_fraction: 35,
  attending: 'Dr. Kavitha Rao',
  next_appointment: buildNextAppointment(),
  comorbidities: ['Type 2 Diabetes', 'Hypertension', 'CKD Stage 2'],
  medications: DEMO_MEDICATIONS,
  insurance: DEMO_INSURANCE,
}

export const DOCTOR_SHORT_NAME = 'Dr. Rao'

export const DEMO_VITALS = {
  heart_rate: 96,
  hrv: 18,
  spo2: 93,
  respiratory_rate: 19,
  skin_temperature: 99.1,
  ecg_rhythm: 'Sinus Rhythm',
  afib_risk: 18,
  steps_today: 600,
  activity_level: 'Gentle recovery',
  sleep_quality: 44,
  sleep_hours: 5.1,
  stress_index: 6.1,
  risk_score: 63,
  alert: {
    type: 'yellow',
    message: 'Oxygen is a little low today. Keep your pace gentle and rest when needed.',
  },
}

export const DEMO_VITAL_TRENDS = {
  heartRate: {
    headline: 'Heart rate has stayed fairly steady this week',
    trend: 'stable',
  },
  oxygen: {
    headline: 'Oxygen has been a little lower than usual — slow breathing and rest help',
    trend: 'stable',
  },
  sleep: {
    headline: 'Sleep has been short this week — extra rest will help recovery',
    trend: 'stable',
  },
  steps: {
    headline: 'Activity is building slowly — short walks are enough for now',
    trend: 'stable',
  },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function buildDemoVitalsHistory(count = 60) {
  const safeCount = Math.max(2, count)
  const weekSpanMs = 7 * 24 * 60 * 60 * 1000
  const stepMs = weekSpanMs / (safeCount - 1)
  const startTime = Date.now() - weekSpanMs

  const history = Array.from({ length: safeCount }, (_, index) => {
    const progress = index / (safeCount - 1)
    const heartRate = +(95.2 + Math.sin(index / 5.8) * 1.8 + Math.cos(index / 11) * 0.9).toFixed(1)
    const spo2 = +(92.9 + Math.sin(index / 7.5) * 0.5 + Math.cos(index / 13) * 0.2).toFixed(1)
    const sleepQuality = +(44 + Math.sin(index / 4.2) * 3.4 + (index % 9 === 0 ? -2 : 0)).toFixed(1)
    const stepsToday = Math.round(420 + progress * 180 + Math.sin(index / 4.6) * 55)

    return {
      timestamp: new Date(startTime + stepMs * index).toISOString(),
      heart_rate: clamp(heartRate, 90, 100),
      spo2: clamp(spo2, 91.8, 94.5),
      sleep_quality: clamp(sleepQuality, 38, 50),
      steps_today: clamp(stepsToday, 320, 760),
    }
  })

  history[history.length - 1] = {
    ...history[history.length - 1],
    heart_rate: DEMO_VITALS.heart_rate,
    spo2: DEMO_VITALS.spo2,
    sleep_quality: DEMO_VITALS.sleep_quality,
    steps_today: DEMO_VITALS.steps_today,
  }

  return history
}

export function buildDemoChatSeedMessages(date = new Date()) {
  const firstName = DEMO_PATIENT.name.split(' ')[0]
  const greeting = getGreeting(date)
  const now = date.getTime()

  return [
    {
      id: '1',
      role: 'cora',
      message: `${greeting}, ${firstName}! I'm Cora, your cardiac rehab coach. You're in Week ${REHAB_PROGRAM.currentWeek} of your ${REHAB_PROGRAM.totalWeeks}-week program, and you've built a ${REHAB_PROGRAM.currentStreak}-day streak. How are you feeling today?`,
      timestamp: new Date(now - 120000).toISOString(),
    },
    {
      id: '2',
      role: 'patient',
      message: "Honestly, I'm really tired. I don't know if I have the energy for a walk today.",
      timestamp: new Date(now - 110000).toISOString(),
    },
    {
      id: '3',
      role: 'cora',
      message: `That makes sense. Week ${REHAB_PROGRAM.currentWeek} is still early recovery, and fatigue is one of the most common barriers people tell me about.\n\nCan I ask: does it feel more physical, or more like worry is making it harder to get started?`,
      timestamp: new Date(now - 100000).toISOString(),
    },
    {
      id: '4',
      role: 'patient',
      message: "More emotional I think. I'm just worried if pushing myself is actually safe after the surgery.",
      timestamp: new Date(now - 90000).toISOString(),
    },
    {
      id: '5',
      role: 'cora',
      message: `That fear makes complete sense, and it shows how much you care about recovering well.\n\nHere is what your data tells me: your heart rate has stayed steady, your oxygen is a little lower than usual, and you had a short night of sleep. That means today should be gentle, not skipped. ${DOCTOR_SHORT_NAME} designed this plan for slow, steady recovery.\n\nWhat if we tried just 10 minutes today? Not a full session, just a calm 10-minute walk. You can stop any time.`,
      timestamp: new Date(now - 80000).toISOString(),
    },
  ]
}
