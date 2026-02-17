const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filename) => ipcRenderer.invoke('read-file', filename),
  writeFile: (filename, content) => ipcRenderer.invoke('write-file', filename, content),
  listFiles: () => ipcRenderer.invoke('list-files'),
  deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename)
});
