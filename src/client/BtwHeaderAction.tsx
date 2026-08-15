import { useCallback, useEffect, useRef } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { parseBtwOpenedOutcome } from '../protocol.ts'
import { BTW_LOCALE_NS } from '../locales.ts'
import { btwChildOf, btwParentOf, discoverBtwPair } from './btw-state.ts'
import css from './BtwHeaderAction.module.css'

/** Registration-owned navigation and lifecycle verbs. */
export interface BtwHeaderInjected {
  openSide: (parentId: SessionId, childId: SessionId) => Promise<boolean>
  openSession: (sessionId: SessionId) => Promise<boolean>
}

/** Full header-action props. */
export type BtwHeaderActionProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof BTW_LOCALE_NS> & BtwHeaderInjected

function isModalOpen(): boolean {
  return document.querySelector('[aria-modal="true"], [role="dialog"]') !== null
}

/** Header controls and keyboard policy for one current main or BTW session. */
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
  const openedNode = nodes.findLast(node => node.kind === 'command'
    && node.name === 'btw'
    && node.outcome?.kind === 'success'
    && parseBtwOpenedOutcome(node.outcome.text) !== undefined)
  const opened = openedNode?.kind === 'command' ? openedNode : undefined
  // A historical command is only transcript. Seeding the ref from the first
  // render prevents a parent remount from reopening the side immediately.
  const handledOpen = useRef<number | undefined>(opened?.seq)
  discoverBtwPair(sessionId, sessions.ids)
  const parentId = btwParentOf(sessionId)
  const isSide = parentId !== undefined
  const outcomeChildId = parseBtwOpenedOutcome(opened?.outcome?.text) as SessionId | undefined
  const candidateChildId = btwChildOf(sessionId) ?? outcomeChildId
  const activeChildId = candidateChildId !== undefined && sessions.byId[candidateChildId] !== undefined
    ? candidateChildId
    : undefined

  const switchSide = useCallback(async () => {
    if (isSide && parentId !== undefined) {
      await openSession(parentId)
      return
    }
    if (activeChildId !== undefined) await openSide(sessionId, activeChildId)
  }, [activeChildId, isSide, openSession, openSide, parentId, sessionId])

  useEffect(() => {
    if (opened?.kind !== 'command' || opened.seq === handledOpen.current) return
    // The command flow node can arrive before the command RPC settles. Opening
    // the child at that point unmounts the parent input shell, aborting the
    // settlement that clears its persisted draft. Wait for that commit first.
    if (inputPhase !== 'plain' || inputDraft !== '') return
    const childId = parseBtwOpenedOutcome(opened.outcome?.text)
    if (childId === undefined) return
    handledOpen.current = opened.seq
    void openSide(sessionId, childId as SessionId)
  }, [inputDraft, inputPhase, opened, openSide, sessionId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || isModalOpen()) return
      const ctrlSlash = event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey
        && (event.code === 'Slash' || event.key === '/')
      if (!ctrlSlash || (!isSide && activeChildId === undefined)) return
      event.preventDefault()
      void switchSide()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [activeChildId, isSide, switchSide])

  if (isSide) {
    return (
      <button className={css.button} type="button" onClick={() => { void switchSide() }}>
        {t('header.backMain')} <span aria-hidden>Ctrl+/</span>
      </button>
    )
  }
  if (activeChildId === undefined) return null
  return (
    <button className={css.button} type="button" onClick={() => { void switchSide() }}>
      {t('header.backChild')} <span aria-hidden>Ctrl+/</span>
    </button>
  )
}
