/**
 * Headless Yjs / Hocuspocus load test.
 *
 * Spawns concurrent clients across multiple boards emitting element edits and
 * awareness pointer updates, then reports latency, convergence, persist time, and memory.
 *
 * Usage:
 *   npx tsx scripts/load-test-collab.ts [boards=3] [clientsPerBoard=10] [opsPerClient=20]
 */
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { createCollabServer } from '../server/collab/index'
import { ELEMENTS_MAP_NAME } from '../lib/whiteboards/snapshot'
import type { BoardAccessResult } from '../lib/whiteboards/permissions'

const NUM_BOARDS = Number(process.argv[2] || 3)
const CLIENTS_PER_BOARD = Number(process.argv[3] || 10)
const OPS_PER_CLIENT = Number(process.argv[4] || 20)

const PROJECT_ID = '33333333-3333-4333-8333-333333333333'
const ORG_ID = '44444444-4444-4444-8444-444444444444'

function makeBoardId(idx: number): string {
  return `10000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`
}

function makeUserId(idx: number): string {
  return `20000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function main() {
  const snapshots = new Map<string, Uint8Array>()
  const storeDurations: number[] = []

  const { server } = createCollabServer({
    port: 0,
    address: '127.0.0.1',
    debounce: 300,
    maxDebounce: 1000,
    maxConnectionsPerUserPerBoard: 50,
    quiet: true,
    stopOnSignals: false,
    enableRealtimeRevocation: false,
    authAdapter: {
      async verifyAndAuthorize(token, boardId) {
        const userId = token
        const access: BoardAccessResult = {
          hasAccess: true,
          canWrite: true,
          canManage: false,
          role: 'member',
          projectId: PROJECT_ID,
          projectSlug: 'load-test',
          projectName: 'Load Test',
          organizationId: ORG_ID,
          board: {
            id: boardId,
            title: `Board ${boardId.slice(-4)}`,
            status: 'active',
            is_locked: false,
            project_id: PROJECT_ID,
            thumbnail_key: null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }
        return { userId, access }
      },
    },
    snapshotStore: {
      async load(boardId) {
        return snapshots.get(boardId) ?? null
      },
      async save(boardId, state) {
        const t0 = performance.now()
        snapshots.set(boardId, new Uint8Array(state))
        storeDurations.push(performance.now() - t0)
      },
    },
  })

  await server.listen()
  const wsUrl = `ws://127.0.0.1:${server.address.port}`
  const totalClients = NUM_BOARDS * CLIENTS_PER_BOARD

  console.log(
    `Load test starting: ${NUM_BOARDS} boards x ${CLIENTS_PER_BOARD} clients = ${totalClients} concurrent clients (${OPS_PER_CLIENT} ops/client)`
  )

  const connectLatencies: number[] = []
  const clients: Array<{
    boardIdx: number
    clientIdx: number
    doc: Y.Doc
    provider: HocuspocusProvider
  }> = []

  const connectPromises: Promise<void>[] = []

  for (let b = 0; b < NUM_BOARDS; b++) {
    const boardId = makeBoardId(b)
    for (let c = 0; c < CLIENTS_PER_BOARD; c++) {
      const globalIdx = b * CLIENTS_PER_BOARD + c
      const doc = new Y.Doc()
      const t0 = performance.now()

      connectPromises.push(
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Client ${globalIdx} sync timeout`)),
            15_000
          )
          const provider = new HocuspocusProvider({
            url: wsUrl,
            name: `board:${boardId}`,
            document: doc,
            token: makeUserId(globalIdx),
            onSynced: ({ state }) => {
              if (state) {
                clearTimeout(timeout)
                connectLatencies.push(performance.now() - t0)
                resolve()
              }
            },
          })
          clients.push({ boardIdx: b, clientIdx: c, doc, provider })
        })
      )
    }
  }

  await Promise.all(connectPromises)
  console.log(
    `All ${totalClients} clients connected & synced. Connect p50=${percentile(connectLatencies, 50).toFixed(1)}ms, p95=${percentile(connectLatencies, 95).toFixed(1)}ms`
  )

  // Emit concurrent mutations & pointer awareness updates
  const mutationStart = performance.now()
  await Promise.all(
    clients.map(async ({ boardIdx, clientIdx, doc, provider }) => {
      const map = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
      for (let op = 0; op < OPS_PER_CLIENT; op++) {
        const elId = `b${boardIdx}_c${clientIdx}_op${op}`
        doc.transact(() => {
          map.set(elId, {
            id: elId,
            type: 'rectangle',
            x: op * 12,
            y: clientIdx * 24,
            width: 100,
            height: 60,
            version: 1,
            versionNonce: op + 1,
            isDeleted: false,
            updated: Date.now(),
          })
        })
        provider.setAwarenessField('presence', {
          user: { id: `u${clientIdx}`, name: `Bot ${clientIdx}`, color: '#2563eb' },
          pointer: { x: op * 10, y: clientIdx * 10, tool: 'pointer' },
        })
        await sleep(5)
      }
    })
  )

  // Wait for convergence across all boards
  const expectedPerBoard = CLIENTS_PER_BOARD * OPS_PER_CLIENT
  const waitStart = performance.now()
  while (performance.now() - waitStart < 15_000) {
    const allConverged = clients.every(
      (c) => c.doc.getMap(ELEMENTS_MAP_NAME).size === expectedPerBoard
    )
    if (allConverged) break
    await sleep(50)
  }

  const totalSyncMs = performance.now() - mutationStart
  const convergedCount = clients.filter(
    (c) => c.doc.getMap(ELEMENTS_MAP_NAME).size === expectedPerBoard
  ).length

  const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024))

  for (const c of clients) {
    c.provider.destroy()
    c.doc.destroy()
  }
  await server.destroy()

  console.log('\n--- Load Test Summary ---')
  console.log(`Boards:             ${NUM_BOARDS}`)
  console.log(`Concurrent clients: ${totalClients}`)
  console.log(`Expected / board:   ${expectedPerBoard} elements`)
  console.log(`Converged clients:  ${convergedCount}/${totalClients}`)
  console.log(`Total mutate+sync:  ${totalSyncMs.toFixed(0)} ms`)
  console.log(`Snapshots stored:   ${snapshots.size}/${NUM_BOARDS}`)
  console.log(
    `Avg persist encode: ${
      storeDurations.length
        ? (storeDurations.reduce((a, b) => a + b, 0) / storeDurations.length).toFixed(2)
        : 0
    } ms`
  )
  console.log(`Peak RSS memory:    ${rssMb} MB`)

  if (convergedCount !== totalClients || snapshots.size !== NUM_BOARDS) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Load test failed:', err)
  process.exit(1)
})

