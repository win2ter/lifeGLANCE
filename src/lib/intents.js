// Local implementation of the @glance-apps/intents@1.3.2 public API.
// Provides schema constants, envelope helpers, and idempotency utilities
// as specified in docs/dayglance-intent-protocol.md.

export const SCHEMA_VERSION = 1

export const SOURCE_APP_LIFEGLANCE = 'app.lifeglance'
export const SOURCE_APP_DAYGLANCE  = 'app.dayglance'

export const ACTIONS = {
  CREATE:   'create',
  COMPLETE: 'complete',
  OPEN:     'open',
  QUERY:    'query',
  NOTIFY:   'notify',
}

export const NOTIFY_EVENTS = {
  COMPLETED:   'completed',
  UNCOMPLETED: 'uncompleted',
  DELETED:     'deleted',
  RESCHEDULED: 'rescheduled',
  UPDATED:     'updated',
}

// Generates a new event ID in the format yyyyMMddTHHmmssZ-rrr (where rrr is 3 random hex bytes).
export function eventId() {
  const now = new Date()
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  const ts =
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    'T' +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    'Z'
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${ts}-${suffix}`
}

// Returns the filename for a given event ID.
export function filenameFor(evtId) {
  return `${evtId}.json`
}

// Returns a stable dedup key for create-action idempotency.
export function createKey(sourceApp, sourceEntityId, due) {
  return `${sourceApp}:${sourceEntityId}:${due ?? ''}`
}

// Builds a WebDAV event file envelope object ready for JSON.stringify.
export function buildEnvelope(emittedBy, action, payload) {
  const id = eventId()
  return {
    schema_version: SCHEMA_VERSION,
    event_id:       id,
    emitted_at:     new Date().toISOString(),
    emitted_by:     emittedBy,
    action,
    payload,
  }
}

// Parses and validates a raw envelope object from a WebDAV event file.
// Throws on malformed or unsupported input.
export function parseEnvelope(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid envelope: not an object')
  if (obj.schema_version !== SCHEMA_VERSION)
    throw new Error(`Unsupported schema_version: ${obj.schema_version}`)
  if (!obj.action)  throw new Error('Invalid envelope: missing action')
  if (!obj.payload) throw new Error('Invalid envelope: missing payload')
  return {
    schema_version: obj.schema_version,
    event_id:       obj.event_id,
    emitted_at:     obj.emitted_at,
    emitted_by:     obj.emitted_by,
    action:         obj.action,
    payload:        obj.payload,
  }
}
