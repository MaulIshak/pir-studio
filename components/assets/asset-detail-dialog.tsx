'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PencilSimple,
  Trash,
  CircleDashed,
  Play,
  CheckCircle,
  PuzzlePiece,
  Image as ImageIcon,
  MusicNotes,
  Cube,
  TextAa,
  Sparkle,
  File,
  User,
  CheckSquare,
  Package,
  UploadSimple,
  ArrowSquareOut,
  WarningCircle,
  Images,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import type { Asset, AssetStatus, AssetType } from '@/actions/assets'

interface AssetDetailDialogProps {
  asset: Asset
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
  onManageReferences?: () => void
  onUploadFile?: () => void
  onStatusChange?: (assetId: string, newStatus: AssetStatus) => void
}

const statusConfig: Record<
  AssetStatus,
  {
    label: string
    icon: typeof CircleDashed
    class: string
  }
> = {
  todo: {
    label: 'To Do',
    icon: CircleDashed,
    class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  in_progress: {
    label: 'In Progress',
    icon: Play,
    class: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  done: {
    label: 'Done',
    icon: CheckCircle,
    class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  implemented: {
    label: 'Implemented',
    icon: PuzzlePiece,
    class: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
}

function getTypeDetails(type: AssetType) {
  switch (type) {
    case 'sprite':
      return {
        label: 'Sprite',
        icon: <ImageIcon className="size-3.5 text-purple-400" />,
        class: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
    case 'audio':
      return {
        label: 'Audio',
        icon: <MusicNotes className="size-3.5 text-blue-400" />,
        class: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case '3d_model':
      return {
        label: '3D Model',
        icon: <Cube className="size-3.5 text-amber-400" />,
        class: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      }
    case 'font':
      return {
        label: 'Font',
        icon: <TextAa className="size-3.5 text-teal-400" />,
        class: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      }
    case 'vfx':
      return {
        label: 'VFX',
        icon: <Sparkle className="size-3.5 text-rose-400" />,
        class: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      }
    default:
      return {
        label: 'Other',
        icon: <File className="size-3.5 text-muted-foreground" />,
        class: 'bg-secondary text-muted-foreground border-border/50',
      }
  }
}

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onManageReferences,
  onUploadFile,
  onStatusChange,
}: AssetDetailDialogProps) {
  const currentStatus = statusConfig[asset.status] || statusConfig.todo
  const StatusIcon = currentStatus.icon
  const typeDetails = getTypeDetails(asset.type)
  const refCount = asset.asset_references?.length || 0

  const createdDate = asset.created_at
    ? new Date(asset.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const driveLink = asset.drive_file_id
    ? `https://drive.google.com/file/d/${asset.drive_file_id}/view`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="gap-2.5 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('gap-1.5 font-mono text-xs', currentStatus.class)}>
                <StatusIcon className="size-3" />
                {currentStatus.label}
              </Badge>
              <Badge variant="outline" className={cn('gap-1.5 font-mono text-xs', typeDetails.class)}>
                {typeDetails.icon}
                {typeDetails.label}
              </Badge>
            </div>

            {createdDate && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Created {createdDate}
              </span>
            )}
          </div>

          <DialogTitle className="text-base font-bold text-foreground leading-snug break-words">
            {asset.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3 text-xs">
            {/* Connected Task */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Connected Task
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckSquare className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{asset.tasks?.title || 'Unassigned'}</span>
              </div>
            </div>

            {/* Created By / Uploader */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Creator
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {asset.profiles?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={asset.profiles.avatar_url}
                    alt={asset.profiles.name || 'Member'}
                    className="size-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-4 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <User className="size-2.5" />
                  </div>
                )}
                <span className="truncate">{asset.profiles?.name || 'Team Member'}</span>
              </div>
            </div>

            {/* Attribution Requirement */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Attribution
              </span>
              <div className="flex items-center gap-1.5 font-medium">
                {asset.needs_credit ? (
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <WarningCircle className="size-3.5 shrink-0" />
                    Required in Credits
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>

            {/* File Format / Destination */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Storage
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {asset.drive_file_id ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="size-3.5" />
                    Google Drive
                  </span>
                ) : (
                  <span className="text-muted-foreground">Backlog Pending</span>
                )}
              </div>
            </div>
          </div>

          {/* Drive File / Bundle Info Card */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Asset File
            </span>
            {asset.drive_file_id ? (
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {asset.bundle_id ? (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Package className="size-4" />
                    </div>
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary border border-primary/20">
                      <File className="size-4" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {asset.bundle_id
                        ? `Atlas: ${asset.asset_bundles?.name || 'Bundle'}`
                        : asset.file_name || asset.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {asset.bundle_id
                        ? asset.asset_bundles?.file_name || 'Composite sprite sheet'
                        : 'Single asset file'}
                    </span>
                  </div>
                </div>

                {driveLink && (
                  <Button
                    variant="outline"
                    size="xs"
                    nativeButton={false}
                    render={
                      <a href={driveLink} target="_blank" rel="noopener noreferrer" />
                    }
                    className="shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <ArrowSquareOut className="size-3.5" />
                    Open in Drive
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 bg-background/50 p-3 text-xs">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">No file attached yet</span>
                  <span className="text-[11px] text-muted-foreground">
                    Upload a single file or link via texture atlas bundle.
                  </span>
                </div>
                {onUploadFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={onUploadFile}
                    className="gap-1.5 shrink-0"
                  >
                    <UploadSimple className="size-3.5" />
                    Upload File
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Visual References Gallery Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Images className="size-3.5 text-primary" />
                References ({refCount})
              </span>
              {onManageReferences && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onManageReferences}
                  className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                >
                  {refCount > 0 ? 'Open Gallery' : '+ Add References'}
                </Button>
              )}
            </div>

            {refCount > 0 ? (
              <div
                role="button"
                tabIndex={0}
                onClick={onManageReferences}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onManageReferences?.()
                  }
                }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 cursor-pointer group"
                title="Click to view references gallery"
              >
                {asset.asset_references?.slice(0, 4).map((ref, idx) => (
                  <div
                    key={ref.id}
                    className="relative aspect-square rounded-md overflow-hidden bg-muted border border-border/60 group-hover:border-primary/40 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/drive/file/${ref.drive_file_id}`}
                      alt={ref.file_name || 'Reference thumbnail'}
                      className="size-full object-cover"
                    />
                    {idx === 3 && refCount > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center font-bold text-xs text-white">
                        +{refCount - 3}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={onManageReferences}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onManageReferences?.()
                  }
                }}
                className="flex items-center justify-center rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground cursor-pointer transition-colors"
              >
                No visual references attached. Click to add or paste image.
              </div>
            )}
          </div>

          {/* Notes / Guidelines Section */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Notes & Guidelines
            </span>
            <div className="rounded-md border border-border/50 bg-background/50 p-3 min-h-[60px] max-h-40 overflow-y-auto text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {asset.notes ? (
                asset.notes
              ) : (
                <span className="italic text-muted-foreground">
                  No notes or production guidelines provided.
                </span>
              )}
            </div>
          </div>

          {/* Quick Status Move buttons */}
          {onStatusChange && (
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Move Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(['todo', 'in_progress', 'done', 'implemented'] as const).map((st) => {
                  const cfg = statusConfig[st]
                  const isCurrent = asset.status === st
                  return (
                    <Button
                      key={st}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="xs"
                      disabled={isCurrent}
                      onClick={() => onStatusChange(asset.id, st)}
                      className="h-7 text-xs font-normal"
                    >
                      {cfg.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-row items-center justify-between border-t border-border/60 pt-3 gap-2">
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <Trash className="size-3.5" />
              Delete
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {onEdit && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onEdit}
                className="gap-1.5"
              >
                <PencilSimple className="size-3.5" />
                Edit Asset
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
