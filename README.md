# Nodex

> Your Notion Agent. Available anywhere OpenAI models work.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Languages:** 🇬🇧 [English](README.md) · 🇨🇳 [中文](docs/i18n/README.zh-CN.md) · 🇮🇳 [हिन्दी](docs/i18n/README.hi.md) · 🇪🇸 [Español](docs/i18n/README.es.md) · 🇫🇷 [Français](docs/i18n/README.fr.md) · 🇸🇦 [العربية](docs/i18n/README.ar.md) · 🇧🇩 [বাংলা](docs/i18n/README.bn.md) · 🇧🇷 [Português](docs/i18n/README.pt-BR.md) · 🇷🇺 [Русский](docs/i18n/README.ru.md) · 🇵🇰 [اردو](docs/i18n/README.ur.md) · 🇩🇪 [Deutsch](docs/i18n/README.de.md) · 🇯🇵 [日本語](docs/i18n/README.ja.md) · 🇮🇹 [Italiano](docs/i18n/README.it.md) · 🇺🇦 [Українська](docs/i18n/README.uk.md) · 🇵🇱 [Polski](docs/i18n/README.pl.md) · 🇷🇸 [Српски](docs/i18n/README.sr.md)

Nodex connects a Notion Custom Agent to Codex through a local OpenAI-compatible API. Your agent stays in Notion. Your files and tools stay on your computer.

## Start in one minute

```bash
npm install nodex-ai
npx nodex
```

The setup wizard opens Notion, finds your Custom Agents, creates a local config and API key, and gives you the exact Codex provider snippet.

```text
Install Nodex.
Connect Notion.
Choose your agent.
Use it from Codex.
```

Start the bridge whenever you need it:

```bash
npx nodex serve
```

## Use with Codex

Add the snippet shown by the wizard to your user-level `~/.codex/config.toml`:

```toml
model = "codex-notion-agent"
model_provider = "nodex"

[model_providers.nodex]
name = "Nodex"
base_url = "http://127.0.0.1:8787/v1"
env_key = "NODEX_API_KEY"
wire_api = "responses"
requires_openai_auth = false
```

Nodex reads the generated `.env` when the server starts. Export the same `NODEX_API_KEY` from that file in the shell that launches Codex.

## What Nodex gives you

- OpenAI-compatible `/v1/responses` with JSON and streaming output.
- Notion Custom Agents as local model bindings.
- Automatic Custom Agent discovery and the correct internal instructions page ID.
- A strong local API key and safe local storage.
- Notion model sync and Codex-compatible tool-call state.
- Backward compatibility for existing `agentPageId` configs.

## Where data lives

Project config stays in `nodex.config.json`; project secrets stay in `.env`. Notion credentials and the dedicated persistent browser profile stay under `~/.nodex` and are never read from your normal browser profile.

## Important note

Nodex uses an unofficial private Notion API. It may break when Notion changes its internals. Nodex is not affiliated with Notion or OpenAI. Keep the server on `127.0.0.1` and never commit credentials, `.env`, local config, browser data, logs, HAR files, or SQLite databases.

## Advanced

- [Manual configuration](docs/advanced/manual-config.md)
- [Notion workflow ID vs. instructions page ID](docs/advanced/notion-agent-id.md)
- [Troubleshooting](docs/advanced/troubleshooting.md)
- [Security model](docs/advanced/security.md)
- [Contributing](CONTRIBUTING.md)

The normal setup flow does not require DevTools or manual JSON editing.

## License

[Apache License 2.0](LICENSE)
