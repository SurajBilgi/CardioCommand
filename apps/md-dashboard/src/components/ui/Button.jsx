import { clsx } from 'clsx'

const variants = {
  primary: 'bg-accent-primary text-bg-base hover:bg-cyan-300 font-semibold',
  secondary: 'bg-bg-elevated border border-bg-border text-text-primary hover:bg-bg-surface',
  danger: 'bg-alert-critical/20 border border-alert-critical/40 text-red-400 hover:bg-alert-critical/30',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
  warning: 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({ children, variant = 'secondary', size = 'md', className, disabled, onClick, ...props }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg transition-all duration-200 cursor-pointer select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
