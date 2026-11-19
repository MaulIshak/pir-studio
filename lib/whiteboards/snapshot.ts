import * as Y from 'yjs'

export const ELEMENTS_MAP_NAME = 'elements'
export const FILES_MAP_NAME = 'files'

/**
 * Encode raw bytes to Postgres bytea hex string format (`\x...`) for PostgREST / Supabase.
 */
export function encodeByteaHex(bytes: Uint8Array): string {
  return '\\x' + Buffer.from(bytes).toString('hex')
}

/**
 * Decode Postgres bytea column value returned by PostgREST / Supabase into Uint8Array.
 */
export function decodeByteaHex(value: unknown): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) {
    return value
  }
  if (typeof value === 'string') {
    if (value.startsWith('\\x') || value.startsWith('\\X')) {
      return new Uint8Array(Buffer.from(value.slice(2), 'hex'))
    }
    // Fallback if a base64 string is ever returned
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value)
  }
  return null
}

/**
 * Seed a fresh Y.Doc snapshot from an array of Excalidraw elements (e.g. from a template).
 */
export function buildInitialBoardSnapshot(
  elements: ReadonlyArray<Record<string, unknown>>
): { state: Uint8Array; elementCount: number } {
  const doc = new Y.Doc()
  const elementsMap = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)

  doc.transact(() => {
    for (const el of elements) {
      const id = typeof el.id === 'string' ? el.id : null
      if (!id) continue
      elementsMap.set(id, { ...el })
    }
  })

  const state = Y.encodeStateAsUpdate(doc)
  const count = elementsMap.size
  doc.destroy()

  return { state, elementCount: count }
}

/**
 * Server-side compaction: remove soft-deleted Excalidraw elements (`isDeleted: true`)
 * whose `updated` timestamp is older than `maxAgeMs` (default 7 days).
 */
export function pruneStaleDeletedElements(
  doc: Y.Doc,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000
): number {
  const elementsMap = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
  const cutoff = Date.now() - maxAgeMs
  const toDelete: string[] = []

  elementsMap.forEach((value, key) => {
    if (!value || typeof value !== 'object') return
    if (value.isDeleted === true) {
      const updated = typeof value.updated === 'number' ? value.updated : 0
      if (updated > 0 && updated < cutoff) {
        toDelete.push(key)
      }
    }
  })

  if (toDelete.length > 0) {
    doc.transact(() => {
      for (const key of toDelete) {
        elementsMap.delete(key)
      }
    }, { source: 'local', skipStoreHooks: true })
  }

  return toDelete.length
}

/**
 * Count non-deleted elements in a Y.Doc.
 */
export function countActiveElements(doc: Y.Doc): number {
  const elementsMap = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
  let count = 0
  elementsMap.forEach((value) => {
    if (value && typeof value === 'object' && value.isDeleted !== true) {
      count++
    }
  })
  return count
}

