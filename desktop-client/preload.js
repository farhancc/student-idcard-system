const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePdfLocally: (fileName, base64Data) => 
    ipcRenderer.invoke('save-pdf', { fileName, base64Data }),
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
});

