import { clsx } from 'clsx'

const STREAK_REWARDS = [
  { milestone: 20, title: 'Complimentary follow-up consult' },
  { milestone: 40, title: '$50 pharmacy coupon' },
  { milestone: 60, title: 'Complimentary minor illness visit' },
]

function formatDaysLeft(days) {
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

function getNextReward(streak) {
  return STREAK_REWARDS.find(reward => streak < reward.milestone) ?? null
}

export function StreakRewards({ streak }) {
  const earnedToday = STREAK_REWARDS.find(reward => streak === reward.milestone) ?? null
  const nextReward = getNextReward(streak)
  const lastReward = STREAK_REWARDS[STREAK_REWARDS.length - 1]
  const allUnlocked = streak >= lastReward.milestone
  const featuredReward = earnedToday ?? nextReward ?? lastReward
  const rewardRows = STREAK_REWARDS.filter(
    reward => reward.milestone !== nextReward?.milestone
  )

  let featuredEyebrow = `Next reward at ${featuredReward.milestone} days`
  let featuredBadge = formatDaysLeft(Math.max(featuredReward.milestone - streak, 0))
  let featuredTone = 'border-emerald-200 bg-emerald-50'
  let markerTone = 'border-emerald-200 bg-white text-accent-calm'

  if (earnedToday) {
    featuredEyebrow = 'Reward earned today'
    featuredBadge = 'Unlocked'
    featuredTone = 'border-emerald-300 bg-emerald-50'
    markerTone = 'border-emerald-300 bg-emerald-100 text-emerald-800'
  } else if (allUnlocked) {
    featuredEyebrow = 'All rewards unlocked'
    featuredBadge = 'All set'
    featuredTone = 'border-emerald-300 bg-emerald-50'
    markerTone = 'border-emerald-300 bg-emerald-100 text-emerald-800'
  }

  return (
    <section className="rounded-[24px] border border-bg-border bg-bg-elevated p-4 space-y-3">
      <div>
        <p className="font-ui text-sm font-semibold text-txt-primary">Streak rewards</p>
        <p className="font-ui text-xs text-txt-secondary mt-1">
          Small care milestones for steady rehab.
        </p>
      </div>

      <div className={clsx('rounded-[20px] border px-4 py-4', featuredTone)}>
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border font-ui text-sm font-semibold',
              markerTone
            )}
          >
            {featuredReward.milestone}d
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-txt-secondary">
                {featuredEyebrow}
              </p>
              <span
                className={clsx(
                  'shrink-0 rounded-full border px-3 py-1 font-ui text-[11px] font-semibold whitespace-nowrap',
                  featuredBadge === 'Unlocked' || featuredBadge === 'All set'
                    ? 'border-emerald-200 bg-white text-emerald-800'
                    : 'border-emerald-200 bg-white text-accent-calm'
                )}
              >
                {featuredBadge}
              </span>
            </div>

            <h3 className="font-display text-[26px] leading-tight text-txt-primary mt-2">
              {featuredReward.title}
            </h3>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rewardRows.map(reward => {
          const unlocked = streak >= reward.milestone
          const earnedThisMilestone = streak === reward.milestone
          const isNext = nextReward?.milestone === reward.milestone
          const statusText = unlocked
            ? earnedThisMilestone
              ? 'Unlocked today'
              : 'Unlocked'
            : formatDaysLeft(reward.milestone - streak)

          return (
            <div
              key={reward.milestone}
              className={clsx(
                'grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-[18px] border px-3 py-3',
                unlocked && 'border-emerald-200 bg-emerald-50/70',
                !unlocked && isNext && 'border-accent-calm/20 bg-bg-surface',
                !unlocked && !isNext && 'border-bg-border bg-bg-surface'
              )}
            >
              <div
                className={clsx(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border font-ui text-sm font-semibold',
                  unlocked
                    ? 'border-emerald-200 bg-white text-emerald-800'
                    : 'border-bg-border bg-bg-elevated text-txt-secondary'
                )}
              >
                {reward.milestone}d
              </div>

              <div className="min-w-0">
                <p className="font-ui text-[15px] leading-5 text-txt-primary">
                  {reward.title}
                </p>
              </div>

              <span
                className={clsx(
                  'shrink-0 rounded-full border px-3 py-1 text-right font-ui text-[11px] font-semibold whitespace-nowrap',
                  unlocked
                    ? 'border-emerald-200 bg-white text-emerald-800'
                    : 'border-bg-border bg-bg-elevated text-txt-secondary'
                )}
              >
                {statusText}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
