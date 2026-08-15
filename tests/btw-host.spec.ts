import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import CommandRuntime, { CommandId } from '@deepseek-ai/dsh-commands'
import { SessionId } from '@deepseek-ai/dsh-session'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply } from '../src/index.ts'
import { parseBtwParentId } from '../src/protocol.ts'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
})

function agent(ctx: Context, id: string, completed = true): Agent {
  return {
    id: SessionId(id),
    ctx,
    options: { provider: 'test', model: 'model' },
    session: {
      id: SessionId(id),
      header: { id: SessionId(id), version: 0, createdAt: 1, cwd: '/tmp/project' },
      events: completed
        ? [{ type: 'turn/end', seq: 0, time: 1, data: { turn: 1, reason: 'completed' } }]
        : [],
    },
    followup: vi.fn(),
  } as unknown as Agent
}

async function setup(locale: 'zh' | 'en' = 'zh', isolatedChild = false) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(CommandRuntime)
  ctx.provide('settings', { get: () => ({ preference: locale }) } as never)
  ctx.provide('sessions', { flush: vi.fn().mockResolvedValue(false) } as never)
  ctx.provide('sessionPersistence', { locate: vi.fn(() => undefined) } as never)
  const dispose = vi.fn().mockResolvedValue(undefined)
  const create = vi.fn(async (options: CreateAgentOptions) => {
    let child: Agent
    if (isolatedChild) {
      await ctx.plugin({
        async apply(childCtx: Context) {
          child = agent(childCtx, options.sessionId)
          Object.defineProperty(childCtx, 'agent', { configurable: true, value: child })
          await options.setup?.(childCtx)
        },
      })
    } else {
      child = agent(ctx, options.sessionId)
      Object.defineProperty(ctx, 'agent', { configurable: true, value: child })
      await options.setup?.(ctx)
    }
    return { agent: child, dispose }
  })
  ctx.provide('agents', { create } as never)
  apply(ctx, {})
  return { ctx, create, dispose }
}

describe('/btw host command', () => {
  it('loads without the subagent service', async () => {
    const { ctx } = await setup()
    expect(ctx.commands.find(agent(ctx, 'parent'), 'btw')).toBeDefined()
  })

  it('requires a completed parent turn', async () => {
    const { ctx, create } = await setup()
    const parent = agent(ctx, 'parent', false)
    const result = await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-1'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })
    expect(result).toEqual({ kind: 'error', text: '主线程至少完成一轮对话后才能使用 /btw。' })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a parentless agent with copied context and inherited runtime options', async () => {
    const { ctx, create } = await setup()
    const parent = agent(ctx, 'parent')
    const commandId = CommandId('cmd-open')
    const seed = [
      ...parent.session.events,
      { type: 'sandbox/mode', seq: 1, time: 2, data: { mode: 'workspace-write', source: 'user' } },
    ] as unknown as typeof parent.session.events
    Object.defineProperty(parent.session, 'events', { value: [
      ...seed,
      { type: 'command/run', seq: 2, time: 3, data: { commandId, name: 'btw', source: { kind: 'user' } } },
    ] })
    const result = await ctx.commands.find(parent, 'btw')?.handler({
      commandId, agent: parent, rawInput: ' explain this', signal: new AbortController().signal,
    })

    expect(result).toMatchObject({ kind: 'success' })
    expect(create).toHaveBeenCalledTimes(1)
    const options = create.mock.calls[0]?.[0]
    expect(options?.sessionId).toMatch(/^session-btw-/u)
    expect(parseBtwParentId(options?.sessionId ?? '')).toBe(parent.id)
    expect(options?.seed).toEqual(seed)
    expect(options?.meta).toEqual({ cwd: '/tmp/project' })
    expect(options?.meta).not.toHaveProperty('parentSession')
    expect(options?.agentOptions).toEqual(parent.options)
  })

  it('injects commands before registering the child-scoped close command', async () => {
    const { ctx } = await setup('zh', true)
    const parent = agent(ctx, 'parent')
    const result = await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-isolated'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })

    expect(result).toEqual({ kind: 'success', text: expect.any(String) })
  })

  it('pins the child to the main session permission preset before publication', async () => {
    const { ctx } = await setup()
    const set = vi.fn()
    ctx.provide('permissionPresets', {
      current: vi.fn(() => 'workspace-write'),
      set,
    } as never)
    const parent = agent(ctx, 'parent')

    await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-permission'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^session-btw-/u) }), 'workspace-write')
  })

  it('opens an empty side session without starting a model turn', async () => {
    const { ctx, create } = await setup()
    const parent = agent(ctx, 'parent')
    await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-empty'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })
    const created = await create.mock.results[0]?.value
    expect(created?.agent.followup).not.toHaveBeenCalled()
  })

  it('rejects nested and duplicate side sessions', async () => {
    const { ctx, create } = await setup()
    const parent = agent(ctx, 'parent')
    const definition = ctx.commands.find(parent, 'btw')
    await definition?.handler({
      commandId: CommandId('cmd-open'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })
    const child = (await create.mock.results[0]?.value)?.agent
    const nested = child === undefined ? undefined : await definition?.handler({
      commandId: CommandId('cmd-nested'), agent: child, rawInput: '', signal: new AbortController().signal,
    })
    expect(nested).toEqual({ kind: 'error', text: '子线程中不能再次创建子线程。' })
    const duplicate = await definition?.handler({
      commandId: CommandId('cmd-duplicate'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })
    expect(duplicate?.kind).toBe('error')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('exposes a private close command only accepted by a live BTW agent', async () => {
    const { ctx, create } = await setup('zh', true)
    const parent = agent(ctx, 'parent')
    await ctx.commands.find(parent, 'btw')?.handler({
      commandId: CommandId('cmd-open'), agent: parent, rawInput: '', signal: new AbortController().signal,
    })
    const child = (await create.mock.results[0]?.value)?.agent
    const close = child === undefined ? undefined : await ctx.commands.find(child, 'btw-close')?.handler({
      commandId: CommandId('cmd-close'), agent: child, rawInput: '', signal: new AbortController().signal,
    })
    expect(close).toEqual({ kind: 'success' })
  })

  it('switches command copy with the Harness locale setting', async () => {
    const { ctx } = await setup('zh')
    const parent = agent(ctx, 'parent', false)
    expect(ctx.commands.find(parent, 'btw')?.description).toContain('临时会话')
    ctx.emit('settings/updated', settingsNamespace('locale'), { preference: 'en' }, { preference: 'zh' }, 'update')
    expect(ctx.commands.find(parent, 'btw')?.description).toContain('temporary session')
  })
})
