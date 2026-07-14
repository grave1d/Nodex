# Changelog

All notable changes to this project will be documented in this file.

This project uses semantic versioning while the public API stabilizes. During `0.x`, breaking changes may still happen between minor versions.

## [Unreleased]

## [0.1.24] - 2026-07-14

### Fixed

- Graceful shutdown now waits for cancelled background responses before closing SQLite.

## [0.1.23] - 2026-07-14

### Added

- Release documentation and repository metadata.
- Apache-2.0 license.
- Security policy and contribution guidelines.
- GitHub Actions verification for Node.js 22 and 24 on Ubuntu and Windows.
- Dependabot updates for npm dependencies and GitHub Actions.
- The publishable npm package name `nodex-ai` while retaining the `nodex` CLI binary.
- Local OpenAI-compatible bridge for connecting Notion Custom Agents to Codex.
- Responses API support for Codex-native tool flows.
- Function and custom/freeform tool call lifecycle support.
- Local response, conversation, and file persistence.
- Browser and manual Notion authentication flows.
- Interactive local dashboard for `nodex serve`.
- Multilingual README documentation.

### Fixed

- Test isolation from a developer shell's `NODEX_API_KEY`.
- README license and release-checklist text after adding Apache-2.0.
- Clone-based CLI instructions that could resolve to an unrelated npm package.

### Security

- Local bearer-token protection via `NODEX_API_KEY`.
- Local-first default binding behavior.
- Redacted diagnostic logging.

[Unreleased]: https://github.com/grave1d/Nodex/compare/v0.1.24...HEAD
[0.1.24]: https://github.com/grave1d/Nodex/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/grave1d/Nodex/releases/tag/v0.1.23
