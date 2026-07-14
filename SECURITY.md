# Security Policy

## Supported versions

Nodex is currently pre-1.0. Security fixes are expected to land on the latest released version only.

| Version | Supported |
| --- | --- |
| Latest `0.x` | Yes |
| Older `0.x` | No |

## Reporting a vulnerability

Please do not open a public issue for credential leaks, authentication bypasses, local API exposure, or Notion credential handling bugs.

Report security issues privately through GitHub Security Advisories when available:

https://github.com/grave1d/Nodex/security/advisories/new

If that is unavailable, open a minimal public issue asking for a private contact path, without technical details or secrets.

## What to include

- Affected Nodex version or commit
- Operating system and Node.js version
- Reproduction steps
- Whether `NODEX_HOST` was changed from the default `127.0.0.1`
- Relevant redacted logs only

Never include `token_v2`, `notion_browser_id`, `NODEX_API_KEY`, cookies, HAR files, SQLite databases, raw upstream captures, or private Notion URLs in public reports.

## Security model

Nodex is a local bridge between Codex and a Notion Custom Agent. Codex executes tools locally on the user's machine. Nodex does not intentionally execute shell commands, apply patches, or act as a remote shell.

By default, Nodex should bind to localhost. If you expose Nodex on a network interface, you are responsible for firewalling, bearer token handling, and any additional access controls.
