const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeClient: () => ipcRenderer.send('close-client'),
    onTogglePassthrough: (callback) => ipcRenderer.on('passthrough-toggled', (_event, value) => callback(value)),
    onClearData: (callback) => ipcRenderer.on('clear-data', () => callback()),
    saveScreenshot: (base64Data) => ipcRenderer.send('save-screenshot', base64Data),
});
