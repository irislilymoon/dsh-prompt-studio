import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLUGIN_NAME = 'dsh-prompt-studio';
const ROUTE_PREFIX = '/prompt-studio';
const SECTION_NAME = 'plugin:prompt-studio';
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_PROMPT_CHARS = 200000;
const MAX_SESSIONS = 500;
const MAX_DIAGNOSTICS = 200;
const MAX_CUSTOM_MODES = 20;
const MAX_MODE_NAME_CHARS = 60;
const CUSTOM_PREFIX = 'custom:';
const MODE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PROMPT_MODES = new Set(['host', 'replace', 'only']);
const BASE_MODES = new Set(['normal', 'pure']);
const REMOVED_SECTIONS = new Set(['harness:identity', 'deployment:persona-prefix']);
const RUNTIME_KINDS = new Set(['runtime-context']);
const INJECTED_KINDS = new Set([
  'agent-instructions',
  'time-context',
  'skill-catalog',
  'skill-invocation',
]);
const USER_KINDS = new Set(['user', 'user-question-reply', 'user-approval']);

export const inject = ['webServer', 'connection', 'systemPrompt'];

function httpError(status, message, code = 'bad-request') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function logToHost(ctx, message, level = 'info') {
  try {
    const logger = ctx === null || ctx === undefined ? undefined : ctx.logger;
    const write = logger === null || logger === undefined ? undefined : logger[level];
    if (typeof write === 'function') {
      write.call(logger, message);
      return;
    }
  } catch {
  }
  try {
    const write = level === 'error' ? console.error : console.log;
    write(message);
  } catch {
  }
}

function dshHome() {
  const configured = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : '';
  return configured !== '' ? configured : join(homedir(), '.dsh');
}

function defaultState() {
  return {
    version: 2,
    updatedAt: 0,
    prompt: { mode: 'host', text: '' },
    suppress: { runtime: false, tools: false, injected: false, all: false },
    toolSafety: false,
    defaultMode: 'normal',
    modes: [],
    sessions: {},
  };
}

function emptySuppress() {
  return { runtime: false, tools: false, injected: false, all: false };
}

function suppressOf(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    runtime: source.runtime === true,
    tools: source.tools === true,
    injected: source.injected === true,
    all: source.all === true,
  };
}

function normalizeSessionId(raw) {
  const value = String(raw ?? '').trim();
  return value !== '' && value.length <= 200 ? value : '';
}

function customModeRef(id) {
  return `${CUSTOM_PREFIX}${id}`;
}

function customModeIdOf(value) {
  if (typeof value !== 'string' || !value.startsWith(CUSTOM_PREFIX)) return '';
  const id = value.slice(CUSTOM_PREFIX.length);
  return MODE_ID_RE.test(id) ? id : '';
}

function findCustomMode(state, value) {
  const id = customModeIdOf(value);
  if (id === '') return undefined;
  return state.modes.find((mode) => mode.id === id);
}

function isKnownMode(state, value) {
  if (typeof value !== 'string') return false;
  if (BASE_MODES.has(value)) return true;
  return findCustomMode(state, value) !== undefined;
}

function normalizeCustomMode(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'string' || !MODE_ID_RE.test(raw.id)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_MODE_NAME_CHARS) : '';
  if (name === '') return null;
  return {
    id: raw.id,
    name,
    promptMode: PROMPT_MODES.has(raw.promptMode) ? raw.promptMode : 'only',
    promptText: typeof raw.promptText === 'string' ? raw.promptText.slice(0, MAX_PROMPT_CHARS) : '',
    suppress: suppressOf(raw.suppress),
    toolSafety: raw.toolSafety === true,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}

function modeNameTaken(state, name, excludeId) {
  const folded = name.trim().toLocaleLowerCase();
  return state.modes.some(
    (mode) => mode.id !== excludeId && mode.name.trim().toLocaleLowerCase() === folded,
  );
}

function pruneSessions(sessions) {
  const entries = Object.entries(sessions);
  if (entries.length <= MAX_SESSIONS) return sessions;
  entries.sort((left, right) => (left[1]?.updatedAt ?? 0) - (right[1]?.updatedAt ?? 0));
  return Object.fromEntries(entries.slice(entries.length - MAX_SESSIONS));
}

