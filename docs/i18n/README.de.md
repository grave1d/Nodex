# Nodex

> Dein Notion Agent. Überall verfügbar, wo OpenAI-Modelle funktionieren.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex verbindet einen Notion Custom Agent über eine lokale OpenAI-kompatible API mit Codex. Der Agent bleibt in Notion; Dateien und Werkzeuge bleiben auf deinem Computer.

## In einer Minute starten

```bash
npm install nodex-ai
npx nodex
```

Der Assistent öffnet die Notion-Anmeldung, findet deine Custom Agents, erstellt lokale Konfiguration und API key und zeigt den fertigen Codex provider.

```text
Nodex installieren.
Notion verbinden.
Agent auswählen.
In Codex verwenden.
```

Später genügt:

```bash
npx nodex serve
```

## Mit Codex verwenden

Füge den angezeigten Abschnitt in die benutzerweite `~/.codex/config.toml` ein:

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

Der Server liest die erzeugte `.env`. Exportiere denselben `NODEX_API_KEY` in der Shell, die Codex startet.

## Was Nodex bietet

- OpenAI-kompatibles `/v1/responses` mit JSON und streaming.
- Automatische Agent-Suche und die richtige internal instructions page ID.
- Starken lokalen API key und sichere lokale Speicherung.
- Notion-Modellsynchronisierung und Codex-kompatiblen tool-call flow.
- Kompatibilität mit älteren `agentPageId`-Konfigurationen.

## Speicherorte

Die Projektkonfiguration liegt in `nodex.config.json`, das Projektsecret in `.env`. Notion credentials und das eigene persistente Browserprofil liegen unter `~/.nodex`; Nodex liest dein normales Browserprofil nicht.

## Wichtiger Hinweis

Nodex verwendet eine inoffizielle private Notion API. Interne Änderungen bei Notion können die Verbindung unterbrechen. Das Projekt ist nicht mit Notion oder OpenAI verbunden. Belasse den Server auf `127.0.0.1` und committe keine credentials, `.env`, lokale Konfiguration, Browserdaten, logs, HAR- oder SQLite-Dateien.

## Erweitert

- [Manuelle Konfiguration](../advanced/manual-config.md)
- [Workflow ID und instructions page ID](../advanced/notion-agent-id.md)
- [Fehlerbehebung](../advanced/troubleshooting.md)
- [Sicherheitsmodell](../advanced/security.md)

Der normale Ablauf benötigt weder DevTools noch manuelle JSON-Bearbeitung.

## Lizenz

[Apache License 2.0](../../LICENSE)
