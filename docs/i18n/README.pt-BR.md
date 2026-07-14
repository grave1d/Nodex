# Nodex

> Use seu Notion Custom Agent como o cérebro do Codex.

[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/) [![API](https://img.shields.io/badge/API-OpenAI%20Responses-000000)](https://platform.openai.com/docs/api-reference/responses) [![Tools](https://img.shields.io/badge/tools-local%20execution-blue)](#security-notes) [![Notion](https://img.shields.io/badge/Notion-Custom%20Agent-black)](https://www.notion.so/product/ai)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

---

Nodex conecta seu Notion Custom Agent ao Codex por meio de uma API Responses local compatível com OpenAI. O agente, modelo, persona, instruções e conhecimento ficam no Notion. O Codex continua sendo o workspace local onde arquivos, comandos shell, patches e ferramentas são executados.

**Sem MCP. Sem shell remoto. Nodex não executa ferramentas.** Codex executes tools on your machine; Nodex only bridges requests, responses, and tool-call state.

> [!WARNING]
> Nodex uses Notion's private `runInferenceTranscript` API. It can change without notice. Use your own account only, keep credentials private, and never commit cookies, HAR captures, tokens, logs, or local databases.

## O que é Nodex?

Nodex é uma ponte local entre Notion Custom Agent e Codex. Crie um agente de IA no Notion, escolha o modelo, escreva instruções, conecte o Notion ao Nodex e configure o Codex para usar Nodex como provider API customizado.

## Por que Nodex?

- **Notion becomes the brain.** Agent persona, prompt, model selection, and knowledge live in Notion.
- **Codex stays the hands.** File edits, shell commands, patches, and tool execution still happen locally through Codex.
- **Native Codex flow.** Responses API items, function calls, custom/freeform tools, call outputs, commentary, and final answers are mapped into the Codex workflow.
- **No MCP setup.** Nodex exposes a local OpenAI-compatible API, so Codex can talk to it like to a model provider.
- **Local-first by default.** The bridge binds to `127.0.0.1`, uses a local API key, and stores response/conversation state locally.

## Como funciona

```text
Codex / OpenAI-compatible client
        │
        │  POST /v1/responses
        ▼
Nodex on 127.0.0.1
        │
        │  Notion private agent protocol
        ▼
Notion Custom Agent
        │
        │  tool call / final answer
        ▼
Nodex maps events back to Responses API items
        │
        ▼
Codex executes tools locally on your computer
```

Nodex does not run tools. It serializes the conversation, talks to the Notion Custom Agent, maps Notion protocol events to OpenAI-compatible Responses items, and gives Codex the tool calls to execute locally.

## Requisitos

- Node.js 20 or newer
- A Notion account with access to a Custom Agent
- Chrome or Chromium for the recommended browser login flow
- Codex if you want the native Codex experience

## Início rápido

### Windows PowerShell

```powershell
git clone https://github.com/grave1d/Nodex.git
Set-Location Nodex
npm install
Copy-Item nodex.config.example.json nodex.config.json
npm run build
npx nodex auth
```

### macOS / Linux

```bash
git clone https://github.com/grave1d/Nodex.git
cd Nodex
npm install
cp nodex.config.example.json nodex.config.json
npm run build
npx nodex auth
```

## Configure your Notion agent binding

Open `nodex.config.json` and add a model binding. `agentPageId` comes from the URL of your Notion Custom Agent. The public model name, for example `codex-notion-agent`, is the name you will use in Codex.

```json
{
  "models": {
    "codex-notion-agent": {
      "agentPageId": "00000000-0000-0000-0000-000000000000",
      "agentName": "My Notion Agent",
      "notionModel": "GPT-5.6 Sol",
      "notionModelSlug": "orange-mousse",
      "syncNotionModel": true
    }
  }
}
```

## Start the bridge

Use a local random API key. The same value must be available in the terminal where you launch Codex.

### Windows PowerShell

```powershell
$env:NODEX_API_KEY = "replace-with-a-local-random-value"
npx nodex serve
```

### macOS / Linux

```bash
export NODEX_API_KEY="replace-with-a-local-random-value"
npx nodex serve
```

## Verify access

```bash
npx nodex doctor
npx nodex doctor --live
```

`npx nodex doctor` checks local config and credentials. `npx nodex doctor --live` creates a real Notion thread and consumes Notion AI quota.

## Conectar Codex

Add a custom provider to your user-level `~/.codex/config.toml` (`$HOME/.codex/config.toml` on Windows). Project-local Codex config should not define `model_providers`.

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

Open a new terminal with the same `NODEX_API_KEY`, enter your project, and start `codex`. The `model` value must match a key under `models` in `nodex.config.json`.

## Model binding

Each public model ID maps to one Notion Custom Agent.

| Field | Meaning |
| --- | --- |
| `agentPageId` | Private Notion Custom Agent page ID. Never expose it in `/v1/models`. |
| `agentName` | Local display name. |
| `notionModel` | Model label sent to the Notion inference transcript. |
| `notionModelSlug` | Internal Notion model type value. Example: `orange-mousse`. |
| `syncNotionModel` | When `true`, Nodex can save/publish the Notion agent model setting before inference. |
| `capabilities` | Advertised feature flags for the binding. |

## Supported API surface

| Area | Status |
| --- | --- |
| Responses JSON and SSE | Supported primary path, including Responses Lite tool catalogs. |
| Function and custom/freeform tools | Supported through the call/output lifecycle. |
| Codex commentary and final phases | Mapped to native assistant message items. |
| Stored responses and `previous_response_id` | Supported subset with local persistence. |
| Conversations and Files APIs | Local CRUD and storage. |
| Chat Completions | Legacy compatibility; Responses is the recommended path. |
| Images and embeddings | Optional OpenAI-compatible providers, separate from Notion. |
| Notion image/file input | Not advertised by the built-in Notion transport. |

### Main endpoints

- `POST /v1/responses`
- `GET /v1/responses/{id}` and `POST /v1/responses/{id}/cancel`
- `POST /v1/chat/completions`
- `/v1/conversations` and `/v1/conversations/{id}/items`
- `/v1/files` and `/v1/files/{id}/content`
- `POST /v1/images/generations` and `POST /v1/images/edits`
- `POST /v1/embeddings`
- `GET /v1/models` and `GET /v1/models/{id}`
- `GET /healthz` and `GET /healthz?deep=1`

## Interactive console

In a real TTY, `npx nodex serve` shows a compact localized dashboard with server health, API URLs, and active model bindings.

- `H` or `?` — help
- `R` — run a deep Notion health check
- `L` — switch UI language
- `C` — redraw
- `Q` or `Ctrl+C` — graceful shutdown

<a id="security-notes"></a>

## Segurança

- Keep `NODEX_HOST=127.0.0.1` unless you fully understand the risk of exposing the bridge on a network.
- Use a strong local `NODEX_API_KEY` and launch Codex with the same value.
- Do not commit `nodex.config.json`, `.env`, credentials, cookies, SQLite files, HAR captures, or raw upstream logs.
- The browser auth flow stores Notion credentials locally under `~/.nodex/credentials.json`.
- Use `npx nodex auth --manual` if browser automation cannot pass your Notion login or SSO flow.

## Troubleshooting

**Codex says `TOOLS []`.**  
Make sure Codex is configured for `wire_api = "responses"` and that you are running a current Nodex build.

**Every `/v1/*` request returns `401`.**  
The server and Codex terminal must use the same `NODEX_API_KEY`.

**The Custom Agent cannot be found.**  
Check `agentPageId`, run `npx nodex auth`, then run `npx nodex doctor`.

**Need more diagnostics.**  
Run `npx nodex doctor`, use the interactive dashboard, or set `NODEX_VERBOSE=1`.

## Development

Before opening a pull request or cutting a release, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Release checklist

- Add a real `LICENSE` file before publishing a stable release.
- Keep `README.md` and every `docs/i18n/README.*.md` in sync.
- Run typecheck, lint, tests, and build.
- Create a git tag such as `v0.1.23`.
- Publish a GitHub Release with clear notes, breaking changes, and upgrade instructions.

## Licença

Choose and add a `LICENSE` file before a stable public release. For this kind of developer tool, Apache-2.0 is a strong default because it is permissive and includes an explicit patent grant. MIT is also fine if you want the shortest and simplest permissive license.

## Disclaimer

Nodex is an unofficial bridge for personal developer workflows. It is not affiliated with Notion or OpenAI.
