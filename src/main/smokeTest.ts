import path from 'node:path';
import fs from 'node:fs/promises';
import { app, type BrowserWindow } from 'electron';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function runUiSmokeTest(window: BrowserWindow): void {
  if (process.env.MDPAD_UI_SMOKE !== '1') return;
  window.webContents.once('did-finish-load', () => {
    void (async () => {
      await delay(700);
      const result = (await window.webContents.executeJavaScript(`
        (async () => {
          const pause = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
          const button = (title) => document.querySelector('button[title="' + title + '"]');
          const ribbonTab = (label) => [...document.querySelectorAll('.ribbon-tabs button')]
            .find((element) => element.textContent?.trim() === label);
          const requiredTools = [
            'Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Underline', 'Highlight',
            'Font family', 'Font size', 'Align left', 'Align center', 'Align right', 'Justify',
            'Paste (Ctrl+V)', 'Cut (Ctrl+X)', 'Copy (Ctrl+C)'
          ];
          const toolbarTitles = [...document.querySelectorAll('.editor-toolbar [title]')]
            .map((element) => element.getAttribute('title'));
          const selectLabels = [...document.querySelectorAll('.editor-toolbar select')]
            .map((element) => element.getAttribute('aria-label'));
          const missingTools = requiredTools.filter((title) =>
            title === 'Font family' || title === 'Font size'
              ? !selectLabels.includes(title)
              : !toolbarTitles.includes(title)
          );
          const modeOrder = [...document.querySelectorAll('.ribbon-mode-switcher button')]
            .map((element) => element.getAttribute('title'));
          const expectedModeOrder = ['Visual mode', 'Source mode', 'Preview mode', 'Split mode', 'Preferences'];
          const modeOrderCorrect = expectedModeOrder.every((title, index) => modeOrder[index] === title);
          const ribbonTabs = [...document.querySelectorAll('.ribbon-tabs button')]
            .map((element) => element.textContent?.trim());
          const ribbonTabsCorrect = ['File', 'Home', 'Insert', 'Workspace', 'View', 'Help']
            .every((label, index) => ribbonTabs[index] === label) && ribbonTabs.length === 6;
          const logoPresent = Boolean(document.querySelector('.ribbon-brand img'));
          const normalSidebarAbsent = !document.querySelector('.sidebar');
          const homePanelTitles = [...document.querySelectorAll('.ribbon-panel [title]')]
            .map((element) => element.getAttribute('title'));
          const homeDuplicatesAbsent = !homePanelTitles.includes('Save (Ctrl+S)') &&
            !homePanelTitles.includes('Undo') && !homePanelTitles.includes('Redo');
          const headerTitle = document.querySelector('.ribbon-document-title');
          const headerTitleConstrained = Boolean(headerTitle?.getAttribute('title')) &&
            (headerTitle?.textContent?.trim().length ?? 100) <= 42;

          button('Source mode')?.click(); await pause();
          const sourcePresent = Boolean(document.querySelector('.cm-editor'));
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: true } }));
          await pause();
          const sourceFindPresent = Boolean(document.querySelector('.find-replace-bar .replace-row'));
          document.querySelector('.find-close')?.click(); await pause();

          button('Visual mode')?.click(); await pause();
          const visualPresent = Boolean(document.querySelector('.visual-editor'));
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: false } }));
          await pause();
          const visualFindPresent = Boolean(document.querySelector('.find-replace-bar'));
          document.querySelector('.find-close')?.click(); await pause();

          button('Preview mode')?.click(); await pause();
          const previewPresent = Boolean(document.querySelector('.markdown-preview'));
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: true } }));
          await pause();
          const previewFindPresent = Boolean(document.querySelector('.find-replace-bar .replace-row'));
          document.querySelector('.find-close')?.click(); await pause();

          button('Split mode')?.click(); await pause();
          const splitPresent = Boolean(document.querySelector('.split-editor'));
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: false } }));
          await pause();
          const splitFindPresent = Boolean(document.querySelector('.find-replace-bar'));
          document.querySelector('.find-close')?.click(); await pause();

          ribbonTab('Workspace')?.click(); await pause();
          const workspaceTitles = [...document.querySelectorAll('.ribbon-panel [title]')]
            .map((element) => element.getAttribute('title'));
          const workspaceToolsPresent = [
            'Workspace files', 'Search workspace', 'Document outline', 'Backlinks', 'Tags'
          ].every((title) => workspaceTitles.includes(title));
          button('Workspace files')?.click(); await pause();
          const temporaryWorkspacePanePresent = Boolean(document.querySelector('.transient-sidebar'));
          document.querySelector('.transient-sidebar button[title="Close navigation pane"]')?.click();
          await pause();
          const workspacePaneCloses = !document.querySelector('.sidebar');
          ribbonTab('Home')?.click(); await pause();

          ribbonTab('Insert')?.click(); await pause();
          button('Link')?.click(); await pause();
          const linkDialogPresent = Boolean(document.querySelector('.link-dialog'));
          document.querySelector('.link-dialog header button')?.click(); await pause();
          const imageInsertAbsent = !button('Choose an image from this computer');

          button('Visual mode')?.click(); await pause();
          const referenceEditor = document.querySelector('.visual-editor');
          if (referenceEditor) {
            referenceEditor.textContent = 'Reference document';
            referenceEditor.dispatchEvent(new InputEvent('input', { bubbles: true }));
            await wait(180);
          }
          ribbonTab('File')?.click(); await pause();
          button('New document')?.click(); await pause();
          if (document.querySelectorAll('.tab').length < 2) {
            button('New document')?.click(); await pause();
          }
          ribbonTab('View')?.click(); await pause();
          if (!document.querySelector('.multi-document-view')) {
            button('Show all open documents side by side')?.click(); await pause();
          }
          const sideTabCount = document.querySelectorAll('.tab').length;
          const sidePanes = document.querySelectorAll('.multi-document-pane').length;
          const sideActiveEditable = Boolean(
            document.querySelector('.multi-document-pane.active .visual-editor[contenteditable="true"]')
          );
          const sideReferenceVisible = Boolean(
            document.querySelector('.multi-document-pane:not(.active) .markdown-preview')
          );
          const sideLabelsPresent = Boolean(
            [...document.querySelectorAll('.multi-document-state')]
              .some((element) => element.textContent?.trim() === 'Editing')
          );
          button('Show all open documents side by side')?.click(); await pause();

          ribbonTab('Help')?.click(); await pause();
          button('About mdPad')?.click(); await pause();
          const aboutAuthorCorrect = document.querySelector('.about-author')?.textContent?.trim() ===
            'Shafiq Abdul Rehman (PhD).';
          const aboutContactPresent = document.querySelector('.about-contact')?.textContent?.trim() ===
            'mdpad@olynors.com';
          document.querySelector('.about-close')?.click(); await pause();
          ribbonTab('Home')?.click(); await pause();

          button('Collapse ribbon')?.click(); await pause();
          const ribbonCollapsed = !document.querySelector('.ribbon-panel');
          button('Expand ribbon')?.click(); await pause();
          const ribbonExpanded = Boolean(document.querySelector('.ribbon-panel'));

          button('Preferences')?.click(); await pause();
          const settingsPresent = Boolean(document.querySelector('.settings-dialog'));
          document.querySelector('.settings-dialog button[title="Close"]')?.click(); await pause();
          const settingsClosed = !document.querySelector('.settings-dialog');
          button('Visual mode')?.click(); await pause();
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: false } }));
          await pause();
          const finalFindPaneVisible = Boolean(document.querySelector('.find-replace-bar'));
          return {
            sourcePresent, visualPresent, previewPresent, splitPresent, settingsPresent, settingsClosed,
            sourceFindPresent, visualFindPresent, previewFindPresent, splitFindPresent,
            workspaceToolsPresent, temporaryWorkspacePanePresent, workspacePaneCloses,
            normalSidebarAbsent, homeDuplicatesAbsent, headerTitleConstrained,
            ribbonCollapsed, ribbonExpanded, modeOrderCorrect, logoPresent, ribbonTabs,
            ribbonTabsCorrect, linkDialogPresent, imageInsertAbsent,
            sideTabCount, sidePanes, sideActiveEditable, sideReferenceVisible, sideLabelsPresent,
            aboutAuthorCorrect, aboutContactPresent, missingTools,
            finalFindPaneVisible,
            title: document.title,
            status: document.querySelector('.status-bar')?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
          };
        })()
      `)) as Record<string, unknown>;

      const screenshotPath = process.env.MDPAD_UI_SMOKE_SCREENSHOT;
      if (screenshotPath && path.isAbsolute(screenshotPath)) {
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        const image = await window.webContents.capturePage();
        await fs.writeFile(screenshotPath, image.toPNG());
      }
      const passed =
        result.sourcePresent === true &&
        result.visualPresent === true &&
        result.previewPresent === true &&
        result.splitPresent === true &&
        result.settingsPresent === true &&
        result.settingsClosed === true &&
        result.sourceFindPresent === true &&
        result.visualFindPresent === true &&
        result.previewFindPresent === true &&
        result.splitFindPresent === true &&
        result.workspaceToolsPresent === true &&
        result.temporaryWorkspacePanePresent === true &&
        result.workspacePaneCloses === true &&
        result.normalSidebarAbsent === true &&
        result.homeDuplicatesAbsent === true &&
        result.headerTitleConstrained === true &&
        result.ribbonCollapsed === true &&
        result.ribbonExpanded === true &&
        result.finalFindPaneVisible === true &&
        result.modeOrderCorrect === true &&
        result.logoPresent === true &&
        result.ribbonTabsCorrect === true &&
        result.linkDialogPresent === true &&
        result.imageInsertAbsent === true &&
        typeof result.sidePanes === 'number' &&
        result.sidePanes >= 2 &&
        result.sideActiveEditable === true &&
        result.sideReferenceVisible === true &&
        result.sideLabelsPresent === true &&
        result.aboutAuthorCorrect === true &&
        result.aboutContactPresent === true &&
        Array.isArray(result.missingTools) &&
        result.missingTools.length === 0;
      const resultPath = process.env.MDPAD_UI_SMOKE_RESULT;
      if (resultPath && path.isAbsolute(resultPath)) {
        await fs.mkdir(path.dirname(resultPath), { recursive: true });
        await fs.writeFile(resultPath, JSON.stringify({ passed, ...result }, null, 2), 'utf8');
      }
      console.warn(`MDPAD_UI_SMOKE ${JSON.stringify({ passed, ...result })}`);
      app.exit(passed ? 0 : 1);
    })().catch((error: unknown) => {
      console.error('MDPAD_UI_SMOKE_FAILED', error);
      app.exit(1);
    });
  });
}
