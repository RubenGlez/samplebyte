import { describe, it, expect } from 'vitest'
import { isChopSampleStale } from './sourceChange'

describe('isChopSampleStale', () => {
  it('is stale when the chop was edited after the sample was built', () => {
    expect(isChopSampleStale({ updatedAt: 200 }, { createdAt: 100 })).toBe(true)
  })

  it('is not stale when the sample is newer than the chop edit', () => {
    expect(isChopSampleStale({ updatedAt: 100 }, { createdAt: 200 })).toBe(false)
  })

  it('is not stale at equal timestamps (just-built sample)', () => {
    expect(isChopSampleStale({ updatedAt: 150 }, { createdAt: 150 })).toBe(false)
  })
})
