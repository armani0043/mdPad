import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { renderMarkdown, visualHtmlToMarkdown } from '../markdown/markdown';
import type { EditorFormattingHandle, FormatCommand } from '../editor/commands';

interface VisualEditorProps {
  markdown: string;
  onChange(markdown: string): void;
}

function wrapSelection(tagName: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const element = document.createElement(tagName);
  try {
    range.surroundContents(element);
  } catch {
    element.textContent = range.toString();
    range.deleteContents();
    range.insertNode(element);
  }
}

function fontSize(value: string): void {
  document.execCommand('fontSize', false, '7');
  for (const node of document.querySelectorAll<HTMLElement>('font[size="7"]')) {
    node.removeAttribute('size');
    node.style.fontSize = value;
  }
}

function insertPlainText(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function listItemsForSelection(editor: HTMLElement): HTMLLIElement[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  return [...editor.querySelectorAll<HTMLLIElement>('li')].filter((item) => {
    try {
      return range.intersectsNode(item);
    } catch {
      return false;
    }
  });
}

export function addTaskMarkersToListItems(items: HTMLLIElement[]): void {
  for (const item of items) {
    if (
      item.querySelector('input[type="checkbox"]') ||
      /^\s*\[[ xX]\]\s/.test(item.textContent ?? '')
    ) {
      continue;
    }
    item.insertBefore(document.createTextNode('[ ] '), item.firstChild);
  }
}

function makeTaskList(editor: HTMLElement): void {
  let items = listItemsForSelection(editor);
  if (items.length === 0) {
    document.execCommand('insertUnorderedList');
    items = listItemsForSelection(editor);
  }
  addTaskMarkersToListItems(items);
}

function insertLink(editor: HTMLElement, value?: string): void {
  const url = value?.trim() || 'https://example.com';
  const selection = window.getSelection();
  if (selection?.rangeCount && !selection.getRangeAt(0).collapsed) {
    document.execCommand('createLink', false, url);
    return;
  }
  const anchor = document.createElement('a');
  anchor.setAttribute('href', url);
  anchor.textContent = url;
  const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange();
  if (!selection?.rangeCount) range.selectNodeContents(editor);
  range.collapse(false);
  range.insertNode(anchor);
  range.setStartAfter(anchor);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function visualCommand(editor: HTMLElement, command: FormatCommand, value?: string): void {
  switch (command) {
    case 'bold':
      document.execCommand('bold');
      break;
    case 'italic':
      document.execCommand('italic');
      break;
    case 'strikethrough':
      document.execCommand('strikeThrough');
      break;
    case 'highlight':
      document.execCommand('hiliteColor', false, '#ffe58a');
      break;
    case 'underline':
      document.execCommand('underline');
      break;
    case 'heading1':
      document.execCommand('formatBlock', false, 'h1');
      break;
    case 'heading2':
      document.execCommand('formatBlock', false, 'h2');
      break;
    case 'heading3':
      document.execCommand('formatBlock', false, 'h3');
      break;
    case 'paragraph':
      document.execCommand('formatBlock', false, 'p');
      break;
    case 'bullet-list':
      document.execCommand('insertUnorderedList');
      break;
    case 'ordered-list':
      document.execCommand('insertOrderedList');
      break;
    case 'task-list':
      makeTaskList(editor);
      break;
    case 'blockquote':
      document.execCommand('formatBlock', false, 'blockquote');
      break;
    case 'inline-code':
      wrapSelection('code');
      break;
    case 'code-block':
      document.execCommand('formatBlock', false, 'pre');
      break;
    case 'link':
      insertLink(editor, value);
      break;
    case 'image':
      document.execCommand('insertImage', false, value || './attachments/image.png');
      break;
    case 'horizontal-rule':
      document.execCommand('insertHorizontalRule');
      break;
    case 'table':
      document.execCommand(
        'insertHTML',
        false,
        '<table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>Value</td><td>Value</td></tr></tbody></table>',
      );
      break;
    case 'align-left':
      document.execCommand('justifyLeft');
      break;
    case 'align-center':
      document.execCommand('justifyCenter');
      break;
    case 'align-right':
      document.execCommand('justifyRight');
      break;
    case 'align-justify':
      document.execCommand('justifyFull');
      break;
    case 'font-family':
      document.execCommand('fontName', false, value || 'serif');
      break;
    case 'font-size':
      fontSize(value || '16px');
      break;
    case 'undo':
      document.execCommand('undo');
      break;
    case 'redo':
      document.execCommand('redo');
      break;
  }
}

export const VisualEditor = forwardRef<EditorFormattingHandle, VisualEditorProps>(
  function VisualEditor({ markdown, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const lastEmitted = useRef<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSelection = useRef<Range | null>(null);

    const rememberSelection = (): void => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer))
        lastSelection.current = range.cloneRange();
    };

    const restoreSelection = (): void => {
      const range = lastSelection.current;
      if (!range) return;
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const emitChange = (): void => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const next = visualHtmlToMarkdown(editor.innerHTML);
        lastEmitted.current = next;
        onChange(next);
      }, 120);
    };

    useImperativeHandle(ref, () => ({
      format: (command, value) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        restoreSelection();
        visualCommand(editor, command, value);
        rememberSelection();
        emitChange();
      },
      clipboard: async (command) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        restoreSelection();
        if (command === 'paste') {
          insertPlainText(await window.desktopAPI.readClipboardText());
          emitChange();
          return;
        }
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.toString()) return;
        await window.desktopAPI.writeClipboardText(selection.toString());
        if (command === 'cut') {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          emitChange();
        }
      },
      insertText: (text) => {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand('insertText', false, text);
        rememberSelection();
        emitChange();
      },
      openFind: () => undefined,
      revealRange: () => undefined,
      focus: () => editorRef.current?.focus(),
    }));

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || lastEmitted.current === markdown) return;
      editor.innerHTML = renderMarkdown(markdown);
    }, [markdown]);

    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );

    return (
      <div
        ref={editorRef}
        className="visual-editor markdown-body"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        aria-label="Visual Markdown editor"
        onInput={emitChange}
        onBlur={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={(event) => {
          const text = event.clipboardData.getData('text/plain');
          if (text) {
            event.preventDefault();
            insertPlainText(text);
            emitChange();
          }
        }}
      />
    );
  },
);
