# Nodex contributor rules

- Runtime: Node.js 20+, TypeScript strict, ESM.
- Keep Notion-specific wire details inside `src/transport`.
- Agent persona belongs in Notion Custom Agent. Never add persona prompts to this repository.
- Protocol preamble is generated from `src/protocol/schema.ts`. When changing protocol, update schema, parser, mapper, fixtures, and tests in one change.
- Never commit cookies, `.env`, `nodex.config.json`, SQLite files, raw private upstream captures, or logs.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before handoff.
- Live tests are opt-in only and must read credentials from environment or `~/.nodex/credentials.json`.
