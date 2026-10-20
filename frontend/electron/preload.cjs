// Runs in an isolated context. Only the functions listed here are visible to the web page.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  chooseSyncFolder: () => ipcRenderer.invoke('sync:choose'),
  startSync: (dir) => ipcRenderer.invoke('sync:start', dir),
  stopSync: () => ipcRenderer.invoke('sync:stop'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  onSyncFile: (cb) => {
    const handler = (_event, file) => cb(file)
    ipcRenderer.on('sync:file', handler)
    return () => ipcRenderer.removeListener('sync:file', handler)
  },
})
