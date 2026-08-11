import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createWorkspaceFile,
  createWorkspaceFolder,
  duplicateWorkspaceEntry,
  listWorkspace,
  renameWorkspaceEntry,
  saveAttachment,
  searchWorkspace,
  validateEntryName,
} from '../src/main/workspace/workspaceService';

const temporaryRoots: string[] = [];

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdpad-workspace-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe('workspace service', () => {
  it('lists nested Markdown files while hiding unrelated files by default', async () => {
    const root = await workspace();
    await fs.mkdir(path.join(root, 'notes'));
    await fs.writeFile(path.join(root, 'README.md'), '# Home');
    await fs.writeFile(path.join(root, 'notes', 'idea.markdown'), '# Idea');
    await fs.writeFile(path.join(root, 'binary.exe'), 'not shown');

    const payload = await listWorkspace(root, false);

    expect(payload.entries.map((entry) => entry.name)).toEqual(['notes', 'README.md']);
    expect(payload.entries[0]?.children?.[0]?.relativePath).toBe('notes/idea.markdown');
  });

  it('creates, renames and duplicates entries without leaving the workspace', async () => {
    const root = await workspace();
    await createWorkspaceFolder(root, '', 'Drafts');
    const created = await createWorkspaceFile(root, 'Drafts', 'chapter');
    expect(created).toBe(path.join(root, 'Drafts', 'chapter.md'));

    await renameWorkspaceEntry(root, 'Drafts/chapter.md', 'chapter-one.md');
    await duplicateWorkspaceEntry(root, 'Drafts/chapter-one.md');
    const files = (await fs.readdir(path.join(root, 'Drafts'))).sort();
    expect(files).toEqual(['chapter-one copy.md', 'chapter-one.md']);
  });

  it('rejects traversal and invalid Windows-style entry names', () => {
    expect(() => validateEntryName('../outside.md')).toThrow();
    expect(() => validateEntryName('folder/name.md')).toThrow();
    expect(() => validateEntryName('')).toThrow();
  });

  it('searches Markdown content locally with line and path context', async () => {
    const root = await workspace();
    await fs.writeFile(
      path.join(root, 'Research.md'),
      '# Research\nThe local-first result is here.',
    );

    const results = await searchWorkspace({
      rootPath: root,
      query: 'local-first',
      caseSensitive: false,
      wholeWord: false,
    });

    expect(results).toEqual([
      expect.objectContaining({ relativePath: 'Research.md', line: 2, column: 5 }),
    ]);
  });

  it('copies a picked image beside a saved document without requiring an open workspace', async () => {
    const root = await workspace();
    const documentPath = path.join(root, 'notes.md');
    await fs.writeFile(documentPath, '# Notes');

    const result = await saveAttachment({
      documentPath,
      workspaceRoot: null,
      relativeFolder: 'attachments',
      originalName: 'diagram.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]),
    });

    expect(result.relativeMarkdownPath).toMatch(/^\.\/attachments\/diagram-/);
    expect(await fs.readFile(result.absolutePath)).toEqual(Buffer.from([137, 80, 78, 71]));
  });
});
