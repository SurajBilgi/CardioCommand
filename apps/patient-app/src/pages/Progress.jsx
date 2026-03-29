import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

const SESSIONS_DONE = 4
const TOTAL_SESSIONS = 36
const REHAB_WEEK = 2
const REHAB_STREAK = 4
const MEDS_TAKEN_WEEK = 6

const MILESTONES = {
  9:  { label: 'Phase I',   emoji: '⭐', color: 'bg-amber-400  border-amber-400' },
  18: { label: 'Halfway',   emoji: '💪', color: 'bg-accent-primary border-accent-primary' },
  27: { label: 'Final Push', emoji: '🏃', color: 'bg-purple-400 border-purple-400' },
  36: { label: 'Heart Hero', emoji: '🏆', color: 'bg-accent-calm border-accent-calm' },
}

const BADGES = [
  {
    id: 'first_step',
    icon: '🌱',
    name: 'First Step',
    desc: 'Complete your first session',
    unlocked: true,
    detail: 'Earned Day 1',
  },
  {
    id: 'med_master',
    icon: '💊',
    name: 'Med Master',
    desc: '7 days full medication adherence',
    unlocked: false,
    detail: `${MEDS_TAKEN_WEEK}/7 days`,
  },
  {
    id: 'one_week',
    icon: '🔥',
    name: 'Week Strong',
    desc: '7-day check-in streak',
    unlocked: false,
    detail: `${REHAB_STREAK}/7 days`,
  },
  {
    id: 'halfway',
    icon: '💪',
    name: 'Halfway There',
    desc: 'Complete 18 sessions',
    unlocked: false,
    detail: `${SESSIONS_DONE}/18 done`,
  },
  {
    id: 'stronger',
    icon: '📈',
    name: 'Stronger',
    desc: 'Resting HR drops 5 bpm',
    unlocked: false,
    detail: 'HR at 96, need 91',
  },
  {
    id: 'heart_hero',
    icon: '❤️',
    name: 'Heart Hero',
    desc: 'All 36 sessions complete',
    unlocked: false,
    detail: `${SESSIONS_DONE}/36 done`,
  },
]

// Sessions split into 4 rows of 9 (left-to-right, each row is a quarter)
const ROWS = [
  [1,  2,  3,  4,  5,  6,  7,  8,  9 ],
  [10, 11, 12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 31, 32, 33, 34, 35, 36],
]

function SessionDot({ session, stagger }) {
  const done    = session <= SESSIONS_DONE
  const current = session === SESSIONS_DONE + 1
  const ms      = MILESTONES[session]

  if (ms) {
    return (
      <motion.div
        className="flex flex-col items-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: stagger * 0.012, type: 'spring', damping: 14 }}
      >
        <div className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center border-2 text-base shadow-md',
          done    ? ms.color + ' text-white'
          : current ? 'bg-accent-primary border-accent-primary text-white animate-pulse ring-2 ring-accent-primary/30 ring-offset-1'
          :           'bg-bg-elevated border-bg-border text-txt-muted'
        )}>
          {done ? ms.emoji : current ? ms.emoji : '⭐'}
        </div>
        <span className="font-ui text-[8px] text-txt-muted text-center mt-0.5 leading-tight w-10">
          {ms.label}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold font-ui',
        done    ? 'bg-accent-calm border-accent-calm text-white'
        : current ? 'bg-accent-primary border-accent-primary text-white animate-pulse ring-2 ring-accent-primary/30 ring-offset-1'
        :           'bg-bg-elevated border-bg-border text-txt-muted'
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: stagger * 0.012 }}
    >
      {done ? '✓' : current ? '·' : ''}
    </motion.div>
  )
}

