window.__ModuleLoader__.load({
	id: "dsh-btw",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#endregion
		//#region src/protocol.ts
		/** Legacy Chinese prefix retained for already-rendered command records. */
		const BTW_OPENED_PREFIX = "BTW 会话已打开：";
		zh["thread.title"];
		const BTW_SESSION_PREFIX = "session-btw-";
		/** Recover only dsh-btw navigation metadata; this is not Harness session lineage. */
		function parseBtwParentId(sessionId) {
			if (!sessionId.startsWith(BTW_SESSION_PREFIX)) return void 0;
			const encoded = sessionId.slice(12);
			const lengthEnd = encoded.indexOf(":");
			if (lengthEnd <= 0) return void 0;
			const lengthText = encoded.slice(0, lengthEnd);
			if (!/^\d+$/u.test(lengthText)) return void 0;
			const parentLength = Number(lengthText);
			if (!Number.isSafeInteger(parentLength) || parentLength < 1) return void 0;
			const parentStart = lengthEnd + 1;
			const parentEnd = parentStart + parentLength;
			if (encoded[parentEnd] !== ":") return void 0;
			const parentId = encoded.slice(parentStart, parentEnd);
			const nonce = encoded.slice(parentEnd + 1);
			return parentId === "" || nonce === "" ? void 0 : parentId;
		}
		zh["thread.title"], en["thread.title"], zh["thread.child"], en["thread.child"];
		/** Parse a branded id from one plugin-owned command outcome. */
		function parseOutcomeId(text, prefix) {
			if (text === void 0 || !text.startsWith(prefix)) return void 0;
			const id = text.slice(prefix.length).trim();
			return id === "" ? void 0 : id;
		}
		/** Parse both current localized outcomes and the legacy Chinese outcome. */
		function parseBtwOpenedOutcome(text) {
			if (text === void 0) return void 0;
			const prefixes = [
				zh["command.opened"].split("{id}")[0] ?? "",
				en["command.opened"].split("{id}")[0] ?? "",
				BTW_OPENED_PREFIX
			];
			for (const prefix of prefixes) {
				const id = parseOutcomeId(text, prefix);
				if (id !== void 0) return id;
			}
		}
		//#endregion
		//#region src/client/btw-state.ts
		const parentByChild = /* @__PURE__ */ new Map();
		const childByParent = /* @__PURE__ */ new Map();
		const STORAGE_KEY = "dsh-btw:pairs:v1";
		let loadedStorageValue;
		function browserSessionStorage() {
			try {
				return globalThis.sessionStorage;
			} catch {
				return;
			}
		}
		function setPair(parentId, childId) {
			const previousChild = childByParent.get(parentId);
			if (previousChild !== void 0) parentByChild.delete(previousChild);
			const previousParent = parentByChild.get(childId);
			if (previousParent !== void 0) childByParent.delete(previousParent);
			parentByChild.set(childId, parentId);
			childByParent.set(parentId, childId);
		}
		/** Reload tab-local navigation metadata after a refresh or client HMR. */
		function restoreBtwPairs() {
			const storage = browserSessionStorage();
			if (storage === void 0) return;
			let value;
			try {
				value = storage.getItem(STORAGE_KEY);
			} catch {
				return;
			}
			if (value === loadedStorageValue) return;
			loadedStorageValue = value;
			parentByChild.clear();
			childByParent.clear();
			if (value === null) return;
			try {
				const pairs = JSON.parse(value);
				if (!Array.isArray(pairs)) return;
				for (const pair of pairs) {
					if (!Array.isArray(pair) || pair.length !== 2) continue;
					const [parentId, childId] = pair;
					if (typeof parentId !== "string" || typeof childId !== "string") continue;
					if (parentId.length === 0 || childId.length === 0) continue;
					setPair(parentId, childId);
				}
			} catch {}
		}
		function persistBtwPairs() {
			const storage = browserSessionStorage();
			if (storage === void 0) return;
			const value = JSON.stringify([...childByParent.entries()]);
			try {
				storage.setItem(STORAGE_KEY, value);
				loadedStorageValue = value;
			} catch {}
		}
		/** Remember tab-local navigation without creating durable Harness lineage. */
		function rememberBtwPair(parentId, childId) {
			restoreBtwPairs();
			setPair(parentId, childId);
			persistBtwPairs();
		}
		function forgetBtwPair(parentId, childId) {
			restoreBtwPairs();
			if (parentByChild.get(childId) === parentId) parentByChild.delete(childId);
			if (childByParent.get(parentId) === childId) childByParent.delete(parentId);
			persistBtwPairs();
		}
		function btwParentOf(childId) {
			restoreBtwPairs();
			return parentByChild.get(childId);
		}
		function btwChildOf(parentId) {
			restoreBtwPairs();
			return childByParent.get(parentId);
		}
		/** Rebuild a missing pair from plugin-owned ids without using native lineage. */
		function discoverBtwPair(sessionId, sessionIds) {
			restoreBtwPairs();
			if (parentByChild.has(sessionId) || childByParent.has(sessionId)) return;
			const known = new Set(sessionIds);
			const encodedParent = parseBtwParentId(sessionId);
			if (encodedParent !== void 0 && known.has(encodedParent)) {
				setPair(encodedParent, sessionId);
				persistBtwPairs();
				return;
			}
			for (const possibleChild of sessionIds) {
				if (parseBtwParentId(possibleChild) !== sessionId) continue;
				setPair(sessionId, possibleChild);
				persistBtwPairs();
				return;
			}
		}
		//#endregion
		//#region \0dsh-btw-css:/Users/leftover/Desktop/projects/dsh-btw/src/client/BtwHeaderAction.module.css.mjs
		const css$1 = ".HbBFWq_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-container,Canvas);min-height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;border-radius:7px;padding:0 9px;font-size:12px}.HbBFWq_button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.HbBFWq_button:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-border-l3);outline:none}.HbBFWq_button:disabled{cursor:default;opacity:.55}";
		const styleId$1 = "dsh-btw/BtwHeaderAction.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(styleId$1) + "]") === null) {
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-btw";
			style.dataset.pluginCss = styleId$1;
			style.textContent = css$1;
			document.head.appendChild(style);
		}
		var BtwHeaderAction_module_css_default = { "button": "HbBFWq_button" };
		//#endregion
		//#region src/client/BtwHeaderAction.tsx
		function isModalOpen() {
			return document.querySelector("[aria-modal=\"true\"], [role=\"dialog\"]") !== null;
		}
		/** Header controls and keyboard policy for one current main or BTW session. */
		function BtwHeaderAction({ sessionId, useSession, useSessions, useInput, openSide, openSession, t }) {
			const nodes = useSession((snapshot) => snapshot.nodes);
			const sessions = useSessions((state) => state);
			const inputDraft = useInput((state) => state.draft);
			const inputPhase = useInput((state) => state.phase);
			const openedNode = nodes.findLast((node) => node.kind === "command" && node.name === "btw" && node.outcome?.kind === "success" && parseBtwOpenedOutcome(node.outcome.text) !== void 0);
			const opened = openedNode?.kind === "command" ? openedNode : void 0;
			const handledOpen = (0, react.useRef)(opened?.seq);
			discoverBtwPair(sessionId, sessions.ids);
			const parentId = btwParentOf(sessionId);
			const isSide = parentId !== void 0;
			const outcomeChildId = parseBtwOpenedOutcome(opened?.outcome?.text);
			const candidateChildId = btwChildOf(sessionId) ?? outcomeChildId;
			const activeChildId = candidateChildId !== void 0 && sessions.byId[candidateChildId] !== void 0 ? candidateChildId : void 0;
			const switchSide = (0, react.useCallback)(async () => {
				if (isSide && parentId !== void 0) {
					await openSession(parentId);
					return;
				}
				if (activeChildId !== void 0) await openSide(sessionId, activeChildId);
			}, [
				activeChildId,
				isSide,
				openSession,
				openSide,
				parentId,
				sessionId
			]);
			(0, react.useEffect)(() => {
				if (opened?.kind !== "command" || opened.seq === handledOpen.current) return;
				if (inputPhase !== "plain" || inputDraft !== "") return;
				const childId = parseBtwOpenedOutcome(opened.outcome?.text);
				if (childId === void 0) return;
				handledOpen.current = opened.seq;
				openSide(sessionId, childId);
			}, [
				inputDraft,
				inputPhase,
				opened,
				openSide,
				sessionId
			]);
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.defaultPrevented || event.isComposing || isModalOpen()) return;
					if (!(event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && (event.code === "Slash" || event.key === "/")) || !isSide && activeChildId === void 0) return;
					event.preventDefault();
					switchSide();
				};
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
				};
			}, [
				activeChildId,
				isSide,
				switchSide
			]);
			if (isSide) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: BtwHeaderAction_module_css_default.button,
				type: "button",
				onClick: () => {
					switchSide();
				},
				children: [
					t("header.backMain"),
					" ",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": true,
						children: "Ctrl+/"
					})
				]
			});
			if (activeChildId === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: BtwHeaderAction_module_css_default.button,
				type: "button",
				onClick: () => {
					switchSide();
				},
				children: [
					t("header.backChild"),
					" ",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": true,
						children: "Ctrl+/"
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-btw-css:/Users/leftover/Desktop/projects/dsh-btw/src/client/BtwThreadIndicator.module.css.mjs
		const css = ".o0cmua_root{bottom:8px;left:max(var(--dsh-composer-side-clearance), calc((100% - var(--dsh-composer-card-max-width)) / 2));z-index:1;background:var(--dsw-alias-bg-base);height:20px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;pointer-events:none;align-items:center;gap:5px;padding-right:10px;font-size:12px;line-height:20px;display:inline-flex;position:absolute}.o0cmua_root[data-thread-kind=child]{color:var(--dsw-alias-state-business-primary)}.o0cmua_root[data-thread-kind=main] .o0cmua_label{color:var(--dsw-alias-state-success-primary)}.o0cmua_dot{background:currentColor;border-radius:50%;width:6px;height:6px}";
		const styleId = "dsh-btw/BtwThreadIndicator.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(styleId) + "]") === null) {
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-btw";
			style.dataset.pluginCss = styleId;
			style.textContent = css;
			document.head.appendChild(style);
		}
		var BtwThreadIndicator_module_css_default = {
			"label": "o0cmua_label",
			"dot": "o0cmua_dot",
			"root": "o0cmua_root"
		};
		//#endregion
		//#region src/client/BtwThreadIndicator.tsx
		/** Ambient main/side identity shown at the left edge of the composer stats row. */
		function BtwThreadIndicator({ sessionId, useSessions, t }) {
			const sessions = useSessions((state) => state);
			discoverBtwPair(sessionId, sessions.ids);
			const isChild = btwParentOf(sessionId) !== void 0;
			const childId = btwChildOf(sessionId);
			const hasChild = childId !== void 0 && sessions.byId[childId] !== void 0;
			if (!isChild && !hasChild) return null;
			const label = t(isChild ? "thread.child" : "thread.main");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BtwThreadIndicator_module_css_default.root,
				"data-thread-kind": isChild ? "child" : "main",
				"aria-label": t("thread.current", { label }),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: BtwThreadIndicator_module_css_default.dot,
					"aria-hidden": true
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: BtwThreadIndicator_module_css_default.label,
					children: label
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"sessions",
			"slots",
			"locale"
		];
		/** Remember the local pair, then open the parentless temporary session. */
		async function openBtwSide(sessions, parentId, childId) {
			rememberBtwPair(parentId, childId);
			try {
				sessions.open(childId);
				return true;
			} catch {
				forgetBtwPair(parentId, childId);
				return false;
			}
		}
		/** Register header controls and full-page side navigation. */
		function apply(ctx) {
			const sessions = ctx.sessions;
			ctx.effect(() => ctx.locale.register("btw", {
				zh,
				en
			}), "dsh-btw: dictionaries");
			const focusComposer = () => {
				requestAnimationFrame(() => {
					document.querySelector("textarea")?.focus();
				});
			};
			const injected = () => ({
				async openSide(parentId, childId) {
					if (!await openBtwSide(sessions, parentId, childId)) return false;
					focusComposer();
					return true;
				},
				async openSession(sessionId) {
					try {
						sessions.open(sessionId);
						focusComposer();
						return true;
					} catch {
						return false;
					}
				}
			});
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "btw",
				order: 5,
				locale: "btw",
				inject: injected
			}, BtwHeaderAction));
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "btw-thread-indicator",
				order: -10,
				locale: "btw"
			}, BtwThreadIndicator));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.openBtwSide = openBtwSide;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map