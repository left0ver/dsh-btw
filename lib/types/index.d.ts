/** Host half of the Codex-style `/btw` side-conversation plugin. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandInvocation } from '@deepseek-ai/dsh-commands';
import { type SessionEvent } from '@deepseek-ai/dsh-session';
export declare const name = "btw";
export declare const inject: string[];
/** Host configuration. */
export interface Config {
}
export declare const Config: z<Config>;
/** Snapshot everything before this `/btw` command, provided the source is between turns. */
export declare function completedContextSeed(agent: Agent, commandId: CommandInvocation['commandId']): readonly SessionEvent[] | undefined;
/** Register `/btw`, creating parentless AgentHandles rather than subagents. */
export declare function apply(ctx: Context, _config: Config): void;
//# sourceMappingURL=index.d.ts.map