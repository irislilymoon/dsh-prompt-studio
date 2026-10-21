# dsh-prompt-studio · 系统提示词工作室

DSH 桌面端 / Web 端插件。用来改「初始系统提示词」，并把 DSH 额外注入的 runtime 上下文、工具 schema、AGENTS.md、时间读数等一层层撤掉，做到低 token 的纯聊天。

### 设计参考：[dsh-persona-select](https://github.com/gosutry/dsh-persona-select)（MIT）。本项目是独立实现，并额外补上了全量替换旧系统提示词、原生主题 UI 与会话 composer 对齐。

## 三种提示词模式

| 模式 | 行为 |
| --- | --- |
| **不覆盖** | 完全使用 DSH 自带的系统提示词 |
| **全量替换** | 整个系统提示词只保留你写的正文；Agent Teams、工具指引、plan 策略等其余段全部去掉。正文为空时系统提示词为空 |
| **只替换开场白** | 用你写的正文替换 `harness:identity` 和 `deployment:persona-prefix`，Agent Teams、工具指引、plan 策略等其余段保留 |

正文按字面注入，不参与 DSH 的 `{{变量}}` 插值；只有 `{{model}}` 会被插件替换成当前模型名。设置页的「载入 DSH 默认开场白」会读取当前宿主的 identity + persona 并填入。

## 纯聊天与屏蔽开关

「一键纯聊天」= 全量替换 + 四个屏蔽开关全开：

- **屏蔽 runtime 上下文**：工作目录、沙箱/审批策略、skill 目录等快照。插件会同时拦截 `agent.runtimeContext` 的投影并注册 `suppressRuntimeContext()`，所以连 DSH 必需的 working-directory 上下文也不会发送。
- **屏蔽工具 schema**：工具定义走独立协议字段，通常是最大的一笔 token。打开后请求里没有工具。
- **屏蔽 AGENTS.md / 时间等注入**：`agent-instructions`、`time-context`、`skill-catalog`、`skill-invocation`。
- **屏蔽所有非用户注入**：更彻底，用户角色里只要不是你自己发的消息都过滤，包括 plan-mode、goal、schedule、session reference 等。

纯聊天默认**从第一条消息起**就不带工具，所以「你好」这一轮也是低 token。代价是：如果之后在同一个会话里重新打开工具，可能因工具声明基线为空被服务端拒绝；此时新建一个会话即可。需要提前保护基线时，可勾选「工具基线保护」，插件会在会话首轮和声明序列重启时保留完整工具一轮（首轮会多约 9k token）。

## 本会话模式

输入框下方有一个「提示词」选择器，只影响当前会话：

- **跟随全局设置**：使用设置页的配置。
- **纯聊天**：本会话强制只用全局提示词正文 + 全部屏蔽。
- **正常模式**：本会话强制使用 DSH 默认系统提示词与完整工具。

设置页也能切换当前会话模式，并展示上一轮实际装配的段数、工具数、过滤条数与工具保活状态。

## 实现位置

- 系统提示词：监听 `system-prompt/assemble`，重写 `sections` / `tools`。
- 用户侧注入：监听 `agent/pre-step`，按 `source.kind` 过滤 `messages`。
- 全量替换：检测当前会话里已有的 system 节点；旧提示词不匹配时在 `agent/pre-step` 设置 `startsRequestSeries: true`，让 DSH 用新提示词覆盖旧节点，而不是继续追加。
- runtime 上下文：按 agent 替换 `agent.runtimeContext.project`，并在 agent 作用域注册 `systemPrompt.suppressRuntimeContext()`。
- 设置：`<DSH_HOME>/prompt-studio/settings.json`（默认 `~/.dsh/prompt-studio/settings.json`），原子写入。
- UI：使用宿主 `Menu` / `Button` / `SegmentedControl` 原生组件，并读取宿主 `theme` 服务的浅色/深色主题。

## 目录结构

