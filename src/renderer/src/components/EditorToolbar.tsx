import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  CircleHelp,
  Code,
  Columns3,
  Copy,
  Eye,
  FileCode2,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Highlighter,
  Info,
  Italic,
  LayoutPanelTop,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MoonStar,
  PanelLeft,
  Pilcrow,
  Quote,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Scissors,
  Settings,
  Sigma,
  Strikethrough,
  Square,
  Table,
  Tags,
  Underline,
  Undo2,
  Waypoints,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import logoUrl from '../../../../resources/icon.png';
import type { FormatCommand, PasteMode } from '../editor/commands';
import { getActiveDocument, useDocumentStore } from '../stores/documentStore';
import { DEFAULT_ZOOM, ZOOM_STEP, useSettingsStore, type ViewMode } from '../stores/settingsStore';
import { parentFolderForSelection, useWorkspaceStore } from '../stores/workspaceStore';
import { SymbolPicker } from './SymbolPicker';
import { LinkDialog } from './LinkDialog';

type RibbonTab = 'file' | 'home' | 'insert' | 'workspace' | 'view' | 'help';
type SidebarView = 'files' | 'search' | 'outline' | 'backlinks' | 'tags';

interface EditorToolbarProps {
  onOpenSettings(): void;
  onOpenPalette(): void;
  onExport(format: 'html' | 'pdf'): void;
  onOpenGuide(): void;
  onOpenAbout(): void;
}

interface RibbonButtonProps {
  title: string;
  disabled?: boolean;
  active?: boolean;
  large?: boolean;
  onClick(): void;
  children: React.ReactNode;
  label?: string;
}

