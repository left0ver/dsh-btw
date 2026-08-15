import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
/** Remember tab-local navigation without creating durable Harness lineage. */
export declare function rememberBtwPair(parentId: SessionId, childId: SessionId): void;
export declare function forgetBtwPair(parentId: SessionId, childId: SessionId): void;
export declare function btwParentOf(childId: SessionId): SessionId | undefined;
export declare function btwChildOf(parentId: SessionId): SessionId | undefined;
/** Rebuild a missing pair from plugin-owned ids without using native lineage. */
export declare function discoverBtwPair(sessionId: SessionId, sessionIds: readonly SessionId[]): void;
/** Test reset. */
export declare function clearBtwPairs(): void;
//# sourceMappingURL=btw-state.d.ts.map