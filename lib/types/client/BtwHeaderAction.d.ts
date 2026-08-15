import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { BTW_LOCALE_NS } from '../locales.ts';
/** Registration-owned navigation and lifecycle verbs. */
export interface BtwHeaderInjected {
    openSide: (parentId: SessionId, childId: SessionId) => Promise<boolean>;
    openSession: (sessionId: SessionId) => Promise<boolean>;
}
/** Full header-action props. */
export type BtwHeaderActionProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof BTW_LOCALE_NS> & BtwHeaderInjected;
/** Header controls and keyboard policy for one current main or BTW session. */
export declare function BtwHeaderAction({ sessionId, useSession, useSessions, useInput, openSide, openSession, t, }: BtwHeaderActionProps): import("react").JSX.Element | null;
//# sourceMappingURL=BtwHeaderAction.d.ts.map