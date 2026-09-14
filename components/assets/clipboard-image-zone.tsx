'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Image as ImageIcon, ClipboardText, X, UploadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

interface StagedImage {
  id: string
  file: File
  previewUrl: string
}

interface ClipboardImageZoneProps {
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  className?: string
}

export function ClipboardImageZone({
  onFilesChange,
  maxFiles = 10,
  className,
}: ClipboardImageZoneProps) {
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)

  // Sync back to parent when stagedImages change
  useEffect(() => {
    onFilesChange(stagedImages.map((s) => s.file))
  }, [stagedImages, onFilesChange])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      stagedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    }
  }, [stagedImages])

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const validImageFiles = newFiles.filter((f) => f.type.startsWith('image/'))
      if (validImageFiles.length === 0) return

      setStagedImages((prev) => {
        const remainingSlots = maxFiles - prev.length
        if (remainingSlots <= 0) return prev

        const filesToAdd = validImageFiles.slice(0, remainingSlots)
        const mapped: StagedImage[] = filesToAdd.map((file) => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }))

        return [...prev, ...mapped]
      })
    },
    [maxFiles]
  )

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    // reset input so the same file can be re-selected if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
  }

  // Handle Ctrl+V paste
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return
      const items = e.clipboardData.items
      const pastedFiles: File[] = []

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png'
            const customFile = new File([blob], `clipboard-${Date.now()}.${ext}`, {
              type: blob.type,
            })
            pastedFiles.push(customFile)
          }
        }
      }

      if (pastedFiles.length > 0) {
        addFiles(pastedFiles)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFiles])

  async function handlePasteButtonClick() {
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read()
        const pastedFiles: File[] = []

        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const ext = imageType.split('/')[1] || 'png'
            const file = new File([blob], `clipboard-${Date.now()}.${ext}`, {
              type: imageType,
            })
            pastedFiles.push(file)
          }
        }

        if (pastedFiles.length > 0) {
          addFiles(pastedFiles)
        }
      }
    } catch (err) {
      console.warn('Clipboard read permission denied or unavailable:', err)
    }
  }

  function removeImage(id: string) {
    setStagedImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((img) => img.id !== id)
    })
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <div
        ref={zoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border/80 bg-muted/20 hover:bg-muted/40'
        )}
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ImageIcon className="size-4" />
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-foreground">
            Drop reference images here or press{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              Ctrl+V
            </kbd>
          </p>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPG, WebP supported. Max {maxFiles} images.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs"
          >
            <UploadSimple className="size-3" />
            Browse
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={handlePasteButtonClick}
            className="text-xs"
          >
            <ClipboardText className="size-3" />
            Paste Image
          </Button>
        </div>
      </div>

      {stagedImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {stagedImages.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-border/80 bg-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.file.name}
                className="size-full object-cover"
              />

              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100"
                title="Remove image"
              >
                <X className="size-3" />
              </button>

              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                {(img.file.size / 1024).toFixed(0)} KB
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
