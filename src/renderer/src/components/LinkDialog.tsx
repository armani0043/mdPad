import { useEffect, useState } from 'react';
import { Link, X } from 'lucide-react';

interface LinkDialogProps {
  onInsert(url: string): void;
  onClose(): void;
}

export function normalizeLinkTarget(value: string): string {
  const target = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return `mailto:${target}`;
  if (/^(?:[a-z][a-z\d+.-]*:|#|\.\.?\/|\/)/i.test(target)) return target;
  return `https://${target}`;
}

export function LinkDialog({ onInsert, onClose }: LinkDialogProps): React.JSX.Element {
  const [url, setUrl] = useState('https://');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const submit = (): void => {
    const value = url.trim();
    if (!value || value === 'https://') return;
    onInsert(normalizeLinkTarget(value));
  };

  return (
    <div className="modal-backdrop link-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Link size={20} />
            <strong id="link-dialog-title">Insert link</strong>
          </div>
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <label>
          Web address or email link
          <input
            autoFocus
            value={url}
            inputMode="url"
            placeholder="https://example.com"
            onChange={(event) => setUrl(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
        </label>
        <p>
          Selected text will become the link. With no selection, mdPad uses the address as the
          label.
        </p>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!url.trim() || url.trim() === 'https://'}
            onClick={submit}
          >
            Insert link
          </button>
        </footer>
      </section>
    </div>
  );
}
