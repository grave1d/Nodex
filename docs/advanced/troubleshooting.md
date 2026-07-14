# Troubleshooting

## Authentication failed

Run `npx nodex auth` or choose **Connect Notion** in setup. Nodex opens a visible, dedicated persistent browser profile under `~/.nodex/browser-profile`; it never reads your normal browser profile. For SSO edge cases, `npx nodex auth --manual` remains available and hides typed values.

## No Custom Agents found

Confirm that the signed-in account can open the agent in the current Notion workspace. Create a Custom Agent or ask the workspace owner for access, then retry discovery.

## Wrong ID or workflow ID

The ID in `/agent/<id>` is a `workflowId`, not `agentInstructionsPageId`. Run:

```bash
npx nodex doctor
```

If the workflow is accessible, Doctor prints the correct instructions page ID. See [Notion agent IDs](notion-agent-id.md).

## Live Doctor uses quota

`npx nodex doctor` performs preflight and discovery only. `npx nodex doctor --live` creates a real Notion thread, sends messages, and can consume Notion AI quota.

## Every `/v1/*` request returns 401

The Nodex server and client must use the same `NODEX_API_KEY`. Nodex loads it from the project `.env`; export it in the shell that launches Codex.

## Package install warnings

Nodex can use system Chrome for browser sign-in. If Playwright or a browser is unavailable, install Playwright explicitly or use `npx nodex auth --manual`. Native `better-sqlite3` install failures usually mean the active Node.js version or platform lacks a compatible binary/toolchain; use a supported Node.js 20+ release.

## The setup command does not open a menu

The wizard requires an interactive TTY. In CI, redirected stdout, or piped input, Nodex prints plain help and exits instead of waiting for input.

## More diagnostics

Use `npx nodex doctor`, the interactive `npx nodex serve` dashboard, or `NODEX_VERBOSE=1`. Share only redacted logs.
