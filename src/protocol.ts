import { en, zh } from './locales.ts'

const BTW_SESSION_PREFIX = 'session-btw-'
const LEGACY_OPENED_PREFIX = 'BTW 会话已打开：'

function outcomePrefix(template: string): string {
  const placeholder = template.indexOf('{id}')
  return placeholder < 0 ? template : template.slice(0, placeholder)
}

const OPENED_PREFIXES = [
  outcomePrefix(zh['command.opened']),
  outcomePrefix(en['command.opened']),
  LEGACY_OPENED_PREFIX,
]

export function btwSessionId(parentId: string, nonce: string): string {
  return `${BTW_SESSION_PREFIX}${parentId.length}:${parentId}:${nonce}`
}

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

function parseOutcomeId(text: string, prefix: string): string | undefined {
  if (!text.startsWith(prefix)) return undefined
  const id = text.slice(prefix.length).trim()
  return id === '' ? undefined : id
}

export function parseBtwOpenedOutcome(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  for (const prefix of OPENED_PREFIXES) {
    const id = parseOutcomeId(text, prefix)
    if (id !== undefined) return id
  }
  return undefined
}
