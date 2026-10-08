# Sameera AI Assistant

A local voice assistant built with React, Express, and Gemini Live. It supports Telugu, Tenglish, and English, article search and reading, Windows application/file actions, and Gmail drafts with separate human approval for sending.

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

## Capabilities

- Live conversation in Telugu, Tenglish, and English, with bounded conversation history and speech recovery.
- Article searches ask for a topic, show source choices, and open one selected article. The reader keeps paragraph and selected-text context for explanations.
- Open installed Notepad, VS Code, Chrome, or Word by name. Notepad notes use separate verified UTF-8 working drafts.
- Explicit Windows file/folder actions, backed-up text edits, Word edits, volume, and supported-display brightness controls. Ambiguous details cause a pause.
- Gmail drafting in Chrome through the included extension. Sending requires the exact-message **Approve and send** button; drafting never grants send permission.

See [LOCAL_ACTIONS.md](LOCAL_ACTIONS.md) for examples, supported operations, and Chrome bridge setup. Gmail requires one-time manual extension installation and pairing. The first bridge version supports Gmail's English interface, one recipient/account, and plain text without attachments or CC/BCC; it stops when page contents cannot be verified.

## Verify

```powershell
npm run lint
npm run build
node --import tsx --test tests/*.test.ts tests/*.test.mjs
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
