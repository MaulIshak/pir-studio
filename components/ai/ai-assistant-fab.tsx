'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { AiAssistantPanel } from './ai-assistant-panel'

export function AiAssistantFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <AnimatePresence>{open && <AiAssistantPanel onClose={() => setOpen(false)} />}</AnimatePresence>
      <Button
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistant"
        className="fixed right-4 bottom-4 z-50 shadow-lg"
      >
        <Sparkle className="size-5" />
      </Button>
    </>
  )
}
