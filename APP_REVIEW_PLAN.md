# Sameera review assessment and delivery plan

Prepared 9 October 2026 against GitHub commit `72bbe6a` and the current local working tree.

## Assessment

`APP_REVIEW.md` gives a useful product direction: a voice-first assistant with explicit boundaries between interaction, session coordination, capabilities, runtime policy, and Windows infrastructure. I agree that broad functionality needs clear ownership and that web and desktop capabilities should differ explicitly.

The review is a high-level architectural opinion, not a verified readiness or security audit. It offers no reproduction cases, severity-ranked defects, latency measurements, or release acceptance results. Its praise of safety and readiness should therefore be treated as an assessment to verify, rather than proof.

I would not copy its proposed directory tree wholesale. It introduces overlapping ownership between `app/session`, `state/LiveSession`, `agent/orchestrator`, `runtime/permissions`, and `policies`. That can distribute the same decisions across more files without improving reliability. Move one responsibility at a time, retain working interfaces, and keep `CODE_STRUCTURE.md` authoritative.

The local checkout has already moved beyond the GitHub review in several areas: separate Word and Notepad implementations, local SQLite repositories, MCP connection/execution modules, a separate Connections UI, and encrypted connection tokens. Preserve those boundaries and their existing work.

Desktop capability is permission to offer a feature, not automatic authorization for every action. Host/origin checks, local session tokens, argument validation, explicit Gmail send approval, and MCP tool permissions must remain enforced at execution boundaries.

## Gemini key issue: corrected verification record

- Pulled the GitHub update while preserving the existing local changes, including the locally modified lockfile.
- Initial shell launches tested an isolated Windows profile, not the user's visible desktop profile. Those results did not establish that the desktop issue was fixed. File Explorer later confirmed the visible app had no saved key; copying the isolated encrypted file did not work because the visible app could not decrypt it.
- Confirmed that an idle setup window did not recheck credential availability and always displayed the initial connection form, even when a usable key existed.
- Made development and packaged launchers use the same explicit Sameera identity and profile, so profile selection and Windows encryption identity stay consistent.
- Added saved-key status and a continue action to setup; it rechecks on focus and offers to open the app without another paste. Status IPC returns only availability, never the key, and only accepts the setup window's main frame.
- Added setup regression tests. Desktop tests and TypeScript checking pass.
- Restored the project's existing key through the actual installed app's protected setup field. Sameera saved its own encrypted copy and opened the normal assistant window. A subsequent cold-launch check was interrupted by the user and remains unverified. Earlier version 1.1.6 installation/launch claims referred to the isolated environment.

## Implementation and research follow-up

Extracted HTTP route families, model declarations/instructions, live connection lifecycle, capability tool families, the assistant session hook, help modal and language selector. Word and Notepad implementations retain their separate modules. These source changes are packaged but require installation in the visible user's environment before being claimed as deployed there.

The hotel-to-Notepad report exposed a specific missing research interface: `searchWeb` opened a tab but returned no search results or page text. Version 1.1.8 adds `searchWebSources` and `readWebpage`, backed by public search and the existing public-address-checked reader. Research guidance directs the model to collect sourced facts before `notepadDraft`, and avoids the article reading/source-choice flow for general research. Failed research stops queued dependent writing. This supports public HTML pages; it does not provide authenticated tab access, booking-form control, or guaranteed live prices.

Validation: 62 regression tests passed, including research route data/failure handling, model tool availability, failed-research cancellation of queued Notepad writing, and existing Notepad draft checks. TypeScript checking and desktop preparation passed. These use mocked sources/model/native delivery; live hotel research and an installed version 1.1.8 voice session have not been verified.
- Verified the packaged archive contains the native modules and no `.env`, saved Gemini credential file, or SQLite database.

These checks verify credential loading and local startup. They do not establish Google API quota or a new live voice conversation.

## Current ownership and priorities

| Area | Current evidence | Decision |
| --- | --- | --- |
| Server composition and live orchestration | `server.ts` is about 970 lines and includes HTTP routes, tool declarations, instructions, and WebSocket lifecycle | Highest refactoring priority; extract routes before the live lifecycle |
| Client tool routing | `ToolManager.ts` is about 560 lines and includes article, Gmail, MCP, browser, and presentation behavior | Keep shared dispatch/repeated-call handling; extract capability implementations |
| Main interface | `SameeraInterface.tsx` is about 980 lines | Extract cohesive panels/hooks after backend contracts are stable |
| Voice lifecycle | `LiveSession.ts`, `ConversationContext.ts`, audio services, and `StateManager.ts` already have separate roles | Preserve interfaces; isolate connection lifecycle changes and verify reconnect/cancellation |
| Word and Notepad | Separate TypeScript and PowerShell modules already exist | Preserve; do not move implementations into shared dispatchers |
| Database, MCP, Connections | Repositories, execution services, routes, and UI already separated | Preserve; use as the pattern for other capability families |
| Runtime policy | Server and client already consult runtime capabilities/policy | Keep one policy owner; verify enforcement on every privileged entry point |

