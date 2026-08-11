import path from 'node:path';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import { IPC } from '../../shared/constants';
import type {
  AppInfo,
  AssetReadResult,
  CloseDecision,
  FileErrorPayload,
  IpcResult,
  OpenedFilePayload,
  SaveFileResult,
  WorkspaceChangeEvent,
  WorkspacePayload,
  WorkspaceSearchResult,
} from '../../shared/types';
import { exportHtmlDocument, exportPdfDocument } from '../export/documentExport';
import { FileSystemError, toFileSystemError } from '../filesystem/errors';
import { displayNameOf, normalizeAbsolutePath } from '../filesystem/paths';
import { readTextFile, writeTextFileAtomic } from '../filesystem/textFile';
import {
  listRecoveryEntries,
  loadAppState,
  removeRecoveryEntry,
  saveAppState,
  saveRecoveryEntry,
} from '../state/appState';
import {
  canonicalWorkspaceRoot,
  createWorkspaceFile,
  createWorkspaceFolder,
  duplicateWorkspaceEntry,
  listWorkspace,
  mimeTypeForPath,
  moveWorkspaceEntry,
  renameWorkspaceEntry,
  resolveExistingWorkspacePath,
  saveAttachment,
  searchWorkspace,
} from '../workspace/workspaceService';
import { FileAccessRegistry } from './fileAccess';
import {
  validateAssetReadRequest,
  validateAttachmentRequest,
  validateSaveAsRequest,
  validateSaveFileRequest,
  validateWorkspaceMoveRequest,
  validateWorkspaceMutationRequest,
  validateWorkspacePathRequest,
  validateWorkspaceRenameRequest,
  validateWorkspaceSearchRequest,
} from './validation';

const MARKDOWN_FILE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
];
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

function errorPayload(error: unknown, context: string): FileErrorPayload {
  if (error instanceof FileSystemError) return error.toPayload();
  return toFileSystemError(error, context).toPayload();
}

async function openPath(absolutePathInput: string): Promise<OpenedFilePayload> {
  const absolutePath = normalizeAbsolutePath(absolutePathInput);
  const result = await readTextFile(absolutePath);
  return {
    absolutePath,
    displayName: displayNameOf(absolutePath),
    content: result.content,
    encoding: result.encoding,
    lineEnding: result.lineEnding,
    sizeBytes: result.sizeBytes,
  };
}

function windowForSender(event: IpcMainInvokeEvent): BrowserWindow {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (
    senderWindow === null ||
    senderWindow.isDestroyed() ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new FileSystemError('PERMISSION_DENIED', 'Rejected IPC call from an unknown sender.');
  }
  return senderWindow;
}

function validShowAll(value: unknown): boolean {
  return value === true;
}

function emitWorkspaceChanged(contents: WebContents, event: WorkspaceChangeEvent): void {
  if (!contents.isDestroyed()) contents.send(IPC.workspaceChanged, event);
}

