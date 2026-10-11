import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RateLimiter } from "./rate-limit.js"

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    let now = 0
    const limiter = new RateLimiter(3, 1000, () => now)
    assert.deepEqual([1, 2, 3, 4, 5].map(() => limiter.hit("a")), [true, true, true, false, false])
  })

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 1000, () => 0)
    assert.equal(limiter.hit("a"), true)
    assert.equal(limiter.hit("a"), false)
    assert.equal(limiter.hit("b"), true)
  })

  it("resets after the window passes", () => {
    let now = 0
    const limiter = new RateLimiter(1, 1000, () => now)
    limiter.hit("a")
    assert.equal(limiter.hit("a"), false)
    now = 1001
    assert.equal(limiter.hit("a"), true)
  })

  it("isBlocked reports the limit without counting a hit", () => {
    const limiter = new RateLimiter(2, 1000, () => 0)
    assert.equal(limiter.isBlocked("a"), false)
    limiter.hit("a")
    assert.equal(limiter.isBlocked("a"), false)
    limiter.hit("a")
    assert.equal(limiter.isBlocked("a"), true)
  })
})
