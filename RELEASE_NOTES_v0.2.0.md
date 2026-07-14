# Nodex 0.2.0

Nodex now feels like a product from the first command.

```bash
npm install nodex-ai@latest
npx nodex setup
```

## Highlights

- **A guided setup wizard.** Run `npx nodex` in a terminal, connect Notion, choose an agent, create a local API key, and copy the ready Codex provider snippet.
- **Automatic Custom Agent discovery.** Nodex reads available workflows and resolves the internal instructions/context page ID without sending a message or creating a thread.
- **The right ID by default.** New configs use `agentInstructionsPageId`; ordinary setup no longer needs DevTools.
- **Safe local configuration.** Existing configs require confirmation before update and receive a timestamped backup. Local API keys are strong, masked, and stored in `.env`.
- **Better Notion authentication.** A visible dedicated persistent browser profile keeps sign-in separate from your everyday browser profile.
- **Honest verification.** Safe verification uses preflight and discovery. Live testing is always explicit and warns that it may consume Notion AI quota.
- **A simpler README.** The quickstart is now install → run → connect → use, with technical fallback guides under `docs/advanced` and synchronized translations.

## Compatibility

Existing configs with a valid `agentPageId` continue to work. Nodex prints:

```text
agentPageId is deprecated. Use agentInstructionsPageId.
```

If a config mistakenly contains the workflow ID from `/agent/<id>`, `npx nodex doctor` now identifies it and proposes the corresponding `agentInstructionsPageId` when accessible.

## Behavioral changes

- `npx nodex` opens setup only when stdin and stdout are interactive TTYs.
- CI, piped input, and redirected output receive plain help and never wait for menu input.
- `npx nodex serve` loads `.env` from the working directory without overwriting environment variables already set by the parent process.
- New generated configs no longer write the legacy `agentPageId` key.

## Security

Notion credentials, the dedicated browser profile, local config, `.env`, logs, and SQLite state stay local. Setup does not print complete credentials or the full local API key. Nodex still uses an unofficial private Notion API and may require updates when Notion changes it.

## Upgrade

```bash
npm install nodex-ai@latest
npx nodex setup
```

Review the proposed migration, keep the generated backup until the first successful run, then start the bridge with:

```bash
npx nodex serve
```

## Publishing checklist for the owner

After the final commit is reviewed:

```bash
git tag v0.2.0
git push origin v0.2.0
npm publish --otp=XXXXXX
```

A granular npm token with an approved 2FA bypass policy may be used instead. No tag, GitHub Release, or npm publish is performed automatically by this task.
