'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { retryDriveProvisioning } from '@/actions/projects'

export function RetryDriveButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRetry = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError(null)

    const res = await retryDriveProvisioning(projectId)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={handleRetry}
      >
        {loading ? 'Retrying...' : 'Retry Drive Sync'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
