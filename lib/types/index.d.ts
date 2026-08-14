/** Host half of the Codex-style `/btw` side-conversation plugin. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "btw";
export declare const inject: string[];
/** Host configuration. */
export interface Config {
    /** Continuable provider used to capture the parent's completed history. */
    provider?: string;
}
export declare const Config: z<Config>;
/** Register `/btw` and own every process-local side handle. */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map