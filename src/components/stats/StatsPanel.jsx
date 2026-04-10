import React from 'react'
import { formatDateDisplay, relativeLabel } from '../../utils/dates'
import TypewriterText from '../ui/TypewriterText'

function StatMilestone({ m, align }) {
  const dateStr = formatDateDisplay(m.date, m.date_precision)
  const relStr  = relativeLabel(m.date, m.date_precision)
  const k = m.id + (m.updated_at || '')

  return (
    <div className={`stat-milestone ${align === 'right' ? 'stat-milestone-right' : ''}`}>
      <div className="stat-milestone-title">
        <TypewriterText key={k + 'title'} text={m.title}
          options={{ delay: 18, jitter: 10 }} showCursor={false} />
      </div>
      <div className="stat-milestone-date">
        <TypewriterText key={k + 'date'} text={dateStr}
          options={{ delay: 14, jitter: 6, startDelay: 180 }} showCursor={false} />
      </div>
      <div className="stat-milestone-rel">
        <TypewriterText key={k + 'rel'} text={relStr}
          options={{ delay: 14, jitter: 6, startDelay: 320 }} showCursor={false} />
      </div>
    </div>
  )
}

// flip=true for past panel: ← goes to higher idx (older), → goes to lower idx (more recent)
// flip=false for future panel: ← goes to lower idx (sooner), → goes to higher idx (later)
function NavRow({ idx, total, onChange, align, flip = false }) {
  if (total <= 1) return null
  const canLeft  = flip ? idx < total - 1 : idx > 0
  const canRight = flip ? idx > 0         : idx < total - 1
  return (
    <div className={`stat-nav-row ${align === 'right' ? 'stat-nav-row-right' : ''}`}>
      <button className="stat-nav-btn" onClick={() => onChange(flip ? idx + 1 : idx - 1)} disabled={!canLeft}>←</button>
      <span className="stat-nav-pos">{idx + 1}/{total}</span>
      <button className="stat-nav-btn" onClick={() => onChange(flip ? idx - 1 : idx + 1)} disabled={!canRight}>→</button>
    </div>
  )
}

export default function StatsPanel({ past, future, pastIdx, futureIdx, onPastChange, onFutureChange }) {
  return (
    <div className="stat-panels">
      {/* Left — past */}
      <div className="stat-panel">
        <div className="stat-panel-label">← past</div>
        <div className="stat-panel-count">
          {past.length} milestone{past.length !== 1 ? 's' : ''}
        </div>
        {/* navigate further-back (←) and back-toward-now (→) */}
        <NavRow idx={pastIdx} total={past.length} onChange={onPastChange} align="left" flip />
        {past[pastIdx] && <StatMilestone m={past[pastIdx]} align="left" />}
      </div>

      {/* Right — future */}
      <div className="stat-panel stat-panel-right">
        <div className="stat-panel-label">future →</div>
        <div className="stat-panel-count">
          {future.length} milestone{future.length !== 1 ? 's' : ''}
        </div>
        {/* navigate closer (←) and further-ahead (→) */}
        <NavRow idx={futureIdx} total={future.length} onChange={onFutureChange} align="right" />
        {future[futureIdx] && <StatMilestone m={future[futureIdx]} align="right" />}
      </div>
    </div>
  )
}
