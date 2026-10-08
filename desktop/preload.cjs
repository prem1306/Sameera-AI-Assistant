const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sameeraSetup', {
  saveKey: (key) => ipcRenderer.invoke('sameera:save-key', key),
});
