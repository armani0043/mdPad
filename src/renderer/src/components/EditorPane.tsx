import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from '../../../../resources/icon.png';
import type { EditorFormattingHandle, FormatCommand, PasteMode } from '../editor/commands';
import { extractOutline } from '../markdown/markdown';
import {
  getActiveDocument,
  useDocumentStore,
  type MarkdownDocument,
} from '../stores/documentStore';
import { useSettingsStore } from '../stores/settingsStore';
import { flattenWorkspaceEntries, useWorkspaceStore } from '../stores/workspaceStore';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { FindReplaceBar, selectTextOccurrence, type FindMatch } from './FindReplaceBar';
import { MarkdownPreview } from './MarkdownPreview';
import { VisualEditor } from './VisualEditor';

function resolveRelativePath(baseFile: string, target: string): string {
  const baseParts = baseFile.split('/');
  baseParts.pop();
  for (const part of target.replace(/^\.\//, '').split('/')) {
    if (part === '..') baseParts.pop();
    else if (part && part !== '.') baseParts.push(part);
  }
  return baseParts.join('/');
}

export function EditorPane(): React.JSX.Element {
  const editorRef = useRef<EditorFormattingHandle | null>(null);
  const [findSession, setFindSession] = useState({ open: false, replace: false, token: 0 });
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const cursorRequest = useDocumentStore((state) => state.cursorRequest);
  const setContent = useDocumentStore((state) => state.setContent);
  const activateDocument = useDocumentStore((state) => state.activateDocument);
  const setCursor = useDocumentStore((state) => state.setCursor);
  const clearCursorRequest = useDocumentStore((state) => state.clearCursorRequest);
  const reloadFromDisk = useDocumentStore((state) => state.reloadFromDisk);
  const keepMyVersion = useDocumentStore((state) => state.keepMyVersion);
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme);
  const wordWrap = useSettingsStore((state) => state.wordWrap);
  const viewMode = useSettingsStore((state) => state.viewMode);
  const sideBySide = useSettingsStore((state) => state.sideBySide);
  const attachmentFolder = useSettingsStore((state) => state.attachmentFolder);
  const defaultPasteMode = useSettingsStore((state) => state.defaultPasteMode);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const document = getActiveDocument({ documents, activeDocumentId });
  const conflictDocument =
    document && document.externalModificationState !== 'none' ? document : null;
  const internalLinkSuggestions = useMemo(() => {
    if (!workspace) return [];
    return [
      ...new Set(
        flattenWorkspaceEntries(workspace.entries)
          .filter((entry) => entry.type === 'file' && /\.(md|markdown)$/i.test(entry.name))
          .map((entry) => entry.name.replace(/\.(md|markdown)$/i, '')),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [workspace]);

  useEffect(() => {
    const openFind = (event: Event): void => {
      const detail = (event as CustomEvent<{ replace?: boolean }>).detail;
      setFindSession((current) => ({
        open: true,
        replace: detail?.replace === true,
        token: current.token + 1,
      }));
    };
    const format = (event: Event): void => {
      const detail = (event as CustomEvent<{ command: FormatCommand; value?: string }>).detail;
      if (!detail?.command) return;
      editorRef.current?.format(detail.command, detail.value);
      editorRef.current?.focus();
    };
    const clipboard = (event: Event): void => {
      const detail = (
        event as CustomEvent<{
          command?: 'paste' | 'cut' | 'copy';
          pasteMode?: PasteMode;
        }>
      ).detail;
      if (detail?.command) void editorRef.current?.clipboard(detail.command, detail.pasteMode);
    };
    const insertText = (event: Event): void => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      editorRef.current?.insertText(text);
      editorRef.current?.focus();
    };
    const closeFindForNavigation = (): void => {
      setFindSession((current) => ({ ...current, open: false }));
    };
    window.addEventListener('mdpad:editor-find', openFind);
    window.addEventListener('mdpad:format', format);
    window.addEventListener('mdpad:clipboard', clipboard);
    window.addEventListener('mdpad:insert-text', insertText);
    window.addEventListener('mdpad:navigation-view', closeFindForNavigation);
    return () => {
      window.removeEventListener('mdpad:editor-find', openFind);
      window.removeEventListener('mdpad:format', format);
      window.removeEventListener('mdpad:clipboard', clipboard);
      window.removeEventListener('mdpad:insert-text', insertText);
      window.removeEventListener('mdpad:navigation-view', closeFindForNavigation);
    };
  }, []);

  const revealFindMatch = (
    match: FindMatch,
    occurrence: number,
    query: string,
    matchCase: boolean,
  ): void => {
    if (
      (!sideBySide && (viewMode === 'source' || viewMode === 'split')) ||
      (sideBySide && viewMode === 'source')
    ) {
      editorRef.current?.revealRange(match.from, match.to);
      return;
    }
    const selector = sideBySide
      ? '.multi-document-pane.active .visual-editor'
      : viewMode === 'visual'
        ? '.visual-editor'
        : '.markdown-preview';
    const surface = window.document.querySelector<HTMLElement>(selector);
    if (surface) selectTextOccurrence(surface, query, occurrence, matchCase);
  };

  const saveImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!document?.absolutePath) {
        useDocumentStore.setState({
          lastError: {
            code: 'INVALID_PATH',
            message: 'Save the document before adding images.',
          },
        });
        return null;
      }
      const result = await window.desktopAPI.saveAttachment({
        documentPath: document.absolutePath,
        workspaceRoot: workspace?.rootPath ?? null,
        relativeFolder: attachmentFolder,
        originalName: file.name || 'pasted-image.png',
        mimeType: file.type || 'image/png',
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      if (!result.ok) {
        useDocumentStore.setState({ lastError: result.error });
        return null;
      }
      if (workspace) void useWorkspaceStore.getState().refresh();
      return `![${file.name || 'image'}](${result.value.relativeMarkdownPath})`;
    },
    [attachmentFolder, document, workspace],
  );

  const openLocalLink = (sourceDocument: MarkdownDocument, href: string): void => {
    if (!workspace || !sourceDocument.absolutePath) return;
    const [rawFile, rawHeading] = href.split('#', 2);
    let clean = rawFile ?? '';
    try {
      clean = decodeURIComponent(clean);
    } catch {
      return;
    }
    if (!clean) return;
    const entries = flattenWorkspaceEntries(workspace.entries).filter(
      (entry) => entry.type === 'file',
    );
    const current = entries.find(
      (entry) =>
        entry.absolutePath.toLocaleLowerCase() === sourceDocument.absolutePath?.toLocaleLowerCase(),
    );
    const resolved = current
      ? resolveRelativePath(current.relativePath, clean)
      : clean.replace(/^\.\//, '');
    const target = entries.find(
      (entry) =>
        entry.relativePath.toLocaleLowerCase() === resolved.toLocaleLowerCase() ||
        entry.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
    );
    if (!target) return;
    void (async () => {
      const opened = await useDocumentStore.getState().openFilePath(target.absolutePath);
      if (!opened || !rawHeading) return;
      let heading = rawHeading;
      try {
        heading = decodeURIComponent(rawHeading);
      } catch {
        return;
      }
      const match = extractOutline(opened.markdown).find(
        (item) => item.text.toLocaleLowerCase() === heading.toLocaleLowerCase(),
      );
      if (match) await useDocumentStore.getState().revealLocation(target.absolutePath, match.line);
    })();
  };

  const editor =
    sideBySide && documents.length > 1 ? (
      <div className="multi-document-view" aria-label="Open documents side by side">
        {documents.map((openDocument) => (
          <section
            key={openDocument.id}
            className={`multi-document-pane${openDocument.id === activeDocumentId ? ' active' : ''}`}
            data-document-id={openDocument.id}
            onMouseDown={() => {
              if (openDocument.id !== activeDocumentId) activateDocument(openDocument.id);
            }}
          >
            <header title={openDocument.displayName}>
              <span className="multi-document-dot" />
              <strong>{openDocument.displayName}</strong>
              <span className="multi-document-state">
                {openDocument.id === activeDocumentId ? 'Editing' : 'Reference'}
              </span>
            </header>
            <div className="multi-document-content">
              {openDocument.id === activeDocumentId ? (
                viewMode === 'source' ? (
                  <CodeMirrorEditor
                    ref={editorRef}
                    key={`side-source-${openDocument.id}`}
                    content={openDocument.markdown}
                    dark={resolvedTheme === 'dark'}
                    wordWrap={wordWrap}
                    internalLinkSuggestions={internalLinkSuggestions}
                    defaultPasteMode={defaultPasteMode}
                    cursorRequest={
                      cursorRequest?.documentId === openDocument.id ? cursorRequest : null
                    }
                    onChange={(markdown) => setContent(openDocument.id, markdown)}
                    onCursor={setCursor}
                    onCursorRequestHandled={clearCursorRequest}
                    onImage={saveImage}
                  />
                ) : (
                  <VisualEditor
                    ref={editorRef}
                    key={`side-visual-${openDocument.id}`}
                    markdown={openDocument.markdown}
                    defaultPasteMode={defaultPasteMode}
                    onChange={(markdown) => setContent(openDocument.id, markdown)}
                  />
                )
              ) : (
                <MarkdownPreview
                  markdown={openDocument.markdown}
                  documentPath={openDocument.absolutePath}
                  onOpenLocalLink={(href) => openLocalLink(openDocument, href)}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    ) : document ? (
      viewMode === 'visual' ? (
        <VisualEditor
          ref={editorRef}
          key={`visual-${document.id}`}
          markdown={document.markdown}
          defaultPasteMode={defaultPasteMode}
          onChange={(markdown) => setContent(document.id, markdown)}
        />
      ) : viewMode === 'preview' ? (
        <MarkdownPreview
          markdown={document.markdown}
          documentPath={document.absolutePath}
          onOpenLocalLink={(href) => openLocalLink(document, href)}
        />
      ) : viewMode === 'split' ? (
        <div className="split-editor">
          <div className="split-pane source-split">
            <CodeMirrorEditor
              ref={editorRef}
              key={`source-${document.id}`}
              content={document.markdown}
              dark={resolvedTheme === 'dark'}
              wordWrap={wordWrap}
              internalLinkSuggestions={internalLinkSuggestions}
              defaultPasteMode={defaultPasteMode}
              cursorRequest={cursorRequest?.documentId === document.id ? cursorRequest : null}
              onChange={(markdown) => setContent(document.id, markdown)}
              onCursor={setCursor}
              onCursorRequestHandled={clearCursorRequest}
              onImage={saveImage}
            />
          </div>
          <div className="split-pane preview-split">
            <MarkdownPreview
              markdown={document.markdown}
              documentPath={document.absolutePath}
              onOpenLocalLink={(href) => openLocalLink(document, href)}
            />
          </div>
        </div>
      ) : (
        <CodeMirrorEditor
          ref={editorRef}
          key={`source-${document.id}`}
          content={document.markdown}
          dark={resolvedTheme === 'dark'}
          wordWrap={wordWrap}
          internalLinkSuggestions={internalLinkSuggestions}
          defaultPasteMode={defaultPasteMode}
          cursorRequest={cursorRequest?.documentId === document.id ? cursorRequest : null}
          onChange={(markdown) => setContent(document.id, markdown)}
          onCursor={setCursor}
          onCursorRequestHandled={clearCursorRequest}
          onImage={saveImage}
        />
      )
    ) : (
      <div className="editor-welcome">
        <img src={logoUrl} alt="mdPad" />
        <h1>mdPad</h1>
        <p>Open a folder or Markdown file to begin.</p>
        <p>Your documents stay on your computer. No account, no cloud.</p>
      </div>
    );

  return (
    <section className="editor-pane" aria-label="Editor">
      {conflictDocument && (
        <div className="conflict-banner" role="alert">
          <span>
            {conflictDocument.externalModificationState === 'deleted'
              ? 'This file was deleted or moved outside mdPad.'
              : 'This file changed externally while you have unsaved edits.'}
          </span>
          {conflictDocument.absolutePath && (
            <button type="button" onClick={() => void reloadFromDisk(conflictDocument.id)}>
              Reload from Disk
            </button>
          )}
          <button type="button" onClick={() => keepMyVersion(conflictDocument.id)}>
            Keep My Version
          </button>
          <button type="button" onClick={() => void useDocumentStore.getState().saveActiveAs()}>
            Save As…
          </button>
        </div>
      )}
      <div className="editor-workspace">
        {findSession.open && document && (
          <FindReplaceBar
            key={`${document.id}-${findSession.token}`}
            markdown={document.markdown}
            initialReplace={findSession.replace}
            onChange={(markdown) => setContent(document.id, markdown)}
            onClose={() => setFindSession((current) => ({ ...current, open: false }))}
            onReveal={revealFindMatch}
          />
        )}
        <div className="editor-document-area">
          <div
            className={`editor-surface mode-${viewMode}${sideBySide ? ' multi-document-mode' : ''}`}
          >
            {editor}
          </div>
        </div>
      </div>
    </section>
  );
}
