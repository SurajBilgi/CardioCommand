import { clsx } from 'clsx'

const variants = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  muted: 'bg-white/5 text-text-secondary border border-bg-border',
}

export function Badge({ children, variant = 'muted', className }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
