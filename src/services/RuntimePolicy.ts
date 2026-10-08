export const DESKTOP_TOOLS = new Set(['performSystemAction', 'getGmailDraft', 'draftGmailMail', 'requestGmailSend']);
export function runtimePolicy(env: Record<string, string | undefined>, platform = process.platform) {
  const mode = env.SAMEERA_MODE || (platform === 'win32' ? 'local' : 'web');
  if (!['web', 'local', 'desktop'].includes(mode)) throw new Error('SAMEERA_MODE must be web, local or desktop.');
  const windowsControls = mode !== 'web' && platform === 'win32';
  return { mode, windowsControls, gmailBridge: windowsControls, voice: true, browsing: true, label: mode === 'web' ? 'Sameera Web' : 'Sameera for Windows' };
}
export function requestAllowed(host: string, origin: string | undefined, web: boolean, port: number, domains = '') {
  const locals = [`localhost:${port}`, `127.0.0.1:${port}`];
  if (!web) return locals.includes(host) && (!origin || [`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin));
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return false;
  const allowed = domains.split(',').map((value) => value.trim()).filter(Boolean);
  if (allowed.length && !locals.includes(host) && !allowed.includes(host)) return false;
  if (!origin) return true;
  try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && url.host === host && !url.username && !url.password; } catch { return false; }
}
export function toolsForMode<T extends { name: string }>(tools: T[], windowsControls: boolean): T[] {
  return windowsControls ? tools : tools.filter((tool) => !DESKTOP_TOOLS.has(tool.name));
}
