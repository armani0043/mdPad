import type {
  AssetReadRequest,
  AttachmentSaveRequest,
  SaveAsRequest,
  SaveFileRequest,
  SaveSerializationOptions,
  WorkspaceMoveRequest,
  WorkspaceMutationRequest,
  WorkspacePathRequest,
  WorkspaceRenameRequest,
  WorkspaceSearchRequest,
} from '../../shared/types';
import { FileSystemError } from '../filesystem/errors';

const MAX_CONTENT_BYTES = 64 * 1024 * 1024;

function validateSerializationOptions(input: unknown): SaveSerializationOptions {
  if (typeof input !== 'object' || input === null) {
    throw new FileSystemError('INVALID_PATH', 'Invalid save options.');
  }
  const opts = input as Partial<SaveSerializationOptions>;
  if (opts.encoding !== 'utf-8' && opts.encoding !== 'utf-8-bom') {
    throw new FileSystemError('INVALID_PATH', 'Invalid save options: unknown encoding.');
  }
  if (opts.lineEnding !== 'LF' && opts.lineEnding !== 'CRLF') {
    throw new FileSystemError('INVALID_PATH', 'Invalid save options: unknown line ending.');
  }
  return { encoding: opts.encoding, lineEnding: opts.lineEnding };
}

function validateContent(content: unknown): string {
  if (typeof content !== 'string') {
    throw new FileSystemError('INVALID_PATH', 'Invalid content: expected a string.');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
    throw new FileSystemError('INVALID_PATH', 'Invalid content: exceeds maximum size.');
  }
  return content;
}

/** Validate the full SaveFileRequest payload coming from the renderer. */
export function validateSaveFileRequest(input: unknown): SaveFileRequest {
  if (typeof input !== 'object' || input === null) {
    throw new FileSystemError('INVALID_PATH', 'Invalid save request.');
  }
  const req = input as Partial<SaveFileRequest>;
  return {
    absolutePath: typeof req.absolutePath === 'string' ? req.absolutePath : '',
    content: validateContent(req.content),
    options: validateSerializationOptions(req.options),
  };
}

/** Validate the full SaveAsRequest payload coming from the renderer. */
export function validateSaveAsRequest(input: unknown): SaveAsRequest {
  if (typeof input !== 'object' || input === null) {
    throw new FileSystemError('INVALID_PATH', 'Invalid save request.');
  }
  const req = input as Partial<SaveAsRequest>;
  const defaultFileName =
    typeof req.defaultFileName === 'string' && req.defaultFileName.length > 0
      ? req.defaultFileName
      : 'untitled.md';
  if (defaultFileName.includes('/') || defaultFileName.includes('\\')) {
    throw new FileSystemError('INVALID_PATH', 'Invalid file name.');
  }
  return {
    defaultFileName,
    content: validateContent(req.content),
    options: validateSerializationOptions(req.options),
  };
}

function objectRequest(input: unknown, message: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new FileSystemError('INVALID_PATH', message);
  }
  return input as Record<string, unknown>;
}

function boundedString(value: unknown, label: string, maximum = 4096): string {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    value.includes(String.fromCharCode(0))
  ) {
    throw new FileSystemError('INVALID_PATH', `Invalid ${label}.`);
  }
  return value;
}

export function validateWorkspaceMutationRequest(input: unknown): WorkspaceMutationRequest {
  const request = objectRequest(input, 'Invalid workspace request.');
  return {
    rootPath: boundedString(request.rootPath, 'workspace path'),
    parentRelativePath: boundedString(request.parentRelativePath, 'parent path'),
    name: boundedString(request.name, 'entry name', 500),
  };
}

export function validateWorkspaceRenameRequest(input: unknown): WorkspaceRenameRequest {
  const request = objectRequest(input, 'Invalid workspace rename request.');
  return {
    rootPath: boundedString(request.rootPath, 'workspace path'),
    relativePath: boundedString(request.relativePath, 'entry path'),
    newName: boundedString(request.newName, 'entry name', 500),
  };
}

export function validateWorkspaceMoveRequest(input: unknown): WorkspaceMoveRequest {
  const request = objectRequest(input, 'Invalid workspace move request.');
  return {
    rootPath: boundedString(request.rootPath, 'workspace path'),
    relativePath: boundedString(request.relativePath, 'relative path'),
    targetFolderRelativePath: boundedString(request.targetFolderRelativePath, 'target folder path'),
  };
}

export function validateWorkspacePathRequest(input: unknown): WorkspacePathRequest {
  const request = objectRequest(input, 'Invalid workspace path request.');
  return {
    rootPath: boundedString(request.rootPath, 'workspace path'),
    relativePath: boundedString(request.relativePath, 'entry path'),
  };
}

export function validateWorkspaceSearchRequest(input: unknown): WorkspaceSearchRequest {
  const request = objectRequest(input, 'Invalid search request.');
  return {
    rootPath: boundedString(request.rootPath, 'workspace path'),
    query: boundedString(request.query, 'search query', 500),
    caseSensitive: request.caseSensitive === true,
    wholeWord: request.wholeWord === true,
  };
}

export function validateAttachmentRequest(input: unknown): AttachmentSaveRequest {
  const request = objectRequest(input, 'Invalid attachment request.');
  if (!(request.bytes instanceof Uint8Array)) {
    throw new FileSystemError('INVALID_PATH', 'Invalid attachment bytes.');
  }
  return {
    documentPath: boundedString(request.documentPath, 'document path'),
    workspaceRoot:
      request.workspaceRoot === null
        ? null
        : boundedString(request.workspaceRoot, 'workspace path'),
    relativeFolder: boundedString(request.relativeFolder, 'attachment folder', 1000),
    originalName: boundedString(request.originalName, 'attachment name', 500),
    mimeType: boundedString(request.mimeType, 'attachment type', 200),
    bytes: request.bytes,
  };
}

export function validateAssetReadRequest(input: unknown): AssetReadRequest {
  const request = objectRequest(input, 'Invalid asset request.');
  return {
    documentPath: boundedString(request.documentPath, 'document path'),
    source: boundedString(request.source, 'asset source', 4096),
  };
}
