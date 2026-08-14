window.__ModuleLoader__.load({
	id: "dsh-btw",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/protocol.ts
		/** Prefix for a successful open result. */
		const BTW_OPENED_PREFIX = "BTW 会话已打开：";
		/** Parse a branded id from one plugin-owned command outcome. */
		function parseOutcomeId(text, prefix) {
			if (text === void 0 || !text.startsWith(prefix)) return void 0;
			const id = text.slice(prefix.length).trim();
			return id === "" ? void 0 : id;
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
		function BtwHeaderAction({ sessionId, useSession, useSessions, open, openSide }) {
			const nodes = useSession((snapshot) => snapshot.nodes);
			const summary = useSessions((state) => state.byId[sessionId]);
			const catalog = useSessions((state) => state.subagentsByParent[sessionId]);
			const opened = nodes.findLast((node) => node.kind === "command" && node.name === "btw" && node.outcome?.kind === "success" && parseOutcomeId(node.outcome.text, "BTW 会话已打开：") !== void 0);
			const handledOpen = (0, react.useRef)(opened?.seq);
			const parentId = summary?.parentId;
			const isSide = parentId !== void 0 && summary?.displayTitle === "子线程";
			const catalogEntries = catalog?.entries;
			const activeChild = (0, react.useMemo)(() => catalogEntries?.find((entry) => entry.kind === "child" && entry.mode === "continuable" && entry.label === "子线程"), [catalogEntries]);
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
				const childId = parseOutcomeId(opened.outcome?.text, BTW_OPENED_PREFIX);
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
				children: ["返回主线程 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					children: "Ctrl+/"
				})]
			});
			if (activeChild?.kind !== "child") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: BtwHeaderAction_module_css_default.button,
				type: "button",
				onClick: () => {
					switchSide();
				},
				children: ["返回子线程 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					children: "Ctrl+/"
				})]
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
			"dot": "o0cmua_dot",
			"label": "o0cmua_label",
			"root": "o0cmua_root"
		};
		//#endregion
		//#region src/client/BtwThreadIndicator.tsx
		/** Ambient main/side identity shown at the left edge of the composer stats row. */
		function BtwThreadIndicator({ sessionId, useSessions }) {
			const summary = useSessions((state) => state.byId[sessionId]);
			const entries = useSessions((state) => state.subagentsByParent[sessionId])?.entries;
			const isChild = summary?.parentId !== void 0 && summary.displayTitle === "子线程";
			const hasChild = entries?.some((entry) => entry.kind === "child" && entry.mode === "continuable" && entry.label === "子线程") === true;
			if (!isChild && !hasChild) return null;
			const label = isChild ? "子线程" : "主线程";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BtwThreadIndicator_module_css_default.root,
				"data-thread-kind": isChild ? "child" : "main",
				"aria-label": `当前：${label}`,
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
		const inject = ["sessions", "slots"];
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
				}
			});
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "btw",
				order: 5,
				inject: injected
			}, BtwHeaderAction));
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "btw-thread-indicator",
				order: -10
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