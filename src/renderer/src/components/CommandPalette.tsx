import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';
import { useSettingsStore, type ViewMode } from '../stores/settingsStore';
import { flattenWorkspaceEntries, useWorkspaceStore } from '../stores/workspaceStore';

interface CommandPaletteProps {
  onClose(): void;
  onOpenSettings(): void;
  onOpenWorkspaceSearch(): void;
}

interface PaletteItem {
  id: string;
  label: string;
  detail: string;
  run(): void;
}

export function CommandPalette({
  onClose,
  onOpenSettings,
  onOpenWorkspaceSearch,
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const workspace = useWorkspaceStore((state) => state.workspace);
  const items = useMemo<PaletteItem[]>(() => {
    const documents = useDocumentStore.getState();
    const settings = useSettingsStore.getState();
    const setMode = (mode: ViewMode) => settings.setViewMode(mode);
    const commands: PaletteItem[] = [
      { id: 'new', label: 'New document', detail: 'Ctrl+N', run: documents.newDocument },
      {
        id: 'open',
        label: 'Open file…',
        detail: 'Ctrl+O',
        run: () => void documents.openFileViaDialog(),
      },
      {
        id: 'folder',
        label: 'Open workspace folder…',
        detail: 'Ctrl+Shift+O',
        run: () => void useWorkspaceStore.getState().openWorkspace(),
      },
      {
        id: 'save',
        label: 'Save document',
        detail: 'Ctrl+S',
        run: () => void documents.saveActive(),
      },
      {
        id: 'source',
        label: 'Switch to Source mode',
        detail: 'Ctrl+1',
        run: () => setMode('source'),
      },
      {
        id: 'visual',
        label: 'Switch to Visual mode',
        detail: 'Ctrl+2',
        run: () => setMode('visual'),
      },
      {
        id: 'preview',
        label: 'Switch to Preview mode',
        detail: 'Ctrl+3',
        run: () => setMode('preview'),
      },
      { id: 'split', label: 'Switch to Split mode', detail: 'Ctrl+4', run: () => setMode('split') },
      { id: 'theme', label: 'Cycle color theme', detail: '', run: settings.cycleTheme },
      {
        id: 'search',
        label: 'Search workspace',
        detail: 'Ctrl+Shift+F',
        run: onOpenWorkspaceSearch,
      },
      { id: 'settings', label: 'Open preferences', detail: 'Ctrl+,', run: onOpenSettings },
    ];
    if (workspace) {
      commands.push(
        ...flattenWorkspaceEntries(workspace.entries)
          .filter((entry) => entry.type === 'file')
          .map((entry) => ({
            id: `file-${entry.relativePath}`,
            label: entry.name,
            detail: entry.relativePath,
            run: () => void useDocumentStore.getState().openFilePath(entry.absolutePath),
          })),
      );
    }
    return commands;
  }, [onOpenSettings, onOpenWorkspaceSearch, workspace]);
  const filtered = items
    .filter((item) =>
      `${item.label} ${item.detail}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .slice(0, 50);
  const choose = (item: PaletteItem): void => {
    item.run();
    onClose();
  };
  return (
    <div
      className="modal-backdrop palette-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="palette-input">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            placeholder="Type a command or file name"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter' && filtered[0]) choose(filtered[0]);
            }}
          />
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="palette-results">
          {filtered.map((item) => (
            <button key={item.id} onClick={() => choose(item)}>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="palette-empty">No matching commands or files.</div>
          )}
        </div>
      </section>
    </div>
  );
}
