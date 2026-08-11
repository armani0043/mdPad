import {
  charCountOf,
  getActiveDocument,
  isModified,
  useDocumentStore,
  wordCountOf,
} from '../stores/documentStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

function formatEncoding(encoding: string): string {
  return encoding === 'utf-8-bom' ? 'UTF-8 with BOM' : 'UTF-8';
}

/** Status bar: language, counts, cursor, encoding, line ending, save state. */
export function StatusBar(): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents);
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId);
  const cursor = useDocumentStore((s) => s.cursor);
  const lastError = useDocumentStore((s) => s.lastError);
  const workspaceError = useWorkspaceStore((s) => s.lastError);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const viewMode = useSettingsStore((s) => s.viewMode);

  const doc = getActiveDocument({ documents, activeDocumentId });
  const modified = doc !== null && isModified(doc);

  return (
    <footer className="status-bar" aria-label="Status bar">
      {(lastError ?? workspaceError) ? (
        <span
          className="status-error"
          role="alert"
          title={(lastError ?? workspaceError)?.detail ?? (lastError ?? workspaceError)?.message}
        >
          {(lastError ?? workspaceError)?.message}
        </span>
      ) : (
        <span className="status-item">Markdown</span>
      )}
      <span className="spacer" />
      {workspace && (
        <span className="status-item" title={workspace.rootPath}>
          {workspace.displayName}
        </span>
      )}
      <span className="status-item status-mode">
        {viewMode === 'preview'
          ? 'Reading'
          : viewMode === 'visual'
            ? 'Visual'
            : viewMode === 'split'
              ? 'Source + Preview'
              : 'Source'}
      </span>
      <span className="status-item">{wordCountOf(doc).toLocaleString()} words</span>
      <span className="status-item">{charCountOf(doc).toLocaleString()} chars</span>
      <span className="status-item">
        Ln {cursor.line}, Col {cursor.column}
      </span>
      <span className="status-item">{doc ? formatEncoding(doc.encoding) : 'UTF-8'}</span>
      <span className="status-item">{doc ? doc.lineEnding : 'LF'}</span>
      <span
        className={modified ? 'status-item status-save-state modified' : 'status-item'}
        aria-live="polite"
      >
        {doc?.externalModificationState === 'conflict'
          ? 'Conflict'
          : doc?.recovered
            ? 'Recovered'
            : modified
              ? 'Modified'
              : 'Saved'}
      </span>
    </footer>
  );
}