function normalizeStored(raw) {
  const base = defaultState();
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const prompt = raw.prompt !== null && typeof raw.prompt === 'object' && !Array.isArray(raw.prompt)
    ? raw.prompt
    : {};
  const modes = [];
  const usedIds = new Set();
  if (Array.isArray(raw.modes)) {
    for (const item of raw.modes) {
      const mode = normalizeCustomMode(item);
      if (mode === null || usedIds.has(mode.id)) continue;
      usedIds.add(mode.id);
      modes.push(mode);
      if (modes.length >= MAX_CUSTOM_MODES) break;
    }
  }
  const knownModes = new Set([...BASE_MODES, ...modes.map((mode) => customModeRef(mode.id))]);
  const nextPrompt = {
    mode: PROMPT_MODES.has(prompt.mode) ? prompt.mode : 'host',
    text: typeof prompt.text === 'string' ? prompt.text.slice(0, MAX_PROMPT_CHARS) : '',
  };
  const nextSuppress = suppressOf(raw.suppress);
  const legacyGlobalMode = isPureConfig(nextPrompt.mode, nextSuppress) ? 'pure' : 'normal';
  const defaultMode = typeof raw.defaultMode === 'string'
    && raw.defaultMode !== 'global'
    && knownModes.has(raw.defaultMode)
    ? raw.defaultMode
    : legacyGlobalMode;
  const sessions = {};
  if (raw.sessions !== null && typeof raw.sessions === 'object' && !Array.isArray(raw.sessions)) {
    for (const [id, value] of Object.entries(raw.sessions)) {
      const sessionId = normalizeSessionId(id);
      if (sessionId === '') continue;
      let mode;
      let updatedAt = 0;
      if (typeof value === 'string') {
        mode = value;
      } else if (value !== null && typeof value === 'object') {
        mode = value.mode;
        updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
      }
      if (mode === 'global') mode = legacyGlobalMode;
      if (!knownModes.has(mode) || mode === 'default') continue;
      sessions[sessionId] = { mode, updatedAt };
    }
  }
  return {
    version: 2,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    prompt: nextPrompt,
    suppress: nextSuppress,
    toolSafety: raw.toolSafety === true,
    defaultMode,
    modes,
    sessions: pruneSessions(sessions),
  };
}

function createStore() {
  const dir = join(dshHome(), 'prompt-studio');
  const path = join(dir, 'settings.json');
  let cache = {
    state: defaultState(),
    mtimeMs: -1,
    size: -1,
    error: null,
  };

  function refresh() {
    try {
      const stat = statSync(path);
      if (!stat.isFile()) return;
      if (stat.mtimeMs === cache.mtimeMs && stat.size === cache.size) return;
      const raw = readFileSync(path, 'utf8');
      cache = {
        state: normalizeStored(JSON.parse(raw)),
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        error: null,
      };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        cache = { state: defaultState(), mtimeMs: -1, size: -1, error: null };
        return;
      }
      cache.error = error?.message ?? String(error);
    }
  }

  function get() {
    refresh();
    return cache.state;
  }

  function save(next) {
    const state = normalizeStored(next);
    state.updatedAt = Date.now();
    mkdirSync(dir, { recursive: true });
    const body = `${JSON.stringify(state, null, 2)}\n`;
    const temp = join(dir, `.settings.${process.pid}.${randomUUID()}.tmp`);
    writeFileSync(temp, body, 'utf8');
    renameSync(temp, path);
    const stat = statSync(path);
    cache = { state, mtimeMs: stat.mtimeMs, size: stat.size, error: null };
    return state;
  }

  return { dir, path, get, save, errorOf: () => cache.error };
}

function sessionIdOf(agentOrSession) {
  try {
    const session = agentOrSession?.session ?? agentOrSession;
    const id = session?.id ?? session?.header?.id;
    return typeof id === 'string' && id !== '' ? id : '';
  } catch {
    return '';
  }
}

function activeSystemTexts(agent) {
  try {
    const session = agent?.session;
    if (session === null || session === undefined || typeof session.snapshotEvents !== 'function') return [];
    const surface = new Set(session.surface?.nodes ?? []);
    const out = [];
    for (const event of session.snapshotEvents()) {
      if (event?.type !== 'system/message' || !surface.has(event.seq)) continue;
      const content = event.data?.message?.content;
      let text = '';
      if (Array.isArray(content)) {
        text = content.map((block) => (block?.type === 'text' ? String(block.text ?? '') : '')).join('');
      }
      out.push({ seq: event.seq, text });
    }
    return out;
  } catch {
    return [];
  }
}

function isPureConfig(promptMode, suppress) {
  return promptMode === 'only'
    && suppress.runtime === true
    && suppress.tools === true
    && suppress.injected === true
    && suppress.all === true;
}

function configForMode(state, modeValue) {
  if (modeValue === 'normal') {
    return {
      promptMode: 'host',
      promptText: '',
      suppress: emptySuppress(),
      toolSafety: false,
      pure: false,
    };
  }
  if (modeValue === 'pure') {
    const suppress = { runtime: true, tools: true, injected: true, all: true };
    return {
      promptMode: 'only',
      promptText: state.prompt.text,
      suppress,
      toolSafety: false,
      pure: true,
    };
  }
  const custom = findCustomMode(state, modeValue);
  if (custom !== undefined) {
    return {
      promptMode: custom.promptMode,
      promptText: custom.promptText,
      suppress: { ...custom.suppress },
      toolSafety: custom.toolSafety,
      pure: isPureConfig(custom.promptMode, custom.suppress),
    };
  }
  return {
    promptMode: 'host',
    promptText: '',
    suppress: emptySuppress(),
    toolSafety: false,
    pure: false,
  };
}

