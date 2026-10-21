# Sameera system actions

Keep application-specific behavior in separate modules so faults can be traced to one application. New Word features belong in the Word modules; Notepad features belong in the Notepad modules. Avoid adding their implementation to the shared dispatcher.

| Responsibility | Source |
| --- | --- |
| Public research search and bounded webpage text endpoints | `src/routes/research.ts` |
| Reviewed public research-to-Notepad task and bounded source excerpts | `src/services/agent/ResearchAdapter.ts`, `src/services/research/ResearchNotes.ts` |
| Research tool requests and failure handling | `src/services/tools/ResearchTools.ts` |
| Model tool declarations and research-to-Notepad guidance | `src/services/session/ModelTools.ts`, `Instructions.ts` |
| Desktop identity, startup and setup IPC authorization | `desktop/main.cjs` |
| Exact main-frame desktop credential bootstrap | `desktop/session.cjs`, `desktop/preload.cjs`, `src/services/tools/DesktopSession.ts` |
| Absolute system PowerShell executable selection | `src/services/system/WindowsPowerShell.ts` |
| Gemini key normalization and input validation | `desktop/credentials.cjs` |
| Saved-key availability and replacement UI | `desktop/setup.html`, `setup.js`, `preload.cjs` |
| Action routing, serialization, repeated-call protection, clarification state | `src/services/SystemActions.ts` |
| Word drafts and existing-document validation | `src/services/system/WordActions.ts` |
| Notepad draft creation and text verification | `src/services/system/NotepadActions.ts` |
| File mutation types, lexical path validation and reviewed-source rechecks | `src/services/system/FilePolicy.ts` |
| Shared result types, path protection, hashing, PowerShell transport | `src/services/system/ActionSupport.ts` |
| Native Windows routing and JSON input/output | `scripts/windows-actions.ps1` |
| Word COM automation | `scripts/windows-word.ps1` |
| Native Notepad launch | `scripts/windows-notepad.ps1` |
| Installed-application discovery and launch | `scripts/windows-apps.ps1` |
| Per-user SQLite lifecycle and profile paths | `src/services/database/LocalDatabase.ts` |
| Versioned transactional database migrations | `src/services/database/migrations.ts` |
| Validated non-secret preferences | `src/services/database/SettingsRepository.ts` |
| Stored MCP connections, permissions, presets and event metadata | `src/services/database/ConnectionRepository.ts` |
| MCP configuration and connection lifecycle | `src/services/mcp/ConnectionConfig.ts`, `ConnectionManager.ts` |
| Pinned HTTP transport and private-address checks | `src/services/mcp/HttpTransport.ts` |
| Encrypted per-connection tokens | `src/services/mcp/CredentialStore.ts`, `scripts/windows-credentials.ps1` |
| Tool request review, execution and repeated-call protection | `src/services/mcp/ToolExecutor.ts` |
| Voice proposals with mandatory exact local review | `src/services/mcp/VoiceToolSession.ts` |
| MCP composition and model tool declarations | `src/services/mcp/McpService.ts`, `ModelTools.ts` |
| Local authenticated connection endpoints | `src/routes/mcp.ts` |
| Data-only plugin preset validation | `src/services/plugins/PluginManifest.ts` |
| Connections UI, forms and result previews | `src/components/connections/` |
| Shared six-language registry, English mixes and persona instructions | `src/services/session/Preferences.ts` |
| Private provider payload reviews and blocked secret detection | `src/services/privacy/PrivacyService.ts` |
| Opt-in DPAPI-encrypted summaries (25 maximum) | `src/services/privacy/MemoryStore.ts` |
| Typed sequential task states, cancellation and exact-action fingerprint approval | `src/services/agent/TaskRunner.ts` |
| System, Gmail and browser capability adapters | `src/services/agent/SystemAdapter.ts`, `GmailAdapter.ts`, `src/services/browser/BrowserBridge.ts` |
| Session-bound spoken scope approval, finalized speech matching and replay protection | `src/services/agent/VoiceTaskApproval.ts` |
| Agent composition and safe model status summaries | `src/services/agent/AgentService.ts`, `ModelTools.ts` |
| Local Word duplicate scanning, keeper validation and cleanup receipts | `src/services/system/DuplicateService.ts`, `DocumentText.ts` |
| Read-only hidden legacy Word inspection | `scripts/windows-word-inspect.ps1` |
| Task ID/state persistence only | `src/services/database/TaskRepository.ts` |
| Authenticated agent settings, task and disclosure review endpoints | `src/routes/agent.ts` |
| Rendered Chrome reading and verified media adapters | `chrome-extension/browser.js` |
| Agent activity, duplicate review and offline setup UI | `src/components/agent/` |
| Optional pinned local asset/dependency manifests and verified installer | `src/services/local/Assets.json`, `Dependencies.json`, `Installer.ts` |
| Sequential local recognition, planning, synthesis and interruption | `src/services/local/Runtime.ts`, `Process.ts`, `LocalConnection.ts` |
| Bounded local archive expansion and local-only Indic speech worker | `scripts/expand-local-package.ps1`, `local-speech.py` |
| Prepared and ASAR package content/version/native-module checks | `scripts/check-desktop-package.mjs`, `package-desktop.mjs` |
| Local AI status/setup/text/reading and public voice samples | `src/routes/local-ai.ts`, `voice.ts` |

The TypeScript modules receive the native executor as a dependency. Tests can inspect requests without launching apps. The PowerShell modules are loaded by the shared Windows entry point, which supplies common error handling. The desktop builder copies each native module into the installed app.

Database details and operating instructions are in `LOCAL_DATABASE.md`. Keep SQL and database lifecycle code inside `src/services/database/`; consumers use repositories.

The assessment and incremental architecture roadmap for `APP_REVIEW.md` are in `APP_REVIEW_PLAN.md`. The desktop launcher uses the explicit `Sameera` identity and `%APPDATA%/Sameera` profile in development and packaged builds; Gemini credentials remain encrypted there and never cross the setup status IPC.

Run `npm run lint` and `node --import tsx --test tests/system-actions.test.ts tests/word-draft.test.ts tests/notepad-draft.test.ts` after changing these modules. The native scripts must also parse successfully in Windows PowerShell. Verify packaged native files after changing the build configuration.

Version 1.2 validation and current limitations are recorded in `PRIVATE_AGENT.md`. The desktop builder includes both new PowerShell modules and the Python speech worker. Model weights, downloaded Python packages, personal databases, credentials and synthetic fixtures stay outside the distributable.
