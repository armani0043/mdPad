import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import type {
  AttachmentSaveRequest,
  AttachmentSaveResult,
  WorkspaceEntry,
  WorkspacePayload,
  WorkspaceSearchRequest,
  WorkspaceSearchResult,
} from '../../shared/types';
import { FileSystemError, toFileSystemError } from '../filesystem/errors';
import { displayNameOf, normalizeAbsolutePath, resolveWithin } from '../filesystem/paths';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt']);
const SKIPPED_FOLDERS = new Set(['.git', '.svn', 'node_modules']);
const MAX_WORKSPACE_ENTRIES = 20_000;
const MAX_SEARCH_RESULTS = 300;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function validateEntryName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new FileSystemError('INVALID_PATH', 'A file or folder name is required.');
  }
  const trimmed = name.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 240 ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes(String.fromCharCode(0))
  ) {
    throw new FileSystemError('INVALID_PATH', 'The file or folder name is not valid.');
  }
  if (process.platform === 'win32' && /[<>:"|?*]|[. ]$/.test(trimmed)) {
    throw new FileSystemError(
      'INVALID_PATH',
      'The file or folder name contains invalid characters.',
    );
  }
  return trimmed;
}

export async function canonicalWorkspaceRoot(rootInput: string): Promise<string> {
  const root = normalizeAbsolutePath(rootInput);
  try {
    const real = await fs.realpath(root);
    const info = await fs.stat(real);
    if (!info.isDirectory()) {
      throw new FileSystemError('IS_DIRECTORY', 'The selected workspace is not a folder.');
    }
    return real;
  } catch (error) {
    throw toFileSystemError(error, 'Could not open workspace');
  }
}

export async function resolveExistingWorkspacePath(
  rootInput: string,
  relativePath: string,
): Promise<string> {
  const root = await canonicalWorkspaceRoot(rootInput);
  const lexical = resolveWithin(root, relativePath);
  try {
    const real = await fs.realpath(lexical);
    if (!isInside(root, real)) {
      throw new FileSystemError('PATH_TRAVERSAL', 'A linked path escapes the workspace.');
    }
    return real;
  } catch (error) {
    throw toFileSystemError(error, 'Could not access workspace entry');
  }
}

async function resolveNewWorkspacePath(
  rootInput: string,
  parentRelativePath: string,
  name: string,
): Promise<string> {
  const root = await canonicalWorkspaceRoot(rootInput);
  const parent = await resolveExistingWorkspacePath(root, parentRelativePath || '.');
  const parentInfo = await fs.stat(parent);
  if (!parentInfo.isDirectory()) {
    throw new FileSystemError('IS_DIRECTORY', 'The selected parent is not a folder.');
  }
  const target = path.join(parent, validateEntryName(name));
  if (!isInside(root, target)) {
    throw new FileSystemError('PATH_TRAVERSAL', 'The new entry would be outside the workspace.');
  }
  return target;
}

