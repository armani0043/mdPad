import path from 'node:path';
import { FileSystemError } from './errors';

const NULL_BYTE = String.fromCharCode(0);

/**
 * Validate and normalize an absolute filesystem path supplied over IPC.
 * Rejects null bytes, empty strings, and non-absolute paths. Never builds a
 * path by concatenating untrusted fragments.
 */
export function normalizeAbsolutePath(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new FileSystemError('INVALID_PATH', 'Invalid path: expected a non-empty string.');
  }
  if (input.includes(NULL_BYTE)) {
    throw new FileSystemError('INVALID_PATH', 'Invalid path: contains a null byte.');
  }
  if (input.length > 4096) {
    throw new FileSystemError('INVALID_PATH', 'Invalid path: exceeds maximum length.');
  }
  const normalized = path.normalize(input);
  if (!path.isAbsolute(normalized)) {
    throw new FileSystemError('INVALID_PATH', 'Invalid path: must be absolute.');
  }
  return normalized;
}

/**
 * Resolve `target` against `root` and require the result to stay inside root.
 * Used for workspace-scoped operations to reject path traversal.
 */
export function resolveWithin(root: string, target: string): string {
  const normalizedRoot = path.resolve(normalizeAbsolutePath(root));
  const resolved = path.resolve(normalizedRoot, target);
  const relative = path.relative(normalizedRoot, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new FileSystemError('PATH_TRAVERSAL', 'Path is outside the allowed folder.');
}

/** Extract a display name (basename) from an absolute path. */
export function displayNameOf(absolutePath: string): string {
  return path.basename(absolutePath);
}

/** Temp file path used for atomic saves, in the same directory as the target. */
export function tempPathFor(targetPath: string, unique: string): string {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  return path.join(dir, `.${base}.${unique}.tmp-mdpad`);
}
