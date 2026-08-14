import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime, { CommandId } from '@deepseek-ai/dsh-commands'
import { SessionId } from '@deepseek-ai/dsh-session'
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

async function setup() {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(CommandRuntime)
  const dispose = vi.fn().mockResolvedValue(undefined)
  const start = vi.fn(async (_spec: EphemeralContinuableStartSpec) => ({
    childId: SessionId('side'),
    followup: vi.fn(),
    interrupt: vi.fn(),
    dispose,
  }))
  ctx.provide('subagents', { startEphemeralContinuable: start } as never)
  apply(ctx, { provider: 'fork' })
  return { ctx, start, dispose }
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
    expect(result).toEqual({ kind: 'error', text: '主会话至少完成一轮对话后才能使用 /btw。' })
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
    expect(first).toEqual({ kind: 'success', text: 'BTW 会话已打开：side' })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'fork',
      label: '子线程',
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
    expect(nested).toEqual({ kind: 'error', text: 'BTW 侧会话中不能再次打开 BTW 会话。' })
    expect(dispose).not.toHaveBeenCalled()
  })
})
