import path from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { markdownFilePathsFromArguments } from './launch/arguments';
import { openLaunchFileForContents, registerIpcHandlers } from './ipc';
import { IPC } from '../shared/constants';
import { installApplicationMenu } from './menu';
import { createMainWindow } from './windows/mainWindow';
import { createSplashWindow } from './windows/splashWindow';
import { runUiSmokeTest } from './smokeTest';
import { initializeAutoUpdates } from './update/updateService';

const MINIMUM_SPLASH_DURATION_MS = 700;
const launchFileQueue = markdownFilePathsFromArguments(process.argv, process.cwd());

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
  let rendererReadyForLaunchFiles = false;
  let flushingLaunchFiles = false;

  const flushLaunchFileQueue = async (): Promise<void> => {
    const targetWindow = mainWindow;
    if (
      flushingLaunchFiles ||
      !rendererReadyForLaunchFiles ||
      !targetWindow ||
      targetWindow.isDestroyed()
    ) {
      return;
    }

    flushingLaunchFiles = true;
    try {
      while (launchFileQueue.length > 0) {
        const launchPath = launchFileQueue.shift();
        if (!launchPath) continue;
        const result = await openLaunchFileForContents(targetWindow.webContents, launchPath);
        if (
          targetWindow.isDestroyed() ||
          targetWindow.webContents.isDestroyed() ||
          mainWindow !== targetWindow
        ) {
          launchFileQueue.unshift(launchPath);
          break;
        }
        targetWindow.webContents.send(IPC.appOpenFile, result);
      }
    } finally {
      flushingLaunchFiles = false;
    }
  };

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
    rendererReadyForLaunchFiles = false;
    runUiSmokeTest(window);
    mainWindow = window;
    installApplicationMenu(window);
    window.webContents.once('did-finish-load', () => {
      if (mainWindow !== window || window.isDestroyed()) return;
      rendererReadyForLaunchFiles = true;
      void flushLaunchFileQueue();
    });
    window.once('closed', () => {
      if (splash && !splash.isDestroyed()) splash.destroy();
      if (mainWindow === window) {
        mainWindow = null;
        rendererReadyForLaunchFiles = false;
      }
    });
    return window;
  };

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    launchFileQueue.push(...markdownFilePathsFromArguments(commandLine, workingDirectory));
    if (!mainWindow || mainWindow.isDestroyed()) {
      openMainWindow();
      return;
    }
    void flushLaunchFileQueue();
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
    initializeAutoUpdates();
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
