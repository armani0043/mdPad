import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  MoreHorizontal,
  Move,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { WorkspaceEntry, WorkspaceSearchResult } from '../../../shared/types';
import { extractOutline, extractTags } from '../markdown/markdown';
import { getActiveDocument, useDocumentStore } from '../stores/documentStore';
import {
  flattenWorkspaceEntries,
  parentFolderForSelection,
  useWorkspaceStore,
} from '../stores/workspaceStore';

export type SidebarView = 'files' | 'search' | 'outline' | 'backlinks' | 'tags';

interface SidebarProps {
  view: SidebarView;
  onClose(): void;
  onViewChange(view: SidebarView): void;
}

interface TreeEntryProps {
  entry: WorkspaceEntry;
  depth: number;
}

function TreeEntry({ entry, depth }: TreeEntryProps): React.JSX.Element {
  const expanded = useWorkspaceStore((state) => state.expandedFolders.has(entry.relativePath));
  const selected = useWorkspaceStore((state) => state.selectedRelativePath === entry.relativePath);
  const toggleFolder = useWorkspaceStore((state) => state.toggleFolder);
  const select = useWorkspaceStore((state) => state.select);
  const openFilePath = useDocumentStore((state) => state.openFilePath);
  const isFolder = entry.type === 'folder';
  return (
    <>
      <button
        type="button"
        className={selected ? 'tree-entry selected' : 'tree-entry'}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        title={entry.relativePath}
        onClick={() => {
          select(entry.relativePath);
          if (isFolder) toggleFolder(entry.relativePath);
          else void openFilePath(entry.absolutePath);
        }}
      >
        <span className="tree-chevron">
          {isFolder ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </span>
        {isFolder ? (
          expanded ? (
            <FolderOpen size={15} />
          ) : (
            <Folder size={15} />
          )
        ) : (
          <FileText size={14} />
        )}
        <span className="tree-label">{entry.name}</span>
      </button>
      {isFolder &&
        expanded &&
        (entry.children ?? []).map((child) => (
          <TreeEntry key={child.relativePath} entry={child} depth={depth + 1} />
        ))}
    </>
  );
}

export function Sidebar({ view, onClose, onViewChange }: SidebarProps): React.JSX.Element {
  const [backlinks, setBacklinks] = useState<WorkspaceSearchResult[]>([]);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const selected = useWorkspaceStore((state) => state.selectedRelativePath);
  const searchQuery = useWorkspaceStore((state) => state.searchQuery);
  const searchResults = useWorkspaceStore((state) => state.searchResults);
  const searchBusy = useWorkspaceStore((state) => state.searchBusy);
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const search = useWorkspaceStore((state) => state.search);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const revealLocation = useDocumentStore((state) => state.revealLocation);
  const active = getActiveDocument({ documents, activeDocumentId });
  const outline = useMemo(() => extractOutline(active?.markdown ?? ''), [active?.markdown]);
  const tags = useMemo(() => extractTags(active?.markdown ?? ''), [active?.markdown]);

  useEffect(() => {
    let cancelled = false;
    if (view !== 'backlinks' || !workspace || !active?.absolutePath) {
      return;
    }
    const documentName = active.displayName
      .replace(/ \(Recovered\)$/, '')
      .replace(/\.(md|markdown)$/i, '');
    void window.desktopAPI
      .searchWorkspace({
        rootPath: workspace.rootPath,
        query: `[[${documentName}`,
        caseSensitive: false,
        wholeWord: false,
      })
      .then((result) => {
        if (cancelled || !result.ok) return;
        const unique = new Map<string, WorkspaceSearchResult>();
        for (const item of result.value) {
          if (item.absolutePath !== active.absolutePath && !unique.has(item.absolutePath)) {
            unique.set(item.absolutePath, item);
          }
        }
        setBacklinks([...unique.values()]);
      });
    return () => {
      cancelled = true;
    };
  }, [view, workspace, active?.absolutePath, active?.displayName]);

  const selectedEntry = workspace
    ? (flattenWorkspaceEntries(workspace.entries).find(
        (entry) => entry.relativePath === selected,
      ) ?? null)
    : null;
  const visibleBacklinks = workspace && active?.absolutePath ? backlinks : [];
  const parent = workspace ? parentFolderForSelection(workspace, selected) : '';

  const createFile = (): void => {
    const name = window.prompt('New Markdown file name', 'untitled.md');
    if (name) void useWorkspaceStore.getState().createFile(parent, name);
  };
  const createFolder = (): void => {
    const name = window.prompt('New folder name', 'New Folder');
    if (name) void useWorkspaceStore.getState().createFolder(parent, name);
  };

  return (
    <aside className="sidebar transient-sidebar" aria-label="Workspace navigation pane">
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <span>{view === 'files' ? (workspace?.displayName ?? 'Explorer') : view}</span>
          <div className="sidebar-actions">
            {view === 'files' && workspace && (
              <>
                <button title="New file" onClick={createFile}>
                  <FilePlus2 size={14} />
                </button>
                <button title="New folder" onClick={createFolder}>
                  <FolderPlus size={14} />
                </button>
                <button title="Refresh" onClick={() => void refresh()}>
                  <RefreshCw size={14} />
                </button>
              </>
            )}
            <button title="Open folder" onClick={() => void openWorkspace()}>
              <MoreHorizontal size={15} />
            </button>
            <button title="Close navigation pane" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {view === 'files' &&
          (workspace ? (
            <div className="tree-container">
              {workspace.entries.map((entry) => (
                <TreeEntry key={entry.relativePath} entry={entry} depth={0} />
              ))}
              {workspace.entries.length === 0 && (
                <div className="sidebar-empty">This folder has no visible files.</div>
              )}
            </div>
          ) : (
            <div className="sidebar-empty">
              <p>No folder opened.</p>
              <button className="primary-button" type="button" onClick={() => void openWorkspace()}>
                Open Folder
              </button>
            </div>
          ))}

        {view === 'search' && (
          <div className="search-panel">
            <div className="search-box">
              <Search size={14} />
              <input
                autoFocus
                value={searchQuery}
                placeholder="Search Markdown files"
                onChange={(event) => void search(event.target.value)}
              />
            </div>
            {searchBusy && <div className="sidebar-empty">Searching…</div>}
            <div className="search-results">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.absolutePath}-${result.line}-${index}`}
                  onClick={() =>
                    void revealLocation(result.absolutePath, result.line, result.column)
                  }
                >
                  <strong>{result.displayName}</strong>
                  <span>
                    Line {result.line} · {result.relativePath}
                  </span>
                  <small>{result.preview}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'outline' && (
          <div className="outline-list">
            {outline.map((heading) => (
              <button
                key={`${heading.line}-${heading.text}`}
                style={{ paddingLeft: `${10 + (heading.level - 1) * 12}px` }}
                onClick={() =>
                  active?.absolutePath && void revealLocation(active.absolutePath, heading.line)
                }
              >
                {heading.text}
              </button>
            ))}
            {outline.length === 0 && (
              <div className="sidebar-empty">No headings in this document.</div>
            )}
          </div>
        )}

        {view === 'tags' && (
          <div className="tag-list">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  onViewChange('search');
                  void search(`#${tag}`);
                }}
              >
                #{tag}
              </button>
            ))}
            {tags.length === 0 && <div className="sidebar-empty">No tags in this document.</div>}
          </div>
        )}

        {view === 'backlinks' && (
          <div className="search-results">
            {visibleBacklinks.map((result) => (
              <button
                key={result.absolutePath}
                onClick={() => void revealLocation(result.absolutePath, result.line, result.column)}
              >
                <strong>{result.displayName}</strong>
                <span>{result.relativePath}</span>
                <small>{result.preview}</small>
              </button>
            ))}
            {visibleBacklinks.length === 0 && (
              <div className="sidebar-empty">No documents link to this file.</div>
            )}
          </div>
        )}

        {view === 'files' && workspace && selectedEntry && (
          <div className="selection-actions">
            <span title={selectedEntry.relativePath}>{selectedEntry.name}</span>
            <button
              title="Rename"
              onClick={() => {
                const name = window.prompt('Rename entry', selectedEntry.name);
                if (name)
                  void useWorkspaceStore.getState().renameEntry(selectedEntry.relativePath, name);
              }}
            >
              <FileText size={14} />
            </button>
            <button
              title="Move to folder"
              onClick={() => {
                const destination = window.prompt(
                  'Move to folder (workspace-relative path; leave empty for workspace root)',
                  '',
                );
                if (destination !== null) {
                  void useWorkspaceStore
                    .getState()
                    .moveEntry(selectedEntry.relativePath, destination.trim());
                }
              }}
            >
              <Move size={14} />
            </button>
            <button
              title="Duplicate"
              onClick={() =>
                void useWorkspaceStore.getState().duplicateEntry(selectedEntry.relativePath)
              }
            >
              <Copy size={14} />
            </button>
            <button
              title="Reveal in File Explorer"
              onClick={() =>
                void useWorkspaceStore.getState().revealEntry(selectedEntry.relativePath)
              }
            >
              <FolderSearch size={14} />
            </button>
            <button
              title="Delete"
              onClick={() =>
                void useWorkspaceStore.getState().deleteEntry(selectedEntry.relativePath)
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
