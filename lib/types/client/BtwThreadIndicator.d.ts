import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import { BTW_LOCALE_NS } from '../locales.ts';
export interface BtwThreadIndicatorProps {
    readonly sessionId: SessionId;
    readonly useSessions: SnapshotSelectorHook<SessionListState>;
    readonly t: PropsLocale<typeof BTW_LOCALE_NS>['t'];
}
/** Ambient main/side identity shown at the left edge of the composer stats row. */
export declare function BtwThreadIndicator({ sessionId, useSessions, t }: BtwThreadIndicatorProps): import("react").JSX.Element | null;
//# sourceMappingURL=BtwThreadIndicator.d.ts.map