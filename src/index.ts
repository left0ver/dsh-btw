import { randomUUID } from 'node:crypto'
import { rmdir, unlink } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import { btwText, resolveBtwLocale, type BtwLocaleId } from './locales.ts'
import { btwSessionId } from './protocol.ts'

export const name = 'btw'
export const inject = ['commands', 'agents', 'sessionPersistence']

export interface Config {}

export const Config: z<Config> = z.object({})

interface AgentPresetsPort {
  composedPreset(ctx: Context): string | undefined
  composeFrom(agentCtx: Context, parentCtx: Context): string | undefined
}

interface SessionPersistencePort {
  locate(header: SessionHeader): { readonly kind: string; readonly path: string } | undefined
}

interface SessionTitlePort {
  rename(session: Agent['session'], title: string): unknown
}

interface PermissionPresetsPort {
  current(events: readonly SessionEvent[]): string
  set(session: Agent['session'], name: string): void
}

interface ActiveBtw {
  readonly parentId: SessionId
  readonly childId: SessionId
  readonly handle: AgentHandle
  closing: boolean
}

const LOCALE_SETTINGS_NAMESPACE = settingsNamespace('locale')
const CLOSE_DELAY_MS = 100

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function completedContextSeed(
  agent: Agent,
  commandId: CommandInvocation['commandId'],
): readonly SessionEvent[] | undefined {
  const events = agent.session.events
  const commandIndex = events.findIndex(event => event.type === 'command/run'
    && event.data.commandId === commandId)
  const cut = commandIndex < 0 ? events.length : commandIndex
  const prefix = events.slice(0, cut)
  const lastTurnBoundary = prefix.findLast(event => event.type === 'turn/start' || event.type === 'turn/end')
  if (lastTurnBoundary?.type !== 'turn/end') return undefined
  return prefix
}