function BadgeCard({ badge, index }) {
  return (
    <motion.div
      className={clsx(
        'rounded-2xl p-3 border text-center',
        badge.unlocked
          ? 'bg-bg-surface border-accent-calm/40 shadow-sm'
          : 'bg-bg-elevated border-bg-border'
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06 }}
    >
      <div className={clsx('text-3xl mb-1.5', !badge.unlocked && 'grayscale opacity-40')}>
        {badge.icon}
      </div>
      <p className={clsx(
        'font-ui text-xs font-semibold leading-tight',
        badge.unlocked ? 'text-txt-primary' : 'text-txt-secondary'
      )}>
        {badge.name}
      </p>
      <p className="font-ui text-[10px] text-txt-muted mt-0.5 leading-tight">{badge.desc}</p>
      {badge.unlocked ? (
        <span className="inline-block mt-1.5 font-ui text-[10px] bg-accent-calm/10 text-accent-calm px-2 py-0.5 rounded-full font-medium">
          ✓ {badge.detail}
        </span>
      ) : (
        <p className="font-ui text-[10px] text-accent-warm mt-1.5 font-medium">{badge.detail}</p>
      )}
    </motion.div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const pct        = Math.round((SESSIONS_DONE / TOTAL_SESSIONS) * 100)
  const sessionsLeft = TOTAL_SESSIONS - SESSIONS_DONE
  const NAV = [
    { icon: '🏠', label: 'Home',    path: '/'         },
    { icon: '💬', label: 'Cora',    path: '/chat'     },
    { icon: '📊', label: 'Vitals',  path: '/vitals'   },
    { icon: '🏆', label: 'Journey', path: '/progress' },
    { icon: '📋', label: 'Plan',    path: '/plan'     },
  ]

  return (
    <div className="app-container pb-24">
      {/* Header */}
      <div className="bg-bg-surface border-b border-bg-border px-4 pt-safe pt-8 pb-4">
        <button onClick={() => navigate('/')} className="font-ui text-txt-secondary text-sm mb-2">← Back</button>
        <h1 className="font-display text-2xl text-txt-primary">Your Journey</h1>
        <p className="font-ui text-sm text-txt-secondary">36 sessions to a stronger heart</p>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-2">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Sessions Done', value: SESSIONS_DONE, sub: `/ ${TOTAL_SESSIONS}`, color: 'text-accent-calm' },
            { label: 'Current Week',  value: REHAB_WEEK,    sub: '/ 12',               color: 'text-accent-primary' },
            { label: 'Day Streak',    value: REHAB_STREAK,  sub: '🔥',                 color: 'text-accent-warm' },
          ].map(s => (
            <div key={s.label} className="bg-bg-surface rounded-2xl p-3 border border-bg-border text-center">
              <p className={clsx('font-display text-xl font-bold tabular-nums', s.color)}>
                {s.value}
                <span className="font-ui text-xs font-normal text-txt-muted ml-0.5">{s.sub}</span>
              </p>
              <p className="font-ui text-[10px] text-txt-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Journey Map card */}
        <motion.div
          className="bg-bg-surface rounded-2xl border border-bg-border p-4 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-display text-base text-txt-primary">36-Session Journey</p>
              <p className="font-ui text-xs text-txt-muted">{SESSIONS_DONE} complete · {sessionsLeft} to go</p>
            </div>
            <span className="font-display text-lg font-bold text-accent-primary">{pct}%</span>
          </div>

          {/* The map */}
          <div className="space-y-2">
            {ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center justify-between gap-1 px-1">
                {row.map((session, colIdx) => (
                  <SessionDot
                    key={session}
                    session={session}
                    stagger={rowIdx * 9 + colIdx}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-bg-border flex-wrap">
            {[
              { cls: 'bg-accent-calm',   label: 'Done' },
              { cls: 'bg-accent-primary animate-pulse', label: 'Next' },
              { cls: 'bg-bg-elevated border border-bg-border', label: 'Upcoming' },
              { cls: 'bg-amber-400',     label: 'Milestone' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={clsx('w-3 h-3 rounded-full shrink-0', l.cls)} />
                <span className="font-ui text-[10px] text-txt-muted">{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Why it matters */}
        <motion.div
          className="rounded-2xl p-4 border border-accent-calm/30"
          style={{ background: 'linear-gradient(135deg, rgba(90,158,111,0.05), rgba(90,158,111,0.12))' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="font-ui text-[10px] text-accent-calm font-semibold uppercase tracking-widest mb-1.5">Why every session matters</p>
          <p className="font-display text-sm text-txt-primary leading-snug">
            Completing your 36 sessions cuts the risk of another heart attack by{' '}
            <span className="text-accent-calm font-bold">43%</span>.
          </p>
          <p className="font-ui text-xs text-txt-secondary mt-2 leading-relaxed">
            You've done <span className="font-semibold text-txt-primary">{SESSIONS_DONE} sessions</span>. Just {sessionsLeft} more to join the{' '}
            <span className="font-semibold text-accent-calm">top 25% of patients</span> who complete the full program.
          </p>
        </motion.div>

        {/* Badge Wall */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base text-txt-primary">Your Badges</p>
            <span className="font-ui text-xs text-txt-muted bg-bg-elevated px-2.5 py-1 rounded-full">
              {BADGES.filter(b => b.unlocked).length}/{BADGES.length} earned
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BADGES.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={i} />
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-bg-surface border-t border-bg-border px-2 py-2 flex justify-around">
        {NAV.map(nav => (
          <button
            key={nav.path}
            onClick={() => navigate(nav.path)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
          >
            <span className="text-lg">{nav.icon}</span>
            <span className={clsx(
              'font-ui text-[10px]',
              nav.path === '/progress' ? 'text-accent-primary font-semibold' : 'text-txt-muted'
            )}>
              {nav.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
