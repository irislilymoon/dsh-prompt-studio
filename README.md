# dsh-prompt-studio · 系统提示词工作室

DSH 桌面端 / Web 端插件，用来编辑初始系统提示词，并按需撤掉 DSH 注入的 runtime 上下文、工具 schema、AGENTS.md、时间读数等系统侧输入。普通模式、仅聊天和自定义模式可以在输入框上方切换，新对话使用设置页选定的默认模式。

### 设计参考：[dsh-persona-select](https://github.com/gosutry/dsh-persona-select)（MIT）

本项目是独立实现，额外提供自定义模式、新对话默认模式、旧系统提示词重建、原生主题 UI 和与输入框对齐的模式选择器。

## 功能概览

- **普通模式**：使用 DSH 默认系统提示词与完整工具。
- **仅聊天**：只发送设置页里的「仅聊天提示词」，并屏蔽所有系统侧输入。
- **自定义模式**：每套模式独立保存名称、系统提示词、屏蔽开关和工具基线保护。
- **新对话默认模式**：新会话自动使用普通模式、仅聊天或任意自定义模式。
- **当前对话切换**：输入框上方的模式选择器只影响当前对话。
- **实时生效**：切换模式后，下一轮会重开请求序列并重建系统提示词，不会继续沿用历史里的旧提示词。
- **原生 UI**：使用宿主 `Menu` / `Button` / `SegmentedControl` 和浅色/深色主题服务。

## 模式

设置页的「新对话默认模式」决定新会话的初始模式；已有对话可以在输入框上方单独切换。

| 模式 | 行为 |
| --- | --- |
| **普通模式** | 完全使用 DSH 自带的系统提示词与完整工具 |
| **仅聊天** | 只发送「仅聊天提示词」，强制全量替换并屏蔽所有系统侧输入 |
| **自定义模式** | 使用模式自己保存的提示词、屏蔽开关和工具保护配置 |

本版本没有全局模式。设置页编辑的是仅聊天提示词；普通模式固定使用 DSH 默认提示词，其他组合通过自定义模式保存。

## 仅聊天

「仅聊天」固定使用设置页里的「仅聊天提示词」，并打开四类屏蔽：

- **屏蔽 runtime 上下文**：工作目录、沙箱/审批策略、skill 目录等快照。插件会同时拦截 `agent.runtimeContext` 的投影并注册 `suppressRuntimeContext()`，连 DSH 必需的 working-directory 上下文也不会发送。
- **屏蔽工具 schema**：工具定义走独立协议字段，通常是最大的一笔 token。打开后请求里没有工具。
- **屏蔽 AGENTS.md / 时间等注入**：`agent-instructions`、`time-context`、`skill-catalog`、`skill-invocation`。
- **屏蔽所有非用户注入**：用户角色里只要不是用户自己发的消息都过滤，包括 plan-mode、goal、schedule、session reference 等。

仅聊天默认**从第一条消息起**就不带工具，所以「你好」这一轮也是低 token。代价是：如果之后在同一个会话里重新打开工具，可能因工具声明基线为空被服务端拒绝；此时新建一个会话即可。

## 自定义模式

设置页的「自定义模式」板块可以新建、编辑、删除模式。每套模式独立配置：

- **提示词模式**：不覆盖 / 全量替换 / 只替换开场白。
  - **不覆盖**：完全使用 DSH 自带的系统提示词。
  - **全量替换**：整个系统提示词只保留模式里的正文；Agent Teams、工具指引、plan 策略等其余段全部去掉。
  - **只替换开场白**：用正文替换 `harness:identity` 和 `deployment:persona-prefix`，其他段保留。
- **系统提示词正文**：按字面注入，不参与 DSH 的 `{{变量}}` 插值；只有 `{{model}}` 会被替换成当前模型名。
- **屏蔽开关**：runtime、工具 schema、AGENTS.md / 时间注入、非用户注入，可单独开关。
- **工具基线保护**：在会话首轮和声明序列重启时保留完整工具一轮，避免之后重新打开工具被服务端拒绝（首轮会多约 9k token）。

