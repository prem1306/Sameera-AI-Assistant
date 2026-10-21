# Plugins and MCP in Sameera for Windows

Open the plug icon in the top toolbar, labelled **Plugins & MCP connections**.

## MCP servers

1. Save a named remote Streamable HTTP URL or a local executable with its JSON argument array.
2. For a remote server requiring a bearer token, choose **Add token**, enter the token, and save it. Tokens are encrypted with Windows DPAPI in the current user's data folder and never stored in SQLite or shipped in installers.
3. Choose **Connect**. For local servers, this starts the specified executable. Install any required Node/Python runtime and server separately. Local subprocesses receive a restricted environment rather than Sameera's Gemini key.
4. Expand discovered tools and enable those you want Sameera to use. Every new tool starts disabled. Permissions persist across restarts; reconnect explicitly after restarting Sameera.
5. Ask Sameera by voice to use a connected tool. An explicit instruction such as **“Use Microsoft Learn to find Python documentation”** or **“Run microsoft_docs_search for Python virtual environments”** authorizes the named enabled tool or connection for that request. Sameera can execute each matching tool once without a second approval. Authorization comes from fresh user transcription, expires after two minutes, and resets on new speech. Ambiguous, quoted, negative, or unsupported phrasing falls back to review.

When Sameera chooses a tool itself without your explicit instruction, review the exact tool and arguments in the panel, then approve or cancel. Manually prepared test requests also require review. Disabled tools remain unavailable in both cases. The active voice session receives confirmed execution results; Activity records completed calls.

Each approval is valid for one exact call and expires after two minutes. Repeated approval of the same request does not execute it twice. A disabled tool or connection is rejected again at execution time. Network failures are reported as uncertain completion, with no automatic retry of the operation.

**Prepare a test** allows testing a selected tool with JSON arguments before using voice. This also requires review and approval.

## Plugins

Plugins in this version are data-only MCP connection presets. Import a JSON file or paste its contents in the **Plugins** section. Review its displayed endpoint or executable, then choose **Add as MCP server**. Importing alone never launches a process, connects to a service, or enables tools.

Preset format:

```json
{
  "version": 1,
  "name": "My MCP server",
  "description": "Tools provided by my server",
  "connection": {
    "transport": "http",
    "url": "https://your-server.example/mcp",
    "allowLocalhost": false
  }
}
```

For a local preset, replace `connection` with an object containing `transport: "stdio"`, `command` (absolute executable path), and `args` (array of strings). Do not include secrets in preset files, executable arguments, or URLs. Add remote tokens separately through the panel.

The example endpoint must be replaced with a real MCP server URL. Codex plugins and arbitrary executable extensions cannot be imported directly.

## Current compatibility

- Remote Streamable HTTP; HTTPS endpoints or explicitly enabled localhost HTTP endpoints.
- Bearer-token authentication or unauthenticated servers. OAuth sign-in is not implemented yet.
- Local stdio servers launched from an absolute executable path without a shell. Custom secret environment variables are not implemented yet.
- Discovered tools with supported JSON Schema arguments; at most 100 tools per connection. Incompatible schemas fail WHuconnection rather than allowing unchecked execution.
- MCP tools only; server resources, prompts, sampling, and MCP Apps are outside this version.
- Desktop only. The public web app cannot access local connections or credentials.

## Storage and diagnostics

Connections, permissions, and imported presets use the per-user SQLite database. **Activity** shows the latest 30 tool events, including failures and uncertain results. The database keeps at most 500 events, with tool names/status/timing only; arguments, results, and conversations are not persisted there.

Encrypted tokens live in `data/connection-credentials` beside the database. Disconnecting keeps configuration and permissions. Removing a connection deletes its saved token and permissions. Removing a preset does not remove connections already created from it.

Sameera closes the MCP processes it owns on orderly shutdown. Tool execution is not automatically resumed after an app restart.

The official MCP SDK is used for transport and protocol handling: https://ts.sdk.modelcontextprotocol.io/client
