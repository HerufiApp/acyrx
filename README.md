# Acyrx

An agentic desktop coding assistant — a Cursor / Claude Code–style tool that can use the
**Google Gemini**, **Anthropic Claude**, and **OpenAI** APIs. Built with **Electron + React +
TypeScript**, with a Monaco editor, a file explorer, an integrated terminal, and an AI chat
panel whose agent can read, search, write, and edit files and run shell commands on your behalf.

## Features

- **Multiple LLM providers** — Gemini, Claude, and OpenAI, switchable in Settings. Use your own
  API key, or fall back to a built-in key for Gemini/Claude when configured (OpenAI is
  your-key-only).
- **Agentic loop** — the model calls tools, sees the results, and keeps going until the task is
  done, including running tests/builds and iterating ("fix until green").
- **Tools the model can use**: `read_file`, `write_file`, `edit_file`, `list_dir`,
  `run_command`, `search`, `git_status`, `git_diff`, `git_commit`.
- **Git integration** — a Source Control panel (stage/unstage, per-file and combined diffs),
  AI-**generated commit messages**, and an **Explain changes** review of the working tree.
- **Checkpoint / undo** — each agent run is snapshotted, so a multi-file run can be rolled back
  in one click, not just per-file.
- **@-mentions** — type `@path` in chat to attach files or folders to the model's context.
- **Inline edit (⌘/Ctrl+K)** — select code in the editor, describe a change, get a diff in place.
- **Rules file** — drop an `AGENTS.md`, `.acyrxrules`, `.cursorrules`, or `CLAUDE.md` in the
  project root and the agent reads it every turn for your conventions.
- **Token & cost tracking** — per-session token counts and an estimated cost in the chat header.
- **Human-in-the-loop safety** — every file write/edit shows an **inline Monaco diff** you must
  **Accept/Reject**; potentially destructive commands require confirmation.
- **Streaming chat** with collapsible tool calls and results.
- **Monaco editor** with syntax highlighting and tabs.
- **Integrated terminal** (xterm.js) streaming command output.
- **Live file explorer** that updates as files change on disk.
- **Resizable panels** — drag the borders of the explorer, chat, and terminal.
- **Secure by design** — all filesystem, shell, and LLM access runs in the Electron **main
  process**; the renderer is sandboxed (`contextIsolation`, no `nodeIntegration`) and talks to
  main only through a typed `contextBridge` preload. API keys never reach the renderer.

## Architecture

