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
      nav: '提示词 / 纯聊天',
      title: '系统提示词工作室',
      intro: '自定义初始系统提示词，并按需撤掉 DSH 注入的 runtime 上下文、工具 schema、AGENTS.md 与 skill 目录。纯聊天模式下，模型只看到你写的提示词和对话内容。',
      promptTitle: '初始系统提示词',
      promptHint: '「全量替换」会把整个系统提示词换成你写的正文，Agent Teams、工具指引等其他段全部去掉；「只替换开场白」只替换 DSH 默认的 Harness 身份和 coding persona，其他段保留。支持 {{model}} 占位符。',
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
      pureTitle: '纯聊天',
      pureHint: '一键把系统提示词设为「全量替换」，并打开全部屏蔽开关。工具从第一条消息起就不会发送，首轮也按低 token 计费。建议用新会话开启纯聊天；已经调用过工具的会话切过来，可能因工具历史/声明不一致被服务端拒绝。',
      pureOn: '一键纯聊天',
      pureOff: '恢复系统输入',
      pureActive: '纯聊天已开启：系统侧输入归零，只保留你写的提示词。',
      pureInactive: '当前仍会发送部分系统侧输入。',
      pureOnBadge: '已开启',
      pureOffBadge: '未开启',
      pureEmptyText: '提示词为空时，纯聊天的系统提示词也会是空的；模型只会看到对话内容。',
      suppressTitle: '屏蔽系统侧输入',
      suppressHint: '每个开关撤掉一类模型本来能看到的输入，可以单独使用。',
      swRuntime: '屏蔽 runtime 上下文',
      swRuntimeHint: '撤掉工作目录、沙箱/审批策略、skill 目录等 runtime 快照。插件会拦截整个快照投影，连 DSH 的必需工作目录上下文也不会发送。',
      swTools: '屏蔽工具 schema',
      swToolsHint: '工具定义走独立协议字段，是最大的一笔 token。打开后模型没有可调用的工具。',
      swInjected: '屏蔽 AGENTS.md / 时间等注入',
      swInjectedHint: '撤掉 workspace instructions（AGENTS.md / CLAUDE.md）、逐步时间读数、skill 目录与 /skill 调用内容。',
      swAll: '屏蔽所有非用户注入',
      swAllHint: '用户角色里只要不是你自己发的消息就过滤掉，包括 plan-mode 提醒、goal/schedule 消息、session 引用等。这是最彻底的纯聊天。',
      swSafety: '工具基线保护',
      swSafetyHint: 'DSH 要求会话有一份非空工具声明基线，否则之后重新打开工具可能被服务端拒绝。勾上后，会话首轮和声明序列重启时会保留完整工具一轮——首轮会多花约 9k token。纯聊天默认关闭。',
      swSafetyCost: '首轮代价高；开启后首条消息不再是低 token。',
      save: '保存设置',
      saving: '保存中…',
      saved: '设置已保存，下一轮请求生效。',
      saveFailed: '保存失败',
      unsaved: '有未保存的修改',
      savedHint: '没有未保存的修改',
      sessionTitle: '当前会话',
      sessionHint: '会话模式只影响这一个对话；设置页里的提示词与屏蔽开关是全局的。',
      sessionNoSession: '打开一个对话后，这里可以单独设置该会话的模式。',
      sessionMode: '会话模式',
      modeGlobal: '跟随全局设置',
      modePure: '纯聊天（仅本会话）',
      modeNormal: '正常模式（仅本会话）',
      modeGlobalHint: '使用设置页的全局配置',
      modePureHint: '只用你的提示词 + 全部屏蔽',
      modeNormalHint: '使用 DSH 默认提示词与工具',
      globalBadge: '全局',
      sessionBadge: '本会话',
      sessionEffective: '本会话实际：{mode}；工具 {tools}；runtime {runtime}',
      effectiveOn: '已屏蔽',
      effectiveOff: '发送',
      diagTitle: '上一轮装配结果',
      diagEmpty: '在当前会话发一条消息后，这里会显示上一轮实际装配的段数、工具数和过滤数量。',
      diagSections: '系统提示词段数 {before} → {after}',
      diagTools: '工具 schema {before} → {after}',
      diagHeld: '工具保活：{reason}',
      diagHeldNone: '工具保活：未触发',
      diagHeldFirst: '会话首轮保留完整工具',
      diagHeldRestart: '声明序列重启，保留完整工具一轮',
      diagStripped: '过滤注入消息 {count} 条',
      diagKinds: '（{kinds}）',
      diagPath: '数据文件',
      diagCounters: '进程累计：装配 {assemblies} 次 · 过滤 {stripped} 条 · 保活 {held} 轮',
      diagNone: '无',
      loading: '读取设置…',
      retry: '重试',
      loadFailed: '读取设置失败',
      storeWarning: '设置文件读取有问题：{error}',
      dockLabel: '提示词',
      dockHint: '只影响本会话：跟随全局 / 纯聊天 / 正常模式',
      dockPure: '纯聊天',
      pureBadge: '纯聊天',
      normalBadge: '正常',
      globalBadgeShort: '全局',
      toolsOn: '工具开',
      toolsOff: '工具关',
      runtimeOn: 'runtime 开',
      runtimeOff: 'runtime 关',
    };

    const en = {
      nav: 'Prompt / pure chat',
      title: 'Prompt Studio',
      intro: 'Edit the initial system prompt and optionally remove runtime context, tool schemas, AGENTS.md and skill catalogs injected by DSH. In pure chat the model sees only your prompt and the conversation.',
      promptTitle: 'Initial system prompt',
      promptHint: '"Replace whole prompt" replaces the entire system prompt with your text and drops Agent Teams, tool guidance and every other section. "Replace opener only" changes just the DSH Harness identity and coding persona and keeps the rest. {{model}} is supported.',
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
      pureTitle: 'Pure chat',
      pureHint: 'Sets the system prompt to "Replace whole prompt" and turns on every suppression switch. Tools are not sent from the first message, so even the first turn is cheap. Prefer a new conversation for pure chat; switching an existing tool-using conversation may be rejected because its tool history and declaration baseline no longer line up.',
      pureOn: 'Make it pure chat',
      pureOff: 'Restore system input',
      pureActive: 'Pure chat is on: zero system-side input, only your prompt remains.',
      pureInactive: 'Some system-side input is still being sent.',
      pureOnBadge: 'On',
      pureOffBadge: 'Off',
      pureEmptyText: 'With an empty prompt, pure chat sends an empty system prompt; the model sees only the conversation.',
      suppressTitle: 'Suppress system-side input',
      suppressHint: 'Each switch removes one class of model-visible input and can be used independently.',
      swRuntime: 'Suppress runtime context',
      swRuntimeHint: 'Removes runtime snapshots: working directory, sandbox/approval policies, skill catalog. The plugin intercepts the whole projection, including DSH mandatory working-directory context.',
      swTools: 'Suppress tool schemas',
      swToolsHint: 'Tool definitions are a separate wire field and usually the largest token item. With this on the model has nothing to call.',
      swInjected: 'Suppress AGENTS.md / time injections',
      swInjectedHint: 'Removes workspace instructions (AGENTS.md / CLAUDE.md), per-step time readings, skill catalogs and /skill content.',
      swAll: 'Suppress every non-user injection',
      swAllHint: 'Drops every user-role message you did not send yourself, including plan-mode reminders, goal/schedule messages and session references. This is the most thorough pure chat.',
      swSafety: 'Tool baseline protection',
      swSafetyHint: 'DSH expects a non-empty tool-declaration baseline; without one, re-enabling tools later in the same session may be rejected. When checked, the full tool list is kept for the session\u2019s first request and after a declaration-series restart \u2014 about 9k extra tokens on that turn. Off by default for pure chat.',
      swSafetyCost: 'Costly first turn; the first message is no longer low-token.',
      save: 'Save settings',
      saving: 'Saving\u2026',
      saved: 'Settings saved; effective on the next turn.',
      saveFailed: 'Save failed',
      unsaved: 'Unsaved changes',
      savedHint: 'No unsaved changes',
      sessionTitle: 'Current conversation',
      sessionHint: 'The conversation mode applies to this chat only; the prompt and switches above are global.',
      sessionNoSession: 'Open a conversation to set a mode for it.',
      sessionMode: 'Conversation mode',
      modeGlobal: 'Follow global settings',
      modePure: 'Pure chat (this chat only)',
      modeNormal: 'Normal mode (this chat only)',
      modeGlobalHint: 'Use the global settings above',
      modePureHint: 'Only your prompt; all input suppressed',
      modeNormalHint: 'DSH default prompt and tools',
      globalBadge: 'Global',
      sessionBadge: 'This chat',
      sessionEffective: 'Effective here: {mode}; tools {tools}; runtime {runtime}',
      effectiveOn: 'off',
      effectiveOff: 'sent',
      diagTitle: 'Last assembly',
      diagEmpty: 'Send a message in the current conversation to see how many sections, tools and injected messages the last turn actually had.',
      diagSections: 'System prompt sections {before} \u2192 {after}',
      diagTools: 'Tool schemas {before} \u2192 {after}',
      diagHeld: 'Tool hold: {reason}',
      diagHeldNone: 'Tool hold: not triggered',
      diagHeldFirst: 'full tools kept on the session\u2019s first request',
      diagHeldRestart: 'full tools kept for one turn after a series restart',
      diagStripped: 'Injected messages filtered: {count}',
      diagKinds: ' ({kinds})',
      diagPath: 'Data file',
      diagCounters: 'Process totals: {assemblies} assemblies \u00b7 {stripped} filtered \u00b7 {held} held turns',
      diagNone: 'none',
      loading: 'Reading settings\u2026',
      retry: 'Retry',
      loadFailed: 'Could not read settings',
      storeWarning: 'The settings file has a problem: {error}',
      dockLabel: 'Prompt',
      dockHint: 'This chat only: follow global / pure chat / normal',
      dockPure: 'Pure chat',
      pureBadge: 'Pure chat',
      normalBadge: 'Normal',
      globalBadgeShort: 'Global',
      toolsOn: 'tools on',
      toolsOff: 'tools off',
      runtimeOn: 'runtime on',
      runtimeOff: 'runtime off',
    };

    function tOf(props) {
      return props !== null && props !== undefined && typeof props.t === 'function' ? props.t : fallbackT;
    }

    function fmt(template, vars) {
      return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ''));
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
      switchRow: { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, lineHeight: '20px' },
      switchText: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
      switchLabel: { fontWeight: 500 },
      switchHint: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      switchCost: { fontSize: 12, lineHeight: '18px', color: 'rgba(220,150,60,0.98)' },
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
        background: mode === 'pure' ? '#19b8a6' : mode === 'normal' ? 'rgba(150,150,150,0.8)' : '#2f7cf6',
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

    const MODE_ITEMS = [
      { value: 'global', labelKey: 'modeGlobal', hintKey: 'modeGlobalHint', dot: '#2f7cf6' },
      { value: 'pure', labelKey: 'modePure', hintKey: 'modePureHint', dot: '#19b8a6' },
      { value: 'normal', labelKey: 'modeNormal', hintKey: 'modeNormalHint', dot: 'rgba(150,150,150,0.8)' },
    ];

    function ModeMenu(props) {
      const t = tOf(props);
      const value = MODE_ITEMS.some((item) => item.value === props.value) ? props.value : 'global';
      const disabled = props.disabled === true;
      const [open, setOpen] = React.useState(false);
      const selected = MODE_ITEMS.find((item) => item.value === value) ?? MODE_ITEMS[0];
      const label = t(selected.labelKey);
      const title = props.title ?? t('dockHint');
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
              'aria-label': `${t('sessionMode')}: ${label}`,
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
              'aria-label': `${t('sessionMode')}: ${label}`,
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
          MODE_ITEMS.map((item) => h('option', { key: item.value, value: item.value }, t(item.labelKey))),
        );
      }

      const items = MODE_ITEMS.map((item) => ({
        id: item.value,
        label: t(item.labelKey),
        icon: h('span', { style: { ...S.menuDot, background: item.dot }, 'aria-hidden': 'true' }),
        disabled,
      }));
      return h(HostMenu, {
        open,
        anchor,
        items,
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
      const mainSessionId = useMainSessionId();
      const [data, setData] = React.useState(null);
      const [baseline, setBaseline] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [status, setStatus] = React.useState('loading');
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [sessionBusy, setSessionBusy] = React.useState(false);
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
              prompt: nextDraft.prompt,
              suppress: nextDraft.suppress,
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

      const makePure = () => {
        if (draft === null) return;
        persist({
          prompt: { mode: 'only', text: draft.prompt.text },
          suppress: { runtime: true, tools: true, injected: true, all: true },
          toolSafety: false,
        }, t('pureActive'));
      };

      const restoreSystem = () => {
        if (draft === null) return;
        persist({
          prompt: { mode: 'host', text: draft.prompt.text },
          suppress: { runtime: false, tools: false, injected: false, all: false },
          toolSafety: false,
        }, t('saved'));
      };

      const loadDefault = async () => {
        if (draft === null) return;
        if (draft.prompt.text.trim() !== '' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (window.confirm(t('confirmLoadDefault')) !== true) return;
        }
        try {
          const payload = await api(`/default-prompt${stateQuery(mainSessionId)}`);
          update((next) => {
            next.prompt.text = typeof payload.text === 'string' ? payload.text : '';
            if (next.prompt.mode === 'host') next.prompt.mode = 'replace';
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

      const changeSessionMode = async (mode) => {
        if (mainSessionId === '') return;
        setSessionBusy(true);
        setError('');
        try {
          const payload = await api('/session', {
            method: 'PUT',
            body: JSON.stringify({ sessionId: mainSessionId, mode }),
          });
          setData(payload);
          notifyChanged();
        } catch (problem) {
          setError(`${t('saveFailed')}：${problem?.message ?? String(problem)}`);
        } finally {
          setSessionBusy(false);
        }
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

      const effective = data.session?.effective;
      const sessionMode = data.session?.mode ?? 'global';
      const last = data.last;
      const effectiveModeLabel = effective?.promptMode === 'only'
        ? t('modeOnly')
        : effective?.promptMode === 'replace'
          ? t('modeReplace')
          : t('modeHost');

      return h(
        'div',
        { ref: rootRef, style: pageStyle, 'data-plugin': 'dsh-prompt-studio', 'data-pure-chat': data.pureChat === true ? '1' : '0' },
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
            h('h3', { style: S.h3 }, t('promptTitle')),
            h('span', { style: { ...S.badge, ...S.badgeBlue } }, t('globalBadge')),
          ),
          h('p', { style: S.sub }, t('promptHint')),
          HostSegmentedControl !== null
            ? h(HostSegmentedControl, {
                id: 'prompt-studio-mode',
                value: draft.prompt.mode,
                options: [
                  { value: 'host', label: t('modeHost') },
                  { value: 'only', label: t('modeOnly') },
                  { value: 'replace', label: t('modeReplace') },
                ],
                onChange: (mode) => update((next) => {
                  next.prompt.mode = mode;
                }),
                label: t('promptTitle'),
                className: themeStyles.segClass,
              })
            : h(
                'select',
                {
                  style: { ...S.fallbackSelect, ...themeStyles.fallbackSelect },
                  value: draft.prompt.mode,
                  onChange: (event) => update((next) => {
                    next.prompt.mode = event.target.value;
                  }),
                  'data-prompt-mode': '1',
                },
                h('option', { value: 'host' }, t('modeHost')),
                h('option', { value: 'only' }, t('modeOnly')),
                h('option', { value: 'replace' }, t('modeReplace')),
              ),
          h(
            'p',
            { style: S.sub },
            draft.prompt.mode === 'only'
              ? t('modeOnlyHint')
              : draft.prompt.mode === 'replace'
                ? t('modeReplaceHint')
                : t('modeHostHint'),
          ),
          h('textarea', {
            style: { ...S.textarea, ...themeStyles.textarea, ...(promptFocus ? themeStyles.textareaFocus : {}) },
            value: draft.prompt.text,
            placeholder: t('promptPlaceholder'),
            spellCheck: false,
            disabled: draft.prompt.mode === 'host',
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
          draft.prompt.mode === 'only' && draft.prompt.text.trim() === ''
            ? h('p', { style: S.warn }, t('pureEmptyText'))
            : null,
          draft.prompt.mode === 'replace' && draft.prompt.text.trim() === ''
            ? h('p', { style: S.warn }, t('pureEmptyText'))
            : null,
        ),

        h(
          'section',
          { style: cardStyle },
          h(
            'div',
            { style: S.row },
            h('h3', { style: S.h3 }, t('pureTitle')),
            h('span', { style: { ...S.badge, ...(data.pureChat === true ? S.badgeGreen : {}) } }, data.pureChat === true ? t('pureOnBadge') : t('pureOffBadge')),
          ),
          h('p', { style: S.sub }, data.pureChat === true ? t('pureActive') : t('pureInactive')),
          h('p', { style: S.sub }, t('pureHint')),
          h(
            'div',
            { style: S.row },
            h(ActionButton, { variant: 'primary', onClick: makePure, disabled: saving }, t('pureOn')),
            h(ActionButton, { variant: 'outline', onClick: restoreSystem, disabled: saving }, t('pureOff')),
          ),
        ),

        h(
          'section',
          { style: cardStyle },
          h('h3', { style: S.h3 }, t('suppressTitle')),
          h('p', { style: S.sub }, t('suppressHint')),
          h(Toggle, {
            id: 'runtime',
            checked: draft.suppress.runtime,
            label: t('swRuntime'),
            hint: t('swRuntimeHint'),
            onChange: (value) => update((next) => {
              next.suppress.runtime = value;
            }),
          }),
          h(Toggle, {
            id: 'tools',
            checked: draft.suppress.tools,
            label: t('swTools'),
            hint: t('swToolsHint'),
            onChange: (value) => update((next) => {
              next.suppress.tools = value;
            }),
          }),
          h(Toggle, {
            id: 'injected',
            checked: draft.suppress.injected,
            label: t('swInjected'),
            hint: t('swInjectedHint'),
            onChange: (value) => update((next) => {
              next.suppress.injected = value;
            }),
          }),
          h(Toggle, {
            id: 'all',
            checked: draft.suppress.all,
            label: t('swAll'),
            hint: t('swAllHint'),
            onChange: (value) => update((next) => {
              next.suppress.all = value;
            }),
          }),
          h(Toggle, {
            id: 'toolSafety',
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
            h('h3', { style: S.h3 }, t('sessionTitle')),
            h('span', { style: S.badge }, t('sessionBadge')),
          ),
          h('p', { style: S.sub }, t('sessionHint')),
          mainSessionId === ''
            ? h('p', { style: S.sub }, t('sessionNoSession'))
            : h(
                'div',
                { style: S.row },
                h('span', { style: S.sub }, t('sessionMode')),
                h(ModeMenu, {
                  t,
                  value: sessionMode,
                  disabled: sessionBusy,
                  onChange: changeSessionMode,
                  title: t('sessionHint'),
                  dataName: 'settings',
                  side: 'top',
                  triggerVariant: 'outline',
                }),
              ),
          effective
            ? h('p', { style: S.sub }, fmt(t('sessionEffective'), {
                mode: effectiveModeLabel,
                tools: effective.suppress.tools ? t('effectiveOn') : t('effectiveOff'),
                runtime: effective.suppress.runtime ? t('effectiveOn') : t('effectiveOff'),
              }))
            : null,
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
                h('div', null, last.toolsHeld === true
                  ? fmt(t('diagHeld'), { reason: last.toolsHeldReason === 'series-restart' ? t('diagHeldRestart') : t('diagHeldFirst') })
                  : t('diagHeldNone')),
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
      const mode = data?.session?.mode ?? 'global';
      const effectivePure = data?.session?.effective?.pure === true;
      const change = async (next) => {
        setBusy(true);
        setError('');
        try {
          const payload = await api('/session', {
            method: 'PUT',
            body: JSON.stringify({ sessionId, mode: next }),
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
        { style: S.dock, 'data-plugin': 'dsh-prompt-studio', 'data-session-mode': mode, 'data-effective-pure': effectivePure ? '1' : '0' },
        h('span', { style: S.dot(effectivePure ? 'pure' : mode), 'aria-hidden': 'true' }),
        h('span', { style: S.dockLabel }, t('dockLabel')),
        h(ModeMenu, {
          t,
          value: mode,
          disabled: busy,
          onChange: change,
          title: error !== '' ? error : t('dockHint'),
          dataName: 'dock',
          side: 'top',
          compact: true,
        }),
        effectivePure ? h('span', { style: { ...S.badge, ...S.badgeGreen } }, t('pureBadge')) : null,
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
                { name: 'settings.section', id: 'prompt-studio', order: 32, label: () => '提示词 / 纯聊天', inject: () => ({}) },
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
