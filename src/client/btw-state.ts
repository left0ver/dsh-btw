import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { parseBtwParentId } from '../protocol.ts'

const parentByChild = new Map<SessionId, SessionId>()
const childByParent = new Map<SessionId, SessionId>()
const STORAGE_KEY = 'dsh-btw:pairs:v1'
let loadedStorageValue: string | null | undefined

function browserSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

function setPair(parentId: SessionId, childId: SessionId): void {
  const previousChild = childByParent.get(parentId)
  if (previousChild !== undefined) parentByChild.delete(previousChild)
  const previousParent = parentByChild.get(childId)
  if (previousParent !== undefined) childByParent.delete(previousParent)
  parentByChild.set(childId, parentId)
  childByParent.set(parentId, childId)
}

/** Reload tab-local navigation metadata after a refresh or client HMR. */
function restoreBtwPairs(): void {
  const storage = browserSessionStorage()
  if (storage === undefined) return
  let value: string | null
  try {
    value = storage.getItem(STORAGE_KEY)
  } catch {
    return
  }
  if (value === loadedStorageValue) return
  loadedStorageValue = value
  parentByChild.clear()
  childByParent.clear()
  if (value === null) return
  try {
    const pairs: unknown = JSON.parse(value)
    if (!Array.isArray(pairs)) return
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) continue
      const [parentId, childId] = pair
      if (typeof parentId !== 'string' || typeof childId !== 'string') continue
      if (parentId.length === 0 || childId.length === 0) continue
      setPair(parentId as SessionId, childId as SessionId)
    }
  } catch {
    // Ignore corrupt tab-local metadata; it never defines host-side lineage.
  }
}

function persistBtwPairs(): void {
  const storage = browserSessionStorage()
  if (storage === undefined) return
  const value = JSON.stringify([...childByParent.entries()])
  try {
    storage.setItem(STORAGE_KEY, value)
    loadedStorageValue = value
  } catch {
    // Navigation still works in memory when browser storage is unavailable.
  }
}

/** Remember tab-local navigation without creating durable Harness lineage. */
export function rememberBtwPair(parentId: SessionId, childId: SessionId): void {
  restoreBtwPairs()
  setPair(parentId, childId)
  persistBtwPairs()
}

export function forgetBtwPair(parentId: SessionId, childId: SessionId): void {
  restoreBtwPairs()
  if (parentByChild.get(childId) === parentId) parentByChild.delete(childId)
  if (childByParent.get(parentId) === childId) childByParent.delete(parentId)
  persistBtwPairs()
}

export function btwParentOf(childId: SessionId): SessionId | undefined {
  restoreBtwPairs()
  return parentByChild.get(childId)
}

export function btwChildOf(parentId: SessionId): SessionId | undefined {
  restoreBtwPairs()
  return childByParent.get(parentId)
}

/** Rebuild a missing pair from plugin-owned ids without using native lineage. */
export function discoverBtwPair(sessionId: SessionId, sessionIds: readonly SessionId[]): void {
  restoreBtwPairs()
  if (parentByChild.has(sessionId) || childByParent.has(sessionId)) return
  const known = new Set(sessionIds)
  const encodedParent = parseBtwParentId(sessionId) as SessionId | undefined
  if (encodedParent !== undefined && known.has(encodedParent)) {
    setPair(encodedParent, sessionId)
    persistBtwPairs()
    return
  }
  for (const possibleChild of sessionIds) {
    if (parseBtwParentId(possibleChild) !== sessionId) continue
    setPair(sessionId, possibleChild)
    persistBtwPairs()
    return
  }
}

/** Test reset. */
export function clearBtwPairs(): void {
  parentByChild.clear()
  childByParent.clear()
  const storage = browserSessionStorage()
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing else to reset when browser storage is unavailable.
  }
  loadedStorageValue = null
}
