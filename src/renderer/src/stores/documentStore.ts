import { create } from 'zustand';
import type {
  FileErrorPayload,
  LineEnding,
  OpenedFilePayload,
  RecoveryEntry,
  TextEncoding,
} from '../../../shared/types';
import { toEditorText } from '../../../shared/text/editorText';
import {
  isTrackedDocumentModified,
  markContentSaved,
  saveActionFor,
} from '../../../shared/text/saveTracking';
import { countCharacters, countWords } from '../../../shared/text/wordCount';
import { saveOptionsFor, useSettingsStore } from './settingsStore';

export type ExternalModificationState = 'none' | 'conflict' | 'deleted';

export interface MarkdownDocument {
  id: string;
  absolutePath: string | null;
  displayName: string;
  markdown: string;
  savedContent: string;
  encoding: TextEncoding;
  lineEnding: LineEnding;
  externalModificationState: ExternalModificationState;
  externalContent: string | null;
  recovered: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CursorRequest extends CursorPosition {
  documentId: string;
  token: number;
}

interface DocumentStoreState {
  documents: MarkdownDocument[];
  activeDocumentId: string | null;
  cursor: CursorPosition;
  cursorRequest: CursorRequest | null;
  recentlyClosed: MarkdownDocument[];
  lastError: FileErrorPayload | null;
  newDocument(): void;
  openFileViaDialog(): Promise<void>;
  openFilePath(absolutePath: string): Promise<MarkdownDocument | null>;
  restoreFiles(paths: string[]): Promise<void>;
  restoreRecovery(entries: RecoveryEntry[]): void;
  activateDocument(id: string): void;
  closeDocument(id: string): Promise<boolean>;
  closeOthers(id: string): Promise<void>;
  closeAll(): Promise<void>;
  reopenClosed(): void;
  setContent(id: string, text: string): void;
  setCursor(position: CursorPosition): void;
  revealLocation(absolutePath: string, line: number, column?: number): Promise<void>;
  clearCursorRequest(): void;
  saveActive(): Promise<void>;
  saveActiveAs(): Promise<void>;
  handleExternalChange(absolutePath: string): Promise<void>;
  reloadFromDisk(id: string): Promise<void>;
  keepMyVersion(id: string): void;
  clearError(): void;
}

let nextUntitledNumber = 1;
const savesInProgress = new Set<string>();

function pathKey(value: string): string {
  return navigator.userAgent.includes('Windows') ? value.toLocaleLowerCase() : value;
}

function makeUntitled(defaultLineEnding: 'LF' | 'CRLF'): MarkdownDocument {
  const number = nextUntitledNumber;
  nextUntitledNumber += 1;
  return {
    id: `untitled-${number}-${Date.now()}`,
    absolutePath: null,
    displayName: `untitled-${number}.md`,
    markdown: '',
    savedContent: '',
    encoding: 'utf-8',
    lineEnding: defaultLineEnding,
    externalModificationState: 'none',
    externalContent: null,
    recovered: false,
  };
}

export function isModified(document: MarkdownDocument): boolean {
  return isTrackedDocumentModified(document);
}

function documentFromPayload(payload: OpenedFilePayload): MarkdownDocument {
  const editorText = toEditorText(payload.content);
  return {
    id: `file-${payload.absolutePath}`,
    absolutePath: payload.absolutePath,
    displayName: payload.displayName,
    markdown: editorText,
    savedContent: editorText,
    encoding: payload.encoding,
    lineEnding: payload.lineEnding,
    externalModificationState: 'none',
    externalContent: null,
    recovered: false,
  };
}

function documentFromRecovery(entry: RecoveryEntry): MarkdownDocument {
  return {
    id: entry.id,
    absolutePath: entry.absolutePath,
    displayName: `${entry.displayName} (Recovered)`,
    markdown: entry.markdown,
    savedContent: entry.savedContent,
    encoding: entry.encoding,
    lineEnding: entry.lineEnding,
    externalModificationState: 'none',
    externalContent: null,
    recovered: true,
  };
}

async function removeRecovery(document: MarkdownDocument): Promise<void> {
  await window.desktopAPI.removeRecovery(document.id).catch(() => undefined);
}

export const useDocumentStore = create<DocumentStoreState>((set, get) => {
  const openPayload = (payload: OpenedFilePayload): MarkdownDocument => {
    const existing = get().documents.find(
      (document) =>
        document.absolutePath !== null &&
        pathKey(document.absolutePath) === pathKey(payload.absolutePath),
    );
    if (existing) {
      set({ activeDocumentId: existing.id, lastError: null });
      return existing;
    }
    const document = documentFromPayload(payload);
    set({
      documents: [...get().documents, document],
      activeDocumentId: document.id,
      cursor: { line: 1, column: 1 },
      lastError: null,
    });
    return document;
  };

  const saveDocument = async (documentId: string, forceSaveAs: boolean): Promise<boolean> => {
    const document = get().documents.find((item) => item.id === documentId);
    if (!document || savesInProgress.has(document.id)) return false;
    if (document.externalModificationState === 'conflict' && !forceSaveAs) {
      set({
        lastError: {
          code: 'PERMISSION_DENIED',
          message: 'Resolve the external file conflict before overwriting this document.',
        },
      });
      return false;
    }
    const action = forceSaveAs ? 'save-as' : saveActionFor(document);
    if (action === 'none') return true;
    const contentBeingSaved = document.markdown;
    const options = saveOptionsFor(document.encoding, document.lineEnding);
    savesInProgress.add(document.id);
    try {
      if (action === 'save-as') {
        const result = await window.desktopAPI.saveAsDialog({
          defaultFileName: document.displayName.replace(/ \(Recovered\)$/, ''),
          content: contentBeingSaved,
          options,
        });
        if (!result.ok) {
          set({ lastError: result.error });
          return false;
        }
        if (!result.value) return false;
        const { absolutePath, displayName } = result.value;
        set({
          documents: get().documents.map((item) =>
            item.id === document.id
              ? markContentSaved(
                  {
                    ...item,
                    absolutePath,
                    displayName,
                    recovered: false,
                    externalModificationState: 'none',
                    externalContent: null,
                  },
                  contentBeingSaved,
                  options.lineEnding,
                )
              : item,
          ),
          lastError: null,
        });
      } else {
        if (!document.absolutePath) return false;
        const result = await window.desktopAPI.writeFile({
          absolutePath: document.absolutePath,
          content: contentBeingSaved,
          options,
        });
        if (!result.ok) {
          set({ lastError: result.error });
          return false;
        }
        set({
          documents: get().documents.map((item) =>
            item.id === document.id
              ? markContentSaved(
                  {
                    ...item,
                    recovered: false,
                    externalModificationState: 'none',
                    externalContent: null,
                  },
                  contentBeingSaved,
                  options.lineEnding,
                )
              : item,
          ),
          lastError: null,
        });
      }
      await removeRecovery(document);
      return true;
    } finally {
      savesInProgress.delete(document.id);
    }
  };

  return {
    documents: [],
    activeDocumentId: null,
    cursor: { line: 1, column: 1 },
    cursorRequest: null,
    recentlyClosed: [],
    lastError: null,

    newDocument: () => {
      const pristine = get().documents.find(
        (document) =>
          document.absolutePath === null && !isModified(document) && !document.recovered,
      );
      if (pristine) return set({ activeDocumentId: pristine.id, cursor: { line: 1, column: 1 } });
      const document = makeUntitled(useSettingsStore.getState().defaultLineEnding);
      set({
        documents: [...get().documents, document],
        activeDocumentId: document.id,
        cursor: { line: 1, column: 1 },
        lastError: null,
      });
    },

    openFileViaDialog: async () => {
      const result = await window.desktopAPI.openFileDialog();
      if (!result.ok) return set({ lastError: result.error });
      if (result.value) openPayload(result.value);
    },

    openFilePath: async (absolutePath) => {
      const existing = get().documents.find(
        (document) =>
          document.absolutePath && pathKey(document.absolutePath) === pathKey(absolutePath),
      );
      if (existing) {
        set({ activeDocumentId: existing.id });
        return existing;
      }
      const result = await window.desktopAPI.readFile(absolutePath);
      if (!result.ok) {
        set({ lastError: result.error });
        return null;
      }
      return openPayload(result.value);
    },

    restoreFiles: async (paths) => {
      for (const filePath of paths.slice(0, 20)) await get().openFilePath(filePath);
    },

    restoreRecovery: (entries) => {
      const existingIds = new Set(get().documents.map((document) => document.id));
      const recovered = entries
        .filter((entry) => !existingIds.has(entry.id))
        .map(documentFromRecovery);
      if (recovered.length === 0) return;
      set({
        documents: [...get().documents, ...recovered],
        activeDocumentId: recovered[0]?.id ?? get().activeDocumentId,
      });
    },

    activateDocument: (id) => {
      if (get().documents.some((document) => document.id === id)) {
        set({ activeDocumentId: id, cursor: { line: 1, column: 1 } });
      }
    },

    closeDocument: async (id) => {
      const document = get().documents.find((item) => item.id === id);
      if (!document) return true;
      if (isModified(document)) {
        const decision = await window.desktopAPI.confirmClose(document.displayName);
        if (!decision.ok) {
          set({ lastError: decision.error });
          return false;
        }
        if (decision.value.action === 'cancel') return false;
        if (decision.value.action === 'save') {
          if (!(await saveDocument(id, false))) return false;
          const savedDocument = get().documents.find((item) => item.id === id);
          if (savedDocument && isModified(savedDocument)) return false;
        }
      }
      const remaining = get().documents.filter((item) => item.id !== id);
      const closedIndex = get().documents.findIndex((item) => item.id === id);
      const nextActive =
        get().activeDocumentId === id
          ? (remaining[Math.min(closedIndex, remaining.length - 1)]?.id ?? null)
          : get().activeDocumentId;
      set({
        documents: remaining,
        activeDocumentId: nextActive,
        recentlyClosed: [document, ...get().recentlyClosed].slice(0, 10),
      });
      await removeRecovery(document);
      return true;
    },

    closeOthers: async (id) => {
      for (const document of [...get().documents]) {
        if (document.id !== id && !(await get().closeDocument(document.id))) break;
      }
    },

    closeAll: async () => {
      for (const document of [...get().documents]) {
        if (!(await get().closeDocument(document.id))) break;
      }
    },

    reopenClosed: () => {
      const [document, ...rest] = get().recentlyClosed;
      if (!document) return;
      set({
        documents: [...get().documents, document],
        activeDocumentId: document.id,
        recentlyClosed: rest,
      });
    },

    setContent: (id, markdown) =>
      set({
        documents: get().documents.map((document) =>
          document.id === id ? { ...document, markdown } : document,
        ),
      }),
    setCursor: (cursor) => set({ cursor }),

    revealLocation: async (absolutePath, line, column = 1) => {
      const document = await get().openFilePath(absolutePath);
      if (!document) return;
      set({
        activeDocumentId: document.id,
        cursorRequest: { documentId: document.id, line, column, token: Date.now() },
      });
    },
    clearCursorRequest: () => set({ cursorRequest: null }),

    saveActive: async () => {
      const active = getActiveDocument(get());
      if (active) await saveDocument(active.id, false);
    },
    saveActiveAs: async () => {
      const active = getActiveDocument(get());
      if (active) await saveDocument(active.id, true);
    },

    handleExternalChange: async (absolutePath) => {
      const document = get().documents.find(
        (item) => item.absolutePath && pathKey(item.absolutePath) === pathKey(absolutePath),
      );
      if (!document) return;
      const result = await window.desktopAPI.readFile(absolutePath);
      if (!result.ok) {
        set({
          documents: get().documents.map((item) =>
            item.id === document.id ? { ...item, externalModificationState: 'deleted' } : item,
          ),
        });
        return;
      }
      const external = toEditorText(result.value.content);
      if (external === document.savedContent) return;
      if (!isModified(document)) {
        set({
          documents: get().documents.map((item) =>
            item.id === document.id
              ? {
                  ...item,
                  markdown: external,
                  savedContent: external,
                  encoding: result.value.encoding,
                  lineEnding: result.value.lineEnding,
                  externalModificationState: 'none',
                  externalContent: null,
                }
              : item,
          ),
        });
      } else {
        set({
          documents: get().documents.map((item) =>
            item.id === document.id
              ? { ...item, externalModificationState: 'conflict', externalContent: external }
              : item,
          ),
        });
      }
    },

    reloadFromDisk: async (id) => {
      const document = get().documents.find((item) => item.id === id);
      if (!document?.absolutePath) return;
      const result = await window.desktopAPI.readFile(document.absolutePath);
      if (!result.ok) return set({ lastError: result.error });
      const markdown = toEditorText(result.value.content);
      set({
        documents: get().documents.map((item) =>
          item.id === id
            ? {
                ...item,
                markdown,
                savedContent: markdown,
                encoding: result.value.encoding,
                lineEnding: result.value.lineEnding,
                externalModificationState: 'none',
                externalContent: null,
              }
            : item,
        ),
      });
    },

    keepMyVersion: (id) =>
      set({
        documents: get().documents.map((item) =>
          item.id === id
            ? { ...item, externalModificationState: 'none', externalContent: null }
            : item,
        ),
      }),
    clearError: () => set({ lastError: null }),
  };
});

export function getActiveDocument(
  state: Pick<DocumentStoreState, 'documents' | 'activeDocumentId'>,
): MarkdownDocument | null {
  return state.documents.find((document) => document.id === state.activeDocumentId) ?? null;
}

export function hasUnsavedChanges(state: Pick<DocumentStoreState, 'documents'>): boolean {
  return state.documents.some(isModified);
}

export function wordCountOf(document: MarkdownDocument | null): number {
  return document ? countWords(document.markdown) : 0;
}

export function charCountOf(document: MarkdownDocument | null): number {
  return document ? countCharacters(document.markdown) : 0;
}

export function recoveryEntryOf(document: MarkdownDocument): RecoveryEntry {
  return {
    id: document.id,
    absolutePath: document.absolutePath,
    displayName: document.displayName.replace(/ \(Recovered\)$/, ''),
    markdown: document.markdown,
    savedContent: document.savedContent,
    encoding: document.encoding,
    lineEnding: document.lineEnding,
    updatedAt: Date.now(),
  };
}