async function removeOwnedJsonlArtifact(ctx: Context, agent: Agent): Promise<void> {
  const persistence = ctx.get('sessionPersistence') as SessionPersistencePort | undefined
  const location = persistence?.locate(agent.session.header)
  if (location?.kind !== 'jsonl') return
  const artifactName = basename(location.path)
  const ownerDir = dirname(location.path)
  if ((artifactName !== 'session.jsonl' && artifactName !== 'session.jsonl.zstd')
    || basename(ownerDir) !== agent.id) {
    throw new Error(`refusing to remove unexpected session artifact path: ${location.path}`)
  }
  try {
    await unlink(location.path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  try {
    await rmdir(ownerDir)
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error
  }
}

export function apply(ctx: Context, _config: Config): void {
  const activeById = new Map<SessionId, ActiveBtw>()
  const starting = new Set<SessionId>()
  let locale: BtwLocaleId = resolveBtwLocale(ctx.get('settings')?.get(LOCALE_SETTINGS_NAMESPACE))
  const text = (key: Parameters<typeof btwText>[1], params?: Readonly<Record<string, unknown>>) =>
    btwText(locale, key, params)

  const forgetEntry = (entry: ActiveBtw): void => {
    if (activeById.get(entry.parentId) === entry) activeById.delete(entry.parentId)
    if (activeById.get(entry.childId) === entry) activeById.delete(entry.childId)
  }

  const closeEntry = async (entry: ActiveBtw): Promise<void> => {
    if (entry.closing) return
    entry.closing = true
    forgetEntry(entry)
    const child = entry.handle.agent
    try {
      await ctx.sessions.flush(child.session)
    } catch (error: unknown) {
      ctx.logger.warn(`btw: failed to flush temporary session "${entry.childId}": ${errorText(error)}`)
    }
    try {
      await entry.handle.dispose()
      // Persistence retirement starts asynchronously from session/disposed.
      await new Promise<void>(resolve => { setTimeout(resolve, 0) })
      await removeOwnedJsonlArtifact(ctx, child)
    } catch (error: unknown) {
      ctx.logger.warn(`btw: failed to dispose temporary session "${entry.childId}": ${errorText(error)}`)
    }
  }

  ctx.effect(() => async () => {
    await Promise.allSettled([...new Set(activeById.values())].map(closeEntry))
    activeById.clear()
    starting.clear()
  }, 'btw.sessions()')

  ctx.on('agent/disposed', ({ agent }) => {
    const entry = activeById.get(agent.id)
    if (entry === undefined) return
    if (entry.parentId === agent.id) void closeEntry(entry)
    else forgetEntry(entry)
  })

  const handler = async ({ agent, commandId, rawInput, signal }: CommandInvocation) => {
    const activeEntry = activeById.get(agent.id)
    if (activeEntry?.childId === agent.id) {
      return { kind: 'error' as const, text: text('command.error.nested') }
    }
    const seed = completedContextSeed(agent, commandId)
    if (seed === undefined) {
      return { kind: 'error' as const, text: text('command.error.noCompletedTurn') }
    }
    if (activeEntry !== undefined || starting.has(agent.id)) {
      return { kind: 'error' as const, text: text('command.error.duplicate') }
    }

    starting.add(agent.id)
    let handle: AgentHandle | undefined
    try {
      const childId = SessionId(btwSessionId(agent.id, randomUUID()))
      const presets = agent.ctx.get('agentPresets') as AgentPresetsPort | undefined
      const agentPreset = presets?.composedPreset(agent.ctx)
      const permissionPresets = ctx.get('permissionPresets') as PermissionPresetsPort | undefined
      const permissionPreset = permissionPresets?.current(agent.session.events)
      handle = await ctx.agents.create({
        sessionId: childId,
        seed,
        meta: {
          ...(agent.session.header.cwd === undefined ? {} : { cwd: agent.session.header.cwd }),
          ...(agentPreset === undefined ? {} : { agentPreset }),
        },
        agentOptions: { ...agent.options },
        signal,
        setup: async childCtx => {
          presets?.composeFrom(childCtx, agent.ctx)
          const child = childCtx.agent
          if (child !== undefined && permissionPresets !== undefined
            && permissionPreset !== undefined && permissionPreset !== 'custom') {
            permissionPresets.set(child.session, permissionPreset)
          }
          await childCtx.inject(['commands'], commandCtx => {
            commandCtx.commands.register({
              name: 'btw-close',
              description: 'Close the current temporary BTW session.',
              recordInput: false,
              handler: closeHandler,
            })
          })
        },
      })
      const sessionTitle = ctx.get('sessionTitle') as SessionTitlePort | undefined
      sessionTitle?.rename(handle.agent.session, text('thread.title'))
      const entry: ActiveBtw = { parentId: agent.id, childId, handle, closing: false }
      activeById.set(agent.id, entry)
      activeById.set(childId, entry)

      const prompt = rawInput.trim()
      if (prompt !== '') {
        handle.agent.followup(createUserMessage({
          content: [{ type: 'text', text: prompt }],
          source: { kind: 'user' },
        }))
      }
      return { kind: 'success' as const, text: text('command.opened', { id: childId }) }
    } catch (error: unknown) {
      if (handle !== undefined) await handle.dispose().catch(() => undefined)
      return { kind: 'error' as const, text: text('command.error.openFailed', { error: errorText(error) }) }
    } finally {
      starting.delete(agent.id)
    }
  }

  const closeHandler = ({ agent }: CommandInvocation) => {
    const entry = activeById.get(agent.id)
    if (entry?.childId !== agent.id) return { kind: 'error' as const, text: 'Not a live BTW session.' }
    setTimeout(() => { void closeEntry(entry) }, CLOSE_DELAY_MS)
    return { kind: 'success' as const }
  }

  const registerCommands = () => {
    const unregisterBtw = ctx.commands.register({
      name: 'btw',
      description: btwText(locale, 'command.description'),
      input: { hint: btwText(locale, 'command.hint') },
      recordInput: false,
      handler,
    })
    return () => { unregisterBtw() }
  }

  let unregisterCommands = registerCommands()
  ctx.on('settings/updated', (namespace, next) => {
    if (namespace !== LOCALE_SETTINGS_NAMESPACE) return
    const nextLocale = resolveBtwLocale(next)
    if (nextLocale === locale) return
    locale = nextLocale
    unregisterCommands()
    unregisterCommands = registerCommands()
  })
  ctx.effect(() => () => { unregisterCommands() }, 'btw.command()')
}
