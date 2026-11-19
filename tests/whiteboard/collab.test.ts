/**
 * Automated integration tests for the realtime collaborative whiteboard server.
 *
 * Tests real Hocuspocus v4 WebSocket server + HocuspocusProvider + Yjs:
 * 1. Multi-client concurrent drawing & state convergence
 * 2. Offline editing & lossless reconnect merge
 * 3. Server restart persistence with graceful shutdown flush
 * 4. Auth enforcement: invalid token, non-member rejection, forged read-only write block, live revocation
 * 5. Health endpoint & server-side stale tombstone pruning
 *
 * Run: npm run test:collab
 */
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import {
  createCollabServer,
  type CollabAuthAdapter,
  type CollabSnapshotStore,
} from '../../server/collab/index'
import {
  ELEMENTS_MAP_NAME,
  pruneStaleDeletedElements,
} from '../../lib/whiteboards/snapshot'
import type { BoardAccessResult } from '../../lib/whiteboards/permissions'

const BOARD_ID = '11111111-1111-4111-8111-111111111111'
const LOCKED_BOARD_ID = '22222222-2222-4222-8222-222222222222'
const PROJECT_ID = '33333333-3333-4333-8333-333333333333'
const ORG_ID = '44444444-4444-4444-8444-444444444444'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
  label = 'condition'
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await sleep(25)
  }
  throw new Error(`Timed out waiting for: ${label}`)
}

