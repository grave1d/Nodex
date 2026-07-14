# Nodex v0.1.23

First public release of Nodex — a local bridge that connects Notion Custom Agents to Codex through an OpenAI-compatible Responses API.

## Highlights

- Use a Notion Custom Agent as the reasoning backend for Codex.
- Expose a local OpenAI-compatible `/v1/responses` API.
- Preserve the native Codex tool-call loop.
- Keep tool execution local to Codex on your machine.
- Support browser and manual Notion authentication.
- Store response, conversation, and file state locally.
- Ship multilingual README documentation.

## Important note

Nodex uses Notion's private `runInferenceTranscript` API. It may change without notice. Use your own Notion account, keep credentials private, and never commit cookies or local credential files.