function shouldIncludeFile(name: string, showAllFiles: boolean): boolean {
  return showAllFiles || MARKDOWN_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function listWorkspace(
  rootInput: string,
  showAllFiles: boolean,
): Promise<WorkspacePayload> {
  const root = await canonicalWorkspaceRoot(rootInput);
  let count = 0;

  const visit = async (directory: string): Promise<WorkspaceEntry[]> => {
    const dirents = await fs.readdir(directory, { withFileTypes: true });
    const entries: WorkspaceEntry[] = [];
    for (const dirent of dirents) {
      if (count >= MAX_WORKSPACE_ENTRIES) break;
      if (dirent.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, dirent.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
      if (dirent.isDirectory()) {
        if (SKIPPED_FOLDERS.has(dirent.name)) continue;
        count += 1;
        entries.push({
          name: dirent.name,
          absolutePath,
          relativePath,
          type: 'folder',
          children: await visit(absolutePath),
        });
      } else if (dirent.isFile() && shouldIncludeFile(dirent.name, showAllFiles)) {
        count += 1;
        const info = await fs.stat(absolutePath);
        entries.push({
          name: dirent.name,
          absolutePath,
          relativePath,
          type: 'file',
          sizeBytes: info.size,
        });
      }
    }
    return entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  return { rootPath: root, displayName: displayNameOf(root), entries: await visit(root) };
}

export async function createWorkspaceFile(
  root: string,
  parentRelativePath: string,
  nameInput: string,
): Promise<string> {
  let name = validateEntryName(nameInput);
  if (path.extname(name).length === 0) name += '.md';
  const target = await resolveNewWorkspacePath(root, parentRelativePath, name);
  try {
    await fs.writeFile(target, '', { flag: 'wx' });
    return target;
  } catch (error) {
    throw toFileSystemError(error, 'Could not create file');
  }
}

export async function createWorkspaceFolder(
  root: string,
  parentRelativePath: string,
  name: string,
): Promise<string> {
  const target = await resolveNewWorkspacePath(root, parentRelativePath, name);
  try {
    await fs.mkdir(target);
    return target;
  } catch (error) {
    throw toFileSystemError(error, 'Could not create folder');
  }
}

export async function renameWorkspaceEntry(
  root: string,
  relativePath: string,
  newName: string,
): Promise<string> {
  const source = await resolveExistingWorkspacePath(root, relativePath);
  const target = path.join(path.dirname(source), validateEntryName(newName));
  const canonicalRoot = await canonicalWorkspaceRoot(root);
  if (!isInside(canonicalRoot, target)) {
    throw new FileSystemError('PATH_TRAVERSAL', 'The renamed entry would leave the workspace.');
  }
  try {
    await fs.access(target, fsConstants.F_OK).then(
      () => {
        throw new FileSystemError('INVALID_PATH', 'An entry with that name already exists.');
      },
      () => undefined,
    );
    await fs.rename(source, target);
    return target;
  } catch (error) {
    throw toFileSystemError(error, 'Could not rename entry');
  }
}

export async function moveWorkspaceEntry(
  root: string,
  relativePath: string,
  targetFolderRelativePath: string,
): Promise<string> {
  const source = await resolveExistingWorkspacePath(root, relativePath);
  const targetFolder = await resolveExistingWorkspacePath(root, targetFolderRelativePath || '.');
  const targetFolderInfo = await fs.stat(targetFolder);
  if (!targetFolderInfo.isDirectory()) {
    throw new FileSystemError('IS_DIRECTORY', 'The move destination is not a folder.');
  }
  const target = path.join(targetFolder, path.basename(source));
  if (path.normalize(target) === path.normalize(source)) return source;
  if (isInside(source, target)) {
    throw new FileSystemError('INVALID_PATH', 'A folder cannot be moved inside itself.');
  }
  try {
    await fs.access(target, fsConstants.F_OK).then(
      () => {
        throw new FileSystemError('INVALID_PATH', 'An entry with that name already exists there.');
      },
      () => undefined,
    );
    await fs.rename(source, target);
    return target;
  } catch (error) {
    throw toFileSystemError(error, 'Could not move entry');
  }
}

function duplicateName(name: string, copyNumber: number): string {
  const extension = path.extname(name);
  const stem = extension.length > 0 ? name.slice(0, -extension.length) : name;
  return `${stem} copy${copyNumber > 1 ? ` ${copyNumber}` : ''}${extension}`;
}

export async function duplicateWorkspaceEntry(root: string, relativePath: string): Promise<string> {
  const source = await resolveExistingWorkspacePath(root, relativePath);
  const info = await fs.stat(source);
  let target = '';
  for (let copyNumber = 1; copyNumber <= 999; copyNumber += 1) {
    target = path.join(path.dirname(source), duplicateName(path.basename(source), copyNumber));
    try {
      await fs.access(target);
    } catch {
      break;
    }
  }
  try {
    if (info.isDirectory()) {
      await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false });
    } else {
      await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
    }
    return target;
  } catch (error) {
    throw toFileSystemError(error, 'Could not duplicate entry');
  }
}

async function markdownFiles(
  root: string,
): Promise<Array<{ absolutePath: string; relativePath: string }>> {
  const payload = await listWorkspace(root, false);
  const files: Array<{ absolutePath: string; relativePath: string }> = [];
  const collect = (entries: WorkspaceEntry[]): void => {
    for (const entry of entries) {
      if (entry.type === 'folder') collect(entry.children ?? []);
      else files.push({ absolutePath: entry.absolutePath, relativePath: entry.relativePath });
    }
  };
  collect(payload.entries);
  return files;
}

export async function searchWorkspace(
  request: WorkspaceSearchRequest,
): Promise<WorkspaceSearchResult[]> {
  const query = request.query.slice(0, 500);
  if (query.length === 0) return [];
  const needle = request.caseSensitive ? query : query.toLocaleLowerCase();
  const results: WorkspaceSearchResult[] = [];
  for (const file of await markdownFiles(request.rootPath)) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    let content: string;
    try {
      content = await fs.readFile(file.absolutePath, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] ?? '';
      const haystack = request.caseSensitive ? line : line.toLocaleLowerCase();
      let from = 0;
      while (from <= haystack.length && results.length < MAX_SEARCH_RESULTS) {
        const found = haystack.indexOf(needle, from);
        if (found < 0) break;
        const before = found === 0 ? '' : (haystack[found - 1] ?? '');
        const after = haystack[found + needle.length] ?? '';
        const wordBoundary = !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after);
        if (!request.wholeWord || wordBoundary) {
          results.push({
            absolutePath: file.absolutePath,
            relativePath: file.relativePath,
            displayName: path.basename(file.absolutePath),
            line: lineIndex + 1,
            column: found + 1,
            preview: line.trim().slice(0, 240),
            matchLength: query.length,
          });
        }
        from = found + Math.max(needle.length, 1);
      }
    }
  }
  return results;
}

