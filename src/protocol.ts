import { en, zh } from './locales.ts'

/** Legacy Chinese prefix retained for already-rendered command records. */
export const BTW_OPENED_PREFIX = 'BTW 会话已打开：'

/** Default label retained for compatibility with existing callers. */
export const BTW_LABEL = zh['thread.title']

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