function RibbonButton({
  title,
  disabled,
  active,
  large,
  onClick,
  children,
  label,
}: RibbonButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`tool-button ribbon-button${active ? ' active' : ''}${large ? ' large' : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

function RibbonGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="ribbon-group" aria-label={label}>
      <div className="ribbon-group-content">{children}</div>
      <span className="ribbon-group-label">{label}</span>
    </section>
  );
}

function emitFormat(command: FormatCommand, value?: string): void {
  window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command, value } }));
}

function openFind(replace: boolean): void {
  window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace } }));
}

function clipboard(command: 'paste' | 'cut' | 'copy', pasteMode?: PasteMode): void {
  window.dispatchEvent(new CustomEvent('mdpad:clipboard', { detail: { command, pasteMode } }));
}

const PASTE_OPTIONS: Array<{ mode: PasteMode; label: string; description: string }> = [
  {
    mode: 'keep-source',
    label: 'Keep Source Formatting',
    description: 'Keep supported fonts, colours, emphasis, lists, links, tables, and structure.',
  },
  {
    mode: 'merge-formatting',
    label: 'Merge Formatting',
    description: 'Keep semantic formatting while using mdPad document styling.',
  },
  {
    mode: 'text-only',
    label: 'Keep Text Only',
    description: 'Discard formatting and paste plain text.',
  },
];

function PasteSpecialControl({
  disabled,
  defaultMode,
  onDefaultChange,
}: {
  disabled: boolean;
  defaultMode: PasteMode;
  onDefaultChange(mode: PasteMode): void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  const toggle = (): void => {
    if (!open) {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          left: Math.max(8, Math.min(rect.left, window.innerWidth - 330)),
          top: rect.bottom + 4,
        });
      }
    }
    setOpen((current) => !current);
  };

  return (
    <div className="paste-special-control" ref={anchorRef}>
      <RibbonButton
        title="Paste (Ctrl+V)"
        large
        label="Paste"
        disabled={disabled}
        onClick={() => clipboard('paste')}
      >
        <ClipboardPaste size={24} />
      </RibbonButton>
      <button
        type="button"
        className="paste-special-toggle"
        aria-label="Paste Special"
        title="Paste Special"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="paste-special-menu"
            role="menu"
            aria-label="Paste Special"
            style={position}
          >
            <strong>Paste Special</strong>
            {PASTE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="menuitem"
                onClick={() => {
                  clipboard('paste', option.mode);
                  setOpen(false);
                }}
              >
                <span>
                  {option.label}
                  {option.mode === defaultMode && <small>Default</small>}
                </span>
                <small>{option.description}</small>
              </button>
            ))}
            <label>
              <span>Default paste behavior</span>
              <select
                aria-label="Default paste behavior"
                value={defaultMode}
                onChange={(event) => onDefaultChange(event.target.value as PasteMode)}
              >
                {PASTE_OPTIONS.map((option) => (
                  <option key={option.mode} value={option.mode}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>,
          document.body,
        )}
    </div>
  );
}

function showSidebar(view: SidebarView): void {
  window.dispatchEvent(new CustomEvent('mdpad:navigation-view', { detail: { view } }));
}

export function compactDocumentName(name: string, maximum = 42): string {
  if (name.length <= maximum) return name;
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : '';
  const tailLength = Math.min(12, Math.max(7, maximum - extension.length - 21));
  const tailStart = Math.max(0, name.length - extension.length - tailLength);
  return `${name.slice(0, maximum - extension.length - tailLength - 1)}…${name.slice(tailStart)}`;
}

export function EditorToolbar({
  onOpenSettings,
  onOpenPalette,
  onExport,
  onOpenGuide,
  onOpenAbout,
}: EditorToolbarProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [ribbonExpanded, setRibbonExpanded] = useState(true);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const selectedRelativePath = useWorkspaceStore((state) => state.selectedRelativePath);
  const viewMode = useSettingsStore((state) => state.viewMode);
  const sideBySide = useSettingsStore((state) => state.sideBySide);
  const wordWrap = useSettingsStore((state) => state.wordWrap);
  const theme = useSettingsStore((state) => state.theme);
  const defaultPasteMode = useSettingsStore((state) => state.defaultPasteMode);
  const zoom = useSettingsStore((state) => state.zoom);
  const activeDocument = getActiveDocument({ documents, activeDocumentId });
  const canFormat = Boolean(activeDocument) && (sideBySide || viewMode !== 'preview');
  const parent = workspace ? parentFolderForSelection(workspace, selectedRelativePath) : '';
  const documentStore = useDocumentStore.getState();
  const workspaceStore = useWorkspaceStore.getState();
  const settings = useSettingsStore.getState();

  useEffect(() => {
    const refresh = (): void => {
      void window.desktopAPI.isWindowMaximized().then(setIsMaximized);
    };
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, []);

  const createFile = (): void => {
    if (!workspace) return void workspaceStore.openWorkspace();
    const name = window.prompt('New Markdown file name', 'untitled.md');
    if (name) void workspaceStore.createFile(parent, name);
  };
  const createFolder = (): void => {
    if (!workspace) return void workspaceStore.openWorkspace();
    const name = window.prompt('New folder name', 'New Folder');
    if (name) void workspaceStore.createFolder(parent, name);
  };

  const modes: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
    { mode: 'visual', label: 'Visual', icon: <Pilcrow size={15} /> },
    { mode: 'source', label: 'Source', icon: <FileCode2 size={15} /> },
    { mode: 'preview', label: 'Preview', icon: <Eye size={15} /> },
    { mode: 'split', label: 'Split', icon: <PanelLeft size={15} /> },
  ];
  const tabs: Array<{ id: RibbonTab; label: string }> = [
    { id: 'file', label: 'File' },
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'view', label: 'View' },
    { id: 'help', label: 'Help' },
  ];

  const renderPanel = (): React.ReactNode => {
    switch (activeTab) {
      case 'file':
        return (
          <>
            <RibbonGroup label="Create & open">
              <RibbonButton
                title="New document"
                large
                label="New"
                onClick={documentStore.newDocument}
              >
                <FilePlus2 size={24} />
              </RibbonButton>
              <RibbonButton
                title="Open file"
                large
                label="Open file"
                onClick={() => void documentStore.openFileViaDialog()}
              >
                <FileText size={24} />
              </RibbonButton>
              <RibbonButton
                title="Open folder"
                large
                label="Open folder"
                onClick={() => void workspaceStore.openWorkspace()}
              >
                <FolderOpen size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Save">
              <RibbonButton
                title="Save (Ctrl+S)"
                large
                label="Save"
                onClick={() => void documentStore.saveActive()}
              >
                <Save size={24} />
              </RibbonButton>
              <RibbonButton
                title="Save As"
                large
                label="Save As"
                onClick={() => void documentStore.saveActiveAs()}
              >
                <FileDown size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Export">
              <RibbonButton title="Export HTML" large label="HTML" onClick={() => onExport('html')}>
                <FileCode2 size={24} />
              </RibbonButton>
              <RibbonButton title="Export PDF" large label="PDF" onClick={() => onExport('pdf')}>
                <FileDown size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
      case 'insert':
        return (
          <>
            <RibbonGroup label="Links & media">
              <RibbonButton
                title="Link"
                large
                label="Link"
                disabled={!canFormat}
                onClick={() => setLinkOpen(true)}
              >
                <Link size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Blocks">
              <RibbonButton
                title="Table"
                large
                label="Table"
                disabled={!canFormat}
                onClick={() => emitFormat('table')}
              >
                <Table size={24} />
              </RibbonButton>
              <RibbonButton
                title="Code block"
                large
                label="Code"
                disabled={!canFormat}
                onClick={() => emitFormat('code-block')}
              >
                <Code size={24} />
              </RibbonButton>
              <RibbonButton
                title="Block quote"
                large
                label="Quote"
                disabled={!canFormat}
                onClick={() => emitFormat('blockquote')}
              >
                <Quote size={24} />
              </RibbonButton>
              <RibbonButton
                title="Horizontal rule"
                large
                label="Rule"
                disabled={!canFormat}
                onClick={() => emitFormat('horizontal-rule')}
              >
                <Minus size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Symbols">
              <RibbonButton
                title="Insert symbol"
                large
                label="Symbols"
                disabled={!canFormat}
                onClick={() => setSymbolsOpen(true)}
              >
                <Sigma size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
      case 'workspace':
        return (
          <>
            <RibbonGroup label="Workspace">
              <RibbonButton
                title="Open folder"
                large
                label="Open folder"
                onClick={() => void workspaceStore.openWorkspace()}
              >
                <FolderOpen size={24} />
              </RibbonButton>
              <RibbonButton title="New workspace file" large label="New file" onClick={createFile}>
                <FilePlus2 size={24} />
              </RibbonButton>
              <RibbonButton
                title="New workspace folder"
                large
                label="New folder"
                onClick={createFolder}
              >
                <FolderPlus size={24} />
              </RibbonButton>
              <RibbonButton
                title="Refresh workspace"
                large
                label="Refresh"
                disabled={!workspace}
                onClick={() => void workspaceStore.refresh()}
              >
                <RefreshCw size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Navigation">
              <RibbonButton
                title="Workspace files"
                large
                label="Files"
                onClick={() => showSidebar('files')}
              >
                <FolderOpen size={24} />
              </RibbonButton>
              <RibbonButton
                title="Search workspace"
                large
                label="Search"
                onClick={() => showSidebar('search')}
              >
                <Search size={24} />
              </RibbonButton>
              <RibbonButton
                title="Document outline"
                large
                label="Outline"
                onClick={() => showSidebar('outline')}
              >
                <List size={24} />
              </RibbonButton>
              <RibbonButton
                title="Backlinks"
                large
                label="Backlinks"
                onClick={() => showSidebar('backlinks')}
              >
                <Waypoints size={24} />
              </RibbonButton>
              <RibbonButton title="Tags" large label="Tags" onClick={() => showSidebar('tags')}>
                <Tags size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Settings">
              <RibbonButton title="Preferences" large label="Preferences" onClick={onOpenSettings}>
                <Settings size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
      case 'view':
        return (
          <>
            <RibbonGroup label="Document view">
              {modes.map(({ mode, label, icon }) => (
                <RibbonButton
                  key={mode}
                  title={`${label} mode`}
                  large
                  label={label}
                  active={viewMode === mode}
                  onClick={() => settings.setViewMode(mode)}
                >
                  {icon}
                </RibbonButton>
              ))}
            </RibbonGroup>
            <RibbonGroup label="Appearance">
              <RibbonButton
                title="Cycle theme"
                large
                label={`Theme: ${theme}`}
                onClick={settings.cycleTheme}
              >
                <MoonStar size={24} />
              </RibbonButton>
              <RibbonButton
                title="Wrap long lines"
                active={wordWrap}
                large
                label="Word wrap"
                onClick={() => settings.updateSettings({ wordWrap: !wordWrap })}
              >
                <BookOpen size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Zoom">
              <RibbonButton
                title="Zoom out (Ctrl+-)"
                large
                label="Zoom out"
                onClick={() => settings.setZoom(zoom - ZOOM_STEP)}
              >
                <ZoomOut size={24} />
              </RibbonButton>
              <RibbonButton
                title="Reset zoom to 100% (Ctrl+0)"
                large
                label={`${zoom}%`}
                active={zoom === DEFAULT_ZOOM}
                onClick={settings.resetZoom}
              >
                <RotateCcw size={24} />
              </RibbonButton>
              <RibbonButton
                title="Zoom in (Ctrl++)"
                large
                label="Zoom in"
                onClick={() => settings.setZoom(zoom + ZOOM_STEP)}
              >
                <ZoomIn size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Window">
              <RibbonButton
                title="Show all open documents side by side"
                active={sideBySide}
                large
                label={sideBySide ? 'Single view' : 'Side by side'}
                disabled={documents.length < 2}
                onClick={() => settings.updateSettings({ sideBySide: !sideBySide })}
              >
                <Columns3 size={24} />
              </RibbonButton>
              <RibbonButton title="Command palette" large label="Commands" onClick={onOpenPalette}>
                <LayoutPanelTop size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
      case 'help':
        return (
          <>
            <RibbonGroup label="Help">
              <RibbonButton title="Open the mdPad guide" large label="Guide" onClick={onOpenGuide}>
                <CircleHelp size={24} />
              </RibbonButton>
              <RibbonButton title="About mdPad" large label="About" onClick={onOpenAbout}>
                <Info size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
      case 'home':
      default:
        return (
          <>
            <RibbonGroup label="Clipboard">
              <PasteSpecialControl
                disabled={!canFormat}
                defaultMode={defaultPasteMode}
                onDefaultChange={(mode) => settings.updateSettings({ defaultPasteMode: mode })}
              />
              <RibbonButton
                title="Cut (Ctrl+X)"
                large
                label="Cut"
                disabled={!canFormat}
                onClick={() => clipboard('cut')}
              >
                <Scissors size={24} />
              </RibbonButton>
              <RibbonButton
                title="Copy (Ctrl+C)"
                large
                label="Copy"
                disabled={!canFormat}
                onClick={() => clipboard('copy')}
              >
                <Copy size={24} />
              </RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Font">
              <div className="ribbon-font-grid">
                <select
                  className="tool-select heading-select"
                  aria-label="Text style"
                  disabled={!canFormat}
                  defaultValue="paragraph"
                  onChange={(event) => emitFormat(event.target.value as FormatCommand)}
                >
                  <option value="paragraph">Paragraph</option>
                  <option value="heading1">Heading 1</option>
                  <option value="heading2">Heading 2</option>
                  <option value="heading3">Heading 3</option>
                </select>
                <select
                  className="tool-select font-select"
                  aria-label="Font family"
                  disabled={!canFormat}
                  defaultValue="system-ui"
                  onChange={(event) => emitFormat('font-family', event.target.value)}
                >
                  <option value="system-ui">System Sans</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Consolas, monospace">Consolas</option>
                </select>
                <select
                  className="tool-select size-select"
                  aria-label="Font size"
                  disabled={!canFormat}
                  defaultValue="16px"
                  onChange={(event) => emitFormat('font-size', event.target.value)}
                >
                  {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((size) => (
                    <option key={size} value={`${size}px`}>
                      {size}
                    </option>
                  ))}
                </select>
                <div className="ribbon-inline-tools">
                  <RibbonButton
                    title="Bold (Ctrl+B)"
                    disabled={!canFormat}
                    onClick={() => emitFormat('bold')}
                  >
                    <Bold size={18} />
                  </RibbonButton>
                  <RibbonButton
                    title="Italic (Ctrl+I)"
                    disabled={!canFormat}
                    onClick={() => emitFormat('italic')}
                  >
                    <Italic size={18} />
                  </RibbonButton>
                  <RibbonButton
                    title="Underline"
                    disabled={!canFormat}
                    onClick={() => emitFormat('underline')}
                  >
                    <Underline size={18} />
                  </RibbonButton>
                  <RibbonButton
                    title="Strikethrough"
                    disabled={!canFormat}
                    onClick={() => emitFormat('strikethrough')}
                  >
                    <Strikethrough size={18} />
                  </RibbonButton>
                  <RibbonButton
                    title="Highlight"
                    disabled={!canFormat}
                    onClick={() => emitFormat('highlight')}
                  >
                    <Highlighter size={18} />
                  </RibbonButton>
                  <RibbonButton
                    title="Inline code"
                    disabled={!canFormat}
                    onClick={() => emitFormat('inline-code')}
                  >
                    <Code size={18} />
                  </RibbonButton>
                </div>
              </div>
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              <div className="ribbon-paragraph-grid">
                <RibbonButton
                  title="Bulleted list"
                  disabled={!canFormat}
                  onClick={() => emitFormat('bullet-list')}
                >
                  <List size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Numbered list"
                  disabled={!canFormat}
                  onClick={() => emitFormat('ordered-list')}
                >
                  <ListOrdered size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Task list"
                  disabled={!canFormat}
                  onClick={() => emitFormat('task-list')}
                >
                  <ListChecks size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Block quote"
                  disabled={!canFormat}
                  onClick={() => emitFormat('blockquote')}
                >
                  <Quote size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Align left"
                  disabled={!canFormat}
                  onClick={() => emitFormat('align-left')}
                >
                  <AlignLeft size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Align center"
                  disabled={!canFormat}
                  onClick={() => emitFormat('align-center')}
                >
                  <AlignCenter size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Align right"
                  disabled={!canFormat}
                  onClick={() => emitFormat('align-right')}
                >
                  <AlignRight size={18} />
                </RibbonButton>
                <RibbonButton
                  title="Justify"
                  disabled={!canFormat}
                  onClick={() => emitFormat('align-justify')}
                >
                  <AlignJustify size={18} />
                </RibbonButton>
              </div>
            </RibbonGroup>
            <RibbonGroup label="Find">
              <RibbonButton
                title="Find (Ctrl+F)"
                large
                label="Find"
                onClick={() => openFind(false)}
              >
                <Search size={24} />
              </RibbonButton>
              <RibbonButton
                title="Replace (Ctrl+H)"
                large
                label="Replace"
                onClick={() => openFind(true)}
              >
                <FileText size={24} />
              </RibbonButton>
            </RibbonGroup>
          </>
        );
    }
  };

  return (
    <header className="editor-toolbar ribbon-shell" aria-label="mdPad ribbon">
      <div
        className="ribbon-brand-row"
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest('.window-controls')) return;
          void window.desktopAPI.toggleMaximizeWindow().then(setIsMaximized);
        }}
      >
        <div className="ribbon-brand">
          <img src={logoUrl} alt="mdPad" />
          <strong>mdPad</strong>
        </div>
        <div className="quick-access" aria-label="Quick access">
          <RibbonButton title="Save (Ctrl+S)" onClick={() => void documentStore.saveActive()}>
            <Save size={16} />
          </RibbonButton>
          <RibbonButton title="Undo" disabled={!canFormat} onClick={() => emitFormat('undo')}>
            <Undo2 size={16} />
          </RibbonButton>
          <RibbonButton title="Redo" disabled={!canFormat} onClick={() => emitFormat('redo')}>
            <Redo2 size={16} />
          </RibbonButton>
        </div>
        <span className="ribbon-document-title" title={activeDocument?.displayName ?? 'mdPad'}>
          {compactDocumentName(activeDocument?.displayName ?? 'mdPad')}
        </span>
        <div className="window-controls" aria-label="Window controls">
          <button
            type="button"
            className="window-control"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => void window.desktopAPI.minimizeWindow()}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="window-control"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            onClick={() => void window.desktopAPI.toggleMaximizeWindow().then(setIsMaximized)}
          >
            {isMaximized ? <Copy size={13} /> : <Square size={11} strokeWidth={1.6} />}
          </button>
          <button
            type="button"
            className="window-control close"
            title="Close"
            aria-label="Close"
            onClick={() => void window.desktopAPI.closeWindow()}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="ribbon-tabs-row">
        <nav className="ribbon-tabs" aria-label="Ribbon tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab.id);
                setRibbonExpanded(true);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="ribbon-mode-switcher" aria-label="Editor mode">
          {modes.map(({ mode, label, icon }) => (
            <RibbonButton
              key={mode}
              title={`${label} mode`}
              active={viewMode === mode}
              onClick={() => settings.setViewMode(mode)}
            >
              {icon}
              <span>{label}</span>
            </RibbonButton>
          ))}
          <RibbonButton title="Preferences" onClick={onOpenSettings}>
            <Settings size={16} />
          </RibbonButton>
        </div>
      </div>
      {ribbonExpanded && (
        <div className="ribbon-panel" role="toolbar" aria-label={`${activeTab} tools`}>
          {renderPanel()}
          <button
            type="button"
            className="ribbon-collapse-button"
            title="Collapse ribbon"
            aria-label="Collapse ribbon"
            onClick={() => setRibbonExpanded(false)}
          >
            <ChevronUp size={14} />
          </button>
        </div>
      )}
      {!ribbonExpanded && (
        <button
          type="button"
          className="ribbon-expand-button"
          title="Expand ribbon"
          aria-label="Expand ribbon"
          onClick={() => setRibbonExpanded(true)}
        >
          <ChevronDown size={14} />
        </button>
      )}
      {symbolsOpen && (
        <SymbolPicker
          onClose={() => setSymbolsOpen(false)}
          onInsert={(symbol) => {
            window.dispatchEvent(
              new CustomEvent('mdpad:insert-text', { detail: { text: symbol } }),
            );
            setSymbolsOpen(false);
          }}
        />
      )}
      {linkOpen && (
        <LinkDialog
          onClose={() => setLinkOpen(false)}
          onInsert={(url) => {
            emitFormat('link', url);
            setLinkOpen(false);
          }}
        />
      )}
    </header>
  );
}