```
┌────────────────────────── Renderer (sandboxed React UI) ──────────────────────────┐
│  FileExplorer │ EditorPane + DiffView │ ChatPanel + ToolCards │ Terminal │ Settings │
│        |  window.codex.*  (typed contextBridge API, invoke + event subscriptions)   │
└───────────────────────────────────────│────────────────────────────────────────────┘
                                         │  preload/index.ts  (contextBridge only)
┌────────────────────────────────────────▼───────────────────────────────────────────┐
│ Main process (full privileges)                                                       │
│  ipc.ts ──► settings (safeStorage) · llm/* providers · agent/loop · tools/*          │
│             watcher (chokidar) · projectState (events to renderer)                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Main** owns the agent loop, the provider adapters, all six tools, settings/secret storage and
  the file watcher. The loop keeps a **provider-agnostic conversation history** and each adapter
  (`src/main/llm/{gemini,anthropic,openai}.ts`) converts it to that provider's wire format. The
  loop **emits events** (`text-delta`, `tool-call`, `tool-result`, `edit-proposed`,
  `command-confirm`, `turn-done`, …) to the renderer via `webContents.send`.
- **Preload** exposes a single typed `window.codex` API (see `src/shared/types.ts`).
- **Renderer** renders those events and sends back user input and accept/reject decisions.

The IPC contract lives in [`src/shared/types.ts`](src/shared/types.ts).

## Project structure

```
src/
  shared/types.ts          IPC channels, agent event union, providers/models, tool arg types
  main/
    index.ts               app lifecycle + secure BrowserWindow
    ipc.ts                 all ipcMain handlers
    settings.ts            per-provider keys (safeStorage) + provider/model selection
    builtinKeys.ts         optional built-in ("ours") keys (env-supplied)
    watcher.ts             chokidar file watcher
    projectState.ts        current project + event emit helpers
    llm/
      types.ts             provider-agnostic message + tool model
      toolSpecs.ts         the six tool specs
      gemini.ts            @google/genai adapter
      anthropic.ts         @anthropic-ai/sdk adapter
      openai.ts            openai adapter
      index.ts             getProvider()
    agent/loop.ts          the provider-agnostic agentic loop
    agent/approvals.ts     pending-approval registry
    tools/*.ts             read/write/edit/list/run/search + path sandbox
  preload/index.ts         contextBridge -> window.codex
  renderer/                React + Tailwind UI (Monaco, xterm, resizable panels)
```

## Prerequisites

- **Node.js 18+** (developed on Node 22)
- An API key for at least one provider:
  - Gemini: <https://aistudio.google.com/apikey>
  - Claude: <https://console.anthropic.com/>
  - OpenAI: <https://platform.openai.com/api-keys>

## Setup

```bash
npm install
```

## Develop

```bash
npm run dev
```

This launches the app with hot-reload. Then:

1. Click **Open Folder** and pick a project.
2. Open **Settings** (gear icon or `⌘/Ctrl+,`): choose the **active provider**, a **model**, and
   paste an API key for the providers you want to use. Or set env vars before launching:
   `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
3. Ask the agent something, e.g. *"Add a function that reverses a string to utils.ts and a test."*
4. When it proposes a file change you'll see a diff — **Accept** (`⌘/Ctrl+Enter`) or **Reject**
   (`Esc`). Commands stream into the terminal; destructive ones ask first.

### Built-in ("ours") keys

For Gemini and Claude the app can ship a built-in key so users don't need their own. These are
**blank by default**; provide them when launching/packaging:

```bash
ACYRX_GEMINI_KEY=...  ACYRX_ANTHROPIC_KEY=...  npm run dev
```

When a user pastes their own key it always takes precedence over the built-in one. OpenAI has no
built-in key — it requires the user's own key.

## Build & package

```bash
npm run build        # type-check + bundle main/preload/renderer (electron-vite)
npm run package      # build, then create a distributable via electron-builder
npm run package:dir  # unpacked build (faster, for local testing)
```

Artifacts are written to `release/` (macOS dmg/zip, Windows nsis, Linux AppImage/deb).

## Keyboard shortcuts

| Action                 | Shortcut             |
| ---------------------- | -------------------- |
| Send chat message      | `Enter`              |
| Newline in chat        | `Shift+Enter`        |
| Accept proposed edit   | `⌘/Ctrl+Enter`       |
| Reject proposed edit   | `Esc`                |
| Save active file       | `⌘/Ctrl+S`           |
| Toggle file explorer   | `⌘/Ctrl+B`           |
| Toggle terminal        | `⌘/Ctrl+J`           |
| Open settings          | `⌘/Ctrl+,`           |

## Troubleshooting

- **Linux: `The SUID sandbox helper binary ... is not configured correctly`** — Electron's
  Chromium sandbox needs a root-owned setuid helper. Either fix it once:
  ```bash
  sudo chown root:root node_modules/electron/dist/chrome-sandbox
  sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
  ```
  or run dev without the OS sandbox: `npm run dev -- --no-sandbox`.
- **No window appears on a headless/SSH box** — there is no display; run on a desktop session.

## Security notes

- Renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- API keys are encrypted at rest with Electron `safeStorage` (OS keychain). If a keychain is
  unavailable (some headless Linux), they fall back to obfuscated storage — prefer env vars there.
- All tool file paths are sandboxed to the open project root; `..` escapes are rejected.
- File edits and destructive shell commands always require explicit user approval.

## License

MIT
