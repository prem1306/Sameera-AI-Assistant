/** Credentials are available only to the trusted desktop main frame through isolated IPC. */
export async function desktopSessionToken(): Promise<string> {
  const bridge = (globalThis as typeof globalThis & { window?: { sameeraDesktop?: { sessionToken(): Promise<string> } } }).window?.sameeraDesktop;
  if (!bridge) throw new Error('PC controls require the Sameera desktop app.');
  const token = await bridge.sessionToken();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Desktop session unavailable. Restart Sameera.');
  return token;
}
