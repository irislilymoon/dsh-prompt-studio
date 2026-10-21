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
      intro: '自定义初始系统提示词，并按需撤掉 DSH 注入的 runtime 上下文、工具 schema、AGENTS.md 与 skill 目录。普通模式、仅聊天和自定义模式可以在输入框上方切换，新对话使用你设置的默认模式。',
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
      onlyPromptHint: '仅聊天模式只发送这段提示词，并屏蔽 runtime 上下文、工具 schema、AGENTS.md、时间等所有系统侧输入。',
      onlyPromptEmpty: '提示词为空时，仅聊天不会发送任何系统提示词；模型只会看到对话内容。',
      swRuntime: '屏蔽 runtime 上下文',
      swRuntimeHint: '撤掉工作目录、沙箱/审批策略、skill 目录等 runtime 快照。插件会拦截整个快照投影，连 DSH 的必需工作目录上下文也不会发送。',
      swTools: '屏蔽工具 schema',
      swToolsHint: '工具定义走独立协议字段，是最大的一笔 token。打开后模型没有可调用的工具。',
      swInjected: '屏蔽 AGENTS.md / 时间等注入',
      swInjectedHint: '撤掉 workspace instructions（AGENTS.md / CLAUDE.md）、逐步时间读数、skill 目录与 /skill 调用内容。',
      swAll: '屏蔽所有非用户注入',
      swAllHint: '用户角色里只要不是你自己发的消息就过滤掉，包括 plan-mode 提醒、goal/schedule 消息、session 引用等。这是最彻底的仅聊天。',
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
      modePureHint: '只发送仅聊天提示词 + 全部屏蔽',
      modeNormalHint: '使用 DSH 默认提示词与完整工具',
      defaultModeTitle: '新对话默认模式',
      defaultModeHint: '新建对话会自动使用这个模式；已有对话可以在输入框上方单独切换，没有单独切换过的对话也会跟随这里。',
      defaultModeLabel: '默认模式',
      defaultModeEffective: '新对话当前使用：{mode}',
      defaultModeSaved: '新对话默认模式已更新。',
      defaultBadge: '默认',
      customTitle: '自定义模式',
      customHint: '把一套系统提示词、屏蔽开关和工具保护保存成可复用的模式，会出现在输入框上方的模式菜单里。',
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
    };

    const en = {
      nav: 'Prompt / modes',
      title: 'Prompt Studio',
      intro: 'Edit the initial system prompt and optionally remove runtime context, tool schemas, AGENTS.md and skill catalogs injected by DSH. Switch between normal mode, chat only and custom modes above the composer; new chats use your default mode.',
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
      onlyPromptHint: 'Chat only sends exactly this prompt and suppresses runtime context, tool schemas, AGENTS.md, time readings and every other system-side input.',
      onlyPromptEmpty: 'With an empty prompt, chat only sends no system prompt at all; the model sees only the conversation.',
      swRuntime: 'Suppress runtime context',
      swRuntimeHint: 'Removes runtime snapshots: working directory, sandbox/approval policies, skill catalog. The plugin intercepts the whole projection, including DSH mandatory working-directory context.',
      swTools: 'Suppress tool schemas',
      swToolsHint: 'Tool definitions are a separate wire field and usually the largest token item. With this on the model has nothing to call.',
      swInjected: 'Suppress AGENTS.md / time injections',
      swInjectedHint: 'Removes workspace instructions (AGENTS.md / CLAUDE.md), per-step time readings, skill catalogs and /skill content.',
      swAll: 'Suppress every non-user injection',
      swAllHint: 'Drops every user-role message you did not send yourself, including plan-mode reminders, goal/schedule messages and session references. This is the most thorough chat-only setup.',
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
      modePureHint: 'Send only the chat-only prompt + suppress all system input',
      modeNormalHint: 'DSH default prompt and full tools',
      defaultModeTitle: 'Default mode for new chats',
      defaultModeHint: 'New chats start in this mode. Existing chats can switch from the prompt row above the composer; chats without their own choice also follow this setting.',
      defaultModeLabel: 'Default mode',
      defaultModeEffective: 'New chats currently use: {mode}',
      defaultModeSaved: 'Default mode for new chats updated.',
      defaultBadge: 'Default',
      customTitle: 'Custom modes',
      customHint: 'Save a system prompt, suppression switches and tool protection as a reusable mode. It appears in the mode menu above the composer.',
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

    function suppressSummary(suppress, t) {
      const labels = [];
      if (suppress?.runtime === true) labels.push(t('sumRuntime'));
      if (suppress?.tools === true) labels.push(t('sumTools'));
      if (suppress?.injected === true) labels.push(t('sumInjected'));
      if (suppress?.all === true) labels.push(t('sumAll'));
      return labels.length === 0
        ? t('customSuppressNone')
        : fmt(t('customSuppressList'), { list: labels.join(' / ') });
    }

    function customModeSummary(mode, t) {
      const base = fmt(t('customSummary'), {
        mode: promptModeLabel(mode.promptMode, t),
        suppress: suppressSummary(mode.suppress, t),
      });
      return mode.toolSafety === true ? `${base} · ${t('sumSafety')}` : base;
    }

    function buildModeItems(t, config) {
      const items = [
        { value: 'normal', label: t('modeNormal'), hint: t('modeNormalHint'), dot: '#2f7cf6' },
        { value: 'pure', label: t('modePure'), hint: t('modePureHint'), dot: '#19b8a6' },
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
          toolSafety: mode.toolSafety === true,
        });
        setEditorFocus('');
        setError('');
        setNotice('');
      };

      const updateEditor = (mutator) => {
        setEditor((previous) => {
          if (previous === null) return previous;
          const next = { ...previous, suppress: { ...previous.suppress } };
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
          h(Toggle, {
            id: 'custom-runtime',
            checked: editor.suppress.runtime,
            label: t('swRuntime'),
            hint: t('swRuntimeHint'),
            onChange: (value) => updateEditor((next) => {
              next.suppress.runtime = value;
            }),
          }),
          h(Toggle, {
            id: 'custom-tools',
            checked: editor.suppress.tools,
            label: t('swTools'),
            hint: t('swToolsHint'),
            onChange: (value) => updateEditor((next) => {
              next.suppress.tools = value;
            }),
          }),
          h(Toggle, {
            id: 'custom-injected',
            checked: editor.suppress.injected,
            label: t('swInjected'),
            hint: t('swInjectedHint'),
            onChange: (value) => updateEditor((next) => {
              next.suppress.injected = value;
            }),
          }),
          h(Toggle, {
            id: 'custom-all',
            checked: editor.suppress.all,
            label: t('swAll'),
            hint: t('swAllHint'),
            onChange: (value) => updateEditor((next) => {
              next.suppress.all = value;
            }),
          }),
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
