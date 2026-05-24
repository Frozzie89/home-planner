import { describe, it, expect } from 'vitest'
import { pb } from './pocketbase'

describe('PocketBase singleton', () => {
  it('exports a single PocketBase instance', () => {
    expect(pb).toBeDefined()
  })

  it('re-importing returns the same instance (singleton)', async () => {
    const { pb: pb2 } = await import('./pocketbase')
    expect(pb2).toBe(pb)
  })
})