function effectiveFor(state, sessionId) {
  const record = sessionId === '' ? undefined : state.sessions[sessionId];
  const override = record?.mode ?? null;
  const modeValue = override ?? state.defaultMode;
  return {
    sessionMode: modeValue,
    mode: modeValue,
    override,
    ...configForMode(state, modeValue),
  };
}

function publicConfig(state) {
  return {
    prompt: { mode: state.prompt.mode, text: state.prompt.text },
    suppress: { ...state.suppress },
    toolSafety: state.toolSafety === true,
    defaultMode: state.defaultMode,
    modes: state.modes.map((mode) => ({
      id: mode.id,
      name: mode.name,
      promptMode: mode.promptMode,
      promptText: mode.promptText,
      suppress: { ...mode.suppress },
      toolSafety: mode.toolSafety === true,
      updatedAt: mode.updatedAt,
    })),
  };
}

function publicEffective(effective) {
  return {
    mode: effective.mode,
    override: effective.override,
    promptMode: effective.promptMode,
    promptChars: effective.promptText.length,
    suppress: { ...effective.suppress },
    toolSafety: effective.toolSafety === true,
    pure: effective.pure === true,
  };
}

function resolveModel(ctx, agent) {
  try {
    const header = agent?.session?.requestHeader?.();
    const model = header?.config?.model;
    if (typeof model === 'string' && model !== '') return model;
  } catch {
  }
  try {
    const service = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined;
    const selection = service?.currentSelection?.();
    if (typeof selection?.model === 'string' && selection.model !== '') return selection.model;
  } catch {
  }
  return 'DeepSeek';
}

function resolveModelForSession(ctx, sessionId) {
  if (sessionId === '') return resolveModel(ctx, undefined);
  try {
    const agents = typeof ctx.get === 'function' ? ctx.get('agents') : undefined;
    const agent = typeof agents?.get === 'function' ? agents.get(sessionId) : undefined;
    return resolveModel(ctx, agent);
  } catch {
    return resolveModel(ctx, undefined);
  }
}

function replaceModelToken(text, model) {
  return String(text ?? '').split('{{model}}').join(model);
}

function rewriteSections(assembly, effective, model) {
  if (assembly === null || typeof assembly !== 'object') return assembly;
  const sections = Array.isArray(assembly.sections) ? assembly.sections : null;
  if (sections === null || effective.promptMode === 'host') return assembly;
  const text = replaceModelToken(effective.promptText, model);
  const hasText = text.trim() !== '';
  if (effective.promptMode === 'only') {
    return {
      ...assembly,
      sections: hasText ? [{ name: SECTION_NAME, text, interpolate: false }] : [],
    };
  }
  const filtered = sections.filter(
    (section) => section?.name !== SECTION_NAME && !REMOVED_SECTIONS.has(section?.name),
  );
  if (hasText) filtered.unshift({ name: SECTION_NAME, text, interpolate: false });
  return { ...assembly, sections: filtered };
}

function toolBaselineOf(agent) {
  try {
    const header = agent?.session?.requestHeader?.();
    if (header === undefined) return 'none';
    const tools = Array.isArray(header?.tools) ? header.tools : [];
    return tools.length > 0 ? 'ready' : 'empty';
  } catch {
    return 'unknown';
  }
}

function seriesRestarted(runtime, agent) {
  try {
    const generation = agent?.session?.surface?.contentGeneration;
    if (typeof generation !== 'number') return false;
    const previous = runtime.generation.get(agent);
    runtime.generation.set(agent, generation);
    return previous !== undefined && previous !== generation;
  } catch {
    return false;
  }
}

function decideTools(agent, assembly, effective, runtime) {
  const before = Array.isArray(assembly?.tools) ? assembly.tools.length : 0;
  if (effective.suppress.tools !== true) {
    return { assembly, before, after: before, held: false, reason: null, baseline: 'off' };
  }
  const baseline = toolBaselineOf(agent);
  const restart = seriesRestarted(runtime, agent);
  let held = false;
  let reason = null;
  if (effective.toolSafety === true) {
    if (baseline === 'none' || baseline === 'unknown') {
      held = true;
      reason = 'first-request';
    } else if (restart) {
      held = true;
      reason = 'series-restart';
    }
  }
  if (held) return { assembly, before, after: before, held: true, reason, baseline };
  return {
    assembly: { ...assembly, tools: [] },
    before,
    after: 0,
    held: false,
    reason: null,
    baseline,
  };
}

function releaseRuntimeEntry(entry) {
  try {
    if (entry?.replaced === true && entry.projection !== undefined) {
      if (entry.projection.project === entry.replacement) {
        entry.projection.project = entry.original;
      }
    }
  } catch {
  }
  try {
    if (typeof entry?.disposer === 'function') entry.disposer();
  } catch {
  }
}

