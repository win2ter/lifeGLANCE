import { describe, it, expect } from 'vitest'
import { applyRecurFilter } from './timeline'

// Helper to build a minimal milestone-like object
function ms(id, dateStr, recurrence_id = null) {
  return { id, date: dateStr, recurrence_id }
}

// Dates relative to test run: use far-past and far-future to avoid flakiness
const PAST1   = '2000-01-01'
const PAST2   = '2001-06-15'
const FUTURE1 = '2099-01-01'
const FUTURE2 = '2099-06-15'
const RID_A   = 'rid-a'
const RID_B   = 'rid-b'

// Fixture set
//   non-recurring: n1 (past), n2 (future)
//   series A:      a1 (past), a2 (future)
//   series B:      b1 (past), b2 (past) — both past, no upcoming
const n1 = ms('n1', PAST1)
const n2 = ms('n2', FUTURE1)
const a1 = ms('a1', PAST2,   RID_A)
const a2 = ms('a2', FUTURE2, RID_A)
const b1 = ms('b1', PAST1,   RID_B)
const b2 = ms('b2', PAST2,   RID_B)

const ALL = [n1, n2, a1, a2, b1, b2]

describe('applyRecurFilter', () => {
  it('all — returns the full set unchanged', () => {
    const result = applyRecurFilter(ALL, 'all')
    expect(result).toHaveLength(ALL.length)
    expect(result).toEqual(expect.arrayContaining(ALL))
  })

  it('past — keeps non-recurring and only past recurring instances', () => {
    const result = applyRecurFilter(ALL, 'past')
    expect(result).toContain(n1)
    expect(result).toContain(n2)   // non-recurring are always included
    expect(result).toContain(a1)   // past recurring ✓
    expect(result).not.toContain(a2) // future recurring ✗
    expect(result).toContain(b1)
    expect(result).toContain(b2)
  })

  it('future — keeps non-recurring and only future recurring instances', () => {
    const result = applyRecurFilter(ALL, 'future')
    expect(result).toContain(n1)
    expect(result).toContain(n2)
    expect(result).not.toContain(a1) // past recurring ✗
    expect(result).toContain(a2)     // future recurring ✓
    expect(result).not.toContain(b1) // both b's are past
    expect(result).not.toContain(b2)
  })

  it('next — picks nearest upcoming per series, falls back to most recent past', () => {
    const result = applyRecurFilter(ALL, 'next')
    expect(result).toContain(n1)
    expect(result).toContain(n2)
    // Series A has a future instance → picks a2 (nearest upcoming)
    expect(result).toContain(a2)
    expect(result).not.toContain(a1)
    // Series B has no future instances → picks b2 (most recent past)
    expect(result).toContain(b2)
    expect(result).not.toContain(b1)
  })

  it('next — with only future instances picks the nearest one', () => {
    const rid = 'rid-future'
    const near = ms('near', FUTURE1, rid)
    const far  = ms('far',  FUTURE2, rid)
    const result = applyRecurFilter([near, far], 'next')
    expect(result).toContain(near)
    expect(result).not.toContain(far)
  })

  it('handles empty input', () => {
    expect(applyRecurFilter([], 'all')).toEqual([])
    expect(applyRecurFilter([], 'past')).toEqual([])
    expect(applyRecurFilter([], 'future')).toEqual([])
    expect(applyRecurFilter([], 'next')).toEqual([])
  })

  it('all — returns milestones with no recurrence_id unchanged', () => {
    const plain = [n1, n2]
    const result = applyRecurFilter(plain, 'all')
    expect(result).toEqual(plain)
  })
})
