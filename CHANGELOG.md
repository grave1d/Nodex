# Changelog

All notable changes to this project will be documented in this file.

This project uses semantic versioning while the public API stabilizes. During `0.x`, breaking changes may still happen between minor versions.

## [Unreleased]

### Added

- Release documentation and repository metadata.
- Apache-2.0 license.
- Security policy and contribution guidelines.

## [0.1.23] - 2026-07-14

### Added

- Local OpenAI-compatible bridge for connecting Notion Custom Agents to Codex.
- Responses API support for Codex-native tool flows.
- Function and custom/freeform tool call lifecycle support.
- Local response, conversation, and file persistence.
- Browser and manual Notion authentication flows.
- Interactive local dashboard for `nodex serve`.
- Multilingual README documentation.

### Security

- Local bearer-token protection via `NODEX_API_KEY`.
- Local-first default binding behavior.
- Redacted diagnostic logging.

[Unreleased]: https://github.com/grave1d/Nodex/compare/v0.1.23...HEAD
[0.1.23]: https://github.com/grave1d/Nodex/releases/tag/v0.1.23
