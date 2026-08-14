/** Runtime copy shared by the Host command and the browser UI. */

/** Locale namespace owned by dsh-btw. */
export const BTW_LOCALE_NS = 'btw'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'command.description': '创建一个临时会话继承当前的上下文，用于临时聊天',
  'command.hint': '给智能体发消息',
  'command.error.nested': '子线程中不能再次创建子线程。',
  'command.error.noCompletedTurn': '主线程至少完成一轮对话后才能使用 /btw。',
  'command.error.duplicate': '当前主线程已经有一个活动子线程；请使用 Ctrl+/ 切换。',
  'command.opened': '子线程已创建：{id}',
  'command.error.openFailed': '无法创建子线程：{error}',
  'thread.main': '主线程',
  'thread.child': '子线程',
  'thread.title': 'btw子线程',
  'thread.current': '当前：{label}',
  'header.backMain': '返回主线程',
  'header.backChild': '返回子线程',
} as const

/** Dictionary key domain. */
export type BtwLocaleKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en: Record<BtwLocaleKey, string> = {
  'command.description': 'Create a temporary session that inherits the current context for a quick side chat',
  'command.hint': 'Message the agent',
  'command.error.nested': 'A side thread cannot create another side thread.',
  'command.error.noCompletedTurn': 'Complete at least one turn in the main thread before using /btw.',
  'command.error.duplicate': 'This main thread already has an active side thread; press Ctrl+/ to switch.',
  'command.opened': 'Side thread created: {id}',
  'command.error.openFailed': 'Could not create the side thread: {error}',
  'thread.main': 'Main thread',
  'thread.child': 'Side thread',
  'thread.title': 'btw side thread',
  'thread.current': 'Current: {label}',
  'header.backMain': 'Back to main thread',
  'header.backChild': 'Back to side thread',
}

/** Locales supported by DeepSeek Harness. */
export type BtwLocaleId = 'zh' | 'en'

/** Resolve and interpolate one Host-side string. */
export function btwText(
  locale: BtwLocaleId,
  key: BtwLocaleKey,
  params?: Readonly<Record<string, unknown>>,
): string {
  const template = (locale === 'en' ? en : zh)[key]
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/gu, (match, name: string) =>
    name in params ? String(params[name]) : match)
}

/** Read the locale preference shape without depending on its schema owner. */
export function resolveBtwLocale(value: unknown): BtwLocaleId {
  if (typeof value !== 'object' || value === null || !('preference' in value)) return 'zh'
  return (value as { preference?: unknown }).preference === 'en' ? 'en' : 'zh'
}
