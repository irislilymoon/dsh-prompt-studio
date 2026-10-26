import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { __test } from '../index.js';

const {
  defaultState,
  normalizeStored,
  configForMode,
  effectiveFor,
  stripMessages,
  decideTools,
  memoryAllows,
  suppressedBy,
  runtimeActive,
  runtimeFullySuppressed,
  onlyPromptMatches,
  installAgentRuntime,
  joinRuntimeSections,
  rewriteSections,
  injectMemorySections,
  readMemoryFile,
  qqCwdFromPatch,
  isQQWorkspacePath,
  resetQQWorkspaceCache,
  memoryRootInfo,
  workspaceRootOf,
} = __test;

function stateWith(overrides = {}) {
  // A v3 payload has no memoryFiles key at all; spreading the current defaults
  // would hide the master-switch migration this helper is meant to exercise.
  const { memoryFiles: _ignored, ...defaults } = defaultState();
  return normalizeStored({
    ...defaults,
    version: 3,
    defaultMode: 'pure',
    ...overrides,
  });
}

test('v2 settings migrate to the old chat-only behavior', () => {
  const state = normalizeStored({
    version: 2,
    prompt: { mode: 'only', text: 'hello' },
    suppress: { runtime: false, tools: false, injected: false, all: false },
    defaultMode: 'normal',
  });
  assert.equal(state.version, 4);
  assert.deepEqual(state.suppress, { runtime: true, tools: true, injected: true, all: true });
  assert.deepEqual(state.allow, { runtime: [], tools: [], injected: [], all: [] });
  assert.deepEqual(state.deny, { runtime: [], tools: [], injected: [], all: [] });
  assert.equal(state.memory, false);
  assert.deepEqual(state.memoryFiles, { soul: false, memory: false });
});

test('v3 settings spread the master memory switch over both files', () => {
  const state = stateWith({ memory: true });
  assert.equal(state.version, 4);
  assert.deepEqual(state.memoryFiles, { soul: true, memory: true });
  assert.equal(state.memory, true);
});

test('v4 settings keep the per-file memory switches and derive the master', () => {
  const both = normalizeStored({ ...defaultState(), memoryFiles: { soul: true, memory: false } });
  assert.deepEqual(both.memoryFiles, { soul: true, memory: false });
  assert.equal(both.memory, true);
  const none = normalizeStored({ ...defaultState(), memory: true, memoryFiles: { soul: false, memory: false } });
  assert.equal(none.memory, false);
});

test('memory allows only the minimum tools, time and working directory', () => {
  const state = stateWith({ memory: true });
  const effective = effectiveFor(state, '');
  assert.equal(effective.memory, true);
  assert.equal(suppressedBy(effective, 'tools', 'read'), false);
  assert.equal(suppressedBy(effective, 'tools', 'write'), false);
  assert.equal(suppressedBy(effective, 'tools', 'edit'), false);
  assert.equal(suppressedBy(effective, 'tools', 'str_replace_editor'), false);
  assert.equal(suppressedBy(effective, 'tools', 'bash'), true);
  assert.equal(suppressedBy(effective, 'injected', 'time-context'), false);
  assert.equal(suppressedBy(effective, 'injected', 'agent-instructions'), true);
  assert.equal(suppressedBy(effective, 'runtime', 'working-directory:current'), false);
  assert.equal(suppressedBy(effective, 'runtime', 'sandbox:policy'), true);
  assert.equal(memoryAllows(effective, 'all', 'time-context'), true);
  assert.equal(memoryAllows(effective, 'all', 'runtime-context'), true);
  assert.equal(runtimeActive(effective), true);
  assert.equal(runtimeFullySuppressed(effective), false);
});

test('chat-only without memory keeps suppressing everything', () => {
  const state = stateWith({ memory: false });
  const effective = effectiveFor(state, '');
  assert.equal(suppressedBy(effective, 'tools', 'read'), true);
  assert.equal(suppressedBy(effective, 'injected', 'time-context'), true);
  assert.equal(suppressedBy(effective, 'runtime', 'working-directory:current'), true);
  assert.equal(runtimeFullySuppressed(effective), true);
});

