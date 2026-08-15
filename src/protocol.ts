import { en, zh } from './locales.ts'

/** Legacy Chinese prefix retained for already-rendered command records. */
export const BTW_OPENED_PREFIX = 'BTW 会话已打开：'

/** Default label retained for compatibility with existing callers. */
export const BTW_LABEL = zh['thread.title']

const BTW_SESSION_PREFIX = 'session-btw-'

/** Build an ordinary top-level session id whose plugin-private shape can restore navigation. */
export function btwSessionId(parentId: string, nonce: string): string {
  return `${BTW_SESSION_PREFIX}${parentId.length}:${parentId}:${nonce}`
}

/** Recover only dsh-btw navigation metadata; this is not Harness session lineage. */
export function parseBtwParentId(sessionId: string): string | undefined {
  if (!sessionId.startsWith(BTW_SESSION_PREFIX)) return undefined
  const encoded = sessionId.slice(BTW_SESSION_PREFIX.length)
  const lengthEnd = encoded.indexOf(':')
  if (lengthEnd <= 0) return undefined
  const lengthText = encoded.slice(0, lengthEnd)
  if (!/^\d+$/u.test(lengthText)) return undefined
  const parentLength = Number(lengthText)
  if (!Number.isSafeInteger(parentLength) || parentLength < 1) return undefined
  const parentStart = lengthEnd + 1
  const parentEnd = parentStart + parentLength
  if (encoded[parentEnd] !== ':') return undefined
  const parentId = encoded.slice(parentStart, parentEnd)
  const nonce = encoded.slice(parentEnd + 1)
  return parentId === '' || nonce === '' ? undefined : parentId
}

/** Every localized label that identifies a dsh-btw child. */
const BTW_LABELS = new Set([
  zh['thread.title'],
  en['thread.title'],
  // Recognize children created before the dedicated breadcrumb title existed.
  zh['thread.child'],
  en['thread.child'],
])

/** Whether a live catalog label belongs to this plugin. */
export function isBtwLabel(label: string | undefined): boolean {
  return label !== undefined && BTW_LABELS.has(label)
}

/** Parse a branded id from one plugin-owned command outcome. */
export function parseOutcomeId(text: string | undefined, prefix: string): string | undefined {
  if (text === undefined || !text.startsWith(prefix)) return undefined
  const id = text.slice(prefix.length).trim()
  return id === '' ? undefined : id
}

/** Parse both current localized outcomes and the legacy Chinese outcome. */
export function parseBtwOpenedOutcome(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const prefixes = [
    zh['command.opened'].split('{id}')[0] ?? '',
    en['command.opened'].split('{id}')[0] ?? '',
    BTW_OPENED_PREFIX,
  ]
  for (const prefix of prefixes) {
    const id = parseOutcomeId(text, prefix)
    if (id !== undefined) return id
  }
  return undefined
}
