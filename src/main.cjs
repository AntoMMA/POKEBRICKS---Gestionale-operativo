const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');

let win;
const dataFile = () => path.join(app.getPath('userData'), 'pokebricks-data.json');
const initial = { schemaVersion: 1, settings: { shopName: 'POKEBRICKS', currency: 'EUR', accent: '#e24842', lowStockThreshold: 2 }, products: [], sales: [], documents: [], updatedAt: new Date().toISOString() };
function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    // Forward-compatible merge: unknown fields and existing records are retained through app updates.
    return { ...initial, ...parsed, settings: { ...initial.settings, ...(parsed.settings || {}) }, products: parsed.products || [], sales: parsed.sales || [], documents: parsed.documents || [] };
  } catch { return initial; }
}
function writeStore(data) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...data, schemaVersion: 1, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
  return true;
}
function restoreStore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings) || !Array.isArray(data.products) || !Array.isArray(data.sales) || !Array.isArray(data.documents) || ![...data.products, ...data.sales, ...data.documents].every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    throw new Error('Il file non è un backup POKEBRICKS valido.');
  }
  const file = dataFile();
  if (fs.existsSync(file)) {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-');
    fs.copyFileSync(file, path.join(backupDir, `prima-del-ripristino-${stamp}.json`));
  }
  return writeStore(data);
}
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1120, minHeight: 720, backgroundColor: '#f5f6f8', title: 'POKEBRICKS - Gestionale operativo', icon: path.join(__dirname, '..', 'assets', 'pokebricks.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
}
app.whenReady().then(() => {
  ipcMain.handle('store:load', () => readStore());
  ipcMain.handle('store:save', (_event, data) => writeStore(data));
  ipcMain.handle('store:restore', (_event, data) => restoreStore(data));
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('document:print', async (event, html) => {
    if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('Documento non valido o troppo grande per la stampa.');
    const parent = BrowserWindow.fromWebContents(event.sender);
    const printWindow = new BrowserWindow({ width: 800, height: 1000, show: false, ...(parent ? { parent } : {}), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      return await new Promise(resolve => {
        printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          resolve({ success, reason: failureReason || '' });
          if (!printWindow.isDestroyed()) printWindow.close();
        });
      });
    } catch (error) {
      if (!printWindow.isDestroyed()) printWindow.close();
      throw new Error(`Impossibile preparare il documento per la stampa: ${error.message}`);
    }
  });
  createWindow();
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => win?.webContents.send('update:status', { state: 'checking' }));
    autoUpdater.on('update-available', info => win?.webContents.send('update:status', { state: 'available', version: info.version, releaseNotes: info.releaseNotes }));
    autoUpdater.on('update-not-available', () => win?.webContents.send('update:status', { state: 'current' }));
    autoUpdater.on('download-progress', p => win?.webContents.send('update:progress', { percent: Math.round(p.percent), transferred: p.transferred, total: p.total }));
    autoUpdater.on('update-downloaded', info => win?.webContents.send('update:status', { state: 'downloaded', version: info.version, releaseNotes: info.releaseNotes }));
    autoUpdater.on('error', error => win?.webContents.send('update:status', { state: 'error', message: error.message }));
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
ipcMain.on('update:install', () => {
  try {
    const source = dataFile();
    if (fs.existsSync(source)) {
      const folder = path.join(app.getPath('userData'), 'backups');
      fs.mkdirSync(folder, { recursive: true });
      fs.copyFileSync(source, path.join(folder, `before-update-${new Date().toISOString().replaceAll(':','-')}.json`));
    }
  } catch (error) { win?.webContents.send('update:status', { state: 'error', message: `Backup prima dell’aggiornamento non riuscito: ${error.message}` }); return; }
  autoUpdater.quitAndInstall(false, true);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
