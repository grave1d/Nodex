# Nodex

> وكيل Notion الخاص بك، متاح حيثما تعمل نماذج OpenAI.

[![npm](https://img.shields.io/npm/v/nodex-ai)](https://www.npmjs.com/package/nodex-ai) [![CI](https://github.com/grave1d/Nodex/actions/workflows/ci.yml/badge.svg)](https://github.com/grave1d/Nodex/actions/workflows/ci.yml) [![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](../../LICENSE)

**Languages:** 🇬🇧 [English](../../README.md) · 🇨🇳 [中文](README.zh-CN.md) · 🇮🇳 [हिन्दी](README.hi.md) · 🇪🇸 [Español](README.es.md) · 🇫🇷 [Français](README.fr.md) · 🇸🇦 [العربية](README.ar.md) · 🇧🇩 [বাংলা](README.bn.md) · 🇧🇷 [Português](README.pt-BR.md) · 🇷🇺 [Русский](README.ru.md) · 🇵🇰 [اردو](README.ur.md) · 🇩🇪 [Deutsch](README.de.md) · 🇯🇵 [日本語](README.ja.md) · 🇮🇹 [Italiano](README.it.md) · 🇺🇦 [Українська](README.uk.md) · 🇵🇱 [Polski](README.pl.md) · 🇷🇸 [Српски](README.sr.md)

يربط Nodex وكيل Notion Custom Agent بـ Codex عبر API محلي متوافق مع OpenAI. يبقى الوكيل في Notion، وتبقى ملفاتك وأدواتك على جهازك.

## ابدأ خلال دقيقة

```bash
npm install nodex-ai
npx nodex
```

يفتح معالج الإعداد تسجيل الدخول إلى Notion، ويعثر على Custom Agents، وينشئ config وAPI key محليين، ثم يعرض إعداد Codex provider الجاهز.

```text
ثبّت Nodex.
صِل Notion.
اختر وكيلك.
استخدمه من Codex.
```

للتشغيل لاحقًا:

```bash
npx nodex serve
```

## الاستخدام مع Codex

أضف المقطع الذي يعرضه المعالج إلى `~/.codex/config.toml` على مستوى المستخدم:

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

يقرأ خادم Nodex ملف `.env` الذي تم إنشاؤه. صدّر `NODEX_API_KEY` نفسه في shell الذي يشغّل Codex.

## ما الذي يقدمه Nodex

- `/v1/responses` متوافق مع OpenAI بصيغتي JSON وstreaming.
- اكتشاف تلقائي للوكلاء ولـ internal instructions page ID الصحيح.
- API key محلي قوي وتخزين محلي آمن.
- مزامنة نموذج Notion وtool-call flow متوافق مع Codex.
- توافق مع إعدادات `agentPageId` القديمة.

## مكان البيانات

يوجد config المشروع في `nodex.config.json` وsecret المشروع في `.env`. تبقى credentials الخاصة بـ Notion وpersistent browser profile المخصص داخل `~/.nodex`؛ لا يقرأ Nodex ملف متصفحك المعتاد.

## ملاحظة مهمة

يستخدم Nodex واجهة Notion private API غير رسمية، وقد تؤدي تغييرات Notion الداخلية إلى تعطله. المشروع غير تابع لـ Notion أو OpenAI. أبقِ الخادم على `127.0.0.1` ولا ترفع credentials أو `.env` أو local config أو browser data أو logs أو HAR أو SQLite.

## متقدم

- [الإعداد اليدوي](../advanced/manual-config.md)
- [Workflow ID وinstructions page ID](../advanced/notion-agent-id.md)
- [استكشاف الأخطاء](../advanced/troubleshooting.md)
- [نموذج الأمان](../advanced/security.md)

لا يحتاج المسار العادي إلى DevTools أو تعديل JSON يدويًا.

## الترخيص

[Apache License 2.0](../../LICENSE)
