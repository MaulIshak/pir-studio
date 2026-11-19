'use client'

import '@excalidraw/excalidraw/index.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import {
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  exportToSvg,
  getNonDeletedElements,
  loadFromBlob,
  restoreElements,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { createClient } from '@/lib/supabase/client'
import {
  cleanupDeletedElementLinks,
  renameBoard,
  toggleBoardLock,
  uploadBoardThumbnail,
} from '@/actions/boards'
import { deleteTask, updateTaskStatus } from '@/actions/tasks'
import {
  createExcalidrawYjsBinding,
  extractElementTaskTitle,
  type ExcalidrawYjsBinding,
} from '@/lib/whiteboards/yjs-binding'
import {
  fetchBoardImage,
  uploadBoardImage,
} from '@/lib/whiteboards/image-assets'
import type {
  BoardRecord,
  BoardTaskLinkRecord,
  BoardFileRef,
} from '@/lib/whiteboards/types'
import type { ProfileItem, TaskItem } from '@/components/tasks/task-card'
import { TaskDetailDialog } from '@/components/tasks/task-detail-dialog'
import { EditTaskDialog } from '@/components/tasks/edit-task-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  CheckSquareOffset,
  CloudCheck,
  CloudSlash,
  DotsThreeVertical,
  DownloadSimple,
  FileCode,
  FileImage,
  FileJs,
  Layout,
  LockSimple,
  LockSimpleOpen,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  TaskBadgeOverlay,
  type OverlayElementRect,
} from './task-badge-overlay'
import {
  ConvertToTaskDialog,
  type SelectedElementDraft,
} from './convert-to-task-dialog'
import { SaveTemplateDialog } from './save-template-dialog'

export interface WhiteboardCanvasProps {
  board: BoardRecord
  projectId: string
  projectSlug: string
  projectName: string
  canWrite: boolean
  canManage: boolean
  wsUrl: string
  highlightElementId?: string | null
  currentUser: {
    id: string
    name: string
    avatarUrl: string | null
  }
  initialTasks: TaskItem[]
  initialLinks: BoardTaskLinkRecord[]
  milestones: Array<{ id: string; title: string }>
  profiles: ProfileItem[]
}

type ConnectionBadgeState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'unauthorized'

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    toggleTheme: false,
  },
} as const

