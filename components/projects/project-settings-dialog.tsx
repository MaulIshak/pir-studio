'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateProject,
  archiveProject,
  syncProjectGoogleDrive,
  deleteProject,
} from '@/actions/projects'
import { notifyProjectsChanged } from '@/lib/events'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import {
  Gear,
  GoogleDriveLogo,
  Trash,
  Archive,
  ArrowCounterClockwise,
  ArrowSquareOut,
  CheckCircle,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react'

interface ProjectSettingsDialogProps {
  project: {
    id: string
    slug: string
    name: string
    type: 'jam' | 'competition' | 'internal'
    status: 'active' | 'completed' | 'archived'
    start_date: string | null
    deadline: string | null
    description: string | null
    drive_folder_id?: string | null
  }
  isLeader?: boolean
  canManage?: boolean
}

export function ProjectSettingsDialog({
  project,
  isLeader = false,
  canManage = true,
}: ProjectSettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSyncingDrive, setIsSyncingDrive] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [driveFolderId, setDriveFolderId] = useState<string | null>(project.drive_folder_id || null)

  const [type, setType] = useState<string>(project.type)
  const [status, setStatus] = useState<string>(project.status)
  const router = useRouter()
  const supabase = createClient()

  if (!canManage) {
    return null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

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
        notifyProjectsChanged()
        setOpen(false)
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
    setSuccessMessage(null)
    const nextStatus = project.status === 'archived' ? 'active' : 'archived'

    startTransition(async () => {
      let res
      if (nextStatus === 'archived') {
        res = await archiveProject(project.id)
      } else {
        res = await updateProject(project.id, { status: 'active' })
      }

      if (res.success) {
        notifyProjectsChanged()
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to update project archive state')
      }
    })
  }

  async function handleSyncDrive() {
    setError(null)
    setSuccessMessage(null)
    setIsSyncingDrive(true)

    try {
      const res = await syncProjectGoogleDrive(project.id)
      if (res.error) {
        if (res.needsDriveAuth) {
          setError('Google Drive is not linked to your account. Redirecting to Google authorization...')
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
                window.location.pathname
              )}`,
              scopes: 'https://www.googleapis.com/auth/drive.file',
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          })
          return
        }
        setError(res.error)
      } else if (res.driveFolderId) {
        setDriveFolderId(res.driveFolderId)
        setSuccessMessage('Google Drive storage connected and folders created.')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive sync failed')
    } finally {
      setIsSyncingDrive(false)
    }
  }

  async function handleDeleteProject() {
    setError(null)
    setIsDeleting(true)

    try {
      const res = await deleteProject(project.id)
      if (res.error) {
        setError(res.error)
        setIsDeleting(false)
      } else {
        notifyProjectsChanged()
        setDeleteConfirmOpen(false)
        setOpen(false)
        router.push('/projects')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <Gear className="size-3.5" />
          <span>Project Settings</span>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Manage project metadata, timeline, Google Drive storage sync, and project status.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-2 text-xs">
              <AlertDescription className="flex items-center gap-1.5">
                <CheckCircle className="size-4 shrink-0" />
                <span>{successMessage}</span>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Metadata Fields */}
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

            {/* Google Drive Storage Sync Section (Leader Only) */}
            {isLeader && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                      <GoogleDriveLogo className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Google Drive Sync</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Connect project folder for assets, builds, and deliverables storage.
                      </p>
                    </div>
                  </div>
                  {driveFolderId ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px]">
                      Not Connected
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                  {driveFolderId ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        nativeButton={false}
                        render={
                          <a
                            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        className="gap-1 text-xs"
                      >
                        <ArrowSquareOut className="size-3 text-primary" />
                        <span>Open Drive Folder</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={handleSyncDrive}
                        disabled={isSyncingDrive}
                        className="gap-1 text-xs"
                      >
                        {isSyncingDrive ? (
                          <>
                            <CircleNotch className="size-3 animate-spin" />
                            <span>Syncing...</span>
                          </>
                        ) : (
                          <>
                            <GoogleDriveLogo className="size-3 text-amber-500" />
                            <span>Re-sync Drive</span>
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      onClick={handleSyncDrive}
                      disabled={isSyncingDrive}
                      className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-medium"
                    >
                      {isSyncingDrive ? (
                        <>
                          <CircleNotch className="size-3 animate-spin" />
                          <span>Connecting Drive...</span>
                        </>
                      ) : (
                        <>
                          <GoogleDriveLogo className="size-3.5" />
                          <span>Connect Google Drive</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Danger Zone: Delete Project (Leader Only) */}
            {isLeader && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-destructive">Delete Project</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Permanently delete this project and all its tasks, assets, and milestones.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="gap-1 text-xs shrink-0"
                >
                  <Trash className="size-3" />
                  <span>Delete Project</span>
                </Button>
              </div>
            )}

            {/* Bottom Form Actions */}
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
                    <span>Restore Project</span>
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5 text-amber-400" />
                    <span>Archive Project</span>
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

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-1">
              <Warning className="size-5" />
            </div>
            <DialogTitle className="text-center font-heading">
              Delete Project
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Are you sure you want to permanently delete <strong className="text-foreground">{project.name}</strong>? All associated tasks, milestones, deliverables, and credits will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center gap-2 sm:justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="text-xs gap-1"
            >
              {isDeleting ? (
                <>
                  <CircleNotch className="size-3 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash className="size-3" />
                  <span>Confirm Delete</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
