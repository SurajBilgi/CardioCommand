import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import {
  DEMO_MEDICATIONS,
  DEMO_PATIENT,
  REHAB_PROGRAM,
} from '../data/patientDemoData'

const PLAN_SECTIONS = [
  {
    id: 'what_happened',
    icon: '🏥',
    title: 'What Happened in Your Surgery',
    content: `You had a ${DEMO_PATIENT.surgery_type} — we call it "bypass surgery." \n\nYour heart had arteries that were blocked, which meant blood could not flow well to your heart muscle. Your surgeon used a blood vessel from your leg to create a new path around the blockage — like building a detour road when the main highway is jammed.\n\nYour heart is now getting much better blood flow. The surgery went well.`,
    color: 'border-accent-primary',
  },
  {
    id: 'this_week',
    icon: '📅',
    title: 'What to Expect This Week',
    content: `**Day ${DEMO_PATIENT.days_post_op} (Today):**\nFatigue is normal. A ${REHAB_PROGRAM.prescribedWalkMinutes}-minute gentle walk is enough for today.\n\n**Days 9-10:**\nYou may start to feel slightly more energetic. Continue short walks and call us if your ankle swelling gets worse.\n\n**Days 11-14:**\nMost people feel meaningfully better by now. Try 10-15 minute walks and light activities around the house.\n\n**Week ${REHAB_PROGRAM.currentWeek + 1}-${REHAB_PROGRAM.currentWeek + 2}:**\nYou should feel more like yourself. Walking 20-30 minutes daily becomes the goal, and we will talk about driving at your next visit.`,
    color: 'border-accent-warm',
  },
  {
    id: 'medications',
    icon: '💊',
    title: 'Your Medications',
    content: null,
    medications: DEMO_MEDICATIONS.map(med => ({
      name: `${med.name} ${med.dose}`,
      why: med.why,
      sideEffects: med.sideEffects,
      timing: med.timingLabel,
    })),
    color: 'border-accent-calm',
  },
  {
    id: 'emergency',
    icon: '🔴',
    title: 'Call 911 Immediately If...',
    urgent: true,
    items: [
      'Chest pain or pressure that feels crushing, squeezing, or heavy',
      'Pain that spreads to your arm, jaw, neck, or back',
      'Sudden severe shortness of breath that doesn\'t improve with rest',
      'Fainting or feeling like you might faint',
      'One side of your face droops, one arm is weak, or your speech is slurred (stroke signs)',
      'Your sternal wound opens up',
    ],
    color: 'border-red-400',
  },
  {
    id: 'yellow_signs',
    icon: '🟡',
    title: 'Call Our Office Same Day If...',
    items: [
      'Fever over 100.4°F (38°C)',
      'Your ankle swelling is getting worse day by day',
      'Heart rate above 100 for more than 2 hours',
      'Wound is red, warm, or has any discharge',
      'Feeling unusually tired — much more than yesterday',
      'You\'ve missed 2 or more medication doses',
    ],
    color: 'border-amber-400',
  },
  {
    id: 'activity',
    icon: '🚶',
    title: 'Activity Guidelines',
    content: `**Walking:** Yes, gentle walks! 10 minutes, 3 times a day this week.\n\n**Driving:** Not yet — you cannot safely turn the steering wheel with your chest healing. We\'ll clear you at your next visit (usually 4-6 weeks total).\n\n**Showering:** Yes, shower daily. Pat your chest wound dry. No soaking in baths yet.\n\n**Lifting:** Nothing heavier than a gallon of milk (about 8 lbs) for 6-8 weeks.\n\n**Sex:** Wait until your doctor clears you, usually around 4-6 weeks.\n\n**Work:** If you have a desk job, possibly 3-4 weeks. Physical jobs: 6-12 weeks.`,
    color: 'border-cyan-400',
  },
]

function Section({ section }) {
  const [open, setOpen] = useState(section.id === 'what_happened')

  return (
    <div className={clsx('bg-bg-surface rounded-2xl border-l-4 shadow-sm overflow-hidden', section.color)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-xl shrink-0">{section.icon}</span>
        <span className="font-display text-sm text-txt-primary flex-1">{section.title}</span>
        <span className="font-ui text-txt-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-bg-border pt-3">
              {section.content && (
                <p className="font-ui text-sm text-txt-secondary leading-relaxed whitespace-pre-wrap">
                  {section.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              )}

              {section.medications && (
                <div className="space-y-3">
                  {section.medications.map(med => (
                    <div key={med.name} className="bg-bg-elevated rounded-xl p-3">
                      <p className="font-ui font-semibold text-sm text-txt-primary">{med.name}</p>
                      <p className="font-ui text-xs text-txt-secondary mt-1"><span className="text-accent-calm font-semibold">Why: </span>{med.why}</p>
                      <p className="font-ui text-xs text-txt-secondary mt-1"><span className="text-accent-warm font-semibold">Watch for: </span>{med.sideEffects}</p>
                      <p className="font-ui text-xs text-txt-muted mt-1">⏰ {med.timing}</p>
                    </div>
                  ))}
                </div>
              )}

              {section.items && (
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className={clsx(
                      'flex gap-2 font-ui text-sm leading-relaxed',
                      section.urgent ? 'text-red-700' : 'text-txt-secondary'
                    )}>
                      <span className="shrink-0">{section.urgent ? '🚨' : '•'}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RecoveryPlan() {
  const navigate = useNavigate()

  return (
    <div className="app-container pb-24">
      <div className="bg-bg-surface border-b border-bg-border px-4 pt-safe pt-8 pb-4">
        <button onClick={() => navigate('/')} className="font-ui text-txt-secondary text-sm mb-2">← Back</button>
        <h1 className="font-display text-2xl text-txt-primary">My Recovery Plan</h1>
        <p className="font-ui text-sm text-txt-secondary">Everything you need to know, in plain English</p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {PLAN_SECTIONS.map(section => (
          <Section key={section.id} section={section} />
        ))}
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-bg-surface border-t border-bg-border px-4 py-2 flex justify-around">
        {[
          { icon: '🏠', label: 'Home', path: '/' },
          { icon: '💬', label: 'Cora', path: '/chat' },
          { icon: '📊', label: 'My Vitals', path: '/vitals' },
          { icon: '📋', label: 'My Plan', path: '/plan' },
        ].map(nav => (
          <button key={nav.path} onClick={() => navigate(nav.path)} className="flex flex-col items-center gap-0.5 px-3 py-1">
            <span className="text-xl">{nav.icon}</span>
            <span className="font-ui text-xs text-txt-muted">{nav.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
