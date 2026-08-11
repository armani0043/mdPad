/**
 * Typed contract of the API exposed to the renderer via contextBridge.
 * The renderer only ever sees `window.desktopAPI` — never Node or Electron.
 */
import type {
  AppInfo,
  AppStateData,
  AssetReadRequest,
  AssetReadResult,
  AttachmentSaveRequest,
  AttachmentSaveResult,
  CloseDecision,
  ExportDocumentRequest,
  IpcResult,
  MenuAction,
  OpenedFilePayload,
  SaveAsRequest,
  SaveFileRequest,
  SaveFileResult,
  UpdateState,
  RecoveryEntry,
  WorkspaceChangeEvent,
  WorkspaceMoveRequest,
  WorkspaceMutationRequest,
  WorkspacePathRequest,
  WorkspacePayload,
  WorkspaceRenameRequest,
  WorkspaceSearchRequest,
  WorkspaceSearchResult,
} from './index';

export interface DesktopAPI {
  /** Show the native open dialog and read the chosen file. */
  openFileDialog(): Promise<IpcResult<OpenedFilePayload | null>>;
  /** Read a file at an absolute path (validated in main). */
  readFile(absolutePath: string): Promise<IpcResult<OpenedFilePayload>>;
  /** Atomically write a file at an absolute path (validated in main). */
  writeFile(request: SaveFileRequest): Promise<IpcResult<SaveFileResult>>;
  /** Show the native save dialog and atomically write to the chosen path. */
  saveAsDialog(request: SaveAsRequest): Promise<IpcResult<SaveFileResult | null>>;
  /** Report the current document dirty state so main can guard window close. */
  setDirty(dirty: boolean): void;
  /** Native window controls used by the frameless mdPad title bar. */
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<boolean>;
  closeWindow(): Promise<void>;
  isWindowMaximized(): Promise<boolean>;
  /** Application version/runtime info for the About dialog. */
  getAppInfo(): Promise<AppInfo>;
  /** Read and subscribe to the optional, silent background update state. */
  getUpdateState(): Promise<UpdateState>;
  onUpdateState(listener: (state: UpdateState) => void): () => void;
  downloadUpdate(): Promise<boolean>;
  installUpdate(): Promise<boolean>;
  /** Receive a Markdown file supplied by Windows at launch or from a second instance. */
  onLaunchFile(listener: (result: IpcResult<OpenedFilePayload>) => void): () => void;
  /** Subscribe to native menu actions. Returns an unsubscribe function. */
  onMenuAction(listener: (action: MenuAction) => void): () => void;
  openFolderDialog(showAllFiles: boolean): Promise<IpcResult<WorkspacePayload | null>>;
  refreshWorkspace(rootPath: string, showAllFiles: boolean): Promise<IpcResult<WorkspacePayload>>;
  createWorkspaceFile(request: WorkspaceMutationRequest): Promise<IpcResult<WorkspacePayload>>;
  createWorkspaceFolder(request: WorkspaceMutationRequest): Promise<IpcResult<WorkspacePayload>>;
  renameWorkspaceEntry(request: WorkspaceRenameRequest): Promise<IpcResult<WorkspacePayload>>;
  moveWorkspaceEntry(request: WorkspaceMoveRequest): Promise<IpcResult<WorkspacePayload>>;
  deleteWorkspaceEntry(request: WorkspacePathRequest): Promise<IpcResult<WorkspacePayload>>;
  duplicateWorkspaceEntry(request: WorkspacePathRequest): Promise<IpcResult<WorkspacePayload>>;
  revealWorkspaceEntry(request: WorkspacePathRequest): Promise<IpcResult<true>>;
  searchWorkspace(request: WorkspaceSearchRequest): Promise<IpcResult<WorkspaceSearchResult[]>>;
  onWorkspaceChanged(listener: (event: WorkspaceChangeEvent) => void): () => void;
  confirmClose(displayName: string): Promise<IpcResult<CloseDecision>>;
  getAppState(): Promise<IpcResult<AppStateData>>;
  setAppState(state: AppStateData): Promise<IpcResult<true>>;
  listRecovery(): Promise<IpcResult<RecoveryEntry[]>>;
  saveRecovery(entry: RecoveryEntry): Promise<IpcResult<true>>;
  removeRecovery(id: string): Promise<IpcResult<true>>;
  saveAttachment(request: AttachmentSaveRequest): Promise<IpcResult<AttachmentSaveResult>>;
  readAsset(request: AssetReadRequest): Promise<IpcResult<AssetReadResult>>;
  exportHtml(request: ExportDocumentRequest): Promise<IpcResult<string | null>>;
  exportPdf(request: ExportDocumentRequest): Promise<IpcResult<string | null>>;
  openExternal(url: string): Promise<IpcResult<true>>;
  readClipboardText(): Promise<string>;
  writeClipboardText(text: string): Promise<void>;
}
