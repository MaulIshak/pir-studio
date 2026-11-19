import * as Y from 'yjs'
import {
  CaptureUpdateAction,
  reconcileElements,
} from '@excalidraw/excalidraw'
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types'
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import type { Awareness } from 'y-protocols/awareness'
import { ELEMENTS_MAP_NAME, FILES_MAP_NAME } from './snapshot'
import type { BoardCollaboratorPresence, BoardFileRef } from './types'

export const LOCAL_YJS_ORIGIN = 'local-excalidraw'

const COLLABORATOR_PALETTE: ReadonlyArray<{ background: string; stroke: string }> = [
  { background: '#dbeafe', stroke: '#2563eb' },
  { background: '#fce7f3', stroke: '#db2777' },
  { background: '#d1fae5', stroke: '#059669' },
  { background: '#fef3c7', stroke: '#d97706' },
  { background: '#ede9fe', stroke: '#7c3aed' },
  { background: '#ffedd5', stroke: '#ea580c' },
  { background: '#cffafe', stroke: '#0891b2' },
  { background: '#ffe4e6', stroke: '#e11d48' },
]

export function getCollaboratorColor(userId: string): {
  background: string
  stroke: string
} {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return COLLABORATOR_PALETTE[Math.abs(hash) % COLLABORATOR_PALETTE.length]
}

function compareFractionalIndex(a: ExcalidrawElement, b: ExcalidrawElement): number {
  const idxA = (a as OrderedExcalidrawElement).index ?? ''
  const idxB = (b as OrderedExcalidrawElement).index ?? ''
  if (idxA === idxB) {
    return a.id.localeCompare(b.id)
  }
  return idxA < idxB ? -1 : 1
}

function cloneElementForYjs(el: ExcalidrawElement): Record<string, unknown> {
  return JSON.parse(JSON.stringify(el)) as Record<string, unknown>
}

export interface ExcalidrawYjsBindingOptions {
  doc: Y.Doc
  awareness: Awareness | null
  api: ExcalidrawImperativeAPI
  isReadOnly: () => boolean
  currentUser: {
    id: string
    name: string
    avatarUrl: string | null
  }
  onCollaboratorsChange?: (
    users: Array<{ id: string; name: string; avatarUrl: string | null; color: string }>
  ) => void
  onRemoteFileAdded?: (ref: BoardFileRef) => void
  onElementsDeleted?: (deletedIds: string[]) => void
}

export interface ExcalidrawYjsBinding {
  handleSceneChange: (elements: readonly OrderedExcalidrawElement[]) => void
  handlePointerUpdate: (payload: {
    pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
    button: 'up' | 'down'
  }) => void
  handleSelectionChange: (selectedElementIds: Readonly<Record<string, true>>) => void
  upsertFileRef: (ref: BoardFileRef) => void
  applyInitialFromDoc: () => void
  destroy: () => void
}

