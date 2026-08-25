import path from 'node:path';
import fs from 'node:fs/promises';
import { app, type BrowserWindow } from 'electron';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function runUiSmokeTest(window: BrowserWindow): void {
  if (process.env.MDPAD_UI_SMOKE !== '1') return;
  const expectedLaunchFileName = process.env.MDPAD_UI_SMOKE_EXPECT_FILE_NAME ?? '';
  window.webContents.once('did-finish-load', () => {
    void (async () => {
      await delay(700);
      const result = (await window.webContents.executeJavaScript(`
        (async () => {
          const expectedLaunchFileName = ${JSON.stringify(expectedLaunchFileName)};
          const pause = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
          const button = (title) => document.querySelector('button[title="' + title + '"]');
          const ribbonTab = (label) => [...document.querySelectorAll('.ribbon-tabs button')]
            .find((element) => element.textContent?.trim() === label);
           const requiredTools = [
             'Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Underline', 'Highlight',
             'Font family', 'Font size', 'Align left', 'Align center', 'Align right', 'Justify',
             'Paste (Ctrl+V)', 'Paste Special', 'Cut (Ctrl+X)', 'Copy (Ctrl+C)'
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
          const initialTabNames = [...document.querySelectorAll('.tab-name')]
            .map((element) => element.textContent?.trim());
          const initialLaunchFileCorrect = !expectedLaunchFileName ||
            (initialTabNames.length === 1 &&
              document.querySelector('.tab.active .tab-name')?.textContent?.trim() === expectedLaunchFileName);
          const autoUpdateNoticeAbsent = !document.querySelector('.update-notification');

           button('Source mode')?.click(); await pause();
           const sourcePresent = Boolean(document.querySelector('.cm-editor'));
           await window.desktopAPI.writeClipboard({
             text: 'SourceRich', html: '<p><strong>SourceRich</strong></p>', markdown: ''
           });
           window.dispatchEvent(new CustomEvent('mdpad:clipboard', {
             detail: { command: 'paste', pasteMode: 'keep-source' }
           }));
           await wait(180);
           const sourcePastePreserved = document.querySelector('.cm-content')?.textContent
             ?.includes('**SourceRich**') === true;
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'undo' } }));
           await wait(80);
           const sourcePasteUndo = document.querySelector('.cm-content')?.textContent
             ?.includes('SourceRich') === false;
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'redo' } }));
           await wait(80);
           const sourcePasteRedo = document.querySelector('.cm-content')?.textContent
             ?.includes('**SourceRich**') === true;
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'undo' } }));
           await wait(80);
          window.dispatchEvent(new CustomEvent('mdpad:editor-find', { detail: { replace: true } }));
          await pause();
          const sourceFindPresent = Boolean(document.querySelector('.find-replace-bar .replace-row'));
          document.querySelector('.find-close')?.click(); await pause();

           button('Visual mode')?.click(); await pause();
           const visualPresent = Boolean(document.querySelector('.visual-editor'));
           const visualClipboardEditor = document.querySelector('.visual-editor');
           if (visualClipboardEditor) {
             const range = document.createRange();
             range.selectNodeContents(visualClipboardEditor);
             range.collapse(false);
             const selection = window.getSelection();
             selection?.removeAllRanges(); selection?.addRange(range);
             visualClipboardEditor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
           }
           await window.desktopAPI.writeClipboard({
             text: 'VisualRich Paste',
             html: '<p><strong style="color: rgb(196, 43, 28)">VisualRich</strong> <em>Paste</em></p>',
             markdown: ''
           });
           window.dispatchEvent(new CustomEvent('mdpad:clipboard', {
             detail: { command: 'paste', pasteMode: 'keep-source' }
           }));
           await wait(180);
           const visualPastePreserved = Boolean(
             [...document.querySelectorAll('.visual-editor strong')]
               .find((element) => element.textContent === 'VisualRich' && element.getAttribute('style'))
           ) && Boolean(
             [...document.querySelectorAll('.visual-editor em')]
               .find((element) => element.textContent === 'Paste')
           );
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'undo' } }));
           await wait(160);
           const visualPasteUndo = !document.querySelector('.visual-editor')?.textContent
             ?.includes('VisualRich');
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'redo' } }));
           await wait(160);
           const visualPasteRedo = document.querySelector('.visual-editor')?.textContent
             ?.includes('VisualRich') === true;
           const copiedStrong = [...document.querySelectorAll('.visual-editor strong')]
             .find((element) => element.textContent === 'VisualRich');
           if (copiedStrong?.firstChild) {
             const range = document.createRange();
             range.selectNodeContents(copiedStrong);
             const selection = window.getSelection();
             selection?.removeAllRanges(); selection?.addRange(range);
             copiedStrong.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
           }
           window.dispatchEvent(new CustomEvent('mdpad:clipboard', { detail: { command: 'copy' } }));
           await wait(100);
           const richCopy = await window.desktopAPI.readClipboard();
           const visualCopyPreserved = richCopy.html.includes('<strong') &&
             richCopy.markdown.includes('VisualRich');
           window.dispatchEvent(new CustomEvent('mdpad:clipboard', { detail: { command: 'cut' } }));
           await wait(180);
           const visualCutApplied = !document.querySelector('.visual-editor')?.textContent
             ?.includes('VisualRich');
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'undo' } }));
           await wait(160);
           const visualCutUndo = document.querySelector('.visual-editor')?.textContent
             ?.includes('VisualRich') === true;
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'redo' } }));
           await wait(160);
           const visualCutRedo = !document.querySelector('.visual-editor')?.textContent
             ?.includes('VisualRich');
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
           button('Paste Special')?.click(); await pause();
           const pasteSpecialLabels = [...document.querySelectorAll('.paste-special-menu [role="menuitem"]')]
             .map((element) => element.querySelector('span')?.childNodes[0]?.textContent?.trim());
           const pasteSpecialOptionsPresent = [
             'Keep Source Formatting', 'Merge Formatting', 'Keep Text Only'
           ].every((label) => pasteSpecialLabels.includes(label));
           const defaultPasteSelect = document.querySelector('.paste-special-menu select');
           if (defaultPasteSelect) {
             defaultPasteSelect.value = 'merge-formatting';
             defaultPasteSelect.dispatchEvent(new Event('change', { bubbles: true }));
             await pause();
           }
           const defaultPasteSaved = JSON.parse(
             localStorage.getItem('mdpad.settings.v1') ?? '{}'
           ).defaultPasteMode === 'merge-formatting';
           if (defaultPasteSelect) {
             defaultPasteSelect.value = 'keep-source';
             defaultPasteSelect.dispatchEvent(new Event('change', { bubbles: true }));
             await pause();
           }
           button('Paste Special')?.click(); await pause();

          ribbonTab('Insert')?.click(); await pause();
          button('Link')?.click(); await pause();
          const linkDialogPresent = Boolean(document.querySelector('.link-dialog'));
          document.querySelector('.link-dialog header button')?.click(); await pause();
          const imageInsertAbsent = !button('Choose an image from this computer');

          button('Visual mode')?.click(); await pause();
           const referenceEditor = document.querySelector('.visual-editor');
           if (referenceEditor) {
             referenceEditor.innerHTML = '<p><strong>Reference</strong> <em>document</em></p>';
            referenceEditor.dispatchEvent(new InputEvent('input', { bubbles: true }));
            await wait(180);
          }
          ribbonTab('File')?.click(); await pause();
          button('New document')?.click(); await pause();
          if (document.querySelectorAll('.tab').length < 2) {
            button('New document')?.click(); await pause();
          }
           ribbonTab('View')?.click(); await pause();
           const zoomSliderPresent = Boolean(
             document.querySelector('.status-zoom input[aria-label="Document zoom percentage"]')
           );
           button('Zoom in (Ctrl++)')?.click(); await pause();
           const zoomInApplied = document.documentElement.style.getPropertyValue('--document-zoom') ===
             '1.1' && document.querySelector('.status-zoom-value')?.textContent?.trim() === '110%' &&
             getComputedStyle(document.querySelector('.visual-editor')).zoom === '1.1';
           button('Reset zoom to 100% (Ctrl+0)')?.click(); await pause();
           const zoomResetApplied = document.documentElement.style.getPropertyValue('--document-zoom') ===
             '1' && document.querySelector('.status-zoom-value')?.textContent?.trim() === '100%';
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
           const referencePreview = document.querySelector('.multi-document-pane:not(.active) .markdown-preview');
           const activeSideEditor = document.querySelector('.multi-document-pane.active .visual-editor');
           if (referencePreview && activeSideEditor) {
             await window.desktopAPI.writeClipboard({
               text: referencePreview.textContent ?? '',
               html: referencePreview.innerHTML,
               markdown: ''
             });
             const range = document.createRange();
             range.selectNodeContents(activeSideEditor); range.collapse(false);
             const selection = window.getSelection();
             selection?.removeAllRanges(); selection?.addRange(range);
             activeSideEditor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
             window.dispatchEvent(new CustomEvent('mdpad:clipboard', {
               detail: { command: 'paste', pasteMode: 'keep-source' }
             }));
             await wait(180);
           }
           const multiDocumentPastePreserved = Boolean(
             [...document.querySelectorAll('.multi-document-pane.active .visual-editor strong')]
               .find((element) => element.textContent === 'Reference')
           );
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'undo' } }));
           await wait(160);
           const multiDocumentPasteUndo = !document.querySelector(
             '.multi-document-pane.active .visual-editor'
           )?.textContent?.includes('Reference');
           window.dispatchEvent(new CustomEvent('mdpad:format', { detail: { command: 'redo' } }));
           await wait(160);
           const multiDocumentPasteRedo = document.querySelector(
             '.multi-document-pane.active .visual-editor'
           )?.textContent?.includes('Reference') === true;
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
             sourcePastePreserved, sourcePasteUndo, sourcePasteRedo,
             visualPastePreserved, visualPasteUndo, visualPasteRedo,
             visualCopyPreserved, visualCutApplied, visualCutUndo, visualCutRedo,
            sourceFindPresent, visualFindPresent, previewFindPresent, splitFindPresent,
            workspaceToolsPresent, temporaryWorkspacePanePresent, workspacePaneCloses,
            normalSidebarAbsent, homeDuplicatesAbsent, headerTitleConstrained,
            initialTabNames, initialLaunchFileCorrect,
            autoUpdateNoticeAbsent,
            ribbonCollapsed, ribbonExpanded, modeOrderCorrect, logoPresent, ribbonTabs,
             ribbonTabsCorrect, linkDialogPresent, imageInsertAbsent,
             pasteSpecialOptionsPresent, defaultPasteSaved,
             zoomSliderPresent, zoomInApplied, zoomResetApplied,
             sideTabCount, sidePanes, sideActiveEditable, sideReferenceVisible, sideLabelsPresent,
             multiDocumentPastePreserved, multiDocumentPasteUndo, multiDocumentPasteRedo,
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
        result.sourcePastePreserved === true &&
        result.sourcePasteUndo === true &&
        result.sourcePasteRedo === true &&
        result.visualPresent === true &&
        result.visualPastePreserved === true &&
        result.visualPasteUndo === true &&
        result.visualPasteRedo === true &&
        result.visualCopyPreserved === true &&
        result.visualCutApplied === true &&
        result.visualCutUndo === true &&
        result.visualCutRedo === true &&
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
        result.initialLaunchFileCorrect === true &&
        result.autoUpdateNoticeAbsent === true &&
        result.ribbonCollapsed === true &&
        result.ribbonExpanded === true &&
        result.finalFindPaneVisible === true &&
        result.modeOrderCorrect === true &&
        result.logoPresent === true &&
        result.ribbonTabsCorrect === true &&
        result.linkDialogPresent === true &&
        result.imageInsertAbsent === true &&
        result.pasteSpecialOptionsPresent === true &&
        result.defaultPasteSaved === true &&
        result.zoomSliderPresent === true &&
        result.zoomInApplied === true &&
        result.zoomResetApplied === true &&
        typeof result.sidePanes === 'number' &&
        result.sidePanes >= 2 &&
        result.sideActiveEditable === true &&
        result.sideReferenceVisible === true &&
        result.sideLabelsPresent === true &&
        result.multiDocumentPastePreserved === true &&
        result.multiDocumentPasteUndo === true &&
        result.multiDocumentPasteRedo === true &&
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
