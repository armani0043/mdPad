import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import type {
  LineEnding,
  ReadTextFileResult,
  SaveSerializationOptions,
  TextEncoding,
} from '../../shared/types';
import { toEditorText } from '../../shared/text/editorText';
import { FileSystemError, toFileSystemError } from './errors';
import { normalizeAbsolutePath, tempPathFor } from './paths';

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Largest file we will load into the editor in this phase (64 MiB). */
export const MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;

/** Detect the dominant line-ending style of a raw string. */
export function detectLineEnding(content: string): LineEnding {
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) {
      if (i > 0 && content.charCodeAt(i - 1) === 13) {
        crlf += 1;
      } else {
        lf += 1;
      }
    }
  }
  if (crlf === 0 && lf === 0) return 'NONE';
  if (crlf > 0 && lf === 0) return 'CRLF';
  if (lf > 0 && crlf === 0) return 'LF';
  return 'MIXED';
}

export { toEditorText };

/**
 * Serialize LF-normalized editor content back to the bytes that must land on
 * disk, restoring the original line-ending style and BOM.
 */
export function serializeForSave(editorContent: string, options: SaveSerializationOptions): Buffer {
  const withLineEndings =
    options.lineEnding === 'CRLF' ? editorContent.replace(/\n/g, '\r\n') : editorContent;
  const body = Buffer.from(withLineEndings, 'utf8');
  return options.encoding === 'utf-8-bom' ? Buffer.concat([UTF8_BOM, body]) : body;
}

function decodeUtf8(buffer: Buffer): { content: string; encoding: TextEncoding } {
  const hasBom = buffer.length >= 3 && buffer.subarray(0, 3).equals(UTF8_BOM);
  const body = hasBom ? buffer.subarray(3) : buffer;
  // Fatal decoding: a file that is not valid UTF-8 is rejected instead of
  // silently corrupting it with replacement characters.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return { content: decoder.decode(body), encoding: hasBom ? 'utf-8-bom' : 'utf-8' };
  } catch {
    throw new FileSystemError(
      'INVALID_UTF8',
      'The file is not valid UTF-8. mdPad currently supports UTF-8 files only.',
    );
  }
}

/**
 * Read a UTF-8 text file byte-faithfully. The returned content keeps its
 * original line endings; only the BOM is stripped (tracked via `encoding`).
 */
export async function readTextFile(absolutePathInput: string): Promise<ReadTextFileResult> {
  const absolutePath = normalizeAbsolutePath(absolutePathInput);
  let buffer: Buffer;
  try {
    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      throw new FileSystemError('IS_DIRECTORY', 'The path is a folder, not a file.');
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      throw new FileSystemError(
        'INVALID_PATH',
        'The file is too large to open in this version (limit 64 MiB).',
      );
    }
    buffer = await fs.readFile(absolutePath);
  } catch (err) {
    throw toFileSystemError(err, 'Could not open file');
  }
  const { content, encoding } = decodeUtf8(buffer);
  return {
    content,
    encoding,
    lineEnding: detectLineEnding(content),
    sizeBytes: buffer.length,
  };
}

/**
 * Atomically write a text file: write to a temp file in the same directory,
 * then rename over the target. The target is never left half-written; the
 * temp file is cleaned up on failure.
 */
export async function writeTextFileAtomic(
  absolutePathInput: string,
  editorContent: string,
  options: SaveSerializationOptions,
): Promise<number> {
  const absolutePath = normalizeAbsolutePath(absolutePathInput);
  const data = serializeForSave(editorContent, options);
  // Give a precise error when the target is a directory (on Windows the
  // rename below would otherwise surface a misleading EPERM).
  try {
    const target = await fs.stat(absolutePath);
    if (target.isDirectory()) {
      throw new FileSystemError('IS_DIRECTORY', 'Could not save file: the path is a folder.');
    }
  } catch (err) {
    if (err instanceof FileSystemError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw toFileSystemError(err, 'Could not save file');
    }
  }
  const tempPath = tempPathFor(absolutePath, randomBytes(6).toString('hex'));
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(tempPath, 'wx');
    await handle.writeFile(data);
    // Flush the complete temporary file before making it visible at the
    // destination path.
    await handle.sync();
    await handle.close();
    handle = null;
  } catch (err) {
    await handle?.close().catch(() => undefined);
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw toFileSystemError(err, 'Could not save file');
  }
  try {
    // On Windows, Node's rename replaces an existing destination file.
    await fs.rename(tempPath, absolutePath);
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw toFileSystemError(err, 'Could not save file');
  }
  return data.length;
}
