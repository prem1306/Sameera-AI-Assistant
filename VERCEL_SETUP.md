# Publish Sameera on Vercel

This checkout includes a Vite frontend and an HTTP server function for the API and `/live` voice WebSocket. Vercel's WebSocket support is in beta and requires Fluid compute, enabled by default for new projects. Keep Fluid compute enabled in project settings.

1. Import this repository into your Vercel account, or deploy this checkout using the Vercel CLI. Use Node.js 24. The included `vercel.json` configures installation, build, and routing.
2. Add `GEMINI_API_KEY` directly in Vercel's environment variables for the deployment environment. Use a Google AI key with Gemini Live access. Local `.env` files are excluded from deployment; never put the key in a frontend variable.
3. Deploy and check `/api/health` and `/api/capabilities`. Capabilities must report `mode: "web"`, `windowsControls: false`, and `gmailBridge: false`.
4. Open the published HTTPS URL, allow microphone access, and test a voice conversation. A missing key is reported by the health endpoint and prevents voice conversation and AI article search.

Vercel function duration limits also apply to WebSockets. The function is configured for 300 seconds; the client already reconnects with its conversation context when a connection closes. The existing four-session limit is per function instance, rather than a global quota across Vercel instances. Visitors use the deployment's Gemini quota.

The Windows desktop application and Replit launcher retain their existing startup paths. On Vercel, the server exports its HTTP/WebSocket handler without opening a local port and forces web mode.

References: [WebSockets on Vercel](https://vercel.com/docs/functions/websockets), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
