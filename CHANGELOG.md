# Changelog

## 0.4.1

- Fix memory-related items being permanently disabled: “Memory default” items are now only marked when memory is on, and can still be checked to suppress. Turning memory off restores every item to a normal checkbox.
- Make memory work in **all sessions**. Chat-only/custom modes now read and inject `SOUL.md` / `MEMORY.md` from the current session working directory; missing files are announced so the model can create them with `write`. Existing memory sections with the same headers are replaced before injection.
- Keep explicit per-item denies authoritative over memory defaults, and preserve those denies when “select all” promotes a category back to the master switch.
- Add memory file safety checks (symlink/out-of-root/oversized rejection) and tests for per-workspace injection.

## 0.4.0

- Add a **memory** switch to chat-only and custom modes. It allows `read` / `write` / `edit` / `str_replace_editor`, `time-context` and `working-directory:current` for workspace memory.
- Add **per-item suppression** to all four categories (runtime contexts, tools, injections, other non-user messages). Each category keeps its master switch and gains a collapsed-by-default item list with allow/deny exceptions; selecting every ordinary item restores the old “block everything” behavior.
- Mark items needed by memory as “Memory default”.
- Filter tools by schema name and runtime contexts by context name instead of dropping the whole tool list or the whole runtime projection. The runtime projection wrapper can now keep `working-directory:current` while removing sandbox/approval/team contexts.
- Add `allow` / `deny` lists and `memory` to the settings schema; v2 settings migrate to v3 with chat-only still suppressing all four categories.
- Show observed tool names, runtime context names and injected message kinds in the item lists; the settings page lists them after the first turn.
- Update README, locale strings, package metadata and add suppression unit tests.

## 0.3.0

- Add **custom modes**: each mode stores its own name, prompt mode/text, suppression switches and tool-baseline protection; create, edit and delete them in Settings.
- Add a **default mode for new chats**. The mode list is now normal mode, chat only and custom modes; the previous global mode and "follow global settings" option were removed.
- Rename 正常模式 to 普通模式 and 纯聊天 to 仅聊天 across the UI, locales and documentation.
- Put normal mode first and use a blue dot for it; chat only and custom modes follow.
- Rework the settings page into a chat-only prompt editor, custom modes manager and new-chat default mode selector.
- Switching the current chat mode now forces a request-series restart on the next turn, so the new mode's system prompt replaces the old in-history prompt. Reopened sessions also get one clean rebuild when an old system prompt is present. The assembly diagnostics report the restart.
- Add settings schema v2 with automatic migration from v1; legacy global-mode sessions map to normal or chat only.
- Update locale metadata, README and package metadata for the new mode model.

## 0.2.0

- Add explicit **full prompt replacement**: all other system sections, including Agent Teams and tool guidance, are removed.
- Force a request-series restart when the prompt mode/text changes or existing system prompts do not match, so DSH replaces old system nodes instead of appending the new prompt after them.
- Use the host `Menu`, `Button` and `SegmentedControl` primitives instead of custom-drawn controls.
- Follow the host light/dark theme service in the settings page; add a theme-aware native outline for the session mode selector.
- Bind the conversation input dock to the composer width and raise it above the composer.
- Remove the textarea resize grip (the white bottom-right square).

## 0.1.0

- Initial release: editable initial system prompt, pure-chat suppression switches, per-session mode overrides, and diagnostics.