test('explicit item denies override memory defaults', () => {
  const state = stateWith({
    memory: true,
    suppress: { runtime: true, tools: true, injected: true, all: true },
    deny: {
      runtime: ['working-directory:current'],
      tools: ['read'],
      injected: ['time-context'],
      all: [],
    },
  });
  const effective = effectiveFor(state, '');
  assert.equal(suppressedBy(effective, 'tools', 'read'), true);
  assert.equal(suppressedBy(effective, 'tools', 'write'), false);
  assert.equal(suppressedBy(effective, 'injected', 'time-context'), true);
  assert.equal(suppressedBy(effective, 'runtime', 'working-directory:current'), true);
  assert.equal(runtimeFullySuppressed(effective), true);
});

test('memory sends time and the trimmed runtime snapshot, drops other injections', () => {
  const state = stateWith({ memory: true });
  const effective = effectiveFor(state, '');
  const messages = [
    { role: 'user', source: { kind: 'user' } },
    { role: 'user', source: { kind: 'time-context' } },
    { role: 'user', source: { kind: 'agent-instructions' } },
    { role: 'user', source: { kind: 'runtime-context' } },
    { role: 'user', source: { kind: 'plan-mode' } },
    { role: 'assistant', source: { kind: 'assistant' } },
  ];
  const result = stripMessages(messages, effective);
  assert.deepEqual(
    result.messages.map((message) => message.source.kind),
    ['user', 'time-context', 'runtime-context', 'assistant'],
  );
  assert.equal(result.dropped, 2);
  assert.deepEqual(result.droppedKinds, { 'agent-instructions': 1, 'plan-mode': 1 });
});

test('without memory the runtime snapshot and time are dropped', () => {
  const state = stateWith({ memory: false });
  const effective = effectiveFor(state, '');
  const result = stripMessages([
    { role: 'user', source: { kind: 'time-context' } },
    { role: 'user', source: { kind: 'runtime-context' } },
  ], effective);
  assert.equal(result.messages.length, 0);
  assert.equal(result.dropped, 2);
});

test('item-level denial works while the master switch is off', () => {
  const state = stateWith({
    suppress: { runtime: false, tools: false, injected: false, all: false },
    deny: {
      runtime: ['sandbox:policy'],
      tools: ['bash'],
      injected: ['time-context'],
      all: ['plan-mode'],
    },
  });
  const effective = effectiveFor(state, '');
  assert.equal(suppressedBy(effective, 'tools', 'bash'), true);
  assert.equal(suppressedBy(effective, 'tools', 'read'), false);
  assert.equal(suppressedBy(effective, 'injected', 'time-context'), true);
  assert.equal(suppressedBy(effective, 'runtime', 'sandbox:policy'), true);
  assert.equal(suppressedBy(effective, 'runtime', 'working-directory:current'), false);
  assert.equal(runtimeActive(effective), true);
  const result = stripMessages([
    { role: 'user', source: { kind: 'user' } },
    { role: 'user', source: { kind: 'plan-mode' } },
    { role: 'user', source: { kind: 'time-context' } },
    { role: 'user', source: { kind: 'runtime-context' } },
  ], effective);
  assert.deepEqual(
    result.messages.map((message) => message.source.kind),
    ['user', 'runtime-context'],
  );
});

