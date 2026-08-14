/** Host half of the Codex-style `/btw` side-conversation plugin. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { EphemeralContinuableHandle } from '@deepseek-ai/dsh-subagent'
import type ToolRuntime from '@deepseek-ai/dsh-tools'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { BTW_LABEL, BTW_OPENED_PREFIX } from './protocol.ts'

export const name = 'btw'
export const inject = ['commands', 'subagents']

/** Host configuration. */
export interface Config {
  /** Continuable provider used to capture the parent's completed history. */
  provider?: string
}

export const Config: z<Config> = z.object({
  provider: z.string().default('fork'),
})

interface ActiveBtw {
  readonly parent: Agent
  readonly handle: EphemeralContinuableHandle
}

const SIDE_INSTRUCTIONS = [
  'You are in a temporary side conversation opened with /btw.',
  'Treat the inherited parent conversation as reference-only background. Do not continue its active task unless the user explicitly asks.',
  'Answer the side conversation directly and keep its messages independent from the parent conversation.',
  'Do not create or message subagents from this side conversation.',
  'Do not modify files, run commands with side effects, or change external state unless the user explicitly requests that action in this side conversation.',
].join(' ')

const SUBAGENT_TOOL_NAMES = ['subagent', 'subagent_fork', 'send_message', 'list_agents'] as const

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Register `/btw` and own every process-local side handle. */
export function apply(ctx: Context, config: Config): void {
  const subagents = ctx.get('subagents') as SubagentRuntime | undefined
  if (subagents === undefined) throw new Error('dsh-btw requires the subagents service')
  if (typeof subagents.startEphemeralContinuable !== 'function') {
    throw new Error(
      'dsh-btw requires an rc.6 host build containing '
      + 'subagents.startEphemeralContinuable; rebuild and restart DeepSeek Harness',
    )
  }
  const activeByParent = new Map<SessionId, ActiveBtw>()
  const activeByChild = new Map<SessionId, ActiveBtw>()
  const starting = new Set<SessionId>()

  const disposeEntry = async (entry: ActiveBtw): Promise<void> => {
    if (activeByParent.get(entry.parent.id) !== entry) return
    await entry.handle.dispose()
    if (activeByParent.get(entry.parent.id) === entry) activeByParent.delete(entry.parent.id)
    if (activeByChild.get(entry.handle.childId) === entry) activeByChild.delete(entry.handle.childId)
  }

  ctx.effect(() => async () => {
    const settled = await Promise.allSettled([...activeByParent.values()].map(disposeEntry))
    const failures = settled.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (failures.length > 0) throw new AggregateError(failures, 'failed to dispose BTW side conversations')
  }, 'btw.handles()')

  ctx.on('agent/disposed', ({ agent }) => {
    const entry = activeByParent.get(agent.id)
    if (entry !== undefined) {
      void disposeEntry(entry).catch((error: unknown) => {
        ctx.logger.warn(`btw: parent cleanup failed: ${errorText(error)}`)
      })
    }
  })

  ctx.commands.register({
    name: 'btw',
    description: '创建一个临时会话继承当前的上下文，用于临时聊天',
    input: { hint: '给智能体发消息' },
    recordInput: false,
    async handler({ agent, rawInput, signal }) {
      const side = activeByChild.get(agent.id)
      if (side !== undefined) {
        return { kind: 'error', text: 'BTW 侧会话中不能再次打开 BTW 会话。' }
      }
      if (!agent.session.events.some(event => event.type === 'turn/end')) {
        return { kind: 'error', text: '主会话至少完成一轮对话后才能使用 /btw。' }
      }
      if (activeByParent.has(agent.id) || starting.has(agent.id)) {
        return { kind: 'error', text: '当前主会话已经有一个 BTW 侧会话；请使用 Ctrl+/ 切换。' }
      }

      starting.add(agent.id)
      try {
        const tools = agent.ctx.get('tools') as ToolRuntime | undefined
        const deniedTools = SUBAGENT_TOOL_NAMES.filter(tool => tools?.get(tool, agent) !== undefined)
        const prompt = rawInput.trim()
        const handle = await subagents.startEphemeralContinuable({
          provider: config.provider ?? 'fork',
          label: BTW_LABEL,
          request: {
            parent: agent,
            ...prompt === '' ? {} : { prompt: [{ type: 'text', text: prompt }] },
            ...deniedTools.length === 0 ? {} : { toolFilter: { deny: deniedTools } },
          },
          instructions: SIDE_INSTRUCTIONS,
          signal,
        })
        const entry = { parent: agent, handle }
        activeByParent.set(agent.id, entry)
        activeByChild.set(handle.childId, entry)
        return { kind: 'success', text: `${BTW_OPENED_PREFIX}${handle.childId}` }
      } catch (error: unknown) {
        return { kind: 'error', text: `无法打开 BTW 会话：${errorText(error)}` }
      } finally {
        starting.delete(agent.id)
      }
    },
  })
}
