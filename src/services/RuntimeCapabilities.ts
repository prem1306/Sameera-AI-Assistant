export type Capabilities = { mode: string; label: string; windowsControls: boolean; gmailBridge: boolean; voice: boolean; browsing: boolean; ready: boolean };
let state: Capabilities = { mode: 'web', label: 'Sameera', windowsControls: false, gmailBridge: false, voice: true, browsing: true, ready: false };
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const runtimeCapabilities = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  load: () => loading ||= fetch('/api/capabilities', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error('Could not load Sameera capabilities.');
    const data = await response.json();
    state = { ...state, mode: data.mode, label: data.label, windowsControls: data.windowsControls === true, gmailBridge: data.gmailBridge === true, ready: true };
    listeners.forEach((listener) => listener());
  }).catch(() => { loading = undefined; }),
};
