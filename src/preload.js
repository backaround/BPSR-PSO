const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeClient: () => ipcRenderer.send('close-client'),
    onTogglePassthrough: (callback) => ipcRenderer.on('passthrough-toggled', (_event, value) => callback(value)),
    onClearData: (callback) => ipcRenderer.on('clear-data', () => callback()),
    saveScreenshot: (base64Data) => ipcRenderer.send('save-screenshot', base64Data),
    openSkillDetailsWindow: (userId) => ipcRenderer.send('open-skill-details-window', userId),
    closeSkillDetailsWindow: () => ipcRenderer.send('close-skill-details-window'),
    openShortcutsWindow: () => ipcRenderer.send('open-shortcuts-window'),
    closeShortcutsWindow: () => ipcRenderer.send('close-shortcuts-window'),
    getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
    saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),
    disableShortcuts: () => ipcRenderer.send('disable-shortcuts'),
    enableShortcuts: () => ipcRenderer.send('enable-shortcuts'),
});