新建模式默认使用「全量替换」，并把当前仅聊天提示词作为起点，屏蔽开关默认关闭，可以按需调整。

## 模式切换与实时生效

切换当前对话的模式后，下一轮 `agent/pre-step` 会返回 `startsRequestSeries: true`，DSH 随即将当前激活的 system 节点替换为新模式的系统提示词，并清空后续旧节点。例如从仅聊天切到普通模式，新一轮会重新注入 DSH 的普通系统提示词，而不是继续沿用历史里的仅聊天提示词。

- 修改提示词、切换模式或删除当前会话正在使用的自定义模式，都会触发相应的重建。
- 重新打开已有会话时，如果历史里已经存在旧系统提示词，插件会在第一次装配时做一次干净重建，确保运行期间保存的配置继续生效。
- 设置页的「上一轮装配结果」会显示系统提示词段数、工具数、过滤数量，以及本轮是否重开了请求序列。

## 实现位置

- 系统提示词：监听 `system-prompt/assemble`，重写 `sections` / `tools`。
- 用户侧注入：监听 `agent/pre-step`，按 `source.kind` 过滤 `messages`。
- 请求序列：模式变化或旧 system 节点不匹配时，在 `agent/pre-step` 设置 `startsRequestSeries: true`，由 DSH 用当前模式的提示词覆盖旧节点。
- runtime 上下文：按 agent 替换 `agent.runtimeContext.project`，并在 agent 作用域注册 `systemPrompt.suppressRuntimeContext()`。
- 设置：`<DSH_HOME>/prompt-studio/settings.json`（默认 `~/.dsh/prompt-studio/settings.json`），原子写入。自定义模式的会话引用格式为 `custom:<id>`。
- UI：宿主 `Menu` / `Button` / `SegmentedControl` 与宿主 `theme` 服务。

## 目录结构

