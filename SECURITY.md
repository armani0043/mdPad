# Security

Markdown, filenames, workspace contents, preview HTML, and renderer input are untrusted. The main
process is privileged; the renderer is not.

Implemented controls:

- Electron sandbox application-wide; `contextIsolation`, `sandbox`, and `webSecurity` enabled;
  Node integration and insecure content disabled.
- Narrow typed `contextBridge` wrappers; no raw IPC, Node, Electron, or filesystem object exposed.
- Owning-window/main-frame validation and runtime request validation for every privileged invoke.
- Native-picker individual-file capabilities and canonical workspace-root capabilities; traversal
  and real-path escapes rejected and symlink tree entries skipped.
- 64 MiB UTF-8 document limit and 20 MiB local image limit; invalid encodings rejected.
- DOMPurify sanitization for preview, Visual Mode input, and export; raw scripts/frames/objects/forms
  forbidden. Marked output is never used unsanitized.
- Navigation prevented, new windows denied, browser permission requests denied, and external shell
  opening restricted to HTTP(S)/mailto.
- Production CSP permits bundled resources/data images only; no remote script/font/connection.
- Atomic flushed saves, recovery snapshots, external-conflict handling, and recycle-bin deletion.
- No eval, command execution, telemetry, secrets, account, document server, remote document content,
  or renderer filesystem module. The installed Windows build makes at most one connectivity-gated
  startup update request to the configured public GitHub Releases source; failures are silent and
  documents are never transmitted.

Inline styles are permitted because CodeMirror and supported Markdown formatting require them.
Remote images are intentionally blocked. Local preview images are read through a size-limited,
document-relative authorized bridge and returned as data URLs.

Before public release, enable Authenticode signing, produce a complete transitive license/notice
bundle including Electron/Chromium notices, retest on a clean offline Windows VM, and maintain the
dependency/security-update process. Security reports should contain version, reproduction, and impact
but no private user documents.
