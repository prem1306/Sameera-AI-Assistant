# Run Sameera on Replit

Import this GitHub repository into a Replit app. Use Node.js 22.12 or newer; the included `.replit` file selects Node.js 22 and configures port 3000.

1. Add `GEMINI_API_KEY` in Replit **Secrets**, using a Google AI key with Gemini Live access. Never put the key in source code or a frontend environment variable.
2. If dependencies were not installed automatically, run `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` in the Replit shell. The Windows desktop runtime is unnecessary on Replit.
3. Press **Run**. Replit runs `npm run dev:web`; open the preview in its own browser tab and allow microphone access.
4. To publish, choose a server deployment, with build command `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && npm run build:web` and run command `npm run start:web`. Add the same secret to the published deployment. A Reserved VM is suitable for persistent voice WebSocket connections. Static publishing cannot run this backend.

The server listens on `0.0.0.0` and uses Replit's `PORT`, defaulting to 3000. Browser requests use the same website origin, including secure WebSocket connections on HTTPS. You may set `SAMEERA_ALLOWED_HOSTS` to a comma-separated list of your preview, published, and custom domain hostnames. Include every hostname you intend to use. By default, public hostnames are accepted with same-origin browser checks.

## Website versus Windows application

| Feature | Replit website | Windows application |
| --- | --- | --- |
| Voice conversation, language and theme selection | Yes | Yes |
| Public web search, article reading, videos, browser notes | Yes | Yes |
| Open/close installed applications, manage local files, Word | No | Yes |
| PC volume and supported display brightness | No | Yes |
| Gmail Chrome extension bridge | No | Yes |

Web mode is enforced by the launcher, server routes, AI tool declarations and interface. The website cannot control visitors' computers. The Windows application runs its own local server; it does not connect to the hosted website for PC actions.

Voice requires microphone permission, HTTPS (or localhost), internet access and available Google AI quota. Embedded content follows the source site's playback and embedding restrictions. Publishing the website uses the deployment's Gemini key and quota for its visitors; keep deployment access appropriate for your intended users.

Check `/api/health` and `/api/capabilities` after publishing: the latter must report `mode: "web"`, `windowsControls: false`, and `gmailBridge: false`.

Replit documentation: [project configuration](https://docs.replit.com/features/project-setup/configuration) and [publishing types](https://docs.replit.com/features/publishing/deployment-types).
