'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChalkboardSimple,
  Compass,
  FlowArrow,
  Lightbulb,
  MapTrifold,
  Plus,
  Scissors,
  Sparkle,
  Trash,
} from '@phosphor-icons/react'
import { createBoard, deleteOrgTemplate } from '@/actions/boards'
import type {
  BoardRecord,
  BoardTemplateCategory,
  BoardTemplateRecord,
} from '@/lib/whiteboards/types'

interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectSlug: string
  templates: BoardTemplateRecord[]
  canManageTemplates: boolean
  onCreated?: (board: BoardRecord) => void
  onTemplateDeleted?: (templateId: string) => void
}

const CATEGORY_ICON: Record<BoardTemplateCategory, typeof Lightbulb> = {
  brainstorm: Lightbulb,
  gameplay: Compass,
  scope: Scissors,
  level: MapTrifold,
  ui: FlowArrow,
  custom: Sparkle,
}

export function CreateBoardDialog({
  open,
  onOpenChange,
  projectId,
  projectSlug,
  templates,
  canManageTemplates,
  onCreated,
  onTemplateDeleted,
}: CreateBoardDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank')
  const [loading, setLoading] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const systemTemplates = templates.filter((t) => t.is_system)
  const orgTemplates = templates.filter((t) => !t.is_system)

  const handleSelectTemplate = (tplId: string, defaultTitle?: string) => {
    setSelectedTemplateId(tplId)
    if (!title.trim() && defaultTitle) {
      setTitle(defaultTitle)
    }
  }

  const handleDeleteOrgTemplate = async (
    e: React.MouseEvent,
    templateId: string
  ) => {
    e.stopPropagation()
    setDeletingTemplateId(templateId)
    const res = await deleteOrgTemplate(templateId)
    setDeletingTemplateId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('blank')
    }
    onTemplateDeleted?.(templateId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)

    const res = await createBoard({
      projectId,
      title: cleanTitle,
      templateId: selectedTemplateId === 'blank' ? null : selectedTemplateId,
    })

    setLoading(false)

    if (res.error || !res.board) {
      setError(res.error ?? 'Failed to create board')
      return
    }

    setTitle('')
    setSelectedTemplateId('blank')
    onOpenChange(false)
    onCreated?.(res.board)
    router.push(`/projects/${projectSlug}/boards/${res.board.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ChalkboardSimple className="size-4 text-primary" />
            New Board
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 pt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="board-title" className="text-xs font-medium text-foreground">
              Title
            </label>
            <Input
              id="board-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Core loop, Level 1, Scope cut..."
              autoFocus
              required
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <span className="text-xs font-medium text-foreground">Template</span>
            <ScrollArea className="max-h-[320px] pr-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Blank Board Option */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('blank')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors cursor-pointer ${
                    selectedTemplateId === 'blank'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Plus className="size-3.5 text-primary" />
                      Blank Canvas
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Start from an empty canvas.
                  </p>
                </button>

                {/* Built-in GameDev / Game Jam Templates */}
                {systemTemplates.map((tpl) => {
                  const Icon = CATEGORY_ICON[tpl.category] ?? Sparkle
                  const isSelected = selectedTemplateId === tpl.id
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id, tpl.title)}
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Icon className="size-3.5 text-primary" />
                          {tpl.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {tpl.category}
                        </Badge>
                      </div>
                      {tpl.description && (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {tpl.description}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Organization Custom Templates */}
              {orgTemplates.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Team Templates
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {orgTemplates.map((tpl) => {
                      const Icon = CATEGORY_ICON[tpl.category] ?? Sparkle
                      const isSelected = selectedTemplateId === tpl.id
                      return (
                        <div
                          key={tpl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectTemplate(tpl.id, tpl.title)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSelectTemplate(tpl.id, tpl.title)
                            }
                          }}
                          className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-1.5">
                            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                              <Icon className="size-3.5 shrink-0 text-primary" />
                              <span className="truncate">{tpl.title}</span>
                            </span>
                            {canManageTemplates && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={deletingTemplateId === tpl.id}
                                onClick={(e) => void handleDeleteOrgTemplate(e, tpl.id)}
                                className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label="Delete template"
                              >
                                <Trash className="size-3" />
                              </Button>
                            )}
                          </div>
                          {tpl.description && (
                            <p className="line-clamp-2 text-[11px] text-muted-foreground">
                              {tpl.description}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Creating...' : 'Create Board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
