'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react'
import { createCredit } from '@/actions/credits'
import { Asset } from '@/actions/assets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

interface CreateCreditDialogProps {
  projectId: string
  assets: Asset[]
  trigger?: React.ReactNode
}

export function CreateCreditDialog({ projectId, assets, trigger }: CreateCreditDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [license, setLicense] = useState<string>('cc_by')
  const [assetId, setAssetId] = useState<string>('none')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('projectId', projectId)
    formData.set('license', license)
    if (assetId !== 'none') {
      formData.set('asset_id', assetId)
    }

    startTransition(async () => {
      const res = await createCredit(formData)
      if (res.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to create credit attribution')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : <Button size="sm" />}>
        {!trigger && (
          <>
            <Plus className="size-4" />
            New Credit
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Attribution</DialogTitle>
          <DialogDescription>
            Record external author licenses and asset attributions.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="source_name" className="text-sm font-medium">
              Source Name
            </label>
            <Input id="source_name" name="source_name" placeholder="RPG Sound Pack Vol. 1" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="author" className="text-sm font-medium">
                Author
              </label>
              <Input id="author" name="author" placeholder="Kenny / OpenGameArt" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">License</label>
              <Select value={license} onValueChange={(val) => val && setLicense(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cc0">CC0 Public Domain</SelectItem>
                  <SelectItem value="cc_by">CC-BY</SelectItem>
                  <SelectItem value="royalty_free">Royalty-Free</SelectItem>
                  <SelectItem value="proprietary">Proprietary</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="source_url" className="text-sm font-medium">
              Source URL {license !== 'cc0' && <span className="text-destructive">*</span>}
            </label>
            <Input
              id="source_url"
              name="source_url"
              type="url"
              placeholder="https://..."
              required={license !== 'cc0'}
            />
          </div>

          {assets.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Associated Asset</label>
              <Select value={assetId} onValueChange={(val) => val && setAssetId(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" label="None">
                    None
                  </SelectItem>
                  {assets.map((asset) => (
                    <SelectItem
                      key={asset.id}
                      value={asset.id}
                      label={`${asset.name} - ${asset.type}`}
                    >
                      {asset.name} - {asset.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Attribution requirement text or commercial usage terms..."
              rows={3}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Credit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
