'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Archive,
  ArrowCounterClockwise,
  ChalkboardSimple,
  Clock,
  DotsThreeVertical,
  LockSimple,
  LockSimpleOpen,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import {
  deleteBoard,
  renameBoard,
  toggleBoardLock,
  updateBoardStatus,
} from '@/actions/boards'
import { buildStorageFileUrl } from '@/lib/storage/urls'
import type { BoardRecord, BoardTemplateRecord } from '@/lib/whiteboards/types'
import { CreateBoardDialog } from './create-board-dialog'

interface BoardListClientProps {
  projectId: string
  projectSlug: string
  initialBoards: BoardRecord[]
  initialTemplates: BoardTemplateRecord[]
  canManage: boolean
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function BoardListClient({
  projectId,
  projectSlug,
  initialBoards,
  initialTemplates,
  canManage,
}: BoardListClientProps) {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardRecord[]>(initialBoards)
  const [templates, setTemplates] = useState<BoardTemplateRecord[]>(initialTemplates)
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [renamingBoard, setRenamingBoard] = useState<BoardRecord | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingBoard, setDeletingBoard] = useState<BoardRecord | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredBoards = boards.filter((b) => b.status === filter)
  const activeCount = boards.filter((b) => b.status === 'active').length
  const archivedCount = boards.filter((b) => b.status === 'archived').length

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renamingBoard || !renameValue.trim()) return
    setBusyId(renamingBoard.id)
    setError(null)
    const res = await renameBoard(renamingBoard.id, renameValue.trim())
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setBoards((prev) =>
      prev.map((b) =>
        b.id === renamingBoard.id
          ? { ...b, title: renameValue.trim(), updated_at: new Date().toISOString() }
          : b
      )
    )
    setRenamingBoard(null)
  }

  const handleToggleLock = async (board: BoardRecord) => {
    setBusyId(board.id)
    setError(null)
    const nextLocked = !board.is_locked
    const res = await toggleBoardLock(board.id, nextLocked)
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setBoards((prev) =>
      prev.map((b) => (b.id === board.id ? { ...b, is_locked: nextLocked } : b))
    )
  }

  const handleToggleArchive = async (board: BoardRecord) => {
    setBusyId(board.id)
    setError(null)
    const nextStatus = board.status === 'active' ? 'archived' : 'active'
    const res = await updateBoardStatus(board.id, nextStatus)
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setBoards((prev) =>
      prev.map((b) => (b.id === board.id ? { ...b, status: nextStatus } : b))
    )
  }

  const handleConfirmDelete = async () => {
    if (!deletingBoard) return
    setBusyId(deletingBoard.id)
    setError(null)
    const res = await deleteBoard(deletingBoard.id)
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setBoards((prev) => prev.filter((b) => b.id !== deletingBoard.id))
    setDeletingBoard(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Boards</h2>
          <p className="text-xs text-muted-foreground">
            Collaborate live on jam ideas, loops, level blockouts, and screen flows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as 'active' | 'archived')}
          >
            <TabsList className="h-8">
              <TabsTrigger value="active" className="text-xs gap-1.5">
                Active
                <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">
                  {activeCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs gap-1.5">
                Archived
                <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">
                  {archivedCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            New Board
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>{error}</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setError(null)
                router.refresh()
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {filteredBoards.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ChalkboardSimple className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">
                {filter === 'active' ? 'No boards' : 'No archived boards'}
              </p>
              <p className="text-xs text-muted-foreground">
                {filter === 'active'
                  ? 'Start a blank canvas or pick a game jam template.'
                  : 'Archived boards stay read-only here.'}
              </p>
            </div>
            {filter === 'active' && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-1 gap-1.5">
                <Plus className="size-3.5" />
                New Board
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Populated Responsive Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoards.map((board, index) => {
            const href = `/projects/${projectSlug}/boards/${board.id}`
            const thumbUrl = board.thumbnail_key
              ? buildStorageFileUrl(board.thumbnail_key)
              : null

            return (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
              >
                <Card className="group flex h-full flex-col overflow-hidden transition-colors hover:border-primary/40">
                  {/* Thumbnail Preview */}
                  <Link
                    href={href}
                    className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden border-b border-border bg-muted/30"
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={board.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                        <ChalkboardSimple className="size-8 text-primary/60" />
                        <span className="text-[11px] font-medium">Open Canvas</span>
                      </div>
                    )}

                    {(board.is_locked || board.status === 'archived') && (
                      <Badge
                        variant="outline"
                        className="absolute top-2 right-2 gap-1 border-amber-500/40 bg-background/90 text-[10px] text-amber-700 backdrop-blur-sm dark:text-amber-400"
                      >
                        <LockSimple className="size-3" />
                        {board.status === 'archived' ? 'Archived' : 'Locked'}
                      </Badge>
                    )}
                  </Link>

                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <Link href={href} className="min-w-0 flex-1">
                      <CardTitle className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                        {board.title}
                      </CardTitle>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={busyId === board.id}
                            aria-label="Board options"
                          />
                        }
                      >
                        <DotsThreeVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {board.status === 'active' && !board.is_locked && (
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingBoard(board)
                              setRenameValue(board.title)
                            }}
                          >
                            <PencilSimple className="size-3.5" />
                            Rename
                          </DropdownMenuItem>
                        )}
                        {canManage && board.status === 'active' && (
                          <DropdownMenuItem onClick={() => void handleToggleLock(board)}>
                            {board.is_locked ? (
                              <LockSimpleOpen className="size-3.5" />
                            ) : (
                              <LockSimple className="size-3.5" />
                            )}
                            {board.is_locked ? 'Unlock' : 'Lock'}
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <DropdownMenuItem onClick={() => void handleToggleArchive(board)}>
                            {board.status === 'active' ? (
                              <Archive className="size-3.5" />
                            ) : (
                              <ArrowCounterClockwise className="size-3.5" />
                            )}
                            {board.status === 'active' ? 'Archive' : 'Restore'}
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingBoard(board)}
                            >
                              <Trash className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>

                  <CardFooter className="mt-auto flex items-center justify-between gap-2 pt-0 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Clock className="size-3 shrink-0" />
                      {formatUpdatedAt(board.updated_at)}
                    </span>
                    {board.creator?.name && (
                      <span className="truncate">{board.creator.name}</span>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create Board Dialog */}
      <CreateBoardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        projectSlug={projectSlug}
        templates={templates}
        canManageTemplates={canManage}
        onCreated={(newBoard) => setBoards((prev) => [newBoard, ...prev])}
        onTemplateDeleted={(id) =>
          setTemplates((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* Rename Board Dialog */}
      <Dialog
        open={!!renamingBoard}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRenamingBoard(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Rename Board</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-3 pt-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Board title"
              autoFocus
              required
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRenamingBoard(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busyId === renamingBoard?.id}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation */}
      <ConfirmDialog
        open={!!deletingBoard}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeletingBoard(null)
        }}
        title="Delete Board"
        description="This permanently removes the board, its canvas history, and uploaded images."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={busyId === deletingBoard?.id}
      />
    </div>
  )
}
