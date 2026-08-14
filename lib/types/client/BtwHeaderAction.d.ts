import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { BTW_LOCALE_NS } from '../locales.ts';
/** Registration-owned navigation and command verbs. */
export interface BtwHeaderInjected {
    open: (id: SessionId) => void;
    openSide: (parentId: SessionId, childId: SessionId) => Promise<boolean>;
    refreshSubagents: (parentId: SessionId) => Promise<void>;
}
/** Full header-action props. */
export type BtwHeaderActionProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof BTW_LOCALE_NS> & BtwHeaderInjected;
/** Header controls and keyboard policy for one current parent or BTW child. */
export declare function BtwHeaderAction({ sessionId, useSession, useSessions, open, openSide, refreshSubagents, t, }: BtwHeaderActionProps): import("react").JSX.Element | null;
/** Build the exact address used by existing subagent navigation. */
export declare function btwAddress(parentSessionId: SessionId, childSessionId: SessionId): SubagentAddress;
//# sourceMappingURL=BtwHeaderAction.d.ts.map