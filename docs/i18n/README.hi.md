# Nodex

> आपका Notion Agent — जहाँ भी OpenAI models काम करते हैं।

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex एक local OpenAI-compatible API के ज़रिए Notion Custom Agent को Codex से जोड़ता है। Agent Notion में रहता है; files और tools आपके computer पर रहते हैं।

## एक मिनट में शुरू करें

```bash
npm install nodex-ai
npx nodex
```

Setup wizard Notion sign-in खोलता है, Custom Agents खोजता है, local config और API key बनाता है, और तैयार Codex provider snippet देता है।

```text
Nodex install करें।
Notion connect करें।
अपना agent चुनें।
Codex में इस्तेमाल करें।
```

बाद में bridge चलाने के लिए:

```bash
npx nodex serve
```

## Codex के साथ उपयोग

Wizard का snippet user-level `~/.codex/config.toml` में जोड़ें:

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

Nodex server generated `.env` पढ़ता है। Codex शुरू करने वाले shell में उसी `NODEX_API_KEY` को export करें।

## Nodex क्या देता है

- JSON और streaming के साथ OpenAI-compatible `/v1/responses`।
- Custom Agents और सही internal instructions page ID की automatic discovery।
- Strong local API key और सुरक्षित local storage।
- Notion model sync और Codex-compatible tool-call flow।
- पुराने `agentPageId` config के लिए compatibility।

## Data कहाँ रहता है

Project config `nodex.config.json` में और project secret `.env` में रहता है। Notion credentials और dedicated persistent browser profile `~/.nodex` में रहते हैं; Nodex आपका normal browser profile नहीं पढ़ता।

## महत्वपूर्ण

Nodex unofficial Notion private API का उपयोग करता है; Notion के internal बदलाव इसे तोड़ सकते हैं। यह Notion या OpenAI से संबद्ध नहीं है। Server को `127.0.0.1` पर रखें और credentials, `.env`, local config, browser data, logs, HAR या SQLite commit न करें।

## Advanced

- [Manual configuration](../advanced/manual-config.md)
- [Workflow ID और instructions page ID](../advanced/notion-agent-id.md)
- [Troubleshooting](../advanced/troubleshooting.md)
- [Security model](../advanced/security.md)

सामान्य setup में DevTools या manual JSON editing की ज़रूरत नहीं है।

## License

[Apache License 2.0](../../LICENSE)
