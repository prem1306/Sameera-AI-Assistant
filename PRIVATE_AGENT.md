# Sameera 1.2: private desktop agent

## Implemented

Public research-to-Notepad requests now use a dedicated reviewed `research/searchToNotepad` task, for example `hotels in Kanchipuram`. It searches public sources, reads bounded excerpts, and delegates the new verified draft to the existing Notepad module. This path needs neither Chrome site permission nor a local model. It keeps extracted text local, cites source URLs, omits blocked pages, and produces no note if all pages fail. The output is source excerpts, not a model-curated hotel shortlist or verified prices. The agent panel offers this action with Google selected, independently of Chrome connectivity. Desktop companion prompts no longer advertise the unavailable legacy research/browser tools.

The desktop agent panel provides task progress, Stop, exact action reviews, private-data previews, language/persona settings, duplicate reports, and optional offline setup. Word and Notepad remain separate TypeScript/native modules; `CODE_STRUCTURE.md` maps ownership.

The Review tasks button sits on its own visible row below the crowded header. New task/action or private-sharing reviews open the dialog automatically once per review. A persistent pending-count notice allows reopening a dismissed review. Settings/manual workflows are collapsed by default so task approval controls appear immediately; expired approvals are disabled. Browser smoke checks verified automatic opening, visible exact-scope approval, and the reopen notice using an isolated unapproved proposal.

Supported language settings are Telugu, Tamil, Kannada, Malayalam, Hindi, and English, with English mixing. Companion and Butler personalities are independent of language and privacy mode. Butler selects Charon for cloud speech. Voice samples and actual native-language intelligibility require device/provider testing.

Chrome's extension includes bounded rendered-page reading and continuation, candidate selection, and YouTube/Netflix playback checks. The extension UI must grant site access or temporary tab access. Tasks bind observations to a tab/document identity and reject stale targets. Public HTML reading is a separate fallback without signed-in cookies. Summarizing private pages uses the optional local planner. Media failures, login/profile ambiguity, absent titles, and unobserved playback are reported rather than assumed successful.

Word duplicate scanning accepts explicit files or folders. It distinguishes identical bytes from matching normalized document text, warns about non-text differences, and skips unsupported/corrupt/changing files. No copies are preselected for removal. Recycle requests require exact review, current hashes, and a surviving keeper. Partial failures produce a receipt; permanent deletion is not a fallback.

## Privacy modes and storage

Controlled cloud is the default: Google receives live microphone audio and planning requests. Private tool results stay local behind opaque IDs until a specific outbound payload is reviewed. Unknown content is private; recognized secrets are blocked. Cloud microphone audio itself is not locally redacted: mute before speaking sensitive information, or select Local-only AI.

Task-approved cloud currently uses the same conservative, one-shot exact-payload reviews. It does **not** grant reusable permission to transmit future task content. Broader task-scoped disclosure grants remain deferred. Paid-provider handling is a user-confirmed configuration setting, not an automated billing or retention verification. Private sharing stays disabled when that setting is unknown. Paid handling is not a zero-retention promise.

Local-only AI closes cloud voice sessions, clears queued payloads, cancels pending tasks/reviews, and disables MCP connections. Missing local models produce an error with no automatic cloud fallback. Explicit website navigation still contacts the requested website. A mode change cannot retract previously transmitted audio or data.

Summaries are opt-in, limited to 25, and encrypted with Windows DPAPI under the Sameera user profile. Full transcripts/audio are not retained by default. Existing browser summaries are preserved pending an explicit import/delete choice; they are not automatically sent to the provider. Routine SQLite task records contain IDs, states, and timestamps; interrupted tasks do not resume automatically. Private task results and disclosure previews are bounded, temporary, in-memory data. See `LOCAL_DATABASE.md` for storage details.

Desktop HTTP and voice endpoints require session authentication; voice connections use short-lived one-use tickets. Extension pairing binds the browser instance. Model output, document text, filenames, and webpages cannot approve actions. MCP proposals require local review, including commands in Indian scripts; reconnecting invalidates pending approvals.

## Optional offline setup

Open the agent panel's offline setup. It downloads pinned Whisper.cpp, Ollama/Qwen3:4b, embedded Python, and Indic Parler assets/dependencies into `%APPDATA%/Sameera/local-ai`. Allow approximately 11 GB of downloads and at least 24 GB of free space. Hash verification precedes installation, and Python installation uses the verified local wheelhouse without an index.

The pinned Indic Parler repository currently requires Hugging Face access. Obtain access in your own account and enter a temporary read token only in the password field in offline setup; the token is not saved. Do not put tokens in chat or source files. Installation can be cancelled and retried using verified cached downloads. The installer marks the stack ready only after dependency import checks pass.

Runtime speech recognition, planning, and speech synthesis execute sequentially to limit memory use. Model downloads are explicit setup operations, not an automatic response to missing models. Workers use offline environment flags, local model paths, bounded I/O, timeouts, and cancellation. These controls are not an OS network or memory sandbox; the pinned local binaries remain trusted code. Latency, resource use, and regional voice quality have not yet been benchmarked on the actual device.

## Validation and remaining acceptance work

