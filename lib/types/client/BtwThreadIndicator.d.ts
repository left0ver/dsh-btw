import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
export interface BtwThreadIndicatorProps {
    readonly sessionId: SessionId;
    readonly useSessions: SnapshotSelectorHook<SessionListState>;
}
/** Ambient main/side identity shown at the left edge of the composer stats row. */
export declare function BtwThreadIndicator({ sessionId, useSessions }: BtwThreadIndicatorProps): import("react").JSX.Element | null;
//# sourceMappingURL=BtwThreadIndicator.d.ts.map