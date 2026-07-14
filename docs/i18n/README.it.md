# Nodex

> Il tuo agente Notion, ovunque funzionino i modelli OpenAI.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex collega un Notion Custom Agent a Codex tramite un'API locale compatibile con OpenAI. L'agente resta in Notion; file e strumenti restano sul tuo computer.

## Inizia in un minuto

```bash
npm install nodex-ai
npx nodex
```

La procedura guidata apre l'accesso a Notion, trova i Custom Agents, crea config e API key locali e mostra il provider Codex pronto.

```text
Installa Nodex.
Collega Notion.
Scegli il tuo agente.
Usalo da Codex.
```

Per gli avvii successivi:

```bash
npx nodex serve
```

## Usa con Codex

Aggiungi il frammento mostrato al tuo `~/.codex/config.toml` utente:

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

Il server legge il `.env` generato. Esporta lo stesso `NODEX_API_KEY` nella shell che avvia Codex.

## Cosa offre Nodex

- `/v1/responses` compatibile OpenAI con JSON e streaming.
- Ricerca automatica degli agenti e del corretto internal instructions page ID.
- API key locale robusta e archiviazione sicura in locale.
- Sincronizzazione del modello Notion e tool-call flow compatibile con Codex.
- Compatibilità con le vecchie configurazioni `agentPageId`.

## Dove vivono i dati

La configurazione del progetto è in `nodex.config.json`, il secret in `.env`. Le credentials Notion e il profilo browser persistente dedicato sono in `~/.nodex`; Nodex non legge il profilo browser principale.

## Importante

Nodex usa un'API privata e non ufficiale di Notion. Modifiche interne di Notion possono interromperlo. Il progetto non è affiliato con Notion o OpenAI. Mantieni il server su `127.0.0.1` e non pubblicare credentials, `.env`, config locale, dati browser, logs, HAR o SQLite.

## Avanzato

- [Configurazione manuale](../advanced/manual-config.md)
- [Workflow ID e instructions page ID](../advanced/notion-agent-id.md)
- [Risoluzione dei problemi](../advanced/troubleshooting.md)
- [Modello di sicurezza](../advanced/security.md)

Il percorso normale non richiede DevTools né modifiche manuali al JSON.

## Licenza

[Apache License 2.0](../../LICENSE)
