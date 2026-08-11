import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { markdownFilePathsFromArguments } from '../src/main/launch/arguments';

describe('Windows launch arguments', () => {
  it('extracts associated Markdown files and ignores executable/options', () => {
    const workingDirectory = path.resolve('C:/documents');
    const result = markdownFilePathsFromArguments(
      [
        'C:/Program Files/mdPad/mdPad.exe',
        '--opened-from-shell',
        'notes.md',
        'C:/documents/README.MARKDOWN',
        'unrelated.txt',
      ],
      workingDirectory,
    );

    expect(result).toEqual([
      path.resolve(workingDirectory, 'notes.md'),
      path.normalize('C:/documents/README.MARKDOWN'),
    ]);
  });

  it('unquotes and de-duplicates the selected file path', () => {
    const markdownPath = path.resolve('C:/documents/My notes.md');
    const result = markdownFilePathsFromArguments(
      [`"${markdownPath}"`, markdownPath.toLocaleUpperCase()],
      path.dirname(markdownPath),
    );

    expect(result).toEqual([markdownPath]);
  });
});
