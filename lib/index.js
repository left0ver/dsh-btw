import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/locales.ts
/** Simplified Chinese dictionary (the key-set source of truth). */
const zh = {
	"command.description": "创建一个临时会话继承当前的上下文，用于临时聊天",
	"command.hint": "给智能体发消息",
	"command.error.nested": "子线程中不能再次创建子线程。",
	"command.error.noCompletedTurn": "主线程至少完成一轮对话后才能使用 /btw。",
	"command.error.duplicate": "当前主线程已经有一个活动子线程；请使用 Ctrl+/ 切换。",
	"command.opened": "子线程已创建：{id}",
	"command.error.openFailed": "无法创建子线程：{error}",
	"thread.main": "主线程",
	"thread.child": "子线程",
	"thread.title": "btw子线程",
	"thread.current": "当前：{label}",
	"header.backMain": "返回主线程",
	"header.backChild": "返回子线程"
};
/** English dictionary, checked against the Chinese key set. */
const en = {
	"command.description": "Create a temporary session that inherits the current context for a quick side chat",
	"command.hint": "Message the agent",
	"command.error.nested": "A side thread cannot create another side thread.",
	"command.error.noCompletedTurn": "Complete at least one turn in the main thread before using /btw.",
	"command.error.duplicate": "This main thread already has an active side thread; press Ctrl+/ to switch.",
	"command.opened": "Side thread created: {id}",
	"command.error.openFailed": "Could not create the side thread: {error}",
	"thread.main": "Main thread",
	"thread.child": "Side thread",
	"thread.title": "btw side thread",
	"thread.current": "Current: {label}",
	"header.backMain": "Back to main thread",
	"header.backChild": "Back to side thread"
};
/** Resolve and interpolate one Host-side string. */
function btwText(locale, key, params) {
	const template = (locale === "en" ? en : zh)[key];
	if (params === void 0) return template;
	return template.replace(/\{(\w+)\}/gu, (match, name) => name in params ? String(params[name]) : match);
}
/** Read the locale preference shape without depending on its schema owner. */
function resolveBtwLocale(value) {
	if (typeof value !== "object" || value === null || !("preference" in value)) return "zh";
	return value.preference === "en" ? "en" : "zh";
}
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
const LOCALE_SETTINGS_NAMESPACE = settingsNamespace("locale");
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
	let locale = resolveBtwLocale(ctx.get("settings")?.get(LOCALE_SETTINGS_NAMESPACE));
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
	const handler = async ({ agent, rawInput, signal }) => {
		const text = (key, params) => btwText(locale, key, params);
		if (activeByChild.get(agent.id) !== void 0) return {
			kind: "error",
			text: text("command.error.nested")
		};
		if (!agent.session.events.some((event) => event.type === "turn/end")) return {
			kind: "error",
			text: text("command.error.noCompletedTurn")
		};
		if (activeByParent.has(agent.id) || starting.has(agent.id)) return {
			kind: "error",
			text: text("command.error.duplicate")
		};
		starting.add(agent.id);
		try {
			const tools = agent.ctx.get("tools");
			const deniedTools = SUBAGENT_TOOL_NAMES.filter((tool) => tools?.get(tool, agent) !== void 0);
			const prompt = rawInput.trim();
			const handle = await subagents.startEphemeralContinuable({
				provider: config.provider ?? "fork",
				label: text("thread.title"),
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
				text: text("command.opened", { id: handle.childId })
			};
		} catch (error) {
			return {
				kind: "error",
				text: text("command.error.openFailed", { error: errorText(error) })
			};
		} finally {
			starting.delete(agent.id);
		}
	};
	const registerCommand = () => ctx.commands.register({
		name: "btw",
		description: btwText(locale, "command.description"),
		input: { hint: btwText(locale, "command.hint") },
		recordInput: false,
		handler
	});
	let unregisterCommand = registerCommand();
	ctx.on("settings/updated", (namespace, next) => {
		if (namespace !== LOCALE_SETTINGS_NAMESPACE) return;
		const nextLocale = resolveBtwLocale(next);
		if (nextLocale === locale) return;
		locale = nextLocale;
		const childLabel = btwText(locale, "thread.title");
		for (const entry of activeByParent.values()) entry.handle.relabel(childLabel);
		unregisterCommand();
		unregisterCommand = registerCommand();
	});
	ctx.effect(() => () => {
		unregisterCommand();
	}, "btw.command()");
}
//#endregion
export { Config, apply, inject, name };
