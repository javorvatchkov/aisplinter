# AISplinter setup in VS Code

The setup wizard is available in three places with **identical behaviour**:

1. **Browser** — `http://127.0.0.1:8747/` (standalone) or your embed path  
2. **Terminal** — `npx aisplinter-setup database --interactive`  
3. **VS Code** — tasks below (extension optional)

## Recommended: VS Code tasks

Add to your app `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AISplinter: setup database",
      "type": "shell",
      "command": "pnpm --filter @aisplinter/server build && npx aisplinter-setup database --interactive",
      "options": { "cwd": "${workspaceFolder}/aisplinter-code" },
      "problemMatcher": []
    },
    {
      "label": "AISplinter: setup status",
      "type": "shell",
      "command": "npx aisplinter-setup status",
      "options": { "cwd": "${workspaceFolder}/aisplinter-code/packages/server" },
      "problemMatcher": []
    },
    {
      "label": "AISplinter: open wizard",
      "type": "shell",
      "command": "open http://127.0.0.1:8747/",
      "dependsOn": ["AISplinter: dev server"],
      "problemMatcher": []
    }
  ]
}
```

Run via **Terminal → Run Task…**.

## Optional extension (future)

A dedicated `@aisplinter/vscode` extension could:

- Start/stop standalone server  
- Open wizard in simple browser  
- Run `aisplinter-setup` with form fields for `DATABASE_URL` + schema  
- Paste `.env` snippet into active editor  

Until then, the CLI + tasks cover the same workflows without maintaining a separate extension package.

See also: `docs/DATABASE.md`, `docs/DEV_SETUP.md`.
