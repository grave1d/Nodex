# Security model

Nodex is a local bridge. Codex executes tools; Nodex transports model input, output, and tool-call state.

## Local files

- `nodex.config.json`: project model bindings and private agent IDs.
- `.env`: local `NODEX_API_KEY`.
- `~/.nodex/credentials.json`: secured Notion session credentials.
- `~/.nodex/browser-profile`: dedicated persistent browser profile.
- `~/.nodex/backups`: private timestamped config backups created before migration.
- `.nodex/*.sqlite`: local response and conversation state.

Nodex never reads the user's normal Chrome, Edge, or Firefox profile. Browser authentication uses only the dedicated Nodex profile.

## Network boundary

Keep the default host `127.0.0.1`. A strong bearer key protects `/v1/*`. Exposing Nodex on another interface requires your own firewall, TLS, access control, and threat review.

## Logging

Authorization headers, cookies, Notion credentials, agent IDs, prompts, raw inputs and outputs, and base64 payloads are redacted from structured server logs. The setup UI never prints complete credentials or the full local API key.

## Never commit or publish

- `.env` or `nodex.config.json`
- `.nodex/`, browser profiles, or credential files
- SQLite databases and sidecar files
- cookies, HAR files, logs, or raw Notion captures

The npm package uses an explicit file allowlist. Review `npm pack --dry-run` before every release.

## Upstream risk

Notion's transport is unofficial and private. Endpoint or payload changes can break Nodex without notice. Use only accounts and workspaces you are authorized to access.
