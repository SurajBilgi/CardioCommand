import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useSSE } from '../../hooks/useSSE'
import { runAnalysis, getPreVisitBrief } from '../../services/api'
import { VoiceCallModal } from '../voice/VoiceCallModal'

const ALERT_COLORS = {
  critical: 'text-red-400',
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-cyan-400',
  none: 'text-emerald-400',
}

const ALERT_BADGES = {
  critical: 'critical',
  high: 'critical',
  medium: 'warning',
  low: 'info',
  none: 'success',
}

export function AgentPanel({ patient, currentVitals }) {
  const { streaming, events, complete, startStream, reset } = useSSE()
  const [activeAction, setActiveAction] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [outreachScript, setOutreachScript] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const handleAnalyze = () => {
    setActiveAction('analyze')
    reset()
    startStream(() => runAnalysis(patient.id, patient, currentVitals))
  }

  const handlePreVisit = () => {
    setActiveAction('pre_visit')
    reset()
    startStream(() => getPreVisitBrief(patient.id, patient))
  }

  const handleCopy = () => {
    const text = events
      .filter(e => ['reasoning', 'action', 'summary'].includes(e.type))
      .map(e => e.content)
      .join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const riskEvent = events.find(e => e.type === 'risk_score')
  const summaryEvent = events.find(e => e.type === 'summary')
  const actionEvent = events.find(e => e.type === 'action')
  const reasoningEvent = events.find(e => e.type === 'reasoning')

  // Capture outreach script whenever it arrives in the stream
  useEffect(() => {
    const outreachEvent = events.find(e => e.type === 'action' && e.action_type === 'outreach_script')
    if (outreachEvent) setOutreachScript(outreachEvent.content)
  }, [events])

  const actionButtons = [
    {
      id: 'analyze',
      label: 'Run Full Analysis',
      icon: '▶',
      variant: 'primary',
      onClick: handleAnalyze,
    },
    {
      id: 'outreach',
      label: 'Outreach Script',
      icon: '📞',
      onClick: () => setShowVoiceCall(true),
    },
    {
      id: 'pre_visit',
      label: 'Pre-Visit Brief',
      icon: '📋',
      onClick: handlePreVisit,
    },
    {
      id: 'ambient',
      label: 'Start Visit Doc',
      icon: '🎙️',
      onClick: () => window.location.href = '/ambient',
    },
  ]

  return (
    <>
    {showVoiceCall && (
      <AnimatePresence>
        <VoiceCallModal
          patient={patient}
          currentVitals={currentVitals}
          outreachScript={outreachScript}
          onClose={() => setShowVoiceCall(false)}
        />
      </AnimatePresence>
    )}
    <div className="flex flex-col h-full gap-3">
      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {actionButtons.map(btn => (
          <Button
            key={btn.id}
            variant={btn.variant || 'secondary'}
            size="sm"
            onClick={btn.onClick}
            disabled={streaming}
            className="justify-start"
          >
            <span>{btn.icon}</span>
            <span className="truncate">{btn.label}</span>
          </Button>
        ))}
      </div>

      {/* Stream output area */}
      <div className="flex-1 bg-bg-base border border-bg-border rounded-xl overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-bg-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Agent Output</span>
            {streaming && (
              <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1 h-1 rounded-full bg-accent-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </span>
            )}
          </div>
          {complete && (
            <Button size="sm" variant="ghost" onClick={handleCopy} className="text-xs">
              {copied ? '✓ Copied' : '📋 Copy'}
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
          <AnimatePresence>
            {events.length === 0 && !streaming && (
              <motion.p
                key="empty"
                className="text-text-muted text-xs font-mono text-center py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Click an action to start the AI pipeline
              </motion.p>
            )}

            {events.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {event.type === 'start' && (
                  <p className="text-text-muted text-xs font-mono">{event.message}</p>
                )}

                {event.type === 'step' && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                    <p className="text-xs font-mono text-text-secondary">{event.message}</p>
                  </div>
                )}

                {event.type === 'step_complete' && (
                  <p className="text-xs font-mono text-emerald-400">{event.message}</p>
                )}

                {event.type === 'risk_score' && (
                  <div className="bg-bg-elevated rounded-lg p-3 border border-bg-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-text-muted uppercase">Risk Score</span>
                      <Badge variant={ALERT_BADGES[event.alert_level] || 'muted'}>
                        {event.alert_level?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={clsx('font-mono text-3xl font-bold', ALERT_COLORS[event.alert_level])}>
                        {event.score}
                      </span>
                      <span className="text-text-muted text-sm">/100</span>
                    </div>
                    <div className="w-full bg-bg-base rounded-full h-1.5 mb-2">
                      <motion.div
                        className={clsx('h-1.5 rounded-full', {
                          'bg-red-500': event.score >= 80,
                          'bg-amber-500': event.score >= 60 && event.score < 80,
                          'bg-cyan-400': event.score >= 35 && event.score < 60,
                          'bg-emerald-400': event.score < 35,
                        })}
                        initial={{ width: 0 }}
                        animate={{ width: `${event.score}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    {event.reasons?.map((r, ri) => (
                      <p key={ri} className="text-xs text-text-secondary font-mono">• {r}</p>
                    ))}
                  </div>
                )}

                {event.type === 'reasoning' && (
                  <div className="bg-bg-elevated rounded-lg p-3 border border-bg-border">
                    <p className="text-xs font-mono text-text-muted uppercase mb-1">Clinical Analysis</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{event.content}</p>
                  </div>
                )}

                {event.type === 'action' && (
                  <div className="bg-bg-elevated rounded-lg p-3 border border-amber-500/20">
                    <p className="text-xs font-mono text-amber-400 uppercase mb-1">
                      {event.action_type === 'urgent_brief' ? '🚨 Urgent Brief' : '📞 Outreach Script'}
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{event.content}</p>
                  </div>
                )}

                {event.type === 'summary' && (
                  <div className="bg-bg-elevated rounded-lg p-3 border border-accent-primary/20">
                    <p className="text-xs font-mono text-accent-primary uppercase mb-1">Clinical Summary</p>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{event.content}</p>
                  </div>
                )}

                {event.type === 'complete' && (
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                    <span>✓</span>
                    <span>Analysis complete</span>
                    {event.risk_score !== undefined && (
                      <span className="text-text-muted">· Risk {event.risk_score}/100</span>
                    )}
                  </div>
                )}

                {event.type === 'error' && (
                  <p className="text-xs text-red-400 font-mono">Error: {event.message}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </>
  )
}
