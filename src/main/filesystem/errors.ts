import type { FileErrorCode, FileErrorPayload } from '../../shared/types';

/**
 * Error type for filesystem operations. Carries a stable machine code plus a
 * user-facing message; the original OS error detail is kept for diagnostics.
 */
export class FileSystemError extends Error {
  readonly code: FileErrorCode;
  readonly detail?: string;

  constructor(code: FileErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
    if (detail !== undefined) {
      this.detail = detail;
    }
  }

  toPayload(): FileErrorPayload {
    const payload: FileErrorPayload = { code: this.code, message: this.message };
    if (this.detail !== undefined) {
      payload.detail = this.detail;
    }
    return payload;
  }
}

interface NodeErrorLike {
  code?: string;
  message?: string;
}

/** Map a raw Node fs error onto a user-facing FileSystemError. */
export function toFileSystemError(err: unknown, context: string): FileSystemError {
  if (err instanceof FileSystemError) {
    return err;
  }
  const nodeErr = (err ?? {}) as NodeErrorLike;
  const detail = typeof nodeErr.message === 'string' ? nodeErr.message : String(err);
  switch (nodeErr.code) {
    case 'ENOENT':
      return new FileSystemError(
        'NOT_FOUND',
        `${context}: the file or folder was not found.`,
        detail,
      );
    case 'EACCES':
    case 'EPERM':
      return new FileSystemError('PERMISSION_DENIED', `${context}: permission denied.`, detail);
    case 'EISDIR':
      return new FileSystemError(
        'IS_DIRECTORY',
        `${context}: the path is a folder, not a file.`,
        detail,
      );
    case 'ENOTDIR':
      return new FileSystemError('INVALID_PATH', `${context}: the path is not valid.`, detail);
    case 'ENOSPC':
      return new FileSystemError('DISK_FULL', `${context}: the disk is full.`, detail);
    default:
      return new FileSystemError('UNKNOWN', `${context}: an unexpected error occurred.`, detail);
  }
}
