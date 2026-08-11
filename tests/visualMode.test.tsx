/** @vitest-environment happy-dom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addTaskMarkersToListItems,
  VisualEditor,
} from '../src/renderer/src/components/VisualEditor';
import { visualHtmlToMarkdown } from '../src/renderer/src/markdown/markdown';
import type { EditorFormattingHandle } from '../src/renderer/src/editor/commands';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('VisualEditor source preservation', () => {
  it('turns rich list items into tasks without removing inline formatting', () => {
    const list = document.createElement('ul');
    list.innerHTML = '<li><strong>Bold</strong> and <em>italic</em></li>';
    const item = list.querySelector('li');
    expect(item).not.toBeNull();

    addTaskMarkersToListItems([item!]);

    expect(item!.querySelector('strong')?.textContent).toBe('Bold');
    expect(item!.querySelector('em')?.textContent).toBe('italic');
    expect(visualHtmlToMarkdown(list.outerHTML)).toContain('- [ ] **Bold** and *italic*');
  });

  it('does not emit or rewrite Markdown merely by opening Visual Mode', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    const markdown = '# Exact source\n\n- [x] Keep spacing\n';

    await act(async () => {
      root.render(<VisualEditor markdown={markdown} onChange={onChange} />);
    });

    expect(container.querySelector('.visual-editor')?.innerHTML).toContain('Exact source');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('serializes only after an actual visual input event', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(<VisualEditor markdown="Original" onChange={onChange} />);
    });
    const editor = container.querySelector<HTMLDivElement>('.visual-editor');
    expect(editor).not.toBeNull();
    editor!.innerHTML = '<p>Changed visually</p>';
    editor!.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await act(async () => vi.advanceTimersByTime(130));

    expect(onChange).toHaveBeenCalledWith('Changed visually');
    await act(async () => root.unmount());
  });

  it('supports the Home ribbon copy, cut, and paste commands', async () => {
    vi.useFakeTimers();
    let clipboardText = 'Pasted';
    const writeClipboardText = vi.fn(async (text: string) => {
      clipboardText = text;
    });
    Object.defineProperty(window, 'desktopAPI', {
      configurable: true,
      value: {
        readClipboardText: vi.fn(async () => clipboardText),
        writeClipboardText,
      },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const editorRef = React.createRef<EditorFormattingHandle>();
    const onChange = vi.fn();

    await act(async () => {
      root.render(<VisualEditor ref={editorRef} markdown="Alpha Beta" onChange={onChange} />);
    });
    const editor = container.querySelector('.visual-editor');
    const textNode =
      editor?.firstChild instanceof Text ? editor.firstChild : editor?.firstChild?.firstChild;
    expect(textNode).toBeTruthy();
    const selectAlpha = (): void => {
      const range = document.createRange();
      range.setStart(textNode!, 0);
      range.setEnd(textNode!, 5);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    selectAlpha();
    await act(async () => editorRef.current?.clipboard('copy'));
    expect(writeClipboardText).toHaveBeenLastCalledWith('Alpha');

    selectAlpha();
    await act(async () => editorRef.current?.clipboard('cut'));
    await act(async () => vi.advanceTimersByTime(130));
    expect(onChange).toHaveBeenLastCalledWith('Beta');

    clipboardText = 'Pasted';
    await act(async () => editorRef.current?.clipboard('paste'));
    await act(async () => vi.advanceTimersByTime(130));
    expect(onChange).toHaveBeenLastCalledWith('Pasted Beta');

    await act(async () => root.unmount());
  });
});
