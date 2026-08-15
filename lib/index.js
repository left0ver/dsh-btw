import { randomUUID } from "node:crypto";
import { rmdir, unlink } from "node:fs/promises";
import { basename, dirname } from "node:path";
import z from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { SessionId } from "@deepseek-ai/dsh-session";
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
zh["thread.title"];
const BTW_SESSION_PREFIX = "session-btw-";
/** Build an ordinary top-level session id whose plugin-private shape can restore navigation. */
function btwSessionId(parentId, nonce) {
	return `${BTW_SESSION_PREFIX}${parentId.length}:${parentId}:${nonce}`;
}
zh["thread.title"], en["thread.title"], zh["thread.child"], en["thread.child"];
//#endregion
//#region src/index.ts
/** Host half of the Codex-style `/btw` side-conversation plugin. */
const name = "btw";
const inject = [
	"commands",
	"agents",
	"sessionPersistence"
];
const Config = z.object({});
const LOCALE_SETTINGS_NAMESPACE = settingsNamespace("locale");
const CLOSE_DELAY_MS = 100;
function errorText(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Snapshot everything before this `/btw` command, provided the source is between turns. */
function completedContextSeed(agent, commandId) {
	const events = agent.session.events;
	const commandIndex = events.findIndex((event) => event.type === "command/run" && event.data.commandId === commandId);
	const cut = commandIndex < 0 ? events.length : commandIndex;
	const prefix = events.slice(0, cut);
	if (prefix.findLast((event) => event.type === "turn/start" || event.type === "turn/end")?.type !== "turn/end") return void 0;
	return prefix;
}
async function removeOwnedJsonlArtifact(ctx, agent) {
	const location = ctx.get("sessionPersistence")?.locate(agent.session.header);
	if (location?.kind !== "jsonl") return;
	const artifactName = basename(location.path);
	const ownerDir = dirname(location.path);
	if (artifactName !== "session.jsonl" && artifactName !== "session.jsonl.zstd" || basename(ownerDir) !== agent.id) throw new Error(`refusing to remove unexpected session artifact path: ${location.path}`);
	try {
		await unlink(location.path);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	try {
		await rmdir(ownerDir);
	} catch (error) {
		const code = error.code;
		if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error;
	}
}
/** Register `/btw`, creating parentless AgentHandles rather than subagents. */
function apply(ctx, _config) {
	const activeByParent = /* @__PURE__ */ new Map();
	const activeByChild = /* @__PURE__ */ new Map();
	const starting = /* @__PURE__ */ new Set();
	let locale = resolveBtwLocale(ctx.get("settings")?.get(LOCALE_SETTINGS_NAMESPACE));
	const forgetEntry = (entry) => {
		if (activeByParent.get(entry.parentId) === entry) activeByParent.delete(entry.parentId);
		if (activeByChild.get(entry.childId) === entry) activeByChild.delete(entry.childId);
	};
	const closeEntry = async (entry) => {
		if (entry.closing) return;
		entry.closing = true;
		forgetEntry(entry);
		const child = entry.handle.agent;
		try {
			await ctx.sessions.flush(child.session);
		} catch (error) {
			ctx.logger.warn(`btw: failed to flush temporary session "${entry.childId}": ${errorText(error)}`);
		}
		try {
			await entry.handle.dispose();
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			await removeOwnedJsonlArtifact(ctx, child);
		} catch (error) {
			ctx.logger.warn(`btw: failed to dispose temporary session "${entry.childId}": ${errorText(error)}`);
		}
	};
	const deferClose = (entry) => {
		setTimeout(() => {
			closeEntry(entry);
		}, CLOSE_DELAY_MS);
	};
	ctx.effect(() => async () => {
		await Promise.allSettled([...activeByChild.values()].map(closeEntry));
		activeByParent.clear();
		activeByChild.clear();
		starting.clear();
	}, "btw.sessions()");
	ctx.on("agent/disposed", ({ agent }) => {
		const parentEntry = activeByParent.get(agent.id);
		if (parentEntry !== void 0) {
			closeEntry(parentEntry);
			return;
		}
		const childEntry = activeByChild.get(agent.id);
		if (childEntry !== void 0) forgetEntry(childEntry);
	});
	const handler = async ({ agent, commandId, rawInput, signal }) => {
		const text = (key, params) => btwText(locale, key, params);
		if (activeByChild.has(agent.id)) return {
			kind: "error",
			text: text("command.error.nested")
		};
		const seed = completedContextSeed(agent, commandId);
		if (seed === void 0) return {
			kind: "error",
			text: text("command.error.noCompletedTurn")
		};
		if (activeByParent.has(agent.id) || starting.has(agent.id)) return {
			kind: "error",
			text: text("command.error.duplicate")
		};
		starting.add(agent.id);
		let handle;
		try {
			const childId = SessionId(btwSessionId(agent.id, randomUUID()));
			const presets = agent.ctx.get("agentPresets");
			const agentPreset = presets?.composedPreset(agent.ctx);
			const permissionPresets = ctx.get("permissionPresets");
			const permissionPreset = permissionPresets?.current(agent.session.events);
			handle = await ctx.agents.create({
				sessionId: childId,
				seed,
				meta: {
					...agent.session.header.cwd === void 0 ? {} : { cwd: agent.session.header.cwd },
					...agentPreset === void 0 ? {} : { agentPreset }
				},
				agentOptions: { ...agent.options },
				signal,
				setup: async (childCtx) => {
					presets?.composeFrom(childCtx, agent.ctx);
					const child = childCtx.agent;
					if (child !== void 0 && permissionPresets !== void 0 && permissionPreset !== void 0 && permissionPreset !== "custom") permissionPresets.set(child.session, permissionPreset);
					await childCtx.inject(["commands"], (commandCtx) => {
						commandCtx.commands.register({
							name: "btw-close",
							description: "Close the current temporary BTW session.",
							recordInput: false,
							handler: closeHandler
						});
					});
				}
			});
			ctx.get("sessionTitle")?.rename(handle.agent.session, text("thread.title"));
			const entry = {
				parentId: agent.id,
				childId,
				handle,
				closing: false
			};
			activeByParent.set(agent.id, entry);
			activeByChild.set(childId, entry);
			const prompt = rawInput.trim();
			if (prompt !== "") handle.agent.followup(createUserMessage({
				content: [{
					type: "text",
					text: prompt
				}],
				source: { kind: "user" }
			}));
			return {
				kind: "success",
				text: text("command.opened", { id: childId })
			};
		} catch (error) {
			if (handle !== void 0) await handle.dispose().catch(() => void 0);
			return {
				kind: "error",
				text: text("command.error.openFailed", { error: errorText(error) })
			};
		} finally {
			starting.delete(agent.id);
		}
	};
	const closeHandler = ({ agent }) => {
		const entry = activeByChild.get(agent.id);
		if (entry === void 0) return {
			kind: "error",
			text: "Not a live BTW session."
		};
		deferClose(entry);
		return { kind: "success" };
	};
	const registerCommands = () => {
		const unregisterBtw = ctx.commands.register({
			name: "btw",
			description: btwText(locale, "command.description"),
			input: { hint: btwText(locale, "command.hint") },
			recordInput: false,
			handler
		});
		return () => {
			unregisterBtw();
		};
	};
	let unregisterCommands = registerCommands();
	ctx.on("settings/updated", (namespace, next) => {
		if (namespace !== LOCALE_SETTINGS_NAMESPACE) return;
		const nextLocale = resolveBtwLocale(next);
		if (nextLocale === locale) return;
		locale = nextLocale;
		unregisterCommands();
		unregisterCommands = registerCommands();
	});
	ctx.effect(() => () => {
		unregisterCommands();
	}, "btw.command()");
}
//#endregion
export { Config, apply, completedContextSeed, inject, name };
