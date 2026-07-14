# Nodex

> آپ کا Notion Agent، جہاں OpenAI models کام کرتے ہیں وہاں دستیاب۔

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex ایک local OpenAI-compatible API کے ذریعے Notion Custom Agent کو Codex سے جوڑتا ہے۔ Agent Notion میں رہتا ہے، جبکہ files اور tools آپ کے computer پر رہتے ہیں۔

## ایک منٹ میں شروع کریں

```bash
npm install nodex-ai
npx nodex
```

Setup wizard Notion sign-in کھولتا ہے، Custom Agents تلاش کرتا ہے، local config اور API key بناتا ہے اور تیار Codex provider دکھاتا ہے۔

```text
Nodex install کریں۔
Notion connect کریں۔
اپنا agent منتخب کریں۔
Codex میں استعمال کریں۔
```

بعد میں چلانے کے لیے:

```bash
npx nodex serve
```

## Codex کے ساتھ استعمال

Wizard کا snippet user-level `~/.codex/config.toml` میں شامل کریں:

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

Nodex server بنائی گئی `.env` پڑھتا ہے۔ Codex شروع کرنے والے shell میں وہی `NODEX_API_KEY` export کریں۔

## Nodex کیا دیتا ہے

- JSON اور streaming کے ساتھ OpenAI-compatible `/v1/responses`۔
- Custom Agents اور درست internal instructions page ID کی automatic discovery۔
- مضبوط local API key اور محفوظ local storage۔
- Notion model sync اور Codex-compatible tool-call flow۔
- پرانی `agentPageId` config کے ساتھ compatibility۔

## Data کہاں رہتا ہے

Project config `nodex.config.json` میں اور secret `.env` میں رہتا ہے۔ Notion credentials اور dedicated persistent browser profile `~/.nodex` میں رہتے ہیں؛ Nodex آپ کا عام browser profile نہیں پڑھتا۔

## اہم

Nodex ایک unofficial Notion private API استعمال کرتا ہے؛ Notion کی اندرونی تبدیلیاں اسے روک سکتی ہیں۔ یہ Notion یا OpenAI سے منسلک نہیں۔ Server کو `127.0.0.1` پر رکھیں اور credentials، `.env`، local config، browser data، logs، HAR یا SQLite commit نہ کریں۔

## Advanced

- [Manual configuration](../advanced/manual-config.md)
- [Workflow ID اور instructions page ID](../advanced/notion-agent-id.md)
- [Troubleshooting](../advanced/troubleshooting.md)
- [Security model](../advanced/security.md)

عام setup میں DevTools یا manual JSON editing کی ضرورت نہیں۔

## License

[Apache License 2.0](../../LICENSE)
