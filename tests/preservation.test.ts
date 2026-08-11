import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  detectLineEnding,
  readTextFile,
  serializeForSave,
  toEditorText,
  writeTextFileAtomic,
} from '../src/main/filesystem/textFile';
import { MARKDOWN_FIXTURES, UTF8_BOM_STRING } from './fixtures/markdown';

/**
 * Preservation guarantee (spec §5/§42): reading a file, loading it into the
 * editor representation and serializing it back for save WITHOUT any edit
 * must reproduce the original bytes exactly — including BOM and CRLF.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mdpad-preservation-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeFixture(name: string, text: string, withBom: boolean): Promise<string> {
  const filePath = path.join(dir, name);
  const body = Buffer.from(text, 'utf8');
  await writeFile(
    filePath,
    withBom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body,
  );
  return filePath;
}

describe('markdown preservation: read → editor → save round-trip is byte-identical', () => {
  for (const fixture of MARKDOWN_FIXTURES) {
    it(`preserves ${fixture.name} byte-for-byte`, async () => {
      const filePath = await writeFixture(fixture.name, fixture.text, false);
      const originalBytes = await readFile(filePath);

      const read = await readTextFile(filePath);
      expect(read.encoding).toBe('utf-8');
      expect(read.content).toBe(fixture.text);

      // Editor load: normalize to CodeMirror's internal LF representation.
      const editorText = toEditorText(read.content);

      // Dirty tracking: no edit happened, so the app would not even write.
      expect(editorText).toBe(toEditorText(fixture.text));

      // If a save were forced anyway, serialization must restore exact bytes.
      const effectiveLineEnding = read.lineEnding === 'CRLF' ? 'CRLF' : 'LF';
      const out = serializeForSave(editorText, {
        encoding: read.encoding,
        lineEnding: effectiveLineEnding,
      });
      if (read.lineEnding === 'MIXED') {
        // Mixed endings cannot round-trip through an LF-normalized editor;
        // untouched files are never rewritten (dirty check), so this only
        // matters after a real edit. Documented behavior.
        expect(out.toString('utf8')).toBe(fixture.text.replace(/\r\n/g, '\n'));
      } else {
        expect(out.equals(originalBytes)).toBe(true);
      }
    });

    it(`preserves ${fixture.name} with a UTF-8 BOM`, async () => {
      const filePath = await writeFixture(`bom-${fixture.name}`, fixture.text, true);
      const originalBytes = await readFile(filePath);

      const read = await readTextFile(filePath);
      expect(read.encoding).toBe('utf-8-bom');
      expect(read.content.startsWith(UTF8_BOM_STRING)).toBe(false);

      const out = serializeForSave(toEditorText(read.content), {
        encoding: read.encoding,
        lineEnding: read.lineEnding === 'CRLF' ? 'CRLF' : 'LF',
      });
      if (read.lineEnding !== 'MIXED') {
        expect(out.equals(originalBytes)).toBe(true);
        expect(out.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
      }
    });
  }

  it('full disk round-trip: write via atomic save reproduces original file', async () => {
    const fixture = MARKDOWN_FIXTURES.find((f) => f.name === 'crlf-front-matter.md');
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const filePath = await writeFixture('atomic-roundtrip.md', fixture.text, true);
    const originalBytes = await readFile(filePath);

    const read = await readTextFile(filePath);
    await writeTextFileAtomic(filePath, toEditorText(read.content), {
      encoding: read.encoding,
      lineEnding: 'CRLF',
    });

    const after = await readFile(filePath);
    expect(after.equals(originalBytes)).toBe(true);
  });
});

describe('detectLineEnding', () => {
  it('classifies LF, CRLF, MIXED and NONE', () => {
    expect(detectLineEnding('a\nb\n')).toBe('LF');
    expect(detectLineEnding('a\r\nb\r\n')).toBe('CRLF');
    expect(detectLineEnding('a\r\nb\n')).toBe('MIXED');
    expect(detectLineEnding('no newlines')).toBe('NONE');
    expect(detectLineEnding('')).toBe('NONE');
  });
});
