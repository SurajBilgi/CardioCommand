function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function getPatientVitals(patient) {
  return patient?.current_vitals || {}
}

export function getAdherenceInsight(patient, vitals = {}) {
  let score = 18
  const reasons = []
  const rehab = patient?.rehab || {}

  if ((vitals.steps_today ?? 0) < 900) {
    score += 24
    reasons.push('Activity is below today’s recovery target')
  }

  if ((vitals.sleep_hours ?? 8) < 6 || (vitals.sleep_quality ?? 100) < 55) {
    score += 18
    reasons.push('Poor sleep makes rehab drop-off more likely')
  }

  if ((vitals.stress_index ?? 0) >= 6) {
    score += 10
    reasons.push('Stress is elevated and may reduce confidence')
  }

  if ((vitals.risk_score ?? 0) >= 70) {
    score += 18
    reasons.push('Symptoms may make the patient avoid activity')
  }

  if ((patient?.days_post_op ?? 0) >= 7 && (patient?.days_post_op ?? 0) <= 21) {
    score += 12
    reasons.push('This is a common drop-off window for rehab engagement')
  }

  if ((vitals.afib_risk ?? 0) >= 50 || /afib/i.test(vitals.ecg_rhythm || '')) {
    score += 12
    reasons.push('Rhythm concerns may cause fear-driven disengagement')
  }

  if ((rehab.sessions_this_week ?? 0) < Math.max(1, (rehab.sessions_goal ?? 3) - 1)) {
    score += 18
    reasons.push('Rehab sessions are falling behind this week')
  }

  if (rehab.last_barrier_reason) {
    score += 14
    reasons.push(`Last skipped reason: ${rehab.last_barrier_reason}`)
  }

  if ((rehab.last_session_duration_seconds ?? 0) > 0 && (rehab.last_session_duration_seconds ?? 0) < 8 * 60) {
    score += 8
    reasons.push('Recent rehab session ended early and may need coaching')
  }

  score = clamp(score, 0, 100)

  const level = score >= 75 ? 'high' : score >= 45 ? 'moderate' : 'low'
  const summary = level === 'high'
    ? 'High risk of disengaging from recovery tasks this week'
    : level === 'moderate'
    ? 'Needs light-touch encouragement to stay on plan'
    : 'Likely to stay on track with simple check-ins'

  return { score, level, summary, reasons: reasons.slice(0, 4) }
}

export function getAlertExplanation(patient, vitals = {}) {
  const reasons = []
  const evidence = []
  const rehab = patient?.rehab || {}

  if ((vitals.heart_rate ?? 0) > 100) {
    reasons.push('Heart rate is elevated above the safe recovery range')
    evidence.push(`HR ${Math.round(vitals.heart_rate)} bpm`)
  }

  if ((vitals.spo2 ?? 100) < 95) {
    reasons.push('Oxygen saturation is trending below target')
    evidence.push(`SpO₂ ${Math.round(vitals.spo2)}%`)
  }

  if ((vitals.hrv ?? 100) < 20) {
    reasons.push('HRV is suppressed, suggesting physiologic strain')
    evidence.push(`HRV ${Math.round(vitals.hrv)}`)
  }

  if ((vitals.sleep_hours ?? 8) < 6) {
    reasons.push('Sleep debt may be worsening recovery capacity')
    evidence.push(`${vitals.sleep_hours?.toFixed?.(1) || vitals.sleep_hours} hrs sleep`)
  }

  if ((vitals.afib_risk ?? 0) >= 50 || /afib/i.test(vitals.ecg_rhythm || '')) {
    reasons.push('Rhythm pattern is concerning for AFib or unstable rhythm')
    evidence.push(vitals.ecg_rhythm || `AFib risk ${vitals.afib_risk}%`)
  }

  if ((vitals.steps_today ?? 9999) < 700) {
    reasons.push('Mobility is far below the expected recovery goal')
    evidence.push(`${Math.round(vitals.steps_today || 0)} steps`)
  }

  if (rehab.last_barrier_reason) {
    reasons.push('Recent rehab friction is contributing to today’s recovery risk')
    evidence.push(`Barrier: ${rehab.last_barrier_reason}`)
  }

  if (reasons.length === 0) {
    reasons.push('No major physiologic trigger is active right now')
    evidence.push('Vitals remain in the expected post-op range')
  }

  return {
    reasons: reasons.slice(0, 4),
    evidence: evidence.slice(0, 4),
  }
}

export function getRecommendedNextAction(patient, vitals = {}, adherenceInsight = getAdherenceInsight(patient, vitals)) {
  const rehab = patient?.rehab || {}

  if ((vitals.alert?.type === 'critical') || (vitals.risk_score ?? 0) >= 85 || (vitals.afib_risk ?? 0) >= 70) {
    return {
      urgency: 'now',
      label: 'Immediate clinician call',
      detail: 'Escalate to a cardiology review now and prepare ED guidance if symptoms worsen.',
      owner: 'RN or cardiologist',
      actions: ['Call patient within 5 minutes', 'Review rhythm trend', 'Confirm red-flag symptoms'],
    }
  }

  if (adherenceInsight.level === 'high') {
    return {
      urgency: 'today',
      label: 'Recovery coaching outreach',
      detail: rehab.last_barrier_reason
        ? `Use reassurance around "${rehab.last_barrier_reason}" and offer a lighter recovery task today.`
        : 'Use reassurance plus a lighter rehab goal so the patient does not disengage this week.',
      owner: 'Care coordinator',
      actions: ['Send encouragement message', 'Reduce today’s activity goal', 'Book a same-day follow-up touchpoint'],
    }
  }

  if ((vitals.risk_score ?? 0) >= 60 || (vitals.spo2 ?? 100) < 95 || (vitals.heart_rate ?? 0) > 100) {
    return {
      urgency: 'today',
      label: 'Same-day outreach',
      detail: 'Check symptoms, reinforce rest and meds, and confirm tomorrow’s plan before the patient deteriorates.',
      owner: 'Nurse triage',
      actions: ['Call before end of day', 'Review medication adherence', 'Assess need for clinic visit'],
    }
  }

  return {
    urgency: 'routine',
    label: 'Continue scheduled check-in',
    detail: 'Patient appears stable. Keep the next planned check-in and reinforce small recovery goals.',
    owner: 'Care team',
    actions: ['Send routine encouragement', 'Keep current recovery plan', 'Review trends at next visit'],
  }
}

export function getPopulationInsights(patients = []) {
  const summaries = patients.map(patient => {
    const vitals = getPatientVitals(patient)
    const adherence = getAdherenceInsight(patient, vitals)
    const nextAction = getRecommendedNextAction(patient, vitals, adherence)
    return { patient, vitals, adherence, nextAction }
  })

  const likelyToSkip = summaries.filter(item => item.adherence.level === 'high')
  const worseningRecovery = summaries.filter(item =>
    (item.vitals.sleep_quality ?? 100) < 50 ||
    (item.vitals.sleep_hours ?? 8) < 5.5 ||
    (item.vitals.hrv ?? 100) < 18
  )
  const followUpToday = summaries.filter(item =>
    item.nextAction.urgency === 'now' || item.nextAction.urgency === 'today'
  )
  const stable = summaries.filter(item => (item.vitals.risk_score ?? 0) < 35 && item.adherence.level === 'low')

  return {
    likelyToSkip,
    worseningRecovery,
    followUpToday,
    stable,
    estimatedReadmissionsPrevented: likelyToSkip.length * 2 + followUpToday.length * 3 + stable.length,
  }
}
