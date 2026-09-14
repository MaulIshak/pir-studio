'use client'

import { useState, useTransition } from 'react'
import {
  DownloadSimple,
  Copy,
  Check,
  FileText,
  GoogleDriveLogo,
} from '@phosphor-icons/react'
import { exportCreditsMarkdown } from '@/actions/credits'
import { Button } from '@/components/ui/button'
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

interface ExportCreditsButtonProps {
  projectId: string
  hasCredits: boolean
}

export function ExportCreditsButton({ projectId, hasCredits }: ExportCreditsButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [driveSaved, setDriveSaved] = useState<boolean>(false)
  const [copied, setCopied] = useState(false)

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen && !markdownContent) {
      startTransition(async () => {
        const res = await exportCreditsMarkdown(projectId)
        if (res.success && res.content) {
          setMarkdownContent(res.content)
          setDriveSaved(!!res.driveSaved)
        }
      })
    }
  }

  function handleCopy() {
    if (!markdownContent) return
    navigator.clipboard.writeText(markdownContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    if (!markdownContent) return
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'CREDITS.md')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={!hasCredits} />}>
        <FileText className="size-4" />
        Export Credits
      </DialogTrigger>

      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Export Credits & Attributions
            </DialogTitle>
            {driveSaved && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
              >
                <GoogleDriveLogo className="size-3 text-emerald-400" />
                Synced to Drive
              </Badge>
            )}
          </div>
          <DialogDescription>
            Formatted Markdown ready for your itch.io page, game credits, or README.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex h-64 items-center justify-center rounded-md border bg-secondary/30 font-mono text-xs text-muted-foreground">
            Generating formatted credits...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <pre className="h-64 overflow-y-auto rounded-md border bg-secondary/40 p-3 font-mono text-xs text-foreground select-all">
                {markdownContent}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!markdownContent || isPending}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy Markdown
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={!markdownContent || isPending}
              className="gap-1.5"
            >
              <DownloadSimple className="size-3.5" />
              Download CREDITS.md
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
