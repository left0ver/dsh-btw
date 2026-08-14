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
		/** Every localized label that identifies a dsh-btw child. */
		const BTW_LABELS = /* @__PURE__ */ new Set([
			zh["thread.title"],
			en["thread.title"],
			zh["thread.child"],
			en["thread.child"]
		]);
		/** Whether a live catalog label belongs to this plugin. */
		function isBtwLabel(label) {
			return label !== void 0 && BTW_LABELS.has(label);
		}
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
		/** Header controls and keyboard policy for one current parent or BTW child. */
		function BtwHeaderAction({ sessionId, useSession, useSessions, open, openSide, refreshSubagents, t }) {
			const nodes = useSession((snapshot) => snapshot.nodes);
			const summary = useSessions((state) => state.byId[sessionId]);
			const catalog = useSessions((state) => state.subagentsByParent[sessionId]);
			const opened = nodes.findLast((node) => node.kind === "command" && node.name === "btw" && node.outcome?.kind === "success" && parseBtwOpenedOutcome(node.outcome.text) !== void 0);
			const handledOpen = (0, react.useRef)(opened?.seq);
			const parentId = summary?.parentId;
			const isSide = parentId !== void 0 && isBtwLabel(summary?.displayTitle);
			const catalogEntries = catalog?.entries;
			const activeChild = (0, react.useMemo)(() => catalogEntries?.find((entry) => entry.kind === "child" && entry.mode === "continuable" && isBtwLabel(entry.label)), [catalogEntries]);
			const localizedChildLabel = t("thread.title");
			(0, react.useEffect)(() => {
				const staleParent = isSide && parentId !== void 0 ? summary?.displayTitle === localizedChildLabel ? void 0 : parentId : activeChild?.label === localizedChildLabel ? void 0 : sessionId;
				if (staleParent !== void 0 && (isSide || activeChild !== void 0)) refreshSubagents(staleParent);
			}, [
				activeChild,
				isSide,
				localizedChildLabel,
				parentId,
				refreshSubagents,
				sessionId,
				summary?.displayTitle
			]);
			const switchSide = (0, react.useCallback)(async () => {
				if (isSide && parentId !== void 0) {
					open(parentId);
					return;
				}
				if (activeChild?.kind === "child") await openSide(sessionId, activeChild.id);
			}, [
				activeChild,
				isSide,
				open,
				openSide,
				parentId,
				sessionId
			]);
			(0, react.useEffect)(() => {
				if (opened?.kind !== "command" || opened.seq === handledOpen.current) return;
				const childId = parseBtwOpenedOutcome(opened.outcome?.text);
				if (childId === void 0) return;
				handledOpen.current = opened.seq;
				openSide(sessionId, childId);
			}, [
				opened,
				openSide,
				sessionId
			]);
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.defaultPrevented || event.isComposing || isModalOpen()) return;
					if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && (event.code === "Slash" || event.key === "/")) {
						if (!isSide && activeChild === void 0) return;
						event.preventDefault();
						switchSide();
						return;
					}
				};
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
				};
			}, [
				activeChild,
				isSide,
				switchSide
			]);
			if (isSide && parentId !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: BtwHeaderAction_module_css_default.button,
				type: "button",
				onClick: () => {
					open(parentId);
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
			if (activeChild?.kind !== "child") return null;
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
		/** Build the exact address used by existing subagent navigation. */
		function btwAddress(parentSessionId, childSessionId) {
			return {
				parentSessionId,
				childSessionId,
				mode: "continuable"
			};
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
			"root": "o0cmua_root",
			"dot": "o0cmua_dot"
		};
		//#endregion
		//#region src/client/BtwThreadIndicator.tsx
		/** Ambient main/side identity shown at the left edge of the composer stats row. */
		function BtwThreadIndicator({ sessionId, useSessions, t }) {
			const summary = useSessions((state) => state.byId[sessionId]);
			const entries = useSessions((state) => state.subagentsByParent[sessionId])?.entries;
			const isChild = summary?.parentId !== void 0 && isBtwLabel(summary.displayTitle);
			const hasChild = entries?.some((entry) => entry.kind === "child" && entry.mode === "continuable" && isBtwLabel(entry.label)) === true;
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
		/** Refresh the parent catalog, then open the child through its known durable address. */
		async function openBtwSide(sessions, parentId, childId) {
			await sessions.refreshSubagents(parentId);
			try {
				sessions.openSubagent(btwAddress(parentId, childId));
				return true;
			} catch {
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
			const injected = () => ({
				open(id) {
					sessions.open(id);
				},
				async openSide(parentId, childId) {
					if (!await openBtwSide(sessions, parentId, childId)) return false;
					requestAnimationFrame(() => {
						document.querySelector("textarea")?.focus();
					});
					return true;
				},
				refreshSubagents(parentId) {
					return sessions.refreshSubagents(parentId);
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