import type { LineEnding } from '../types';

export interface SaveTrackedDocument {
  absolutePath: string | null;
  markdown: string;
  savedContent: string;
  lineEnding: LineEnding;
}

export type SaveAction = 'none' | 'save-as' | 'write';

/** Decide whether Save is a no-op, a native Save As, or an existing-file write. */
export function saveActionFor(document: SaveTrackedDocument): SaveAction {
  if (document.absolutePath === null) return 'save-as';
  return document.markdown === document.savedContent ? 'none' : 'write';
}

export function isTrackedDocumentModified(document: SaveTrackedDocument): boolean {
  return document.markdown !== document.savedContent;
}

/**
 * Mark exactly the snapshot that reached disk as saved. If the editor changed
 * while the asynchronous write was running, those newer edits remain dirty.
 */
export function markContentSaved<T extends SaveTrackedDocument>(
  document: T,
  savedContent: string,
  lineEnding: 'LF' | 'CRLF',
): T {
  return { ...document, savedContent, lineEnding };
}
