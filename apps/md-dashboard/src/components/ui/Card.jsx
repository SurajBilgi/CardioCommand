import { clsx } from 'clsx'

export function Card({ children, className, onClick, glow }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-bg-surface border border-bg-border rounded-xl',
        onClick && 'cursor-pointer hover:border-accent-primary/30 transition-all duration-200',
        glow && 'shadow-lg shadow-accent-primary/5',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={clsx('px-4 py-3 border-b border-bg-border flex items-center justify-between', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }) {
  return (
    <div className={clsx('p-4', className)}>
      {children}
    </div>
  )
}
