'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Package, UploadSimple, MagnifyingGlass, CircleNotch } from '@phosphor-icons/react'
import {
  Asset,
  getAssetUploadSession,
  recordAssetBundleAfterUpload,
} from '@/actions/assets'
import { uploadDirectToDrive } from '@/lib/gdrive/client-upload'

interface UploadBundleDialogProps {
  projectId: string
  assets: Asset[]
  trigger?: React.ReactNode
}

export function UploadBundleDialog({ projectId, assets, trigger }: UploadBundleDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const router = useRouter()

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      asset.name.toLowerCase().includes(q) ||
      asset.type.toLowerCase().includes(q) ||
      asset.tasks?.title.toLowerCase().includes(q)
    )
  })

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  function handleSelectAllFiltered() {
    const allFilteredIds = filteredAssets.map((a) => a.id)
    const allSelected = allFilteredIds.every((id) => selectedAssetIds.includes(id))

    if (allSelected) {
      setSelectedAssetIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)))
    } else {
      setSelectedAssetIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  function resetState() {
    setName('')
    setFile(null)
    setSelectedAssetIds([])
    setError(null)
    setIsUploading(false)
    setProgress(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide an Atlas / Bundle name.')
      return
    }

    if (!file) {
      setError('Please select a file to upload.')
      return
    }

    if (selectedAssetIds.length === 0) {
      setError('Please select at least one asset item to include in this bundle.')
      return
    }

    try {
      setIsUploading(true)
      setProgress(0)

      // 1. Get Resumable Upload Session (0 MB Vercel payload)
      const sessionRes = await getAssetUploadSession({
        projectId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        subfolder: 'Assets',
      })

      if (!sessionRes.success || !sessionRes.uploadUrl) {
        throw new Error(sessionRes.error || 'Failed to initialize Google Drive upload session')
      }

      // 2. Direct upload from browser to Google Drive
      const driveRes = await uploadDirectToDrive(sessionRes.uploadUrl, file, (p) => {
        setProgress(p)
      })

      if (!driveRes.id) {
        throw new Error('Google Drive upload did not return a valid file ID')
      }

      // 3. Record bundle in database and link selected assets
      const recordRes = await recordAssetBundleAfterUpload({
        projectId,
        name: name.trim(),
        driveFileId: driveRes.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        assetIds: selectedAssetIds,
      })

      if (!recordRes.success) {
        throw new Error(recordRes.error || 'Failed to record bundle in database')
      }

      resetState()
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      console.error('Failed to upload atlas/bundle:', err)
      setError(err instanceof Error ? err.message : 'Bundle upload failed')
      setIsUploading(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isUploading) {
          setOpen(next)
          if (!next) resetState()
        }
      }}
    >
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : <Button variant="outline" size="sm" />}>
        {!trigger && (
          <>
            <Package className="size-4" />
            Upload Atlas / Bundle
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            <span>Upload Atlas / Asset Bundle</span>
          </DialogTitle>
          <DialogDescription>
            Streams composite files (Texture Atlas, Sprite Sheet, or Sound Pack) directly to Google Drive.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bundleName" className="text-xs font-semibold">
                Atlas / Bundle Name
              </label>
              <Input
                id="bundleName"
                placeholder="e.g. UI Elements Texture Atlas"
                value={name}
                disabled={isUploading}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bundleFile" className="text-xs font-semibold">
                File (Atlas / Sheet / Zip)
              </label>
              <Input
                id="bundleFile"
                type="file"
                disabled={isUploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>

          {/* Asset Selection List */}
          <div className="flex flex-col gap-2 flex-1 overflow-hidden border border-border/70 rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Select Included Assets</span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {selectedAssetIds.length} Selected
                </Badge>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleSelectAllFiltered}
                disabled={isUploading}
                className="text-xs h-6 px-2"
              >
                {filteredAssets.length > 0 &&
                filteredAssets.every((a) => selectedAssetIds.includes(a.id))
                  ? 'Deselect Filtered'
                  : 'Select All Filtered'}
              </Button>
            </div>

            {/* Search filter */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search assets by name, type, or task..."
                value={searchQuery}
                disabled={isUploading}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto max-h-[260px] flex flex-col gap-1 pr-1">
              {filteredAssets.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No assets found matching search.
                </div>
              ) : (
                filteredAssets.map((asset) => {
                  const isChecked = selectedAssetIds.includes(asset.id)
                  return (
                    <label
                      key={asset.id}
                      className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/60 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          disabled={isUploading}
                          onCheckedChange={() => toggleAsset(asset.id)}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{asset.name}</span>
                          {asset.tasks && (
                            <span className="text-[10px] text-muted-foreground">
                              Task: {asset.tasks.title}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="capitalize text-[10px] font-mono">
                          {asset.type.replace('_', ' ')}
                        </Badge>
                        {asset.bundle_id && (
                          <Badge variant="secondary" className="text-[9px] text-amber-500 bg-amber-500/10">
                            Already Bundled
                          </Badge>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CircleNotch className="size-3.5 animate-spin text-primary" />
                  Streaming bundle to Google Drive ({progress ?? 0}%)...
                </span>
                <span className="font-mono text-muted-foreground">{progress ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress ?? 5}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isUploading || selectedAssetIds.length === 0 || !file}>
              {isUploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Uploading to Drive...
                </>
              ) : (
                <>
                  <UploadSimple className="size-4" />
                  {`Bundle ${selectedAssetIds.length} Assets`}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
