import { describe, it, expect } from 'vitest'
import { parseIcs } from './icsParser'

function makeEvent({ dtstart, summary = 'Test Event', extra = '' } = {}) {
  return [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    `DTSTART${dtstart.includes('T') ? '' : ';VALUE=DATE'}:${dtstart}`,
    `SUMMARY:${summary}`,
    extra,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

describe('parseIcs', () => {
  it('returns empty candidates and zero timedCount for empty input', () => {
    const { candidates, timedCount } = parseIcs('')
    expect(candidates).toEqual([])
    expect(timedCount).toBe(0)
  })

  it('returns empty candidates for malformed non-ICS text', () => {
    const { candidates, timedCount } = parseIcs('not an ics file\nrandom text')
    expect(candidates).toEqual([])
    expect(timedCount).toBe(0)
  })

  it('parses a single all-day event', () => {
    const ics = makeEvent({ dtstart: '20200315', summary: 'Moved to Portland' })
    const { candidates, timedCount } = parseIcs(ics)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].title).toBe('Moved to Portland')
    expect(candidates[0].date).toEqual(new Date(2020, 2, 15))
    expect(candidates[0].selected).toBe(true)
    expect(timedCount).toBe(0)
  })

  it('skips timed events and increments timedCount', () => {
    const ics = makeEvent({ dtstart: '20200315T090000Z', summary: 'Morning Meeting' })
    const { candidates, timedCount } = parseIcs(ics)
    expect(candidates).toHaveLength(0)
    expect(timedCount).toBe(1)
  })

  it('parses multiple events and sorts by date', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20200601',
      'SUMMARY:June Event',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20190101',
      'SUMMARY:Jan Event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const { candidates } = parseIcs(ics)
    expect(candidates).toHaveLength(2)
    expect(candidates[0].title).toBe('Jan Event')
    expect(candidates[1].title).toBe('June Event')
  })

  it('counts timed events separately from all-day events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20200601',
      'SUMMARY:All Day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20200601T100000Z',
      'SUMMARY:Timed',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20200601T120000Z',
      'SUMMARY:Also Timed',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const { candidates, timedCount } = parseIcs(ics)
    expect(candidates).toHaveLength(1)
    expect(timedCount).toBe(2)
  })

  it('detects yearly recurrence via RRULE', () => {
    const ics = makeEvent({ dtstart: '20200101', extra: 'RRULE:FREQ=YEARLY' })
    const { candidates } = parseIcs(ics)
    expect(candidates[0].isRecurring).toBe(true)
  })

  it('marks non-recurring events as isRecurring false', () => {
    const ics = makeEvent({ dtstart: '20200101' })
    const { candidates } = parseIcs(ics)
    expect(candidates[0].isRecurring).toBe(false)
  })

  it('unescapes ICS special characters in summary', () => {
    const ics = makeEvent({ dtstart: '20200101', summary: 'Rock\\, Paper\\, Scissors' })
    const { candidates } = parseIcs(ics)
    expect(candidates[0].title).toBe('Rock, Paper, Scissors')
  })

  it('handles line-folded content (CRLF + whitespace continuation)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20200101',
      'SUMMARY:Long Sum',
      ' mary Here',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const { candidates } = parseIcs(ics)
    expect(candidates[0].title).toBe('Long Summary Here')
  })

  it('guesses category from summary keywords', () => {
    const cases = [
      { summary: 'Family reunion',   expected: 'family' },
      { summary: 'Vacation trip',    expected: 'travel' },
      { summary: 'New job interview', expected: 'career' },
      { summary: 'Birthday party',   expected: 'personal' },
    ]
    for (const { summary, expected } of cases) {
      const ics = makeEvent({ dtstart: '20200101', summary })
      const { candidates } = parseIcs(ics)
      expect(candidates[0].category).toBe(expected)
    }
  })

  it('uses (untitled) as fallback for missing summary', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20200101',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const { candidates } = parseIcs(ics)
    expect(candidates[0].title).toBe('(untitled)')
  })
})
