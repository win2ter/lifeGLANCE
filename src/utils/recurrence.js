// Expand an annual recurrence into per-year Date instances.
// Returns an array of Date objects from baseDate's year to endYear (clamped to base+99).
export function expandAnnualDates(baseDate, requestedEndYear) {
  const base    = baseDate instanceof Date ? baseDate : new Date(baseDate)
  const baseYear = base.getFullYear()
  const endYear  = Math.max(baseYear, Math.min(requestedEndYear, baseYear + 99))
  const dates    = []
  for (let y = baseYear; y <= endYear; y++) {
    const d = new Date(base)
    d.setFullYear(y)
    dates.push(d)
  }
  return dates
}
