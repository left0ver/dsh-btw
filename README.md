# dsh-btw

为 DeepSeek Harness 添加与 Codex `/btw` 一致的临时侧会话。

## 功能

- `/btw`：打开一个空白侧会话。
- `/btw <文本>`：打开侧会话并发送首条文本消息。
- `Ctrl+/`：在主会话与活动侧会话之间整页切换；BTW 复用原生会话视图、输入框和工具消息展示。
- 输入框下方会标明当前是“主线程”还是“子线程”。BTW 不提供手动关闭入口。

侧会话从执行命令时主会话最近一个已完成边界分叉，继承模型、推理配置、工具、沙箱与审批策略。它支持多轮追问，不阻塞主会话，也不会把任何侧会话消息写回主会话上下文。

## 环境要求

需要 DeepSeek Harness `>= 0.1.0-rc.6`，并包含 `ctx.subagents.startEphemeralContinuable()` 宿主 API；插件不会通过安装脚本修改宿主。开发时不能直接使用尚未包含该 API 的全局 `rc.6` 产物。

## 安装与启用

```bash
pnpm add dsh-btw
```

将本包的 `cordis.patch.yml` 加入 Harness bundle，或通过支持插件清单的安装界面启用本包。清单同时挂载服务端命令与 Web 客户端入口。

本仓库联调宿主源码时，可把 DeepSeek Harness 各包解析到相邻 workspace，再执行：

```bash
pnpm install
pnpm dev:host-build
pnpm build
pnpm test
pnpm dev:web
```

`dev:web` 使用相邻 `../deepseek-harness` 的本地 CLI 和宿主包启动 Web。修改宿主后需要重新执行 `dev:host-build` 并重启进程；直接运行全局 `dsh web` 会重新加载全局安装的宿主包。

## 生命周期与限制

- 每个主会话最多一个活动侧会话，不允许在侧会话内继续创建 `/btw`。
- 仅支持文本；首版不支持图片、文件引用、`/side` 别名或右侧面板。
- 临时会话完全绕过 JSONL/SQLite 持久化，不进入普通历史、工作区或最近会话列表。
- 插件卸载、父会话销毁或进程退出都会释放侧会话；刷新或重启后不可恢复。
