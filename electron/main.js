const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const { pathToFileURL } = require('url');

const store = new Store({
  defaults: {
    alarms: [],
    settings: {
      defaultRingtone: '',
      volume: 0.8,
    }
  }
});

let mainWindow = null;
let tray = null;
let isQuitting = false;

// #4 fix: restrict file access to audio extensions only
const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4']);

function isAllowedAudioFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return ALLOWED_AUDIO_EXTENSIONS.has(ext);
}

// #5 fix: validate alarm data structure before saving
const VALID_RECURRENCES = new Set(['once', 'daily', 'legalWorkday', 'legalHoliday', 'weekdays']);

function validateAlarm(alarm) {
  if (!alarm || typeof alarm !== 'object') return false;
  if (typeof alarm.id !== 'string' || !alarm.id) return false;
  if (typeof alarm.time !== 'string' || !/^\d{2}:\d{2}$/.test(alarm.time)) return false;
  if (typeof alarm.label !== 'string') return false;
  if (typeof alarm.enabled !== 'boolean') return false;
  if (typeof alarm.durationMinutes !== 'number' || alarm.durationMinutes < 1 || alarm.durationMinutes > 1440) return false;
  if (!VALID_RECURRENCES.has(alarm.recurrence || 'once')) return false;
  return true;
}

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(__dirname, '../public/icon.svg'),
    path.join(__dirname, '../dist/icon.svg'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function loadTrayImage() {
  const iconPath = resolveIconPath();
  if (!iconPath) return nativeImage.createEmpty();

  if (iconPath.toLowerCase().endsWith('.svg')) {
    try {
      const svg = fs.readFileSync(iconPath, 'utf8');
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const img = nativeImage.createFromDataURL(dataUrl);
      if (!img.isEmpty()) return img;
    } catch {
      // fall through
    }
  }

  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return nativeImage.createEmpty();
  }
}

function createWindow() {
  const iconPath = resolveIconPath();
  const isSvgIcon = !!iconPath && iconPath.toLowerCase().endsWith('.svg');
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    ...(iconPath && !isSvgIcon ? { icon: iconPath } : {}),
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const img = loadTrayImage();
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出简钟',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('简钟');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC 通信处理
ipcMain.handle('get-alarms', () => {
  return store.get('alarms');
});

// #5 fix: validate before saving
ipcMain.handle('save-alarms', (event, alarms) => {
  if (!Array.isArray(alarms)) return false;
  const valid = alarms.filter(validateAlarm);
  store.set('alarms', valid);
  return true;
});

ipcMain.handle('select-ringtone', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择铃声文件',
    properties: ['openFile'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// #4 fix: validate file is an allowed audio type before returning URL
ipcMain.handle('get-file-url', (event, filePath) => {
  try {
    if (!filePath) return null;
    if (!isAllowedAudioFile(filePath)) return null;
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(app.getAppPath(), filePath);
    if (!fs.existsSync(resolved)) return null;
    return pathToFileURL(resolved).href;
  } catch (e) {
    console.error('get-file-url error:', e);
    return null;
  }
});

// #4 fix: validate file is an allowed audio type before reading
ipcMain.handle('get-file-data-url', async (event, filePath) => {
  try {
    if (!filePath) return null;
    if (!isAllowedAudioFile(filePath)) return null;
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(app.getAppPath(), filePath);
    if (!fs.existsSync(resolved)) return null;
    const buf = fs.readFileSync(resolved);
    const ext = path.extname(resolved).slice(1).toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === 'mp3') mime = 'audio/mpeg';
    else if (ext === 'wav') mime = 'audio/wav';
    else if (ext === 'ogg') mime = 'audio/ogg';
    else if (ext === 'm4a' || ext === 'mp4') mime = 'audio/mp4';
    else if (ext === 'flac') mime = 'audio/flac';
    const data = `data:${mime};base64,${buf.toString('base64')}`;
    return data;
  } catch (e) {
    console.error('get-file-data-url error:', e);
    return null;
  }
});

// #7 fix: volume persistence IPC
ipcMain.handle('get-volume', () => {
  return store.get('settings.volume', 0.8);
});

ipcMain.handle('save-volume', (event, volume) => {
  if (typeof volume === 'number' && volume >= 0 && volume <= 1) {
    store.set('settings.volume', volume);
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-hide', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('window-close', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('show-notification', (event, title, body) => {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notification.show();
  }
});

ipcMain.handle('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
