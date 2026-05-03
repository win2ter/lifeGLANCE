import { describe, it, expect } from 'vitest'
import { expandAnnualDates } from './recurrence'

describe('expandAnnualDates', () => {
  const base = new Date(2020, 2, 15) // 15 March 2020

  it('generates one date per year from base to end year', () => {
    const dates = expandAnnualDates(base, 2023)
    expect(dates).toHaveLength(4)
    expect(dates.map(d => d.getFullYear())).toEqual([2020, 2021, 2022, 2023])
  })

  it('preserves month and day across all instances', () => {
    const dates = expandAnnualDates(base, 2022)
    for (const d of dates) {
      expect(d.getMonth()).toBe(2)   // March
      expect(d.getDate()).toBe(15)
    }
  })

  it('returns a single date when base year equals end year', () => {
    const dates = expandAnnualDates(base, 2020)
    expect(dates).toHaveLength(1)
    expect(dates[0].getFullYear()).toBe(2020)
  })

  it('clamps end year to base + 99', () => {
    const dates = expandAnnualDates(base, 2200) // 180 years requested
    expect(dates).toHaveLength(100)             // only base+99 = 100 instances
    expect(dates[dates.length - 1].getFullYear()).toBe(2119)
  })

  it('clamps end year when requested end < base year', () => {
    const dates = expandAnnualDates(base, 2015) // end before base
    expect(dates).toHaveLength(1)               // still at least the base year
    expect(dates[0].getFullYear()).toBe(2020)
  })

  it('accepts ISO string as baseDate', () => {
    const dates = expandAnnualDates('2020-03-15', 2022)
    expect(dates).toHaveLength(3)
    expect(dates[0].getFullYear()).toBe(2020)
  })

  it('produces correct instance count', () => {
    for (const n of [1, 5, 10, 50, 99, 100]) {
      const endYear = 2020 + n - 1
      const dates   = expandAnnualDates(base, endYear)
      expect(dates).toHaveLength(Math.min(n, 100))
    }
  })
})
