'use client'

import { useState, useRef, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MagnifyingGlassPlus,
  Trash,
  ArrowSquareOut,
  Image as ImageIcon,
  Plus,
  CaretLeft,
  CaretRight,
  UploadSimple,
  ClipboardText,
  CircleNotch,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { Asset, AssetReference, addAssetReferences, deleteAssetReference } from '@/actions/assets'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface AssetReferenceGalleryProps {
  asset: Asset
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssetReferenceGallery({
  asset,
  projectId,
  open,
  onOpenChange,
}: AssetReferenceGalleryProps) {
  const [prevAssetReferences, setPrevAssetReferences] = useState(asset.asset_references)
  const [localReferences, setLocalReferences] = useState<AssetReference[]>(
    asset.asset_references || []
  )
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [refToDelete, setRefToDelete] = useState<AssetReference | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (asset.asset_references !== prevAssetReferences) {
    setPrevAssetReferences(asset.asset_references)
    setLocalReferences(asset.asset_references || [])
  }

  const handleUploadFiles = useCallback(
    async (files: File[] | FileList) => {
      const fileArray = Array.from(files)
      const validImages = fileArray.filter((f) => f.type.startsWith('image/'))

      if (validImages.length === 0) return

      setIsUploading(true)
      setErrorMessage(null)

      const formData = new FormData()
      validImages.forEach((f) => formData.append('reference_files', f))

      try {
        const res = await addAssetReferences(asset.id, projectId, formData)
        if (res.success) {
          if (res.references) {
            setLocalReferences(res.references)
          }
          router.refresh()
        } else {
          setErrorMessage(res.error || 'Failed to upload references')
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [asset.id, projectId, router]
  )

  // Global Ctrl+V paste listener while dialog is open
  useEffect(() => {
    if (!open) return

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return

      // Do not intercept paste if user is typing in a text field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const items = e.clipboardData.items
      const pastedFiles: File[] = []

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png'
            const customFile = new File([blob], `ref-${Date.now()}.${ext}`, {
              type: blob.type,
            })
            pastedFiles.push(customFile)
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault()
        handleUploadFiles(pastedFiles)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, handleUploadFiles])

  async function handlePasteButtonClick() {
    if (isUploading) return
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read()
        const pastedFiles: File[] = []

        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const ext = imageType.split('/')[1] || 'png'
            const file = new File([blob], `ref-${Date.now()}.${ext}`, {
              type: imageType,
            })
            pastedFiles.push(file)
          }
        }

        if (pastedFiles.length > 0) {
          handleUploadFiles(pastedFiles)
        }
      }
    } catch (err) {
      console.warn('Clipboard read permission denied or unavailable:', err)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  function handleConfirmDelete() {
    if (!refToDelete) return

    const targetId = refToDelete.id
    const targetDriveFileId = refToDelete.drive_file_id

    startTransition(async () => {
      setLocalReferences((prev) => prev.filter((r) => r.id !== targetId))
      if (selectedImageIndex !== null) {
        setSelectedImageIndex(null)
      }
      setRefToDelete(null)

      await deleteAssetReference(targetId, targetDriveFileId, projectId)
      router.refresh()
    })
  }

  const activeReference =
    selectedImageIndex !== null && localReferences[selectedImageIndex]
      ? localReferences[selectedImageIndex]
      : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/60 shrink-0">
            <div className="flex flex-col gap-0.5 min-w-0 pr-4">
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="text-base font-semibold truncate">
                  {asset.name}
                </DialogTitle>
                <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                  {localReferences.length} {localReferences.length === 1 ? 'Reference' : 'References'}
                </Badge>
              </div>
              <DialogDescription className="text-xs truncate">
                Visual references, concept sketches, and style guides.
              </DialogDescription>
            </div>

            {/* Quick Actions in Header (shown when there are references) */}
            {localReferences.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handlePasteButtonClick}
                  disabled={isUploading}
                  className="gap-1 text-xs"
                  title="Paste image from clipboard (or press Ctrl+V)"
                >
                  <ClipboardText className="size-3.5" />
                  Paste
                </Button>

                <Button
                  type="button"
                  size="xs"
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-1 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add Reference
                </Button>
              </div>
            )}
          </DialogHeader>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive flex items-center justify-between my-1">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Single Unified Panel */}
          {localReferences.length === 0 ? (
            /* Empty State: Direct Upload Dropzone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'flex flex-1 flex-col items-center justify-center p-8 text-center rounded-lg border-2 border-dashed transition-all duration-150 min-h-[300px]',
                isDragOver
                  ? 'border-primary bg-primary/10 scale-[0.99]'
                  : 'border-border/80 bg-muted/10 hover:border-border hover:bg-muted/20'
              )}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CircleNotch className="size-6 animate-spin" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      Uploading reference...
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Saving images to Google Drive and project gallery.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 max-w-sm">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs">
                    <ImageIcon className="size-6" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-foreground">No references yet</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Drop images here, paste directly from clipboard with{' '}
                      <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground border border-border/60">
                        Ctrl+V
                      </kbd>
                      , or browse files.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5 text-xs"
                    >
                      <UploadSimple className="size-4" />
                      Browse Files
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handlePasteButtonClick}
                      className="gap-1.5 text-xs"
                    >
                      <ClipboardText className="size-4" />
                      Paste Image
                    </Button>
                  </div>

                  <span className="text-[11px] text-muted-foreground/70 pt-1 font-mono">
                    PNG, JPG, WebP supported
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Gallery State: Interactive Grid */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'relative flex-1 overflow-y-auto py-2 pr-1 rounded-lg transition-colors',
                isDragOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5'
              )}
            >
              {isDragOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-xs border-2 border-dashed border-primary">
                  <UploadSimple className="size-8 text-primary animate-bounce" />
                  <p className="text-xs font-semibold text-primary">Drop images to upload</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {/* Add Reference Interactive Tile */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="group relative aspect-square flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/80 bg-muted/10 hover:border-primary/60 hover:bg-primary/5 transition-all text-center p-3 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  title="Add reference image or press Ctrl+V"
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-background border border-border/60 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary transition-colors shadow-xs">
                    <Plus className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      Add Image
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      or Ctrl+V
                    </span>
                  </div>
                </button>

                {/* Uploading Tile Placeholder */}
                {isUploading && (
                  <div className="aspect-square flex flex-col items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-center animate-pulse">
                    <CircleNotch className="size-6 animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">Uploading...</span>
                  </div>
                )}

                {/* Existing Reference Cards */}
                {localReferences.map((ref, idx) => (
                  <div
                    key={ref.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border/80 bg-background/80 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/drive/file/${ref.drive_file_id}`}
                      alt={ref.file_name || 'Reference image'}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />

                    {/* Gradient Overlay & Actions */}
                    <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          className="size-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRefToDelete(ref)
                          }}
                          title="Delete Reference"
                        >
                          <Trash className="size-3" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <span className="truncate text-[10px] font-medium text-white min-w-0 flex-1">
                          {ref.file_name || 'Image'}
                        </span>

                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          className="size-6 p-0 shrink-0 bg-white/20 hover:bg-white/30 text-white"
                          onClick={() => setSelectedImageIndex(idx)}
                          title="Zoom / Fullscreen"
                        >
                          <MagnifyingGlassPlus className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom View Dialog */}
      <Dialog
        open={selectedImageIndex !== null}
        onOpenChange={(isOpen) => !isOpen && setSelectedImageIndex(null)}
      >
        <DialogContent className="sm:max-w-4xl max-h-[95vh] p-4 flex flex-col overflow-hidden bg-background/95 backdrop-blur">
          {activeReference && (
            <div className="flex flex-col gap-3 h-full">
              {/* Lightbox Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {activeReference.file_name || 'Reference Image'}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({selectedImageIndex! + 1} / {localReferences.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pr-6">
                  <Button
                    variant="outline"
                    size="xs"
                    nativeButton={false}
                    render={
                      <a
                        href={`https://drive.google.com/file/d/${activeReference.drive_file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    className="text-xs text-primary"
                  >
                    <ArrowSquareOut className="size-3.5" />
                    Drive
                  </Button>

                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => setRefToDelete(activeReference)}
                    className="text-xs"
                  >
                    <Trash className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Lightbox Main View with Prev / Next Navigation */}
              <div className="relative flex-1 flex items-center justify-center min-h-[400px] max-h-[70vh] bg-black/40 rounded-lg overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/drive/file/${activeReference.drive_file_id}`}
                  alt={activeReference.file_name || 'Enlarged reference'}
                  className="max-h-full max-w-full object-contain select-none"
                />

                {localReferences.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImageIndex((prev) =>
                          prev !== null ? (prev > 0 ? prev - 1 : localReferences.length - 1) : 0
                        )
                      }
                      className="absolute left-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Previous"
                    >
                      <CaretLeft className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImageIndex((prev) =>
                          prev !== null ? (prev < localReferences.length - 1 ? prev + 1 : 0) : 0
                        )
                      }
                      className="absolute right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Next"
                    >
                      <CaretRight className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reusable Confirm Hard Delete Dialog */}
      <ConfirmDialog
        open={!!refToDelete}
        onOpenChange={(isOpen) => !isOpen && setRefToDelete(null)}
        title="Delete Reference"
        description="Are you sure you want to permanently delete this reference image? This will remove the record and delete the file from Google Drive."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
