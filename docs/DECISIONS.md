# Decision log

## Electron + electron-vite

Use Electron with separate TypeScript main/preload/renderer entries. It provides maintained Windows
desktop integration and Chromium editing while preserving a clear privilege boundary. The cost is
ongoing Electron security updates and a larger binary than native shells.

## CodeMirror and Markdown authority

Use CodeMirror 6 for Source Mode and keep one Markdown string as the sole document authority.
Rendered/visual models are projections only. This maximizes source fidelity, keeps files portable,
and avoids ProseMirror-style schema loss.

## Preservation and atomic saving

Decode valid UTF-8, track BOM/EOL metadata, normalize only the in-memory editor representation to
LF, never write untouched existing files, and serialize through a flushed sibling temporary file
before atomic replacement. LF/CRLF and BOM round-trip; mixed endings become LF only after a real
edit. External reads before saving prevent silent overwrites.

## File/workspace authorization

Treat native Open/Save selections as per-renderer file capabilities and folder selection as one
canonical root capability. Every child request resolves against the root and verifies real paths;
the renderer never receives unrestricted filesystem authority.

## Local metadata without a database

Use small validated atomic JSON under Electron `userData` for session and recovery, plus local
renderer preferences. Search and backlink extraction scan local Markdown at v0.1 scale. No SQLite,
native addon, or proprietary workspace file is justified; caches remain rebuildable.

## Visual editing

Use sanitized contentEditable HTML plus Turndown/GFM, and serialize only after a real visual input
event. This supplies the requested rich actions without replacing Markdown. Untouched mode switching
is a proven no-op; actual visual edits may normalize whitespace, list syntax, or inline HTML and are
therefore explicitly disclosed.

## Rendering and export

Use Marked for GFM, DOMPurify for sanitizer policy, highlight.js locally, and Chromium printing for
PDF. External navigation is denied by default and allow-listed HTTP(S)/mailto URLs use a narrow
shell bridge. There is no cloud conversion or remote renderer content.

## Windows packaging

Use electron-builder 26 with separate NSIS and portable x64 targets. This yields a guided install
and copyable standalone EXE while allowing future Authenticode signing without redesign. Current
development artifacts are unsigned and can trigger SmartScreen.
