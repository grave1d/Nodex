# Contributing to Nodex

Thanks for helping improve Nodex.

## Before you start

Nodex is a local bridge between Codex and Notion Custom Agents. Keep the boundary clear:

- Codex executes tools locally.
- Nodex translates requests, responses, tool calls, and local state.
- Agent persona and model behavior belong in Notion, not in repository prompts.
- Notion wire details should stay inside `src/transport`.

## Development setup

```powershell
git clone https://github.com/grave1d/Nodex.git
Set-Location Nodex
npm install
Copy-Item nodex.config.example.json nodex.config.json
npm run build
```

## Checks before opening a pull request

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Live tests are opt-in because they create real Notion threads and consume Notion AI quota:

```powershell
npm run test:live
```

## Pull request expectations

- Keep changes focused.
- Update tests when protocol behavior changes.
- Update README/docs when user-facing behavior changes.
- Do not commit credentials, cookies, local databases, logs, HAR files, or raw upstream captures.
- For Notion protocol changes, update schema, parser, mapper, fixtures, and tests together.

## Commit style

Use short, descriptive commits. Examples:

```text
fix: map custom tool call outputs
feat: add responses file storage
chore: update release metadata
docs: improve Codex setup guide
```