function installAgentRuntime(agent, wanted, runtime) {
  const sessionId = sessionIdOf(agent);
  if (sessionId === '') return;
  let entry = runtime.patches.get(sessionId);
  if (entry !== undefined && entry.agent !== agent) {
    releaseRuntimeEntry(entry);
    runtime.patches.delete(sessionId);
    entry = undefined;
  }
  if (wanted !== true) {
    if (entry !== undefined) {
      releaseRuntimeEntry(entry);
      runtime.patches.delete(sessionId);
    }
    return;
  }
  if (entry !== undefined) return;
  const projection = agent?.runtimeContext;
  let original = null;
  let replacement = null;
  let replaced = false;
  if (projection !== null && projection !== undefined && typeof projection.project === 'function') {
    original = projection.project;
    replacement = function promptStudioWithoutRuntimeContext() {
      return undefined;
    };
    try {
      projection.project = replacement;
      replaced = true;
    } catch {
      original = null;
      replacement = null;
      replaced = false;
    }
  }
  let disposer = null;
  try {
    const scoped = agent?.ctx?.systemPrompt;
    if (scoped !== null && scoped !== undefined && typeof scoped.suppressRuntimeContext === 'function') {
      const candidate = scoped.suppressRuntimeContext();
      if (typeof candidate === 'function') disposer = candidate;
    }
  } catch {
  }
  runtime.patches.set(sessionId, {
    agent,
    projection,
    original,
    replacement,
    replaced,
    disposer,
  });
}

function recordDiagnostics(runtime, sessionId, record) {
  const key = sessionId === '' ? '<anonymous>' : sessionId;
  const previous = runtime.last.get(key);
  const merged = {
    ...(previous ?? {}),
    ...record,
    stripKinds: record.stripKinds !== undefined
      ? { ...record.stripKinds }
      : (previous?.stripKinds ?? {}),
  };
  runtime.last.delete(key);
  runtime.last.set(key, merged);
  while (runtime.last.size > MAX_DIAGNOSTICS) {
    const oldest = runtime.last.keys().next().value;
    if (oldest === undefined) break;
    runtime.last.delete(oldest);
  }
}

function stripMessages(messages, effective) {
  const kept = [];
  const droppedKinds = {};
  let dropped = 0;
  for (const message of messages) {
    let drop = false;
    let kind;
    if (message?.role === 'user') {
      kind = message?.source?.kind;
      if (effective.suppress.all === true) {
        drop = typeof kind === 'string' && !USER_KINDS.has(kind);
      } else if (effective.suppress.runtime === true && RUNTIME_KINDS.has(kind)) {
        drop = true;
      } else if (effective.suppress.injected === true && INJECTED_KINDS.has(kind)) {
        drop = true;
      }
    }
    if (drop) {
      dropped += 1;
      const label = typeof kind === 'string' ? kind : 'unknown';
      droppedKinds[label] = (droppedKinds[label] ?? 0) + 1;
    } else {
      kept.push(message);
    }
  }
  return { messages: kept, dropped, droppedKinds };
}

function validateSettingsBody(body, state) {
  let prompt;
  if (body.prompt !== undefined) {
    if (body.prompt === null || typeof body.prompt !== 'object' || Array.isArray(body.prompt)) {
      throw httpError(400, 'prompt 必须是对象');
    }
    const next = {};
    if (body.prompt.mode !== undefined) {
      if (!PROMPT_MODES.has(body.prompt.mode)) {
        throw httpError(400, 'prompt.mode 只能是 host / replace / only');
      }
      next.mode = body.prompt.mode;
    }
    if (body.prompt.text !== undefined) {
      if (typeof body.prompt.text !== 'string') {
        throw httpError(400, 'prompt.text 必须是字符串');
      }
      if (body.prompt.text.length > MAX_PROMPT_CHARS) {
        throw httpError(400, `prompt.text 超过 ${MAX_PROMPT_CHARS} 字符上限`, 'prompt-too-long');
      }
      next.text = body.prompt.text;
    }
    if (Object.keys(next).length > 0) prompt = next;
  }
  let suppress;
  if (body.suppress !== undefined) {
    if (body.suppress === null || typeof body.suppress !== 'object' || Array.isArray(body.suppress)) {
      throw httpError(400, 'suppress 必须是对象');
    }
    const next = {};
    for (const key of ['runtime', 'tools', 'injected', 'all']) {
      if (body.suppress[key] === undefined) continue;
      if (typeof body.suppress[key] !== 'boolean') {
        throw httpError(400, `suppress.${key} 必须是布尔值`);
      }
      next[key] = body.suppress[key];
    }
    if (Object.keys(next).length > 0) suppress = next;
  }
  let toolSafety;
  if (body.toolSafety !== undefined) {
    if (typeof body.toolSafety !== 'boolean') {
      throw httpError(400, 'toolSafety 必须是布尔值');
    }
    toolSafety = body.toolSafety;
  }
  let defaultMode;
  if (body.defaultMode !== undefined) {
    if (!isKnownMode(state, body.defaultMode)) {
      throw httpError(400, 'defaultMode 不是可用的模式');
    }
    defaultMode = body.defaultMode;
  }
  if (prompt === undefined && suppress === undefined && toolSafety === undefined && defaultMode === undefined) {
    throw httpError(400, '没有可保存的设置字段');
  }
  return { prompt, suppress, toolSafety, defaultMode };
}

