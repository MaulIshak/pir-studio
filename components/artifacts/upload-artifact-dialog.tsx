'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UploadSimple, CircleNotch } from '@phosphor-icons/react'
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

const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5 MB Vercel Serverless limit

interface UploadArtifactDialogProps {
  projectId: string
}

export function UploadArtifactDialog({ projectId }: UploadArtifactDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<'build' | 'gdd'>('build')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const router = useRouter()

  function resetState() {
    setError(null)
    setLabel('')
    setFile(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_FILE_SIZE) {
      setError(`File size (${(selected.size / (1024 * 1024)).toFixed(1)} MB) exceeds Vercel limit of 4.5 MB.`)
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds Vercel limit of 4.5 MB.`)
      return
    }

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('label', label.trim() || file.name)
    formData.set('type', type)
    formData.set('file', file)

    startTransition(async () => {
      const res = await uploadArtifactFile(formData)
      if (res.success) {
        resetState()
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to upload artifact file')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) {
          setOpen(next)
          if (!next) resetState()
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UploadSimple className="size-4" />
        Upload File
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Upload Build or Document</DialogTitle>
          <DialogDescription>
            Upload build artifacts or design docs to Google Drive (Max 4.5 MB per file).
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
            <Input
              id="file"
              name="file"
              type="file"
              disabled={isPending}
              onChange={handleFileChange}
              required
            />
            {file && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Destination Folder</label>
            <Select
              value={type}
              disabled={isPending}
              onValueChange={(val) => val && setType(val as 'build' | 'gdd')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build">Builds (/Builds/)</SelectItem>
                <SelectItem value="gdd">GDD & Specs (/GDD/)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="label" className="text-sm font-medium">
              Artifact Label
            </label>
            <Input
              id="label"
              name="label"
              value={label}
              disabled={isPending}
              onChange={(e) => setLabel(e.target.value)}
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
            <Button type="submit" disabled={isPending || !file}>
              {isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadSimple className="size-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