function extensionForMime(mimeType: string): string {
  const known: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  return known[mimeType] ?? '';
}

export async function saveAttachment(
  request: AttachmentSaveRequest,
): Promise<AttachmentSaveResult> {
  if (!request.mimeType.startsWith('image/') || request.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new FileSystemError(
      'INVALID_PATH',
      'The attachment is not a supported image or is too large.',
    );
  }
  const documentPath = await fs.realpath(normalizeAbsolutePath(request.documentPath));
  const root = request.workspaceRoot
    ? await canonicalWorkspaceRoot(request.workspaceRoot)
    : path.dirname(documentPath);
  if (!isInside(root, documentPath)) {
    throw new FileSystemError(
      'PERMISSION_DENIED',
      'Attachments require a document inside the workspace.',
    );
  }
  const folderSegments = request.relativeFolder.split(/[\\/]+/).filter(Boolean);
  let folder = path.dirname(documentPath);
  for (const segment of folderSegments) {
    folder = path.join(folder, validateEntryName(segment));
  }
  if (!isInside(root, folder)) {
    throw new FileSystemError('PATH_TRAVERSAL', 'The attachment folder is outside the workspace.');
  }
  await fs.mkdir(folder, { recursive: true });
  const extension =
    path.extname(request.originalName) || extensionForMime(request.mimeType) || '.png';
  const rawStem = path.basename(request.originalName, path.extname(request.originalName));
  const safeStem = rawStem.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'image';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let target = path.join(folder, `${safeStem}-${timestamp}${extension.toLowerCase()}`);
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    try {
      await fs.access(target);
      target = path.join(folder, `${safeStem}-${timestamp}-${suffix}${extension.toLowerCase()}`);
    } catch {
      break;
    }
  }
  await fs.writeFile(target, request.bytes, { flag: 'wx' });
  const relative = path.relative(path.dirname(documentPath), target).split(path.sep).join('/');
  return {
    absolutePath: target,
    relativeMarkdownPath: relative.startsWith('.') ? relative : `./${relative}`,
  };
}

export function mimeTypeForPath(filePath: string): string | null {
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return types[path.extname(filePath).toLowerCase()] ?? null;
}
