'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UploadSimple } from '@phosphor-icons/react'
import { uploadArtifactFile } from '@/actions/artifacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface UploadArtifactDialogProps {
  projectId: string
}

export function UploadArtifactDialog({ projectId }: UploadArtifactDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<'build' | 'gdd'>('build')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('projectId', projectId)
    formData.set('type', type)

    startTransition(async () => {
      const res = await uploadArtifactFile(formData)
      if (res.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to upload artifact file')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UploadSimple className="size-4" />
        Upload File
      </DialogTrigger>

      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Upload Build or Document</DialogTitle>
          <DialogDescription>
            Directly upload playable builds or design docs to Google Drive.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="file" className="text-sm font-medium">
              Select File
            </label>
            <Input id="file" name="file" type="file" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Destination Folder</label>
            <Select
              value={type}
              onValueChange={(val) => val && setType(val as 'build' | 'gdd')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build">Builds</SelectItem>
                <SelectItem value="gdd">Game Design Doc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="label" className="text-sm font-medium">
              Display Label
            </label>
            <Input
              id="label"
              name="label"
              placeholder="Leave blank to use filename"
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
              <UploadSimple className="size-4" />
              {isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
