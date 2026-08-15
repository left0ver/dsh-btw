// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { openBtwSide } from '../src/client/index.ts'
import { btwNavigation } from '../src/client/btw-state.ts'
import { btwSessionId } from '../src/protocol.ts'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId

afterEach(() => { btwNavigation.clear() })

describe('openBtwSide', () => {
  it('opens an ordinary parentless session and remembers only a local navigation pair', async () => {
    const open = vi.fn()
    await expect(openBtwSide({ open }, parentId, childId)).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith(childId)
    expect(btwNavigation.resolve(childId, [parentId, childId])?.parentId).toBe(parentId)
  })

  it('forgets the pair when the child is absent from the session list', async () => {
    const open = vi.fn(() => { throw new Error('session is absent') })
    await expect(openBtwSide({ open }, parentId, childId)).resolves.toBe(false)
    expect(btwNavigation.resolve(childId, [parentId, childId])).toBeUndefined()
  })

  it('recovers navigation from a parentless BTW session id without browser storage', () => {
    const recoverableChild = btwSessionId(parentId, 'nonce') as SessionId
    expect(btwNavigation.resolve(recoverableChild, [parentId, recoverableChild])?.parentId).toBe(parentId)
  })
})
