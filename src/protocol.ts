/** Prefix for a successful open result. */
export const BTW_OPENED_PREFIX = 'BTW 会话已打开：'

/** Stable label identifying this plugin's live catalog child. */
export const BTW_LABEL = '子线程'

/** Parse a branded id from one plugin-owned command outcome. */
export function parseOutcomeId(text: string | undefined, prefix: string): string | undefined {
  if (text === undefined || !text.startsWith(prefix)) return undefined
  const id = text.slice(prefix.length).trim()
  return id === '' ? undefined : id
}
