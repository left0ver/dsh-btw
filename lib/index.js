import z from "@deepseek-ai/schemastery";
//#region src/protocol.ts
/** Prefix for a successful open result. */
const BTW_OPENED_PREFIX = "BTW 会话已打开：";
/** Stable label identifying this plugin's live catalog child. */
const BTW_LABEL = "子线程";
//#endregion
//#region src/index.ts
const name = "btw";
const inject = ["commands", "subagents"];
const Config = z.object({ provider: z.string().default("fork") });
const SIDE_INSTRUCTIONS = [
	"You are in a temporary side conversation opened with /btw.",
	"Treat the inherited parent conversation as reference-only background. Do not continue its active task unless the user explicitly asks.",
	"Answer the side conversation directly and keep its messages independent from the parent conversation.",
	"Do not create or message subagents from this side conversation.",
	"Do not modify files, run commands with side effects, or change external state unless the user explicitly requests that action in this side conversation."
].join(" ");
const SUBAGENT_TOOL_NAMES = [
	"subagent",
	"subagent_fork",
	"send_message",
	"list_agents"
];
function errorText(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Register `/btw` and own every process-local side handle. */
function apply(ctx, config) {
	const subagents = ctx.get("subagents");
	if (subagents === void 0) throw new Error("dsh-btw requires the subagents service");
	if (typeof subagents.startEphemeralContinuable !== "function") throw new Error("dsh-btw requires an rc.6 host build containing subagents.startEphemeralContinuable; rebuild and restart DeepSeek Harness");
	const activeByParent = /* @__PURE__ */ new Map();
	const activeByChild = /* @__PURE__ */ new Map();
	const starting = /* @__PURE__ */ new Set();
	const disposeEntry = async (entry) => {
		if (activeByParent.get(entry.parent.id) !== entry) return;
		await entry.handle.dispose();
		if (activeByParent.get(entry.parent.id) === entry) activeByParent.delete(entry.parent.id);
		if (activeByChild.get(entry.handle.childId) === entry) activeByChild.delete(entry.handle.childId);
	};
	ctx.effect(() => async () => {
		const failures = (await Promise.allSettled([...activeByParent.values()].map(disposeEntry))).flatMap((result) => result.status === "rejected" ? [result.reason] : []);
		if (failures.length > 0) throw new AggregateError(failures, "failed to dispose BTW side conversations");
	}, "btw.handles()");
	ctx.on("agent/disposed", ({ agent }) => {
		const entry = activeByParent.get(agent.id);
		if (entry !== void 0) disposeEntry(entry).catch((error) => {
			ctx.logger.warn(`btw: parent cleanup failed: ${errorText(error)}`);
		});
	});
	ctx.commands.register({
		name: "btw",
		description: "创建一个临时会话继承当前的上下文，用于临时聊天",
		input: { hint: "给智能体发消息" },
		recordInput: false,
		async handler({ agent, rawInput, signal }) {
			if (activeByChild.get(agent.id) !== void 0) return {
				kind: "error",
				text: "BTW 侧会话中不能再次打开 BTW 会话。"
			};
			if (!agent.session.events.some((event) => event.type === "turn/end")) return {
				kind: "error",
				text: "主会话至少完成一轮对话后才能使用 /btw。"
			};
			if (activeByParent.has(agent.id) || starting.has(agent.id)) return {
				kind: "error",
				text: "当前主会话已经有一个 BTW 侧会话；请使用 Ctrl+/ 切换。"
			};
			starting.add(agent.id);
			try {
				const tools = agent.ctx.get("tools");
				const deniedTools = SUBAGENT_TOOL_NAMES.filter((tool) => tools?.get(tool, agent) !== void 0);
				const prompt = rawInput.trim();
				const handle = await subagents.startEphemeralContinuable({
					provider: config.provider ?? "fork",
					label: BTW_LABEL,
					request: {
						parent: agent,
						...prompt === "" ? {} : { prompt: [{
							type: "text",
							text: prompt
						}] },
						...deniedTools.length === 0 ? {} : { toolFilter: { deny: deniedTools } }
					},
					instructions: SIDE_INSTRUCTIONS,
					signal
				});
				const entry = {
					parent: agent,
					handle
				};
				activeByParent.set(agent.id, entry);
				activeByChild.set(handle.childId, entry);
				return {
					kind: "success",
					text: `${BTW_OPENED_PREFIX}${handle.childId}`
				};
			} catch (error) {
				return {
					kind: "error",
					text: `无法打开 BTW 会话：${errorText(error)}`
				};
			} finally {
				starting.delete(agent.id);
			}
		}
	});
}
//#endregion
export { Config, apply, inject, name };
