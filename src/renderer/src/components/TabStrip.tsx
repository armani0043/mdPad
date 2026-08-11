import { MoreHorizontal, RotateCcw, X } from 'lucide-react';
import { isModified, useDocumentStore } from '../stores/documentStore';

export function TabStrip(): React.JSX.Element {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const recentlyClosed = useDocumentStore((state) => state.recentlyClosed);
  const activateDocument = useDocumentStore((state) => state.activateDocument);
  const closeDocument = useDocumentStore((state) => state.closeDocument);
  const closeOthers = useDocumentStore((state) => state.closeOthers);
  const closeAll = useDocumentStore((state) => state.closeAll);
  const reopenClosed = useDocumentStore((state) => state.reopenClosed);

  return (
    <div className="tab-strip" role="tablist" aria-label="Open documents">
      <div className="tabs-scroll">
        {documents.map((document) => (
          <div
            key={document.id}
            role="tab"
            aria-selected={document.id === activeDocumentId}
            className={document.id === activeDocumentId ? 'tab active' : 'tab'}
            title={document.absolutePath ?? document.displayName}
            onClick={() => activateDocument(document.id)}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                void closeDocument(document.id);
              }
            }}
          >
            {isModified(document) && (
              <span className="tab-dirty-dot" aria-label="Unsaved changes" />
            )}
            <span className="tab-name">{document.displayName}</span>
            <button
              type="button"
              className="tab-close"
              title="Close"
              onClick={(event) => {
                event.stopPropagation();
                void closeDocument(document.id);
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="tab-actions">
        {recentlyClosed.length > 0 && (
          <button type="button" title="Reopen closed tab" onClick={reopenClosed}>
            <RotateCcw size={14} />
          </button>
        )}
        <details>
          <summary title="Tab actions">
            <MoreHorizontal size={15} />
          </summary>
          <div className="tab-menu">
            <button
              type="button"
              disabled={!activeDocumentId}
              onClick={() => activeDocumentId && void closeOthers(activeDocumentId)}
            >
              Close Others
            </button>
            <button type="button" disabled={documents.length === 0} onClick={() => void closeAll()}>
              Close All
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
