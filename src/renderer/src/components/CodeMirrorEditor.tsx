import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import type { CursorPosition, CursorRequest } from '../stores/documentStore';
import type { EditorFormattingHandle, FormatCommand } from '../editor/commands';

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading, color: '#1a4f9c', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#2f6fd0', textDecoration: 'underline' },
  { tag: tags.url, color: '#2f6fd0' },
  { tag: tags.monospace, color: '#8a3a12' },
  { tag: tags.quote, color: '#5a6650' },
  { tag: tags.processingInstruction, color: '#6b6a64' },
  { tag: tags.contentSeparator, color: '#6b6a64' },
]);

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--workspace-background)', color: 'var(--text-primary)' },
  '.cm-content': {
    maxWidth: 'var(--content-width)',
    minHeight: 'calc(100% - 32px)',
    margin: '16px auto',
    width: '100%',
    padding: '28px 34px 60px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--page-background)',
    border: '1px solid var(--page-border)',
    boxShadow: '0 3px 14px var(--page-shadow)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--workspace-background)',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--hover)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--focus-ring)',
  },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text-primary)' },
  '.cm-textfield': {
    backgroundColor: 'var(--surface-alt)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
});

interface CodeMirrorEditorProps {
  content: string;
  dark: boolean;
  wordWrap: boolean;
  cursorRequest: CursorRequest | null;
  internalLinkSuggestions: string[];
  onChange(text: string): void;
  onCursor(position: CursorPosition): void;
  onCursorRequestHandled(): void;
  onImage(file: File): Promise<string | null>;
}

function selectedText(
  view: EditorView,
  placeholder: string,
): { from: number; to: number; text: string } {
  const selection = view.state.selection.main;
  return {
    from: selection.from,
    to: selection.to,
    text: selection.empty ? placeholder : view.state.sliceDoc(selection.from, selection.to),
  };
}

function replaceSelection(
  view: EditorView,
  replacement: string,
  selectFrom?: number,
  selectTo?: number,
): void {
  const selection = view.state.selection.main;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: replacement },
    selection: EditorSelection.single(
      selectFrom ?? selection.from + replacement.length,
      selectTo ?? selectFrom ?? selection.from + replacement.length,
    ),
    scrollIntoView: true,
  });
}

function wrap(view: EditorView, before: string, after: string, placeholder: string): void {
  const selection = selectedText(view, placeholder);
  const replacement = `${before}${selection.text}${after}`;
  replaceSelection(
    view,
    replacement,
    selection.from + before.length,
    selection.from + before.length + selection.text.length,
  );
}

function prefixLines(view: EditorView, prefix: string, ordered = false): void {
  const selection = view.state.selection.main;
  const first = view.state.doc.lineAt(selection.from);
  const last = view.state.doc.lineAt(selection.to);
  const text = view.state.sliceDoc(first.from, last.to);
  const replacement = text
    .split('\n')
    .map((line, index) => `${ordered ? `${index + 1}. ` : prefix}${line}`)
    .join('\n');
  view.dispatch({
    changes: { from: first.from, to: last.to, insert: replacement },
    scrollIntoView: true,
  });
}

function heading(view: EditorView, level: number): void {
  const selection = view.state.selection.main;
  const line = view.state.doc.lineAt(selection.from);
  const clean = line.text.replace(/^#{1,6}\s+/, '');
  const replacement = level === 0 ? clean : `${'#'.repeat(level)} ${clean}`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: replacement },
    scrollIntoView: true,
  });
}

function applySourceFormat(view: EditorView, command: FormatCommand, value?: string): void {
  switch (command) {
    case 'bold':
      wrap(view, '**', '**', 'bold text');
      break;
    case 'italic':
      wrap(view, '*', '*', 'italic text');
      break;
    case 'strikethrough':
      wrap(view, '~~', '~~', 'struck text');
      break;
    case 'highlight':
      wrap(view, '<mark>', '</mark>', 'highlighted text');
      break;
    case 'underline':
      wrap(view, '<u>', '</u>', 'underlined text');
      break;
    case 'inline-code':
      wrap(view, '`', '`', 'code');
      break;
    case 'heading1':
      heading(view, 1);
      break;
    case 'heading2':
      heading(view, 2);
      break;
    case 'heading3':
      heading(view, 3);
      break;
    case 'paragraph':
      heading(view, 0);
      break;
    case 'bullet-list':
      prefixLines(view, '- ');
      break;
    case 'ordered-list':
      prefixLines(view, '', true);
      break;
    case 'task-list':
      prefixLines(view, '- [ ] ');
      break;
    case 'blockquote':
      prefixLines(view, '> ');
      break;
    case 'code-block':
      wrap(view, '```\n', '\n```', 'code');
      break;
    case 'link': {
      const selection = selectedText(view, 'link text');
      const url = value?.trim() || 'https://example.com';
      replaceSelection(view, `[${selection.text}](${url})`);
      break;
    }
    case 'image':
      replaceSelection(view, `![image](${value?.trim() || './attachments/image.png'})`);
      break;
    case 'horizontal-rule':
      replaceSelection(view, '\n\n---\n\n');
      break;
    case 'table':
      replaceSelection(view, '| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |');
      break;
    case 'align-left':
      wrap(view, '<div style="text-align: left">\n', '\n</div>', 'text');
      break;
    case 'align-center':
      wrap(view, '<div style="text-align: center">\n', '\n</div>', 'text');
      break;
    case 'align-right':
      wrap(view, '<div style="text-align: right">\n', '\n</div>', 'text');
      break;
    case 'align-justify':
      wrap(view, '<div style="text-align: justify">\n', '\n</div>', 'text');
      break;
    case 'font-family':
      wrap(view, `<span style="font-family: ${value || 'serif'}">`, '</span>', 'text');
      break;
    case 'font-size':
      wrap(view, `<span style="font-size: ${value || '16px'}">`, '</span>', 'text');
      break;
    case 'undo':
      undo(view);
      break;
    case 'redo':
      redo(view);
      break;
  }
}

