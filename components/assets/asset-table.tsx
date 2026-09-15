'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowSquareOut,
  Trash,
  Image as ImageIcon,
  MusicNotes,
  Cube,
  TextAa,
  Sparkle,
  File,
  WarningCircle,
  Package,
  UploadSimple,
  CheckCircle,
  Play,
  CircleDashed,
  PuzzlePiece,
  Eye,
  PencilSimple,
} from '@phosphor-icons/react'
import { Asset, AssetStatus, updateAssetStatus, deleteAsset } from '@/actions/assets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/projects/empty-state'
import { CreateAssetDialog } from './create-asset-dialog'
import { UploadBundleDialog } from './upload-bundle-dialog'
import { UploadSingleDialog } from './upload-single-dialog'
import { AssetReferenceGallery } from './asset-reference-gallery'
import { AssetDetailDialog } from './asset-detail-dialog'
import { EditAssetDialog } from './edit-asset-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface AssetTableProps {
  assets: Asset[]
  projectId: string
  tasks?: Array<{ id: string; title: string }>
}

function getTypeDetails(type: Asset['type']) {
  switch (type) {
    case 'sprite':
      return {
        icon: <ImageIcon className="size-3.5 text-purple-400" />,
        bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
    case 'audio':
      return {
        icon: <MusicNotes className="size-3.5 text-blue-400" />,
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case '3d_model':
      return {
        icon: <Cube className="size-3.5 text-amber-400" />,
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      }
    case 'font':
      return {
        icon: <TextAa className="size-3.5 text-teal-400" />,
        bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      }
    case 'vfx':
      return {
        icon: <Sparkle className="size-3.5 text-rose-400" />,
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      }
    default:
      return {
        icon: <File className="size-3.5 text-muted-foreground" />,
        bg: 'bg-secondary text-muted-foreground',
      }
  }
}

function getStatusBadge(status: AssetStatus) {
  switch (status) {
    case 'todo':
      return {
        label: 'To Do',
        icon: <CircleDashed className="size-3 text-slate-400" />,
        class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      }
    case 'in_progress':
      return {
        label: 'In Progress',
        icon: <Play className="size-3 text-blue-400" />,
        class: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case 'done':
      return {
        label: 'Done',
        icon: <CheckCircle className="size-3 text-emerald-400" />,
        class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }
    case 'implemented':
      return {
        label: 'Implemented',
        icon: <PuzzlePiece className="size-3 text-purple-400" />,
        class: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
  }
}

export function AssetTable({ assets, projectId, tasks = [] }: AssetTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [taskFilter, setTaskFilter] = useState<string>('all')
  const [fileFilter, setFileFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [galleryAsset, setGalleryAsset] = useState<Asset | null>(null)
  const [uploadSingleAsset, setUploadSingleAsset] = useState<Asset | null>(null)
  const [selectedDetailAsset, setSelectedDetailAsset] = useState<Asset | null>(null)
  const [selectedEditAsset, setSelectedEditAsset] = useState<Asset | null>(null)

  // Derive active asset from props to stay in sync with server revalidations
  const activeDetailAsset = selectedDetailAsset
    ? assets.find((a) => a.id === selectedDetailAsset.id) || selectedDetailAsset
    : null
  const activeEditAsset = selectedEditAsset
    ? assets.find((a) => a.id === selectedEditAsset.id) || selectedEditAsset
    : null
  const activeGalleryAsset = galleryAsset
    ? assets.find((a) => a.id === galleryAsset.id) || galleryAsset
    : null

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const filteredAssets = assets.filter((asset) => {
    if (typeFilter !== 'all' && asset.type !== typeFilter) return false
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false
    if (taskFilter !== 'all') {
      if (taskFilter === 'unassigned' && asset.task_id) return false
      if (taskFilter !== 'unassigned' && asset.task_id !== taskFilter) return false
    }
    if (fileFilter !== 'all') {
      if (fileFilter === 'with_file' && !asset.drive_file_id) return false
      if (fileFilter === 'no_file' && asset.drive_file_id) return false
      if (fileFilter === 'bundle' && !asset.bundle_id) return false
      if (fileFilter === 'single' && (asset.bundle_id || !asset.drive_file_id)) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = asset.name.toLowerCase().includes(q)
      const matchNotes = asset.notes?.toLowerCase().includes(q)
      const matchTask = asset.tasks?.title.toLowerCase().includes(q)
      const matchBundle = asset.asset_bundles?.name.toLowerCase().includes(q)
      if (!matchName && !matchNotes && !matchTask && !matchBundle) {
        return false
      }
    }
    return true
  })

  function handleStatusChange(assetId: string, newStatus: AssetStatus) {
    if (selectedDetailAsset && selectedDetailAsset.id === assetId) {
      setSelectedDetailAsset({ ...selectedDetailAsset, status: newStatus })
    }
    startTransition(async () => {
      await updateAssetStatus(assetId, projectId, newStatus)
      router.refresh()
    })
  }

  function handleConfirmDelete() {
    if (!assetToDelete) return
    startTransition(async () => {
      await deleteAsset(assetToDelete.id, projectId)
      setAssetToDelete(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 max-w-sm">
            <Input
              placeholder="Search assets, tasks, bundles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(val) => val && setTypeFilter(val)}>
              <SelectTrigger className="w-full sm:w-[125px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sprite">Sprite</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="3d_model">3D Model</SelectItem>
                <SelectItem value="font">Font</SelectItem>
                <SelectItem value="vfx">VFX</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
              </SelectContent>
            </Select>

            {/* Task Filter */}
            <Select value={taskFilter} onValueChange={(val) => val && setTaskFilter(val)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* File Source Filter */}
            <Select value={fileFilter} onValueChange={(val) => val && setFileFilter(val)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Files</SelectItem>
                <SelectItem value="with_file">With File</SelectItem>
                <SelectItem value="no_file">Missing File</SelectItem>
                <SelectItem value="single">Single File</SelectItem>
                <SelectItem value="bundle">Atlas / Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          title={assets.length === 0 ? 'No assets recorded' : 'No matching assets'}
          description={
            assets.length === 0
              ? 'Add required game assets to establish your production backlog.'
              : 'No assets match your search and filter criteria.'
          }
          icon={<Package className="size-7" />}
          action={
            assets.length === 0 ? (
              <div className="flex items-center gap-2">
                <CreateAssetDialog projectId={projectId} tasks={tasks} />
                <UploadBundleDialog projectId={projectId} assets={assets} />
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile View: Asset Card List (< md) */}
          <div className="flex md:hidden flex-col gap-3">
            {filteredAssets.map((asset) => {
              const driveLink = asset.drive_file_id
                ? `https://drive.google.com/file/d/${asset.drive_file_id}/view`
                : null
              const details = getTypeDetails(asset.type)
              const statusInfo = getStatusBadge(asset.status)
              const refCount = asset.asset_references?.length || 0
              const firstRef = asset.asset_references?.[0]

              return (
                <div
                  key={asset.id}
                  className="flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 shadow-2xs"
                >
                  {/* Header: Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailAsset(asset)}
                        className="text-left font-medium text-foreground hover:text-primary transition-colors text-xs truncate cursor-pointer"
                      >
                        {asset.name}
                      </button>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 w-fit capitalize text-[10px] h-4.5 px-1.5 ${details.bg}`}
                        >
                          {details.icon}
                          {asset.type.replace('_', ' ')}
                        </Badge>
                        {asset.tasks && (
                          <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 truncate max-w-[120px]">
                            {asset.tasks.title}
                          </Badge>
                        )}
                        {asset.needs_credit && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4.5 px-1.5 border-amber-500/20 bg-amber-500/10 text-amber-500"
                          >
                            Attribution Req.
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Select
                      value={asset.status}
                      disabled={isPending}
                      onValueChange={(val) => val && handleStatusChange(asset.id, val as AssetStatus)}
                    >
                      <SelectTrigger className={`h-6 text-[11px] px-2 py-0 gap-1 shrink-0 ${statusInfo.class}`}>
                        {statusInfo.icon}
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

                  {/* References & Files row */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {refCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setGalleryAsset(asset)}
                          className="flex items-center gap-1.5 rounded border border-border/70 p-0.5 pr-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {firstRef && (
                            <div className="size-5 rounded overflow-hidden bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/drive/file/${firstRef.drive_file_id}`}
                                alt="Reference"
                                className="size-full object-cover"
                              />
                            </div>
                          )}
                          <span>{refCount} {refCount === 1 ? 'Ref' : 'Refs'}</span>
                        </button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setGalleryAsset(asset)}
                          className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground gap-1"
                        >
                          <ImageIcon className="size-3" />
                          Add Ref
                        </Button>
                      )}

                      {driveLink ? (
                        <Button
                          variant="outline"
                          size="xs"
                          nativeButton={false}
                          render={<a href={driveLink} target="_blank" rel="noopener noreferrer" />}
                          className="h-6 text-[11px] px-2 text-primary border-primary/30 bg-primary/5 gap-1"
                        >
                          <ArrowSquareOut className="size-3" />
                          Drive
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setUploadSingleAsset(asset)}
                          className="h-6 text-[11px] px-2 text-muted-foreground gap-1"
                        >
                          <UploadSimple className="size-3" />
                          Upload
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedDetailAsset(asset)}
                        className="size-6 p-0 text-muted-foreground"
                      >
                        <Eye className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedEditAsset(asset)}
                        className="size-6 p-0 text-muted-foreground"
                      >
                        <PencilSimple className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setAssetToDelete(asset)}
                        className="size-6 p-0 text-destructive"
                      >
                        <Trash className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop View: Table (md and up) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="hidden md:block rounded-md border bg-card/60 overflow-hidden"
          >
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Asset</TableHead>
                <TableHead className="w-[95px]">References</TableHead>
                <TableHead className="w-[95px]">Type</TableHead>
                <TableHead className="w-[140px]">Connected Task</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[105px]">File Source</TableHead>
                <TableHead className="w-[90px]">Attribution</TableHead>
                <TableHead className="w-[85px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const driveLink = asset.drive_file_id
                  ? `https://drive.google.com/file/d/${asset.drive_file_id}/view`
                  : null
                const details = getTypeDetails(asset.type)
                const statusInfo = getStatusBadge(asset.status)
                const refCount = asset.asset_references?.length || 0
                const firstRef = asset.asset_references?.[0]

                return (
                  <TableRow key={asset.id} className="hover:bg-muted/40 transition-colors">
                    {/* Asset Name */}
                    <TableCell className="font-medium max-w-[200px]">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailAsset(asset)}
                        className="group flex items-center text-left hover:opacity-80 transition-opacity cursor-pointer truncate max-w-full"
                        title={asset.name}
                      >
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {asset.name}
                        </span>
                      </button>
                    </TableCell>

                    {/* Visual References Gallery Trigger */}
                    <TableCell>
                      {refCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setGalleryAsset(asset)}
                          className="group flex items-center gap-2 rounded-md border border-border/70 p-1 pr-2 hover:border-primary/50 hover:bg-muted/40 transition-all text-left"
                        >
                          {firstRef && (
                            <div className="size-7 rounded overflow-hidden bg-muted border border-border/60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/drive/file/${firstRef.drive_file_id}`}
                                alt="Reference thumbnail"
                                className="size-full object-cover"
                              />
                            </div>
                          )}
                          <span className="text-xs font-medium text-foreground group-hover:text-primary">
                            {refCount} {refCount === 1 ? 'Ref' : 'Refs'}
                          </span>
                        </button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setGalleryAsset(asset)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ImageIcon className="size-3.5" />
                          Add Ref
                        </Button>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1.5 w-fit capitalize text-xs ${details.bg}`}
                      >
                        {details.icon}
                        {asset.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>

                    {/* Connected Task */}
                    <TableCell>
                      {asset.tasks ? (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal max-w-[125px] truncate"
                          title={asset.tasks.title}
                        >
                          <span className="truncate">{asset.tasks.title}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Status Dropdown */}
                    <TableCell>
                      <Select
                        value={asset.status}
                        onValueChange={(val) =>
                          val && handleStatusChange(asset.id, val as AssetStatus)
                        }
                      >
                        <SelectTrigger className={`h-7 w-[125px] text-xs gap-1.5 ${statusInfo.class}`}>
                          {statusInfo.icon}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="implemented">Implemented</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* File Source */}
                    <TableCell>
                      {driveLink ? (
                        asset.bundle_id ? (
                          <Button
                            variant="outline"
                            size="xs"
                            nativeButton={false}
                            render={
                              <a href={driveLink} target="_blank" rel="noopener noreferrer" />
                            }
                            className="h-6 text-[11px] gap-1.5 text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 max-w-[140px]"
                            title={`Atlas: ${asset.asset_bundles?.name || 'Bundle'} (Open in Google Drive)`}
                          >
                            <ArrowSquareOut className="size-3 shrink-0" />
                            <span className="truncate">
                              {asset.asset_bundles?.name ? `Atlas: ${asset.asset_bundles.name}` : 'Atlas'}
                            </span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            nativeButton={false}
                            render={
                              <a href={driveLink} target="_blank" rel="noopener noreferrer" />
                            }
                            className="h-6 text-[11px] gap-1.5 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                            title="Open in Google Drive"
                          >
                            <ArrowSquareOut className="size-3 shrink-0" />
                            Drive
                          </Button>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setUploadSingleAsset(asset)}
                          className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <UploadSimple className="size-3" />
                          Upload
                        </Button>
                      )}
                    </TableCell>

                    {/* Attribution */}
                    <TableCell>
                      {asset.needs_credit ? (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 w-fit text-xs border-amber-500/20 bg-amber-500/10 text-amber-500"
                        >
                          <WarningCircle className="size-3" />
                          Required
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedDetailAsset(asset)}
                          className="text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedEditAsset(asset)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Edit Asset"
                        >
                          <PencilSimple className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setAssetToDelete(asset)}
                          className="text-destructive hover:text-destructive"
                          title="Delete Asset"
                        >
                          <Trash className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </motion.div>
      </>
      )}

      {/* Asset Detail Dialog */}
      {activeDetailAsset && (
        <AssetDetailDialog
          asset={activeDetailAsset}
          projectId={projectId}
          open={!!selectedDetailAsset}
          onOpenChange={(isOpen) => !isOpen && setSelectedDetailAsset(null)}
          onEdit={() => {
            const current = activeDetailAsset
            setSelectedDetailAsset(null)
            setSelectedEditAsset(current)
          }}
          onDelete={() => {
            const current = activeDetailAsset
            setSelectedDetailAsset(null)
            setAssetToDelete(current)
          }}
          onManageReferences={() => {
            setGalleryAsset(activeDetailAsset)
          }}
          onUploadFile={() => {
            setUploadSingleAsset(activeDetailAsset)
          }}
          onStatusChange={(assetId, newStatus) => handleStatusChange(assetId, newStatus)}
        />
      )}

      {/* Edit Asset Dialog */}
      {activeEditAsset && (
        <EditAssetDialog
          asset={activeEditAsset}
          projectId={projectId}
          tasks={tasks}
          open={!!selectedEditAsset}
          onOpenChange={(isOpen) => !isOpen && setSelectedEditAsset(null)}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}

      {/* Asset Reference Gallery Modal */}
      {galleryAsset && (
        <AssetReferenceGallery
          asset={activeGalleryAsset || galleryAsset}
          projectId={projectId}
          open={!!galleryAsset}
          onOpenChange={(isOpen) => !isOpen && setGalleryAsset(null)}
        />
      )}

      {/* Upload Single File Modal */}
      {uploadSingleAsset && (
        <UploadSingleDialog
          asset={uploadSingleAsset}
          projectId={projectId}
          open={!!uploadSingleAsset}
          onOpenChange={(isOpen) => !isOpen && setUploadSingleAsset(null)}
        />
      )}

      {/* Confirm Delete Asset Dialog */}
      <ConfirmDialog
        open={!!assetToDelete}
        onOpenChange={(open) => !open && setAssetToDelete(null)}
        title="Delete Asset"
        description={`Are you sure you want to delete "${assetToDelete?.name}"? Any credits referencing this asset will be preserved.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
