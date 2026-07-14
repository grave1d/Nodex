# Nodex

> Ваш Notion Agent — усюди, де працюють OpenAI-моделі.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex підключає Notion Custom Agent до Codex через локальний OpenAI-сумісний API. Агент залишається в Notion, а файли й інструменти — на вашому комп'ютері.

## Старт за хвилину

```bash
npm install nodex-ai
npx nodex
```

Майстер відкриє вхід до Notion, знайде Custom Agents, створить локальні config та API key і покаже готовий provider для Codex.

```text
Встановіть Nodex.
Підключіть Notion.
Оберіть агента.
Використовуйте його в Codex.
```

Для наступного запуску:

```bash
npx nodex serve
```

## Підключення Codex

Додайте фрагмент від майстра до користувацького `~/.codex/config.toml`:

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

Сервер Nodex читає створений `.env`. Експортуйте той самий `NODEX_API_KEY` в оболонці, з якої запускаєте Codex.

## Що дає Nodex

- OpenAI-сумісний `/v1/responses` з JSON і streaming.
- Автоматичний пошук Custom Agents та правильного internal instructions page ID.
- Сильний локальний API key і безпечне локальне зберігання.
- Синхронізацію моделі Notion і сумісний із Codex tool-call flow.
- Сумісність зі старими config-файлами з `agentPageId`.

## Де зберігаються дані

Config проєкту міститься в `nodex.config.json`, секрет — у `.env`. Credentials Notion та окремий persistent browser profile зберігаються в `~/.nodex`; Nodex не читає основний профіль браузера.

## Важливо

Nodex використовує неофіційний приватний API Notion, тому внутрішні зміни Notion можуть його зламати. Проєкт не пов'язаний із Notion або OpenAI. Залишайте сервер на `127.0.0.1` і не комітьте credentials, `.env`, local config, browser data, logs, HAR чи SQLite.

## Докладніше

- [Ручна конфігурація](../advanced/manual-config.md)
- [Workflow ID та instructions page ID](../advanced/notion-agent-id.md)
- [Усунення проблем](../advanced/troubleshooting.md)
- [Модель безпеки](../advanced/security.md)

Звичайний setup не потребує DevTools або ручного редагування JSON.

## Ліцензія

[Apache License 2.0](../../LICENSE)
