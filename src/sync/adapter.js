import { mergeArrayById, pruneTombstones } from '@glance-apps/sync';
import { dbGetAll, dbGetAllChapters, dbPut, dbDelete, dbPutChapter, dbDeleteChapter } from '../data/db.js';
import { getMilestoneTombstones, getChapterTombstones } from './tombstones.js';

const RETENTION_MS = 90 * 86_400_000;

// buildPayload — reads live IDB state. Called before every upload.
// Accepts a milestonesRef so it can read the latest React state for milestones
// (avoiding stale closures), but falls back to IDB for robustness.
export const buildPayload = async (milestonesRef, chaptersRef) => {
  const milestones = milestonesRef?.current ?? await dbGetAll();
  const chapters = chaptersRef?.current ?? await dbGetAllChapters();
  return {
    lives: {
      default: {
        milestones,  // has_photo / media_type flags included; blobs are NOT in milestone objects
        chapters,
        milestoneTombstones: getMilestoneTombstones(),
        chapterTombstones: getChapterTombstones(),
      }
    }
  };
};

// buildBackupPayload — timer-safe. Must not read React state.
export const buildBackupPayload = async () => {
  const [milestones, chapters] = await Promise.all([dbGetAll(), dbGetAllChapters()]);
  return {
    lives: {
      default: {
        milestones,
        chapters,
        milestoneTombstones: getMilestoneTombstones(),
        chapterTombstones: getChapterTombstones(),
      }
    }
  };
};

// applyPayload — writes merged data to IDB, then refreshes React state via callbacks
export const makeApplyPayload = (setMilestones, setChapters) =>
  async (data, opts) => {
    const life = data?.lives?.default;
    if (!life) return;

      const milestones          = Array.isArray(life.milestones) ? life.milestones : []
    const chapters            = Array.isArray(life.chapters)   ? life.chapters   : []
    const milestoneTombstones = life.milestoneTombstones && typeof life.milestoneTombstones === 'object' ? life.milestoneTombstones : {}
    const chapterTombstones   = life.chapterTombstones   && typeof life.chapterTombstones   === 'object' ? life.chapterTombstones   : {}

    // Persist tombstones
    localStorage.setItem('lifeglance-milestone-tombstones', JSON.stringify(milestoneTombstones));
    localStorage.setItem('lifeglance-chapter-tombstones', JSON.stringify(chapterTombstones));

    // Compute IDB milestone ids to delete (tombstoned, not in merged set)
    const currentMilestones = await dbGetAll();
    const mergedMilestoneIds = new Set(milestones.map(m => m.id));
    const milestoneIdsToDelete = currentMilestones
      .map(m => m.id)
      .filter(id => !mergedMilestoneIds.has(id));

    // Write merged milestones
    for (const m of milestones) await dbPut(m);
    for (const id of milestoneIdsToDelete) await dbDelete(id);

    // Compute IDB chapter ids to delete
    const currentChapters = await dbGetAllChapters();
    const mergedChapterIds = new Set(chapters.map(c => c.id));
    const chapterIdsToDelete = currentChapters
      .map(c => c.id)
      .filter(id => !mergedChapterIds.has(id));

    // Write merged chapters
    for (const c of chapters) await dbPutChapter(c);
    for (const id of chapterIdsToDelete) await dbDeleteChapter(id);

    // Reload React state
    const [freshMilestones, freshChapters] = await Promise.all([dbGetAll(), dbGetAllChapters()]);
    setMilestones(freshMilestones);
    setChapters(freshChapters);
  };

// mergePayloads — synchronous CRDT merge
export const mergePayloads = (local, remote) => {
  const localLife = local?.lives?.default ?? {};
  const remoteLife = remote?.lives?.default ?? {};

  const lm = Array.isArray(localLife.milestones)  ? localLife.milestones  : []
  const rm = Array.isArray(remoteLife.milestones) ? remoteLife.milestones : []
  const lc = Array.isArray(localLife.chapters)    ? localLife.chapters    : []
  const rc = Array.isArray(remoteLife.chapters)   ? remoteLife.chapters   : []
  const lmt = localLife.milestoneTombstones ?? {};
  const rmt = remoteLife.milestoneTombstones ?? {};
  const lct = localLife.chapterTombstones ?? {};
  const rct = remoteLife.chapterTombstones ?? {};

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const milestoneTombstones = pruneTombstones({ ...lmt, ...rmt }, cutoff);
  const chapterTombstones = pruneTombstones({ ...lct, ...rct }, cutoff);

  const mergedMilestones = mergeArrayById(lm, rm, milestoneTombstones, null,
    { idField: 'id', timestampField: 'updated_at' });
  const mergedChapters = mergeArrayById(lc, rc, chapterTombstones, null,
    { idField: 'id', timestampField: 'updated_at' });

  const mergedLife = { milestones: mergedMilestones, chapters: mergedChapters, milestoneTombstones, chapterTombstones };

  const localChanged =
    JSON.stringify(mergedMilestones) !== JSON.stringify(lm) ||
    JSON.stringify(mergedChapters) !== JSON.stringify(lc) ||
    JSON.stringify(milestoneTombstones) !== JSON.stringify(lmt) ||
    JSON.stringify(chapterTombstones) !== JSON.stringify(lct);

  const remoteChanged =
    JSON.stringify(mergedMilestones) !== JSON.stringify(rm) ||
    JSON.stringify(mergedChapters) !== JSON.stringify(rc) ||
    JSON.stringify(milestoneTombstones) !== JSON.stringify(rmt) ||
    JSON.stringify(chapterTombstones) !== JSON.stringify(rct);

  return { data: { lives: { default: mergedLife } }, localChanged, remoteChanged };
};
