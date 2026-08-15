import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { parseBtwParentId } from '../protocol.ts'

interface BtwPair {
  readonly parentId: SessionId
  readonly childId: SessionId
}

const STORAGE_KEY = 'dsh-btw:pairs:v1'

class BtwNavigationState {
  readonly #parentByChild = new Map<SessionId, SessionId>()
  readonly #childByParent = new Map<SessionId, SessionId>()
  #loadedStorageValue: string | null | undefined

  remember(parentId: SessionId, childId: SessionId): void {
    this.#restore()
    this.#set({ parentId, childId })
    this.#persist()
  }

  forget(parentId: SessionId, childId: SessionId): void {
    this.#restore()
    if (this.#parentByChild.get(childId) === parentId) this.#parentByChild.delete(childId)
    if (this.#childByParent.get(parentId) === childId) this.#childByParent.delete(parentId)
    this.#persist()
  }

  resolve(sessionId: SessionId, sessionIds: readonly SessionId[]): BtwPair | undefined {
    this.#restore()
    const existing = this.#find(sessionId)
    if (existing !== undefined) return existing
    this.#discover(sessionId, sessionIds)
    return this.#find(sessionId)
  }

  clear(): void {
    this.#parentByChild.clear()
    this.#childByParent.clear()
    try {
      this.#storage()?.removeItem(STORAGE_KEY)
    } catch {
      // In-memory navigation is already reset when browser storage is unavailable.
    }
    this.#loadedStorageValue = null
  }

  #find(sessionId: SessionId): BtwPair | undefined {
    const parentId = this.#parentByChild.get(sessionId)
    if (parentId !== undefined) return { parentId, childId: sessionId }
    const childId = this.#childByParent.get(sessionId)
    return childId === undefined ? undefined : { parentId: sessionId, childId }
  }

  #discover(sessionId: SessionId, sessionIds: readonly SessionId[]): void {
    const knownIds = new Set(sessionIds)
    const encodedParent = parseBtwParentId(sessionId) as SessionId | undefined
    if (encodedParent !== undefined && knownIds.has(encodedParent)) {
      this.#set({ parentId: encodedParent, childId: sessionId })
      this.#persist()
      return
    }
    const childId = sessionIds.find(id => parseBtwParentId(id) === sessionId)
    if (childId === undefined) return
    this.#set({ parentId: sessionId, childId })
    this.#persist()
  }

  #set({ parentId, childId }: BtwPair): void {
    const previousChild = this.#childByParent.get(parentId)
    if (previousChild !== undefined) this.#parentByChild.delete(previousChild)
    const previousParent = this.#parentByChild.get(childId)
    if (previousParent !== undefined) this.#childByParent.delete(previousParent)
    this.#parentByChild.set(childId, parentId)
    this.#childByParent.set(parentId, childId)
  }

  #restore(): void {
    const storage = this.#storage()
    if (storage === undefined) return
    let value: string | null
    try {
      value = storage.getItem(STORAGE_KEY)
    } catch {
      return
    }
    if (value === this.#loadedStorageValue) return
    this.#loadedStorageValue = value
    this.#parentByChild.clear()
    this.#childByParent.clear()
    if (value === null) return
    try {
      const pairs: unknown = JSON.parse(value)
      if (!Array.isArray(pairs)) return
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length !== 2) continue
        const [parentId, childId] = pair
        if (typeof parentId !== 'string' || typeof childId !== 'string') continue
        if (parentId === '' || childId === '') continue
        this.#set({ parentId: parentId as SessionId, childId: childId as SessionId })
      }
    } catch {
      // Corrupt tab-local metadata must not affect host-side session lineage.
    }
  }

  #persist(): void {
    const storage = this.#storage()
    if (storage === undefined) return
    const value = JSON.stringify([...this.#childByParent.entries()])
    try {
      storage.setItem(STORAGE_KEY, value)
      this.#loadedStorageValue = value
    } catch {
      // Navigation remains available in memory.
    }
  }

  #storage(): Storage | undefined {
    try {
      return globalThis.sessionStorage
    } catch {
      return undefined
    }
  }
}

export const btwNavigation = new BtwNavigationState()
