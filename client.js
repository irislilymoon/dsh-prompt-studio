window.__ModuleLoader__.load({
  id: 'dsh-prompt-studio',
  factory: function promptStudioFactory(require) {
    'use strict';
    let React = null;
    try {
      React = require('react');
    } catch {
      React = null;
    }
    if (React === null || typeof React.createElement !== 'function') {
      try {
        console.error('[dsh-prompt-studio] 拿不到 react，客户端不注册任何槽位。');
      } catch {
      }
      return { inject: [], apply() {} };
    }
    const h = React.createElement;
    let primitives = null;
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    } catch (error) {
      primitives = null;
      try {
        console.warn('[dsh-prompt-studio] host primitives unavailable, falling back to native controls:', error?.message ?? String(error));
      } catch {
      }
    }
    const HostMenu = primitives?.Menu ?? null;
    const HostButton = primitives?.Button ?? null;
    const HostSegmentedControl = primitives?.SegmentedControl ?? null;
    const NS = 'prompt-studio';
    const ROUTE = '/prompt-studio';
    const CHANGED_EVENT = 'dsh-prompt-studio:changed';
    const MAX_CUSTOM_MODES = 20;
    let fallbackT = (key) => key;
    const sessionsHolder = { service: null };
    const themeHolder = { service: null, scheme: 'light', listeners: new Set() };

    function detectThemeScheme() {
      try {
        const snapshot = themeHolder.service?.getTheme?.();
        const scheme = snapshot?.active?.colorScheme;
        if (scheme === 'dark' || scheme === 'light') return scheme;
      } catch {
      }
      try {
        if (document.body.hasAttribute('data-ds-dark-theme')
          || document.documentElement.hasAttribute('data-ds-dark-theme')) {
          return 'dark';
        }
      } catch {
      }
      return 'light';
    }

    function notifyThemeChanged() {
      for (const listener of [...themeHolder.listeners]) {
        try {
          listener();
        } catch {
        }
      }
    }

    function useThemeScheme() {
      const [scheme, setScheme] = React.useState(() => themeHolder.scheme);
      React.useEffect(() => {
        const update = () => setScheme(themeHolder.scheme);
        themeHolder.listeners.add(update);
        update();
        return () => {
          themeHolder.listeners.delete(update);
        };
      }, []);
      return scheme;
    }

    function notifyChanged() {
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new Event(CHANGED_EVENT));
        }
      } catch {
      }
    }

    const zh = {
      nav: '提示词 / 模式',
      title: '系统提示词工作室',
      intro: '自定义初始系统提示词，并按需撤掉 DSH 注入的 runtime 上下文、工具 schema、AGENTS.md 与 skill 目录。普通模式、仅聊天和自定义模式可以在输入框上方切换；仅聊天可以单独放行记忆、时间读数和少数工具。新对话使用你设置的默认模式。',
      modeHost: '不覆盖',
      modeReplace: '只替换开场白',
      modeOnly: '全量替换',
      modeHostHint: '使用 DSH 自带的系统提示词',
      modeReplaceHint: '只替换 Harness 身份与 coding persona，Agent Teams、工具指引等其他段保留',
      modeOnlyHint: '整个系统提示词只保留你写的正文，Agent Teams、工具指引等其他段全部去掉',
      promptPlaceholder: '在这里写你的初始系统提示词。例如：\n你是 DeepSeek，一个简洁、直接的对话助手。',
      loadDefault: '载入 DSH 默认开场白',
      clearPrompt: '清空',
      chars: '{n} 字符',
      modelTokenHint: '{{model}} 会在每次请求时替换成当前模型名。文本按字面注入，不会触发 DSH 的变量插值。',
      confirmLoadDefault: '编辑区已有内容，载入默认开场白会替换它。继续？',
      confirmClear: '清空编辑区里的提示词？',
      defaultLoaded: '已载入 DSH 默认开场白，点击「保存设置」生效。',
      defaultFailed: '载入默认开场白失败',
      cleared: '已清空编辑区，点击「保存设置」生效。',
      onlyPromptTitle: '仅聊天提示词',
      onlyPromptBadge: '全量替换',
      onlyPromptHint: '仅聊天模式默认只发送这段提示词，并屏蔽 runtime 上下文、工具 schema、AGENTS.md、时间等系统侧输入。可以在下方「仅聊天屏蔽与记忆」里放行记忆、时间或个别工具。',
      onlyPromptEmpty: '提示词为空时，仅聊天不会发送任何系统提示词；模型只会看到对话内容。',
      swRuntime: '屏蔽 runtime 上下文',
      swRuntimeHint: '撤掉工作目录、沙箱/审批策略、skill 目录等 runtime 快照。总开关会拦下整份快照，包括 DSH 必需的 working-directory；展开单项后可以只屏蔽其中几项，或只保留工作目录。',
      swTools: '屏蔽工具 schema',
      swToolsHint: '工具定义走独立协议字段，是最大的一笔 token。总开关会移除全部工具；展开单项后可以只保留个别工具，例如记忆默认放行的 read / write / edit。',
      swInjected: '屏蔽 AGENTS.md / 时间等注入',
      swInjectedHint: '撤掉 workspace instructions（AGENTS.md / CLAUDE.md）、逐步时间读数、skill 目录与 /skill 调用内容。展开单项后可以只保留时间读数等某一项。',
      swAll: '屏蔽所有非用户注入',
      swAllHint: '用户角色里只要不是你自己发的消息就过滤掉，包括 plan-mode 提醒、goal/schedule 消息、session 引用等。总开关是最彻底的仅聊天；展开单项后可以只屏蔽其中几类。',
      swSafety: '工具基线保护',
      swSafetyHint: 'DSH 要求会话有一份非空工具声明基线，否则之后重新打开工具可能被服务端拒绝。勾上后，会话首轮和声明序列重启时会保留完整工具一轮——首轮会多花约 9k token。仅聊天默认关闭。',
      swSafetyCost: '首轮代价高；开启后首条消息不再是低 token。',
      save: '保存设置',
      saving: '保存中…',
      saved: '设置已保存，下一轮请求生效。',
      saveFailed: '保存失败',
      unsaved: '有未保存的修改',
      savedHint: '没有未保存的修改',
      modePure: '仅聊天',
      modeNormal: '普通模式',
      modePureHint: '只发送仅聊天提示词，默认屏蔽全部系统侧输入；可在下方单独放行记忆、时间或工具',
      modeNormalHint: '使用 DSH 默认提示词与完整工具',
      defaultModeTitle: '新对话默认模式',
      defaultModeHint: '新建对话会自动使用这个模式；已有对话可以在输入框上方单独切换，没有单独切换过的对话也会跟随这里。',
      defaultModeLabel: '默认模式',
      defaultModeEffective: '新对话当前使用：{mode}',
      defaultModeSaved: '新对话默认模式已更新。',
      defaultBadge: '默认',
      customTitle: '自定义模式',
      customHint: '把一套系统提示词、屏蔽开关、记忆和工具保护保存成可复用的模式，会出现在输入框上方的模式菜单里。',
      customAdd: '新建模式',
      customEmpty: '还没有自定义模式。',
      customEdit: '编辑',
      customDelete: '删除',
      customBadge: '自定义',
      customCount: '{n} 个',
      customNewName: '自定义模式 {n}',
      customEditorTitleNew: '新建自定义模式',
      customEditorTitleEdit: '编辑自定义模式',
      customName: '模式名称',
      customNamePlaceholder: '例如：翻译助手',
      customPromptTitle: '系统提示词',
      customSave: '保存模式',
      customCancel: '取消',
      customDeleteConfirm: '删除自定义模式「{name}」？使用该模式的对话会回到默认模式。',
      customSaved: '自定义模式已保存。',
      customDeleted: '自定义模式已删除。',
      customNameRequired: '请填写模式名称。',
      customLimit: '最多 20 个自定义模式。',
      customEmptyPrompt: '系统提示词为空时，这个模式不会发送提示词正文。',
      customSummary: '{mode} · {suppress}',
      customSuppressNone: '不屏蔽',
      customSuppressItems: '仅屏蔽细项',
      customSuppressList: '屏蔽 {list}',
      sumRuntime: 'runtime',
      sumTools: '工具',
      sumInjected: '注入',
      sumAll: '非用户注入',
      sumSafety: '工具保护',
      diagTitle: '上一轮装配结果',
      diagEmpty: '在当前会话发一条消息后，这里会显示上一轮实际装配的段数、工具数和过滤数量。',
      diagSections: '系统提示词段数 {before} → {after}',
      diagTools: '工具 schema {before} → {after}',
      diagMemory: '记忆：{state}',
      diagMemoryOn: '开',
      diagMemoryOff: '关',
      diagHeld: '工具保活：{reason}',
      diagHeldNone: '工具保活：未触发',
      diagHeldFirst: '会话首轮保留完整工具',
      diagHeldRestart: '声明序列重启，保留完整工具一轮',
      diagSeriesRestarted: '请求序列：本轮已重开，系统提示词按当前模式重建',
      diagStripped: '过滤注入消息 {count} 条',
      diagKinds: '（{kinds}）',
      diagPath: '数据文件',
      diagCounters: '进程累计：装配 {assemblies} 次 · 过滤 {stripped} 条 · 保活 {held} 轮',
      loading: '读取设置…',
      retry: '重试',
      loadFailed: '读取设置失败',
      storeWarning: '设置文件读取有问题：{error}',
      dockLabel: '提示词',
      dockHint: '只影响当前对话：普通模式 / 仅聊天 / 自定义模式',
      pureBadge: '仅聊天',
      lang: 'zh',
      memoryLabel: '允许记忆',
      memoryBadge: '记忆',
      memoryHint: '在当前会话的工作目录读取并注入 SOUL.md / MEMORY.md，并默认放行 read / write / edit 与时间读数。文件不存在时模型可以用 write 创建。',
      memoryRuntimeHint: '当 runtime 总开关打开时，记忆会保留当前工作目录，便于按相对路径读写这些文件。',
      memoryScopeHint: '记忆开关属于当前模式；普通模式保持 DSH 默认行为，不读取这里的设置。',
      memoryDefault: '记忆默认',
      memoryDefaultHint: '开启记忆时这些项默认放行；勾选仍可单独屏蔽，但记忆可能无法正常工作。',
      memoryDir: '记忆目录',
      memoryNoDir: '当前会话没有工作目录，记忆不会注入',
      subItems: '单项',
      subItemsHint: '默认折叠。勾选表示屏蔽该项；总开关打开时，未勾选的项会被放行。带「记忆默认」的项可以勾选，但会影响记忆。',
      subEmpty: '还没有可列出的项。发一条消息后，这里会显示当前会话实际出现的项目。',
      pureSuppressTitle: '仅聊天屏蔽与记忆',
      pureSuppressHint: '这些开关只作用于仅聊天模式。总开关保持「全部屏蔽」；展开单项后可以放行某一项，或只单独屏蔽某一项。',
      customSuppressTitle: '屏蔽与记忆',
      suppressSummaryExtra: '（{n} 项细调）',
    };

    const en = {
      nav: 'Prompt / modes',
      title: 'Prompt Studio',
      intro: 'Edit the initial system prompt and optionally remove runtime context, tool schemas, AGENTS.md and skill catalogs injected by DSH. Switch between normal mode, chat only and custom modes above the composer; chat only can allow memory, time readings and a few tools individually. New chats use your default mode.',
      modeHost: 'Do not override',
      modeReplace: 'Replace opener only',
      modeOnly: 'Replace whole prompt',
      modeHostHint: 'Use the system prompt shipped with DSH',
      modeReplaceHint: 'Only the Harness identity and coding persona; Agent Teams, tool guidance and other sections stay',
      modeOnlyHint: 'Only your text remains; Agent Teams, tool guidance and every other section are removed',
      promptPlaceholder: 'Write your initial system prompt here. For example:\nYou are DeepSeek, a concise and direct chat assistant.',
      loadDefault: 'Load DSH default opener',
      clearPrompt: 'Clear',
      chars: '{n} characters',
      modelTokenHint: '{{model}} is replaced with the current model name for every request. Text is injected literally and is not interpolated by DSH.',
      confirmLoadDefault: 'The editor already has content. Loading the default opener will replace it. Continue?',
      confirmClear: 'Clear the prompt in the editor?',
      defaultLoaded: 'Default opener loaded. Click Save settings to apply.',
      defaultFailed: 'Could not load the default opener',
      cleared: 'Editor cleared. Click Save settings to apply.',
      onlyPromptTitle: 'Chat-only prompt',
      onlyPromptBadge: 'Replace whole prompt',
      onlyPromptHint: 'Chat only sends exactly this prompt and suppresses runtime context, tool schemas, AGENTS.md, time readings and every other system-side input by default. Allow memory, time or individual tools in “Chat-only suppression and memory” below.',
      onlyPromptEmpty: 'With an empty prompt, chat only sends no system prompt at all; the model sees only the conversation.',
      swRuntime: 'Suppress runtime context',
      swRuntimeHint: 'Removes runtime snapshots: working directory, sandbox/approval policies, skill catalog. The master switch drops the whole snapshot, including DSH mandatory working-directory context; expand Items to suppress only some contexts or keep just the working directory.',
      swTools: 'Suppress tool schemas',
      swToolsHint: 'Tool definitions are a separate wire field and usually the largest token item. The master switch removes every tool; expand Items to keep individual tools such as read / write / edit, which memory allows by default.',
      swInjected: 'Suppress AGENTS.md / time injections',
      swInjectedHint: 'Removes workspace instructions (AGENTS.md / CLAUDE.md), per-step time readings, skill catalogs and /skill content. Expand Items to keep individual entries such as time readings.',
      swAll: 'Suppress every non-user injection',
      swAllHint: 'Drops every user-role message you did not send yourself, including plan-mode reminders, goal/schedule messages and session references. The master switch is the most thorough chat-only setup; expand Items to suppress only some kinds.',
      swSafety: 'Tool baseline protection',
      swSafetyHint: 'DSH expects a non-empty tool-declaration baseline; without one, re-enabling tools later in the same session may be rejected. When checked, the full tool list is kept for the session\u2019s first request and after a declaration-series restart \u2014 about 9k extra tokens on that turn. Off by default for chat only.',
      swSafetyCost: 'Costly first turn; the first message is no longer low-token.',
      save: 'Save settings',
      saving: 'Saving\u2026',
      saved: 'Settings saved; effective on the next turn.',
      saveFailed: 'Save failed',
      unsaved: 'Unsaved changes',
      savedHint: 'No unsaved changes',
      modePure: 'Chat only',
      modeNormal: 'Normal mode',
      modePureHint: 'Send only the chat-only prompt with every system input suppressed by default; allow memory, time or tools below',
      modeNormalHint: 'DSH default prompt and full tools',
      defaultModeTitle: 'Default mode for new chats',
      defaultModeHint: 'New chats start in this mode. Existing chats can switch from the prompt row above the composer; chats without their own choice also follow this setting.',
      defaultModeLabel: 'Default mode',
      defaultModeEffective: 'New chats currently use: {mode}',
      defaultModeSaved: 'Default mode for new chats updated.',
      defaultBadge: 'Default',
      customTitle: 'Custom modes',
      customHint: 'Save a system prompt, suppression switches, memory and tool protection as a reusable mode. It appears in the mode menu above the composer.',
      customAdd: 'New mode',
      customEmpty: 'No custom modes yet.',
      customEdit: 'Edit',
      customDelete: 'Delete',
      customBadge: 'Custom',
      customCount: '{n}',
      customNewName: 'Custom mode {n}',
      customEditorTitleNew: 'New custom mode',
      customEditorTitleEdit: 'Edit custom mode',
      customName: 'Mode name',
      customNamePlaceholder: 'e.g. Translation assistant',
      customPromptTitle: 'System prompt',
      customSave: 'Save mode',
      customCancel: 'Cancel',
      customDeleteConfirm: 'Delete custom mode "{name}"? Chats using it will fall back to the default mode.',
      customSaved: 'Custom mode saved.',
      customDeleted: 'Custom mode deleted.',
      customNameRequired: 'Enter a mode name.',
      customLimit: 'Up to 20 custom modes.',
      customEmptyPrompt: 'With an empty system prompt, this mode sends no prompt text.',
      customSummary: '{mode} \u00b7 {suppress}',
      customSuppressNone: 'no suppression',
      customSuppressItems: 'item-level suppression only',
      customSuppressList: 'suppress {list}',
      sumRuntime: 'runtime',
      sumTools: 'tools',
      sumInjected: 'injections',
      sumAll: 'non-user input',
      sumSafety: 'tool hold',
      diagTitle: 'Last assembly',
      diagEmpty: 'Send a message in the current conversation to see how many sections, tools and injected messages the last turn actually had.',
      diagSections: 'System prompt sections {before} \u2192 {after}',
      diagTools: 'Tool schemas {before} \u2192 {after}',
      diagMemory: 'Memory: {state}',
      diagMemoryOn: 'on',
      diagMemoryOff: 'off',
      diagHeld: 'Tool hold: {reason}',
      diagHeldNone: 'Tool hold: not triggered',
      diagHeldFirst: 'full tools kept on the session\u2019s first request',
      diagHeldRestart: 'full tools kept for one turn after a series restart',
      diagSeriesRestarted: 'Request series: restarted this turn; system prompt rebuilt for the current mode',
      diagStripped: 'Injected messages filtered: {count}',
      diagKinds: ' ({kinds})',
      diagPath: 'Data file',
      diagCounters: 'Process totals: {assemblies} assemblies \u00b7 {stripped} filtered \u00b7 {held} held turns',
      loading: 'Reading settings\u2026',
      retry: 'Retry',
      loadFailed: 'Could not read settings',
      storeWarning: 'The settings file has a problem: {error}',
      dockLabel: 'Prompt',
      dockHint: 'This chat only: normal / chat only / custom modes',
      pureBadge: 'Chat only',
      lang: 'en',
      memoryLabel: 'Allow memory',
      memoryBadge: 'Memory',
      memoryHint: 'Read and inject SOUL.md / MEMORY.md from the current session working directory, and allow read / write / edit plus time readings by default. The model can create missing files with write.',
      memoryRuntimeHint: 'While the runtime master switch is on, memory keeps the current working directory so those files can be addressed by relative path.',
      memoryScopeHint: 'The memory switch belongs to the current mode. Normal mode keeps DSH defaults and ignores this setting.',
      memoryDefault: 'Memory default',
      memoryDefaultHint: 'These items are allowed by default while memory is on. You can still check them to suppress, but memory may stop working.',
      memoryDir: 'Memory directory',
      memoryNoDir: 'This session has no working directory; memory will not be injected',
      subItems: 'Items',
      subItemsHint: 'Collapsed by default. Checked means suppressed; while the master switch is on, unchecked items are allowed through. Items marked “Memory default” can still be checked, at the risk of breaking memory.',
      subEmpty: 'Nothing to list yet. Send a message and items observed in this chat will appear here.',
      pureSuppressTitle: 'Chat-only suppression and memory',
      pureSuppressHint: 'These switches apply to chat-only mode only. The master switch keeps the old “suppress everything” behavior; expand Items to allow one item or suppress it selectively.',
      customSuppressTitle: 'Suppression and memory',
      suppressSummaryExtra: ' ({n} item overrides)',
    };

    function tOf(props) {
      return props !== null && props !== undefined && typeof props.t === 'function' ? props.t : fallbackT;
    }

    function fmt(template, vars) {
      return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ''));
    }

    function promptModeLabel(promptMode, t) {
      if (promptMode === 'host') return t('modeHost');
      if (promptMode === 'replace') return t('modeReplace');
      return t('modeOnly');
    }

    function suppressSummary(suppress, t, config) {
      const labels = [];
      if (suppress?.runtime === true) labels.push(t('sumRuntime'));
      if (suppress?.tools === true) labels.push(t('sumTools'));
      if (suppress?.injected === true) labels.push(t('sumInjected'));
      if (suppress?.all === true) labels.push(t('sumAll'));
      if (labels.length === 0) {
        const denied = SUPPRESS_KEYS.reduce(
          (count, key) => count + (Array.isArray(config?.deny?.[key]) ? config.deny[key].length : 0),
          0,
        );
        return denied > 0 ? t('customSuppressItems') : t('customSuppressNone');
      }
      return fmt(t('customSuppressList'), { list: labels.join(' / ') });
    }

    function customModeSummary(mode, t) {
      let base = fmt(t('customSummary'), {
        mode: promptModeLabel(mode.promptMode, t),
        suppress: suppressSummary(mode.suppress, t, mode),
      });
      const overrides = overrideCount(mode);
      if (overrides > 0) base += fmt(t('suppressSummaryExtra'), { n: overrides });
      if (mode.memory === true) base += ` · ${t('memoryBadge')}`;
      if (mode.toolSafety === true) base += ` · ${t('sumSafety')}`;
      return base;
    }

    const SUPPRESS_KEYS = ['runtime', 'tools', 'injected', 'all'];
    const USER_KINDS = new Set(['user', 'user-question-reply', 'user-approval']);
    const INJECTED_KEYS = ['agent-instructions', 'time-context', 'skill-catalog', 'skill-invocation'];
    const MEMORY_DEFAULT_ALLOW = {
      runtime: ['working-directory:current'],
      tools: ['read', 'write', 'edit', 'str_replace_editor'],
      injected: ['time-context'],
      all: ['time-context', 'runtime-context'],
    };
    const TOOL_CATALOG = [
      { key: 'read', zh: '读取文件', en: 'Read file', zhHint: '记忆默认放行。', enHint: 'Allowed by default for memory.' },
      { key: 'write', zh: '写入文件', en: 'Write file', zhHint: '记忆默认放行。', enHint: 'Allowed by default for memory.' },
      { key: 'edit', zh: '编辑文件', en: 'Edit file', zhHint: '记忆默认放行。', enHint: 'Allowed by default for memory.' },
      { key: 'str_replace_editor', zh: '文本替换编辑器', en: 'Text replace editor', zhHint: '记忆的备选编辑工具，默认放行。', enHint: 'Alternative editor, allowed by default for memory.' },
      { key: 'read_image', zh: '读取图片', en: 'Read image' },
      { key: 'glob', zh: '文件匹配', en: 'Glob files' },
      { key: 'grep', zh: '内容搜索', en: 'Search contents' },
      { key: 'bash', zh: 'Bash 命令', en: 'Bash command' },
      { key: 'pwsh', zh: 'PowerShell 命令', en: 'PowerShell command' },
      { key: 'terminal_open', zh: '打开终端', en: 'Open terminal' },
      { key: 'terminal_send', zh: '终端输入', en: 'Send to terminal' },
      { key: 'terminal_read', zh: '读取终端', en: 'Read terminal' },
      { key: 'terminal_signal', zh: '终端信号', en: 'Signal terminal' },
      { key: 'terminal_close', zh: '关闭终端', en: 'Close terminal' },
      { key: 'terminal_list', zh: '终端列表', en: 'List terminals' },
      { key: 'todo_write', zh: '待办清单', en: 'Todo list' },
      { key: 'ask_user_question', zh: '询问用户', en: 'Ask user' },
      { key: 'web_search', zh: '网页搜索', en: 'Web search' },
      { key: 'web_fetch', zh: '打开网页', en: 'Fetch web page' },
      { key: 'skill', zh: '调用技能', en: 'Invoke skill' },
      { key: 'present', zh: '展示内容', en: 'Present content' },
      { key: 'schedule_create', zh: '创建定时任务', en: 'Create schedule' },
      { key: 'schedule_list', zh: '列出定时任务', en: 'List schedules' },
      { key: 'schedule_update', zh: '更新定时任务', en: 'Update schedule' },
      { key: 'schedule_delete', zh: '删除定时任务', en: 'Delete schedule' },
      { key: 'subagent', zh: '子代理', en: 'Subagent' },
      { key: 'send_message', zh: '团队消息', en: 'Team message' },
      { key: 'list_agents', zh: '列出代理', en: 'List agents' },
      { key: 'working_directory', zh: '切换工作目录', en: 'Change working directory' },
      { key: 'load_workspace_dependencies', zh: '加载工作区依赖', en: 'Load workspace dependencies' },
      { key: 'read_mcp_resource', zh: '读取 MCP 资源', en: 'Read MCP resource' },
    ];
    const RUNTIME_CATALOG = [
      { key: 'working-directory:current', zh: '工作目录', en: 'Working directory', zhHint: 'DSH 必需的当前工作目录上下文；记忆开启时默认保留。', enHint: 'DSH mandatory current working directory; kept by default for memory.' },
      { key: 'sandbox:policy', zh: '沙箱策略', en: 'Sandbox policy', zhHint: '文件与命令的沙箱权限说明。', enHint: 'Sandbox permissions for files and commands.' },
      { key: 'approval:policy', zh: '审批策略', en: 'Approval policy', zhHint: '哪些操作需要用户审批。', enHint: 'Which operations need user approval.' },
      { key: 'team:identity', zh: '团队身份', en: 'Team identity', zhHint: 'Agent Teams 的成员身份说明。', enHint: 'Agent Teams membership identity.' },
      { key: 'subagent:delegation', zh: '子代理委派', en: 'Subagent delegation', zhHint: '子代理的委派上下文。', enHint: 'Subagent delegation context.' },
      { key: 'harness-source', zh: 'Harness 源码', en: 'Harness source', zhHint: '调试用 Harness 源码路径。', enHint: 'Harness source path for development.' },
      { key: 'web-surface', zh: 'Web 面板地址', en: 'Web surface URL', zhHint: '调试用 Web GUI 地址。', enHint: 'Web GUI URL for development.' },
    ];
    const INJECTED_CATALOG = [
      { key: 'agent-instructions', zh: 'AGENTS.md / CLAUDE.md', en: 'AGENTS.md / CLAUDE.md', zhHint: '工作区指令文件。', enHint: 'Workspace instruction files.' },
      { key: 'time-context', zh: '时间读数', en: 'Time readings', zhHint: '每步的当前时间与间隔；记忆开启时默认保留。', enHint: 'Current time and elapsed time per step; kept by default for memory.' },
      { key: 'skill-catalog', zh: 'skill 目录', en: 'Skill catalog', zhHint: '可用技能列表。', enHint: 'Available skill list.' },
      { key: 'skill-invocation', zh: '/skill 调用内容', en: '/skill invocation', zhHint: '斜杠命令展开的技能正文。', enHint: 'Expanded skill text from a slash command.' },
    ];
    const ALL_CATALOG = [
      { key: 'plan-mode', zh: '计划模式提醒', en: 'Plan-mode reminder' },
      { key: 'goal', zh: '目标轮次消息', en: 'Goal round message' },
      { key: 'schedule', zh: '定时任务消息', en: 'Schedule message' },
      { key: 'session-reference', zh: '会话引用', en: 'Session reference' },
      { key: 'team-message', zh: '团队消息', en: 'Team message' },
      { key: 'agent-message', zh: '代理消息', en: 'Agent message' },
      { key: 'subagent-report', zh: '子代理报告', en: 'Subagent report' },
      { key: 'subagent-settled', zh: '子代理完成通知', en: 'Subagent settled' },
      { key: 'model-selection', zh: '模型切换提示', en: 'Model selection note' },
      { key: 'repeat-tool-reminder', zh: '重复工具提醒', en: 'Repeat tool reminder' },
      { key: 'compact-checkpoint', zh: '压缩检查点', en: 'Compaction checkpoint' },
      { key: 'webhook', zh: 'Webhook 消息', en: 'Webhook message' },
      { key: 'tmux-context', zh: '终端上下文', en: 'Terminal context' },
    ];

    function cloneFilterSet(raw) {
      const out = { runtime: [], tools: [], injected: [], all: [] };
      for (const key of SUPPRESS_KEYS) {
        out[key] = Array.isArray(raw?.[key])
          ? raw[key].filter((item) => typeof item === 'string' && item !== '')
          : [];
      }
      return out;
    }

    function overrideCount(config) {
      let count = 0;
      for (const key of SUPPRESS_KEYS) {
        count += Array.isArray(config?.allow?.[key]) ? config.allow[key].length : 0;
        count += Array.isArray(config?.deny?.[key]) ? config.deny[key].length : 0;
      }
      return count;
    }

    function itemSuppressed(config, category, key, memoryDefault) {
      if (memoryDefault === true) {
        return (config?.deny?.[category] ?? []).includes(key);
      }
      if (config?.suppress?.[category] === true) {
        return !(config.allow?.[category] ?? []).includes(key);
      }
      return (config?.deny?.[category] ?? []).includes(key);
    }

    function setSuppressMaster(config, category, value) {
      if (config?.suppress === undefined || config?.allow === undefined || config?.deny === undefined) return;
      config.suppress[category] = value === true;
      config.allow[category] = [];
      config.deny[category] = [];
    }

    function setSuppressItem(config, category, key, suppressed, itemKeys, memoryDefault, memoryKeys) {
      if (config?.suppress === undefined || config?.allow === undefined || config?.deny === undefined) return;
      if (typeof key !== 'string' || key === '') return;
      if (memoryDefault === true) {
        const deny = Array.isArray(config.deny[category]) ? config.deny[category] : [];
        if (suppressed === true) {
          if (!deny.includes(key)) config.deny[category] = [...deny, key];
        } else {
          config.deny[category] = deny.filter((item) => item !== key);
        }
        return;
      }
      if (config.suppress[category] === true) {
        const allow = Array.isArray(config.allow[category]) ? config.allow[category] : [];
        if (suppressed === true) config.allow[category] = allow.filter((item) => item !== key);
        else if (!allow.includes(key)) config.allow[category] = [...allow, key];
      } else {
        const deny = Array.isArray(config.deny[category]) ? config.deny[category] : [];
        if (suppressed === true) {
          if (!deny.includes(key)) config.deny[category] = [...deny, key];
        } else {
          config.deny[category] = deny.filter((item) => item !== key);
        }
      }
      if (config.suppress[category] !== true && Array.isArray(itemKeys) && itemKeys.length > 0) {
        const deny = config.deny[category] ?? [];
        if (itemKeys.every((item) => deny.includes(item))) {
          const keepDeny = (Array.isArray(memoryKeys) ? memoryKeys : [])
            .filter((item) => deny.includes(item));
          config.suppress[category] = true;
          config.allow[category] = [];
          config.deny[category] = keepDeny;
        }
      }
    }

    function itemCatalog(category, extras, lang, memory) {
      const catalogs = {
        runtime: RUNTIME_CATALOG,
        tools: TOOL_CATALOG,
        injected: INJECTED_CATALOG,
        all: ALL_CATALOG,
      };
      const base = catalogs[category] ?? [];
      const known = new Set(base.map((item) => item.key));
      const extraKeys = [];
      for (const key of Array.isArray(extras) ? extras : []) {
        if (typeof key !== 'string' || key === '' || known.has(key)) continue;
        if (category === 'all' && USER_KINDS.has(key)) continue;
        if (category === 'all' && (key === 'runtime-context' || INJECTED_KEYS.includes(key))) continue;
        known.add(key);
        extraKeys.push(key);
      }
      const items = [...base, ...extraKeys.map((key) => ({ key }))];
      return items.map((item) => ({
        key: item.key,
        label: lang === 'en' ? (item.en ?? item.key) : (item.zh ?? item.key),
        hint: lang === 'en' ? (item.enHint ?? '') : (item.zhHint ?? ''),
        memoryDefault: memory === true && (MEMORY_DEFAULT_ALLOW[category] ?? []).includes(item.key),
      }));
    }

    function buildModeItems(t, config) {
      const items = [
        { value: 'normal', label: t('modeNormal'), hint: t('modeNormalHint'), dot: '#2f7cf6' },
        {
          value: 'pure',
          label: t('modePure'),
          hint: config?.memory === true ? `${t('modePureHint')} · ${t('memoryBadge')}` : t('modePureHint'),
          dot: '#19b8a6',
        },
      ];
      const modes = Array.isArray(config?.modes) ? config.modes : [];
      for (const mode of modes) {
        items.push({
          value: `custom:${mode.id}`,
          label: mode.name,
          hint: customModeSummary(mode, t),
          dot: '#a855f7',
        });
      }
      return items;
    }

    function ActionButton(props) {
      const { variant = 'outline', size = 'sm', style, type = 'button', ...rest } = props;
      if (HostButton !== null) {
        return h(HostButton, {
          variant,
          size,
          type,
          ...rest,
          ...(style === undefined ? {} : { style }),
        });
      }
      return h('button', {
        type,
        ...rest,
        style: {
          ...S.button,
          ...(variant === 'primary' ? S.buttonPrimary : {}),
          ...(style ?? {}),
        },
      });
    }

    async function api(path, init) {
      const headers = { ...(init?.headers ?? {}) };
      if (init?.body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(ROUTE + path, { ...(init ?? {}), headers });
      const raw = await response.text();
      let payload = null;
      try {
        payload = raw === '' ? null : JSON.parse(raw);
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload !== null && typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}`);
      }
      if (payload === null || typeof payload !== 'object') {
        throw new Error('响应不是合法的 JSON 对象');
      }
      return payload;
    }

    function cloneConfig(config) {
      return {
        prompt: {
          mode: ['host', 'replace', 'only'].includes(config?.prompt?.mode) ? config.prompt.mode : 'host',
          text: typeof config?.prompt?.text === 'string' ? config.prompt.text : '',
        },
        suppress: {
          runtime: config?.suppress?.runtime === true,
          tools: config?.suppress?.tools === true,
          injected: config?.suppress?.injected === true,
          all: config?.suppress?.all === true,
        },
        allow: cloneFilterSet(config?.allow),
        deny: cloneFilterSet(config?.deny),
        memory: config?.memory === true,
        toolSafety: config?.toolSafety === true,
      };
    }

    function sameConfig(left, right) {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    function stateQuery(sessionId) {
      return sessionId === '' ? '' : `?session=${encodeURIComponent(sessionId)}`;
    }

    function useSessionsSnapshot() {
      const service = sessionsHolder.service;
      const [, force] = React.useState(0);
      React.useEffect(() => {
        const store = service?.list;
        if (store === null || store === undefined || typeof store.subscribe !== 'function') return undefined;
        return store.subscribe(() => force((n) => n + 1));
      }, [service]);
      let snapshot = null;
      try {
        snapshot = service?.list?.getSnapshot?.() ?? null;
      } catch {
        snapshot = null;
      }
      return snapshot;
    }

    function pickMainSessionId(state) {
      if (state === null || state === undefined || typeof state !== 'object') return '';
      if (typeof state.current === 'string' && state.current !== '') return state.current;
      const byId = state.byId;
      if (byId === null || byId === undefined || typeof byId !== 'object') return '';
      for (const row of Object.values(byId)) {
        if (row === null || row === undefined) continue;
        const mainView = row.retainedBy?.mainView;
        if (typeof mainView !== 'number' || mainView <= 0) continue;
        if (typeof row.id === 'string' && row.id !== '') return row.id;
        if (typeof row.sessionId === 'string' && row.sessionId !== '') return row.sessionId;
      }
      return '';
    }

    function useMainSessionId() {
      return pickMainSessionId(useSessionsSnapshot());
    }

    const DARK_THEME_VARS = {
      '--dsw-alias-bg-base': '#151517',
      '--dsw-alias-bg-layer-1': '#232324',
      '--dsw-alias-bg-layer-2': '#2c2c2e',
      '--dsw-alias-bg-layer-3': '#353638',
      '--dsw-alias-label-primary': '#f5f6f7',
      '--dsw-alias-label-secondary': '#cfd3d6',
      '--dsw-alias-label-tertiary': '#adb2b8',
      '--dsw-alias-label-caption': '#81858c',
      '--dsw-alias-label-dimmed': '#3c3c3d',
      '--dsw-alias-interactive-bg-hover': 'rgba(255,255,255,0.08)',
      '--dsw-alias-interactive-bg-active': 'rgba(255,255,255,0.14)',
      '--dsw-alias-border-l1': 'rgba(255,255,255,0.06)',
      '--dsw-alias-border-l2': 'rgba(255,255,255,0.12)',
      '--dsw-alias-border-l3': 'rgba(255,255,255,0.16)',
      '--dsw-alias-border-l4': 'rgba(255,255,255,0.20)',
      '--dsw-alias-button-primary-fill': '#f5f6f7',
      '--dsw-alias-button-primary-hover': '#ebeef2',
      '--dsw-alias-label-primary-foreground': '#0f1115',
      '--dsw-alias-state-business-primary': '#4d93f8',
      '--dsw-alias-menu-icon': '#cfd3d6',
      '--dsw-specific-menu': 'rgba(67,69,74,0.45)',
      '--dsw-alias-switch-thumb': '#adb2b8',
    };

    const LIGHT_THEME_VARS = {
      '--dsw-alias-bg-base': '#ffffff',
      '--dsw-alias-bg-layer-1': '#ffffff',
      '--dsw-alias-bg-layer-2': '#ffffff',
      '--dsw-alias-bg-layer-3': '#ffffff',
      '--dsw-alias-label-primary': '#0f1115',
      '--dsw-alias-label-secondary': '#61666b',
      '--dsw-alias-label-tertiary': '#81858c',
      '--dsw-alias-label-caption': '#adb2b8',
      '--dsw-alias-label-dimmed': '#e1e5ee',
      '--dsw-alias-interactive-bg-hover': 'rgba(38,49,72,0.06)',
      '--dsw-alias-interactive-bg-active': 'rgba(38,49,72,0.10)',
      '--dsw-alias-border-l1': 'rgba(0,0,0,0.04)',
      '--dsw-alias-border-l2': 'rgba(0,0,0,0.10)',
      '--dsw-alias-border-l3': 'rgba(0,0,0,0.12)',
      '--dsw-alias-border-l4': 'rgba(0,0,0,0.16)',
      '--dsw-alias-button-primary-fill': '#0f1115',
      '--dsw-alias-button-primary-hover': '#3c3c3d',
      '--dsw-alias-label-primary-foreground': '#ffffff',
      '--dsw-alias-state-business-primary': '#4176e6',
      '--dsw-alias-menu-icon': '#353638',
      '--dsw-specific-menu': 'rgba(248,249,250,0.58)',
      '--dsw-alias-switch-thumb': '#ffffff',
    };

    const SEGMENT_CSS = [
      '.dsh-ps-seg-dark{background:rgba(255,255,255,0.08)!important;}',
      '.dsh-ps-seg-dark>span{background:#232324!important;box-shadow:0 1px 3px rgba(0,0,0,0.45)!important;}',
      '.dsh-ps-seg-dark button{color:#cfd3d6!important;}',
      '.dsh-ps-seg-dark button[aria-selected="true"]{color:#f5f6f7!important;}',
      '.dsh-ps-seg-light{background:rgba(38,49,72,0.06)!important;}',
      '.dsh-ps-seg-light>span{background:#ffffff!important;box-shadow:0 1px 3px rgba(0,0,0,0.12)!important;}',
      '.dsh-ps-seg-light button{color:#61666b!important;}',
      '.dsh-ps-seg-light button[aria-selected="true"]{color:#0f1115!important;}',
    ].join('');

    function settingsThemeStyles(scheme) {
      const dark = scheme === 'dark';
      return {
        color: dark ? '#f5f6f7' : '#0f1115',
        vars: dark ? DARK_THEME_VARS : LIGHT_THEME_VARS,
        card: {
          background: dark ? '#232324' : '#ffffff',
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
        },
        textarea: {
          background: dark ? '#232324' : '#ffffff',
          color: dark ? '#f5f6f7' : '#0f1115',
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.16)'}`,
          colorScheme: dark ? 'dark' : 'light',
        },
        textareaFocus: {
          borderColor: dark ? '#4d93f8' : '#4176e6',
        },
        input: {
          background: dark ? '#232324' : '#ffffff',
          color: dark ? '#f5f6f7' : '#0f1115',
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.16)'}`,
          colorScheme: dark ? 'dark' : 'light',
        },
        inputFocus: {
          borderColor: dark ? '#4d93f8' : '#4176e6',
        },
        fallbackSelect: {
          background: dark ? '#232324' : '#ffffff',
          color: dark ? '#f5f6f7' : '#0f1115',
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.16)'}`,
          colorScheme: dark ? 'dark' : 'light',
        },
        segClass: dark ? 'dsh-ps-seg-dark' : 'dsh-ps-seg-light',
      };
    }

    const S = {
      root: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 },
      h2: { margin: 0, fontSize: 18, fontWeight: 600, lineHeight: '26px' },
      h3: { margin: 0, fontSize: 14, fontWeight: 600, lineHeight: '22px' },
      sub: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      card: {
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      },
      row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      grow: { flex: '1 1 auto', minWidth: 0 },
      button: {
        font: 'inherit',
        fontSize: 13,
        padding: '5px 10px',
        borderRadius: 8,
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.4))',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      buttonPrimary: {
        font: 'inherit',
        fontSize: 13,
        padding: '5px 10px',
        borderRadius: 8,
        border: 'none',
        background: 'var(--dsw-alias-button-primary-fill, rgba(47,124,246,0.16))',
        color: 'var(--dsw-alias-label-primary-foreground, inherit)',
        cursor: 'pointer',
      },
      menuTriggerLabel: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        maxWidth: 220,
      },
      menuChevron: { fontSize: 9, opacity: 0.75, lineHeight: 1, flex: 'none' },
      menuDot: { width: 6, height: 6, borderRadius: '50%', flex: 'none' },
      fallbackSelect: {
        font: 'inherit',
        fontSize: 12,
        height: 28,
        padding: '0 8px',
        borderRadius: 8,
        maxWidth: 280,
      },
      textarea: {
        font: '13px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        padding: '8px 10px',
        borderRadius: 8,
        boxSizing: 'border-box',
        resize: 'none',
        minHeight: 240,
        width: '100%',
        outline: 'none',
      },
      input: {
        font: 'inherit',
        fontSize: 13,
        height: 32,
        padding: '0 10px',
        borderRadius: 8,
        boxSizing: 'border-box',
        width: '100%',
        outline: 'none',
      },
      modeList: { display: 'flex', flexDirection: 'column' },
      modeRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        borderTop: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))',
      },
      modeNameRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
      modeName: {
        fontSize: 13,
        fontWeight: 600,
        lineHeight: '20px',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      modeSummary: {
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary, #61666b)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      editor: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28))',
        background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.04))',
      },
      switchRow: { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, lineHeight: '20px' },
      switchText: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
      switchLabel: { fontWeight: 500 },
      switchHint: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      switchCost: { fontSize: 12, lineHeight: '18px', color: 'rgba(220,150,60,0.98)' },
      suppressGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 0',
        borderTop: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))',
      },
      suppressHead: { display: 'flex', alignItems: 'flex-start', gap: 10 },
      subToggle: {
        font: 'inherit',
        fontSize: 12,
        lineHeight: '20px',
        padding: '0 2px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-state-business-primary, #4176e6)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flex: 'none',
      },
      subList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        marginLeft: 22,
        padding: '6px 9px 8px',
        borderLeft: '2px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28))',
        background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.04))',
        borderRadius: '0 6px 6px 0',
        maxHeight: 280,
        overflowY: 'auto',
      },
      subRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        fontSize: 12.5,
        lineHeight: '18px',
        cursor: 'pointer',
      },
      subText: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
      subLabel: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
      subBadge: {
        fontSize: 10,
        lineHeight: '14px',
        padding: '0 5px',
        borderRadius: 999,
        border: '1px solid rgba(25,184,166,0.55)',
        background: 'rgba(25,184,166,0.12)',
        whiteSpace: 'nowrap',
      },
      badge: {
        fontSize: 11,
        lineHeight: '16px',
        padding: '1px 6px',
        borderRadius: 999,
        border: '1px solid rgba(127,127,127,0.4)',
        opacity: 0.85,
        whiteSpace: 'nowrap',
      },
      badgeBlue: { borderColor: 'rgba(47,124,246,0.55)', background: 'rgba(47,124,246,0.12)' },
      badgeGreen: { borderColor: 'rgba(25,184,166,0.55)', background: 'rgba(25,184,166,0.12)' },
      notice: {
        fontSize: 13,
        lineHeight: '20px',
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(25,184,166,0.45)',
        background: 'rgba(25,184,166,0.10)',
      },
      error: {
        fontSize: 13,
        lineHeight: '20px',
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(220,80,80,0.5)',
        background: 'rgba(220,80,80,0.10)',
      },
      warn: {
        fontSize: 12,
        lineHeight: '18px',
        padding: '6px 9px',
        borderRadius: 8,
        border: '1px solid rgba(220,150,60,0.45)',
        background: 'rgba(220,150,60,0.10)',
      },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #81858c)', wordBreak: 'break-all' },
      diag: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, lineHeight: '19px' },
      dock: {
        boxSizing: 'border-box',
        width: 'calc(100% - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))',
        maxWidth: 'calc(var(--dsh-composer-card-max-width, 952px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))',
        margin: '0 auto var(--dsh-composer-stack-gap, 6px)',
        padding: '0 var(--dsh-composer-dock-inset, 8px)',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        opacity: 0.9,
        minHeight: 24,
      },
      dockLabel: { color: 'var(--dsw-alias-label-secondary, #61666b)' },
      dot: (mode) => ({
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: String(mode ?? '').startsWith('custom:')
          ? '#a855f7'
          : mode === 'pure'
            ? '#19b8a6'
            : '#2f7cf6',
        flex: 'none',
      }),
    };

    function Banner(props) {
      if (typeof props?.text !== 'string' || props.text === '') return null;
      return h('div', { style: props.kind === 'error' ? S.error : S.notice, role: props.kind === 'error' ? 'alert' : 'status' }, props.text);
    }

    function Toggle(props) {
      return h(
        'label',
        { style: S.switchRow, 'data-switch': props.id },
        h('input', {
          type: 'checkbox',
          checked: props.checked === true,
          disabled: props.disabled === true,
          onChange: (event) => props.onChange(event.target.checked),
          style: { marginTop: 2, flex: 'none' },
        }),
        h(
          'span',
          { style: S.switchText },
          h('span', { style: S.switchLabel }, props.label),
          props.hint ? h('span', { style: S.switchHint }, props.hint) : null,
          props.cost ? h('span', { style: S.switchCost }, props.cost) : null,
        ),
      );
    }

    function SuppressGroup(props) {
      const t = tOf(props);
      const [open, setOpen] = React.useState(false);
      const items = Array.isArray(props.items) ? props.items : [];
      const master = props.config?.suppress?.[props.category] === true;
      const count = items.filter(
        (item) => itemSuppressed(props.config, props.category, item.key, item.memoryDefault),
      ).length;
      return h(
        'div',
        { style: S.suppressGroup, 'data-suppress-group': props.category },
        h(
          'div',
          { style: S.suppressHead },
          h(
            'div',
            { style: S.grow },
            h(Toggle, {
              id: `suppress-${props.category}-master`,
              checked: master,
              label: props.label,
              hint: props.hint,
              onChange: (value) => props.onMaster(value),
            }),
          ),
          h(
            'button',
            {
              type: 'button',
              style: S.subToggle,
              'aria-expanded': open ? 'true' : 'false',
              'data-suppress-toggle': props.category,
              onClick: () => setOpen((previous) => !previous),
            },
            `${t('subItems')} ${count}/${items.length} ${open ? '▴' : '▾'}`,
          ),
        ),
        open
          ? h(
              'div',
              { style: S.subList, 'data-suppress-items': props.category },
              h('p', { style: { ...S.switchHint, margin: 0 } }, t('subItemsHint')),
              items.length === 0
                ? h('p', { style: { ...S.switchHint, margin: 0 } }, t('subEmpty'))
                : items.map((item) => {
                    const memoryDefault = item.memoryDefault === true;
                    const checked = itemSuppressed(props.config, props.category, item.key, memoryDefault);
                    return h(
                      'label',
                      {
                        key: item.key,
                        style: S.subRow,
                        title: memoryDefault ? t('memoryDefaultHint') : undefined,
                      },
                      h('input', {
                        type: 'checkbox',
                        checked,
                        onChange: (event) => props.onItem(item.key, event.target.checked, memoryDefault),
                        style: { marginTop: 2, flex: 'none' },
                      }),
                      h(
                        'span',
                        { style: S.subText },
                        h(
                          'span',
                          { style: S.subLabel },
                          item.label,
                          memoryDefault ? h('span', { style: S.subBadge }, t('memoryDefault')) : null,
                        ),
                        item.hint ? h('span', { style: S.switchHint }, item.hint) : null,
                      ),
                    );
                  }),
            )
          : null,
      );
    }

    function ModeMenu(props) {
      const t = tOf(props);
      const items = Array.isArray(props.items) ? props.items : [];
      const value = items.some((item) => item.value === props.value)
        ? props.value
        : (items[0]?.value ?? '');
      const disabled = props.disabled === true || items.length === 0;
      const [open, setOpen] = React.useState(false);
      const selected = items.find((item) => item.value === value) ?? items[0];
      const label = selected?.displayLabel ?? selected?.label ?? '';
      const title = props.title ?? selected?.hint ?? t('dockHint');
      if (items.length === 0) return null;
      const toggle = () => {
        if (!disabled) setOpen((previous) => !previous);
      };
      const anchor = HostButton !== null
        ? h(
            HostButton,
            {
              variant: props.triggerVariant === 'outline' ? 'outline' : 'ghost',
              size: 'sm',
              type: 'button',
              disabled,
              'aria-haspopup': 'menu',
              'aria-expanded': open ? 'true' : 'false',
              'aria-label': `${t('dockLabel')}: ${label}`,
              title,
              'data-mode-menu-trigger': props.dataName ?? '1',
              onClick: toggle,
            },
            h('span', { style: S.menuTriggerLabel }, label),
            h('span', { style: S.menuChevron, 'aria-hidden': 'true' }, open ? '▴' : '▾'),
          )
        : h(
            'button',
            {
              type: 'button',
              disabled,
              style: S.button,
              'aria-haspopup': 'menu',
              'aria-expanded': open ? 'true' : 'false',
              'aria-label': `${t('dockLabel')}: ${label}`,
              title,
              'data-mode-menu-trigger': props.dataName ?? '1',
              onClick: toggle,
            },
            h('span', { style: S.menuTriggerLabel }, label),
            h('span', { style: S.menuChevron, 'aria-hidden': 'true' }, open ? '▴' : '▾'),
          );

      if (HostMenu === null) {
        const fallbackTheme = settingsThemeStyles(themeHolder.scheme).fallbackSelect;
        return h(
          'select',
          {
            style: { ...S.fallbackSelect, ...fallbackTheme },
            value,
            disabled,
            title,
            'data-mode-menu-trigger': props.dataName ?? '1',
            onChange: (event) => {
              const next = event.target.value;
              if (next !== value) props.onChange?.(next);
            },
          },
          items.map((item) => h('option', { key: item.value, value: item.value }, item.label)),
        );
      }

      const menuItems = items.map((item) => ({
        id: item.value,
        label: item.label,
        icon: h('span', { style: { ...S.menuDot, background: item.dot }, 'aria-hidden': 'true' }),
        disabled,
      }));
      return h(HostMenu, {
        open,
        anchor,
        items: menuItems,
        selectedId: value,
        onSelect: (id) => {
          setOpen(false);
          if (id !== value) props.onChange?.(id);
        },
        onClose: () => setOpen(false),
        side: props.side ?? 'bottom',
        align: 'start',
        portal: true,
        compact: props.compact === true,
      });
    }

    function SettingsPage(props) {
      const t = tOf(props);
      const lang = t('lang') === 'en' ? 'en' : 'zh';
      const mainSessionId = useMainSessionId();
      const [data, setData] = React.useState(null);
      const [baseline, setBaseline] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [status, setStatus] = React.useState('loading');
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [defaultBusy, setDefaultBusy] = React.useState(false);
      const [modeBusy, setModeBusy] = React.useState(false);
      const [editor, setEditor] = React.useState(null);
      const [editorFocus, setEditorFocus] = React.useState('');
      const [promptFocus, setPromptFocus] = React.useState(false);
      const rootRef = React.useRef(null);
      const scheme = useThemeScheme();
      const themeStyles = settingsThemeStyles(scheme);
      const cardStyle = { ...S.card, ...themeStyles.card };
      const pageStyle = { ...S.root, color: themeStyles.color, colorScheme: scheme, ...themeStyles.vars };
      const dirtyRef = React.useRef(false);
      const dirty = draft !== null && baseline !== null && !sameConfig(draft, baseline);

      React.useEffect(() => {
        dirtyRef.current = dirty;
      }, [dirty]);

      const load = React.useCallback(async (keepDraft) => {
        setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
        try {
          const payload = await api(`/state${stateQuery(mainSessionId)}`);
          setData(payload);
          const nextBaseline = cloneConfig(payload.config);
          setBaseline(nextBaseline);
          if (keepDraft !== true || dirtyRef.current !== true) setDraft(cloneConfig(payload.config));
          setError('');
          setStatus('ready');
        } catch (problem) {
          setError(problem?.message ?? String(problem));
          setStatus((previous) => (previous === 'ready' ? 'ready' : 'error'));
        }
      }, [mainSessionId]);

      React.useEffect(() => {
        load(false);
      }, [load]);

      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
        const onChanged = () => load(true);
        window.addEventListener(CHANGED_EVENT, onChanged);
        return () => window.removeEventListener(CHANGED_EVENT, onChanged);
      }, [load]);

      const update = (mutator) => {
        setDraft((previous) => {
          if (previous === null) return previous;
          const next = cloneConfig(previous);
          mutator(next);
          return next;
        });
        setNotice('');
      };

      const persist = async (nextDraft, message) => {
        setSaving(true);
        setError('');
        try {
          const payload = await api(`/settings${stateQuery(mainSessionId)}`, {
            method: 'PUT',
            body: JSON.stringify({
              prompt: { mode: 'only', text: nextDraft.prompt.text },
              suppress: nextDraft.suppress,
              allow: nextDraft.allow,
              deny: nextDraft.deny,
              memory: nextDraft.memory,
              toolSafety: nextDraft.toolSafety,
            }),
          });
          setData(payload);
          const nextBaseline = cloneConfig(payload.config);
          setBaseline(nextBaseline);
          setDraft(cloneConfig(payload.config));
          setNotice(message ?? t('saved'));
          setStatus('ready');
          dirtyRef.current = false;
          notifyChanged();
        } catch (problem) {
          setError(`${t('saveFailed')}：${problem?.message ?? String(problem)}`);
        } finally {
          setSaving(false);
        }
      };

      const loadDefault = async () => {
        if (draft === null) return;
        if (draft.prompt.text.trim() !== '' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (window.confirm(t('confirmLoadDefault')) !== true) return;
        }
        try {
          const payload = await api(`/default-prompt${stateQuery(mainSessionId)}`);
          update((next) => {
            next.prompt.mode = 'only';
            next.prompt.text = typeof payload.text === 'string' ? payload.text : '';
          });
          setNotice(t('defaultLoaded'));
        } catch (problem) {
          setError(`${t('defaultFailed')}：${problem?.message ?? String(problem)}`);
        }
      };

      const clearPrompt = () => {
        if (draft === null) return;
        if (draft.prompt.text.trim() !== '' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (window.confirm(t('confirmClear')) !== true) return;
        }
        update((next) => {
          next.prompt.text = '';
        });
        setNotice(t('cleared'));
      };

      const saveDefaultMode = async (mode) => {
        if (mode === '' || mode === data?.config?.defaultMode) return;
        setDefaultBusy(true);
        setError('');
        try {
          const payload = await api(`/settings${stateQuery(mainSessionId)}`, {
            method: 'PUT',
            body: JSON.stringify({ defaultMode: mode }),
          });
          setData(payload);
          setNotice(t('defaultModeSaved'));
          notifyChanged();
        } catch (problem) {
          setError(`${t('saveFailed')}：${problem?.message ?? String(problem)}`);
        } finally {
          setDefaultBusy(false);
        }
      };

      const openCreateMode = () => {
        if (draft === null) return;
        const count = Array.isArray(data?.config?.modes) ? data.config.modes.length : 0;
        setEditor({
          id: '',
          name: fmt(t('customNewName'), { n: count + 1 }),
          promptMode: 'only',
          promptText: draft.prompt.text,
          suppress: { runtime: false, tools: false, injected: false, all: false },
          allow: { runtime: [], tools: [], injected: [], all: [] },
          deny: { runtime: [], tools: [], injected: [], all: [] },
          memory: false,
          toolSafety: false,
        });
        setEditorFocus('');
        setError('');
        setNotice('');
      };

      const openEditMode = (mode) => {
        setEditor({
          id: mode.id,
          name: mode.name,
          promptMode: mode.promptMode,
          promptText: mode.promptText,
          suppress: { ...mode.suppress },
          allow: cloneFilterSet(mode.allow),
          deny: cloneFilterSet(mode.deny),
          memory: mode.memory === true,
          toolSafety: mode.toolSafety === true,
        });
        setEditorFocus('');
        setError('');
        setNotice('');
      };

      const updateEditor = (mutator) => {
        setEditor((previous) => {
          if (previous === null) return previous;
          const next = {
            ...previous,
            suppress: { ...previous.suppress },
            allow: cloneFilterSet(previous.allow),
            deny: cloneFilterSet(previous.deny),
          };
          mutator(next);
          return next;
        });
        setNotice('');
      };

      const saveEditor = async () => {
        if (editor === null || modeBusy) return;
        if (editor.name.trim() === '') {
          setError(t('customNameRequired'));
          return;
        }
        setModeBusy(true);
        setError('');
        try {
          const query = stateQuery(mainSessionId);
          const path = editor.id === ''
            ? `/modes${query}`
            : `/modes/${encodeURIComponent(editor.id)}${query}`;
          const payload = await api(path, {
            method: editor.id === '' ? 'POST' : 'PUT',
            body: JSON.stringify({
              name: editor.name,
              promptMode: editor.promptMode,
              promptText: editor.promptText,
              suppress: editor.suppress,
              allow: editor.allow,
              deny: editor.deny,
              memory: editor.memory,
              toolSafety: editor.toolSafety,
            }),
          });
          setData(payload);
          setEditor(null);
          setEditorFocus('');
          setNotice(t('customSaved'));
          notifyChanged();
        } catch (problem) {
          setError(`${t('saveFailed')}：${problem?.message ?? String(problem)}`);
        } finally {
          setModeBusy(false);
        }
      };

      const deleteMode = async (mode) => {
        if (modeBusy) return;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (window.confirm(fmt(t('customDeleteConfirm'), { name: mode.name })) !== true) return;
        }
        setModeBusy(true);
        setError('');
        try {
          const payload = await api(`/modes/${encodeURIComponent(mode.id)}${stateQuery(mainSessionId)}`, {
            method: 'DELETE',
          });
          setData(payload);
          if (editor !== null && editor.id === mode.id) setEditor(null);
          setNotice(t('customDeleted'));
          notifyChanged();
        } catch (problem) {
          setError(`${t('saveFailed')}：${problem?.message ?? String(problem)}`);
        } finally {
          setModeBusy(false);
        }
      };

      const renderMemoryToggle = (id, config, mutator) => h(
        'div',
        { style: S.switchText },
        h(Toggle, {
          id,
          checked: config.memory === true,
          label: t('memoryLabel'),
          hint: t('memoryHint'),
          onChange: (value) => mutator((next) => {
            next.memory = value === true;
          }),
        }),
        config.memory === true ? h('p', { style: { ...S.switchHint, margin: 0 } }, t('memoryRuntimeHint')) : null,
        h('p', { style: { ...S.switchHint, margin: 0 } }, t('memoryScopeHint')),
        h(
          'p',
          { style: { ...S.mono, margin: 0 } },
          data?.memoryRoot
            ? `${t('memoryDir')}：${data.memoryRoot}`
            : t('memoryNoDir'),
        ),
      );

      const renderSuppressGroups = (config, mutator) => {
        const extras = {
          runtime: data?.last?.runtimeNames ?? [],
          tools: data?.last?.toolNames ?? [],
          injected: [],
          all: data?.last?.messageKinds ?? [],
        };
        return SUPPRESS_KEYS.map((category) => {
          const items = itemCatalog(category, extras[category], lang, config.memory === true);
          const normalKeys = items.filter((item) => item.memoryDefault !== true).map((item) => item.key);
          const memoryKeys = items.filter((item) => item.memoryDefault === true).map((item) => item.key);
          return h(SuppressGroup, {
            key: category,
            t,
            lang,
            category,
            config,
            label: category === 'runtime'
              ? t('swRuntime')
              : category === 'tools'
                ? t('swTools')
                : category === 'injected'
                  ? t('swInjected')
                  : t('swAll'),
            hint: category === 'runtime'
              ? t('swRuntimeHint')
              : category === 'tools'
                ? t('swToolsHint')
                : category === 'injected'
                  ? t('swInjectedHint')
                  : t('swAllHint'),
            items,
            onMaster: (value) => mutator((next) => setSuppressMaster(next, category, value)),
            onItem: (key, value, memoryDefault) => mutator(
              (next) => setSuppressItem(next, category, key, value, normalKeys, memoryDefault, memoryKeys),
            ),
          });
        });
      };

      const renderEditor = () => {
        if (editor === null) return null;
        const promptHint = editor.promptMode === 'only'
          ? t('modeOnlyHint')
          : editor.promptMode === 'replace'
            ? t('modeReplaceHint')
            : t('modeHostHint');
        const promptModes = [
          { value: 'host', label: t('modeHost') },
          { value: 'only', label: t('modeOnly') },
          { value: 'replace', label: t('modeReplace') },
        ];
        return h(
          'div',
          { style: S.editor, 'data-mode-editor': editor.id === '' ? 'new' : editor.id },
          h('h4', { style: { ...S.h3, margin: 0 } }, editor.id === '' ? t('customEditorTitleNew') : t('customEditorTitleEdit')),
          h(
            'div',
            { style: S.switchText },
            h('span', { style: S.switchLabel }, t('customName')),
            h('input', {
              style: {
                ...S.input,
                ...themeStyles.input,
                ...(editorFocus === 'name' ? themeStyles.inputFocus : {}),
              },
              value: editor.name,
              placeholder: t('customNamePlaceholder'),
              maxLength: 60,
              spellCheck: false,
              onFocus: () => setEditorFocus('name'),
              onBlur: () => setEditorFocus(''),
              onChange: (event) => updateEditor((next) => {
                next.name = event.target.value;
              }),
              'data-mode-name': '1',
            }),
          ),
          h(
            'div',
            { style: S.switchText },
            h('span', { style: S.switchLabel }, t('customPromptTitle')),
            HostSegmentedControl !== null
              ? h(HostSegmentedControl, {
                  id: 'prompt-studio-custom-prompt-mode',
                  value: editor.promptMode,
                  options: promptModes,
                  onChange: (value) => updateEditor((next) => {
                    next.promptMode = value;
                  }),
                  label: t('customPromptTitle'),
                  className: themeStyles.segClass,
                })
              : h(
                  'select',
                  {
                    style: { ...S.fallbackSelect, ...themeStyles.fallbackSelect },
                    value: editor.promptMode,
                    onChange: (event) => updateEditor((next) => {
                      next.promptMode = event.target.value;
                    }),
                  },
                  promptModes.map((item) => h('option', { key: item.value, value: item.value }, item.label)),
                ),
            h('span', { style: S.switchHint }, promptHint),
          ),
          h('textarea', {
            style: {
              ...S.textarea,
              ...themeStyles.textarea,
              minHeight: 140,
              ...(editorFocus === 'prompt' ? themeStyles.textareaFocus : {}),
            },
            value: editor.promptText,
            placeholder: t('promptPlaceholder'),
            spellCheck: false,
            disabled: editor.promptMode === 'host',
            onFocus: () => setEditorFocus('prompt'),
            onBlur: () => setEditorFocus(''),
            onChange: (event) => updateEditor((next) => {
              next.promptText = event.target.value;
            }),
            'data-mode-prompt': '1',
          }),
          h(
            'div',
            { style: S.row },
            h('span', { style: S.mono }, fmt(t('chars'), { n: editor.promptText.length })),
            editor.promptMode !== 'host' && editor.promptText.trim() === ''
              ? h('span', { style: S.switchCost }, t('customEmptyPrompt'))
              : null,
          ),
          h('h4', { style: { ...S.h3, margin: 0 } }, t('customSuppressTitle')),
          renderMemoryToggle('custom-memory', editor, updateEditor),
          ...renderSuppressGroups(editor, updateEditor),
          h(Toggle, {
            id: 'custom-toolSafety',
            checked: editor.toolSafety,
            disabled: !editor.suppress.tools,
            label: t('swSafety'),
            hint: t('swSafetyHint'),
            cost: editor.toolSafety ? t('swSafetyCost') : '',
            onChange: (value) => updateEditor((next) => {
              next.toolSafety = value;
            }),
          }),
          h(
            'div',
            { style: S.row },
            h(ActionButton, { variant: 'primary', onClick: saveEditor, disabled: modeBusy }, modeBusy ? t('saving') : t('customSave')),
            h(
              ActionButton,
              {
                variant: 'ghost',
                disabled: modeBusy,
                onClick: () => {
                  setEditor(null);
                  setEditorFocus('');
                },
              },
              t('customCancel'),
            ),
          ),
        );
      };

      if (status === 'loading' && data === null) {
        return h('div', { ref: rootRef, style: pageStyle, 'data-plugin': 'dsh-prompt-studio' }, h('p', { style: S.sub }, t('loading')));
      }
      if (status === 'error' && data === null) {
        return h(
          'div',
          { ref: rootRef, style: pageStyle, 'data-plugin': 'dsh-prompt-studio' },
          h('h2', { style: S.h2 }, t('title')),
          h(Banner, { kind: 'error', text: `${t('loadFailed')}：${error}` }),
          h('div', { style: S.row }, h(ActionButton, { variant: 'outline', onClick: () => load(false) }, t('retry'))),
        );
      }
      if (data === null || draft === null) return null;

      const last = data.last;
      const config = data.config ?? {};
      const modes = Array.isArray(config.modes) ? config.modes : [];
      const defaultMode = typeof config.defaultMode === 'string' ? config.defaultMode : 'normal';
      const modeItems = buildModeItems(t, config);
      const defaultLabel = modeItems.find((item) => item.value === defaultMode)?.label ?? t('modeNormal');

      return h(
        'div',
        { ref: rootRef, style: pageStyle, 'data-plugin': 'dsh-prompt-studio' },
        h('style', null, SEGMENT_CSS),
        h('h2', { style: S.h2 }, t('title')),
        h('p', { style: S.sub }, t('intro')),
        data.storeError ? h(Banner, { kind: 'error', text: fmt(t('storeWarning'), { error: data.storeError }) }) : null,
        error ? h(Banner, { kind: 'error', text: error }) : null,
        notice ? h(Banner, { kind: 'notice', text: notice }) : null,

        h(
          'section',
          { style: cardStyle },
          h(
            'div',
            { style: S.row },
            h('h3', { style: S.h3 }, t('onlyPromptTitle')),
            h('span', { style: { ...S.badge, ...S.badgeBlue } }, t('onlyPromptBadge')),
          ),
          h('p', { style: S.sub }, t('onlyPromptHint')),
          h('textarea', {
            style: { ...S.textarea, ...themeStyles.textarea, ...(promptFocus ? themeStyles.textareaFocus : {}) },
            value: draft.prompt.text,
            placeholder: t('promptPlaceholder'),
            spellCheck: false,
            onFocus: () => setPromptFocus(true),
            onBlur: () => setPromptFocus(false),
            onChange: (event) => update((next) => {
              next.prompt.text = event.target.value;
            }),
            'data-prompt-text': '1',
          }),
          h(
            'div',
            { style: S.row },
            h(ActionButton, { variant: 'outline', onClick: loadDefault }, t('loadDefault')),
            h(ActionButton, { variant: 'ghost', onClick: clearPrompt, disabled: draft.prompt.text === '' }, t('clearPrompt')),
            h('span', { style: S.mono }, fmt(t('chars'), { n: draft.prompt.text.length })),
          ),
          h('p', { style: S.sub }, t('modelTokenHint')),
          draft.prompt.text.trim() === ''
            ? h('p', { style: S.warn }, t('onlyPromptEmpty'))
            : null,
        ),

        h(
          'section',
          { style: cardStyle, 'data-pure-suppress': '1' },
          h(
            'div',
            { style: S.row },
            h('h3', { style: S.h3 }, t('pureSuppressTitle')),
            draft.memory === true
              ? h('span', { style: { ...S.badge, ...S.badgeGreen } }, t('memoryBadge'))
              : null,
          ),
          h('p', { style: S.sub }, t('pureSuppressHint')),
          renderMemoryToggle('pure-memory', draft, update),
          ...renderSuppressGroups(draft, update),
          h(Toggle, {
            id: 'pure-toolSafety',
            checked: draft.toolSafety,
            disabled: !draft.suppress.tools,
            label: t('swSafety'),
            hint: t('swSafetyHint'),
            cost: draft.toolSafety ? t('swSafetyCost') : '',
            onChange: (value) => update((next) => {
              next.toolSafety = value;
            }),
          }),
        ),

        h(
          'section',
          { style: cardStyle },
          h(
            'div',
            { style: S.row },
            h('h3', { style: S.h3 }, t('customTitle')),
            h('span', { style: S.badge }, fmt(t('customCount'), { n: modes.length })),
          ),
          h('p', { style: S.sub }, t('customHint')),
          modes.length === 0
            ? h('p', { style: S.sub }, t('customEmpty'))
            : h(
                'div',
                { style: S.modeList },
                modes.map((mode) => h(
                  'div',
                  { key: mode.id, style: S.modeRow, 'data-custom-mode': mode.id },
                  h('span', { style: { ...S.menuDot, background: '#a855f7' }, 'aria-hidden': 'true' }),
                  h(
                    'div',
                    { style: S.grow },
                    h(
                      'div',
                      { style: S.modeNameRow },
                      h('span', { style: S.modeName }, mode.name),
                      h('span', { style: S.badge }, t('customBadge')),
                    ),
                    h('span', { style: S.modeSummary }, customModeSummary(mode, t)),
                  ),
                  h(ActionButton, { variant: 'ghost', disabled: modeBusy, onClick: () => openEditMode(mode) }, t('customEdit')),
                  h(ActionButton, { variant: 'ghost', disabled: modeBusy, onClick: () => deleteMode(mode) }, t('customDelete')),
                )),
              ),
          editor === null
            ? h(
                'div',
                { style: S.row },
                h(
                  ActionButton,
                  {
                    variant: 'outline',
                    disabled: modeBusy || modes.length >= MAX_CUSTOM_MODES,
                    onClick: openCreateMode,
                  },
                  t('customAdd'),
                ),
                modes.length >= MAX_CUSTOM_MODES ? h('span', { style: S.sub }, t('customLimit')) : null,
              )
            : renderEditor(),
        ),

        h(
          'section',
          { style: cardStyle },
          h(
            'div',
            { style: S.row },
            h('h3', { style: S.h3 }, t('defaultModeTitle')),
            h('span', { style: { ...S.badge, ...S.badgeBlue } }, t('defaultBadge')),
          ),
          h('p', { style: S.sub }, t('defaultModeHint')),
          h(
            'div',
            { style: S.row },
            h('span', { style: S.sub }, t('defaultModeLabel')),
            h(ModeMenu, {
              t,
              items: modeItems,
              value: defaultMode,
              disabled: defaultBusy,
              onChange: saveDefaultMode,
              title: t('defaultModeHint'),
              dataName: 'default',
              side: 'top',
              triggerVariant: 'outline',
            }),
          ),
          h('p', { style: S.sub }, fmt(t('defaultModeEffective'), { mode: defaultLabel })),
        ),

        h(
          'section',
          { style: cardStyle },
          h('h3', { style: S.h3 }, t('diagTitle')),
          last === null || last === undefined
            ? h('p', { style: S.sub }, t('diagEmpty'))
            : h(
                'div',
                { style: S.diag },
                h('div', null, fmt(t('diagSections'), { before: last.sectionsBefore ?? '?', after: last.sectionsAfter ?? '?' })),
                h('div', null, fmt(t('diagTools'), { before: last.toolsBefore ?? '?', after: last.toolsAfter ?? '?' })),
                h('div', null, fmt(t('diagMemory'), {
                  state: last.memory === true ? t('diagMemoryOn') : t('diagMemoryOff'),
                })),
                h('div', null, last.toolsHeld === true
                  ? fmt(t('diagHeld'), { reason: last.toolsHeldReason === 'series-restart' ? t('diagHeldRestart') : t('diagHeldFirst') })
                  : t('diagHeldNone')),
                last.seriesRestart === true ? h('div', null, t('diagSeriesRestarted')) : null,
                h('div', null, `${fmt(t('diagStripped'), { count: last.stripped ?? 0 })}${last.stripKinds !== undefined && Object.keys(last.stripKinds).length > 0 ? fmt(t('diagKinds'), { kinds: Object.entries(last.stripKinds).map(([key, value]) => `${key}×${value}`).join(', ') }) : ''}`),
                h('div', { style: S.mono }, `${t('diagPath')}：${data.path}`),
                h('div', { style: S.sub }, fmt(t('diagCounters'), data.counters ?? { assemblies: 0, stripped: 0, held: 0 })),
              ),
        ),

        h(
          'div',
          { style: S.row },
          h(
            ActionButton,
            {
              variant: 'primary',
              disabled: saving,
              onClick: () => persist(draft, t('saved')),
              'data-save-settings': '1',
            },
            saving ? t('saving') : t('save'),
          ),
          h('span', { style: S.sub }, dirty ? t('unsaved') : t('savedHint')),
        ),
      );
    }

    function Dock(props) {
      const t = tOf(props);
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : '';
      const [data, setData] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');

      const load = React.useCallback(async () => {
        if (sessionId === '') return;
        try {
          const payload = await api(`/state?session=${encodeURIComponent(sessionId)}`);
          setData(payload);
          setError('');
        } catch (problem) {
          setError(problem?.message ?? String(problem));
        }
      }, [sessionId]);

      React.useEffect(() => {
        load();
      }, [load]);

      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
        const onChanged = () => load();
        window.addEventListener(CHANGED_EVENT, onChanged);
        window.addEventListener('focus', onChanged);
        return () => {
          window.removeEventListener(CHANGED_EVENT, onChanged);
          window.removeEventListener('focus', onChanged);
        };
      }, [load]);

      if (sessionId === '') return null;
      const config = data?.config;
      const effectiveMode = data?.session?.mode ?? data?.config?.defaultMode ?? 'normal';
      const override = data?.session?.override ?? null;
      const effectivePure = data?.session?.effective?.pure === true;
      const effectiveMemory = data?.session?.effective?.memory === true;
      const items = buildModeItems(t, config);
      const change = async (next) => {
        const target = next === config?.defaultMode ? 'default' : next;
        setBusy(true);
        setError('');
        try {
          const payload = await api('/session', {
            method: 'PUT',
            body: JSON.stringify({ sessionId, mode: target }),
          });
          setData(payload);
          notifyChanged();
        } catch (problem) {
          setError(problem?.message ?? String(problem));
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        {
          style: S.dock,
          'data-plugin': 'dsh-prompt-studio',
          'data-session-mode': effectiveMode,
          'data-mode-override': override ?? '',
          'data-effective-pure': effectivePure ? '1' : '0',
          'data-effective-memory': effectiveMemory ? '1' : '0',
        },
        h('span', { style: S.dot(effectiveMode), 'aria-hidden': 'true' }),
        h('span', { style: S.dockLabel }, t('dockLabel')),
        h(ModeMenu, {
          t,
          items,
          value: effectiveMode,
          disabled: busy,
          onChange: change,
          title: error !== '' ? error : t('dockHint'),
          dataName: 'dock',
          side: 'top',
          compact: true,
        }),
        override === null
          ? h('span', { style: S.badge }, t('defaultBadge'))
          : effectivePure
            ? h('span', { style: { ...S.badge, ...S.badgeGreen } }, t('pureBadge'))
            : null,
        effectiveMemory
          ? h('span', { style: { ...S.badge, ...S.badgeGreen } }, t('memoryBadge'))
          : null,
      );
    }

    function degradedPlugin(error) {
      const message = error?.message ?? String(error);
      function Failure() {
        return h(
          'div',
          { style: S.root, 'data-plugin': 'dsh-prompt-studio', 'data-render-state': 'degraded' },
          h('h2', { style: S.h2 }, 'Prompt Studio — load failure'),
          h('p', { style: S.error }, message),
        );
      }
      return {
        inject: ['slots'],
        apply(ctx) {
          try {
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                { name: 'settings.section', id: 'prompt-studio', order: 32, label: () => '提示词 / 模式', inject: () => ({}) },
                Failure,
              ),
            );
          } catch {
          }
        },
      };
    }

    try {
      return {
        inject: ['slots', 'locale'],
        apply(ctx) {
          const locale = ctx.locale;
          const t = typeof locale?.bind === 'function' ? locale.bind(NS) : (key) => key;
          fallbackT = t;
          try {
            sessionsHolder.service = typeof ctx.get === 'function' ? (ctx.get('sessions') ?? ctx.sessions ?? null) : (ctx.sessions ?? null);
          } catch {
            sessionsHolder.service = null;
          }
          try {
            if (typeof ctx.inject === 'function') {
              ctx.inject(['sessions'], (scoped) => {
                sessionsHolder.service = scoped?.sessions ?? sessionsHolder.service;
              });
            }
          } catch {
          }
          try {
            themeHolder.service = typeof ctx.get === 'function'
              ? (ctx.get('theme') ?? ctx.theme ?? null)
              : (ctx.theme ?? null);
          } catch {
            themeHolder.service = null;
          }
          themeHolder.scheme = detectThemeScheme();
          try {
            if (typeof ctx.inject === 'function') {
              ctx.inject(['theme'], (scoped) => {
                themeHolder.service = scoped?.theme ?? themeHolder.service;
                themeHolder.scheme = detectThemeScheme();
                notifyThemeChanged();
              });
            }
          } catch {
          }
          ctx.effect(() => {
            const update = (snapshot) => {
              const scheme = snapshot?.active?.colorScheme;
              themeHolder.scheme = scheme === 'dark' ? 'dark' : scheme === 'light' ? 'light' : detectThemeScheme();
              notifyThemeChanged();
            };
            let off;
            try {
              off = typeof ctx.on === 'function' ? ctx.on('theme/change', update) : undefined;
            } catch {
            }
            let observer = null;
            try {
              if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
                const sync = () => {
                  themeHolder.scheme = detectThemeScheme();
                  notifyThemeChanged();
                };
                observer = new MutationObserver(sync);
                const options = { attributes: true, attributeFilter: ['data-ds-dark-theme', 'data-theme'] };
                observer.observe(document.documentElement, options);
                if (document.body) observer.observe(document.body, options);
              }
            } catch {
            }
            return () => {
              if (typeof off === 'function') off();
              try {
                observer?.disconnect();
              } catch {
              }
            };
          }, 'prompt-studio: theme');
          ctx.effect(() => {
            if (typeof locale?.register !== 'function') return undefined;
            try {
              return locale.register(NS, { zh, en });
            } catch (problem) {
              try {
                console.warn('[dsh-prompt-studio] locale registration failed:', problem?.message ?? String(problem));
              } catch {
              }
              return undefined;
            }
          }, 'prompt-studio: locale');
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'prompt-studio',
                order: 32,
                label: () => t('nav'),
                locale: NS,
                inject: () => ({ t }),
              },
              SettingsPage,
            ),
          );
          ctx.slots.inject('conversation.input.dock', () =>
            ctx.slots.register(
              {
                name: 'conversation.input.dock',
                id: 'prompt-studio',
                order: 28,
                locale: NS,
                inject: (sessionId) => ({ t, sessionId: typeof sessionId === 'string' ? sessionId : '' }),
              },
              Dock,
            ),
          );
        },
      };
    } catch (error) {
      try {
        console.error('[dsh-prompt-studio] client plugin failed to load:', error?.message ?? String(error));
      } catch {
      }
      return degradedPlugin(error);
    }
  },
});
