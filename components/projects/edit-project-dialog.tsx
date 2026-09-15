'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProject, archiveProject } from '@/actions/projects'
import { notifyProjectsChanged } from '@/lib/events'
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
import { PencilSimple, Archive, ArrowCounterClockwise } from '@phosphor-icons/react'

interface EditProjectDialogProps {
  project: {
    id: string
    slug: string
    name: string
    type: 'jam' | 'competition' | 'internal'
    status: 'active' | 'completed' | 'archived'
    start_date: string | null
    deadline: string | null
    description: string | null
  }
}

export function EditProjectDialog({ project }: EditProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<string>(project.type)
  const [status, setStatus] = useState<string>(project.status)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const slug = (formData.get('slug') as string)?.trim()
    const startDate = (formData.get('start_date') as string) || null
    const deadline = (formData.get('deadline') as string) || null
    const description = (formData.get('description') as string) || null

    startTransition(async () => {
      const res = await updateProject(project.id, {
        name,
        slug: slug || undefined,
        type: type as 'jam' | 'competition' | 'internal',
        status: status as 'active' | 'completed' | 'archived',
        start_date: startDate,
        deadline,
        description,
      })

      if (res.success) {
        setOpen(false)
        notifyProjectsChanged()
        if (res.project?.slug && res.project.slug !== project.slug) {
          router.push(`/projects/${res.project.slug}`)
        } else {
          router.refresh()
        }
      } else {
        setError(res.error || 'Failed to update project')
      }
    })
  }

  async function handleToggleArchive() {
    setError(null)
    const nextStatus = project.status === 'archived' ? 'active' : 'archived'

    startTransition(async () => {
      let res
      if (nextStatus === 'archived') {
        res = await archiveProject(project.id)
      } else {
        res = await updateProject(project.id, { status: 'active' })
      }

      if (res.success) {
        setOpen(false)
        notifyProjectsChanged()
        router.refresh()
      } else {
        setError(res.error || 'Failed to update project archive state')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" size="sm" />}>
        <PencilSimple className="size-3.5" />
        Edit Project
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project metadata and timeline. Drive folder structure remains unchanged.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-foreground">
              Project Name
            </label>
            <Input id="name" name="name" defaultValue={project.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="slug" className="text-xs font-medium text-foreground">
              Slug
            </label>
            <Input id="slug" name="slug" defaultValue={project.slug} required />
            <p className="text-[11px] text-muted-foreground">
              URL path: /projects/{project.slug}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Type</label>
              <Select value={type} onValueChange={(val) => val && setType(val as string)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jam" label="Game Jam">
                    Game Jam
                  </SelectItem>
                  <SelectItem value="competition" label="Competition">
                    Competition
                  </SelectItem>
                  <SelectItem value="internal" label="Internal Project">
                    Internal Project
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Status</label>
              <Select value={status} onValueChange={(val) => val && setStatus(val as string)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" label="Active">
                    Active
                  </SelectItem>
                  <SelectItem value="completed" label="Completed">
                    Completed
                  </SelectItem>
                  <SelectItem value="archived" label="Archived">
                    Archived
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="start_date" className="text-xs font-medium text-foreground">
                Start Date
              </label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={project.start_date || ''}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="deadline" className="text-xs font-medium text-foreground">
                Deadline
              </label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={project.deadline || ''}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-medium text-foreground">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={project.description || ''}
              placeholder="Brief summary of game theme, engine, or scope..."
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant={project.status === 'archived' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={handleToggleArchive}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {project.status === 'archived' ? (
                <>
                  <ArrowCounterClockwise className="size-3.5 text-emerald-400" />
                  Restore Project
                </>
              ) : (
                <>
                  <Archive className="size-3.5 text-amber-400" />
                  Archive Project
                </>
              )}
            </Button>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
