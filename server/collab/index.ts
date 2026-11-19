import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Server, type Document } from '@hocuspocus/server'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { resolveBoardAccess, type BoardAccessResult } from '../../lib/whiteboards/permissions'
import {
  countActiveElements,
  decodeByteaHex,
  encodeByteaHex,
  pruneStaleDeletedElements,
} from '../../lib/whiteboards/snapshot'
import { createMetrics, logEvent } from './logger'
import { ConnectionRateLimiter, UserBoardConnectionTracker } from './rate-limit'

const BOARD_DOC_PREFIX = 'board:'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CollabConnectionContext {
  userId: string
  boardId: string
  projectId: string
  organizationId: string
  role: string
  canWrite: boolean
  canManage: boolean
}

export interface CollabAuthAdapter {
  verifyAndAuthorize(
    token: string,
    boardId: string
  ): Promise<{ userId: string; access: BoardAccessResult } | null>
}

export interface CollabSnapshotStore {
  load(boardId: string): Promise<Uint8Array | null>
  save(
    boardId: string,
    state: Uint8Array,
    elementCount: number
  ): Promise<void>
}

export interface CollabServerOptions {
  port?: number
  address?: string
  debounce?: number
  maxDebounce?: number
  maxPayloadBytes?: number
  maxDocBytes?: number
  maxElements?: number
  maxConnectionsPerUserPerBoard?: number
  allowedOrigins?: string[]
  quiet?: boolean
  stopOnSignals?: boolean
  enableRealtimeRevocation?: boolean
  authAdapter?: CollabAuthAdapter
  snapshotStore?: CollabSnapshotStore
}

export function parseBoardIdFromDocumentName(documentName: string): string | null {
  if (!documentName.startsWith(BOARD_DOC_PREFIX)) {
    return null
  }
  const boardId = documentName.slice(BOARD_DOC_PREFIX.length)
  return UUID_REGEX.test(boardId) ? boardId : null
}

function loadLocalEnvFiles(): void {
  if (typeof process.loadEnvFile !== 'function') return
  const candidates = ['.env.local', '.env']
  for (const file of candidates) {
    const fullPath = resolve(process.cwd(), file)
    if (existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath)
      } catch {
        // Ignore if already loaded or unreadable
      }
    }
  }
}

function createSupabaseAdminFromEnv(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Collab server requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createDefaultAuthAdapter(supabase: SupabaseClient): CollabAuthAdapter {
  return {
    async verifyAndAuthorize(token, boardId) {
      if (!token) return null
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token)

      if (error || !user) {
        return null
      }

      const access = await resolveBoardAccess(supabase, boardId, user.id)
      if (!access.hasAccess || !access.projectId || !access.organizationId) {
        return null
      }

      return { userId: user.id, access }
    },
  }
}

function createDefaultSnapshotStore(supabase: SupabaseClient): CollabSnapshotStore {
  return {
    async load(boardId) {
      const { data, error } = await supabase
        .from('board_snapshots')
        .select('state')
        .eq('board_id', boardId)
        .maybeSingle()

      if (error) {
        throw new Error(`Snapshot load failed: ${error.message}`)
      }
      if (!data?.state) return null
      return decodeByteaHex(data.state)
    },

    async save(boardId, state, elementCount) {
      const hex = encodeByteaHex(state)
      const now = new Date().toISOString()

      const { data: existing } = await supabase
        .from('board_snapshots')
        .select('version')
        .eq('board_id', boardId)
        .maybeSingle()

      const nextVersion = Number(existing?.version ?? 0) + 1

      const { error } = await supabase.from('board_snapshots').upsert(
        {
          board_id: boardId,
          state: hex,
          version: nextVersion,
          element_count: elementCount,
          updated_at: now,
        },
        { onConflict: 'board_id' }
      )

      if (error) {
        throw new Error(`Snapshot save failed: ${error.message}`)
      }

      // Touch parent board updated_at (best-effort)
      await supabase
        .from('boards')
        .update({ updated_at: now })
        .eq('id', boardId)
    },
  }
}

