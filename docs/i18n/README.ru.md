# Nodex

> Ваш Notion Agent — везде, где работают OpenAI-модели.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex подключает Notion Custom Agent к Codex через локальный OpenAI-совместимый API. Агент остаётся в Notion. Файлы и инструменты остаются на вашем компьютере.

## Запуск за минуту

```bash
npm install nodex-ai
npx nodex
```

Мастер откроет вход в Notion, сам найдёт Custom Agents, создаст локальный config и API-ключ, а затем покажет готовый provider для Codex.

```text
Установите Nodex.
Подключите Notion.
Выберите агента.
Используйте его в Codex.
```

Для следующего запуска достаточно:

```bash
npx nodex serve
```

## Подключение Codex

Добавьте показанный мастером фрагмент в пользовательский `~/.codex/config.toml`:

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

Сервер Nodex читает созданный `.env`. Перед запуском Codex экспортируйте из него тот же `NODEX_API_KEY` в текущую оболочку.

## Что даёт Nodex

- OpenAI-совместимый `/v1/responses` с JSON и streaming.
- Автопоиск Custom Agents и правильного internal instructions page ID.
- Сильный локальный API-ключ и безопасное локальное хранение.
- Синхронизацию модели Notion и совместимый с Codex tool-call flow.
- Совместимость со старыми config-файлами, где указан `agentPageId`.

## Где хранятся данные

Config проекта находится в `nodex.config.json`, секрет проекта — в `.env`. Credentials Notion и отдельный persistent browser profile находятся в `~/.nodex`; Nodex не читает основной профиль вашего браузера.

## Важно

Nodex использует неофициальный приватный API Notion. Изменения внутри Notion могут его сломать. Проект не аффилирован с Notion или OpenAI. Оставляйте сервер на `127.0.0.1` и не коммитьте credentials, `.env`, локальный config, browser data, логи, HAR или SQLite.

## Подробнее

- [Ручная конфигурация](../advanced/manual-config.md)
- [Workflow ID и instructions page ID](../advanced/notion-agent-id.md)
- [Решение проблем](../advanced/troubleshooting.md)
- [Модель безопасности](../advanced/security.md)

В обычном сценарии DevTools и ручное редактирование JSON не нужны.

## Лицензия

[Apache License 2.0](../../LICENSE)
