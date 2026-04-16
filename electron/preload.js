const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAlarms: () => ipcRenderer.invoke('get-alarms'),
  saveAlarms: (alarms) => ipcRenderer.invoke('save-alarms', alarms),
  selectRingtone: () => ipcRenderer.invoke('select-ringtone'),
  getFileUrl: (p) => ipcRenderer.invoke('get-file-url', p),
  getFileDataUrl: (p) => ipcRenderer.invoke('get-file-data-url', p),
  getVolume: () => ipcRenderer.invoke('get-volume'),
  saveVolume: (volume) => ipcRenderer.invoke('save-volume', volume),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowHide: () => ipcRenderer.invoke('window-hide'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  showWindow: () => ipcRenderer.invoke('show-window'),
});
