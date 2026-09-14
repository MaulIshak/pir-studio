'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FolderDashed } from '@phosphor-icons/react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({
  title = 'No items found',
  description = 'Get started by creating your first entry.',
  icon,
  action,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full"
    >
      <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-border/70 bg-gradient-to-b from-card to-secondary/30">
        <CardContent className="flex flex-col items-center gap-3.5 p-0 max-w-sm">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon || <FolderDashed className="size-7" />}
          </div>

          <div className="flex flex-col gap-1.5">
            <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {action ? (
            <div className="mt-2">{action}</div>
          ) : onAction && actionLabel ? (
            <Button size="sm" onClick={onAction} className="mt-2">
              <Plus className="size-3.5" />
              {actionLabel}
            </Button>
          ) : actionHref && actionLabel ? (
            <Button
              nativeButton={false}
              render={<Link href={actionHref} />}
              size="sm"
              className="mt-2"
            >
              <Plus className="size-3.5" />
              {actionLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
