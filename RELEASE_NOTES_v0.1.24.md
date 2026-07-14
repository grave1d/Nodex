# Nodex v0.1.24

Patch release fixing intermittent Windows shutdown failures.

## Fixed

- Graceful server shutdown now waits for cancelled background response tasks to finish before SQLite is closed.
- Windows test runs no longer race temporary-directory removal against background response cleanup.

The npm package is `nodex-ai`; the installed command remains `nodex`.
