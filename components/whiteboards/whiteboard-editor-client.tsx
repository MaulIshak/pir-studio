'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { WhiteboardCanvasProps } from './whiteboard-canvas'

const DynamicWhiteboardCanvas = dynamic(
  () => import('./whiteboard-canvas').then((mod) => mod.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-screen flex-col bg-background">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-6" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    ),
  }
)

export function WhiteboardEditorClient(props: WhiteboardCanvasProps) {
  return <DynamicWhiteboardCanvas {...props} />
}

