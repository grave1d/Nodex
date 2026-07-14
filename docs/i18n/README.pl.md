# Nodex

> Twój agent Notion — wszędzie tam, gdzie działają modele OpenAI.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex łączy Notion Custom Agent z Codex przez lokalne API zgodne z OpenAI. Agent pozostaje w Notion, a pliki i narzędzia na twoim komputerze.

## Start w minutę

```bash
npm install nodex-ai
npx nodex
```

Kreator otwiera logowanie Notion, wyszukuje Custom Agents, tworzy lokalny config i API key oraz pokazuje gotowy provider Codex.

```text
Zainstaluj Nodex.
Połącz Notion.
Wybierz agenta.
Używaj go w Codex.
```

Przy kolejnych uruchomieniach:

```bash
npx nodex serve
```

## Użycie z Codex

Dodaj fragment z kreatora do użytkowego `~/.codex/config.toml`:

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

Serwer Nodex czyta utworzony `.env`. Wyeksportuj ten sam `NODEX_API_KEY` w powłoce uruchamiającej Codex.

## Co daje Nodex

- Zgodny z OpenAI `/v1/responses` z JSON i streaming.
- Automatyczne wyszukiwanie agentów i poprawnego internal instructions page ID.
- Silny lokalny API key i bezpieczne przechowywanie lokalne.
- Synchronizację modelu Notion i zgodny z Codex tool-call flow.
- Zgodność ze starszymi configami `agentPageId`.

## Gdzie są dane

Config projektu znajduje się w `nodex.config.json`, a secret w `.env`. Notion credentials i osobny persistent browser profile są w `~/.nodex`; Nodex nie czyta zwykłego profilu przeglądarki.

## Ważne

Nodex używa nieoficjalnego prywatnego API Notion. Zmiany wewnętrzne Notion mogą przerwać działanie. Projekt nie jest powiązany z Notion ani OpenAI. Pozostaw serwer na `127.0.0.1` i nie commituj credentials, `.env`, local config, browser data, logs, HAR ani SQLite.

## Więcej

- [Konfiguracja ręczna](../advanced/manual-config.md)
- [Workflow ID i instructions page ID](../advanced/notion-agent-id.md)
- [Rozwiązywanie problemów](../advanced/troubleshooting.md)
- [Model bezpieczeństwa](../advanced/security.md)

Zwykły setup nie wymaga DevTools ani ręcznej edycji JSON.

## Licencja

[Apache License 2.0](../../LICENSE)