test('allow exceptions survive tool filtering', () => {
  const state = stateWith({
    suppress: { runtime: true, tools: true, injected: true, all: true },
    allow: { runtime: [], tools: ['read'], injected: [], all: [] },
    memory: true,
  });
  const effective = effectiveFor(state, '');
  const agent = {
    session: {
      requestHeader: () => ({ tools: [{ name: 'read' }] }),
      surface: { contentGeneration: 1 },
    },
  };
  const runtime = { generation: new WeakMap() };
  const assembly = { tools: [{ name: 'read' }, { name: 'write' }, { name: 'bash' }, { name: 'glob' }] };
  const result = decideTools(agent, assembly, effective, runtime);
  assert.deepEqual(result.assembly.tools.map((tool) => tool.name).sort(), ['read', 'write']);
  assert.equal(result.before, 4);
  assert.equal(result.after, 2);
  assert.equal(result.held, false);
});

test('custom mode config keeps its own memory and filters', () => {
  const state = stateWith({
    memory: false,
    modes: [{
      id: 'abc',
      name: 'Memory chat',
      promptMode: 'only',
      promptText: 'hi',
      suppress: { runtime: true, tools: true, injected: true, all: true },
      allow: { runtime: [], tools: ['read', 'write', 'edit'], injected: ['time-context'], all: [] },
      deny: { runtime: [], tools: [], injected: [], all: [] },
      memory: true,
      toolSafety: false,
      updatedAt: 1,
    }],
  });
  const custom = configForMode(state, 'custom:abc');
  assert.equal(custom.memory, true);
  assert.deepEqual(custom.allow.tools, ['read', 'write', 'edit']);
  assert.equal(custom.pure, true);
});

test('only prompt matching tolerates known memory extras', () => {
  const soul = '## Persistent persona (SOUL.md)\nBe kind.';
  const memory = '## Long-term memory (MEMORY.md)\n- likes tea';
  assert.equal(onlyPromptMatches('hello', 'hello'), true);
  assert.equal(onlyPromptMatches(`hello\n\n${memory}`, 'hello'), true);
  assert.equal(onlyPromptMatches(`${soul}\n\nhello`, 'hello'), true);
  assert.equal(onlyPromptMatches(`${soul}\n\nhello\n\n${memory}`, 'hello'), true);
  assert.equal(onlyPromptMatches('hello extra', 'hello'), false);
  assert.equal(onlyPromptMatches('old prompt', 'hello'), false);
  assert.equal(onlyPromptMatches(`hello\n\n## unrelated section`, 'hello'), false);
});

test('runtime projection keeps allowed contexts and drops the rest', () => {
  const state = stateWith({ memory: true });
  const effective = effectiveFor(state, 's1');
  const calls = [];
  const agent = {
    session: { id: 's1' },
    runtimeContext: {
      project(current, sections) {
        calls.push({ current, sections });
        return { ok: true };
      },
    },
  };
  const runtime = { patches: new Map() };
  installAgentRuntime(agent, effective, runtime, () => effective);
  const result = agent.runtimeContext.project('original', [
    { name: 'working-directory:current', text: 'cwd' },
    { name: 'sandbox:policy', text: 'sandbox' },
    { name: 'team:identity', text: 'team' },
  ]);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].sections.map((section) => section.name), ['working-directory:current']);
  assert.match(calls[0].current, /Current runtime context/);
  assert.match(calls[0].current, /cwd/);
  assert.doesNotMatch(calls[0].current, /sandbox/);
  assert.equal(joinRuntimeSections([]), '');
});

test('runtime projection drops the whole snapshot without memory', () => {
  const state = stateWith({ memory: false });
  const effective = effectiveFor(state, 's2');
  let called = 0;
  const agent = {
    session: { id: 's2' },
    runtimeContext: {
      project() {
        called += 1;
        return { ok: true };
      },
    },
  };
  installAgentRuntime(agent, effective, { patches: new Map() }, () => effective);
  const result = agent.runtimeContext.project('original', [
    { name: 'working-directory:current', text: 'cwd' },
  ]);
  assert.equal(result, undefined);
  assert.equal(called, 0);
});

