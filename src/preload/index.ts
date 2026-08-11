import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/constants';
import type { DesktopAPI } from '../shared/types/desktopApi';
import type {
  AppInfo,
  IpcResult,
  MenuAction,
  OpenedFilePayload,
  UpdateState,
} from '../shared/types';

type LaunchFileResult = IpcResult<OpenedFilePayload>;
type LaunchFileListener = (result: LaunchFileResult) => void;

// The main process can deliver a startup file as soon as the page loads. Buffer
// it in preload so React cannot miss the event before its first effect runs.
const pendingLaunchFiles: LaunchFileResult[] = [];
const launchFileListeners = new Set<LaunchFileListener>();

ipcRenderer.on(IPC.appOpenFile, (_event, result: LaunchFileResult) => {
  if (launchFileListeners.size === 0) {
    pendingLaunchFiles.push(result);
    return;
  }
  for (const listener of launchFileListeners) listener(result);
});

/**
 * Preload bridge. Runs in an isolated, sandboxed context and exposes only a
 * narrow, typed API on `window.desktopAPI`. The renderer never receives
 * direct access to ipcRenderer channels beyond these wrappers.
 */
const api: DesktopAPI = {
  openFileDialog: () => ipcRenderer.invoke(IPC.dialogOpenFile),
  readFile: (absolutePath: string) => ipcRenderer.invoke(IPC.fileRead, absolutePath),
  writeFile: (request) => ipcRenderer.invoke(IPC.fileWrite, request),
  saveAsDialog: (request) => ipcRenderer.invoke(IPC.dialogSaveAs, request),
  setDirty: (dirty: boolean) => {
    ipcRenderer.send(IPC.windowSetDirty, dirty === true);
  },
  minimizeWindow: () => ipcRenderer.invoke(IPC.windowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.windowToggleMaximize),
  closeWindow: () => ipcRenderer.invoke(IPC.windowClose),
  isWindowMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo) as Promise<AppInfo>,
  getUpdateState: () => ipcRenderer.invoke(IPC.updateGetState) as Promise<UpdateState>,
  onUpdateState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: UpdateState): void => {
      listener(state);
    };
    ipcRenderer.on(IPC.updateStateChanged, handler);
    return () => ipcRenderer.removeListener(IPC.updateStateChanged, handler);
  },
  downloadUpdate: () => ipcRenderer.invoke(IPC.updateDownload) as Promise<boolean>,
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall) as Promise<boolean>,
  onLaunchFile: (listener) => {
    launchFileListeners.add(listener);
    const waiting = pendingLaunchFiles.splice(0);
    for (const result of waiting) listener(result);
    return () => launchFileListeners.delete(listener);
  },
  onMenuAction: (listener) => {
    const allowed: readonly string[] = [
      'file:new',
      'file:open',
      'file:open-folder',
      'file:save',
      'file:save-as',
      'file:export-html',
      'file:export-pdf',
      'edit:find',
      'edit:replace',
      'view:source',
      'view:visual',
      'view:preview',
      'view:split',
      'view:toggle-theme',
      'tools:workspace-search',
      'tools:command-palette',
      'tools:preferences',
    ];
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction): void => {
      if (typeof action === 'string' && allowed.includes(action)) {
        listener(action);
      }
    };
    ipcRenderer.on(IPC.menuAction, handler);
    return () => {
      ipcRenderer.removeListener(IPC.menuAction, handler);
    };
  },
  openFolderDialog: (showAllFiles) => ipcRenderer.invoke(IPC.dialogOpenFolder, showAllFiles),
  refreshWorkspace: (rootPath, showAllFiles) =>
    ipcRenderer.invoke(IPC.workspaceRefresh, rootPath, showAllFiles),
  createWorkspaceFile: (request) => ipcRenderer.invoke(IPC.workspaceCreateFile, request),
  createWorkspaceFolder: (request) => ipcRenderer.invoke(IPC.workspaceCreateFolder, request),
  renameWorkspaceEntry: (request) => ipcRenderer.invoke(IPC.workspaceRename, request),
  moveWorkspaceEntry: (request) => ipcRenderer.invoke(IPC.workspaceMove, request),
  deleteWorkspaceEntry: (request) => ipcRenderer.invoke(IPC.workspaceDelete, request),
  duplicateWorkspaceEntry: (request) => ipcRenderer.invoke(IPC.workspaceDuplicate, request),
  revealWorkspaceEntry: (request) => ipcRenderer.invoke(IPC.workspaceReveal, request),
  searchWorkspace: (request) => ipcRenderer.invoke(IPC.workspaceSearch, request),
  onWorkspaceChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { rootPath?: unknown }).rootPath === 'string'
      ) {
        listener(value as Parameters<typeof listener>[0]);
      }
    };
    ipcRenderer.on(IPC.workspaceChanged, handler);
    return () => ipcRenderer.removeListener(IPC.workspaceChanged, handler);
  },
  confirmClose: (displayName) => ipcRenderer.invoke(IPC.dialogConfirmClose, displayName),
  getAppState: () => ipcRenderer.invoke(IPC.stateGet),
  setAppState: (state) => ipcRenderer.invoke(IPC.stateSet, state),
  listRecovery: () => ipcRenderer.invoke(IPC.recoveryList),
  saveRecovery: (entry) => ipcRenderer.invoke(IPC.recoverySave, entry),
  removeRecovery: (id) => ipcRenderer.invoke(IPC.recoveryRemove, id),
  saveAttachment: (request) => ipcRenderer.invoke(IPC.attachmentSave, request),
  readAsset: (request) => ipcRenderer.invoke(IPC.assetRead, request),
  exportHtml: (request) => ipcRenderer.invoke(IPC.exportHtml, request),
  exportPdf: (request) => ipcRenderer.invoke(IPC.exportPdf, request),
  openExternal: (url) => ipcRenderer.invoke(IPC.shellOpenExternal, url),
  readClipboardText: () => ipcRenderer.invoke(IPC.clipboardReadText),
  writeClipboardText: (text) => ipcRenderer.invoke(IPC.clipboardWriteText, text),
};

contextBridge.exposeInMainWorld('desktopAPI', api);
