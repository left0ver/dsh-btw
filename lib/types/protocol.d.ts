/** Legacy Chinese prefix retained for already-rendered command records. */
export declare const BTW_OPENED_PREFIX = "BTW \u4F1A\u8BDD\u5DF2\u6253\u5F00\uFF1A";
/** Default label retained for compatibility with existing callers. */
export declare const BTW_LABEL: "btw子线程";
/** Whether a live catalog label belongs to this plugin. */
export declare function isBtwLabel(label: string | undefined): boolean;
/** Parse a branded id from one plugin-owned command outcome. */
export declare function parseOutcomeId(text: string | undefined, prefix: string): string | undefined;
/** Parse both current localized outcomes and the legacy Chinese outcome. */
export declare function parseBtwOpenedOutcome(text: string | undefined): string | undefined;
//# sourceMappingURL=protocol.d.ts.map