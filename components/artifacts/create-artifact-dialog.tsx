'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link as LinkIcon } from '@phosphor-icons/react'
import { createArtifactLink } from '@/actions/artifacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CreateArtifactDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

export function CreateArtifactDialog({ projectId, trigger }: CreateArtifactDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<string>('figma')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('projectId', projectId)
    formData.set('type', type)

    startTransition(async () => {
      const res = await createArtifactLink(formData)
      if (res.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to create artifact link')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : <Button size="sm" />}>
        {!trigger && (
          <>
            <LinkIcon className="size-4" />
            Add Link
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[460px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Artifact Link</DialogTitle>
          <DialogDescription>
            Bookmark an external workspace, design file, or prototype.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="label" className="text-sm font-medium">
              Label
            </label>
            <Input id="label" name="label" placeholder="Main Game Flow & Wireframes" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(val) => val && setType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="figma">Figma</SelectItem>
                <SelectItem value="figjam">FigJam</SelectItem>
                <SelectItem value="gdd">GDD</SelectItem>
                <SelectItem value="build">Build</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="url" className="text-sm font-medium">
              URL
            </label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://figma.com/file/..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Password or specific page reference..."
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
