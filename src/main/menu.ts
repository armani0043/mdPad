import { app, dialog, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC, SHORTCUTS } from '../shared/constants';
import type { MenuAction } from '../shared/types';

function send(mainWindow: BrowserWindow, action: MenuAction): void {
  mainWindow.webContents.send(IPC.menuAction, action);
}

async function showAbout(mainWindow: BrowserWindow): Promise<void> {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About mdPad',
    message: 'mdPad',
    detail: [
      `Version ${app.getVersion()}`,
      'A local-first, offline Markdown editor.',
      'Your documents remain on your computer.',
      '',
      `Electron ${process.versions.electron ?? ''}`,
      `Chromium ${process.versions.chrome ?? ''}`,
      `Node.js ${process.versions.node ?? ''}`,
    ].join('\n'),
    buttons: ['OK'],
    noLink: true,
  });
}

async function showKeyboardShortcuts(mainWindow: BrowserWindow): Promise<void> {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: 'mdPad keyboard shortcuts',
    detail: [
      'Ctrl+N  New document',
      'Ctrl+O  Open file',
      'Ctrl+Shift+O  Open folder',
      'Ctrl+S  Save',
      'Ctrl+Shift+S  Save As',
      'Ctrl+F / Ctrl+H  Find / Replace',
      'Ctrl+P  Quick open',
      'Ctrl+Shift+P  Command palette',
      'Ctrl+B / Ctrl+I  Bold / Italic',
      'Ctrl+Tab  Next tab',
      'Ctrl+W  Close tab',
      'Ctrl+1 / 2 / 3 / 4  Visual / Source / Preview / Split',
      'Ctrl+,  Preferences',
    ].join('\n'),
    buttons: ['OK'],
    noLink: true,
  });
}

async function showLicenses(mainWindow: BrowserWindow): Promise<void> {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Open-Source Licenses',
    message: 'mdPad uses commercially compatible open-source components.',
    detail:
      'Electron, React, CodeMirror, Marked, DOMPurify, Turndown, highlight.js, Lucide, and their dependencies retain their own licenses. See THIRD_PARTY_LICENSES.md in the source distribution for the reviewed inventory and release-notice requirements.',
    buttons: ['OK'],
    noLink: true,
  });
}

export function installApplicationMenu(mainWindow: BrowserWindow): void {
  const isDev = !app.isPackaged;
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: SHORTCUTS.newFile,
          click: () => send(mainWindow, 'file:new'),
        },
        {
          label: 'Open File…',
          accelerator: SHORTCUTS.openFile,
          click: () => send(mainWindow, 'file:open'),
        },
        {
          label: 'Open Folder…',
          accelerator: SHORTCUTS.openFolder,
          click: () => send(mainWindow, 'file:open-folder'),
        },
        { type: 'separator' },
        { label: 'Save', accelerator: SHORTCUTS.save, click: () => send(mainWindow, 'file:save') },
        {
          label: 'Save As…',
          accelerator: SHORTCUTS.saveAs,
          click: () => send(mainWindow, 'file:save-as'),
        },
        { type: 'separator' },
        { label: 'Export HTML…', click: () => send(mainWindow, 'file:export-html') },
        { label: 'Export PDF…', click: () => send(mainWindow, 'file:export-pdf') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send(mainWindow, 'edit:find') },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => send(mainWindow, 'edit:replace'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Visual Mode',
          accelerator: 'CmdOrCtrl+1',
          click: () => send(mainWindow, 'view:visual'),
        },
        {
          label: 'Source Mode',
          accelerator: 'CmdOrCtrl+2',
          click: () => send(mainWindow, 'view:source'),
        },
        {
          label: 'Reading / Preview Mode',
          accelerator: 'CmdOrCtrl+3',
          click: () => send(mainWindow, 'view:preview'),
        },
        {
          label: 'Source + Preview',
          accelerator: 'CmdOrCtrl+4',
          click: () => send(mainWindow, 'view:split'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Theme',
          accelerator: SHORTCUTS.toggleTheme,
          click: () => send(mainWindow, 'view:toggle-theme'),
        },
        { type: 'separator' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' },
        ...(isDev
          ? ([
              { label: 'Reload', role: 'reload' },
              { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
            ] satisfies MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Command Palette…',
          accelerator: SHORTCUTS.commandPalette,
          click: () => send(mainWindow, 'tools:command-palette'),
        },
        {
          label: 'Search Workspace…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send(mainWindow, 'tools:workspace-search'),
        },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => send(mainWindow, 'tools:preferences'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: () => void showKeyboardShortcuts(mainWindow) },
        { label: 'Open-Source Licenses', click: () => void showLicenses(mainWindow) },
        { type: 'separator' },
        { label: 'About mdPad', click: () => void showAbout(mainWindow) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
