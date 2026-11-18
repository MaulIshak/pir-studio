'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import { Sparkle, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

const AiAssistantPanel = dynamic(
  () => import('./ai-assistant-panel').then((m) => m.AiAssistantPanel),
  { ssr: false }
)

export function AiAssistantFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <AnimatePresence>{open && <AiAssistantPanel onClose={() => setOpen(false)} />}</AnimatePresence>
      <Button
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className="fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:right-4 md:bottom-4 z-40 rounded-full md:rounded-lg border border-primary/30 shadow-lg"
      >
        {open ? <X className="size-5" /> : <Sparkle className="size-5" />}
      </Button>
    </>
  )
}
