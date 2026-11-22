const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pokebricks', {
  load: () => ipcRenderer.invoke('store:load'),
  save: data => ipcRenderer.invoke('store:save', data),
  restore: data => ipcRenderer.invoke('store:restore', data),
  printDocument: html => ipcRenderer.invoke('document:print', html),
  version: () => ipcRenderer.invoke('app:version'),
  tiktokStatus: () => ipcRenderer.invoke('tiktok:status'),
  tiktokSave: credentials => ipcRenderer.invoke('tiktok:save', credentials),
  tiktokConnect: () => ipcRenderer.invoke('tiktok:connect'),
  tiktokSelectShop: shop => ipcRenderer.invoke('tiktok:select-shop', shop),
  tiktokAutoSync: enabled => ipcRenderer.invoke('tiktok:auto-sync', enabled),
  tiktokSync: since => ipcRenderer.invoke('tiktok:sync', since),
  tiktokClear: () => ipcRenderer.invoke('tiktok:clear'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdateStatus: fn => ipcRenderer.on('update:status', (_e, value) => fn(value)),
  onUpdateProgress: fn => ipcRenderer.on('update:progress', (_e, value) => fn(value))
});
