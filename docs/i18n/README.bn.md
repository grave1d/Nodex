# Nodex

> আপনার Notion Agent—যেখানে OpenAI models কাজ করে, সেখানেই।

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex একটি local OpenAI-compatible API দিয়ে Notion Custom Agent-কে Codex-এর সঙ্গে যুক্ত করে। Agent থাকে Notion-এ; files ও tools থাকে আপনার computer-এ।

## এক মিনিটে শুরু করুন

```bash
npm install nodex-ai
npx nodex
```

Setup wizard Notion sign-in খুলে, Custom Agents খুঁজে, local config ও API key তৈরি করে এবং প্রস্তুত Codex provider দেখায়।

```text
Nodex install করুন।
Notion connect করুন।
Agent বেছে নিন।
Codex-এ ব্যবহার করুন।
```

পরেরবার চালাতে:

```bash
npx nodex serve
```

## Codex-এর সঙ্গে ব্যবহার

Wizard-এর snippet user-level `~/.codex/config.toml`-এ যোগ করুন:

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

Nodex server তৈরি করা `.env` পড়ে। যে shell থেকে Codex চালাবেন, সেখানে একই `NODEX_API_KEY` export করুন।

## Nodex যা দেয়

- JSON ও streaming সহ OpenAI-compatible `/v1/responses`।
- Custom Agents এবং সঠিক internal instructions page ID-এর automatic discovery।
- শক্তিশালী local API key ও নিরাপদ local storage।
- Notion model sync এবং Codex-compatible tool-call flow।
- পুরোনো `agentPageId` config-এর compatibility।

## Data কোথায় থাকে

Project config থাকে `nodex.config.json`-এ এবং secret থাকে `.env`-এ। Notion credentials ও dedicated persistent browser profile থাকে `~/.nodex`-এ; Nodex আপনার normal browser profile পড়ে না।

## গুরুত্বপূর্ণ

Nodex একটি unofficial Notion private API ব্যবহার করে; Notion-এর internal পরিবর্তনে এটি ভেঙে যেতে পারে। এটি Notion বা OpenAI-এর সঙ্গে যুক্ত নয়। Server `127.0.0.1`-এ রাখুন এবং credentials, `.env`, local config, browser data, logs, HAR বা SQLite commit করবেন না।

## Advanced

- [Manual configuration](../advanced/manual-config.md)
- [Workflow ID ও instructions page ID](../advanced/notion-agent-id.md)
- [Troubleshooting](../advanced/troubleshooting.md)
- [Security model](../advanced/security.md)

সাধারণ setup-এ DevTools বা manual JSON editing লাগে না।

## License

[Apache License 2.0](../../LICENSE)
