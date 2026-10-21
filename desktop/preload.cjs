const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sameeraSetup', {
  useLocalOnly: () => ipcRenderer.invoke('sameera:use-local-only'),
  saveKey: (key) => ipcRenderer.invoke('sameera:save-key', key),
  keyStatus: () => ipcRenderer.invoke('sameera:key-status'),
  useSavedKey: () => ipcRenderer.invoke('sameera:use-saved-key'),
});

contextBridge.exposeInMainWorld('sameeraDesktop', {
  sessionToken: () => ipcRenderer.invoke('sameera:desktop-session'),
});
