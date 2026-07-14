# Nodex

> 让你的 Notion Agent 在任何支持 OpenAI 模型的地方工作。

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex 通过本地、兼容 OpenAI 的 API 把 Notion Custom Agent 连接到 Codex。Agent 留在 Notion，文件和工具留在你的电脑上。

## 一分钟开始

```bash
npm install nodex-ai
npx nodex
```

设置向导会打开 Notion 登录、查找 Custom Agents、创建本地配置和 API key，并生成可直接使用的 Codex provider 配置。

```text
安装 Nodex。
连接 Notion。
选择 Agent。
在 Codex 中使用。
```

以后运行：

```bash
npx nodex serve
```

## 在 Codex 中使用

把向导显示的内容加入用户级 `~/.codex/config.toml`：

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

Nodex server 会读取生成的 `.env`。启动 Codex 前，请在同一个 shell 中导出其中的 `NODEX_API_KEY`。

## Nodex 提供什么

- 兼容 OpenAI 的 `/v1/responses`，支持 JSON 和 streaming。
- 自动发现 Custom Agents 和正确的 internal instructions page ID。
- 强随机本地 API key 与本地安全存储。
- Notion 模型同步和兼容 Codex 的 tool-call 流程。
- 兼容旧的 `agentPageId` 配置。

## 数据存放位置

项目配置在 `nodex.config.json`，项目 secret 在 `.env`。Notion credentials 和独立的 persistent browser profile 保存在 `~/.nodex`；Nodex 不会读取你的日常浏览器 profile。

## 重要说明

Nodex 使用非官方的 Notion private API，Notion 内部变化可能导致失效。本项目与 Notion 或 OpenAI 无关联。请保持监听地址为 `127.0.0.1`，不要提交 credentials、`.env`、本地配置、browser data、logs、HAR 或 SQLite 文件。

## 进阶文档

- [手动配置](../advanced/manual-config.md)
- [Workflow ID 与 instructions page ID](../advanced/notion-agent-id.md)
- [故障排查](../advanced/troubleshooting.md)
- [安全模型](../advanced/security.md)

正常设置流程无需 DevTools，也无需手动编辑 JSON。

## 许可证

[Apache License 2.0](../../LICENSE)
