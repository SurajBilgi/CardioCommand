import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

const WEEK            = 2
const SESSIONS_DONE   = 2   // sessions this week
const SESSIONS_GOAL   = 3
const MEDS_TAKEN      = 6
const MEDS_TOTAL      = 7
const STREAK          = 4
const HR_CHANGE       = -4   // bpm vs last week (negative = good)
const STEPS_CHANGE    = 12   // % increase vs last week

function StatBox({ label, value, sub, good }) {
  return (
    <div className="bg-bg-elevated rounded-2xl p-3 text-center">
      <p className={clsx(
        'font-display text-xl font-bold',
        good ? 'text-accent-calm' : 'text-accent-warm'
      )}>
        {value}
      </p>
      <p className="font-ui text-[10px] text-txt-muted mt-0.5">{label}</p>
      {sub && (
        <p className={clsx(
          'font-ui text-[10px] mt-0.5 font-medium',
          good ? 'text-accent-calm' : 'text-txt-secondary'
        )}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function WeeklyRecap({ onClose }) {
  const [copied, setCopied] = useState(false)

  const shareText =
    `Week ${WEEK} of my cardiac rehab — done! 🎉\n\n` +
    `✅ ${SESSIONS_DONE} sessions completed this week\n` +
    `💊 Meds taken: ${MEDS_TAKEN}/${MEDS_TOTAL} days\n` +
    `🔥 ${STREAK}-day streak\n` +
    `❤️ Resting HR dropped ${Math.abs(HR_CHANGE)} bpm from last week\n\n` +
    `Getting stronger every day! 💪`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `My Week ${WEEK} Cardiac Rehab Update`, text: shareText })
      } catch {
        // user cancelled share sheet — that's fine
      }
      return
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Last resort: open SMS
      window.location.href = `sms:?body=${encodeURIComponent(shareText)}`
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg-base w-full max-w-mobile rounded-t-3xl overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-bg-border rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2 overflow-y-auto max-h-[88vh]">

          {/* Header */}
          <div className="text-center mb-5">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="font-display text-2xl text-txt-primary">Week {WEEK} Complete!</h2>
            <p className="font-ui text-sm text-txt-secondary mt-1">
              Here's how your recovery is going
            </p>
          </div>

          {/* Stats 2×2 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatBox
              label="Sessions this week"
              value={`${SESSIONS_DONE}/${SESSIONS_GOAL}`}
              sub={SESSIONS_DONE >= SESSIONS_GOAL ? '✓ Goal met!' : `${SESSIONS_GOAL - SESSIONS_DONE} to go`}
              good={SESSIONS_DONE >= SESSIONS_GOAL}
            />
            <StatBox
              label="Medications taken"
              value={`${MEDS_TAKEN}/${MEDS_TOTAL}`}
              sub="days this week"
              good={MEDS_TAKEN >= 6}
            />
            <StatBox
              label="Day streak"
              value={`${STREAK} 🔥`}
              sub="consecutive days"
              good
            />
            <StatBox
              label="Mood trend"
              value="😐→😊"
              sub="improving"
              good
            />
          </div>

          {/* What changed */}
          <div className="bg-bg-surface rounded-2xl border border-bg-border p-4 mb-4">
            <p className="font-display text-sm text-txt-primary mb-3">What changed this week</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0">❤️</span>
                <div>
                  <p className="font-ui text-sm text-txt-primary">
                    Resting heart rate{' '}
                    <span className="text-accent-calm font-semibold">
                      ↓ {Math.abs(HR_CHANGE)} bpm
                    </span>
                  </p>
                  <p className="font-ui text-xs text-txt-muted">Your heart is getting stronger</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0">🚶</span>
                <div>
                  <p className="font-ui text-sm text-txt-primary">
                    Daily steps{' '}
                    <span className="text-accent-calm font-semibold">↑ {STEPS_CHANGE}% more</span>
                  </p>
                  <p className="font-ui text-xs text-txt-muted">Your activity is increasing</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cora says */}
          <div
            className="rounded-2xl border border-accent-calm/20 p-4 mb-5"
            style={{ background: 'rgba(90,158,111,0.06)' }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xl shrink-0">🎙️</span>
              <div>
                <p className="font-ui text-[10px] text-accent-calm font-semibold uppercase tracking-wide mb-1">
                  Cora says
                </p>
                <p className="font-ui text-sm text-txt-primary leading-relaxed">
                  "Your resting heart rate dropped {Math.abs(HR_CHANGE)} bpm from last week — that's your
                  heart adapting and getting stronger. Week 3 is where most patients start feeling
                  a real difference. Keep going."
                </p>
              </div>
            </div>
          </div>

          {/* Share with Daughter */}
          <button
            onClick={handleShare}
            className="w-full py-4 rounded-2xl font-ui font-semibold text-sm text-white flex items-center justify-center gap-2 shadow-lg mb-2 transition-opacity active:opacity-90"
            style={{ background: 'linear-gradient(135deg, #5A9E6F, #4a8a5e)' }}
          >
            <span className="text-lg">💌</span>
            {copied ? 'Copied! Paste it in a text 📋' : 'Share with Sarah (your daughter)'}
          </button>
          <p className="font-ui text-[11px] text-txt-muted text-center mb-5">
            Sends a simple, positive update — no scary numbers
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 font-ui text-sm text-txt-muted"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
