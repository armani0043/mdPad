import { useEffect, useRef, useState } from 'react';
import type {
  AppStateData,
  FileErrorPayload,
  IpcResult,
  OpenedFilePayload,
} from '../../shared/types';
import { renderMarkdown } from './markdown/markdown';
import { CommandPalette } from './components/CommandPalette';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorPane } from './components/EditorPane';
import { AboutDialog, GuideTour } from './components/HelpDialogs';
import { SettingsDialog } from './components/SettingsDialog';
import { Sidebar, type SidebarView } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TabStrip } from './components/TabStrip';
import {
  getActiveDocument,
  hasUnsavedChanges,
  isModified,
  recoveryEntryOf,
  useDocumentStore,
} from './stores/documentStore';
import { useSettingsStore, type ViewMode } from './stores/settingsStore';
import { useWorkspaceStore } from './stores/workspaceStore';

const EMPTY_STATE: AppStateData = {
  recentFiles: [],
  recentWorkspaces: [],
  lastWorkspace: null,
  openFiles: [],
};

function reportError(error: FileErrorPayload): void {
  useDocumentStore.setState({ lastError: error });
}

export function App(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [navigationView, setNavigationView] = useState<SidebarView | null>(null);
  const restoredState = useRef<AppStateData>(EMPTY_STATE);
  const initialized = useRef(false);
  const queuedLaunchFiles = useRef<IpcResult<OpenedFilePayload>[]>([]);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const autosave = useSettingsStore((state) => state.autosave);
  const autosaveDelay = useSettingsStore((state) => state.autosaveDelay);
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme);

  const requestWorkspaceSearch = (): void => {
    setNavigationView('search');
  };

  useEffect(() => {
    const showNavigation = (event: Event): void => {
      const view = (event as CustomEvent<{ view?: SidebarView }>).detail?.view;
      if (view) setNavigationView(view);
    };
    const closeNavigationForFind = (): void => setNavigationView(null);
    window.addEventListener('mdpad:navigation-view', showNavigation);
    window.addEventListener('mdpad:editor-find', closeNavigationForFind);
    return () => {
      window.removeEventListener('mdpad:navigation-view', showNavigation);
      window.removeEventListener('mdpad:editor-find', closeNavigationForFind);
    };
  }, []);

  useEffect(() => {
    return window.desktopAPI.onLaunchFile((result) => {
      if (initialized.current) useDocumentStore.getState().openLaunchFile(result);
      else queuedLaunchFiles.current.push(result);
    });
  }, []);

  const exportDocument = async (format: 'html' | 'pdf'): Promise<void> => {
    const active = getActiveDocument(useDocumentStore.getState());
    if (!active) return;
    const request = {
      defaultFileName: active.displayName,
      title: active.displayName.replace(/\.(md|markdown)$/i, ''),
      html: renderMarkdown(active.markdown),
      theme: useSettingsStore.getState().resolvedTheme,
    } as const;
    const result =
      format === 'html'
        ? await window.desktopAPI.exportHtml(request)
        : await window.desktopAPI.exportPdf(request);
    if (!result.ok) reportError(result.error);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [info, stateResult, recoveryResult] = await Promise.all([
        window.desktopAPI.getAppInfo(),
        window.desktopAPI.getAppState(),
        window.desktopAPI.listRecovery(),
      ]);
      if (cancelled) return;
      useSettingsStore.getState().setDefaultLineEnding(info.platform === 'win32' ? 'CRLF' : 'LF');
      if (stateResult.ok) {
        restoredState.current = stateResult.value;
        if (stateResult.value.lastWorkspace && useSettingsStore.getState().reopenLastWorkspace) {
          await useWorkspaceStore.getState().restoreWorkspace(stateResult.value.lastWorkspace);
        }
        await useDocumentStore.getState().restoreFiles(stateResult.value.openFiles);
      }
      if (recoveryResult.ok && recoveryResult.value.length > 0) {
        useDocumentStore.getState().restoreRecovery(recoveryResult.value);
      }
      for (const result of queuedLaunchFiles.current.splice(0)) {
        useDocumentStore.getState().openLaunchFile(result);
      }
      if (useDocumentStore.getState().documents.length === 0) {
        useDocumentStore.getState().newDocument();
      }
      initialized.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.desktopAPI.onMenuAction((action) => {
      const documentStore = useDocumentStore.getState();
      const settings = useSettingsStore.getState();
      const modes: Partial<Record<typeof action, ViewMode>> = {
        'view:source': 'source',
        'view:visual': 'visual',
        'view:preview': 'preview',
        'view:split': 'split',
      };
      const mode = modes[action];
      if (mode) return settings.setViewMode(mode);
      switch (action) {
        case 'file:new':
          documentStore.newDocument();
          break;
        case 'file:open':
          void documentStore.openFileViaDialog();
          break;
        case 'file:open-folder':
          void useWorkspaceStore.getState().openWorkspace();
          break;
        case 'file:save':
          void documentStore.saveActive();
          break;
        case 'file:save-as':
          void documentStore.saveActiveAs();
          break;
        case 'file:export-html':
          void exportDocument('html');
          break;
        case 'file:export-pdf':
          void exportDocument('pdf');
          break;
        case 'edit:find':
        case 'edit:replace':
          window.dispatchEvent(
            new CustomEvent('mdpad:editor-find', {
              detail: { replace: action === 'edit:replace' },
            }),
          );
          break;
        case 'view:toggle-theme':
          settings.cycleTheme();
          break;
        case 'tools:workspace-search':
          requestWorkspaceSearch();
          break;
        case 'tools:command-palette':
          setPaletteOpen(true);
          break;
        case 'tools:preferences':
          setSettingsOpen(true);
          break;
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        const store = useDocumentStore.getState();
        if (store.documents.length > 1) {
          const current = store.documents.findIndex((item) => item.id === store.activeDocumentId);
          const delta = event.shiftKey ? -1 : 1;
          const next = (current + delta + store.documents.length) % store.documents.length;
          const target = store.documents[next];
          if (target) store.activateDocument(target.id);
        }
        return;
      }
      if (!event.shiftKey && event.key.toLocaleLowerCase() === 'w') {
        event.preventDefault();
        const store = useDocumentStore.getState();
        if (store.activeDocumentId) void store.closeDocument(store.activeDocumentId);
        return;
      }
      if (!event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: false } }));
        return;
      }
      if (!event.shiftKey && event.key.toLocaleLowerCase() === 'h') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: true } }));
        return;
      }
      if (
        (event.shiftKey && event.key.toLocaleLowerCase() === 'p') ||
        (!event.shiftKey && event.key.toLocaleLowerCase() === 'p')
      ) {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        requestWorkspaceSearch();
      } else if (['1', '2', '3', '4'].includes(event.key)) {
        const modes: ViewMode[] = ['visual', 'source', 'preview', 'split'];
        useSettingsStore.getState().setViewMode(modes[Number(event.key) - 1] ?? 'visual');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const active = getActiveDocument({ documents, activeDocumentId });
    const dirty = active ? isModified(active) : false;
    document.title = `${dirty ? '● ' : ''}mdPad`;
    window.desktopAPI.setDirty(hasUnsavedChanges({ documents }));
  }, [documents, activeDocumentId]);

  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      const openFiles = documents.flatMap((document) =>
        document.absolutePath ? [document.absolutePath] : [],
      );
      const rootPath = workspace?.rootPath ?? null;
      const previous = restoredState.current;
      const next: AppStateData = {
        openFiles,
        lastWorkspace: rootPath,
        recentFiles: [
          ...openFiles,
          ...previous.recentFiles.filter((file) => !openFiles.includes(file)),
        ].slice(0, 20),
        recentWorkspaces: rootPath
          ? [rootPath, ...previous.recentWorkspaces.filter((root) => root !== rootPath)].slice(
              0,
              10,
            )
          : previous.recentWorkspaces,
      };
      restoredState.current = next;
      void window.desktopAPI.setAppState(next);
    }, 400);
    return () => clearTimeout(timer);
  }, [documents, workspace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const document of documents) {
        if (isModified(document)) void window.desktopAPI.saveRecovery(recoveryEntryOf(document));
        else void window.desktopAPI.removeRecovery(document.id);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [documents]);

  useEffect(() => {
    if (autosave !== 'delay') return;
    const active = getActiveDocument({ documents, activeDocumentId });
    if (!active?.absolutePath || !isModified(active) || active.externalModificationState !== 'none')
      return;
    const timer = setTimeout(() => void useDocumentStore.getState().saveActive(), autosaveDelay);
    return () => clearTimeout(timer);
  }, [autosave, autosaveDelay, documents, activeDocumentId]);

  useEffect(() => {
    if (autosave !== 'blur') return;
    const onBlur = (): void => {
      const active = getActiveDocument(useDocumentStore.getState());
      if (
        active?.absolutePath &&
        isModified(active) &&
        active.externalModificationState === 'none'
      ) {
        void useDocumentStore.getState().saveActive();
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [autosave]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = window.desktopAPI.onWorkspaceChanged((event) => {
      if (workspace && event.rootPath === workspace.rootPath) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void useWorkspaceStore.getState().refresh(), 180);
        if (event.absolutePath)
          void useDocumentStore.getState().handleExternalChange(event.absolutePath);
      }
    });
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [workspace]);

  return (
    <div className={`app-shell theme-${resolvedTheme}`}>
      <EditorToolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onExport={(format) => void exportDocument(format)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />
      <div className="app-body">
        {navigationView && (
          <Sidebar
            view={navigationView}
            onClose={() => setNavigationView(null)}
            onViewChange={setNavigationView}
          />
        )}
        <div className="app-main">
          <TabStrip />
          <EditorPane />
        </div>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {guideOpen && <GuideTour onClose={() => setGuideOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => {
            setPaletteOpen(false);
            setSettingsOpen(true);
          }}
          onOpenWorkspaceSearch={() => {
            setPaletteOpen(false);
            requestWorkspaceSearch();
          }}
        />
      )}
    </div>
  );
}
