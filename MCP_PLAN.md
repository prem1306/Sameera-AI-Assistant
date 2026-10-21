# Sameera MCP and plugin connection plan

Status: the first desktop implementation supports remote Streamable HTTP, Windows-encrypted bearer tokens, local stdio connections, disabled-by-default tool permissions, reviewed tool execution, voice discovery/calls, and data-only plugin presets. See `MCP_SETUP.md` for actual supported behavior. OAuth, web accounts, and a marketplace remain future work. The detailed design below describes the broader intended roadmap; the first version uses generic model discovery/call tools instead of registering every remote schema directly with Gemini.

## Intended experience

In Sameera for Windows, open Connections, add an MCP server, authenticate if required, review its tools, and enable the tools you want. Ask Sameera by voice to use the connected service. See the actual tool result or a clear error. Connections persist across app restarts and can be disabled or removed.

Build MCP connections first. A Sameera plugin initially means a named connection preset containing server details and suggested tool permissions. Installing arbitrary extension code or importing Codex plugins is outside the initial scope.

## Scope and delivery order

1. Remote MCP: HTTPS Streamable HTTP connections using the official TypeScript SDK, tool discovery, tool calls, connection state, individual tool toggles, and persistence. Support unauthenticated test servers, user-provided tokens, and OAuth where required. Pin a released SDK and test its negotiated protocol compatibility; do not implement draft protocol changes by hand.
2. Voice integration: expose enabled tools to Gemini using schema conversion and collision-free names; route calls to the MCP execution service; return structured results to the current live session. Rebuild the tool snapshot when connections change, restarting the live session only at a safe boundary with a visible status. Disablement and permission changes take effect at execution time even if Gemini still has an older snapshot.
3. Desktop connections UI: add/edit, authenticate, test, inspect tools, enable/disable, disconnect/remove, and inspect redacted diagnostics. Show missing credentials and expired authentication separately from service outages.
4. Local MCP: stdio subprocesses with explicit executable and argument fields, user-reviewed launch settings, dedicated environment variables, and graceful shutdown. Do not accept executable commands from the voice model. Inspect required runtimes before launching; third-party servers may require Node, Python, or separately installed software even though Sameera itself does not.
5. Plugin presets: a versioned data-only manifest with name, description, transport, server configuration, required credentials, and suggested permissions. User reviews the resolved endpoint or executable before connection. No automatic arbitrary package installation.

Desktop is the initial target. Public web MCP configuration remains disabled until user accounts, per-user credentials, and per-user sessions are implemented; shared production credentials must not become every visitor's connections.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `src/services/mcp/types.ts` | Connection configuration, status, tool descriptors, execution results |
| `src/services/mcp/ConnectionManager.ts` | Connect/disconnect/reconnect, client ownership, lifecycle |
| `src/services/mcp/transports/HttpTransport.ts` | Remote transport construction and endpoint validation |
| `src/services/mcp/transports/StdioTransport.ts` | Local transport, process settings and cleanup |
| `src/services/mcp/AuthManager.ts` | OAuth state, PKCE, callback handling, refresh and sign-out |
| `desktop/connection-secrets.cjs` | Windows-encrypted per-connection secret storage; narrow IPC interface |
| `src/services/database/ConnectionRepository.ts` (planned) | Non-secret connection records using the shared local SQLite database |
| `src/services/mcp/ToolRegistry.ts` | Discovery, namespacing, schema conversion and compatibility reporting |
| `src/services/mcp/ToolExecutor.ts` | Permission checks, validation, deadlines, cancellation and results |
| `src/services/mcp/PermissionPolicy.ts` | Enabled tools and configured confirmation rules |
| `src/services/mcp/Diagnostics.ts` | Per-connection redacted events and actionable errors |
| `src/routes/mcp.ts` | Desktop-local authenticated connection management endpoints |
| `src/components/connections/` | Connections screen and tool permission controls |
| `src/services/plugins/PluginManifest.ts` | Validate connection presets; no executable extension loading |

`server.ts` composes these services and integrates their tool declarations into Gemini sessions. Existing Word and Notepad modules retain their own behavior. `ToolManager` forwards MCP requests through the local authenticated gateway rather than holding MCP credentials in browser storage.

## Request flow

Voice request → Gemini selects an enabled namespaced tool → local gateway checks session and connection permissions → ToolExecutor validates arguments and calls the correct MCP client → structured MCP result returns to Gemini → Sameera reports the verified result.

The gateway owns authorization and execution. A tool description or model-generated argument cannot enable a disabled tool or change connection settings. Treat tool output as untrusted content, not new instructions. Unsupported JSON Schema features cause an explicit compatibility error rather than silently weakened validation.

## Credentials and execution behavior

- Reuse the existing Windows encryption approach for connection credentials, separately from the Gemini key. Store no secrets in source, installers, plain configuration, logs, browser storage, or diagnostic exports.
- Use OAuth through the external browser with state/PKCE and a verified callback where supported. Preserve SDK token/issuer information, isolate credentials per connection, and expose connection status without exposing tokens.
- Local gateway endpoints retain Sameera's origin and local-token checks. Default remote transport uses HTTPS. Any localhost exception must be explicit and cannot authorize arbitrary private-network access or redirects.
- Select tools explicitly. Configure confirmation rules for sending, deleting, purchasing, or other consequential operations; do not rely only on server-provided tool annotations to establish trust.
- Preserve repeated-call protection, but never assume a repeated network request is idempotent. Do not retry ambiguous tool writes after a timeout. Report uncertain completion and inspect state when supported.
- Bound discovered tools, schema size, arguments, output, concurrency, and execution time. Keep cancellation tied to the live session; distinguish cancellation requests from confirmed cancellation of external work.
- Reconnect the transport where appropriate, without automatically repeating an interrupted write. Closing Sameera shuts down only processes it owns.

## Verification and acceptance

Use a controlled MCP test server with read-only tools and a reversible write tool. Verify discovery, schema conversion, disabled-tool rejection, duplicate calls, credentials, expired auth, cancellation, disconnects, timeouts, and redacted diagnostics.

Verify the complete simulated voice flow: connect → enable tool → request by voice → execute → return result → spoken acknowledgement. Test a deliberate tool failure and ensure Sameera does not claim completion. Keep Word, Notepad, saved Gemini credentials, and web-mode restrictions passing existing regression checks.

Create a new desktop installer and test it on a Windows user profile without the source repository. Verify configuration survives restart and the installer contains no personal secrets. Document optional local-server runtime requirements.

## References

- Official MCP TypeScript client documentation: https://ts.sdk.modelcontextprotocol.io/client
- Released transport specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

The exact supported SDK/protocol versions will be selected and pinned during implementation, based on released compatibility.
