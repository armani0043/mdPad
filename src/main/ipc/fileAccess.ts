import { FileSystemError } from '../filesystem/errors';
import { normalizeAbsolutePath } from '../filesystem/paths';
import path from 'node:path';

function accessKey(absolutePath: string): string {
  const normalized = normalizeAbsolutePath(absolutePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Tracks file capabilities granted by a native picker for each renderer.
 *
 * An absolute path is not authorization by itself. A compromised renderer may
 * only read or overwrite files the user explicitly selected in an Open/Save
 * dialog. Workspace-scoped capabilities will be added alongside Phase 3.
 */
export class FileAccessRegistry {
  private readonly allowedByWebContents = new Map<number, Set<string>>();
  private readonly workspaceRootsByWebContents = new Map<number, Set<string>>();

  authorize(webContentsId: number, absolutePath: string): string {
    const normalized = normalizeAbsolutePath(absolutePath);
    const allowed = this.allowedByWebContents.get(webContentsId) ?? new Set<string>();
    allowed.add(accessKey(normalized));
    this.allowedByWebContents.set(webContentsId, allowed);
    return normalized;
  }

  assertAuthorized(webContentsId: number, absolutePath: string): string {
    const normalized = normalizeAbsolutePath(absolutePath);
    const explicitlyAllowed = this.allowedByWebContents
      .get(webContentsId)
      ?.has(accessKey(normalized));
    const workspaceAllowed = [...(this.workspaceRootsByWebContents.get(webContentsId) ?? [])].some(
      (root) => {
        const relative = path.relative(root, normalized);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
      },
    );
    if (!explicitlyAllowed && !workspaceAllowed) {
      throw new FileSystemError(
        'PERMISSION_DENIED',
        'Access to this file was not granted by a native file dialog.',
      );
    }
    return normalized;
  }

  authorizeWorkspace(webContentsId: number, rootPath: string): string {
    const normalized = normalizeAbsolutePath(rootPath);
    const roots = this.workspaceRootsByWebContents.get(webContentsId) ?? new Set<string>();
    roots.add(accessKey(normalized));
    this.workspaceRootsByWebContents.set(webContentsId, roots);
    return normalized;
  }

  assertWorkspaceAuthorized(webContentsId: number, rootPath: string): string {
    const normalized = normalizeAbsolutePath(rootPath);
    if (!this.workspaceRootsByWebContents.get(webContentsId)?.has(accessKey(normalized))) {
      throw new FileSystemError(
        'PERMISSION_DENIED',
        'Access to this workspace was not granted by a native folder dialog.',
      );
    }
    return normalized;
  }

  revokeAll(webContentsId: number): void {
    this.allowedByWebContents.delete(webContentsId);
    this.workspaceRootsByWebContents.delete(webContentsId);
  }
}
