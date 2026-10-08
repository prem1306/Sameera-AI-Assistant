const { app, BrowserWindow, Menu, dialog, shell, ipcMain, safeStorage, utilityProcess } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { isExternalUrl, isAppUrl } = require('./policy.cjs');
const { createLogger } = require('./logging.cjs');
const log = createLogger(app.getPath('userData'));
process.stdout.on('error', (error) => log(`Desktop output stream: ${error.code || error.message}`));
process.stderr.on('error', (error) => log(`Desktop diagnostic stream: ${error.code || error.message}`));

let mainWindow;
let setupWindow;
let backend;
let quitting = false;
let starting = false;
const port = 3001;
const origin = `http://127.0.0.1:${port}`;
const smoke = process.argv.includes('--smoke-test');
const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..', 'build', 'desktop-app');
const nativeRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : appRoot;
const credentialFile = () => path.join(app.getPath('userData'), 'gemini-key.bin');

function smokeResult(data) {
  if (!smoke) return;
  const result = { ...data, packaged: app.isPackaged, origin };
  if (process.env.SAMEERA_SMOKE_RESULT) fs.writeFileSync(process.env.SAMEERA_SMOKE_RESULT, JSON.stringify(result, null, 2));
  log(`SAMEERA_DESKTOP_SMOKE ${JSON.stringify(result)}`);
}
function readKey() {
  if (fs.existsSync(credentialFile())) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    return safeStorage.decryptString(fs.readFileSync(credentialFile()));
  }
  if (!app.isPackaged) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    const envFile = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envFile)) {
      const match = fs.readFileSync(envFile, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
      if (match) return match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return '';
}
function external(url) {
  if (isExternalUrl(url)) void shell.openExternal(url).catch(() => {});
}
function protectWindow(window, allowed) {
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) { event.preventDefault(); external(url); } });
  window.webContents.on('will-redirect', (event, url) => { if (!allowed(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}
async function showSetup() {
  if (setupWindow) { setupWindow.focus(); return; }
  setupWindow = new BrowserWindow({ width: 560, height: 580, resizable: false, title: 'Sameera setup', backgroundColor: '#090e19',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  setupWindow.removeMenu();
  protectWindow(setupWindow, () => false);
  setupWindow.on('closed', () => { setupWindow = null; });
  await setupWindow.loadFile(path.join(__dirname, 'setup.html'));
}
async function startBackend(key) {
  const workingFolder = path.join(app.getPath('documents'), 'Sameera');
  fs.mkdirSync(workingFolder, { recursive: true });
  backend = utilityProcess.fork(path.join(appRoot, 'server.mjs'), [], {
    cwd: workingFolder, serviceName: 'Sameera local server', stdio: 'pipe',
    env: { ...process.env, SAMEERA_MODE: 'desktop', NODE_ENV: 'production', PORT: String(port), GEMINI_API_KEY: key, SAMEERA_APP_ROOT: appRoot, SAMEERA_NATIVE_ROOT: nativeRoot },
  });
  backend.stdout.on('data', (data) => log(data.toString()));
  // Only local server diagnostics, never an environment dump or API key.
  backend.stderr.on('data', (data) => log(data.toString()));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The local server did not start within 30 seconds.')), 30000);
    backend.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`The local server stopped (${code}). Check whether port ${port} is already in use.`)); });
    backend.on('message', (message) => { if (message?.type === 'ready' && message.port === port) { clearTimeout(timeout); resolve(); } });
  });
  backend.on('exit', () => { if (!quitting) { dialog.showErrorBox('Sameera server stopped', 'Close and reopen Sameera to reconnect.'); app.quit(); } });
}
async function openApp(key) {
  await startBackend(key);
  mainWindow = new BrowserWindow({ width: 1180, height: 820, minWidth: 720, minHeight: 600, title: 'Sameera', show: false, backgroundColor: '#090e19',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  protectWindow(mainWindow, (url) => isAppUrl(url, origin));
  const session = mainWindow.webContents.session;
  let microphoneAllowed = false;
  session.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
    if (contents !== mainWindow?.webContents || !isAppUrl(requestingOrigin, origin)) return false;
    if (permission === 'media') return microphoneAllowed && details.mediaType === 'audio';
    return permission === 'clipboard-sanitized-write';
  });
  session.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== mainWindow?.webContents || !isAppUrl(details.requestingUrl || contents.getURL(), origin)) return callback(false);
    if (permission === 'clipboard-sanitized-write') return callback(true);
    if (permission !== 'media' || !details.mediaTypes?.length || details.mediaTypes.some((type) => type !== 'audio')) return callback(false);
    if (!microphoneAllowed) {
      const choice = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Microphone access', message: 'Allow Sameera to use your microphone for this voice session?', detail: 'Voice audio is sent to Google AI while a session is active.', buttons: ['Allow microphone', 'Cancel'], defaultId: 1, cancelId: 1 });
      microphoneAllowed = choice.response === 0;
    }
    callback(microphoneAllowed);
  });
  mainWindow.once('ready-to-show', () => { if (!smoke) mainWindow.show(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  if (smoke) mainWindow.webContents.on('render-process-gone', (_event, details) => { smokeResult({ success: false, reason: details.reason }); backend?.kill(); app.exit(1); });
  await mainWindow.loadURL(origin);
  if (smoke) {
    const response = await fetch(`${origin}/api/health`);
    const health = await response.json();
    const nativeScriptExists = ['windows-actions.ps1', 'windows-apps.ps1', 'WindowsAudio.cs'].every((file) => fs.existsSync(path.join(nativeRoot, 'scripts', file)));
    const extensionExists = fs.existsSync(path.join(nativeRoot, 'chrome-extension', 'manifest.json'));
    smokeResult({ success: response.ok && health.status === 'ok' && nativeScriptExists && extensionExists, pageLoaded: true, backendHealthy: health.status === 'ok', hasApiKey: health.hasApiKey, nativeScriptExists, extensionExists });
    app.quit();
  }
}

ipcMain.handle('sameera:save-key', async (event, value) => {
  if (!setupWindow || event.sender !== setupWindow.webContents || event.senderFrame !== setupWindow.webContents.mainFrame) return { success: false, message: 'Open the Sameera setup window to change your key.' };
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(key)) return { success: false, message: 'Paste a valid Gemini API key.' };
  if (!safeStorage.isEncryptionAvailable()) return { success: false, message: 'Windows credential encryption is unavailable. The key was not saved.' };
  try {
    fs.writeFileSync(credentialFile(), safeStorage.encryptString(key));
    setTimeout(async () => {
      if (backend) { app.relaunch(); app.quit(); }
      else { starting = true; setupWindow?.close(); try { await openApp(key); } catch (error) { dialog.showErrorBox('Sameera could not start', error.message); app.quit(); } finally { starting = false; } }
    }, 100);
    return { success: true };
  } catch { return { success: false, message: 'Could not save the key. Check your Windows user folder permissions.' }; }
});
app.on('before-quit', () => { quitting = true; backend?.kill(); });
app.on('window-all-closed', () => { if (!starting) app.quit(); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const window = mainWindow || setupWindow; if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.sameera.assistant');
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'App', submenu: [{ label: 'Gemini key settings…', click: showSetup }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    ]));
    try {
      const key = readKey();
      if (key || smoke) await openApp(key);
      else await showSetup();
    } catch (error) { smokeResult({ success: false, error: error.message }); if (!smoke) dialog.showErrorBox('Sameera could not start', error.message); backend?.kill(); app.exit(1); }
  });
}