function readModeFields(body, existing) {
  const next = existing === undefined || existing === null
    ? {
        name: '',
        promptMode: 'only',
        promptText: '',
        suppress: emptySuppress(),
        toolSafety: false,
      }
    : {
        name: existing.name,
        promptMode: existing.promptMode,
        promptText: existing.promptText,
        suppress: { ...existing.suppress },
        toolSafety: existing.toolSafety === true,
      };
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      throw httpError(400, 'name 必须是字符串');
    }
    const name = body.name.trim();
    if (name === '') throw httpError(400, '模式名称不能为空');
    if (name.length > MAX_MODE_NAME_CHARS) {
      throw httpError(400, `模式名称不能超过 ${MAX_MODE_NAME_CHARS} 个字符`);
    }
    next.name = name;
  } else if (existing === undefined || existing === null) {
    throw httpError(400, '模式名称不能为空');
  }
  if (body.promptMode !== undefined) {
    if (!PROMPT_MODES.has(body.promptMode)) {
      throw httpError(400, 'promptMode 只能是 host / replace / only');
    }
    next.promptMode = body.promptMode;
  }
  if (body.promptText !== undefined) {
    if (typeof body.promptText !== 'string') {
      throw httpError(400, 'promptText 必须是字符串');
    }
    if (body.promptText.length > MAX_PROMPT_CHARS) {
      throw httpError(400, `promptText 超过 ${MAX_PROMPT_CHARS} 字符上限`, 'prompt-too-long');
    }
    next.promptText = body.promptText;
  }
  if (body.suppress !== undefined) {
    if (body.suppress === null || typeof body.suppress !== 'object' || Array.isArray(body.suppress)) {
      throw httpError(400, 'suppress 必须是对象');
    }
    for (const key of ['runtime', 'tools', 'injected', 'all']) {
      if (body.suppress[key] === undefined) continue;
      if (typeof body.suppress[key] !== 'boolean') {
        throw httpError(400, `suppress.${key} 必须是布尔值`);
      }
      next.suppress[key] = body.suppress[key];
    }
  }
  if (body.toolSafety !== undefined) {
    if (typeof body.toolSafety !== 'boolean') {
      throw httpError(400, 'toolSafety 必须是布尔值');
    }
    next.toolSafety = body.toolSafety;
  }
  return next;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function requestUrl(req) {
  return new URL(String(req?.url ?? '/'), 'http://localhost');
}

function rejected(ctx, req, res) {
  try {
    const connection = Reflect.get(ctx, 'connection');
    const rejection = connection?.requestRejection?.(req);
    if (rejection === undefined) return false;
    res.statusCode = rejection;
    res.end();
    return true;
  } catch {
    return false;
  }
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let size = 0;
    const chunks = [];
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const declared = Number(req?.headers?.['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      fail(httpError(413, `请求体超过 ${maxBytes} 字节上限`, 'body-too-large'));
      try {
        req.destroy();
      } catch {
      }
      return;
    }
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        fail(httpError(413, `请求体超过 ${maxBytes} 字节上限`, 'body-too-large'));
        try {
          req.destroy();
        } catch {
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw === '' ? {} : JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw httpError(400, '请求体必须是 JSON 对象');
        }
        resolve(parsed);
      } catch (error) {
        reject(error?.status !== undefined ? error : httpError(400, `请求体不是合法 JSON：${error?.message ?? String(error)}`));
      }
    });
    req.on('error', (error) => fail(error));
  });
}

function statePayload(store, runtime, state, sessionId) {
  const effective = effectiveFor(state, sessionId);
  return {
    ok: true,
    path: store.path,
    updatedAt: state.updatedAt,
    config: publicConfig(state),
    session: sessionId === ''
      ? null
      : {
          id: sessionId,
          mode: effective.sessionMode,
          override: effective.override,
          effective: publicEffective(effective),
        },
    last: sessionId === '' ? null : runtime.last.get(sessionId) ?? null,
    counters: { ...runtime.counters },
    sessions: Object.keys(state.sessions).length,
    storeError: store.errorOf(),
  };
}

