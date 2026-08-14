import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  SessionId,
  SubagentAddress,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  isBtwLabel,
  parseBtwOpenedOutcome,
} from '../protocol.ts'
import { BTW_LOCALE_NS } from '../locales.ts'
import css from './BtwHeaderAction.module.css'

/** Registration-owned navigation and command verbs. */
export interface BtwHeaderInjected {
  open: (id: SessionId) => void
  openSide: (parentId: SessionId, childId: SessionId) => Promise<boolean>
  refreshSubagents: (parentId: SessionId) => Promise<void>
}

/** Full header-action props. */
export type BtwHeaderActionProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof BTW_LOCALE_NS> & BtwHeaderInjected

interface BtwCatalogEntry {
  readonly kind: string
  readonly id: SessionId
  readonly mode?: string
  readonly label?: string
}

function isModalOpen(): boolean {
  return document.querySelector('[aria-modal="true"], [role="dialog"]') !== null
}

/** Header controls and keyboard policy for one current parent or BTW child. */
export function BtwHeaderAction({
  sessionId,
  useSession,
  useSessions,
  open,
  openSide,
  refreshSubagents,
  t,
}: BtwHeaderActionProps) {
  const nodes = useSession(snapshot => snapshot.nodes)
  const summary = useSessions(state => state.byId[sessionId])
  const catalog = useSessions(state => state.subagentsByParent[sessionId])
  const opened = nodes.findLast(node => node.kind === 'command'
    && node.name === 'btw'
    && node.outcome?.kind === 'success'
    && parseBtwOpenedOutcome(node.outcome.text) !== undefined)
  // A historical command is only transcript. Seeding the ref from the first
  // render prevents a parent remount (after switching back) from reopening
  // the side immediately. A command that settles after mount still advances
  // the sequence and triggers the effect below.
  const handledOpen = useRef<number | undefined>(opened?.seq)
  const parentId = summary?.parentId
  const isSide = parentId !== undefined && isBtwLabel(summary?.displayTitle)
  const catalogEntries = (catalog as { entries?: readonly BtwCatalogEntry[] } | undefined)?.entries
  const activeChild = useMemo(() => catalogEntries?.find(entry =>
    entry.kind === 'child'
      && entry.mode === 'continuable'
      && isBtwLabel(entry.label)), [catalogEntries])
  const localizedChildLabel = t('thread.title')

  // The Host owns the native breadcrumb title through the subagent catalog.
  // After a locale change, pull the relabeled catalog so the breadcrumb and
  // plugin-owned controls switch languages together.
  useEffect(() => {
    const staleParent = isSide && parentId !== undefined
      ? summary?.displayTitle === localizedChildLabel ? undefined : parentId
      : activeChild?.label === localizedChildLabel ? undefined : sessionId
    if (staleParent !== undefined && (isSide || activeChild !== undefined)) {
      void refreshSubagents(staleParent)
    }
  }, [
    activeChild,
    isSide,
    localizedChildLabel,
    parentId,
    refreshSubagents,
    sessionId,
    summary?.displayTitle,
  ])

  const switchSide = useCallback(async () => {
    if (isSide && parentId !== undefined) {
      open(parentId)
      return
    }
    if (activeChild?.kind === 'child') {
      await openSide(sessionId, activeChild.id)
    }
  }, [activeChild, isSide, open, openSide, parentId, sessionId])

  useEffect(() => {
    if (opened?.kind !== 'command' || opened.seq === handledOpen.current) return
    const childId = parseBtwOpenedOutcome(opened.outcome?.text)
    if (childId === undefined) return
    handledOpen.current = opened.seq
    void openSide(sessionId, childId as SessionId)
  }, [opened, openSide, sessionId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || isModalOpen()) return
      const ctrlSlash = event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey
        && (event.code === 'Slash' || event.key === '/')
      if (ctrlSlash) {
        if (!isSide && activeChild === undefined) return
        event.preventDefault()
        void switchSide()
        return
      }
    }
    // Capture before the native composer interprets the chord. This is a
    // global session-navigation shortcut, so it must work while its textarea
    // owns focus without turning the current draft into a submission.
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [activeChild, isSide, switchSide])

  if (isSide && parentId !== undefined) {
    return (
      <button className={css.button} type="button" onClick={() => { open(parentId) }}>
        {t('header.backMain')} <span aria-hidden>Ctrl+/</span>
      </button>
    )
  }

  if (activeChild?.kind !== 'child') return null
  return (
    <button className={css.button} type="button" onClick={() => { void switchSide() }}>
      {t('header.backChild')} <span aria-hidden>Ctrl+/</span>
    </button>
  )
}

/** Build the exact address used by existing subagent navigation. */
export function btwAddress(parentSessionId: SessionId, childSessionId: SessionId): SubagentAddress {
  return { parentSessionId, childSessionId, mode: 'continuable' }
}
