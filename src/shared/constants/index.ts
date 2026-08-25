/**
 * Centralized keyboard shortcut definitions.
 * Kept in one module so shortcuts can become user-configurable later.
 * Accelerators use Electron's accelerator syntax (used by the native menu).
 */
export const SHORTCUTS = {
  newFile: 'CmdOrCtrl+N',
  openFile: 'CmdOrCtrl+O',
  save: 'CmdOrCtrl+S',
  saveAs: 'CmdOrCtrl+Shift+S',
  toggleTheme: 'CmdOrCtrl+Shift+T',
  openFolder: 'CmdOrCtrl+Shift+O',
  commandPalette: 'CmdOrCtrl+Shift+P',
  quickOpen: 'CmdOrCtrl+P',
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;

/** IPC channel names. Single source of truth for main + preload. */
export const IPC = {
  dialogOpenFile: 'dialog:open-file',
  dialogSaveAs: 'dialog:save-as',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  windowSetDirty: 'window:set-dirty',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  appInfo: 'app:info',
  appOpenFile: 'app:open-file',
  updateGetState: 'update:get-state',
  updateStateChanged: 'update:state-changed',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  menuAction: 'menu:action',
  dialogOpenFolder: 'dialog:open-folder',
  workspaceRefresh: 'workspace:refresh',
  workspaceCreateFile: 'workspace:create-file',
  workspaceCreateFolder: 'workspace:create-folder',
  workspaceRename: 'workspace:rename',
  workspaceMove: 'workspace:move',
  workspaceDelete: 'workspace:delete',
  workspaceDuplicate: 'workspace:duplicate',
  workspaceReveal: 'workspace:reveal',
  workspaceSearch: 'workspace:search',
  workspaceChanged: 'workspace:changed',
  dialogConfirmClose: 'dialog:confirm-close',
  stateGet: 'state:get',
  stateSet: 'state:set',
  recoveryList: 'recovery:list',
  recoverySave: 'recovery:save',
  recoveryRemove: 'recovery:remove',
  attachmentSave: 'attachment:save',
  assetRead: 'asset:read',
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  shellOpenExternal: 'shell:open-external',
  clipboardRead: 'clipboard:read',
  clipboardWrite: 'clipboard:write',
  clipboardReadText: 'clipboard:read-text',
  clipboardWriteText: 'clipboard:write-text',
} as const;
