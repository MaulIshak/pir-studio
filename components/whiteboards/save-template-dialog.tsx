'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Layout } from '@phosphor-icons/react'
import { saveBoardAsTemplate } from '@/actions/boards'
import type { BoardTemplateCategory } from '@/lib/whiteboards/types'

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  defaultTitle: string
  getElements: () => Record<string, unknown>[]
  onSaved?: () => void
}

const CATEGORY_LABELS: Record<BoardTemplateCategory, string> = {
  brainstorm: 'Brainstorm',
  gameplay: 'Gameplay',
  scope: 'Scope',
  level: 'Level',
  ui: 'Screen Flow',
  custom: 'Custom',
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  boardId,
  defaultTitle,
  getElements,
  onSaved,
}: SaveTemplateDialogProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [category, setCategory] = useState<BoardTemplateCategory>('custom')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    const elements = getElements()
    if (elements.length === 0) {
      setError('Board has no elements to save')
      return
    }

    setLoading(true)
    setError(null)

    const res = await saveBoardAsTemplate({
      boardId,
      title: title.trim(),
      category,
      description: description.trim() || null,
      elements,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Layout className="size-4 text-primary" />
            Save Template
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Name</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Template name"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Category</label>
            <Select
              value={category}
              onValueChange={(v) => setCategory((v as BoardTemplateCategory) ?? 'custom')}
            >
              <SelectTrigger>
                <SelectValue>{CATEGORY_LABELS[category]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brainstorm">Brainstorm</SelectItem>
                <SelectItem value="gameplay">Gameplay</SelectItem>
                <SelectItem value="scope">Scope</SelectItem>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="ui">Screen Flow</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary"
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

