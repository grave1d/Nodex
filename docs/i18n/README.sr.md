# Nodex

> Ваш Notion Agent — свуда где раде OpenAI модели.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex повезује Notion Custom Agent са Codex-ом преко локалног OpenAI-компатибилног API-ја. Агент остаје у Notion-у, а датотеке и алати на вашем рачунару.

## Почните за минут

```bash
npm install nodex-ai
npx nodex
```

Чаробњак отвара пријаву у Notion, проналази Custom Agents, прави локални config и API key и приказује спреман Codex provider.

```text
Инсталирајте Nodex.
Повежите Notion.
Изаберите агента.
Користите га у Codex-у.
```

За следеће покретање:

```bash
npx nodex serve
```

## Употреба са Codex-ом

Додајте исечак из чаробњака у кориснички `~/.codex/config.toml`:

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

Nodex сервер чита направљени `.env`. Извезите исти `NODEX_API_KEY` у shell-у који покреће Codex.

## Шта Nodex пружа

- OpenAI-компатибилан `/v1/responses` са JSON и streaming излазом.
- Аутоматско проналажење агената и исправног internal instructions page ID-а.
- Јак локални API key и безбедно локално чување.
- Синхронизацију Notion модела и Codex-компатибилан tool-call flow.
- Компатибилност са старим `agentPageId` config-ом.

## Где су подаци

Config пројекта је у `nodex.config.json`, а secret у `.env`. Notion credentials и наменски persistent browser profile су у `~/.nodex`; Nodex не чита уобичајени профил прегледача.

## Важно

Nodex користи незванични приватни Notion API. Унутрашње промене Notion-а могу прекинути рад. Пројекат није повезан са Notion-ом или OpenAI-јем. Оставите сервер на `127.0.0.1` и не commit-ујте credentials, `.env`, local config, browser data, logs, HAR или SQLite.

## Напредно

- [Ручна конфигурација](../advanced/manual-config.md)
- [Workflow ID и instructions page ID](../advanced/notion-agent-id.md)
- [Решавање проблема](../advanced/troubleshooting.md)
- [Безбедносни модел](../advanced/security.md)

Уобичајени setup не тражи DevTools ни ручно уређивање JSON-а.

## Лиценца

[Apache License 2.0](../../LICENSE)