export const CodeMirrorEditor = forwardRef<EditorFormattingHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    {
      content,
      dark,
      wordWrap,
      cursorRequest,
      internalLinkSuggestions,
      onChange,
      onCursor,
      onCursorRequestHandled,
      onImage,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const themeCompartment = useRef(new Compartment());
    const wrapCompartment = useRef(new Compartment());
    const syncing = useRef(false);
    const callbacks = useRef({ onChange, onCursor, onImage });
    const initialContent = useRef(content);
    const initialDark = useRef(dark);
    const initialWrap = useRef(wordWrap);
    const suggestions = useRef(internalLinkSuggestions);

    useEffect(() => {
      callbacks.current = { onChange, onCursor, onImage };
    }, [onChange, onCursor, onImage]);

    useEffect(() => {
      suggestions.current = internalLinkSuggestions;
    }, [internalLinkSuggestions]);

    useImperativeHandle(ref, () => ({
      format: (command, value) => {
        const view = viewRef.current;
        if (view) applySourceFormat(view, command, value);
      },
      clipboard: async (command) => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        if (command === 'paste') {
          replaceSelection(view, await window.desktopAPI.readClipboardText());
          view.focus();
          return;
        }
        if (selection.empty) return;
        const text = view.state.sliceDoc(selection.from, selection.to);
        await window.desktopAPI.writeClipboardText(text);
        if (command === 'cut') {
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: '' },
            selection: EditorSelection.cursor(selection.from),
          });
        }
        view.focus();
      },
      insertText: (text) => {
        const view = viewRef.current;
        if (view) replaceSelection(view, text);
      },
      openFind: () => {
        window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: false } }));
      },
      revealRange: (from, to) => {
        const view = viewRef.current;
        if (!view) return;
        const safeFrom = Math.min(Math.max(from, 0), view.state.doc.length);
        const safeTo = Math.min(Math.max(to, safeFrom), view.state.doc.length);
        view.dispatch({
          selection: EditorSelection.range(safeFrom, safeTo),
          effects: EditorView.scrollIntoView(safeFrom, { y: 'center' }),
        });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: initialContent.current,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            history(),
            autocompletion({
              activateOnTyping: true,
              override: [
                (context: CompletionContext) => {
                  const match = context.matchBefore(/\[\[[^\]\n]*/);
                  if (!match || (match.from === match.to && !context.explicit)) return null;
                  return {
                    from: match.from + 2,
                    options: suggestions.current.slice(0, 2_000).map((label) => ({
                      label,
                      type: 'text',
                      detail: 'Workspace document',
                      apply: `${label}]]`,
                    })),
                  };
                },
              ],
            }),
            keymap.of([
              ...defaultKeymap,
              ...historyKeymap,
              {
                key: 'Mod-b',
                run: (editor) => {
                  applySourceFormat(editor, 'bold');
                  return true;
                },
              },
              {
                key: 'Mod-i',
                run: (editor) => {
                  applySourceFormat(editor, 'italic');
                  return true;
                },
              },
              indentWithTab,
            ]),
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            themeCompartment.current.of(
              initialDark.current
                ? [oneDark]
                : [syntaxHighlighting(lightHighlight), syntaxHighlighting(defaultHighlightStyle)],
            ),
            wrapCompartment.current.of(initialWrap.current ? EditorView.lineWrapping : []),
            baseTheme,
            EditorView.domEventHandlers({
              paste: (event) => {
                const file = [...(event.clipboardData?.files ?? [])].find((item) =>
                  item.type.startsWith('image/'),
                );
                if (!file) return false;
                event.preventDefault();
                void callbacks.current.onImage(file).then((markdown) => {
                  if (markdown) replaceSelection(view, markdown);
                });
                return true;
              },
              drop: (event) => {
                const file = [...(event.dataTransfer?.files ?? [])].find((item) =>
                  item.type.startsWith('image/'),
                );
                if (!file) return false;
                event.preventDefault();
                void callbacks.current.onImage(file).then((markdown) => {
                  if (markdown) replaceSelection(view, markdown);
                });
                return true;
              },
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged && !syncing.current)
                callbacks.current.onChange(update.state.doc.toString());
              if (update.selectionSet || update.docChanged) {
                const head = update.state.selection.main.head;
                const line = update.state.doc.lineAt(head);
                callbacks.current.onCursor({ line: line.number, column: head - line.from + 1 });
              }
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || view.state.doc.toString() === content) return;
      syncing.current = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      syncing.current = false;
    }, [content]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: themeCompartment.current.reconfigure(
          dark
            ? [oneDark]
            : [syntaxHighlighting(lightHighlight), syntaxHighlighting(defaultHighlightStyle)],
        ),
      });
    }, [dark]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: wrapCompartment.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
      });
    }, [wordWrap]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || !cursorRequest) return;
      const lineNumber = Math.min(Math.max(cursorRequest.line, 1), view.state.doc.lines);
      const line = view.state.doc.line(lineNumber);
      const position = Math.min(line.to, line.from + Math.max(cursorRequest.column - 1, 0));
      view.dispatch({
        selection: EditorSelection.cursor(position),
        effects: EditorView.scrollIntoView(position, { y: 'center' }),
      });
      view.focus();
      onCursorRequestHandled();
    }, [cursorRequest, onCursorRequestHandled]);

    return <div className="cm-host" ref={hostRef} />;
  },
);
