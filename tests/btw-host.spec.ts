import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime, { CommandId } from '@deepseek-ai/dsh-commands'
import { SessionId } from '@deepseek-ai/dsh-session'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { EphemeralContinuableStartSpec } from '@deepseek-ai/dsh-subagent'
import { apply } from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
})

function agent(ctx: Context, id: string, completed = true): Agent {
  return {
    id: SessionId(id),
    ctx,
    session: {
      id: SessionId(id),
      events: completed ? [{ type: 'turn/end' }] : [],
    },
  } as unknown as Agent
}

async function setup(locale: 'zh' | 'en' = 'zh') {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(CommandRuntime)
  ctx.provide('settings', {
    get: () => ({ preference: locale }),
  } as never)
  const dispose = vi.fn().mockResolvedValue(undefined)
  const relabel = vi.fn()
  const start = vi.fn(async (_spec: EphemeralContinuableStartSpec) => ({
    childId: SessionId('side'),
    followup: vi.fn(),
    relabel,
    interrupt: vi.fn(),
    dispose,
  }))
  ctx.provide('subagents', { startEphemeralContinuable: start } as never)
  apply(ctx, { provider: 'fork' })
  return { ctx, start, dispose, relabel }
}

describe('/btw host command', () => {
  it('fails at plugin load when the host build lacks the ephemeral API', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(CommandRuntime)
    ctx.provide('subagents', {} as never)
    expect(() => apply(ctx, { provider: 'fork' })).toThrow(
      'dsh-btw requires an rc.6 host build containing subagents.startEphemeralContinuable',
    )
  })

  it('requires a completed parent turn', async () => {
    const { ctx, start } = await setup()
    const definition = ctx.commands.find(agent(ctx, 'parent', false), 'btw')
    const result = await definition?.handler({
      commandId: CommandId('cmd-1'),
      agent: agent(ctx, 'parent', false),
      rawInput: '',
      signal: new AbortController().signal,
    })
    expect(result).toEqual({ kind: 'error', text: '主线程至少完成一轮对话后才能使用 /btw。' })
    expect(start).not.toHaveBeenCalled()
  })

  it('opens once, forwards inline text, and rejects a duplicate', async () => {
    const { ctx, start } = await setup()
    const parent = agent(ctx, 'parent')
    const definition = ctx.commands.find(parent, 'btw')
    const first = await definition?.handler({
      commandId: CommandId('cmd-1'),
      agent: parent,
      rawInput: ' explain this',
      signal: new AbortController().signal,
    })
    expect(first).toEqual({ kind: 'success', text: '子线程已创建：side' })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'fork',
      label: 'btw子线程',
      request: expect.objectContaining({
        parent,
        prompt: [{ type: 'text', text: 'explain this' }],
      }),
    }))

    const duplicate = await definition?.handler({
      commandId: CommandId('cmd-2'),
      agent: parent,
      rawInput: '',
      signal: new AbortController().signal,
    })
    expect(duplicate?.kind).toBe('error')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does not expose a close command from the active side', async () => {
    const { ctx, dispose } = await setup()
    const parent = agent(ctx, 'parent')
    const definition = ctx.commands.find(parent, 'btw')
    await definition?.handler({
      commandId: CommandId('cmd-open'),
      agent: parent,
      rawInput: '',
      signal: new AbortController().signal,
    })
    const side = agent(ctx, 'side')
    const nested = await definition?.handler({
      commandId: CommandId('cmd-nested'),
      agent: side,
      rawInput: '',
      signal: new AbortController().signal,
    })
    expect(nested).toEqual({ kind: 'error', text: '子线程中不能再次创建子线程。' })
    expect(dispose).not.toHaveBeenCalled()
  })

  it('switches command metadata and outcomes with the Harness locale setting', async () => {
    const { ctx, start } = await setup('zh')
    const parent = agent(ctx, 'parent', false)
    expect(ctx.commands.find(parent, 'btw')).toMatchObject({
      description: '创建一个临时会话继承当前的上下文，用于临时聊天',
      input: { hint: '给智能体发消息' },
    })

    ctx.emit(
      'settings/updated',
      settingsNamespace('locale'),
      { preference: 'en' },
      { preference: 'zh' },
      'update',
    )
    const english = ctx.commands.find(parent, 'btw')
    expect(english).toMatchObject({
      description: 'Create a temporary session that inherits the current context for a quick side chat',
      input: { hint: 'Message the agent' },
    })
    const result = await english?.handler({
      commandId: CommandId('cmd-en'),
      agent: parent,
      rawInput: '',
      signal: new AbortController().signal,
    })
    expect(result).toEqual({
      kind: 'error',
      text: 'Complete at least one turn in the main thread before using /btw.',
    })
    expect(start).not.toHaveBeenCalled()
  })

  it('creates an English-labeled child when English is selected', async () => {
    const { ctx, start } = await setup('en')
    const parent = agent(ctx, 'parent')
    const result = await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-en-open'),
      agent: parent,
      rawInput: ' hello',
      signal: new AbortController().signal,
    })
    expect(result).toEqual({ kind: 'success', text: 'Side thread created: side' })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      label: 'btw side thread',
      request: expect.objectContaining({ prompt: [{ type: 'text', text: 'hello' }] }),
    }))
  })

  it('relabels an active child when the Harness locale changes', async () => {
    const { ctx, relabel } = await setup('en')
    const parent = agent(ctx, 'parent')
    await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-open-en'),
      agent: parent,
      rawInput: '',
      signal: new AbortController().signal,
    })

    ctx.emit(
      'settings/updated',
      settingsNamespace('locale'),
      { preference: 'zh' },
      { preference: 'en' },
      'update',
    )

    expect(relabel).toHaveBeenCalledWith('btw子线程')
  })
})