test('runtime projection applies selective deny while the master is off', () => {
  const state = stateWith({
    suppress: { runtime: false, tools: false, injected: false, all: false },
    deny: { runtime: ['sandbox:policy'], tools: [], injected: [], all: [] },
  });
  const effective = effectiveFor(state, 's3');
  const calls = [];
  const agent = {
    session: { id: 's3' },
    runtimeContext: {
      project(current, sections) {
        calls.push({ current, sections });
        return { ok: true };
      },
    },
  };
  installAgentRuntime(agent, effective, { patches: new Map() }, () => effective);
  agent.runtimeContext.project('original', [
    { name: 'working-directory:current', text: 'cwd' },
    { name: 'sandbox:policy', text: 'sandbox' },
  ]);
  assert.deepEqual(calls[0].sections.map((section) => section.name), ['working-directory:current']);
  assert.doesNotMatch(calls[0].current, /sandbox/);
});

test('only mode replaces all sections before memory injection', () => {
  const assembly = {
    sections: [
      { name: 'harness:identity', text: 'identity' },
      { name: 'plugin:prompt-studio-memory', text: '## Long-term memory (MEMORY.md)\n- tea' },
    ],
    contexts: [],
    tools: [],
    variables: {},
  };
  const withMemory = rewriteSections(assembly, {
    promptMode: 'only',
    promptText: 'custom {{model}}',
    memory: true,
  }, 'DeepSeek');
  assert.deepEqual(withMemory.sections.map((section) => section.name), ['plugin:prompt-studio']);
  assert.equal(withMemory.sections[0].text, 'custom DeepSeek');
  const withoutMemory = rewriteSections(assembly, {
    promptMode: 'only',
    promptText: 'custom',
    memory: false,
  }, 'DeepSeek');
  assert.deepEqual(withoutMemory.sections.map((section) => section.name), ['plugin:prompt-studio']);
});

