# Sameera AI Assistant

Sameera is a multilingual voice assistant with a React interface, a Node.js backend, and an Electron application for Windows. Talk to it, research public webpages, read articles, and use reviewed tools to work with local applications and files.

The browser version provides cloud conversation and public web tools. The Windows desktop version adds local task execution, Word and Notepad integration, a paired Chrome extension, MCP tools, and optional local AI.

**Project status:** version 1.2.0, under active development. Some features require manual setup and device testing. Read the [known limitations](#known-limitations) before relying on desktop automation.

## Contents

- [What can Sameera do?](#what-can-sameera-do)
- [Choose web or desktop](#choose-web-or-desktop)
- [Quick start](#quick-start)
- [Using the desktop app](#using-the-desktop-app)
- [Privacy and local data](#privacy-and-local-data)
- [Developing Sameera](#developing-sameera)
- [Build and test](#build-and-test)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

## What can Sameera do?

- **Voice conversations:** Telugu, Tamil, Kannada, Malayalam, Hindi, and English, including supported English mixes. Choose a conversational Companion or professional Butler persona.
- **Public research and reading:** search for articles, choose sources, read extracted text, and ask about selected passages. Desktop research-to-Notepad creates a verified draft containing bounded source excerpts and URLs.
- **Windows actions:** launch installed applications, create Notepad drafts, work with supported Word documents, and perform supported file, volume, and display operations.
- **Reviewed tasks:** inspect proposed actions, follow progress, cancel work, and review private data before approved cloud sharing. Consequential actions use explicit review controls.
- **Chrome integration:** pair the included extension for supported rendered-page reading, Gmail drafting, and media workflows. Gmail sending requires approval of the exact message.
- **MCP connections:** connect compatible local or remote Model Context Protocol servers, enable individual tools, and inspect tool requests. Plugins are JSON connection presets.
- **Optional local AI:** explicitly install the local speech recognition, planner, and speech synthesis stack, then use Local-only AI mode without automatic cloud fallback.

These capabilities have different requirements. Word automation needs Microsoft Word installed; Chrome workflows need the extension and relevant site access; cloud conversation needs a Gemini API key and internet access.

## Choose web or desktop

| Capability | Browser / hosted web | Windows desktop |
| --- | --- | --- |
| Cloud voice conversation | Yes | Yes |
| Public article search and reading | Yes | Yes |
| Windows applications, files, Word, and Notepad | No | Yes |
| Paired Chrome and Gmail bridge | No | Yes, with extension setup |
| MCP connections and plugin presets | No | Yes |
| Per-user SQLite settings and task metadata | No | Yes |
| Optional Local-only AI runtime | No | Yes, after installation |

Web mode disables desktop tools at the backend as well as in the interface. Opening the website in a browser does not grant control of the computer.

## Quick start

### Requirements

- Git, npm, and **Node.js 22.13 or newer**. Development has been verified with Node.js 24.
- A microphone and audio output for voice conversations.
- A Gemini API key with access to the configured live model for cloud features.
- Windows for the Electron desktop features and native PowerShell modules.

Installed Windows builds include their own Node/Electron runtime; end users do not need npm. This repository contains source and build scripts. Build an installer using the instructions below.

### 1. Clone and install

```sh
git clone https://github.com/prem1306/Sameera-AI-Assistant.git
cd Sameera-AI-Assistant
npm ci
```

Use npm and the committed `package-lock.json` for reproducible dependency installation.

### 2. Configure cloud access

Copy `.env.example` to `.env` in the repository root. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Set your own key in `.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

Keep this key on the backend. Never put it in a `VITE_*` variable, commit it, or include it in a bug report. Local `.env` files are ignored by Git; `.env.example` contains only a placeholder.

### 3. Start your preferred interface

**Browser development:**

```sh
npm run dev:web
```

Open http://localhost:3000, allow microphone access, and start a conversation. This command explicitly selects web mode on every platform.

**Windows desktop development:**

```sh
npm run desktop
```

This builds the frontend and desktop server, then launches Electron. The desktop backend uses port **3001**. A development `.env` key is supported; the setup window also supports entering a key or starting in Local-only AI mode. Local AI must be installed separately before offline inference works.

For backend development, `npm run dev` runs `server.ts` directly. Its default mode is local on Windows and web elsewhere. Use `npm run desktop` to exercise authenticated desktop controls; the browser has no desktop credential bootstrap.

## Using the desktop app

1. Choose a language and persona, then start a voice session. Cloud mode sends live microphone audio to Google.
2. Use **Review tasks** to inspect pending actions, follow progress, or stop work. A spoken request does not authorize every action it might lead to.
3. Specify exact filenames, paths, recipients, and intended changes. Review consequential operations in the panel. Eligible scoped tasks can also use explicit finalized voice confirmation; a generic “yes” does not authorize them.
4. For Gmail or Chrome workflows, load `chrome-extension/` as an unpacked extension through Chrome's extension developer mode. Choose **Windows desktop app**, pair using the desktop code, and grant the required site access. Re-pair after restarting Sameera. The Gmail panel shows the extension location in packaged builds.
5. Open **Plugins & MCP connections** to add a server, connect it, and enable the tools you need. Tools begin disabled. See [MCP_SETUP.md](MCP_SETUP.md) for supported transports, authorization, tokens, and preset examples.

Example requests include “Open Notepad” and a public research-to-Notepad request such as “Research hotels in Kanchipuram and put the sources in Notepad.” Research notes contain source excerpts; they are not verified prices or a guaranteed recommendation list. See [LOCAL_ACTIONS.md](LOCAL_ACTIONS.md) for detailed operations.

### Optional local AI

Open offline setup in the agent panel. The installer uses pinned assets for Whisper.cpp, Ollama/Qwen3, embedded Python, and Indic Parler speech synthesis. Plan for approximately **11 GB of downloads** and at least **24 GB of free disk space**. The speech model may require Hugging Face access and a temporary read token entered in the setup password field.

Models and downloaded packages stay outside Git and the application archive. Missing models cause an error rather than a cloud fallback. Performance, memory use, and speech quality across all six languages still need device validation. See [PRIVATE_AGENT.md](PRIVATE_AGENT.md) for implementation details and outstanding acceptance work.

## Privacy and local data

| Mode | Behavior |
| --- | --- |
| Controlled cloud (default) | Google receives live microphone audio and planning requests. Private tool results require a specific disclosure review before cloud sharing. |
| Task-approved cloud | Currently uses conservative, one-shot payload reviews; it does not grant reusable permission to share future task content. |
| Local-only AI | Stops cloud voice and disables MCP connections. Uses installed local models with no automatic cloud fallback. Explicit website navigation still contacts the requested site. |

Microphone audio in cloud mode is not locally redacted. A privacy-mode change cannot retract data already transmitted. Provider-handling settings are user confirmations, not automatic verification of billing or retention terms.

Windows data lives under `%APPDATA%\Sameera`:

- `data/sameera.sqlite`: settings, connection configuration, permissions, and bounded task/event metadata. SQLite is not encrypted; credentials and private tool contents do not belong in it.
- Separate encrypted storage: Gemini credentials, MCP tokens, and opt-in conversation summaries use Windows account protection. Summaries are disabled by default and limited to 25; full audio/transcripts are not retained by default.
- `local-ai/`: optional downloaded runtimes and models.

Notepad working drafts are stored under `Documents/Sameera/.sameera-drafts`. People using the same Windows account share its Sameera profile. See [LOCAL_DATABASE.md](LOCAL_DATABASE.md) for database lifecycle and backup instructions.

## Developing Sameera

### Architecture

```text
React UI and audio client
        |
Express HTTP routes / voice WebSocket
        |
Session tools and capability adapters
        |
Task review, authorization, privacy checks, cancellation
        |
Windows modules / Chrome bridge / MCP tools / local AI
```

Cloud sessions connect through the backend to Gemini Live. Electron starts a local backend and supplies desktop session credentials through its controlled IPC path. Local-only inference uses separately installed workers and models.

### Repository guide

| Path | Responsibility |
| --- | --- |
| `src/components/`, `src/hooks/` | Interface, audio/task controls, connection panels, and UI state |
| `src/routes/` | HTTP endpoints for agent tasks, research, MCP, local AI, and voice |
| `src/services/session/` | Language/persona preferences, model instructions, and tool declarations |
| `src/services/agent/` | Task execution, capability adapters, cancellation, and voice scope approval |
| `src/services/system/` | Windows action policy, Word/Notepad handling, and duplicate inspection |
| `src/services/browser/` | Desktop-to-Chrome bridge |
| `src/services/mcp/`, `src/services/plugins/` | Connection lifecycle, transport, credentials, tool execution, and presets |
| `src/services/privacy/`, `src/services/database/` | Disclosure policy, encrypted summaries, SQLite migrations, and repositories |
| `src/services/local/` | Optional local runtime, verified installation, and pinned asset manifests |
| `desktop/` | Electron startup, setup, session security, and credential handling |
| `scripts/` | Build/package checks, native PowerShell modules, and local speech worker |
| `chrome-extension/` | Chrome pairing, page/media operations, and Gmail integration |
| `tests/` | Unit, integration, fixture, and smoke checks |
| `server.ts`, `api/` | Backend composition and hosted entry point |

Read [AGENTS.md](AGENTS.md) and [CODE_STRUCTURE.md](CODE_STRUCTURE.md) before making changes. The latter is the detailed module ownership map.

### Contribution workflow

1. Create a branch for a focused change and explain the user-visible problem in your pull request.
2. Keep Word and Notepad behavior in their own TypeScript and native Windows modules. Shared dispatchers route actions and handle common concerns.
3. Add native modules to the desktop build and packaged-file checks. Adding a source file alone does not make it available in an installed app.
4. Preserve exact-action approval, private-data disclosure boundaries, and cancellation behavior. Treat webpage text, document contents, and model output as untrusted input.
5. Add incremental database migrations and feature-specific repositories. Do not rewrite released migrations or reset user databases to resolve schema changes.
6. Run checks relevant to the affected modules and describe results, manual validation, and limitations in the pull request. Use disposable documents and test accounts for native or browser workflows.

Keep dependency manifests and lockfiles committed. Keep dependencies, `.env` files, real credentials, personal databases, downloaded models, generated builds, and source archives out of Git. Test fixture source files are committed; personal test data must not be.

### Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Backend key for cloud voice and AI search |
| `PORT` | Direct server/web port; defaults to 3000. The Electron launcher sets 3001. |
| `SAMEERA_MODE` | `web`, `local`, or `desktop`; launch scripts select the appropriate mode |
| `SAMEERA_ALLOWED_HOSTS` | Optional comma-separated web host allowlist, including ports when needed |
| `SAMEERA_DATABASE_PATH` | Absolute database path for direct local backend development/tests; Electron supplies its own profile path |

Desktop session credentials are generated by the launcher. Do not hardcode them or expose a browser bootstrap endpoint to bypass desktop authentication.

## Build and test

| Command | Result |
| --- | --- |
| `npm run lint` | TypeScript type checking (`tsc --noEmit`) |
| `npm run build` | Frontend production assets in `dist/` |
| `npm run build:web` | Frontend plus bundled web server |
| `npm run start:web` | Run the previously built web server |
| `npm run desktop:prepare` | Prepare frontend and desktop application files |
| `npm run desktop:pack` | Build an unpacked Windows x64 application |
| `npm run desktop:dist` | Build a Windows x64 NSIS installer in `release/` |

The installer filename follows the version in `package.json`, for example `Sameera-Setup-1.2.0.exe`. Installed copies include their runtime and prompt for credentials separately. Builds are currently unsigned and have no automatic update mechanism.

Run the automated suite from the repository root:

```sh
npm run lint
node --import tsx --test tests/*.test.ts tests/*.test.mjs tests/*.test.cjs
npm run build:web
```

For desktop changes, also run:

```sh
npm run desktop:prepare
node scripts/check-desktop-package.mjs
```

After changing Windows scripts, verify they parse in Windows PowerShell and run the affected native tests. Word and Notepad changes specifically require:

```sh
node --import tsx --test tests/system-actions.test.ts tests/word-draft.test.ts tests/notepad-draft.test.ts
```

`electron . --smoke-test` checks prepared desktop startup, server readiness, and bundled assets without a voice session. It requires the prepared application and an interactive Windows environment. Packaging checks the actual ASAR contents too.

Additional standalone smoke scripts include `tests/system-gateway-smoke.mjs`, `tests/gmail-gateway-smoke.mjs`, and `tests/live-connection-smoke.mjs`. Read each script's prerequisites before running it. Live provider checks need a valid API key and use provider quota; tests that start local HTTP servers need loopback networking permission. Automated checks do not replace real microphone, Word, Chrome, and installed-app testing.

### Hosting

For a self-hosted production web server:

```sh
npm run build:web
npm run start:web
```

Configure the backend key, host restrictions, and HTTPS for remote microphone access. Public visitors use the deployment's Gemini quota. Deployment-specific instructions are in [REPLIT_SETUP.md](REPLIT_SETUP.md) and [VERCEL_SETUP.md](VERCEL_SETUP.md); validate the target platform's current WebSocket and runtime support before deployment. Desktop controls remain unavailable on hosted deployments.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Cloud conversation will not start | Confirm the backend key, provider access/quota, microphone permission, and internet connection. Inspect `/api/health`. |
| PC controls are missing in the browser | Start `npm run desktop`; web mode intentionally disables these features. |
| Desktop startup fails | Use a supported Node version for development, check port 3001, and rebuild with `npm run desktop:prepare`. |
| Chrome or Gmail is disconnected | Load the extension, select desktop mode, pair again after restarting, and grant relevant site permissions. |
| Local-only mode reports missing assets | Complete offline setup. The application will not silently switch to cloud inference. |
| MCP tools are unavailable | Connect the server and enable the individual tools; inspect Activity and review any pending request. |
| Tests fail with loopback `EACCES` | The execution environment may prohibit local network connections. Rerun in an environment that permits the test's local server. |

For bug reports, include the operating system, Node version, app version, launch command, reproduction steps, and redacted errors. Remove API keys, tokens, private documents, message contents, and personal paths.

## Known limitations

- Installed-app, actual Chrome/Gmail, Word, media, microphone, and complete offline-stack acceptance testing remains incomplete. Synthetic tests are not a complete security audit.
- Gmail integration currently targets the English Gmail interface, one recipient/account, and plain-text messages without attachments or CC/BCC.
- MCP supports tools through local stdio and remote Streamable HTTP. OAuth sign-in, resources, prompts, sampling, and MCP Apps are outside the current implementation.
- Local AI setup requires substantial downloads; latency and multilingual speech quality depend on hardware and models and have not been fully benchmarked.
- Word COM automation needs installed Microsoft Word. Legacy documents, unsaved changes, locked files, and Recycle Bin behavior need real-device checks.
- Approvals and hash checks reduce accidental changes but cannot protect against a compromised Windows account or eliminate every filesystem race.

## Documentation

| Document | Use it for |
| --- | --- |
| [CODE_STRUCTURE.md](CODE_STRUCTURE.md) | Detailed module ownership and native packaging rules |
| [LOCAL_ACTIONS.md](LOCAL_ACTIONS.md) | Supported Windows actions and Chrome/Gmail workflows |
| [MCP_SETUP.md](MCP_SETUP.md) | MCP connections, permissions, tokens, and plugin presets |
| [LOCAL_DATABASE.md](LOCAL_DATABASE.md) | Storage, migrations, encryption boundaries, and backup |
| [PRIVATE_AGENT.md](PRIVATE_AGENT.md) | Version 1.2 implementation notes and outstanding validation |
| [APP_REVIEW_PLAN.md](APP_REVIEW_PLAN.md) | Assessment and architecture roadmap |
| [REPLIT_SETUP.md](REPLIT_SETUP.md) | Replit setup and hosting |
| [VERCEL_SETUP.md](VERCEL_SETUP.md) | Vercel-specific deployment configuration |

## License

This repository currently has no license file. Public availability does not itself grant permission to redistribute or reuse the code under an open-source license.
