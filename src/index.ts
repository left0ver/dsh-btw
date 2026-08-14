/** Host half of the Codex-style `/btw` side-conversation plugin. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { EphemeralContinuableHandle } from '@deepseek-ai/dsh-subagent'
import type ToolRuntime from '@deepseek-ai/dsh-tools'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { btwText, resolveBtwLocale, type BtwLocaleId } from './locales.ts'

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
const LOCALE_SETTINGS_NAMESPACE = settingsNamespace('locale')

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
  let locale: BtwLocaleId = resolveBtwLocale(ctx.get('settings')?.get(LOCALE_SETTINGS_NAMESPACE))

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

  const handler = async ({ agent, rawInput, signal }: CommandInvocation) => {
      const text = (key: Parameters<typeof btwText>[1], params?: Readonly<Record<string, unknown>>) =>
        btwText(locale, key, params)
      const side = activeByChild.get(agent.id)
      if (side !== undefined) {
        return { kind: 'error' as const, text: text('command.error.nested') }
      }
      if (!agent.session.events.some(event => event.type === 'turn/end')) {
        return { kind: 'error' as const, text: text('command.error.noCompletedTurn') }
      }
      if (activeByParent.has(agent.id) || starting.has(agent.id)) {
        return { kind: 'error' as const, text: text('command.error.duplicate') }
      }

      starting.add(agent.id)
      try {
        const tools = agent.ctx.get('tools') as ToolRuntime | undefined
        const deniedTools = SUBAGENT_TOOL_NAMES.filter(tool => tools?.get(tool, agent) !== undefined)
        const prompt = rawInput.trim()
        const handle = await subagents.startEphemeralContinuable({
          provider: config.provider ?? 'fork',
          label: text('thread.title'),
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
        return { kind: 'success' as const, text: text('command.opened', { id: handle.childId }) }
      } catch (error: unknown) {
        return { kind: 'error' as const, text: text('command.error.openFailed', { error: errorText(error) }) }
      } finally {
        starting.delete(agent.id)
      }
  }

  const registerCommand = () => ctx.commands.register({
    name: 'btw',
    description: btwText(locale, 'command.description'),
    input: { hint: btwText(locale, 'command.hint') },
    recordInput: false,
    handler,
  })
  let unregisterCommand = registerCommand()
  ctx.on('settings/updated', (namespace, next) => {
    if (namespace !== LOCALE_SETTINGS_NAMESPACE) return
    const nextLocale = resolveBtwLocale(next)
    if (nextLocale === locale) return
    locale = nextLocale
    const childLabel = btwText(locale, 'thread.title')
    for (const entry of activeByParent.values()) entry.handle.relabel(childLabel)
    unregisterCommand()
    unregisterCommand = registerCommand()
  })
  ctx.effect(() => () => { unregisterCommand() }, 'btw.command()')
}
