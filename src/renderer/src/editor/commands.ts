export type FormatCommand =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'underline'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'blockquote'
  | 'inline-code'
  | 'code-block'
  | 'link'
  | 'image'
  | 'horizontal-rule'
  | 'table'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-justify'
  | 'font-family'
  | 'font-size'
  | 'undo'
  | 'redo';

export type PasteMode = 'keep-source' | 'merge-formatting' | 'text-only';
export type ClipboardCommand = 'paste' | 'cut' | 'copy';

export interface EditorFormattingHandle {
  format(command: FormatCommand, value?: string): void;
  clipboard(command: ClipboardCommand, pasteMode?: PasteMode): Promise<void>;
  insertText(text: string): void;
  openFind(): void;
  revealRange(from: number, to: number): void;
  focus(): void;
}