function parseAllowedOrigins(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export function createCollabServer(options: CollabServerOptions = {}) {
  const port = options.port ?? Number(process.env.COLLAB_PORT || 1234)
  const address = options.address ?? (process.env.COLLAB_HOST || '0.0.0.0')
  const debounce = options.debounce ?? Number(process.env.COLLAB_DEBOUNCE_MS || 2000)
  const maxDebounce = options.maxDebounce ?? Number(process.env.COLLAB_MAX_DEBOUNCE_MS || 10000)
  const maxPayloadBytes =
    options.maxPayloadBytes ?? Number(process.env.COLLAB_MAX_PAYLOAD_BYTES || 1024 * 1024)
  const maxDocBytes =
    options.maxDocBytes ?? Number(process.env.COLLAB_MAX_DOC_BYTES || 10 * 1024 * 1024)
  const maxElements =
    options.maxElements ?? Number(process.env.COLLAB_MAX_ELEMENTS || 5000)
  const maxConnectionsPerUserPerBoard =
    options.maxConnectionsPerUserPerBoard ??
    Number(process.env.COLLAB_MAX_CONNECTIONS_PER_USER || 5)
  const allowedOrigins =
    options.allowedOrigins ?? parseAllowedOrigins(process.env.COLLAB_ALLOWED_ORIGINS)

  const needsSupabase = !options.authAdapter || !options.snapshotStore || options.enableRealtimeRevocation !== false
  const supabase = needsSupabase ? createSupabaseAdminFromEnv() : null
  const authAdapter =
    options.authAdapter ?? createDefaultAuthAdapter(supabase!)
  const snapshotStore =
    options.snapshotStore ?? createDefaultSnapshotStore(supabase!)

  const metrics = createMetrics()
  const rateLimiter = new ConnectionRateLimiter({ capacity: 120, refillPerSecond: 60 })
  const connTracker = new UserBoardConnectionTracker(maxConnectionsPerUserPerBoard)
  const dirtyDocs = new Set<string>()
  let realtimeChannel: RealtimeChannel | null = null

  const server = new Server<CollabConnectionContext>({
    name: 'gamedev-pm-collab',
    port,
    address,
    debounce,
    maxDebounce,
    timeout: 30_000,
    quiet: options.quiet ?? true,
    stopOnSignals: options.stopOnSignals ?? false,
    unloadImmediately: false,
    maxUnauthenticatedQueueSize: 512 * 1024,
    maxUnauthenticatedQueueMessages: 100,
    maxPendingDocuments: 10,
    websocketOptions: {
      maxPayload: maxPayloadBytes,
    },

    async onRequest({ request, response, instance }) {
      const urlPath = (request.url || '/').split('?')[0]
      if (urlPath === '/health' || urlPath === '/healthz') {
        const body = JSON.stringify({
          status: 'ok',
          uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
          activeDocuments: instance.getDocumentsCount(),
          activeConnections: instance.getConnectionsCount(),
          metrics: {
            authSuccessCount: metrics.authSuccessCount,
            authFailureCount: metrics.authFailureCount,
            storeSuccessCount: metrics.storeSuccessCount,
            storeErrorCount: metrics.storeErrorCount,
            rateLimitDropCount: metrics.rateLimitDropCount,
            lastStoreDurationMs: metrics.lastStoreDurationMs,
            lastStoreAt: metrics.lastStoreAt,
            lastStoreError: metrics.lastStoreError,
          },
          memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        })
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        response.end(body)
        // Reject with falsy value so Hocuspocus does not write its default 200 response
        throw null
      }
    },

    async onUpgrade({ request, socket }) {
      if (allowedOrigins.length === 0) {
        return
      }
      const origin = request.headers.origin?.replace(/\/+$/, '')
      if (!origin || !allowedOrigins.includes(origin)) {
        logEvent('warn', 'ws.origin_rejected', { origin: origin ?? 'missing' })
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        throw null
      }
    },

    async onAuthenticate({ token, documentName, socketId, connectionConfig }) {
      const boardId = parseBoardIdFromDocumentName(documentName)
      if (!boardId) {
        metrics.authFailureCount++
        logEvent('warn', 'auth.invalid_doc_name', { documentName, socketId })
        throw new Error('Invalid board identifier')
      }

      const verified = await authAdapter.verifyAndAuthorize(token, boardId)
      if (!verified) {
        metrics.authFailureCount++
        logEvent('warn', 'auth.denied', { boardId, socketId })
        throw new Error('Unauthorized')
      }

      const { userId, access } = verified
      if (!connTracker.tryAcquire(userId, boardId, socketId)) {
        metrics.authFailureCount++
        logEvent('warn', 'auth.connection_limit', { userId, boardId, socketId })
        throw new Error('Too many concurrent connections to this board')
      }

      // Server-side read-only enforcement (blocks modified clients from mutating locked/archived boards)
      connectionConfig.readOnly = !access.canWrite

      metrics.authSuccessCount++
      logEvent('info', 'auth.accepted', {
        userId,
        boardId,
        projectId: access.projectId,
        role: access.role,
        readOnly: connectionConfig.readOnly,
        socketId,
      })

      return {
        userId,
        boardId,
        projectId: access.projectId!,
        organizationId: access.organizationId!,
        role: access.role!,
        canWrite: access.canWrite,
        canManage: access.canManage,
      }
    },

    async onLoadDocument({ documentName, document }) {
      const boardId = parseBoardIdFromDocumentName(documentName)
      if (!boardId) return

      const started = Date.now()
      const state = await snapshotStore.load(boardId)
      if (state && state.byteLength > 0) {
        Y.applyUpdate(document, state, { source: 'local', skipStoreHooks: true })
        logEvent('info', 'doc.loaded', {
          boardId,
          bytes: state.byteLength,
          elements: countActiveElements(document),
          durationMs: Date.now() - started,
        })
      } else {
        logEvent('info', 'doc.created_empty', {
          boardId,
          durationMs: Date.now() - started,
        })
      }
    },

    async beforeHandleMessage({ socketId, update, document, context }) {
      if (!rateLimiter.consume(socketId, 1)) {
        metrics.rateLimitDropCount++
        logEvent('warn', 'ws.rate_limited', {
          socketId,
          userId: context?.userId,
          boardId: context?.boardId,
        })
        throw new Error('Rate limit exceeded')
      }

      if (update.byteLength > maxPayloadBytes) {
        logEvent('warn', 'ws.payload_too_large', {
          socketId,
          bytes: update.byteLength,
          maxPayloadBytes,
        })
        throw new Error('Message exceeds maximum size')
      }

      const activeElements = countActiveElements(document)
      if (activeElements > maxElements) {
        logEvent('warn', 'doc.element_limit_exceeded', {
          boardId: context?.boardId,
          activeElements,
          maxElements,
        })
        throw new Error('Board element limit exceeded')
      }
    },

    async onChange({ documentName }) {
      dirtyDocs.add(documentName)
    },

    async onStoreDocument({ documentName, document }) {
      const boardId = parseBoardIdFromDocumentName(documentName)
      if (!boardId) return

      const started = Date.now()
      try {
        const pruned = pruneStaleDeletedElements(document)
        const state = Y.encodeStateAsUpdate(document)
        const elementCount = countActiveElements(document)

        if (state.byteLength > maxDocBytes) {
          metrics.storeErrorCount++
          metrics.lastStoreError = `Document ${boardId} exceeds max size (${state.byteLength} bytes)`
          logEvent('error', 'doc.store_size_exceeded', {
            boardId,
            bytes: state.byteLength,
            maxDocBytes,
          })
          return
        }

        await snapshotStore.save(boardId, state, elementCount)
        dirtyDocs.delete(documentName)

        const durationMs = Date.now() - started
        metrics.storeSuccessCount++
        metrics.lastStoreDurationMs = durationMs
        metrics.lastStoreAt = new Date().toISOString()
        metrics.lastStoreError = null

        logEvent('info', 'doc.stored', {
          boardId,
          bytes: state.byteLength,
          elementCount,
          pruned,
          durationMs,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        metrics.storeErrorCount++
        metrics.lastStoreError = message
        logEvent('error', 'doc.store_failed', {
          boardId,
          error: message,
        })
        throw err
      }
    },

    async onDisconnect({ socketId, context }) {
      rateLimiter.delete(socketId)
      if (context?.userId && context?.boardId) {
        connTracker.release(context.userId, context.boardId, socketId)
        logEvent('info', 'ws.disconnected', {
          userId: context.userId,
          boardId: context.boardId,
          socketId,
        })
      }
    },

    async onDestroy() {
      if (realtimeChannel && supabase) {
        await supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
      }
      logEvent('info', 'server.destroyed', {
        remainingDirtyDocs: dirtyDocs.size,
      })
    },
  })

  // Helper to revoke or force-reconnect active WebSocket connections when RBAC / board lock changes
  function closeMatchingConnections(
    predicate: (ctx: CollabConnectionContext, doc: Document) => boolean,
    reason: string
  ): number {
    let closed = 0
    for (const [, doc] of server.hocuspocus.documents) {
      for (const connection of doc.getConnections()) {
        const ctx = connection.context as CollabConnectionContext | undefined
        if (ctx && predicate(ctx, doc)) {
          connection.close({ code: 4403, reason })
          closed++
        }
      }
    }
    if (closed > 0) {
      logEvent('info', 'ws.revoked_connections', { reason, count: closed })
    }
    return closed
  }

  // Subscribe to Supabase Realtime for instant access revocation & lock/archive enforcement
  if (supabase && options.enableRealtimeRevocation !== false) {
    realtimeChannel = supabase
      .channel('collab_rbac_revocation')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'project_members' },
        (payload) => {
          const oldRow = payload.old as { project_id?: string; user_id?: string }
          if (!oldRow.project_id || !oldRow.user_id) return
          closeMatchingConnections(
            (ctx) =>
              ctx.projectId === oldRow.project_id &&
              ctx.userId === oldRow.user_id &&
              ctx.role === 'member',
            'Project access revoked'
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'organization_members' },
        (payload) => {
          const oldRow = payload.old as { organization_id?: string; user_id?: string }
          if (!oldRow.organization_id || !oldRow.user_id) return
          closeMatchingConnections(
            (ctx) =>
              ctx.organizationId === oldRow.organization_id &&
              ctx.userId === oldRow.user_id,
            'Organization access revoked'
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'boards' },
        (payload) => {
          const updated = payload.new as {
            id?: string
            status?: string
            is_locked?: boolean
          }
          if (!updated.id) return
          const nowWritable = updated.status === 'active' && !updated.is_locked
          // Force reconnect if write permission changed so clients re-authenticate with updated readOnly state
          closeMatchingConnections(
            (ctx) => ctx.boardId === updated.id && ctx.canWrite !== nowWritable,
            nowWritable ? 'Board unlocked' : 'Board is now read-only'
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'boards' },
        (payload) => {
          const oldRow = payload.old as { id?: string }
          if (!oldRow.id) return
          closeMatchingConnections(
            (ctx) => ctx.boardId === oldRow.id,
            'Board deleted'
          )
        }
      )
      .subscribe((status) => {
        logEvent('info', 'realtime.revocation_channel', { status })
      })
  }

  return {
    server,
    metrics,
    closeMatchingConnections,
  }
}

// Direct CLI entrypoint
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server/collab/index.ts') ||
    process.argv[1].endsWith('server/collab/index.js'))

if (isMainModule) {
  loadLocalEnvFiles()
  const { server } = createCollabServer({ stopOnSignals: false })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logEvent('info', 'server.shutdown_start', {
      signal,
      activeDocuments: server.hocuspocus.getDocumentsCount(),
      activeConnections: server.hocuspocus.getConnectionsCount(),
    })

    const forceTimer = setTimeout(() => {
      logEvent('error', 'server.shutdown_timeout')
      process.exit(1)
    }, 15_000)
    forceTimer.unref()

    try {
      await server.destroy()
      logEvent('info', 'server.shutdown_complete')
      process.exit(0)
    } catch (err) {
      logEvent('error', 'server.shutdown_error', {
        error: err instanceof Error ? err.message : String(err),
      })
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  server
    .listen()
    .then(() => {
      logEvent('info', 'server.listening', {
        port: server.address.port,
        address: server.address.address,
      })
    })
    .catch((err) => {
      logEvent('error', 'server.start_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      process.exit(1)
    })
}

