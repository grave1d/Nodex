# Nodex

> Votre agent Notion, partout où les modèles OpenAI fonctionnent.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex relie un Notion Custom Agent à Codex par une API locale compatible OpenAI. L'agent reste dans Notion ; vos fichiers et outils restent sur votre ordinateur.

## Démarrer en une minute

```bash
npm install nodex-ai
npx nodex
```

L'assistant ouvre la connexion Notion, trouve vos Custom Agents, crée la configuration et une API key locale, puis affiche le provider Codex prêt à l'emploi.

```text
Installez Nodex.
Connectez Notion.
Choisissez votre agent.
Utilisez-le dans Codex.
```

Pour les lancements suivants :

```bash
npx nodex serve
```

## Utiliser avec Codex

Ajoutez le fragment affiché à votre `~/.codex/config.toml` utilisateur :

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

Le serveur charge le `.env` généré. Exportez le même `NODEX_API_KEY` dans le shell qui lance Codex.

## Ce que Nodex apporte

- `/v1/responses` compatible OpenAI, en JSON et streaming.
- Découverte automatique des agents et du bon internal instructions page ID.
- API key locale robuste et stockage local sécurisé.
- Synchronisation du modèle Notion et tool-call flow compatible Codex.
- Compatibilité avec les anciennes configurations `agentPageId`.

## Où vivent les données

La configuration du projet est dans `nodex.config.json`, son secret dans `.env`. Les credentials Notion et le profil navigateur persistant dédié sont sous `~/.nodex` ; Nodex ne lit jamais votre profil habituel.

## Important

Nodex utilise une API privée et non officielle de Notion. Un changement interne de Notion peut interrompre le service. Le projet n'est affilié ni à Notion ni à OpenAI. Gardez le serveur sur `127.0.0.1` et ne publiez pas credentials, `.env`, configuration locale, données navigateur, logs, HAR ou SQLite.

## Avancé

- [Configuration manuelle](../advanced/manual-config.md)
- [Workflow ID et instructions page ID](../advanced/notion-agent-id.md)
- [Dépannage](../advanced/troubleshooting.md)
- [Modèle de sécurité](../advanced/security.md)

Le parcours normal ne demande ni DevTools ni édition manuelle de JSON.

## Licence

[Apache License 2.0](../../LICENSE)
