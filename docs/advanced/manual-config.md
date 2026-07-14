# Manual configuration

The setup wizard is the recommended path:

```bash
npx nodex setup
```

Use manual configuration only when discovery cannot complete.

## Model binding

Create `nodex.config.json` in the project where you run Nodex:

```json
{
  "models": {
    "codex-notion-agent": {
      "agentInstructionsPageId": "00000000-0000-0000-0000-000000000000",
      "agentName": "My Notion Agent",
      "notionModel": "Notion Custom Agent",
      "notionModelSlug": "orange-mousse",
      "syncNotionModel": true
    }
  }
}
```

`agentInstructionsPageId` is the internal instructions/context page ID. It is not the workflow ID shown in `/agent/<id>`. See [Notion agent IDs](notion-agent-id.md).

The legacy `agentPageId` field is still accepted for working configurations, but it is deprecated. When both fields exist, `agentInstructionsPageId` wins.

## Local API key

The wizard writes a strong key to `.env`:

```dotenv
NODEX_API_KEY=nodex_replace_with_a_strong_local_value
```

`nodex serve` loads the project `.env` without overriding variables already present in the process. Export the same variable in the shell that starts your OpenAI-compatible client.

## Useful overrides

| Variable | Purpose |
| --- | --- |
| `NODEX_CONFIG` | Alternate config path. |
| `NODEX_HOST` / `NODEX_PORT` | Server address. Keep the host on `127.0.0.1`. |
| `NODEX_DATABASE_PATH` | Local SQLite path. |
| `NODEX_API_KEY` | Local bearer token. |
| `NODEX_NOTION_TOKEN_V2` / `NODEX_NOTION_BROWSER_ID` | Explicit Notion credentials for controlled environments. |

Never commit config containing private IDs, `.env`, credentials, databases, logs, or captures.
