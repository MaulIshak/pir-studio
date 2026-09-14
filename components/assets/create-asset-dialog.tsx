'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, UploadSimple, Scroll } from '@phosphor-icons/react'
import { createAsset } from '@/actions/assets'
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

interface CreateAssetDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

export function CreateAssetDialog({ projectId, trigger }: CreateAssetDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<string>('sprite')
  const [needsCredit, setNeedsCredit] = useState(false)
  const [creditLicense, setCreditLicense] = useState<string>('cc0')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('projectId', projectId)
    formData.set('type', type)
    formData.set('needsCredit', needsCredit ? 'true' : 'false')
    if (needsCredit) {
      formData.set('credit_license', creditLicense)
    }

    startTransition(async () => {
      const res = await createAsset(formData)
      if (res.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to create asset')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : <Button size="sm" />}>
        {!trigger && (
          <>
            <Plus className="size-4" />
            New Asset
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
          <DialogDescription>
            Record an asset and stream file to the project Google Drive folder.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Asset Name
            </label>
            <Input id="name" name="name" placeholder="Hero Walk Animation" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(val) => val && setType(val)}>
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="file" className="text-sm font-medium">
                Upload File
              </label>
              <Input id="file" name="file" type="file" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="needsCredit"
              checked={needsCredit}
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
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">License</label>
                    <Select value={creditLicense} onValueChange={(val) => val && setCreditLicense(val as string)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cc0" label="CC0 Public Domain">
                          CC0 Public Domain
                        </SelectItem>
                        <SelectItem value="cc_by" label="CC-BY Attribution">
                          CC-BY Attribution
                        </SelectItem>
                        <SelectItem value="royalty_free" label="Royalty-Free">
                          Royalty-Free
                        </SelectItem>
                        <SelectItem value="proprietary" label="Proprietary / Purchased">
                          Proprietary / Purchased
                        </SelectItem>
                        <SelectItem value="other" label="Other">
                          Other
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="credit_source_url" className="text-[11px] font-medium text-foreground">
                      Source URL {creditLicense !== 'cc0' && <span className="text-destructive">*</span>}
                    </label>
                    <Input
                      id="credit_source_url"
                      name="credit_source_url"
                      placeholder="https://..."
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Optional now — you can leave blank and configure details in Credits tab anytime.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Resolution, license origin, or usage guidelines..."
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
              <UploadSimple className="size-4" />
              {isPending ? 'Uploading...' : 'Save Asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
