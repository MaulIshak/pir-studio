interface Bucket {
  tokens: number
  lastRefill: number
}

/**
 * Token-bucket message rate limiter keyed by socketId.
 */
export class ConnectionRateLimiter {
  private buckets = new Map<string, Bucket>()
  private readonly capacity: number
  private readonly refillPerSecond: number

  constructor(options?: { capacity?: number; refillPerSecond?: number }) {
    this.capacity = options?.capacity ?? 120
    this.refillPerSecond = options?.refillPerSecond ?? 60
  }

  consume(socketId: string, cost = 1): boolean {
    const now = Date.now()
    let bucket = this.buckets.get(socketId)
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now }
      this.buckets.set(socketId, bucket)
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000
    if (elapsedSec > 0) {
      bucket.tokens = Math.min(
        this.capacity,
        bucket.tokens + elapsedSec * this.refillPerSecond
      )
      bucket.lastRefill = now
    }

    if (bucket.tokens < cost) {
      return false
    }

    bucket.tokens -= cost
    return true
  }

  delete(socketId: string): void {
    this.buckets.delete(socketId)
  }
}

/**
 * Tracks active WebSocket connections per (userId, boardId) pair to cap concurrent tabs/sockets.
 */
export class UserBoardConnectionTracker {
  private counts = new Map<string, Set<string>>()
  private readonly maxPerUserPerBoard: number

  constructor(maxPerUserPerBoard = 5) {
    this.maxPerUserPerBoard = maxPerUserPerBoard
  }

  private key(userId: string, boardId: string): string {
    return `${userId}:${boardId}`
  }

  tryAcquire(userId: string, boardId: string, socketId: string): boolean {
    const k = this.key(userId, boardId)
    let set = this.counts.get(k)
    if (!set) {
      set = new Set()
      this.counts.set(k, set)
    }
    if (!set.has(socketId) && set.size >= this.maxPerUserPerBoard) {
      return false
    }
    set.add(socketId)
    return true
  }

  release(userId: string, boardId: string, socketId: string): void {
    const k = this.key(userId, boardId)
    const set = this.counts.get(k)
    if (!set) return
    set.delete(socketId)
    if (set.size === 0) {
      this.counts.delete(k)
    }
  }
}

