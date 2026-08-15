import { useCallback, useEffect, useRef } from 'react'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { parseBtwOpenedOutcome } from '../protocol.ts'
import { BTW_LOCALE_NS } from '../locales.ts'
import { btwNavigation } from './btw-state.ts'
import css from './BtwHeaderAction.module.css'

export interface BtwHeaderInjected {
  openSide: (parentId: SessionId, childId: SessionId) => Promise<boolean>
  openSession: (sessionId: SessionId) => Promise<boolean>
}

export type BtwHeaderActionProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof BTW_LOCALE_NS> & BtwHeaderInjected

interface OpenedBtw {
  readonly seq: number
  readonly childId: SessionId
}

function findLatestOpenedBtw(nodes: ConversationSnapshot['nodes']): OpenedBtw | undefined {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node?.kind !== 'command' || node.name !== 'btw' || node.outcome?.kind !== 'success') continue
    const childId = parseBtwOpenedOutcome(node.outcome.text)
    if (childId !== undefined) return { seq: node.seq, childId: childId as SessionId }
  }
  return undefined
}

function hasOpenModal(): boolean {
  return document.querySelector('[aria-modal="true"], [role="dialog"]') !== null
}

export function BtwHeaderAction({
  sessionId,
  useSession,
  useSessions,
  useInput,
  openSide,
  openSession,
  t,
}: BtwHeaderActionProps) {
  const nodes = useSession(snapshot => snapshot.nodes)
  const sessions = useSessions(state => state)
  const inputDraft = useInput(state => state.draft)
  const inputPhase = useInput(state => state.phase)
  const opened = findLatestOpenedBtw(nodes)
  // A historical command is only transcript. Seeding the ref from the first
  // render prevents a parent remount from reopening the side immediately.
  const handledOpen = useRef<number | undefined>(opened?.seq)
  const pair = btwNavigation.resolve(sessionId, sessions.ids)
  const parentId = pair?.childId === sessionId ? pair.parentId : undefined
  const rememberedChildId = pair?.parentId === sessionId ? pair.childId : undefined
  const candidateChildId = rememberedChildId ?? opened?.childId
  const activeChildId = candidateChildId !== undefined && sessions.byId[candidateChildId] !== undefined
    ? candidateChildId
    : undefined

  const switchThread = useCallback(() => {
    if (parentId !== undefined) {
      void openSession(parentId)
      return
    }
    if (activeChildId !== undefined) void openSide(sessionId, activeChildId)
  }, [activeChildId, openSession, openSide, parentId, sessionId])

  useEffect(() => {
    if (opened === undefined || opened.seq === handledOpen.current) return
    // The command flow node can arrive before the command RPC settles. Opening
    // the child at that point unmounts the parent input shell, aborting the
    // settlement that clears its persisted draft. Wait for that commit first.
    if (inputPhase !== 'plain' || inputDraft !== '') return
    handledOpen.current = opened.seq
    void openSide(sessionId, opened.childId)
  }, [inputDraft, inputPhase, opened, openSide, sessionId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || hasOpenModal()) return
      const ctrlSlash = event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey
        && (event.code === 'Slash' || event.key === '/')
      if (!ctrlSlash || (parentId === undefined && activeChildId === undefined)) return
      event.preventDefault()
      switchThread()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [activeChildId, parentId, switchThread])

  if (parentId === undefined && activeChildId === undefined) return null
  return (
    <button className={css.button} type="button" onClick={switchThread}>
      {t(parentId === undefined ? 'header.backChild' : 'header.backMain')} <span aria-hidden>Ctrl+/</span>
    </button>
  )
}