function mount(ctx, cleanups) {
  const store = createStore();
  const runtime = {
    patches: new Map(),
    last: new Map(),
    generation: new WeakMap(),
    promptKey: new WeakMap(),
    pendingSeries: new WeakSet(),
    forceSeries: new Set(),
    counters: { assemblies: 0, stripped: 0, held: 0 },
  };
  const effect = (label, factory) => {
    const disposer = ctx.effect(factory, label);
    if (typeof disposer !== 'function') {
      throw new TypeError(`ctx.effect(${JSON.stringify(label)}) 没有返回 disposer`);
    }
    cleanups.push(disposer);
  };

  async function handleRequest(req, res) {
    if (rejected(ctx, req, res)) return;
    const url = requestUrl(req);
    const method = req?.method ?? 'GET';
    try {
      if (url.pathname === `${ROUTE_PREFIX}/state` && method === 'GET') {
        store.get();
        const sessionId = normalizeSessionId(url.searchParams.get('session') ?? '');
        const state = store.get();
        sendJson(res, 200, statePayload(store, runtime, state, sessionId));
        return;
      }
      if (url.pathname === `${ROUTE_PREFIX}/settings` && method === 'PUT') {
        const body = await readJsonBody(req);
        const current = store.get();
        const patch = validateSettingsBody(body, current);
        const next = {
          ...current,
          prompt: patch.prompt === undefined ? current.prompt : { ...current.prompt, ...patch.prompt },
          suppress: patch.suppress === undefined ? current.suppress : { ...current.suppress, ...patch.suppress },
          toolSafety: patch.toolSafety === undefined ? current.toolSafety : patch.toolSafety,
          defaultMode: patch.defaultMode === undefined ? current.defaultMode : patch.defaultMode,
        };
        const saved = store.save(next);
        logToHost(ctx, `[${PLUGIN_NAME}] 设置已保存：${saved.prompt.mode}；默认模式 ${saved.defaultMode}；屏蔽 ${Object.entries(saved.suppress).filter(([, value]) => value === true).map(([key]) => key).join(',') || '（无）'}`);
        const sessionId = normalizeSessionId(url.searchParams.get('session') ?? '');
        sendJson(res, 200, statePayload(store, runtime, saved, sessionId));
        return;
      }
      if (url.pathname === `${ROUTE_PREFIX}/session` && method === 'PUT') {
        const body = await readJsonBody(req);
        const sessionId = normalizeSessionId(body.sessionId);
        if (sessionId === '') throw httpError(400, 'sessionId 不能为空');
        const current = store.get();
        if (body.mode !== 'default' && !isKnownMode(current, body.mode)) {
          throw httpError(400, 'mode 不是可用的模式');
        }
        const sessions = { ...current.sessions };
        if (body.mode === 'default') {
          delete sessions[sessionId];
        } else {
          sessions[sessionId] = { mode: body.mode, updatedAt: Date.now() };
        }
        const saved = store.save({ ...current, sessions });
        // Mode changes land between turns; the next assemble must rebuild the system prompt even if the agent key is new.
        runtime.forceSeries.add(sessionId);
        logToHost(ctx, `[${PLUGIN_NAME}] 会话 ${sessionId} 的模式已设为 ${body.mode}，下一轮重开请求序列`);
        sendJson(res, 200, statePayload(store, runtime, saved, sessionId));
        return;
      }
      const modesMatch = url.pathname.match(/^\/prompt-studio\/modes(?:\/([^/]+))?$/);
      if (modesMatch !== null) {
        const modeId = modesMatch[1] ?? '';
        const current = store.get();
        const sessionId = normalizeSessionId(url.searchParams.get('session') ?? '');
        if (method === 'POST' && modeId === '') {
          const body = await readJsonBody(req);
          const fields = readModeFields(body, null);
          if (current.modes.length >= MAX_CUSTOM_MODES) {
            throw httpError(409, `自定义模式最多 ${MAX_CUSTOM_MODES} 个`, 'too-many-modes');
          }
          if (modeNameTaken(current, fields.name, '')) {
            throw httpError(409, '已存在同名模式', 'duplicate-name');
          }
          const mode = { id: randomUUID(), ...fields, updatedAt: Date.now() };
          const saved = store.save({ ...current, modes: [...current.modes, mode] });
          logToHost(ctx, `[${PLUGIN_NAME}] 已创建自定义模式 ${mode.name}（${mode.id}）`);
          sendJson(res, 200, statePayload(store, runtime, saved, sessionId));
          return;
        }
        if (method === 'PUT' && modeId !== '') {
          const existing = current.modes.find((mode) => mode.id === modeId);
          if (existing === undefined) throw httpError(404, '没有这个自定义模式', 'mode-not-found');
          const body = await readJsonBody(req);
          const fields = readModeFields(body, existing);
          if (modeNameTaken(current, fields.name, modeId)) {
            throw httpError(409, '已存在同名模式', 'duplicate-name');
          }
          const updated = { ...existing, ...fields, updatedAt: Date.now() };
          const saved = store.save({
            ...current,
            modes: current.modes.map((mode) => (mode.id === modeId ? updated : mode)),
          });
          logToHost(ctx, `[${PLUGIN_NAME}] 已更新自定义模式 ${updated.name}（${updated.id}）`);
          sendJson(res, 200, statePayload(store, runtime, saved, sessionId));
          return;
        }
        if (method === 'DELETE' && modeId !== '') {
          const existing = current.modes.find((mode) => mode.id === modeId);
          if (existing === undefined) throw httpError(404, '没有这个自定义模式', 'mode-not-found');
          const ref = customModeRef(modeId);
          const sessions = {};
          const affected = [];
          for (const [id, record] of Object.entries(current.sessions)) {
            if (record.mode === ref) affected.push(id);
            else sessions[id] = record;
          }
          const defaultMode = current.defaultMode === ref ? 'normal' : current.defaultMode;
          const saved = store.save({
            ...current,
            modes: current.modes.filter((mode) => mode.id !== modeId),
            sessions,
            defaultMode,
          });
          for (const id of affected) runtime.forceSeries.add(id);
          logToHost(ctx, `[${PLUGIN_NAME}] 已删除自定义模式 ${existing.name}（${existing.id}）`);
          sendJson(res, 200, statePayload(store, runtime, saved, sessionId));
          return;
        }
      }
      if (url.pathname === `${ROUTE_PREFIX}/default-prompt` && method === 'GET') {
        const sessionId = normalizeSessionId(url.searchParams.get('session') ?? '');
        let text = '';
        try {
          const assembly = await ctx.systemPrompt.assemble({ promptStudio: { bypass: true } });
          const sections = Array.isArray(assembly?.sections) ? assembly.sections : [];
          const identity = sections.find((section) => section?.name === 'harness:identity')?.text;
          const persona = sections.find((section) => section?.name === 'deployment:persona-prefix')?.text;
          text = [identity, persona]
            .filter((value) => typeof value === 'string' && value.trim() !== '')
            .join('\n\n');
        } catch {
          text = '';
        }
        if (text.trim() === '') {
          text = 'You are an AI agent powered by DeepSeek Harness.\n\nYou are a coding agent powered by the {{model}} model.';
        }
        sendJson(res, 200, {
          ok: true,
          text: replaceModelToken(text, resolveModelForSession(ctx, sessionId)),
        });
        return;
      }
      sendJson(res, 404, {
        ok: false,
        code: 'not-found',
        message: `没有这条路由：${method} ${url.pathname}`,
      });
    } catch (error) {
      const status = Number.isFinite(error?.status) ? error.status : 500;
      if (status >= 500) {
        logToHost(ctx, `[${PLUGIN_NAME}] 路由失败：${error?.stack ?? error?.message ?? String(error)}`, 'error');
      }
      sendJson(res, status, {
        ok: false,
        code: typeof error?.code === 'string' ? error.code : 'internal-error',
        message: error?.message ?? String(error),
      });
    }
  }

  effect(`${PLUGIN_NAME}: HTTP 路由`, () => {
    const disposer = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: handleRequest,
    });
    if (typeof disposer !== 'function') {
      throw new TypeError('webServer.register() 没有返回 disposer');
    }
    return disposer;
  });

  effect(`${PLUGIN_NAME}: 系统提示词与工具装配`, () =>
    ctx.on('system-prompt/assemble', async (assembly, context, next) => {
      const downstream = await next();
      if (context?.promptStudio?.bypass === true) return downstream;
      try {
        const agent = context?.agent;
        const sessionId = sessionIdOf(agent);
        const state = store.get();
        const effective = effectiveFor(state, sessionId);
        installAgentRuntime(agent, effective.suppress.runtime, runtime);
        const model = resolveModel(ctx, agent);
        const sectionsBefore = Array.isArray(downstream?.sections) ? downstream.sections.length : 0;
        const toolsBefore = Array.isArray(downstream?.tools) ? downstream.tools.length : 0;
        let rewritten = rewriteSections(downstream, effective, model);
        const sectionsAfter = Array.isArray(rewritten?.sections) ? rewritten.sections.length : 0;
        try {
          if (agent !== null && agent !== undefined && typeof agent === 'object') {
            const key = `${effective.promptMode}\u0000${effective.promptText}`;
            const previousKey = runtime.promptKey.get(agent);
            const nodes = activeSystemTexts(agent).filter((node) => node.text !== '');
            if (sessionId !== '' && runtime.forceSeries.delete(sessionId)) {
              runtime.pendingSeries.add(agent);
            }
            // A fresh agent lifecycle can still carry an old in-history prompt; rebuild once so the current mode wins.
            if (previousKey === undefined && nodes.length > 0) {
              runtime.pendingSeries.add(agent);
            }
            if (previousKey !== undefined && previousKey !== key) runtime.pendingSeries.add(agent);
            runtime.promptKey.set(agent, key);
            if (effective.promptMode === 'only' && effective.promptText.trim() !== '') {
              const customText = replaceModelToken(effective.promptText, model);
              if (nodes.length > 0 && (nodes.length !== 1 || nodes[0].text !== customText)) {
                runtime.pendingSeries.add(agent);
              }
            }
          }
        } catch {
        }
        const tools = decideTools(agent, rewritten, effective, runtime);
        rewritten = tools.assembly;
        const toolsAfter = Array.isArray(rewritten?.tools) ? rewritten.tools.length : 0;
        runtime.counters.assemblies += 1;
        if (tools.held) runtime.counters.held += 1;
        recordDiagnostics(runtime, sessionId, {
          at: Date.now(),
          sessionMode: effective.sessionMode,
          promptMode: effective.promptMode,
          promptChars: effective.promptText.length,
          model,
          sectionsBefore,
          sectionsAfter,
          toolsBefore,
          toolsAfter,
          toolsHeld: tools.held,
          toolsHeldReason: tools.reason,
          toolsBaseline: tools.baseline,
          stripped: 0,
          stripKinds: {},
          seriesRestart: false,
        });
        return rewritten;
      } catch (error) {
        logToHost(ctx, `[${PLUGIN_NAME}] 装配改写失败，已回退：${error?.message ?? String(error)}`, 'error');
        return downstream;
      }
    }),
  );

  effect(`${PLUGIN_NAME}: 用户侧注入过滤`, () =>
    ctx.on(
      'agent/pre-step',
      async ({ agent, signal }, next) => {
        const decision = await next();
        if (decision === null || typeof decision !== 'object') return decision;
        if (decision.kind === 'reject') return decision;
        if (signal !== undefined && signal !== null && signal.aborted === true) return decision;
        if (!Array.isArray(decision.messages)) return decision;
        try {
          const sessionId = sessionIdOf(agent);
          const state = store.get();
          const effective = effectiveFor(state, sessionId);
          installAgentRuntime(agent, effective.suppress.runtime, runtime);
          const pendingSeries = runtime.pendingSeries.has(agent);
          if (pendingSeries) runtime.pendingSeries.delete(agent);
          const filtered = stripMessages(decision.messages, effective);
          if (filtered.dropped > 0) {
            runtime.counters.stripped += filtered.dropped;
            recordDiagnostics(runtime, sessionId, {
              at: Date.now(),
              stripped: filtered.dropped,
              stripKinds: filtered.droppedKinds,
            });
          }
          if (pendingSeries) {
            recordDiagnostics(runtime, sessionId, {
              at: Date.now(),
              seriesRestart: true,
            });
          }
          if (filtered.dropped === 0 && !pendingSeries) return decision;
          return {
            ...decision,
            messages: filtered.messages,
            ...(pendingSeries ? { startsRequestSeries: true } : {}),
          };
        } catch (error) {
          logToHost(ctx, `[${PLUGIN_NAME}] 注入过滤失败，已跳过：${error?.message ?? String(error)}`, 'error');
          return decision;
        }
      },
      { prepend: true },
    ),
  );

  effect(`${PLUGIN_NAME}: agent 生命周期`, () =>
    ctx.on('agent/created', ({ agent }) => {
      try {
        const sessionId = sessionIdOf(agent);
        const effective = effectiveFor(store.get(), sessionId);
        installAgentRuntime(agent, effective.suppress.runtime, runtime);
      } catch {
      }
    }),
  );

  effect(`${PLUGIN_NAME}: agent 回收`, () =>
    ctx.on('agent/disposed', ({ agent }) => {
      try {
        const sessionId = sessionIdOf(agent);
        const entry = runtime.patches.get(sessionId);
        if (entry !== undefined && entry.agent === agent) {
          releaseRuntimeEntry(entry);
          runtime.patches.delete(sessionId);
        }
        runtime.pendingSeries.delete(agent);
        runtime.promptKey.delete(agent);
      } catch {
      }
    }),
  );

  effect(`${PLUGIN_NAME}: 回收 runtime 补丁`, () => () => {
    for (const entry of runtime.patches.values()) releaseRuntimeEntry(entry);
    runtime.patches.clear();
    runtime.last.clear();
  });

  const globalState = store.get();
  logToHost(
    ctx,
    `[${PLUGIN_NAME}] 已挂载：设置 ${store.path}；默认模式 ${globalState.defaultMode}；自定义模式 ${globalState.modes.length} 个；会话覆盖 ${Object.keys(globalState.sessions).length} 条`,
  );
}

export function apply(ctx) {
  const cleanups = [];
  try {
    mount(ctx, cleanups);
  } catch (error) {
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch {
      }
    }
    cleanups.length = 0;
    logToHost(ctx, `[${PLUGIN_NAME}] 挂载失败，已回滚：${error?.stack ?? error?.message ?? String(error)}`, 'error');
  }
}