export function registerIpcHandlers(): void {
  const fileAccess = new FileAccessRegistry();
  const watchers = new Map<number, FSWatcher>();
  const watchTimers = new Map<number, ReturnType<typeof setTimeout>>();

  ipcMain.handle(IPC.clipboardReadText, (event): string => {
    windowForSender(event);
    return clipboard.readText();
  });

  ipcMain.handle(IPC.clipboardWriteText, (event, value: unknown): void => {
    windowForSender(event);
    if (typeof value !== 'string' || value.length > 20_000_000) return;
    clipboard.writeText(value);
  });

  ipcMain.handle(IPC.windowMinimize, (event): void => {
    windowForSender(event).minimize();
  });

  ipcMain.handle(IPC.windowToggleMaximize, (event): boolean => {
    const senderWindow = windowForSender(event);
    if (senderWindow.isMaximized()) senderWindow.unmaximize();
    else senderWindow.maximize();
    return senderWindow.isMaximized();
  });

  ipcMain.handle(IPC.windowClose, (event): void => {
    windowForSender(event).close();
  });

  ipcMain.handle(IPC.windowIsMaximized, (event): boolean => {
    return windowForSender(event).isMaximized();
  });

  const stopWatch = (webContentsId: number): void => {
    watchers.get(webContentsId)?.close();
    watchers.delete(webContentsId);
    const timer = watchTimers.get(webContentsId);
    if (timer) clearTimeout(timer);
    watchTimers.delete(webContentsId);
  };

  const startWatch = (contents: WebContents, rootPath: string): void => {
    stopWatch(contents.id);
    try {
      const watcher = watch(rootPath, { recursive: true }, (_eventType, fileName) => {
        const previous = watchTimers.get(contents.id);
        if (previous) clearTimeout(previous);
        const timer = setTimeout(() => {
          watchTimers.delete(contents.id);
          const absolutePath = fileName ? path.resolve(rootPath, fileName.toString()) : null;
          emitWorkspaceChanged(contents, { rootPath, absolutePath });
        }, 180);
        watchTimers.set(contents.id, timer);
      });
      watcher.on('error', () => stopWatch(contents.id));
      watchers.set(contents.id, watcher);
    } catch {
      // Watching is best-effort; manual refresh remains available.
    }
  };

  app.on('web-contents-created', (_event, contents) => {
    contents.once('destroyed', () => {
      fileAccess.revokeAll(contents.id);
      stopWatch(contents.id);
    });
  });

  ipcMain.handle(
    IPC.dialogOpenFile,
    async (event): Promise<IpcResult<OpenedFilePayload | null>> => {
      try {
        const senderWindow = windowForSender(event);
        const picked = await dialog.showOpenDialog(senderWindow, {
          title: 'Open Markdown File',
          properties: ['openFile'],
          filters: MARKDOWN_FILE_FILTERS,
        });
        const pickedPath = picked.filePaths[0];
        if (picked.canceled || !pickedPath) return { ok: true, value: null };
        const realPath = await fs.realpath(normalizeAbsolutePath(pickedPath));
        fileAccess.authorize(event.sender.id, realPath);
        return { ok: true, value: await openPath(realPath) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not open file') };
      }
    },
  );

  ipcMain.handle(
    IPC.fileRead,
    async (event, rawPath: unknown): Promise<IpcResult<OpenedFilePayload>> => {
      try {
        windowForSender(event);
        const requested = fileAccess.assertAuthorized(
          event.sender.id,
          normalizeAbsolutePath(rawPath),
        );
        const realPath = await fs.realpath(requested);
        fileAccess.assertAuthorized(event.sender.id, realPath);
        return { ok: true, value: await openPath(realPath) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not open file') };
      }
    },
  );

  ipcMain.handle(
    IPC.fileWrite,
    async (event, rawRequest: unknown): Promise<IpcResult<SaveFileResult>> => {
      try {
        windowForSender(event);
        const request = validateSaveFileRequest(rawRequest);
        let absolutePath = fileAccess.assertAuthorized(event.sender.id, request.absolutePath);
        try {
          absolutePath = await fs.realpath(absolutePath);
          fileAccess.assertAuthorized(event.sender.id, absolutePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        const sizeBytes = await writeTextFileAtomic(absolutePath, request.content, request.options);
        return {
          ok: true,
          value: { absolutePath, displayName: displayNameOf(absolutePath), sizeBytes },
        };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not save file') };
      }
    },
  );

  ipcMain.handle(
    IPC.dialogSaveAs,
    async (event, rawRequest: unknown): Promise<IpcResult<SaveFileResult | null>> => {
      try {
        const senderWindow = windowForSender(event);
        const request = validateSaveAsRequest(rawRequest);
        const picked = await dialog.showSaveDialog(senderWindow, {
          title: 'Save Markdown File As',
          defaultPath: request.defaultFileName,
          filters: MARKDOWN_FILE_FILTERS,
        });
        if (picked.canceled || !picked.filePath) return { ok: true, value: null };
        const absolutePath = fileAccess.authorize(event.sender.id, picked.filePath);
        const sizeBytes = await writeTextFileAtomic(absolutePath, request.content, request.options);
        return {
          ok: true,
          value: { absolutePath, displayName: displayNameOf(absolutePath), sizeBytes },
        };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not save file') };
      }
    },
  );

  ipcMain.handle(
    IPC.dialogOpenFolder,
    async (event, showAllFiles: unknown): Promise<IpcResult<WorkspacePayload | null>> => {
      try {
        const senderWindow = windowForSender(event);
        const picked = await dialog.showOpenDialog(senderWindow, {
          title: 'Open Workspace Folder',
          properties: ['openDirectory', 'createDirectory'],
        });
        const pickedPath = picked.filePaths[0];
        if (picked.canceled || !pickedPath) return { ok: true, value: null };
        const rootPath = await canonicalWorkspaceRoot(pickedPath);
        fileAccess.authorizeWorkspace(event.sender.id, rootPath);
        startWatch(event.sender, rootPath);
        return { ok: true, value: await listWorkspace(rootPath, validShowAll(showAllFiles)) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not open workspace') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceRefresh,
    async (
      event,
      rootPath: unknown,
      showAllFiles: unknown,
    ): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const root = fileAccess.assertWorkspaceAuthorized(
          event.sender.id,
          normalizeAbsolutePath(rootPath),
        );
        return { ok: true, value: await listWorkspace(root, validShowAll(showAllFiles)) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not refresh workspace') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceCreateFile,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const request = validateWorkspaceMutationRequest(rawRequest);
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        const created = await createWorkspaceFile(root, request.parentRelativePath, request.name);
        fileAccess.authorize(event.sender.id, created);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not create file') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceCreateFolder,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const request = validateWorkspaceMutationRequest(rawRequest);
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        await createWorkspaceFolder(root, request.parentRelativePath, request.name);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not create folder') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceRename,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const request = validateWorkspaceRenameRequest(rawRequest);
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        const renamed = await renameWorkspaceEntry(root, request.relativePath, request.newName);
        fileAccess.authorize(event.sender.id, renamed);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not rename entry') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceMove,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const request = validateWorkspaceMoveRequest(rawRequest);
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        const moved = await moveWorkspaceEntry(
          root,
          request.relativePath,
          request.targetFolderRelativePath,
        );
        fileAccess.authorize(event.sender.id, moved);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not move entry') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceDelete,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        const senderWindow = windowForSender(event);
        const request = validateWorkspacePathRequest(rawRequest);
        if (!request.relativePath || request.relativePath === '.') {
          throw new FileSystemError(
            'PERMISSION_DENIED',
            'The workspace root cannot be deleted here.',
          );
        }
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        const target = await resolveExistingWorkspacePath(root, request.relativePath);
        const decision = await dialog.showMessageBox(senderWindow, {
          type: 'warning',
          title: 'Move to Recycle Bin',
          message: `Move “${path.basename(target)}” to the Recycle Bin?`,
          detail: 'This operation uses the system Recycle Bin and is normally recoverable.',
          buttons: ['Move to Recycle Bin', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        });
        if (decision.response === 0) await shell.trashItem(target);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not delete entry') };
      }
    },
  );

  ipcMain.handle(
    IPC.workspaceDuplicate,
    async (event, rawRequest): Promise<IpcResult<WorkspacePayload>> => {
      try {
        windowForSender(event);
        const request = validateWorkspacePathRequest(rawRequest);
        const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        await duplicateWorkspaceEntry(root, request.relativePath);
        return { ok: true, value: await listWorkspace(root, false) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not duplicate entry') };
      }
    },
  );

  ipcMain.handle(IPC.workspaceReveal, async (event, rawRequest): Promise<IpcResult<true>> => {
    try {
      windowForSender(event);
      const request = validateWorkspacePathRequest(rawRequest);
      const root = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
      const target = await resolveExistingWorkspacePath(root, request.relativePath || '.');
      shell.showItemInFolder(target);
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not reveal entry') };
    }
  });

  ipcMain.handle(
    IPC.workspaceSearch,
    async (event, rawRequest): Promise<IpcResult<WorkspaceSearchResult[]>> => {
      try {
        windowForSender(event);
        const request = validateWorkspaceSearchRequest(rawRequest);
        request.rootPath = fileAccess.assertWorkspaceAuthorized(event.sender.id, request.rootPath);
        return { ok: true, value: await searchWorkspace(request) };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not search workspace') };
      }
    },
  );

  ipcMain.handle(
    IPC.dialogConfirmClose,
    async (event, displayName: unknown): Promise<IpcResult<CloseDecision>> => {
      try {
        const senderWindow = windowForSender(event);
        const name = typeof displayName === 'string' ? displayName.slice(0, 500) : 'document';
        const choice = await dialog.showMessageBox(senderWindow, {
          type: 'warning',
          title: 'Unsaved Changes',
          message: `Save changes to “${name}”?`,
          detail: 'Your changes will be lost if you close without saving.',
          buttons: ['Save', 'Discard', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
        });
        const action: CloseDecision['action'] =
          choice.response === 0 ? 'save' : choice.response === 1 ? 'discard' : 'cancel';
        return { ok: true, value: { action } };
      } catch (error) {
        return { ok: false, error: errorPayload(error, 'Could not confirm close') };
      }
    },
  );

  ipcMain.handle(IPC.stateGet, async (event) => {
    try {
      windowForSender(event);
      const state = await loadAppState();
      if (state.lastWorkspace) {
        try {
          const root = await canonicalWorkspaceRoot(state.lastWorkspace);
          state.lastWorkspace = root;
          fileAccess.authorizeWorkspace(event.sender.id, root);
          startWatch(event.sender, root);
        } catch {
          state.lastWorkspace = null;
        }
      }
      for (const filePath of state.openFiles) {
        try {
          fileAccess.authorize(event.sender.id, await fs.realpath(filePath));
        } catch {
          // Ignore stale session files.
        }
      }
      return { ok: true, value: state };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not restore application state') };
    }
  });

  ipcMain.handle(IPC.stateSet, async (event, value) => {
    try {
      windowForSender(event);
      await saveAppState(value);
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not save application state') };
    }
  });

  ipcMain.handle(IPC.recoveryList, async (event) => {
    try {
      windowForSender(event);
      return { ok: true, value: await listRecoveryEntries() };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not read recovery data') };
    }
  });

  ipcMain.handle(IPC.recoverySave, async (event, value) => {
    try {
      windowForSender(event);
      await saveRecoveryEntry(value);
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not save recovery data') };
    }
  });

  ipcMain.handle(IPC.recoveryRemove, async (event, id) => {
    try {
      windowForSender(event);
      await removeRecoveryEntry(id);
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not remove recovery data') };
    }
  });

  ipcMain.handle(IPC.attachmentSave, async (event, value) => {
    try {
      windowForSender(event);
      const request = validateAttachmentRequest(value);
      if (request.workspaceRoot) {
        request.workspaceRoot = fileAccess.assertWorkspaceAuthorized(
          event.sender.id,
          request.workspaceRoot,
        );
      }
      fileAccess.assertAuthorized(event.sender.id, request.documentPath);
      const result = await saveAttachment(request);
      fileAccess.authorize(event.sender.id, result.absolutePath);
      return { ok: true, value: result };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not save attachment') };
    }
  });

  ipcMain.handle(IPC.assetRead, async (event, value): Promise<IpcResult<AssetReadResult>> => {
    try {
      windowForSender(event);
      const request = validateAssetReadRequest(value);
      const documentPath = await fs.realpath(
        fileAccess.assertAuthorized(event.sender.id, request.documentPath),
      );
      if (/^(data:|https?:|file:|javascript:)/i.test(request.source)) {
        throw new FileSystemError(
          'PERMISSION_DENIED',
          'Only relative local image paths are allowed.',
        );
      }
      let decodedSource: string;
      try {
        decodedSource = decodeURIComponent(request.source.split(/[?#]/, 1)[0] ?? '');
      } catch {
        throw new FileSystemError('INVALID_PATH', 'The image path is not valid.');
      }
      const candidate = path.resolve(path.dirname(documentPath), decodedSource);
      fileAccess.assertAuthorized(event.sender.id, candidate);
      const realPath = await fs.realpath(candidate);
      fileAccess.assertAuthorized(event.sender.id, realPath);
      const mimeType = mimeTypeForPath(realPath);
      if (!mimeType) throw new FileSystemError('INVALID_PATH', 'Unsupported image format.');
      const bytes = await fs.readFile(realPath);
      if (bytes.byteLength > MAX_ASSET_BYTES) {
        throw new FileSystemError('INVALID_PATH', 'The image is too large to display.');
      }
      return {
        ok: true,
        value: { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`, mimeType },
      };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not read image') };
    }
  });

  ipcMain.handle(IPC.exportHtml, async (event, value) => {
    try {
      const senderWindow = windowForSender(event);
      return { ok: true, value: await exportHtmlDocument(senderWindow, value) };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not export HTML') };
    }
  });

  ipcMain.handle(IPC.exportPdf, async (event, value) => {
    try {
      const senderWindow = windowForSender(event);
      return { ok: true, value: await exportPdfDocument(senderWindow, value) };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not export PDF') };
    }
  });

  ipcMain.handle(IPC.shellOpenExternal, async (event, value) => {
    try {
      windowForSender(event);
      if (typeof value !== 'string' || value.length > 4096) {
        throw new FileSystemError('INVALID_PATH', 'Invalid external link.');
      }
      const url = new URL(value);
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) {
        throw new FileSystemError('PERMISSION_DENIED', 'This link protocol is not allowed.');
      }
      await shell.openExternal(url.toString());
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorPayload(error, 'Could not open link') };
    }
  });

  ipcMain.handle(IPC.appInfo, (event): AppInfo => {
    windowForSender(event);
    return {
      name: 'mdPad',
      version: app.getVersion(),
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      platform: process.platform,
    };
  });
}