```
dsh-prompt-studio/
├── index.js            # 宿主半侧：装配重写、注入过滤、HTTP 路由
├── client.js           # 浏览器半侧：设置页、输入区选择器
├── cordis.patch.yml    # bundle patch
├── package.json
├── locale/             # 插件市场显示用的中文/英文元数据
│   ├── zh.json
│   └── en.json
├── icon.svg
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## 安装

### 桌面端插件页（推荐）

设置 → 插件 → 添加插件 → 填写本目录的绝对路径：

```
<你的插件目录>\dsh-prompt-studio
```

安装后插件会出现在「已安装插件」，确认开关是开启状态即可；客户端部分会热更新，宿主部分按提示重启 DSH。

卸载：设置 → 插件 → 系统提示词工作室 → 卸载。

### 命令行（仅非桌面 profile）

桌面 profile 由 Electron 应用独占管理，`dsh plugin --profile desktop ...` 会被拒绝。桌面端请用上面的插件页；Web / CLI profile 可以用：

```bat
dsh plugin --profile <profile-name> add "<你的插件目录>/dsh-prompt-studio"
```

## 限制

- **minimal 模式**：如果某个 agent preset 自己声明了 `complete: true` 的系统提示词段（DSH 内置 minimal 模式会），平台会在装配最后把它恢复为唯一段，本插件的提示词段无法进入。改用 standard / cordis / ptc 等模式。
- **工具恢复**：纯聊天会话从首轮起工具基线为空，之后在同一会话打开工具可能被服务端拒绝；请新建会话，或预先开启「工具基线保护」。
- **已有工具调用的会话**：已经调用过工具的会话切到纯聊天，工具历史与空声明可能对不上，容易被服务端拒绝；纯聊天请用新会话。
- **KV 缓存**：切换提示词或屏蔽开关会让下一轮请求内容变化，已有会话的缓存会重建一次，之后恢复稳定。全量替换旧系统提示词时也会重开一次请求序列。
- 插件只处理 `role === 'user'` 的注入消息；assistant / tool 历史原样保留，避免破坏会话结构。
- 兼容性：需要提供 `Menu` / `Button` / `SegmentedControl` 客户端 primitives 与 `theme` 服务的 DSH 0.2.x。

## 数据文件

`~/.dsh/prompt-studio/settings.json`

- `prompt.mode`: `host`（不覆盖） / `replace`（只替换开场白） / `only`（全量替换）
- `prompt.text`: 提示词正文
- `suppress`: `runtime` / `tools` / `injected` / `all`
- `toolSafety`: 工具基线保护
- `sessions`: 每个会话的模式覆盖（`global` 不写入）

删除该文件即可恢复默认（插件仍会挂载，但所有功能关闭）。

## 隐私

- 插件只在本地读写 `<DSH_HOME>/prompt-studio/settings.json`；设置页通过同源本地路由存取，不访问外部服务。
- 仓库内不包含用户设置、会话日志、凭据、账号信息或本机绝对路径。
- 提交 issue / 截图时请注意：轨迹和会话内容可能包含个人信息，上传前先自行脱敏；本插件本身不收集这些数据。


## English

A DSH Desktop/Web plugin that makes the initial system prompt editable and removes the extra system-side input DSH would otherwise send.

### Design reference: [dsh-persona-select](https://github.com/gosutry/dsh-persona-select) (MIT). This is an independent implementation; it adds full replacement of stale system prompts, native theme-aware UI, and composer-aligned dock controls.

- **Modes**: leave the host prompt untouched, replace only the opener, or replace the whole system prompt (Agent Teams, tool guidance and every other section are removed).
- **Pure chat**: suppress runtime context (including the mandatory working-directory snapshot), tool schemas, AGENTS.md/time/skill injections, and every other non-user injection. Tools are absent from the first message, so even the first turn is cheap.
- **Per-chat override**: follow global settings, pure chat, or normal mode for one conversation only.
- **Native UI**: host `Menu`, `Button`, `SegmentedControl`, and the host light/dark theme service.
- **Full replacement**: when the prompt changes, the plugin forces a request-series restart so DSH replaces the old system-prompt node instead of appending the new prompt after it.

Install from **Settings → Plugins → Add plugin** with the absolute path to this directory (the desktop profile is managed by the Electron app; `dsh plugin --profile desktop ...` is refused). Data lives in `~/.dsh/prompt-studio/settings.json`.

**Privacy**: all settings stay local in `~/.dsh/prompt-studio/settings.json`. The plugin has no telemetry and makes no external network calls; the repository ships no user settings, session logs, credentials, account data, or machine-specific paths.

## 参考与致谢

- [dsh-persona-select](https://github.com/gosutry/dsh-persona-select)：本插件在 DSH 插件结构、系统提示词注入/屏蔽、纯聊天开关和会话级覆盖的设计上参考了该项目（MIT）。
- 本项目为独立实现，**不包含** dsh-persona-select 的内置人设、历史对话导入/导出、PNG 角色卡等功能，也不包含其鲸鱼娘形象素材。
- 如果后续引入或改编该项目的代码，请同时保留其 MIT 许可证声明。

## License

MIT — see [LICENSE](LICENSE).
