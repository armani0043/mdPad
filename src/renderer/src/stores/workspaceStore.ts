import { create } from 'zustand';
import type {
  FileErrorPayload,
  WorkspaceEntry,
  WorkspacePayload,
  WorkspaceSearchResult,
} from '../../../shared/types';
import { useSettingsStore } from './settingsStore';
import { useDocumentStore } from './documentStore';

interface WorkspaceState {
  workspace: WorkspacePayload | null;
  selectedRelativePath: string | null;
  expandedFolders: Set<string>;
  searchQuery: string;
  searchResults: WorkspaceSearchResult[];
  searchBusy: boolean;
  lastError: FileErrorPayload | null;
  openWorkspace(): Promise<void>;
  restoreWorkspace(rootPath: string): Promise<void>;
  refresh(): Promise<void>;
  select(relativePath: string | null): void;
  toggleFolder(relativePath: string): void;
  createFile(parentRelativePath: string, name: string): Promise<void>;
  createFolder(parentRelativePath: string, name: string): Promise<void>;
  renameEntry(relativePath: string, newName: string): Promise<void>;
  moveEntry(relativePath: string, targetFolderRelativePath: string): Promise<void>;
  deleteEntry(relativePath: string): Promise<void>;
  duplicateEntry(relativePath: string): Promise<void>;
  revealEntry(relativePath: string): Promise<void>;
  search(query: string, caseSensitive?: boolean, wholeWord?: boolean): Promise<void>;
  clearError(): void;
}

function updateWorkspace(
  payload: WorkspacePayload,
): Pick<WorkspaceState, 'workspace' | 'lastError'> {
  return { workspace: payload, lastError: null };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  selectedRelativePath: null,
  expandedFolders: new Set<string>(),
  searchQuery: '',
  searchResults: [],
  searchBusy: false,
  lastError: null,

  openWorkspace: async () => {
    const result = await window.desktopAPI.openFolderDialog(
      useSettingsStore.getState().showAllFiles,
    );
    if (!result.ok) return set({ lastError: result.error });
    if (!result.value) return;
    set({
      ...updateWorkspace(result.value),
      expandedFolders: new Set<string>(),
      selectedRelativePath: null,
      searchQuery: '',
      searchResults: [],
    });
  },

  restoreWorkspace: async (rootPath) => {
    const result = await window.desktopAPI.refreshWorkspace(
      rootPath,
      useSettingsStore.getState().showAllFiles,
    );
    if (!result.ok) return set({ lastError: result.error });
    set(updateWorkspace(result.value));
  },

  refresh: async () => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.refreshWorkspace(
      current.rootPath,
      useSettingsStore.getState().showAllFiles,
    );
    if (!result.ok) return set({ lastError: result.error });
    set(updateWorkspace(result.value));
  },

  select: (selectedRelativePath) => set({ selectedRelativePath }),
  toggleFolder: (relativePath) => {
    const next = new Set(get().expandedFolders);
    if (next.has(relativePath)) next.delete(relativePath);
    else next.add(relativePath);
    set({ expandedFolders: next, selectedRelativePath: relativePath });
  },

  createFile: async (parentRelativePath, name) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.createWorkspaceFile({
      rootPath: current.rootPath,
      parentRelativePath,
      name,
    });
    if (!result.ok) return set({ lastError: result.error });
    const expanded = new Set(get().expandedFolders);
    if (parentRelativePath) expanded.add(parentRelativePath);
    set({ ...updateWorkspace(result.value), expandedFolders: expanded });
  },

  createFolder: async (parentRelativePath, name) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.createWorkspaceFolder({
      rootPath: current.rootPath,
      parentRelativePath,
      name,
    });
    if (!result.ok) return set({ lastError: result.error });
    const expanded = new Set(get().expandedFolders);
    if (parentRelativePath) expanded.add(parentRelativePath);
    set({ ...updateWorkspace(result.value), expandedFolders: expanded });
  },

  renameEntry: async (relativePath, newName) => {
    const current = get().workspace;
    if (!current) return;
    const previousEntry = flattenWorkspaceEntries(current.entries).find(
      (entry) => entry.relativePath === relativePath,
    );
    const result = await window.desktopAPI.renameWorkspaceEntry({
      rootPath: current.rootPath,
      relativePath,
      newName,
    });
    if (!result.ok) return set({ lastError: result.error });
    const parent = relativePath.split('/').slice(0, -1).join('/');
    const nextRelativePath = parent ? `${parent}/${newName}` : newName;
    const nextEntry = flattenWorkspaceEntries(result.value.entries).find(
      (entry) => entry.relativePath === nextRelativePath,
    );
    if (previousEntry && nextEntry) {
      useDocumentStore.setState((documentState) => ({
        documents: documentState.documents.map((document) =>
          document.absolutePath?.toLocaleLowerCase() ===
          previousEntry.absolutePath.toLocaleLowerCase()
            ? {
                ...document,
                absolutePath: nextEntry.absolutePath,
                displayName: nextEntry.name,
              }
            : document,
        ),
      }));
    }
    set({ ...updateWorkspace(result.value), selectedRelativePath: null });
  },

  moveEntry: async (relativePath, targetFolderRelativePath) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.moveWorkspaceEntry({
      rootPath: current.rootPath,
      relativePath,
      targetFolderRelativePath,
    });
    if (!result.ok) return set({ lastError: result.error });
    set({ ...updateWorkspace(result.value), selectedRelativePath: null });
  },

  deleteEntry: async (relativePath) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.deleteWorkspaceEntry({
      rootPath: current.rootPath,
      relativePath,
    });
    if (!result.ok) return set({ lastError: result.error });
    set({ ...updateWorkspace(result.value), selectedRelativePath: null });
  },

  duplicateEntry: async (relativePath) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.duplicateWorkspaceEntry({
      rootPath: current.rootPath,
      relativePath,
    });
    if (!result.ok) return set({ lastError: result.error });
    set(updateWorkspace(result.value));
  },

  revealEntry: async (relativePath) => {
    const current = get().workspace;
    if (!current) return;
    const result = await window.desktopAPI.revealWorkspaceEntry({
      rootPath: current.rootPath,
      relativePath,
    });
    if (!result.ok) set({ lastError: result.error });
  },

  search: async (query, caseSensitive = false, wholeWord = false) => {
    const current = get().workspace;
    set({ searchQuery: query });
    if (!current || query.trim().length === 0) return set({ searchResults: [], searchBusy: false });
    set({ searchBusy: true });
    const result = await window.desktopAPI.searchWorkspace({
      rootPath: current.rootPath,
      query,
      caseSensitive,
      wholeWord,
    });
    if (!result.ok) return set({ lastError: result.error, searchBusy: false });
    if (get().searchQuery === query) set({ searchResults: result.value, searchBusy: false });
  },

  clearError: () => set({ lastError: null }),
}));

export function flattenWorkspaceEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  const flattened: WorkspaceEntry[] = [];
  for (const entry of entries) {
    flattened.push(entry);
    if (entry.children) flattened.push(...flattenWorkspaceEntries(entry.children));
  }
  return flattened;
}

export function parentFolderForSelection(
  workspace: WorkspacePayload,
  selected: string | null,
): string {
  if (!selected) return '';
  const entry = flattenWorkspaceEntries(workspace.entries).find(
    (item) => item.relativePath === selected,
  );
  if (!entry) return '';
  if (entry.type === 'folder') return entry.relativePath;
  const slash = entry.relativePath.lastIndexOf('/');
  return slash < 0 ? '' : entry.relativePath.slice(0, slash);
}