## Delivery sequence

Each phase is a small reviewable change. Passing the preceding phase is the gate for the next. Avoid mixing module moves with behavior changes.

Baseline result: 48 automated test cases verified. The first sandbox run passed 46 and blocked two network-dependent cases (including loopback `EACCES`); rerunning the MCP and production web suites with local network access passed all six cases in those suites. `npm run lint` and JavaScript syntax checks passed. Architecture refactoring below remains planned; it has not been bundled into the credential release.

### 1. Establish the regression baseline and capability map

Run the existing automated suites and record the results. Map each built-in tool to its capability, execution location, authorization requirement, and web/desktop availability. Add missing boundary cases where the map exposes a gap; do not duplicate tests that already cover the behavior.

Use `RuntimePolicy.ts` as the policy owner and `RuntimeCapabilities.ts` as its client projection. Keep web startup free of local credentials, local databases, and Windows action execution. Preserve the separate local development mode already present in the code; the review's two-mode narrative should not erase it.

Acceptance: existing tests pass; unsupported platforms/web mode reject privileged HTTP routes and tool calls; the capability map agrees with model-visible declarations and UI availability.

### 2. Reduce server responsibilities without changing the protocol

Extract authenticated system routes, Gmail/browser bridge routes, and article/media routes into `src/routes/` factories with explicit dependencies. Use the existing MCP route module as a pattern. Keep app initialization, middleware order, host/origin checks, service construction, and shutdown in the server composition layer.

Next extract model tool declarations/instructions into a clearly owned agent/session module. Finally move WebSocket session coordination behind a service interface. Keep the HTTP/WS contracts, response shapes, transcript authorization, timeouts, and cancellation behavior stable throughout.

Acceptance: route and gateway tests pass; malformed and unauthorized requests remain rejected; web sessions cannot execute desktop tools; server shutdown still releases its database and owned processes.

### 3. Make ToolManager a dispatcher

Extract Gmail, article, browser/media, and connected-tool implementation families into separate modules. Pass transport and UI event callbacks as dependencies. Keep common result formatting, batch ordering, cancellation, repeated-call protection, and stop-on-clarification behavior in the dispatcher.

Keep credential handling on the server/native side. Do not migrate Word or Notepad behavior into client tool handlers. Preserve the user's explicit article selection, verified mail state, single-use approval, and uncertain-write handling.

Acceptance: article workflow and Gmail tests pass; repeated calls execute once; clarification blocks dependent calls; cancellation prevents stale acknowledgements; failure never becomes a claimed success.

### 4. Separate interface rendering from session ownership

Extract self-contained settings, drawers, panels, and overlays from `SameeraInterface.tsx`. Introduce a session hook/controller only where it reduces lifecycle coupling. Keep `StateManager` responsible for its state rather than adding a second competing store. Keep audio capture/playback in the audio services and connection/reconnect ownership in `LiveSession`.

Display actionable states for missing credentials, backend failure, disconnection, reconnecting, and tool approval. Match the server's actual capability state instead of inferring permission from which UI is visible.

Acceptance: start/stop, reconnect, microphone permission, captions, cancellation, and Connections interactions work; cleanup leaves no duplicate sockets, timers, or audio streams; no privileged implementation moves into rendering code.

### 5. Verify and package each release

Update `CODE_STRUCTURE.md` as responsibilities move. Run the relevant existing suites and `npm run lint`. For native changes, parse the PowerShell modules and run the affected native checks. Check every native module in the build and installed archive.

Build a new installer after code changes settle. Verify key and settings persistence across restarts, desktop startup outside the repository, web capability restrictions, and the absence of personal secrets in the package. Use controlled tools for workflow checks; Gmail verification must not send a real message.

Acceptance: the installer runs with its own packaged resources; profile data survives upgrade/restart; the release record distinguishes automated tests, native checks, and manually verified voice/UI behavior.

## Next implementation slice

After the baseline, extract only the system action HTTP route and its session-token endpoint into `src/routes/system.ts`, with dependencies for the action executor and token. Keep global runtime/origin middleware in place and preserve endpoint names. Verify token rejection, invalid payloads, and successful dispatch through a fake executor before proceeding to Gmail routes.

Defer folder-wide renaming, a new planner framework, duplicate policy layers, and new capabilities until these ownership changes are verified. This plan is an incremental reliability refactor, not a rewrite.
