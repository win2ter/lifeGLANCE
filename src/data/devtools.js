import {
  createEra, getEra, listEras, updateEra, deleteEra,
  addMilestoneToEra, removeMilestoneFromEra,
  getMilestonesInEra, getErasForMilestone,
} from './eras'
import { loadMilestones } from './milestones'

// Attaches window.lg — a set of dev-console-callable functions for verifying
// the Phase 1 Era data model.  Call window.lg.help() for a usage summary.
//
// Verification workflow from the PR description:
//   1. lg.createEra(...)           — create an era, see it written to IDB
//   2. lg.addMilestoneToEra(...)   — add a milestone, see era updated
//   3. lg.getEra(id)               — confirm milestone is in era.milestoneIds
//   4. lg.getErasForMilestone(id)  — confirm era appears for that milestone
//   5. lg.updateEra(id, {...})     — update a field, reload app, lg.getEra(id) again
//   6. lg.deleteEra(id)            — delete; lg.getErasForMilestone(id) returns []
//   7. lg.checkMigration()         — log milestone count + sample mainTimelineVisibility

export function registerDevtools() {
  window.lg = {
    help() {
      console.log(`
lifeGLANCE Phase 1 devtools  (window.lg)
─────────────────────────────────────────
Era CRUD
  lg.createEra({ title, start, end, color, description?, defaultMemberVisibility?, parentEraId? })
  lg.getEra(id)
  lg.listEras()
  lg.updateEra(id, { ...fields })
  lg.deleteEra(id)

Membership
  lg.addMilestoneToEra(eraId, milestoneId)
  lg.removeMilestoneFromEra(eraId, milestoneId)
  lg.getMilestonesInEra(eraId)
  lg.getErasForMilestone(milestoneId)

Migration
  lg.checkMigration()   — log milestone count + sample mainTimelineVisibility

All functions return Promises; await them or check the console.
      `.trim())
    },

    async createEra(fields) {
      const era = await createEra(fields)
      console.log('[lg.createEra] written to IDB:', era)
      return era
    },

    async getEra(id) {
      const era = await getEra(id)
      console.log('[lg.getEra] read from IDB:', era)
      return era
    },

    async listEras() {
      const eras = await listEras()
      console.log('[lg.listEras] read from IDB:', eras)
      return eras
    },

    async updateEra(id, updates) {
      const existing = await getEra(id)
      if (!existing) { console.error('[lg.updateEra] era not found:', id); return null }
      const era = await updateEra(id, updates, existing)
      console.log('[lg.updateEra] written to IDB:', era)
      return era
    },

    async deleteEra(id) {
      await deleteEra(id)
      console.log('[lg.deleteEra] deleted era id:', id)
    },

    async addMilestoneToEra(eraId, milestoneId) {
      const era = await addMilestoneToEra(eraId, milestoneId)
      console.log('[lg.addMilestoneToEra] era milestoneIds:', era.milestoneIds)
      return era
    },

    async removeMilestoneFromEra(eraId, milestoneId) {
      const era = await removeMilestoneFromEra(eraId, milestoneId)
      console.log('[lg.removeMilestoneFromEra] era milestoneIds:', era.milestoneIds)
      return era
    },

    async getMilestonesInEra(eraId) {
      const ids = await getMilestonesInEra(eraId)
      console.log('[lg.getMilestonesInEra] milestoneIds:', ids)
      return ids
    },

    async getErasForMilestone(milestoneId) {
      const eras = await getErasForMilestone(milestoneId)
      console.log('[lg.getErasForMilestone] eras:', eras)
      return eras
    },

    async checkMigration() {
      const milestones = await loadMilestones()
      console.log('[lg.checkMigration] total milestones:', milestones.length)
      if (milestones.length > 0) {
        const sample = milestones[0]
        console.log('[lg.checkMigration] sample milestone.mainTimelineVisibility:', sample.mainTimelineVisibility)
        console.log('[lg.checkMigration] sample milestone:', sample)
        const allHaveField = milestones.every(m => 'mainTimelineVisibility' in m)
        console.log('[lg.checkMigration] all milestones have mainTimelineVisibility:', allHaveField)
      } else {
        console.log('[lg.checkMigration] no milestones found — new install')
      }
      return milestones
    },
  }

  console.log('[lifeGLANCE devtools] window.lg ready — run lg.help() for usage')
}