export function createExcalidrawYjsBinding(
  opts: ExcalidrawYjsBindingOptions
): ExcalidrawYjsBinding {
  const { doc, awareness, api } = opts
  const elementsMap = doc.getMap<Record<string, unknown>>(ELEMENTS_MAP_NAME)
  const filesMap = doc.getMap<BoardFileRef>(FILES_MAP_NAME)

  const syncedVersions = new Map<string, { version: number; versionNonce: number }>()
  const knownDeleted = new Set<string>()
  let isApplyingRemote = false
  let pendingRemoteRaf: number | null = null
  let pendingAwarenessRaf: number | null = null
  let destroyed = false

  // Pointer throttling state
  const POINTER_THROTTLE_MS = 40
  let lastPointerSentAt = 0
  let lastPointerKey = ''
  let pointerTimer: ReturnType<typeof setTimeout> | null = null
  let queuedPointer: {
    pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
    button: 'up' | 'down'
  } | null = null

  const userColor = getCollaboratorColor(opts.currentUser.id)

  // Initialize local awareness user profile
  if (awareness) {
    const initialPresence: BoardCollaboratorPresence = {
      user: {
        id: opts.currentUser.id,
        name: opts.currentUser.name,
        avatarUrl: opts.currentUser.avatarUrl,
        color: userColor.stroke,
      },
      selectedElementIds: {},
    }
    awareness.setLocalStateField('presence', initialPresence)
  }

  function applyRemoteElementsToScene(): void {
    if (destroyed) return
    pendingRemoteRaf = null

    const remoteList: OrderedExcalidrawElement[] = []
    elementsMap.forEach((raw) => {
      if (raw && typeof raw === 'object' && typeof raw.id === 'string') {
        remoteList.push(raw as unknown as OrderedExcalidrawElement)
      }
    })
    remoteList.sort(compareFractionalIndex)

    const localElements = api.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[]
    const appState = api.getAppState()

    const reconciled = reconcileElements(
      localElements,
      remoteList as unknown as readonly RemoteExcalidrawElement[],
      appState
    )

    for (const el of reconciled) {
      syncedVersions.set(el.id, {
        version: el.version,
        versionNonce: el.versionNonce,
      })
      if (el.isDeleted) {
        knownDeleted.add(el.id)
      }
    }

    isApplyingRemote = true
    try {
      api.updateScene({
        elements: reconciled,
        captureUpdate: CaptureUpdateAction.NEVER,
      })
    } finally {
      isApplyingRemote = false
    }
  }

  function scheduleRemoteApply(): void {
    if (destroyed || pendingRemoteRaf !== null) return
    pendingRemoteRaf = window.requestAnimationFrame(applyRemoteElementsToScene)
  }

  const handleElementsMapObserve = (event: Y.YMapEvent<Record<string, unknown>>) => {
    if (event.transaction.origin === LOCAL_YJS_ORIGIN) return
    scheduleRemoteApply()
  }

  const handleFilesMapObserve = (event: Y.YMapEvent<BoardFileRef>) => {
    if (!opts.onRemoteFileAdded) return
    event.keysChanged.forEach((key) => {
      const ref = filesMap.get(key)
      if (ref && ref.status === 'ready') {
        opts.onRemoteFileAdded?.(ref)
      }
    })
  }

  function syncCollaboratorsFromAwareness(): void {
    if (destroyed || !awareness) return
    pendingAwarenessRaf = null

    const states = awareness.getStates()
    const collaborators = new Map<SocketId, Collaborator>()
    const activeByUser = new Map<
      string,
      { id: string; name: string; avatarUrl: string | null; color: string }
    >()

    states.forEach((state, clientId) => {
      const presence = state?.presence as BoardCollaboratorPresence | undefined
      if (!presence?.user?.id) return

      activeByUser.set(presence.user.id, {
        id: presence.user.id,
        name: presence.user.name,
        avatarUrl: presence.user.avatarUrl,
        color: presence.user.color,
      })

      if (clientId === awareness.clientID) return

      const palette = getCollaboratorColor(presence.user.id)
      const socketId = String(clientId) as SocketId
      collaborators.set(socketId, {
        id: presence.user.id,
        socketId,
        username: presence.user.name,
        avatarUrl: presence.user.avatarUrl ?? undefined,
        color: palette,
        pointer: presence.pointer
          ? {
              x: presence.pointer.x,
              y: presence.pointer.y,
              tool: presence.pointer.tool,
              renderCursor: true,
            }
          : undefined,
        button: presence.button,
        selectedElementIds: presence.selectedElementIds,
      })
    })

    api.updateScene({
      collaborators,
      captureUpdate: CaptureUpdateAction.NEVER,
    })

    opts.onCollaboratorsChange?.(Array.from(activeByUser.values()))
  }

  const handleAwarenessChange = () => {
    if (destroyed || pendingAwarenessRaf !== null) return
    pendingAwarenessRaf = window.requestAnimationFrame(syncCollaboratorsFromAwareness)
  }

  elementsMap.observe(handleElementsMapObserve)
  filesMap.observe(handleFilesMapObserve)
  awareness?.on('change', handleAwarenessChange)

  function handleSceneChange(elements: readonly OrderedExcalidrawElement[]): void {
    if (destroyed || isApplyingRemote || opts.isReadOnly()) return

    const changed: OrderedExcalidrawElement[] = []
    const newlyDeleted: string[] = []

    for (const el of elements) {
      const prev = syncedVersions.get(el.id)
      if (!prev || prev.version !== el.version || prev.versionNonce !== el.versionNonce) {
        // Also compare with current Y.Map entry so we never overwrite newer remote version
        const existingInY = elementsMap.get(el.id) as
          | { version?: number; versionNonce?: number }
          | undefined
        if (
          existingInY &&
          typeof existingInY.version === 'number' &&
          existingInY.version > el.version
        ) {
          continue
        }
        changed.push(el)
        syncedVersions.set(el.id, {
          version: el.version,
          versionNonce: el.versionNonce,
        })
      }

      if (el.isDeleted && !knownDeleted.has(el.id)) {
        knownDeleted.add(el.id)
        newlyDeleted.push(el.id)
      }
    }

    if (changed.length > 0) {
      doc.transact(() => {
        for (const el of changed) {
          elementsMap.set(el.id, cloneElementForYjs(el))
        }
      }, LOCAL_YJS_ORIGIN)
    }

    if (newlyDeleted.length > 0) {
      opts.onElementsDeleted?.(newlyDeleted)
    }
  }

  function flushPointer(): void {
    if (destroyed || !awareness || !queuedPointer) return
    const payload = queuedPointer
    queuedPointer = null
    lastPointerSentAt = Date.now()

    const current =
      (awareness.getLocalState()?.presence as BoardCollaboratorPresence | undefined) ?? {
        user: {
          id: opts.currentUser.id,
          name: opts.currentUser.name,
          avatarUrl: opts.currentUser.avatarUrl,
          color: userColor.stroke,
        },
      }

    awareness.setLocalStateField('presence', {
      ...current,
      pointer: payload.pointer,
      button: payload.button,
    })
  }

  function handlePointerUpdate(payload: {
    pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
    button: 'up' | 'down'
  }): void {
    if (destroyed || !awareness) return
    const key = `${Math.round(payload.pointer.x)}:${Math.round(payload.pointer.y)}:${payload.pointer.tool}:${payload.button}`
    if (key === lastPointerKey) return
    lastPointerKey = key
    queuedPointer = payload

    const elapsed = Date.now() - lastPointerSentAt
    if (elapsed >= POINTER_THROTTLE_MS) {
      if (pointerTimer) {
        clearTimeout(pointerTimer)
        pointerTimer = null
      }
      flushPointer()
    } else if (!pointerTimer) {
      pointerTimer = setTimeout(() => {
        pointerTimer = null
        flushPointer()
      }, POINTER_THROTTLE_MS - elapsed)
    }
  }

  let lastSelectedKey = ''
  function handleSelectionChange(
    selectedElementIds: Readonly<Record<string, true>>
  ): void {
    if (destroyed || !awareness) return
    const keys = Object.keys(selectedElementIds).sort().join(',')
    if (keys === lastSelectedKey) return
    lastSelectedKey = keys

    const current =
      (awareness.getLocalState()?.presence as BoardCollaboratorPresence | undefined) ?? {
        user: {
          id: opts.currentUser.id,
          name: opts.currentUser.name,
          avatarUrl: opts.currentUser.avatarUrl,
          color: userColor.stroke,
        },
      }

    awareness.setLocalStateField('presence', {
      ...current,
      selectedElementIds: { ...selectedElementIds },
    })
  }

  function upsertFileRef(ref: BoardFileRef): void {
    if (destroyed || opts.isReadOnly()) return
    doc.transact(() => {
      filesMap.set(ref.fileId, ref)
    }, LOCAL_YJS_ORIGIN)
  }

  function applyInitialFromDoc(): void {
    if (destroyed) return
    applyRemoteElementsToScene()
    if (opts.onRemoteFileAdded) {
      filesMap.forEach((ref) => {
        if (ref && ref.status === 'ready') {
          opts.onRemoteFileAdded?.(ref)
        }
      })
    }
    syncCollaboratorsFromAwareness()
  }

  function destroy(): void {
    destroyed = true
    elementsMap.unobserve(handleElementsMapObserve)
    filesMap.unobserve(handleFilesMapObserve)
    awareness?.off('change', handleAwarenessChange)
    if (pendingRemoteRaf !== null) {
      window.cancelAnimationFrame(pendingRemoteRaf)
    }
    if (pendingAwarenessRaf !== null) {
      window.cancelAnimationFrame(pendingAwarenessRaf)
    }
    if (pointerTimer) {
      clearTimeout(pointerTimer)
    }
    if (awareness) {
      awareness.setLocalState(null)
    }
  }

  return {
    handleSceneChange,
    handlePointerUpdate,
    handleSelectionChange,
    upsertFileRef,
    applyInitialFromDoc,
    destroy,
  }
}

/**
 * Extract human-readable text from a selected Excalidraw element (standalone text
 * or a container shape with bound text) to pre-fill a task title.
 */
export function extractElementTaskTitle(
  element: ExcalidrawElement,
  allElements: readonly ExcalidrawElement[]
): string {
  if (element.type === 'text' && 'text' in element && typeof element.text === 'string') {
    const cleaned = element.text.replace(/\s+/g, ' ').trim()
    if (cleaned) return cleaned.slice(0, 120)
  }

  if (Array.isArray(element.boundElements)) {
    const boundTextRef = element.boundElements.find((b) => b.type === 'text')
    if (boundTextRef) {
      const boundText = allElements.find((el) => el.id === boundTextRef.id && !el.isDeleted)
      if (boundText && boundText.type === 'text' && 'text' in boundText && typeof boundText.text === 'string') {
        const cleaned = boundText.text.replace(/\s+/g, ' ').trim()
        if (cleaned) return cleaned.slice(0, 120)
      }
    }
  }

  const labelByType: Record<string, string> = {
    rectangle: 'Card Task',
    diamond: 'Decision Task',
    ellipse: 'Node Task',
    frame: 'Frame Task',
    image: 'Asset Task',
  }
  return labelByType[element.type] ?? 'Board Task'
}

