// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { BtwThreadIndicator } from '../src/client/BtwThreadIndicator.tsx'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId

afterEach(cleanup)

function state(current: 'ordinary' | 'main' | 'child'): SessionListState {
  const hasSideThread = current !== 'ordinary'
  return {
    ids: [parentId],
    byId: {
      [parentId]: {
        id: parentId,
        displayTitle: 'Parent',
        running: false,
        blank: false,
        updatedAt: 1,
      },
      ...(hasSideThread ? {
        [childId]: {
          id: childId,
          displayTitle: '子线程',
          parentId,
          origin: 'subagent' as const,
          running: false,
          blank: false,
          updatedAt: 2,
        },
      } : {}),
    },
    current: current === 'child' ? childId : parentId,
    phase: 'ready',
    subagentsByParent: current === 'main' ? {
      [parentId]: {
        entries: [{
          kind: 'child', id: childId, activity: 'running', hasChildren: false,
          mode: 'continuable', label: '子线程',
        }],
        parentAvailable: true,
        state: 'ready',
        error: null,
      },
    } : {},
    jobsBySession: {},
  }
}

describe('BtwThreadIndicator', () => {
  it('does not label an ordinary conversation before /btw is used', () => {
    const sessions = state('ordinary')
    const view = render(<BtwThreadIndicator
      sessionId={parentId}
      useSessions={selector => selector(sessions)}
    />)
    expect(view.queryByLabelText('当前：主线程')).toBeNull()
    expect(view.queryByLabelText('当前：子线程')).toBeNull()
  })

  it('does not label a regular subagent as a BTW child thread', () => {
    const ordinary = state('ordinary')
    const sessions: SessionListState = {
      ...ordinary,
      byId: {
        ...ordinary.byId,
        [childId]: {
          id: childId,
          displayTitle: '普通子代理',
          parentId,
          origin: 'subagent',
          running: false,
          blank: false,
          updatedAt: 2,
        },
      },
      current: childId,
    }
    const view = render(<BtwThreadIndicator
      sessionId={childId}
      useSessions={selector => selector(sessions)}
    />)
    expect(view.queryByLabelText('当前：主线程')).toBeNull()
    expect(view.queryByLabelText('当前：子线程')).toBeNull()
  })

  it('labels the parent as the main thread after /btw is used', () => {
    const sessions = state('main')
    const view = render(<BtwThreadIndicator
      sessionId={parentId}
      useSessions={selector => selector(sessions)}
    />)
    expect(view.getByLabelText('当前：主线程')).toBeTruthy()
  })

  it('labels the BTW conversation as a child thread', () => {
    const sessions = state('child')
    const view = render(<BtwThreadIndicator
      sessionId={childId}
      useSessions={selector => selector(sessions)}
    />)
    expect(view.getByLabelText('当前：子线程')).toBeTruthy()
  })
})
