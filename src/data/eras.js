import { dbGetAllEras, dbGetEra, dbAddEra, dbPutEra, dbDeleteEra } from './db'
import { uid } from './milestones'

// Valid color values are the same hex strings used for milestone categories and
// the settings palette (COLOR_PALETTE in SettingsModal).  No runtime validation
// here — the caller is responsible for passing a valid palette color.

export function buildEra({
  title,
  start,
  end,
  color,
  description             = '',
  defaultMemberVisibility = 'shown',
  parentEraId             = null,
}) {
  const now = new Date().toISOString()
  return {
    id:                     uid(),
    title:                  title.trim(),
    start:                  start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
    end:                    end instanceof Date   ? end.toISOString()   : new Date(end).toISOString(),
    color,
    description,
    defaultMemberVisibility,
    parentEraId,
    milestoneIds:           [],
    created_at:             now,
    updated_at:             now,
  }
}

export async function createEra(data) {
  const era = buildEra(data)
  console.log('[eras] createEra writing:', era)
  await dbAddEra(era)
  return era
}

export async function getEra(id) {
  const era = await dbGetEra(id)
  console.log('[eras] getEra read:', era)
  return era
}

export async function listEras() {
  return dbGetAllEras()
}

export async function updateEra(id, updates, existing) {
  const era = {
    ...existing,
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  }
  console.log('[eras] updateEra writing:', era)
  await dbPutEra(era)
  return era
}

export async function deleteEra(id) {
  console.log('[eras] deleteEra id:', id)
  await dbDeleteEra(id)
}

// Adds milestoneId to era.milestoneIds; no-op if already present.
export async function addMilestoneToEra(eraId, milestoneId) {
  const era = await dbGetEra(eraId)
  if (!era) throw new Error(`Era not found: ${eraId}`)
  if (era.milestoneIds.includes(milestoneId)) return era
  const updated = {
    ...era,
    milestoneIds: [...era.milestoneIds, milestoneId],
    updated_at:   new Date().toISOString(),
  }
  console.log('[eras] addMilestoneToEra writing:', updated)
  await dbPutEra(updated)
  return updated
}

// Removes milestoneId from era.milestoneIds; no-op if not present.
export async function removeMilestoneFromEra(eraId, milestoneId) {
  const era = await dbGetEra(eraId)
  if (!era) throw new Error(`Era not found: ${eraId}`)
  const updated = {
    ...era,
    milestoneIds: era.milestoneIds.filter(id => id !== milestoneId),
    updated_at:   new Date().toISOString(),
  }
  console.log('[eras] removeMilestoneFromEra writing:', updated)
  await dbPutEra(updated)
  return updated
}

// Returns the milestoneIds array for an era.
export async function getMilestonesInEra(eraId) {
  const era = await dbGetEra(eraId)
  if (!era) throw new Error(`Era not found: ${eraId}`)
  return era.milestoneIds
}

// Returns all eras that contain the given milestoneId.
export async function getErasForMilestone(milestoneId) {
  const eras = await dbGetAllEras()
  return eras.filter(era => era.milestoneIds.includes(milestoneId))
}

// Replaces all era records with the supplied array (used by backup restore).
export async function restoreEras(items) {
  const existing = await dbGetAllEras()
  for (const era of existing) await dbDeleteEra(era.id)
  for (const era of items)    await dbPutEra(era)
  return items
}