test('memory sections are injected from the session working directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'ps-memory-'));
  try {
    writeFileSync(join(root, 'MEMORY.md'), '- likes tea\n', 'utf8');
    writeFileSync(join(root, 'SOUL.md'), 'Be concise.\n', 'utf8');
    const agent = { session: { header: { cwd: root } } };
    const assembly = {
      sections: [
        { name: 'harness:identity', text: 'identity' },
        { name: 'plugin:other-memory', text: '## Long-term memory (MEMORY.md)\n- old entry' },
      ],
    };
    const out = injectMemorySections(assembly, agent, { memoryFiles: { soul: true, memory: true } });
    assert.deepEqual(out.sections.map((section) => section.name), [
      'plugin:workspace-soul',
      'harness:identity',
      'plugin:workspace-memory',
    ]);
    assert.match(out.sections[0].text, /Be concise/);
    assert.match(out.sections[2].text, /likes tea/);
    assert.doesNotMatch(out.sections[2].text, /old entry/);
    assert.equal(injectMemorySections(assembly, agent, { memoryFiles: { soul: false, memory: false } }), assembly);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a single memory file is injected without touching the other section', () => {
  const root = mkdtempSync(join(tmpdir(), 'ps-memory-one-'));
  try {
    writeFileSync(join(root, 'MEMORY.md'), '- likes tea\n', 'utf8');
    const agent = { session: { header: { cwd: root } } };
    const assembly = {
      sections: [
        { name: 'plugin:workspace-soul', text: '## Persistent persona (SOUL.md)\nfrom qq' },
        { name: 'harness:identity', text: 'identity' },
      ],
    };
    const out = injectMemorySections(assembly, agent, { memoryFiles: { soul: false, memory: true } });
    assert.deepEqual(out.sections.map((section) => section.name), [
      'plugin:workspace-soul',
      'harness:identity',
      'plugin:workspace-memory',
    ]);
    assert.equal(out.sections[0].text, '## Persistent persona (SOUL.md)\nfrom qq');
    assert.match(out.sections[2].text, /likes tea/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing memory files are announced instead of injected', () => {
  const root = mkdtempSync(join(tmpdir(), 'ps-memory-empty-'));
  try {
    const out = injectMemorySections(
      { sections: [] },
      { session: { header: { cwd: root } } },
      { memoryFiles: { soul: true, memory: true } },
    );
    assert.deepEqual(out.sections.map((section) => section.name), ['plugin:workspace-soul', 'plugin:workspace-memory']);
    assert.match(out.sections[0].text, /does not exist yet/);
    assert.match(out.sections[1].text, /does not exist yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('memory reader rejects symlinks or out-of-root files', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'ps-memory-link-'));
  const outside = join(tmpdir(), `ps-memory-outside-${process.pid}-${Date.now()}.md`);
  try {
    writeFileSync(outside, 'secret', 'utf8');
    try {
      symlinkSync(outside, join(root, 'MEMORY.md'), 'file');
    } catch (error) {
      t.skip(`symlink unavailable: ${error?.code ?? error?.message}`);
      return;
    }
    const file = readMemoryFile(root, 'MEMORY.md');
    assert.equal(file.content, '');
    assert.match(file.error, /符号链接|指向工作目录外/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

test('qq cwd parser reads the im-qqbot patch entry and skips other entries', () => {
  const home = mkdtempSync(join(tmpdir(), 'ps-qq-patch-'));
  try {
    const patch = join(home, 'cordis.patch.yml');
    writeFileSync(patch, [
      '# comment with - id: im-qqbot inside',
      "- id: llm-deepseek",
      '  config:',
      "    reasoningEffort: low",
      "- id: im-qqbot",
      '  config:',
      "    cwd: 'D:\\bot-files'",
      '    media:',
      '      ttlHours: 0',
      '- id: ui-chat',
      '  config:',
      '    cwd: should-not-count',
    ].join('\n'), 'utf8');
    assert.equal(qqCwdFromPatch(patch), 'D:\\bot-files');
    writeFileSync(patch, '- id: other\n  config:\n    cwd: nope\n', 'utf8');
    assert.equal(qqCwdFromPatch(patch), '');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('the qq workspace directory is excluded from memory management', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'ps-qq-home-'));
  const workspace = join(home, 'bot-files');
  mkdirSync(join(home, 'profiles', 'desktop'), { recursive: true });
  mkdirSync(workspace, { recursive: true });
  writeFileSync(
    join(home, 'profiles', 'desktop', 'cordis.patch.yml'),
    "- id: im-qqbot\n  config:\n    cwd: 'D:\\bot-files'\n",
    'utf8',
  );
  // Point the plugin at the fake home; the QQ cwd above does not exist on disk
  // in this temp tree, so register a second profile whose cwd does.
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = join(home, 'real-home');
  mkdirSync(join(process.env.DSH_HOME, 'profiles', 'desktop'), { recursive: true });
  writeFileSync(
    join(process.env.DSH_HOME, 'profiles', 'desktop', 'cordis.patch.yml'),
    `- id: im-qqbot\n  config:\n    cwd: '${workspace}'\n`,
    'utf8',
  );
  resetQQWorkspaceCache();
  t.after(() => {
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    resetQQWorkspaceCache();
    rmSync(home, { recursive: true, force: true });
  });

  assert.equal(isQQWorkspacePath(workspace), true);
  assert.equal(isQQWorkspacePath(join(home, 'something-else')), false);

  const agent = { session: { header: { cwd: workspace } } };
  const ctx = { get: (key) => (key === 'agents' ? { get: () => agent } : undefined) };
  assert.equal(workspaceRootOf(ctx, agent), '');
  const info = memoryRootInfo(ctx, 'session-qq');
  assert.equal(info.managedByQQ, true);

  const otherAgent = { session: { header: { cwd: join(home, 'other-workspace') } } };
  assert.equal(workspaceRootOf(ctx, otherAgent), join(home, 'other-workspace'));

  const assembly = { sections: [{ name: 'harness:identity', text: 'identity' }] };
  assert.equal(
    injectMemorySections(assembly, agent, { memoryFiles: { soul: true, memory: true } }),
    assembly,
  );
});
