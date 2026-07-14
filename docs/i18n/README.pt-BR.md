# Nodex

> Seu agente do Notion, disponível onde modelos OpenAI funcionam.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex conecta um Notion Custom Agent ao Codex por uma API local compatível com OpenAI. O agente fica no Notion; seus arquivos e ferramentas ficam no computador.

## Comece em um minuto

```bash
npm install nodex-ai
npx nodex
```

O assistente abre o login do Notion, encontra seus Custom Agents, cria config e API key locais e mostra o provider pronto para o Codex.

```text
Instale o Nodex.
Conecte o Notion.
Escolha seu agente.
Use-o no Codex.
```

Nas próximas vezes:

```bash
npx nodex serve
```

## Use com o Codex

Adicione o trecho do assistente ao seu `~/.codex/config.toml` de usuário:

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

O servidor lê o `.env` gerado. Exporte o mesmo `NODEX_API_KEY` no shell que inicia o Codex.

## O que o Nodex oferece

- `/v1/responses` compatível com OpenAI, em JSON e streaming.
- Descoberta automática de agentes e do internal instructions page ID correto.
- API key local forte e armazenamento local seguro.
- Sincronização do modelo do Notion e tool-call flow compatível com Codex.
- Compatibilidade com configs antigos que usam `agentPageId`.

## Onde ficam os dados

O config do projeto fica em `nodex.config.json` e o secret em `.env`. As credentials do Notion e o perfil persistente dedicado do navegador ficam em `~/.nodex`; o Nodex não lê seu perfil normal.

## Importante

O Nodex usa uma API privada e não oficial do Notion. Mudanças internas do Notion podem interromper seu funcionamento. O projeto não é afiliado ao Notion nem à OpenAI. Mantenha o servidor em `127.0.0.1` e não publique credentials, `.env`, local config, browser data, logs, HAR ou SQLite.

## Avançado

- [Configuração manual](../advanced/manual-config.md)
- [Workflow ID e instructions page ID](../advanced/notion-agent-id.md)
- [Solução de problemas](../advanced/troubleshooting.md)
- [Modelo de segurança](../advanced/security.md)

O fluxo normal não exige DevTools nem edição manual de JSON.

## Licença

[Apache License 2.0](../../LICENSE)
