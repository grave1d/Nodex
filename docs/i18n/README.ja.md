# Nodex

> Notion Agent を、OpenAI モデルが使える場所ならどこでも。

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

Nodex は、ローカルの OpenAI 互換 API を通して Notion Custom Agent を Codex に接続します。Agent は Notion に、ファイルとツールはあなたのコンピューターに残ります。

## 1分で開始

```bash
npm install nodex-ai
npx nodex
```

セットアップウィザードが Notion のログインを開き、Custom Agents を検出し、ローカル config と API key を作成して、Codex provider の設定を表示します。

```text
Nodex をインストール。
Notion に接続。
Agent を選択。
Codex で利用。
```

次回からは：

```bash
npx nodex serve
```

## Codex で使う

ウィザードの内容をユーザー用 `~/.codex/config.toml` に追加します：

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

Nodex server は生成された `.env` を読み込みます。Codex を起動する shell に同じ `NODEX_API_KEY` を export してください。

## Nodex の機能

- JSON と streaming に対応した OpenAI 互換 `/v1/responses`。
- Custom Agents と正しい internal instructions page ID の自動検出。
- 強力なローカル API key と安全なローカル保存。
- Notion model sync と Codex 互換の tool-call flow。
- 旧 `agentPageId` config との互換性。

## データの保存場所

プロジェクト config は `nodex.config.json`、secret は `.env` に保存されます。Notion credentials と専用の persistent browser profile は `~/.nodex` に保存され、通常のブラウザー profile は読み取りません。

## 重要

Nodex は非公式の Notion private API を使います。Notion の内部変更により動作しなくなる可能性があります。Notion や OpenAI とは提携していません。Server は `127.0.0.1` のまま使い、credentials、`.env`、local config、browser data、logs、HAR、SQLite を commit しないでください。

## 詳細

- [手動設定](../advanced/manual-config.md)
- [Workflow ID と instructions page ID](../advanced/notion-agent-id.md)
- [トラブルシューティング](../advanced/troubleshooting.md)
- [セキュリティモデル](../advanced/security.md)

通常のセットアップでは DevTools も JSON の手動編集も不要です。

## ライセンス

[Apache License 2.0](../../LICENSE)
