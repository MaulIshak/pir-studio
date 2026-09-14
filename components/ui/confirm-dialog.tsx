'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WarningCircle, Trash, CircleNotch } from '@phosphor-icons/react'
import { cn } from 'cn'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  icon?: 'trash' | 'warning' | 'none'
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  icon = 'trash',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)
  const isPending = isLoading || internalLoading

  const handleConfirm = async () => {
    try {
      const result = onConfirm()
      if (result instanceof Promise) {
        setInternalLoading(true)
        await result
        setInternalLoading(false)
      }
      onOpenChange(false)
    } catch {
      setInternalLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex gap-4 items-start pt-1">
          {icon !== 'none' && (
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                variant === 'destructive'
                  ? 'bg-destructive/10 text-destructive dark:bg-destructive/20'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {icon === 'trash' ? (
                <Trash className="size-5" />
              ) : (
                <WarningCircle className="size-5" />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <DialogHeader className="p-0">
              <DialogTitle className="text-sm font-semibold leading-tight text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
        </div>

        <DialogFooter className="mt-2 flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <CircleNotch className="size-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
