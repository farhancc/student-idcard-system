const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePdfLocally: (fileName, base64Data, clientName) => 
    ipcRenderer.invoke('save-pdf', { fileName, base64Data, clientName }),
  isDesktop: () => 
    ipcRenderer.invoke('is-desktop'),
  getPortalUrl: () => 
    ipcRenderer.invoke('get-portal-url'),
  reloadApp: () => 
    ipcRenderer.invoke('reload-app'),
  runBackup: (data) =>
    ipcRenderer.invoke('run-backup', data),
  saveTemplateImage: (data) =>
    ipcRenderer.invoke('save-template-image', data),
  getLocalTemplatePath: (data) =>
    ipcRenderer.invoke('get-local-template-path', data),
  finalizeTemplateOriginals: (data) =>
    ipcRenderer.invoke('finalize-template-originals', data),
  saveTemplateOriginal: (data) =>
    ipcRenderer.invoke('save-template-original', data),
  saveCredentials: (email, password) =>
    ipcRenderer.invoke('save-credentials', { email, password }),
  loadCredentials: () =>
    ipcRenderer.invoke('load-credentials'),
  clearCredentials: () =>
    ipcRenderer.invoke('clear-credentials'),
  // Offline print queue
  queuePrintLog: (payload) =>
    ipcRenderer.invoke('queue-print-log', { payload }),
  flushPrintQueue: (authToken) =>
    ipcRenderer.invoke('flush-print-queue', { authToken }),
  getQueueStatus: () =>
    ipcRenderer.invoke('get-queue-status'),
  saveBackupLocally: (clientName, monthName, base64ZipData) =>
    ipcRenderer.invoke('save-backup', { clientName, monthName, base64ZipData }),
  cachePhoto: (cardholderId, photoUrl) =>
    ipcRenderer.invoke('cache-photo', { cardholderId, photoUrl }),
});
