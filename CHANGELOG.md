# Changelog

## 0.2.0

- Add explicit **full prompt replacement**: all other system sections, including Agent Teams and tool guidance, are removed.
- Force a request-series restart when the prompt mode/text changes or existing system prompts do not match, so DSH replaces old system nodes instead of appending the new prompt after them.
- Use the host `Menu`, `Button` and `SegmentedControl` primitives instead of custom-drawn controls.
- Follow the host light/dark theme service in the settings page; add a theme-aware native outline for the session mode selector.
- Bind the conversation input dock to the composer width and raise it above the composer.
- Remove the textarea resize grip (the white bottom-right square).

## 0.1.0

- Initial release: editable initial system prompt, pure-chat suppression switches, per-session mode overrides, and diagnostics.
