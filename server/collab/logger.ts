export type LogLevel = 'info' | 'warn' | 'error'

export function logEvent(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'collab',
    event,
    ...(meta ?? {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export interface CollabMetrics {
  startedAt: number
  authSuccessCount: number
  authFailureCount: number
  storeSuccessCount: number
  storeErrorCount: number
  rateLimitDropCount: number
  lastStoreDurationMs: number | null
  lastStoreAt: string | null
  lastStoreError: string | null
}

export function createMetrics(): CollabMetrics {
  return {
    startedAt: Date.now(),
    authSuccessCount: 0,
    authFailureCount: 0,
    storeSuccessCount: 0,
    storeErrorCount: 0,
    rateLimitDropCount: 0,
    lastStoreDurationMs: null,
    lastStoreAt: null,
    lastStoreError: null,
  }
}

