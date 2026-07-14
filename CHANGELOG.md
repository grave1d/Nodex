# Changelog

All notable changes to this project will be documented in this file.

This project uses semantic versioning while the public API stabilizes. During `0.x`, breaking changes may still happen between minor versions.

## [Unreleased]

## [0.3.0] - 2026-07-14

### Added

- Setup language selection now includes every language available in the README and persists the choice.
- Custom Agent setup now includes a Notion model picker built from known and workspace-discovered models.
- Animated progress states now cover setup operations.

### Changed

- First launch defaults to English, and disconnected setup shows only connection, language, documentation, and exit actions.
- Connected setup offers an explicit Notion account switch and returns directly to the menu after API-key security handling.
- The private-API warning is no longer printed in the setup header or CLI help.

### Fixed

- Setup and server dashboards hide the terminal cursor while active and restore it on exit.
- Diagnostic results remain visible while waiting for the user to continue.

## [0.2.0] - 2026-07-14

### Added

- Interactive Russian/English setup wizard for no-argument TTY launches and `nodex setup`.
- Persistent dedicated-browser Notion sign-in with clear progress and masked credential status.
- Automatic Notion Custom Agent discovery without inference, test messages, or thread creation.
- Canonical `agentInstructionsPageId` bindings and workflow-ID diagnostics in Doctor.
- Safe config generation/migration with confirmation and timestamped backups.
- Strong local API-key generation, `.env` loading, `.gitignore` guidance, and Codex provider output.
- Explicit safe connection verification and opt-in live testing with quota warning.
- Concise quickstart documentation, 15 synchronized translations, and advanced guides.

### Changed

- `nodex` without arguments opens setup only in an interactive TTY; non-interactive launches print plain help.
- New configurations use `agentInstructionsPageId`; `agentPageId` remains a deprecated compatibility alias.
- Browser authentication reuses only `~/.nodex/browser-profile` and never reads the user's main browser profile.
- Package documentation and metadata now target the 0.2.0 setup-first experience.

### Security

- Complete local API keys and Notion credentials are never printed by setup.
- Manual credential input is hidden.
- Canonical agent IDs are redacted from structured logs.
- The npm file allowlist includes documentation while excluding local secrets, profiles, databases, logs, and captures.

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

[Unreleased]: https://github.com/grave1d/Nodex/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/grave1d/Nodex/compare/v0.1.24...v0.2.0
[0.1.24]: https://github.com/grave1d/Nodex/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/grave1d/Nodex/releases/tag/v0.1.23