The initial production dependency audit found no known vulnerabilities. TypeScript checks, synthetic duplicate tests, browser protocol tests, mocked provider-capture tests, setup tests, and native PowerShell parsing have passed. Desktop preparation, the web server bundle, and prepared-package content checks pass. The complete suite passed 84/84 tests in an approved run outside the restricted sandbox. The desktop HTTP fixture now uses the launcher's 30-second startup budget to avoid failures under parallel load.

A real isolated desktop HTTP/WebSocket integration test passed in an earlier permitted run, including authentication, local-only provider blocking, and ticket replay rejection. The activity/duplicate review UI was exercised with synthetic documents in an isolated local profile. The newest MCP reconnect test passes and confirms that pending approval is invalidated after a server reconnect.

These checks do not establish every acceptance criterion. Remaining work includes:

- Complete installed-app validation after the final edits.
- Install the complete optional local stack, then benchmark all six languages, both personas, interruption, and latency on this 16 GB machine.
- Load/pair the extension in the actual Chrome profile and test Google/article reading, continuation, permissions, navigation invalidation, and media playback in the user's available services/region.
- Exercise installed Word, legacy `.doc`, live unsaved-document approval invalidation, locked files, and real Recycle Bin recovery with disposable fixtures.
- Validate installed-app startup and cloud voice/sample reconnection with the user's provider configuration.
- Add OS-level outbound network capture across browser, search, MCP, and provider traffic. Existing provider-capture tests use instrumented clients and do not constitute complete OS network capture.

Native Word smoke execution was not completed: an earlier automatic approval review encountered an account usage limit before executing the command. Restricted sandbox runs also reject Windows atomic replacement, loopback connections, and executable renaming. A subsequent approved Windows packaging run succeeded, and the 1.2 unpacked application passed actual ASAR content checks before replacing `release/win-unpacked`. No 1.2 installer has been produced and installed-app/media/offline smoke testing remains pending. Existing shortcuts may still point to older installed releases; launch the new unpacked executable explicitly for testing.

Approvals reduce accidental or model-induced damage; they do not protect against an already-compromised local account or eliminate every filesystem race. Native file hash rechecks occur immediately before actions, but a malicious local process racing a shell recycle operation remains outside the current guarantee. The target is no unauthorized private-data transfer backed by enforceable boundaries and tests, not an absolute zero-leak claim.

## Build

Run `npm run lint`, `node --import tsx --test tests/*.test.ts tests/*.test.cjs tests/*.test.mjs`, `npm run desktop:prepare`, and `npm run build:web`. Run `node scripts/check-desktop-package.mjs` to check the prepared application. Packaging performs the same checks against the actual ASAR archive before copying it to `release`. `npm run desktop:pack` produces an unpacked Windows app; `npm run desktop:dist` produces the installer. Native script parsing and package inspection must accompany changes to native modules. Builds include the new Word-inspection/archive modules and Python speech worker, and exclude personal databases, credentials, downloaded model weights, and test fixtures.

Voice scope approval is available for a single pending supported research, browser, read-only file, new-draft or duplicate-scan task proposed during the active voice session. Sameera explains the scope and says “go for it”; a finalized explicit task-confirmation phrase then approves that exact task. Generic yes/okay replies, including bare native-script affirmatives, do not authorize. The panel remains visible and usable. Explicit task-confirmation phrases in the six supported languages are recognized. Offers expire after at most 60 seconds, clear on connection reset, and are invalidated by another pending task or sharing review. No model approval tool or client-transcription approval endpoint is exposed. Consequential actions, unclassified actions, MCP requests and private disclosure still require panel review. This is speech consent, not speaker identity verification. Live microphone/device accuracy still needs an actual spoken smoke test.

Voice approval validation: 90/90 regression tests passed, including finalized/replayed speech, six-language consent, ambiguous and expired reviews, cloud-session input boundaries and local-only consent without replanning. TypeScript, production build and prepared package checks passed.

Security continuation (10 October 2026): Desktop session credentials now travel through main-process/backend provisioning and exact-main-frame preload IPC; /api/system/session never returns a token. The backend refuses non-web startup without an out-of-band 64-hex-character SAMEERA_DESKTOP_TOKEN. Use the desktop launcher for PC controls and dev:web for browser development. Google Fonts loading was removed, using installed system-font fallbacks. PowerShell hosts use an absolute Windows system path. These controls do not authenticate a speaker or protect an already compromised local account. Other reviewed hardening work remains tracked in handoff.md.

Security continuation (11 October 2026): Shared file tools restrict text mutations to txt/md/csv/json/yaml and reject known executable/script/installer/shortcut copy, move and rename targets and sources. Path syntax rejects controls, traversal, reserved Windows devices and trailing-dot/space aliases before normalization. Rename fingerprints include the destination, and reviewed source hashes are rechecked after shared-queue waits. Cross-drive EXDEV moves stop without copying or deleting. These checks narrow races; they are not a user-selected allowed-root policy or an atomic filesystem transaction.

Stopping a task while its action is executing immediately reports uncertain, retains any late receipt and prevents dependent steps. Repeated Stop does not erase uncertainty. Cancelled queued system work returns a verified notExecuted receipt and becomes cancelled without invoking the native host. Running native applications are not force-killed or rolled back; inspect the result before retrying. Adapter execution exceptions without a verifiable result are uncertain.
