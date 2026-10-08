# Sameera AI Assistant

A voice assistant built with React, Express, and Gemini Live, available as a website or a Windows desktop application. Both support Telugu, Tenglish, English, and web/article tools. Windows additionally provides local app/file controls and the Gmail bridge.

## Replit website

See [REPLIT_SETUP.md](REPLIT_SETUP.md) for importing, secrets and publishing. Run `npm run dev:web` for development, or `npm run build:web` followed by `npm run start:web` for production. Web mode hides Windows controls and rejects native action requests at the server.

## Run locally

Requirements: Node.js and npm. Windows is required for native application, Word, audio, and display controls. Development has been verified with Node.js 24.

```powershell
npm ci
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in your local `.env`, then start the server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start a voice session. Allow microphone access when prompted. The server binds only to `127.0.0.1`; keep it local.

## Windows desktop application

Run Sameera in its own desktop window from the checkout:

```powershell
npm run desktop
```

This builds the UI and bundles the local server. It uses your existing development `.env` key. The desktop server uses port 3001, so the web app on port 3000 can stay open independently. Close the desktop window to stop its server.

Create a Windows x64 installer:

```powershell
npm run desktop:dist
```

The installer is written to `release/Sameera-Setup-1.1.0.exe` and creates desktop and Start menu shortcuts. Installed copies include their own runtime and do not require Node.js or npm. On first launch, enter your Gemini API key; it is stored encrypted for your Windows account under Sameera's application-data folder. Use **App → Gemini key settings** to replace it. No `.env` file or API key is included in the installer. Internet access and Google AI quota are still required for voice and AI search. This local build is unsigned and does not provide automatic updates.

For Gmail, install the included Chrome extension from the folder shown in the Gmail panel, choose **Windows desktop app** in the extension, and pair it with the desktop window's code. Re-pair after restarting Sameera. Notepad working drafts are written inside `Documents/Sameera/.sameera-drafts` in desktop mode. Browser links open in your default browser; embedded media and article readers remain in Sameera.

`npm run desktop:pack` builds the unpacked Windows application for local testing. The startup check `electron . --smoke-test` loads the production UI and verifies the server and bundled Windows/extension assets without starting a voice session.

## Capabilities

- Live conversation in Telugu, Tenglish, and English, with bounded conversation history and speech recovery.
- Article searches ask for a topic, show source choices, and open one selected article. The reader keeps paragraph and selected-text context for explanations.
- Discover and open installed Windows apps by name, or a portable app by an exact executable path. Close requested application windows gracefully, with a choice for ambiguous matches and normal save prompts. Notepad notes use separate verified UTF-8 working drafts.
- Explicit Windows file/folder actions, backed-up text edits, Word edits, volume, and supported-display brightness controls. Ambiguous details cause a pause.
- Gmail drafting in Chrome through the included extension. Sending requires the exact-message **Approve and send** button; drafting never grants send permission.

See [LOCAL_ACTIONS.md](LOCAL_ACTIONS.md) for examples, supported operations, and Chrome bridge setup. Gmail requires one-time manual extension installation and pairing. The first bridge version supports Gmail's English interface, one recipient/account, and plain text without attachments or CC/BCC; it stops when page contents cannot be verified.

## Verify

```powershell
npm run lint
npm run build
npm run build:web
node --import tsx --test tests/*.test.ts tests/*.test.mjs tests/*.test.cjs
```

Optional local-server smoke checks (no emails sent):

```powershell
node tests/system-gateway-smoke.mjs
node tests/gmail-gateway-smoke.mjs
node tests/live-connection-smoke.mjs
```

The live smoke check connects to Gemini and requires a valid API key. Gmail browser interaction still needs validation with a signed-in account; mocked tests cover the sending permission gate and changed-page checks.

## Local data

Environment secrets, dependency/build output, Notepad working drafts, edit backups, test fixtures, and local agent metadata are excluded from Git. Never commit a real API key. Model interpretation can be wrong: specify exact names, text, paths, and amounts, and review drafts before sending or saving permanent copies.
