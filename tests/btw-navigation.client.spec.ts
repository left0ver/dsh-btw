// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import { openBtwSide } from '../src/client/index.ts'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId

describe('openBtwSide', () => {
  it('opens with the known address after refreshing instead of requiring a retained address', async () => {
    const refreshSubagents = vi.fn().mockResolvedValue(undefined)
    const openSubagent = vi.fn((_address: SubagentAddress) => undefined)

    await expect(openBtwSide({ refreshSubagents, openSubagent }, parentId, childId)).resolves.toBe(true)
    expect(refreshSubagents).toHaveBeenCalledWith(parentId)
    expect(openSubagent).toHaveBeenCalledWith({
      parentSessionId: parentId,
      childSessionId: childId,
      mode: 'continuable',
    })
  })

  it('reports a catalog validation failure without changing the current page', async () => {
    const refreshSubagents = vi.fn().mockResolvedValue(undefined)
    const openSubagent = vi.fn(() => { throw new Error('child is absent') })
    await expect(openBtwSide({ refreshSubagents, openSubagent }, parentId, childId)).resolves.toBe(false)
  })
})
