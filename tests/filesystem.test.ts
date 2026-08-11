import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileSystemError } from '../src/main/filesystem/errors';
import { normalizeAbsolutePath, resolveWithin } from '../src/main/filesystem/paths';
import {
  readTextFile,
  serializeForSave,
  writeTextFileAtomic,
} from '../src/main/filesystem/textFile';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mdpad-fs-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readTextFile', () => {
  it('reads a UTF-8 file and reports size', async () => {
    const filePath = path.join(dir, 'read-me.md');
    await writeFile(filePath, '# Hello\n', 'utf8');
    const result = await readTextFile(filePath);
    expect(result.content).toBe('# Hello\n');
    expect(result.encoding).toBe('utf-8');
    expect(result.lineEnding).toBe('LF');
    expect(result.sizeBytes).toBe(8);
  });

  it('rejects a missing file with NOT_FOUND', async () => {
    await expect(readTextFile(path.join(dir, 'does-not-exist.md'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a directory with IS_DIRECTORY', async () => {
    await expect(readTextFile(dir)).rejects.toMatchObject({ code: 'IS_DIRECTORY' });
  });

  it('rejects non-UTF-8 bytes instead of corrupting them', async () => {
    const filePath = path.join(dir, 'latin1.md');
    await writeFile(filePath, Buffer.from([0x63, 0x61, 0x66, 0xe9])); // "café" in Latin-1
    await expect(readTextFile(filePath)).rejects.toMatchObject({ code: 'INVALID_UTF8' });
  });

  it('rejects relative and malformed paths', async () => {
    await expect(readTextFile('relative/file.md')).rejects.toMatchObject({
      code: 'INVALID_PATH',
    });
    await expect(readTextFile('')).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });
});

describe('writeTextFileAtomic', () => {
  it('writes a new file and returns its byte size', async () => {
    const filePath = path.join(dir, 'write-me.md');
    const size = await writeTextFileAtomic(filePath, '# New\n', {
      encoding: 'utf-8',
      lineEnding: 'LF',
    });
    expect(size).toBe(6);
    expect(await readFile(filePath, 'utf8')).toBe('# New\n');
  });

  it('replaces an existing file (rename-over) and leaves no temp files', async () => {
    const filePath = path.join(dir, 'replace-me.md');
    await writeFile(filePath, 'old content', 'utf8');
    await writeTextFileAtomic(filePath, 'new content', {
      encoding: 'utf-8',
      lineEnding: 'LF',
    });
    expect(await readFile(filePath, 'utf8')).toBe('new content');
    const leftovers = (await readdir(dir)).filter((f) => f.includes('.tmp-mdpad'));
    expect(leftovers).toEqual([]);
  });

  it('cleans up the temp file when the write target is invalid', async () => {
    // A path whose parent is a file → ENOTDIR on every platform.
    const blocker = path.join(dir, 'blocker');
    await writeFile(blocker, 'x', 'utf8');
    const badTarget = path.join(blocker, 'nested.md');
    await expect(
      writeTextFileAtomic(badTarget, 'content', { encoding: 'utf-8', lineEnding: 'LF' }),
    ).rejects.toBeInstanceOf(FileSystemError);
    const leftovers = (await readdir(dir)).filter((f) => f.includes('.tmp-mdpad'));
    expect(leftovers).toEqual([]);
  });

  it('fails with IS_DIRECTORY when the target is a folder', async () => {
    await expect(
      writeTextFileAtomic(dir, 'content', { encoding: 'utf-8', lineEnding: 'LF' }),
    ).rejects.toMatchObject({ code: 'IS_DIRECTORY' });
  });

  it('writes CRLF and BOM correctly on save', async () => {
    const filePath = path.join(dir, 'crlf-bom.md');
    await writeTextFileAtomic(filePath, 'a\nb\n', { encoding: 'utf-8-bom', lineEnding: 'CRLF' });
    const bytes = await readFile(filePath);
    expect(
      bytes.equals(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a\r\nb\r\n')])),
    ).toBe(true);
  });
});

describe('path validation', () => {
  it('normalizeAbsolutePath rejects traversal-shaped relative paths and null bytes', () => {
    expect(() => normalizeAbsolutePath('../../etc/passwd')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PATH' }) as Error,
    );
    expect(() => normalizeAbsolutePath('bad\0path')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PATH' }) as Error,
    );
  });

  it('resolveWithin allows children and rejects escapes', () => {
    const root = path.join(dir, 'workspace');
    expect(resolveWithin(root, 'notes/todo.md')).toBe(path.resolve(root, 'notes/todo.md'));
    expect(() => resolveWithin(root, '../outside.md')).toThrowError(
      expect.objectContaining({ code: 'PATH_TRAVERSAL' }) as Error,
    );
    expect(() => resolveWithin(root, '../../..')).toThrowError(
      expect.objectContaining({ code: 'PATH_TRAVERSAL' }) as Error,
    );
  });

  it('handles Unicode, spaces and Windows separators', async () => {
    const { mkdir } = await import('node:fs/promises');
    const sub = path.join(dir, 'dossier été 文');
    await mkdir(sub, { recursive: true });
    const filePath = path.join(sub, 'my notes.md');
    await writeFile(filePath, 'unicode path ok', 'utf8');
    const result = await readTextFile(filePath);
    expect(result.content).toBe('unicode path ok');
    const info = await stat(filePath);
    expect(info.isFile()).toBe(true);
  });
});

describe('serializeForSave', () => {
  it('does not alter LF content when saving as LF', () => {
    const out = serializeForSave('a\nb\n', { encoding: 'utf-8', lineEnding: 'LF' });
    expect(out.toString('utf8')).toBe('a\nb\n');
  });

  it('converts LF to CRLF when the original document was CRLF', () => {
    const out = serializeForSave('a\nb\n', { encoding: 'utf-8', lineEnding: 'CRLF' });
    expect(out.toString('utf8')).toBe('a\r\nb\r\n');
  });
});
