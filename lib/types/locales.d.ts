/** Runtime copy shared by the Host command and the browser UI. */
/** Locale namespace owned by dsh-btw. */
export declare const BTW_LOCALE_NS = "btw";
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    readonly 'command.description': "创建一个临时会话继承当前的上下文，用于临时聊天";
    readonly 'command.hint': "给智能体发消息";
    readonly 'command.error.nested': "子线程中不能再次创建子线程。";
    readonly 'command.error.noCompletedTurn': "主线程至少完成一轮对话后才能使用 /btw。";
    readonly 'command.error.duplicate': "当前主线程已经有一个活动子线程；请使用 Ctrl+/ 切换。";
    readonly 'command.opened': "子线程已创建：{id}";
    readonly 'command.error.openFailed': "无法创建子线程：{error}";
    readonly 'thread.main': "主线程";
    readonly 'thread.child': "子线程";
    readonly 'thread.title': "btw子线程";
    readonly 'thread.current': "当前：{label}";
    readonly 'header.backMain': "返回主线程";
    readonly 'header.backChild': "返回子线程";
};
/** Dictionary key domain. */
export type BtwLocaleKey = keyof typeof zh;
/** English dictionary, checked against the Chinese key set. */
export declare const en: Record<BtwLocaleKey, string>;
/** Locales supported by DeepSeek Harness. */
export type BtwLocaleId = 'zh' | 'en';
/** Resolve and interpolate one Host-side string. */
export declare function btwText(locale: BtwLocaleId, key: BtwLocaleKey, params?: Readonly<Record<string, unknown>>): string;
/** Read the locale preference shape without depending on its schema owner. */
export declare function resolveBtwLocale(value: unknown): BtwLocaleId;
//# sourceMappingURL=locales.d.ts.map