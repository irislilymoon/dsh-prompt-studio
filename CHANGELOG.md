# Changelog

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
