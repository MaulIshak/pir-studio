'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PencilSimple, CheckSquare } from '@phosphor-icons/react'
import { Asset, AssetStatus, AssetType, updateAsset } from '@/actions/assets'

interface EditAssetDialogProps {
  asset: Asset
  projectId: string
  tasks?: Array<{ id: string; title: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (updatedAsset: Asset) => void
}

interface EditAssetFormProps {
  asset: Asset
  projectId: string
  tasks: Array<{ id: string; title: string }>
  onClose: () => void
  onSuccess?: (updatedAsset: Asset) => void
}

function EditAssetForm({
  asset,
  projectId,
  tasks,
  onClose,
  onSuccess,
}: EditAssetFormProps) {
  const [name, setName] = useState(asset.name)
  const [type, setType] = useState<AssetType>(asset.type)
  const [taskId, setTaskId] = useState<string>(asset.task_id || 'none')
  const [status, setStatus] = useState<AssetStatus>(asset.status)
  const [needsCredit, setNeedsCredit] = useState(asset.needs_credit)
  const [notes, setNotes] = useState(asset.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Asset name is required')
      return
    }

    setLoading(true)
    setError(null)

    const res = await updateAsset(asset.id, projectId, {
      name: name.trim(),
      type,
      taskId: taskId === 'none' ? null : taskId,
      status,
      needsCredit,
      notes: notes.trim() || null,
    })

    setLoading(false)

    if (res.success && res.data) {
      onClose()
      onSuccess?.(res.data)
      router.refresh()
    } else {
      setError(res.error || 'Failed to update asset')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Asset Name & Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <label htmlFor="edit_asset_name" className="text-xs font-semibold">
            Asset Name
          </label>
          <Input
            id="edit_asset_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">Type</label>
          <Select
            value={type}
            onValueChange={(val) => val && setType(val as AssetType)}
            disabled={loading}
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
      </div>

      {/* Connected Task & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">Connected Task</label>
          <Select
            value={taskId}
            onValueChange={(val) => val && setTaskId(val)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Task / Unassigned</SelectItem>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">Status</label>
          <Select
            value={status}
            onValueChange={(val) => val && setStatus(val as AssetStatus)}
            disabled={loading}
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

      {/* Credit Attribution Checkbox */}
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="edit_needsCredit"
          checked={needsCredit}
          onCheckedChange={(checked) => setNeedsCredit(checked === true)}
          disabled={loading}
        />
        <label htmlFor="edit_needsCredit" className="cursor-pointer text-xs font-medium">
          Requires License Attribution
        </label>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_notes" className="text-xs font-semibold">
          Notes
        </label>
        <Textarea
          id="edit_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dimensions, usage guidelines, or engine notes..."
          rows={3}
          disabled={loading}
        />
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          <CheckSquare className="size-4" />
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditAssetDialog({
  asset,
  projectId,
  tasks = [],
  open,
  onOpenChange,
  onSuccess,
}: EditAssetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilSimple className="size-4 text-primary" />
            <span>Edit Asset</span>
          </DialogTitle>
        </DialogHeader>

        {open && (
          <EditAssetForm
            key={asset.id}
            asset={asset}
            projectId={projectId}
            tasks={tasks}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
