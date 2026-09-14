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
} from '@phosphor-icons/react'
import { Asset, updateAssetStatus, deleteAsset } from '@/actions/assets'
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

interface AssetTableProps {
  assets: Asset[]
  projectId: string
}

function getTypeDetails(type: Asset['type']) {
  switch (type) {
    case 'sprite':
      return { icon: <ImageIcon className="size-3.5 text-purple-400" />, bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
    case 'audio':
      return { icon: <MusicNotes className="size-3.5 text-blue-400" />, bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case '3d_model':
      return { icon: <Cube className="size-3.5 text-amber-400" />, bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    case 'font':
      return { icon: <TextAa className="size-3.5 text-teal-400" />, bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20' }
    case 'vfx':
      return { icon: <Sparkle className="size-3.5 text-rose-400" />, bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
    default:
      return { icon: <File className="size-3.5 text-muted-foreground" />, bg: 'bg-secondary text-muted-foreground' }
  }
}

export function AssetTable({ assets, projectId }: AssetTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [, startTransition] = useTransition()
  const router = useRouter()

  const filteredAssets = assets.filter((asset) => {
    if (typeFilter !== 'all' && asset.type !== typeFilter) return false
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false
    if (
      searchQuery.trim() &&
      !asset.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !asset.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  function handleStatusChange(assetId: string, newStatus: Asset['status']) {
    startTransition(async () => {
      await updateAssetStatus(assetId, projectId, newStatus)
      router.refresh()
    })
  }

  function handleDelete(assetId: string) {
    if (!confirm('Are you sure you want to delete this asset?')) return
    startTransition(async () => {
      await deleteAsset(assetId, projectId)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(val) => val && setTypeFilter(val)}>
            <SelectTrigger className="w-[130px]">
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

          <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="integrated">Integrated</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          title={assets.length === 0 ? 'No assets recorded' : 'No matching assets'}
          description={
            assets.length === 0
              ? 'Upload or register assets to begin tracking art, audio, and VFX.'
              : 'No assets match your search filters.'
          }
          icon={<Package className="size-7" />}
          action={assets.length === 0 ? <CreateAssetDialog projectId={projectId} /> : undefined}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-md border bg-card/60 overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attribution</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const driveLink = asset.drive_file_id
                  ? `https://drive.google.com/file/d/${asset.drive_file_id}/view`
                  : null
                const details = getTypeDetails(asset.type)

                return (
                  <TableRow key={asset.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{asset.name}</span>
                        {asset.notes && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {asset.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className={`flex items-center gap-1.5 w-fit capitalize text-xs ${details.bg}`}>
                        {details.icon}
                        {asset.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={asset.status}
                        onValueChange={(val) =>
                          val && handleStatusChange(asset.id, val as Asset['status'])
                        }
                      >
                        <SelectTrigger className="h-7 w-[125px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="integrated">Integrated</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      {asset.needs_credit ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit text-xs border-amber-500/20 bg-amber-500/10 text-amber-500">
                          <WarningCircle className="size-3" />
                          Required
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {asset.profiles?.name || asset.profiles?.email || 'Team'}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {driveLink && (
                          <Button
                            variant="ghost"
                            size="xs"
                            nativeButton={false}
                            render={
                              <a href={driveLink} target="_blank" rel="noopener noreferrer" />
                            }
                            className="text-primary hover:text-primary"
                          >
                            <ArrowSquareOut className="size-3.5" />
                            Drive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleDelete(asset.id)}
                          className="text-destructive hover:text-destructive"
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
      )}
    </div>
  )
}
