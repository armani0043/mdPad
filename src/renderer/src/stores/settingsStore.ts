import { create } from 'zustand';
import type {
  LineEnding,
  SaveSerializationOptions,
  TextEncoding,
  ThemeSetting,
} from '../../../shared/types';
import type { PasteMode } from '../editor/commands';

export type ViewMode = 'source' | 'visual' | 'preview' | 'split';
export type AutosaveMode = 'off' | 'delay' | 'blur';
export const ZOOM_MIN = 25;
export const ZOOM_MAX = 300;
export const ZOOM_STEP = 10;
export const DEFAULT_ZOOM = 100;

export interface PersistedSettings {
  theme: ThemeSetting;
  wordWrap: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  autosave: AutosaveMode;
  autosaveDelay: number;
  attachmentFolder: string;
  showAllFiles: boolean;
  viewMode: ViewMode;
  sideBySide: boolean;
  reopenLastWorkspace: boolean;
  defaultPasteMode: PasteMode;
  zoom: number;
}

interface SettingsState extends PersistedSettings {
  resolvedTheme: 'light' | 'dark';
  defaultLineEnding: Exclude<LineEnding, 'MIXED' | 'NONE'>;
  setTheme(theme: ThemeSetting): void;
  cycleTheme(): void;
  updateSettings(settings: Partial<PersistedSettings>): void;
  setDefaultLineEnding(eol: 'LF' | 'CRLF'): void;
  setViewMode(mode: ViewMode): void;
  setZoom(zoom: number): void;
  resetZoom(): void;
}

const STORAGE_KEY = 'mdpad.settings.v1';
const DEFAULTS: PersistedSettings = {
  theme: 'system',
  wordWrap: true,
  fontFamily: "'Cascadia Code', Consolas, monospace",
  fontSize: 15,
  lineHeight: 1.65,
  contentWidth: 920,
  autosave: 'off',
  autosaveDelay: 1200,
  attachmentFolder: 'attachments',
  showAllFiles: false,
  viewMode: 'visual',
  sideBySide: false,
  reopenLastWorkspace: true,
  defaultPasteMode: 'keep-source',
  zoom: DEFAULT_ZOOM,
};

function validPasteMode(value: unknown): PasteMode {
  return value === 'merge-formatting' || value === 'text-only' ? value : 'keep-source';
}

export function clampZoom(value: number): number {
  const numeric = Number.isFinite(value) ? value : DEFAULT_ZOOM;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(numeric)));
}

function loadSettings(): PersistedSettings {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '',
    ) as Partial<PersistedSettings>;
    return {
      ...DEFAULTS,
      ...parsed,
      fontSize: Math.min(32, Math.max(11, Number(parsed.fontSize ?? DEFAULTS.fontSize))),
      lineHeight: Math.min(2.4, Math.max(1.2, Number(parsed.lineHeight ?? DEFAULTS.lineHeight))),
      contentWidth: Math.min(
        1600,
        Math.max(560, Number(parsed.contentWidth ?? DEFAULTS.contentWidth)),
      ),
      autosaveDelay: Math.min(
        10_000,
        Math.max(300, Number(parsed.autosaveDelay ?? DEFAULTS.autosaveDelay)),
      ),
      defaultPasteMode: validPasteMode(parsed.defaultPasteMode),
      zoom: clampZoom(Number(parsed.zoom ?? DEFAULTS.zoom)),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyVisualSettings(settings: PersistedSettings, resolvedTheme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.style.setProperty('--font-editor', settings.fontFamily);
  root.style.setProperty('--font-size-editor', `${settings.fontSize}px`);
  root.style.setProperty('--editor-line-height', String(settings.lineHeight));
  root.style.setProperty('--content-width', `${settings.contentWidth}px`);
  root.style.setProperty('--document-zoom', String(settings.zoom / 100));
}

const initial = loadSettings();
const initialResolvedTheme = initial.theme === 'system' ? systemTheme() : initial.theme;
applyVisualSettings(initial, initialResolvedTheme);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,
  resolvedTheme: initialResolvedTheme,
  defaultLineEnding: 'CRLF',
  setTheme: (theme) => {
    const resolvedTheme = theme === 'system' ? systemTheme() : theme;
    const next = { ...get(), theme };
    applyVisualSettings(next, resolvedTheme);
    set({ theme, resolvedTheme });
  },
  cycleTheme: () => {
    const order: ThemeSetting[] = ['system', 'light', 'dark'];
    const current = get().theme;
    get().setTheme(order[(order.indexOf(current) + 1) % order.length] ?? 'system');
  },
  updateSettings: (settings) => {
    const next = { ...get(), ...settings };
    const resolvedTheme = next.theme === 'system' ? systemTheme() : next.theme;
    applyVisualSettings(next, resolvedTheme);
    set({ ...settings, resolvedTheme });
  },
  setDefaultLineEnding: (defaultLineEnding) => set({ defaultLineEnding }),
  setViewMode: (viewMode) => set({ viewMode, sideBySide: false }),
  setZoom: (zoom) => {
    const nextZoom = clampZoom(zoom);
    const next = { ...get(), zoom: nextZoom };
    applyVisualSettings(next, next.resolvedTheme);
    set({ zoom: nextZoom });
  },
  resetZoom: () => get().setZoom(DEFAULT_ZOOM),
}));

useSettingsStore.subscribe((state) => {
  const persisted: PersistedSettings = {
    theme: state.theme,
    wordWrap: state.wordWrap,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    contentWidth: state.contentWidth,
    autosave: state.autosave,
    autosaveDelay: state.autosaveDelay,
    attachmentFolder: state.attachmentFolder,
    showAllFiles: state.showAllFiles,
    viewMode: state.viewMode,
    sideBySide: state.sideBySide,
    reopenLastWorkspace: state.reopenLastWorkspace,
    defaultPasteMode: state.defaultPasteMode,
    zoom: state.zoom,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useSettingsStore.getState().theme === 'system')
    useSettingsStore.getState().setTheme('system');
});

export function saveOptionsFor(
  encoding: TextEncoding,
  lineEnding: LineEnding,
): SaveSerializationOptions {
  return { encoding, lineEnding: lineEnding === 'CRLF' ? 'CRLF' : 'LF' };
}
