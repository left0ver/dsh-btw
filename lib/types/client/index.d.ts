/** Browser half of the `/btw` plugin. */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import { type BtwLocaleKey } from '../locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-btw navigation and thread identity copy. */
        btw: BtwLocaleKey;
    }
}
export declare const inject: string[];
interface BtwNavigation {
    open(id: SessionId): void;
}
/** Remember the local pair, then open the parentless temporary session. */
export declare function openBtwSide(sessions: BtwNavigation, parentId: SessionId, childId: SessionId): Promise<boolean>;
/** Register header controls and full-page side navigation. */
export declare function apply(ctx: ClientContext): void;
export {};
//# sourceMappingURL=index.d.ts.map