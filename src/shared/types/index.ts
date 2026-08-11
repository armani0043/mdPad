/**
 * Shared domain types used by main, preload and renderer.
 * Keep this module free of Node/Electron/DOM imports so it works everywhere.
 */

/** Text encodings mdPad can read. UTF-8 is the only supported encoding for now. */
export type TextEncoding = 'utf-8' | 'utf-8-bom';

/** Line-ending style detected in the original file bytes. */
export type LineEnding = 'LF' | 'CRLF' | 'MIXED' | 'NONE';

/**
 * Result of reading a text file from disk.
 * `content` is the raw decoded string, byte-faithful except the BOM which is
 * stripped here and tracked separately in `encoding` (restored on save).
 * Line endings are NOT normalized at this layer.
 */
export interface ReadTextFileResult {
  content: string;
  encoding: TextEncoding;
  lineEnding: LineEnding;
  sizeBytes: number;
}

/** Payload returned to the renderer when a file is opened. */
export interface OpenedFilePayload {
  absolutePath: string;
  displayName: string;
  content: string;
  encoding: TextEncoding;
  lineEnding: LineEnding;
  sizeBytes: number;
}

/** Options describing how editor content must be serialized back to bytes. */
export interface SaveSerializationOptions {
  /** Original encoding; when 'utf-8-bom' a BOM is prepended on write. */
  encoding: TextEncoding;
  /** Target line endings on disk. 'LF' for 'MIXED'/'NONE' unless overridden. */
  lineEnding: Exclude<LineEnding, 'MIXED' | 'NONE'>;
}

export interface SaveFileRequest {
  absolutePath: string;
  /** Editor content, LF-normalized (CodeMirror internal representation). */
  content: string;
  options: SaveSerializationOptions;
}

export interface SaveAsRequest {
  defaultFileName: string;
  content: string;
  options: SaveSerializationOptions;
}

export interface SaveFileResult {
  absolutePath: string;
  displayName: string;
  sizeBytes: number;
}

/** Stable error codes surfaced to the renderer for user-facing messages. */
export type FileErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'IS_DIRECTORY'
  | 'INVALID_UTF8'
  | 'INVALID_PATH'
  | 'PATH_TRAVERSAL'
  | 'DISK_FULL'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface FileErrorPayload {
  code: FileErrorCode;
  message: string;
  detail?: string;
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: FileErrorPayload };

/** Menu actions forwarded from the native application menu to the renderer. */
export type MenuAction =
  | 'file:new'
  | 'file:open'
  | 'file:open-folder'
  | 'file:save'
  | 'file:save-as'
  | 'file:export-html'
  | 'file:export-pdf'
  | 'edit:find'
  | 'edit:replace'
  | 'view:source'
  | 'view:visual'
  | 'view:preview'
  | 'view:split'
  | 'view:toggle-theme'
  | 'tools:workspace-search'
  | 'tools:command-palette'
  | 'tools:preferences';

/** Theme selection; 'system' follows the OS preference. */
export type ThemeSetting = 'light' | 'dark' | 'system';

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
}

/** Renderer-visible updater state. Automatic checks stay in `idle` and silent. */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'download-error'; version: string }
  | { phase: 'ready'; version: string }
  | { phase: 'installing'; version: string };

export type WorkspaceEntryType = 'file' | 'folder';

export interface WorkspaceEntry {
  name: string;
  absolutePath: string;
  relativePath: string;
  type: WorkspaceEntryType;
  children?: WorkspaceEntry[];
  sizeBytes?: number;
}

export interface WorkspacePayload {
  rootPath: string;
  displayName: string;
  entries: WorkspaceEntry[];
}

export interface WorkspaceMutationRequest {
  rootPath: string;
  parentRelativePath: string;
  name: string;
}

export interface WorkspaceRenameRequest {
  rootPath: string;
  relativePath: string;
  newName: string;
}

export interface WorkspaceMoveRequest {
  rootPath: string;
  relativePath: string;
  targetFolderRelativePath: string;
}

export interface WorkspacePathRequest {
  rootPath: string;
  relativePath: string;
}

export interface WorkspaceSearchRequest {
  rootPath: string;
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface WorkspaceSearchResult {
  absolutePath: string;
  relativePath: string;
  displayName: string;
  line: number;
  column: number;
  preview: string;
  matchLength: number;
}

export interface WorkspaceChangeEvent {
  rootPath: string;
  absolutePath: string | null;
}

export interface CloseDecision {
  action: 'save' | 'discard' | 'cancel';
}

export interface AppStateData {
  recentFiles: string[];
  recentWorkspaces: string[];
  lastWorkspace: string | null;
  openFiles: string[];
}

export interface RecoveryEntry {
  id: string;
  absolutePath: string | null;
  displayName: string;
  markdown: string;
  savedContent: string;
  encoding: TextEncoding;
  lineEnding: LineEnding;
  updatedAt: number;
}

export interface AttachmentSaveRequest {
  documentPath: string;
  workspaceRoot: string | null;
  relativeFolder: string;
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface AttachmentSaveResult {
  absolutePath: string;
  relativeMarkdownPath: string;
}

export interface AssetReadRequest {
  documentPath: string;
  source: string;
}

export interface AssetReadResult {
  dataUrl: string;
  mimeType: string;
}

export interface ExportDocumentRequest {
  defaultFileName: string;
  title: string;
  html: string;
  theme: 'light' | 'dark';
}
