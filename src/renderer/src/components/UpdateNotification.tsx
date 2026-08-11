import { Download, RefreshCw, RotateCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UpdateState } from '../../../shared/types';
import { hasUnsavedChanges, useDocumentStore } from '../stores/documentStore';

const IDLE_UPDATE: UpdateState = { phase: 'idle' };

export function UpdateNotification(): React.JSX.Element | null {
  const [update, setUpdate] = useState<UpdateState>(IDLE_UPDATE);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [downloadProgressHidden, setDownloadProgressHidden] = useState(false);
  const [saveReminder, setSaveReminder] = useState(false);
  const documents = useDocumentStore((store) => store.documents);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = window.desktopAPI.onUpdateState((next) => {
      if (!disposed) {
        setUpdate(next);
        if (next.phase !== 'ready') setSaveReminder(false);
        if (next.phase !== 'downloading') setDownloadProgressHidden(false);
      }
    });
    void window.desktopAPI.getUpdateState().then((next) => {
      if (!disposed) setUpdate(next);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  if (update.phase === 'idle') return null;
  if (update.phase === 'downloading' && downloadProgressHidden) return null;
  if (update.phase !== 'installing' && dismissedVersion === update.version) return null;

  const postpone = (): void => {
    setDismissedVersion(update.version);
    setSaveReminder(false);
  };

  const install = (): void => {
    if (hasUnsavedChanges({ documents })) {
      setSaveReminder(true);
      return;
    }
    void window.desktopAPI.installUpdate();
  };

  return (
    <section className={`update-notification phase-${update.phase}`} aria-live="polite">
      <div className="update-icon" aria-hidden="true">
        {update.phase === 'ready' || update.phase === 'installing' ? (
          <RotateCw size={17} />
        ) : (
          <Download size={17} />
        )}
      </div>
      <div className="update-copy">
        {update.phase === 'available' && (
          <>
            <strong>mdPad {update.version} is available.</strong>
            <span>Download it in the background whenever convenient.</span>
          </>
        )}
        {update.phase === 'downloading' && (
          <>
            <strong>
              Downloading mdPad {update.version}… {update.percent}%
            </strong>
            <span>You can keep working while the update downloads.</span>
            <span className="update-progress" aria-hidden="true">
              <span style={{ width: `${update.percent}%` }} />
            </span>
          </>
        )}
        {update.phase === 'download-error' && (
          <>
            <strong>The update download paused.</strong>
            <span>Nothing changed. Retry later whenever a connection is available.</span>
          </>
        )}
        {update.phase === 'ready' && (
          <>
            <strong>mdPad {update.version} is ready to install.</strong>
            <span>
              {saveReminder
                ? 'Save or close unsaved documents before restarting.'
                : 'Install it now and restart mdPad automatically.'}
            </span>
          </>
        )}
        {update.phase === 'installing' && (
          <>
            <strong>Installing mdPad {update.version}…</strong>
            <span>mdPad will restart automatically.</span>
          </>
        )}
      </div>
      <div className="update-actions">
        {update.phase === 'available' && (
          <button
            type="button"
            className="primary"
            onClick={() => void window.desktopAPI.downloadUpdate()}
          >
            Download update
          </button>
        )}
        {update.phase === 'download-error' && (
          <button
            type="button"
            className="primary"
            onClick={() => void window.desktopAPI.downloadUpdate()}
          >
            <RefreshCw size={13} /> Retry
          </button>
        )}
        {update.phase === 'ready' && (
          <button type="button" className="primary" onClick={install}>
            Install and restart
          </button>
        )}
        {update.phase !== 'downloading' && update.phase !== 'installing' && (
          <button type="button" onClick={postpone}>
            Later
          </button>
        )}
        {update.phase === 'downloading' && (
          <button
            type="button"
            className="icon-only"
            title="Hide update progress"
            onClick={() => setDownloadProgressHidden(true)}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </section>
  );
}
