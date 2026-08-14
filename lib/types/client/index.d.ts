/** Browser half of the `/btw` plugin. */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import { btwAddress } from './BtwHeaderAction.tsx';
export declare const inject: string[];
interface BtwNavigation {
    refreshSubagents(parentId: SessionId): Promise<void>;
    openSubagent(address: ReturnType<typeof btwAddress>): void;
}
/** Refresh the parent catalog, then open the child through its known durable address. */
export declare function openBtwSide(sessions: BtwNavigation, parentId: SessionId, childId: SessionId): Promise<boolean>;
/** Register header controls and full-page side navigation. */
export declare function apply(ctx: ClientContext): void;
export {};
//# sourceMappingURL=index.d.ts.map