```
dsh-prompt-studio/
├── index.js            # 宿主半侧：装配重写、注入过滤、HTTP 路由
├── client.js           # 浏览器半侧：设置页、输入区模式选择器
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

将本目录放到任意位置，然后在 DSH 中打开：

设置 → 插件 → 添加插件 → 填写该目录的绝对路径：

```
<插件目录>\dsh-prompt-studio
```

安装后插件会出现在「已安装插件」，确认开关是开启状态即可；客户端部分会热更新，宿主部分按提示重启 DSH。

卸载：设置 → 插件 → 系统提示词工作室 → 卸载。

### 命令行（仅非桌面 profile）

桌面 profile 由 Electron 应用独占管理，`dsh plugin --profile desktop ...` 会被拒绝。桌面端请使用上面的插件页；Web / CLI profile 可以用：

```bat
dsh plugin --profile <profile-name> add "<插件目录>/dsh-prompt-studio"
```

## 限制

- **minimal 模式**：如果某个 agent preset 自己声明了 `complete: true` 的系统提示词段（DSH 内置 minimal 模式会），平台会在装配最后把它恢复为唯一段，本插件的提示词段无法进入。请改用 standard / cordis / ptc 等模式。
- **工具恢复**：仅聊天或开启了工具屏蔽的自定义模式，从首轮起工具基线为空，之后在同一会话打开工具可能被服务端拒绝；请新建会话，或在模式里预先开启「工具基线保护」。
- **已有工具调用的会话**：把已经调用过工具的会话切换到仅聊天时，工具历史与空声明可能对不上，容易被服务端拒绝；仅聊天建议使用新会话。
- **KV 缓存**：切换提示词、模式或屏蔽开关会让下一轮请求内容变化，已有会话的缓存会重建一次，之后恢复稳定；重开请求序列也会重建一次缓存。
- 插件只处理 `role === 'user'` 的注入消息；assistant / tool 历史原样保留，避免破坏会话结构。
- 兼容性：需要提供 `Menu` / `Button` / `SegmentedControl` 客户端 primitives 与 `theme` 服务的 DSH 0.2.x。

## 数据文件

`~/.dsh/prompt-studio/settings.json`

- `prompt.text`: 仅聊天提示词正文
- `defaultMode`: 新对话默认模式，`normal` / `pure` / `custom:<id>`
- `modes`: 自定义模式数组，每项包含 `id`、`name`、`promptMode`、`promptText`、`suppress`、`toolSafety`
- `sessions`: 每个会话的模式覆盖；没有覆盖的会话跟随 `defaultMode`
- `prompt.mode` / `suppress` / `toolSafety`: 旧版兼容字段；仅聊天固定全量替换和全部屏蔽，自定义模式使用各自的配置

删除该文件即可恢复默认（插件仍会挂载，但所有功能关闭）。

## 隐私

- 插件只在本地读写 `<DSH_HOME>/prompt-studio/settings.json`；设置页通过同源本地路由存取，不访问外部服务。
- 仓库内不包含用户设置、会话日志、凭据、账号信息或本机绝对路径。
- 提交 issue / 截图时请注意：轨迹和会话内容可能包含个人信息，发布前自行脱敏；本插件本身不收集这些数据。

## English

A DSH Desktop/Web plugin that makes the initial system prompt editable and suppresses runtime context, tool schemas, AGENTS.md, time readings and other system-side input. Normal mode, chat only and custom modes switch from the prompt row above the composer; new chats use the default mode chosen in Settings.

### Design reference: [dsh-persona-select](https://github.com/gosutry/dsh-persona-select) (MIT)

This is an independent implementation. It adds custom modes, a default mode for new chats, clean replacement of stale system prompts, native theme-aware UI, and a composer-aligned mode selector.

- **Normal mode**: DSH default system prompt and full tools.
- **Chat only**: send only the chat-only prompt from Settings and suppress all system-side input.
- **Custom modes**: save a name, system prompt, suppression switches and tool-baseline protection per mode.
- **Default mode**: new chats start in normal mode, chat only or any custom mode.
- **Per-chat override**: the selector above the composer affects the current conversation only.
- **Live updates**: after a mode change, the next turn starts a new request series and rebuilds the system prompt, so an old chat-only prompt is not reused.
- **Native UI**: host `Menu`, `Button`, `SegmentedControl` and the host light/dark theme service.

Prompt modes available inside a custom mode are **do not override**, **replace whole prompt**, and **replace opener only**. `{{model}}` is replaced with the current model name; other text is injected literally. New custom modes start from the chat-only prompt with full replacement and no suppression enabled.

Data lives in `~/.dsh/prompt-studio/settings.json`. Install from **Settings → Plugins → Add plugin** with the absolute path to this directory (the desktop profile is managed by the Electron app; `dsh plugin --profile desktop ...` is refused). Web/CLI profiles can use `dsh plugin --profile <profile-name> add "<plugin-dir>/dsh-prompt-studio"`.

**Limitations**: minimal agent presets with a `complete` prompt section override this plugin's prompt; sessions that already used tools may reject a later empty tool baseline; each mode/prompt change rebuilds the KV cache once. The plugin only filters user-role injected messages and leaves assistant/tool history intact. DSH 0.2.x with client primitives and the theme service is required.

**Privacy**: all settings stay local in `~/.dsh/prompt-studio/settings.json`. The plugin has no telemetry and makes no external network calls; the repository ships no user settings, session logs, credentials, account data, or machine-specific paths.

## 参考与致谢

- [dsh-persona-select](https://github.com/gosutry/dsh-persona-select)：本插件在 DSH 插件结构、系统提示词注入/屏蔽、仅聊天开关和会话级覆盖的设计上参考了该项目（MIT）。
- 本项目为独立实现，**不包含** dsh-persona-select 的内置人设、历史对话导入/导出、PNG 角色卡等功能，也不包含其鲸鱼娘形象素材。
- 如果后续引入或改编该项目的代码，请同时保留其 MIT 许可证声明。

## License

MIT — see [LICENSE](LICENSE).
