'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Scroll, CheckSquare, CircleNotch } from '@phosphor-icons/react'
import {
  getAssetUploadSession,
  recordAssetAfterUpload,
  AssetStatus,
  AssetType,
} from '@/actions/assets'
import { uploadDirectToDrive } from '@/lib/gdrive/client-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ClipboardImageZone } from './clipboard-image-zone'

interface CreateAssetDialogProps {
  projectId: string
  tasks?: Array<{ id: string; title: string }>
  trigger?: React.ReactNode
}

export function CreateAssetDialog({ projectId, tasks = [], trigger }: CreateAssetDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStage, setUploadStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('sprite')
  const [taskId, setTaskId] = useState<string>('none')
  const [status, setStatus] = useState<AssetStatus>('todo')
  const [notes, setNotes] = useState('')
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])

  // Credit attribution state
  const [needsCredit, setNeedsCredit] = useState(false)
  const [creditSourceName, setCreditSourceName] = useState('')
  const [creditAuthor, setCreditAuthor] = useState('')
  const [creditLicense, setCreditLicense] = useState<string>('cc0')
  const [creditSourceUrl, setCreditSourceUrl] = useState('')

  const router = useRouter()

  function resetForm() {
    setName('')
    setType('sprite')
    setTaskId('none')
    setStatus('todo')
    setNotes('')
    setAssetFile(null)
    setReferenceFiles([])
    setNeedsCredit(false)
    setCreditSourceName('')
    setCreditAuthor('')
    setCreditLicense('cc0')
    setCreditSourceUrl('')
    setError(null)
    setIsUploading(false)
    setUploadProgress(null)
    setUploadStage(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Asset name is required')
      return
    }

    try {
      setIsUploading(true)

      let uploadedDriveFileId: string | null = null
      let uploadedFileName: string | null = null

      // Step 1: If Asset File is attached, upload directly to Drive
      if (assetFile) {
        setUploadStage('Connecting to Google Drive for asset file...')
        setUploadProgress(0)

        const sessionRes = await getAssetUploadSession({
          projectId,
          fileName: assetFile.name,
          mimeType: assetFile.type || 'application/octet-stream',
          fileSize: assetFile.size,
          subfolder: 'Assets',
        })

        if (!sessionRes.success || !sessionRes.uploadUrl) {
          throw new Error(sessionRes.error || 'Failed to initialize Google Drive upload for asset file')
        }

        setUploadStage(`Uploading ${assetFile.name} directly to Drive...`)
        const driveRes = await uploadDirectToDrive(sessionRes.uploadUrl, assetFile, (p) => {
          setUploadProgress(p)
        })

        uploadedDriveFileId = driveRes.id
        uploadedFileName = assetFile.name
      }

      // Step 2: If Reference Files are attached, upload each directly to Drive
      const uploadedRefs: Array<{
        driveFileId: string
        fileName: string
        fileSize?: number
        mimeType?: string
      }> = []

      if (referenceFiles.length > 0) {
        for (let i = 0; i < referenceFiles.length; i++) {
          const refFile = referenceFiles[i]
          setUploadStage(`Uploading reference image (${i + 1}/${referenceFiles.length})...`)
          setUploadProgress(0)

          const refSessionRes = await getAssetUploadSession({
            projectId,
            fileName: refFile.name || `reference_${Date.now()}_${i}.png`,
            mimeType: refFile.type || 'image/png',
            fileSize: refFile.size,
            subfolder: 'Design',
          })

          if (refSessionRes.success && refSessionRes.uploadUrl) {
            const refDriveRes = await uploadDirectToDrive(refSessionRes.uploadUrl, refFile, (p) => {
              setUploadProgress(p)
            })

            if (refDriveRes.id) {
              uploadedRefs.push({
                driveFileId: refDriveRes.id,
                fileName: refFile.name,
                fileSize: refFile.size,
                mimeType: refFile.type,
              })
            }
          }
        }
      }

      // Step 3: Record metadata in Supabase (tiny payload < 1KB)
      setUploadStage('Saving asset deliverable to database...')
      const recordRes = await recordAssetAfterUpload({
        projectId,
        name: name.trim(),
        type,
        taskId: taskId !== 'none' ? taskId : null,
        status,
        needsCredit,
        notes: notes.trim() || null,
        driveFileId: uploadedDriveFileId,
        fileName: uploadedFileName,
        referenceFiles: uploadedRefs,
        creditInfo: needsCredit
          ? {
              sourceName: creditSourceName,
              author: creditAuthor,
              license: creditLicense,
              sourceUrl: creditSourceUrl,
            }
          : null,
      })

      if (!recordRes.success) {
        throw new Error(recordRes.error || 'Failed to save asset details in database')
      }

      // Success
      resetForm()
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      console.error('Asset creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save asset. Please try again.')
      setIsUploading(false)
      setUploadProgress(null)
      setUploadStage(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isUploading) {
          setOpen(next)
          if (!next) resetForm()
        }
      }}
    >
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : <Button size="sm" />}>
        {!trigger && (
          <>
            <Plus className="size-4" />
            New Asset
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>
            Add a game asset deliverable with optional visual references and direct Drive storage.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Asset Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-semibold">
              Asset Name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Hero Walk Animation, Main Theme"
              value={name}
              disabled={isUploading}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Asset Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Type</label>
              <Select
                value={type}
                disabled={isUploading}
                onValueChange={(val) => val && setType(val as AssetType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sprite">Sprite</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="3d_model">3D Model</SelectItem>
                  <SelectItem value="font">Font</SelectItem>
                  <SelectItem value="vfx">VFX</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Associated Task */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Linked Task</label>
              <Select
                value={taskId}
                disabled={isUploading}
                onValueChange={(val) => val && setTaskId(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Status</label>
              <Select
                value={status}
                disabled={isUploading}
                onValueChange={(val) => val && setStatus(val as AssetStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Visual Reference Section with Clipboard Paste */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-muted/10 p-3">
            <div className="flex items-center justify-between pb-1">
              <label className="text-xs font-semibold text-foreground">
                Visual References (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground">
                Paste Ctrl+V or upload sketches
              </span>
            </div>

            <ClipboardImageZone onFilesChange={setReferenceFiles} maxFiles={6} />
          </div>

          {/* Direct-to-Drive Asset File */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="file" className="text-xs font-semibold">
                Asset File (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground">
                Streams directly to Google Drive (no size limit)
              </span>
            </div>
            <Input
              id="file"
              name="file"
              type="file"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setAssetFile(f)
              }}
            />
            {assetFile && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {assetFile.name} ({(assetFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            )}
          </div>

          {/* Credit Attribution Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="needsCredit"
              checked={needsCredit}
              disabled={isUploading}
              onCheckedChange={(checked) => setNeedsCredit(checked === true)}
            />
            <label htmlFor="needsCredit" className="cursor-pointer text-xs font-medium">
              Requires License Attribution
            </label>
          </div>

          <AnimatePresence>
            {needsCredit && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 overflow-hidden"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                  <Scroll className="size-3.5" />
                  <span>Credit Attribution</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="credit_source_name" className="text-[11px] font-medium text-foreground">
                      Source / Pack Name
                    </label>
                    <Input
                      id="credit_source_name"
                      name="credit_source_name"
                      placeholder="e.g. Kenney Pixel UI"
                      value={creditSourceName}
                      disabled={isUploading}
                      onChange={(e) => setCreditSourceName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="credit_author" className="text-[11px] font-medium text-foreground">
                      Author / Creator
                    </label>
                    <Input
                      id="credit_author"
                      name="credit_author"
                      placeholder="e.g. Kenney"
                      value={creditAuthor}
                      disabled={isUploading}
                      onChange={(e) => setCreditAuthor(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">License</label>
                    <Select
                      value={creditLicense}
                      disabled={isUploading}
                      onValueChange={(val) => val && setCreditLicense(val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cc0">CC0 (Public Domain)</SelectItem>
                        <SelectItem value="cc_by">CC-BY (Attribution)</SelectItem>
                        <SelectItem value="royalty_free">Royalty-Free</SelectItem>
                        <SelectItem value="proprietary">Proprietary</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="credit_source_url" className="text-[11px] font-medium text-foreground">
                      Source URL
                    </label>
                    <Input
                      id="credit_source_url"
                      name="credit_source_url"
                      placeholder="https://..."
                      value={creditSourceUrl}
                      disabled={isUploading}
                      onChange={(e) => setCreditSourceUrl(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-xs font-semibold">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              value={notes}
              disabled={isUploading}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dimensions, style guidelines, color palette, or implementation details..."
              rows={2}
            />
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CircleNotch className="size-3.5 animate-spin text-primary" />
                  {uploadStage || 'Processing...'}
                </span>
                {uploadProgress !== null && (
                  <span className="font-mono text-muted-foreground">{uploadProgress}%</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress ?? 10}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isUploading || !name.trim()}>
              {isUploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckSquare className="size-4" />
                  Save Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
