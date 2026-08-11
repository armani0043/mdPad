/** @vitest-environment happy-dom */
/* Exercises the renderer document store with the DOM globals it expects. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { IpcResult, OpenedFilePayload } from '../src/shared/types';
import { useDocumentStore } from '../src/renderer/src/stores/documentStore';

function openedFile(absolutePath: string, content: string): IpcResult<OpenedFilePayload> {
  return {
    ok: true,
    value: {
      absolutePath,
      displayName: absolutePath.split(/[\\/]/).at(-1) ?? 'document.md',
      content,
      encoding: 'utf-8',
      lineEnding: 'LF',
      sizeBytes: content.length,
    },
  };
}

describe('files launched by Windows', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      documents: [],
      activeDocumentId: null,
      cursor: { line: 1, column: 1 },
      cursorRequest: null,
      recentlyClosed: [],
      lastError: null,
    });
  });

  it('replaces the automatic pristine blank document', () => {
    useDocumentStore.getState().newDocument();
    useDocumentStore
      .getState()
      .openLaunchFile(openedFile('C:\\documents\\selected.md', '# Selected'));

    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0]?.absolutePath).toBe('C:\\documents\\selected.md');
    expect(state.documents[0]?.markdown).toBe('# Selected');
    expect(state.activeDocumentId).toBe(state.documents[0]?.id);
  });

  it('keeps edited work and opens later launches as tabs without duplicates', () => {
    useDocumentStore.getState().newDocument();
    const draft = useDocumentStore.getState().documents[0];
    if (!draft) throw new Error('Expected an untitled document');
    useDocumentStore.getState().setContent(draft.id, 'Unsaved draft');

    const launched = openedFile('C:\\documents\\reference.md', 'Reference');
    useDocumentStore.getState().openLaunchFile(launched);
    useDocumentStore.getState().openLaunchFile(launched);

    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(2);
    expect(state.documents[0]?.markdown).toBe('Unsaved draft');
    expect(state.documents[1]?.absolutePath).toBe('C:\\documents\\reference.md');
    expect(state.activeDocumentId).toBe(state.documents[1]?.id);
  });
});
