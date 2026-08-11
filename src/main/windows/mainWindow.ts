import { join } from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import { IPC } from '../../shared/constants';

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

/**
 * Track the renderer-reported dirty state so the window close can be guarded
 * against accidental loss of unsaved changes.
 */
const dirtyByWebContents = new Map<number, boolean>();

export function markDirty(webContentsId: number, dirty: boolean): void {
  dirtyByWebContents.set(webContentsId, dirty);
}

interface MainWindowOptions {
  onReadyToShow?: () => void;
}

export function createMainWindow(options: MainWindowOptions = {}): BrowserWindow {
  const icon = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1f24',
    title: 'mdPad',
    icon,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });
  // Electron destroys `window.webContents` before the BrowserWindow `closed`
  // event fires. Keep the stable numeric id while the window is still alive.
  const webContentsId = window.webContents.id;

  window.setMenuBarVisibility(false);

  window.once('ready-to-show', () => {
    if (options.onReadyToShow) options.onReadyToShow();
    else window.show();
  });

  // Guard against navigation away from the bundled application.
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Never allow the renderer to open new windows.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Warn before closing a window with unsaved changes.
  window.on('close', (event) => {
    const dirty = dirtyByWebContents.get(webContentsId) === true;
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'One or more documents have unsaved changes.',
      detail: 'Closing mdPad now will discard those changes.',
      buttons: ['Discard Changes', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (choice === 1) {
      event.preventDefault();
    }
  });

  window.on('closed', () => {
    dirtyByWebContents.delete(webContentsId);
  });

  window.webContents.on('ipc-message', (event, channel, ...args) => {
    if (
      channel === IPC.windowSetDirty &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    ) {
      markDirty(webContentsId, args[0] === true);
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