function makeAccess(
  boardId: string,
  opts: { canWrite: boolean; role?: 'leader' | 'co_leader' | 'member' }
): BoardAccessResult {
  return {
    hasAccess: true,
    canWrite: opts.canWrite,
    canManage: opts.role === 'leader' || opts.role === 'co_leader',
    role: opts.role ?? 'member',
    projectId: PROJECT_ID,
    projectSlug: 'test-jam',
    projectName: 'Test Jam',
    organizationId: ORG_ID,
    board: {
      id: boardId,
      title: 'Test Board',
      status: 'active',
      is_locked: !opts.canWrite,
      project_id: PROJECT_ID,
      thumbnail_key: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

function createInMemoryStore(): {
  store: CollabSnapshotStore
  snapshots: Map<string, Uint8Array>
  saveCount: () => number
} {
  const snapshots = new Map<string, Uint8Array>()
  let saves = 0
  return {
    snapshots,
    saveCount: () => saves,
    store: {
      async load(boardId) {
        return snapshots.get(boardId) ?? null
      },
      async save(boardId, state) {
        snapshots.set(boardId, new Uint8Array(state))
        saves++
      },
    },
  }
}

function createTestAuthAdapter(): {
  adapter: CollabAuthAdapter
  revokeBob: () => void
} {
  let bobRevoked = false
  return {
    revokeBob: () => {
      bobRevoked = true
    },
    adapter: {
      async verifyAndAuthorize(token, boardId) {
        if (token === 'token-alice') {
          return {
            userId: 'aaaa1111-1111-4111-8111-111111111111',
            access: makeAccess(boardId, {
              canWrite: boardId !== LOCKED_BOARD_ID,
              role: 'leader',
            }),
          }
        }
        if (token === 'token-bob' && !bobRevoked) {
          return {
            userId: 'bbbb2222-2222-4222-8222-222222222222',
            access: makeAccess(boardId, {
              canWrite: boardId !== LOCKED_BOARD_ID,
              role: 'member',
            }),
          }
        }
        // token-outsider, revoked, expired, or invalid tokens are rejected
        return null
      },
    },
  }
}

function snapshotElements(doc: Y.Doc): Record<string, unknown> {
  const map = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
  const out: Record<string, unknown> = {}
  for (const key of Array.from(map.keys()).sort()) {
    out[key] = map.get(key)
  }
  return out
}

async function runTests() {
  const mem = createInMemoryStore()
  const auth = createTestAuthAdapter()

  // Start test Hocuspocus instance on ephemeral port
  const instance1 = createCollabServer({
    port: 0,
    address: '127.0.0.1',
    debounce: 150,
    maxDebounce: 400,
    quiet: true,
    stopOnSignals: false,
    enableRealtimeRevocation: false,
    authAdapter: auth.adapter,
    snapshotStore: mem.store,
  })
  await instance1.server.listen()
  const port1 = instance1.server.address.port
  const wsUrl1 = `ws://127.0.0.1:${port1}`

  console.log(`[test] Hocuspocus #1 listening on ${wsUrl1}`)

  // ---------------------------------------------------------------------------
  // Test 1: Multi-client concurrent mutations converge to identical state
  // ---------------------------------------------------------------------------
  {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    let syncedA = false
    let syncedB = false

    const provA = new HocuspocusProvider({
      url: wsUrl1,
      name: `board:${BOARD_ID}`,
      document: docA,
      token: 'token-alice',
      onSynced: ({ state }) => {
        if (state) syncedA = true
      },
    })
    const provB = new HocuspocusProvider({
      url: wsUrl1,
      name: `board:${BOARD_ID}`,
      document: docB,
      token: 'token-bob',
      onSynced: ({ state }) => {
        if (state) syncedB = true
      },
    })

    await waitFor(() => syncedA && syncedB, 5000, 'initial sync A & B')

    // Concurrent edits from both clients
    docA.transact(() => {
      const m = docA.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
      m.set('el-a1', { id: 'el-a1', type: 'rectangle', x: 10, y: 20, version: 1, isDeleted: false })
      m.set('el-shared', { id: 'el-shared', type: 'text', text: 'From A', version: 1, isDeleted: false })
    })
    docB.transact(() => {
      const m = docB.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
      m.set('el-b1', { id: 'el-b1', type: 'ellipse', x: 100, y: 200, version: 1, isDeleted: false })
      m.set('el-b2', { id: 'el-b2', type: 'rectangle', x: 300, y: 400, version: 1, isDeleted: false })
    })

    await waitFor(
      () =>
        docA.getMap(ELEMENTS_MAP_NAME).size === 4 &&
        docB.getMap(ELEMENTS_MAP_NAME).size === 4,
      5000,
      'multi-client convergence'
    )

    assert.deepEqual(snapshotElements(docA), snapshotElements(docB))
    console.log('PASS [1] Multi-client concurrent drawing converges identically')

    // -------------------------------------------------------------------------
    // Test 2: Offline edit & lossless reconnect merge
    // -------------------------------------------------------------------------
    provB.disconnect()
    await sleep(100)

    // Client A edits online while Client B edits offline
    docA.transact(() => {
      docA.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME).set('el-online', {
        id: 'el-online',
        type: 'rectangle',
        x: 50,
        y: 50,
        version: 1,
        isDeleted: false,
      })
    })
    docB.transact(() => {
      docB.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME).set('el-offline', {
        id: 'el-offline',
        type: 'rectangle',
        x: 75,
        y: 75,
        version: 1,
        isDeleted: false,
      })
    })

    await provB.connect()
    await waitFor(
      () =>
        docA.getMap(ELEMENTS_MAP_NAME).has('el-offline') &&
        docB.getMap(ELEMENTS_MAP_NAME).has('el-online'),
      5000,
      'offline reconnect merge'
    )

    assert.deepEqual(snapshotElements(docA), snapshotElements(docB))
    assert.equal(docA.getMap(ELEMENTS_MAP_NAME).size, 6)
    console.log('PASS [2] Offline edit + reconnect merges without data loss')

    // -------------------------------------------------------------------------
    // Test 5a: Health endpoint check while clients are connected
    // -------------------------------------------------------------------------
    const healthRes = await fetch(`http://127.0.0.1:${port1}/health`)
    assert.equal(healthRes.status, 200)
    const healthJson = (await healthRes.json()) as {
      status: string
      activeDocuments: number
      activeConnections: number
    }
    assert.equal(healthJson.status, 'ok')
    assert.ok(healthJson.activeDocuments >= 1)
    assert.ok(healthJson.activeConnections >= 2)
    console.log('PASS [5a] /health endpoint returns active documents & connections')

    // -------------------------------------------------------------------------
    // Test 4: Auth enforcement (invalid token, non-member, read-only forged write, live revoke)
    // -------------------------------------------------------------------------
    // 4a: Non-member / invalid token rejected
    let authFailedReason = ''
    const badDoc = new Y.Doc()
    const badProv = new HocuspocusProvider({
      url: wsUrl1,
      name: `board:${BOARD_ID}`,
      document: badDoc,
      token: 'token-outsider',
      onAuthenticationFailed: ({ reason }) => {
        authFailedReason = reason || 'denied'
      },
    })
    await waitFor(() => authFailedReason.length > 0, 5000, 'outsider auth rejection')
    badProv.destroy()
    badDoc.destroy()
    console.log('PASS [4a] Non-member / invalid JWT rejected by Hocuspocus')

    // 4b: Read-only (locked) board blocks forged writes from a modified client
    const roDocA = new Y.Doc()
    const roDocB = new Y.Doc()
    let roScope = ''
    let roSyncedA = false
    let roSyncedB = false

    const roProvA = new HocuspocusProvider({
      url: wsUrl1,
      name: `board:${LOCKED_BOARD_ID}`,
      document: roDocA,
      token: 'token-alice',
      onAuthenticated: ({ scope }) => {
        roScope = scope
      },
      onSynced: ({ state }) => {
        if (state) roSyncedA = true
      },
    })
    const roProvB = new HocuspocusProvider({
      url: wsUrl1,
      name: `board:${LOCKED_BOARD_ID}`,
      document: roDocB,
      token: 'token-bob',
      onSynced: ({ state }) => {
        if (state) roSyncedB = true
      },
    })

    await waitFor(() => roSyncedA && roSyncedB, 5000, 'readonly board sync')
    assert.equal(roScope, 'readonly')

    // Attempt a forged write directly into Y.Doc on a read-only connection
    roDocA.transact(() => {
      roDocA.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME).set('forged-el', {
        id: 'forged-el',
        type: 'rectangle',
        version: 1,
        isDeleted: false,
      })
    })
    await sleep(300)

    // Client B and server document must NOT have received the forged element
    assert.equal(roDocB.getMap(ELEMENTS_MAP_NAME).has('forged-el'), false)
    const serverLockedDoc = instance1.server.hocuspocus.documents.get(`board:${LOCKED_BOARD_ID}`)
    assert.equal(serverLockedDoc?.getMap(ELEMENTS_MAP_NAME).has('forged-el') ?? false, false)

    roProvA.destroy()
    roProvB.destroy()
    roDocA.destroy()
    roDocB.destroy()
    console.log('PASS [4b] Locked board enforces readOnly and rejects forged client writes')

    // 4c: Active connection revocation immediately disconnects removed member & blocks reconnect
    auth.revokeBob()
    const revoked = instance1.closeMatchingConnections(
      (ctx) =>
        ctx.boardId === BOARD_ID &&
        ctx.userId === 'bbbb2222-2222-4222-8222-222222222222',
      'Project access revoked'
    )
    assert.equal(revoked, 1)
    const liveBoardDoc = instance1.server.hocuspocus.documents.get(`board:${BOARD_ID}`)
    assert.equal(liveBoardDoc?.getConnectionsCount(), 1)

    // Verify revoked Bob cannot push updates or reconnect
    docB.transact(() => {
      docB.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME).set('el-after-revoke', {
        id: 'el-after-revoke',
        type: 'rectangle',
        version: 1,
        isDeleted: false,
      })
    })
    await sleep(250)
    assert.equal(docA.getMap(ELEMENTS_MAP_NAME).has('el-after-revoke'), false)
    console.log('PASS [4c] Live connection revocation disconnects removed member & blocks writes')

    provA.destroy()
    provB.destroy()
    docA.destroy()
    docB.destroy()
  }

  // ---------------------------------------------------------------------------
  // Test 3: Graceful shutdown flushes state, survives full server restart
  // ---------------------------------------------------------------------------
  await instance1.server.destroy()
  assert.ok(mem.snapshots.has(BOARD_ID), 'snapshot must be flushed on shutdown')
  assert.ok(mem.saveCount() >= 1)

  const instance2 = createCollabServer({
    port: 0,
    address: '127.0.0.1',
    debounce: 150,
    maxDebounce: 400,
    quiet: true,
    stopOnSignals: false,
    enableRealtimeRevocation: false,
    authAdapter: auth.adapter,
    snapshotStore: mem.store,
  })
  await instance2.server.listen()
  const wsUrl2 = `ws://127.0.0.1:${instance2.server.address.port}`

  const docC = new Y.Doc()
  let syncedC = false
  const provC = new HocuspocusProvider({
    url: wsUrl2,
    name: `board:${BOARD_ID}`,
    document: docC,
    token: 'token-alice',
    onSynced: ({ state }) => {
      if (state) syncedC = true
    },
  })

  await waitFor(() => syncedC, 5000, 'fresh client sync after server restart')
  assert.equal(docC.getMap(ELEMENTS_MAP_NAME).size, 6)
  assert.ok(docC.getMap(ELEMENTS_MAP_NAME).has('el-a1'))
  assert.ok(docC.getMap(ELEMENTS_MAP_NAME).has('el-offline'))
  console.log('PASS [3] Board state survives Hocuspocus server restart via snapshot store')

  provC.destroy()
  docC.destroy()
  await instance2.server.destroy()

  // ---------------------------------------------------------------------------
  // Test 5b: Server-side stale deleted element compaction
  // ---------------------------------------------------------------------------
  {
    const doc = new Y.Doc()
    const m = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
    const now = Date.now()
    m.set('live', { id: 'live', isDeleted: false, updated: now - 30 * 86400_000 })
    m.set('recent-del', { id: 'recent-del', isDeleted: true, updated: now - 3600_000 })
    m.set('stale-del', { id: 'stale-del', isDeleted: true, updated: now - 10 * 86400_000 })

    const pruned = pruneStaleDeletedElements(doc, 7 * 86400_000)
    assert.equal(pruned, 1)
    assert.equal(m.has('live'), true)
    assert.equal(m.has('recent-del'), true)
    assert.equal(m.has('stale-del'), false)
    doc.destroy()
    console.log('PASS [5b] Server-side stale deleted element pruning works accurately')
  }

  console.log('\nAll realtime whiteboard integration tests PASSED!')
}

runTests().catch((err) => {
  console.error('Whiteboard integration test FAILED:', err)
  process.exit(1)
})
