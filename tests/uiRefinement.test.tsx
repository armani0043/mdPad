/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { compactDocumentName } from '../src/renderer/src/components/EditorToolbar';
import { normalizeLinkTarget } from '../src/renderer/src/components/LinkDialog';

describe('mdPad header title', () => {
  it('keeps short filenames unchanged', () => {
    expect(compactDocumentName('notes.md')).toBe('notes.md');
  });

  it('middle-truncates long filenames while preserving the extension', () => {
    const compact = compactDocumentName(
      'a-very-long-and-descriptive-document-name-that-must-not-overlap.markdown',
      34,
    );

    expect(compact.length).toBeLessThanOrEqual(34);
    expect(compact).toContain('…');
    expect(compact.endsWith('.markdown')).toBe(true);
  });
});

describe('Insert link target normalization', () => {
  it('accepts web addresses with or without a protocol', () => {
    expect(normalizeLinkTarget('example.com')).toBe('https://example.com');
    expect(normalizeLinkTarget('https://example.com/docs')).toBe('https://example.com/docs');
  });

  it('turns a plain email address into a mail link', () => {
    expect(normalizeLinkTarget('mdpad@olynors.com')).toBe('mailto:mdpad@olynors.com');
  });
});
