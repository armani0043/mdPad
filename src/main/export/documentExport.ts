import fs from 'node:fs/promises';
import { BrowserWindow, dialog } from 'electron';
import type { ExportDocumentRequest } from '../../shared/types';
import { FileSystemError, toFileSystemError } from '../filesystem/errors';

const MAX_EXPORT_HTML_BYTES = 64 * 1024 * 1024;

export function validateExportRequest(value: unknown): ExportDocumentRequest {
  if (typeof value !== 'object' || value === null) {
    throw new FileSystemError('INVALID_PATH', 'Invalid export request.');
  }
  const request = value as Partial<ExportDocumentRequest>;
  if (
    typeof request.defaultFileName !== 'string' ||
    request.defaultFileName.includes('/') ||
    request.defaultFileName.includes('\\') ||
    typeof request.title !== 'string' ||
    typeof request.html !== 'string' ||
    Buffer.byteLength(request.html, 'utf8') > MAX_EXPORT_HTML_BYTES ||
    (request.theme !== 'light' && request.theme !== 'dark')
  ) {
    throw new FileSystemError('INVALID_PATH', 'Invalid export request.');
  }
  return {
    defaultFileName: request.defaultFileName.slice(0, 240),
    title: request.title.slice(0, 500),
    html: request.html,
    theme: request.theme,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function printableDocument(request: ExportDocumentRequest): string {
  const dark = request.theme === 'dark';
  const background = dark ? '#1f2025' : '#ffffff';
  const foreground = dark ? '#e8e6df' : '#24231f';
  const secondary = dark ? '#aaa79e' : '#65635c';
  const border = dark ? '#45464e' : '#dddcd7';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
<title>${escapeHtml(request.title)}</title>
<style>
@page { margin: 18mm; }
body { max-width: 850px; margin: 0 auto; padding: 36px; color: ${foreground}; background: ${background}; font: 16px/1.7 system-ui, sans-serif; }
h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.4em 0 .55em; } h1,h2 { border-bottom: 1px solid ${border}; padding-bottom: .25em; }
code,pre { font-family: Consolas, monospace; } pre { overflow-wrap: anywhere; padding: 14px; border: 1px solid ${border}; border-radius: 6px; }
blockquote { margin-left: 0; padding-left: 16px; border-left: 4px solid ${border}; color: ${secondary}; }
table { border-collapse: collapse; width: 100%; } th,td { border: 1px solid ${border}; padding: 6px 9px; text-align: left; }
img { max-width: 100%; height: auto; } a { color: #3478d4; } mark { background: #ffe58a; padding: 0 .12em; }
input[type=checkbox] { margin-right: .45em; }
</style></head><body>${request.html}</body></html>`;
}

export async function exportHtmlDocument(
  parent: BrowserWindow,
  value: unknown,
): Promise<string | null> {
  const request = validateExportRequest(value);
  const chosen = await dialog.showSaveDialog(parent, {
    title: 'Export Markdown as HTML',
    defaultPath: request.defaultFileName.replace(/\.(md|markdown)$/i, '') + '.html',
    filters: [{ name: 'HTML document', extensions: ['html'] }],
  });
  if (chosen.canceled || !chosen.filePath) return null;
  try {
    await fs.writeFile(chosen.filePath, printableDocument(request), 'utf8');
    return chosen.filePath;
  } catch (error) {
    throw toFileSystemError(error, 'Could not export HTML');
  }
}

export async function exportPdfDocument(
  parent: BrowserWindow,
  value: unknown,
): Promise<string | null> {
  const request = validateExportRequest(value);
  const chosen = await dialog.showSaveDialog(parent, {
    title: 'Export Markdown as PDF',
    defaultPath: request.defaultFileName.replace(/\.(md|markdown)$/i, '') + '.pdf',
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  });
  if (chosen.canceled || !chosen.filePath) return null;
  const exportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  exportWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  exportWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  try {
    const document = printableDocument(request);
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document)}`);
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    await fs.writeFile(chosen.filePath, pdf);
    return chosen.filePath;
  } catch (error) {
    throw toFileSystemError(error, 'Could not export PDF');
  } finally {
    exportWindow.destroy();
  }
}
