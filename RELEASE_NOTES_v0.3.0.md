# Nodex 0.3.0

This release makes the interactive setup faster, quieter, and easier to use across languages.

## Highlights

- The setup wizard now defaults to English and remembers the selected language.
- All 16 languages linked from the README are available in the language picker.
- Disconnected setup shows only the four actions that are currently useful.
- Connected setup can explicitly switch the Notion account.
- Custom Agent selection now includes a model picker based on known and workspace-discovered models.
- Animated progress indicators cover setup operations, including short tasks.
- Diagnostic details remain visible until the user continues.
- The terminal cursor is hidden while setup or the interactive server dashboard is active and restored on exit.
- API-key setup returns directly to the main menu after `.gitignore` handling.

## Upgrade

```bash
npm install nodex-ai@latest
npx nodex
```

Existing `nodex.config.json`, `.env`, credentials, and browser profiles remain compatible.
