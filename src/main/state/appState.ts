import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import type { AppStateData, RecoveryEntry } from '../../shared/types';
import { FileSystemError, toFileSystemError } from '../filesystem/errors';
import { normalizeAbsolutePath } from '../filesystem/paths';

const DEFAULT_STATE: AppStateData = {
  recentFiles: [],
  recentWorkspaces: [],
  lastWorkspace: null,
  openFiles: [],
};

function stateFilePath(): string {
  return path.join(app.getPath('userData'), 'app-state.json');
}

function normalizePathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const paths: string[] = [];
  for (const item of value.slice(0, 30)) {
    try {
      const normalized = normalizeAbsolutePath(item);
      if (!paths.includes(normalized)) paths.push(normalized);
    } catch {
      // Ignore stale or malformed persisted entries.
    }
  }
  return paths;
}

export function validateAppState(value: unknown): AppStateData {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_STATE };
  const candidate = value as Partial<AppStateData>;
  let lastWorkspace: string | null = null;
  if (candidate.lastWorkspace !== null && candidate.lastWorkspace !== undefined) {
    try {
      lastWorkspace = normalizeAbsolutePath(candidate.lastWorkspace);
    } catch {
      lastWorkspace = null;
    }
  }
  return {
    recentFiles: normalizePathList(candidate.recentFiles),
    recentWorkspaces: normalizePathList(candidate.recentWorkspaces),
    lastWorkspace,
    openFiles: normalizePathList(candidate.openFiles),
  };
}

export async function loadAppState(): Promise<AppStateData> {
  try {
    const raw = await fs.readFile(stateFilePath(), 'utf8');
    return validateAppState(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE };
  }
}

async function atomicJsonWrite(filePath: string, value: unknown): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${randomBytes(5).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw toFileSystemError(error, 'Could not save application state');
  }
}

export async function saveAppState(value: unknown): Promise<void> {
  await atomicJsonWrite(stateFilePath(), validateAppState(value));
}

function recoveryDirectory(): string {
  return path.join(app.getPath('userData'), 'recovery');
}

function recoveryFile(id: string): string {
  const digest = createHash('sha256').update(id).digest('hex');
  return path.join(recoveryDirectory(), `${digest}.json`);
}

export function validateRecoveryEntry(value: unknown): RecoveryEntry {
  if (typeof value !== 'object' || value === null) {
    throw new FileSystemError('INVALID_PATH', 'Invalid recovery entry.');
  }
  const entry = value as Partial<RecoveryEntry>;
  if (
    typeof entry.id !== 'string' ||
    entry.id.length === 0 ||
    entry.id.length > 5000 ||
    typeof entry.displayName !== 'string' ||
    typeof entry.markdown !== 'string' ||
    typeof entry.savedContent !== 'string' ||
    Buffer.byteLength(entry.markdown, 'utf8') > 64 * 1024 * 1024 ||
    (entry.encoding !== 'utf-8' && entry.encoding !== 'utf-8-bom') ||
    !['LF', 'CRLF', 'MIXED', 'NONE'].includes(entry.lineEnding ?? '')
  ) {
    throw new FileSystemError('INVALID_PATH', 'Invalid recovery entry.');
  }
  const absolutePath =
    entry.absolutePath === null ? null : normalizeAbsolutePath(entry.absolutePath);
  return {
    id: entry.id,
    absolutePath,
    displayName: entry.displayName.slice(0, 500),
    markdown: entry.markdown,
    savedContent: entry.savedContent,
    encoding: entry.encoding,
    lineEnding: entry.lineEnding as RecoveryEntry['lineEnding'],
    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
  };
}

export async function listRecoveryEntries(): Promise<RecoveryEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(recoveryDirectory());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw toFileSystemError(error, 'Could not read recovery data');
  }
  const entries: RecoveryEntry[] = [];
  for (const name of names.filter((item) => item.endsWith('.json')).slice(0, 50)) {
    try {
      const raw = await fs.readFile(path.join(recoveryDirectory(), name), 'utf8');
      entries.push(validateRecoveryEntry(JSON.parse(raw) as unknown));
    } catch {
      // A corrupt recovery record must not block valid recovery records.
    }
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveRecoveryEntry(value: unknown): Promise<void> {
  const entry = validateRecoveryEntry(value);
  await atomicJsonWrite(recoveryFile(entry.id), entry);
}

export async function removeRecoveryEntry(id: unknown): Promise<void> {
  if (typeof id !== 'string' || id.length === 0 || id.length > 5000) {
    throw new FileSystemError('INVALID_PATH', 'Invalid recovery identifier.');
  }
  await fs.rm(recoveryFile(id), { force: true });
}
