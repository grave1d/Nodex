# Nodex

> Tu agente de Notion, disponible donde funcionen los modelos OpenAI.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex conecta un Notion Custom Agent con Codex mediante una API local compatible con OpenAI. El agente permanece en Notion; tus archivos y herramientas permanecen en tu equipo.

## Empieza en un minuto

```bash
npm install nodex-ai
npx nodex
```

El asistente abre el inicio de sesión de Notion, encuentra tus Custom Agents, crea la configuración y una API key local, y entrega el provider exacto para Codex.

```text
Instala Nodex.
Conecta Notion.
Elige tu agente.
Úsalo desde Codex.
```

Para iniciar el puente después:

```bash
npx nodex serve
```

## Usar con Codex

Añade el fragmento del asistente a tu `~/.codex/config.toml` de usuario:

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

El servidor carga el `.env` generado. Exporta el mismo `NODEX_API_KEY` en la terminal desde la que abras Codex.

## Qué ofrece Nodex

- `/v1/responses` compatible con OpenAI, en JSON y streaming.
- Descubrimiento automático de agentes y del internal instructions page ID correcto.
- API key local robusta y almacenamiento seguro en tu equipo.
- Sincronización del modelo de Notion y flujo de tool calls compatible con Codex.
- Compatibilidad con configuraciones antiguas que usan `agentPageId`.

## Dónde están los datos

La configuración del proyecto vive en `nodex.config.json` y su secreto en `.env`. Las credenciales de Notion y el perfil persistente dedicado del navegador viven en `~/.nodex`; Nodex nunca lee tu perfil habitual.

## Importante

Nodex usa una API privada y no oficial de Notion. Puede dejar de funcionar si Notion cambia sus detalles internos. No está afiliado con Notion ni OpenAI. Mantén el servidor en `127.0.0.1` y no publiques credenciales, `.env`, configuración local, datos del navegador, logs, HAR o SQLite.

## Avanzado

- [Configuración manual](../advanced/manual-config.md)
- [Workflow ID e instructions page ID](../advanced/notion-agent-id.md)
- [Solución de problemas](../advanced/troubleshooting.md)
- [Modelo de seguridad](../advanced/security.md)

El flujo normal no requiere DevTools ni editar JSON a mano.

## Licencia

[Apache License 2.0](../../LICENSE)