function areOverlayRectsEqual(
  prev: OverlayElementRect[],
  next: OverlayElementRect[]
): boolean {
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (
      a.id !== b.id ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.width !== b.width ||
      a.height !== b.height ||
      a.linkedTaskId !== b.linkedTaskId
    ) {
      return false
    }
  }
  return true
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Failed to encode blob'))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function WhiteboardCanvas({
  board,
  projectId,
  projectSlug,
  projectName,
  canWrite,
  canManage,
  wsUrl,
  highlightElementId,
  currentUser,
  initialTasks,
  initialLinks,
  milestones,
  profiles,
}: WhiteboardCanvasProps) {
  const { resolvedTheme } = useTheme()
  const supabase = useMemo(() => createClient(), [])
  const stableCurrentUser = useMemo(
    () => ({
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
    }),
    [currentUser.id, currentUser.name, currentUser.avatarUrl]
  )

  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [boardTitle, setBoardTitle] = useState(board.title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(board.title)
  const [isLocked, setIsLocked] = useState(board.is_locked)
  const [serverReadOnly, setServerReadOnly] = useState(!canWrite)
  const [connectionState, setConnectionState] = useState<ConnectionBadgeState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting'
  )
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<
    Array<{ id: string; name: string; avatarUrl: string | null; color: string }>
  >([])

  // Live tasks & links for status badge overlay (never stored in Yjs)
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [links, setLinks] = useState<BoardTaskLinkRecord[]>(initialLinks)
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)

  // Viewport + overlay tracking
  const [viewport, setViewport] = useState({ scrollX: 0, scrollY: 0, zoom: 1 })
  const [overlayElements, setOverlayElements] = useState<OverlayElementRect[]>([])
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])

  // Dialogs
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

  // Refs
  const bindingRef = useRef<ExcalidrawYjsBinding | null>(null)
  const isReadOnlyRef = useRef(!canWrite)
  const uploadedFileIdsRef = useRef<Set<string>>(new Set())
  const didHighlightRef = useRef(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const linksRef = useRef<BoardTaskLinkRecord[]>(initialLinks)
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasEverConnectedRef = useRef(false)

  const isReadOnly =
    !canWrite || serverReadOnly || board.status === 'archived' || isLocked

  useEffect(() => {
    isReadOnlyRef.current = isReadOnly
  }, [isReadOnly])

  useEffect(() => {
    linksRef.current = links
  }, [links])

  const tasksById = useMemo(() => {
    const map = new Map<string, TaskItem>()
    for (const t of tasks) {
      map.set(t.id, t)
    }
    return map
  }, [tasks])

  // Clear ephemeral notices automatically
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // Browser online/offline indicator
  useEffect(() => {
    const handleOffline = () => setConnectionState('offline')
    const handleOnline = () => {
      setConnectionState((prev) => (prev === 'offline' ? 'reconnecting' : prev))
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Warn user before leaving if unsynced edits exist
  useEffect(() => {
    if (unsyncedCount <= 0) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsyncedCount])

  // Subscribe to Supabase Realtime for live task updates & board lock changes
  useEffect(() => {
    const channel = supabase
      .channel(`whiteboard_tasks_${board.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as TaskItem
            setTasks((prev) =>
              prev.some((t) => t.id === newTask.id) ? prev : [newTask, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TaskItem
            const matchedAssignee = updated.assignee_id
              ? profiles.find((p) => p.id === updated.assignee_id)
              : undefined
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updated.id
                  ? {
                      ...t,
                      ...updated,
                      profiles:
                        updated.assignee_id === t.assignee_id
                          ? t.profiles
                          : matchedAssignee
                            ? {
                                id: matchedAssignee.id,
                                name: matchedAssignee.name || matchedAssignee.email || 'Member',
                                avatar_url: matchedAssignee.avatar_url ?? null,
                              }
                            : null,
                    }
                  : t
              )
            )
            setActiveTaskDetail((prev) =>
              prev && prev.id === updated.id ? { ...prev, ...updated } : prev
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setTasks((prev) => prev.filter((t) => t.id !== deletedId))
            setLinks((prev) => prev.filter((l) => l.task_id !== deletedId))
            setActiveTaskDetail((prev) => (prev?.id === deletedId ? null : prev))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${board.id}`,
        },
        (payload) => {
          const updated = payload.new as {
            title?: string
            is_locked?: boolean
            status?: string
          }
          if (typeof updated.title === 'string') {
            setBoardTitle(updated.title)
          }
          if (typeof updated.is_locked === 'boolean') {
            setIsLocked(updated.is_locked)
          }
          if (updated.status === 'archived') {
            setServerReadOnly(true)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [board.id, projectId, profiles, supabase])

  const focusHighlightedElement = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      if (!highlightElementId || didHighlightRef.current) return
      const all = api.getSceneElements()
      const target = all.find((el) => el.id === highlightElementId)
      if (!target) return

      didHighlightRef.current = true
      api.scrollToContent([target], { fitToViewport: true, animate: true })
      api.updateScene({
        appState: {
          selectedElementIds: { [target.id]: true },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      })
    },
    [highlightElementId]
  )

  const refreshOverlayFromApi = useCallback((api: ExcalidrawImperativeAPI) => {
    const nonDeleted = getNonDeletedElements(api.getSceneElements())
    const linkedIds = new Set(
      linksRef.current.map((l) => l.element_id).filter((id): id is string => Boolean(id))
    )
    const rects: OverlayElementRect[] = []
    for (const el of nonDeleted) {
      const custom = el.customData as { linkedTaskId?: string } | undefined
      if (!custom?.linkedTaskId && !linkedIds.has(el.id)) continue
      rects.push({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        linkedTaskId: custom?.linkedTaskId,
      })
    }
    setOverlayElements((prev) => (areOverlayRectsEqual(prev, rects) ? prev : rects))
  }, [])

  // Main Yjs + IndexedDB + Hocuspocus lifecycle
  useEffect(() => {
    if (!excalidrawAPI) return

    const ydoc = new Y.Doc()
    const idb = new IndexeddbPersistence(`board:${board.id}`, ydoc)

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: `board:${board.id}`,
      document: ydoc,
      token: async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? ''
      },
      onStatus: ({ status }) => {
        if (status === WebSocketStatus.Connected) {
          hasEverConnectedRef.current = true
          setAuthError(null)
          setConnectionState('connected')
        } else if (status === WebSocketStatus.Connecting) {
          setConnectionState(
            hasEverConnectedRef.current ? 'reconnecting' : 'connecting'
          )
        } else if (status === WebSocketStatus.Disconnected) {
          setConnectionState(
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'offline'
              : 'reconnecting'
          )
        }
      },
      onAuthenticated: ({ scope }) => {
        setAuthError(null)
        setServerReadOnly(scope === 'readonly')
      },
      onAuthenticationFailed: ({ reason }) => {
        setAuthError(reason || 'Access denied')
        setConnectionState('unauthorized')
      },
      onSynced: ({ state }) => {
        if (state) {
          bindingRef.current?.applyInitialFromDoc()
          refreshOverlayFromApi(excalidrawAPI)
          focusHighlightedElement(excalidrawAPI)
        }
      },
      onUnsyncedChanges: ({ number }) => {
        setUnsyncedCount(number)
      },
    })

    const handleRemoteFileAdded = (ref: BoardFileRef) => {
      const currentFiles = excalidrawAPI.getFiles()
      if (currentFiles[ref.fileId]) {
        uploadedFileIdsRef.current.add(ref.fileId)
        return
      }
      void fetchBoardImage(board.id, ref.fileId, ref.mimeType).then((binaryFile) => {
        if (binaryFile) {
          uploadedFileIdsRef.current.add(ref.fileId)
          excalidrawAPI.addFiles([binaryFile])
        }
      })
    }

    const handleElementsDeleted = (deletedIds: string[]) => {
      const linkedDeleted = deletedIds.filter((id) =>
        linksRef.current.some((l) => l.element_id === id)
      )
      if (linkedDeleted.length > 0) {
        setLinks((prev) =>
          prev.filter((l) => !l.element_id || !linkedDeleted.includes(l.element_id))
        )
        void cleanupDeletedElementLinks(board.id, linkedDeleted)
      }
    }

    const binding = createExcalidrawYjsBinding({
      doc: ydoc,
      awareness: provider.awareness,
      api: excalidrawAPI,
      isReadOnly: () => isReadOnlyRef.current,
      currentUser: stableCurrentUser,
      onCollaboratorsChange: (nextUsers) => {
        setCollaborators((prev) => {
          if (
            prev.length === nextUsers.length &&
            prev.every(
              (u, i) =>
                u.id === nextUsers[i].id &&
                u.name === nextUsers[i].name &&
                u.avatarUrl === nextUsers[i].avatarUrl &&
                u.color === nextUsers[i].color
            )
          ) {
            return prev
          }
          return nextUsers
        })
      },
      onRemoteFileAdded: handleRemoteFileAdded,
      onElementsDeleted: handleElementsDeleted,
    })
    bindingRef.current = binding

    // Load cached offline state immediately while WebSocket handshakes
    idb.on('synced', () => {
      binding.applyInitialFromDoc()
      refreshOverlayFromApi(excalidrawAPI)
      focusHighlightedElement(excalidrawAPI)
    })

    return () => {
      binding.destroy()
      bindingRef.current = null
      provider.destroy()
      void idb.destroy()
      ydoc.destroy()
    }
  }, [
    board.id,
    stableCurrentUser,
    excalidrawAPI,
    focusHighlightedElement,
    refreshOverlayFromApi,
    supabase,
    wsUrl,
  ])

  const scheduleThumbnailUpload = useCallback(() => {
    if (isReadOnlyRef.current || !excalidrawAPI) return
    if (thumbnailTimerRef.current) {
      clearTimeout(thumbnailTimerRef.current)
    }
    thumbnailTimerRef.current = setTimeout(async () => {
      try {
        const els = getNonDeletedElements(excalidrawAPI.getSceneElements())
        if (els.length === 0) return
        const blob = await exportToBlob({
          elements: els,
          appState: {
            exportWithDarkMode: false,
            exportBackground: true,
            viewBackgroundColor: '#ffffff',
          },
          files: excalidrawAPI.getFiles(),
          mimeType: 'image/webp',
          quality: 0.72,
          maxWidthOrHeight: 640,
        })
        const dataUrl = await blobToDataUrl(blob)
        await uploadBoardThumbnail(board.id, dataUrl)
      } catch {
        // Non-blocking best-effort thumbnail
      }
    }, 15_000)
  }, [board.id, excalidrawAPI])

  useEffect(() => {
    return () => {
      if (thumbnailTimerRef.current) {
        clearTimeout(thumbnailTimerRef.current)
      }
    }
  }, [])

  const handleExcalidrawChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      const binding = bindingRef.current
      if (binding) {
        binding.handleSceneChange(elements)
        binding.handleSelectionChange(appState.selectedElementIds)
      }

      // Track selected element IDs for floating Make Task bar
      const nextSelected = Object.keys(appState.selectedElementIds).filter(
        (id) => appState.selectedElementIds[id]
      )
      setSelectedElementIds((prev) =>
        prev.length === nextSelected.length &&
        prev.every((v, i) => v === nextSelected[i])
          ? prev
          : nextSelected
      )

      // Keep viewport & task badge overlay synchronized
      setViewport((prev) => {
        const nextZoom = appState.zoom.value
        if (
          prev.scrollX === appState.scrollX &&
          prev.scrollY === appState.scrollY &&
          prev.zoom === nextZoom
        ) {
          return prev
        }
        return {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: nextZoom,
        }
      })

      const linkedIds = new Set(
        linksRef.current.map((l) => l.element_id).filter((id): id is string => Boolean(id))
      )
      const rects: OverlayElementRect[] = []
      for (const el of elements) {
        if (el.isDeleted) continue
        const custom = el.customData as { linkedTaskId?: string } | undefined
        if (!custom?.linkedTaskId && !linkedIds.has(el.id)) continue
        rects.push({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          linkedTaskId: custom?.linkedTaskId,
        })
      }
      setOverlayElements((prev) => (areOverlayRectsEqual(prev, rects) ? prev : rects))

      // Upload newly pasted/dropped local image files to Garage via presigned URL
      if (!isReadOnlyRef.current && binding) {
        for (const file of Object.values(files)) {
          if (!file?.id || uploadedFileIdsRef.current.has(file.id)) continue
          uploadedFileIdsRef.current.add(file.id)
          void uploadBoardImage(board.id, file).then((result) => {
            if (result.ok) {
              binding.upsertFileRef({
                fileId: file.id,
                mimeType: result.mimeType,
                status: 'ready',
                width: result.width,
                height: result.height,
              })
            } else {
              uploadedFileIdsRef.current.delete(file.id)
              setNotice(result.error || 'Image upload failed')
            }
          })
        }
        if (elements.length > 0) {
          scheduleThumbnailUpload()
        }
      }
    },
    [board.id, scheduleThumbnailUpload]
  )

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
      button: 'up' | 'down'
    }) => {
      bindingRef.current?.handlePointerUpdate({
        pointer: payload.pointer,
        button: payload.button,
      })
    },
    []
  )

  const selectedElementDrafts = useMemo<SelectedElementDraft[]>(() => {
    if (!excalidrawAPI || selectedElementIds.length === 0) return []
    const allElements = excalidrawAPI.getSceneElements()
    const drafts: SelectedElementDraft[] = []
    const seen = new Set<string>()

    for (const id of selectedElementIds) {
      const el = allElements.find((e) => e.id === id)
      if (!el || el.isDeleted) continue
      // If user selected bound text inside a container shape, target the parent container instead
      const containerId =
        el.type === 'text' && 'containerId' in el && el.containerId
          ? el.containerId
          : null
      const target = containerId
        ? allElements.find((e) => e.id === containerId && !e.isDeleted) ?? el
        : el

      if (seen.has(target.id)) continue
      seen.add(target.id)
      drafts.push({
        elementId: target.id,
        suggestedTitle: extractElementTaskTitle(target, allElements),
      })
    }
    return drafts
  }, [excalidrawAPI, selectedElementIds])

  const handleTasksLinked = useCallback(
    (
      pairs: Array<{ elementId: string; task: TaskItem; link: BoardTaskLinkRecord }>
    ) => {
      setTasks((prev) => {
        const next = [...prev]
        for (const p of pairs) {
          if (!next.some((t) => t.id === p.task.id)) {
            next.unshift(p.task)
          }
        }
        return next
      })

      setLinks((prev) => [...pairs.map((p) => p.link), ...prev])

      // Stamp lightweight customData.linkedTaskId on each linked Excalidraw element (status is NEVER stored)
      if (excalidrawAPI) {
        const taskByElId = new Map(pairs.map((p) => [p.elementId, p.task.id]))
        const updatedElements = excalidrawAPI
          .getSceneElementsIncludingDeleted()
          .map((el) => {
            const linkedTaskId = taskByElId.get(el.id)
            if (!linkedTaskId) return el
            return {
              ...el,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now(),
              customData: {
                ...(el.customData ?? {}),
                linkedTaskId,
              },
            }
          }) as OrderedExcalidrawElement[]

        excalidrawAPI.updateScene({
          elements: updatedElements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        })
        bindingRef.current?.handleSceneChange(updatedElements)
        refreshOverlayFromApi(excalidrawAPI)
      }

      setNotice(
        pairs.length > 1
          ? `${pairs.length} tasks linked`
          : 'Task linked'
      )
    },
    [excalidrawAPI, refreshOverlayFromApi]
  )

  const handleSaveTitle = async () => {
    setIsEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === boardTitle) {
      setTitleDraft(boardTitle)
      return
    }
    setBoardTitle(trimmed)
    const res = await renameBoard(board.id, trimmed)
    if (res.error) {
      setBoardTitle(board.title)
      setTitleDraft(board.title)
      setNotice(res.error)
    }
  }

  const handleToggleLock = async () => {
    const nextLocked = !isLocked
    const res = await toggleBoardLock(board.id, nextLocked)
    if (res.error) {
      setNotice(res.error)
      return
    }
    setIsLocked(nextLocked)
    setNotice(nextLocked ? 'Board locked' : 'Board unlocked')
  }

  const handleExportPng = async () => {
    if (!excalidrawAPI) return
    const elements = getNonDeletedElements(excalidrawAPI.getSceneElements())
    const blob = await exportToBlob({
      elements,
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      mimeType: 'image/png',
    })
    downloadBlob(blob, `${boardTitle.toLowerCase().replace(/\s+/g, '-') || 'board'}.png`)
  }

  const handleExportSvg = async () => {
    if (!excalidrawAPI) return
    const elements = getNonDeletedElements(excalidrawAPI.getSceneElements())
    const svg = await exportToSvg({
      elements,
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    })
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    downloadBlob(blob, `${boardTitle.toLowerCase().replace(/\s+/g, '-') || 'board'}.svg`)
  }

  const handleExportJson = () => {
    if (!excalidrawAPI) return
    const json = serializeAsJSON(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
      'local'
    )
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, `${boardTitle.toLowerCase().replace(/\s+/g, '-') || 'board'}.excalidraw`)
  }

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !excalidrawAPI || isReadOnly) return

    try {
      const loaded = await loadFromBlob(file, excalidrawAPI.getAppState(), null)
      const restored = restoreElements(loaded.elements ?? [], null, {
        refreshDimensions: true,
      })
      const existing = excalidrawAPI.getSceneElementsIncludingDeleted()
      const merged = [...existing, ...restored] as OrderedExcalidrawElement[]

      if (loaded.files) {
        excalidrawAPI.addFiles(Object.values(loaded.files))
      }
      excalidrawAPI.updateScene({
        elements: merged,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
      bindingRef.current?.handleSceneChange(merged)
      setNotice('Board imported')
    } catch {
      setNotice('Invalid Excalidraw file')
    }
  }

  const handleQuickTaskStatus = async (
    taskId: string,
    newStatus: 'todo' | 'in_progress' | 'review' | 'done'
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )
    setActiveTaskDetail((prev) =>
      prev && prev.id === taskId ? { ...prev, status: newStatus } : prev
    )
    await updateTaskStatus(taskId, projectId, newStatus)
  }

  const handleDeleteLinkedTask = async (taskId: string) => {
    const res = await deleteTask(taskId, projectId)
    if (res.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setLinks((prev) => prev.filter((l) => l.task_id !== taskId))
      setActiveTaskDetail(null)
    }
  }

  const connectionMeta = useMemo(() => {
    if (connectionState === 'connected') {
      return {
        label: unsyncedCount > 0 ? 'Syncing' : 'Connected',
        icon: unsyncedCount > 0 ? SpinnerGap : CloudCheck,
        spin: unsyncedCount > 0,
        className:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      }
    }
    if (connectionState === 'offline') {
      return {
        label: 'Offline',
        icon: CloudSlash,
        spin: false,
        className:
          'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      }
    }
    if (connectionState === 'unauthorized') {
      return {
        label: 'Disconnected',
        icon: WarningCircle,
        spin: false,
        className:
          'border-destructive/30 bg-destructive/10 text-destructive',
      }
    }
    return {
      label: connectionState === 'reconnecting' ? 'Reconnecting' : 'Connecting',
      icon: SpinnerGap,
      spin: true,
      className:
        'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    }
  }, [connectionState, unsyncedCount])

  const ConnIcon = connectionMeta.icon

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-background">
      {/* Compact Full-Viewport Whiteboard Top Bar */}
      <header className="z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            nativeButton={false}
            render={<Link href={`/projects/${projectSlug}/boards`} />}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">{projectName}</span>
          </Button>

          <span className="text-muted-foreground/40">/</span>

          {isEditingTitle && !isReadOnly ? (
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveTitle()
                if (e.key === 'Escape') {
                  setTitleDraft(boardTitle)
                  setIsEditingTitle(false)
                }
              }}
              autoFocus
              className="h-7 w-44 text-xs font-semibold sm:w-64"
            />
          ) : (
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => {
                setTitleDraft(boardTitle)
                setIsEditingTitle(true)
              }}
              className="max-w-[180px] truncate text-left text-xs font-semibold text-foreground hover:text-primary disabled:cursor-default disabled:hover:text-foreground sm:max-w-xs sm:text-sm"
            >
              {boardTitle}
            </button>
          )}

          {isReadOnly && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
            >
              <LockSimple className="size-3" />
              {board.status === 'archived' ? 'Archived' : 'Read Only'}
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Active Collaborators */}
          {collaborators.length > 0 && (
            <div className="hidden items-center -space-x-1.5 sm:flex">
              {collaborators.slice(0, 6).map((user) => (
                <Tooltip key={user.id}>
                  <TooltipTrigger>
                    <Avatar
                      className="size-6 border-2 bg-background"
                      style={{ borderColor: user.color }}
                    >
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                      <AvatarFallback className="text-[10px] font-semibold">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{user.name}</TooltipContent>
                </Tooltip>
              ))}
              {collaborators.length > 6 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                  +{collaborators.length - 6}
                </Badge>
              )}
            </div>
          )}

          {/* Connection Status Badge */}
          <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${connectionMeta.className}`}>
            <ConnIcon className={`size-3 ${connectionMeta.spin ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">{connectionMeta.label}</span>
          </Badge>

          {/* Admin Lock Toggle */}
          {canManage && board.status === 'active' && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleToggleLock}
              className="hidden gap-1 text-xs md:inline-flex"
            >
              {isLocked ? (
                <>
                  <LockSimpleOpen className="size-3.5" />
                  Unlock
                </>
              ) : (
                <>
                  <LockSimple className="size-3.5" />
                  Lock
                </>
              )}
            </Button>
          )}

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-xs" aria-label="Board menu" />}
            >
              <DotsThreeVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canManage && board.status === 'active' && (
                <DropdownMenuItem onClick={handleToggleLock}>
                  {isLocked ? (
                    <LockSimpleOpen className="size-3.5" />
                  ) : (
                    <LockSimple className="size-3.5" />
                  )}
                  {isLocked ? 'Unlock Board' : 'Lock Board'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)}>
                <Layout className="size-3.5" />
                Save Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportPng}>
                <FileImage className="size-3.5" />
                Export PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSvg}>
                <FileCode className="size-3.5" />
                Export SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson}>
                <FileJs className="size-3.5" />
                Export JSON
              </DropdownMenuItem>
              {!isReadOnly && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                    <UploadSimple className="size-3.5" />
                    Import JSON
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={importInputRef}
            type="file"
            accept=".excalidraw,.json,application/json"
            onChange={handleImportJsonFile}
            className="hidden"
          />
        </div>
      </header>

      {/* Auth / Notice Banners */}
      {authError && (
        <div className="z-30 px-3 pt-2">
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-2 text-xs">
              <span>{authError}</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {notice && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <Badge variant="secondary" className="border border-border px-3 py-1 text-xs shadow-md">
            <DownloadSimple className="mr-1.5 size-3.5 text-primary" />
            {notice}
          </Badge>
        </div>
      )}

      {/* Full-Viewport Canvas Region */}
      <div className="relative flex-1 min-h-0 w-full">
        <Excalidraw
          excalidrawAPI={setExcalidrawAPI}
          onChange={handleExcalidrawChange}
          onPointerUpdate={handlePointerUpdate}
          isCollaborating={true}
          viewModeEnabled={isReadOnly}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          name={boardTitle}
          UIOptions={EXCALIDRAW_UI_OPTIONS}
        />

        {/* Live Task Status Badges Overlay (sourced from Supabase Realtime, never Yjs) */}
        <TaskBadgeOverlay
          elements={overlayElements}
          links={links}
          tasksById={tasksById}
          scrollX={viewport.scrollX}
          scrollY={viewport.scrollY}
          zoom={viewport.zoom}
          onSelectTask={(task) => setActiveTaskDetail(task)}
        />

        {/* Floating Selection Action Bar: Make Task / Link Task */}
        {!isReadOnly && selectedElementDrafts.length > 0 && (
          <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-muted-foreground">
                {selectedElementDrafts.length}{' '}
                {selectedElementDrafts.length === 1 ? 'selected' : 'selected'}
              </span>
              <Button
                size="xs"
                onClick={() => setConvertDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <CheckSquareOffset className="size-3.5" />
                {selectedElementDrafts.length > 1 ? 'Create Tasks' : 'Make Task'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Convert / Link Element to Task Dialog */}
      <ConvertToTaskDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        boardId={board.id}
        projectId={projectId}
        selectedElements={selectedElementDrafts}
        milestones={milestones}
        profiles={profiles}
        existingTasks={tasks}
        onTasksLinked={handleTasksLinked}
      />

      {/* Save Organization Template Dialog */}
      <SaveTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        boardId={board.id}
        defaultTitle={boardTitle}
        getElements={() => {
          if (!excalidrawAPI) return []
          return getNonDeletedElements(excalidrawAPI.getSceneElements()) as unknown as Record<
            string,
            unknown
          >[]
        }}
        onSaved={() => setNotice('Template saved')}
      />

      {/* Linked Task Detail Dialog */}
      {activeTaskDetail && (
        <TaskDetailDialog
          task={activeTaskDetail}
          projectId={projectId}
          open={!!activeTaskDetail}
          onOpenChange={(isOpen) => {
            if (!isOpen) setActiveTaskDetail(null)
          }}
          onEdit={() => {
            setEditingTask(activeTaskDetail)
            setActiveTaskDetail(null)
          }}
          onDelete={() => void handleDeleteLinkedTask(activeTaskDetail.id)}
          onStatusChange={(id, st) => void handleQuickTaskStatus(id, st)}
          onUpdateTask={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            setActiveTaskDetail(updated)
          }}
        />
      )}

      {/* Edit Linked Task Dialog */}
      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          projectId={projectId}
          milestones={milestones}
          profiles={profiles}
          open={!!editingTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingTask(null)
          }}
          onSuccess={(updated) => {
            if (updated) {
              setTasks((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t))
              )
            }
          }}
        />
      )}
    </div>
  )
}
