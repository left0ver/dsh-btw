# dsh-btw

为 DeepSeek Harness 添加与 Codex `/btw` 类似的临时侧会话。

## 功能

- `/btw`：打开一个空白侧会话。
- `/btw <文本>`：打开侧会话并发送首条文本消息。
- `Ctrl+/`：进入活动侧会话，或从侧会话返回主会话。BTW 复用原生会话视图、输入框和工具消息展示。
- 临时侧会话不会显示在左侧会话列表中。
- 输入框下方会标明当前是“主线程”还是“子线程”。
- 当前标签页仅在临时侧会话存活期间保留导航关系；该关系不会写入 Harness 会话 lineage。
- 命令说明、输入提示、错误信息、切换按钮、线程标识和临时标题支持中文与英文。

侧会话复制 `/btw` 执行前的完整已完成上下文，并继承当时的模型、agent preset、工具、工作目录和权限 preset（沙箱与审批策略）；创建完成后可在侧会话中独立修改权限。它是一个独立的顶层 Agent：没有 `parentSession`、没有 `origin: subagent`，不会出现在 subagent catalog，也不会把任何消息或结果写回主会话。

## 环境要求

需要 DeepSeek Harness `>= 0.1.0-rc.6`。插件只使用该版本 npm 包中已经发布的 `ctx.agents.create()`、`AgentHandle`、preset composition 和 session persistence Interface，不依赖本地 Harness 源码或未发布的宿主补丁。

## 安装与启用

```bash
pnpm add dsh-btw
```

将本包的 `cordis.patch.yml` 加入 Harness bundle，或通过支持插件清单的安装界面启用本包。清单同时挂载服务端命令与 Web 客户端入口。

本仓库直接安装 DeepSeek Harness 已发布到 npm 的包：

```bash
pnpm install
pnpm build
pnpm test
pnpm dev:web
```

`dev:web` 调用已安装的 `dsh web`，不读取相邻的 `../deepseek-harness` 工作区。

## 生命周期与限制

- 每个主会话最多一个活动侧会话，不允许在侧会话内继续创建 `/btw`。
- 离开临时侧会话时（包括返回主会话、切换到其他会话或清空当前选择），插件会自动销毁该侧会话。
- 仅支持文本；首版不支持图片、文件引用、`/side` 别名或右侧面板。
- rc.6 要求每个运行中的 Agent 绑定 Session，因此侧会话活动期间会使用临时 JSONL 日志。退出时插件先 flush、释放 `AgentHandle`，再删除该随机会话 ID 对应的 artifact；该会话不会作为可恢复记录保留。
- 上述物理清理针对 rc.6 默认的 JSONL backend。若部署替换成没有独立 artifact 的持久化 backend，Agent 仍会正确释放，但该 backend 中的日志无法由 rc.6 的公开 Interface 删除。
