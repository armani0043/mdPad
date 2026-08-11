import { describe, expect, it } from 'vitest';
import {
  isTrackedDocumentModified,
  markContentSaved,
  saveActionFor,
  type SaveTrackedDocument,
} from '../src/shared/text/saveTracking';

function document(overrides: Partial<SaveTrackedDocument> = {}): SaveTrackedDocument {
  return {
    absolutePath: 'C:\\notes\\document.md',
    markdown: '# Current',
    savedContent: '# Saved',
    lineEnding: 'CRLF',
    ...overrides,
  };
}

describe('save tracking', () => {
  it('opens Save As for a new empty document', () => {
    expect(saveActionFor(document({ absolutePath: null, markdown: '', savedContent: '' }))).toBe(
      'save-as',
    );
  });

  it('does not rewrite an untouched existing file', () => {
    expect(saveActionFor(document({ markdown: '# Same', savedContent: '# Same' }))).toBe('none');
  });

  it('writes a changed existing file', () => {
    expect(saveActionFor(document())).toBe('write');
  });

  it('keeps edits made during an asynchronous save marked dirty', () => {
    const changedDuringWrite = document({ markdown: 'second edit', savedContent: 'on disk' });
    const afterFirstWrite = markContentSaved(changedDuringWrite, 'first edit', 'LF');
    expect(afterFirstWrite.savedContent).toBe('first edit');
    expect(afterFirstWrite.markdown).toBe('second edit');
    expect(afterFirstWrite.lineEnding).toBe('LF');
    expect(isTrackedDocumentModified(afterFirstWrite)).toBe(true);
  });
});
