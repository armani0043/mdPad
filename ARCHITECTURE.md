# Architecture

## Trust boundaries

- `src/main/` is privileged. It owns native dialogs/menus, file and workspace capabilities,
  canonical path checks, filesystem watching, recovery/state storage, export, and IPC validation.
- `src/preload/` is a sandboxed, isolated bridge exposing one typed wrapper per approved operation.
  It exposes no Node.js, Electron object, shell, or generic IPC primitive.
- `src/renderer/` is an unprivileged React UI containing the document, workspace, and settings
  stores plus CodeMirror, the Visual editor, preview, tabs, toolbar, sidebar, and dialogs.
- `src/shared/` contains process-neutral contracts and pure text/state utilities.

## Source of truth and saving

```text
Markdown bytes on disk
  -> validated/capability-authorized main-process read
  -> UTF-8 + BOM/EOL metadata
  -> one LF-normalized Markdown string per document
  -> Source / Visual / Preview projections
  -> snapshot + conflict check
  -> flushed sibling temporary file
  -> atomic replacement
```

Markdown text is always authoritative. Preview HTML, visual HTML, outlines, tags, backlinks, and
search results are derived and never replace the file model. Dirty state is exact inequality
between current Markdown and the last saved snapshot. Saving records only the submitted snapshot,
so edits made while I/O is in flight stay dirty.

Visual Mode renders sanitized Markdown into `contentEditable`. Merely rendering it never calls the
document store. The first real input converts HTML back through Turndown/GFM. That edit path can
normalize the document and is explicitly disclosed.

## Capabilities and path safety

Native Open/Save grants individual-file capabilities. Selecting a workspace grants one canonical
root capability. Every child request resolves against that root, rejects traversal, and verifies
real paths; symlink entries are not traversed by the tree. Workspace delete uses the Windows
Recycle Bin. Local image reads are authorized relative to the current document.

## Persistence and recovery

Small application/session state is stored as validated atomic JSON under Electron `userData`.
Settings are local renderer preferences. Recovery snapshots are separate local JSON records and
are removed after a successful save/close. No database or proprietary file is written into the
workspace; Markdown files remain portable and authoritative.

## Rendering and export

Marked supplies GFM parsing, DOMPurify sanitizes rendered/visual HTML, and highlight.js operates
locally. Navigation and new-window creation are denied globally; only allow-listed HTTP(S)/mailto
links are handed to the OS. Local HTML/PDF export uses sanitized renderer output and an isolated
hidden print window. No cloud converter is involved.

## Build and distribution

electron-vite creates separate main, CommonJS sandboxed-preload, and renderer bundles in `out/`.
electron-builder packages the ASAR and produces NSIS installer and portable x64 Windows targets in
`release/`. Code-signing configuration can be supplied later through electron-builder without an
architecture change.
