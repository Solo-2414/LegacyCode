/**
 * Small fixed-window rate limiter kept in memory.
 * hit(key) returns true while the key is under its limit, false once it is over.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>()

  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  hit(key: string): boolean {
    const now = this.now()
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    bucket.count += 1
    return bucket.count <= this.limit
  }

  /** Whether the key is already at/over its limit, without counting another hit. */
  isBlocked(key: string): boolean {
    const bucket = this.buckets.get(key)
    return !!bucket && bucket.resetAt > this.now() && bucket.count >= this.limit
  }

  /** Drop expired buckets so the map cannot grow forever. */
  sweep() {
    const now = this.now()
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key)
  }
}
