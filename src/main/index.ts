import path from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { registerIpcHandlers } from './ipc';
import { installApplicationMenu } from './menu';
import { createMainWindow } from './windows/mainWindow';
import { createSplashWindow } from './windows/splashWindow';
import { runUiSmokeTest } from './smokeTest';

const MINIMUM_SPLASH_DURATION_MS = 700;

const smokeDataDirectory = process.env.MDPAD_UI_SMOKE_DATA_DIR;
if (
  process.env.MDPAD_UI_SMOKE === '1' &&
  smokeDataDirectory &&
  path.isAbsolute(smokeDataDirectory)
) {
  app.setPath('userData', smokeDataDirectory);
}

// Single instance: a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // Enforce Chromium sandboxing application-wide before Electron is ready.
  app.enableSandbox();

  let mainWindow: BrowserWindow | null = null;

  const openMainWindow = (showSplash = false): BrowserWindow => {
    const splash = showSplash ? createSplashWindow() : null;
    const splashStartedAt = Date.now();
    const pending = { window: null as BrowserWindow | null };
    const revealMainWindow = (): void => {
      const reveal = (): void => {
        if (splash && !splash.isDestroyed()) splash.destroy();
        if (pending.window && !pending.window.isDestroyed()) {
          pending.window.show();
          pending.window.focus();
        }
      };
      const remaining = splash
        ? Math.max(0, MINIMUM_SPLASH_DURATION_MS - (Date.now() - splashStartedAt))
        : 0;
      if (remaining > 0) setTimeout(reveal, remaining);
      else reveal();
    };
    const window = createMainWindow({ onReadyToShow: revealMainWindow });
    pending.window = window;
    runUiSmokeTest(window);
    mainWindow = window;
    installApplicationMenu(window);
    window.once('closed', () => {
      if (splash && !splash.isDestroyed()) splash.destroy();
      if (mainWindow === window) mainWindow = null;
    });
    return window;
  };

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      openMainWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    // A local Markdown editor needs no browser permissions.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);

    registerIpcHandlers();
    openMainWindow(process.env.MDPAD_UI_SMOKE !== '1');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        openMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
