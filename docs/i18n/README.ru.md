# Nodex

> Используй своего Notion Custom Agent как мозг Codex.

[![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/) [![API](https://img.shields.io/badge/API-OpenAI%20Responses-000000)](https://platform.openai.com/docs/api-reference/responses) [![Tools](https://img.shields.io/badge/tools-local%20execution-blue)](#security-notes) [![Notion](https://img.shields.io/badge/Notion-Custom%20Agent-black)](https://www.notion.so/product/ai)

**npm package:** `nodex-ai` · **installed CLI command:** `nodex`

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

---

Nodex соединяет вашего Notion Custom Agent с Codex через локальный OpenAI-совместимый Responses API. Агент, модель, персона, инструкции и знания остаются в Notion. Codex остаётся локальной рабочей средой, где выполняются файлы, shell-команды, патчи и инструменты.

**Без MCP. Без удалённой оболочки. Без выполнения инструментов внутри Nodex.** Инструменты выполняет Codex на вашем компьютере; Nodex только передаёт запросы, ответы и состояние tool calls.

> [!WARNING]
> Nodex использует приватный API Notion `runInferenceTranscript`. Этот API может измениться без предупреждения. Используйте только свой аккаунт, храните credentials приватно и никогда не коммитьте cookies, HAR-captures, tokens, logs или локальные базы.

## Что такое Nodex?

Nodex — локальный мост между Notion Custom Agent и Codex. Вы создаёте AI Агента в Notion, выбираете модель, пишете инструкцию, подключаете свой Notion-аккаунт к Nodex и настраиваете Codex на кастомный API provider. После этого агент Notion думает, а Codex работает в вашем проекте как обычно.

## Зачем Nodex?

- **Notion становится мозгом.** Персона агента, prompt, выбор модели и знания живут в Notion.
- **Codex остаётся руками.** Изменение файлов, shell-команды, патчи и инструменты выполняются локально через Codex.
- **Нативный поток Codex.** Responses API items, function calls, custom/freeform tools, call outputs, commentary и final answers маппятся в workflow Codex.
- **Без настройки MCP.** Nodex поднимает локальный OpenAI-совместимый API, поэтому Codex видит его как provider модели.
- **Local-first по умолчанию.** Мост слушает `127.0.0.1`, использует локальный API key и хранит состояние responses/conversations локально.

## Как это работает

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

Nodex не запускает инструменты. Он сериализует диалог, общается с Notion Custom Agent, превращает события протокола Notion в OpenAI-совместимые Responses items и отдаёт Codex tool calls для локального исполнения.

## Требования

- Node.js 20 или новее
- Аккаунт Notion с доступом к Custom Agent
- Chrome или Chromium для рекомендуемого browser login flow
- Codex, если нужен нативный опыт Codex

## Быстрый старт

### Windows PowerShell

```powershell
git clone https://github.com/grave1d/Nodex.git
Set-Location Nodex
npm install
Copy-Item nodex.config.example.json nodex.config.json
npm run build
node dist/cli.js auth
```

### macOS / Linux

```bash
git clone https://github.com/grave1d/Nodex.git
cd Nodex
npm install
cp nodex.config.example.json nodex.config.json
npm run build
node dist/cli.js auth
```

## Настройка binding для Notion-агента

Откройте `nodex.config.json` и добавьте model binding. `agentPageId` берётся из URL вашего Notion Custom Agent. Публичное имя модели, например `codex-notion-agent`, — это имя для Codex.

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

## Запуск моста

Используйте локальный случайный API key. То же значение должно быть доступно в терминале, где вы запускаете Codex.

### Windows PowerShell

```powershell
$env:NODEX_API_KEY = "replace-with-a-local-random-value"
node dist/cli.js serve
```

### macOS / Linux

```bash
export NODEX_API_KEY="replace-with-a-local-random-value"
node dist/cli.js serve
```

## Проверка доступа

```bash
node dist/cli.js doctor
node dist/cli.js doctor --live
```

`node dist/cli.js doctor` проверяет локальный config и credentials. `node dist/cli.js doctor --live` создаёт реальный Notion-тред и расходует Notion AI quota.

## Подключение Codex

Добавьте custom provider в пользовательский `~/.codex/config.toml` (`$HOME/.codex/config.toml` на Windows). Project-local Codex config не должен объявлять `model_providers`.

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

Откройте новый терминал с тем же `NODEX_API_KEY`, перейдите в проект и запустите `codex`. Значение `model` должно совпадать с ключом в `models` внутри `nodex.config.json`.

## Model binding

Каждый публичный model ID указывает на одного Notion Custom Agent.

| Field | Meaning |
| --- | --- |
| `agentPageId` | Private Notion Custom Agent page ID. Never expose it in `/v1/models`. |
| `agentName` | Local display name. |
| `notionModel` | Model label sent to the Notion inference transcript. |
| `notionModelSlug` | Internal Notion model type value. Example: `orange-mousse`. |
| `syncNotionModel` | When `true`, Nodex can save/publish the Notion agent model setting before inference. |
| `capabilities` | Advertised feature flags for the binding. |

## Поддерживаемая API-поверхность

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

## Интерактивная консоль

В реальном TTY `node dist/cli.js serve` показывает компактный локализованный dashboard со здоровьем сервера, API URL и активными model bindings.

- `H` or `?` — help
- `R` — run a deep Notion health check
- `L` — switch UI language
- `C` — redraw
- `Q` or `Ctrl+C` — graceful shutdown

<a id="security-notes"></a>

## Безопасность

- Оставляйте `NODEX_HOST=127.0.0.1`, если вы полностью не понимаете риск публикации моста в сеть.
- Используйте сильный локальный `NODEX_API_KEY` и запускайте Codex с тем же значением.
- Не коммитьте `nodex.config.json`, `.env`, credentials, cookies, SQLite-файлы, HAR-captures или сырые upstream logs.
- Browser auth flow хранит Notion credentials локально в `~/.nodex/credentials.json`.
- Используйте `node dist/cli.js auth --manual`, если browser automation не проходит Notion login или SSO.

## Troubleshooting

**Codex пишет `TOOLS []`.**  
Проверьте, что Codex настроен на `wire_api = "responses"` и используется актуальная сборка Nodex.

**Каждый запрос `/v1/*` возвращает `401`.**  
Сервер и терминал Codex должны использовать один и тот же `NODEX_API_KEY`.

**Custom Agent не найден.**  
Проверьте `agentPageId`, выполните `node dist/cli.js auth`, затем `node dist/cli.js doctor`.

**Нужно больше диагностики.**  
Запустите `node dist/cli.js doctor`, используйте dashboard или включите `NODEX_VERBOSE=1`.

## Разработка

Перед pull request или релизом выполните:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Release checklist

- Убедитесь, что версии в `package.json`, `package-lock.json`, `CHANGELOG.md` и release tag совпадают.
- Держите `README.md` и все `docs/i18n/README.*.md` синхронизированными.
- Запустите typecheck, lint, tests и build.
- Создайте git tag, например `v0.1.23`.
- Опубликуйте GitHub Release с понятными notes, breaking changes и upgrade-инструкцией.

## Лицензия

Nodex распространяется по [лицензии Apache 2.0](../../LICENSE).

## Disclaimer

Nodex — неофициальный мост для личных developer workflows. Проект не аффилирован с Notion или OpenAI.
