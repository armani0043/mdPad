# Changelog

## 0.1.2 - 2026-08-11

### Fixed

- Registered mdPad as a Windows Default Apps and Open with candidate for `.md` and `.markdown` files.
- Opened the exact Markdown file supplied by Windows instead of creating an unrelated blank document.
- Routed files launched while mdPad is already running into a new or existing tab in the active window.

## 0.1.1 - 2026-08-11

### Fixed

- Prevented the main-process “Object has been destroyed” exception when mdPad closes.

### Changed

- Added a short-lived branded startup splash while the editor window loads.
- Removed the Insert Image ribbon command and its unused native picker.

## 0.1.0 - 2026-08-10

### Added

- Complete offline Windows Markdown editor with Source, Visual, Preview, and Split modes.
- Rich formatting toolbar: fonts, sizes, headings, bold, italic, underline, strike, highlight,
  code, links, images, lists/tasks, quote, table, rule, and text alignment/justification.
- Folder workspace tree with safe create, rename, move, duplicate, recycle-bin delete, reveal,
  filesystem watching, outline, tags, backlinks, and local content search.
- Tabs, session/workspace restoration, recently closed tabs, quick open, command palette, and native
  menus/shortcuts.
- Sanitized GFM preview, internal `[[Document]]` suggestions/navigation, safe local images/links,
  and offline HTML/PDF export.
- Atomic saving, UTF-8 BOM/EOL preservation, external-change conflicts, autosave, local crash
  recovery, and collision-safe relative attachments.
- Persistent themes/editor preferences, status metrics, renderer error boundary, and original icon.
- NSIS installer and standalone portable x64 Windows packaging.
- 50 automated tests plus production renderer/UI smoke coverage.

### Known limitations

- Actual Visual Mode edits may normalize Markdown; untouched mode switching is source-preserving.
- Mixed line endings become LF after a real edit.
- Development installers are unsigned and may display Windows SmartScreen warnings.
