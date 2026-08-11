import { app, BrowserWindow, ipcMain, net, type IpcMainInvokeEvent } from 'electron';
import electronUpdater, { type AppUpdater } from 'electron-updater';
import { IPC } from '../../shared/constants';
import type { UpdateState } from '../../shared/types';
import {
  displayUpdateVersion,
  isPortableEnvironment,
  shouldCheckForUpdates,
  updateProgressPercent,
} from './updatePolicy';

const STARTUP_CHECK_DELAY_MS = 6_000;

let state: UpdateState = { phase: 'idle' };
let availableVersion: string | null = null;
let downloadRequested = false;
let initialized = false;

function updater(): AppUpdater {
  // electron-updater is CommonJS; destructuring the default import is the
  // compatibility path recommended by its TypeScript documentation.
  return electronUpdater.autoUpdater;
}

function setState(next: UpdateState): void {
  state = next;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(IPC.updateStateChanged, next);
    }
  }
}

function validateSender(event: IpcMainInvokeEvent): void {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (
    senderWindow === null ||
    senderWindow.isDestroyed() ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('Rejected updater IPC call from an unknown sender.');
  }
}

async function downloadAvailableUpdate(): Promise<boolean> {
  if (
    !availableVersion ||
    (state.phase !== 'available' && state.phase !== 'download-error') ||
    !net.isOnline()
  ) {
    return false;
  }

  downloadRequested = true;
  setState({ phase: 'downloading', version: availableVersion, percent: 0 });
  try {
    await updater().downloadUpdate();
    return true;
  } catch {
    if (availableVersion) {
      setState({ phase: 'download-error', version: availableVersion });
    }
    return false;
  }
}

function installDownloadedUpdate(): boolean {
  if (!availableVersion || state.phase !== 'ready') return false;
  const version = availableVersion;
  setState({ phase: 'installing', version });
  const timer = setTimeout(() => {
    try {
      updater().quitAndInstall(true, true);
    } catch {
      setState({ phase: 'ready', version });
    }
  }, 120);
  timer.unref();
  return true;
}

function registerUpdaterIpc(): void {
  ipcMain.handle(IPC.updateGetState, (event): UpdateState => {
    validateSender(event);
    return state;
  });
  ipcMain.handle(IPC.updateDownload, async (event): Promise<boolean> => {
    validateSender(event);
    return downloadAvailableUpdate();
  });
  ipcMain.handle(IPC.updateInstall, (event): boolean => {
    validateSender(event);
    return installDownloadedUpdate();
  });
}

function registerUpdaterEvents(): void {
  const autoUpdater = updater();
  autoUpdater.logger = null;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on('update-available', (info) => {
    availableVersion = displayUpdateVersion(info.version);
    downloadRequested = false;
    setState({ phase: 'available', version: availableVersion });
  });
  autoUpdater.on('update-not-available', () => {
    availableVersion = null;
    downloadRequested = false;
    setState({ phase: 'idle' });
  });
  autoUpdater.on('download-progress', (progress) => {
    if (!availableVersion || !downloadRequested) return;
    setState({
      phase: 'downloading',
      version: availableVersion,
      percent: updateProgressPercent(progress.percent),
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    availableVersion = displayUpdateVersion(info.version);
    downloadRequested = false;
    setState({ phase: 'ready', version: availableVersion });
  });
  autoUpdater.on('update-cancelled', () => {
    downloadRequested = false;
    if (availableVersion) setState({ phase: 'available', version: availableVersion });
  });
  autoUpdater.on('error', () => {
    if (downloadRequested && availableVersion) {
      downloadRequested = false;
      setState({ phase: 'download-error', version: availableVersion });
    } else {
      // Startup checks are intentionally silent when GitHub is unreachable.
      setState({ phase: 'idle' });
    }
  });
}

/** Register the updater and schedule one quiet, connectivity-gated startup check. */
export function initializeAutoUpdates(): void {
  if (initialized) return;
  initialized = true;
  registerUpdaterIpc();

  const runtime = {
    isPackaged: app.isPackaged,
    platform: process.platform,
    isOnline: net.isOnline(),
    isPortable: isPortableEnvironment(process.env),
    isSmokeTest: process.env.MDPAD_UI_SMOKE === '1',
  } as const;
  if (!shouldCheckForUpdates(runtime)) return;

  registerUpdaterEvents();
  const timer = setTimeout(() => {
    // Connectivity can disappear during the startup delay. Re-check locally;
    // a false value means no update request is made at all.
    if (!net.isOnline()) return;
    void updater()
      .checkForUpdates()
      .catch(() => undefined);
  }, STARTUP_CHECK_DELAY_MS);
  timer.unref();
}
